import React, { memo, useId } from "react";
import { View } from "react-native";
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import Gradient from "./Gradient";

export default memo(function MilestoneIcon({ size = 40, showBackground = true }) {
    const { colors } = useTheme();
    const p = colors.milestoneIcon;
    const id = "milestone-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <View pointerEvents="none" accessible={false} style={{ width: size, height: size, flexShrink: 0,
        borderRadius: size * 0.28, boxShadow: showBackground ? p.shadow : undefined }}>
        {showBackground ? <Gradient pointerEvents="none" accessible={false} colors={p.background}
            style={{ position: "absolute", inset: 0, borderRadius: size * 0.28,
                boxShadow: `inset 1px 2px 2px ${p.highlight}, inset -1px -1px 2px ${p.edge}` }} /> : null}
        <Svg pointerEvents="none" accessible={false} width={size} height={size} viewBox="0 0 100 100" style={{ position: "relative" }}>
            <Defs>
                <LinearGradient id={`${id}-fabric`} x1="0" y1="0" x2="1" y2="1">
                    {p.fabric.map((color, i) => <Stop key={i} offset={i / (p.fabric.length - 1)} stopColor={color} />)}
                </LinearGradient>
                <LinearGradient id={`${id}-pole`} x1="0" y1="0" x2="1" y2="0">
                    {p.pole.map((color, i) => <Stop key={i} offset={i / (p.pole.length - 1)} stopColor={color} />)}
                </LinearGradient>
            </Defs>
            <Ellipse cx="47" cy="80" rx="25" ry="5" fill={p.shade} opacity="0.16" />
            <Path d="M34 30C48 34 57 22 75 28Q78 29 76 33L70 45L77 58Q79 62 74 62C57 57 48 69 34 63Z" fill={p.shade} opacity="0.2" transform="translate(1 3)" />
            <Path d="M33 27C47 32 57 20 75 26Q78 27 76 31L70 44L77 57Q79 61 74 61C57 55 47 67 33 61Z" fill={`url(#${id}-fabric)`} />
            <Path d="M38 30C51 33 59 23 73 27M38 34L38 57" fill="none" stroke={p.highlight} strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
            <Path d="M60 28Q54 44 59 60M72 59Q60 56 48 61" fill="none" stroke={p.shade} strokeWidth="2" strokeLinecap="round" opacity="0.32" />
            <Rect x="27" y="21" width="9" height="57" rx="4.5" fill={`url(#${id}-pole)`} />
            <Path d="M29 26V72" fill="none" stroke={p.highlight} strokeWidth="1.7" strokeLinecap="round" opacity="0.85" />
        </Svg>
    </View>;
});
