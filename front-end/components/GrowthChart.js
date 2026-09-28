import React, { useState, useMemo, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { radius, space, shadow, type, MIN_TOUCH } from "../theme";
import PercentileChart from "./PercentileChart";
import AnchoredMenu, { AnchoredMenuItem } from "./ui/AnchoredMenu";
import { SkeletonBlock } from "./ui/Skeleton";

// Weight/height/head-circumference chart for the Dashboard's growth section.
// Takes the child's raw growth_records rows — the same rows Dashboard.js already
// fetches to compute the faster/slower verdict — so this costs no extra request.
//
// The plotting itself lives in PercentileChart. This file supplies the card,
// metric switcher, and empty state shared by Home and professional views.
const METRICS = [
    { key: "weight", label: "Weight", labelKey: "growthWeight", field: "weight" },
    { key: "height", label: "Height", labelKey: "growthHeight", field: "height" },
    { key: "head", label: "Head", labelKey: "growthHeadCirc", field: "head_circumference" },
];

export default function GrowthChart({
    rows,
    dateOfBirth,
    loading = false,
    title = "Growth Chart",
    // Parent-facing Home presentation. The professional view keeps the
    // compact tabs by leaving this off.
    plain = false,
    dateWindow = null,
    emptyMessage,
    onViewDetail,
}) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [metric, setMetric] = useState("weight");
    const [metricMenuOpen, setMetricMenuOpen] = useState(false);
    const [metricMenuAnchor, setMetricMenuAnchor] = useState(null);
    const metricTriggerRef = useRef(null);

    const active = METRICS.find((m) => m.key === metric);
    const openMetricMenu = () => {
        metricTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setMetricMenuAnchor({ x, y, width, height });
            setMetricMenuOpen(true);
        });
    };

    const count = useMemo(
        () =>
            (rows || []).filter(
                (r) => r.date_recorded && r[active.field] != null && r[active.field] !== ""
            ).length,
        [rows, active.field]
    );

    return (
        <View style={styles.card}>
            {plain ? (
                <View style={styles.parentHeader}>
                    <View style={styles.headerText}>
                        <Text style={[styles.title, styles.parentTitle]}>{title}</Text>
                        <Text style={styles.subtitle}>{t("growthCurrentMonth")}</Text>
                    </View>
                    <TouchableOpacity
                        ref={metricTriggerRef}
                        onPress={openMetricMenu}
                        style={styles.metricSelect}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: metricMenuOpen }}
                        accessibilityLabel={t("growthShowChart").replace("{metric}", t(active.labelKey))}
                    >
                        <Text style={styles.metricSelectText}>{t(active.labelKey)}</Text>
                        <Ionicons
                            name={metricMenuOpen ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <Text style={styles.title}>{title}</Text>
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
                </>
            )}

            {loading ? (
                <View style={styles.emptyState}>
                    <SkeletonBlock width="100%" height={110} radius={radius.md} />
                </View>
            ) : count === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        {emptyMessage || `No ${active.label.toLowerCase()} measurements recorded yet.`}
                    </Text>
                </View>
            ) : (
                <>
                    <PercentileChart
                        indicator={metric}
                        dateOfBirth={dateOfBirth}
                        rows={rows}
                        compact
                        showReference={false}
                        seriesColor={colors.growthMetric?.[metric] || colors.primary}
                        areaFill={plain}
                        dateWindow={dateWindow}
                        datePreset={plain ? "month" : null}
                        emptyMessage={emptyMessage}
                    />
                </>
            )}

            {onViewDetail ? (
                <TouchableOpacity
                    style={styles.detailButton}
                    onPress={onViewDetail}
                    accessibilityRole="button"
                    accessibilityLabel={t("growthViewDetail")}
                >
                    <Text style={styles.detailButtonText}>{t("growthViewDetail")}</Text>
                    <Ionicons name="arrow-forward" size={17} color={colors.primary} />
                </TouchableOpacity>
            ) : null}

            <AnchoredMenu
                visible={metricMenuOpen}
                anchor={metricMenuAnchor}
                onClose={() => setMetricMenuOpen(false)}
                variant="select"
            >
                {METRICS.map((m) => (
                    <AnchoredMenuItem
                        key={m.key}
                        label={t(m.labelKey)}
                        selected={metric === m.key}
                        variant="select"
                        leading={
                            <View style={[styles.metricDot, { backgroundColor: colors.growthMetric?.[m.key] || colors.primary }]} />
                        }
                        onPress={() => {
                            setMetric(m.key);
                            setMetricMenuOpen(false);
                        }}
                    />
                ))}
            </AnchoredMenu>
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
        parentTitle: { fontFamily: type.bodyStrong.fontFamily, fontWeight: type.bodyStrong.fontWeight },
        parentHeader: {
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: space.md,
            marginBottom: space.sm,
        },
        headerText: { flex: 1, minWidth: 0 },
        subtitle: { ...type.caption, color: colors.textMuted, marginTop: 2 },
        metricSelect: {
            minWidth: 128,
            minHeight: MIN_TOUCH,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.sm,
            paddingHorizontal: space.md,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
        },
        metricSelectText: { ...type.label, color: colors.text },
        metricDot: { width: 8, height: 8, borderRadius: 4, borderCurve: "continuous" },
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
        detailButton: {
            minHeight: MIN_TOUCH,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.xs,
            marginTop: space.md,
            paddingTop: space.sm,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
        },
        detailButtonText: { ...type.label, color: colors.primary },

    });
