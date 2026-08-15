import React, { useState, useMemo } from "react";
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
import QrScanner, { scannerAvailable } from "./QrScanner";
import { shortDate, shortTime, overdueBy } from "../utils/dates";
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

// Clinical reading order. The old order was Profile, Vaccinations, Allergies,
// Growth, Milestones, Checkups, Nutrition, Medical History — which put the
// two things a clinician needs first (what is this child allergic to, what
// have they had) behind the things they need last.
const SECTION_ORDER = [
    "allergies",
    "medicalHistory",
    "vaccinations",
    "growth",
    "checkups",
    "profile",
    "milestones",
    "nutrition",
];

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
        <ScrollView contentContainerStyle={styles.entryScroll}>
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

function Row({ label, value }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{label}</Text>
            <Text style={styles.dataValue}>{value || "—"}</Text>
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
                <Text style={styles.sectionTitle}>{title}</Text>
                {count != null ? <Text style={styles.sectionCount}>{count}</Text> : null}
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
            <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{title}</Text>
                {sub ? <Text style={styles.itemSub}>{sub}</Text> : null}
                {flag ? <Text style={[styles.itemFlag, { color: tone }]}>{flag}</Text> : null}
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

// The five-second read: who this is, what they react to, and what is overdue.
// Everything here is derived from the snapshot already on screen — no extra
// data, no interpretation, just the facts a clinician would otherwise have to
// assemble by scrolling and doing date arithmetic.
function ClinicalSummary({ payload }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const p = payload || {};
    const dob = p.profile?.dateOfBirth;
    const allergies = (p.allergies?.allergies || []).filter(Boolean);
    const hereditary = (p.allergies?.hereditaryConditions || []).filter(Boolean);
    const overdueCount = (p.vaccinations || []).filter(
        (v) => v.status !== "completed" && v.due_date && overdueBy(v.due_date),
    ).length;
    const ongoing = (p.medicalHistory || []).filter(
        (m) => !m.resolved && (m.category === "Illness" || m.category === "Hospitalization"),
    );

    const identity = [
        dob ? ageText(dob) : null,
        p.profile?.sex,
        p.profile?.bloodType ? `Blood ${p.profile.bloodType}` : null,
    ].filter(Boolean);

    // Only the allergy line is unconditional. It reads "None recorded" rather
    // than disappearing, because a blank allergy field and a child with no
    // known allergies must never look the same to a clinician.
    const allergyShared = !!p.allergies;
    const feeding = feedingSummary(p.nutrition, dob);

    return (
        <View style={styles.summary}>
            {identity.length ? <Text style={styles.summaryIdentity}>{identity.join(" · ")}</Text> : null}

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

        allergies: p.allergies && (
            <Section key="allergies" icon="warning-outline" title={RECORD_LABELS.allergies}>
                <Row
                    label="Allergies"
                    value={(p.allergies.allergies || []).join(", ") || "None recorded"}
                />
                <Row
                    label="Hereditary"
                    value={(p.allergies.hereditaryConditions || []).join(", ") || "None recorded"}
                />
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
                    render={(m, i) => (
                        <Item
                            key={i}
                            tone={m.resolved ? colors.success : colors.danger}
                            statusIcon={m.resolved ? "checkmark-circle" : "alert-circle"}
                            title={`${m.title || m.category} · ${m.category}`}
                            sub={[shortDate(m.date_recorded), m.resolved ? "resolved" : "ongoing"]
                                .filter(Boolean)
                                .join(" · ")}
                        />
                    )}
                />
            </Section>
        ),

        vaccinations: p.vaccinations && (
            <Section
                key="vaccinations"
                icon="medical-outline"
                title={RECORD_LABELS.vaccinations}
                count={p.vaccinations.length}
            >
                {p.vaccinations.length === 0 && <Text style={styles.empty}>No records.</Text>}
                <Capped
                    rows={p.vaccinations}
                    noun="vaccines"
                    render={(v, i) => {
                        const done = v.status === "completed";
                        const late = !done && v.due_date ? overdueBy(v.due_date) : "";
                        return (
                            <Item
                                key={i}
                                tone={done ? colors.success : late ? colors.danger : colors.warning}
                                statusIcon={
                                    done ? "checkmark-circle" : late ? "alert-circle" : "time-outline"
                                }
                                title={v.vaccine_name}
                                sub={[
                                    v.visit_name,
                                    done
                                        ? `given ${shortDate(v.date_given) || "—"}`
                                        : `due ${shortDate(v.due_date) || "—"}`,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                flag={late || null}
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
                                sub={shortDate(g.date_recorded)}
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
                title={RECORD_LABELS.checkups}
                count={p.checkups.length}
            >
                {p.checkups.length === 0 && <Text style={styles.empty}>No records.</Text>}
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
                title={RECORD_LABELS.nutrition}
                count={p.nutrition.length}
            >
                {p.nutrition.length === 0 && <Text style={styles.empty}>No records.</Text>}
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
            </Section>
        ),
    };

    return (
        <ScrollView contentContainerStyle={styles.recScroll}>
            <View style={styles.viewOnlyBanner}>
                <Ionicons name="eye" size={15} color={colors.onPrimary} />
                <Text style={styles.viewOnlyText}>VIEW ONLY · authorized by parent</Text>
            </View>

            <Text style={styles.childName}>{session.childName || "Child"}</Text>
            <Text style={styles.childMeta}>
                {(session.recordKeys || []).length} record types shared · code {session.code}
            </Text>
            <SnapshotTimestamp capturedAt={session.capturedAt} />

            <ClinicalSummary payload={p} />

            {SECTION_ORDER.map((k) => sections[k] || null)}


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
    title: { fontSize: 21, fontWeight: "800", color: colors.primary, textAlign: "center" },
    subtitle: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 6, marginBottom: 18, lineHeight: 17 },
    field: { marginBottom: 14 },
    label: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
    inputWrap: {
        flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceAlt,
        borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, height: 46,
    },
    input: { flex: 1, fontSize: 16, color: colors.text },
    errorBox: {
        flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.dangerBg,
        borderRadius: 10, padding: 10, marginBottom: 12,
    },
    errorText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: "600" },
    accessNotice: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginBottom: 10, lineHeight: 14 },
    viewBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: colors.primary, height: 48, borderRadius: 24, marginTop: 2,
    },
    viewBtnText: { color: colors.onPrimary, fontWeight: "800", fontSize: 14.5 },
    scanHint: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 14 },
    scanHintText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 15 },
    exitLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
    exitText: { fontSize: 13, color: colors.primary, fontWeight: "700" },
    recScroll: { padding: 16, paddingBottom: 40 },
    viewOnlyBanner: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 9, marginBottom: 14,
    },
    viewOnlyText: { color: colors.onPrimary, fontWeight: "800", fontSize: 13, letterSpacing: 1 },
    childName: { fontSize: 24, fontWeight: "900", color: colors.text },
    childMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    snapshotBanner: {
        flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: colors.surfaceAlt,
        borderRadius: 12, padding: 10, marginTop: 10, marginBottom: 14,
    },
    snapshotBannerStale: { backgroundColor: colors.warningBg },
    snapshotText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
    snapshotTextStale: { color: colors.warning, fontWeight: "800" },
    snapshotWarningText: { fontSize: 13, color: colors.warning, marginTop: 3, lineHeight: 15 },
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
    summaryIdentity: { fontSize: 17, fontWeight: "800", color: colors.text },
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
    summaryText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 19 },
    summaryTextAlert: { color: colors.danger, fontWeight: "700" },
    summaryTextWarn: { color: colors.warning, fontWeight: "700" },

    section: {
        // Was a hardcoded "#FFFFFF", which stayed white in dark mode.
        backgroundColor: colors.surface,
        borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    },
    sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.primary, flex: 1 },
    sectionCount: {
        fontSize: 13, fontWeight: "700", color: colors.textMuted,
        backgroundColor: colors.surfaceAlt, borderRadius: 999,
        paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden",
    },
    dataRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.hairline },
    dataLabel: { fontSize: 13, color: colors.textMuted, flex: 1 },
    dataValue: { fontSize: 13, color: colors.text, fontWeight: "700", flex: 1, textAlign: "right" },
    listItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 },
    itemTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    itemSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
    // The one line a clinician scans for: overdue, or a feeding reaction.
    itemFlag: { fontSize: 13, fontWeight: "700", marginTop: 1 },
    showMore: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
        minHeight: 44, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.hairline,
    },
    showMoreText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    empty: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
    readOnlyNote: {
        flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.surfaceAlt,
        borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 14,
    },
    readOnlyText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 15 },
    endBtn: { backgroundColor: colors.accentStrong, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
    endText: { color: colors.onPrimary, fontWeight: "800", fontSize: 14 },
});
