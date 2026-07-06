import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionContainerCard } from "../common/Cards";
import { useTheme } from "../../context/ThemeContext";
import { space, radius } from "../../theme";

const FAQS = [
    {
        q: "How do I share my child's records with a doctor?",
        a: "Go to the header QR icon on Dashboard, generate a consultation code, and have the healthcare professional scan it. Access is temporary and view-only.",
    },
    {
        q: "Can I use BabyBook+ without an internet connection?",
        a: "You need a connection to sync records with your account, but the app is lightweight and works well on mobile data.",
    },
    {
        q: "Is my child's data private?",
        a: "Yes. Sensitive fields are encrypted, and access is controlled entirely by you as the parent/guardian. See Privacy Settings for more.",
    },
    {
        q: "How do I change my baby's profile info?",
        a: "Open the side menu → Edit Profile for your own account, or use the pencil icon on the Dashboard baby card to edit your child's profile.",
    },
];

export default function HelpSupport() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <ScrollView style={styles.container}>
            <SectionContainerCard title="Frequently Asked Questions">
                {FAQS.map((item, idx) => (
                    <View key={idx} style={idx < FAQS.length - 1 ? styles.faqItem : undefined}>
                        <Text style={styles.faqQ}>{item.q}</Text>
                        <Text style={styles.faqA}>{item.a}</Text>
                    </View>
                ))}
            </SectionContainerCard>

            <SectionContainerCard title="Contact Support" subtitle="We usually respond within 1-2 business days">
                <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => Linking.openURL("mailto:support@babybookplus.app")}
                    accessibilityRole="button"
                >
                    <Ionicons name="mail-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} />
                    <Text style={styles.contactText}>support@babybookplus.app</Text>
                </TouchableOpacity>
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: space.lg },
        faqItem: { marginBottom: space.md, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.hairline },
        faqQ: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 4 },
        faqA: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
        contactRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            borderCurve: "continuous",
        },
        contactText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    });
