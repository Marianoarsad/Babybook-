import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { radius, space, shadow, type, MIN_TOUCH } from "../theme";
import PercentileChart from "./PercentileChart";
import { SkeletonBlock } from "./ui/Skeleton";
import {
    WHO_MAX_DAY,
    ageInDays,
    describeZ,
    formatPercentile,
    normalizeSex,
    percentileFromZ,
    unitFor,
    zScore,
} from "../utils/whoGrowth";

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

    // Where the latest measurement of the selected metric sits on the WHO
    // reference. The chart draws the comparison; without this line the parent
    // has to eyeball a point against a grey band and guess. Same computation
    // Growth > Metrics runs (Growth.js) — shared through utils/whoGrowth so the
    // two screens can never describe the same z differently.
    const reading = useMemo(() => {
        const sexKey = normalizeSex(sex);
        if (!sexKey || !dateOfBirth) return null;
        const usable = (rows || [])
            .map((r) => {
                const date = r.date_recorded ? String(r.date_recorded).slice(0, 10) : null;
                const raw = r[active.field];
                if (!date || raw == null || raw === "") return null;
                const value = Number(raw);
                const day = ageInDays(dateOfBirth, date);
                if (!(value > 0) || day == null || day > WHO_MAX_DAY) return null;
                return { day, value };
            })
            .filter(Boolean)
            .sort((a, b) => a.day - b.day);
        const latest = usable[usable.length - 1];
        if (!latest) return null;
        const z = zScore(metric, sexKey, latest.day, latest.value);
        if (z == null) return null;
        return {
            value: latest.value,
            percentile: percentileFromZ(z),
            ...describeZ(z),
        };
    }, [rows, active.field, metric, sex, dateOfBirth]);

    return (
        <View style={styles.card}>
            {/* Title and switcher on separate rows. Side by side, "Growth
                Chart" wrapped to two lines at phone width because the three
                pills took the space it needed. */}
            <Text style={styles.title}>Growth Chart</Text>
            <View style={styles.tabs}>
                {METRICS.map((m) => (
                    <TouchableOpacity
                        key={m.key}
                        onPress={() => setMetric(m.key)}
                        style={[styles.tab, metric === m.key && styles.tabActive]}
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
                <>
                    <PercentileChart
                        indicator={metric}
                        sex={sex}
                        dateOfBirth={dateOfBirth}
                        rows={rows}
                        compact
                    />
                    {/* The reading. Positional, never diagnostic — describeZ()
                        says where the point sits and leaves the judgment to a
                        health worker (PRODUCT.md, "Never imply clinical
                        authority"). No "talk to your doctor" prompt here; that
                        stays on Growth > Metrics rather than being repeated as
                        a second, louder alarm on the home screen. */}
                    {reading ? (
                        <View style={styles.reading}>
                            <View style={styles.readingTop}>
                                <Text style={styles.readingValue}>
                                    {reading.value} {unitFor(metric)}
                                </Text>
                                <Text style={styles.readingPct}>
                                    {formatPercentile(reading.percentile)} percentile
                                </Text>
                            </View>
                            <Text style={styles.readingText}>{reading.text}</Text>
                        </View>
                    ) : null}
                </>
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
            padding: space.lg + 2,
            marginBottom: space.lg,
            ...shadow.card,
        },
        title: { ...type.heading, color: colors.text },
        // Full-width segmented control on its own row: each metric gets an
        // equal third, so the labels never crowd each other or the title.
        tabs: {
            flexDirection: "row",
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            padding: space.xs,
            marginTop: space.md,
            marginBottom: space.sm,
        },
        tab: {
            flex: 1,
            minHeight: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: space.sm,
            borderRadius: radius.pill,
            borderCurve: "continuous",
        },
        tabActive: { backgroundColor: colors.accentStrong },
        tabText: { ...type.label, color: colors.textMuted },
        tabTextActive: { color: colors.onAccent },
        emptyState: { paddingVertical: space.lg, alignItems: "center" },
        emptyText: { ...type.caption, color: colors.textMuted, textAlign: "center" },

        reading: {
            marginTop: space.md,
            paddingTop: space.md,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
        },
        readingTop: {
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: space.sm,
        },
        readingValue: { ...type.bodyStrong, color: colors.text },
        readingPct: { ...type.label, color: colors.primary },
        readingText: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
    });
