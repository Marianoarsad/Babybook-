import React, { useId, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH } from "../../theme";
import Gradient from "./Gradient";
import useSoftPress from "./useSoftPress";

export function NutritionBackground({ kind = "card", radius = 24 }) {
    const { colors } = useTheme();
    return <Gradient pointerEvents="none" accessible={false} colors={colors.nutritionSurface[kind]}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius,
            boxShadow: "inset 0 1px 2px " + colors.nutritionSurface.highlight }]} />;
}

export function NutritionControl({ ref: controlRef, children, circular = false, style, ...props }) {
    const { colors } = useTheme();
    const { respond, transform } = useSoftPress(0.97);
    const [focused, setFocused] = useState(false);
    const focus = event => setFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    const radius = circular ? MIN_TOUCH / 2 : 24;
    return <Pressable {...props} ref={controlRef} onPressIn={() => respond(true)} onPressOut={() => respond(false)}
        onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); respond(false); }}
        style={[{ minHeight: MIN_TOUCH, borderRadius: radius }, style, Platform.OS === "web" && { outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: colors.nutritionSurface.series }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: radius,
            boxShadow: colors.nutritionSurface.controlShadow, transform }]}>
            <NutritionBackground kind={circular ? "filter" : "control"} radius={radius} />
        </Animated.View>
        {children}
    </Pressable>;
}

export function NutritionControlIcon({ calendar = false, size = 24 }) {
    const { colors } = useTheme();
    const p = colors.nutritionArtwork;
    const id = "nutrition-control-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <Svg pointerEvents="none" accessible={false} width={size} height={size} viewBox="0 0 32 32">
        <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {p.pink.map((color, index) => <Stop key={index} offset={index / 2} stopColor={color} />)}
        </LinearGradient></Defs>
        {calendar ? <>
            <Rect x="4" y="6" width="24" height="24" rx="5" fill={"url(#" + id + ")"} />
            <Rect x="7" y="13" width="18" height="13" rx="2" fill={p.reflection} />
            <Path d="M10 3 L10 9 M22 3 L22 9" stroke={p.pink[2]} strokeWidth="3" strokeLinecap="round" />
            <Path d="M11 17 L12 17 M19 17 L20 17 M11 22 L12 22 M19 22 L20 22" stroke={p.pink[2]} strokeWidth="3" strokeLinecap="round" />
        </> : <>
            <Path d="M5 6 Q3 6 5 9 L12 18 L12 26 Q16 30 20 26 L20 18 L27 9 Q29 6 27 6 Z" fill={"url(#" + id + ")"} />
            <Path d="M7 8 L24 8" stroke={p.reflection} strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" />
        </>}
    </Svg>;
}
