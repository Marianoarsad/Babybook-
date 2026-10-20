import RecordIcon, { AllergyIcon, HereditaryIcon, IllnessIcon } from "./ui/RecordIcon";
import { hospitalStayInfo } from "../utils/hospitalStays";
import HospitalStayIcon from "./ui/HospitalStayIcon";
import ViewerImmunizationStatusCard from "./ui/ViewerImmunizationStatusCard";
import SolidFoodIcon from "./ui/SolidFoodIcon";
import MilkIcon from "./ui/MilkIcon";
import { MetricArtwork } from "./ui/FeedingTodayCard";
import { DashboardSurface as ClinicalSurface } from "./ui/ConsultationsAppointmentsCard";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { milkPeriodInfo } from "../utils/milkTypeHistory";
import React, { useEffect, useId, useState, useMemo, useRef } from "react";
import {
    View,
    Text,
    Image,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    AppState,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Field from "./ui/Field";
import Button from "./ui/Button";
import Gradient from "./ui/Gradient";
import KeyboardAvoider from "./ui/KeyboardAvoider";
import { SectionContainerCard, ListEntryCard } from "./common/Cards";
import professionalAccess from "../utils/professionalAccess.cjs";
import consultationLinks from "../utils/consultationLinks.cjs";
import consultationSession from "../utils/consultationSession.cjs";
import { Ionicons } from "@expo/vector-icons";
import { RECORD_LABELS } from "../utils/shareStore";
import { api } from "../utils/api";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { LatestMeasurementsSummary, SolidFoodsSummary, growthMeasurements } from "./common/RecordSummaries";
import { radius, space, type, shadow, MIN_TOUCH, paletteFor, cardHeaderIconStyle } from "../theme";
import { fitsColumns } from "../utils/responsive";
import QrScanner, { scannerAvailable } from "./QrScanner";
import GrowthChart from "./GrowthChart";
import AnimatedReveal from "./ui/AnimatedReveal";
import { shortDate, overdueBy, todayLocal, toLocalISO, numericDate, ageLabel, recentDateRange } from "../utils/dates";
import MedicationIcon from "./ui/MedicationIcon";
import GrowthIcon from "./ui/GrowthIcon";
import { isActiveOn, courseDayText } from "../utils/medication";
import { nutritionToApp, feedVolumeMl } from "../utils/adapters";
import { byMoment, solidFoodStats } from "../utils/feedingStats";
import { ageText } from "./Dashboard";
import { medicationStatus, medicalHistoryRows, conditionDuration } from "../utils/viewerRecords";

// How many rows of any one record type show before "Show more". The clinician
// this screen serves has, per PRODUCT.md, "a patient in front of them and very
// little time" — and a year of feeding is hundreds of near-identical rows,
// which previously rendered in full and pushed Medical History off the bottom.
// Matches DESIGN.md's app-wide rule (cap at 10, reveal the rest on request).
const PAGE = 10;
const { formatConsultationInput, protectConsultation } = professionalAccess;
const { scannedCredentials, clearBrowserConsultation } = consultationLinks;
const { remainingLifetime, watchConsultation } = consultationSession;
// An older custom native build may not include the new module yet. Keep the
// parent app usable, but fail closed when opening protected shared records.
let ScreenCapture = null;
try { ScreenCapture = require("expo-screen-capture"); } catch { /* viewer shows Retry/Exit */ }

function abbreviateAge(value) {
    return String(value ?? "").replace(/\b(months?|years?)\b/gi,
        (unit) => ({ month: "mo", months: "mos", year: "yr", years: "yrs" })[unit.toLowerCase()]);
}

function ProtectedRecordsView(props) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const id = useId();
    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] = useState(Platform.OS === "web" ? "ready" : "loading");
    useEffect(() => {
        if (Platform.OS === "web") return undefined;
        let active = true;
        setStatus("loading");
        const protection = protectConsultation(ScreenCapture || { isAvailableAsync: async () => false },
            Platform.OS, `consultation:${id}:${attempt}`);
        protection.ready.then((ready) => { if (active && ready) setStatus("ready"); },
            () => { if (active) setStatus("error"); });
        return () => {
            active = false;
            protection.dispose().catch(() => console.warn("Could not release consultation capture protection"));
        };
    }, [id, attempt]);

    return <Gradient colors={colors.pageGradient} style={{ flex: 1 }}>
        {status === "ready" ? <RecordsView {...props} /> : (
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.xl,
                paddingTop: space.xl + insets.top, paddingBottom: space.xl + insets.bottom }}>
                <SectionContainerCard title={status === "error" ? "Records Are Protected" : "Protecting Records"}
                    subtitle={status === "error"
                        ? "Screenshot protection could not start. Please retry, update the app, or leave this view."
                        : "Setting up screenshot protection before showing the baby's information."}>
                    {status === "error" ? <Button title="Retry" icon="refresh-outline" onPress={() => setAttempt((v) => v + 1)} /> : null}
                    <Button title="Exit" variant="ghost" onPress={props.onEnd} style={{ marginTop: space.md }} />
                </SectionContainerCard>
            </ScrollView>
        )}
    </Gradient>;
}

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
    "nutrition",
    "medications",
    "medicalHistory",
    "checkups",
    "milestones",
    "growth",
];



// Short labels for the jump bar. RECORD_LABELS is written for the parent
// choosing what to share ("Allergies & Hereditary Conditions") and is too
// long to sit in a chip.
const SECTION_SHORT = {
    vaccinations: "Immunization",
    growth: "Growth",
    medicalHistory: "History",
    medications: "Medications",
    checkups: "Care",
    milestones: "Development",
    nutrition: "Nutrition",
};

// Secondary actor: healthcare professional. View-only access via a parent's
// consultation code, resolved against the backend (works across devices).
export default function ProfessionalView({ onExit, initialShare }) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [name, setName] = useState("");
    const [code, setCode] = useState(initialShare?.code || "");
    const [codeSelection, setCodeSelection] = useState({ start: 0, end: 0 });
    const selectionRef = useRef(codeSelection);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(initialShare?.invalid ? "This sharing link is invalid. Ask the parent for a new QR code." : "");
    const [session, setSession] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [verified, setVerified] = useState(false);
    const tokenRef = useRef(initialShare?.shareToken);
    const requestRef = useRef(null);
    const generation = useRef(0);
    const cancel = () => { generation.current++; requestRef.current?.abort(); requestRef.current = null; };
    useEffect(() => () => cancel(), []);
    useEffect(() => {
        cancel(); setSession(null); setVerified(false); setLoading(false);
        setCode(initialShare?.code || ""); tokenRef.current = initialShare?.shareToken;
        setError(initialShare?.invalid ? "This sharing link is invalid. Ask the parent for a new QR code." : "");
    }, [initialShare]);
    useEffect(() => {
        if (!session) return undefined;
        return watchConsultation({ session, credentials: session.credentials, api, appState: Platform.OS === "web" ? null : AppState,
            onHidden: () => setVerified(false), onReady: () => setVerified(true),
            onEnd: (message) => { setSession(null); setVerified(false); setError(message); } });
    }, [session]);

    const handleView = async (overrideCode) => {
        if (loading) return;
        const raw = (typeof overrideCode === "string" ? overrideCode : code).trim();
        const credentials = scannedCredentials(raw);
        if (!credentials) { setError("Enter the consultation code shown in the parent's app."); return; }
        if (!name.trim() || name.trim().length > 100) { setError("Enter your name before viewing the records."); return; }
        if (tokenRef.current) credentials.shareToken = tokenRef.current;
        cancel();
        const stamp = generation.current, controller = new AbortController();
        requestRef.current = controller;
        const started = performance.now(), timeout = setTimeout(() => controller.abort(), 90000);
        setLoading(true); setError("");
        try {
            const r = await api.resolveConsult({ ...credentials, professionalName: name.trim() }, { signal: controller.signal });
            if (stamp !== generation.current) return;
            const remainingMs = remainingLifetime(r, performance.now() - started);
            if (!remainingMs || r.status !== "ok") throw new Error("This code has expired or its access could not be verified.");
            setVerified(typeof document === "undefined" ? AppState.currentState === "active" : document.visibilityState === "visible");
            setSession({ childName: r.childName, recordKeys: r.recordKeys || [], payload: r.payload || {},
                code: credentials.code, credentials, remainingMs, professionalName: name.trim(), capturedAt: r.capturedAt });
        } catch (e) {
            if (stamp !== generation.current) return;
            const s = e.data?.status;
            if (s === "expired") setError("This code has expired. Ask the parent to generate a new one.");
            else if (s === "revoked") setError("This code was revoked by the parent.");
            else if (s === "unavailable" || s === "unreadable")
                setError("These records cannot be opened safely. Ask the parent for a new code.");
            else if (s === "notfound") setError("Code not found. Please re-check with the parent.");
            else if (s === "invalid") setError("Check your name and consultation code, then try again.");
            else if (e.status === 0) setError("The sharing server may be starting or your connection is unavailable. Wait a minute, then try again.");
            else setError(e.message || "Could not open the records.");
        } finally {
            clearTimeout(timeout);
            if (stamp === generation.current) { requestRef.current = null; setLoading(false); }
        }
    };

    const endSession = () => {
        cancel(); setSession(null); setVerified(false); setLoading(false);
        setCode(""); tokenRef.current = undefined;
        selectionRef.current = { start: 0, end: 0 }; setCodeSelection(selectionRef.current);
        setName(""); setError(""); clearBrowserConsultation();
    };

    const handleScanned = (data) => {
        cancel(); setLoading(false); setScanning(false);
        const credentials = scannedCredentials(data);
        setCode(credentials?.code || ""); tokenRef.current = credentials?.shareToken;
        setError(credentials ? "" : "This QR code is not a valid BabyBook+ sharing link.");
    };

    if (scanning) {
        return <QrScanner onScanned={handleScanned} onClose={() => setScanning(false)} />;
    }

    if (session) {
        return verified ? <ProtectedRecordsView session={session} onEnd={endSession} onExit={onExit} />
            : <Gradient colors={colors.pageGradient} style={styles.root}>
                <View style={{ padding: space.xl + insets.top }}>
                    <SectionContainerCard title="Checking Access" subtitle="Records stay hidden until your access is confirmed.">
                        <Button title="Exit" onPress={endSession} />
                    </SectionContainerCard>
                </View>
            </Gradient>;
    }

    return (
        <Gradient colors={colors.pageGradient} style={styles.root}>
        <KeyboardAvoider>
        <ScrollView contentContainerStyle={[styles.entryScroll, { paddingTop: space.xl + insets.top,
            paddingBottom: space.xl + insets.bottom }]} keyboardShouldPersistTaps="handled">
            <View style={styles.entryCard}>
                <SectionContainerCard title="Healthcare Professional" subtitle="Read-only access to records shared by the parent for this consultation.">
                <View style={styles.logoCircle}>
                    <Ionicons name="medkit" size={26} color={colors.primary} />
                </View>
                <Field
                            label="Your Name (for the access log)"
                            leading={<Ionicons name="person-outline" size={16} color={colors.textMuted} />}
                            placeholder="e.g. Dr. Sarah Chen"
                            maxLength={100}
                            value={name}
                            onChangeText={(next) => { cancel(); setLoading(false); setName(next); }}
                        />

                <Field
                            label="Consultation Code"
                            leading={<Ionicons name="qr-code-outline" size={16} color={colors.textMuted} />}
                            inputStyle={{ ...type.bodyStrong, letterSpacing: 2 }}
                            placeholder="ABCD-1234"
                            autoCapitalize="characters"
                            autoCorrect={false}
                            helper="Capital letters and the dash are added automatically."
                            value={code}
                            selection={codeSelection}
                            onSelectionChange={(event) => {
                                selectionRef.current = event.nativeEvent.selection;
                                setCodeSelection(event.nativeEvent.selection);
                            }}
                            onChangeText={(next) => {
                                cancel(); setLoading(false); tokenRef.current = undefined;
                                const formatted = formatConsultationInput(next, code, selectionRef.current);
                                setCode(formatted.value);
                                selectionRef.current = formatted.selection;
                                setCodeSelection(formatted.selection);
                            }}
                            error={!!error}
                        />

                {error ? (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={15} color={colors.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <Text style={styles.accessNotice}>
                    Your name, device, and network address will be recorded in the parent's access log.
                </Text>

                <Button title="View Records" icon="eye-outline" onPress={() => handleView()} loading={loading} loadingIndicator={false} />
                {loading ? <Text style={styles.accessNotice}>Opening records. If the server is waking up, this can take about a minute.</Text> : null}

                {scannerAvailable() ? (
                    <Button title="Scan QR Code" icon="scan-outline" variant="secondary" style={{ marginTop: space.md }}
                        onPress={() => {
                            setError("");
                            setScanning(true);
                        }}
                    />
                ) : (
                    <View style={styles.scanHint}>
                        <Ionicons name="camera-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.scanHintText}>
                            Camera scanning isn't available here — type the code shown under the parent's QR.
                        </Text>
                    </View>
                )}

                <TouchableOpacity style={styles.exitLink} onPress={onExit} accessibilityRole="button" accessibilityLabel="Back to parent sign-in">
                    <Ionicons name="arrow-back" size={14} color={colors.primary} />
                    <Text style={styles.exitText}>Back to parent sign-in</Text>
                </TouchableOpacity>
                </SectionContainerCard>
            </View>
        </ScrollView>
        </KeyboardAvoider>
        </Gradient>
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
    const { colors, scheme } = useTheme();
    const brand = paletteFor(undefined, "neutral", scheme);
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const formatted = formatCapturedAt(capturedAt);
    if (!formatted) return null;

    const ageMs = Date.now() - new Date(capturedAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const stale = ageHours >= 24;

    return (
        <View style={styles.snapshotContainer}>
            <View style={[styles.snapshotBanner, { backgroundColor: brand.primarySoft }]}>
                <Ionicons
                    name={stale ? "warning-outline" : "time-outline"}
                    size={14}
                    color={brand.primaryDark}
                />
                <Text style={[styles.snapshotText, { color: brand.primaryDark }]}>
                    Records as of {formatted}
                </Text>
            </View>
            {stale && (
                <Text style={styles.snapshotWarningText}>
                    This snapshot is {Math.floor(ageHours / 24)} day{Math.floor(ageHours / 24) === 1 ? "" : "s"} old. Records may have changed since. Ask the parent for a new code.
                </Text>
            )}
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

function ProfileRow({ label, value }) {
    const { colors } = useTheme(), material = colors.clinicalSummary;
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const stacked = width > 0 && width - 28 < (120 + 96) * fontScale + space.md;
    return <View testID="viewer-profile-row" onLayout={event => setWidth(event.nativeEvent.layout.width)}
        style={[styles.profileRow, stacked && styles.profileRowStacked]}>
        <ClinicalSurface colors={material.item} highlight={material.highlight} radius={18} />
        <Text style={[styles.profileLabel, stacked && styles.profileTextStacked]}>{label}</Text>
        <Text selectable style={[styles.profileValue, stacked && styles.profileTextStacked]}>{value || "—"}</Text>
    </View>;
}

export function ViewerChildProfileCard({ session, measurements = [] }) {
    const { colors } = useTheme(), material = colors.clinicalSummary;
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const p = session.payload || {}, dob = p.profile?.dateOfBirth;
    return <SectionContainerCard title="Child Profile" style={styles.profilePanel}
        headerStyle={styles.profileHeader} titleStyle={styles.profileTitle}
        background={<ClinicalSurface colors={material.panel} highlight={material.highlight} radius={24} />}
        icon={<View accessible={false} style={styles.profileIcon}>
            <Image accessible={false} source={require("../assets/header/profile-blue.png")} resizeMode="contain" style={styles.profileArtwork} />
        </View>}>
        <View testID="viewer-child-profile">
            <Text style={styles.childName}>{session.childName || "Child"}</Text>
            {!p.profile ? <Text style={styles.childIdentity}>Profile not shared</Text> : null}
            {p.profile ? <View style={styles.profileRows}>
                <ProfileRow label="Date of Birth" value={shortDate(dob)} />
                <ProfileRow label="Age" value={dob ? abbreviateAge(ageText(dob)) : ""} />
                <ProfileRow label="Sex" value={p.profile.sex} />
                <ProfileRow label="Blood Type" value={p.profile.bloodType} />
                {[["Height (cm)", "height"], ["Weight (kg)", "weight"], ["Head Circumference (cm)", "head_circumference"]].map(([label, field]) =>
                    <ProfileRow key={field} label={label} value={!p.growth ? "Not shared" : measurements[0]?.[field] != null ? String(measurements[0][field]) : "Not recorded"} />)}
                <ProfileRow label="Hospital" value={p.profile.hospital} />
                <ProfileRow label="Pediatrician" value={p.profile.pediatrician} />
                <ProfileRow label="OB-GYNE" value={p.profile.obgyne} />
                {[["First Name", "firstName"], ["Last Name", "lastName"], ["Relationship", "relationship"], ["Contact Number", "contactNumber"]].map(([label, field]) =>
                    <ProfileRow key={field} label={`Emergency Contact ${label}`} value={p.profile.emergencyContactDetails?.[field] || "Not recorded"} />)}
            </View> : null}
            <Text style={styles.childMeta}>{(session.recordKeys || []).length} record types shared · code {session.code}</Text>
        </View>
    </SectionContainerCard>;
}

function Section({ icon, title, count, subtitle, children }) {
    const { colors } = useTheme();
    return <SectionContainerCard title={title} subtitle={subtitle} count={count}
        icon={React.isValidElement(icon) ? icon : <Ionicons name={icon} size={29.16} color={colors.primary}
            style={{ width: 29.16, height: 29.16, lineHeight: 29.16, includeFontPadding: false, textAlign: "center", textAlignVertical: "center" }} />}>
        {children}
    </SectionContainerCard>;
}

function GrowthEntries({ measurements, dob }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [expanded, setExpanded] = useState(false);
    if (!measurements.length) return <Text style={styles.empty}>No measurements.</Text>;
    return <>
        <TouchableOpacity onPress={() => setExpanded((value) => !value)} accessibilityRole="button"
            accessibilityState={{ expanded }} accessibilityLabel={expanded ? "Hide Entries" : "Show Entries"}
            style={{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill }}>
            <Text style={{ ...type.label, color: colors.primary }}>{expanded ? "Hide Entries" : "Show Entries"}</Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.primary} />
        </TouchableOpacity>
        <AnimatedReveal expanded={expanded} contentStyle={{ paddingTop: space.md, paddingBottom: 24 }}>
                <Capped rows={measurements} noun="measurements" animate={false} render={(g, i) => (
                    <Item key={g.id ?? i} tone={colors.recGrowth.on} growthRecord
                        title={numericDate(g.date) || "Date not recorded"}
                        sub={g.day != null ? ageLabel(g.day) : dob ? "Age unavailable" : "Age unavailable — birth date not shared"} />
                )} />
        </AnimatedReveal>
    </>;
}

// One record row. `tone` is a theme status colour and `statusIcon` repeats it
// as a shape — DESIGN.md requires a second, non-colour signal so a state never
// depends on hue alone, which the previous bare coloured dot did.
function Item({ tone, statusIcon, title, sub, dateText, flag, status, statusTone, badge, badges, multiline = false, medicationRecord, hospitalRecord, conditionCategory, growthRecord = false }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <ListEntryCard title={title} subtitle={sub} dateText={dateText} subtitleNumberOfLines={multiline ? 0 : 3} iconAlign="center"
            titleAccessory={status ? <View style={[styles.recordBadge, { backgroundColor: statusTone === "success" ? colors.successBg : colors.warningBg }]}>
                <Text style={{ ...type.caption, color: statusTone === "success" ? colors.success : colors.warning }}>{status}</Text>
            </View> : null}
            icon={conditionCategory ? <RecordIcon category={conditionCategory} /> : hospitalRecord ? <HospitalStayIcon /> : medicationRecord ? <MedicationIcon record={medicationRecord} /> : growthRecord ? <GrowthIcon /> : statusIcon ? <Ionicons name={statusIcon} size={20} color={tone} /> : null}
            iconBg={conditionCategory || hospitalRecord || medicationRecord || growthRecord ? "transparent" : tone === colors.recGrowth.on ? colors.recGrowth.bg : tone === colors.danger ? colors.dangerBg : tone === colors.warning ? colors.warningBg
                : tone === colors.success ? colors.successBg : tone === colors.info ? colors.infoBg : colors.surfaceAlt}
            labelTrailing={!!badge || !!badges?.length} trailingWidth={badges?.length ? "45%" : undefined}
            label={badges?.length ? <View style={styles.medicationBadges}>{badges.map((value, i) =>
                <View key={i} style={styles.medicationBadge}><Text style={styles.recordBadgeText} accessibilityLabel={value}>{value}</Text></View>)}</View>
                : badge ? <View style={styles.recordBadge}><Text style={styles.recordBadgeText} accessibilityLabel={badge}>{badge}</Text></View>
                : flag ? <Text style={[styles.itemFlag, { color: tone }]}>{flag}</Text> : null} />
    );
}

// Caps a list and offers the rest, mirroring ShowMore elsewhere in the app.
function Capped({ rows, render, noun, animate = true, contentStyle }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [visible, setVisible] = useState(PAGE);
    const remaining = rows.length - visible;
    const Container = animate ? AnimatedReveal : React.Fragment;
    return (
        <Container {...(animate ? { contentStyle: contentStyle ? [{ paddingTop: 12, paddingBottom: 24 }, contentStyle] : { paddingTop: 12, paddingBottom: 24 } } : {})}>
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
        </Container>
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
        <SectionContainerCard title="Parent's Note" subtitle="Why they came for this consultation">
            <Text style={styles.reasonText}>“{text}”</Text>
        </SectionContainerCard>
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
        <SectionContainerCard title="Not Shared By The Parent">
        <View style={styles.notSharedCard}>
            <Ionicons name="eye-off-outline" size={15} color={colors.warning} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.notSharedBody}>
                    {missing.map((k) => RECORD_LABELS[k]).join(" · ")}
                </Text>
                <Text style={styles.notSharedHint}>
                    These record types were not included in this consultation. Treat them as unknown, not as empty.
                </Text>
            </View>
        </View>
        </SectionContainerCard>
    );
}

// The five-second read: who this is, what they react to, and what is overdue.
// Everything here is derived from the snapshot already on screen — no extra
// data, no interpretation, just the facts a clinician would otherwise have to
// assemble by scrolling and doing date arithmetic.
function ClinicalRecord({ title, sub, badge }) {
    const { colors } = useTheme(), p = colors.clinicalSummary;
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return <View style={styles.clinicalRecord}>
        <ClinicalSurface colors={p.item} highlight={p.highlight} radius={20} />
        <View style={styles.clinicalRecordBody}><Text style={styles.clinicalRecordTitle}>{title}</Text>
            {sub ? <Text style={styles.feedingText}>{sub}</Text> : null}</View>
        {badge ? <View style={styles.clinicalBadge}><Text style={styles.clinicalBadgeText}>{badge}</Text></View> : null}
    </View>;
}

function ClinicalSection({ title, icon, rows, noun, empty, render, first }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return <View testID={`clinical-section-${noun}`} style={first ? [styles.feedingSection, styles.clinicalFirstSection] : styles.feedingSection}>
        <View style={styles.feedingHeading}>{icon}<Text style={styles.feedingTitle} accessibilityRole="header">{title}</Text></View>
        {rows.length ? <Capped rows={rows} noun={noun} contentStyle={styles.clinicalList} render={render} />
            : <Text style={styles.feedingText}>{empty}</Text>}
    </View>;
}

export function ClinicalSummary({ payload, recordKeys }) {
    const { colors } = useTheme(), material = colors.clinicalSummary;
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const p = payload || {}, shared = new Set(recordKeys || []);
    const allergyShared = shared.has("allergies"), historyShared = shared.has("medicalHistory");
    // Gate before deriving facts, even if an unexpected payload contains excluded data.
    const history = historyShared && Array.isArray(p.medicalHistory) ? p.medicalHistory : [];
    const conditions = medicalHistoryRows({ allergies: allergyShared ? p.allergies : undefined, medicalHistory: history });
    const allergyRecords = allergyShared ? conditions.filter(row => row.category === "Allergy") : [];
    const classifiedAllergies = allergyRecords.filter(row => ["food", "non_food"].includes(row.allergy_type));
    const hereditary = allergyShared ? conditions.filter(row => row.category === "Hereditary Condition") : [];
    const illnesses = history.filter(row => row.category === "Illness");
    const vaccinations = shared.has("vaccinations") && Array.isArray(p.vaccinations) ? p.vaccinations : [];
    const overdueCount = vaccinations.filter(v => v.status !== "completed" && v.due_date && overdueBy(v.due_date)).length;
    const vaxReactions = vaccinations.filter(v => ["mild", "severe"].includes(v.reaction_severity));
    const ongoing = history.filter(m => !m.resolved && ["Illness", "Hospitalization"].includes(m.category));
    const onNow = history.filter(m => m.category === "Medication" && isActiveOn(medFromSnapshot(m), todayLocal()));
    if (!allergyShared && !historyShared && !shared.has("nutrition") && !overdueCount && !vaxReactions.length) return null;
    const unavailable = label => `${label} records unavailable in this shared record.`;
    return <SectionContainerCard title="Clinical Summary" style={styles.clinicalPanel} titleStyle={styles.clinicalTitle}
        headerStyle={styles.clinicalHeader} background={<ClinicalSurface colors={material.panel} highlight={material.highlight} radius={28} />}>
        <View testID="clinical-summary" style={styles.summary}>
            {overdueCount || vaxReactions.length || ongoing.length ? <View testID="clinical-safety-notices" style={styles.clinicalNotices}>
                {overdueCount > 0 ? <View style={[styles.summaryRow, styles.summaryRowWarn]}>
                    <Ionicons name="time" size={18} color={colors.warning} />
                    <Text style={[styles.summaryText, styles.summaryTextWarn]}>{overdueCount} vaccine{overdueCount === 1 ? "" : "s"} past due date</Text>
                </View> : null}
                {vaxReactions.length ? <View style={[styles.summaryRow, styles.summaryRowAlert]}>
                    <Ionicons name="warning" size={18} color={colors.danger} />
                    <Text style={[styles.summaryText, styles.summaryTextAlert]}>Prior vaccine reaction: {vaxReactions.map(v => [v.vaccine_name, v.reaction_severity, v.reaction].filter(Boolean).join(" \u2014 ")).join("; ")}</Text>
                </View> : null}
                {ongoing.length ? <View style={[styles.summaryRow, styles.summaryRowAlert]}>
                    <Ionicons name="medkit" size={18} color={colors.danger} />
                    <Text style={[styles.summaryText, styles.summaryTextAlert]}>Unresolved: {ongoing.map(m => m.title || m.category).join(", ")}</Text>
                </View> : null}
            </View> : null}
            {historyShared ? <ClinicalSection first title="ILLNESS" icon={<IllnessIcon size={40} showBackground={false} />} rows={illnesses} noun="illnesses"
                empty={Array.isArray(p.medicalHistory) ? "No illnesses recorded." : unavailable("Illness")}
                render={(entry, i) => <ClinicalRecord key={entry.id ?? i} title={entry.title || "Illness name not recorded"} />} /> : null}
            {allergyShared ? <ClinicalSection first={!historyShared} title="ALLERGIES" icon={<AllergyIcon size={40} showBackground={false} />} rows={classifiedAllergies} noun="allergies"
                empty={!p.allergies ? unavailable("Allergy") : allergyRecords.length ? "No classified allergies to display." : "No allergies recorded."}
                render={(entry, i) => <ClinicalRecord key={entry.id ?? i} title={entry.title || "Allergy name not recorded"} badge={entry.allergy_type === "food" ? "food" : "non-food"} />} /> : null}
            {allergyShared ? <ClinicalSection title="HEREDITARY" icon={<HereditaryIcon size={40} showBackground={false} />} rows={hereditary} noun="hereditary conditions"
                empty={p.allergies ? "No hereditary conditions recorded." : unavailable("Hereditary")}
                render={(entry, i) => <ClinicalRecord key={entry.id ?? i} title={entry.title || "Condition name not recorded"} />} /> : null}
            {historyShared ? <ClinicalSection title="CURRENTLY TAKING" icon={<MedicationIcon size={40} showBackground={false} />} rows={onNow} noun="medications"
                empty={Array.isArray(p.medicalHistory) ? "No medications currently being taken." : unavailable("Medication")}
                render={(m, i) => <ClinicalRecord key={m.id ?? i} title={m.title || "Medication name not recorded"}
                    sub={[m.dose_amount, Number(m.frequency_per_day) > 0 ? `${m.frequency_per_day} ${Number(m.frequency_per_day) === 1 ? "time" : "times"} a day` : null,
                        courseDayText(medFromSnapshot(m).date, m.course_days, todayLocal())].filter(Boolean).join(" \u2022 ")} />} /> : null}
            {shared.has("nutrition") ? <FeedingSummary rows={p.nutrition} shared first={!historyShared && !allergyShared} /> : null}
        </View>
    </SectionContainerCard>;
}


// "What does this child need today?" — the question the immunisation list was
// not answering. Overdue doses named and sorted oldest-first, then the next
// scheduled visit with everything falling due on it.
//
// Purely a re-presentation of rows already in the snapshot: no new data, no
// schedule of its own, and no recommendation. Which doses exist and when they
// are due was decided by the EPI generator on the parent's side.
// Daily averages share the same logged-day denominator; missing calendar
// days never imply that the baby was not fed. Undated reactions remain visible.
function feedingSummary(rows) {
    const entries = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === "object")
        .map(nutritionToApp).filter((e) => ["milk", "solid"].includes(e.entryType));
    const dated = entries.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date)
        && toLocalISO(new Date(`${e.date}T00:00:00`)) === e.date);
    const days = new Set(dated.map((e) => e.date)).size;
    const milk = dated.filter((e) => e.entryType === "milk");
    const solids = dated.filter((e) => e.entryType === "solid");
    const positive = (value) => Number.isFinite(value) && value > 0;
    const bottles = milk.filter((e) => e.feedMethod === "bottle" && positive(e.quantity)
        && ["mL", "oz", "L"].includes(e.unit)
        && (e.milkType !== "Mixed" || positive(e.breastmilkQuantity)));
    const breast = milk.filter((e) => e.feedMethod === "breast" && positive(e.durationMinutes));
    const average = (total) => days ? Math.round(total / days * 10) / 10 : null;
    return {
        days,
        averages: {
            milk: average(milk.length),
            bottle: bottles.length ? average(bottles.reduce((sum, e) => sum + feedVolumeMl(e), 0)) : null,
            breast: breast.length ? average(breast.reduce((sum, e) => sum + e.durationMinutes, 0)) : null,
            solid: average(solids.length),
        },
        reactions: solidFoodStats(entries.filter((e) => e.entryType === "solid")).reactions.sort((a, b) =>
            Number(b.reactionSeverity === "severe") - Number(a.reactionSeverity === "severe") || byMoment(b, a)),
    };
}

function ReactionWarning({ severity, size = 40 }) {
    const { colors } = useTheme(), p = colors.clinicalSummary;
    const tone = p[severity] || p.unknown;
    const id = "clinical-warning-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <View accessible={false} style={{ width: size, height: size, flexShrink: 0, borderRadius: size / 2 }}>
        <ClinicalSurface colors={tone.surface} highlight={p.highlight} radius={size / 2} />
        <Svg aria-hidden pointerEvents="none" width={size} height={size} viewBox="0 0 40 40" style={{ position: "relative" }}>
            <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">{tone.art.map((c, i) => <Stop key={i} offset={i / 2} stopColor={c} />)}</LinearGradient></Defs>
            <Path d="M17 8q3-5 6 0l12 21q3 5-3 5H8q-6 0-3-5Z" fill={`url(#${id})`} />
            <Path d="M20 14v9m0 5v1" stroke={p.reflection} strokeWidth="3" strokeLinecap="round" />
            <Path d="m9 26 9-16" stroke={p.reflection} strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
        </Svg>
    </View>;
}

function FeedingSummary({ rows, shared, first }) {
    const { colors } = useTheme(), p = colors.clinicalSummary;
    const { fontScale } = useWindowDimensions();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const summary = useMemo(() => shared ? feedingSummary(rows) : null, [rows, shared]);
    const [width, setWidth] = useState(0);
    const scale = Math.max(1, fontScale || 1);
    const columns = !width || (width - 12) / 2 >= 112 * scale ? 2 : 1;
    // Round down fractional web measurements so a pair cannot overflow into separate rows.
    const side = width ? Math.floor((width - 12 * (columns - 1)) / columns) : undefined;
    const inline = side >= 200 * scale;
    const metrics = [
        { key: "milk", label: "Milk", unit: "entries" }, { key: "bottle", label: "Bottle amounts", unit: "mL" },
        { key: "breast", label: "Breastfeeding time", unit: "min" }, { key: "solid", label: "Solid foods", unit: "entries" },
    ];
    const reaction = (e, i) => {
        const tone = p[e.reactionSeverity] || p.unknown;
        return <View key={i} testID={`clinical-reaction-${e.reactionSeverity || "unknown"}`} style={styles.feedingReaction}>
            <ClinicalSurface colors={tone.surface} highlight={p.highlight} radius={20} />
            <ReactionWarning severity={e.reactionSeverity} />
            <View style={styles.feedingReactionDetails}><Text style={styles.feedingLabel}>{e.foodIntroduced || "Food not recorded"}</Text>
                <Text style={styles.feedingText}>{numericDate(e.date) || "Date not recorded"}</Text></View>
            <View style={[styles.clinicalBadge, { backgroundColor: tone.badge }]}><Text style={[styles.clinicalBadgeText, { color: tone.ink }]}>
                {e.reactionSeverity === "severe" ? "Severe" : e.reactionSeverity === "mild" ? "Mild" : "Severity not recorded"}
            </Text></View>
        </View>;
    };
    if (!shared) return null;
    return <View testID="clinical-feeding" style={first ? [styles.feedingSection, styles.clinicalFirstSection] : styles.feedingSection}>
        <View style={styles.feedingHeading}><MilkIcon size={40} showBackground={false} /><Text style={styles.feedingTitle} accessibilityRole="header">FEEDING{" "}
            <Text style={styles.feedingPerDay}>avg per day</Text></Text></View>
        <Text style={styles.feedingAverageHint}>Daily averages across logged days</Text>
        {!Array.isArray(rows) ? <Text style={styles.feedingText}>Feeding records unavailable in this shared record.</Text> : null}
        <View style={styles.feedingMetricRow} testID="feeding-metrics" onLayout={e => setWidth(e.nativeEvent.layout.width)}>
            {metrics.map(metric => <View key={metric.key} testID={`feeding-metric-${metric.key}`}
                style={[styles.feedingMetric, inline && styles.feedingMetricInline, { width: side || "48%" }]}
                accessible accessibilityLabel={`${metric.label}, ${summary.averages[metric.key] == null ? "Not recorded" : `${summary.averages[metric.key]} ${metric.unit} per day`}, across ${summary.days} logged days`}>
                <ClinicalSurface colors={p.item} highlight={p.highlight} radius={22} />
                <View style={styles.feedingMetricIcon}><ClinicalSurface colors={p.icon} highlight={p.highlight} radius={24} />
                    {metric.key === "solid" ? <SolidFoodIcon size={48} showBackground={false} /> : metric.key === "milk" ? <MilkIcon size={48} showBackground={false} />
                        : <MetricArtwork kind={metric.key === "bottle" ? "volume" : "clock"} size={48} />}</View>
                <View style={styles.feedingMetricBody}><Text style={styles.feedingMetricLabel}>{metric.label}</Text>
                    <Text style={[styles.feedingMetricValue, summary.averages[metric.key] == null && styles.feedingMetricUnit]}>
                        {summary.averages[metric.key] == null ? "Not recorded" : <>{summary.averages[metric.key]} <Text style={styles.feedingMetricUnit}>{metric.unit}</Text></>}
                    </Text></View>
            </View>)}
        </View>
        <Text style={styles.clinicalReactionsTitle} accessibilityRole="header">All Reported Food Reactions</Text>
        {summary.reactions.length ? <Capped rows={summary.reactions} noun="food reactions" contentStyle={styles.clinicalReactionsList} render={reaction} />
            : <Text style={styles.feedingText}>{Array.isArray(rows) ? "No food reactions reported." : "Food reaction records unavailable in this shared record."}</Text>}
    </View>;
}

function RecordsView({ session, onEnd, onExit }) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const p = session.payload || {};
    const dob = p.profile?.dateOfBirth;
    const { t } = useLanguage();
    const measurements = useMemo(() => growthMeasurements(p.growth?.measurements, dob), [p.growth, dob]);
    const solids = useMemo(() => (p.nutrition || []).map(nutritionToApp).filter((e) => e.entryType === "solid"), [p.nutrition]);
    // Measured section offsets for the jump bar. A ref, not state: these are
    // written on every layout pass and nothing should re-render because a
    // section moved two pixels.
    const scrollRef = useRef(null);
    const sectionY = useRef({});

    const medicalHistory = medicalHistoryRows(p);
    const medications = (p.medicalHistory || []).filter((m) => m.category === "Medication"
        && ["taking", "completed"].includes(medicationStatus(m, todayLocal())));
    const allergies = medicalHistory.filter((m) => m.category === "Allergy");
    const classifiedAllergies = allergies.filter((m) => ["food", "non_food"].includes(m.allergy_type));
    const hereditary = medicalHistory.filter((m) => m.category === "Hereditary Condition");
    const conditions = medicalHistory.filter((m) => m.category === "Illness");
    const hospitalStays = medicalHistory.filter((m) => m.category === "Hospitalization");
    const medicalSection = (rows, key, title, icon) => (
            <Section
                key={key}
                icon={icon}
                title={title}
                count={key === "medicalHistory" ? hereditary.length + conditions.length + hospitalStays.length + classifiedAllergies.length : rows.length}
            >
                {key === "medicalHistory" && <>
                    <Text style={styles.groupTitle}>Hereditary</Text>
                    {!p.allergies ? <Text style={styles.empty}>Not shared</Text>
                        : hereditary.length === 0 ? <Text style={styles.empty}>No hereditary conditions recorded</Text> : null}
                    {hereditary.length > 0 ? <Capped rows={hereditary} noun="conditions" render={(m, i) => <Item key={m.id ?? i}
                        title={m.title} conditionCategory="Hereditary Condition" multiline sub={[CARE_LABELS[m.care_level], m.facility].filter(Boolean).join("\n")}
                        dateText={numericDate(m.date_recorded)} />} /> : null}
                    <Text style={styles.groupTitle}>Allergy</Text>
                    {!p.allergies ? <Text style={styles.empty}>Not shared</Text>
                        : allergies.length === 0 ? <Text style={styles.empty}>No allergy</Text>
                        : classifiedAllergies.length === 0 ? <Text style={[styles.empty, styles.allergySpacing]}>No classified allergies to display</Text> : null}
                    {["food", "non_food"].map((kind) => {
                        const entries = classifiedAllergies.filter((m) => m.allergy_type === kind);
                        return entries.length > 0 ? <View key={kind}>
                            <Text style={styles.groupTitle}>{kind === "food" ? "Food" : "Non-food"}</Text>
                            <Capped rows={entries} noun="allergies" render={(m, i) => <View key={m.id ?? i} style={styles.allergySpacing}><Item
                                title={m.title} conditionCategory="Allergy" multiline sub={[m.description, CARE_LABELS[m.care_level], m.facility].filter(Boolean).join("\n")}
                                dateText={numericDate(m.date_recorded)} /></View>} />
                        </View> : null;
                    })}
                </>}
                {key === "medications" && rows.length === 0 ? <Text style={styles.empty}>No medications to display</Text> : null}
                {(key === "medications" ? ["taking", "completed"] : ["conditions", ...(hospitalStays.length ? ["hospital"] : [])]).map((group) => {
                    const medGroup = key === "medications";
                    const entries = medGroup ? rows.filter((m) => medicationStatus(m, todayLocal()) === group)
                        : group === "hospital" ? hospitalStays : conditions;
                    return <View key={group}>
                    <Text style={styles.groupTitle}>{group === "taking" ? "Taking" : group === "completed" ? "Completed" : group === "hospital" ? "Hospital Stays" : "Conditions"}</Text>
                    {!medGroup && group === "conditions" && entries.length === 0 && p.medicalHistory
                        ? <Text style={styles.empty}>No conditions recorded</Text> : null}
                    {!medGroup && group === "conditions" && !p.medicalHistory ? <Text style={styles.empty}>Illness records not shared</Text> : null}
                    {medGroup && rows.length > 0 && entries.length === 0 ? <Text style={styles.empty}>
                        {group === "taking" ? "No medications currently being taken" : "No completed medications"}</Text> : null}
                    <Capped
                    rows={entries}
                    noun="entries"
                    render={(m, i) => {
                        const isMed = m.category === "Medication";
                        const state = isMed ? medicationStatus(m, todayLocal()) : m.resolved === true ? "completed" : m.resolved === false ? "active" : "Status not recorded";
                        const completed = state === "completed";
                        const treats = isMed && m.treats_id
                            ? (p.medicalHistory.find((x) => String(x.id) === String(m.treats_id)) || {}).title : "";
                        const doseBadge = [m.dose_amount,
                            m.frequency_per_day ? `${m.frequency_per_day}x daily` : null,
                            m.course_days ? `${m.course_days} days` : null].filter(Boolean);
                        return <Item key={m.id ?? i} conditionCategory={m.category === "Illness" ? "Illness" : undefined} medicationRecord={isMed ? m : undefined} hospitalRecord={m.category === "Hospitalization" ? m : undefined} tone={completed ? colors.success : colors.warning}
                            statusIcon={!isMed && completed ? "checkmark-circle" : null}
                            status={m.category === "Hospitalization" ? hospitalStayInfo(m).statusLabel : isMed || completed ? null : state} statusTone={completed ? "success" : "warning"}
                            title={`${m.title || m.category}${["Illness", "Medication"].includes(m.category) ? "" : ` · ${m.category}`}`}
                            badges={isMed ? doseBadge : undefined}
                            badge={isMed ? undefined : m.category === "Hospitalization" ? hospitalStayInfo(m).durationLabel : conditionDuration(m, todayLocal())} multiline
                            sub={[treats ? `for ${treats}` : null, m.prescribed_by ? `by ${m.prescribed_by}` : null,
                                CARE_LABELS[m.care_level], m.facility,
                                m.allergy_type ? `${m.allergy_type === "food" ? "Food" : "Non-food"} allergy` : null].filter(Boolean).join("\n")}
                            dateText={numericDate(m.date_recorded) || "Date not recorded"} />;
                    }}
                />
                </View>;
                })}
            </Section>
    );

    const sections = {
        medicalHistory: (p.medicalHistory || p.allergies) && medicalSection(medicalHistory, "medicalHistory", RECORD_LABELS.medicalHistory, "pulse-outline"),
        medications: p.medicalHistory && medicalSection(medications, "medications", "Medication", <MedicationIcon size={30} showBackground={false} />),
        vaccinations: session.recordKeys?.includes("vaccinations") && Array.isArray(p.vaccinations) && (
            <ViewerImmunizationStatusCard key={`vaccinations-${session.code}-${session.capturedAt || ""}`} rows={p.vaccinations} />
        ),

        growth: p.growth && (
            <Section key="growth" icon={<GrowthIcon size={29.16} showBackground={false} />} title={RECORD_LABELS.growth}>
                <LatestMeasurementsSummary measurement={measurements[0] || null} plain />
                {dob ? <GrowthChart rows={p.growth.measurements || []} dateOfBirth={dob}
                    title={t("growthLast30DaysTitle")} plain showMetricDots={false} dateWindow={recentDateRange(30, dob)}
                    emptyMessage={t("growthNoMeasurementsLast30Days")} />
                    : <Text style={styles.empty}>The growth chart needs a birth date, which was not shared.</Text>}
                <View style={{ marginTop: space.md, marginBottom: space.md }}>
                    <Text style={{ ...type.bodyStrong, color: colors.text, marginBottom: space.sm }}>At Birth</Text>
                    <Row label="Height" value={p.growth.birthLength != null ? `${p.growth.birthLength} cm` : "Not recorded"} />
                    <Row label="Weight" value={p.growth.birthWeight != null ? `${p.growth.birthWeight} kg` : "Not recorded"} />
                    <Row label="Head Circumference" value={p.growth.birthHeadCircumference != null ? `${p.growth.birthHeadCircumference} cm` : "Not recorded"} />
                </View>
                <GrowthEntries key={session.code} measurements={measurements} dob={dob} />
            </Section>
        ),

        checkups: p.checkups && (
            <Section
                key="checkups"
                icon="calendar-outline"
                title="Appointments & Checkups"
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
                            multiline
                            title={c.title || "Checkup"}
                            sub={[
                                c.doctor_name,
                                c.clinic,
                            ]
                                .filter(Boolean)
                                .join("\n")}
                            dateText={numericDate(c.checkup_date) || "Date not recorded"}
                        />
                    )}
                />
            </Section>
        ),

        milestones: p.milestones && (
            <Section
                key="milestones"
                icon={<RecordIcon category="milestone" size={29.16} showBackground={false} />}
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
                            badge={abbreviateAge(m.age_achieved) || "Age not recorded"}
                            dateText={numericDate(m.date_recorded) || "Date not recorded"}
                        />
                    )}
                />
            </Section>
        ),

        nutrition: p.nutrition && (
            <React.Fragment key="nutrition">
            <Section icon={<MilkIcon size={29.16} showBackground={false} />} title="Milk Type Periods" subtitle="Saved periods, separate from individual feeding entries">
                {Array.isArray(p.milkTypePeriods) ? p.milkTypePeriods.length ? p.milkTypePeriods.map(record => {
                    const period = milkPeriodInfo(record, String(session.capturedAt || todayLocal()).slice(0, 10));
                    return <View key={record.id} style={{ paddingVertical: space.md, gap: space.xs }}>
                        <Text style={{ ...type.bodyStrong, color: colors.text }}>{period.type}</Text>
                        <Text style={{ ...type.caption, color: colors.textSecondary }}>{period.dateLabel}</Text>
                        {record.notes ? <Text style={{ ...type.caption, color: colors.textSecondary }}>{record.notes}</Text> : null}
                    </View>;
                }) : <Text style={{ ...type.caption, color: colors.textMuted }}>No saved milk-type periods in this snapshot.</Text>
                    : <Text style={{ ...type.caption, color: colors.textMuted }}>Milk-type periods were not included in this older share.</Text>}
            </Section>
            <Section key="nutrition" icon={<SolidFoodIcon size={29.16} showBackground={false} />} title="Solid Foods"
                subtitle="Foods this child has tried">
                <SolidFoodsSummary solids={solids} dob={dob} readOnly />
            </Section>
            </React.Fragment>
        ),
    };

    return (
        <ScrollView
            ref={scrollRef}
            style={styles.root}
            contentContainerStyle={[styles.recScroll, { paddingTop: space.lg + insets.top,
                paddingBottom: space.xl + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
        >
            <TouchableOpacity style={styles.backButton} onPress={onEnd} accessibilityRole="button" accessibilityLabel="Back to consultation access">
                <Ionicons name="chevron-back" size={22} color={colors.text} />
                <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <SnapshotTimestamp capturedAt={session.capturedAt} />
            <ViewerChildProfileCard session={session} measurements={measurements} />

            <VisitReason text={p.visitReason} />

            <ClinicalSummary payload={p} recordKeys={session.recordKeys} />

            <NotShared recordKeys={session.recordKeys} />
            <Text style={styles.groupTitle}>Record Shortcuts</Text>

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
                                const offset = Math.max(0, y - insets.top - space.lg);
                                scrollRef.current.scrollTo({ y: offset, top: offset, animated: true });
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

            <Button title="End Session" icon="log-out-outline" onPress={onEnd} />
            <TouchableOpacity style={styles.exitLink} onPress={onExit} accessibilityRole="button" accessibilityLabel="Back to parent sign-in">
                <Ionicons name="arrow-back" size={14} color={colors.primary} />
                <Text style={styles.exitText}>Back to parent sign-in</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    root: { flex: 1 },
    entryScroll: { flexGrow: 1, justifyContent: "center", padding: space.xl },
    entryCard: { maxWidth: 440, width: "100%", alignSelf: "center" },
    logoCircle: {
        width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.primarySoft,
        alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: space.lg,
    },
    errorBox: {
        flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.dangerBg,
        borderRadius: radius.md, padding: space.md, marginBottom: space.md,
    },
    errorText: { flex: 1, ...type.label, color: colors.danger },
    accessNotice: { ...type.caption, color: colors.textMuted, marginBottom: space.lg },
    scanHint: { flexDirection: "row", gap: space.sm, alignItems: "center", marginTop: space.lg },
    scanHintText: { flex: 1, ...type.caption, color: colors.textMuted },
    exitLink: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, marginTop: space.md },
    exitText: { ...type.label, color: colors.primary },
    recScroll: { padding: space.xl },
    backButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", minHeight: MIN_TOUCH,
        gap: space.xs, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surface, marginBottom: space.lg },
    backText: { ...type.label, color: colors.text },
    profilePanel: { padding: 18, borderWidth: 0, borderRadius: 24, backgroundColor: colors.clinicalSummary.panel[0], boxShadow: colors.clinicalSummary.panelShadow },
    profileHeader: { marginBottom: 16 },
    profileTitle: { ...type.bodyStrong, fontSize: 18, lineHeight: 24, color: colors.clinicalSummary.secondary, textTransform: "none" },
    profileIcon: { ...cardHeaderIconStyle, width: 40, height: 40 },
    profileArtwork: { width: 30, height: 30 },
    childName: { ...type.title, fontSize: 24, lineHeight: 30, color: colors.clinicalSummary.text, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.clinicalSummary.divider },
    childIdentity: { ...type.body, color: colors.clinicalSummary.secondary, marginTop: 16 },
    profileRows: { paddingTop: 16, gap: 10 },
    profileRow: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: 18, boxShadow: colors.clinicalSummary.itemShadow },
    profileLabel: { ...type.body, fontSize: 14, lineHeight: 20, color: colors.clinicalSummary.secondary, flex: 1.25, minWidth: 0 },
    profileValue: { ...type.bodyStrong, fontSize: 15, lineHeight: 22, color: colors.clinicalSummary.text, flex: 1, minWidth: 0, textAlign: "right" },
    profileRowStacked: { flexDirection: "column", alignItems: "stretch", gap: 4 },
    profileTextStacked: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", textAlign: "left" },
    childMeta: { ...type.caption, lineHeight: 20, color: colors.clinicalSummary.secondary, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.clinicalSummary.divider },
    reasonText: { ...type.body, color: colors.text, fontStyle: "italic" },

    // Withheld record types. Amber, not coral: this is "you have not been told",
    // which is a caution, not an error or an emergency (DESIGN.md's tone ladder).
    notSharedCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.warningBg,
        borderWidth: 1,
        borderColor: colors.warning,
    },
    notSharedBody: { ...type.body, color: colors.text },
    notSharedHint: { ...type.caption, color: colors.textSecondary, marginTop: space.sm },

    jumpBar: { flexDirection: "row", gap: space.sm, paddingBottom: space.lg },
    jumpChip: {
        minHeight: MIN_TOUCH,
        justifyContent: "center",
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
    },
    jumpChipText: { ...type.label, color: colors.primaryDark },




    snapshotContainer: { width: "100%", gap: space.sm, marginBottom: space.md },
    snapshotBanner: {
        flexDirection: "row", alignItems: "center", alignSelf: "flex-start", maxWidth: "100%", gap: space.sm,
        borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm,
    },
    snapshotText: { flexShrink: 1, ...type.caption },
    snapshotWarningText: { ...type.caption, color: colors.warning, lineHeight: 18 },
    clinicalPanel: { padding: 16, borderRadius: 28, borderWidth: 0, backgroundColor: colors.clinicalSummary.panel[0], boxShadow: colors.clinicalSummary.panelShadow },
    clinicalHeader: { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 20 },
    clinicalTitle: { ...type.heading, fontSize: 25, lineHeight: 32, color: colors.clinicalSummary.text, textTransform: "none" },
    summary: { gap: 22 }, clinicalNotices: { gap: 12 },
    summaryRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 16 },
    summaryRowAlert: { backgroundColor: colors.dangerBg }, summaryRowWarn: { backgroundColor: colors.warningBg },
    summaryText: { flex: 1, ...type.body, color: colors.textSecondary },
    summaryTextAlert: { ...type.bodyStrong, color: colors.danger }, summaryTextWarn: { ...type.bodyStrong, color: colors.warning },
    feedingSection: { borderTopWidth: 1, borderTopColor: colors.clinicalSummary.divider, paddingTop: 14, gap: 14 },
    clinicalFirstSection: { borderTopWidth: 0, paddingTop: 0 },
    feedingHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
    feedingTitle: { ...type.subheading, fontSize: 16, lineHeight: 22, color: colors.clinicalSummary.text, includeFontPadding: false, flexShrink: 1 },
    feedingPerDay: { ...type.caption, fontFamily: type.body.fontFamily, fontWeight: type.body.fontWeight,
        color: colors.clinicalSummary.secondary, textTransform: "none", letterSpacing: 0 },
    feedingText: { ...type.body, fontSize: 13, lineHeight: 20, color: colors.clinicalSummary.secondary },
    feedingLabel: { ...type.bodyStrong, fontSize: 15, lineHeight: 22, color: colors.clinicalSummary.text },
    clinicalList: { paddingTop: 0, paddingBottom: 0, gap: 12 },
    clinicalRecord: { minHeight: 52, padding: 14, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", boxShadow: colors.clinicalSummary.itemShadow },
    clinicalRecordBody: { flex: 1, minWidth: 100, gap: 4 },
    clinicalRecordTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 22, color: colors.clinicalSummary.text },
    clinicalBadge: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: colors.clinicalSummary.icon[0], alignSelf: "center", maxWidth: "100%", boxShadow: colors.clinicalSummary.badgeShadow },
    clinicalBadgeText: { ...type.caption, fontSize: 13, lineHeight: 18, color: colors.clinicalSummary.secondary },
    feedingReaction: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", borderRadius: 20, padding: 12, gap: 10, minHeight: 76, boxShadow: colors.clinicalSummary.itemShadow },
    feedingReactionDetails: { flex: 1, minWidth: 80, gap: 3 },
    clinicalReactionsList: { paddingTop: 0, paddingBottom: 0, gap: 14 },
    clinicalReactionsTitle: { ...type.subheading, fontSize: 17, lineHeight: 24, color: colors.clinicalSummary.text, marginTop: 6, textTransform: "none" },
    feedingAverageHint: { ...type.caption, fontSize: 13, lineHeight: 20, color: colors.clinicalSummary.secondary },
    feedingMetricUnit: { ...type.caption, color: colors.clinicalSummary.secondary },
    feedingMetricRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 12 },
    feedingMetric: { minHeight: 164, alignItems: "flex-start", padding: 12, gap: 8, borderRadius: 22, boxShadow: colors.clinicalSummary.itemShadow },
    feedingMetricInline: { flexDirection: "row", alignItems: "center", gap: 12 },
    feedingMetricIcon: { width: 48, height: 48, borderRadius: 24, flexShrink: 0 },
    feedingMetricBody: { alignSelf: "stretch", minWidth: 0, gap: 5, flexShrink: 1, justifyContent: "center" },
    feedingMetricLabel: { ...type.caption, fontSize: 13, lineHeight: 19, color: colors.clinicalSummary.secondary, textAlign: "left" },
    feedingMetricValue: { ...type.heading, fontSize: 24, lineHeight: 31, color: colors.clinicalSummary.text, textAlign: "left" },

    dataRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.hairline },
    dataLabel: { ...type.caption, color: colors.textMuted, flex: 1, minWidth: 0 },
    dataValue: { ...type.bodyStrong, color: colors.text, flex: 1, minWidth: 0, textAlign: "right" },
    dataRowStacked: { flexDirection: "column", gap: space.xs },
    // Longhand, not `flex: 0` — see the note on Dashboard's statCellStacked.
    dataValueStacked: { textAlign: "left", flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
    // The one line a clinician scans for: overdue, or a feeding reaction.
    itemFlag: { ...type.label },
    recordBadge: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: space.xs, maxWidth: 136 },
    recordBadgeText: { ...type.caption, color: colors.textSecondary, textAlign: "center" },
    medicationBadges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: space.xs, minWidth: 0 },
    medicationBadge: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: space.xs, maxWidth: "100%", minWidth: 0, flexShrink: 1 },
    allergySpacing: { paddingBottom: space.sm },
    groupTitle: { ...type.body, fontWeight: "700", color: colors.text, marginTop: space.md, marginBottom: space.sm },
    showMore: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm,
        minHeight: MIN_TOUCH, marginTop: space.xs, borderTopWidth: 1, borderTopColor: colors.hairline,
    },
    showMoreText: { ...type.label, color: colors.primary },
    empty: { ...type.caption, color: colors.textMuted, fontStyle: "italic" },
    readOnlyNote: {
        flexDirection: "row", gap: space.sm, alignItems: "center", backgroundColor: colors.surface,
        borderRadius: radius.md, padding: space.md, marginBottom: space.lg,
    },
    readOnlyText: { flex: 1, ...type.caption, color: colors.textMuted, lineHeight: 18 },
});
