import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MIN_TOUCH, type } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import AnchoredMenu from "./AnchoredMenu";
import GlassLighting from "./GlassLighting";
import Gradient from "./Gradient";
import useReducedMotion from "./useReducedMotion";

function ChartFilterRow({ item, checked, disabled, onPress, testIDPrefix }) {
    const { colors } = useTheme();
    const material = colors.dateFilterGlass;
    const styles = useMemo(() => makeStyles(material), [material]);
    const reduced = useReducedMotion();
    const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;
    useEffect(() => {
        const animation = Animated.timing(progress, {
            toValue: checked ? 1 : 0, duration: reduced ? 0 : 210,
            easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: Platform.OS !== "web",
        });
        animation.start();
        return () => animation.stop();
    }, [checked, progress, reduced]);

    return <TouchableOpacity testID={`${testIDPrefix}-${item.key}`}
        style={[styles.row, disabled && styles.disabled]} onPress={onPress} disabled={disabled} activeOpacity={0.9}
        accessibilityRole="switch" accessibilityState={{ checked, disabled }} accessibilityLabel={item.label}
        {...(Platform.OS === "web" ? { "aria-checked": checked, "aria-disabled": disabled } : {})}>
        <Gradient colors={material.control} style={styles.rowFace} pointerEvents="none" />
        <GlassLighting material={material} radius={24} />
        {item.icon}
        <Text style={styles.label}>{item.label}</Text>
        <View pointerEvents="none" style={styles.track}>
            <Gradient colors={material.field} style={styles.trackFace} />
            <Animated.View style={[styles.trackFace, { opacity: progress }]}>
                <Gradient colors={material.active} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />
            </Animated.View>
            <GlassLighting material={material} radius={15} selected={checked} />
            <Animated.View style={[styles.knob, { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]}>
                <Gradient colors={material.knob} style={StyleSheet.absoluteFillObject} />
                <GlassLighting material={material} radius={13} />
            </Animated.View>
        </View>
    </TouchableOpacity>;
}

export default function GlassChartFilterPopover({ visible, anchor, blurTarget, title, closeLabel, options, selectedKeys, onToggle, onClose, testIDPrefix }) {
    const { colors } = useTheme();
    const material = colors.dateFilterGlass;
    const styles = useMemo(() => makeStyles(material), [material]);
    return <AnchoredMenu visible={visible} anchor={anchor} onClose={onClose} maxWidth={300}
        dimBackdrop={false} animation="warp" appearance="glass" blurTarget={blurTarget}>
        <View style={styles.header}>
            <TouchableOpacity style={styles.back} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel}>
                <Gradient colors={material.control} style={styles.backFace} pointerEvents="none" />
                <GlassLighting material={material} radius={22} />
                <Ionicons name="chevron-back" size={24} color={material.accent} />
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.divider} />
        {options.map(item => {
            const checked = selectedKeys.includes(item.key);
            return <ChartFilterRow key={item.key} item={item} checked={checked}
                disabled={checked && selectedKeys.length === 1} onPress={() => onToggle(item.key)} testIDPrefix={testIDPrefix} />;
        })}
    </AnchoredMenu>;
}

const makeStyles = material => StyleSheet.create({
    header: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10 },
    back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center",
        borderRadius: MIN_TOUCH / 2, boxShadow: material.controlShadow },
    backFace: { ...StyleSheet.absoluteFillObject, borderRadius: MIN_TOUCH / 2 },
    title: { ...type.heading, fontSize: 20, lineHeight: 25, color: material.text, flexShrink: 1 },
    divider: { height: 1, backgroundColor: material.divider },
    row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12,
        borderRadius: 24, boxShadow: material.controlShadow },
    rowFace: { ...StyleSheet.absoluteFillObject, borderRadius: 24 },
    disabled: { opacity: 0.65 },
    label: { ...type.bodyStrong, color: material.text, flex: 1, minWidth: 0 },
    track: { width: 50, height: 30, borderRadius: 15, flexShrink: 0, boxShadow: material.activeShadow },
    trackFace: { ...StyleSheet.absoluteFillObject, borderRadius: 15, overflow: "hidden" },
    knob: { position: "absolute", left: 2, top: 2, width: 26, height: 26, borderRadius: 13,
        overflow: "hidden", borderWidth: 1, borderColor: material.rimLight, boxShadow: material.controlShadow },
});
