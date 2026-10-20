import React, { memo, useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, G, Rect, ClipPath, Path, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";

// An elapsed course is not confirmation that the parent finished it.
export function medicationIconVariant(record) {
    return record?.resolved === true ? "green" : "purple";
}

export default memo(function MedicationIcon({ record, size = 40, showBackground = true }) {
    const { colors } = useTheme();
    const material = colors.medicationIcon;
    const palette = material[medicationIconVariant(record)];
    const id = "pill-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <View pointerEvents="none" style={{ width: size, height: size, flexShrink: 0 }} accessible={false}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" accessible={false}>
            <Defs>
                <LinearGradient id={id + "-circle"} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={palette.background[0]} /><Stop offset="1" stopColor={palette.background[1]} />
                </LinearGradient>
                <RadialGradient id={id + "-body"} cx="25%" cy="20%" r="85%">
                    {palette.body.map((color, i) => <Stop key={i} offset={i / 2} stopColor={color} />)}
                </RadialGradient>
                <LinearGradient id={id + "-white"} x1="0" y1="0" x2="1" y2="1">
                    {material.white.map((color, i) => <Stop key={i} offset={i / 2} stopColor={color} />)}
                </LinearGradient>
                <LinearGradient id={id + "-shine"} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={material.reflection} stopOpacity="0.85" />
                    <Stop offset="1" stopColor={material.reflection} stopOpacity="0" />
                </LinearGradient>
            <ClipPath id={id + "-clip"}><Rect x="33" y="13" width="34" height="74" rx="17" /></ClipPath>
            </Defs>
            {showBackground ? <Circle cx="50" cy="50" r="49" fill={"url(#" + id + "-circle)"} /> : null}
            <G transform="rotate(40 50 50)">
                <Rect x="33" y="16" width="36" height="74" rx="18" fill={palette.shade} opacity="0.12" />
                <Rect x="33" y="13" width="34" height="74" rx="17" fill={"url(#" + id + "-body)"} />
                <G clipPath={"url(#" + id + "-clip)"}>
                    <Rect x="33" y="50" width="34" height="38" fill={"url(#" + id + "-white)"} />
                    <Path d="M33 50 Q50 54 67 50 L67 53 Q50 57 33 53 Z" fill={palette.shade} opacity="0.2" />
                    <Path d="M36 48 L36 31 Q36 16 49 16 Q40 22 40 34 L40 46 Z" fill={"url(#" + id + "-shine)"} />
                    <Path d="M36 56 Q35 77 48 81 Q40 74 41 57 Z" fill={material.reflection} opacity="0.88" />
                    <Path d="M63 30 L63 68 Q63 80 53 84 L58 83 Q67 77 67 65 L67 29 Z" fill={palette.shade} opacity="0.22" />
                    <Path d="M38 24 Q43 15 53 16" fill="none" stroke={material.reflection} strokeOpacity="0.65" strokeWidth="1.5" strokeLinecap="round" />
                    <Path d="M62 57 L62 69 Q62 79 54 82" fill="none" stroke={material.reflection} strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
                </G>
            </G>
        </Svg>
    </View>;
});
