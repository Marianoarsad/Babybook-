import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, motion, type } from "../../theme";
import { shortDate, shortTime } from "../../utils/dates";
import { recordedFeedingTime } from "../../utils/feedingStats";
import { SectionContainerCard } from "../common/Cards";
import AnimatedReveal from "./AnimatedReveal";
import AnchoredMenu from "./AnchoredMenu";
import Gradient from "./Gradient";
import MilkIcon from "./MilkIcon";
import SolidFoodIcon from "./SolidFoodIcon";
import { MetricArtwork } from "./FeedingTodayCard";
import NutritionMixChart, { NutritionMixLegend } from "./NutritionMixChart";
import { SkeletonBlock } from "./Skeleton";
import useReducedMotion from "./useReducedMotion";
import useSoftPress from "./useSoftPress";

function Surface({ colors, radius = 22, highlight }) {
    return <Gradient pointerEvents="none" accessible={false} colors={colors}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius, boxShadow: "inset 1px 2px 3px " + highlight }]} />;
}

function Control({ ref: controlRef, surface = "control", radius = 24, style, children, ...props }) {
    const { colors } = useTheme(), p = colors.feedingBreakdown;
    const { respond, transform } = useSoftPress();
    const [pressed, setPressed] = useState(false), [focused, setFocused] = useState(false);
    const focus = e => setFocused(Platform.OS === "web" && Boolean(e.currentTarget?.matches?.(":focus-visible")));
    const press = down => { setPressed(down); respond(down); };
    return <Pressable {...props} ref={controlRef} onPressIn={() => press(true)} onPressOut={() => press(false)}
        onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); press(false); }}
        style={[{ minHeight: MIN_TOUCH, borderRadius: radius }, style, Platform.OS === "web" && { outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: p.azure }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: radius, transform,
            backgroundColor: p[surface][0], boxShadow: pressed ? p.pressedShadow : p.itemShadow }]}>
            <Surface colors={p[surface]} radius={radius} highlight={p.highlight} />
        </Animated.View>
        {children}
    </Pressable>;
}

export function FeedingSummaryMetrics({ summary }) {
    const { colors } = useTheme(), p = colors.feedingBreakdown;
    const styles = useMemo(() => makeStyles(p), [p]);
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const columns = width >= 600 * fontScale ? 4 : width > 0 && (width - 10) / 2 < 104 * fontScale ? 1 : 2;
    const volume = summary.loggedMilkVolumeMl;
    const tiles = [
        { key: "entries", label: "Entries logged today", value: String(summary.totalEntries) },
        { key: "milk", label: "Logged milk volume", value: volume == null ? "Not logged" : volume < 0.1 ? "<0.1 mL" : `${Number(volume.toFixed(1))} mL` },
        { key: "solid", label: "Solid meals today", value: String(summary.solidFoodEntries) },
        { key: "time", label: "Last feed", value: shortTime(summary.lastFeedingTime) || "Not logged" },
    ];
    const groups = [];
    for (let i = 0; i < tiles.length; i += columns) groups.push(tiles.slice(i, i + columns));
    return <View testID="feeding-summary-metrics" style={styles.metrics} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {groups.map((group, index) => <View key={index} style={styles.metricRow}>
            {group.map(tile => <View key={tile.key} testID={`feeding-summary-${tile.key}`} accessible
                accessibilityLabel={`${tile.label}, ${tile.value}`} style={[styles.tile, { backgroundColor: p[tile.key][0] }]}>
                <Surface colors={p[tile.key]} highlight={p.highlight} />
                {tile.key === "milk" ? <MilkIcon size={40} /> : tile.key === "solid" ? <SolidFoodIcon size={40} /> :
                    <View style={styles.metricIcon}>
                        <Surface colors={p[tile.key]} radius={20} highlight={p.highlight} />
                        {tile.key === "time" ? <MetricArtwork kind="clock" size={40} /> : <Ionicons name="document-text" size={24} color={p.lavender} />}
                    </View>}
                <Text style={[styles.value, tile.value === "Not logged" && styles.missingValue]}>{tile.value}</Text>
                <Text style={styles.metricLabel}>{tile.label}</Text>
            </View>)}
        </View>)}
    </View>;
}

export default function FeedingBreakdownCard({ date, summary, entriesVisible, onToggleEntries, onOpenEntry, entryTitle, loading, loadFailed, onRetry }) {
    const { colors } = useTheme(), p = colors.feedingBreakdown;
    const styles = useMemo(() => makeStyles(p), [p]);
    const { width } = useWindowDimensions();
    const [infoOpen, setInfoOpen] = useState(false), [anchor, setAnchor] = useState(null);
    const infoRef = useRef(null);
    const panelId = "feeding-entries-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const reduced = useReducedMotion(), angle = useRef(new Animated.Value(entriesVisible ? 1 : 0)).current;
    useEffect(() => {
        angle.stopAnimation();
        if (reduced !== false) { angle.setValue(entriesVisible ? 1 : 0); return; }
        const animation = Animated.timing(angle, { toValue: entriesVisible ? 1 : 0, duration: 260, easing: Easing.bezier(...motion.standard.bezier), useNativeDriver: Platform.OS !== "web" });
        animation.start(); return () => animation.stop();
    }, [entriesVisible, reduced, angle]);
    const openInfo = () => infoRef.current?.measureInWindow((x, y, width, height) => { setAnchor({ x, y, width, height }); setInfoOpen(true); });
    const unavailable = summary.totalEntries === 0 && (loading || loadFailed);
    return <SectionContainerCard title="Today’s Feeding Breakdown" subtitle={shortDate(date)} style={styles.panel}
        titleStyle={styles.title} subtitleStyle={styles.date} headerStyle={styles.header}
        background={<Surface colors={p.panel} radius={28} highlight={p.highlight} />}
        action={<Control ref={infoRef} radius={22} style={styles.info} onPress={openInfo}
            accessibilityRole="button" accessibilityLabel="About today's feeding breakdown" accessibilityState={{ expanded: infoOpen }}>
            <View style={styles.infoSymbol}><Surface colors={p.ringMilk} radius={14} highlight={p.highlight} />
                <Ionicons name="information" size={20} color={p.reflection} /></View>
        </Control>}>
        {unavailable ? <View testID="feeding-breakdown-unavailable" style={styles.unavailable}>
            {loading ? <><SkeletonBlock height={220} radius={110} /><SkeletonBlock height={116} radius={22} /></> : <>
                <Text style={styles.help}>Feeding records could not be loaded.</Text>
                <Control onPress={onRetry} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry feeding records"><Text style={styles.toggleText}>Retry</Text></Control>
            </>}
        </View> : <>
            <NutritionMixChart summary={summary} />
            <NutritionMixLegend summary={summary} />
            <FeedingSummaryMetrics summary={summary} />
            {summary.totalEntries > 0 ? <Control style={styles.toggle} onPress={onToggleEntries} testID="feeding-entries-toggle"
                accessibilityRole="button" accessibilityLabel={entriesVisible ? "Hide entries" : "Show entries"}
                accessibilityState={{ expanded: entriesVisible }} aria-expanded={entriesVisible} aria-controls={panelId}>
                <Animated.View pointerEvents="none" style={{ transform: [{ rotate: angle.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
                    <Ionicons name="chevron-down" size={22} color={p.azure} />
                </Animated.View>
                <Text style={styles.toggleText}>{entriesVisible ? "Hide entries" : "Show entries"}</Text>
            </Control> : <Text style={styles.empty}>No feeding entries logged today.</Text>}
            <AnimatedReveal expanded={entriesVisible} duration={260} contentStyle={styles.history}>
                <View nativeID={panelId} aria-hidden={!entriesVisible} testID="feeding-breakdown-history" style={styles.historyRows}>
                    {summary.entries.map(entry => {
                        const time = shortTime(recordedFeedingTime(entry.time));
                        return <Control key={entry.id} surface="row" radius={22} style={styles.entry}
                        disabled={!entriesVisible} onPress={() => onOpenEntry(entry)} accessibilityRole="button"
                        accessibilityLabel={`View ${entryTitle(entry)}. ${shortDate(entry.date)}${time ? `, ${time}` : ""}`}>
                        {entry.entryType === "solid" ? <SolidFoodIcon size={40} /> : <MilkIcon size={40} />}
                        <View style={styles.entryBody}>
                            <Text style={styles.entryTitle}>{entryTitle(entry)}</Text>
                            <Text style={styles.entryDate}>{shortDate(entry.date)}{time ? ` · ${time}` : ""}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={p.azure} accessible={false} />
                    </Control>;
                    })}
                </View>
            </AnimatedReveal>
        </>}
        <AnchoredMenu visible={infoOpen} anchor={anchor} onClose={() => setInfoOpen(false)}
            minWidth={Math.min(300, width - 16)} maxWidth={Math.min(300, width - 16)} dimBackdrop={false}>
            <View style={styles.explanation}>
                <Text style={styles.entryTitle}>About this chart</Text>
                <Text style={styles.help}>Percentages count today's logged feeding entries, not milk volume, nutrients or physical consumption. Milk includes breast milk, formula and mixed feeds.</Text>
                <Text style={styles.help}>Logged milk volume sums recorded bottle amounts only, including both saved portions of mixed feeds. Missing amounts are not estimated.</Text>
                <Text style={styles.help}>Last feed shows the latest saved feeding time across milk and solids. Entries without a time cannot establish the latest time.</Text>
            </View>
        </AnchoredMenu>
    </SectionContainerCard>;
}

const makeStyles = p => StyleSheet.create({
    panel: { padding: 16, borderRadius: 28, borderWidth: 0, backgroundColor: p.panel[0], boxShadow: p.panelShadow, overflow: "visible" },
    header: { marginBottom: 8 }, title: { ...type.heading, fontSize: 20, lineHeight: 26, color: p.text }, date: { ...type.caption, color: p.secondary, marginTop: 4 },
    info: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, infoSymbol: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    metrics: { gap: 10, overflow: "visible" }, metricRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
    tile: { flex: 1, minWidth: 0, minHeight: 116, padding: 10, gap: 5, borderRadius: 22, alignItems: "center", justifyContent: "center", boxShadow: p.itemShadow },
    metricIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", boxShadow: p.itemShadow },
    value: { ...type.heading, fontSize: 22, lineHeight: 28, textAlign: "center", color: p.text }, missingValue: { fontSize: 16, lineHeight: 24 },
    metricLabel: { ...type.caption, lineHeight: 17, color: p.secondary, textAlign: "center" },
    toggle: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 18, minHeight: 48 }, toggleText: { ...type.label, color: p.azure },
    history: { paddingTop: 16, paddingHorizontal: 2, paddingBottom: 10 }, historyRows: { gap: 10 },
    entry: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, minHeight: 64 }, entryBody: { flex: 1, minWidth: 0 },
    entryTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 21, color: p.text }, entryDate: { ...type.caption, fontSize: 12, color: p.secondary, marginTop: 3 },
    empty: { ...type.caption, color: p.secondary, marginTop: 18, textAlign: "center" }, explanation: { padding: 12, gap: 10 }, help: { ...type.caption, color: p.secondary, lineHeight: 20 },
    unavailable: { gap: 16, paddingVertical: 16 }, retry: { alignItems: "center", justifyContent: "center" },
});
