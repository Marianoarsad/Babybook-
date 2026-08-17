import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useScreenPadBottom, useScreenPadTop } from "../../utils/responsive";
import { space, radius, type } from "../../theme";

const LANGUAGES = [
    { key: "en", label: "English", flag: "🇺🇸" },
    { key: "fil", label: "Filipino", flag: "🇵🇭" },
    { key: "tag", label: "Taglish", flag: "🇵🇭" },
];

export default function LanguagePreferences() {
    const { language, setLanguage, t } = useLanguage();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            keyboardShouldPersistTaps="handled"
        >
            <SectionContainerCard title={t("settingsLanguageLabel")} subtitle={t("settingsLanguageHelp")}>
                <View style={styles.langGrid}>
                    {LANGUAGES.map((l) => {
                        const on = language === l.key;
                        return (
                            <TouchableOpacity
                                key={l.key}
                                style={[styles.langCard, on && styles.langCardActive]}
                                onPress={() => setLanguage(l.key)}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on }}
                            >
                                <Text style={styles.langFlag}>{l.flag}</Text>
                                <Text style={[styles.langLabel, on && styles.langLabelActive]}>{l.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        // transparent, not colors.background: App.js paints the page gradient.

        container: { flex: 1, backgroundColor: "transparent" },
        // Padding on the content so the bottom clearance scrolls with it.
        content: { padding: space.lg },
        langGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
        langCard: {
            flexBasis: "31%",
            flexGrow: 1,
            paddingVertical: space.lg,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: "center",
        },
        langCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        // Emoji glyph size — the type scale bundles fontFamily+weight+lineHeight,
        // none of which apply to an emoji, so a bespoke literal is correct here.
        langFlag: { fontSize: 34, marginBottom: space.xs },
        langLabel: { ...type.label, color: colors.textMuted },
        langLabelActive: { color: colors.primaryDark },
    });
