import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { space, radius, shadow } from "../theme";
import { api } from "../utils/api";
import { EmptyStateCard } from "./common/Cards";

// "See all" destination for Dashboard's Recent Activity section. Dashboard
// only ever loads its 5 most recent items to begin with, so this screen does
// its own separate, larger fetch rather than trying to reveal more of an
// already-limited list. The item-building logic below mirrors Dashboard.js's
// Recent Activity effect on purpose, since this is the full version of it.
export default function AllActivity({ profile, onClose }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const [vax, checkups, nutrition, milestones] = await Promise.all([
                    api.listRecords(profile.id, "vaccinations").catch(() => []),
                    api.listRecords(profile.id, "checkups").catch(() => []),
                    api.listRecords(profile.id, "nutrition").catch(() => []),
                    api.listRecords(profile.id, "milestones").catch(() => []),
                ]);
                if (!active) return;
                const todayStr = new Date().toISOString().slice(0, 10);
                const items = [];
                (vax || [])
                    .filter((v) => v.status === "completed" && v.date_given)
                    .forEach((v) =>
                        items.push({
                            key: `vax-${v.id}`,
                            title: "Vaccination Logged",
                            subtitle: v.vaccine_name || "Vaccine",
                            date: String(v.date_given).slice(0, 10),
                            icon: "checkmark-circle",
                            tone: "primary",
                        }),
                    );
                (checkups || [])
                    .filter((c) => c.checkup_date)
                    .forEach((c) =>
                        items.push({
                            key: `chk-${c.id}`,
                            title: "Wellness Checkup",
                            subtitle: c.title || c.doctor_name || "Checkup",
                            date: String(c.checkup_date).slice(0, 10),
                            icon: "medkit",
                            tone: "danger",
                        }),
                    );
                (nutrition || []).forEach((n) => {
                    const isMilk = (n.entry_type || "milk") === "milk";
                    const qty = n.quantity != null && n.quantity !== "" ? Number(n.quantity) : null;
                    const subtitle = isMilk
                        ? `${n.milk_type || "Milk"}${qty != null ? ` • ${qty} ${n.unit || "mL"}` : ""}`
                        : `Solid Food${n.food_introduced ? ` • ${n.food_introduced}` : ""}`;
                    items.push({
                        key: `nut-${n.id}`,
                        title: "Feeding Logged",
                        subtitle,
                        date: String(n.entry_date).slice(0, 10),
                        icon: "restaurant",
                        tone: "success",
                    });
                });
                (milestones || [])
                    .filter((m) => m.is_completed && m.date_recorded)
                    .forEach((m) =>
                        items.push({
                            key: `ms-${m.id}`,
                            title: "Milestone Reached",
                            subtitle: m.title || "Milestone",
                            date: String(m.date_recorded).slice(0, 10),
                            icon: "trophy",
                            tone: "info",
                        }),
                    );
                const past = items.filter((i) => i.date && i.date <= todayStr);
                past.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
                setActivity(past);
            } catch (e) {
                console.log("load all activity:", e.message);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);

    const toneColor = { primary: colors.primary, danger: colors.danger, success: colors.success, info: colors.info };

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={onClose}
                    style={styles.headerBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Recent Activity</Text>
                <View style={styles.headerBtn} />
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <Text style={styles.loadingText}>Loading…</Text>
                ) : activity.length === 0 ? (
                    <EmptyStateCard message="No activity yet." icon="time-outline" />
                ) : (
                    <View style={styles.activityCard}>
                        {activity.map((a, idx) => {
                            const tone = toneColor[a.tone] || colors.primary;
                            return (
                                <View
                                    key={a.key}
                                    style={[styles.activityRow, idx < activity.length - 1 && styles.activityRowBorder]}
                                >
                                    <View style={styles.activityLeft}>
                                        <View style={[styles.activityIcon, { backgroundColor: tone + "1A" }]}>
                                            <Ionicons name={a.icon} size={18} color={tone} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.activityTitle}>{a.title}</Text>
                                            <Text style={styles.activitySubtitle} numberOfLines={1}>
                                                {a.subtitle}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.activityDate}>{a.date}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.hairline,
        },
        headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
        headerTitle: { fontSize: 18, fontWeight: "800", color: colors.primary },
        content: { padding: space.lg, paddingBottom: space.xxl },
        loadingText: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: space.xl },
        activityCard: {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.hairline,
            overflow: "hidden",
            ...shadow.card,
        },
        activityRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: space.md,
            paddingHorizontal: space.md,
        },
        activityRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
        activityLeft: { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
        activityIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
        activityTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
        activitySubtitle: { fontSize: 12, fontWeight: "500", color: colors.textMuted, marginTop: 1 },
        activityDate: { fontSize: 11, fontWeight: "600", color: colors.textMuted, marginLeft: space.sm },
    });
