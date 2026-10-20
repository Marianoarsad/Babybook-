import React, { memo, useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";

function NutritionArtwork({ size = 40, showBackground = true }) {
    const { colors } = useTheme();
    const p = colors.nutritionArtwork;
    const id = "feeding-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const gradient = (name, stops, radial = false) => {
        const Component = radial ? RadialGradient : LinearGradient;
        return <Component id={id + name} {...(radial ? { cx: "25%", cy: "15%", r: "90%" } : { x1: "0", y1: "0", x2: "1", y2: "1" })}>
            {stops.map((color, index) => <Stop key={index} offset={index / (stops.length - 1)} stopColor={color} />)}
        </Component>;
    };
    const fill = name => "url(#" + id + name + ")";
    return <View pointerEvents="none" accessible={false} style={{ width: size, height: size, flexShrink: 0 }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" accessible={false}>
            <Defs>
                {gradient("bg", p.mint)}
                {gradient("body", p.green, true)}
                {gradient("green", p.green)}
                {gradient("cream", p.cream)}
            </Defs>
            {showBackground ? <>
                <Circle cx="50" cy="50" r="49" fill={fill("bg")} />
                <Path d="M12 34 Q22 8 49 7" fill="none" stroke={p.reflection} strokeWidth="2" strokeOpacity="0.7" strokeLinecap="round" />
            </> : null}
            <G>
                <Ellipse cx="51" cy="82" rx="30" ry="5" fill={p.shade} opacity="0.12" />
                <Path d="M59 52 L75 22 Q80 13 84 18 Q88 22 81 29 L65 55 Z" fill={fill("green")} />
                <Path d="M77 23 Q80 18 82 20" fill="none" stroke={p.reflection} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                <Ellipse cx="48" cy="53" rx="32" ry="15" fill={fill("body")} />
                <Ellipse cx="48" cy="52" rx="26" ry="10" fill={p.green[2]} />
                <Path d="M23 55 Q27 45 37 48 Q43 39 52 45 Q64 42 73 55 Q48 66 23 55 Z" fill={fill("cream")} />
                <Path d="M17 53 Q21 82 48 83 Q75 82 79 53 Q49 69 17 53 Z" fill={fill("body")} />
                <Path d="M19 52 Q46 68 77 52" fill="none" stroke={p.green[0]} strokeWidth="3" strokeLinecap="round" />
                <Path d="M23 59 Q26 72 34 75" fill="none" stroke={p.reflection} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
                <Path d="M68 65 Q64 76 53 79" fill="none" stroke={p.green[2]} strokeWidth="2" opacity="0.35" />
                <Path d="M24 48 Q29 43 36 43" fill="none" stroke={p.reflection} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            </G>
        </Svg>
    </View>;
}

export default memo(function SolidFoodIcon(props) { return <NutritionArtwork {...props} />; });
