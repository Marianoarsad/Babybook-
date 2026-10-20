import React, { useId, useMemo, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { space, type } from "../../theme";
import { evenDateSlots, evenYearSlots, weekdayAbbreviation } from "../../utils/dates";
import { wholeNumberLabel } from "../../utils/whoGrowth";

import { NutritionBackground } from "./NutritionVisuals";
import { useNutritionMotion } from "./NutritionMotion";
import { RollingNumber } from "./RollingNumber";
import useReducedMotion from "./useReducedMotion";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const averageLabel = (value) => value < 10 ? value.toFixed(1) : String(Math.round(value));
const Y_TICK_COUNT = 7;

function roundedBarPath(x, y, width, baseline) {
    const radius = Math.min(width / 2, (baseline - y) / 2);
    return [
        `M ${x.toFixed(1)} ${baseline.toFixed(1)}`,
        `L ${x.toFixed(1)} ${(y + radius).toFixed(1)}`,
        `Q ${x.toFixed(1)} ${y.toFixed(1)} ${(x + radius).toFixed(1)} ${y.toFixed(1)}`,
        `H ${(x + width - radius).toFixed(1)}`,
        `Q ${(x + width).toFixed(1)} ${y.toFixed(1)} ${(x + width).toFixed(1)} ${(y + radius).toFixed(1)}`,
        `L ${(x + width).toFixed(1)} ${baseline.toFixed(1)} Z`,
    ].join(" ");
}

export default function NutritionTrendChart({
    title,
    bars,
    unit,
    color,
    dateWindow,
    datePreset,
    average,
    granularity,
    emptyMessage,
    loading,
    headerControl,
    headerIcon,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [width, setWidth] = useState(0);
    const reducedMotion = useReducedMotion();
    const gradientId = "nutrition-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const material = colors.nutritionSurface;
    const chartHeight = 216;
    const padTop = 28;
    const padBottom = 28;
    const leftPad = 42;
    const rightPad = 24;
    const plotH = chartHeight - padTop - padBottom;
    const plotW = Math.max(0, width - leftPad - rightPad);
    const points = useMemo(
        () => (bars || []).map((bar) => ({ ...bar, value: Number(bar.value) || 0 })),
        [bars],
    );
    const selectedDayCount = useMemo(() => {
        const start = new Date(`${dateWindow.from}T00:00:00`);
        const end = new Date(`${dateWindow.to}T00:00:00`);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return null;
        return Math.round((end - start) / 86400000) + 1;
    }, [dateWindow.from, dateWindow.to]);
    const shortRange = selectedDayCount != null && selectedDayCount <= 7;
    const lineMode = selectedDayCount != null && selectedDayCount > 7;
    const yAxis = useMemo(() => {
        const highest = Math.max(1, Number(average) || 0, ...points.map((point) => point.value));
        const intervals = Y_TICK_COUNT - 1;
        const step = Math.max(1, Math.ceil(highest / intervals));
        return {
            max: step * intervals,
            ticks: Array.from({ length: Y_TICK_COUNT }, (_, index) => step * (intervals - index)),
        };
    }, [average, points]);

    const geometry = useMemo(() => {
        if (!points.length || plotW <= 0) return null;
        const baseline = padTop + plotH;
        const yFor = (value) => padTop + plotH - ((Number(value) || 0) / yAxis.max) * plotH;
        const slotWidth = plotW / points.length;
        const barWidth = Math.max(1.5, Math.min(28, slotWidth * 0.48));
        const latestIndex = points.reduce((found, point, index) => point.value > 0 ? index : found, -1);
        const coords = points.map((point, index) => ({
            point,
            index,
            x: points.length === 1 ? leftPad + plotW / 2 : leftPad + (index / (points.length - 1)) * plotW,
            y: yFor(point.value),
        }));
        const line = coords.map((coord, index) =>
            `${index ? "L" : "M"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`
        ).join(" ");
        const area = coords.length
            ? `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${baseline.toFixed(1)} L ${coords[0].x.toFixed(1)} ${baseline.toFixed(1)} Z`
            : null;
        const dotStep = Math.max(1, Math.ceil((coords.length - 1) / 23));
        return {
            yFor,
            line,
            area,
            dots: coords.filter((coord, index) =>
                index === 0 || index === coords.length - 1 || index === latestIndex || index % dotStep === 0
            ),
            latestIndex,
            bars: points.map((point, index) => {
                const x = leftPad + index * slotWidth + (slotWidth - barWidth) / 2;
                const y = yFor(point.value);
                return {
                    point,
                    path: point.value > 0 ? roundedBarPath(x, y, barWidth, baseline) : null,
                    latest: index === latestIndex,
                    height: baseline - y,
                    x,
                    width: barWidth,
                    centerX: x + barWidth / 2,
                };
            }),
        };
    }, [leftPad, padTop, plotH, plotW, points, yAxis]);

    const xTicks = useMemo(() => {
        if (!points.length) return [];
        const axisX = (index, count) => count === 1
            ? leftPad + plotW / 2
            : leftPad + (index / (count - 1)) * plotW;
        if (shortRange && geometry) {
            return geometry.bars.map((bar) => ({
                label: weekdayAbbreviation(new Date(bar.point.sort)),
                x: bar.centerX,
                width: bar.width,
                fontSize: 13,
            }));
        }
        if (datePreset === "year") {
            const fromYear = Number(dateWindow.from.slice(0, 4));
            const toYear = Number(dateWindow.to.slice(0, 4));
            if (toYear > fromYear) {
                const years = evenYearSlots(fromYear, toYear);
                return years.map((year, index) => ({
                    label: String(year),
                    x: axisX(index, years.length),
                    fontSize: 13,
                }));
            }
            const tickCount = plotW < 240 ? 5 : 7;
            const months = [...new Set(
                evenDateSlots(dateWindow.from, dateWindow.to, tickCount).map((iso) => iso.slice(0, 7))
            )];
            return months.map((month, index) => ({
                label: new Date(`${month}-01T00:00:00`).toLocaleDateString("en-PH", { month: "short" }).slice(0, 3),
                x: axisX(index, months.length),
                fontSize: 11,
            }));
        }
        if (datePreset == null) {
            const tickCount = plotW < 240 ? 5 : 7;
            const slots = [...new Set(evenDateSlots(dateWindow.from, dateWindow.to, tickCount))];
            return slots.map((iso, index) => ({
                label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
                x: axisX(index, slots.length),
                fontSize: 13,
            }));
        }
        const count = Math.min(7, points.length);
        const slots = count === 1 ? [dateWindow.from] : evenDateSlots(dateWindow.from, dateWindow.to, count);
        return slots.map((iso, index) => ({
            label: String(Number(iso.slice(8, 10))),
            x: lineMode
                ? axisX(index, count)
                : count === 1
                ? leftPad + plotW / 2
                : leftPad + plotW / (2 * points.length)
                    + (index / (count - 1)) * (plotW - plotW / points.length),
            fontSize: 13,
        }));
    }, [datePreset, dateWindow.from, dateWindow.to, geometry, leftPad, lineMode, plotW, points.length, shortRange]);

    const label = averageLabel(Number.isFinite(Number(average)) ? Number(average) : 0);
    const heights = useMemo(() => !lineMode && geometry
        ? Object.fromEntries(geometry.bars.map((bar, index) => [bar.point.sort || index, bar.height]))
        : {}, [geometry, lineMode]);
    const dataKey = JSON.stringify([dateWindow.from, dateWindow.to, unit, granularity, label,
        points.map(point => [point.sort, point.value])]);
    const motion = useNutritionMotion({ label, heights, dataKey, width,
        ready: Boolean(geometry) || !points.length, reducedMotion });
    const averageText = `${label} ${unit}`;
    const chartKind = lineMode ? "line chart" : "bar chart";

    return (
        <View style={styles.card}>
            <NutritionBackground />
            <View style={styles.averageHeader}>
                {headerIcon}
                <View style={styles.summary}>
                    <Text style={styles.title}>{title}</Text>
                <View
                    accessible
                    accessibilityLabel={`${title} ${chartKind}, average ${averageText} per ${granularity || "period"}`}
                    style={styles.averageCopy}
                >
                    <RollingNumber motion={motion} unit={unit} style={styles.average}
                        precision={motion.label.includes(".") || motion.fromValue < 10 ? 1 : 0} />
                    <Text style={styles.averageCaption}>Average per {granularity || "period"}</Text>
                </View>
                </View>
                {headerControl}
            </View>
            {loading && !points.length ? <Text style={styles.empty}>Loading…</Text> : !points.length ? <Text style={styles.empty}>{emptyMessage}</Text> : <View
                accessible
                accessibilityLabel={`${title} ${chartKind}`}
                style={{ height: chartHeight }}
                onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            >
                {geometry ? (
                    <Svg width={width} height={chartHeight}>
                        <Defs>
                                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                                    <Stop offset="1" stopColor={color} stopOpacity={0.02} />
                                </LinearGradient>
                            {["bar", "latest"].map(kind => <LinearGradient key={kind} id={gradientId + "-" + kind} x1="0" y1="0" x2="1" y2="1">
                                {(kind === "bar" ? material.bar : material.latestBar).map((shade, index) => <Stop key={index} offset={index} stopColor={shade} />)}
                            </LinearGradient>)}
                        </Defs>
                        {yAxis.ticks.map((value, index) => (
                            <React.Fragment key={`y-${index}`}>
                                <Line
                                    x1={leftPad}
                                    y1={geometry.yFor(value)}
                                    x2={leftPad + plotW}
                                    y2={geometry.yFor(value)}
                                    stroke={material.grid}
                                    strokeWidth={1}
                                    strokeDasharray={lineMode ? "4 4" : undefined}
                                    strokeLinecap={lineMode ? "round" : undefined}
                                />
                                <SvgText
                                    x={2}
                                    y={geometry.yFor(value) + 3.5}
                                    fontSize={12}
                                    fontFamily={type.caption.fontFamily}
                                    fontWeight={type.caption.fontWeight}
                                    fill={material.axis}
                                    textAnchor="start"
                                >
                                    {wholeNumberLabel(value)}
                                </SvgText>
                            </React.Fragment>
                        ))}
                        <SvgText
                            x={2}
                            y={12}
                            fontSize={11}
                            fontFamily={type.caption.fontFamily}
                            fontWeight={type.caption.fontWeight}
                            fill={material.axis}
                            textAnchor="start"
                        >
                            {unit}
                        </SvgText>
                        {!lineMode ? (
                            <>
                                <Line
                                    x1={leftPad}
                                    y1={geometry.yFor(average)}
                                    x2={leftPad + plotW}
                                    y2={geometry.yFor(average)}
                                    stroke={material.histogramAccent}
                                    strokeWidth={1.5}
                                    strokeDasharray="6 6"
                                    strokeLinecap="round"
                                    opacity={0.72}
                                />
                                {geometry.bars.map((bar, index) => {
                                    const key = bar.point.sort || index;
                                    const before = motion.fromHeights[key] || 0;
                                    if (!bar.path && !(motion.animated && before > 0)) return null;
                                    const baseline = padTop + plotH;
                                    const path = roundedBarPath(bar.x, baseline - bar.height, bar.width, baseline);
                                    return <AnimatedPath key={key}
                                        d={motion.pending ? roundedBarPath(bar.x, baseline, bar.width, baseline)
                                            : motion.animated ? motion.bars.interpolate({ inputRange: [0, 1],
                                                outputRange: [roundedBarPath(bar.x, baseline - before, bar.width, baseline), path] }) : path}
                                        fill={`url(#${gradientId}-${bar.latest ? "latest" : "bar"})`} />;
                                })}
                            </>
                        ) : (
                            <>
                                {geometry.area ? <Path d={geometry.area} fill={`url(#${gradientId})`} /> : null}
                                {geometry.line && points.length > 1 ? (
                                    <Path
                                        d={geometry.line}
                                        stroke={color}
                                        strokeWidth={2.5}
                                        strokeLinecap="round"
                                        strokeLinejoin="miter"
                                        fill="none"
                                    />
                                ) : null}
                                {geometry.dots.map((dot) => {
                                    const selected = dot.index === geometry.latestIndex;
                                    return (
                                        <React.Fragment key={dot.point.sort || dot.index}>
                                            {selected ? (
                                                <Circle
                                                    cx={dot.x}
                                                    cy={dot.y}
                                                    r={7}
                                                    fill={colors.surface}
                                                    stroke={color}
                                                    strokeWidth={2}
                                                />
                                            ) : null}
                                            <Circle
                                                cx={dot.x}
                                                cy={dot.y}
                                                r={selected ? 3.5 : 2.5}
                                                fill={colors.surface}
                                                stroke={color}
                                                strokeWidth={1.25}
                                                strokeOpacity={selected ? 1 : 0.62}
                                            />
                                        </React.Fragment>
                                    );
                                })}
                            </>
                        )}
                        {xTicks.map((tick, index) => (
                            <SvgText
                                key={`x-${index}`}
                                x={tick.x}
                                y={chartHeight - 5}
                                fontSize={tick.fontSize}
                                fontFamily={type.caption.fontFamily}
                                fontWeight={type.caption.fontWeight}
                                fill={material.axis}
                                textAnchor="middle"
                            >
                                {tick.label}
                            </SvgText>
                        ))}
                    </Svg>
                ) : null}
            </View>}
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    card: { borderRadius: 24, padding: space.md, boxShadow: colors.nutritionSurface.cardShadow, overflow: "visible" },
    summary: { flexGrow: 1, flexShrink: 1, minWidth: 110 },
    title: { ...type.bodyStrong, color: colors.text, textTransform: "capitalize" },
    averageHeader: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: space.md,
        marginTop: 0,
    },
    averageCopy: { flex: 1, minWidth: 0 },
    average: {
        ...type.title,
        color: colors.text,
        fontSize: 28,
        lineHeight: 34,
        fontVariant: ["tabular-nums"],
    },
    averageCaption: { ...type.body, color: colors.nutritionSurface.axis, marginTop: 2, paddingBottom: space.md },
    empty: { ...type.caption, color: colors.nutritionSurface.axis, lineHeight: 18, paddingVertical: space.lg },
});
