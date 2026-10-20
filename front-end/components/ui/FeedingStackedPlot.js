import React, { useId } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { type } from "../../theme";

export function roundedStackedBar(x, y, width, height) {
    const r = Math.min(6, width / 2, height);
    return `M ${x} ${y + height} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + width - r} Q ${x + width} ${y} ${x + width} ${y + r} V ${y + height} Z`;
}

export default function FeedingStackedPlot({ chart, width, categories, materials, p, prefix, unit, unavailable, onInspect, maxBarWidth = 40 }) {
    const { fontScale } = useWindowDimensions();
    const id = "feeding-plot-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const axisWidth = Math.max(42, chart.axis.max.toLocaleString().length * 8 + 12) * fontScale;
    const available = Math.max(1, width - axisWidth);
    const minSlot = chart.points.length === 7 && fontScale <= 1.2 ? 0 : (chart.granularity === "day" ? 48 : 62) * fontScale;
    const plotWidth = Math.max(available, chart.points.length * minSlot), slot = plotWidth / chart.points.length;
    const top = 38 * fontScale, plotHeight = 208, baseline = top + plotHeight, height = baseline + 62 * fontScale;
    const y = value => baseline - value / chart.axis.max * plotHeight;
    return (
        <View style={{ flexDirection: "row", minWidth: 0 }} testID={`${prefix}-stacked-plot`}>
            <Svg testID={`${prefix}-y-axis`} accessible={false} width={axisWidth} height={height} fontFamily={type.caption.fontFamily}>
                <SvgText x={axisWidth - 7} y={17 * fontScale} fontSize={11 * fontScale} fill={p.secondary} textAnchor="end">{unit}</SvgText>
                {chart.axis.ticks.map(tick => <SvgText key={tick} x={axisWidth - 7} y={y(tick) + 4} fontSize={11 * fontScale} fill={p.secondary} textAnchor="end">{tick.toLocaleString()}</SvgText>)}
            </Svg>
            <ScrollView horizontal showsHorizontalScrollIndicator={chart.points.length > 7 || fontScale > 1.2} style={{ flex: 1, minWidth: 0 }}>
                {width > 0 ? <Svg testID={`${prefix}-stacked-columns`} accessible={false} width={plotWidth} height={height} fontFamily={type.caption.fontFamily}>
                    <Defs>{categories.map((t, i) => <LinearGradient key={t} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                        {materials[t].segment.map((color, n) => <Stop key={n} offset={n / 2} stopColor={color} />)}</LinearGradient>)}</Defs>
                    {chart.axis.ticks.map(tick => <Line key={tick} x1={0} x2={plotWidth} y1={y(tick)} y2={y(tick)} stroke={p.divider} strokeWidth={tick === 0 ? 1 : 0.6} />)}
                    {chart.points.map((point, index) => {
                        const barWidth = Math.min(maxBarWidth, slot * 0.76), x = index * slot + (slot - barWidth) / 2;
                        const upper = categories.filter(t => point.values[t] > 0).pop();
                        let lower = 0;
                        return <React.Fragment key={point.from}>
                            {categories.map((t, i) => {
                                const amount = point.values[t], bottom = lower; lower += amount;
                                if (!amount || unavailable) return null;
                                const props = { testID: `${prefix}-segment-${point.from}-${t}`, fill: `url(#${id}-${i})`, onPress: () => onInspect(point, t) };
                                return t === upper ? <Path key={t} {...props} d={roundedStackedBar(x, y(lower), barWidth, amount / chart.axis.max * plotHeight)} />
                                    : <Rect key={t} {...props} x={x} y={y(lower)} width={barWidth} height={y(bottom) - y(lower)} />;
                            })}
                            {point.total > 0 && !unavailable ? <SvgText testID={`${prefix}-total-${point.from}`} x={x + barWidth / 2} y={y(point.total) - 9} fontSize={12 * fontScale} fontWeight="700" fill={p.text} textAnchor="middle" onPress={() => onInspect(point)}>{point.total.toLocaleString()}</SvgText> : null}
                            <SvgText testID={`${prefix}-date-${point.from}`} x={(index + 0.5) * slot} y={baseline + 20 * fontScale} fontSize={10 * fontScale} fill={p.secondary} textAnchor="middle">{point.label}</SvgText>
                            <SvgText x={(index + 0.5) * slot} y={baseline + 36 * fontScale} fontSize={10 * fontScale} fill={p.secondary} textAnchor="middle">{slot < 30 ? point.subLabel.split(" ")[0] : point.subLabel}</SvgText>
                            {slot < 30 ? <SvgText x={(index + 0.5) * slot} y={baseline + 50 * fontScale} fontSize={10 * fontScale} fill={p.secondary} textAnchor="middle">{point.subLabel.split(" ").slice(1).join(" ")}</SvgText> : null}
                        </React.Fragment>;
                    })}
                </Svg> : null}
            </ScrollView>
        </View>
    );
}
