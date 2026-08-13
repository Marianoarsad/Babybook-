import React, { useMemo } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { SectionContainerCard, RadioRow } from "../common/Cards";
import { useTheme } from "../../context/ThemeContext";
import { space, PALETTES, paletteFor } from "../../theme";

const OPTIONS = [
    { key: "auto", label: "Automatic" },
    { key: "girl", label: "Girl Theme", sub: "Always pink" },
    { key: "boy", label: "Boy Theme", sub: "Always blue" },
];

// 3 small dots per option, read live from theme.js's PALETTES export, so the
// swatches are never at risk of drifting from the real palette values.
function PaletteDots({ palette }) {
    return (
        <View style={{ flexDirection: "row", gap: 4 }}>
            {[palette.primary, palette.accent, palette.primarySoft].map((c, i) => (
                <View
                    key={i}
                    style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: palette.hairline, backgroundColor: c }}
                />
            ))}
        </View>
    );
}

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
                    const palette =
                        opt.key === "girl" ? PALETTES.girl : opt.key === "boy" ? PALETTES.boy : paletteFor(childGender);
                    return (
                        <RadioRow
                            key={opt.key}
                            label={opt.label}
                            sublabel={sub}
                            selected={on}
                            onPress={() => onThemeOverrideChange && onThemeOverrideChange(opt.key)}
                            trailing={<PaletteDots palette={palette} />}
                        />
                    );
                })}
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: space.lg },
    });
