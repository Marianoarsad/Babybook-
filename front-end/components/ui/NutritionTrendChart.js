import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { space, type } from "../../theme";
import { evenDateSlots, evenYearSlots, weekdayAbbreviation } from "../../utils/dates";
import { wholeNumberLabel } from "../../utils/whoGrowth";

const averageLabel = (value) => value < 10 ? value.toFixed(1) : String(Math.round(value));
const Y_TICK_COUNT = 7;

function roundedBarPath(x, y, width, baseline) {
    const radius = Math.min(width / 2, 8, (baseline - y) / 2);
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
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [width, setWidth] = useState(0);
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

    if (loading && !points.length) return null;
    if (!points.length) return <Text style={styles.empty}>{emptyMessage}</Text>;

    const averageText = `${averageLabel(Number(average) || 0)} ${unit}`;
    const chartKind = lineMode ? "line chart" : "bar chart";
    const gradientId = `nutrition-${String(title || "trend").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return (
        <View>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.averageHeader}>
                <View
                    accessible
                    accessibilityLabel={`${title} ${chartKind}, average ${averageText} per ${granularity || "period"}`}
                    style={styles.averageCopy}
                >
                    <Text selectable style={styles.average}>{averageText}</Text>
                    <Text style={styles.averageCaption}>Average per {granularity || "period"}</Text>
                </View>
                {headerControl}
            </View>
            <View
                accessible
                accessibilityLabel={`${title} ${chartKind}`}
                style={{ height: chartHeight }}
                onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            >
                {geometry ? (
                    <Svg width={width} height={chartHeight}>
                        {lineMode ? (
                            <Defs>
                                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                                    <Stop offset="1" stopColor={color} stopOpacity={0.02} />
                                </LinearGradient>
                            </Defs>
                        ) : null}
                        {yAxis.ticks.map((value, index) => (
                            <React.Fragment key={`y-${index}`}>
                                <Line
                                    x1={leftPad}
                                    y1={geometry.yFor(value)}
                                    x2={leftPad + plotW}
                                    y2={geometry.yFor(value)}
                                    stroke={colors.hairline}
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
                                    fill={colors.textMuted}
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
                            fill={colors.textMuted}
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
                                    stroke={color}
                                    strokeWidth={1.5}
                                    strokeDasharray="6 6"
                                    strokeLinecap="round"
                                    opacity={0.72}
                                />
                                {geometry.bars.map((bar, index) => bar.path ? (
                                    <Path
                                        key={bar.point.sort || index}
                                        d={bar.path}
                                        fill={color}
                                        opacity={bar.latest ? 1 : 0.68}
                                    />
                                ) : null)}
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
                                fill={colors.textMuted}
                                textAnchor="middle"
                            >
                                {tick.label}
                            </SvgText>
                        ))}
                    </Svg>
                ) : null}
            </View>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    title: { ...type.bodyStrong, color: colors.text },
    averageHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: space.md,
        marginTop: space.sm,
    },
    averageCopy: { flex: 1, minWidth: 0 },
    average: {
        ...type.title,
        color: colors.text,
        fontSize: 28,
        lineHeight: 34,
        fontVariant: ["tabular-nums"],
    },
    averageCaption: { ...type.body, color: colors.textMuted, marginTop: 2, paddingBottom: space.md },
    empty: { ...type.caption, color: colors.textMuted, lineHeight: 18, paddingVertical: space.lg },
});
