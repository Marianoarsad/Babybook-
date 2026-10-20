import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, space, type } from "../../theme";
import Gradient from "./Gradient";

function useReducedMotion() {
    const [reduced, setReduced] = useState(true);
    useEffect(() => {
        if (Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia) {
            const query = window.matchMedia("(prefers-reduced-motion: reduce)");
            const changed = () => setReduced(query.matches);
            changed(); query.addEventListener("change", changed);
            return () => query.removeEventListener("change", changed);
        }
        let alive = true, changed = false;
        AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive && !changed) setReduced(value); }).catch(() => {});
        const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", value => { changed = true; if (alive) setReduced(value); });
        return () => { alive = false; subscription.remove(); };
    }, []);
    return reduced;
}

export function MedicineSurface({ item = false, radius = 28 }) {
    const { colors } = useTheme();
    return <Gradient pointerEvents="none" colors={colors.medicineSurface[item ? "item" : "section"]}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius, boxShadow: "inset 0 1px 1px " + colors.medicineSurface.highlight }]} />;
}

export function MedicineDoseButton({ onPress, disabled, label, onLayout }) {
    const { colors } = useTheme();
    const reduced = useReducedMotion();
    const pressure = useRef(new Animated.Value(0)).current;
    const [focused, setFocused] = useState(false);
    const focus = event => setFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    const respond = down => {
        pressure.stopAnimation();
        if (reduced) { pressure.setValue(down ? 1 : 0); return; }
        const options = { toValue: down ? 1 : 0, useNativeDriver: Platform.OS !== "web", isInteraction: false };
        if (down) Animated.timing(pressure, { ...options, duration: 110 }).start();
        else Animated.spring(pressure, { ...options, stiffness: 1400, damping: 64, mass: 0.75, overshootClamping: true }).start();
    };
    useEffect(() => { pressure.stopAnimation(); pressure.setValue(0); }, [disabled, reduced, pressure]);
    useEffect(() => () => pressure.stopAnimation(), [pressure]);
    return <Pressable onLayout={onLayout} onPress={onPress} disabled={disabled} onPressIn={event => { if (event?.nativeEvent?.type === "keydown") focus(event); else setFocused(false); respond(true); }}
        onPressOut={() => respond(false)} onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); respond(false); }}
        accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, busy: !!disabled }}
        style={[{ minHeight: MIN_TOUCH, borderRadius: 999, alignSelf: "flex-start", flexShrink: 0, maxWidth: "100%" },
            Platform.OS === "web" && { outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: colors.primaryDark }]}>
        <Animated.View style={{ maxWidth: "100%", opacity: disabled ? 0.55 : 1, transform: [{ scale: pressure.interpolate({ inputRange: [0, 1], outputRange: reduced ? [1, 1] : [1, 0.95] }) }] }}>
            <Gradient colors={colors.medicineAction.gradient} style={{ minHeight: MIN_TOUCH, borderRadius: 999,
                paddingHorizontal: space.lg, paddingVertical: space.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm,
                boxShadow: colors.medicineSurface.itemShadow }}>
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: 999,
                    boxShadow: "inset 0 2px 3px " + colors.medicineSurface.highlight,
                    opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) }]} />
                <Ionicons name="add" size={21} color={colors.medicineAction.foreground} />
                <Text style={{ ...type.label, color: colors.medicineAction.foreground, flexShrink: 1, textAlign: "center" }}>Record a dose</Text>
            </Gradient>
        </Animated.View>
    </Pressable>;
}

export function DoseProgress({ given, scheduled, onCountLayout }) {
    const { colors } = useTheme();
    const reduced = useReducedMotion();
    const ratio = scheduled > 0 ? Math.min(1, Math.max(0, given / scheduled)) : 0;
    const value = useRef(new Animated.Value(ratio)).current;
    const [width, setWidth] = useState(0);
    useEffect(() => {
        value.stopAnimation();
        if (reduced) value.setValue(ratio);
        else Animated.timing(value, { toValue: ratio, duration: 300, easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== "web", isInteraction: false }).start();
        return () => value.stopAnimation();
    }, [ratio, reduced, value]);
    if (!scheduled) return <Text style={{ ...type.caption, color: colors.textMuted }}>Schedule not recorded</Text>;
    return <View style={{ flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0, gap: space.sm }} accessible accessibilityLiveRegion="polite" accessibilityRole="progressbar"
        accessibilityLabel="Doses recorded today" accessibilityValue={{ min: 0, max: scheduled, now: Math.min(given, scheduled), text: given + " / " + scheduled + " doses" }}>
        <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flex: 1, minWidth: 30, height: 12, borderRadius: 999, overflow: "hidden", backgroundColor: colors.medicineSurface.track }}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [
                { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [-width / 2, 0] }) }, { scaleX: value },
            ] }]}>
                <Gradient colors={colors.medicineSurface.progress} style={[StyleSheet.absoluteFillObject, { borderRadius: 999 }]} />
            </Animated.View>
        </View>
        <Text onLayout={onCountLayout} style={{ ...type.caption, color: colors.textSecondary, flexShrink: 0, maxWidth: "80%" }}>{given} / {scheduled} doses</Text>
    </View>;
}

export function MedicineReminderBanner() {
    const { colors } = useTheme();
    return <Gradient colors={colors.medicineSurface.banner} style={{ borderRadius: 18, padding: 16, marginBottom: 20,
        flexDirection: "row", alignItems: "flex-start", gap: 12, boxShadow: "inset 0 1px 2px " + colors.medicineSurface.highlight }}>
        <Gradient colors={colors.medicineSurface.info} style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" }}>
            <Text accessible={false} style={{ ...type.label, color: colors.medicationIcon.reflection }}>i</Text>
        </Gradient>
        <Text style={{ ...type.body, fontSize: 14, lineHeight: 21, fontWeight: "500", flex: 1, color: colors.text }}>Dose reminders arrive on the phone app. This preview can't send them, but everything you record here is saved.</Text>
    </Gradient>;
}
