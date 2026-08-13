import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { radius, space, shadow, MIN_TOUCH } from "../theme";
import PercentileChart from "./PercentileChart";
import { SkeletonBlock } from "./ui/Skeleton";

// Weight/height/head-circumference chart for the Dashboard's growth section.
// Takes the child's raw growth_records rows — the same rows Dashboard.js already
// fetches to compute the faster/slower verdict — so this costs no extra request.
//
// The plotting itself lives in PercentileChart, which draws the child's line
// against the WHO reference bands. This file is just the card, the metric
// switcher, and the empty state. Two consequences of that move, both wanted:
// the small dashboard chart now carries the same meaning as the full one in
// Growth > Metrics, and its x axis is finally proportional to age rather than
// to the number of measurements.
const METRICS = [
    { key: "weight", label: "Weight", field: "weight" },
    { key: "height", label: "Height", field: "height" },
    { key: "head", label: "Head", field: "head_circumference" },
];

export default function GrowthChart({ rows, sex, dateOfBirth, loading = false }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [metric, setMetric] = useState("weight");

    const active = METRICS.find((m) => m.key === metric);

    const count = useMemo(
        () =>
            (rows || []).filter(
                (r) => r.date_recorded && r[active.field] != null && r[active.field] !== ""
            ).length,
        [rows, active.field]
    );

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>Growth Chart</Text>
                <View style={styles.tabs}>
                    {METRICS.map((m) => (
                        <TouchableOpacity
                            key={m.key}
                            onPress={() => setMetric(m.key)}
                            style={[styles.tab, metric === m.key && styles.tabActive]}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: metric === m.key }}
                            accessibilityLabel={`Show ${m.label} chart`}
                        >
                            <Text style={[styles.tabText, metric === m.key && styles.tabTextActive]}>
                                {m.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? (
                <View style={styles.emptyState}>
                    <SkeletonBlock width="100%" height={110} radius={radius.md} />
                </View>
            ) : count === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        No {active.label.toLowerCase()} measurements recorded yet.
                    </Text>
                </View>
            ) : (
                <PercentileChart
                    indicator={metric}
                    sex={sex}
                    dateOfBirth={dateOfBirth}
                    rows={rows}
                    compact
                />
            )}
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.hairline,
            padding: space.md,
            marginBottom: space.lg,
            ...shadow.card,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: space.sm,
        },
        title: { fontSize: 18, fontWeight: "800", color: colors.text },
        tabs: {
            flexDirection: "row",
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            padding: space.xs,
        },
        tab: {
            minHeight: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: space.sm,
            paddingVertical: space.sm,
            borderRadius: radius.pill,
            borderCurve: "continuous",
        },
        tabActive: { backgroundColor: colors.accentStrong },
        tabText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
        tabTextActive: { color: colors.onAccent },
        emptyState: { paddingVertical: space.lg, alignItems: "center" },
        emptyText: { fontSize: 13, fontWeight: "600", color: colors.textMuted, textAlign: "center" },
    });
