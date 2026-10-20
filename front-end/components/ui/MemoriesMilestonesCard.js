import React, { useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, type } from "../../theme";
import { EmptyStateCard, MemoryVisualCard } from "../common/Cards";
import Gradient from "./Gradient";
import RecordIcon from "./RecordIcon";
import useSoftPress from "./useSoftPress";

export function MemoryGalleryGrid({ records, onOpenMemory }) {
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const columns = width > 0 && (width - 12) / 2 < 112 * fontScale ? 1 : 2;
    const rows = [];
    for (let i = 0; i < records.length; i += columns) rows.push(records.slice(i, i + columns));
    return <View onLayout={event => setWidth(Math.floor(event.nativeEvent.layout.width))}
        style={{ gap: 16 }}>
        {rows.map((row, index) => <View key={index} style={{ flexDirection: "row", gap: 12, alignItems: "stretch" }}>
            {row.map((record, itemIndex) => <MemoryVisualCard key={`${record.kind || "memory"}-${record.id || itemIndex}`}
                title={record.title} description={record.description} date={record.date} photoUrl={record.photoUrl}
                kind={record.kind || "memory"} style={{ flex: 1, minWidth: 0 }} onClick={() => onOpenMemory(record)} />)}
            {columns === 2 && row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>)}
    </View>;
}

function SeeAll({ onPress }) {
    const { colors } = useTheme();
    const p = colors.memoriesSurface;
    const { respond, transform } = useSoftPress();
    const [pressed, setPressed] = useState(false), [focused, setFocused] = useState(false);
    const press = down => { setPressed(down); respond(down); };
    const focus = event => setFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    return <Animated.View style={{ borderRadius: 999, transform, boxShadow: pressed ? p.pressedShadow : p.controlShadow }}>
        <Gradient pointerEvents="none" accessible={false} colors={p.control}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 999, boxShadow: `inset 1px 2px 2px ${p.highlight}` }]} />
        <Pressable onPress={onPress} onPressIn={() => press(true)} onPressOut={() => press(false)}
            onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); press(false); }}
            accessibilityRole="button" accessibilityLabel="See all memories and milestones"
            style={{ minHeight: MIN_TOUCH, paddingHorizontal: 10, flexDirection: "row", gap: 3,
                alignItems: "center", justifyContent: "center", borderRadius: 999,
                ...(Platform.OS === "web" ? { outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: p.accent } : {}) }}>
            <Text style={{ ...type.label, fontSize: 13, lineHeight: 17, color: p.accent }}>See all</Text>
            <Ionicons name="chevron-forward" size={17} color={p.accent} />
        </Pressable>
    </Animated.View>;
}

export default function MemoriesMilestonesCard({ records, onOpenMemory, onViewAll }) {
    const { colors } = useTheme();
    const p = colors.memoriesSurface;
    return <View style={{ borderRadius: 28, padding: 16, marginBottom: 16, boxShadow: p.panelShadow }}>
        <Gradient pointerEvents="none" accessible={false} colors={p.panel}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 28,
                boxShadow: `inset 1px 2px 2px ${p.highlight}, inset -1px -1px 2px ${p.shade}` }]} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <RecordIcon category="milestone" size={40} showBackground={false} />
            <Text accessibilityRole="header" style={{ ...type.heading, color: p.text, flex: 1, minWidth: 0 }}>Memories &amp; Milestones</Text>
            <SeeAll onPress={onViewAll} />
        </View>
        {records.length ? <MemoryGalleryGrid records={records} onOpenMemory={onOpenMemory} />
            : <EmptyStateCard message="No memories yet. Tap Add to save your baby's precious moments." icon="image-outline" />}
    </View>;
}
