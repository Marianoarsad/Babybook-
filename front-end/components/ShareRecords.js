import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    View,
    Text,
    Image,
    StyleSheet,
    TouchableOpacity,    ActivityIndicator,
    Animated,
    Easing,
    Platform,
    TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QrCodeView from "./QrCodeView";
import { ageText } from "./Dashboard";
import { RECORD_LABELS, qrPayloadForCode, VISIT_REASON_MAX } from "../utils/shareStore";
import { exportChildRecordsPdf, pdfExportAvailable } from "../utils/exportPdf";
import { api } from "../utils/api";
import { useToast } from "./ui/Toast";
import { useTheme } from "../context/ThemeContext";
import { motion, shadow, space, type, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
import { EmptyStateCard } from "./common/Cards";
import { useRefreshControl } from "./ui/useRefreshControl";
import ShowMore from "./ui/ShowMore";
import TipStrip from "./ui/TipStrip";

// Turns a raw user-agent string into a short readable summary, e.g. "Chrome on Android".
function parseUserAgent(ua) {
    if (!ua) return null;
    const browser = /Edg\//.test(ua) ? "Edge"
        : /Chrome\//.test(ua) ? "Chrome"
        : /Firefox\//.test(ua) ? "Firefox"
        : /Safari\//.test(ua) ? "Safari"
        : "Browser";
    const os = /Android/.test(ua) ? "Android"
        : /iPhone|iPad|iOS/.test(ua) ? "iOS"
        : /Windows/.test(ua) ? "Windows"
        : /Mac OS X/.test(ua) ? "Mac"
        : /Linux/.test(ua) ? "Linux"
        : null;
    return os ? `${browser} on ${os}` : browser;
}

const TTL_OPTIONS = [
    { label: "15 min", min: 15 },
    { label: "1 hour", min: 60 },
    { label: "24 hours", min: 1440 },
];

export default function ShareRecords({ profile }) {
    const toast = useToast();
    const alert = (m) => toast.error(m);
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();

    const { scrollProps } = useScroll();
    const allKeys = Object.keys(RECORD_LABELS);
    const [selected, setSelected] = useState(() => new Set(allKeys));
    const [ttl, setTtl] = useState(60);
    const [visitReason, setVisitReason] = useState("");
    const [generating, setGenerating] = useState(false);
    const [activeShare, setActiveShare] = useState(null);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [history, setHistory] = useState([]);
    const [accessLog, setAccessLog] = useState([]);
    const [historyVisible, setHistoryVisible] = useState(10);
    const [logVisible, setLogVisible] = useState(10);
    const [avatarBroken, setAvatarBroken] = useState(false);
    const [loading, setLoading] = useState(true);

    // Reveal pulse for the freshly-generated QR — reassures the parent that
    // something just happened, mirrors Skeleton.js's useNativeDriver gating.
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (!activeShare) return;
        const leg = (toValue) =>
            Animated.timing(pulseAnim, {
                toValue,
                duration: motion.pulse.duration / 2,
                easing: Easing.bezier(...motion.pulse.bezier),
                useNativeDriver: Platform.OS !== "web",
            });
        Animated.sequence(
            Array.from({ length: motion.pulse.cycles }).flatMap(() => [
                leg(motion.pulse.scale),
                leg(1),
            ]),
        ).start();
    }, [activeShare, pulseAnim]);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [shares, log] = await Promise.all([
                api.listShares(profile.id),
                api.accessLog(profile.id),
            ]);
            setHistory(shares);
            setAccessLog(log);
            api.markAccessLogSeen(profile.id).catch(() => {});
        } catch (e) {
            console.log("share refresh:", e.message);
        } finally {
            setLoading(false);
        }
    }, [profile.id]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const refreshControl = useRefreshControl(loading, refresh);

    const toggle = (key) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleGenerate = async () => {
        const keys = allKeys.filter((k) => selected.has(k));
        if (keys.length === 0) return;
        setGenerating(true);
        try {
            const share = await api.createShare(profile.id, {
                recordKeys: keys,
                ttlMinutes: ttl,
                visitReason: visitReason.trim(),
            });
            setActiveShare(share);
            toast.success("Ready to show the doctor");
            await refresh();
        } catch (e) {
            alert(e.message || "Could not generate QR");
        } finally {
            setGenerating(false);
        }
    };

    const handleRevoke = async (id) => {
        try {
            await api.revokeShare(profile.id, id);
            if (activeShare && activeShare.id === id) setActiveShare(null);
            await refresh();
        } catch (e) {
            alert(e.message || "Could not revoke");
        }
    };

    // Prints exactly what step 1 has ticked — the same selection a QR code
    // would carry, so paper and screen can't disagree. The key names in
    // RECORD_LABELS already match the PDF template's CATEGORY_LABELS, so
    // there is no mapping table in between to drift. Untick "Allergies" and
    // the printout has no allergy line either.
    const handleExportPdf = async () => {
        if (selected.size === 0) return;
        setExportingPdf(true);
        try {
            await exportChildRecordsPdf(profile, { scope: new Set(selected) });
        } catch (e) {
            alert(e.message || "Could not export records");
        } finally {
            setExportingPdf(false);
        }
    };

    const expiryText = (iso) => {
        const ms = new Date(iso).getTime() - Date.now();
        if (ms <= 0) return "expired";
        const mins = Math.round(ms / 60000);
        if (mins < 60) return `in ${mins} min`;
        return `in ${Math.round(mins / 60)} h`;
    };

    // ---- result view ----
    if (activeShare) {
        const keys = activeShare.shared_record_keys || [];
        return (
            <Animated.ScrollView
                contentContainerStyle={[styles.scroll, { paddingTop: padTop, paddingBottom: padBottom }]}
                refreshControl={refreshControl}
                keyboardShouldPersistTaps="handled"
                {...scrollProps}
            >
                <View style={styles.resultCard}>
                    <View style={styles.identityRow}>
                        {profile.avatarUrl && !avatarBroken ? (
                            <Image
                                source={{ uri: profile.avatarUrl }}
                                style={styles.identityAvatar}
                                onError={() => setAvatarBroken(true)}
                            />
                        ) : (
                            <View style={[styles.identityAvatar, styles.identityAvatarFallback]}>
                                <Ionicons name="person" size={20} color={colors.primary} />
                            </View>
                        )}
                        <View>
                            <Text style={styles.identityName}>{profile.name}</Text>
                            <Text style={styles.identityAge}>{ageText(profile.dateOfBirth)}</Text>
                        </View>
                    </View>

                    <View style={styles.shieldRow}>
                        <Ionicons name="qr-code" size={18} color={colors.primary} />
                        <Text style={styles.resultTitle}>Consultation QR Ready</Text>
                    </View>
                    <Text style={styles.resultSub}>
                        Show this to the healthcare professional. Access is view-only and expires {expiryText(activeShare.expiration_date)}.
                    </Text>

                    <Animated.View style={[styles.qrWrap, { transform: [{ scale: pulseAnim }] }]}>
                        <QrCodeView value={qrPayloadForCode(activeShare.code)} size={230} />
                    </Animated.View>

                    <Text style={styles.codeLabel}>OR ENTER CODE</Text>
                    <Text style={styles.codeText}>{activeShare.code}</Text>

                    <View style={styles.sharedChips}>
                        {keys.map((k) => (
                            <View key={k} style={styles.chip}>
                                <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                                <Text style={styles.chipText}>{RECORD_LABELS[k]}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.resultBtns}>
                        <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevoke(activeShare.id)}>
                            <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                            <Text style={styles.revokeText}>Revoke Now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.doneBtn} onPress={() => setActiveShare(null)}>
                            <Text style={styles.doneText}>New Share</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.ScrollView>
        );
    }

    // ---- builder view ----
    return (
        <Animated.ScrollView
                contentContainerStyle={[styles.scroll, { paddingTop: padTop, paddingBottom: padBottom }]}
                refreshControl={refreshControl}
                keyboardShouldPersistTaps="handled"
                {...scrollProps}
            >
            <TipStrip tipKey="tip_share">
                Pick what a doctor may see, then show them the code. Access is read-only and expires on its own.
            </TipStrip>

            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.h1}>Share for Consultation</Text>
                    <Text style={styles.h2}>
                        Generate a QR code that lets a healthcare professional view selected records — temporarily and view-only.
                    </Text>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>1 · Choose records to share</Text>
                {allKeys.map((k) => {
                    const on = selected.has(k);
                    return (
                        <TouchableOpacity key={k} style={styles.recRow} onPress={() => toggle(k)}>
                            <View style={[styles.checkbox, on && styles.checkboxOn]}>
                                {on && <Ionicons name="checkmark" size={13} color={colors.onPrimary} />}
                            </View>
                            <Text style={styles.recLabel}>{RECORD_LABELS[k]}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* The one thing on the professional's screen that no record can
                supply: why you are there today. Optional, and deliberately
                asks for the concern in the parent's own words — the app must
                never nudge a parent toward naming a diagnosis. */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>2 · What is this visit about?</Text>
                <Text style={styles.reasonHint}>
                    Optional. Whatever you write here is shown first to the healthcare
                    professional, in your own words.
                </Text>
                <TextInput
                    style={styles.reasonInput}
                    value={visitReason}
                    onChangeText={setVisitReason}
                    placeholder="e.g. Coughing for 4 days, worse at night, not eating well"
                    placeholderTextColor={colors.placeholder}
                    multiline
                    maxLength={VISIT_REASON_MAX}
                    textAlignVertical="top"
                    accessibilityLabel="What this visit is about"
                />
                <Text style={styles.reasonCount}>
                    {visitReason.length}/{VISIT_REASON_MAX}
                </Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>3 · Access expires after</Text>
                <View style={styles.ttlRow}>
                    {TTL_OPTIONS.map((o) => (
                        <TouchableOpacity
                            key={o.min}
                            style={[styles.ttlBtn, ttl === o.min && styles.ttlBtnOn]}
                            onPress={() => setTtl(o.min)}
                        >
                            <Text style={[styles.ttlText, ttl === o.min && styles.ttlTextOn]}>{o.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                {ttl >= 1440 && (
                    <Text style={styles.ttlHint}>Longer codes may show older data by the time they're viewed.</Text>
                )}
            </View>

            <TouchableOpacity
                style={[styles.genBtn, selected.size === 0 && { opacity: 0.5 }]}
                onPress={handleGenerate}
                disabled={generating || selected.size === 0}
            >
                {generating ? (
                    <ActivityIndicator color={colors.onPrimary} />
                ) : (
                    <>
                        <Ionicons name="qr-code" size={18} color={colors.onPrimary} />
                        <Text style={styles.genText}>Generate Consultation QR</Text>
                    </>
                )}
            </TouchableOpacity>

            {/* Paper alternative to the QR, not a follow-up to it — for a
                clinic with no scanner, or a parent with no signal. Prints the
                same selection ticked above, so the two routes always carry
                the same records. */}
            {pdfExportAvailable() ? (
                <TouchableOpacity
                    style={[styles.printBtn, selected.size === 0 && { opacity: 0.5 }]}
                    onPress={handleExportPdf}
                    disabled={exportingPdf || selected.size === 0}
                    accessibilityRole="button"
                    accessibilityLabel="Save or print the selected records as a PDF"
                >
                    <Ionicons name="print-outline" size={16} color={colors.primaryDark} />
                    <Text style={styles.printBtnText}>
                        {exportingPdf ? "Preparing…" : "Save or print as PDF"}
                    </Text>
                </TouchableOpacity>
            ) : null}

            {!loading && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Active & recent shares</Text>
                    {history.length === 0 && (
                        <EmptyStateCard message="No shares yet. Generate a QR code above." icon="qr-code-outline" />
                    )}
                    {history.slice(0, historyVisible).map((s) => (
                        <View key={s.id} style={styles.histRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.histCode}>{s.code}</Text>
                                <Text style={styles.histMeta}>
                                    {(s.shared_record_keys || []).length} record types ·{" "}
                                    {s.status === "active" ? `expires ${expiryText(s.expiration_date)}` : s.status}
                                </Text>
                            </View>
                            <View style={[styles.statusPill, s.status === "active" ? styles.pillActive : styles.pillDim]}>
                                <Text style={[styles.pillText, s.status === "active" ? { color: colors.shared } : { color: colors.textMuted }]}>
                                    {s.status}
                                </Text>
                            </View>
                            {s.status === "active" && (
                                <TouchableOpacity onPress={() => handleRevoke(s.id)} style={styles.histRevoke}>
                                    <Ionicons name="close" size={16} color={colors.danger} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                    <ShowMore
                        total={history.length}
                        visible={historyVisible}
                        onPress={() => setHistoryVisible((c) => c + 10)}
                        noun="shares"
                    />
                </View>
            )}

            {!loading && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Access log · who viewed records</Text>
                    {accessLog.length === 0 && (
                        <EmptyStateCard message="No one has viewed shared records yet." icon="eye-outline" />
                    )}
                    {accessLog.slice(0, logVisible).map((l) => (
                        <View key={l.id} style={styles.logRow}>
                            <Ionicons name="eye-outline" size={15} color={colors.primary} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.logWho}>{l.professional_name}</Text>
                                <Text style={styles.logMeta}>
                                    {l.action} · code {l.code} ·{" "}
                                    {new Date(l.access_date).toLocaleString()}
                                </Text>
                                <Text style={styles.logMeta}>
                                    {[parseUserAgent(l.user_agent), l.ip_address].filter(Boolean).join(" · ") || "Device info unavailable"}
                                </Text>
                            </View>
                        </View>
                    ))}
                    <ShowMore
                        total={accessLog.length}
                        visible={logVisible}
                        onPress={() => setLogVisible((c) => c + 10)}
                        noun="log entries"
                    />
                </View>
            )}

            <View style={styles.privacyNote}>
                <Ionicons name="lock-closed" size={14} color={colors.primary} />
                <Text style={styles.privacyText}>
                    You control exactly what is shared. The professional can view — never edit, add, or delete. Every view is recorded in your access log.
                </Text>
            </View>
        </Animated.ScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    scroll: { padding: space.lg },
    headerRow: { flexDirection: "row", marginBottom: 16 },
    h1: { ...type.title, fontWeight: "800", color: colors.primary },
    h2: { ...type.caption, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
    card: {
        backgroundColor: colors.surface, borderRadius: 20, padding: 16,
        borderWidth: 1, borderColor: colors.border, marginBottom: 14,
    },
    cardTitle: { ...type.caption, fontWeight: "800", color: colors.primary, marginBottom: 12 },
    // 44pt: the visible checkbox is 22 and was the whole target.
    recRow: { flexDirection: "row", alignItems: "center", minHeight: MIN_TOUCH, paddingVertical: 9 },
    checkbox: {
        width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.borderStrong,
        alignItems: "center", justifyContent: "center", marginRight: 12, backgroundColor: colors.surface,
    },
    checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    recLabel: { flex: 1, minWidth: 0, ...type.body, color: colors.text, fontWeight: "500" },
    ttlRow: { flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 4 },
    ttlHint: { ...type.caption, color: colors.textMuted, marginTop: 8, lineHeight: 18 },
    reasonHint: { ...type.caption, color: colors.textMuted, marginBottom: space.sm, lineHeight: 18 },
    reasonInput: {
        ...type.body,
        color: colors.text,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        borderCurve: "continuous",
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        minHeight: 88,
    },
    reasonCount: { ...type.caption, color: colors.textMuted, textAlign: "right", marginTop: space.xs },
    ttlBtn: { flex: 1, minWidth: 0, minHeight: MIN_TOUCH, justifyContent: "center", paddingVertical: 9, borderRadius: 9, alignItems: "center" },
    ttlBtnOn: { backgroundColor: colors.surface, shadowColor: colors.text, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
    ttlText: { ...type.caption, fontWeight: "600", color: colors.textMuted },
    ttlTextOn: { color: colors.primary, fontWeight: "800" },
    genBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: colors.accentStrong, height: 50, borderRadius: 25, marginBottom: 16,
        shadowColor: colors.accentStrong, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 3,
    },
    genText: { color: colors.onPrimary, ...type.label, fontWeight: "800" },
    histRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
    histCode: { ...type.label, fontWeight: "800", color: colors.text, letterSpacing: 1 },
    histMeta: { ...type.caption, color: colors.textMuted, marginTop: 2 },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginHorizontal: 8 },
    pillActive: { backgroundColor: colors.sharedBg },
    pillDim: { backgroundColor: colors.surfaceAlt },
    pillText: { ...type.caption, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
    histRevoke: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
    logRow: {
        flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8,
        borderTopWidth: 1, borderTopColor: colors.surfaceAlt,
    },
    logWho: { ...type.caption, fontWeight: "700", color: colors.text },
    logMeta: { ...type.caption, color: colors.textMuted, marginTop: 1 },
    privacyNote: {
        flexDirection: "row", gap: 8, backgroundColor: colors.softGreen, borderRadius: 14, padding: 14, alignItems: "flex-start",
    },
    privacyText: { flex: 1, ...type.caption, color: colors.primaryDark, lineHeight: 18 },
    resultCard: {
        backgroundColor: colors.surface, borderRadius: 24, padding: 20, alignItems: "center",
        borderWidth: 1, borderColor: colors.border,
        ...shadow.active(colors.info),
    },
    identityRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", gap: space.sm, marginBottom: space.md },
    identityAvatar: { width: 40, height: 40, borderRadius: 20, borderCurve: "continuous", borderWidth: 2, borderColor: colors.info },
    identityAvatarFallback: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
    identityName: { ...type.heading, color: colors.text },
    identityAge: { ...type.caption, color: colors.textMuted, marginTop: 1 },
    shieldRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    resultTitle: { ...type.heading, fontWeight: "800", color: colors.primary },
    resultSub: { ...type.caption, color: colors.textMuted, textAlign: "center", lineHeight: 18, marginBottom: 16 },
    qrWrap: {
        padding: 10, backgroundColor: colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: colors.border, marginBottom: 14,
    },
    codeLabel: { ...type.caption, fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 2 },
    codeText: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: 3, marginTop: 2, marginBottom: 14 },
    sharedChips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginBottom: 18 },
    // maxWidth plus a shrinkable label. "Medical History (Illnesses,
    // Medications, Hospitalizations)" is wider than the card, and a chip that
    // can neither wrap nor shrink overflowed both of its edges.
    chip: {
        flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.softGreen,
        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, maxWidth: "100%",
    },
    chipText: { ...type.caption, color: colors.primaryDark, fontWeight: "700", flexShrink: 1 },
    printBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
        width: "100%", height: 46, borderRadius: 23, marginBottom: 16,
        backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.primaryDark,
    },
    // primaryDark, not primary: this sits on surfaceAlt, where primary
    // measures 4.20:1 — under AA. Same reason the button it replaces on the
    // Health screen used primaryDark.
    printBtnText: { color: colors.primaryDark, ...type.caption, fontWeight: "800" },
    resultBtns: { flexDirection: "row", gap: 10, width: "100%" },
    revokeBtn: {
        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
        height: 46, borderRadius: 23, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger,
    },
    revokeText: { color: colors.danger, ...type.caption, fontWeight: "800" },
    doneBtn: { flex: 1, alignItems: "center", justifyContent: "center", height: 46, borderRadius: 23, backgroundColor: colors.primary },
    doneText: { color: colors.onPrimary, ...type.caption, fontWeight: "800" },
});
