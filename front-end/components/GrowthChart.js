import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import { radius, space, shadow } from "../theme";

// Weight/height/head-circumference line chart for the Dashboard's growth
// section (BabyBook+_Dashboard_Redesign follow-up: "make the home dashboard
// more informative"). Takes the child's raw growth_records rows — the same
// rows Dashboard.js already fetches to compute the faster/slower verdict —
// so this costs no extra network request.
//
// Deliberate simplification, stated openly: this draws the measurements that
// exist. It does not compare against WHO growth-standard percentile curves,
// so it shows that a child is growing but not whether that pace is typical
// for their age. That would need bundled reference tables — a later addition.
const METRICS = [
    { key: "weight", label: "Weight", unit: "kg", field: "weight" },
    { key: "height", label: "Height", unit: "cm", field: "height" },
    { key: "head", label: "Head", unit: "cm", field: "head_circumference" },
];

const CHART_HEIGHT = 160;
const PAD = { top: 14, bottom: 22 };

function monthLabel(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short" });
}

export default function GrowthChart({ rows }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [metric, setMetric] = useState("weight");
    const [width, setWidth] = useState(0);

    const active = METRICS.find((m) => m.key === metric);

    const points = useMemo(() => {
        return (rows || [])
            .filter((r) => r.date_recorded && r[active.field] != null && r[active.field] !== "")
            .map((r) => ({ date: String(r.date_recorded).slice(0, 10), value: Number(r[active.field]) }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [rows, active.field]);

    const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom;

    const chart = useMemo(() => {
        if (points.length < 2 || width <= 0) return null;
        const values = points.map((p) => p.value);
        let min = Math.min(...values);
        let max = Math.max(...values);
        if (min === max) {
            min -= 1;
            max += 1;
        }
        const pad = (max - min) * 0.15;
        min -= pad;
        max += pad;

        const xFor = (i) => (i / (points.length - 1)) * width;
        const yFor = (v) => PAD.top + plotHeight - ((v - min) / (max - min)) * plotHeight;

        const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.value) }));
        const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
        const floorY = (PAD.top + plotHeight).toFixed(1);
        const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${floorY} L 0 ${floorY} Z`;

        return { line, area, coords, minLabel: min.toFixed(1), maxLabel: max.toFixed(1) };
    }, [points, width, plotHeight]);

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
                            accessibilityLabel={`Show ${m.label} chart`}
                        >
                            <Text style={[styles.tabText, metric === m.key && styles.tabTextActive]}>{m.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {points.length < 2 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        {points.length === 0
                            ? `No ${active.label.toLowerCase()} measurements recorded yet.`
                            : `Add one more ${active.label.toLowerCase()} measurement to see a trend line.`}
                    </Text>
                </View>
            ) : (
                <View style={{ position: "relative" }}>
                    <View style={styles.axisLabels}>
                        <Text style={styles.axisText}>
                            {chart ? `${chart.maxLabel} ${active.unit}` : ""}
                        </Text>
                        <Text style={styles.axisText}>
                            {chart ? `${chart.minLabel} ${active.unit}` : ""}
                        </Text>
                    </View>
                    <View style={styles.plotArea} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                        {chart ? (
                            <Svg width={width} height={CHART_HEIGHT}>
                                <Line
                                    x1={0}
                                    y1={PAD.top + plotHeight}
                                    x2={width}
                                    y2={PAD.top + plotHeight}
                                    stroke={colors.hairline}
                                    strokeWidth={1}
                                />
                                <Path d={chart.area} fill={colors.primary} fillOpacity={0.12} />
                                <Path d={chart.line} stroke={colors.primary} strokeWidth={2.5} fill="none" />
                                {chart.coords.map((c, i) => (
                                    <Circle
                                        key={i}
                                        cx={c.x}
                                        cy={c.y}
                                        r={3.5}
                                        fill={colors.surface}
                                        stroke={colors.primary}
                                        strokeWidth={2}
                                    />
                                ))}
                            </Svg>
                        ) : null}
                    </View>
                    <View style={styles.monthRow}>
                        <Text style={styles.monthText}>{monthLabel(points[0].date)}</Text>
                        <Text style={styles.monthText}>{monthLabel(points[points.length - 1].date)}</Text>
                    </View>
                </View>
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
        title: { fontSize: 14, fontWeight: "800", color: colors.text },
        tabs: { flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, borderCurve: "continuous", padding: 3 },
        tab: { paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.pill, borderCurve: "continuous" },
        tabActive: { backgroundColor: colors.accentStrong },
        tabText: { fontSize: 11.5, fontWeight: "700", color: colors.textMuted },
        tabTextActive: { color: colors.onAccent },
        axisLabels: { position: "absolute", top: 0, bottom: 22, justifyContent: "space-between", zIndex: 1 },
        axisText: { fontSize: 10, fontWeight: "600", color: colors.textMuted },
        plotArea: { height: CHART_HEIGHT, marginLeft: 32 },
        monthRow: { flexDirection: "row", justifyContent: "space-between", marginLeft: 32, marginTop: 2 },
        monthText: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
        emptyState: { paddingVertical: space.lg, alignItems: "center" },
        emptyText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted, textAlign: "center" },
    });
