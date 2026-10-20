import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Keyboard, Platform, StyleSheet, View, findNodeHandle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { databaseLoaderColors } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { getApiActivitySnapshot } from "../../utils/api";

const SPINNER_SIZE = 112;

export default function DatabaseLoadingOverlay({ previousFocus }) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const label = t("databaseLoading");
    const ref = useRef(null);
    const pinkRotation = useRef(new Animated.Value(0)).current;
    const blueRotation = useRef(new Animated.Value(0)).current;
    const [reduceMotion, setReduceMotion] = useState(true);
    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled().then((value) => active && setReduceMotion(value)).catch(() => {});
        const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
        return () => { active = false; subscription.remove(); };
    }, []);
    useEffect(() => {
        pinkRotation.setValue(0);
        blueRotation.setValue(0);
        if (reduceMotion) return undefined;
        const loops = [[pinkRotation, 1200], [blueRotation, 1000]].map(([value, duration]) => Animated.loop(
            Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: Platform.OS !== "web", isInteraction: false }),
        ));
        loops.forEach((loop) => loop.start());
        return () => loops.forEach((loop) => loop.stop());
    }, [reduceMotion, pinkRotation, blueRotation]);
    useEffect(() => {
        Keyboard.dismiss();
        const previous = Platform.OS === "web" && typeof document !== "undefined" ? previousFocus?.current || document.activeElement : null;
        const frame = requestAnimationFrame(() => {
            if (Platform.OS === "web") ref.current?.focus?.();
            else {
                const handle = findNodeHandle(ref.current);
                if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
            }
            AccessibilityInfo.announceForAccessibility?.(label);
        });
        return () => {
            cancelAnimationFrame(frame);
            if (previous) requestAnimationFrame(() => {
                if (!getApiActivitySnapshot() && previous.isConnected) previous.focus?.();
            });
        };
    }, [label, previousFocus]);
    return <View ref={ref} accessible focusable accessibilityRole="progressbar" accessibilityLabel={label}
        accessibilityState={{ busy: true }} accessibilityViewIsModal onAccessibilityEscape={() => {}}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        {...(Platform.OS === "web" ? {
            onWheel: (event) => { event.preventDefault(); event.stopPropagation(); },
            onKeyDown: (event) => { if (!event.ctrlKey && !event.metaKey) { event.preventDefault(); event.stopPropagation(); } },
        } : {})}
        style={[StyleSheet.absoluteFill, { zIndex: 10000, backgroundColor: colors.text + "2F", alignItems: "center", justifyContent: "center" },
            Platform.OS === "web" && { touchAction: "none" }]}>
        <View pointerEvents="none" accessible={false} style={{ width: SPINNER_SIZE, height: SPINNER_SIZE }}>
            {[[43, databaseLoaderColors.girl, pinkRotation, "360deg"],
                [28, databaseLoaderColors.boy, blueRotation, "-360deg"]].map(([r, color, rotation, end]) =>
                <Animated.View key={r} style={[StyleSheet.absoluteFill, { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", end] }) }] }]}>
                    <Svg width={SPINNER_SIZE} height={SPINNER_SIZE} viewBox="0 0 96 96" accessible={false}>
                        <Circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={7.8} strokeLinecap="round"
                            strokeDasharray={`${r * Math.PI * 1.5} ${r * Math.PI * 0.5}`} />
                    </Svg>
                </Animated.View>)}
        </View>
    </View>;
}
