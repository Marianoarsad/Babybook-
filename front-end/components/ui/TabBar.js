import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { MIN_TOUCH, motion, radius, shadow, space, type } from "../../theme";

export const TAB_KEYS = ["dashboard", "health", "growth", "nutrition", "calendar"];
export const TAB_BAR_BASE_HEIGHT = 88;
export const TAB_ICON_SIZE = 28;

// Transparent, tintable silhouettes: no JPEG backgrounds or mismatched font glyphs.
export function TabIcon({ name, color }) {
    let shape;
    switch (name) {
        case "dashboard":
            shape = <Path d="M3 10.5 16 3l13 7.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
            return <Svg width={TAB_ICON_SIZE} height={TAB_ICON_SIZE} viewBox="0 0 32 32" accessible={false}>
                {shape}<Path fill={color} d="M5 15 16 8.5 27 15v12a3 3 0 0 1-3 3h-4v-9a4 4 0 0 0-8 0v9H8a3 3 0 0 1-3-3Z" />
            </Svg>;
        case "health":
            shape = <><Rect x="9" y="2" width="4" height="8" rx="2" fill={color} />
                <Rect x="20" y="2" width="4" height="8" rx="2" fill={color} />
                <Path fill={color} fillRule="evenodd" d="M11 6h10q9 0 9 9v6q0 9-9 9H11q-9 0-9-9v-6q0-9 9-9ZM14 12q-1 0-1 1v4H9q-1 0-1 1v3q0 1 1 1h4v4q0 1 1 1h4q1 0 1-1v-4h4q1 0 1-1v-3q0-1-1-1h-4v-4q0-1-1-1Z" />
            </>;
            break;
        case "growth":
            shape = <><Rect x="2" y="18" width="7" height="12" rx="1.6" fill={color} />
                <Rect x="12" y="12" width="7" height="18" rx="1.6" fill={color} />
                <Path fill={color} d="M24 2q1-1 2 0l4 5q1 2-1 2H28v13q0 1-1 1h-4q-1 0-1-1V9h-1.5q-2 0-1-2Z" />
                <Rect x="22" y="25" width="7" height="2" rx="1" fill={color} />
                <Rect x="22" y="28" width="7" height="2" rx="1" fill={color} />
            </>;
            break;
        case "nutrition":
            shape = <Path fill={color} d="M16 9q-5-4-10 0-6 5-2 11 3 5 12 10 9-5 12-10 4-6-2-11-4-3-8-1 0-4 3-6-4 0-5 7ZM15 7q-7 0-7-6 7 0 7 6ZM22 11q4-1 4 4 0 2-2 3 1-5-2-7Z" fillRule="evenodd" />;
            break;
        case "calendar":
            shape = <><Path fill={color} fillRule="evenodd" d="M10 6h12q8 0 8 8v8q0 8-8 8H10q-8 0-8-8v-8q0-8 8-8ZM5 13v9q0 5 5 5h12q5 0 5-5v-9Z" />
                <Rect x="8" y="2" width="3.5" height="9" rx="1.75" fill={color} />
                <Rect x="21" y="2" width="3.5" height="9" rx="1.75" fill={color} />
                {[0, 1, 2].map((row) => [0, 1, 2, 3].slice(0, row === 2 ? 3 : 4).map((column) =>
                    <Rect key={row + ":" + column} x={7 + column * 5} y={15 + row * 4} width="3" height="3" rx=".5" fill={color} />))}
            </>;
            break;
        default: return null;
    }
    return <Svg width={TAB_ICON_SIZE} height={TAB_ICON_SIZE} viewBox="0 0 32 32" accessible={false}>{shape}</Svg>;
}

function TabItem({ tab, label, active, reduceMotion, colors, styles, onSelect }) {
    const progress = useRef(new Animated.Value(0)).current;
    const previous = useRef(active);
    useEffect(() => {
        const newlySelected = active && !previous.current;
        previous.current = active;
        progress.stopAnimation();
        progress.setValue(0);
        if (!newlySelected || reduceMotion) return;
        const animation = Animated.sequence([
            Animated.timing(progress, { toValue: 1, duration: motion.micro.duration,
                easing: Easing.bezier(...motion.micro.bezier), useNativeDriver: Platform.OS !== "web" }),
            Animated.timing(progress, { toValue: 0, duration: 100,
                easing: Easing.bezier(...motion.micro.bezier), useNativeDriver: Platform.OS !== "web" }),
        ]);
        animation.start();
        return () => { animation.stop(); progress.stopAnimation(); progress.setValue(0); };
    }, [active, reduceMotion, progress]);
    return <Pressable onPress={() => onSelect(tab)} accessibilityRole="tab" accessibilityLabel={label}
        accessibilityState={{ selected: active }} style={({ pressed }) => [styles.item, { opacity: pressed ? 0.85 : 1 }]}>
        <View style={styles.iconFrame}>
            <Animated.View style={{ transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
            ] }}>
                <TabIcon name={tab} color={active ? colors.primary : colors.textMuted} />
            </Animated.View>
        </View>
        <Text numberOfLines={2} style={[styles.label, active && styles.labelActive,
            { color: active ? colors.primary : colors.textMuted }]}>{label}</Text>
    </Pressable>;
}

export default function TabBar({ activeView, onSelect, onLayout, blurTarget }) {
    const { colors, scheme } = useTheme();
    const { t } = useLanguage();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [reduceMotion, setReduceMotion] = useState(true);
    const index = TAB_KEYS.indexOf(activeView);
    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled().then((value) => mounted && setReduceMotion(value)).catch(() => {});
        const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
        return () => { mounted = false; subscription.remove(); };
    }, []);
    const labels = [t("navDashboard"), t("navHealth"), t("navGrowth"), t("navNutrition"), t("navCalendar")];
    return <View style={[styles.bar, { paddingBottom: space.sm + insets.bottom }]} onLayout={onLayout}>
        <View style={styles.glassShadow}>
            <BlurView
                blurTarget={blurTarget}
                blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
                intensity={72}
                tint={scheme === "dark" ? "systemMaterialDark" : "systemMaterialLight"}
                style={styles.glass}
            >
                <View pointerEvents="none" style={styles.glassTint} />
                <View style={styles.row}>
                    {TAB_KEYS.map((tab, position) => <TabItem key={tab} tab={tab} label={labels[position]}
                        active={index === position} reduceMotion={reduceMotion} colors={colors} styles={styles} onSelect={onSelect} />)}
                </View>
            </BlurView>
        </View>
    </View>;
}

const makeStyles = (colors) => StyleSheet.create({
    bar: { minHeight: TAB_BAR_BASE_HEIGHT, paddingTop: space.sm, paddingHorizontal: space.md },
    glassShadow: { borderRadius: radius.pill, borderCurve: "continuous", ...shadow.raised },
    glass: { overflow: "hidden", borderRadius: radius.pill, borderCurve: "continuous",
        borderWidth: 1, borderColor: colors.surface + "CC", backgroundColor: colors.surface + "70" },
    glassTint: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surface + "38" },
    row: { flexDirection: "row", alignItems: "stretch" },
    item: { flex: 1, minWidth: 0, minHeight: MIN_TOUCH, alignItems: "center",
        paddingTop: 10, paddingBottom: 8, paddingHorizontal: 2, gap: 4 },
    iconFrame: { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, alignItems: "center", justifyContent: "center" },
    label: { ...type.caption, textAlign: "center", alignSelf: "stretch" },
    labelActive: { fontWeight: "700" },
});
