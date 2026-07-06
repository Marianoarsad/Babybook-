import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { useTheme } from "../../context/ThemeContext";
import { space } from "../../theme";

const APP_VERSION = "1.0.0";

export default function AboutApp() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.brandBox}>
                <Text style={styles.brandTitle}>BabyBook+</Text>
                <Text style={styles.brandVersion}>Version {APP_VERSION}</Text>
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
        brandTitle: { fontSize: 22, fontWeight: "800", color: colors.primary },
        brandVersion: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        paragraph: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    });
