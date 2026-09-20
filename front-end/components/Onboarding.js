import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Animated,
    Easing,
    PanResponder,
    AccessibilityInfo,
    Platform,
    ScrollView,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { radius, space, shadow, type, motion, MIN_TOUCH } from "../theme";
import { useResponsive } from "../utils/responsive";
import Gradient from "./ui/Gradient";
import { ART_H, BookCollage, CareCircleArt, QrShareArt } from "./onboarding/OnboardingArt";

// Welcome carousel shown once, on the very first launch, between the splash
// (components/Splash.js) and sign-in. Built from the app's genuine
// differentiators rather than generic app-store copy: the doctor QR share,
// followed by a warm invitation to create an account.
// See App.js for the once-only gating (utils/firstRun.js).
//
// This is now the ONLY place the app explains itself before sign-in. Landing.js
// used to repeat these same features immediately afterwards as a
// marketing page; it was deleted, and these cards should not grow into a
// replacement for it.
//
// MOTION — why this is an Animated track and not a paging ScrollView:
// pagingEnabled applies CSS scroll-snap on web, which fights an animated
// programmatic scrollTo (it starts, then gets pulled back toward the nearest
// snap point). The old code worked around that with scrollTo({ animated:
// false }), i.e. swiping animated but tapping Next teleported. Driving one
// Animated.Value instead removes the scroll container entirely, so there is
// nothing left to fight: every transition — swipe, Next, or a dot tap — runs
// the same spring settle. Swipes come from a PanResponder (core RN; no
// gesture-handler dependency).
//
// THREE VALUES, AND WHY IT ISN'T ONE. `pos` is the source of truth for the
// carousel position and drives everything expressible as transform/opacity —
// track offset, card depth, the background ramp — so it runs on the native
// driver. `posJS` follows the exact same curve but is JS-driven, and exists
// only for the dot width morph: width is a LAYOUT property, and binding a
// native-driven value to a layout style throws "Style property 'width' is not
// supported by native animated module" on iOS and Android. (react-native-web
// ignores useNativeDriver, so that crash would NOT have shown up in the web
// demo — it would have waited for the phone build.) `lastV` is likewise
// JS-driven for the CTA's width morph. Keep any new layout animation on the
// JS pair; keep transforms on `pos`.
const CARDS = [
    {
        art: "book",
        title: "Every record, in one BabyBook",
        body: "Keep vaccines, checkups, growth, and memories organized from birth to age six.",
    },
    {
        art: "qr",
        title: "You choose what your doctor sees",
        body: "Share selected records with a read-only code that expires when you choose.",
    },
    {
        art: "care-circle",
        title: "Ready when it matters",
        body: "Keep their health, growth, and memories together—and share only what a doctor needs, only when you choose.",
    },
];

const N = CARDS.length;
const RING_SIZE = 56;
const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R; // 163.4
// 0x47 ≈ 28% alpha, on the same token the ring's filled arc uses.
const RING_TRACK_ALPHA = "47";

export default function Onboarding({ onGetStarted, onLogin }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { contentMaxWidth } = useResponsive();
    const cardWidth = Math.min(contentMaxWidth, 480);

    const [index, setIndex] = useState(0);
    const [reduceMotion, setReduceMotion] = useState(false);

    // Native-driven: track offset, card depth, background ramp.
    const pos = useRef(new Animated.Value(0)).current;
    // JS-driven mirror of `pos`, for layout properties only (the dot widths).
    const posJS = useRef(new Animated.Value(0)).current;
    // JS-driven: the CTA's width morph is a layout property.
    const lastV = useRef(new Animated.Value(0)).current;

    // Matches the idiom in components/Splash.js — one implementation of this
    // behavior, not two that drift apart.
    useEffect(() => {
        let alive = true;
        AccessibilityInfo.isReduceMotionEnabled?.()
            .then((on) => alive && setReduceMotion(!!on))
            .catch(() => {});
        const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (on) =>
            alive && setReduceMotion(!!on),
        );
        return () => {
            alive = false;
            sub?.remove?.();
        };
    }, []);

    const animateTo = (i) => {
        const duration = reduceMotion ? 0 : motion.carousel.duration;
        const easing = Easing.bezier(...motion.carousel.bezier);
        Animated.parallel([
            Animated.timing(pos, { toValue: i, duration, easing, useNativeDriver: true }),
            Animated.timing(posJS, { toValue: i, duration, easing, useNativeDriver: false }),
            Animated.timing(lastV, {
                toValue: i === N - 1 ? 1 : 0,
                duration,
                easing,
                useNativeDriver: false,
            }),
        ]).start();
    };

    const goTo = (i) => {
        const clamped = Math.max(0, Math.min(N - 1, i));
        setIndex(clamped);
        animateTo(clamped);
    };

    // Horizontal swipe. Committed at a quarter of a card, or on a fast flick.
    const idxRef = useRef(0);
    idxRef.current = index;
    const pan = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_e, g) =>
                Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
            onPanResponderMove: (_e, g) => {
                const raw = idxRef.current - g.dx / cardWidth;
                const clamped = Math.max(-0.25, Math.min(N - 0.75, raw));
                pos.setValue(clamped);
                posJS.setValue(clamped);
            },
            onPanResponderRelease: (_e, g) => {
                const flick = Math.abs(g.vx) > 0.35;
                const moved = Math.abs(g.dx) > cardWidth * 0.25;
                if (flick || moved) goTo(idxRef.current + (g.dx < 0 ? 1 : -1));
                else goTo(idxRef.current);
            },
            onPanResponderTerminate: () => goTo(idxRef.current),
        })
    ).current;

    const isLast = index === N - 1;

    // The violet primary ramp deepening one step per card. Every ramp still
    // ends on `background`, per the theme.js pageGradient rule.
    const bgRamps = [
        [colors.primarySoft, colors.background],
        [colors.pageGradient[0], colors.background],
        [colors.accent + "4D", colors.background],
    ];

    const artFor = (kind) => {
        if (kind === "book") return <BookCollage />;
        if (kind === "qr") return <QrShareArt />;
        return <CareCircleArt />;
    };

    return (
        <View style={styles.root}>
            {/* Background ramp — three cross-faded layers, opacity only. */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {bgRamps.map((ramp, i) => (
                    <Animated.View
                        key={i}
                        style={[
                            StyleSheet.absoluteFill,
                            {
                                opacity:
                                    i === 0
                                        ? 1
                                        : pos.interpolate({
                                              inputRange: [i - 1, i],
                                              outputRange: [0, 1],
                                              extrapolate: "clamp",
                                          }),
                            },
                        ]}
                    >
                        <Gradient
                            colors={ramp}
                            start={{ x: 1, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                ))}
            </View>

            <Pressable
                onPress={onGetStarted}
                pointerEvents={isLast ? "none" : "auto"}
                style={[styles.skipBtn, isLast && styles.skipBtnHidden]}
                accessibilityRole="button"
                accessibilityLabel="Skip introduction and create an account"
                accessibilityElementsHidden={isLast}
                importantForAccessibility={isLast ? "no-hide-descendants" : "auto"}
            >
                <Text style={styles.skipText}>Skip</Text>
            </Pressable>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
            >
                <View style={{ width: cardWidth, overflow: "hidden" }} {...pan.panHandlers}>
                    <Animated.View
                        style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            transform: [
                                {
                                    translateX: pos.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, -cardWidth],
                                    }),
                                },
                            ],
                        }}
                    >
                        {CARDS.map((card, i) => {
                            // The outgoing card recedes to 0.9 / 35% as the
                            // incoming one comes forward.
                            const depth = {
                                inputRange: [i - 1, i, i + 1],
                                outputRange: [0.9, 1, 0.9],
                                extrapolate: "clamp",
                            };
                            return (
                                <Animated.View
                                    key={card.title}
                                    style={[
                                        styles.card,
                                        { width: cardWidth },
                                        {
                                            opacity: pos.interpolate({
                                                inputRange: [i - 1, i, i + 1],
                                                outputRange: [0.35, 1, 0.35],
                                                extrapolate: "clamp",
                                            }),
                                            transform: [{ scale: pos.interpolate(depth) }],
                                        },
                                    ]}
                                    accessibilityElementsHidden={i !== index}
                                    importantForAccessibility={i === index ? "auto" : "no-hide-descendants"}
                                >
                                    <View style={styles.artSlot}>{artFor(card.art)}</View>
                                    <Text style={styles.title}>{card.title}</Text>
                                    <Text style={styles.body}>{card.body}</Text>
                                </Animated.View>
                            );
                        })}
                    </Animated.View>
                </View>

                <View style={[styles.dotsRow, { width: cardWidth }]}>
                    {CARDS.map((card, i) => (
                        <Pressable
                            key={card.title}
                            onPress={() => goTo(i)}
                            accessibilityRole="button"
                            accessibilityLabel={`Go to slide ${i + 1} of ${N}`}
                            hitSlop={10}
                        >
                            <Animated.View
                                style={[
                                    styles.dot,
                                    {
                                        width: posJS.interpolate({
                                            inputRange: [i - 1, i, i + 1],
                                            outputRange: [8, 22, 8],
                                            extrapolate: "clamp",
                                        }),
                                        backgroundColor: i === index ? colors.primary : colors.border,
                                    },
                                ]}
                            />
                        </Pressable>
                    ))}
                </View>

                {/* CTA — a 56pt ring button whose arc reads progress (1/3 … 3/3).
                    On the last card it expands into the full-width primary pill and
                    the ghost account button rises in beneath it. */}
                <View style={[styles.ctaWrap, { width: cardWidth }]}>
                    <Animated.View
                        style={{
                            width: lastV.interpolate({
                                inputRange: [0, 1],
                                outputRange: [RING_SIZE, cardWidth - space.xl * 2],
                            }),
                        }}
                    >
                        <Pressable
                            onPress={() => (isLast ? onGetStarted() : goTo(index + 1))}
                            accessibilityRole="button"
                            accessibilityLabel={isLast ? "Start My BabyBook" : `Next, slide ${index + 2} of ${N}`}
                            style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.94 }]}
                        >
                            <Animated.View
                                style={[
                                    StyleSheet.absoluteFill,
                                    { alignItems: "center", justifyContent: "center", opacity: lastV.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
                                ]}
                                pointerEvents="none"
                            >
                                <ProgressRing index={index} colors={colors} />
                            </Animated.View>
                            <Animated.View style={{ opacity: lastV.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
                                <Ionicons name="arrow-forward" size={22} color={colors.onPrimary} />
                            </Animated.View>
                            <Animated.Text
                                numberOfLines={1}
                                style={[
                                    styles.ctaLabel,
                                    StyleSheet.absoluteFill,
                                    { textAlign: "center", lineHeight: MIN_TOUCH + 4, opacity: lastV },
                                ]}
                                pointerEvents="none"
                            >
                                Start My BabyBook
                            </Animated.Text>
                        </Pressable>
                    </Animated.View>

                    <Animated.View
                        style={{
                            width: "100%",
                            marginTop: space.sm,
                            opacity: lastV,
                            transform: [{ translateY: lastV.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                        }}
                        pointerEvents={isLast ? "auto" : "none"}
                    >
                        <Pressable
                            onPress={onLogin}
                            accessibilityRole="button"
                            accessibilityLabel="I Already Have an Account"
                            accessibilityElementsHidden={!isLast}
                            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.94 }]}
                        >
                            <Text style={styles.ghostLabel}>I Already Have an Account</Text>
                        </Pressable>
                    </Animated.View>
                </View>
            </ScrollView>
        </View>
    );
}

// The arc is the one thing that can't ride the native driver — stroke geometry
// isn't a transform — so it gets its own listener-free interpolation at a
// coarse step: one dash offset per card, set on index change.
function ProgressRing({ index, colors }) {
    const offset = RING_C * (1 - (index + 1) / N);
    return (
        <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
            <Circle
                cx={28}
                cy={28}
                r={RING_R}
                fill="none"
                stroke={colors.onPrimary + RING_TRACK_ALPHA}
                strokeWidth={3}
            />
            <Circle
                cx={28}
                cy={28}
                r={RING_R}
                fill="none"
                stroke={colors.onPrimary}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${RING_C}`}
                strokeDashoffset={offset}
            />
        </Svg>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            alignItems: "center",
            backgroundColor: colors.background,
        },
        scroll: { width: "100%" },
        scrollContent: {
            flexGrow: 1,
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
            zIndex: 2,
        },
        skipText: { ...type.label, color: colors.textSecondary, fontWeight: "700" },
        skipBtnHidden: { opacity: 0 },
        card: {
            alignItems: "center",
            paddingHorizontal: space.xl,
        },
        // Fixed-height slot so the title never shifts between slides.
        artSlot: {
            width: "100%",
            height: ART_H,
            marginBottom: space.xl + space.xs,
            alignItems: "center",
            justifyContent: "center",
        },
        title: {
            ...type.display,
            width: "100%",
            maxWidth: 360,
            minHeight: 68,
            fontSize: 28,
            lineHeight: 34,
            letterSpacing: -0.3,
            color: colors.text,
            textAlign: "center",
            marginBottom: space.xs + 2,
        },
        body: {
            ...type.body,
            width: "100%",
            maxWidth: 360,
            minHeight: 72,
            color: colors.textSecondary,
            textAlign: "center",
        },
        dotsRow: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: space.sm,
            marginTop: space.xl,
        },
        dot: { height: 8, borderRadius: 4 },
        ctaWrap: {
            marginTop: space.xxl,
            paddingHorizontal: space.xl,
            height: 112,
            alignItems: "center",
        },
        ctaBtn: {
            minHeight: MIN_TOUCH + 4,
            height: MIN_TOUCH + 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            overflow: "hidden",
            ...shadow.raised,
        },
        ctaLabel: { ...type.label, color: colors.onPrimary },
        ghostBtn: {
            minHeight: MIN_TOUCH + 4,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "transparent",
        },
        ghostLabel: { ...type.label, color: colors.primary },
    });
