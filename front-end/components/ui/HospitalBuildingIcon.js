import React, { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";

// Section/empty-state illustration; hospital records always use HospitalStayIcon.
export default function HospitalBuildingIcon({ size = 44, blue = false, empty = false }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const material = empty ? { ...p.all, art: colors.hospitalStayIcon.emptyBuilding } : blue ? p.all : p.headerIcon;
    const id = "hospital-building-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <View accessible={false} pointerEvents="none" style={{ width: size, height: size, flexShrink: 0 }}>
        <Svg aria-hidden width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>{["body", "background"].map(name => <LinearGradient key={name} id={id + name} x1="0" y1="0" x2="1" y2="1">
                {(name === "body" ? material.art : material.surface).map((color, i, array) => <Stop key={i} offset={i / (array.length - 1)} stopColor={color} />)}
            </LinearGradient>)}</Defs>
            {!empty ? <><Circle cx="51" cy="53" r="45" fill={material.art[2]} opacity="0.12" /><Circle cx="50" cy="49" r="45" fill={`url(#${id}background)`} /></> : <>
                <Path d="M8 31q-3-9 4-10 1-10 9-10 8 0 9 9 9-1 9 7 0 5-7 5H10Z M72 26q-2-8 4-9 1-8 8-8 7 0 8 7 7 0 7 7 0 4-6 4H75Z" fill={material.art[0]} opacity="0.4" />
                <Path d="M12 65v7 M8.5 68.5h7 M88 43v7 M84.5 46.5h7" stroke={material.art[0]} strokeWidth="3" strokeLinecap="round" />
            </>}
            <Ellipse cx="51" cy="80" rx="32" ry="4" fill={material.art[2]} opacity="0.15" />
            <Rect x="20" y="45" width="22" height="33" rx="5" fill={`url(#${id}body)`} />
            <Rect x="63" y="43" width="18" height="35" rx="5" fill={`url(#${id}body)`} />
            <Rect x="35" y="28" width="32" height="51" rx="6" fill={material.art[2]} opacity="0.2" transform="translate(2 2)" />
            <Rect x="34" y="26" width="32" height="52" rx="6" fill={`url(#${id}body)`} />
            <Rect x="45" y="64" width="10" height="14" rx="2" fill={material.art[2]} />
            <Path d="M50 32v17 M42 40.5h16" stroke={empty ? colors.hospitalStayIcon.body[1] : p.reflection} strokeWidth="5" strokeLinecap="round" />
            {[[26, 52], [26, 65], [41, 54], [54, 54], [70, 51], [70, 65]].map(([x, y]) => <Rect key={`${x}-${y}`} x={x} y={y} width="5" height="7" rx="1.5" fill={p.reflection} opacity="0.85" />)}
            <Path d="M38 45V33q0-3 3-3 M23 61v-9 M66 46h8" stroke={p.reflection} strokeWidth="1.7" opacity="0.65" fill="none" strokeLinecap="round" />
        </Svg>
    </View>;
}
