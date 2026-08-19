import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { space, radius, shadow, type } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
import { api } from "../utils/api";
import { EmptyStateCard } from "./common/Cards";
import { AppointmentsSkeleton } from "./ui/Skeleton";
import { useRefreshControl } from "./ui/useRefreshControl";
import ShowMore from "./ui/ShowMore";
import { feedRowSummary } from "../utils/adapters";
import { todayLocal } from "../utils/dates";

// "See all" destination for Dashboard's Recent Activity section. Dashboard
// only ever loads its 5 most recent items to begin with, so this screen does
// its own separate, larger fetch rather than trying to reveal more of an
// already-limited list. The item-building logic below mirrors Dashboard.js's
// Recent Activity effect on purpose, since this is the full version of it.
export default function AllActivity({ profile }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();

    const { scrollProps } = useScroll();
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [visibleCount, setVisibleCount] = useState(10);

    const load = useCallback(() => {
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
                const todayStr = todayLocal();
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
                    items.push({
                        key: `nut-${n.id}`,
                        title: "Feeding Logged",
                        subtitle: feedRowSummary(n),
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

    useEffect(() => load(), [load]);

    const refreshControl = useRefreshControl(loading, load);

    const toneColor = { primary: colors.primary, danger: colors.danger, success: colors.success, info: colors.info };

    return (
        <Animated.ScrollView
            style={styles.root}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            refreshControl={refreshControl}
            keyboardShouldPersistTaps="handled"
            {...scrollProps}
        >
            {loading && activity.length === 0 ? (
                <AppointmentsSkeleton />
            ) : !loading && activity.length === 0 ? (
                <EmptyStateCard message="No activity yet." icon="time-outline" />
            ) : (
                <View style={styles.activityCard}>
                    {activity.slice(0, visibleCount).map((a, idx, shown) => {
                        const tone = toneColor[a.tone] || colors.primary;
                        return (
                            <View
                                key={a.key}
                                style={[styles.activityRow, idx < shown.length - 1 && styles.activityRowBorder]}
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
            {!loading && (
                <ShowMore
                    total={activity.length}
                    visible={visibleCount}
                    onPress={() => setVisibleCount((c) => c + 10)}
                    noun="activity items"
                />
            )}
        </Animated.ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        // transparent, not colors.background: App.js paints the page gradient.

        root: { flex: 1, backgroundColor: "transparent" },
        content: { padding: space.lg },
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
        activityTitle: { ...type.label, fontWeight: "700", color: colors.text },
        activitySubtitle: { ...type.caption, fontWeight: "500", color: colors.textMuted, marginTop: 1 },
        activityDate: { ...type.caption, fontWeight: "600", color: colors.textMuted, marginLeft: space.sm, flexShrink: 0 },
    });
