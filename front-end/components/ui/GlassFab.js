import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Circle, ClipPath, Defs, FeGaussianBlur, Filter, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { motion } from "../../theme";

const PLUS = "M50 27 A6 6 0 0 1 56 33 V42 Q56 44 58 44 H67 A6 6 0 0 1 67 56 H58 Q56 56 56 58 V67 A6 6 0 0 1 44 67 V58 Q44 56 42 56 H33 A6 6 0 0 1 33 44 H42 Q44 44 44 42 V33 A6 6 0 0 1 50 27 Z";

export default function GlassFab({ onPress, style, blurTarget, accessibilityLabel = "Add a record", appearance = "default" }) {
    const { colors, scheme } = useTheme();
    const azure = appearance === "azureGlass";
    const material = azure ? colors.globalFabGlass : colors.fab;
    const glyph = colors.fab;
    const styles = useMemo(() => makeStyles(material), [material]);
    const webGlass = azure && Platform.OS === "web";
    const Glass = webGlass ? View : BlurView;
    const id = `fab-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const pressure = useRef(new Animated.Value(0)).current;
    const pressed = useRef(false);
    const [reduceMotion, setReduceMotion] = useState(true);
    const [focusVisible, setFocusVisible] = useState(false);
    const updateFocus = Platform.OS === "web"
        ? (event) => setFocusVisible(Boolean(event.currentTarget?.matches?.(":focus-visible")))
        : undefined;
    useEffect(() => {
        let mounted = true, changed = false;
        AccessibilityInfo.isReduceMotionEnabled().then((value) => {
            if (mounted && !changed) setReduceMotion(value);
        }).catch(() => {});
        const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
            changed = true;
            if (mounted) setReduceMotion(value);
        });
        return () => { mounted = false; subscription.remove(); pressure.stopAnimation(); };
    }, [pressure]);
    useEffect(() => {
        if (reduceMotion) {
            pressure.stopAnimation();
            pressure.setValue(pressed.current ? 1 : 0);
        }
    }, [reduceMotion, pressure]);
    const respond = (down) => {
        pressed.current = down;
        pressure.stopAnimation();
        if (reduceMotion) {
            pressure.setValue(down ? 1 : 0);
            return;
        }
        const options = { toValue: down ? 1 : 0, useNativeDriver: Platform.OS !== "web", isInteraction: false };
        if (down) {
            Animated.timing(pressure, { ...options, duration: 110, easing: Easing.bezier(...motion.micro.bezier) }).start();
        } else {
            Animated.spring(pressure, { ...options, stiffness: 1400, damping: 64, mass: 0.75,
                overshootClamping: true, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.02 }).start();
        }
    };
    return <Pressable testID="glass-fab" onPress={onPress}
        {...(Platform.OS === "web" ? { delayPressIn: 0 } : {})}
        onPressIn={(event) => {
            if (event.nativeEvent?.type === "keydown") updateFocus?.(event);
            else setFocusVisible(false);
            respond(true);
        }}
        onPressOut={() => respond(false)} onFocus={updateFocus} onKeyDown={updateFocus}
        onBlur={() => { setFocusVisible(false); if (pressed.current) respond(false); }}
        accessibilityRole="button" accessibilityLabel={accessibilityLabel}
        style={[styles.hitArea, style, Platform.OS === "web" && styles.web,
            focusVisible && styles.focused]}>
        <Animated.View pointerEvents="none" style={[styles.shadow, {
            opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }),
            transform: [{ scale: pressure.interpolate({ inputRange: [0, 1], outputRange: reduceMotion ? [1, 1] : [1, 0.92] }) }],
        }]} />
        <Animated.View pointerEvents="none" style={[styles.face, {
            transform: [{ scale: pressure.interpolate({ inputRange: [0, 1], outputRange: reduceMotion ? [1, 1] : [1, 0.95] }) }],
        }]}>
            <Glass {...(webGlass ? { testID: "azure-fab-backdrop" } : { blurTarget,
                blurMethod: Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined,
                intensity: azure ? 40 : 76,
                tint: azure ? "default" : scheme === "dark" ? "systemMaterialDark" : "systemMaterialLight",
                })}
                style={[styles.glass, webGlass && styles.webGlass]}>
                <Svg style={azure && styles.reflections} width="100%" height="100%" viewBox="0 0 100 100" accessible={false}>
                    <Defs>
                        {!azure && <RadialGradient id={id + "-surface"} cx="32%" cy="22%" r="90%">
                            <Stop offset="0" stopColor={material.surface[0]} />
                            <Stop offset="0.55" stopColor={material.surface[1]} />
                            <Stop offset="1" stopColor={material.surface[2]} />
                        </RadialGradient>}
                        <LinearGradient id={id + "-plus"} x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0" stopColor={glyph.plus[0]} />
                            <Stop offset="0.45" stopColor={glyph.plus[1]} />
                            <Stop offset="1" stopColor={glyph.plus[2]} />
                        </LinearGradient>
                    </Defs>
                    {azure ? azureGlassSurface(material, id) : <Circle cx="50" cy="50" r="50" fill={`url(#${id}-surface)`} />}
                    <Path d={PLUS} transform="translate(0 1.4)" fill={glyph.plusShadow} opacity={0.18} />
                    <Path d={PLUS} fill={`url(#${id}-plus)`} stroke={glyph.reflection}
                        strokeOpacity="0.6" strokeWidth="1.2" />
                </Svg>
                <Animated.View pointerEvents="none" style={[styles.reflections, {
                    opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }),
                }]}>
                    <Svg width="100%" height="100%" viewBox="0 0 100 100" accessible={false}>
                        {!azure && <><Defs>
                            <RadialGradient id={id + "-rim"} cx="50%" cy="50%" r="50%">
                                <Stop offset="0.82" stopColor={material.reflection} stopOpacity="0" />
                                <Stop offset="0.91" stopColor={material.reflection} stopOpacity="0.12" />
                                <Stop offset="0.96" stopColor={material.reflection} stopOpacity="0.6" />
                                <Stop offset="1" stopColor={material.reflection} stopOpacity="0.08" />
                            </RadialGradient>
                            <LinearGradient id={id + "-gloss"} x1="0%" y1="0%" x2="75%" y2="100%">
                                <Stop offset="0" stopColor={material.reflection} stopOpacity="0.85" />
                                <Stop offset="0.55" stopColor={material.reflection} stopOpacity="0.16" />
                                <Stop offset="1" stopColor={material.reflection} stopOpacity="0" />
                            </LinearGradient>
                        </Defs>
                        <Circle cx="50" cy="50" r="50" fill={`url(#${id}-rim)`} />
                        <Path d="M11 44 C13 20 34 6 61 10 C38 11 20 23 11 44 Z"
                            fill={`url(#${id}-gloss)`} />
                        </>}
                        <Path d="M47 39 V33 Q47 30 50 30 M33 47 H41"
                            fill="none" stroke={glyph.reflection} strokeOpacity="0.75"
                            strokeWidth="2" strokeLinecap="round" />
                    </Svg>
                </Animated.View>
            </Glass>
        </Animated.View>
    </Pressable>;
}

function azureGlassSurface(p, id) {
    const upperLeft = "M4 45 C5 24 22 6 43 3 C46 3 45 5 41 6 C23 10 10 25 7 43 C6 47 4 48 4 45 Z";
    const upperRight = "M74 8 C83 12 92 23 95 35 C95 38 93 39 92 35 C87 24 82 18 75 14 C72 12 71 9 74 8 Z";
    return <G>
        <Defs>
            <ClipPath id={id + "-clip"}><Circle cx="50" cy="50" r="50" /></ClipPath>
            <RadialGradient id={id + "-body"} gradientUnits="userSpaceOnUse" cx="55" cy="30" r="76">
                <Stop offset="0" stopColor={p.surface[0]} stopOpacity={p.opacity[0]} />
                <Stop offset="0.55" stopColor={p.surface[1]} stopOpacity={p.opacity[1]} />
                <Stop offset="1" stopColor={p.surface[2]} stopOpacity={p.opacity[2]} />
            </RadialGradient>
            <RadialGradient id={id + "-curvature"} gradientUnits="userSpaceOnUse" cx="50" cy="46" r="52">
                <Stop offset="0.65" stopColor={p.depth} stopOpacity="0" />
                <Stop offset="0.88" stopColor={p.depth} stopOpacity="0.08" />
                <Stop offset="1" stopColor={p.depth} stopOpacity="0.48" />
            </RadialGradient>
            <RadialGradient id={id + "-interior"} gradientUnits="userSpaceOnUse" cx="61" cy="29" r="40">
                <Stop offset="0" stopColor={p.depth} stopOpacity="0.55" />
                <Stop offset="0.6" stopColor={p.depth} stopOpacity="0.22" />
                <Stop offset="1" stopColor={p.depth} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={id + "-glaze"} gradientUnits="userSpaceOnUse" cx="24" cy="12" r="49">
                <Stop offset="0" stopColor={p.reflection} stopOpacity="0.65" />
                <Stop offset="0.55" stopColor={p.light} stopOpacity="0.2" />
                <Stop offset="1" stopColor={p.light} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={id + "-cyan"} gradientUnits="userSpaceOnUse" cx="52" cy="98" r="62" gradientTransform="translate(0 56.84) scale(1 .42)">
                <Stop offset="0" stopColor={p.reflection} stopOpacity="0.72" />
                <Stop offset="0.36" stopColor={p.cyan} stopOpacity="0.5" />
                <Stop offset="1" stopColor={p.cyan} stopOpacity="0" />
            </RadialGradient>
            {[{ key: "left", cx: 10, cy: 80 }, { key: "right", cx: 91, cy: 79 }].map(light =>
                <RadialGradient key={light.key} id={`${id}-${light.key}-caustic`} gradientUnits="userSpaceOnUse" cx={light.cx} cy={light.cy} r="25">
                    <Stop offset="0" stopColor={p.reflection} stopOpacity="0.76" />
                    <Stop offset="0.35" stopColor={p.cyan} stopOpacity="0.48" />
                    <Stop offset="1" stopColor={p.cyan} stopOpacity="0" />
                </RadialGradient>)}
            <LinearGradient id={id + "-specular"} gradientUnits="userSpaceOnUse" x1="7" y1="46" x2="40" y2="4">
                <Stop offset="0" stopColor={p.reflection} stopOpacity="0" />
                <Stop offset="0.45" stopColor={p.reflection} stopOpacity="0.8" />
                <Stop offset="0.78" stopColor={p.reflection} stopOpacity="1" />
                <Stop offset="1" stopColor={p.reflection} stopOpacity="0.12" />
            </LinearGradient>
            <LinearGradient id={id + "-right-specular"} gradientUnits="userSpaceOnUse" x1="73" y1="8" x2="95" y2="39">
                <Stop offset="0" stopColor={p.reflection} stopOpacity="0" />
                <Stop offset="0.4" stopColor={p.reflection} stopOpacity="0.96" />
                <Stop offset="0.65" stopColor={p.reflection} stopOpacity="0.85" />
                <Stop offset="1" stopColor={p.reflection} stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id={id + "-edge"} gradientUnits="userSpaceOnUse" x1="16" y1="0" x2="80" y2="100">
                <Stop offset="0" stopColor={p.reflection} stopOpacity="0.96" />
                <Stop offset="0.28" stopColor={p.cyan} stopOpacity="0.72" />
                <Stop offset="0.5" stopColor={p.depth} stopOpacity="0.8" />
                <Stop offset="0.78" stopColor={p.cyan} stopOpacity="0.7" />
                <Stop offset="0.94" stopColor={p.reflection} stopOpacity="0.96" />
                <Stop offset="1" stopColor={p.surface[0]} stopOpacity="0.8" />
            </LinearGradient>
            <Filter id={id + "-feather"} filterUnits="userSpaceOnUse" x="-8" y="-8" width="116" height="116">
                <FeGaussianBlur stdDeviation="2.2" />
            </Filter>
        </Defs>
        <G clipPath={`url(#${id}-clip)`}>
            <Rect width="100" height="100" fill={`url(#${id}-body)`} />
            <Rect width="100" height="100" fill={`url(#${id}-curvature)`} />
            <Rect width="100" height="100" fill={`url(#${id}-interior)`} />
            <Rect width="100" height="100" fill={`url(#${id}-glaze)`} />
            <G filter={`url(#${id}-feather)`}>
                <Path d="M-8 53 C4 45 11 48 17 52 C24 57 28 49 36 53 C44 58 39 65 32 64 C24 63 23 72 14 70 C6 68 5 60 -4 65 Z" fill={p.cyan} opacity="0.38" />
                <Path d="M33 58 C41 48 50 53 56 57 C64 62 71 51 82 55 C91 59 86 69 76 68 C67 67 64 77 53 72 C45 69 40 73 34 67 Z" fill={p.light} opacity="0.4" />
                <Path d="M-4 78 C5 66 14 74 19 80 C27 88 34 77 42 83 C49 88 58 81 66 86 C76 92 84 81 103 77 L104 110 L-5 109 Z" fill={p.cyan} opacity="0.42" />
                <Path d={upperLeft} fill={p.reflection} opacity="0.65" />
                <Path d={upperRight} fill={p.reflection} opacity="0.45" />
            </G>
            <Rect width="100" height="100" fill={`url(#${id}-cyan)`} />
            <Rect width="100" height="100" fill={`url(#${id}-left-caustic)`} />
            <Rect width="100" height="100" fill={`url(#${id}-right-caustic)`} />
            <Path d={upperLeft} fill={`url(#${id}-specular)`} />
            <Path d={upperRight} fill={`url(#${id}-right-specular)`} />
            <Circle cx="50" cy="50" r="49.3" fill="none" stroke={`url(#${id}-edge)`} strokeWidth="1.15" />
        </G>
    </G>;
}

const makeStyles = (material) => StyleSheet.create({
    hitArea: { width: 56, height: 56, borderRadius: 28, borderCurve: "continuous" },
    web: { outlineStyle: "none" },
    focused: { outlineStyle: "solid", outlineWidth: 2, outlineOffset: 3, outlineColor: material.focus },
    shadow: { ...StyleSheet.absoluteFillObject, borderRadius: 28, borderCurve: "continuous", boxShadow: material.shadow },
    face: { ...StyleSheet.absoluteFillObject },
    glass: { flex: 1, overflow: "hidden", borderRadius: 28, borderCurve: "continuous" },
    webGlass: { backdropFilter: "blur(8px) saturate(120%)", WebkitBackdropFilter: "blur(8px) saturate(120%)", backgroundColor: material.tint },
    reflections: { ...StyleSheet.absoluteFillObject },
});
