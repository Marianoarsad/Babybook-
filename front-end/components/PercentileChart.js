import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import { space } from "../theme";
import {
    WHO_MAX_DAY,
    ageInDays,
    normalizeSex,
    referenceCurve,
    unitFor,
} from "../utils/whoGrowth";

// A child's measurements drawn against the WHO reference envelope.
//
// The bands are deliberately COLOURLESS — ink at low opacity, never green or
// red. A green "safe" zone and a red "danger" zone would turn a reference
// comparison into a verdict, which this product does not make (PRODUCT.md:
// "Never imply clinical authority"). Colour in this chart belongs to one thing
// only: the child's own line.
//
// The x axis is proportional to AGE, not to the index of the measurement, so a
// point taken after a six-month gap sits six months along. The band comparison
// is meaningless otherwise.

const Z_LINES = [-3, -2, 0, 2, 3];
const FIELD = { weight: "weight", height: "height", head: "head_circumference" };

export default function PercentileChart({
    indicator = "weight",
    sex,
    dateOfBirth,
    rows,
    compact = false,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [width, setWidth] = useState(0);
    // Callers pass whatever they hold — "Female", "boy", or an already
    // normalized "girls". Anything unrecognized yields null and the reference
    // bands are simply omitted rather than guessed.
    const sexKey = useMemo(() => normalizeSex(sex), [sex]);

    const chartHeight = compact ? 168 : 236;
    const padTop = 10;
    // Compact used to be 16, which left no room for the x axis and was the
    // reason compact had no time reference at all. A curve without an age axis
    // can't be read: three months of growth and three years look identical.
    const padBottom = 22;
    // Widened from 30/26 to fit the 13px tick labels (DESIGN.md's 13px text
    // floor) without clipping — narrower and "14.5"/"med" started running off
    // the left/right edge of the compact chart.
    const gutter = compact ? 36 : 38;
    const rightPad = compact ? 6 : 30; // room for the z-line labels
    const plotH = chartHeight - padTop - padBottom;
    const plotW = Math.max(0, width - gutter - rightPad);

    const field = FIELD[indicator];
    const unit = unitFor(indicator);

    // The child's own measurements, placed by age.
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
                return { day, value, date };
            })
            .filter(Boolean)
            .sort((a, b) => a.day - b.day);
    }, [rows, field, dateOfBirth]);

    const inRange = useMemo(() => points.filter((p) => p.day <= WHO_MAX_DAY), [points]);
    const beyondRange = points.length - inRange.length;

    // Age window: fit the child's history, with a floor so a newborn's first
    // measurement doesn't render on a one-day-wide axis.
    const toDay = useMemo(() => {
        const maxDay = inRange.length ? inRange[inRange.length - 1].day : 0;
        return Math.min(WHO_MAX_DAY, Math.max(Math.ceil(maxDay * 1.12), 90));
    }, [inRange]);

    const bands = useMemo(() => {
        if (!sexKey) return null;
        const curves = {};
        for (const z of Z_LINES) curves[z] = referenceCurve(indicator, sexKey, 0, toDay, z);
        if (!curves[0].length) return null;
        return curves;
    }, [indicator, sexKey, toDay]);

    // Y window covers the full reference envelope plus anything the child's own
    // line does outside it, so an outlying measurement is never clipped away.
    const yRange = useMemo(() => {
        const vals = [];
        if (bands) {
            for (const p of bands[-3]) vals.push(p.value);
            for (const p of bands[3]) vals.push(p.value);
        }
        for (const p of inRange) vals.push(p.value);
        if (!vals.length) return null;
        let min = Math.min(...vals);
        let max = Math.max(...vals);
        if (min === max) { min -= 1; max += 1; }
        const pad = (max - min) * 0.06;
        return { min: min - pad, max: max + pad };
    }, [bands, inRange]);

    const geo = useMemo(() => {
        if (!yRange || plotW <= 0) return null;
        const xFor = (day) => gutter + (day / toDay) * plotW;
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
    }, [yRange, plotW, plotH, toDay, gutter, padTop]);

    const childPath = useMemo(() => {
        if (!geo || inRange.length < 1) return null;
        const coords = inRange.map((p) => ({ x: geo.xFor(p.day), y: geo.yFor(p.value) }));
        const line = coords
            .map((c, i) => `${i ? "L" : "M"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
            .join(" ");
        return { line, coords };
    }, [geo, inRange]);

    const xTicks = useMemo(() => {
        const months = toDay / 30.4375;
        const stepMonths = months <= 4 ? 1 : months <= 14 ? 3 : months <= 30 ? 6 : 12;
        const out = [];
        for (let mo = 0; mo * 30.4375 <= toDay; mo += stepMonths) {
            out.push({
                day: mo * 30.4375,
                label: mo === 0 ? "Birth" : mo % 12 === 0 ? `${mo / 12}y` : `${mo}m`,
            });
        }
        return out;
    }, [toDay]);

    if (!dateOfBirth) {
        return <Text style={styles.note}>Add the child's date of birth to compare growth against WHO reference curves.</Text>;
    }
    if (!points.length) {
        return <Text style={styles.note}>No {indicator === "head" ? "head circumference" : indicator} measurements recorded yet.</Text>;
    }

    return (
        <View>
            <View style={{ height: chartHeight }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                {geo ? (
                    <Svg width={width} height={chartHeight}>
                        {bands ? (
                            <>
                                {/* Reference envelope, widest first. */}
                                <Path d={geo.areaFor(bands[3], bands[-3])} fill={colors.text} fillOpacity={0.035} />
                                <Path d={geo.areaFor(bands[2], bands[-2])} fill={colors.text} fillOpacity={0.05} />
                                {Z_LINES.map((z) => (
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
                                {!compact &&
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

                        {/* Baseline */}
                        <Line
                            x1={gutter}
                            y1={padTop + plotH}
                            x2={gutter + plotW}
                            y2={padTop + plotH}
                            stroke={colors.hairline}
                            strokeWidth={1}
                        />

                        {/* Y scale */}
                        {yRange
                            ? [yRange.max, (yRange.max + yRange.min) / 2, yRange.min].map((v, i) => (
                                  <SvgText
                                      key={`y${i}`}
                                      x={gutter - 6}
                                      y={geo.yFor(v) + 3.5}
                                      fontSize={13}
                                      fontWeight="600"
                                      fill={colors.textMuted}
                                      textAnchor="end"
                                  >
                                      {v.toFixed(v > 40 ? 0 : 1)}
                                  </SvgText>
                              ))
                            : null}

                        {/* The child */}
                        {childPath && inRange.length > 1 ? (
                            <Path d={childPath.line} stroke={colors.primary} strokeWidth={2.5} fill="none" />
                        ) : null}
                        {childPath
                            ? childPath.coords.map((c, i) => (
                                  <Circle
                                      key={i}
                                      cx={c.x}
                                      cy={c.y}
                                      r={compact ? 3 : 4}
                                      fill={colors.surface}
                                      stroke={colors.primary}
                                      strokeWidth={2}
                                  />
                              ))
                            : null}

                        {/* X scale — drawn in both sizes now. */}
                        {xTicks.map((t, i) => (
                            <SvgText
                                key={`x${i}`}
                                x={geo.xFor(t.day)}
                                y={chartHeight - 5}
                                fontSize={13}
                                fontWeight="600"
                                fill={colors.textMuted}
                                textAnchor={i === 0 ? "start" : "middle"}
                            >
                                {t.label}
                            </SvgText>
                        ))}
                    </Svg>
                ) : null}
            </View>

            {/* Legend, in both sizes. It was gated to the full chart before,
                which left the compact one showing an unexplained grey band —
                and the band is the entire point of the chart. It also carries
                the unit, which nothing else on the Dashboard card states. */}
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
                    <Text style={styles.legendText}>This child ({unit})</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={styles.legendBand} />
                    <Text style={styles.legendText}>Where most children this age are</Text>
                </View>
            </View>

            {!sexKey ? (
                <Text style={styles.note}>
                    WHO curves are published separately for boys and girls. Add the child's sex to see the reference range.
                </Text>
            ) : null}
            {beyondRange > 0 ? (
                <Text style={styles.note}>
                    {beyondRange} measurement{beyondRange === 1 ? "" : "s"} taken after age 5 {beyondRange === 1 ? "is" : "are"} not
                    shown — WHO's standards for these measures stop at 5 years.
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
        legendBand: {
            width: 16,
            height: 10,
            borderRadius: 3,
            borderCurve: "continuous",
            backgroundColor: colors.text,
            opacity: 0.08,
        },
        legendText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
    });
