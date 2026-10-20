import React, { useId, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path } from "react-native-svg";

// Light is painted over the surface without taking space or intercepting presses.
export default function GlassLighting({ material: p, radius, selected = false, panel = false }) {
    const id = useId().replace(/:/g, "");
    const [size, setSize] = useState({ width: 100, height: 50 });
    const { width: w, height: h } = size;
    const r = Math.min(radius, w / 2 - 1, h / 2 - 1);
    return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFillObject} onLayout={event => {
        const width = Math.round(event.nativeEvent.layout.width), height = Math.round(event.nativeEvent.layout.height);
        if (width > 2 && height > 2) setSize(old => old.width === width && old.height === height ? old : { width, height });
    }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} accessible={false} aria-hidden={true}>
            <Defs>
                <LinearGradient id={id + "rim"} x1="0%" y1="0%" x2="90%" y2="100%">
                    <Stop offset="0" stopColor={p.reflection} stopOpacity="0.98" /><Stop offset="0.32" stopColor={p.reflection} stopOpacity="0.82" />
                    <Stop offset="0.65" stopColor={p.rimShade} stopOpacity="0.35" /><Stop offset="1" stopColor={p.reflection} stopOpacity="0.84" />
                </LinearGradient>
                <LinearGradient id={id + "gloss"} x1="0%" y1="0%" x2="25%" y2="100%">
                    <Stop offset="0" stopColor={p.reflection} stopOpacity={selected ? "0.65" : "0.8"} /><Stop offset="1" stopColor={p.reflection} stopOpacity="0" />
                </LinearGradient>
                <RadialGradient id={id + "cyan"} cx="0%" cy="0%" r="80%"><Stop offset="0" stopColor={p.cyan} stopOpacity={panel ? "0.38" : "0.1"} /><Stop offset="1" stopColor={p.cyan} stopOpacity="0" /></RadialGradient>
                <RadialGradient id={id + "lavender"} cx="100%" cy="70%" r="65%"><Stop offset="0" stopColor={p.lavender} stopOpacity={panel ? "0.16" : "0"} /><Stop offset="1" stopColor={p.lavender} stopOpacity="0" /></RadialGradient>
            </Defs>
            <Rect x="1" y="1" width={w - 2} height={h - 2} rx={r} fill={`url(#${id}cyan)`} />
            <Rect x="1" y="1" width={w - 2} height={h - 2} rx={r} fill={`url(#${id}lavender)`} />
            {panel ? <Path d={`M2 ${r + 4} Q2 2 ${r + 4} 2 L${w - r} 2`} fill="none" stroke={p.rimLight} strokeWidth="3" strokeLinecap="round" />
                : <Path d={`M4 ${h * 0.46} Q4 4 ${r} 4 L${w - r} 4 Q${w - 4} 5 ${w - 4} ${h * 0.36} Q${w * 0.52} ${h * 0.18} 4 ${h * 0.46} Z`} fill={`url(#${id}gloss)`} />}
            <Rect x="0.8" y="0.8" width={w - 1.6} height={h - 1.6} rx={r} fill="none" stroke={`url(#${id}rim)`} strokeWidth={panel ? 1.5 : 1.15} />
            <Rect x="3" y="3" width={Math.max(0, w - 6)} height={Math.max(0, h - 6)} rx={Math.max(0, r - 2)} fill="none" stroke={p.highlight} strokeOpacity="0.28" strokeWidth="1" />
        </Svg>
    </View>;
}
