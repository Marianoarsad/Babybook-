import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { space, type } from "../../theme";

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 70;
const STROKE = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const OUTSIDE_AT = 0.08;

const CATEGORIES = [
    { key: "solid", label: "Solid foods" },
    { key: "breastmilk", label: "Breast milk" },
    { key: "formula", label: "Formula" },
    { key: "mixed", label: "Mixed" },
];

const polar = (radius, angle) => {
    const radians = (angle * Math.PI) / 180;
    return { x: CENTER + Math.cos(radians) * radius, y: CENTER + Math.sin(radians) * radius };
};

function spreadLabels(labels) {
    const output = labels.map((label) => ({ ...label }));
    for (const side of [-1, 1]) {
        const group = output.filter((label) => label.side === side).sort((a, b) => a.y - b.y);
        for (let index = 1; index < group.length; index++) {
            group[index].y = Math.max(group[index].y, group[index - 1].y + 18);
        }
        const overflow = group.length ? group[group.length - 1].y - (SIZE - 14) : 0;
        if (overflow > 0) group.forEach((label) => { label.y -= overflow; });
    }
    return output;
}

export default function NutritionMixChart({ counts }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const total = Number(counts?.total) || 0;
    const segments = useMemo(() => {
        let offset = 0;
        return CATEGORIES.map((category) => {
            const count = Number(counts?.[category.key]) || 0;
            const fraction = total ? count / total : 0;
            const start = offset;
            offset += fraction;
            return {
                ...category,
                count,
                fraction,
                start,
                percent: Math.round(fraction * 100),
                color: colors.nutritionMix[category.key],
                angle: -90 + (start + fraction / 2) * 360,
            };
        }).filter((segment) => segment.count > 0);
    }, [colors.nutritionMix, counts, total]);
    const outsideLabels = useMemo(() => spreadLabels(
        segments.filter((segment) => segment.fraction < OUTSIDE_AT).map((segment) => {
            const target = polar(RADIUS + STROKE / 2 + 18, segment.angle);
            const side = Math.cos((segment.angle * Math.PI) / 180) < 0 ? -1 : 1;
            return {
                ...segment,
                side,
                lineX: CENTER + side * (RADIUS + STROKE / 2 + 12),
                textX: side < 0 ? 4 : SIZE - 4,
                y: target.y,
            };
        })
    ), [segments]);
    const summary = total
        ? `Today's feedings donut chart. ${CATEGORIES.map((category) => {
            const count = Number(counts?.[category.key]) || 0;
            return `${category.label}: ${count}, ${Math.round((count / total) * 100)} percent`;
        }).join(". ")}.`
        : "Today's feedings donut chart. No feedings logged today.";

    return (
        <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.container}>
            <Svg width={SIZE} height={SIZE}>
                <Circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={colors.surfaceAlt}
                    strokeWidth={STROKE}
                />
                {segments.map((segment) => (
                    <Circle
                        key={segment.key}
                        cx={CENTER}
                        cy={CENTER}
                        r={RADIUS}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth={STROKE}
                        strokeDasharray={`${segment.fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                        strokeDashoffset={-segment.start * CIRCUMFERENCE}
                        transform={`rotate(-90 ${CENTER} ${CENTER})`}
                    />
                ))}
                {segments.filter((segment) => segment.fraction >= OUTSIDE_AT).map((segment) => {
                    const position = polar(RADIUS, segment.angle);
                    return (
                        <SvgText
                            key={`inside-${segment.key}`}
                            x={position.x}
                            y={position.y + 4}
                            fill={colors.surface}
                            fontSize={13}
                            fontFamily={type.bodyStrong.fontFamily}
                            fontWeight={type.bodyStrong.fontWeight}
                            textAnchor="middle"
                        >
                            {segment.percent}%
                        </SvgText>
                    );
                })}
                {outsideLabels.map((label) => {
                    const edge = polar(RADIUS + STROKE / 2 + 2, label.angle);
                    return (
                        <React.Fragment key={`outside-${label.key}`}>
                            <Line x1={edge.x} y1={edge.y} x2={label.lineX} y2={label.y} stroke={label.color} strokeWidth={1.5} />
                            <SvgText
                                x={label.textX}
                                y={label.y + 4}
                                fill={colors.text}
                                fontSize={13}
                                fontFamily={type.bodyStrong.fontFamily}
                                fontWeight={type.bodyStrong.fontWeight}
                                textAnchor={label.side < 0 ? "start" : "end"}
                            >
                                {label.percent}%
                            </SvgText>
                        </React.Fragment>
                    );
                })}
                {!total ? (
                    <>
                        <SvgText x={CENTER} y={CENTER - 3} fill={colors.textMuted} fontSize={13} textAnchor="middle">
                            No feedings
                        </SvgText>
                        <SvgText x={CENTER} y={CENTER + 16} fill={colors.textMuted} fontSize={13} textAnchor="middle">
                            logged today
                        </SvgText>
                    </>
                ) : null}
            </Svg>
            <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {CATEGORIES.map((category) => (
                    <View key={category.key} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.nutritionMix[category.key] }]} />
                        <Text style={styles.legendText}>{category.label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: { alignItems: "center", paddingTop: space.sm },
    legend: {
        width: "100%",
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        rowGap: space.sm,
        paddingTop: space.sm,
    },
    legendItem: {
        width: "45%",
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.sm,
    },
    legendDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
    legendText: { ...type.body, color: colors.text, flexShrink: 1 },
});
