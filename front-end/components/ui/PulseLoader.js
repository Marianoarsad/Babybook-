import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { useDatabaseLoading } from "../../context/DatabaseLoadingContext";

// A compact open book derived from the BabyBook+ mark. The simplified page
// geometry remains legible inside buttons where the full wordmark would not.
export default function PulseLoader({ size = 22, color, accessibilityLabel }) {
    const { colors } = useTheme();
    const { busy } = useDatabaseLoading();
    const beat = useRef(new Animated.Value(0)).current;
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

    useEffect(() => {
        if (reduceMotion || busy) {
            beat.setValue(1);
            return undefined;
        }
        const useNativeDriver = Platform.OS !== "web";
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(beat, {
                    toValue: 1,
                    duration: 360,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver,
                }),
                Animated.timing(beat, {
                    toValue: 0,
                    duration: 520,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [beat, reduceMotion, busy]);

    if (busy) return null;

    return (
        <Animated.View
            accessible={!!accessibilityLabel}
            accessibilityRole={accessibilityLabel ? "progressbar" : undefined}
            accessibilityLabel={accessibilityLabel}
            style={{
                width: size,
                height: size,
                opacity: reduceMotion ? 1 : beat.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                transform: [
                    {
                        scale: reduceMotion
                            ? 1
                            : beat.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] }),
                    },
                ],
            }}
        >
            <Svg width="100%" height="100%" viewBox="0 0 64 64">
                <Path
                    d="M6 16h16c5 0 8 2 10 5v29c-3-4-7-6-12-6H6V16Zm52 0H42c-5 0-8 2-10 5v29c3-4 7-6 12-6h14V16Z"
                    fill="none"
                    stroke={color || colors.primary}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </Svg>
        </Animated.View>
    );
}
