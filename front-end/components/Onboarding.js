import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { radius, space, shadow, MIN_TOUCH } from "../theme";
import { useResponsive } from "../utils/responsive";
import Gradient from "./ui/Gradient";
import Button from "./ui/Button";

// Welcome carousel shown once, on the very first launch, between the splash
// (components/Splash.js) and sign-in. Built from the app's genuine
// differentiators rather than generic app-store copy — the auto-generated DOH
// schedule and the doctor QR share are the two things that don't exist in
// comparable apps. See App.js for the once-only gating (utils/firstRun.js).
//
// This is now the ONLY place the app explains itself before sign-in. Landing.js
// used to repeat these same four features immediately afterwards as a
// marketing page; it was deleted, and these cards should not grow into a
// replacement for it.
const CARDS = [
    {
        icon: "book-outline",
        title: "One place for everything",
        body: "Vaccines, checkups, illnesses, growth, and memories — from birth to age six.",
    },
    {
        icon: "shield-checkmark-outline",
        title: "The schedule fills itself in",
        body: "The full DOH immunization schedule appears the moment you add your child, dated from their birthday.",
    },
    {
        icon: "qr-code-outline",
        title: "Share with your doctor in one scan",
        body: "Generate a code that gives a healthcare professional read-only access, only while you allow it.",
    },
    {
        icon: "lock-closed-outline",
        title: "Your records stay yours",
        body: "Encrypted, consent-based, and exportable at any time. Nothing is shared without you.",
    },
];

export default function Onboarding({ onGetStarted, onLogin }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { contentMaxWidth } = useResponsive();
    const cardWidth = Math.min(contentMaxWidth, 480);

    const scrollRef = useRef(null);
    const [index, setIndex] = useState(0);

    // animated:false is deliberate — pagingEnabled applies CSS scroll-snap on
    // web, which fights an animated programmatic scrollTo (it starts, then
    // gets pulled back toward the nearest snap point instead of completing
    // at the target card). An instant jump lands exactly on the card and
    // doesn't fight the browser's own snap behavior; touch/trackpad swipes
    // are unaffected and still animate via native momentum scrolling.
    const goTo = (i) => {
        const clamped = Math.max(0, Math.min(CARDS.length - 1, i));
        scrollRef.current?.scrollTo({ x: clamped * cardWidth, animated: false });
        setIndex(clamped);
    };

    const onMomentumEnd = (e) => {
        const i = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
        setIndex(Math.max(0, Math.min(CARDS.length - 1, i)));
    };

    const isLast = index === CARDS.length - 1;

    return (
        <Gradient
            colors={[colors.softGreen, colors.background]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.root}
        >
            <TouchableOpacity
                onPress={onGetStarted}
                style={styles.skipBtn}
                accessibilityRole="button"
                accessibilityLabel="Skip introduction"
            >
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onMomentumEnd}
                style={{ width: cardWidth, alignSelf: "center" }}
                contentContainerStyle={{ alignItems: "center" }}
            >
                {CARDS.map((card) => (
                    <View key={card.title} style={[styles.card, { width: cardWidth }]}>
                        <View style={styles.iconCircle}>
                            <Ionicons name={card.icon} size={40} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>{card.title}</Text>
                        <Text style={styles.body}>{card.body}</Text>
                    </View>
                ))}
            </ScrollView>

            <View style={[styles.dotsRow, { width: cardWidth, alignSelf: "center" }]}>
                {CARDS.map((card, i) => (
                    <TouchableOpacity
                        key={card.title}
                        onPress={() => goTo(i)}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to slide ${i + 1} of ${CARDS.length}`}
                        hitSlop={8}
                        style={[styles.dot, i === index && styles.dotActive]}
                    />
                ))}
            </View>

            <View style={[styles.ctaWrap, { width: cardWidth, alignSelf: "center" }]}>
                {isLast ? (
                    <>
                        <Button title="Start Your Journey" onPress={onGetStarted} />
                        <Button
                            title="I Already Have an Account"
                            variant="ghost"
                            onPress={onLogin}
                            style={{ marginTop: space.sm }}
                        />
                    </>
                ) : (
                    <Button title="Next" onPress={() => goTo(index + 1)} />
                )}
            </View>
        </Gradient>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: space.xl,
        },
        skipBtn: {
            position: "absolute",
            top: Platform.OS === "web" ? space.xl : space.xxl,
            right: space.lg,
            minHeight: MIN_TOUCH,
            paddingHorizontal: space.md,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
        },
        skipText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
        card: {
            alignItems: "center",
            paddingHorizontal: space.xl,
        },
        iconCircle: {
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: space.xl,
            ...shadow.card,
        },
        title: {
            fontSize: 22,
            fontWeight: "800",
            color: colors.text,
            textAlign: "center",
            marginBottom: space.sm,
        },
        body: {
            fontSize: 15,
            lineHeight: 22,
            color: colors.textSecondary,
            textAlign: "center",
        },
        dotsRow: {
            flexDirection: "row",
            justifyContent: "center",
            gap: space.sm,
            marginTop: space.xl,
        },
        dot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.border,
        },
        dotActive: {
            width: 22,
            backgroundColor: colors.primary,
        },
        ctaWrap: {
            marginTop: space.xxl,
            paddingHorizontal: space.xl,
        },
    });
