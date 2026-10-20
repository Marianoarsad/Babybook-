import React, { useId, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { type } from "../../theme";
import { shortDate, shortTime } from "../../utils/dates";
import { MILK_TYPES } from "../../utils/milkTypeHistory";
import { milkFeedType } from "../../utils/milkFeedingChart";
import { DashboardSurface as Surface, DashboardControl as Control } from "./ConsultationsAppointmentsCard";
import PlanDetail from "./PlanDetail";
import FeedingStackedPlot from "./FeedingStackedPlot";

export { roundedStackedBar as roundedMilkBar } from "./FeedingStackedPlot";

// Analytical illustrations only; the shared MilkIcon remains the record identity.
export function MilkAnalyticIcon({ kind, size = 44 }) {
    const { colors } = useTheme(), material = colors.milkType[kind];
    const id = "milk-analytic-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <View accessible={false} pointerEvents="none" style={{ width: size, height: size, borderRadius: size / 2, boxShadow: material.shadow }}>
        <Surface colors={material.surface} highlight={colors.appointmentDashboard.highlight} radius={size / 2} />
        <Svg accessible={false} width={size} height={size} viewBox="0 0 48 48" style={{ position: "relative" }}>
            <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">{material.segment.map((color, i) => <Stop key={i} offset={i / 2} stopColor={color} />)}</LinearGradient></Defs>
            {kind === "Formula" ? <>
                <Rect x="16" y="18" width="17" height="23" rx="5" fill={`url(#${id})`} />
                <Rect x="19" y="21" width="11" height="17" rx="3" fill={colors.nutritionArtwork.white[0]} />
                <Rect x="15" y="15" width="19" height="6" rx="3" fill={`url(#${id})`} />
                <Path d="M21 15v-3q0-4 3-4t3 4v3" fill={`url(#${id})`} />
                <Path d="M18 24v11 M18 17h10" stroke={colors.nutritionArtwork.reflection} strokeOpacity="0.75" strokeWidth="1.5" strokeLinecap="round" />
            </> : <>
                <Path d="M24 7C21 13 13 22 13 29a11 11 0 0 0 22 0C35 22 27 13 24 7Z" fill={`url(#${id})`} />
                <Path d="M23 13c-3 6-7 11-7 16" fill="none" stroke={colors.nutritionArtwork.reflection} strokeOpacity="0.8" strokeWidth="2.5" strokeLinecap="round" />
            </>}
        </Svg>
    </View>;
}

export default function MilkFeedingStackedChart({ chart, unavailable = false, stale = false, onOpenEntry }) {
    const { colors } = useTheme(), p = { ...colors.appointmentDashboard, ...colors.milkTypeDashboard };
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0), [dataOpen, setDataOpen] = useState(false), [selection, setSelection] = useState(null), [visible, setVisible] = useState(10);
    const styles = useMemo(() => makeStyles(p), [p]);
    const selected = selection && chart.points.find(point => point.from === selection.from);
    const entries = selected ? selected.entries.filter(feed => !selection.type || milkFeedType(feed) === selection.type) : [];
    const inspect = (point, category = null) => { setSelection(point ? { from: point.from, type: category } : null); setVisible(10); setDataOpen(true); };
    const help = `Counts recorded feeding events, not milk volume or feeding minutes. Mixed entries count once. Percentages are shares of categorized feeds.${chart.excluded ? ` ${chart.excluded} uncategorized milk ${chart.excluded === 1 ? "entry is" : "entries are"} excluded.` : ""} Saved milk-type periods do not create feeding events. Search covers all milk-type history independently of the chart dates. The + button adds a history period; feeding events are logged through the existing Milk form.`;
    const plan = { title: selected ? `${selection.type || "Milk feedings"} · ${shortDate(selected.from)}` : "Milk Feeding Data", categoryLabel: "Feeding history", date: selected?.from || chart.window.from,
        showTime: false, showReminder: false, showNotes: !selected, notes: help,
        details: selected ? [{ label: "Dates", value: `${shortDate(selected.from)} – ${shortDate(selected.to)}` },
            ...MILK_TYPES.map(t => ({ label: t, value: `${selected.values[t]} feeds` })), { label: "Total", value: `${selected.total} feeds` }]
            : [{ label: "Range", value: `${shortDate(chart.window.from)} – ${shortDate(chart.window.to)}` }, { label: "Total", value: unavailable ? "Unavailable" : `${chart.total} categorized feeds` }] };
    const legend = <View style={styles.legend}>{MILK_TYPES.map(t => <View key={t} style={styles.legendEntry}>
        <View style={styles.dot}><Surface colors={colors.milkType[t].segment} highlight={p.highlight} radius={6} /></View><Text style={styles.caption}>{t}</Text></View>)}</View>;
    return <View testID="milk-stacked-chart" onLayout={e => setWidth(e.nativeEvent.layout.width)} style={styles.chart}>
        <View style={[styles.heading, width >= 560 * fontScale && styles.wideHeading]}><View style={styles.body}>
            <View style={styles.titleRow}><Text style={styles.title}>{chart.title}</Text>
                <Control material={{ surface: p.control }} radius={22} style={styles.info} onPress={() => inspect(null)} accessibilityRole="button" accessibilityLabel="View milk feeding chart data and help">
                    <Ionicons name="information-circle-outline" size={21} color={p.azure} /></Control></View>
            <Text style={styles.caption}>{chart.subtitle}</Text>
        </View>{width >= 560 * fontScale ? legend : null}</View>
        {width < 560 * fontScale ? legend : null}
        <FeedingStackedPlot chart={chart} width={width} categories={MILK_TYPES} materials={colors.milkType} p={p}
            prefix="milk" unit="Feeds" unavailable={unavailable} onInspect={inspect} />
        {unavailable || !chart.total ? <Text testID="milk-chart-empty" style={styles.caption}>{unavailable ? "Feeding records are unavailable until they load." : "No recorded milk feedings in this period."}</Text> : null}
        {stale && !unavailable ? <Text style={styles.caption}>Feeding records could not be refreshed. Showing the last loaded entries.</Text> : null}
        <PlanDetail visible={dataOpen} plan={plan} onClose={() => setDataOpen(false)}>
            {selected ? <View style={styles.list}>
                <Control material={{ surface: p.control }} style={styles.entry} onPress={() => inspect(null)} accessibilityRole="button" accessibilityLabel="View all chart data"><Text style={styles.link}>All chart data</Text></Control>
                {entries.slice(0, visible).map(feed => <Control key={feed.id} material={{ surface: p.row }} style={styles.entry} onPress={() => { setDataOpen(false); onOpenEntry(feed); }}
                    accessibilityRole="button" accessibilityLabel={`View ${milkFeedType(feed)} feeding, ${shortDate(feed.date)} ${shortTime(feed.time)}`}>
                    <Text style={styles.link}>{milkFeedType(feed)} · {shortDate(feed.date)} {shortTime(feed.time)}</Text></Control>)}
                {entries.length > visible ? <Control material={{ surface: p.control }} style={styles.entry} onPress={() => setVisible(count => count + 10)} accessibilityRole="button" accessibilityLabel="Show more chart feeding entries"><Text style={styles.link}>Show more ({entries.length - visible} remaining)</Text></Control> : null}
            </View> : unavailable ? null : <View style={styles.list}>{chart.points.map(point => <Control key={point.from} material={{ surface: p.row }} style={styles.entry} onPress={() => inspect(point)}
                accessibilityRole="button" accessibilityLabel={`${shortDate(point.from)} to ${shortDate(point.to)}, ${point.total} feeds. ${MILK_TYPES.map(t => `${t} ${point.values[t]}`).join(", ")}`}>
                <Text style={styles.link}>{shortDate(point.from)}{point.to !== point.from ? ` – ${shortDate(point.to)}` : ""} · {point.total} feeds</Text></Control>)}</View>}
        </PlanDetail>
    </View>;
}

const makeStyles = p => StyleSheet.create({
    chart: { gap: 14 }, heading: { gap: 10 }, wideHeading: { flexDirection: "row", gap: 20 }, body: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 4 }, title: { ...type.bodyStrong, fontSize: 16, lineHeight: 23, color: p.text, flex: 1 },
    info: { width: 44, alignItems: "center", justifyContent: "center" }, caption: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary },
    legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, legendEntry: { flexDirection: "row", alignItems: "center", gap: 5 }, dot: { width: 12, height: 12, borderRadius: 6 },
    plot: { flexDirection: "row", minWidth: 0 }, plotScroll: { flex: 1, minWidth: 0 }, list: { gap: 12, padding: 12 },
    entry: { minHeight: 48, padding: 12, justifyContent: "center" }, link: { ...type.caption, color: p.azure, lineHeight: 20 },
});
