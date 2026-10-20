import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import Gradient from "./Gradient";

const SYRINGE = require("../../assets/vaccine/syringe.png");

export default function VaccineIcon({ size = 40, showBackground = true }) {
    const { colors } = useTheme();
    const p = colors.vaccineIcon;
    return <View pointerEvents="none" accessible={false} style={{ width: size, height: size, borderRadius: size / 2,
        alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: showBackground ? p.shadow : undefined }}>
        {showBackground ? <Gradient accessible={false} colors={p.background}
            style={[StyleSheet.absoluteFillObject, { borderRadius: size / 2, boxShadow: `inset 0 2px 2px ${p.highlight}` }]} /> : null}
        <Image source={SYRINGE} resizeMode="contain" accessible={false} style={{ width: size * 0.84, height: size * 0.84 }} />
    </View>;
}
