import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { MIN_TOUCH, radius, shadow, space, type } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
import { api } from "../utils/api";
import { useRecordCache, useScreenRefresh, useSessionEpoch } from "../utils/useRecords";
import { storage } from "../utils/storageAdapter";
import { addRecentSearch, searchSuggestions } from "../utils/search";
import { shortDate } from "../utils/dates";
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

const HISTORY_KEY = (childId) => `bb_search_history:${childId}`;
const SEARCH_RESOURCES = ["vaccinations", "checkups", "medical-history", "milestones", "memories", "calendar-events"];

const CATEGORIES = [
    { labelKey: "searchVaccines", icon: "shield-checkmark-outline", tone: "recVaccine", view: "health", tab: "immunizations" },
    { labelKey: "searchCheckups", icon: "calendar-outline", tone: "recCheckup", view: "health", tab: "appointments" },
    { labelKey: "searchConditions", icon: "pulse-outline", tone: "recIllness", view: "health", tab: "illnesses" },
    { labelKey: "searchMedicine", icon: "flask-outline", tone: "recMedication", view: "health", tab: "medications" },
    { labelKey: "searchMilestones", icon: "trophy-outline", tone: "recGrowth", view: "growth", tab: "milestones" },
    { labelKey: "searchMemories", icon: "image-outline", tone: "recMemory", view: "growth", tab: "gallery" },
    { labelKey: "searchCalendar", icon: "today-outline", tone: "info", view: "calendar", tab: null },
];

// Text records are decrypted by the authenticated API, then filtered locally:
// randomized field encryption means SQL LIKE cannot search them safely.
export default function Search({ profile, onNavigate }) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const { scrollProps } = useScroll();
    const vaxCache = useRecordCache(profile.id, "vaccinations");
    const checkupCache = useRecordCache(profile.id, "checkups");
    const medicalCache = useRecordCache(profile.id, "medical-history");
    const milestoneCache = useRecordCache(profile.id, "milestones");
    const memoryCache = useRecordCache(profile.id, "memories");
    const eventCache = useRecordCache(profile.id, "calendar-events");
    const epoch = useSessionEpoch();
    const [query, setQuery] = useState("");
    const [history, setHistory] = useState([]);
    const load = useCallback(async () => {
        const outcomes = await Promise.allSettled(SEARCH_RESOURCES.map((resource) =>
            api.listRecords(profile.id, resource, { loading: "nonblocking" })));
        return SEARCH_RESOURCES.filter((_, index) => outcomes[index].status === "rejected");
    }, [profile.id]);
    const { refreshing, failures, refresh } = useScreenRefresh(profile.id, load);
    const caches = [vaxCache, checkupCache, medicalCache, milestoneCache, memoryCache, eventCache];
    const completeIndex = caches.every((cache) => cache.hasFetched);
    const vax = vaxCache.rows, checkups = checkupCache.rows, medHistory = medicalCache.rows;
    const milestones = milestoneCache.rows, memories = memoryCache.rows, events = eventCache.rows;
    const items = useMemo(() => {
        const built = [];
        (vax || []).forEach((row) => {
            const v = vaccinationToApp(row);
            built.push({ key: `vax-${v.id}`, title: v.vaccineName, subtitle: v.visitName || (v.isCompleted ? t("searchGiven") : t("searchScheduled")), date: v.completedDate || v.dueDate, searchText: `${v.vaccineName} ${v.visitName} ${v.notes} vaccine vaccination ${t("searchVaccines")}`, icon: "shield-checkmark-outline", iconColor: colors.recVaccine.on, iconBg: colors.recVaccine.bg, navTo: { view: "health", tab: "immunizations" } });
        });
        (checkups || []).forEach((row) => {
            const c = checkupToApp(row);
            built.push({ key: `chk-${c.id}`, title: c.title, subtitle: c.provider || t("searchCheckups"), date: c.date, searchText: `${c.title} ${c.provider} ${c.notes} checkup appointment ${t("searchCheckups")}`, icon: "calendar-outline", iconColor: colors.recCheckup.on, iconBg: colors.recCheckup.bg, navTo: { view: "health", tab: "appointments" } });
        });
        (medHistory || []).forEach((row) => {
            if (row.category === "Medication") {
                const m = medHistoryToMed(row);
                built.push({ key: `med-${m.id}`, title: m.title, subtitle: m.dosage ? `${t("searchDosage")}: ${m.dosage}` : m.duration, date: row.date_recorded, searchText: `${m.title} ${m.dosage} ${m.duration} medicine medication ${t("searchMedicine")}`, icon: "flask-outline", iconColor: colors.recMedication.on, iconBg: colors.recMedication.bg, navTo: { view: "health", tab: "medications" } });
            } else {
                const item = medHistoryToIllness(row);
                const hospitalization = row.category === "Hospitalization";
                built.push({ key: `${hospitalization ? "hosp" : "ill"}-${item.id}`, title: item.title, subtitle: hospitalization ? t("searchHospitalization") : item.resolved ? t("searchResolved") : t("searchActiveCondition"), date: item.date, searchText: `${item.title} ${item.desc} condition illness hospitalization ${t("searchConditions")}`, icon: hospitalization ? "bandage-outline" : "pulse-outline", iconColor: hospitalization ? colors.recHospitalization.on : colors.recIllness.on, iconBg: hospitalization ? colors.recHospitalization.bg : colors.recIllness.bg, navTo: { view: "health", tab: hospitalization ? "appointments" : "illnesses" } });
            }
        });
        (milestones || []).forEach((row) => {
            const m = milestoneToApp(row);
            built.push({ key: `ms-${m.id}`, title: m.title, subtitle: m.isCompleted ? t("searchMilestoneReached") : t("searchNotReached"), date: m.date, searchText: `${m.title} ${m.description} milestone development ${t("searchMilestones")}`, icon: "trophy-outline", iconColor: colors.recGrowth.on, iconBg: colors.recGrowth.bg, navTo: { view: "growth", tab: "milestones" } });
        });
        (memories || []).forEach((row) => {
            const m = memoryToApp(row);
            built.push({ key: `mem-${m.id}`, title: m.title, subtitle: m.description || t("searchMemory"), date: m.date, searchText: `${m.title} ${m.description} memory photo ${t("searchMemories")}`, icon: "image-outline", iconColor: colors.recMemory.on, iconBg: colors.recMemory.bg, navTo: { view: "growth", tab: "gallery" } });
        });
        (events || []).forEach((row) => built.push({ key: `evt-${row.id}`, title: row.title || t("searchEvent"), subtitle: row.description || t("searchCalendarEvent"), date: row.event_date ? String(row.event_date).slice(0, 10) : null, searchText: `${row.title || ""} ${row.description || ""} calendar event plan ${t("searchCalendar")}`, icon: "today-outline", iconColor: colors.info, iconBg: colors.infoBg, navTo: { view: "calendar" } }));
        return built;
    }, [vax, checkups, medHistory, milestones, memories, events, colors, t]);
    useEffect(() => {
        let active = true;
        setHistory([]);
        storage.getItem(HISTORY_KEY(profile.id)).then((raw) => {
            if (!active || !raw) return;
            try {
                const saved = JSON.parse(raw);
                if (Array.isArray(saved)) setHistory(saved.filter((item) => typeof item === "string").slice(0, 6));
            } catch (_) {}
        }).catch(() => {});
        return () => { active = false; };
    }, [profile.id, epoch]);

    const refreshControl = useRefreshControl(refreshing, refresh);
    const normalizedQuery = query.trim().toLowerCase();
    const results = useMemo(() => {
        if (!normalizedQuery) return [];
        return items.filter((item) => item.searchText.toLowerCase().includes(normalizedQuery)).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    }, [items, normalizedQuery]);
    const suggestions = useMemo(() => searchSuggestions(items, CATEGORIES.map((category) => t(category.labelKey))), [items, t]);
    const categoryColumns = useMemo(() => {
        const columns = [];
        for (let index = 0; index < CATEGORIES.length; index += 2) columns.push(CATEGORIES.slice(index, index + 2));
        return columns;
    }, []);

    const rememberSearch = useCallback((term) => {
        const next = addRecentSearch(history, term);
        if (next === history) return;
        setHistory(next);
        storage.setItem(HISTORY_KEY(profile.id), JSON.stringify(next)).catch(() => {});
    }, [history, profile.id]);

    const runSearch = (term) => {
        setQuery(term);
        rememberSearch(term);
    };
    const clearHistory = () => {
        setHistory([]);
        storage.removeItem(HISTORY_KEY(profile.id)).catch(() => {});
    };
    const openResult = (item) => {
        rememberSearch(query);
        onNavigate(item.navTo.view, item.navTo.tab);
    };

    const renderChip = (term, source) => (
        <TouchableOpacity key={`${source}-${term}`} style={styles.chip} onPress={() => runSearch(term)} accessibilityRole="button" accessibilityLabel={`${t("searchFor")} ${term}`}>
            <Text style={styles.chipText} numberOfLines={1}>{term}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.root}>
            <View style={[styles.searchBar, { marginTop: padTop }]}>
                <Ionicons name="search-outline" size={24} color={colors.text} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={t("searchPlaceholder")}
                    placeholderTextColor={colors.placeholder}
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={() => rememberSearch(query)}
                    returnKeyType="search"
                    autoFocus
                    accessibilityLabel={t("searchRecords")}
                />
                {query ? <TouchableOpacity style={styles.clearQuery} onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel={t("searchClearQuery")}><Ionicons name="close-circle" size={20} color={colors.textMuted} /></TouchableOpacity> : null}
            </View>

            <Animated.ScrollView contentContainerStyle={[styles.content, { paddingBottom: padBottom }]} refreshControl={refreshControl} {...scrollProps} keyboardShouldPersistTaps="handled">
                {failures.length > 0 ? (
                    <View style={styles.refreshNotice}>
                        <Text style={styles.emptyHistory}>{t("screenRefreshFailed")}</Text>
                        <TouchableOpacity style={styles.clearHistory} onPress={refresh} accessibilityRole="button">
                            <Text style={styles.clearHistoryText}>{t("retry")}</Text>
                        </TouchableOpacity>
                    </View>
                ) : refreshing ? <Text style={styles.emptyHistory}>{t("screenRefreshing")}</Text> : null}
                {normalizedQuery ? (
                    <View style={styles.section}>
                        <View style={styles.sectionHeading}>
                            <Text style={[styles.sectionTitle, styles.sectionHeadingTitle]}>{t("searchResults")}</Text>
                            <View style={styles.resultCount}><Text style={styles.resultCountText}>{results.length}</Text></View>
                        </View>
                        {results.length ? (
                            <View style={styles.resultsCard}>
                                {results.map((item, index) => (
                                    <TouchableOpacity key={item.key} onPress={() => openResult(item)} style={[styles.row, index < results.length - 1 && styles.rowBorder]} accessibilityRole="button" accessibilityLabel={item.title}>
                                        <View style={[styles.rowIcon, { backgroundColor: item.iconBg }]}><Ionicons name={item.icon} size={19} color={item.iconColor} /></View>
                                        <View style={styles.rowBody}>
                                            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                                            <Text style={styles.rowSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                                        </View>
                                        {item.date ? <Text style={styles.rowDate}>{shortDate(item.date)}</Text> : null}
                                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : refreshing && !completeIndex ? <AppointmentsSkeleton /> : (
                            <EmptyStateCard message={completeIndex
                                ? `${t("searchNoMatches")} “${query.trim()}”.`
                                : t("screenDataUnavailable")} icon="search-outline" />
                        )}
                    </View>
                ) : (
                    <>
                        <View style={styles.section}>
                            <View style={styles.sectionHeading}>
                                <Text style={[styles.sectionTitle, styles.sectionHeadingTitle]}>{t("searchHistory")}</Text>
                                {history.length ? <TouchableOpacity style={styles.clearHistory} onPress={clearHistory} accessibilityRole="button"><Text style={styles.clearHistoryText}>{t("searchClearHistory")}</Text></TouchableOpacity> : null}
                            </View>
                            {history.length ? <View style={styles.chipWrap}>{history.map((term) => renderChip(term, "history"))}</View> : <Text style={styles.emptyHistory}>{t("searchNoHistory")}</Text>}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t("searchByCategory")}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail} keyboardShouldPersistTaps="handled">
                                {categoryColumns.map((column, index) => (
                                    <View key={index} style={styles.categoryColumn}>
                                        {column.map((category) => {
                                            const tone = category.tone === "info" ? { on: colors.info, bg: colors.infoBg } : colors[category.tone];
                                            return (
                                                <TouchableOpacity key={category.labelKey} style={styles.categoryCard} onPress={() => onNavigate(category.view, category.tab)} accessibilityRole="button" accessibilityLabel={t(category.labelKey)}>
                                                    <View style={[styles.categoryIcon, { backgroundColor: tone.bg }]}><Ionicons name={category.icon} size={24} color={tone.on} /></View>
                                                    <Text style={styles.categoryText} numberOfLines={1}>{t(category.labelKey)}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t("searchSuggestions")}</Text>
                            <View style={styles.chipWrap}>{suggestions.map((term) => renderChip(term, "suggestion"))}</View>
                        </View>
                    </>
                )}
            </Animated.ScrollView>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    root: { flex: 1, backgroundColor: "transparent" },
    searchBar: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, marginHorizontal: space.lg, paddingHorizontal: space.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.textSecondary, borderRadius: radius.pill, borderCurve: "continuous", ...shadow.card },
    searchInput: { flex: 1, minWidth: 0, height: 54, ...type.body, color: colors.text },
    clearQuery: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", marginRight: -space.md },
    content: { paddingHorizontal: space.lg, paddingTop: space.xl },
    refreshNotice: { marginBottom: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
    section: { marginBottom: space.xxl },
    sectionHeading: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
    sectionTitle: { ...type.title, color: colors.text, marginBottom: space.md },
    sectionHeadingTitle: { marginBottom: 0 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
    chip: { minHeight: MIN_TOUCH, maxWidth: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, borderCurve: "continuous", backgroundColor: colors.surfaceAlt },
    chipText: { ...type.label, color: colors.primaryDark, maxWidth: 190 },
    clearHistory: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.sm },
    clearHistoryText: { ...type.label, color: colors.primaryDark },
    emptyHistory: { ...type.caption, color: colors.textMuted },
    categoryRail: { gap: space.md, paddingRight: space.lg },
    categoryColumn: { gap: space.md },
    categoryCard: { width: 156, minHeight: 72, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, borderCurve: "continuous" },
    categoryIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderCurve: "continuous" },
    categoryText: { ...type.bodyStrong, color: colors.text, flex: 1 },
    resultCount: { minWidth: 28, height: 28, paddingHorizontal: space.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderCurve: "continuous", backgroundColor: colors.surfaceAlt },
    resultCountText: { ...type.caption, color: colors.textSecondary, textAlign: "center", fontVariant: ["tabular-nums"] },
    resultsCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderCurve: "continuous", borderWidth: 1, borderColor: colors.hairline, overflow: "hidden", ...shadow.card },
    row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.md },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    rowIcon: { width: 40, height: 40, borderRadius: radius.md, borderCurve: "continuous", alignItems: "center", justifyContent: "center" },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { ...type.label, fontWeight: "700", color: colors.text },
    rowSubtitle: { ...type.caption, color: colors.textMuted, marginTop: 1 },
    rowDate: { ...type.caption, color: colors.textMuted, maxWidth: 72, textAlign: "right", flexShrink: 0 },
});
