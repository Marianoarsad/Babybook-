import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { useTheme } from "../../context/ThemeContext";
import { space } from "../../theme";

const OPTIONS = [
    { key: "auto", label: "Automatic", swatch: null },
    { key: "girl", label: "Girl Theme", sub: "Always pink", swatch: "#EC4F96" },
    { key: "boy", label: "Boy Theme", sub: "Always blue", swatch: "#2F7BF6" },
];

export default function ThemePreferences({ themeOverride = "auto", onThemeOverrideChange, childGender }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <ScrollView style={styles.container}>
            <SectionContainerCard title="App Appearance" subtitle="How the app's colors are themed">
                {OPTIONS.map((opt) => {
                    const on = (themeOverride || "auto") === opt.key;
                    const sub =
                        opt.key === "auto"
                            ? "Follows the selected baby's gender" +
                              (childGender ? ` (currently ${childGender === "boy" ? "Boy · Blue" : "Girl · Pink"})` : "")
                            : opt.sub;
                    return (
                        <TouchableOpacity
                            key={opt.key}
                            onPress={() => onThemeOverrideChange && onThemeOverrideChange(opt.key)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            style={[styles.option, on && styles.optionActive]}
                        >
                            <View style={[styles.radio, on && styles.radioActive]}>
                                {on ? <View style={styles.radioDot} /> : null}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.optionLabel, on && styles.optionLabelActive]}>{opt.label}</Text>
                                <Text style={styles.optionSub}>{sub}</Text>
                            </View>
                            {opt.swatch ? <View style={[styles.swatch, { backgroundColor: opt.swatch }]} /> : null}
                        </TouchableOpacity>
                    );
                })}
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: space.lg },
        option: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginBottom: 8,
        },
        optionActive: { borderColor: colors.primary, backgroundColor: colors.softGreen },
        radio: {
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: "#D6D3D1",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
        },
        radioActive: { borderColor: colors.primary },
        radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
        optionLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
        optionLabelActive: { color: colors.primary },
        optionSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
        swatch: { width: 22, height: 22, borderRadius: 11 },
    });
