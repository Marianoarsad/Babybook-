import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { useTheme } from "../../context/ThemeContext";
import { space, radius, type } from "../../theme";

const APP_VERSION = "1.0.0";

export default function AboutApp() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <ScrollView style={styles.container}>
            {/* Version-plate hero — anchors the app identity + clinical
                credibility claim before the reference sections below. */}
            <View style={styles.brandBox}>
                <Text style={styles.brandTitle}>BabyBook+</Text>
                <Text style={styles.brandVersion}>Version {APP_VERSION}</Text>
                <View style={styles.epiBadge}>
                    <Text style={styles.epiBadgeText}>DOH-aligned EPI schedule</Text>
                </View>
            </View>

            <SectionContainerCard title="About This App">
                <Text style={styles.paragraph}>
                    BabyBook+ is a parent-controlled app for recording a child's health and
                    development from birth through age six, built for families in the
                    Philippines. It helps you track vaccinations, growth, milestones, and
                    nutrition, and lets you securely share records with a healthcare
                    professional through a temporary QR consultation code.
                </Text>
            </SectionContainerCard>

            <SectionContainerCard title="Compliance">
                <Text style={styles.paragraph}>
                    Data handling follows the Philippine Data Privacy Act of 2012 (RA 10173).
                    See Privacy Settings for your consent status and data-retention details.
                </Text>
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: space.lg },
        brandBox: { alignItems: "center", marginVertical: space.lg },
        brandTitle: { ...type.display, color: colors.primary },
        brandVersion: { ...type.caption, color: colors.textMuted, marginTop: 4 },
        epiBadge: {
            backgroundColor: colors.recVaccine.bg,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            paddingVertical: 6,
            paddingHorizontal: space.md,
            marginTop: space.md,
        },
        epiBadgeText: { ...type.label, color: colors.recVaccine.on },
        paragraph: { ...type.body, color: colors.textSecondary },
    });
