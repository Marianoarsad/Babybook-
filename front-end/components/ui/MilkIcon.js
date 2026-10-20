import React, { memo, useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";

export default memo(function MilkIcon({ size = 40, showBackground = true, backgroundShape = "circle" }) {
    const { colors } = useTheme();
    const p = colors.nutritionArtwork;
    const id = "milk-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const fill = name => `url(#${id}-${name})`;
    const gradient = (name, stops, radial = false) => {
        const Component = radial ? RadialGradient : LinearGradient;
        return <Component id={`${id}-${name}`} {...(radial ? { cx: "25%", cy: "18%", r: "85%" } : { x1: "0", y1: "0", x2: "1", y2: "1" })}>
            {stops.map((color, index) => <Stop key={index} offset={index / (stops.length - 1)} stopColor={color} />)}
        </Component>;
    };
    return <View pointerEvents="none" accessible={false} style={{ width: size, height: size, flexShrink: 0 }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" accessible={false}>
            <Defs>
                {gradient("background", p.milkBackground, true)}
                {gradient("white", p.white, true)}{gradient("blue", p.blue, true)}
                {gradient("edge", [p.white[0], p.blue[0], p.blue[2]])}
            </Defs>
            {showBackground && backgroundShape !== "none" ? <>
                {backgroundShape === "rounded-square"
                    ? <Rect x="1" y="1" width="98" height="98" rx="28" fill={fill("background")} />
                    : <Circle cx="50" cy="50" r="49" fill={fill("background")} />}
                <Path d="M12 32 Q18 9 46 7" fill="none" stroke={p.reflection} strokeWidth="2" strokeOpacity="0.85" strokeLinecap="round" />
            </> : null}
            <Ellipse cx="48" cy="88" rx="23" ry="5" fill={p.blueShade} opacity="0.13" />
            <G transform="rotate(16 50 50)">
                <Path d="M35 35 L65 35 L66 42 Q72 47 72 55 L72 79 Q72 88 63 89 L37 89 Q28 88 28 79 L28 55 Q28 47 34 42 Z" fill={fill("edge")} />
                <Path d="M36 36 L64 36 L64 43 Q70 48 70 55 L70 78 Q70 86 62 86 L38 86 Q30 86 30 78 L30 55 Q30 48 36 43 Z" fill={fill("white")} />
                <Path d="M36 53 Q35 47 42 44 L42 39 M35 58 L35 76 Q35 80 39 81" fill="none" stroke={p.reflection} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
                <Path d="M65 54 L65 77 Q65 82 60 82" fill="none" stroke={p.white[2]} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
                <Rect x="31" y="27" width="38" height="13" rx="5" fill={fill("blue")} />
                <Ellipse cx="50" cy="28" rx="19" ry="5" fill={fill("blue")} />
                <Path d="M40 26 L40 23 Q40 18 45 17 L45 12 Q44 7 49 7 Q54 7 54 12 L54 17 Q60 18 60 23 L60 26 Z" fill={fill("blue")} />
                <Path d="M45 21 Q43 19 48 18 L48 12" fill="none" stroke={p.reflection} strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
                <Path d="M35 29 Q43 25 56 27" fill="none" stroke={p.reflection} strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
                <Path d="M48 54 L56 54 M48 63 L53 63 M48 72 L56 72 M48 80 L53 80" fill="none" stroke={fill("blue")} strokeWidth="3.5" strokeLinecap="round" />
            </G>
        </Svg>
    </View>;
});
