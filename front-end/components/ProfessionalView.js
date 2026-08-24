import React, { useState, useMemo, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RECORD_LABELS } from "../utils/shareStore";
import { api } from "../utils/api";
import { useTheme } from "../context/ThemeContext";
import { space, type, MIN_TOUCH } from "../theme";
import { fitsColumns } from "../utils/responsive";
import QrScanner, { scannerAvailable } from "./QrScanner";
import GrowthChart from "./GrowthChart";
import { shortDate, shortTime, overdueBy, spanText, todayLocal } from "../utils/dates";
import { courseDayText, isActiveOn } from "../utils/medication";
import { feedRowSummary } from "../utils/adapters";
import { ageText } from "./Dashboard";
import {
    WHO_MAX_DAY,
    ageInDays,
    formatPercentile,
    normalizeSex,
    percentileFromZ,
    zScore,
} from "../utils/whoGrowth";

// How many rows of any one record type show before "Show more". The clinician
// this screen serves has, per PRODUCT.md, "a patient in front of them and very
// little time" — and a year of feeding is hundreds of near-identical rows,
// which previously rendered in full and pushed Medical History off the bottom.
// Matches DESIGN.md's app-wide rule (cap at 10, reveal the rest on request).
const PAGE = 10;

// Where the child was cared for, as recorded by the parent. Stated as a fact
// about what the family did — the app assigns no severity and must not start.
const CARE_LABELS = {
    home: "cared for at home",
    doctor: "seen by a doctor",
    hospital: "admitted to hospital",
};

// The snapshot ships snake_case straight from the database, while
// utils/medication.js works on the app's camelCase shape. Rather than teach
// that module two vocabularies, translate the three fields it reads.
const medFromSnapshot = (m) => ({
    date: m.date_recorded ? String(m.date_recorded).slice(0, 10) : "",
    courseDays: m.course_days ?? null,
    resolved: !!m.resolved,
});

// Consultation reading order: what could hurt this child, then what they need
// today, then how they are growing, then history, then context.
//
// The order before this was Profile, Vaccinations, Allergies, Growth,
// Milestones, Checkups, Nutrition, Medical History — which buried the two facts
// a clinician needs first. `allergies` no longer appears as a section at all:
// it is the safety band at the top, and repeating it lower down would only
// invite the two copies to disagree.
const SECTION_ORDER = [
    "vaccinations",
    "growth",
    "medicalHistory",
    "checkups",
    "milestones",
    "nutrition",
    "profile",
];

// growth_records.measured_at (migration 007). Reading only: never rank or
// discount a measurement by where it was taken.
const GROWTH_PLACE = {
    home: "at home",
    health_center: "health centre",
    clinic: "clinic",
    hospital: "hospital",
};

// Short labels for the jump bar. RECORD_LABELS is written for the parent
// choosing what to share ("Allergies & Hereditary Conditions") and is too
// long to sit in a chip.
const SECTION_SHORT = {
    vaccinations: "Immunisation",
    growth: "Growth",
    medicalHistory: "History",
    checkups: "Care",
    milestones: "Development",
    nutrition: "Feeding",
    profile: "Profile",
};

// Secondary actor: healthcare professional. View-only access via a parent's
// consultation code, resolved against the backend (works across devices).
export default function ProfessionalView({ onExit }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [session, setSession] = useState(null);
    const [scanning, setScanning] = useState(false);

    const handleView = async (overrideCode) => {
        // overrideCode is only used by the QR-scan path (a real scanned
        // string). Guard with typeof, not just != null — wiring this
        // function directly to an onPress/onClick prop elsewhere would
        // otherwise pass the press event itself here, which is a truthy
        // object that silently stringifies to "[object Object]".
        const raw = (typeof overrideCode === "string" ? overrideCode : code).trim();
        if (!raw) {
            setError("Enter the consultation code shown in the parent's app.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const r = await api.resolveConsult({
                code: raw,
                professionalName: name.trim(),
            });
            setSession({
                childName: r.childName,
                recordKeys: r.recordKeys || [],
                payload: r.payload || {},
                code: raw.toUpperCase(),
                capturedAt: r.capturedAt,
            });
        } catch (e) {
            const s = e.data && e.data.status;
            if (s === "expired") setError("This code has expired. Ask the parent to generate a new one.");
            else if (s === "revoked") setError("This code was revoked by the parent.");
            // The snapshot could not be opened — purged with the code, or
            // sealed under a key the server no longer has. Refusing is the only
            // safe answer: an empty record set would read as a child with no
            // allergies and no history.
            else if (s === "unavailable")
                setError("These shared records are no longer available. Ask the parent to generate a new code.");
            else if (s === "notfound") setError("Code not found. Please re-check with the parent.");
            else if (s === "invalid") setError("Unrecognized code. Check and try again.");
            else setError(e.message || "Could not resolve the code.");
        } finally {
            setLoading(false);
        }
    };

    const endSession = () => {
        setSession(null);
        setCode("");
        setName("");
        setError("");
    };

    const handleScanned = (data) => {
        setScanning(false);
        setCode(String(data || ""));
        handleView(data);
    };

    if (scanning) {
        return <QrScanner onScanned={handleScanned} onClose={() => setScanning(false)} />;
    }

    if (session) {
        return <RecordsView session={session} onEnd={endSession} onExit={onExit} />;
    }

    return (
        <ScrollView contentContainerStyle={styles.entryScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.entryCard}>
                <View style={styles.logoCircle}>
                    <Ionicons name="medkit" size={26} color={colors.primary} />
                </View>
                <Text style={styles.title}>Healthcare Professional</Text>
                <Text style={styles.subtitle}>
                    View-only access to a child's records, authorized by the parent for this consultation.
                </Text>

                <View style={styles.field}>
                    <Text style={styles.label}>Your Name (for the access log)</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="person-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Dr. Sarah Chen"
                            placeholderTextColor={colors.placeholder}
                            value={name}
                            onChangeText={setName}
                        />
                    </View>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Consultation Code</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="qr-code-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                        <TextInput
                            style={[styles.input, { letterSpacing: 2, fontWeight: "700" }]}
                            placeholder="ABCD-1234"
                            placeholderTextColor={colors.placeholder}
                            autoCapitalize="characters"
                            value={code}
                            onChangeText={setCode}
                        />
                    </View>
                </View>

                {error ? (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={15} color={colors.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <Text style={styles.accessNotice}>
                    Your name, device, and network address will be recorded in the parent's access log.
                </Text>

                <TouchableOpacity style={styles.viewBtn} onPress={() => handleView()} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                        <>
                            <Ionicons name="eye-outline" size={18} color={colors.onPrimary} />
                            <Text style={styles.viewBtnText}>View Records</Text>
                        </>
                    )}
                </TouchableOpacity>

                {scannerAvailable() ? (
                    <TouchableOpacity
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            height: 46,
                            borderRadius: 23,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.softGreen,
                            marginTop: 12,
                        }}
                        onPress={() => {
                            setError("");
                            setScanning(true);
                        }}
                    >
                        <Ionicons name="scan-outline" size={18} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>
                            Scan QR Code
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.scanHint}>
                        <Ionicons name="camera-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.scanHintText}>
                            Camera scanning isn't available here — type the code shown under the parent's QR.
                        </Text>
                    </View>
                )}

                <TouchableOpacity style={styles.exitLink} onPress={onExit}>
                    <Ionicons name="arrow-back" size={14} color={colors.primary} />
                    <Text style={styles.exitText}>Back to parent sign-in</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

function formatCapturedAt(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const datePart = d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${datePart}, ${timePart}`;
}

function SnapshotTimestamp({ capturedAt }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const formatted = formatCapturedAt(capturedAt);
    if (!formatted) return null;

    const ageMs = Date.now() - new Date(capturedAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const stale = ageHours >= 24;

    return (
        <View style={[styles.snapshotBanner, stale && styles.snapshotBannerStale]}>
            <Ionicons
                name={stale ? "warning-outline" : "time-outline"}
                size={14}
                color={stale ? colors.warning : colors.textMuted}
            />
            <View style={{ flex: 1 }}>
                <Text style={[styles.snapshotText, stale && styles.snapshotTextStale]}>
                    Records as of {formatted}
                </Text>
                {stale && (
                    <Text style={styles.snapshotWarningText}>
                        This snapshot is {Math.floor(ageHours / 24)} day{Math.floor(ageHours / 24) === 1 ? "" : "s"} old. Records may have changed since. Ask the parent for a new code.
                    </Text>
                )}
            </View>
        </View>
    );
}

// A label/value pair. Stacks to two lines on a narrow screen rather than
// squeezing both to ~142pt, which wrapped real values ("Metro General
// Hospital") into a ragged two-line column beside a one-line label.
function Row({ label, value }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [width, setWidth] = useState(0);
    const twoCol = fitsColumns(width, 2, space.md);
    return (
        <View
            style={[styles.dataRow, !twoCol && styles.dataRowStacked]}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
            <Text style={styles.dataLabel}>{label}</Text>
            <Text style={[styles.dataValue, !twoCol && styles.dataValueStacked]}>{value || "—"}</Text>
        </View>
    );
}

function Section({ icon, title, count, children }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <View style={styles.section}>
            <View style={styles.sectionHead}>
                <Ionicons name={icon} size={16} color={colors.primary} />
                <Text style={styles.sectionTitle} numberOfLines={2}>
                    {title}
                </Text>
                {count != null ? (
                    <Text style={styles.sectionCount} numberOfLines={1}>
                        {count}
                    </Text>
                ) : null}
            </View>
            {children}
        </View>
    );
}

// One record row. `tone` is a theme status colour and `statusIcon` repeats it
// as a shape — DESIGN.md requires a second, non-colour signal so a state never
// depends on hue alone, which the previous bare coloured dot did.
function Item({ tone, statusIcon, title, sub, flag }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <View style={styles.listItem}>
            <Ionicons name={statusIcon} size={15} color={tone} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemTitle} numberOfLines={2} ellipsizeMode="tail">
                    {title}
                </Text>
                {sub ? (
                    <Text style={styles.itemSub} numberOfLines={3} ellipsizeMode="tail">
                        {sub}
                    </Text>
                ) : null}
                {flag ? (
                    <Text style={[styles.itemFlag, { color: tone }]} numberOfLines={2}>
                        {flag}
                    </Text>
                ) : null}
            </View>
        </View>
    );
}

// Caps a list and offers the rest, mirroring ShowMore elsewhere in the app.
function Capped({ rows, render, noun }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [visible, setVisible] = useState(PAGE);
    const remaining = rows.length - visible;
    return (
        <>
            {rows.slice(0, visible).map(render)}
            {remaining > 0 ? (
                <TouchableOpacity
                    onPress={() => setVisible((v) => v + PAGE)}
                    style={styles.showMore}
                    accessibilityRole="button"
                    accessibilityLabel={`Show more ${noun}, ${remaining} remaining`}
                >
                    <Ionicons name="chevron-down" size={14} color={colors.primary} />
                    <Text style={styles.showMoreText}>
                        Show more {noun} ({remaining} remaining)
                    </Text>
                </TouchableOpacity>
            ) : null}
        </>
    );
}

// The parent's own words about why this consultation is happening — the one
// thing on this screen no record can supply.
//
// Presented as a QUOTE and attributed. It is not a diagnosis, not a triage
// category, and is never parsed for keywords: the app carries the sentence, it
// does not interpret it (PRODUCT.md Principle 5).
function VisitReason({ text }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    if (!text) return null;
    return (
        <View style={styles.reasonCard}>
            <View style={styles.reasonHead}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.reasonLabel}>PARENT'S NOTE — WHY THEY CAME</Text>
            </View>
            <Text style={styles.reasonText}>“{text}”</Text>
        </View>
    );
}

// What the parent chose NOT to share.
//
// This exists because silence was ambiguous in the one place ambiguity is
// dangerous. A withheld section used to render nothing at all, so a clinician
// seeing no allergy line could not tell "none recorded" from "not shared" —
// and would reasonably assume the former. Naming the gaps is the whole point:
// an absent section is now a stated absence.
function NotShared({ recordKeys }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const shared = new Set(recordKeys || []);
    const missing = Object.keys(RECORD_LABELS).filter((k) => !shared.has(k));
    if (!missing.length) return null;
    return (
        <View style={styles.notSharedCard}>
            <Ionicons name="eye-off-outline" size={15} color={colors.warning} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.notSharedTitle}>Not shared by the parent</Text>
                <Text style={styles.notSharedBody}>
                    {missing.map((k) => RECORD_LABELS[k]).join(" · ")}
                </Text>
                <Text style={styles.notSharedHint}>
                    These records exist in the app but were withheld for this consultation. Treat
                    them as unknown, not as empty.
                </Text>
            </View>
        </View>
    );
}

// The five-second read: who this is, what they react to, and what is overdue.
// Everything here is derived from the snapshot already on screen — no extra
// data, no interpretation, just the facts a clinician would otherwise have to
// assemble by scrolling and doing date arithmetic.
function ClinicalSummary({ payload, recordKeys }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const p = payload || {};
    const dob = p.profile?.dateOfBirth;
    // Whether the parent shared the type at all, which is a different question
    // from whether it holds anything. Read from recordKeys rather than from the
    // payload, because an empty shared section and a withheld one both arrive
    // as "nothing to render" otherwise.
    const shared = new Set(recordKeys || []);
    const allergies = (p.allergies?.allergies || []).filter(Boolean);
    const hereditary = (p.allergies?.hereditaryConditions || []).filter(Boolean);
    const overdueCount = (p.vaccinations || []).filter(
        (v) => v.status !== "completed" && v.due_date && overdueBy(v.due_date),
    ).length;
    const ongoing = (p.medicalHistory || []).filter(
        (m) => !m.resolved && (m.category === "Illness" || m.category === "Hospitalization"),
    );
    // What the child is on right now. Kept as its own line rather than folded
    // into "Unresolved", because taking a prescribed medicine is not a problem
    // — it is context, and the single fact a clinician most needs before
    // prescribing anything else.
    const onNow = (p.medicalHistory || []).filter(
        (m) => m.category === "Medication" && isActiveOn(medFromSnapshot(m), todayLocal()),
    );

    // Prior vaccine reactions, promoted from a row buried in the immunisation
    // list. Before giving another dose this is the single most decision-
    // relevant fact on the screen, and it used to be visible only if the
    // clinician happened to scroll to the right row.
    const vaxReactions = (p.vaccinations || []).filter(
        (v) => v.reaction_severity === "mild" || v.reaction_severity === "severe",
    );

    // The allergy line has THREE states, and the third is why this band was
    // rewritten. "Shared but empty" and "withheld" must never look alike:
    // the first means nobody has recorded an allergy, the second means the
    // clinician has not been told either way.
    const allergyShared = shared.has("allergies");
    const feeding = feedingSummary(p.nutrition, dob);

    return (
        <View style={styles.summary}>
            {allergyShared ? (
                <View style={[styles.summaryRow, allergies.length && styles.summaryRowAlert]}>
                    <Ionicons
                        name={allergies.length ? "alert-circle" : "checkmark-circle-outline"}
                        size={16}
                        color={allergies.length ? colors.danger : colors.textMuted}
                        style={{ marginTop: 1 }}
                    />
                    <Text
                        style={[styles.summaryText, allergies.length && styles.summaryTextAlert]}
                    >
                        {allergies.length ? `Allergies: ${allergies.join(", ")}` : "Allergies: none recorded"}
                    </Text>
                </View>
            ) : (
                <View style={[styles.summaryRow, styles.summaryRowWarn]}>
                    <Ionicons name="eye-off" size={16} color={colors.warning} style={{ marginTop: 1 }} />
                    <Text style={[styles.summaryText, styles.summaryTextWarn]}>
                        Allergies: NOT SHARED — ask the parent directly
                    </Text>
                </View>
            )}

            {vaxReactions.length ? (
                <View style={[styles.summaryRow, styles.summaryRowAlert]}>
                    <Ionicons name="warning" size={16} color={colors.danger} style={{ marginTop: 1 }} />
                    <Text style={[styles.summaryText, styles.summaryTextAlert]}>
                        Prior vaccine reaction:{" "}
                        {vaxReactions
                            .map((v) =>
                                [v.vaccine_name, v.reaction_severity, v.reaction]
                                    .filter(Boolean)
                                    .join(" — "),
                            )
                            .join("; ")}
                    </Text>
                </View>
            ) : null}

            {hereditary.length ? (
                <View style={styles.summaryRow}>
                    <Ionicons name="pulse" size={16} color={colors.textMuted} style={{ marginTop: 1 }} />
                    <Text style={styles.summaryText}>Hereditary: {hereditary.join(", ")}</Text>
                </View>
            ) : null}

            {ongoing.length ? (
                <View style={[styles.summaryRow, styles.summaryRowAlert]}>
                    <Ionicons name="medkit" size={16} color={colors.danger} style={{ marginTop: 1 }} />
                    <Text style={[styles.summaryText, styles.summaryTextAlert]}>
                        Unresolved: {ongoing.map((m) => m.title || m.category).join(", ")}
                    </Text>
                </View>
            ) : null}

            {onNow.length ? (
                <View style={styles.summaryRow}>
                    <Ionicons name="flask" size={16} color={colors.info} style={{ marginTop: 1 }} />
                    <Text style={styles.summaryText}>
                        Currently taking:{" "}
                        {onNow
                            .map((m) =>
                                [m.title, m.dose_amount, m.frequency_per_day ? `${m.frequency_per_day}x daily` : null]
                                    .filter(Boolean)
                                    .join(" "),
                            )
                            .join(", ")}
                    </Text>
                </View>
            ) : null}

            {overdueCount > 0 ? (
                <View style={[styles.summaryRow, styles.summaryRowWarn]}>
                    <Ionicons name="time" size={16} color={colors.warning} style={{ marginTop: 1 }} />
                    <Text style={[styles.summaryText, styles.summaryTextWarn]}>
                        {overdueCount} vaccine{overdueCount === 1 ? "" : "s"} past due date
                    </Text>
                </View>
            ) : null}

            {feeding ? (
                <View style={styles.summaryRow}>
                    <Ionicons name="restaurant" size={16} color={colors.textMuted} style={{ marginTop: 1 }} />
                    <Text style={styles.summaryText}>{feeding}</Text>
                </View>
            ) : null}
        </View>
    );
}

// Hides a long, low-signal list behind one tap. Not a cap — everything is
// still reachable; it just stops hundreds of feed rows from sitting between a
// clinician and the next section.
function ShowRaw({ count, children }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [open, setOpen] = useState(false);
    if (!count) return null;
    return (
        <>
            <TouchableOpacity
                onPress={() => setOpen((v) => !v)}
                style={styles.showMore}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${open ? "Hide" : "Show"} the full log of ${count} entries`}
            >
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
                <Text style={styles.showMoreText}>
                    {open ? "Hide" : "Show"} full log ({count} entries)
                </Text>
            </TouchableOpacity>
            {open ? children : null}
        </>
    );
}

// The feeding pattern and every reaction — the two things a clinician can act
// on. feedingSummary() already computed the pattern for the top band; this
// reuses it rather than deriving the same numbers a second way.
function FeedingBrief({ rows, dob }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const summary = feedingSummary(rows, dob);
    const reactions = (rows || []).filter(
        (r) => r.reaction_severity === "mild" || r.reaction_severity === "severe" ||
            (!r.reaction_severity && !!r.reaction),
    );
    if (!summary && !reactions.length) return null;
    return (
        <View style={styles.briefCard}>
            {summary ? <Text style={styles.briefText}>{summary}</Text> : null}
            {reactions.length ? (
                <>
                    <Text style={styles.briefLabel}>
                        FOOD REACTIONS ({reactions.length})
                    </Text>
                    {reactions.map((r, i) => (
                        <Text key={i} style={styles.briefReaction} numberOfLines={3}>
                            {[
                                r.food_introduced || "unspecified food",
                                r.reaction_severity || "reaction",
                                r.reaction,
                                shortDate(r.entry_date),
                            ]
                                .filter(Boolean)
                                .join(" — ")}
                        </Text>
                    ))}
                </>
            ) : (
                <Text style={styles.briefNone}>No food reactions recorded.</Text>
            )}
        </View>
    );
}

// Last seen, and what is already booked. Two facts a clinician reaches for at
// the start of a consultation, pulled out of the date-ordered list rather than
// left to be found in it.
function CareTimeline({ rows }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const today = todayLocal();
    const dated = (rows || []).filter((c) => c.checkup_date);
    const past = dated
        .filter((c) => String(c.checkup_date).slice(0, 10) <= today)
        .sort((a, b) => String(b.checkup_date).localeCompare(String(a.checkup_date)));
    const future = dated
        .filter((c) => String(c.checkup_date).slice(0, 10) > today)
        .sort((a, b) => String(a.checkup_date).localeCompare(String(b.checkup_date)));

    if (!past.length && !future.length) return null;
    const line = (c) =>
        [c.title || "Checkup", c.doctor_name, c.clinic].filter(Boolean).join(" · ");

    return (
        <View style={styles.timelineCard}>
            <View style={styles.timelineCol}>
                <Text style={styles.timelineLabel}>LAST SEEN</Text>
                <Text style={styles.timelineValue} numberOfLines={3}>
                    {past.length
                        ? `${shortDate(past[0].checkup_date)} — ${line(past[0])}`
                        : "No past visit recorded"}
                </Text>
            </View>
            <View style={styles.timelineCol}>
                <Text style={styles.timelineLabel}>SCHEDULED</Text>
                <Text style={styles.timelineValue} numberOfLines={3}>
                    {future.length
                        ? `${shortDate(future[0].checkup_date)} — ${line(future[0])}${
                              future.length > 1 ? ` (+${future.length - 1} more)` : ""
                          }`
                        : "Nothing booked"}
                </Text>
            </View>
        </View>
    );
}

// Percentile movement between the earliest and latest usable measurement.
//
// PRINCIPLE 5 BOUNDARY, and it is a fine one. A percentile is a published
// reference position and the difference between two of them is arithmetic —
// both are facts. "Falling off the curve", "poor growth", "catch-up" are
// verdicts, and none of them appear here or may be added. The app states the
// movement and the interval; reading it is the clinician's job, and they are
// the one person on either side of this screen qualified to do it.
function GrowthTrend({ rows, sex, dateOfBirth }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const sexKey = normalizeSex(sex);

    const lines = useMemo(() => {
        if (!sexKey || !dateOfBirth) return [];
        const out = [];
        for (const [indicator, field, label] of [
            ["weight", "weight", "Weight"],
            ["height", "height", "Height"],
            ["head", "head_circumference", "Head"],
        ]) {
            const usable = (rows || [])
                .filter((r) => r.date_recorded && r[field] != null && r[field] !== "")
                .map((r) => {
                    const day = ageInDays(dateOfBirth, String(r.date_recorded).slice(0, 10));
                    if (day == null || day > WHO_MAX_DAY) return null;
                    const z = zScore(indicator, sexKey, day, Number(r[field]));
                    return z == null ? null : { date: String(r.date_recorded).slice(0, 10), z };
                })
                .filter(Boolean)
                .sort((a, b) => a.date.localeCompare(b.date));
            // Two distinct dates or there is no movement to report.
            if (usable.length < 2) continue;
            const first = usable[0];
            const last = usable[usable.length - 1];
            if (first.date === last.date) continue;
            const p0 = percentileFromZ(first.z);
            const p1 = percentileFromZ(last.z);
            out.push({
                label,
                from: formatPercentile(p0),
                to: formatPercentile(p1),
                span: spanText(first.date, last.date),
                n: usable.length,
            });
        }
        return out;
    }, [rows, sexKey, dateOfBirth]);

    if (!lines.length) return null;

    return (
        <View style={styles.trendCard}>
            <Text style={styles.trendTitle}>WHO percentile, first to latest recorded</Text>
            {lines.map((l, i) => (
                <Text key={i} style={styles.trendRow} numberOfLines={2}>
                    {l.label}: {l.from} → {l.to}
                    <Text style={styles.trendMeta}>
                        {"  "}({l.n} measurements over {l.span})
                    </Text>
                </Text>
            ))}
        </View>
    );
}

// "What does this child need today?" — the question the immunisation list was
// not answering. Overdue doses named and sorted oldest-first, then the next
// scheduled visit with everything falling due on it.
//
// Purely a re-presentation of rows already in the snapshot: no new data, no
// schedule of its own, and no recommendation. Which doses exist and when they
// are due was decided by the EPI generator on the parent's side.
function VaccineStatus({ rows }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const pending = (rows || []).filter((v) => v.status !== "completed" && v.due_date);
    const today = todayLocal();

    const overdue = pending
        .filter((v) => String(v.due_date).slice(0, 10) < today)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

    const upcoming = pending
        .filter((v) => String(v.due_date).slice(0, 10) >= today)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    // Everything due on the same day is one visit, which is how a clinic books
    // it — listing four separate rows for one appointment reads as four trips.
    const nextDate = upcoming.length ? String(upcoming[0].due_date).slice(0, 10) : null;
    const nextBatch = nextDate
        ? upcoming.filter((v) => String(v.due_date).slice(0, 10) === nextDate)
        : [];

    const label = (v) => [v.vaccine_name, v.dose_number ? `dose ${v.dose_number}` : null]
        .filter(Boolean)
        .join(" ");

    if (!overdue.length && !nextBatch.length) return null;

    return (
        <View style={styles.vaxStatus}>
            {overdue.length ? (
                <View style={[styles.vaxBand, styles.vaxBandOverdue]}>
                    <Text style={styles.vaxBandTitle}>
                        {overdue.length} missed {overdue.length === 1 ? "dose" : "doses"}
                    </Text>
                    {overdue.slice(0, 6).map((v, i) => (
                        <Text key={i} style={styles.vaxBandRow} numberOfLines={2}>
                            {label(v)} — {overdueBy(v.due_date)}
                        </Text>
                    ))}
                    {overdue.length > 6 ? (
                        <Text style={styles.vaxBandRow}>+{overdue.length - 6} more, listed below</Text>
                    ) : null}
                </View>
            ) : null}

            {nextBatch.length ? (
                <View style={[styles.vaxBand, styles.vaxBandNext]}>
                    <Text style={styles.vaxBandTitleNext}>
                        Next due {shortDate(nextDate)}
                    </Text>
                    <Text style={styles.vaxBandRowNext} numberOfLines={3}>
                        {nextBatch.map(label).join(" · ")}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

// Compresses the nutrition log into the one line a clinician can use. The
// section itself sits last and caps at 10 rows, so against a real account —
// 300-plus feeds — it shows a handful of recent entries and answers nothing.
// Everything here is counted from the same snapshot already on screen.
function feedingSummary(rows, dob) {
    if (!Array.isArray(rows) || !rows.length) return "";
    const milk = rows.filter((r) => (r.entry_type || "milk") === "milk" && r.entry_date);
    const solids = rows.filter((r) => r.entry_type === "solid" && r.entry_date);
    const parts = [];

    if (milk.length) {
        // Rows arrive newest-first from the snapshot query.
        const current = milk[0].milk_type;
        const breast = milk.filter((r) => r.feed_method === "breast").length;
        const method =
            breast === milk.length ? "at the breast" : breast === 0 ? "by bottle" : "breast and bottle";
        // Feeds a day, measured over the days that actually have entries —
        // averaging across empty days would understate a sparse history.
        const byDay = new Set(milk.map((r) => String(r.entry_date).slice(0, 10)));
        const perDay = byDay.size ? milk.length / byDay.size : 0;
        parts.push(`${current || "Milk"} ${method}, ~${perDay.toFixed(1)} feeds/day`);
    }

    if (solids.length) {
        const first = solids[solids.length - 1];
        const days = dob && first ? ageInDays(dob, first.entry_date) : null;
        const distinct = new Set(
            solids.map((r) => String(r.food_introduced || "").trim().toLowerCase()).filter(Boolean),
        ).size;
        parts.push(
            days != null
                ? `solids from ${Math.round(days / 30.4375)} mo (${distinct} foods)`
                : `${distinct} solid foods introduced`,
        );
    }

    const reactions = solids.filter(
        (r) => r.reaction_severity === "mild" || r.reaction_severity === "severe",
    ).length;
    if (reactions) parts.push(`${reactions} food reaction${reactions === 1 ? "" : "s"} recorded`);

    return parts.join(" · ");
}

function RecordsView({ session, onEnd, onExit }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const p = session.payload || {};
    const sexKey = normalizeSex(p.profile?.sex);
    const dob = p.profile?.dateOfBirth;
    // Measured section offsets for the jump bar. A ref, not state: these are
    // written on every layout pass and nothing should re-render because a
    // section moved two pixels.
    const scrollRef = useRef(null);
    const sectionY = useRef({});

    // Where a measurement sits on the WHO reference. Shown here and nowhere
    // else in this file: a percentile is a published reference position, not a
    // verdict, and the clinician is the person qualified to read it. The app
    // still never labels it (PRODUCT.md, "never imply clinical authority").
    const percentileFor = (indicator, value, dateRecorded) => {
        if (!sexKey || !dob || value == null || value === "") return null;
        const day = ageInDays(dob, String(dateRecorded).slice(0, 10));
        if (day == null || day > WHO_MAX_DAY) return null;
        const z = zScore(indicator, sexKey, day, Number(value));
        if (z == null) return null;
        return formatPercentile(percentileFromZ(z));
    };

    const sections = {
        profile: p.profile && (
            <Section key="profile" icon="person-circle-outline" title={RECORD_LABELS.profile}>
                <Row label="Date of Birth" value={shortDate(p.profile.dateOfBirth)} />
                <Row label="Age" value={p.profile.dateOfBirth ? ageText(p.profile.dateOfBirth) : ""} />
                <Row label="Sex" value={p.profile.sex} />
                <Row label="Blood Type" value={p.profile.bloodType} />
                <Row
                    label="Birth Weight / Length"
                    value={`${p.profile.birthWeight ?? "—"} kg · ${p.profile.birthLength ?? "—"} cm`}
                />
                <Row label="Hospital" value={p.profile.hospital} />
                <Row label="Pediatrician" value={p.profile.pediatrician} />
                <Row label="OB-GYNE" value={p.profile.obgyne} />
                <Row label="Emergency Contact" value={p.profile.emergencyContact} />
            </Section>
        ),


        medicalHistory: p.medicalHistory && (
            <Section
                key="medicalHistory"
                icon="pulse-outline"
                title={RECORD_LABELS.medicalHistory}
                count={p.medicalHistory.length}
            >
                {p.medicalHistory.length === 0 && <Text style={styles.empty}>No records.</Text>}
                <Capped
                    rows={p.medicalHistory}
                    noun="entries"
                    render={(m, i) => {
                        // Every category here has a course now. Medications
                        // were rendered neutral for one pass, correctly, while
                        // `resolved` was a column nothing could ever set for
                        // them — migration 006 made "still taking / finished"
                        // real, so they carry a status again.
                        const isMed = m.category === "Medication";
                        // Coral for a child in hospital right now, amber for an
                        // illness still being got over, green once it is over.
                        // Same ladder the Dashboard's Needs Attention card uses.
                        // A medicine still being taken is teal — informational,
                        // not a problem: a course running as prescribed is not
                        // something to alarm a clinician about.
                        const tone = m.resolved
                            ? colors.success
                            : isMed
                              ? colors.info
                              : m.category === "Hospitalization"
                                ? colors.danger
                                : colors.warning;
                        // Currently on it is the single most decision-relevant
                        // thing on this screen, so it leads the line.
                        const doseLine = isMed
                            ? [
                                  m.dose_amount,
                                  m.frequency_per_day ? `${m.frequency_per_day}x daily` : null,
                              ]
                                  .filter(Boolean)
                                  .join(", ")
                            : "";
                        const treats = isMed && m.treats_id
                            ? (p.medicalHistory.find((x) => String(x.id) === String(m.treats_id)) || {}).title
                            : "";
                        return (
                            <Item
                                key={i}
                                tone={tone}
                                statusIcon={
                                    m.resolved
                                        ? "checkmark-circle"
                                        : isMed
                                          ? "ellipse"
                                          : "alert-circle"
                                }
                                title={`${m.title || m.category} · ${m.category}`}
                                sub={[
                                    shortDate(m.date_recorded),
                                    doseLine,
                                    // How long it ran, which is what a clinician
                                    // is reading this list for. A bare start
                                    // date leaves "three days" and "three
                                    // months" looking identical. A row resolved
                                    // with no end date (possible before
                                    // migration 005) says so plainly rather
                                    // than claiming to be ongoing.
                                    m.resolved
                                        ? m.resolved_date
                                            ? spanText(m.date_recorded, m.resolved_date)
                                            : isMed
                                              ? "finished"
                                              : "resolved"
                                        : isMed
                                          ? courseDayText(m.date_recorded, m.course_days, todayLocal()).toLowerCase()
                                          : spanText(m.date_recorded, ""),
                                    treats ? `for ${treats}` : null,
                                    m.prescribed_by ? `by ${m.prescribed_by}` : null,
                                    CARE_LABELS[m.care_level],
                                    m.facility,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            />
                        );
                    }}
                />
            </Section>
        ),

        vaccinations: p.vaccinations && (
            <Section
                key="vaccinations"
                icon="medical-outline"
                title="Immunisation status"
                count={p.vaccinations.length}
            >
                {p.vaccinations.length === 0 && <Text style={styles.empty}>No records.</Text>}
                {/* The actionable read, above the archive. "18 vaccines past
                    due" told a clinician a number they could not act on; what
                    they need is WHICH, oldest first, and what falls due next.
                    Both are derived from rows already on screen. */}
                <VaccineStatus rows={p.vaccinations} />
                <Capped
                    rows={p.vaccinations}
                    noun="vaccines"
                    render={(v, i) => {
                        const done = v.status === "completed";
                        const late = !done && v.due_date ? overdueBy(v.due_date) : "";
                        // A reaction to a previous dose is among the most
                        // decision-relevant things this screen can carry, and
                        // it could not reach a clinician at all before. It
                        // outranks lateness in the flag slot when present.
                        const reacted =
                            v.reaction_severity === "mild" || v.reaction_severity === "severe";
                        const reactionFlag = reacted
                            ? `${v.reaction_severity} reaction${v.reaction ? `: ${v.reaction}` : ""}`
                            : null;
                        return (
                            <Item
                                key={i}
                                tone={
                                    reacted
                                        ? v.reaction_severity === "severe"
                                            ? colors.danger
                                            : colors.warning
                                        : done
                                          ? colors.success
                                          : late
                                            ? colors.danger
                                            : colors.warning
                                }
                                statusIcon={
                                    reacted
                                        ? "alert-circle"
                                        : done
                                          ? "checkmark-circle"
                                          : late
                                            ? "alert-circle"
                                            : "time-outline"
                                }
                                title={v.vaccine_name}
                                sub={[
                                    v.dose_number ? `dose ${v.dose_number}` : null,
                                    v.visit_name,
                                    done
                                        ? `given ${shortDate(v.date_given) || "—"}`
                                        : `due ${shortDate(v.due_date) || "—"}`,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                flag={reactionFlag || late || null}
                            />
                        );
                    }}
                />
            </Section>
        ),

        growth: p.growth && (
            <Section
                key="growth"
                icon="trending-up-outline"
                title={RECORD_LABELS.growth}
                count={(p.growth.measurements || []).length}
            >
                <Row
                    label="At Birth"
                    value={`${p.growth.birthWeight ?? "—"} kg · ${p.growth.birthLength ?? "—"} cm`}
                />
                {(p.growth.measurements || []).length === 0 && (
                    <Text style={styles.empty}>No measurements.</Text>
                )}
                {/* The chart, not just the numbers. "Is this child tracking or
                    falling off?" is the question this section exists to answer,
                    and a newest-first list capped at 10 could hide the older
                    baseline that makes the comparison possible.

                    GrowthChart is reused exactly as the parent's Dashboard uses
                    it — it reads date_recorded / weight / height /
                    head_circumference, which is the snapshot's own shape, so no
                    adapter is involved and the two screens cannot plot the same
                    child differently. */}
                {(p.growth.measurements || []).length > 0 && dob && sexKey ? (
                    <>
                        {/* `plain` is deliberately NOT passed. The parent's
                            Dashboard card states the percentile in words and
                            drops the outer reference band; this screen keeps
                            the ordinal and both bands, which is the shorthand a
                            clinician reads fluently. */}
                        <GrowthChart
                            rows={p.growth.measurements}
                            sex={p.profile?.sex}
                            dateOfBirth={dob}
                            name={(p.profile?.name || "").split(" ")[0]}
                        />
                        <GrowthTrend
                            rows={p.growth.measurements}
                            sex={p.profile?.sex}
                            dateOfBirth={dob}
                        />
                    </>
                ) : null}
                <Capped
                    rows={p.growth.measurements || []}
                    noun="measurements"
                    render={(g, i) => {
                        // Percentiles are the reason a clinician reads this
                        // section at all; raw centimetres make them do the
                        // reference lookup by hand.
                        const pct = [
                            ["weight", g.weight, "Wt"],
                            ["height", g.height, "Ht"],
                            ["head", g.head_circumference, "HC"],
                        ]
                            .map(([ind, val, label]) => {
                                const s = percentileFor(ind, val, g.date_recorded);
                                return s ? `${label} ${s}` : null;
                            })
                            .filter(Boolean)
                            .join(" · ");
                        return (
                            <Item
                                key={i}
                                tone={colors.info}
                                statusIcon="analytics-outline"
                                title={`${g.weight ?? "—"} kg · ${g.height ?? "—"} cm${
                                    g.head_circumference ? ` · HC ${g.head_circumference} cm` : ""
                                }`}
                                // Where it was taken, when recorded. A clinic
                                // scale and a home scale are different
                                // instruments and the difference is the
                                // clinician's to weigh -- the app states the
                                // fact and stops there (migration 007).
                                sub={[shortDate(g.date_recorded), GROWTH_PLACE[g.measured_at]]
                                    .filter(Boolean)
                                    .join(" · ")}
                                flag={pct ? `${pct} (WHO percentile)` : null}
                            />
                        );
                    }}
                />
            </Section>
        ),

        checkups: p.checkups && (
            <Section
                key="checkups"
                icon="calendar-outline"
                title="Care timeline"
                count={p.checkups.length}
            >
                {p.checkups.length === 0 && <Text style={styles.empty}>No records.</Text>}
                {/* "When were they last seen" and "what is already booked" are
                    two different questions, and a single date-ordered list made
                    a clinician answer both by reading the whole thing. */}
                <CareTimeline rows={p.checkups} />
                <Capped
                    rows={p.checkups}
                    noun="checkups"
                    render={(c, i) => (
                        <Item
                            key={i}
                            tone={c.status === "completed" ? colors.success : colors.warning}
                            statusIcon={c.status === "completed" ? "checkmark-circle" : "time-outline"}
                            title={c.title || "Checkup"}
                            sub={[
                                c.doctor_name,
                                c.clinic,
                                shortDate(c.checkup_date),
                                shortTime(c.time_of_visit),
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        />
                    )}
                />
            </Section>
        ),

        milestones: p.milestones && (
            <Section
                key="milestones"
                icon="ribbon-outline"
                title={RECORD_LABELS.milestones}
                count={p.milestones.length}
            >
                {p.milestones.length === 0 && <Text style={styles.empty}>No records.</Text>}
                <Capped
                    rows={p.milestones}
                    noun="milestones"
                    render={(m, i) => (
                        <Item
                            key={i}
                            tone={m.is_completed ? colors.success : colors.textMuted}
                            statusIcon={m.is_completed ? "checkmark-circle" : "ellipse-outline"}
                            title={m.title}
                            // age_achieved was queried, decrypted and shipped in
                            // the snapshot, then never rendered — and for a
                            // milestone it is the clinically meaningful field.
                            sub={[m.age_achieved, shortDate(m.date_recorded)]
                                .filter(Boolean)
                                .join(" · ")}
                        />
                    )}
                />
            </Section>
        ),

        nutrition: p.nutrition && (
            <Section
                key="nutrition"
                icon="restaurant-outline"
                title="Feeding"
                count={p.nutrition.length}
            >
                {p.nutrition.length === 0 && <Text style={styles.empty}>No records.</Text>}
                {/* Summary first, reactions in full, the raw log last and
                    collapsed.

                    The feed-by-feed log is the least useful thing on this
                    screen: a real account holds hundreds of rows and the cap
                    showed ten recent ones, which answers no clinical question.
                    What a clinician needs from nutrition is the pattern and the
                    reactions — so those lead, and the log stays available
                    rather than being deleted. */}
                <FeedingBrief rows={p.nutrition} dob={dob} />
                <ShowRaw count={p.nutrition.length}>
                <Capped
                    rows={p.nutrition}
                    noun="entries"
                    render={(f, i) => {
                        // Severity drives the tone; free text alone is a
                        // pre-migration row, which still deserves the flag.
                        const severe = f.reaction_severity === "severe";
                        const flagged = severe || f.reaction_severity === "mild" || (!f.reaction_severity && !!f.reaction);
                        return (
                            <Item
                                key={i}
                                tone={severe ? colors.danger : flagged ? colors.warning : colors.info}
                                statusIcon={flagged ? "alert-circle" : "restaurant-outline"}
                                title={
                                    feedRowSummary(f).replace(" • ", " — ") +
                                    (f.formula_brand ? ` (${f.formula_brand})` : "")
                                }
                                sub={[shortDate(f.entry_date), shortTime(f.entry_time)]
                                    .filter(Boolean)
                                    .join(" · ")}
                                flag={
                                    flagged
                                        ? `${severe ? "severe" : "mild"} reaction${f.reaction ? `: ${f.reaction}` : ""}`
                                        : null
                                }
                            />
                        );
                    }}
                />
                </ShowRaw>
            </Section>
        ),
    };

    return (
        <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.recScroll}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.viewOnlyBanner}>
                <Ionicons name="eye" size={15} color={colors.onPrimary} />
                <Text style={styles.viewOnlyText}>VIEW ONLY · authorized by parent</Text>
            </View>

            {/* Identity as one block. Age used to sit in the summary band while
                the name sat above it, so the fact every paediatric judgment
                hangs on was separated from the person it belongs to. */}
            <Text style={styles.childName} numberOfLines={2}>
                {session.childName || "Child"}
            </Text>
            <Text style={styles.childIdentity} numberOfLines={2}>
                {[
                    dob ? ageText(dob) : null,
                    p.profile?.sex,
                    p.profile?.bloodType ? `Blood ${p.profile.bloodType}` : null,
                    dob ? `born ${shortDate(dob)}` : null,
                ]
                    .filter(Boolean)
                    .join(" · ") || "Profile not shared"}
            </Text>
            <Text style={styles.childMeta}>
                {(session.recordKeys || []).length} record types shared · code {session.code}
            </Text>
            <SnapshotTimestamp capturedAt={session.capturedAt} />

            <VisitReason text={p.visitReason} />

            <ClinicalSummary payload={p} recordKeys={session.recordKeys} />

            <NotShared recordKeys={session.recordKeys} />

            {/* Jump bar. Eight sections and several long lists, read by someone
                with a patient in front of them — scrolling to find growth is
                time this screen should not be costing. */}
            {/* One scrolling row rather than a wrapping block: seven chips at a
                real 44pt would otherwise take two rows and ~90pt of a screen
                whose whole purpose is to save the reader time. */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.jumpBar}
            >
                {SECTION_ORDER.filter((k) => sections[k]).map((k) => (
                    <TouchableOpacity
                        key={k}
                        style={styles.jumpChip}
                        onPress={() => {
                            const y = sectionY.current[k];
                            if (y != null && scrollRef.current) {
                                // scrollTo, not scrollToEnd: on react-native-web
                                // the ref is the DOM node, which understands
                                // `top`, while native wants `y`. Passing both
                                // keeps one call working on both.
                                scrollRef.current.scrollTo({ y, top: y, animated: true });
                            }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Jump to ${SECTION_SHORT[k]}`}
                    >
                        <Text style={styles.jumpChipText}>{SECTION_SHORT[k]}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {SECTION_ORDER.map((k) =>
                sections[k] ? (
                    <View
                        key={k}
                        onLayout={(e) => {
                            sectionY.current[k] = e.nativeEvent.layout.y;
                        }}
                    >
                        {sections[k]}
                    </View>
                ) : null,
            )}


            <View style={styles.readOnlyNote}>
                <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
                <Text style={styles.readOnlyText}>
                    These records are read-only. You cannot create, edit, or delete any record. This view has been recorded in the parent's access log.
                </Text>
            </View>

            <TouchableOpacity style={styles.endBtn} onPress={onEnd}>
                <Text style={styles.endText}>End Session</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exitLink} onPress={onExit}>
                <Ionicons name="arrow-back" size={14} color={colors.primary} />
                <Text style={styles.exitText}>Back to parent sign-in</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    entryScroll: { flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: colors.background },
    entryCard: {
        backgroundColor: colors.surface, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: colors.border,
        maxWidth: 440, width: "100%", alignSelf: "center",
    },
    logoCircle: {
        width: 56, height: 56, borderRadius: 16, backgroundColor: colors.softGreen,
        alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14,
        borderWidth: 1, borderColor: colors.border,
    },
    title: { ...type.title, color: colors.primary, textAlign: "center" },
    subtitle: { ...type.caption, color: colors.textMuted, textAlign: "center", marginTop: 6, marginBottom: 18, lineHeight: 18 },
    field: { marginBottom: 14 },
    label: { ...type.subheading, color: colors.textMuted, letterSpacing: 1, marginBottom: 6 },
    inputWrap: {
        flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceAlt,
        borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, height: 46,
    },
    input: { flex: 1, ...type.body, color: colors.text },
    errorBox: {
        flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.dangerBg,
        borderRadius: 10, padding: 10, marginBottom: 12,
    },
    errorText: { flex: 1, ...type.caption, color: colors.danger, fontWeight: "600" },
    accessNotice: { ...type.caption, color: colors.textMuted, textAlign: "center", marginBottom: 10, lineHeight: 18 },
    viewBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: colors.primary, height: 48, borderRadius: 24, marginTop: 2,
    },
    viewBtnText: { color: colors.onPrimary, ...type.label, fontWeight: "800" },
    scanHint: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 14 },
    scanHintText: { flex: 1, ...type.caption, color: colors.textMuted, lineHeight: 18 },
    exitLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
    exitText: { ...type.caption, color: colors.primary, fontWeight: "700" },
    recScroll: { padding: 16, paddingBottom: 40 },
    viewOnlyBanner: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 9, marginBottom: 14,
    },
    viewOnlyText: { color: colors.onPrimary, ...type.caption, fontWeight: "800", letterSpacing: 1 },
    childName: { ...type.display, fontSize: 24, lineHeight: 29, color: colors.text },
    childIdentity: { ...type.bodyStrong, color: colors.textSecondary, marginTop: 2 },
    childMeta: { ...type.caption, color: colors.textMuted, marginTop: 2 },

    // Parent's note. Primary-tinted so it reads as authored content rather than
    // as a system status — and quoted, so it is never mistaken for a clinical
    // assessment the app has made.
    reasonCard: {
        marginTop: space.md,
        padding: space.md,
        borderRadius: 14,
        borderCurve: "continuous",
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    reasonHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    reasonLabel: { ...type.caption, fontWeight: "800", color: colors.primaryDark, letterSpacing: 0.4 },
    reasonText: { ...type.body, color: colors.text, fontStyle: "italic", lineHeight: 23 },

    // Withheld record types. Amber, not coral: this is "you have not been told",
    // which is a caution, not an error or an emergency (DESIGN.md's tone ladder).
    notSharedCard: {
        flexDirection: "row",
        gap: space.sm,
        marginTop: space.md,
        padding: space.md,
        borderRadius: 14,
        borderCurve: "continuous",
        backgroundColor: colors.warningBg,
        borderWidth: 1,
        borderColor: colors.warning,
    },
    notSharedTitle: { ...type.label, color: colors.warning, marginBottom: 2 },
    notSharedBody: { ...type.caption, color: colors.text, lineHeight: 18 },
    notSharedHint: { ...type.caption, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },

    jumpBar: { flexDirection: "row", gap: 6, paddingVertical: space.md, paddingRight: space.md },
    jumpChip: {
        minHeight: MIN_TOUCH,
        justifyContent: "center",
        paddingHorizontal: space.md,
        borderRadius: 999,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.hairline,
    },
    jumpChipText: { ...type.caption, color: colors.textSecondary, fontWeight: "600" },

    vaxStatus: { gap: 8, marginBottom: space.sm },
    vaxBand: { padding: space.sm, borderRadius: 12, borderCurve: "continuous", borderWidth: 1 },
    vaxBandOverdue: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
    vaxBandNext: { backgroundColor: colors.infoBg, borderColor: colors.info },
    vaxBandTitle: { ...type.label, color: colors.danger, marginBottom: 3 },
    vaxBandTitleNext: { ...type.label, color: colors.info, marginBottom: 3 },
    vaxBandRow: { ...type.caption, color: colors.text, lineHeight: 18 },
    vaxBandRowNext: { ...type.caption, color: colors.text, lineHeight: 18 },

    trendCard: {
        marginTop: space.sm,
        padding: space.sm,
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
    },
    trendTitle: { ...type.caption, fontWeight: "800", color: colors.textSecondary, marginBottom: 4 },
    trendRow: { ...type.body, color: colors.text, lineHeight: 22 },
    trendMeta: { ...type.caption, color: colors.textMuted },

    timelineCard: { flexDirection: "row", gap: space.md, marginBottom: space.sm, flexWrap: "wrap" },
    timelineCol: { flex: 1, minWidth: 140 },
    timelineLabel: { ...type.caption, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.4 },
    timelineValue: { ...type.caption, color: colors.text, lineHeight: 18, marginTop: 2 },

    briefCard: {
        padding: space.sm,
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
        marginBottom: space.sm,
    },
    briefText: { ...type.body, color: colors.text, lineHeight: 22 },
    briefLabel: { ...type.caption, fontWeight: "800", color: colors.danger, marginTop: 6, letterSpacing: 0.4 },
    briefReaction: { ...type.caption, color: colors.text, lineHeight: 18, marginTop: 2 },
    briefNone: { ...type.caption, color: colors.textMuted, marginTop: 4 },
    snapshotBanner: {
        flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: colors.surfaceAlt,
        borderRadius: 12, padding: 10, marginTop: 10, marginBottom: 14,
    },
    snapshotBannerStale: { backgroundColor: colors.warningBg },
    snapshotText: { flex: 1, ...type.caption, color: colors.textMuted, fontWeight: "600" },
    snapshotTextStale: { color: colors.warning, fontWeight: "800" },
    snapshotWarningText: { ...type.caption, color: colors.warning, marginTop: 3, lineHeight: 18 },
    // Clinical summary band — the five-second read, above every section.
    summary: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.primary,
        padding: 14,
        marginBottom: 14,
        gap: 8,
    },
    summaryIdentity: { ...type.heading, fontWeight: "800", color: colors.text },
    summaryRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    summaryRowAlert: {
        backgroundColor: colors.dangerBg,
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
        marginHorizontal: -2,
    },
    summaryRowWarn: {
        backgroundColor: colors.warningBg,
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
        marginHorizontal: -2,
    },
    summaryText: { flex: 1, ...type.label, fontWeight: "400", color: colors.textSecondary, lineHeight: 20 },
    summaryTextAlert: { color: colors.danger, fontWeight: "700" },
    summaryTextWarn: { color: colors.warning, fontWeight: "700" },

    section: {
        // Was a hardcoded "#FFFFFF", which stayed white in dark mode.
        backgroundColor: colors.surface,
        borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    },
    sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    sectionTitle: { ...type.bodyStrong, fontSize: 15, fontWeight: "800", color: colors.primary, flex: 1, minWidth: 0 },
    sectionCount: {
        ...type.caption, fontWeight: "700", color: colors.textMuted, flexShrink: 0,
        backgroundColor: colors.surfaceAlt, borderRadius: 999,
        paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden",
    },
    dataRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.hairline },
    dataLabel: { ...type.caption, color: colors.textMuted, flex: 1, minWidth: 0 },
    dataValue: { ...type.caption, color: colors.text, fontWeight: "700", flex: 1, minWidth: 0, textAlign: "right" },
    dataRowStacked: { flexDirection: "column", gap: 2 },
    // Longhand, not `flex: 0` — see the note on Dashboard's statCellStacked.
    dataValueStacked: { textAlign: "left", flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
    listItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 },
    itemTitle: { ...type.label, fontWeight: "700", color: colors.text },
    itemSub: { ...type.caption, color: colors.textMuted, marginTop: 1 },
    // The one line a clinician scans for: overdue, or a feeding reaction.
    itemFlag: { ...type.caption, fontWeight: "700", marginTop: 1 },
    showMore: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
        minHeight: 44, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.hairline,
    },
    showMoreText: { ...type.caption, fontWeight: "700", color: colors.primary },
    empty: { ...type.caption, color: colors.textMuted, fontStyle: "italic" },
    readOnlyNote: {
        flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.surfaceAlt,
        borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 14,
    },
    readOnlyText: { flex: 1, ...type.caption, color: colors.textMuted, lineHeight: 18 },
    endBtn: { backgroundColor: colors.accentStrong, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
    endText: { color: colors.onPrimary, ...type.label, fontWeight: "800" },
});
