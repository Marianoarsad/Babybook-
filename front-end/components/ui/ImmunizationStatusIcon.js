import React, { useId } from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import Gradient from "./Gradient";

export default function ImmunizationStatusIcon({ kind, material, size = 40 }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const id = "vaccine-metric-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <Gradient accessible={false} colors={material.surface} style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: p.rowShadow }}>
        <Svg accessible={false} aria-hidden pointerEvents="none" width={size * 0.75} height={size * 0.75} viewBox="0 0 36 36" style={{ position: "relative" }}>
            <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">{material.art.map((color, i) => <Stop key={color} offset={i / 2} stopColor={color} />)}</LinearGradient></Defs>
            {kind === "scheduled" || kind === "dueSoon" ? <>
                <Rect x="4" y="7" width="28" height="27" rx="6" fill={material.art[2]} opacity="0.18" />
                <Rect x="4" y="5" width="28" height="27" rx="6" fill={`url(#${id})`} />
                <Rect x="8" y="14" width="20" height="14" rx="2" fill={p.reflection} opacity="0.95" />
                <Path d="M11 3v7M25 3v7" stroke={material.art[2]} strokeWidth="3" strokeLinecap="round" />
                {[12, 18, 24].flatMap(x => [18, 24].map(y => <Rect key={`${x}-${y}`} x={x - 1} y={y - 1} width="2.5" height="2.5" rx="0.6" fill={material.art[1]} />))}
            </> : <>
                <Circle cx="18" cy="20" r="14" fill={material.art[2]} opacity="0.18" /><Circle cx="18" cy="18" r="14" fill={`url(#${id})`} />
                {kind === "completed" ? <Path d="m10 18 6 6 11-12" fill="none" stroke={p.reflection} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /> : kind === "alert" ?
                    <Path d="M18 10v10M18 25v.1" fill="none" stroke={p.reflection} strokeWidth="3.5" strokeLinecap="round" /> : <>
                    <Circle cx="18" cy="18" r="10" fill="none" stroke={p.reflection} strokeWidth="1.6" />
                    <Path d="M18 10v9l5 3" fill="none" stroke={p.reflection} strokeWidth="2.5" strokeLinecap="round" />
                </>}
            </>}
            <Path d="M8 12q2-6 9-6" fill="none" stroke={p.reflection} strokeWidth="1.5" opacity="0.75" strokeLinecap="round" />
        </Svg>
    </Gradient>;
}

