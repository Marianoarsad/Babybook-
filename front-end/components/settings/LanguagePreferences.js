import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { space } from "../../theme";

const LANGUAGES = [
    { key: "en", label: "English" },
    { key: "fil", label: "Filipino" },
    { key: "tag", label: "Taglish" },
];

export default function LanguagePreferences() {
    const { language, setLanguage, t } = useLanguage();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <ScrollView style={styles.container}>
            <SectionContainerCard title={t("settingsLanguageLabel")} subtitle={t("settingsLanguageHelp")}>
                <View style={styles.langRow}>
                    {LANGUAGES.map((l) => (
                        <TouchableOpacity
                            key={l.key}
                            style={[styles.langBtn, language === l.key && styles.langBtnActive]}
                            onPress={() => setLanguage(l.key)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: language === l.key }}
                        >
                            <Text style={[styles.langBtnText, language === l.key && styles.langBtnTextActive]}>
                                {l.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: space.lg },
        langRow: { flexDirection: "row", gap: 8 },
        langBtn: {
            flex: 1,
            height: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.surface,
        },
        langBtnActive: { borderColor: colors.primary, backgroundColor: colors.tintGreen },
        langBtnText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
        langBtnTextActive: { color: colors.primary, fontWeight: "800" },
    });
