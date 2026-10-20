import React, { useMemo, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, type } from "../../theme";
import { DashboardSurface as Surface, DashboardControl as Control, DashboardListTransition as ListTransition, AppointmentStatusIcon } from "./ConsultationsAppointmentsCard";
import AnimatedReveal from "./AnimatedReveal";
import { AppointmentsSkeleton, SkeletonBlock } from "./Skeleton";
import HospitalBuildingIcon from "./HospitalBuildingIcon";
import HospitalStayIcon from "./HospitalStayIcon";
import AllRecordsIcon from "./AllRecordsIcon";
import useSoftPress from "./useSoftPress";

const EMPTY = { all: "No hospital stays recorded yet", current: "No ongoing hospital stays.", past: "No past hospital stays recorded." };

export function HospitalStayMetrics({ summary, filter, onSelect }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const columns = width >= 600 * fontScale ? 4 : width > 0 && (width - 10) / 2 < 100 * fontScale ? 1 : 2;
    const compact = width > 0 && width / columns < 148 * fontScale;
    const tiles = [
        { key: "all", label: "All", value: summary.counts.all, material: p.all, icon: <AllRecordsIcon size={40} /> },
        { key: "current", label: "Current", value: summary.counts.current, material: p.overdue, icon: <HospitalStayIcon size={40} /> },
        { key: "past", label: "Past", value: summary.counts.past, material: p.completed, icon: <AppointmentStatusIcon kind="completed" size={40} /> },
        { key: "days", label: "Total Days", value: summary.totalDays, material: { surface: colors.feedingBreakdown.entries }, icon: <AppointmentStatusIcon kind="headerIcon" size={40} /> },
    ];
    const groups = [];
    for (let i = 0; i < tiles.length; i += columns) groups.push(tiles.slice(i, i + columns));
    return <View testID="hospital-metrics" style={styles.metrics} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {groups.map((group, i) => <View key={i} style={styles.metricRow}>
            {group.map(tile => {
                const value = tile.value == null ? "Not recorded" : tile.value.toLocaleString();
                const contents = <>{tile.icon}<View style={styles.metricBody}>
                    <Text style={[styles.value, tile.value == null && styles.missing, compact && styles.centered]}>{value}</Text>
                    <Text style={[styles.metricLabel, compact && styles.centered, { color: tile.material.ink || p.text, fontWeight: filter === tile.key ? "700" : "500" }]}>{tile.label}</Text>
                    {tile.key === "days" ? <Text style={[styles.metricNote, compact && styles.centered]}>Discharged stays only</Text> : null}
                </View></>;
                const style = [styles.metric, compact && styles.compactMetric];
                return tile.key === "days" ? <View key={tile.key} testID="hospital-total-days" accessible
                    accessibilityLabel={`Total days, ${value}. Sum of discharged stays only; both admission and discharge dates count.`}
                    style={[...style, { backgroundColor: tile.material.surface[0], boxShadow: p.rowShadow }]}>
                    <Surface colors={tile.material.surface} highlight={p.highlight} />{contents}
                </View> : <Control key={tile.key} testID={`hospital-filter-${tile.key}`} material={tile.material} active={filter === tile.key}
                    style={style} onPress={() => onSelect(tile.key)} accessibilityRole="button"
                    accessibilityLabel={`${tile.label}, ${value} hospital ${tile.value === 1 ? "stay" : "stays"}`}
                    accessibilityState={{ selected: filter === tile.key }}>{contents}</Control>;
            })}
        </View>)}
        {summary.excludedStays > 0 ? <Text style={styles.excluded}>
            Total Days excludes {summary.excludedStays} discharged {summary.excludedStays === 1 ? "stay" : "stays"} without valid admission and discharge dates.
        </Text> : null}
    </View>;
}

export function HospitalStayItem({ stay, onOpen, thumbnailUrl, onOpenAttachment }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const { respond, transform } = useSoftPress();
    const [focused, setFocused] = useState(false), [pressed, setPressed] = useState(false);
    const press = down => { setPressed(down); respond(down); };
    const focus = e => setFocused(Platform.OS === "web" && Boolean(e.currentTarget?.matches?.(":focus-visible")));
    return <Animated.View testID={`hospital-stay-${stay.id}`} style={[styles.item, { transform, boxShadow: pressed ? p.pressedShadow : p.rowShadow }]}>
        <Surface colors={p.row} highlight={p.highlight} />
        <Pressable style={[styles.itemBody, Platform.OS === "web" && { outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 2, outlineColor: p.azure }]}
            onPress={() => onOpen(stay)} onPressIn={() => press(true)} onPressOut={() => press(false)} onFocus={focus} onKeyDown={focus}
            onBlur={() => { setFocused(false); press(false); }} accessibilityRole="button"
            accessibilityLabel={`View ${stay.title} hospital stay details. ${stay.statusLabel}. ${stay.facility || ""}. ${stay.dateLabel}. ${stay.durationLabel}`}>
            <HospitalStayIcon size={44} />
            <View style={styles.information}>
                <Text style={styles.itemTitle}>{stay.title}</Text>
                {stay.facility ? <Text style={styles.facility}>{stay.facility}</Text> : null}
                <Text style={[styles.status, { color: stay.stayStatus === "current" ? p.upcoming.ink : stay.stayStatus === "past" ? p.completed.ink : p.secondary }]}>{stay.statusLabel}</Text>
                <View style={styles.metaPair}><Ionicons accessible={false} name="calendar-outline" size={13} color={p.secondary} /><Text style={styles.metadata}>{stay.dateLabel}</Text></View>
                <View style={styles.metaPair}><Ionicons accessible={false} name="time-outline" size={13} color={p.secondary} /><Text style={styles.metadata}>{stay.durationLabel}</Text></View>
            </View>
            <View accessible={false} pointerEvents="none" style={styles.chevron}>
                <Surface colors={p.control} highlight={p.highlight} radius={17} /><Ionicons accessible={false} name="chevron-forward" size={21} color={p.chevron} />
            </View>
        </Pressable>
        {thumbnailUrl ? <Pressable style={styles.attachment} onPress={() => onOpenAttachment(stay)} accessibilityRole="button" accessibilityLabel={`View attached photo for ${stay.title}`}>
            <Image accessible={false} source={{ uri: thumbnailUrl }} style={styles.thumbnail} /><Text style={styles.attachmentText}>View attached photo</Text>
        </Pressable> : null}
    </Animated.View>;
}

export default function HospitalStaysCard({ summary, loading, loadFailed, onRetry, onAdd, onOpen, attachmentUrl, onOpenAttachment }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const [selection, setSelection] = useState({ filter: "all", visible: 10 });
    const { filter, visible } = selection;
    const filtered = useMemo(() => filter === "all" ? summary.stays : summary.stays.filter(stay => stay.stayStatus === filter), [summary.stays, filter]);
    const remaining = Math.max(0, filtered.length - visible);
    return <View testID="hospital-stays-card" style={styles.panel}>
        <Surface colors={p.panel} highlight={p.highlight} radius={28} />
        <View style={styles.header}><HospitalBuildingIcon showBackground={false} /><Text style={styles.title}>Hospital Stays</Text>
            <Control material={{ surface: p.control }} radius={22} style={styles.add} onPress={onAdd} accessibilityRole="button" accessibilityLabel="Log a hospital stay">
                <Ionicons accessible={false} name="add" size={28} color={p.azure} />
            </Control>
        </View>
        <Text style={styles.subtitle}>Record and manage hospital stays for your child.</Text>
        {loading ? <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading hospital stays">
            <SkeletonBlock height={95} borderRadius={22} /><AppointmentsSkeleton count={2} />
        </View> : loadFailed ? <View style={styles.empty}>
            <Text style={styles.emptyText}>Hospital stays could not be loaded.</Text>
            <Control material={{ surface: p.control }} style={styles.more} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading hospital stays"><Text style={styles.moreText}>Retry</Text></Control>
        </View> : <>
            <HospitalStayMetrics summary={summary} filter={filter} onSelect={next => setSelection(previous => previous.filter === next ? previous : { filter: next, visible: 10 })} />
            <AnimatedReveal duration={240} contentStyle={styles.listSpace}>
                <ListTransition filter={filter} testID="hospital-list-transition">
                    <View testID="hospital-results" style={styles.items} accessibilityLiveRegion="polite">
                        {filtered.slice(0, visible).map(stay => <HospitalStayItem key={stay.id} stay={stay} onOpen={onOpen} thumbnailUrl={attachmentUrl?.(stay)} onOpenAttachment={onOpenAttachment} />)}
                        {!filtered.length ? <View testID="hospital-empty" style={styles.empty}>
                            <Surface colors={p.row} highlight={p.highlight} />
                            <HospitalBuildingIcon empty size={filter === "all" ? 150 : 86} />
                            <Text style={styles.emptyTitle}>{EMPTY[filter]}</Text>
                            {filter === "all" ? <><Text style={styles.emptyText}>Keep track of your child’s hospital stays in one place.</Text><Text style={styles.emptyText}>Tap the + button to add a record.</Text></> : null}
                        </View> : null}
                        {remaining > 0 ? <Control material={{ surface: p.control }} radius={999} style={styles.more}
                            onPress={() => setSelection(previous => ({ ...previous, visible: previous.visible + 10 }))} accessibilityRole="button"
                            accessibilityLabel={`Show more ${filter === "all" ? "" : filter + " "}hospital stays, ${remaining} remaining`}>
                            <Ionicons accessible={false} name="chevron-down" size={18} color={p.azure} /><Text style={styles.moreText}>Show more ({remaining.toLocaleString()} remaining)</Text>
                        </Control> : null}
                    </View>
                </ListTransition>
            </AnimatedReveal>
        </>}
    </View>;
}

const makeStyles = p => StyleSheet.create({
    panel: { padding: 14, borderRadius: 28, backgroundColor: p.panel[0], boxShadow: p.panelShadow, marginBottom: 20, overflow: "visible" },
    header: { flexDirection: "row", alignItems: "center", gap: 10 }, title: { ...type.heading, fontSize: 18, lineHeight: 24, color: p.text, flex: 1, minWidth: 0 },
    subtitle: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary, marginTop: 8 }, add: { width: 44, height: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    metrics: { marginTop: 16, gap: 10 }, metricRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
    metric: { flex: 1, minWidth: 0, minHeight: 108, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 22 },
    compactMetric: { flexDirection: "column", gap: 6 }, centered: { textAlign: "center" }, metricBody: { flex: 1, minWidth: 0 },
    value: { ...type.heading, fontSize: 23, lineHeight: 29, color: p.text }, missing: { fontSize: 16, lineHeight: 22 }, metricLabel: { ...type.caption, fontSize: 13, lineHeight: 19, marginTop: 2 },
    metricNote: { ...type.caption, fontSize: 12, lineHeight: 17, color: p.secondary, marginTop: 3 }, excluded: { ...type.caption, lineHeight: 18, color: p.secondary },
    listSpace: { paddingHorizontal: 2, paddingTop: 16, paddingBottom: 10 }, items: { gap: 10 }, item: { borderRadius: 22, backgroundColor: p.row[0], overflow: "visible" },
    itemBody: { minHeight: 112, borderRadius: 22, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }, information: { flex: 1, minWidth: 0 },
    itemTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 21, color: p.text }, facility: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.azure, marginTop: 2 },
    status: { ...type.caption, fontSize: 12, lineHeight: 18, fontWeight: "600", marginTop: 4 }, metaPair: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    metadata: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, flexShrink: 1 },
    chevron: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: p.rowShadow },
    attachment: { minHeight: MIN_TOUCH, marginHorizontal: 12, marginBottom: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }, thumbnail: { width: 40, height: 40, borderRadius: 10 }, attachmentText: { ...type.caption, color: p.azure, flexShrink: 1 },
    more: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, gap: 8, marginTop: 4 }, moreText: { ...type.label, color: p.azure, textAlign: "center", flexShrink: 1 },
    empty: { padding: 18, borderRadius: 22, gap: 10, alignItems: "center" }, emptyTitle: { ...type.bodyStrong, color: p.text, textAlign: "center" }, emptyText: { ...type.caption, lineHeight: 20, textAlign: "center", color: p.secondary }, loading: { marginTop: 16, gap: 16 },
});
