import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { space, type } from "../theme";
import { evenDateSlots, evenYearSlots, weekdayAbbreviation } from "../utils/dates";
import {
    WHO_MAX_DAY,
    ageInDays,
    chartAxisTicks,
    integerAxisRange,
    latestPointPerDay,
    measurementAgeDomain,
    normalizeSex,
    referenceCurve,
    signedAgeInDays,
    unitFor,
    wholeNumberLabel,
} from "../utils/whoGrowth";

// A child's measurements drawn against the WHO reference envelope.
//
// The bands are deliberately COLOURLESS — ink at low opacity, never green or
// red. A green "safe" zone and a red "danger" zone would turn a reference
// comparison into a verdict, which this product does not make (PRODUCT.md:
// "Never imply clinical authority"). Colour in this chart belongs to one thing
// only: the child's own line.
//
// The clinician chart keeps a proportional age axis for its WHO comparison.
// Parent trend charts use a proportional recorded-date axis.

const Z_LINES = [-3, -2, 0, 2, 3];
const FIELD = { weight: "weight", height: "height", head: "head_circumference" };

export default function PercentileChart({
    indicator = "weight",
    sex,
    dateOfBirth,
    rows,
    compact = false,
    // The child's first name, for the legend. "This child" is the fallback and
    // is what the healthcare professional's copy still reads.
    name,
    // Parent-facing: draw ONE reference band instead of two. The chart used to
    // put a +/-2 band and a +/-3 band on top of each other at different
    // opacities while the legend named only one of them, so a reader with no
    // statistics background met an unexplained second shape. The clinician's
    // copy keeps both -- see the `plain` gate in GrowthChart.js.
    simple = false,
    // Reference context is opt-in; parent and professional charts now show
    // only the family's recorded measurements.
    showReference = false,
    seriesColor,
    areaFill = false,
    dateWindow = null,
    datePreset = null,
    yearRange = null,
    axisWindow = null,
    pointAlignedShortRange = false,
    emptyMessage,
}) {
    const { colors } = useTheme();
    const { language, t } = useLanguage();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const lineColor = seriesColor || colors.primary;
    const chartFontFamily = areaFill ? type.caption.fontFamily : undefined;
    const [width, setWidth] = useState(0);
    const selectedDayCount = useMemo(() => {
        if (!dateWindow?.from || !dateWindow?.to) return null;
        const start = new Date(`${dateWindow.from}T00:00:00`);
        const end = new Date(`${dateWindow.to}T00:00:00`);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return null;
        return Math.round((end - start) / 86400000) + 1;
    }, [dateWindow]);
    const shortRange = pointAlignedShortRange && selectedDayCount != null && selectedDayCount < 8;
    const multiYearMode = Boolean(
        areaFill
        && datePreset === "year"
        && yearRange
        && Number(yearRange.to) > Number(yearRange.from)
    );
    // Callers pass whatever they hold — "Female", "boy", or an already
    // normalized "girls". Anything unrecognized yields null and the reference
    // bands are simply omitted rather than guessed.
    const sexKey = useMemo(() => normalizeSex(sex), [sex]);

    const chartHeight = areaFill ? (compact ? 220 : 288) : compact ? 184 : 252;
    // 26, not 10: the unit label sits above the topmost y tick, and both are
    // 13px right-aligned to the same edge. At 18 the two glyphs touched --
    // "kg" sat directly on top of "14.4". 26 leaves 18px between the two
    // baselines. chartHeight grew by the same 16, so the plot area is
    // unchanged from the original 136.
    const padTop = 26;
    // Compact used to be 16, which left no room for the x axis and was the
    // reason compact had no time reference at all. A curve without an age axis
    // can't be read: three months of growth and three years look identical.
    const padBottom = 22;
    // Widened from 30/26 to fit the 13px tick labels (DESIGN.md's 13px text
    // floor) without clipping — narrower and "14.5"/"med" started running off
    // the left/right edge of the compact chart.
    const gutter = areaFill ? 44 : compact ? 36 : 38;
    // Keep the latest marker clear of the right edge.
    const rightPad = areaFill ? 24 : compact || simple ? 6 : 30;
    const plotH = chartHeight - padTop - padBottom;
    const plotW = Math.max(0, width - gutter - rightPad);

    const field = FIELD[indicator];
    const unit = unitFor(indicator);
    const indicatorLabel = t(
        indicator === "head" ? "growthHeadCirc" : indicator === "height" ? "growthHeight" : "growthWeight"
    );

    // The child's own measurements, sorted by age before plotting.
    const points = useMemo(() => {
        if (!dateOfBirth) return [];
        return (rows || [])
            .map((r) => {
                const date = r.date_recorded ? String(r.date_recorded).slice(0, 10) : null;
                const raw = r[field];
                if (!date || raw == null || raw === "") return null;
                const value = Number(raw);
                const day = ageInDays(dateOfBirth, date);
                if (!(value > 0) || day == null) return null;
                return { id: r.id, day, value, date };
            })
            .filter((p) => p && (!dateWindow || (p.date >= dateWindow.from && p.date <= dateWindow.to)))
            .sort((a, b) => a.day - b.day || Number(a.id || 0) - Number(b.id || 0));
    }, [rows, field, dateOfBirth, dateWindow]);

    // WHO curves stop at age five, but the family's own measurements do not.
    // Keep plotting every saved value and limit only the reference overlay.
    const inRange = points;
    const chartPoints = useMemo(() => {
        if (multiYearMode) {
            const latestByYear = new Map();
            for (const point of inRange) latestByYear.set(point.date.slice(0, 4), point);
            return [...latestByYear.values()];
        }
        return shortRange ? latestPointPerDay(inRange) : inRange;
    }, [inRange, multiYearMode, shortRange]);
    const beyondRange = showReference ? points.filter((p) => p.day > WHO_MAX_DAY).length : 0;
    // Filters decide which records are visible; real measurements decide the
    // viewport. All-mode callers may share one recorded window so its three
    // metric charts remain directly comparable.
    const plotDateWindow = useMemo(
        () => areaFill
            ? axisWindow || (chartPoints.length
                ? { from: chartPoints[0].date, to: chartPoints[chartPoints.length - 1].date }
                : dateWindow)
            : dateWindow,
        [areaFill, axisWindow, chartPoints, dateWindow],
    );

    // Growth's date-filtered charts fit the visible measurements. Other callers
    // retain the existing history view and its newborn-width floor.
    const domain = useMemo(() => {
        if (multiYearMode) {
            return { from: Number(yearRange.from), to: Number(yearRange.to) };
        }
        if (areaFill && datePreset === "year" && yearRange && chartPoints.length) {
            const fitted = measurementAgeDomain(chartPoints);
            if (fitted) return fitted;
        }
        if (areaFill && plotDateWindow?.from && plotDateWindow?.to) {
            const first = signedAgeInDays(dateOfBirth, plotDateWindow.from);
            const last = signedAgeInDays(dateOfBirth, plotDateWindow.to);
            if (first != null && last != null) {
                return first === last ? { from: first - 1, to: last + 1 } : { from: first, to: last };
            }
        }
        if (yearRange) {
            const first = signedAgeInDays(dateOfBirth, `${yearRange.from}-01-01`);
            const last = signedAgeInDays(dateOfBirth, `${yearRange.to}-12-31`);
            if (first != null && last != null) return { from: first, to: last };
        }
        if (dateWindow) {
            const fitted = measurementAgeDomain(chartPoints);
            if (fitted) return fitted;
            const first = Math.max(0, ageInDays(dateOfBirth, dateWindow.from) || 0);
            const last = Math.max(first, ageInDays(dateOfBirth, dateWindow.to) || first);
            if (first === last) return { from: Math.max(0, first - 1), to: first + 1 };
            return { from: first, to: last };
        }
        const maxDay = chartPoints.length ? chartPoints[chartPoints.length - 1].day : 0;
        const fitted = Math.max(Math.ceil(maxDay * 1.12), 90);
        return { from: 0, to: fitted };
    }, [areaFill, multiYearMode, datePreset, plotDateWindow, yearRange, dateWindow, dateOfBirth, chartPoints]);

    const bands = useMemo(() => {
        if (!showReference || !sexKey || domain.from > WHO_MAX_DAY) return null;
        const curves = {};
        for (const z of Z_LINES) {
            curves[z] = referenceCurve(indicator, sexKey, domain.from, Math.min(domain.to, WHO_MAX_DAY), z);
        }
        if (!curves[0].length) return null;
        return curves;
    }, [indicator, sexKey, showReference, domain]);

    // Y window covers the full reference envelope plus anything the child's own
    // line does outside it, so an outlying measurement is never clipped away.
    const yRange = useMemo(() => {
        const vals = [];
        if (bands) {
            for (const p of bands[-3]) vals.push(p.value);
            for (const p of bands[3]) vals.push(p.value);
        }
        for (const p of chartPoints) vals.push(p.value);
        if (!vals.length) return null;
        let min = Math.min(...vals);
        let max = Math.max(...vals);
        if (min === max) { min -= 1; max += 1; }
        const pad = (max - min) * 0.06;
        const quantum = indicator === "weight" ? 0.1 : 1;
        const range = {
            min: Math.floor((min - pad) / quantum) * quantum,
            max: Math.ceil((max + pad) / quantum) * quantum,
        };
        return areaFill
            ? integerAxisRange(Math.max(0, range.min), range.max, 7)
            : range;
    }, [areaFill, bands, chartPoints, indicator]);

    const yTicks = useMemo(() => {
        if (!yRange) return [];
        const count = areaFill ? 7 : 3;
        return chartAxisTicks(yRange.min, yRange.max, count).reverse();
    }, [areaFill, yRange]);
    const yTickDecimals = useMemo(() => {
        if (!yRange || areaFill) return 0;
        const step = (yRange.max - yRange.min) / Math.max(1, yTicks.length - 1);
        return indicator === "weight" || step < 1 ? 1 : 0;
    }, [areaFill, indicator, yRange, yTicks.length]);

    const geo = useMemo(() => {
        if (!yRange || plotW <= 0) return null;
        const span = Math.max(1, domain.to - domain.from);
        const xFor = (day) => gutter + ((day - domain.from) / span) * plotW;
        const yFor = (v) => padTop + plotH - ((v - yRange.min) / (yRange.max - yRange.min)) * plotH;
        const lineFor = (curve) =>
            curve.map((p, i) => `${i ? "L" : "M"} ${xFor(p.day).toFixed(1)} ${yFor(p.value).toFixed(1)}`).join(" ");
        // Area between two reference curves: out along the top, back along the bottom.
        const areaFor = (upper, lower) => {
            const fwd = upper.map((p, i) => `${i ? "L" : "M"} ${xFor(p.day).toFixed(1)} ${yFor(p.value).toFixed(1)}`).join(" ");
            const back = [...lower].reverse().map((p) => `L ${xFor(p.day).toFixed(1)} ${yFor(p.value).toFixed(1)}`).join(" ");
            return `${fwd} ${back} Z`;
        };
        return { xFor, yFor, lineFor, areaFor };
    }, [yRange, plotW, plotH, domain, gutter, padTop]);

    const childPath = useMemo(() => {
        if (!geo || chartPoints.length < 1) return null;
        const coords = chartPoints.map((p) => ({
            point: p,
            x: geo.xFor(multiYearMode ? Number(p.date.slice(0, 4)) : p.day),
            y: geo.yFor(p.value),
        }));
        const line = coords.map((c, i) => `${i ? "L" : "M"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
        const baseline = padTop + plotH;
        const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${baseline} L ${coords[0].x.toFixed(1)} ${baseline} Z`;
        const maxDots = compact ? 12 : 24;
        const step = Math.max(1, Math.ceil((coords.length - 1) / Math.max(1, maxDots - 1)));
        const dots = coords.filter((_, index) => index === 0 || index === coords.length - 1 || index % step === 0);
        return { line, area, coords: dots, latest: coords[coords.length - 1] };
    }, [chartPoints, compact, geo, multiYearMode, padTop, plotH]);

    const xTicks = useMemo(() => {
        if (areaFill && shortRange && geo) {
            return chartPoints.map((point) => ({
                label: weekdayAbbreviation(point.date),
                x: geo.xFor(point.day),
                fontSize: 13,
            }));
        }
        if (areaFill && datePreset === "year" && yearRange) {
            const fromYear = Number(yearRange.from);
            const toYear = Number(yearRange.to);
            if (toYear > fromYear) {
                return evenYearSlots(fromYear, toYear).map((year) => ({ label: String(year) }));
            }
            const labelWindow = dateWindow || plotDateWindow;
            if (!labelWindow) return [];
            const tickCount = plotW < 240 ? 5 : 7;
            const months = [...new Set(
                evenDateSlots(labelWindow.from, labelWindow.to, tickCount).map((iso) => iso.slice(0, 7))
            )];
            const locale = language === "fil" ? "fil-PH" : "en-PH";
            return months.map((month) => ({
                label: new Date(`${month}-01T00:00:00`).toLocaleDateString(locale, { month: "short" }).slice(0, 3),
                fontSize: 11,
            }));
        }
        if (areaFill && plotDateWindow) {
            const customRange = datePreset == null;
            const labelWindow = customRange && dateWindow ? dateWindow : plotDateWindow;
            // DD/MM needs more room than day numbers. Keep seven slots when
            // they fit; five 40px intervals are the narrow-screen fallback.
            const tickCount = (datePreset === "month" || customRange) && plotW < 240 ? 5 : 7;
            const rawSlots = evenDateSlots(labelWindow.from, labelWindow.to, tickCount);
            const slots = customRange ? [...new Set(rawSlots)] : rawSlots;
            const locale = language === "fil" ? "fil-PH" : "en-PH";
            return slots.map((iso) => ({
                day: signedAgeInDays(dateOfBirth, iso),
                label: datePreset === "year"
                    ? new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { month: "short" }).slice(0, 3)
                    : datePreset === "month" || customRange
                      ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
                      : String(Number(iso.slice(8, 10))),
                fontSize: datePreset === "year" ? 11 : 13,
            }));
        }
        const labelWindow = dateWindow || plotDateWindow;
        if (labelWindow) {
            const slots = evenDateSlots(labelWindow.from, labelWindow.to);
            return slots.map((iso, index) => {
                const first = slots.indexOf(iso);
                const last = slots.lastIndexOf(iso);
                const show = iso === slots[0] ? index === first : iso === slots[slots.length - 1] ? index === last : index === first;
                return {
                    day: ageInDays(dateOfBirth, iso),
                    label: show ? String(Number(iso.slice(8, 10))) : "",
                };
            });
        }
        const months = domain.to / 30.4375;
        const stepMonths = months <= 4 ? 1 : months <= 14 ? 3 : months <= 30 ? 6 : 12;
        const out = [];
        for (let mo = 0; mo * 30.4375 <= domain.to; mo += stepMonths) {
            out.push({
                day: mo * 30.4375,
                label: mo === 0 ? t("growthChartBirth") : mo % 12 === 0 ? `${mo / 12}y` : `${mo}m`,
            });
        }
        return out;
    }, [areaFill, shortRange, geo, chartPoints, yearRange, datePreset, domain, dateWindow, plotDateWindow, dateOfBirth, language, plotW, t]);

    const latestHighlight = areaFill && childPath?.latest ? childPath.latest : null;

    if (!dateOfBirth) {
        return <Text style={[styles.note, areaFill && styles.parentChartText]}>{t(showReference ? "growthMissingDobReference" : "growthMissingDobPlot")}</Text>;
    }
    if (!points.length) {
        return <Text style={[styles.note, areaFill && styles.parentChartText]}>{emptyMessage || t("growthNoMeasurements").replace("{metric}", indicatorLabel.toLowerCase())}</Text>;
    }

    return (
        <View
            accessible
            accessibilityLabel={yearRange ? `${indicatorLabel} growth chart from ${yearRange.from} to ${yearRange.to}` : undefined}
        >
            <View style={{ height: chartHeight }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                {geo ? (
                    <Svg width={width} height={chartHeight}>
                        {areaFill ? (
                            <Defs>
                                <LinearGradient id={`growth-${indicator}`} x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor={lineColor} stopOpacity={0.22} />
                                    <Stop offset="1" stopColor={lineColor} stopOpacity={0.02} />
                                </LinearGradient>
                            </Defs>
                        ) : null}
                        {bands ? (
                            <>
                                {/* Reference envelope, widest first. The outer
                                    one is dropped in simple mode: two nested
                                    greys read as one vague smudge, and only the
                                    inner band was ever named in the legend. */}
                                {!simple ? (
                                    <Path d={geo.areaFor(bands[3], bands[-3])} fill={colors.text} fillOpacity={0.035} />
                                ) : null}
                                <Path d={geo.areaFor(bands[2], bands[-2])} fill={colors.text} fillOpacity={0.05} />
                                {(simple ? [-2, 0, 2] : Z_LINES).map((z) => (
                                    <Path
                                        key={z}
                                        d={geo.lineFor(bands[z])}
                                        stroke={z === 0 ? colors.textMuted : colors.border}
                                        strokeWidth={z === 0 ? 1.5 : 1}
                                        strokeDasharray={z === 0 ? "5 4" : undefined}
                                        strokeOpacity={z === 0 ? 0.6 : 1}
                                        fill="none"
                                    />
                                ))}
                                {!compact && !simple &&
                                    Z_LINES.map((z) => {
                                        const curve = bands[z];
                                        const last = curve[curve.length - 1];
                                        if (!last) return null;
                                        return (
                                            <SvgText
                                                key={`lbl-${z}`}
                                                x={geo.xFor(last.day) + 4}
                                                y={geo.yFor(last.value) + 3.5}
                                                fontSize={13}
                                                fontWeight="700"
                                                fill={colors.textMuted}
                                            >
                                                {z > 0 ? `+${z}` : z === 0 ? "med" : `${z}`}
                                            </SvgText>
                                        );
                                    })}
                            </>
                        ) : null}

                        {/* Horizontal guides keep values easy to trace without visual clutter. */}
                        {(areaFill ? yTicks : [yRange?.min])
                            .filter((v) => v != null)
                            .map((v, i) => (
                                <Line
                                    key={`grid-${i}`}
                                    x1={gutter}
                                    y1={geo.yFor(v)}
                                    x2={gutter + plotW}
                                    y2={geo.yFor(v)}
                                    stroke={colors.hairline}
                                    strokeWidth={1}
                                    strokeDasharray={areaFill ? "4 4" : undefined}
                                    strokeLinecap={areaFill ? "round" : undefined}
                                />
                            ))}

                        {/* The unit, on the axis with the numbers it belongs
                            to. It used to appear only inside the legend phrase
                            "This child (kg)", which is nowhere near the figures
                            a reader is trying to interpret. */}
                        <SvgText
                            x={0}
                            y={11}
                            fontSize={13}
                            fontFamily={chartFontFamily}
                            fontWeight={areaFill ? type.caption.fontWeight : "700"}
                            fill={colors.textMuted}
                            textAnchor="start"
                        >
                            {unit}
                        </SvgText>

                        {/* Y scale */}
                        {yRange
                            ? yTicks.map((v, i) => {
                                  return (
                                  <SvgText
                                      key={`y${i}`}
                                      x={0}
                                      y={geo.yFor(v) + 3.5}
                                      fontSize={13}
                                      fontFamily={chartFontFamily}
                                      fontWeight={areaFill ? type.caption.fontWeight : "600"}
                                      fill={colors.textMuted}
                                      textAnchor="start"
                                  >
                                      {areaFill
                                          ? wholeNumberLabel(v)
                                          : v.toFixed(yTickDecimals)}
                                  </SvgText>
                                  );
                              })
                            : null}

                        {/* The child */}
                        {areaFill && childPath && chartPoints.length > 1 ? (
                            <Path d={childPath.area} fill={`url(#growth-${indicator})`} />
                        ) : null}
                        {childPath && chartPoints.length > 1 ? (
                            <Path
                                d={childPath.line}
                                stroke={lineColor}
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin={areaFill ? "miter" : "round"}
                                fill="none"
                            />
                        ) : null}
                        {childPath
                            ? childPath.coords.map((c, i) => {
                                  const selected = latestHighlight === c;
                                  return (
                                      <React.Fragment key={c.point?.id || `${c.point?.date}-${i}`}>
                                          {selected ? (
                                              <Circle
                                                  cx={c.x}
                                                  cy={c.y}
                                                  r={7}
                                                  fill={colors.surface}
                                                  stroke={lineColor}
                                                  strokeWidth={2}
                                              />
                                          ) : null}
                                          <Circle
                                              cx={c.x}
                                              cy={c.y}
                                              r={selected ? 3.5 : areaFill ? 2.5 : compact ? 2.75 : 3.5}
                                              fill={colors.surface}
                                              fillOpacity={1}
                                              stroke={lineColor}
                                              strokeWidth={areaFill ? 1.25 : 2}
                                              strokeOpacity={selected || !areaFill ? 1 : 0.62}
                                          />
                                      </React.Fragment>
                                  );
                              })
                            : null}

                        {/* X scale — drawn in both sizes now. */}
                        {xTicks.map((t, i) => {
                            const x = Number.isFinite(t.x)
                                ? t.x
                                : areaFill
                                  ? xTicks.length === 1
                                    ? gutter + plotW / 2
                                    : gutter + (i / (xTicks.length - 1)) * plotW
                                  : geo.xFor(t.day);
                            return (
                            <SvgText
                                key={`x${i}`}
                                x={x}
                                y={chartHeight - 5}
                                fontSize={t.fontSize || 13}
                                fontFamily={chartFontFamily}
                                fontWeight={areaFill ? type.caption.fontWeight : "600"}
                                fill={colors.textMuted}
                                textAnchor={areaFill
                                    ? "middle"
                                    : xTicks.length === 1
                                      ? "middle"
                                      : i === 0
                                        ? "start"
                                        : i === xTicks.length - 1
                                          ? "end"
                                          : "middle"}
                            >
                                {t.label}
                            </SvgText>
                            );
                        })}

                    </Svg>
                ) : null}
            </View>

            {/* The recorded-only overview names each series above its chart,
                so repeating the same legend below every chart adds noise. */}
            {showReference ? (
                <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendLine, { backgroundColor: lineColor }]} />
                        <Text style={[styles.legendText, areaFill && styles.parentChartText]}>{name || t("growthLegendThisChild")}</Text>
                    </View>
                    {bands ? <>
                        <View style={styles.legendItem}>
                            <View style={styles.legendBand} />
                            <Text style={[styles.legendText, areaFill && styles.parentChartText]}>{t("growthLegendMost")}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={styles.legendDash}>
                                <View style={styles.legendDashSeg} />
                                <View style={styles.legendDashSeg} />
                                <View style={styles.legendDashSeg} />
                            </View>
                            <Text style={[styles.legendText, areaFill && styles.parentChartText]}>{t("growthLegendMiddle")}</Text>
                        </View>
                    </> : null}
                </View>
            ) : null}

            {showReference && !sexKey ? (
                <Text style={[styles.note, areaFill && styles.parentChartText]}>
                    {t("growthMissingSex")}
                </Text>
            ) : null}
            {beyondRange > 0 ? (
                <Text style={[styles.note, areaFill && styles.parentChartText]}>
                    {t(beyondRange === 1 ? "growthBeyondAgeOne" : "growthBeyondAgeMany").replace("{count}", beyondRange)}
                </Text>
            ) : null}
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        note: {
            fontSize: 13,
            fontWeight: "600",
            color: colors.textMuted,
            lineHeight: 18,
            marginTop: space.sm,
        },
        legendRow: { flexDirection: "row", flexWrap: "wrap", gap: space.lg, marginTop: space.sm },
        legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
        legendLine: { width: 16, height: 3, borderRadius: 2, borderCurve: "continuous" },
        // Matches the median stroke: same colour, same 0.6 opacity, broken into
        // segments. A solid swatch standing for a dashed line is not a key.
        legendDash: { width: 16, flexDirection: "row", alignItems: "center", gap: 2 },
        legendDashSeg: {
            flex: 1,
            height: 2,
            backgroundColor: colors.textMuted,
            opacity: 0.6,
        },
        legendBand: {
            width: 16,
            height: 10,
            borderRadius: 3,
            borderCurve: "continuous",
            backgroundColor: colors.text,
            opacity: 0.08,
        },
        legendText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
        parentChartText: { ...type.caption, color: colors.textMuted },
    });
