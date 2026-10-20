import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { motion, space, type } from "../../theme";
import Gradient from "./Gradient";

export const TAB_KEYS = ["dashboard", "health", "growth", "nutrition", "calendar"];
export const TAB_BAR_BASE_HEIGHT = 106;
export const TAB_ICON_SIZE = 32;
// Keep tall accessibility layouts from clipping the end tabs inside the pill.
const GLASS_RADIUS = 44;
const ROW_PADDING = 4;
const ITEM_GAP = 2;

export const TAB_ICON_ASSETS = {
    dashboard: { blue: require("../../assets/navbar/dashboard-blue.png"), pink: require("../../assets/navbar/dashboard-pink.png"), inactive: require("../../assets/navbar/dashboard-inactive.png") },
    health: { blue: require("../../assets/navbar/health-blue.png"), pink: require("../../assets/navbar/health-pink.png"), inactive: require("../../assets/navbar/health-inactive.png") },
    growth: { blue: require("../../assets/navbar/growth-blue.png"), pink: require("../../assets/navbar/growth-pink.png"), inactive: require("../../assets/navbar/growth-inactive.png") },
    nutrition: { blue: require("../../assets/navbar/nutrition-blue.png"), pink: require("../../assets/navbar/nutrition-pink.png"), inactive: require("../../assets/navbar/nutrition-inactive.png") },
    calendar: { blue: require("../../assets/navbar/calendar-blue.png"), pink: require("../../assets/navbar/calendar-pink.png"), inactive: require("../../assets/navbar/calendar-inactive.png") },
};
export const TAB_ICON_SOURCES = Object.values(TAB_ICON_ASSETS).flatMap(Object.values);

export function TabIcon({ name, active = false, mode = "neutral" }) {
    const assets = TAB_ICON_ASSETS[name];
    if (!assets) return null;
    return <Image source={assets[active ? mode === "girl" ? "pink" : "blue" : "inactive"]}
        style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE }} resizeMode="contain"
        accessible={false} pointerEvents="none" fadeDuration={0} />;
}

function TabItem({ tab, label, active, reduceMotion, colors, mode, styles, onSelect }) {
    const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
    const scale = useRef(new Animated.Value(active ? 1 : 0.96)).current;
    const previous = useRef(active);
    const [focusVisible, setFocusVisible] = useState(false);
    const updateFocus = Platform.OS === "web"
        ? (event) => setFocusVisible(Boolean(event.currentTarget?.matches?.(":focus-visible")))
        : undefined;
    useEffect(() => {
        const changed = active !== previous.current;
        previous.current = active;
        if (reduceMotion) {
            progress.stopAnimation();
            scale.stopAnimation();
            progress.setValue(active ? 1 : 0);
            scale.setValue(active ? 1 : 0.96);
            return;
        }
        if (!changed) return;
        const options = { duration: motion.standard.duration, easing: Easing.bezier(...motion.micro.bezier),
            useNativeDriver: Platform.OS !== "web", isInteraction: false };
        const animation = Animated.parallel([
            Animated.timing(progress, { ...options, toValue: active ? 1 : 0 }),
            active ? Animated.sequence([
                Animated.timing(scale, { ...options, toValue: 1.05, duration: 110 }),
                Animated.timing(scale, { ...options, toValue: 1, duration: 110 }),
            ]) : Animated.timing(scale, { ...options, toValue: 0.96 }),
        ]);
        animation.start();
        return () => animation.stop();
    }, [active, reduceMotion, progress, scale]);
    useEffect(() => () => { progress.stopAnimation(); scale.stopAnimation(); }, [progress, scale]);
    return <Pressable onPress={() => onSelect(tab)} accessibilityRole="tab" accessibilityLabel={label}
        accessibilityState={{ selected: active }} aria-selected={active}
        onFocus={updateFocus} onKeyDown={updateFocus} onPressIn={updateFocus}
        onBlur={() => setFocusVisible(false)}
        style={({ pressed }) => [styles.item, Platform.OS === "web" && styles.itemWeb,
            focusVisible && styles.itemFocused, { opacity: pressed ? 0.85 : 1 }]}>
        <View style={styles.iconFrame}>
            <Animated.View style={[styles.iconFrame, { transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
                { scale },
            ] }]}>
                <Animated.View pointerEvents="none" style={[styles.iconLayer,
                    { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
                    <TabIcon name={tab} mode={mode} />
                </Animated.View>
                <Animated.View pointerEvents="none" style={[styles.iconLayer, { opacity: progress }]}>
                    <TabIcon name={tab} active mode={mode} />
                </Animated.View>
            </Animated.View>
        </View>
        <Animated.Text style={[styles.label, {
            color: progress.interpolate({ inputRange: [0, 1],
                outputRange: [colors.navbar.inactiveLabel, colors.navbar.activeLabel] }),
        }]}>{label}</Animated.Text>
    </Pressable>;
}

export default function TabBar({ activeView, onSelect, onLayout, blurTarget }) {
    const { colors, scheme, mode } = useTheme();
    const { t } = useLanguage();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [reduceMotion, setReduceMotion] = useState(true);
    const index = TAB_KEYS.indexOf(activeView);
    const [rowLayout, setRowLayout] = useState({ width: 0, height: 0 });
    const indicatorX = useRef(new Animated.Value(0)).current;
    const previousPlacement = useRef(null);
    const itemWidth = Math.max(0, (rowLayout.width - ROW_PADDING * 2 - ITEM_GAP * (TAB_KEYS.length - 1)) / TAB_KEYS.length);
    const indicatorVisible = index >= 0 && itemWidth > 0 && rowLayout.height > 0;
    const destination = ROW_PADDING + Math.max(0, index) * (itemWidth + ITEM_GAP);
    useLayoutEffect(() => {
        const previous = previousPlacement.current;
        previousPlacement.current = { width: rowLayout.width, height: rowLayout.height, index };
        const resized = !previous || previous.width !== rowLayout.width || previous.height !== rowLayout.height;
        if (!indicatorVisible || resized || previous.index < 0 || reduceMotion) {
            indicatorX.stopAnimation();
            indicatorX.setValue(destination);
            return;
        }
        if (previous.index === index) return;
        const animation = Animated.spring(indicatorX, {
            toValue: destination, stiffness: 450, damping: 38, mass: 1,
            overshootClamping: true, restDisplacementThreshold: 0.5, restSpeedThreshold: 5,
            useNativeDriver: Platform.OS !== "web", isInteraction: false,
        });
        animation.start();
        return () => animation.stop();
    }, [destination, index, indicatorVisible, rowLayout.width, rowLayout.height, reduceMotion, indicatorX]);
    useEffect(() => () => indicatorX.stopAnimation(), [indicatorX]);
    useEffect(() => {
        let mounted = true, changed = false;
        AccessibilityInfo.isReduceMotionEnabled().then((value) => {
            if (mounted && !changed) setReduceMotion(value);
        }).catch(() => {});
        const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
            changed = true;
            if (mounted) setReduceMotion(value);
        });
        return () => { mounted = false; subscription.remove(); };
    }, []);
    const labels = [t("navDashboard"), t("navHealth"), t("navGrowth"), t("navNutrition"), t("navCalendar")];
    return <View pointerEvents="box-none" style={[styles.bar, { left: insets.left, right: insets.right, minHeight: TAB_BAR_BASE_HEIGHT + insets.bottom, paddingBottom: space.md + insets.bottom }]} onLayout={onLayout}>
        <View style={styles.glassShadow}>
            <BlurView
                blurTarget={blurTarget}
                blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
                intensity={80}
                tint={scheme === "dark" ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
                style={styles.glass}
            >
                <Gradient pointerEvents="none" colors={colors.navbar.gradient} style={styles.glassTint} />
                <View pointerEvents="none" style={styles.glassHighlight} />
                <View style={styles.row} onLayout={({ nativeEvent: { layout } }) => {
                    setRowLayout((previous) => previous.width === layout.width && previous.height === layout.height
                        ? previous : { width: layout.width, height: layout.height });
                }}>
                    <Animated.View testID="navbar-glass-indicator" pointerEvents="none" accessible={false} accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={[styles.indicator, { width: itemWidth, height: Math.max(0, rowLayout.height - ROW_PADDING * 2),
                            opacity: indicatorVisible ? 1 : 0, transform: [{ translateX: indicatorX }] }]}>
                        <Gradient colors={colors.navbar.selectedGradient} style={styles.selection}>
                            <Gradient colors={colors.navbar.selectedReflection}
                                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.selectionHighlight} />
                        </Gradient>
                    </Animated.View>
                    {TAB_KEYS.map((tab, position) => <TabItem key={tab} tab={tab} label={labels[position]}
                        active={index === position} reduceMotion={reduceMotion} colors={colors} mode={mode} styles={styles} onSelect={onSelect} />)}
                </View>
            </BlurView>
        </View>
    </View>;
}

const makeStyles = (colors) => StyleSheet.create({
    bar: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20, paddingTop: space.sm, paddingHorizontal: space.md },
    glassShadow: { borderRadius: GLASS_RADIUS, borderCurve: "continuous", boxShadow: colors.navbar.shadow },
    glass: { overflow: "hidden", borderRadius: GLASS_RADIUS, borderCurve: "continuous",
        borderWidth: 1, borderColor: colors.navbar.rim },
    glassTint: { ...StyleSheet.absoluteFillObject },
    glassHighlight: { position: "absolute", top: 1, left: 24, right: 24, height: 1,
        backgroundColor: colors.navbar.highlight },
    row: { flexDirection: "row", alignItems: "stretch", padding: ROW_PADDING, gap: ITEM_GAP },
    item: { flex: 1, minWidth: 0, minHeight: 76, alignItems: "center", justifyContent: "flex-start",
        borderRadius: 24, borderCurve: "continuous", paddingVertical: 8, paddingHorizontal: 2, gap: 6 },
    itemWeb: { outlineStyle: "none" },
    itemFocused: { outlineWidth: 2, outlineStyle: "solid", outlineColor: colors.navbar.activeLabel, outlineOffset: -3 },
    indicator: { position: "absolute", left: 0, top: ROW_PADDING, borderRadius: 26,
        borderCurve: "continuous", boxShadow: colors.navbar.selectedShadow },
    selection: { ...StyleSheet.absoluteFillObject, borderRadius: 26, borderCurve: "continuous", overflow: "hidden" },
    selectionHighlight: { position: "absolute", top: 3, left: 5, right: 5, height: 16, borderRadius: 20 },
    iconLayer: { ...StyleSheet.absoluteFillObject },
    iconFrame: { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, alignItems: "center", justifyContent: "center" },
    label: { ...type.caption, fontFamily: "PublicSans_600SemiBold", fontWeight: "600", textAlign: "center", alignSelf: "stretch" },
});
