import RecordIcon from "./ui/RecordIcon";
import HospitalStayIcon from "./ui/HospitalStayIcon";
import VaccineIcon from "./ui/VaccineIcon";
import { recordItemStyle } from "../theme";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
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
import MedicationIcon from "./ui/MedicationIcon";
import { EmptyStateCard } from "./common/Cards";
import { AppointmentsSkeleton } from "./ui/Skeleton";
import { useRefreshControl } from "./ui/useRefreshControl";
import { DashboardSurface as Surface, DashboardControl as Control } from "./ui/ConsultationsAppointmentsCard";

const HISTORY_KEY = (childId) => `bb_search_history:${childId}`;
const SEARCH_RESOURCES = ["vaccinations", "checkups", "medical-history", "milestones", "memories", "calendar-events"];

const CATEGORIES = [
    { labelKey: "searchVaccines", tone: "vaccines", view: "health", tab: "immunizations" },
    { labelKey: "searchConditions", icon: "pulse-outline", tone: "conditions", view: "health", tab: "illnesses" },
    { labelKey: "searchMilestones", recordCategory: "milestone", tone: "milestones", view: "growth", tab: "milestones" },
    { labelKey: "searchCalendar", icon: "today-outline", tone: "calendar", view: "calendar", tab: null },
    { labelKey: "searchCheckups", icon: "calendar-outline", tone: "checkups", view: "health", tab: "appointments" },
    { labelKey: "searchMedicine", medication: true, tone: "medication", view: "health", tab: "medications" },
    { labelKey: "searchMemories", icon: "image-outline", tone: "memories", view: "growth", tab: "gallery" },
];

// Text records are decrypted by the authenticated API, then filtered locally:
// randomized field encryption means SQL LIKE cannot search them safely.
export default function Search({ profile, onNavigate }) {
    const { colors } = useTheme();
    const p = colors.searchSurface;
    const { t } = useLanguage();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const { scrollProps, scrollViewRef } = useScroll();
    const vaxCache = useRecordCache(profile.id, "vaccinations");
    const checkupCache = useRecordCache(profile.id, "checkups");
    const medicalCache = useRecordCache(profile.id, "medical-history");
    const milestoneCache = useRecordCache(profile.id, "milestones");
    const memoryCache = useRecordCache(profile.id, "memories");
    const eventCache = useRecordCache(profile.id, "calendar-events");
    const epoch = useSessionEpoch();
    const [query, setQuery] = useState("");
    const [history, setHistory] = useState([]);
    const [inputFocused, setInputFocused] = useState(false);
    const [gridWidth, setGridWidth] = useState(0);
    const { width, fontScale = 1 } = useWindowDimensions();
    const available = gridWidth || width - 32;
    const columns = available >= 4 * 112 * fontScale + 36 ? 4 : available >= 2 * 112 * fontScale + 12 ? 2 : 1;
    // Leave one pixel for native/web measurement rounding so the last tile stays in its row.
    const cardWidth = Math.floor((available - (columns - 1) * 12 - 1) / columns);
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
            built.push({ key: `vax-${v.id}`, title: v.vaccineName, subtitle: v.visitName || (v.isCompleted ? t("searchGiven") : t("searchScheduled")), date: v.completedDate || v.dueDate, searchText: `${v.vaccineName} ${v.visitName} ${v.notes} vaccine vaccination ${t("searchVaccines")}`, iconColor: colors.recVaccine.on, iconBg: colors.recVaccine.bg, navTo: { view: "health", tab: "immunizations" } });
        });
        (checkups || []).forEach((row) => {
            const c = checkupToApp(row);
            built.push({ key: `chk-${c.id}`, title: c.title, subtitle: c.provider || t("searchCheckups"), date: c.date, searchText: `${c.title} ${c.provider} ${c.notes} checkup appointment ${t("searchCheckups")}`, icon: "calendar-outline", iconColor: colors.recCheckup.on, iconBg: colors.recCheckup.bg, navTo: { view: "health", tab: "appointments" } });
        });
        (medHistory || []).forEach((row) => {
            if (row.category === "Medication") {
                const m = medHistoryToMed(row);
                built.push({ key: `med-${m.id}`, title: m.title, subtitle: m.dosage ? `${t("searchDosage")}: ${m.dosage}` : m.duration, date: row.date_recorded, searchText: `${m.title} ${m.dosage} ${m.duration} medicine medication ${t("searchMedicine")}`, medication: row, navTo: { view: "health", tab: "medications" } });
            } else {
                const item = medHistoryToIllness(row);
                const hospitalization = row.category === "Hospitalization";
                const allergy = row.category === "Allergy";
                const hereditary = row.category === "Hereditary Condition";
                const tone = hospitalization
                    ? colors.recHospitalization
                    : allergy
                      ? colors.conditionCategory.allergy
                      : hereditary
                        ? colors.conditionCategory.hereditary
                        : colors.conditionCategory.illness;
                const categoryLabel = hospitalization ? t("searchHospitalization") : hereditary ? "Hereditary condition" : row.category;
                built.push({ key: `${hospitalization ? "hosp" : allergy ? "allergy" : hereditary ? "hereditary" : "ill"}-${item.id}`, title: item.title, hospitalization, conditionCategory: hospitalization ? null : row.category, subtitle: categoryLabel || (item.resolved ? t("searchResolved") : t("searchActiveCondition")), date: item.date, searchText: `${item.title} ${item.desc} ${row.category} condition illness allergy hereditary hospitalization ${t("searchConditions")}`, icon: allergy ? "alert-circle-outline" : "pulse-outline", iconColor: tone.on, iconBg: tone.bg, navTo: { view: "health", tab: hospitalization ? "appointments" : "illnesses" } });
            }
        });
        (milestones || []).forEach((row) => {
            const m = milestoneToApp(row);
            built.push({ key: `ms-${m.id}`, title: m.title, subtitle: m.isCompleted ? t("searchMilestoneReached") : t("searchNotReached"), date: m.date, searchText: `${m.title} ${m.description} milestone development ${t("searchMilestones")}`, recordCategory: "milestone", iconColor: colors.recGrowth.on, iconBg: colors.recGrowth.bg, navTo: { view: "growth", tab: "milestones" } });
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
    const removeHistory = (term) => {
        const next = history.filter((item) => item !== term);
        setHistory(next);
        const save = next.length
            ? storage.setItem(HISTORY_KEY(profile.id), JSON.stringify(next))
            : storage.removeItem(HISTORY_KEY(profile.id));
        save.catch(() => {});
    };
    const openResult = (item) => {
        rememberSearch(query);
        onNavigate(item.navTo.view, item.navTo.tab);
    };

    const renderChip = (term, source) => source === "history" ? (
        <View key={`${source}-${term}`} testID="search-history-row" style={styles.historyChip}>
            <Surface colors={p.surface} highlight={p.highlight} radius={22} />
            <Control appearance="text" material={{ surface: p.surface }} style={styles.historyChipAction}
                onPress={() => runSearch(term)} accessibilityRole="button" accessibilityLabel={`${t("searchFor")} ${term}`}>
                <Text style={styles.historyText} numberOfLines={2} ellipsizeMode="tail">{term}</Text>
            </Control>
            <Control material={{ surface: p.surface }} faceSize={36} radius={18} style={styles.historyRemove}
                onPress={() => removeHistory(term)} accessibilityRole="button" accessibilityLabel={t("searchRemoveHistory").replace("{query}", term)}>
                <Ionicons accessible={false} name="close" size={22} color={p.mutedIcon} />
            </Control>
        </View>
    ) : (
        <Control key={`${source}-${term}`} testID="search-suggestion" material={{ surface: p.surface }} radius={999} style={styles.chip}
            onPress={() => runSearch(term)} accessibilityRole="button" accessibilityLabel={`${t("searchFor")} ${term}`}>
            <Text style={styles.chipText}>{term}</Text>
        </Control>
    );

    return (
        <KeyboardAvoidingView testID="search-screen" style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.searchBar, { marginTop: padTop }, Platform.OS === "web" && {
                outlineStyle: inputFocused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: p.azure }]}>
                <Surface colors={p.surface} highlight={p.highlight} radius={999} />
                <Ionicons accessible={false} name="search-outline" size={26} color={p.mutedIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={t("searchPlaceholder")}
                    placeholderTextColor={p.secondary}
                    value={query}
                    onChangeText={setQuery}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onSubmitEditing={() => rememberSearch(query)}
                    returnKeyType="search"
                    autoFocus
                    accessibilityLabel={t("searchRecords")}
                />
                {query ? <Control material={{ surface: p.surface }} appearance="text" style={styles.clearQuery} onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel={t("searchClearQuery")}><Ionicons accessible={false} name="close-circle" size={20} color={p.mutedIcon} /></Control> : null}
            </View>

            <Animated.ScrollView ref={scrollViewRef} contentContainerStyle={[styles.content, { paddingBottom: padBottom }]} refreshControl={refreshControl} {...scrollProps} keyboardShouldPersistTaps="handled">
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
                                    <TouchableOpacity key={item.key} onPress={() => openResult(item)} style={styles.row} accessibilityRole="button" accessibilityLabel={item.title}>
                                        {item.conditionCategory || item.recordCategory ? <RecordIcon category={item.conditionCategory || item.recordCategory} size={40} /> : item.hospitalization ? <HospitalStayIcon size={40} /> : item.navTo?.tab === "immunizations" ? <VaccineIcon size={40} /> : item.medication ? <MedicationIcon record={item.medication} size={40} /> : <View style={[styles.rowIcon, { backgroundColor: item.iconBg }]}><Ionicons name={item.icon} size={19} color={item.iconColor} /></View>}
                                        <View style={styles.rowBody}>
                                            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                                            <Text style={styles.rowSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                                            {item.date ? <Text style={styles.rowDate}>{shortDate(item.date)}</Text> : null}
                                        </View>
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
                                <View style={styles.headingText}><Text accessibilityRole="header" style={[styles.sectionTitle, styles.sectionHeadingTitle]}>{t("searchHistory")}</Text><Text style={styles.description}>{t("searchHistoryDescription")}</Text></View>
                                {history.length ? <Control material={{ surface: p.surface }} radius={999} style={styles.clearHistory} onPress={clearHistory} accessibilityRole="button" accessibilityLabel={t("searchClearHistory")}><Text style={styles.clearHistoryText}>{t("searchClearHistory")}</Text></Control> : null}
                            </View>
                            {history.length ? <View style={styles.historyList}>{history.map((term) => renderChip(term, "history"))}</View> : <Text style={styles.emptyHistory}>{t("searchNoHistory")}</Text>}
                        </View>

                        <View style={styles.section}>
                            <Text accessibilityRole="header" style={styles.sectionTitle}>{t("searchByCategory")}</Text>
                            <Text style={styles.description}>{t("searchCategoryDescription")}</Text>
                            <View testID="search-category-grid" style={styles.categoryGrid} onLayout={e => setGridWidth(e.nativeEvent.layout.width)}>
                                {CATEGORIES.map(category => {
                                    const material = p.categories[category.tone];
                                    return <Control key={category.labelKey} testID={`search-category-${category.tone}`} material={material} radius={22}
                                        style={[styles.categoryCard, { width: cardWidth }]}
                                        onPress={() => onNavigate(category.view, category.tab)} accessibilityRole="button" accessibilityLabel={t(category.labelKey)}>
                                        <View style={styles.categoryIcon}>
                                            <Surface colors={material.surface} highlight={p.highlight} radius={26} />
                                            {category.recordCategory ? <RecordIcon category={category.recordCategory} size={48} /> : category.tab === "immunizations" ? <VaccineIcon size={48} showBackground={false} />
                                                : category.medication ? <MedicationIcon size={48} showBackground={false} />
                                                : category.tab === "appointments" ? <Image accessible={false} source={require("../assets/navbar/calendar-blue.png")} resizeMode="contain" style={styles.calendarArt} />
                                                : <Ionicons accessible={false} name={category.icon} size={32} color={material.ink} />}
                                        </View>
                                        <Text style={styles.categoryText}>{t(category.labelKey)}</Text>
                                    </Control>;
                                })}
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text accessibilityRole="header" style={styles.sectionTitle}>{t("searchSuggestions")}</Text>
                            <Text style={styles.description}>{t("searchSuggestionsDescription")}</Text>
                            <View style={styles.chipWrap}>{suggestions.map((term) => renderChip(term, "suggestion"))}</View>
                        </View>
                    </>
                )}
            </Animated.ScrollView>
        </KeyboardAvoidingView>
    );
}

const makeStyles = (colors) => {
    const p = colors.searchSurface;
    return StyleSheet.create({
    root: { flex: 1, backgroundColor: "transparent" },
    searchBar: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, paddingHorizontal: 16, borderRadius: 999, boxShadow: p.shadow },
    searchInput: { position: "relative", flex: 1, minWidth: 0, minHeight: 56, ...type.body, fontSize: 15, lineHeight: 22, color: p.text, ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) },
    clearQuery: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", marginRight: -8 },
    content: { paddingHorizontal: 16, paddingTop: 24 },
    refreshNotice: { marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    section: { marginBottom: 28 },
    sectionHeading: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
    sectionTitle: { ...type.title, fontSize: 20, lineHeight: 26, color: p.text, marginBottom: 4, textTransform: "capitalize" },
    sectionHeadingTitle: { marginBottom: 0 }, headingText: { flex: 1, minWidth: 0, gap: 4 },
    description: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingVertical: 16 },
    chip: { minHeight: MIN_TOUCH, maxWidth: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10 },
    chipText: { ...type.label, fontSize: 14, lineHeight: 20, color: p.azure, flexShrink: 1 },
    historyList: { gap: 12 },
    historyChip: { width: "100%", minHeight: 56, flexDirection: "row", alignItems: "center", borderRadius: 22, boxShadow: p.rowShadow, overflow: "visible" },
    historyChipAction: { minHeight: 56, flex: 1, minWidth: 0, justifyContent: "center", paddingLeft: 16, paddingRight: 8, paddingVertical: 12 },
    historyText: { ...type.label, fontSize: 15, lineHeight: 22, color: p.text },
    historyRemove: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 6 },
    clearHistory: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: 16, flexShrink: 0 },
    clearHistoryText: { ...type.label, fontSize: 13, color: p.azure },
    emptyHistory: { ...type.caption, color: p.secondary },
    categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingVertical: 16 },
    categoryCard: { minHeight: 132, alignItems: "center", justifyContent: "center", gap: 10, padding: 12 },
    categoryIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, boxShadow: p.rowShadow },
    calendarArt: { width: 38, height: 38 },
    categoryText: { ...type.bodyStrong, fontSize: 13, lineHeight: 19, color: p.text, textAlign: "center" },
    resultCount: { minWidth: 28, height: 28, paddingHorizontal: space.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderCurve: "continuous", backgroundColor: colors.surfaceAlt },
    resultCountText: { ...type.caption, color: colors.textSecondary, textAlign: "center", fontVariant: ["tabular-nums"] },
    resultsCard: {  borderRadius: radius.xl, borderCurve: "continuous",  borderColor: colors.hairline,  ...shadow.card  , overflow: "visible", backgroundColor: "transparent", borderWidth: 0, boxShadow: "none"},
    row: { ...recordItemStyle(colors),  minHeight: 68, flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm,  borderRadius: 24, borderWidth: 0, marginBottom: 12, overflow: "visible", paddingHorizontal: 12},
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    rowIcon: { width: 40, height: 40, borderRadius: radius.md, borderCurve: "continuous", alignItems: "center", justifyContent: "center" },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { ...type.label, fontWeight: "700", color: colors.text },
    rowSubtitle: { ...type.caption, color: colors.textMuted, marginTop: 1 },
    rowDate: { ...type.caption, color: colors.textMuted, marginTop: space.xs },
    });
};
