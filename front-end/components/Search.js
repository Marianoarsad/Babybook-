import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { space, radius, shadow, type } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
import { api } from "../utils/api";
import {
    vaccinationToApp,
    checkupToApp,
    medHistoryToIllness,
    medHistoryToMed,
    milestoneToApp,
    memoryToApp,
} from "../utils/adapters";
import { EmptyStateCard } from "./common/Cards";
import { AppointmentsSkeleton } from "./ui/Skeleton";
import { useRefreshControl } from "./ui/useRefreshControl";

// Searches across a child's vaccinations, checkups, conditions (illness /
// medication / hospitalization), milestones, memories, and custom calendar
// events. Nutrition/feeding logs are deliberately excluded — that table is
// unbounded over a 6-year record and its rows are near-duplicate ("120 mL
// Formula" repeated daily), low search value for real noise/perf cost.
// Growth is excluded too, but for a different reason: growth_records has no
// text columns at all, nothing to match against.
//
// Client-side, fetch-once: every searchable text column is encrypted at
// rest with a random IV per row, so SQL LIKE/ILIKE can never match — the
// only search path is fetch-then-filter, and data volume here (well under
// 1,000 rows across these 8 categories for a real 6-year record) makes a
// plain client-side filter effectively instant.
export default function Search({ profile, onClose, onNavigate }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const { scrollProps } = useScroll();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    const load = useCallback(() => {
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const [vax, checkups, medHistory, milestones, memories, events] = await Promise.all([
                    api.listRecords(profile.id, "vaccinations").catch(() => []),
                    api.listRecords(profile.id, "checkups").catch(() => []),
                    api.listRecords(profile.id, "medical-history").catch(() => []),
                    api.listRecords(profile.id, "milestones").catch(() => []),
                    api.listRecords(profile.id, "memories").catch(() => []),
                    api.listRecords(profile.id, "calendar-events").catch(() => []),
                ]);
                if (!active) return;

                const built = [];

                (vax || []).forEach((row) => {
                    const v = vaccinationToApp(row);
                    built.push({
                        key: `vax-${v.id}`,
                        title: v.vaccineName,
                        subtitle: v.visitName || (v.isCompleted ? "Given" : "Scheduled"),
                        date: v.completedDate || v.dueDate,
                        searchText: `${v.vaccineName} ${v.visitName} ${v.notes}`,
                        icon: "shield-checkmark-outline",
                        iconColor: colors.recVaccine.on,
                        iconBg: colors.recVaccine.bg,
                        navTo: { view: "health", tab: "immunizations" },
                    });
                });

                (checkups || []).forEach((row) => {
                    const c = checkupToApp(row);
                    built.push({
                        key: `chk-${c.id}`,
                        title: c.title,
                        subtitle: c.provider || "Checkup",
                        date: c.date,
                        searchText: `${c.title} ${c.provider} ${c.notes}`,
                        icon: "calendar-outline",
                        iconColor: colors.recCheckup.on,
                        iconBg: colors.recCheckup.bg,
                        navTo: { view: "health", tab: "appointments" },
                    });
                });

                (medHistory || []).forEach((row) => {
                    if (row.category === "Medication") {
                        const m = medHistoryToMed(row);
                        built.push({
                            key: `med-${m.id}`,
                            title: m.title,
                            subtitle: m.dosage ? `Dosage: ${m.dosage}` : m.duration,
                            date: null,
                            searchText: `${m.title} ${m.dosage} ${m.duration}`,
                            icon: "flask-outline",
                            iconColor: colors.recMedication.on,
                            iconBg: colors.recMedication.bg,
                            navTo: { view: "health", tab: "medications" },
                        });
                    } else {
                        const i = medHistoryToIllness(row);
                        const isHosp = row.category === "Hospitalization";
                        built.push({
                            key: `${isHosp ? "hosp" : "ill"}-${i.id}`,
                            title: i.title,
                            subtitle: isHosp ? "Hospitalization" : i.resolved ? "Resolved" : "Active condition",
                            date: i.date,
                            searchText: `${i.title} ${i.desc}`,
                            icon: isHosp ? "bandage-outline" : "pulse-outline",
                            iconColor: isHosp ? colors.recHospitalization.on : colors.recIllness.on,
                            iconBg: isHosp ? colors.recHospitalization.bg : colors.recIllness.bg,
                            navTo: { view: "health", tab: isHosp ? "appointments" : "illnesses" },
                        });
                    }
                });

                (milestones || []).forEach((row) => {
                    const m = milestoneToApp(row);
                    built.push({
                        key: `ms-${m.id}`,
                        title: m.title,
                        subtitle: m.isCompleted ? "Milestone reached" : "Not yet reached",
                        date: m.date,
                        searchText: `${m.title} ${m.description}`,
                        icon: "trophy-outline",
                        iconColor: colors.recGrowth.on,
                        iconBg: colors.recGrowth.bg,
                        navTo: { view: "growth", tab: "milestones" },
                    });
                });

                (memories || []).forEach((row) => {
                    const m = memoryToApp(row);
                    built.push({
                        key: `mem-${m.id}`,
                        title: m.title,
                        subtitle: m.description || "Memory",
                        date: m.date,
                        searchText: `${m.title} ${m.description}`,
                        icon: "image-outline",
                        iconColor: colors.recMemory.on,
                        iconBg: colors.recMemory.bg,
                        navTo: { view: "growth", tab: "gallery" },
                    });
                });

                (events || []).forEach((row) => {
                    built.push({
                        key: `evt-${row.id}`,
                        title: row.title || "Event",
                        subtitle: row.description || "Calendar event",
                        date: row.event_date ? String(row.event_date).slice(0, 10) : null,
                        searchText: `${row.title || ""} ${row.description || ""}`,
                        icon: "today-outline",
                        iconColor: colors.info,
                        iconBg: colors.infoBg,
                        navTo: { view: "calendar" },
                    });
                });

                setItems(built);
            } catch (e) {
                console.log("load search index:", e.message);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id, colors]);

    useEffect(() => load(), [load]);

    const refreshControl = useRefreshControl(loading, load);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return items
            .filter((it) => it.searchText.toLowerCase().includes(q))
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }, [items, query]);

    const handleSelect = (item) => {
        onNavigate(item.navTo.view, item.navTo.tab);
        onClose();
    };

    return (
        <View style={styles.root}>
            {/* No header here on purpose: App.js draws "← Search" from
                SCREEN_TITLES. A second bar would render underneath the floating
                app header and the two titles would overlap.

                The input stays OUTSIDE the ScrollView so it holds still while
                results scroll, which means it has to clear the header itself —
                padTop reaches contentContainerStyle, not siblings of it. */}
            <View style={[styles.searchBarWrap, { marginTop: padTop }]}>
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search vaccines, checkups, conditions, milestones, memories, events..."
                    placeholderTextColor={colors.placeholder}
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                />
                {query.length > 0 && (
                    <TouchableOpacity
                        onPress={() => setQuery("")}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                        hitSlop={8}
                    >
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            <Animated.ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: padBottom }]}
                refreshControl={refreshControl}
                {...scrollProps}
                keyboardShouldPersistTaps="handled"
            >
                {loading && items.length === 0 ? (
                    <AppointmentsSkeleton />
                ) : query.trim().length === 0 ? (
                    <EmptyStateCard
                        message="Search vaccines, checkups, conditions, milestones, memories, and calendar events."
                        icon="search-outline"
                    />
                ) : results.length === 0 ? (
                    <EmptyStateCard message={`No matches for "${query.trim()}".`} icon="search-outline" />
                ) : (
                    <View style={styles.resultsCard}>
                        {results.map((item, idx) => (
                            <TouchableOpacity
                                key={item.key}
                                onPress={() => handleSelect(item)}
                                style={[styles.row, idx < results.length - 1 && styles.rowBorder]}
                                accessibilityRole="button"
                                accessibilityLabel={item.title}
                            >
                                <View style={[styles.rowIcon, { backgroundColor: item.iconBg }]}>
                                    <Ionicons name={item.icon} size={18} color={item.iconColor} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowTitle} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                                        {item.subtitle}
                                    </Text>
                                </View>
                                {item.date ? <Text style={styles.rowDate}>{item.date}</Text> : null}
                                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </Animated.ScrollView>
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        // transparent, not colors.background: App.js paints the page gradient.

        root: { flex: 1, backgroundColor: "transparent" },
        searchBarWrap: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            marginHorizontal: space.lg,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: space.md,
            height: 44,
        },
        searchInput: { flex: 1, fontSize: 16, color: colors.text, height: 44 },
        content: { padding: space.lg },
        resultsCard: {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.hairline,
            overflow: "hidden",
            ...shadow.card,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            paddingVertical: space.md,
            paddingHorizontal: space.md,
        },
        rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
        rowIcon: { width: 40, height: 40, borderRadius: radius.md, borderCurve: "continuous", alignItems: "center", justifyContent: "center" },
        rowTitle: { ...type.label, fontWeight: "700", color: colors.text },
        rowSubtitle: { ...type.caption, fontWeight: "500", color: colors.textMuted, marginTop: 1 },
        rowDate: { ...type.caption, fontWeight: "600", color: colors.textMuted, marginLeft: space.xs, flexShrink: 0 },
    });
