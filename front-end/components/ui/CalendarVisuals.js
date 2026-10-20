import React, { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, type } from "../../theme";
import Gradient from "./Gradient";
import useReducedMotion from "./useReducedMotion";
import useSoftPress from "./useSoftPress";

export function CalendarSurface({ kind = "panel", radius = 28 }) {
    const { colors } = useTheme();
    const p = colors.calendarSurface;
    return <Gradient accessible={false} pointerEvents="none" colors={p[kind]}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius,
            boxShadow: `inset 0 2px 2px ${p.highlight}, inset -1px -1px 2px ${p.shade}` }]} />;
}

// Keep the hit area and legend anchor stationary while its visible face compresses.
export function CalendarControl({ ref: controlRef, active = false, kind = "control", circular = false,
    children, style, ...props }) {
    const { colors } = useTheme();
    const p = colors.calendarSurface;
    const { respond, transform } = useSoftPress(0.985);
    const reduced = useReducedMotion();
    const selection = useRef(new Animated.Value(active ? 1 : 0)).current;
    const previousActive = useRef(active);
    const [focused, setFocused] = useState(false);
    const [pressed, setPressed] = useState(false);
    const borderRadius = circular ? MIN_TOUCH / 2 : kind === "day" ? 12 : 999;
    const focus = event => setFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    useLayoutEffect(() => {
        selection.stopAnimation();
        const changed = previousActive.current !== active;
        previousActive.current = active;
        if (reduced !== false || !changed) selection.setValue(active ? 1 : 0);
        else Animated.timing(selection, { toValue: active ? 1 : 0, duration: 180,
            easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== "web", isInteraction: false }).start();
        return () => selection.stopAnimation();
    }, [active, reduced, selection]);
    const press = down => { setPressed(down); respond(down); };
    return <Pressable {...props} ref={controlRef}
        aria-pressed={props.accessibilityState?.selected}
        aria-expanded={props.accessibilityState?.expanded}
        onPressIn={() => press(true)} onPressOut={() => press(false)}
        onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); press(false); }}
        style={[{ minHeight: MIN_TOUCH, borderRadius, justifyContent: "center", alignItems: "center" }, style,
            Platform.OS === "web" && { outlineStyle: focused ? "solid" : "none", outlineWidth: 2,
                outlineOffset: 2, outlineColor: p.focus }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius,
            ...(kind === "day" ? { left: 2, right: 2 } : {}),
            boxShadow: pressed ? p.pressedShadow : active ? p.activeShadow : kind === "day" ? p.dayShadow : p.controlShadow,
            transform }]}>
            <CalendarSurface kind={kind} radius={borderRadius} />
            <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: selection }]}>
                <CalendarSurface kind="active" radius={borderRadius} />
            </Animated.View>
        </Animated.View>
        {children}
    </Pressable>;
}

export function CalendarArtwork({ information = false }) {
    const { colors } = useTheme();
    const p = colors.calendarSurface;
    const id = "calendar-info-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    if (!information) return <Image accessible={false} source={require("../../assets/navbar/calendar-blue.png")}
        style={{ width: 29, height: 29 }} resizeMode="contain" />;
    return <Svg aria-hidden pointerEvents="none" width={29} height={29} viewBox="0 0 32 32" style={{ position: "relative" }}>
        <Defs><LinearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            {p.active.map((color, index) => <Stop key={color} offset={index / (p.active.length - 1)} stopColor={color} />)}
        </LinearGradient></Defs>
        <Circle cx="16" cy="16" r="12" fill="none" stroke={`url(#${id})`} strokeWidth="3" />
        <Path d="M16 15 L16 23 M16 10 L16 10.2" stroke={`url(#${id})`} strokeWidth="3.5" strokeLinecap="round" />
        <Path d="M7 11 Q10 4 18 5" fill="none" stroke={p.highlight} strokeWidth="1.1" strokeLinecap="round" />
    </Svg>;
}

export function CalendarDateCell({ date, state, marking = {}, onPress, onLongPress, accessibilityLabel, testID, children }) {
    const { colors } = useTheme();
    const p = colors.calendarSurface;
    const selected = Boolean(marking.selected);
    const disabled = Boolean(marking.disabled || marking.disableTouchEvent);
    const muted = state === "disabled" && !selected;
    const periods = marking.periods || [];
    return <CalendarControl kind="day" active={selected} style={styles.day} disabled={disabled}
        onPress={() => onPress?.(date)} onLongPress={onLongPress ? () => onLongPress(date) : undefined}
        accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={testID}
        accessibilityState={{ selected, disabled }}>
        <Text style={[styles.dayText, { color: selected ? p.onActive : muted ? p.muted : p.text }]}>{children ?? date.day}</Text>
        {periods.length > 0 && <View pointerEvents="none" style={styles.markers}>
            {periods.map((period, index) => <View key={index} style={[styles.marker,
                selected && { boxShadow: `0 0 0 1px ${p.markerBacking}` }, {
                    backgroundColor: period.color,
                    borderTopLeftRadius: period.startingDay ? 3 : 0,
                    borderBottomLeftRadius: period.startingDay ? 3 : 0,
                    borderTopRightRadius: period.endingDay ? 3 : 0,
                    borderBottomRightRadius: period.endingDay ? 3 : 0,
                    marginLeft: period.startingDay ? 3 : 0,
                    marginRight: period.endingDay ? 3 : 0,
                }]} />)}
        </View>}
    </CalendarControl>;
}

export function CalendarMonthTransition({ month, width, children }) {
    const reduced = useReducedMotion();
    const position = useRef(new Animated.Value(0)).current;
    const previous = useRef({ month, width });
    useLayoutEffect(() => {
        position.stopAnimation();
        const changed = previous.current.month !== month;
        const resized = previous.current.width !== width;
        const direction = month > previous.current.month ? 1 : -1;
        previous.current = { month, width };
        if (reduced !== false || resized || !changed) position.setValue(0);
        else {
            position.setValue(direction);
            Animated.timing(position, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic),
                useNativeDriver: Platform.OS !== "web", isInteraction: false }).start();
        }
        return () => position.stopAnimation();
    }, [month, width, reduced, position]);
    const motion = useMemo(() => ({ transform: [{ translateX: position.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] }) }],
        opacity: position.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.65, 1, 0.65] }) }), [position]);
    return <Animated.View style={motion}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
    day: { width: "100%", height: MIN_TOUCH },
    dayText: { ...type.label, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
    markers: { position: "absolute", bottom: 3, left: "18%", right: "18%", gap: 1 },
    marker: { height: 2.5 },
});
