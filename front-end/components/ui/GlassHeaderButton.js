import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Circle, Defs, FeGaussianBlur, Filter, LinearGradient, Mask, Path, RadialGradient, Stop } from "react-native-svg";
import Gradient from "./Gradient";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, motion, type } from "../../theme";

const ICONS = {
    notifications: { blue: require("../../assets/header/notifications-blue.png"), pink: require("../../assets/header/notifications-pink.png") },
    search: { blue: require("../../assets/header/search-blue.png"), pink: require("../../assets/header/search-pink.png") },
    profile: { blue: require("../../assets/header/profile-blue.png"), pink: require("../../assets/header/profile-pink.png") },
    qr: { blue: require("../../assets/header/qr-blue.png"), pink: require("../../assets/header/qr-pink.png") },
};
export const HEADER_ICON_SOURCES = Object.values(ICONS).flatMap(Object.values);

export default function GlassHeaderButton({ icon, onPress, badgeCount = 0, disabled = false, accessibilityLabel, style, blurTarget, selected }) {
    const { colors, scheme, mode } = useTheme();
    const material = colors.headerButton;
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const id = `header-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const pressure = useRef(new Animated.Value(0)).current;
    const hover = useRef(new Animated.Value(0)).current;
    const pressed = useRef(false);
    const hovered = useRef(false);
    const [reduceMotion, setReduceMotion] = useState(true);
    const [focusVisible, setFocusVisible] = useState(false);
    const updateFocus = Platform.OS === "web" ? event => setFocusVisible(Boolean(event.currentTarget?.matches?.(":focus-visible"))) : undefined;
    useEffect(() => {
        let mounted = true, changed = false;
        const changedMotion = value => { changed = true; if (mounted) setReduceMotion(value); };
        const media = Platform.OS === "web" && globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
        const mediaChanged = event => changedMotion(event.matches);
        if (media) setReduceMotion(media.matches);
        else AccessibilityInfo.isReduceMotionEnabled().then(value => {
            if (mounted && !changed) setReduceMotion(value);
        }).catch(() => {});
        // Web's AccessibilityInfo keys listeners by function text, so sibling removals collide.
        if (media) {
            if (media.addEventListener) media.addEventListener("change", mediaChanged);
            else media.addListener(mediaChanged);
        }
        const subscription = media ? { remove: () => {
            if (media.removeEventListener) media.removeEventListener("change", mediaChanged);
            else media.removeListener(mediaChanged);
        } } : AccessibilityInfo.addEventListener("reduceMotionChanged", changedMotion);
        return () => { mounted = false; subscription?.remove(); pressure.stopAnimation(); hover.stopAnimation(); };
    }, [pressure, hover]);
    useEffect(() => {
        if (reduceMotion) { pressure.stopAnimation(); pressure.setValue(pressed.current ? 1 : 0); hover.stopAnimation(); hover.setValue(hovered.current ? 1 : 0); }
    }, [reduceMotion, pressure, hover]);
    useEffect(() => {
        if (disabled) { pressed.current = false; hovered.current = false; pressure.stopAnimation(); pressure.setValue(0); hover.stopAnimation(); hover.setValue(0); setFocusVisible(false); }
    }, [disabled, pressure, hover]);
    const respond = down => {
        if (disabled) return;
        pressed.current = down;
        pressure.stopAnimation();
        if (reduceMotion) { pressure.setValue(down ? 1 : 0); return; }
        const options = { toValue: down ? 1 : 0, useNativeDriver: Platform.OS !== "web", isInteraction: false };
        if (down) Animated.timing(pressure, { ...options, duration: 110, easing: Easing.bezier(...motion.micro.bezier) }).start();
        else Animated.spring(pressure, { ...options, stiffness: 2000, damping: 78, mass: 0.75,
            overshootClamping: true, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.02 }).start();
    };
    const illuminate = over => {
        if (disabled) return;
        hovered.current = over;
        hover.stopAnimation();
        if (reduceMotion) hover.setValue(over ? 1 : 0);
        else Animated.timing(hover, { toValue: over ? 1 : 0, duration: 160, useNativeDriver: Platform.OS !== "web", isInteraction: false }).start();
    };
    const glyph = ICONS[icon][mode === "girl" ? "pink" : "blue"];
    const iconSize = icon === "notifications" ? 28 : icon === "search" || icon === "profile" ? 26 : 24;
    return <Pressable testID={`glass-header-${icon}`} disabled={disabled} onPress={disabled ? undefined : onPress}
        accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled, selected }}
        {...(Platform.OS === "web" ? { "aria-current": selected ? "page" : undefined, delayPressIn: 0, onHoverIn: () => illuminate(true), onHoverOut: () => illuminate(false) } : {})}
        onPressIn={event => {
            if (event.nativeEvent?.type === "keydown") updateFocus?.(event); else setFocusVisible(false);
            respond(true);
        }} onPressOut={() => respond(false)} onFocus={updateFocus} onKeyDown={updateFocus}
        onBlur={() => { setFocusVisible(false); if (pressed.current) respond(false); illuminate(false); }}
        style={[styles.hitArea, style, Platform.OS === "web" && styles.web, focusVisible && styles.focused, disabled && styles.disabled]}>
        <Animated.View pointerEvents="none" style={[styles.visual, {
            transform: [{ translateY: hover.interpolate({ inputRange: [0, 1], outputRange: reduceMotion ? [0, 0] : [0, -1] }) },
                { scale: pressure.interpolate({ inputRange: [0, 1], outputRange: reduceMotion ? [1, 1] : [1, 0.95] }) }],
        }]}>
            <Animated.View style={[styles.shadow, {
                opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }),
                transform: [{ scale: pressure.interpolate({ inputRange: [0, 1], outputRange: reduceMotion ? [1, 1] : [1, 0.92] }) }],
            }]} />
            <View style={styles.face}>
                {Platform.OS === "web" ? <View testID="header-glass-backdrop" pointerEvents="none" accessible={false} style={[styles.blur, styles.webBlur]} /> :
                    <BlurView pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                    blurTarget={blurTarget} blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
                    blurReductionFactor={2} intensity={30}
                    tint={Platform.OS === "android" ? "default" : scheme === "dark" ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"} style={styles.blur} />}
                {/* Positioned material paints above the backdrop on web. */}
                <Svg style={styles.reflections} width="100%" height="100%" viewBox="0 0 100 100" accessible={false} aria-hidden={true}>
                    <Defs>
                        <RadialGradient id={id + "-rim"} gradientUnits="userSpaceOnUse" cx="50" cy="50" fx="50" fy="50" r="50">
                            <Stop offset="0.65" stopColor={material.reflection} stopOpacity="0" />
                            <Stop offset="0.76" stopColor={material.reflection} stopOpacity="0.08" />
                            <Stop offset="0.86" stopColor={material.reflection} stopOpacity="0.4" />
                            <Stop offset="0.94" stopColor={material.reflection} stopOpacity="0.85" />
                            <Stop offset="0.975" stopColor={material.reflection} stopOpacity="0.95" />
                            <Stop offset="1" stopColor={material.reflection} stopOpacity="0" />
                        </RadialGradient>
                        <RadialGradient id={id + "-depth"} gradientUnits="userSpaceOnUse" cx="50" cy="38" fx="50" fy="38" r="65">
                            <Stop offset="0.48" stopColor={material.refraction} stopOpacity="0" />
                            <Stop offset="0.7" stopColor={material.refraction} stopOpacity="0.015" />
                            <Stop offset="0.9" stopColor={material.refraction} stopOpacity="0.08" />
                            <Stop offset="1" stopColor={material.refraction} stopOpacity="0.12" />
                        </RadialGradient>
                        <LinearGradient id={id + "-edge"} gradientUnits="userSpaceOnUse" x1="15" y1="0" x2="75" y2="100">
                            <Stop offset="0" stopColor={material.rimTint} stopOpacity="0.4" />
                            <Stop offset="0.18" stopColor={material.reflection} stopOpacity="0.95" />
                            <Stop offset="0.45" stopColor={material.reflection} stopOpacity="0.6" />
                            <Stop offset="0.7" stopColor={material.rimTint} stopOpacity="0.4" />
                            <Stop offset="0.9" stopColor={material.reflection} stopOpacity="0.85" />
                            <Stop offset="1" stopColor={material.rimTint} stopOpacity="0.45" />
                        </LinearGradient>
                        <Mask id={id + "-rim-mask"} maskType="alpha" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                            <Circle cx="50" cy="50" r="50" fill={`url(#${id}-rim)`} />
                        </Mask>
                    </Defs>
                    <Circle cx="50" cy="50" r="50" fill={`url(#${id}-depth)`} />
                    <Circle cx="50" cy="50" r="50" fill={`url(#${id}-edge)`} mask={`url(#${id}-rim-mask)`} />
                </Svg>
                <Animated.View style={[styles.reflections, { opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }) }]}>
                    <Animated.View style={[styles.reflections, { opacity: hover.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }]}>
                        <Svg width="100%" height="100%" viewBox="0 0 100 100" accessible={false} aria-hidden={true}>
                            <Defs><LinearGradient id={id + "-gloss"} gradientUnits="userSpaceOnUse" x1="38" y1="10" x2="10" y2="55">
                                <Stop offset="0" stopColor={material.reflection} stopOpacity="0.95" />
                                <Stop offset="0.35" stopColor={material.reflection} stopOpacity="0.95" />
                                <Stop offset="0.8" stopColor={material.reflection} stopOpacity="0.15" />
                                <Stop offset="1" stopColor={material.reflection} stopOpacity="0" />
                            </LinearGradient>
                                <Filter id={id + "-feather"} x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse"><FeGaussianBlur stdDeviation="1.2" /></Filter>
                            </Defs>
                            <Path d="M11 48 C10 30 25 12 43 10 C49 9 51 14 45 17 C29 20 20 31 17 45 C16 51 12 53 11 48 Z" fill={`url(#${id}-gloss)`} filter={`url(#${id}-feather)`} opacity="0.4" />
                            <Path d="M11 48 C10 30 25 12 43 10 C49 9 51 14 45 17 C29 20 20 31 17 45 C16 51 12 53 11 48 Z" fill={`url(#${id}-gloss)`} />
                            <Path d="M62 11 Q80 16 87 33 Q82 25 67 18 Q62 15 62 11 Z" fill={`url(#${id}-gloss)`} opacity="0.36" />
                            <Path d="M89 57 C89 77 76 89 57 91 C74 86 84 70 89 57 Z" fill={material.reflection} opacity="0.45" />
                        </Svg>
                    </Animated.View>
                </Animated.View>
                <Image source={glyph} style={[styles.icon, { width: iconSize, height: iconSize, left: (40 - iconSize) / 2, top: (40 - iconSize) / 2 }]} resizeMode="contain" accessible={false} pointerEvents="none" fadeDuration={0} />
            </View>
        </Animated.View>
        {badgeCount > 0 && <Gradient colors={material.badge} style={styles.badge} pointerEvents="none" accessible={false}>
            <View style={styles.badgeLens}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" accessible={false} aria-hidden={true}>
                    <Defs><RadialGradient id={id + "-badge-gloss"} cx="25%" cy="0%" r="75%">
                        <Stop offset="0" stopColor={material.reflection} stopOpacity="0.85" />
                        <Stop offset="0.35" stopColor={material.reflection} stopOpacity="0.22" />
                        <Stop offset="1" stopColor={material.reflection} stopOpacity="0" />
                    </RadialGradient></Defs>
                    <Path d="M10 34 C12 14 28 8 50 8 C68 8 78 11 85 18 C61 12 32 14 21 28 C16 35 11 39 10 34 Z" fill={`url(#${id}-badge-gloss)`} />
                </Svg>
            </View>
            <Text style={styles.badgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
        </Gradient>}
    </Pressable>;
}

const makeStyles = colors => StyleSheet.create({
    hitArea: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    web: { outlineStyle: "none" },
    focused: { outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2, outlineColor: colors.fab.focus },
    disabled: { opacity: 0.5 },
    visual: { width: 40, height: 40 },
    shadow: { ...StyleSheet.absoluteFillObject, borderRadius: 20, boxShadow: colors.headerButton.shadow },
    face: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center" },
    blur: { ...StyleSheet.absoluteFillObject, borderRadius: 20, overflow: "hidden" },
    webBlur: { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", backgroundColor: colors.headerButton.centerTint },
    reflections: { ...StyleSheet.absoluteFillObject },
    icon: { position: "absolute" },
    badge: { position: "absolute", top: 0, right: 0, minWidth: 18, minHeight: 18, paddingHorizontal: 4, paddingVertical: 1,
        borderRadius: 20, alignItems: "center", justifyContent: "center", boxShadow: colors.headerButton.badgeShadow },
    badgeLens: { ...StyleSheet.absoluteFillObject, borderRadius: 20, overflow: "hidden" },
    badgeText: { ...type.caption, fontSize: 11, lineHeight: 14, fontFamily: type.subheading.fontFamily, fontWeight: type.subheading.fontWeight, color: colors.headerButton.badgeText },
});
