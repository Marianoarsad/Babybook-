import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, type } from "../../theme";
import AnchoredMenu, { AnchoredMenuItem } from "./AnchoredMenu";
import Gradient from "./Gradient";
import RecordIcon from "./RecordIcon";
import MemoryDateRow from "./MemoryDateRow";
import { SkeletonBlock } from "./Skeleton";
import useSoftPress from "./useSoftPress";
import useReducedMotion from "./useReducedMotion";
import { DOMAINS } from "../../utils/milestoneChecklist";

const FILTERS = [
    { key: "all", label: "All", icon: "grid" },
    { key: "milestone", label: "Milestones" },
    { key: "memory", label: "Memories", icon: "image-outline" },
];
const SORTS = [{ key: "newest", label: "Newest first" }, { key: "oldest", label: "Oldest first" }];
const CATEGORIES = [{ key: "all", label: "All categories" }, ...DOMAINS, { key: "uncategorized", label: "Not categorized" }];

function Surface({ material, radius = 24 }) {
    const { colors } = useTheme();
    const p = colors.memoriesSurface;
    return <Gradient accessible={false} pointerEvents="none" colors={material}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius,
            boxShadow: `inset 1px 2px 2px ${p.highlight}, inset -1px -1px 2px ${p.shade}` }]} />;
}

function Control({ ref: controlRef, active = false, row = false, radius = 999, style, children, ...props }) {
    const { colors } = useTheme();
    const p = colors.memoriesSurface;
    const reduced = useReducedMotion(), { respond, transform } = useSoftPress();
    const selection = useRef(new Animated.Value(active ? 1 : 0)).current;
    const [pressed, setPressed] = useState(false), [focused, setFocused] = useState(false);
    useEffect(() => {
        selection.stopAnimation();
        if (reduced !== false) selection.setValue(active ? 1 : 0);
        else Animated.timing(selection, { toValue: active ? 1 : 0, duration: 200,
            easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== "web", isInteraction: false }).start();
        return () => selection.stopAnimation();
    }, [active, reduced, selection]);
    const press = down => { setPressed(down); respond(down); };
    const focus = event => setFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    return <Pressable {...props} ref={controlRef} accessibilityRole="button" aria-pressed={props.accessibilityState?.selected}
        aria-expanded={props.accessibilityState?.expanded}
        onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); press(false); }}
        onPressIn={() => press(true)} onPressOut={() => press(false)}
        style={[{ minHeight: MIN_TOUCH, borderRadius: radius }, style, Platform.OS === "web" && {
            outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: p.accent }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: radius, transform,
            boxShadow: pressed ? p.pressedShadow : active ? p.activeShadow : row ? p.itemShadow : p.controlShadow }]}>
            <Surface material={row ? p.item : p.control} radius={radius} />
            <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: selection }]}>
                <Surface material={p.active} radius={radius} />
            </Animated.View>
        </Animated.View>
        {children}
    </Pressable>;
}

export function MemoryRecordRow({ record, onOpen, thumbnailWidth = 100, compact = false }) {
    const { colors } = useTheme();
    const p = colors.memoriesSurface;
    const s = useMemo(() => makeStyles(p), [p]);
    const milestone = record.kind === "milestone";
    return <Control row radius={24} onPress={() => onOpen(record)} accessibilityLabel={`View ${record.title}`}
        style={[s.record, compact && { padding: 8, gap: 8 }]}>
        <View style={[s.thumbnail, { width: thumbnailWidth, height: Math.max(100, Math.min(115, thumbnailWidth + 10)) }]}>
            {record.photoUrl ? <Image accessible={false} source={{ uri: record.photoUrl }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
                : milestone ? <RecordIcon category="milestone" size={44} />
                    : <Ionicons accessible={false} name="image-outline" size={28} color={p.secondary} />}
            {milestone && record.photoUrl ? <View pointerEvents="none" style={s.flag}><RecordIcon category="milestone" size={25} /></View> : null}
        </View>
        <View style={s.details}>
            <Text style={s.recordTitle}>{record.title}</Text>
            {record.description ? <Text style={s.description}>{record.description}</Text> : null}
            <View style={s.badge}>
                <Surface material={p.control} radius={999} />
                <Text style={s.badgeText}>{milestone ? "Milestone" : "Memory"}</Text>
            </View>
            <MemoryDateRow date={record.date} />
        </View>
        <View pointerEvents="none" accessible={false} style={[s.chevron, compact && { width: 28, height: 28 }]}>
            <Surface material={p.control} radius={999} />
            <Ionicons name="chevron-forward" size={21} color={p.accent} />
        </View>
    </Control>;
}

export default function MemoriesMilestonesCollection({ result, view, loading, onChangeView, onShowMore, onOpenRecord, blurTarget }) {
    const { colors } = useTheme();
    const p = colors.memoriesSurface;
    const s = useMemo(() => makeStyles(p), [p]);
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0), [searchFocused, setSearchFocused] = useState(false);
    const [sortOpen, setSortOpen] = useState(false), [sortAnchor, setSortAnchor] = useState(null);
    const sortTrigger = useRef(null);
    const categoryTrigger = useRef(null);
    const [categoryAnchor, setCategoryAnchor] = useState(null);
    const selectedCategory = CATEGORIES.find(category => category.key === view.developmentCategory) || CATEGORIES[0];
    const compact = width > 0 && width < 330;
    const thumbnailWidth = fontScale > 1.2 ? 72 : width > 0 ? Math.max(80, Math.min(120, (width - (compact ? 24 : 32)) * 0.3)) : 100;
    const selectedSort = SORTS.find(sort => sort.key === view.sort) || SORTS[0];
    const empty = !result.counts.all ? "No memories or milestones recorded yet."
        : view.query.trim() || selectedCategory.key !== "all" ? "No matching memories or milestones found."
            : view.category === "milestone" ? "No milestones recorded yet." : "No memories recorded yet.";
    return <View onLayout={event => setWidth(Math.floor(event.nativeEvent.layout.width))}
        style={[s.panel, compact && { padding: 12 }]}>
        <Surface material={p.panel} radius={28} />
        <View style={s.header}>
            <RecordIcon category="milestone" size={48} showBackground={false} />
            <View style={s.headingText}>
                <Text accessibilityRole="header" style={s.title}>Memories &amp; Milestones</Text>
                <Text style={s.subtitle}>A collection of special moments and developmental milestones.</Text>
            </View>
        </View>
        <View style={[s.search, Platform.OS === "web" && { outlineStyle: searchFocused ? "solid" : "none",
            outlineWidth: 2, outlineOffset: 3, outlineColor: p.accent }]}>
            <Surface material={p.control} radius={999} />
            <Ionicons accessible={false} name="search-outline" size={21} color={p.secondary} />
            <TextInput value={view.query} onChangeText={query => onChangeView({ query })}
                accessibilityLabel="Search memories and milestones" placeholder="Search memories and milestones..."
                placeholderTextColor={p.secondary} style={s.input} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
                autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
            {view.query ? <Pressable onPress={() => onChangeView({ query: "" })} style={s.clear}
                accessibilityRole="button" accessibilityLabel="Clear memories search"><Ionicons name="close-circle" size={20} color={p.accent} /></Pressable> : null}
        </View>
        <Control ref={categoryTrigger} style={[s.pill, { alignSelf: "stretch", justifyContent: "space-between", marginBottom: 12 }]}
            accessibilityLabel={`Development category, ${selectedCategory.label}`} accessibilityState={{ expanded: !!categoryAnchor }}
            onPress={() => categoryTrigger.current?.measureInWindow((x, y, width, height) => setCategoryAnchor({ x, y, width, height }))}>
            <Text style={[s.pillText, { color: p.accent }]}>{selectedCategory.label}</Text>
            <Ionicons accessible={false} name="chevron-down" size={18} color={p.accent} />
        </Control>
        <View style={s.toolbar}>
            {FILTERS.map(filter => {
                const active = view.category === filter.key;
                const ink = active ? p.onActive : p.accent;
                return <Control key={filter.key} active={active} style={s.pill} accessibilityState={{ selected: active }}
                    accessibilityLabel={`${filter.label}, ${result.counts[filter.key]} total records`}
                    onPress={() => onChangeView({ category: filter.key })}>
                    {filter.key === "milestone" ? <RecordIcon category="milestone" size={23} /> : <Ionicons accessible={false} name={filter.icon} size={19} color={ink} />}
                    <Text style={[s.pillText, { color: ink }]}>{filter.label}</Text>
                </Control>;
            })}
            <Control ref={sortTrigger} style={[s.pill, s.sort]} accessibilityLabel={`Sort memories, ${selectedSort.label}`}
                accessibilityState={{ expanded: sortOpen }} onPress={() => sortTrigger.current?.measureInWindow((x, y, anchorWidth, height) => {
                    setSortAnchor({ x, y, width: anchorWidth, height }); setSortOpen(true);
                })}>
                <Ionicons accessible={false} name="swap-vertical" size={19} color={p.accent} />
                <Text style={[s.pillText, { color: p.accent }]}>{selectedSort.label}</Text>
                <Ionicons accessible={false} name="chevron-down" size={16} color={p.accent} />
            </Control>
        </View>
        {loading ? <View accessibilityLabel="Loading memories and milestones" style={s.groups}>
            {[0, 1].map(index => <View key={index} style={s.loadingRow}>
                <Surface material={p.item} radius={24} />
                <SkeletonBlock width={thumbnailWidth} height={110} radius={18} />
                <View style={s.details}><SkeletonBlock width="90%" height={18} /><SkeletonBlock width="70%" height={13} style={{ marginTop: 10 }} /><SkeletonBlock width="85%" height={13} style={{ marginTop: 16 }} /></View>
            </View>)}
        </View> : result.total ? <View style={s.groups}>
            {result.groups.map(group => <View key={group.key} style={s.group}>
                <Text accessibilityRole="header" style={s.month}>{group.label}</Text>
                {group.items.map(record => <MemoryRecordRow key={`${record.kind}-${record.id}`} record={record}
                    onOpen={onOpenRecord} compact={compact} thumbnailWidth={thumbnailWidth} />)}
            </View>)}
            {result.remaining > 0 ? <Control style={s.more} onPress={onShowMore}
                accessibilityLabel={`Show more memories and milestones, ${result.remaining} remaining`}>
                <Ionicons accessible={false} name="chevron-down" size={21} color={p.accent} />
                <Text style={[s.pillText, { color: p.accent }]}>Show more ({result.remaining} remaining)</Text>
            </Control> : null}
        </View> : <View style={s.empty}>
            <Surface material={p.item} radius={24} />
            <Ionicons accessible={false} name={view.query.trim() ? "search-outline" : "images-outline"} size={30} color={p.secondary} />
            <Text style={s.emptyText}>{empty}</Text>
        </View>}
        <AnchoredMenu visible={sortOpen && !!sortAnchor} anchor={sortAnchor} onClose={() => setSortOpen(false)}
            appearance="glass" dimBackdrop={false} animation="warp" maxWidth={240} blurTarget={blurTarget}>
            {SORTS.map(sort => <AnchoredMenuItem key={sort.key} label={sort.label} selected={view.sort === sort.key}
                onPress={() => { onChangeView({ sort: sort.key }); setSortOpen(false); }} />)}
        </AnchoredMenu>
        <AnchoredMenu visible={!!categoryAnchor} anchor={categoryAnchor} onClose={() => setCategoryAnchor(null)}
            appearance="glass" variant="select" dimBackdrop={false} maxWidth={categoryAnchor?.width || 300} blurTarget={blurTarget}>
            {CATEGORIES.map(category => <AnchoredMenuItem key={category.key} variant="select" label={category.label}
                selected={selectedCategory.key === category.key} onPress={() => {
                    onChangeView({ developmentCategory: category.key }); setCategoryAnchor(null);
                }} />)}
        </AnchoredMenu>
    </View>;
}

const makeStyles = p => StyleSheet.create({
    panel: { padding: 16, borderRadius: 28, marginBottom: 16, boxShadow: p.panelShadow, overflow: "visible" },
    header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
    headingText: { flex: 1, minWidth: 0 },
    title: { ...type.title, fontSize: 21, lineHeight: 26, color: p.text },
    subtitle: { ...type.caption, color: p.secondary, marginTop: 5 },
    search: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14,
        paddingRight: 6, borderRadius: 999, boxShadow: p.controlShadow, marginBottom: 18 },
    input: { ...type.body, color: p.text, minHeight: 50, flex: 1, minWidth: 0, position: "relative",
        ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) },
    clear: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
    toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
    pill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 8 },
    pillText: { ...type.label, fontSize: 13, lineHeight: 18, flexShrink: 1 },
    sort: { marginLeft: "auto" },
    groups: { gap: 18 }, group: { gap: 12 },
    month: { ...type.label, color: p.secondary, textTransform: "uppercase", marginTop: 2 },
    record: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10, width: "100%" },
    thumbnail: { borderRadius: 18, overflow: "hidden", flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: p.control[1] },
    flag: { position: "absolute", top: 6, left: 6 },
    details: { flex: 1, minWidth: 0 },
    recordTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 20, color: p.text },
    description: { ...type.caption, color: p.secondary, marginTop: 5 },
    badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
        marginTop: 6, boxShadow: p.controlShadow },
    badgeText: { ...type.caption, color: p.accent },
    chevron: { width: 32, height: 32, borderRadius: 999, flexShrink: 0, alignItems: "center", justifyContent: "center", boxShadow: p.controlShadow },
    more: { minHeight: 50, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    empty: { padding: 24, borderRadius: 24, alignItems: "center", gap: 12, boxShadow: p.itemShadow },
    emptyText: { ...type.body, color: p.secondary, textAlign: "center" },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 24, boxShadow: p.itemShadow },
});
