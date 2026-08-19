import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, StyleSheet, Animated, Easing, Platform, AccessibilityInfo } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { space, motion } from "../theme";

// The app's own splash, shown from launch until fonts, the saved session and
// the first-run check have all resolved. Replaces AppLoadingScreen.js (deleted)
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
//    this screen takes over from it, and matching the ground exactly is what
//    makes the handoff invisible. A gradient here would flash on every launch.
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
// It also states nothing it cannot know. The old loading screen counted a
// percentage from 0 to 96 that was, by its own comment, "simulated" — it tracked
// nothing. Three dots say "working" without inventing a number.

// Held for at least this long even when everything is ready sooner. On a warm
// start fonts resolve in well under 100ms, and without a floor the splash is a
// flicker rather than a moment of brand.
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
    const enter = useRef(new Animated.Value(0)).current; // 0 -> 1, logo + wordmark
    const exit = useRef(new Animated.Value(1)).current; // 1 -> 0, whole screen
    const pulse = useRef(new Animated.Value(0)).current; // the waiting dots

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
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: useNative }),
                Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: useNative }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [enter, pulse, reduceMotion, useNative]);

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

    const logoStyle = {
        opacity: enter,
        transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
    };

    return (
        <Animated.View style={[styles.root, { opacity: exit }]}>
            <Animated.View style={[styles.brandBlock, logoStyle]}>
                <Image
                    source={require("../assets/splash-icon.png")}
                    style={styles.logo}
                    resizeMode="contain"
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel="BabyBook+"
                />
                <Text style={styles.wordmark}>BabyBook+</Text>
                {/* The same sentence Auth.js shows on the screen this leads
                    into, rather than a second tagline that would have to be
                    kept in step with it. */}
                <Text style={styles.tagline}>Your child's health, all in one place</Text>
            </Animated.View>

            <View style={styles.dotsRow} accessibilityRole="progressbar" accessibilityLabel="Loading">
                {[0, 1, 2].map((i) => (
                    <Animated.View
                        key={i}
                        style={[
                            styles.dot,
                            reduceMotion
                                ? null
                                : {
                                      opacity: pulse.interpolate({
                                          inputRange: [0, 1],
                                          // Staggered, so they read as a wave
                                          // rather than three lights blinking
                                          // in unison.
                                          outputRange: i === 1 ? [0.35, 1] : [1, 0.35],
                                      }),
                                  },
                        ]}
                    />
                ))}
            </View>
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
        brandBlock: { alignItems: "center" },
        // 200 to match app.json's imageWidth, so the mark does not resize when
        // the native splash hands over.
        logo: { width: 200, height: 200 },
        // Deliberately no fontFamily: the brand fonts are still loading.
        wordmark: {
            fontSize: 28,
            fontWeight: "800",
            letterSpacing: -0.4,
            color: colors.primary,
            marginTop: space.md,
        },
        tagline: {
            fontSize: 15,
            fontWeight: "500",
            color: colors.textSecondary,
            marginTop: space.sm,
            textAlign: "center",
            maxWidth: 280,
        },
        dotsRow: {
            position: "absolute",
            bottom: space.xxl * 2,
            flexDirection: "row",
            gap: space.sm,
        },
        dot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.primary,
            opacity: 0.55,
        },
    });
