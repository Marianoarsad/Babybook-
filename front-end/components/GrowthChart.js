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
import { ageLabel } from "../utils/dates";

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
    // `lower` completes "N of 100 boys this age ___". One verb per measure,
    // because "weigh less" is simply wrong for the other two.
    { key: "weight", label: "Weight", field: "weight", lower: "weigh less" },
    { key: "height", label: "Height", field: "height", lower: "are shorter" },
    { key: "head", label: "Head", field: "head_circumference", lower: "measure less around the head" },
];

// A percentile said the way it is defined, with no statistics vocabulary.
//
// "22nd percentile" is the single least understandable thing this card used to
// show: read as a score out of 100 it lands as a poor grade, which is not what
// it means. This states the same fact concretely.
//
// IT IS A POSITION, NOT A VERDICT (PRODUCT.md Principle 5). It says where the
// measurement sits among children of the same age and stops there. Never
// reword it into "good", "healthy", "behind", "on track" or "catching up", and
// never colour it.
//
// The bounds come from formatPercentile's own: below 1 and above 99 it stops
// giving a number, and "0 of 100" / "100 of 100" would both be false.
function plainPercentile(percentile, sexKey, verb) {
    if (percentile == null) return null;
    const who = `100 ${sexKey === "girls" ? "girls" : "boys"} this age`;
    if (percentile < 1) return `fewer than 1 of ${who} ${verb}`;
    if (percentile > 99) return `more than 99 of ${who} ${verb}`;
    return `${Math.round(percentile)} of ${who} ${verb}`;
}

export default function GrowthChart({
    rows,
    sex,
    dateOfBirth,
    loading = false,
    // The child's first name, for the chart legend.
    name,
    // Parent-facing wording. OFF by default, and that default is load-bearing:
    // this component is also the healthcare professional's growth chart
    // (ProfessionalView.js), where the ordinal percentile is the shorthand
    // they read fluently and both reference bands carry meaning. Without this
    // gate, simplifying the parent's card would quietly reword a clinical
    // screen.
    plain = false,
}) {
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
        const percentile = percentileFromZ(z);
        return {
            value: latest.value,
            percentile,
            age: ageLabel(latest.day),
            plainPct: plainPercentile(percentile, sexKey, active.lower),
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
                        name={name}
                        simple={plain}
                    />
                    {/* The reading. Positional, never diagnostic — describeZ()
                        says where the point sits and leaves the judgment to a
                        health worker (PRODUCT.md, "Never imply clinical
                        authority"). No "talk to your doctor" prompt here; that
                        stays on Growth > Metrics rather than being repeated as
                        a second, louder alarm on the home screen. */}
                    {reading ? (
                        <View style={styles.reading}>
                            {plain ? (
                                <>
                                    {/* The plain sentence LEADS now. It was
                                        always the one line on this card a
                                        reader could act on, and it used to sit
                                        underneath the percentile in smaller
                                        muted type. */}
                                    <Text style={styles.readingLead}>{reading.text}</Text>
                                    <Text style={styles.readingMeta}>
                                        {reading.value} {unitFor(metric)}
                                        {reading.age ? ` at ${reading.age}` : ""}
                                        {reading.plainPct ? ` \u00b7 ${reading.plainPct}` : ""}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <View style={styles.readingTop}>
                                        <Text style={styles.readingValue}>
                                            {reading.value} {unitFor(metric)}
                                        </Text>
                                        <Text style={styles.readingPct}>
                                            {formatPercentile(reading.percentile)} percentile
                                        </Text>
                                    </View>
                                    <Text style={styles.readingText}>{reading.text}</Text>
                                </>
                            )}
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
        // The lead carries the emphasis the percentile used to have.
        readingLead: { ...type.bodyStrong, color: colors.text },
        readingMeta: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
        readingValue: { ...type.bodyStrong, color: colors.text },
        readingPct: { ...type.label, color: colors.primary },
        readingText: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
    });
