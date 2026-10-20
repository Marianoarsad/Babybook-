import React, { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import Gradient from "./Gradient";

export default function ConditionsArtwork({ kind, size = 40 }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const id = "condition-aux-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const art = kind === "grid" ? p.all.art : kind === "microbe" ? p.overdue.art : colors.plansDashboard.artwork.board;
    return <View accessible={false} pointerEvents="none" style={{ width: size, height: size, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {kind !== "clipboard" ? <Gradient accessible={false} colors={kind === "grid" ? p.all.surface : p.overdue.surface}
            style={{ position: "absolute", inset: 0, borderRadius: size / 2, boxShadow: p.rowShadow }} /> : null}
        <Svg style={{ position: "relative" }} accessible={false} aria-hidden width={size * 0.9} height={size * 0.9} viewBox="0 0 100 100">
            <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                {art.map((color, i) => <Stop key={i} offset={i / (art.length - 1)} stopColor={color} />)}
            </LinearGradient></Defs>
            {kind === "grid" ? [25,55].flatMap(x => [25,55].map(y => <React.Fragment key={`${x}-${y}`}>
                <Rect x={x} y={y+2} width="22" height="22" rx="5" fill={art[2]} opacity="0.2" />
                <Rect x={x} y={y} width="22" height="22" rx="5" fill={`url(#${id})`} />
                <Rect x={x+5} y={y+5} width="12" height="12" rx="2" fill={p.reflection} opacity="0.9" />
            </React.Fragment>)) : kind === "microbe" ? <>
                {Array.from({length:8},(_,i) => <React.Fragment key={i}>
                    <Path d="M50 20v12" transform={`rotate(${i*45} 50 50)`} stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round" />
                    <Circle cx="50" cy="18" r="5" transform={`rotate(${i*45} 50 50)`} fill={`url(#${id})`} />
                </React.Fragment>)}
                <Circle cx="50" cy="52" r="23" fill={art[2]} opacity="0.2" /><Circle cx="50" cy="49" r="22" fill={`url(#${id})`} />
                <Path d="M34 42q3-9 12-10" fill="none" stroke={p.reflection} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
                {[ [43,43],[56,45],[49,58] ].map(([cx,cy],i)=><Circle key={i} cx={cx} cy={cy} r="3" fill={p.reflection} opacity="0.7" />)}
            </> : <>
                <Path d="M25 85C4 67 10 46 23 50q12 3 11 32M70 84q18-35 24-21t-17 27" fill={art[0]} opacity="0.7" />
                <Rect x="26" y="19" width="54" height="72" rx="10" fill={art[2]} opacity="0.15" />
                <Rect x="23" y="16" width="54" height="72" rx="10" fill={`url(#${id})`} />
                <Rect x="28" y="21" width="44" height="61" rx="6" fill={p.reflection} />
                <Rect x="37" y="10" width="26" height="16" rx="5" fill={colors.conditionArtwork.purple[1]} />
                <Circle cx="50" cy="12" r="3" fill={p.reflection} />
                <Path d="M50 37v16M42 45h16" stroke={colors.conditionArtwork.purple[1]} strokeWidth="7" strokeLinecap="round" />
                <Path d="m35 65 3 3 5-6M47 65h17m-29 9 3 3 5-6M47 74h14" fill="none" stroke={art[0]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M13 34v8M9 38h8M85 31v8M81 35h8" stroke={colors.conditionArtwork.purple[0]} strokeWidth="3" strokeLinecap="round" />
            </>}
        </Svg>
    </View>;
}
