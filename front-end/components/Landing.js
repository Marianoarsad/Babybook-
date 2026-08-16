import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { radius, space, shadow, type, MIN_TOUCH } from "../theme";
import { useResponsive } from "../utils/responsive";
import Gradient from "./ui/Gradient";

// Hero photo. The Stitch mock uses a stock photo of a parent and baby; drop a
// licensed image into the project and point this at it to match it exactly:
//   const HERO_PHOTO = require("../assets/hero.jpg");
// Until then the frame renders a themed placeholder of the same 4:3 shape, so
// the layout is identical either way.
const HERO_PHOTO = null;

// Muted trust row (Stitch renders these at ~60% opacity).
const TRUST = [
    { icon: "lock-closed", label: "Encrypted Records" },
    { icon: "shield-checkmark", label: "Privacy Compliant" },
    { icon: "cloud-done", label: "Sync Enabled" },
];

// Feature cards. `tint`/`chipTone` mirror Stitch's per-card icon + chip colours.
const FEATURES = [
    {
        icon: "medkit-outline",
        title: "Health Tracking",
        body: "Log vaccinations, medications, and checkups with clinical precision and automatic reminders.",
        tint: "primary",
        chips: [{ label: "Vaccines", tone: "neutral" }, { label: "Checkups", tone: "neutral" }],
    },
    {
        icon: "trending-up-outline",
        title: "Growth Analytics",
        body: "Track height, weight, and development milestones against WHO child-growth standards.",
        tint: "success",
        chips: [{ label: "WHO Standards", tone: "success" }],
    },
    {
        icon: "calendar-outline",
        title: "Smart Calendar",
        body: "Never miss an appointment with intuitive scheduling, reminders, and your own custom events.",
        tint: "neutral",
        chips: [{ label: "Sync", tone: "primary" }],
    },
    {
        icon: "qr-code-outline",
        title: "Share with Your Doctor",
        body: "Generate a temporary QR code so a healthcare professional can view records — read-only, only while you allow it.",
        tint: "primary",
        chips: [{ label: "Consent-based", tone: "neutral" }, { label: "View-only", tone: "primary" }],
    },
];

// Pre-login landing page, matching the Stitch "Landing Page - BabyBook+"
// layout. Renders on the neutral palette (no child selected yet).
export default function Landing({ onGetStarted, onLogin, onProfessional }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    // Sections are full-bleed; their content is capped and centred so wide web
    // viewports mirror the (mobile) Stitch mock instead of stretching.
    const { contentMaxWidth } = useResponsive();
    const inner = { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" };

    const tintBg = {
        primary: colors.softGreen,
        success: colors.successBg,
        neutral: colors.surfaceAlt,
    };
    const tintFg = {
        primary: colors.primary,
        success: colors.success,
        neutral: colors.textSecondary,
    };
    const chipBg = {
        neutral: colors.surfaceAlt,
        success: colors.success,
        primary: colors.primary,
    };
    const chipFg = {
        neutral: colors.textSecondary,
        success: "#FFFFFF",
        primary: "#FFFFFF",
    };

    return (
        <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 0 }} showsVerticalScrollIndicator={false}>
            {/* ---------- Top bar ---------- */}
            <View style={styles.topBarOuter}>
                <View style={[styles.topBarInner, inner]}>
                    <View style={styles.brandRow}>
                        <MaterialCommunityIcons name="baby-face-outline" size={24} color={colors.primary} />
                        <Text style={styles.brandName}>BabyBook+</Text>
                    </View>
                    <TouchableOpacity
                        onPress={onLogin}
                        style={styles.topLoginBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Log in"
                    >
                        <Text style={styles.topLoginText}>Log In</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ---------- Hero ---------- */}
            <Gradient
                colors={[colors.softGreen, colors.background]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.hero}
            >
              <View style={inner}>
                <Text style={styles.h1}>
                    Cherish Every Milestone with{" "}
                    <Text style={styles.h1Accent}>BabyBook+</Text>
                </Text>
                <Text style={styles.heroSub}>
                    The all-in-one companion for your baby's health, growth, and development.
                    Built for parents, loved by families. Clinical precision meets parental warmth.
                </Text>

                <TouchableOpacity
                    onPress={onGetStarted}
                    style={styles.btnPrimary}
                    accessibilityRole="button"
                    accessibilityLabel="Start your journey"
                >
                    <Text style={styles.btnPrimaryText}>Start Your Journey</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onLogin}
                    style={styles.btnOutline}
                    accessibilityRole="button"
                    accessibilityLabel="I already have an account"
                >
                    <Text style={styles.btnOutlineText}>I Already Have an Account</Text>
                </TouchableOpacity>

                {/* Framed hero image + floating growth pill */}
                <View style={styles.heroMediaWrap}>
                    <View style={styles.heroCard}>
                        {HERO_PHOTO ? (
                            <Image source={HERO_PHOTO} style={styles.heroImg} resizeMode="cover" />
                        ) : (
                            <View style={[styles.heroImg, styles.heroPlaceholder]}>
                                <MaterialCommunityIcons
                                    name="baby-face-outline"
                                    size={44}
                                    color={colors.primary}
                                />
                                <Text style={styles.heroPlaceholderText}>
                                    Your baby's story, beautifully kept
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.pill}>
                        <View style={styles.pillIcon}>
                            <Ionicons name="trending-up" size={18} color={colors.success} />
                        </View>
                        <View>
                            <Text style={styles.pillLabel}>Weekly Growth</Text>
                            <Text style={styles.pillValue}>+2.4cm</Text>
                        </View>
                    </View>
                </View>
              </View>
            </Gradient>

            {/* ---------- Trust ---------- */}
            <View style={styles.trustSection}>
              <View style={inner}>
                <Text style={styles.eyebrow}>BUILT FOR FAMILIES</Text>
                <Text style={styles.h2Center}>Designed for Filipino families, ages 0 to 6</Text>
                <View style={styles.trustRow}>
                    {TRUST.map((t) => (
                        <View key={t.label} style={styles.trustItem}>
                            <Ionicons name={t.icon} size={26} color={colors.textSecondary} />
                            <Text style={styles.trustText}>{t.label}</Text>
                        </View>
                    ))}
                </View>
              </View>
            </View>

            {/* ---------- Features ---------- */}
            <View style={styles.featuresSection}>
              <View style={inner}>
                <Text style={styles.h2Left}>Everything you need in one place</Text>
                <Text style={styles.featuresSub}>
                    We've designed our features to reduce the cognitive load of parenting, giving
                    you more time for what matters.
                </Text>

                {FEATURES.map((f) => (
                    <View key={f.title} style={styles.featureCard}>
                        <View style={[styles.featureIcon, { backgroundColor: tintBg[f.tint] }]}>
                            <Ionicons name={f.icon} size={22} color={tintFg[f.tint]} />
                        </View>
                        <Text style={styles.featureTitle}>{f.title}</Text>
                        <Text style={styles.featureBody}>{f.body}</Text>
                        <View style={styles.chipRow}>
                            {f.chips.map((c) => (
                                <View key={c.label} style={[styles.chip, { backgroundColor: chipBg[c.tone] }]}>
                                    <Text style={[styles.chipText, { color: chipFg[c.tone] }]}>{c.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
              </View>
            </View>

            {/* ---------- Final CTA ---------- */}
            <View style={styles.ctaSection}>
                <View style={[styles.ctaCard, inner]}>
                    {/* Decorative wash (Stitch uses blurred circles) */}
                    <View style={styles.ctaBlobTop} />
                    <View style={styles.ctaBlobBottom} />

                    <Text style={styles.ctaTitle}>Join the BabyBook+ family today.</Text>
                    <Text style={styles.ctaSub}>
                        Experience the peace of mind that comes with organized, professional-grade
                        pediatric tracking.
                    </Text>
                    <TouchableOpacity
                        onPress={onGetStarted}
                        style={styles.ctaBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Create your account"
                    >
                        <Text style={styles.ctaBtnText}>Create Your Account</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ---------- Footer ---------- */}
            <View style={styles.footerOuter}>
                <View style={[styles.footerInner, inner]}>
                    <View style={styles.brandRow}>
                        <MaterialCommunityIcons name="baby-face-outline" size={18} color={colors.primary} />
                        <Text style={styles.footerBrand}>BabyBook+</Text>
                    </View>
                    <Text style={styles.copyright}>© 2026 BabyBook+</Text>
                    <Text style={styles.disclaimer}>
                        Medical Disclaimer: BabyBook+ is a record-keeping tool for parents and does
                        not provide medical advice, diagnosis, or treatment. Always consult your
                        pediatrician.
                    </Text>
                    {onProfessional ? (
                        <TouchableOpacity
                            onPress={onProfessional}
                            style={styles.proLink}
                            accessibilityRole="button"
                            accessibilityLabel="Healthcare professional access"
                        >
                            <Text style={styles.proLinkText}>Healthcare Professional Access</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },

        // Top bar (outer is full-bleed so the bar spans the viewport)
        topBarOuter: {
            backgroundColor: colors.surface,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
        },
        topBarInner: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
        brandName: { fontSize: 22, fontWeight: "800", color: colors.primary, letterSpacing: -0.3 },
        topLoginBtn: {
            backgroundColor: colors.primary,
            paddingHorizontal: space.lg,
            height: 40,
            justifyContent: "center",
            borderRadius: radius.sm,
            borderCurve: "continuous",
        },
        topLoginText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },

        // Hero
        hero: { paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: 56 },
        h1: {
            fontSize: 32,
            lineHeight: 40,
            fontWeight: "800",
            color: colors.text,
            letterSpacing: -0.6,
            textAlign: "center",
        },
        h1Accent: { color: colors.primary },
        heroSub: {
            marginTop: space.lg,
            fontSize: 16,
            lineHeight: 24,
            color: colors.textSecondary,
            textAlign: "center",
        },
        btnPrimary: {
            marginTop: space.xl,
            backgroundColor: colors.primary,
            minHeight: MIN_TOUCH + 4,
            borderRadius: radius.sm,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            ...shadow.card,
        },
        btnPrimaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
        btnOutline: {
            marginTop: space.md,
            borderWidth: 1.5,
            borderColor: colors.primary,
            minHeight: MIN_TOUCH + 4,
            borderRadius: radius.sm,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
        },
        btnOutlineText: { color: colors.primary, fontSize: 16, fontWeight: "800" },

        // Hero media (extra padding lets the pill overhang like the mock)
        heroMediaWrap: { marginTop: space.xl + space.sm, paddingBottom: 28, paddingLeft: 10 },
        heroCard: {
            backgroundColor: colors.surface,
            padding: 8,
            borderRadius: radius.md,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            ...shadow.raised,
        },
        heroImg: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.sm },
        heroPlaceholder: {
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.softGreen,
            gap: space.sm,
        },
        heroPlaceholderText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
        pill: {
            position: "absolute",
            bottom: 0,
            left: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            backgroundColor: colors.surface,
            padding: space.md,
            borderRadius: radius.md,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            ...shadow.raised,
        },
        pillIcon: {
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: colors.successBg,
            alignItems: "center",
            justifyContent: "center",
        },
        pillLabel: { ...type.caption, fontWeight: "600", color: colors.textSecondary, letterSpacing: 0.2 },
        pillValue: { fontSize: 18, fontWeight: "800", color: colors.text },

        // Trust
        trustSection: {
            backgroundColor: colors.surface,
            paddingHorizontal: space.lg,
            paddingVertical: space.xxl,
        },
        eyebrow: {
            ...type.caption,
            fontWeight: "700",
            color: colors.primary,
            letterSpacing: 1.6,
            textAlign: "center",
        },
        h2Center: {
            marginTop: space.sm,
            fontSize: 24,
            lineHeight: 32,
            fontWeight: "800",
            color: colors.text,
            textAlign: "center",
        },
        trustRow: {
            marginTop: space.xl,
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            opacity: 0.6,
        },
        trustItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            marginHorizontal: space.md,
            marginBottom: space.lg,
        },
        trustText: { fontSize: 15, fontWeight: "800", color: colors.textSecondary },

        // Features
        featuresSection: {
            backgroundColor: colors.surface,
            paddingHorizontal: space.lg,
            paddingBottom: space.xxl,
        },
        h2Left: { fontSize: 30, lineHeight: 38, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
        featuresSub: {
            marginTop: space.md,
            marginBottom: space.xl,
            fontSize: 16,
            lineHeight: 24,
            color: colors.textSecondary,
        },
        featureCard: {
            backgroundColor: colors.surface,
            padding: space.xl,
            borderRadius: radius.md,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: space.lg,
            ...shadow.card,
        },
        featureIcon: {
            width: 48,
            height: 48,
            borderRadius: radius.sm,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: space.md,
        },
        featureTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: space.sm },
        featureBody: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
        chip: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
        chipText: { ...type.caption, fontWeight: "700" },

        // CTA
        ctaSection: { padding: space.lg, backgroundColor: colors.background },
        ctaCard: {
            backgroundColor: colors.primary,
            borderRadius: 32,
            borderCurve: "continuous",
            padding: space.xxl,
            alignItems: "center",
            overflow: "hidden",
            ...shadow.accent,
        },
        ctaBlobTop: {
            position: "absolute",
            top: -80,
            right: -80,
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: "rgba(255,255,255,0.10)",
        },
        ctaBlobBottom: {
            position: "absolute",
            bottom: -90,
            left: -90,
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: "rgba(255,255,255,0.08)",
        },
        ctaTitle: {
            fontSize: 30,
            lineHeight: 38,
            fontWeight: "800",
            color: "#FFFFFF",
            textAlign: "center",
            letterSpacing: -0.5,
        },
        ctaSub: {
            marginTop: space.lg,
            fontSize: 16,
            lineHeight: 24,
            color: "rgba(255,255,255,0.85)",
            textAlign: "center",
        },
        ctaBtn: {
            marginTop: space.xl,
            backgroundColor: "#FFFFFF",
            paddingHorizontal: space.xl,
            minHeight: MIN_TOUCH + 4,
            justifyContent: "center",
            borderRadius: radius.sm,
            borderCurve: "continuous",
            ...shadow.raised,
        },
        ctaBtnText: { color: colors.primary, fontSize: 16, fontWeight: "800" },

        // Footer (outer is full-bleed so the band spans the viewport)
        footerOuter: {
            backgroundColor: colors.surfaceAlt,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: space.lg,
            paddingVertical: space.xxl,
        },
        footerInner: { alignItems: "center", gap: space.sm },
        footerBrand: { fontSize: 18, fontWeight: "800", color: colors.primary },
        copyright: { fontSize: 14, color: colors.textSecondary },
        disclaimer: {
            ...type.caption,
            lineHeight: 18,
            color: colors.textMuted,
            textAlign: "center",
            maxWidth: 360,
        },
        proLink: { marginTop: space.md, minHeight: MIN_TOUCH, justifyContent: "center" },
        proLinkText: {
            fontSize: 13,
            fontWeight: "700",
            color: colors.textSecondary,
            textDecorationLine: "underline",
        },
    });
