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
// Mirrors MemoryVisualCard's mat-frame treatment (common/Cards.js): a square
// photo block inside a bordered frame, with caption lines below it rather
// than overlaid — the loading→content swap shouldn't visibly jump shape.
export function MemoriesSkeleton({ count = 2 }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const clock = useShimmerClock();
    return (
        <View accessibilityLabel="Loading memories">
            {Array.from({ length: count }).map((_, i) => (
                <View key={i} style={styles.memoryCard}>
                    <View style={styles.memoryFrame}>
                        <SkeletonBlock clock={clock} width="100%" height="100%" radius={R.md} />
                    </View>
                    <View style={styles.memoryCaption}>
                        <SkeletonBlock clock={clock} width={48} height={10} radius={4} />
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

// ── Home Dashboard lazy-load state ──────────────────────────────────────────
// Stands in for the whole first paint while the three Dashboard fetches are in
// flight — not a pixel-perfect double of every card, just enough shape (a
// summary row, the growth chart, the feeding card, a few activity rows) that
// the screen doesn't flash blank or show a stale/empty state before data
// arrives.
export function DashboardSkeleton() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const clock = useShimmerClock();
    return (
        <View accessibilityLabel="Loading dashboard">
            <View style={styles.dashSummary}>
                <SkeletonBlock clock={clock} width={40} height={40} radius={R.pill} />
                <View style={styles.dashSummaryGrid}>
                    {[0, 1, 2, 3].map((i) => (
                        <SkeletonBlock
                            key={i}
                            clock={clock}
                            width={i % 2 ? "60%" : "72%"}
                            height={12}
                            radius={6}
                        />
                    ))}
                </View>
            </View>
            <SkeletonBlock clock={clock} width="100%" height={150} radius={R.xl} style={{ marginBottom: space.lg }} />
            <SkeletonBlock clock={clock} width="100%" height={64} radius={R.lg} style={{ marginBottom: space.lg }} />
            {Array.from({ length: 3 }).map((_, i) => (
                <View key={i} style={[styles.dashActivityRow, { opacity: 1 - i * 0.2 }]}>
                    <SkeletonBlock clock={clock} width={40} height={40} radius={R.md} />
                    <View style={styles.dashActivityText}>
                        <SkeletonBlock clock={clock} width={i % 2 ? "50%" : "62%"} height={12} radius={6} />
                        <SkeletonBlock
                            clock={clock}
                            width={i % 2 ? "70%" : "80%"}
                            height={10}
                            radius={6}
                            style={{ marginTop: 7 }}
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
            borderBottomColor: colors.hairline,
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
            borderRadius: R.lg,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.borderStrong,
            padding: space.sm,
            backgroundColor: colors.surface,
            marginBottom: space.md,
            ...shadow.card,
        },
        memoryFrame: {
            borderRadius: R.md,
            borderCurve: "continuous",
            overflow: "hidden",
            aspectRatio: 1,
            backgroundColor: colors.surfaceAlt,
        },
        memoryCaption: { paddingTop: space.sm, paddingHorizontal: space.xs, paddingBottom: space.xs },

        dashSummary: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            padding: space.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: R.xl,
            borderCurve: "continuous",
            marginBottom: space.lg,
        },
        dashSummaryGrid: {
            flex: 1,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: space.sm,
        },
        dashActivityRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: space.sm,
        },
        dashActivityText: { flex: 1, marginLeft: space.md },
    });
