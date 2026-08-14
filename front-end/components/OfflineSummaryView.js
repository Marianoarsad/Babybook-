import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { radius, space, shadow, type } from "../theme";
import { getSummary } from "../utils/offlineSummary";
import { ageText } from "./Dashboard";

// Read-only, print/screenshot-friendly view of the offline consultation
// summary cached by utils/offlineSummary.js. Reads straight from local
// storage — no network request — so it works exactly when the live screens
// (Health, Growth, Dashboard) don't: no signal.
//
// Navigated to via App.js's global header back arrow (this view is in
// SCREEN_TITLES), so it draws no back control of its own — same convention
// ShareRecords.js follows.
export default function OfflineSummaryView({ profile }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [summary, setSummary] = useState(undefined); // undefined = loading, null = none cached

    useEffect(() => {
        let active = true;
        getSummary(profile.id).then((s) => {
            if (active) setSummary(s);
        });
        return () => {
            active = false;
        };
    }, [profile.id]);

    if (summary === undefined) return null;

    return (
        <ScrollView contentContainerStyle={styles.scroll}>
            {!summary ? (
                <View style={styles.emptyCard}>
                    <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>No offline summary yet</Text>
                    <Text style={styles.emptyText}>
                        Open the Dashboard once while you have a connection — it saves a copy of {profile.name}'s
                        key records automatically, so this screen still works with no signal at all.
                    </Text>
                </View>
            ) : (
                <>
                    <View style={styles.banner}>
                        <Ionicons name="cloud-offline" size={15} color="#FFFFFF" />
                        <Text style={styles.bannerText}>OFFLINE SUMMARY · read-only</Text>
                    </View>

                    <Text style={styles.childName}>{profile.name}</Text>
                    <AsOf cachedAt={summary.cachedAt} />

                    <Section icon="person-circle-outline" title="Profile" colors={colors} styles={styles}>
                        <Row label="Date of Birth" value={summary.profile.dateOfBirth} styles={styles} />
                        <Row label="Age" value={ageText(summary.profile.dateOfBirth)} styles={styles} />
                        <Row label="Sex" value={summary.profile.sex} styles={styles} />
                        <Row label="Blood Type" value={summary.profile.bloodType} styles={styles} />
                        <Row label="Pediatrician" value={summary.profile.pediatricianName} styles={styles} />
                        <Row label="Emergency Contact" value={summary.profile.emergencyContact} styles={styles} />
                    </Section>

                    <Section icon="warning-outline" title="Allergies & Hereditary Conditions" colors={colors} styles={styles}>
                        <Row label="Allergies" value={summary.profile.allergies.join(", ") || "None recorded"} styles={styles} />
                        <Row
                            label="Hereditary"
                            value={summary.profile.hereditaryConditions.join(", ") || "None recorded"}
                            styles={styles}
                        />
                    </Section>

                    <Section icon="medical-outline" title="Vaccinations" colors={colors} styles={styles}>
                        {summary.vaccinations.length === 0 && <Text style={styles.empty}>No records.</Text>}
                        {summary.vaccinations.map((v, i) => (
                            <View key={i} style={styles.listItem}>
                                <View
                                    style={[
                                        styles.dot,
                                        { backgroundColor: v.status === "completed" ? "#22C55E" : "#F59E0B" },
                                    ]}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>{v.vaccine_name}</Text>
                                    <Text style={styles.itemSub}>
                                        {v.status === "completed" ? `given ${v.date_given || ""}` : `due ${v.due_date || ""}`}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </Section>

                    <Section icon="medkit-outline" title="Current Medications" colors={colors} styles={styles}>
                        {summary.medications.length === 0 && <Text style={styles.empty}>None recorded.</Text>}
                        {summary.medications.map((m, i) => (
                            <View key={i} style={styles.listItem}>
                                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>{m.title}</Text>
                                    {m.description ? <Text style={styles.itemSub}>{m.description}</Text> : null}
                                </View>
                            </View>
                        ))}
                    </Section>

                    <Section icon="calendar-outline" title="Recent Checkups" colors={colors} styles={styles}>
                        {summary.recentCheckups.length === 0 && <Text style={styles.empty}>No records.</Text>}
                        {summary.recentCheckups.map((c, i) => (
                            <View key={i} style={styles.listItem}>
                                <View style={[styles.dot, { backgroundColor: "#3B82F6" }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>{c.title || "Checkup"}</Text>
                                    <Text style={styles.itemSub}>
                                        {[c.doctor_name, c.checkup_date].filter(Boolean).join(" · ")}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </Section>

                    <View style={styles.readOnlyNote}>
                        <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.readOnlyText}>
                            This is a snapshot saved on this device the last time it had a connection. It is not
                            live — records may have changed since. Reconnect and reopen the Dashboard to refresh it.
                        </Text>
                    </View>
                </>
            )}
        </ScrollView>
    );
}

function AsOf({ cachedAt }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const d = new Date(cachedAt);
    const formatted = isNaN(d.getTime())
        ? null
        : `${d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    return (
        <View style={styles.asOfRow}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.asOfText}>Saved as of {formatted || "an earlier visit"}</Text>
        </View>
    );
}

function Row({ label, value, styles }) {
    return (
        <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{label}</Text>
            <Text style={styles.dataValue}>{value || "—"}</Text>
        </View>
    );
}

function Section({ icon, title, colors, styles, children }) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHead}>
                <Ionicons name={icon} size={16} color={colors.primary} />
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {children}
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        scroll: { padding: 16, paddingBottom: 40 },
        emptyCard: {
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: space.xl,
            gap: space.sm,
        },
        emptyTitle: { ...type.heading, color: colors.text },
        emptyText: { ...type.body, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
        banner: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 9,
            marginBottom: 14,
        },
        bannerText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
        childName: { fontSize: 24, fontWeight: "900", color: colors.text },
        asOfRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 14 },
        asOfText: { ...type.caption, color: colors.textMuted },
        section: {
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 12,
        },
        sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
        sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.primary },
        dataRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 6,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
        },
        dataLabel: { fontSize: 12.5, color: colors.textMuted, flex: 1 },
        dataValue: { fontSize: 12.5, color: colors.text, fontWeight: "700", flex: 1, textAlign: "right" },
        listItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
        dot: { width: 9, height: 9, borderRadius: 5 },
        itemTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
        itemSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
        empty: { fontSize: 12, color: colors.textMuted, fontStyle: "italic" },
        readOnlyNote: {
            flexDirection: "row",
            gap: 8,
            alignItems: "flex-start",
            backgroundColor: colors.surfaceAlt,
            borderRadius: 12,
            padding: 12,
            marginTop: 4,
        },
        readOnlyText: { flex: 1, fontSize: 11, color: colors.textMuted, lineHeight: 15 },
    });
