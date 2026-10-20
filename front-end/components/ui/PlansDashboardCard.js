import React, { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, type } from "../../theme";
import AnimatedReveal from "./AnimatedReveal";
import { CalendarControl } from "./CalendarVisuals";
import Gradient from "./Gradient";
import useReducedMotion from "./useReducedMotion";
import useSoftPress from "./useSoftPress";

const TABS = [
    { key: "today", label: "Today's Plan" }, { key: "upcoming", label: "Upcoming" },
    { key: "overdue", label: "Overdue" }, { key: "completed", label: "Completed" },
];

function Surface({ colors, radius = 24, highlight }) {
    return <Gradient accessible={false} pointerEvents="none" colors={colors}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius, boxShadow: `inset 0 2px 2px ${highlight}` }]} />;
}

function StatusArtwork({ kind }) {
    const { colors } = useTheme();
    const material = colors.plansDashboard[kind];
    const id = "plan-status-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <Gradient colors={material?.surface || colors.calendarSurface.icon} accessible={false}
        style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
            flexShrink: 0, boxShadow: colors.calendarSurface.dayShadow }}>
        {kind === "today" ? <Image accessible={false} source={require("../../assets/navbar/calendar-blue.png")}
            resizeMode="contain" style={{ width: 26, height: 26 }} /> :
            <Svg aria-hidden width={28} height={28} viewBox="0 0 36 36">
                <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                    {material.art.map((color, index) => <Stop key={color} offset={index / 2} stopColor={color} />)}
                </LinearGradient></Defs>
                {kind === "upcoming" ? <>
                    <Rect x="6" y="7" width="25" height="27" rx="6" fill={material.art[2]} opacity="0.22" />
                    <Rect x="5" y="5" width="25" height="27" rx="6" fill={`url(#${id})`} />
                    <Rect x="8.5" y="13" width="18" height="15" rx="3" fill={colors.plansDashboard.artwork.paper[0]} />
                    <Path d="M12 3v6 M23 3v6" stroke={material.art[1]} strokeWidth="4" strokeLinecap="round" />
                    <Circle cx="13" cy="23" r="2.1" fill={material.art[1]} />
                    <Circle cx="21" cy="19" r="2.1" fill={material.art[1]} />
                    <Path d="M8 10v-1q0-2 3-2" stroke={colors.plansDashboard.artwork.reflection} strokeWidth="1.4" fill="none" opacity="0.7" />
                </> : kind === "overdue" ? <>
                    <Circle cx="18" cy="19" r="13" fill="none" stroke={material.art[2]} strokeWidth="3" opacity="0.18" />
                    <Circle cx="18" cy="17" r="13" fill="none" stroke={`url(#${id})`} strokeWidth="3.5" />
                    <Path d="M18 10v9 M18 24v.1" stroke={material.art[2]} strokeWidth="3.5" strokeLinecap="round" />
                    <Path d="M8 12q3-6 9-6" fill="none" stroke={colors.plansDashboard.artwork.reflection} strokeWidth="1.2" />
                </> : <>
                    <Circle cx="18" cy="19" r="13" fill={material.art[2]} opacity="0.2" />
                    <Circle cx="18" cy="17" r="13" fill={`url(#${id})`} />
                    <Path d="m11 17 5 5 10-11" fill="none" stroke={colors.plansDashboard.artwork.reflection}
                        strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M8 13q2-7 10-7" fill="none" stroke={colors.plansDashboard.artwork.reflection} strokeWidth="1.2" opacity="0.7" />
                </>}
            </Svg>}
    </Gradient>;
}

function PlanTab({ tab, count, active, onPress, onLayout, onKeyDown, tabRef, id, panelId }) {
    const { colors } = useTheme();
    const p = colors.calendarSurface, material = colors.plansDashboard;
    const reduced = useReducedMotion();
    const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
    const previous = useRef(active);
    const { respond, transform } = useSoftPress();
    const [focused, setFocused] = useState(false);
    useLayoutEffect(() => {
        progress.stopAnimation();
        const changed = previous.current !== active;
        previous.current = active;
        if (reduced !== false || !changed) progress.setValue(active ? 1 : 0);
        else {
            const animation = Animated.spring(progress, { toValue: active ? 1 : 0, stiffness: 350, damping: 34,
                mass: 0.8, overshootClamping: true, useNativeDriver: Platform.OS !== "web", isInteraction: false });
            animation.start();
            return () => animation.stop();
        }
    }, [active, reduced, progress]);
    const focus = event => setFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    return <Pressable ref={tabRef} nativeID={id} onPress={onPress} onLayout={onLayout}
        accessibilityRole="tab" accessibilityLabel={`${tab.label}, ${count} ${count === 1 ? "plan" : "plans"}`}
        accessibilityState={{ selected: active }} aria-selected={active} aria-controls={panelId}
        {...(Platform.OS === "web" ? { tabIndex: active ? 0 : -1 } : {})}
        onFocus={focus} onBlur={() => { setFocused(false); respond(false); }}
        onKeyDown={Platform.OS === "web" ? event => { focus(event); onKeyDown(event); } : undefined}
        onPressIn={() => respond(true)} onPressOut={() => respond(false)}
        style={[styles.tab, focused && { outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2, outlineColor: p.focus }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject,
            { borderRadius: 22, boxShadow: active ? p.activeShadow : p.controlShadow, transform }]}>
            <Surface colors={p.control} radius={22} highlight={p.highlight} />
            <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: progress }]}>
                <Surface colors={material.active} radius={22} highlight={p.highlight} />
            </Animated.View>
        </Animated.View>
        <StatusArtwork kind={tab.key} />
        <Animated.Text style={[styles.tabLabel, { color: progress.interpolate({ inputRange: [0, 1], outputRange: [p.secondary, p.onActive] }) }]}>
            {tab.label}
        </Animated.Text>
        <View style={[styles.badge, { backgroundColor: active ? material.activeBadge : material[tab.key]?.surface[1] || p.icon[1] }]}>
            <Text style={[styles.badgeText, { color: active ? p.onActive : material[tab.key]?.ink || p.secondary }]}>{count}</Text>
        </View>
    </Pressable>;
}

export function PlanAddButton({ onPress, accessibilityLabel }) {
    const { colors } = useTheme();
    return <CalendarControl active onPress={onPress} style={styles.addButton}
        accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        <Text accessible={false} style={[styles.plus, { color: colors.calendarSurface.onActive }]}>+</Text>
        <Text style={[styles.addLabel, { color: colors.calendarSurface.onActive }]}>Add plan</Text>
    </CalendarControl>;
}

function ClipboardArtwork() {
    const { colors } = useTheme();
    const p = colors.plansDashboard.artwork;
    const id = "plan-empty-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <Svg accessible={false} aria-hidden width={144} height={132} viewBox="0 0 192 176">
        <Defs>{["board", "clip", "heart", "paper"].map(kind => <LinearGradient key={kind} id={id + kind} x1="0" y1="0" x2="1" y2="1">
            {p[kind].map((color, index) => <Stop key={color} offset={index / (p[kind].length - 1)} stopColor={color} />)}
        </LinearGradient>)}</Defs>
        <Ellipse cx="102" cy="153" rx="57" ry="11" fill={p.shadow} />
        <Rect x="48" y="40" width="106" height="113" rx="25" fill={p.shadow} />
        <Rect x="44" y="34" width="106" height="113" rx="25" fill={`url(#${id}board)`} />
        <Path d="M50 57q0-17 21-17h38" stroke={p.reflection} strokeWidth="3" strokeLinecap="round" opacity="0.65" fill="none" />
        <Rect x="56" y="49" width="79" height="84" rx="14" fill={`url(#${id}paper)`} />
        <Path d="M73 54v-9q0-8 8-10v-4a16 16 0 0 1 32 0v4q8 2 8 10v9q0 4-5 4H78q-5 0-5-4" fill={`url(#${id}clip)`} />
        <Circle cx="97" cy="28" r="6" fill={p.reflection} />
        <Path d="m69 80 5 5 9-10 m-14 26 5 5 9-10" stroke={p.clip[2]} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M94 81h25 M94 103h19" stroke={p.line} strokeWidth="7" strokeLinecap="round" />
        <Path d="M146 116c-15-23-47-3-29 19l27 24 27-24c19-23-13-43-25-19" fill={`url(#${id}heart)`} />
        <Path d="M120 121q3-13 15-10" fill="none" stroke={p.reflection} strokeWidth="2" opacity="0.5" strokeLinecap="round" />
        <Path d="m20 93 10 7 m-4 24 7-8 m131-57 8-10 m0 28 10-5" stroke={p.clip[0]} strokeWidth="8" strokeLinecap="round" />
    </Svg>;
}

export function PlansEmptyState({ message, onAddPlan, addPlanLabel }) {
    const { colors } = useTheme();
    return <View style={styles.empty}>
        <ClipboardArtwork />
        <Text style={[styles.emptyTitle, { color: colors.calendarSurface.text }]}>{message}</Text>
        {onAddPlan ? <>
            <Text style={[styles.emptyHint, { color: colors.calendarSurface.secondary }]}>You can add a new plan for the selected day.</Text>
            <PlanAddButton onPress={onAddPlan} accessibilityLabel={addPlanLabel} />
        </> : null}
    </View>;
}

export default function PlansDashboardCard({ value, onChange, counts, title, action, children }) {
    const { colors } = useTheme();
    const p = colors.calendarSurface, material = colors.plansDashboard;
    const reduced = useReducedMotion();
    const id = "plans-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const strip = useRef(null), tabRefs = useRef({});
    const [width, setWidth] = useState(0), [placements, setPlacements] = useState({});
    const entrance = useRef(new Animated.Value(1)).current, previous = useRef(value);
    const offsets = useMemo(() => TABS.map(tab => placements[tab.key]?.x).filter(x => x != null), [placements]);
    useLayoutEffect(() => {
        const item = placements[value], last = placements.completed;
        if (!item || !last || !width) return;
        strip.current?.scrollTo({ x: Math.max(0, Math.min(item.x, last.x + last.width + 16 - width)),
            y: 0, animated: reduced === false });
    }, [value, placements, width, reduced]);
    useLayoutEffect(() => {
        entrance.stopAnimation();
        const changed = previous.current !== value;
        previous.current = value;
        if (reduced !== false || !changed) { entrance.setValue(1); return; }
        entrance.setValue(0);
        const animation = Animated.timing(entrance, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== "web", isInteraction: false });
        animation.start();
        return () => animation.stop();
    }, [value, reduced, entrance]);
    const navigate = (event, index) => {
        if (event.target !== event.currentTarget) return;
        const key = event.nativeEvent?.key || event.key;
        const next = key === "ArrowRight" ? (index + 1) % TABS.length : key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length
            : key === "Home" ? 0 : key === "End" ? TABS.length - 1 : null;
        if (next == null) return;
        event.preventDefault();
        onChange(TABS[next].key);
        tabRefs.current[TABS[next].key]?.focus?.();
    };
    return <View testID="plans-dashboard" style={[styles.dashboard, { boxShadow: material.panelShadow }]}>
        <Surface colors={p.panel} radius={30} highlight={p.highlight} />
        <ScrollView horizontal ref={strip} showsHorizontalScrollIndicator={false} nestedScrollEnabled
            testID="plans-tab-strip" snapToOffsets={offsets} decelerationRate="fast"
            style={Platform.OS === "web" ? { scrollSnapType: "x proximity", scrollPaddingLeft: 8, scrollPaddingRight: 8 } : undefined}
            onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)} contentContainerStyle={styles.strip}>
            <View accessibilityRole="tablist" accessibilityLabel="Plan categories" style={styles.tabs}>
                {TABS.map((tab, index) => <PlanTab key={tab.key} tab={tab} count={counts[tab.key]} active={value === tab.key}
                    id={id + tab.key} panelId={id + "panel"} tabRef={node => { tabRefs.current[tab.key] = node; }}
                    onPress={() => onChange(tab.key)} onKeyDown={event => navigate(event, index)}
                    onLayout={({ nativeEvent: { layout } }) => setPlacements(previous =>
                        previous[tab.key]?.x === layout.x && previous[tab.key]?.width === layout.width ? previous
                            : { ...previous, [tab.key]: { x: layout.x, width: layout.width } })} />)}
            </View>
        </ScrollView>
        <View nativeID={id + "panel"} accessibilityRole={Platform.OS === "web" ? "tabpanel" : undefined}
            aria-labelledby={id + value} testID="plans-content-panel"
            style={[styles.panel, { boxShadow: material.contentShadow }]}>
            <Surface colors={material.content} highlight={p.highlight} />
            <View style={styles.heading}>
                <View style={styles.titleGroup}>
                    <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>{title}</Text>
                    <View style={[styles.badge, { backgroundColor: material[value]?.surface[1] || p.icon[1] }]}>
                        <Text style={[styles.badgeText, { color: material[value]?.ink || p.secondary }]}>{counts[value]}</Text>
                    </View>
                </View>
                {action}
            </View>
            <AnimatedReveal contentStyle={styles.content}>
                <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
                    {children}
                </Animated.View>
            </AnimatedReveal>
        </View>
    </View>;
}

const styles = StyleSheet.create({
    dashboard: { borderRadius: 30, padding: 12, marginBottom: 16, overflow: "visible" },
    strip: { flexGrow: 1, paddingHorizontal: 8, paddingVertical: 12 },
    tabs: { flexGrow: 1, flexDirection: "row", gap: 10 },
    tab: { minWidth: 176, minHeight: 64, flexGrow: 1, flexShrink: 0, flexDirection: "row", alignItems: "center",
        justifyContent: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 22,
        ...(Platform.OS === "web" ? { outlineStyle: "none", scrollSnapAlign: "start" } : {}) },
    tabLabel: { ...type.label, fontSize: 13, fontWeight: "700", flexShrink: 0 },
    badge: { minWidth: 28, minHeight: 28, borderRadius: 999, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    badgeText: { ...type.caption, fontWeight: "700", fontVariant: ["tabular-nums"] },
    panel: { borderRadius: 24, overflow: "visible", marginTop: 4 },
    heading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16, paddingBottom: 0 },
    titleGroup: { flexDirection: "row", alignItems: "center", flexShrink: 1, gap: 8 },
    title: { ...type.heading, flexShrink: 1, textTransform: "capitalize" },
    content: { padding: 14, paddingTop: 16, paddingBottom: 20 },
    empty: { alignItems: "center", gap: 12, paddingHorizontal: 4, paddingTop: 16, paddingBottom: 12 },
    emptyTitle: { ...type.label, fontSize: 16, textAlign: "center" },
    emptyHint: { ...type.body, textAlign: "center", lineHeight: 21, marginBottom: 6 },
    addButton: { minHeight: MIN_TOUCH + 4, flexDirection: "row", gap: 8, paddingHorizontal: 22, alignSelf: "center" },
    plus: { fontSize: 28, lineHeight: 30, fontWeight: "400" },
    addLabel: { ...type.label },
});
