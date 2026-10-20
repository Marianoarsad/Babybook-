import React, { memo, useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import Gradient from "./Gradient";

export default memo(function AllRecordsIcon({ size = 40 }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const id = "all-records-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <View accessible={false} pointerEvents="none" testID="all-records-icon" style={{ width: size, height: size, flexShrink: 0 }}>
        <Gradient colors={p.all.surface} style={{ position: "absolute", inset: 0, borderRadius: size / 2, boxShadow: p.rowShadow }} />
        <Svg accessible={false} aria-hidden width={size} height={size} viewBox="0 0 100 100" style={{ position: "relative" }}>
            <Defs><RadialGradient id={id} cx="28%" cy="20%" r="85%">
                {p.all.art.map((color, i) => <Stop key={i} offset={i / 2} stopColor={color} />)}
            </RadialGradient></Defs>
            <Ellipse cx="52" cy="84" rx="27" ry="5" fill={p.all.art[2]} opacity="0.15" />
            <Circle cx="22" cy="60" r="9" fill={`url(#${id})`} /><Circle cx="78" cy="60" r="9" fill={`url(#${id})`} />
            <Circle cx="51" cy="55" r="31" fill={`url(#${id})`} />
            <Path d="M50 28q-10-10-1-18 7-5 10 0-10-1-6 12" fill={p.all.art[1]} />
            <Path d="M28 45q4-12 15-15" fill="none" stroke={p.reflection} strokeWidth="4" strokeLinecap="round" opacity="0.65" />
            <Ellipse cx="34" cy="67" rx="7" ry="4" fill={p.reflection} opacity="0.4" /><Ellipse cx="68" cy="67" rx="7" ry="4" fill={p.reflection} opacity="0.4" />
            {[39, 63].map(cx => <React.Fragment key={cx}><Circle cx={cx} cy="55" r="4.5" fill={p.text} /><Circle cx={cx - 1} cy="53.5" r="1.4" fill={p.reflection} /></React.Fragment>)}
            <Path d="M43 69q8 10 16 0" fill="none" stroke={p.text} strokeWidth="3" strokeLinecap="round" />
        </Svg>
    </View>;
});
