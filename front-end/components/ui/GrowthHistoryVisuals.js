import React, { useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { type, MIN_TOUCH } from "../../theme";
import Gradient from "./Gradient";
import GrowthIcon from "./GrowthIcon";
import useSoftPress from "./useSoftPress";

export function HistoryBackground({ item = false }) {
    const { colors } = useTheme();
    const material = colors.growthHistory;
    return <Gradient pointerEvents="none" accessible={false} colors={material[item ? "item" : "panel"]}
        style={[StyleSheet.absoluteFillObject, { borderRadius: item ? 24 : 28,
            boxShadow: "inset 0 1px 2px " + material.highlight }]} />;
}

export function MeasurementHistoryRow({ date, age }) {
    const { colors } = useTheme();
    const material = colors.growthHistory;
    return <View style={{ minHeight: 80, padding: 14, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <HistoryBackground item />
        <GrowthIcon size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...type.bodyStrong, fontSize: 17, color: material.title }}>{date}</Text>
            {age ? <Text style={{ ...type.caption, color: material.secondary, marginTop: 3 }}>{age}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={21} color={material.chevron} accessible={false} />
    </View>;
}

export function HistoryShowMore({ remaining, onPress, noun }) {
    const { colors } = useTheme();
    const material = colors.growthHistory;
    const { respond, transform } = useSoftPress();
    const [focused, setFocused] = useState(false);
    const focus = event => setFocused(Platform.OS === "web" && !!event.currentTarget?.matches?.(":focus-visible"));
    return <Pressable onPress={onPress} onPressIn={() => { setFocused(false); respond(true); }} onPressOut={() => respond(false)}
        onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); respond(false); }}
        accessibilityRole="button" accessibilityLabel={"Show more " + noun + ", " + remaining + " remaining"}
        style={{ minHeight: MIN_TOUCH, marginTop: 4, borderRadius: 999, ...(Platform.OS === "web" ?
            { outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: material.moreText } : {}) }}>
        <Animated.View style={{ transform, borderRadius: 999, boxShadow: material.moreShadow }}>
            <Gradient colors={material.more} style={{ minHeight: 48, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 12,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden", boxShadow: "inset 0 2px 2px " + material.highlight }}>
                <Ionicons name="chevron-down" size={18} color={material.moreText} />
                <Text style={{ ...type.label, color: material.moreText, textAlign: "center", flexShrink: 1 }}>Show more ({remaining.toLocaleString()} remaining)</Text>
            </Gradient>
        </Animated.View>
    </Pressable>;
}
