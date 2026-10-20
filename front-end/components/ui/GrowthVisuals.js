import React, { useEffect, useMemo, useRef, useState } from "react";
import { CountUpNumber } from "./RollingNumber";
import useReducedMotion from "./useReducedMotion";
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { MIN_TOUCH, space, type } from "../../theme";
import { shortDate } from "../../utils/dates";
import Gradient from "./Gradient";

const ICONS = {
    weight: require("../../assets/growth/weight.png"),
    height: require("../../assets/growth/height.png"),
    head: require("../../assets/growth/head.png"),
};
const METRICS = [
    { key: "weight", field: "weight", label: "growthWeight", unit: "kg" },
    { key: "height", field: "height", label: "growthHeight", unit: "cm" },
    { key: "head", field: "head_circumference", label: "growthHeadCirc", unit: "cm" },
];

export function GrowthBackground({ kind = "panel", metric, radius = 28 }) {
    const { colors } = useTheme();
    const material = colors.growthSurface;
    return <Gradient pointerEvents="none" accessible={false}
        colors={metric ? material.metric[metric].surface : material[kind]}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius,
            boxShadow: "inset 0 1px 0 " + material.highlight }]} />;
}

export function GrowthMetricIcon({ metric, size = 44, circular = false }) {
    const { colors } = useTheme();
    return <Gradient pointerEvents="none" accessible={false}
        colors={colors.growthSurface.metric[metric].iconSurface}
        style={{ width: size, height: size, borderRadius: circular ? size / 2 : size * 0.36,
            alignItems: "center", justifyContent: "center", flexShrink: 0,
            ...(circular ? { boxShadow: colors.dateFilterGlass.controlShadow } : null) }}>
        <Image source={ICONS[metric]} resizeMode="contain"
            style={{ width: size * 0.8, height: size * 0.8 }} accessible={false} />
    </Gradient>;
}

export function NeumorphicMeasurements({ measurement }) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [rowWidth, setRowWidth] = useState(0);
    const reducedMotion = useReducedMotion();
    const roomy = (rowWidth - space.sm * 2) / 3 >= 132;
    return <View style={styles.summary}>
        <GrowthBackground kind="section" radius={24} />
        <View style={styles.heading}>
            <Text style={styles.title}>{t("growthLatestMeasurements")}</Text>
            {measurement ? <Text selectable style={styles.date}>{shortDate(measurement.date)}</Text> : null}
        </View>
        <View style={styles.row} onLayout={event => {
            const width = Math.round(event.nativeEvent.layout.width);
            setRowWidth(previous => previous === width ? previous : width);
        }}>
            {METRICS.map(metric => <View key={metric.key}
                style={[styles.tile, { boxShadow: colors.growthSurface.metric[metric.key].shadow },
                    roomy && styles.tileRoomy]}>
                <GrowthBackground metric={metric.key} radius={18} />
                <GrowthMetricIcon metric={metric.key} />
                <View style={[styles.reading, roomy && styles.readingRoomy]}>
                    <Text style={styles.label}>{t(metric.label)}</Text>
                    {measurement?.[metric.field] != null ? <>
                        <CountUpNumber label={String(measurement[metric.field])} style={styles.value}
                            width={rowWidth} reducedMotion={reducedMotion} />
                        <Text style={styles.unit}>{metric.unit}</Text>
                    </> : <Text style={styles.empty}>{measurement ? "—" : t("growthNoRecordYet")}</Text>}
                </View>
            </View>)}
        </View>
    </View>;
}

// Keep the target and anchored-menu measurement stable while only its surface compresses.
export function GrowthControl({ ref: controlRef, children, style, circular = false, onPress, ...props }) {
    const { colors } = useTheme();
    const pressure = useRef(new Animated.Value(0)).current;
    const pressed = useRef(false);
    const [reduceMotion, setReduceMotion] = useState(true);
    const [focusVisible, setFocusVisible] = useState(false);
    const updateFocus = Platform.OS === "web"
        ? event => setFocusVisible(Boolean(event.currentTarget?.matches?.(":focus-visible")))
        : undefined;
    useEffect(() => {
        let mounted = true, changed = false;
        const media = Platform.OS === "web" && globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
        const update = value => { changed = true; if (mounted) setReduceMotion(value); };
        if (media) setReduceMotion(media.matches);
        else AccessibilityInfo.isReduceMotionEnabled().then(value => {
            if (mounted && !changed) setReduceMotion(value);
        }).catch(() => {});
        const listener = event => update(event.matches);
        if (media?.addEventListener) media.addEventListener("change", listener);
        else media?.addListener?.(listener);
        const subscription = media ? null : AccessibilityInfo.addEventListener("reduceMotionChanged", update);
        return () => {
            mounted = false;
            if (media?.removeEventListener) media.removeEventListener("change", listener);
            else media?.removeListener?.(listener);
            subscription?.remove();
            pressure.stopAnimation();
        };
    }, [pressure]);
    useEffect(() => {
        if (reduceMotion) { pressure.stopAnimation(); pressure.setValue(pressed.current ? 1 : 0); }
    }, [reduceMotion, pressure]);
    const respond = down => {
        pressed.current = down;
        pressure.stopAnimation();
        if (reduceMotion) { pressure.setValue(down ? 1 : 0); return; }
        const options = { toValue: down ? 1 : 0, useNativeDriver: Platform.OS !== "web", isInteraction: false };
        if (down) Animated.timing(pressure, { ...options, duration: 100, easing: Easing.out(Easing.quad) }).start();
        else Animated.spring(pressure, { ...options, stiffness: 1400, damping: 64, mass: 0.75,
            overshootClamping: true, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.02 }).start();
    };
    const round = circular ? MIN_TOUCH / 2 : 24;
    return <Pressable {...props} ref={controlRef} onPress={onPress}
        onPressIn={event => {
            if (event.nativeEvent?.type === "keydown") updateFocus?.(event);
            else setFocusVisible(false);
            respond(true);
        }}
        onPressOut={() => respond(false)} onFocus={updateFocus} onKeyDown={updateFocus}
        onBlur={() => { setFocusVisible(false); if (pressed.current) respond(false); }}
        style={[{ minHeight: MIN_TOUCH, borderRadius: round }, style,
            Platform.OS === "web" && { outlineStyle: focusVisible ? "solid" : "none",
                outlineWidth: 2, outlineOffset: 3, outlineColor: colors.growthSurface.series }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, {
            borderRadius: round, backgroundColor: colors.growthSurface.control[0],
            boxShadow: colors.growthSurface.controlShadow,
            opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }),
            transform: [{ scale: pressure.interpolate({ inputRange: [0, 1], outputRange: reduceMotion ? [1, 1] : [1, 0.985] }) }],
        }]}><GrowthBackground kind="control" radius={round} /></Animated.View>
        {children}
    </Pressable>;
}

const makeStyles = colors => StyleSheet.create({
    summary: { borderRadius: 24, padding: space.md, marginBottom: space.lg,
        boxShadow: colors.growthSurface.sectionShadow },
    heading: { gap: 2, marginBottom: space.md },
    title: { ...type.bodyStrong, color: colors.text },
    date: { ...type.caption, color: colors.textMuted },
    row: { flexDirection: "row", gap: space.sm, alignItems: "stretch" },
    tile: { flex: 1, minWidth: 0, borderRadius: 18, paddingHorizontal: space.xs,
        paddingVertical: space.md, alignItems: "center", gap: space.sm },
    tileRoomy: { flexDirection: "row", paddingHorizontal: space.sm, justifyContent: "center" },
    reading: { minWidth: 0, alignItems: "center", alignSelf: "stretch" },
    readingRoomy: { flex: 1, alignItems: "flex-start", alignSelf: "center" },
    label: { ...type.caption, color: colors.textMuted, textAlign: "center", maxWidth: "100%" },
    value: { ...type.heading, color: colors.text, fontVariant: ["tabular-nums"], marginTop: space.xs,
        maxWidth: "100%", textAlign: "center" },
    unit: { ...type.caption, color: colors.textMuted },
    empty: { ...type.caption, color: colors.textMuted, textAlign: "center", marginTop: space.xs, maxWidth: "100%" },
});
