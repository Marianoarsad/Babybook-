import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QrCodeView from "./QrCodeView";
import { RECORD_LABELS, qrPayloadForCode } from "../utils/shareStore";
import { api } from "../utils/api";
import { useToast } from "./ui/Toast";

const TTL_OPTIONS = [
    { label: "15 min", min: 15 },
    { label: "1 hour", min: 60 },
    { label: "24 hours", min: 1440 },
];

export default function ShareRecords({ profile }) {
    const toast = useToast();
    const alert = (m) => toast.error(m);
    const allKeys = Object.keys(RECORD_LABELS);
    const [selected, setSelected] = useState(() => new Set(allKeys));
    const [ttl, setTtl] = useState(60);
    const [generating, setGenerating] = useState(false);
    const [activeShare, setActiveShare] = useState(null);
    const [history, setHistory] = useState([]);
    const [accessLog, setAccessLog] = useState([]);

    const refresh = useCallback(async () => {
        try {
            const [shares, log] = await Promise.all([
                api.listShares(profile.id),
                api.accessLog(profile.id),
            ]);
            setHistory(shares);
            setAccessLog(log);
        } catch (e) {
            console.log("share refresh:", e.message);
        }
    }, [profile.id]);

    useEffect(() => {
        refresh();
    }, [refresh]);

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
            });
            setActiveShare(share);
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
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.resultCard}>
                    <View style={styles.shieldRow}>
                        <Ionicons name="qr-code" size={18} color="#456155" />
                        <Text style={styles.resultTitle}>Consultation QR Ready</Text>
                    </View>
                    <Text style={styles.resultSub}>
                        Show this to the healthcare professional. Access is view-only and expires {expiryText(activeShare.expiration_date)}.
                    </Text>

                    <View style={styles.qrWrap}>
                        <QrCodeView value={qrPayloadForCode(activeShare.code)} size={230} />
                    </View>

                    <Text style={styles.codeLabel}>OR ENTER CODE</Text>
                    <Text style={styles.codeText}>{activeShare.code}</Text>

                    <View style={styles.sharedChips}>
                        {keys.map((k) => (
                            <View key={k} style={styles.chip}>
                                <Ionicons name="checkmark-circle" size={12} color="#456155" />
                                <Text style={styles.chipText}>{RECORD_LABELS[k]}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.resultBtns}>
                        <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevoke(activeShare.id)}>
                            <Ionicons name="close-circle-outline" size={16} color="#C2410C" />
                            <Text style={styles.revokeText}>Revoke Now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.doneBtn} onPress={() => setActiveShare(null)}>
                            <Text style={styles.doneText}>New Share</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        );
    }

    // ---- builder view ----
    return (
        <ScrollView contentContainerStyle={styles.scroll}>
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
                                {on && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                            </View>
                            <Text style={styles.recLabel}>{RECORD_LABELS[k]}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>2 · Access expires after</Text>
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
            </View>

            <TouchableOpacity
                style={[styles.genBtn, selected.size === 0 && { opacity: 0.5 }]}
                onPress={handleGenerate}
                disabled={generating || selected.size === 0}
            >
                {generating ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <>
                        <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                        <Text style={styles.genText}>Generate Consultation QR</Text>
                    </>
                )}
            </TouchableOpacity>

            {history.length > 0 && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Active & recent shares</Text>
                    {history.map((s) => (
                        <View key={s.id} style={styles.histRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.histCode}>{s.code}</Text>
                                <Text style={styles.histMeta}>
                                    {(s.shared_record_keys || []).length} record types ·{" "}
                                    {s.status === "active" ? `expires ${expiryText(s.expiration_date)}` : s.status}
                                </Text>
                            </View>
                            <View style={[styles.statusPill, s.status === "active" ? styles.pillActive : styles.pillDim]}>
                                <Text style={[styles.pillText, s.status === "active" ? { color: "#15803D" } : { color: "#78716C" }]}>
                                    {s.status}
                                </Text>
                            </View>
                            {s.status === "active" && (
                                <TouchableOpacity onPress={() => handleRevoke(s.id)} style={styles.histRevoke}>
                                    <Ionicons name="close" size={16} color="#C2410C" />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            )}

            {accessLog.length > 0 && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Access log · who viewed records</Text>
                    {accessLog.map((l) => (
                        <View key={l.id} style={styles.logRow}>
                            <Ionicons name="eye-outline" size={15} color="#456155" />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.logWho}>{l.professional_name}</Text>
                                <Text style={styles.logMeta}>
                                    {l.action} · code {l.code} ·{" "}
                                    {new Date(l.access_date).toLocaleString()}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.privacyNote}>
                <Ionicons name="lock-closed" size={14} color="#456155" />
                <Text style={styles.privacyText}>
                    You control exactly what is shared. The professional can view — never edit, add, or delete. Every view is recorded in your access log.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 16, paddingBottom: 40 },
    headerRow: { flexDirection: "row", marginBottom: 16 },
    h1: { fontSize: 22, fontWeight: "800", color: "#456155" },
    h2: { fontSize: 12.5, color: "#78716C", marginTop: 4, lineHeight: 17 },
    card: {
        backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16,
        borderWidth: 1, borderColor: "#F2F2F2", marginBottom: 14,
    },
    cardTitle: { fontSize: 13, fontWeight: "800", color: "#456155", marginBottom: 12 },
    recRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
    checkbox: {
        width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: "#D6D3D1",
        alignItems: "center", justifyContent: "center", marginRight: 12, backgroundColor: "#FFFFFF",
    },
    checkboxOn: { backgroundColor: "#456155", borderColor: "#456155" },
    recLabel: { flex: 1, fontSize: 13.5, color: "#1C1917", fontWeight: "500" },
    ttlRow: { flexDirection: "row", backgroundColor: "#F5F5F4", borderRadius: 12, padding: 4 },
    ttlBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
    ttlBtnOn: { backgroundColor: "#FFFFFF", shadowColor: "#374151", shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
    ttlText: { fontSize: 12.5, fontWeight: "600", color: "#78716C" },
    ttlTextOn: { color: "#456155", fontWeight: "800" },
    genBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: "#FF8A7A", height: 50, borderRadius: 25, marginBottom: 16,
        shadowColor: "#FF8A7A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 3,
    },
    genText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14.5 },
    histRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F5F5F4" },
    histCode: { fontSize: 14, fontWeight: "800", color: "#1C1917", letterSpacing: 1 },
    histMeta: { fontSize: 11, color: "#78716C", marginTop: 2 },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginHorizontal: 8 },
    pillActive: { backgroundColor: "#DCFCE7" },
    pillDim: { backgroundColor: "#F5F5F4" },
    pillText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    histRevoke: { padding: 4 },
    logRow: {
        flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8,
        borderTopWidth: 1, borderTopColor: "#F5F5F4",
    },
    logWho: { fontSize: 13, fontWeight: "700", color: "#1C1917" },
    logMeta: { fontSize: 10.5, color: "#78716C", marginTop: 1 },
    privacyNote: {
        flexDirection: "row", gap: 8, backgroundColor: "#EAF0EC", borderRadius: 14, padding: 14, alignItems: "flex-start",
    },
    privacyText: { flex: 1, fontSize: 11.5, color: "#456155", lineHeight: 16 },
    resultCard: {
        backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20, alignItems: "center",
        borderWidth: 1, borderColor: "#F2F2F2",
    },
    shieldRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    resultTitle: { fontSize: 18, fontWeight: "800", color: "#456155" },
    resultSub: { fontSize: 12.5, color: "#78716C", textAlign: "center", lineHeight: 17, marginBottom: 16 },
    qrWrap: {
        padding: 10, backgroundColor: "#FFFFFF", borderRadius: 16,
        borderWidth: 1, borderColor: "#E7E5E4", marginBottom: 14,
    },
    codeLabel: { fontSize: 10, fontWeight: "800", color: "#A8A29E", letterSpacing: 2 },
    codeText: { fontSize: 28, fontWeight: "900", color: "#1C1917", letterSpacing: 3, marginTop: 2, marginBottom: 14 },
    sharedChips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginBottom: 18 },
    chip: {
        flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EAF0EC",
        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
    },
    chipText: { fontSize: 10.5, color: "#456155", fontWeight: "700" },
    resultBtns: { flexDirection: "row", gap: 10, width: "100%" },
    revokeBtn: {
        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
        height: 46, borderRadius: 23, backgroundColor: "#FFF1ED", borderWidth: 1, borderColor: "#FED7C3",
    },
    revokeText: { color: "#C2410C", fontWeight: "800", fontSize: 13 },
    doneBtn: { flex: 1, alignItems: "center", justifyContent: "center", height: 46, borderRadius: 23, backgroundColor: "#456155" },
    doneText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
});
