import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { motion, type } from "../../theme";
import { feedingPercentage } from "../../utils/feedingStats";
import Gradient from "./Gradient";
import MilkIcon from "./MilkIcon";
import useReducedMotion from "./useReducedMotion";

const CENTER = 120, RADIUS = 70, STROKE = 42, CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const polar = angle => ({ x: CENTER + Math.cos(angle * Math.PI / 180) * RADIUS, y: CENTER + Math.sin(angle * Math.PI / 180) * RADIUS });

export default function NutritionMixChart({ summary }) {
    const { colors } = useTheme(), p = colors.feedingBreakdown;
    const { fontScale } = useWindowDimensions();
    const styles = useMemo(() => makeStyles(p), [p]);
    const id = "feeding-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const [width, setWidth] = useState(0);
    const size = Math.min(252, width), centerSize = size * 98 / 192;
    const reduced = useReducedMotion();
    const solid = summary.solidFoodPercentage / 100, milk = summary.milkPercentage / 100;
    const [drawn, setDrawn] = useState([solid, milk]);
    const current = useRef(drawn), progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        progress.stopAnimation();
        const target = [solid, milk], from = current.current;
        if (reduced !== false) { current.current = target; setDrawn(target); return; }
        if (from.every((value, i) => value === target[i])) return;
        progress.setValue(0);
        const listener = progress.addListener(({ value }) => {
            current.current = from.map((start, i) => start + (target[i] - start) * value);
            setDrawn(current.current);
        });
        const animation = Animated.timing(progress, { toValue: 1, duration: 320, easing: Easing.bezier(...motion.standard.bezier), useNativeDriver: false });
        animation.start();
        return () => { animation.stop(); progress.removeListener(listener); };
    }, [solid, milk, reduced, progress]);
    const segments = [
        { key: "solid", fraction: drawn[0], start: 0, colors: p.ringSolid },
        { key: "milk", fraction: drawn[1], start: drawn[0], colors: p.ringMilk },
    ].filter(segment => segment.fraction > 0);
    const accessibleSummary = summary.totalEntries
        ? `Today's feeding entries. Milk, including formula, breast milk and mixed: ${summary.milkEntries}, ${feedingPercentage(summary.milkPercentage)}. Solid food: ${summary.solidFoodEntries}, ${feedingPercentage(summary.solidFoodPercentage)}. Percentages count logged events, not nutritional intake.`
        : "Today's feeding entries. No feedings logged today.";
    return <View testID="feeding-donut" style={styles.chart} onLayout={e => setWidth(e.nativeEvent.layout.width)}
        accessible accessibilityRole="image" accessibilityLabel={accessibleSummary}>
        <View style={{ width: size, height: size }}>
            <Svg pointerEvents="none" accessible={false} width={size} height={size} viewBox="24 24 192 192">
                <Defs>
                    {segments.map(segment => <LinearGradient key={segment.key} id={`${id}-${segment.key}`} x1="100%" y1="0%" x2="0%" y2="100%">
                        {segment.colors.map((color, i) => <Stop key={i} offset={i / 2} stopColor={color} />)}
                    </LinearGradient>)}
                    <LinearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={p.reflection} stopOpacity="0.85" />
                        <Stop offset="0.45" stopColor={p.reflection} stopOpacity="0.12" />
                        <Stop offset="1" stopColor={p.clearReflection} />
                    </LinearGradient>
                    <RadialGradient id={`${id}-center`} cx="25%" cy="15%" r="85%">
                        {p.center.map((color, i) => <Stop key={i} offset={i / 2} stopColor={color} />)}
                    </RadialGradient>
                </Defs>
                <Circle cx={CENTER} cy={CENTER + 3} r={RADIUS} fill="none" stroke={p.ringShade} strokeOpacity="0.18" strokeWidth={STROKE + 4} />
                <Circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={p.track} strokeWidth={STROKE} />
                {segments.map(segment => <Circle key={segment.key} testID={`feeding-arc-${segment.key}`} cx={CENTER} cy={CENTER} r={RADIUS}
                    fill="none" stroke={`url(#${id}-${segment.key})`} strokeWidth={STROKE}
                    strokeDasharray={`${segment.fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-segment.start * CIRCUMFERENCE} transform={`rotate(-90 ${CENTER} ${CENTER})`} />)}
                <Circle cx={CENTER} cy={CENTER} r={89} fill="none" stroke={`url(#${id}-gloss)`} strokeWidth={3} />
                <Circle cx={CENTER} cy={CENTER} r={84} fill="none" stroke={`url(#${id}-gloss)`} strokeWidth={7} strokeOpacity="0.3" />
                <Circle cx={CENTER} cy={CENTER} r={49} fill={`url(#${id}-center)`} stroke={p.reflection} strokeOpacity="0.8" strokeWidth={2} />
                {segments.filter(segment => segment.fraction >= 0.08).map(segment => {
                    const position = polar(-90 + (segment.start + segment.fraction / 2) * 360);
                    const props = { x: position.x, y: position.y + 4, fontSize: 13, fontFamily: type.bodyStrong.fontFamily, fontWeight: "700", textAnchor: "middle" };
                    return <React.Fragment key={`label-${segment.key}`}>
                        <SvgText {...props} fill={p.labelBacking} stroke={p.labelBacking} strokeWidth={1.8} strokeOpacity="0.55">{feedingPercentage(segment.fraction * 100)}</SvgText>
                        <SvgText {...props} fill={p.reflection}>{feedingPercentage(segment.fraction * 100)}</SvgText>
                    </React.Fragment>;
                })}
            </Svg>
            <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFillObject, styles.center]}>
                <MilkIcon size={Math.min(72, centerSize * 0.56)} showBackground={false} />
                {fontScale <= 1.3 ? <Text style={[styles.centerText, { maxWidth: centerSize * 0.82 }]}>Feeding{"\n"}entries</Text> : null}
            </View>
        </View>
    </View>;
}

export function NutritionMixLegend({ summary }) {
    const { colors } = useTheme(), p = colors.feedingBreakdown;
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const styles = useMemo(() => makeStyles(p), [p]);
    const stacked = width > 0 && width < 280 * fontScale;
    return <View testID="feeding-legends" onLayout={e => setWidth(e.nativeEvent.layout.width)} style={[styles.legends, stacked && { flexDirection: "column" }]}>
        {[{ key: "milk", label: "Milk / Formula", value: summary.milkPercentage, ink: p.azure, gradient: p.ringMilk },
            { key: "solid", label: "Solid Food", value: summary.solidFoodPercentage, ink: p.mint, gradient: p.ringSolid }].map(item =>
            <View key={item.key} accessible accessibilityLabel={`${item.label}, ${feedingPercentage(item.value)}`} style={styles.legend}>
                <Gradient colors={p.row} style={[StyleSheet.absoluteFillObject, { borderRadius: 24, boxShadow: "inset 0 2px 2px " + p.highlight }]} />
                <Gradient colors={item.gradient} style={styles.dot} />
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={[styles.legendValue, { color: item.ink }]}>{feedingPercentage(item.value)}</Text>
            </View>)}
    </View>;
}
const makeStyles = p => StyleSheet.create({
    chart: { width: "100%", alignItems: "center", marginTop: 4, marginBottom: 10 },
    center: { alignItems: "center", justifyContent: "center" }, centerText: { ...type.caption, fontSize: 12, lineHeight: 14, textAlign: "center", color: p.secondary },
    legends: { flexDirection: "row", gap: 10, marginBottom: 16, overflow: "visible" },
    legend: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 5, padding: 8, borderRadius: 24, boxShadow: p.itemShadow },
    dot: { width: 14, height: 14, borderRadius: 7 }, legendLabel: { ...type.caption, fontSize: 12, color: p.secondary }, legendValue: { ...type.label },
});
