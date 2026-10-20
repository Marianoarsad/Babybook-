import React, { useId, useMemo, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, recordItemStyle, type } from "../../theme";
import { shortDate, shortTime, durationText } from "../../utils/dates";
import { feedRowSummary } from "../../utils/adapters";
import { SectionContainerCard } from "../common/Cards";
import Gradient from "./Gradient";
import MilkIcon from "./MilkIcon";
import SolidFoodIcon from "./SolidFoodIcon";
import useSoftPress from "./useSoftPress";

function Surface({ colors, radius, highlight }) {
    return <Gradient pointerEvents="none" accessible={false} colors={colors}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius, boxShadow: `inset 0 2px 2px ${highlight}` }]} />;
}

export function MetricArtwork({ kind, size = 56 }) {
    const { colors } = useTheme();
    const p = colors.nutritionArtwork;
    const id = "feeding-metric-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const fill = name => `url(#${id}-${name})`;
    return <Svg pointerEvents="none" accessible={false} width={size} height={size} viewBox="0 0 100 100" style={{ position: "relative" }}>
        <Defs>
            <RadialGradient id={`${id}-white`} cx="25%" cy="20%" r="85%">
                {p.white.map((color, i) => <Stop key={i} offset={i / 2} stopColor={color} />)}
            </RadialGradient>
            <LinearGradient id={`${id}-blue`} x1="0" y1="0" x2="1" y2="1">
                {p.blue.map((color, i) => <Stop key={i} offset={i / 2} stopColor={color} />)}
            </LinearGradient>
        </Defs>
        <Ellipse cx="52" cy="88" rx="30" ry="5" fill={p.blueShade} opacity="0.15" />
        {kind === "volume" ? <>
            <Rect x="29" y="29" width="44" height="58" rx="13" fill={fill("white")} />
            <Path d="M35 43 L35 73 Q35 80 40 81" fill="none" stroke={p.reflection} strokeWidth="4" strokeLinecap="round" opacity="0.85" />
            <Path d="M68 43 L68 74 Q68 82 61 83" fill="none" stroke={p.white[2]} strokeWidth="3" opacity="0.65" />
            <Rect x="27" y="17" width="48" height="20" rx="7" fill={fill("blue")} />
            <Ellipse cx="51" cy="18" rx="24" ry="6" fill={fill("blue")} />
            <Path d="M32 18 Q44 12 59 15" fill="none" stroke={p.reflection} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <Path d="M44 47 L52 47 M44 57 L49 57 M44 67 L52 67 M44 77 L49 77" stroke={fill("blue")} strokeWidth="4" strokeLinecap="round" />
        </> : <>
            <Circle cx="50" cy="49" r="35" fill={fill("blue")} />
            <Circle cx="49" cy="48" r="27" fill={fill("white")} />
            <Path d="M20 42 Q23 19 48 18" fill="none" stroke={p.reflection} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
            <Path d="M50 32 L50 50 L63 50" fill="none" stroke={p.blue[2]} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M48 32 L48 49 L61 49" fill="none" stroke={p.blue[0]} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </>}
    </Svg>;
}

export default function FeedingTodayCard({ date, stats, mix, lastMilkText, latestEntries, reactions, onViewAll }) {
    const { colors } = useTheme();
    const p = colors.feedingToday;
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const [focused, setFocused] = useState(false);
    const { respond, transform } = useSoftPress();
    const columns = width && (width - 12) / 2 < 112 * fontScale ? 1 : 2;
    const inline = width > 0 && (width - 12 * (columns - 1)) / columns >= 200 * fontScale;
    const tiles = [
        { key: "milk", label: "Milk feeds", value: String(stats.count) },
        { key: "solid", label: "Solid meals", value: String(stats.solidCount) },
        { key: "volume", label: "Bottle volume logged", value: stats.volume > 0 ? `${Math.round(stats.volume)} mL` : "Not logged" },
        { key: "breast", label: "Breastfeeding time", value: stats.breastMinutes > 0 ? durationText(stats.breastMinutes) : "Not logged" },
    ];
    const groups = [];
    for (let i = 0; i < tiles.length; i += columns) groups.push(tiles.slice(i, i + columns));
    const categories = [{ key: "breastmilk", label: "Breast milk" }, { key: "formula", label: "Formula" },
        { key: "mixed", label: "Mixed" }, { key: "solid", label: "Solid food" }];
    const reaction = reactions[0];
    const severe = String(reaction?.reaction_severity || "").toLowerCase() === "severe";
    const focus = event => setFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    return <SectionContainerCard title="Feeding Today" subtitle={shortDate(date)} style={styles.panel}
        titleStyle={styles.title} subtitleStyle={styles.subtitle} headerStyle={styles.header}
        background={<Surface colors={p.panel} radius={30} highlight={p.highlight} />}>
        <Text style={styles.summary}>{stats.totalCount > 0
            ? `${stats.totalCount} ${stats.totalCount === 1 ? "entry" : "entries"} logged`
            : "No feeding records logged today."}</Text>
        <Text style={styles.lastMilk}>{lastMilkText}</Text>
        <View testID="feeding-today-metrics" style={styles.grid} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
            {groups.map((group, i) => <View key={i} style={styles.metricRow}>
                {group.map(tile => <View key={tile.key} testID={`feeding-today-${tile.key}`} accessible
                    accessibilityLabel={`${tile.label}, ${tile.value}`}
                    style={[styles.tile, inline && styles.tileInline, { backgroundColor: p[tile.key][0] }]}>
                    <Surface colors={p[tile.key]} radius={22} highlight={p.highlight} />
                    {tile.key === "milk" ? <MilkIcon size={56} backgroundShape="rounded-square" />
                        : <View style={[styles.iconSurface, { backgroundColor: tile.key === "solid" ? p.mintIcon[0] : p.icon[0] }]}>
                            <Surface colors={tile.key === "solid" ? p.mintIcon : p.icon} radius={17} highlight={p.highlight} />
                            {tile.key === "solid" ? <SolidFoodIcon size={56} showBackground={false} /> : <MetricArtwork kind={tile.key} />}
                        </View>}
                    <View style={[styles.metricDetails, inline && styles.metricDetailsInline]}>
                        <Text style={[styles.metricLabel, inline && styles.alignLeft]}>{tile.label}</Text>
                        <Text style={[styles.value, tile.value === "Not logged" && styles.missingValue, inline && styles.alignLeft]}>{tile.value}</Text>
                    </View>
                </View>)}
            </View>)}
        </View>
        <View style={styles.mix} accessibilityLabel="Today's feeding types">
            {categories.map((category, i) => <View key={category.key} style={[styles.category, i > 0 && styles.categoryDivider]}>
                <Text style={styles.categoryLabel}>{category.label}</Text>
                <Text style={styles.categoryCount}>{mix[category.key]}</Text>
            </View>)}
        </View>
        {reaction ? <View accessibilityRole="alert" style={[styles.reaction, { backgroundColor: severe ? colors.dangerBg : colors.warningBg }]}>
            <Ionicons name="alert-circle-outline" size={18} color={severe ? colors.danger : colors.warning} />
            <Text style={[styles.reactionText, { color: severe ? colors.danger : colors.warning }]}>
                Reaction recorded: {reaction.food_introduced || "Solid food"} · {severe ? "Severe" : "Mild"}
                {reactions.length > 1 ? ` · +${reactions.length - 1} more` : ""}
            </Text>
        </View> : null}
        {latestEntries.length > 0 ? <View style={styles.latest}>
            <Text style={styles.latestTitle}>Latest</Text>
            {latestEntries.map((entry, i) => <View key={entry.id || `${entry.entry_date}-${entry.entry_time}-${i}`} testID="feeding-today-entry" style={styles.entry}>
                <Surface colors={colors.recordItem.surface} radius={24} highlight={colors.recordItem.highlight} />
                {entry.entry_type === "solid" ? <SolidFoodIcon size={32} /> : null}
                <View style={styles.timePill}>
                    <Surface colors={p.time} radius={18} highlight={p.highlight} />
                    <Text style={styles.time}>{shortTime(entry.entry_time) || "Time not recorded"}</Text>
                </View>
                <View style={styles.entryDetails}><Text style={styles.entryText}>{feedRowSummary(entry)}</Text></View>
            </View>)}
        </View> : null}
        <Pressable onPress={onViewAll} accessibilityRole="button" accessibilityLabel="View all nutrition records"
            onPressIn={() => respond(true)} onPressOut={() => respond(false)} onFocus={focus} onKeyDown={focus}
            onBlur={() => { setFocused(false); respond(false); }}
            style={[styles.footer, Platform.OS === "web" && { outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: p.accent }]}>
            <Animated.View style={[styles.footerContents, { transform }]}>
                <Text style={styles.footerText}>View all</Text><Ionicons name="arrow-forward" size={20} color={p.accent} />
            </Animated.View>
        </Pressable>
    </SectionContainerCard>;
}

const makeStyles = colors => {
    const p = colors.feedingToday;
    return StyleSheet.create({
        panel: { padding: 18, borderRadius: 30, borderWidth: 0, backgroundColor: p.panel[0], boxShadow: p.panelShadow, overflow: "visible" },
        header: { marginBottom: 16 }, title: { ...type.title, color: p.text }, subtitle: { ...type.body, color: p.secondary, marginTop: 3 },
        summary: { ...type.bodyStrong, color: p.text }, lastMilk: { ...type.caption, color: p.secondary, marginTop: 3 },
        grid: { gap: 12, marginTop: 16, overflow: "visible" }, metricRow: { flexDirection: "row", gap: 12, alignItems: "stretch" },
        tile: { flex: 1, minWidth: 0, minHeight: 136, padding: 12, gap: 8, alignItems: "center", justifyContent: "center", borderRadius: 22, boxShadow: p.tileShadow, overflow: "visible" },
        tileInline: { flexDirection: "row", justifyContent: "flex-start", gap: 12, minHeight: 104 },
        iconSurface: { width: 56, height: 56, borderRadius: 17, flexShrink: 0, boxShadow: p.iconShadow },
        metricDetails: { alignSelf: "stretch", minWidth: 0 }, metricDetailsInline: { flex: 1 },
        metricLabel: { ...type.caption, color: p.secondary, textAlign: "center" },
        value: { ...type.title, fontSize: 26, lineHeight: 32, color: p.text, textAlign: "center", marginTop: 3 },
        missingValue: { ...type.heading, lineHeight: 24 }, alignLeft: { textAlign: "left" },
        mix: { flexDirection: "row", marginTop: 24, marginBottom: 4, alignItems: "stretch" },
        category: { flex: 1, minWidth: 0, paddingHorizontal: 3, justifyContent: "space-between", gap: 3 },
        categoryDivider: { borderLeftWidth: 1, borderLeftColor: p.divider },
        categoryLabel: { ...type.caption, color: p.secondary, textAlign: "center" }, categoryCount: { ...type.heading, color: p.text, textAlign: "center" },
        reaction: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginTop: 16, borderRadius: 16 }, reactionText: { ...type.caption, flex: 1 },
        latest: { marginTop: 16, gap: 12 }, latestTitle: { ...type.bodyStrong, color: p.text },
        entry: { ...recordItemStyle(colors), flexDirection: "row", alignItems: "center", minHeight: 56, padding: 10, gap: 8, borderWidth: 0, marginBottom: 0, overflow: "visible" },
        timePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18, maxWidth: 100, flexShrink: 0 },
        time: { ...type.caption, color: p.secondary, textAlign: "center" },
        entryDetails: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: p.divider, paddingLeft: 12 }, entryText: { ...type.label, color: p.text },
        footer: { minHeight: MIN_TOUCH, justifyContent: "center", borderTopWidth: 1, borderTopColor: p.divider, marginTop: 18, paddingTop: 8, borderRadius: 4 },
        footerContents: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }, footerText: { ...type.bodyStrong, color: p.accent },
    });
};
