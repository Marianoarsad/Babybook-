import React, { memo } from "react";
import { Image, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import Gradient from "./Gradient";

export const GROWTH_ICON_SOURCE = require("../../assets/growth/height.png");

export default memo(function GrowthIcon({ size = 40, showBackground = true, accessibilityLabel }) {
    const { colors } = useTheme();
    const material = colors.growthIcon;
    return <View pointerEvents="none" accessible={!!accessibilityLabel} accessibilityRole={accessibilityLabel ? "image" : undefined}
        accessibilityLabel={accessibilityLabel} style={{ width: size, height: size, flexShrink: 0 }}>
        {showBackground ? <Gradient pointerEvents="none" colors={material.background}
            style={{ position: "absolute", inset: 0, borderRadius: size / 2, boxShadow: material.shadow }} /> : null}
        <Image source={GROWTH_ICON_SOURCE} resizeMode="contain" accessible={false} fadeDuration={0}
            style={{ width: size, height: size, transform: [{ scale: showBackground ? 0.74 : 1 }] }} />
    </View>;
});
