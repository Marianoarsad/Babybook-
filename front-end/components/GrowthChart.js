import React, { useState, useMemo, useRef, useEffect, useContext, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurTargetView } from "expo-blur";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import ScrollContext from "../context/ScrollContext";
import { radius, space, shadow, type, MIN_TOUCH } from "../theme";
import PercentileChart from "./PercentileChart";
import AnchoredMenu, { AnchoredMenuItem } from "./ui/AnchoredMenu";
import Gradient from "./ui/Gradient";
import GlassLighting from "./ui/GlassLighting";
import { SkeletonBlock } from "./ui/Skeleton";
import { GrowthBackground, GrowthMetricIcon } from "./ui/GrowthVisuals";
import { ageInDays, unitFor, wholeNumberLabel } from "../utils/whoGrowth";

// Weight/height/head-circumference chart for the Dashboard's growth section.
// Reuses the raw growth_records already fetched by its parent.
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
    // Shared Home/viewer presentation with an anchored metric selector.
    plain = false,
    appearance = "default",
    showMetricDots = true,
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
    const blurTarget = useRef(null);
    const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
    const { scrollY, headerHeight, tabBarHeight } = useContext(ScrollContext);
    const updateMetricAnchor = useCallback(() => {
        metricTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setMetricMenuAnchor(previous => previous?.x === x && previous?.y === y && previous?.width === width && previous?.height === height
                ? previous : { x, y, width, height });
        });
    }, []);
    useEffect(() => {
        if (!metricMenuOpen) return;
        updateMetricAnchor();
        const listener = scrollY.addListener(updateMetricAnchor);
        // Cards above can reflow after a resize without changing this trigger's own size.
        const observer = Platform.OS === "web" && globalThis.ResizeObserver ? new globalThis.ResizeObserver(updateMetricAnchor) : null;
        let node = metricTriggerRef.current;
        while (observer && node?.nodeType === 1) { observer.observe(node); node = node.parentElement; }
        return () => { scrollY.removeListener(listener); observer?.disconnect(); };
    }, [metricMenuOpen, windowWidth, windowHeight, fontScale, headerHeight, tabBarHeight, scrollY, updateMetricAnchor]);

    const active = METRICS.find((m) => m.key === metric);
    const growthTracking = appearance === "growthTracking";
    const material = colors.growthSurface.metric[metric];
    const visibleMeasurements = useMemo(() => (rows || []).filter(row => {
        const date = row.date_recorded ? String(row.date_recorded).slice(0, 10) : null;
        const value = Number(row[active.field]);
        return date && Number.isFinite(value) && value > 0
            && ageInDays(dateOfBirth, date) != null
            && (!dateWindow || (date >= dateWindow.from && date <= dateWindow.to));
    }).sort((a, b) => String(b.date_recorded).slice(0, 10).localeCompare(String(a.date_recorded).slice(0, 10))
        || Number(b.id || 0) - Number(a.id || 0)), [rows, active.field, dateOfBirth, dateWindow]);
    const latest = visibleMeasurements[0];
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

    const metricHeader = (expanded = false, covered = false) => (
        <TouchableOpacity
            ref={expanded ? undefined : metricTriggerRef}
            onPress={expanded ? () => setMetricMenuOpen(false) : openMetricMenu}
            style={[styles.metricSelect, expanded && styles.metricHeader,
                covered && { opacity: 0, pointerEvents: "none" }]}
            aria-hidden={covered || undefined} accessible={!covered}
            importantForAccessibility={covered ? "no-hide-descendants" : "auto"}
            accessibilityRole="button" accessibilityState={{ expanded }}
            accessibilityLabel={t("growthShowChart").replace("{metric}", t(active.labelKey))}
        >
            {!expanded ? <>
                <Gradient colors={colors.growthDropdownGlass.popoverPanel} style={styles.metricFace} pointerEvents="none" />
                <GlassLighting material={colors.growthDropdownGlass} radius={22} />
            </> : null}
            <Text style={styles.metricSelectText}>{t(active.labelKey)}</Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.growthDropdownGlass.accent} />
        </TouchableOpacity>
    );
    const Card = plain ? BlurTargetView : View;

    return (
        <Card ref={plain ? blurTarget : undefined} style={[styles.card, growthTracking && styles.growthCard]}>
            {growthTracking ? <GrowthBackground kind="panel" radius={24} /> : null}
            {plain ? (
                <View style={styles.parentHeader} onLayout={metricMenuOpen ? updateMetricAnchor : undefined}>
                    <View style={styles.headerText}>
                        <Text style={[styles.title, styles.parentTitle]}>{title}</Text>
                        <Text style={styles.subtitle}>{t("growthCurrentMonth")}</Text>
                    </View>
                    <AnchoredMenu visible={metricMenuOpen} anchor={metricMenuAnchor}
                        onClose={() => setMetricMenuOpen(false)} variant="select" appearance="connectedSelect"
                        blurTarget={blurTarget} dimBackdrop={false}
                        trigger={({ covered }) => metricHeader(false, covered)} header={metricHeader(true)}>
                        {METRICS.map(m => <AnchoredMenuItem key={m.key} label={t(m.labelKey)}
                            selected={metric === m.key} variant="connectedSelect"
                            leading={showMetricDots ? <View style={[styles.metricDot, { backgroundColor: colors.growthSurface.metric[m.key].line,
                                boxShadow: colors.growthSurface.metric[m.key].shadow }]}>
                                <Gradient pointerEvents="none" colors={[colors.growthDropdownGlass.reflection, colors.growthSurface.metric[m.key].line]}
                                    style={styles.metricDotLight} />
                            </View> : null}
                            onPress={() => { setMetric(m.key); setMetricMenuOpen(false); }} />)}
                    </AnchoredMenu>
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

            <View style={growthTracking ? [styles.chartPanel, { boxShadow: material.shadow }] : undefined}>
                {growthTracking ? <>
                    <GrowthBackground metric={metric} radius={24} />
                    <View style={styles.chartHeading}>
                        <GrowthMetricIcon metric={metric} size={36} />
                        <Text style={styles.chartTitle}>{t(active.labelKey)}</Text>
                        {!loading && latest ? <Text selectable style={[styles.chartLatest, { color: material.accent }]}>
                            {wholeNumberLabel(Number(latest[active.field]))} {unitFor(metric)}
                        </Text> : null}
                    </View>
                </> : null}
                {loading ? (
                    <View style={styles.emptyState}>
                        <SkeletonBlock width="100%" height={110} radius={radius.md} />
                    </View>
                ) : (growthTracking ? visibleMeasurements.length : count) === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            {emptyMessage || `No ${active.label.toLowerCase()} measurements recorded yet.`}
                        </Text>
                    </View>
                ) : (
                    <>
                        <PercentileChart
                            animateLine={growthTracking}
                            indicator={metric}
                            dateOfBirth={dateOfBirth}
                            rows={rows}
                            compact
                            showReference={false}
                            seriesColor={colors.growthMetric?.[metric] || colors.primary}
                            seriesTheme={growthTracking ? material : undefined}
                            gridColor={growthTracking ? colors.growthSurface.grid : undefined}
                            areaFill={plain || growthTracking}
                            dateWindow={dateWindow}
                            datePreset={plain ? "month" : null}
                            emptyMessage={emptyMessage}
                        />
                    </>
                )}

            </View>

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

        </Card>
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
        growthCard: { borderWidth: 0, borderRadius: 24, boxShadow: colors.growthSurface.panelShadow },
        chartPanel: { padding: space.sm, borderRadius: 24 },
        chartHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.xs, paddingBottom: space.xs },
        chartTitle: { ...type.bodyStrong, color: colors.text, flex: 1, minWidth: 0 },
        chartLatest: { ...type.heading, marginLeft: "auto", flexShrink: 0, fontVariant: ["tabular-nums"] },
        title: { ...type.heading, color: colors.text, textTransform: "capitalize" },
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
            borderRadius: 22,
            borderCurve: "continuous",
            backgroundColor: "transparent",
            boxShadow: colors.growthDropdownGlass.panelShadow,
        },
        metricHeader: { flex: 1, minWidth: 0, borderRadius: 0, boxShadow: "none", borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.growthDropdownGlass.divider },
        metricFace: { ...StyleSheet.absoluteFillObject, borderRadius: 22 },
        metricSelectText: { ...type.label, color: colors.growthDropdownGlass.text, flexShrink: 1 },
        metricDot: { width: 14, height: 14, borderRadius: 7, overflow: "hidden", flexShrink: 0 },
        metricDotLight: { ...StyleSheet.absoluteFillObject, opacity: 0.6, borderRadius: 7 },
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
