import React, { useState } from "react";
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
import QrScanner, { scannerAvailable } from "./QrScanner";

// Secondary actor: healthcare professional. View-only access via a parent's
// consultation code, resolved against the backend (works across devices).
export default function ProfessionalView({ onExit }) {
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
                    <Ionicons name="medkit" size={26} color="#456155" />
                </View>
                <Text style={styles.title}>Healthcare Professional</Text>
                <Text style={styles.subtitle}>
                    View-only access to a child's records, authorized by the parent for this consultation.
                </Text>

                <View style={styles.field}>
                    <Text style={styles.label}>Your Name (for the access log)</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="person-outline" size={16} color="#78716C" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Dr. Sarah Chen"
                            placeholderTextColor="#A8A29E"
                            value={name}
                            onChangeText={setName}
                        />
                    </View>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Consultation Code</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="qr-code-outline" size={16} color="#78716C" style={{ marginRight: 8 }} />
                        <TextInput
                            style={[styles.input, { letterSpacing: 2, fontWeight: "700" }]}
                            placeholder="ABCD-1234"
                            placeholderTextColor="#A8A29E"
                            autoCapitalize="characters"
                            value={code}
                            onChangeText={setCode}
                        />
                    </View>
                </View>

                {error ? (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={15} color="#C2410C" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <TouchableOpacity style={styles.viewBtn} onPress={() => handleView()} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
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
                            borderColor: "#C8E6C9",
                            backgroundColor: "#F1F8F2",
                            marginTop: 12,
                        }}
                        onPress={() => {
                            setError("");
                            setScanning(true);
                        }}
                    >
                        <Ionicons name="scan-outline" size={18} color="#456155" />
                        <Text style={{ color: "#456155", fontWeight: "800", fontSize: 14 }}>
                            Scan QR Code
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.scanHint}>
                        <Ionicons name="camera-outline" size={14} color="#78716C" />
                        <Text style={styles.scanHintText}>
                            Camera scanning isn't available here — type the code shown under the parent's QR.
                        </Text>
                    </View>
                )}

                <TouchableOpacity style={styles.exitLink} onPress={onExit}>
                    <Ionicons name="arrow-back" size={14} color="#456155" />
                    <Text style={styles.exitText}>Back to parent sign-in</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

function Row({ label, value }) {
    return (
        <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{label}</Text>
            <Text style={styles.dataValue}>{value || "—"}</Text>
        </View>
    );
}

function Section({ icon, title, children }) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHead}>
                <Ionicons name={icon} size={16} color="#456155" />
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {children}
        </View>
    );
}

function RecordsView({ session, onEnd, onExit }) {
    const p = session.payload || {};
    return (
        <ScrollView contentContainerStyle={styles.recScroll}>
            <View style={styles.viewOnlyBanner}>
                <Ionicons name="eye" size={15} color="#FFFFFF" />
                <Text style={styles.viewOnlyText}>VIEW ONLY · authorized by parent</Text>
            </View>

            <Text style={styles.childName}>{session.childName || "Child"}</Text>
            <Text style={styles.childMeta}>
                {(session.recordKeys || []).length} record types shared · code {session.code}
            </Text>

            {p.profile && (
                <Section icon="person-circle-outline" title={RECORD_LABELS.profile}>
                    <Row label="Date of Birth" value={p.profile.dateOfBirth} />
                    <Row label="Sex" value={p.profile.sex} />
                    <Row label="Blood Type" value={p.profile.bloodType} />
                    <Row label="Birth Weight / Length" value={`${p.profile.birthWeight ?? "—"} kg · ${p.profile.birthLength ?? "—"} cm`} />
                    <Row label="Hospital" value={p.profile.hospital} />
                    <Row label="Pediatrician" value={p.profile.pediatrician} />
                    <Row label="OB-GYNE" value={p.profile.obgyne} />
                    <Row label="Emergency Contact" value={p.profile.emergencyContact} />
                </Section>
            )}

            {p.vaccinations && (
                <Section icon="medical-outline" title={RECORD_LABELS.vaccinations}>
                    {p.vaccinations.length === 0 && <Text style={styles.empty}>No records.</Text>}
                    {p.vaccinations.map((v, i) => (
                        <View key={i} style={styles.listItem}>
                            <View style={[styles.dot, { backgroundColor: v.status === "completed" ? "#22C55E" : "#F59E0B" }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle}>{v.vaccine_name}</Text>
                                <Text style={styles.itemSub}>
                                    {v.visit_name ? v.visit_name + " · " : ""}
                                    {v.status === "completed" ? `given ${v.date_given || ""}` : `due ${v.due_date || ""}`}
                                </Text>
                            </View>
                        </View>
                    ))}
                </Section>
            )}

            {p.allergies && (
                <Section icon="warning-outline" title={RECORD_LABELS.allergies}>
                    <Row label="Allergies" value={(p.allergies.allergies || []).join(", ") || "None recorded"} />
                    <Row label="Hereditary" value={(p.allergies.hereditaryConditions || []).join(", ") || "None recorded"} />
                </Section>
            )}

            {p.growth && (
                <Section icon="trending-up-outline" title={RECORD_LABELS.growth}>
                    <Row label="At Birth" value={`${p.growth.birthWeight ?? "—"} kg · ${p.growth.birthLength ?? "—"} cm`} />
                    {(p.growth.measurements || []).length === 0 && <Text style={styles.empty}>No measurements.</Text>}
                    {(p.growth.measurements || []).map((g, i) => (
                        <View key={i} style={styles.listItem}>
                            <View style={[styles.dot, { backgroundColor: "#3B82F6" }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle}>
                                    {g.height ?? "—"} cm · {g.weight ?? "—"} kg{g.head_circumference ? ` · HC ${g.head_circumference} cm` : ""}
                                </Text>
                                <Text style={styles.itemSub}>{g.date_recorded || ""}</Text>
                            </View>
                        </View>
                    ))}
                </Section>
            )}

            {p.milestones && (
                <Section icon="ribbon-outline" title={RECORD_LABELS.milestones}>
                    {p.milestones.length === 0 && <Text style={styles.empty}>No records.</Text>}
                    {p.milestones.map((m, i) => (
                        <View key={i} style={styles.listItem}>
                            <View style={[styles.dot, { backgroundColor: m.is_completed ? "#22C55E" : "#D6D3D1" }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle}>{m.title}</Text>
                                <Text style={styles.itemSub}>{m.date_recorded || ""}</Text>
                            </View>
                        </View>
                    ))}
                </Section>
            )}

            {p.checkups && (
                <Section icon="calendar-outline" title={RECORD_LABELS.checkups}>
                    {p.checkups.length === 0 && <Text style={styles.empty}>No records.</Text>}
                    {p.checkups.map((c, i) => (
                        <View key={i} style={styles.listItem}>
                            <View style={[styles.dot, { backgroundColor: c.status === "completed" ? "#22C55E" : "#F59E0B" }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle}>{c.title || "Checkup"}</Text>
                                <Text style={styles.itemSub}>
                                    {[c.doctor_name, c.clinic, c.checkup_date].filter(Boolean).join(" · ")}
                                </Text>
                            </View>
                        </View>
                    ))}
                </Section>
            )}

            {p.nutrition && (
                <Section icon="restaurant-outline" title={RECORD_LABELS.nutrition}>
                    {p.nutrition.length === 0 && <Text style={styles.empty}>No records.</Text>}
                    {p.nutrition.map((f, i) => (
                        <View key={i} style={styles.listItem}>
                            <View style={[styles.dot, { backgroundColor: "#8B5CF6" }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle}>
                                    {f.entry_type === "milk"
                                        ? `${f.milk_type || "Milk"}${f.quantity != null ? ` — ${f.quantity} ${f.unit || ""}` : ""}${f.formula_brand ? ` (${f.formula_brand})` : ""}`
                                        : f.food_introduced || "Solid food"}
                                </Text>
                                <Text style={styles.itemSub}>
                                    {[f.reaction ? `reaction: ${f.reaction}` : "", f.entry_date, f.entry_time].filter(Boolean).join(" · ")}
                                </Text>
                            </View>
                        </View>
                    ))}
                </Section>
            )}

            <View style={styles.readOnlyNote}>
                <Ionicons name="lock-closed" size={13} color="#78716C" />
                <Text style={styles.readOnlyText}>
                    These records are read-only. You cannot create, edit, or delete any record. This view has been recorded in the parent's access log.
                </Text>
            </View>

            <TouchableOpacity style={styles.endBtn} onPress={onEnd}>
                <Text style={styles.endText}>End Session</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exitLink} onPress={onExit}>
                <Ionicons name="arrow-back" size={14} color="#456155" />
                <Text style={styles.exitText}>Back to parent sign-in</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    entryScroll: { flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: "#FFFDF9" },
    entryCard: {
        backgroundColor: "#FFFFFF", borderRadius: 28, padding: 24, borderWidth: 1, borderColor: "#EBEBEB",
        maxWidth: 440, width: "100%", alignSelf: "center",
    },
    logoCircle: {
        width: 56, height: 56, borderRadius: 16, backgroundColor: "#E8F5E9",
        alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14,
        borderWidth: 1, borderColor: "#C8E6C9",
    },
    title: { fontSize: 21, fontWeight: "800", color: "#456155", textAlign: "center" },
    subtitle: { fontSize: 12.5, color: "#78716C", textAlign: "center", marginTop: 6, marginBottom: 18, lineHeight: 17 },
    field: { marginBottom: 14 },
    label: { fontSize: 10, fontWeight: "700", color: "#A8A29E", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
    inputWrap: {
        flexDirection: "row", alignItems: "center", backgroundColor: "#F5F5F4",
        borderWidth: 1, borderColor: "#E7E5E4", borderRadius: 12, paddingHorizontal: 12, height: 46,
    },
    input: { flex: 1, fontSize: 14, color: "#1C1917" },
    errorBox: {
        flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF1ED",
        borderRadius: 10, padding: 10, marginBottom: 12,
    },
    errorText: { flex: 1, fontSize: 12, color: "#C2410C", fontWeight: "600" },
    viewBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: "#456155", height: 48, borderRadius: 24, marginTop: 2,
    },
    viewBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14.5 },
    scanHint: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 14 },
    scanHintText: { flex: 1, fontSize: 10.5, color: "#78716C", lineHeight: 15 },
    exitLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
    exitText: { fontSize: 12.5, color: "#456155", fontWeight: "700" },
    recScroll: { padding: 16, paddingBottom: 40 },
    viewOnlyBanner: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: "#456155", borderRadius: 12, paddingVertical: 9, marginBottom: 14,
    },
    viewOnlyText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
    childName: { fontSize: 24, fontWeight: "900", color: "#1C1917" },
    childMeta: { fontSize: 12, color: "#78716C", marginTop: 2, marginBottom: 14 },
    section: {
        backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#F2F2F2", marginBottom: 12,
    },
    sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: "#456155" },
    dataRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#F7F6F4" },
    dataLabel: { fontSize: 12.5, color: "#78716C", flex: 1 },
    dataValue: { fontSize: 12.5, color: "#1C1917", fontWeight: "700", flex: 1, textAlign: "right" },
    listItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
    dot: { width: 9, height: 9, borderRadius: 5 },
    itemTitle: { fontSize: 13, fontWeight: "700", color: "#1C1917" },
    itemSub: { fontSize: 11, color: "#78716C", marginTop: 1 },
    empty: { fontSize: 12, color: "#A8A29E", fontStyle: "italic" },
    readOnlyNote: {
        flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#F5F5F4",
        borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 14,
    },
    readOnlyText: { flex: 1, fontSize: 11, color: "#78716C", lineHeight: 15 },
    endBtn: { backgroundColor: "#FF8A7A", height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
    endText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
