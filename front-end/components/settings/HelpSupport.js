import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionContainerCard } from "../common/Cards";
import { useTheme } from "../../context/ThemeContext";
import { useScreenPadBottom, useScreenPadTop } from "../../utils/responsive";
import { space, radius, type, MIN_TOUCH } from "../../theme";

// Each FAQ gets its own icon + rec* tint, so the tint doubles as a topic
// legend across the screen (share/QR = recMemory, connectivity = recGrowth,
// privacy = recMedication, profile editing = recCheckup).
const FAQS = [
    {
        q: "How do I share my child's records with a doctor?",
        a: "Go to the header QR icon on Dashboard, generate a consultation code, and have the healthcare professional scan it. Access is temporary and view-only.",
        icon: "qr-code-outline",
        tint: "recMemory",
    },
    {
        q: "Can I use BabyBook+ without an internet connection?",
        a: "You need a connection to sync records with your account, but the app is lightweight and works well on mobile data.",
        icon: "cloud-offline-outline",
        tint: "recGrowth",
    },
    {
        q: "Is my child's data private?",
        a: "Yes. Sensitive fields are encrypted, and access is controlled entirely by you as the parent/guardian. See Privacy Settings for more.",
        icon: "lock-closed-outline",
        tint: "recMedication",
    },
    {
        q: "How do I change my baby's profile info?",
        a: "Open the side menu → Edit Profile for your own account, or use the pencil icon on the Dashboard baby card to edit your child's profile.",
        icon: "person-circle-outline",
        tint: "recCheckup",
    },
];

export default function HelpSupport() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const [openIdx, setOpenIdx] = useState(null);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            keyboardShouldPersistTaps="handled"
        >
            <SectionContainerCard title="Frequently Asked Questions">
                {FAQS.map((item, idx) => {
                    const open = openIdx === idx;
                    const tint = colors[item.tint];
                    return (
                        <View key={idx} style={[styles.faqItem, idx === FAQS.length - 1 && { marginBottom: 0 }]}>
                            <TouchableOpacity
                                style={styles.faqHeader}
                                onPress={() => setOpenIdx(open ? null : idx)}
                                accessibilityRole="button"
                                accessibilityState={{ expanded: open }}
                            >
                                <View style={[styles.faqIconWrap, { backgroundColor: tint.bg }]}>
                                    <Ionicons name={item.icon} size={18} color={tint.on} />
                                </View>
                                <Text style={styles.faqQ}>{item.q}</Text>
                                <Ionicons
                                    name={open ? "chevron-up" : "chevron-down"}
                                    size={16}
                                    color={colors.textMuted}
                                />
                            </TouchableOpacity>
                            {open ? <Text style={styles.faqA}>{item.a}</Text> : null}
                        </View>
                    );
                })}
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
        // transparent, not colors.background: App.js paints the page gradient.

        container: { flex: 1, backgroundColor: "transparent" },
        // Padding on the content so the bottom clearance scrolls with it.
        content: { padding: space.lg },
        faqItem: { marginBottom: space.sm, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.hairline },
        faqHeader: { flexDirection: "row", alignItems: "center", minHeight: MIN_TOUCH, paddingVertical: space.xs },
        faqIconWrap: {
            width: 34,
            height: 34,
            borderRadius: radius.sm,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            marginRight: space.sm,
        },
        faqQ: { ...type.bodyStrong, color: colors.text, flex: 1 },
        faqA: { ...type.caption, color: colors.textSecondary, marginTop: space.xs, marginLeft: 34 + space.sm },
        contactRow: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: MIN_TOUCH,
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            borderCurve: "continuous",
        },
        contactText: { ...type.label, color: colors.primary },
    });
