import React, { memo, useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";

function HospitalStayArtwork({ size = 40, showBackground = true }) {
    const { colors } = useTheme(), p = colors.hospitalStayIcon;
    const id = "hospital-stay-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const gradient = (name, stops, radial = false) => {
        const Component = radial ? RadialGradient : LinearGradient;
        return <Component id={id + name} {...(radial ? { cx: "25%", cy: "18%", r: "90%" } : { x1: "0", y1: "0", x2: "1", y2: "1" })}>
            {stops.map((color, index) => <Stop key={index} offset={index / (stops.length - 1)} stopColor={color} />)}
        </Component>;
    };
    const fill = name => `url(#${id + name})`;
    return <View pointerEvents="none" accessible={false} style={{ width: size, height: size, flexShrink: 0 }}>
        <Svg aria-hidden width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>{gradient("background", p.background, true)}{gradient("body", p.body)}{gradient("person", p.body, true)}</Defs>
            {showBackground ? <>
                <Circle cx="51" cy="53" r="45" fill={p.shadow} />
                <Circle cx="50" cy="49" r="45" fill={fill("background")} />
                <Path d="M10 43a41 41 0 0 1 55-32" stroke={p.highlight} strokeWidth="2.4" fill="none" opacity="0.75" strokeLinecap="round" />
            </> : null}
            <Ellipse cx="51" cy="74" rx="32" ry="5" fill={p.shadow} />
            <Rect x="20" y="36" width="9" height="39" rx="4.5" fill={p.shade} opacity="0.18" />
            <Rect x="18" y="33" width="9" height="39" rx="4.5" fill={fill("body")} />
            <Circle cx="36" cy="44" r="7.5" fill={fill("person")} />
            <Path d="M46 42h19q12 0 12 12v7H44V46q0-4 2-4Z" fill={p.shade} opacity="0.17" transform="translate(1 2)" />
            <Path d="M46 41h19q12 0 12 12v8H44V45q0-4 2-4Z" fill={fill("person")} />
            <Rect x="25" y="55" width="57" height="10" rx="5" fill={fill("body")} />
            <Rect x="75" y="54" width="8" height="18" rx="4" fill={fill("body")} />
            <Path d="M21 39v21 M48 44h15q7 0 9 5 M30 58h43" stroke={p.highlight} strokeWidth="2" fill="none" opacity="0.68" strokeLinecap="round" />
            <Path d="M32 40q3-3 6-1" stroke={p.highlight} strokeWidth="1.7" fill="none" opacity="0.85" strokeLinecap="round" />
        </Svg>
    </View>;
}

export default memo(HospitalStayArtwork);
