import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Animated, StyleSheet, Easing, Platform } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { radius as R, space, shadow } from "../../theme";

// Guarded — a soft gradient sheen looks best but the app must still run if
// expo-linear-gradient isn't installed (falls back to a translucent band).
let LinearGradient = null;
try {
    // eslint-disable-next-line global-require
    LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch (e) {
    LinearGradient = null;
}

// One shared clock so every shimmer block on a screen sweeps in sync and we
// only run a single animation loop regardless of how many placeholders render.
function useShimmerClock() {
    const v = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(v, {
                toValue: 1,
                duration: 1400,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: Platform.OS !== "web",
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [v]);
    return v;
}

// A single shimmering placeholder block. Pass it the shared `clock` value so
// all blocks animate together; if omitted it spins up its own.
export function SkeletonBlock({ width = "100%", height = 12, radius = 6, style, clock }) {
    const { colors } = useTheme();
    const ownClock = useShimmerClock();
    const shimmer = clock || ownClock;

    const [w, setW] = useState(typeof width === "number" ? width : 220);
    const translateX = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [-w, w],
    });

    const base = colors.surfaceAlt || "#EEF1F6";
    const highlight = colors.surface || "#FFFFFF";

    return (
        <View
            onLayout={(e) => {
                const lw = e.nativeEvent.layout.width;
                if (lw && Math.abs(lw - w) > 1) setW(lw);
            }}
            style={[
                { width, height, borderRadius: radius, backgroundColor: base, overflow: "hidden" },
                style,
            ]}
        >
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
                {LinearGradient ? (
                    <LinearGradient
                        colors={["transparent", highlight, "transparent"]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={{ flex: 1 }}
                    />
                ) : (
                    <View style={{ flex: 1, backgroundColor: highlight, opacity: 0.55 }} />
                )}
            </Animated.View>
        </View>
    );
}

// ── Immunizations lazy-load state ───────────────────────────────────────────
// Mirrors the vaccination rows in Health.js (checkbox + two text lines), with a
// gentle opacity fade down the list to suggest "more records loading below".
export function ImmunizationsSkeleton({ count = 4 }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const clock = useShimmerClock();
    return (
        <View accessibilityLabel="Loading immunization records">
            {Array.from({ length: count }).map((_, i) => (
                <View key={i} style={[styles.immunRow, { opacity: 1 - i * 0.18 }]}>
                    <SkeletonBlock clock={clock} width={20} height={20} radius={6} />
                    <View style={styles.immunText}>
                        <SkeletonBlock clock={clock} width={i % 2 ? "52%" : "40%"} height={12} radius={6} />
                        <SkeletonBlock
                            clock={clock}
                            width={i % 2 ? "72%" : "84%"}
                            height={9}
                            radius={6}
                            style={{ marginTop: 7 }}
                        />
                    </View>
                    <SkeletonBlock clock={clock} width={42} height={42} radius={10} />
                </View>
            ))}
        </View>
    );
}

// ── Appointments lazy-load state ────────────────────────────────────────────
// Mirrors ListEntryCard (icon tile + title/subtitle + a small pill), the shape
// used for checkups/appointments in Growth.js.
export function AppointmentsSkeleton({ count = 3 }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const clock = useShimmerClock();
    return (
        <View accessibilityLabel="Loading appointments">
            {Array.from({ length: count }).map((_, i) => (
                <View key={i} style={[styles.apptCard, { opacity: 1 - i * 0.16 }]}>
                    <SkeletonBlock clock={clock} width={40} height={40} radius={R.md} />
                    <View style={styles.apptText}>
                        <SkeletonBlock clock={clock} width={i % 2 ? "58%" : "70%"} height={13} radius={6} />
                        <SkeletonBlock
                            clock={clock}
                            width={i % 2 ? "40%" : "48%"}
                            height={10}
                            radius={6}
                            style={{ marginTop: 8 }}
                        />
                        <SkeletonBlock
                            clock={clock}
                            width={72}
                            height={18}
                            radius={R.pill}
                            style={{ marginTop: 10 }}
                        />
                    </View>
                </View>
            ))}
        </View>
    );
}

// ── Memories lazy-load state ────────────────────────────────────────────────
// Mirrors MemoryVisualCard (full-bleed 180px photo card) with faint caption
// lines pinned to the bottom, echoing the Stitch shimmer aesthetic.
export function MemoriesSkeleton({ count = 2 }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const clock = useShimmerClock();
    return (
        <View accessibilityLabel="Loading memories">
            {Array.from({ length: count }).map((_, i) => (
                <View key={i} style={styles.memoryCard}>
                    <SkeletonBlock clock={clock} width="100%" height="100%" radius={R.lg + 2} />
                    <View style={styles.memoryOverlay}>
                        <SkeletonBlock clock={clock} width={64} height={16} radius={R.pill} />
                        <SkeletonBlock
                            clock={clock}
                            width={i % 2 ? "60%" : "48%"}
                            height={14}
                            radius={6}
                            style={{ marginTop: 8 }}
                        />
                    </View>
                </View>
            ))}
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        immunRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.surfaceAlt,
        },
        immunText: { flex: 1, marginLeft: 12, marginRight: 8 },

        apptCard: {
            padding: space.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: R.lg,
            borderCurve: "continuous",
            flexDirection: "row",
            alignItems: "flex-start",
            marginBottom: space.sm,
        },
        apptText: { flex: 1, marginLeft: space.md },

        memoryCard: {
            borderRadius: R.lg + 2,
            borderCurve: "continuous",
            overflow: "hidden",
            height: 180,
            backgroundColor: colors.surfaceAlt,
            marginBottom: space.md,
            position: "relative",
            ...shadow.soft,
        },
        memoryOverlay: {
            ...StyleSheet.absoluteFillObject,
            padding: space.lg,
            justifyContent: "flex-end",
        },
    });
