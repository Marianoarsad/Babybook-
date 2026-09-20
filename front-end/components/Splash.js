import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, StyleSheet, Animated, Easing, Platform, AccessibilityInfo } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { space, motion } from "../theme";
import PulseLoader from "./ui/PulseLoader";

// The React splash fallback, shown on web until fonts, assets, preferences,
// the saved session and the first-run check have all resolved. Native keeps
// expo-splash-screen visible through the same readiness gate. Replaces AppLoadingScreen.js (deleted)
// and Landing.js (deleted). Landing.js was a marketing web page — hero, feature
// grid, repeated CTAs — that repeated Onboarding.js's four cards immediately
// after showing them, on a screen every relaunch had to pass through. A phone
// app opens on its brand, not on a pitch.
//
// TWO THINGS HERE ARE LOAD-BEARING. Do not "tidy" either one.
//
// 1. FLAT colors.background, never the page gradient. That token is #F2F5F7
//    light / #12151A dark, which are the exact values app.json gives the NATIVE
//    splash (expo-splash-screen). The native splash is what a phone shows first;
//    this screen takes over from it, and matching the light/dark ground exactly
//    is what makes the handoff invisible. A gradient here would flash on launch.
//    The logo is 200px wide for the same reason — app.json says imageWidth: 200,
//    so the mark must not jump size at the swap.
//
// 2. NO type.* text styles, and no @expo/vector-icons. Both pull in fonts that
//    are still loading while this screen is up — Archivo and PublicSans via
//    type.*, the icon fonts via Ionicons. This screen is what the app shows
//    WHILE it waits for them, so it draws with system-font weights and an
//    <Image>, and nothing it renders can reflow when the real fonts land.
//    (AppLoadingScreen had the same constraint and solved it with a 📖 emoji;
//    the real brand mark is used here instead.)
//
// 3. THE LOGO NEVER MOVES AND NEVER ANIMATES. It is already on screen, drawn by
//    Android from app.json, before any of this code runs — this screen is a
//    CONTINUATION of that splash, not an entrance. So the logo is the only
//    element that takes part in centring (the wordmark and tagline are absolutely
//    positioned beneath it, and therefore cannot push it up), and it has no fade
//    or scale of its own. Putting the logo back inside a centred stack with the
//    text, or re-adding an entrance animation to it, is exactly what made the
//    launch look like two separate screens.
//
// It also states nothing it cannot know. The old loading screen counted a
// percentage from 0 to 96 that was, by its own comment, "simulated" — it tracked
// nothing. The pulsing brand mark says "working" without inventing a number.

// Must match app.json's splash "imageWidth", or the mark changes size at the
// handoff. Measured against a real device screenshot, not assumed — see the
// plan's verification notes.
const LOGO_SIZE = 200;

// Held for at least this long even when everything is ready sooner.
//
// Web gets the longer hold because a browser has NO system splash — this screen
// is the only brand moment there, and without a floor it is a flicker. On a
// phone the system splash has already been up for a second or more, so piling
// another 1100ms on top of it just makes the app feel slow to open.
const MIN_VISIBLE_MS = 1100;

export default function Splash({ appReady = false, onFinished }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    // Reduce Motion is a system accessibility setting; when it is on, this
    // screen shows its final state and skips the entrance animation entirely.
    const [reduceMotion, setReduceMotion] = useState(false);
    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled?.()
            .then((on) => active && setReduceMotion(!!on))
            .catch(() => {});
        const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (on) =>
            active && setReduceMotion(!!on),
        );
        return () => {
            active = false;
            sub?.remove?.();
        };
    }, []);

    // Everything below animates opacity or transform only, so the native driver
    // stays on. It is off on web, where RN Web has no native driver for these.
    const useNative = Platform.OS !== "web";
    const enter = useRef(new Animated.Value(0)).current; // 0 -> 1, TEXT only (never the logo)
    const exit = useRef(new Animated.Value(1)).current; // 1 -> 0, whole screen

    useEffect(() => {
        if (reduceMotion) {
            enter.setValue(1);
            return undefined;
        }
        Animated.timing(enter, {
            toValue: 1,
            duration: motion.entrance.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: useNative,
        }).start();
        return undefined;
    }, [enter, reduceMotion, useNative]);

    // Timing lives here rather than in App.js, so the only thing App has to ask
    // is "are you finished?".
    const mountedAt = useRef(Date.now()).current;
    const finishedRef = useRef(false);

    const finish = useCallback(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        Animated.timing(exit, {
            toValue: 0,
            duration: reduceMotion ? 0 : motion.standard.duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: useNative,
        }).start(() => onFinished && onFinished());
    }, [exit, onFinished, reduceMotion, useNative]);

    useEffect(() => {
        if (!appReady) return undefined;
        const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt));
        const t = setTimeout(finish, remaining);
        return () => clearTimeout(t);
    }, [appReady, finish, mountedAt]);

    // Applied to the wordmark/tagline block and the dots — never to the logo.
    const textStyle = {
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
    };

    return (
        <Animated.View style={[styles.root, { opacity: exit }]}>
            {/* The ONLY child in normal flow, so it lands dead centre — exactly
                where Android put it a moment ago. No animation: see rule 3. */}
            <Image
                source={require("../assets/splash-icon.png")}
                style={styles.logo}
                resizeMode="contain"
                accessible
                accessibilityRole="image"
                accessibilityLabel="BabyBook+"
            />

            {/* Absolute, so text can never shift the logo above centre. */}
            <Animated.View style={[styles.textBlock, textStyle]}>
                <Text style={styles.tagline}>Your child's health, all in one place</Text>
            </Animated.View>

            <Animated.View style={[styles.loaderWrap, textStyle]}>
                <PulseLoader size={38} accessibilityLabel="Loading BabyBook+" />
            </Animated.View>
        </Animated.View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            // Flat, and matching app.json's splash backgroundColor exactly.
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
            padding: space.xl,
        },
        // Matches app.json's imageWidth, so the mark does not resize when the
        // system splash hands over.
        logo: { width: LOGO_SIZE, height: LOGO_SIZE },
        // Anchored to the middle of the screen and pushed down past the logo,
        // rather than stacked under it — a stack would drag the logo upward and
        // the mark would visibly jump at the handoff.
        textBlock: {
            position: "absolute",
            top: "50%",
            marginTop: LOGO_SIZE / 2 + space.md,
            left: 0,
            right: 0,
            alignItems: "center",
            paddingHorizontal: space.xl,
        },
        tagline: {
            fontSize: 15,
            fontWeight: "500",
            color: colors.textSecondary,
            textAlign: "center",
            maxWidth: 280,
        },
        loaderWrap: {
            position: "absolute",
            bottom: space.xxl * 2,
        },
    });
