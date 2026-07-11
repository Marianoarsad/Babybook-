import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, Platform } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { space, shadow } from "../theme";

// Rotating status messages (from the Stitch "App Loading Screen").
const MESSAGES = [
    "Preparing your baby's world...",
    "Loading your baby's world...",
    "Synchronizing health data...",
    "Organizing milestones...",
    "Nearly there...",
];

// Full-screen loading state shown while global UI resources (icon fonts, etc.)
// are still loading. Uses NO @expo/vector-icons — those are exactly what it
// waits for — so it relies on an emoji + a View-drawn spinner ring instead.
export default function AppLoadingScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const spin = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;
    const [pct, setPct] = useState(0);
    const [msgIdx, setMsgIdx] = useState(0);

    useEffect(() => {
        Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 1100,
                easing: Easing.linear,
                useNativeDriver: Platform.OS !== "web",
            }),
        ).start();
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
                Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
            ]),
        ).start();

        // Simulated progress + message cycling (real readiness unmounts this screen).
        const pctTimer = setInterval(() => {
            setPct((p) => (p >= 96 ? p : Math.min(96, p + Math.random() * 6)));
        }, 120);
        const msgTimer = setInterval(() => {
            setMsgIdx((i) => Math.min(MESSAGES.length - 1, i + 1));
        }, 1400);
        return () => {
            clearInterval(pctTimer);
            clearInterval(msgTimer);
        };
    }, [spin, pulse]);

    const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1.22] });
    const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });

    return (
        <View style={styles.root}>
            <View style={styles.ringWrap}>
                <Animated.View style={[styles.glow, { transform: [{ scale: glowScale }], opacity: glowOpacity }]} />
                <View style={styles.track} />
                <Animated.View style={[styles.arc, { transform: [{ rotate }] }]} />
                <View style={styles.iconCircle}>
                    <Text style={styles.book}>📖</Text>
                </View>
            </View>

            <Text style={styles.brand}>BabyBook+</Text>
            <Text style={styles.status}>{MESSAGES[msgIdx]}</Text>
            <Text style={styles.percent}>{Math.floor(pct)}%</Text>

            <View style={styles.footer}>
                <Text style={styles.footerText}>🛡️  Secure Pediatric Health Platform</Text>
            </View>
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
            padding: space.xl,
        },
        ringWrap: { width: 160, height: 160, alignItems: "center", justifyContent: "center", marginBottom: space.xl },
        glow: {
            position: "absolute",
            width: 160,
            height: 160,
            borderRadius: 80,
            borderWidth: 1,
            borderColor: colors.primary,
        },
        track: {
            position: "absolute",
            width: 128,
            height: 128,
            borderRadius: 64,
            borderWidth: 4,
            borderColor: colors.border,
        },
        arc: {
            position: "absolute",
            width: 128,
            height: 128,
            borderRadius: 64,
            borderWidth: 4,
            borderColor: "transparent",
            borderTopColor: colors.primary,
        },
        iconCircle: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            ...shadow.raised,
        },
        book: { fontSize: 40, lineHeight: 46 },
        brand: { fontSize: 22, fontWeight: "800", color: colors.primary, letterSpacing: -0.3, marginBottom: 4 },
        status: { fontSize: 14, color: colors.textSecondary, opacity: 0.85, textAlign: "center", maxWidth: 260 },
        percent: { marginTop: space.xl, fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 2 },
        footer: { position: "absolute", bottom: space.xl, left: 0, right: 0, alignItems: "center" },
        footerText: { fontSize: 12, fontWeight: "600", color: colors.textMuted, opacity: 0.7 },
    });
