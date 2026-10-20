import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { type } from "../../theme";
import { shortDate, shortTime } from "../../utils/dates";
import { ageInDays } from "../../utils/whoGrowth";
import { solidFoodStats } from "../../utils/feedingStats";
import { MILK_RANGES } from "../../utils/milkTypeHistory";
import { FOOD_CATEGORIES, buildSolidFoodChart, foodCategoryLabel, foodReactionLabel, searchSolidFoods, solidFoodCategory, sortSolidFoods } from "../../utils/solidFoods";
import { DashboardSurface as Surface, DashboardControl as Control, DashboardListTransition as Transition } from "./ConsultationsAppointmentsCard";
import SolidFoodIcon from "./SolidFoodIcon";
import FoodCategoryIcon from "./FoodCategoryIcon";
import FeedingStackedPlot from "./FeedingStackedPlot";
import PlanDetail from "./PlanDetail";
import AnimatedReveal from "./AnimatedReveal";

export function SolidFoodRow({ entry, reaction = false, onOpen }) {
    const { colors } = useTheme(), p = { ...colors.appointmentDashboard, ...colors.milkTypeDashboard, ...colors.solidFoodDashboard };
    const s = useMemo(() => makeStyles(p), [p]);
    const severe = entry.reactionSeverity === "severe", mild = entry.reactionSeverity === "mild";
    const tint = severe ? colors.dangerBg : mild ? colors.warningBg : null;
    const ink = severe ? colors.danger : mild ? colors.warning : p.secondary;
    return <Control material={{ surface: reaction && tint ? [colors.surface, tint, tint] : p.row }} radius={22}
        style={s.record} onPress={() => onOpen(entry)} accessibilityRole="button"
        accessibilityLabel={`View ${entry.foodIntroduced || "Solid food"}, ${reaction ? foodReactionLabel(entry) + ". " + (entry.reaction || "") : foodCategoryLabel(entry.foodCategory)}, ${shortDate(entry.date) || "Date not recorded"}`}>
        {reaction ? <View style={s.warning}><Ionicons accessible={false} name={severe ? "alert-circle" : "warning"} size={27} color={ink} /></View> : <SolidFoodIcon size={44} />}
        <View style={s.body}><Text style={s.recordTitle}>{entry.foodIntroduced || "Solid food"}</Text>
            {reaction ? <><Text style={[s.caption, { color: ink, fontWeight: "600" }]}>{foodReactionLabel(entry)}</Text>
                {entry.reaction ? <Text style={[s.caption, { color: ink }]}>{entry.reaction}</Text> : null}</>
                : <><Text style={s.caption}>{foodCategoryLabel(entry.foodCategory)}</Text>
                    {entry.reactionSeverity === "mild" || entry.reactionSeverity === "severe" || !entry.reactionSeverity && entry.reaction ? <Text style={[s.caption, { color: ink }]}>{foodReactionLabel(entry)}{entry.reactionSeverity ? " reaction recorded" : ""}</Text> : null}</>}
            <View style={s.date}><Ionicons accessible={false} name="calendar-outline" size={15} color={p.secondary} /><Text style={s.caption}>{shortDate(entry.date) || "Date not recorded"}</Text></View>
        </View><View accessible={false} pointerEvents="none" style={s.chevron}><Surface colors={p.control} highlight={p.highlight} radius={20} /><Ionicons name="chevron-forward" size={22} color={p.azure} /></View>
    </Control>;
}

export default function SolidFoodsCard({ entries, dob, today, unavailable = false, failed = false, onRetry, onAdd, onOpenEntry }) {
    const { colors } = useTheme(), p = { ...colors.appointmentDashboard, ...colors.milkTypeDashboard, ...colors.solidFoodDashboard };
    const s = useMemo(() => makeStyles(p), [p]), { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0), [plotWidth, setPlotWidth] = useState(0), [range, setRange] = useState("7");
    const [query, setQuery] = useState(""), [mode, setMode] = useState(null), [visible, setVisible] = useState(10), [selection, setSelection] = useState(null);
    const solids = useMemo(() => sortSolidFoods(entries.filter(e => e.entryType === "solid")), [entries]);
    const stats = useMemo(() => solidFoodStats(solids, today.slice(0, 7)), [solids, today]);
    const chart = useMemo(() => buildSolidFoodChart(solids, range, today), [solids, range, today]);
    const matching = useMemo(() => searchSolidFoods(solids, query), [solids, query]);
    const selected = selection && chart.points.find(point => point.from === selection.from);
    const chartEntries = selected ? selected.entries.filter(e => !selection.category || solidFoodCategory(e) === selection.category) : [];
    const columns = width >= 3 * 150 * fontScale + 92 ? 3 : width >= 2 * 120 * fontScale + 78 ? 2 : 1;
    const wideMetrics = (width - 64) * (columns === 3 ? 0.315 : columns === 2 ? 0.48 : 1) >= 180 * fontScale;
    const wideHeader = plotWidth >= 720 * fontScale;
    const legendColumns = plotWidth >= 290 * fontScale ? 3 : 2;
    const open = entry => { setMode(null); onOpenEntry(entry); };
    const inspect = (point, category = null) => { setSelection(point ? { from: point.from, category } : null); setVisible(10); setMode("chart"); };
    const show = value => { setVisible(10); setMode(value); };
    const days = stats.first && dob ? ageInDays(dob, stats.first.date) : null;
    const months = days != null && Number.isFinite(days) && days >= 0 ? Math.round(days / 30.4375) : null;
    const milestone = unavailable ? "Solid food records have not loaded." : stats.first ? `${stats.first.foodIntroduced} · ${shortDate(stats.first.date) || "Date not recorded"}${months == null ? "" : ` · ${months} month${months === 1 ? "" : "s"} old`}` : "No solid foods recorded.";
    const overviewValue = value => unavailable ? "Unavailable" : String(value);
    const help = "Counts saved Solid Food feeding entries, not servings or unique foods. Each entry counts once. Mixed dishes use the single category recorded by the parent. Other includes entries without a recorded category; food names are never classified automatically. Percentages are shares of entries in the chart range, rounded by largest remainder to total 100%. Very small shares can round to 0%. Search covers the complete food history independently of chart dates. Recorded reactions are not confirmed allergies.";
    const plan = { title: mode === "history" ? "Solid Food History" : mode === "reactions" ? "Food Reaction History"
        : selected ? `${selection.category ? foodCategoryLabel(selection.category) : "Food entries"} · ${shortDate(selected.from)}` : "Solid Food Chart Data",
        categoryLabel: "Solid foods", showDate: false, showTime: false, showReminder: false, showNotes: mode === "chart" && !selected,
        notes: help, details: mode === "history" ? [
            { label: "Different foods", value: overviewValue(stats.distinct) }, { label: "New this month", value: overviewValue(stats.newThisMonth) },
            { label: "With a reaction", value: overviewValue(stats.reactions.length) }, { label: "First solid food", value: milestone },
        ] : mode === "reactions" ? [{ label: "Recorded reactions", value: overviewValue(stats.reactions.length) }, { label: "Information", value: "Recorded food reactions are not confirmed allergies." }]
            : selected ? [{ label: "Dates", value: `${shortDate(selected.from)} – ${shortDate(selected.to)}` },
                ...FOOD_CATEGORIES.map(c => ({ label: foodCategoryLabel(c), value: `${selected.values[c]} entries` })), { label: "Total", value: `${selected.total} entries` }]
                : [{ label: "Range", value: `${shortDate(chart.window.from)} – ${shortDate(chart.window.to)}` }, { label: "Total", value: unavailable ? "Unavailable" : `${chart.total} entries` }] };
    const more = total => total > visible ? <Control material={{ surface: p.control }} radius={999} style={s.more}
        onPress={() => setVisible(count => count + 10)} accessibilityRole="button" accessibilityLabel={`Show more ${mode === "reactions" ? "reactions" : "food records"}, ${total - visible} remaining`}>
        <Ionicons name="chevron-down" size={18} color={p.azure} /><Text style={s.link}>Show more ({total - visible} remaining)</Text></Control> : null;
    const search = <View style={s.search}><Surface colors={p.row} highlight={p.highlight} radius={999} /><Ionicons name="search-outline" size={20} color={p.secondary} />
        <TextInput testID="solid-food-search" value={query} onChangeText={value => { setQuery(value); setVisible(10); }} placeholder="Search food, date, or reaction..."
            placeholderTextColor={p.secondary} style={s.input} accessibilityLabel="Search all solid food history" />
        {query ? <Control material={{ surface: p.control }} radius={22} style={s.smallControl} onPress={() => { setQuery(""); setVisible(10); }} accessibilityRole="button" accessibilityLabel="Clear food search"><Ionicons name="close" size={19} color={p.azure} /></Control> : null}</View>;
    const heading = (title, subtitle, target) => <View style={s.sectionHeader}><View style={s.body}><Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text><Text style={s.caption}>{subtitle}</Text></View>
        <Control material={{ surface: p.control }} radius={22} appearance="text" style={s.viewAll} onPress={() => show(target)} accessibilityRole="button" accessibilityLabel={`View all ${target === "reactions" ? "food reactions" : "solid food records"}`}><Text style={s.link}>View All</Text><Ionicons name="chevron-forward" size={17} color={p.azure} /></Control></View>;
    const empty = message => <Text testID="solid-food-empty" style={s.caption}>{unavailable ? "Solid food records are unavailable until they load." : message}</Text>;
    const rows = (data, count, reaction = false) => <AnimatedReveal duration={240} contentStyle={s.list}>
        {data.slice(0, count).map(entry => <SolidFoodRow key={entry.id} entry={entry} reaction={reaction} onOpen={open} />)}
    </AnimatedReveal>;
    const legend = <View testID="solid-legend" style={[s.legend, wideHeader && s.wideLegend]}>{FOOD_CATEGORIES.map(c => <View key={c} style={[s.legendEntry, { width: legendColumns === 3 ? "32%" : "49%" }]}><View style={s.dot}><Surface colors={colors.solidFoodCategories[c].segment} highlight={p.highlight} radius={6} /></View><Text style={s.caption}>{foodCategoryLabel(c)}</Text></View>)}</View>;
    return <View testID="solid-food-card" style={s.panel} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        <Surface colors={p.panel} highlight={p.highlight} radius={28} />
        <View style={s.header}><SolidFoodIcon size={52} /><View style={s.body}><Text accessibilityRole="header" style={s.title}>Solid Foods</Text><Text style={s.subtitle}>Foods the child has tried.</Text></View>
            <Control material={{ surface: p.control }} radius={24} style={s.add} onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add solid food entry"><Ionicons name="add" size={28} color={p.azure} /></Control></View>
        {failed ? <View style={s.notice}><Text style={s.caption}>{unavailable ? "Solid food records could not be loaded." : "Records could not be refreshed. Showing the last loaded entries."}</Text><Control material={{ surface: p.control }} style={s.more} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading solid foods"><Text style={s.link}>Retry</Text></Control></View> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.rangeScroll} contentContainerStyle={s.ranges}>
            {MILK_RANGES.map(option => <Control key={option.key} testID={`solid-range-${option.key}`} material={p.all} active={range === option.key} radius={999}
                style={[s.range, { width: Math.max(88 * fontScale, (width - 56) / 4), borderColor: range === option.key ? p.azure : p.divider }]}
                onPress={() => { setRange(option.key); setSelection(null); }} accessibilityRole="button" accessibilityLabel={`Solid foods ${option.label}`} accessibilityState={{ selected: range === option.key }}>
                <Text style={[s.rangeText, { color: range === option.key ? p.azure : p.secondary }]}>{option.label}</Text></Control>)}
        </ScrollView>
        <View testID="solid-analysis" style={s.analysis}>
            <Surface colors={p.row} highlight={p.highlight} radius={24} />
            <Transition filter={range}><View onLayout={e => setPlotWidth(e.nativeEvent.layout.width)}>
                <View style={[s.chartHeader, wideHeader && s.wideChartHeader]}><View style={s.body}>
                    <View style={s.chartTitleRow}><Text style={[s.sectionTitle, s.body]}>{chart.title}</Text><Control material={{ surface: p.control }} radius={16} faceSize={32} style={s.infoControl} onPress={() => inspect(null)} accessibilityRole="button" accessibilityLabel="View solid food chart data and help"><Ionicons name="information-circle-outline" size={21} color={p.azure} /></Control></View>
                    <Text style={s.caption}>{chart.subtitle}</Text></View>{legend}</View>
                <FeedingStackedPlot chart={chart} width={plotWidth} categories={FOOD_CATEGORIES} materials={colors.solidFoodCategories} p={p} prefix="solid" maxBarWidth={64} unit="Entries" unavailable={unavailable} onInspect={inspect} />
                {unavailable || !chart.total ? <Text testID="solid-chart-empty" style={s.caption}>{unavailable ? "Solid food records are unavailable until they load." : "No recorded solid food entries in this period."}</Text> : null}
            </View></Transition>
            <View testID="solid-category-metrics" style={s.metrics}>{FOOD_CATEGORIES.map(category => <View key={category} accessible
                accessibilityLabel={`${foodCategoryLabel(category)}, ${unavailable ? "count unavailable" : `${chart.totals[category]} entries${chart.total ? `, ${chart.displayPercentages[category]}% of entries` : ""}`}`}
                style={[s.metric, { width: columns === 3 ? "31.5%" : columns === 2 ? "48%" : "100%", backgroundColor: colors.solidFoodCategories[category].surface[0], boxShadow: colors.solidFoodCategories[category].shadow }, wideMetrics && s.wideMetric]}>
                <Surface colors={colors.solidFoodCategories[category].surface} highlight={p.highlight} radius={20} /><FoodCategoryIcon category={category} size={wideMetrics ? 64 : 52} />
                <View style={[s.metricBody, wideMetrics && s.wideMetricBody]}><Text style={s.value}>{unavailable ? "\u2014" : chart.totals[category].toLocaleString()}</Text><Text style={[s.metricLabel, { color: colors.solidFoodCategories[category].ink }]}>{foodCategoryLabel(category)}</Text><Text style={s.metricNote}>{unavailable ? "Unavailable" : chart.total ? `${chart.displayPercentages[category]}% of entries` : "Entries"}</Text></View>
            </View>)}</View>
        </View>
        <View testID="solid-reactions" style={s.reactions}><Surface colors={p.row} highlight={p.highlight} radius={24} />
            {heading("Recent Food Reactions", "Latest recorded reactions to foods.", "reactions")}
            {stats.reactions.length ? rows(stats.reactions, 2, true) : empty("No food reactions recorded.")}
        </View>
        {search}
        {heading("Recent Records", "Your latest solid food entries.", "history")}
        {matching.length ? rows(matching, 3) : empty(query ? "No food records match your search." : "No solid foods recorded yet.")}
        <PlanDetail visible={Boolean(mode)} plan={mode ? plan : null} onClose={() => setMode(null)}>
            <View style={s.modalContent}>
                {mode === "history" ? <>{search}{matching.length ? rows(matching, visible) : empty(query ? "No food records match your search." : "No solid foods recorded yet.")}{more(matching.length)}</>
                    : mode === "reactions" ? <>{stats.reactions.length ? rows(stats.reactions, visible, true) : empty("No food reactions recorded.")}{more(stats.reactions.length)}</>
                        : mode === "chart" && !unavailable ? selected ? <>
                            <Control material={{ surface: p.control }} style={s.more} onPress={() => inspect(null)} accessibilityRole="button" accessibilityLabel="View all solid food chart data"><Text style={s.link}>All chart data</Text></Control>
                            {chartEntries.slice(0, visible).map(entry => <Control key={entry.id} material={{ surface: p.row }} style={s.more} onPress={() => open(entry)} accessibilityRole="button" accessibilityLabel={`View food entry ${entry.foodIntroduced}, ${shortDate(entry.date)}`}><Text style={s.link}>{entry.foodIntroduced || "Solid food"} · {shortDate(entry.date)} {shortTime(entry.time)}</Text></Control>)}{more(chartEntries.length)}
                        </> : chart.points.map(point => <Control key={point.from} material={{ surface: p.row }} style={s.more} onPress={() => inspect(point)} accessibilityRole="button" accessibilityLabel={`${shortDate(point.from)} to ${shortDate(point.to)}, ${point.total} entries. ${FOOD_CATEGORIES.map(c => `${foodCategoryLabel(c)} ${point.values[c]}`).join(", ")}`}><Text style={s.link}>{shortDate(point.from)}{point.to !== point.from ? ` – ${shortDate(point.to)}` : ""} · {point.total} entries</Text></Control>) : null}
            </View>
        </PlanDetail>
    </View>;
}

const makeStyles = p => StyleSheet.create({
    panel: { padding: 16, gap: 18, borderRadius: 28, backgroundColor: p.panel[0], boxShadow: p.panelShadow, marginBottom: 24, overflow: "visible" },
    header: { flexDirection: "row", alignItems: "center", gap: 12 }, body: { flex: 1, minWidth: 0, gap: 3 }, title: { ...type.heading, fontSize: 20, lineHeight: 26, color: p.text },
    subtitle: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary }, add: { width: 48, height: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", boxShadow: p.iconShadow },
    caption: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, flexShrink: 1 }, sectionTitle: { ...type.bodyStrong, fontSize: 17, lineHeight: 24, color: p.text },
    rangeScroll: { marginHorizontal: -8, flexGrow: 0, overflow: "visible" }, ranges: { gap: 8, paddingHorizontal: 8, paddingVertical: 6 }, range: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center", alignItems: "center", borderWidth: 1 }, rangeText: { ...type.caption, fontSize: 13, lineHeight: 19 },
    analysis: { borderRadius: 24, padding: 16, gap: 20, backgroundColor: p.row[0], boxShadow: p.chartShadow, overflow: "visible" }, chartHeader: { gap: 16, marginBottom: 12 }, wideChartHeader: { flexDirection: "row", gap: 24 },
    legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }, wideLegend: { width: 300, flexShrink: 0 }, legendEntry: { flexDirection: "row", alignItems: "center", gap: 5 }, dot: { width: 12, height: 12, borderRadius: 6 },
    metrics: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 }, metric: { padding: 12, gap: 10, borderRadius: 20, alignItems: "center", minHeight: 150 }, wideMetric: { flexDirection: "row", minHeight: 124, gap: 14 }, wideMetricBody: { flex: 1, alignItems: "flex-start" }, metricBody: { minWidth: 0, gap: 3, alignItems: "center" },
    value: { ...type.title, fontSize: 24, lineHeight: 30, color: p.text }, metricLabel: { ...type.caption, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "600" }, metricNote: { ...type.caption, fontSize: 11, lineHeight: 17, color: p.secondary, textAlign: "center" },
    reactions: { borderRadius: 24, padding: 14, gap: 14, boxShadow: p.chartShadow, backgroundColor: p.row[0], overflow: "visible" }, sectionHeader: { flexDirection: "row", gap: 8, alignItems: "center" }, viewAll: { flexDirection: "row", gap: 2, alignItems: "center", paddingHorizontal: 8, flexShrink: 0 },
    list: { padding: 6, gap: 12 }, record: { minHeight: 100, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }, recordTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 22, color: p.text }, warning: { width: 32, alignItems: "center", flexShrink: 0 }, date: { flexDirection: "row", gap: 5, alignItems: "flex-start" },
    chevron: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", boxShadow: p.iconShadow, flexShrink: 0 },
    search: { minHeight: 48, borderRadius: 999, paddingLeft: 14, paddingRight: 4, gap: 8, flexDirection: "row", alignItems: "center", boxShadow: p.rowShadow }, input: { position: "relative", minHeight: 48, flex: 1, minWidth: 0, color: p.text, fontSize: 13, ...(Platform.OS === "web" ? { outlineColor: p.azure, outlineOffset: 2 } : {}) }, chartTitleRow: { flexDirection: "row", gap: 4, alignItems: "flex-start" }, infoControl: { width: 44, height: 44, marginTop: -10, marginBottom: -10, alignItems: "center", justifyContent: "center" }, smallControl: { width: 44, alignItems: "center", justifyContent: "center" },
    more: { minHeight: 48, borderRadius: 22, padding: 12, gap: 6, flexDirection: "row", alignItems: "center", justifyContent: "center" }, link: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.azure }, notice: { gap: 8 }, modalContent: { gap: 12, padding: 12 },
});
