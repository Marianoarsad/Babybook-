import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, Animated, Easing, Platform, AccessibilityInfo } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { motion } from "../theme";

// Native and web share the blue ground and centered 200dp logo; startup must
// not depend on fonts or animate the mark into place.
const LOGO_SIZE = 200;
const MIN_VISIBLE_MS = 1100;

export default function Splash({ appReady = false, onFinished }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [reduceMotion, setReduceMotion] = useState(false);
    const [logoLoadedAt, setLogoLoadedAt] = useState(null);
    const [logoFailed, setLogoFailed] = useState(false);
    const handleLogoLoad = useCallback(() => setLogoLoadedAt((loadedAt) => loadedAt ?? Date.now()), []);
    const handleLogoError = useCallback(() => setLogoFailed(true), []);

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

    const useNative = Platform.OS !== "web";
    const exit = useRef(new Animated.Value(1)).current;
    const finishedRef = useRef(false);
    useEffect(() => () => exit.stopAnimation(), [exit]);

    const finish = useCallback(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        Animated.timing(exit, {
            toValue: 0,
            duration: reduceMotion ? 0 : motion.standard.duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: useNative,
        }).start(({ finished }) => {
            if (finished) onFinished && onFinished();
        });
    }, [exit, onFinished, reduceMotion, useNative]);

    useEffect(() => {
        if (!appReady || (logoLoadedAt === null && !logoFailed)) return undefined;
        // Count visible logo time, not time spent downloading it.
        const remaining = logoFailed ? 0 : Math.max(0, MIN_VISIBLE_MS - (Date.now() - logoLoadedAt));
        const t = setTimeout(finish, remaining);
        return () => clearTimeout(t);
    }, [appReady, finish, logoLoadedAt, logoFailed]);

    return (
        <Animated.View style={[styles.root, { opacity: exit }]}>
            <Image
                source={require("../assets/splash-icon.png")}
                style={styles.logo}
                resizeMode="contain"
                onLoad={handleLogoLoad}
                onError={handleLogoError}
                accessible
                accessibilityRole="image"
                accessibilityLabel="BabyBook+"
            />
        </Animated.View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.splashBackground,
            alignItems: "center",
            justifyContent: "center",
        },
        // Match the native splash plugin's imageWidth so the logo stays still.
        logo: { width: LOGO_SIZE, height: LOGO_SIZE },
    });
