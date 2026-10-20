import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    TouchableOpacity,
    Animated,
    Easing,
    Platform,
    useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Modal from "./AppModal";
import Gradient from "./Gradient";
import GlassLighting from "./GlassLighting";
import useReducedMotion from "./useReducedMotion";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, motion, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// A menu that opens directly beneath the control that summoned it, rather than
// sliding a sheet up from the bottom of the screen.
//
// ui/OptionSheet.js is the long-list wrapper around this same surface:
//
//   OptionSheet  — maps and scrolls long option data (age bands, vaccines).
//   AnchoredMenu — positions and animates the shared input-bound surface.
//
//   anchor: { x, y, width, height } in window coordinates, from the trigger's
//           measureInWindow(). The menu left-aligns to `x` and drops below
//           `y + height`, clamped so it never leaves the screen.
export default function AnchoredMenu({
    visible,
    anchor,
    onClose,
    children,
    variant = "menu",
    minWidth = 240,
    // 300, not 340: at 340 on a 360pt screen the panel left 8px of page beside
    // it and read as a full-width sheet rather than a menu hanging off the
    // title. The reference leaves a visible strip of content down the side.
    maxWidth = 300,
    dimBackdrop = true,
    // Input-bound selects fold from their trigger. Icon-bound chart filters can
    // opt into the non-uniform warp; ordinary menus keep the original scale.
    animation,
    initialScrollOffset = 0,
    appearance,
    blurTarget,
    // Connected selects keep their in-layout trigger covered until the portal finishes closing.
    trigger,
    header,
}) {
    const { colors, scheme } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const actions = appearance === "actions";
    const connected = appearance === "connectedSelect";
    const glass = appearance === "glass" || actions || connected;
    const material = connected ? colors.growthDropdownGlass : actions ? colors.actionMenuGlass : colors.dateFilterGlass;
    const glassStyles = useMemo(() => makeGlassStyles(material), [material]);
    const { width: winW, height: winH } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const select = variant === "select";
    const animationMode = animation || (select || connected ? "fold" : "scale");
    const folding = animationMode === "fold";
    const warping = animationMode === "warp";

    // Kept mounted for the exit animation — unmounting on `visible` going false
    // would snap the menu away instead of letting it animate closed.
    const [mounted, setMounted] = useState(visible);
    const [panelHeight, setPanelHeight] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);
    const reduceMotion = useReducedMotion() ?? true;
    const anim = useRef(new Animated.Value(0)).current;
    const scrollRef = useRef(null);
    const lastAnchor = useRef(anchor);
    // Callers clear their anchor to close; keep the exit attached to its trigger.
    if (visible && anchor) lastAnchor.current = anchor;

    // Keep natural content height through interrupted closes; an unchanged
    // mounted ScrollView need not emit a new content-size event on reopening.
    useEffect(() => {
        if (visible) {
            anim.stopAnimation();
            anim.setValue(0);
            if (glass && !folding) setPanelHeight(0);
            setMounted(true);
            return;
        }
        anim.stopAnimation();
        Animated.timing(anim, {
            toValue: 0,
            duration: reduceMotion ? 0 : motion.standard.duration,
            easing: Easing.bezier(...motion.standard.bezier),
            useNativeDriver: !folding,
        }).start(({ finished }) => {
            if (finished) setMounted(false);
        });
    }, [visible, anim, folding, glass, reduceMotion]);

    useEffect(() => {
        if (!visible || !mounted || (folding && !contentHeight)) return;
        Animated.timing(anim, {
            toValue: 1,
            duration: reduceMotion
                ? 0
                : warping
                  ? motion.entrance.duration
                  : motion.standard.duration,
            easing: Easing.bezier(...(warping ? motion.entrance.bezier : motion.standard.bezier)),
            useNativeDriver: !folding,
        }).start();
    }, [visible, mounted, anim, folding, warping, contentHeight, reduceMotion]);

    useEffect(() => {
        if (!visible || !mounted || !initialScrollOffset || (folding && !contentHeight)) return;
        scrollRef.current?.scrollTo({ x: 0, y: initialScrollOffset, animated: false });
    }, [visible, mounted, initialScrollOffset, folding, contentHeight]);

    const triggerNode = trigger?.({ covered: mounted });
    if (!mounted) return triggerNode ? <>{triggerNode}</> : null;

    const a = lastAnchor.current || { x: space.lg, y: 0, width: 0, height: 0 };
    const leftInset = actions || connected ? Math.max(space.lg, insets.left || 0) : space.lg;
    const rightInset = actions || connected ? Math.max(space.lg, insets.right || 0) : space.lg;
    const panelWidth = connected ? Math.min(a.width, winW - leftInset - rightInset)
        : glass ? Math.min(maxWidth, winW - leftInset - rightInset)
        : select && a.width
        ? Math.min(a.width, winW - space.sm * 2)
        : maxWidth;
    // Clamp horizontally so a menu anchored near the right edge folds back on
    // screen instead of running off it.
    const left = glass
        ? Math.max(leftInset, Math.min(a.x + a.width - panelWidth, winW - panelWidth - rightInset))
        : Math.max(space.sm, Math.min(a.x, winW - panelWidth - space.sm));
    const below = winH - insets.bottom - (a.y + a.height + 12) - space.lg;
    const above = a.y - insets.top - 12 - space.lg;
    const aboveAnchor = glass && !connected && below < (panelHeight || 300) && above > below;
    const top = connected ? Math.max(insets.top + space.sm, Math.min(a.y, winH - insets.bottom - space.sm - a.height - MIN_TOUCH - 16))
        : glass ? aboveAnchor
        ? Math.max(insets.top + space.lg, a.y - (panelHeight || 300) - 12)
        : a.y + a.height + 12
        : a.y + a.height + space.xs;
    // Whatever vertical room is left below the anchor, minus a margin — the
    // list scrolls inside this rather than overflowing the screen.
    const maxHeight = connected ? winH - insets.bottom - space.sm - top
        : glass ? Math.max(80, aboveAnchor ? above : below) : Math.max(160, winH - top - space.xxl);
    const cardStyle = StyleSheet.flatten([styles.card, select && styles.selectCard, glass && glassStyles.card, connected && glassStyles.connectedCard]);
    const foldHeight = Math.min((connected ? a.height : 0) + contentHeight + 2 * ((cardStyle.paddingVertical || 0) + (cardStyle.borderWidth || 0)), maxHeight);
    const pointerCenter = a.x + a.width / 2 - left;
    const pointerX = Math.max(28, Math.min(panelWidth - 28, pointerCenter));
    const showPointer = glass && !connected && Math.abs(pointerX - pointerCenter) <= 18;
    const supportsBlur = Platform.OS === "web"
        ? Boolean(globalThis.CSS?.supports?.("backdrop-filter", "blur(1px)") || globalThis.CSS?.supports?.("-webkit-backdrop-filter", "blur(1px)"))
        : Platform.OS === "ios" || (Platform.OS === "android" && Number(Platform.Version) >= 31 && !!blurTarget);
    const Content = connected ? View : React.Fragment;

    return (<>
        {triggerNode}
        <Modal visible transparent animationType="none" onRequestClose={onClose}>
            {/* A light scrim, not a heavy modal backdrop: this is a menu hanging
                off a control, and the page behind it should stay legible. */}
            <Animated.View style={[styles.scrim, (select || actions || !dimBackdrop) && styles.selectScrim, { opacity: anim }]} />
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
            />
            <Animated.View
                testID="anchored-menu-panel"
                accessibilityViewIsModal
                onLayout={(glass && !folding)
                    ? (event) => { const height = Math.round(event.nativeEvent.layout.height);
                        if (height > 0 && height !== panelHeight) setPanelHeight(height); }
                    : undefined}
                style={[
                    cardStyle,
                    // Sample behind the animated element, not inside its temporary opacity root.
                    glass && supportsBlur && Platform.OS === "web" && glassStyles.webBlur,
                    {
                        left,
                        top,
                        ...(select || glass ? { width: panelWidth } : { minWidth, maxWidth }),
                        maxHeight,
                        opacity: connected ? 1 : anim,
                        ...(folding && (contentHeight || connected)
                            ? {
                                  height: anim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [connected ? a.height : 0, connected && !contentHeight ? a.height : foldHeight],
                                  }),
                                  overflow: connected ? "visible" : "hidden",
                              }
                            : null),
                        // The default menu scales from its top-left corner;
                        // fold mode clips its measured height from the top.
                        // transformOrigin needs RN 0.74+ (this project is on 0.85).
                        transformOrigin: actions ? `${pointerX}px ${aboveAnchor ? "bottom" : "top"}` : warping ? "top right" : "top left",
                        transform: folding
                            ? []
                            : warping
                              ? [
                                    {
                                        scaleX: anim.interpolate({
                                            inputRange: [0, 0.78, 1],
                                            outputRange: [0.28, 1.04, 1],
                                        }),
                                    },
                                    {
                                        scaleY: anim.interpolate({
                                            inputRange: [0, 0.78, 1],
                                            outputRange: [0.12, 0.98, 1],
                                        }),
                                    },
                                ]
                              : [
                                    {
                                        scale: anim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.8, 1],
                                        }),
                                    },
                                ],
                    },
                ]}
            >
                <Content {...(connected ? { style: { flex: 1, borderRadius: 22, overflow: "hidden" } } : {})}>
                {glass && <>
                    {showPointer && <View pointerEvents="none" style={[glassStyles.pointer, { left: pointerX - 10 }, aboveAnchor ? glassStyles.pointerBelow : glassStyles.pointerAbove]}>
                        <Svg width="20" height="12" viewBox="0 0 20 12"><Path d="M1 11 L10 1 L19 11 Z" fill={material.panel[0]} stroke={material.rimLight} strokeWidth="1.5" /></Svg>
                    </View>}
                    <View pointerEvents="none" style={[glassStyles.surface, connected && glassStyles.connectedSurface]}>
                        {supportsBlur && Platform.OS !== "web" ? <BlurView blurTarget={blurTarget} blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
                                intensity={80} tint={Platform.OS === "android" ? "default" : scheme === "dark" ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
                                style={StyleSheet.absoluteFillObject} /> : null}
                        <Gradient colors={supportsBlur ? material.popoverPanel : [material.fallback, material.fallback]} style={StyleSheet.absoluteFillObject} />
                        <GlassLighting material={material} radius={connected ? 22 : 26} panel />
                    </View>
                </>}
                {connected ? <View style={{ height: a.height, flexShrink: 0 }}>{header}</View> : null}
                <ScrollView
                    ref={scrollRef}
                    onContentSizeChange={folding ? (_, height) => {
                        // Measuring the animated panel would feed its shrinking frames back into the target.
                        if (Number.isFinite(height) && height > 0) setContentHeight(Math.ceil(height));
                    } : undefined}
                    style={connected ? { flexShrink: 1, minHeight: 0, opacity: anim } : undefined}
                    contentContainerStyle={glass ? [glassStyles.content, actions && glassStyles.actionContent, connected && glassStyles.connectedContent] : undefined}
                    showsVerticalScrollIndicator={select && (!connected || foldHeight < a.height + contentHeight)}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    {children}
                </ScrollView>
                </Content>
            </Animated.View>
        </Modal>
    </>);
}

// A row inside the menu. Exported so callers don't rebuild the same layout and
// drift apart on padding.
export function AnchoredMenuItem({ label, note, selected, leading, onPress, accessibilityLabel, variant = "menu", divider = false, disabled = false }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const connected = variant === "connectedSelect";
    const select = variant === "select" || connected;
    const action = variant === "action";
    const [focused, setFocused] = useState(false);
    return (
        <TouchableOpacity
            style={[styles.item, select && styles.selectItem, action && styles.actionItem,
                action && divider && styles.actionDivider, selected && (select ? styles.selectItemOn : styles.itemOn),
                connected && styles.connectedItem, connected && selected && styles.connectedItemOn,
                (action || connected) && disabled && { opacity: 0.5 }, (action || connected) && focused && Platform.OS === "web" && styles.actionFocus]}
            onPress={onPress}
            onFocus={() => (action || connected) && setFocused(true)} onBlur={() => (action || connected) && setFocused(false)}
            disabled={disabled} activeOpacity={action || connected ? 0.85 : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: !!selected, ...(disabled ? { disabled: true } : {}) }}
            {...(connected && Platform.OS === "web" ? { "aria-pressed": !!selected } : {})}
            accessibilityLabel={accessibilityLabel || (note ? `${label}, ${note}` : label)}
        >
            {connected && selected ? <>
                <Gradient pointerEvents="none" colors={colors.growthDropdownGlass.selected} style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]} />
                <GlassLighting material={colors.growthDropdownGlass} radius={14} panel />
            </> : null}
            {leading || null}
            <View style={styles.itemText}>
                <Text style={[styles.itemLabel, select && styles.selectItemLabel, action && styles.actionLabel,
                    selected && (select ? styles.selectItemLabelOn : styles.itemLabelOn), connected && styles.connectedLabel]} numberOfLines={action || connected ? undefined : 2}>
                    {label}
                </Text>
                {note ? <Text style={[styles.itemNote, select && styles.selectItemNote]}>{note}</Text> : null}
            </View>
            {/* A checkmark as well as the tint — colour must never be the only
                signal that a row is the selected one. */}
            {selected && !select ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
        </TouchableOpacity>
    );
}

export function AnchoredMenuFooter({ icon = "add", label, onPress }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <TouchableOpacity
            style={styles.footer}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Ionicons name={icon} size={18} color={colors.primaryDark} />
            <Text style={styles.footerText}>{label}</Text>
        </TouchableOpacity>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22,32,42,0.18)" },
        selectScrim: { backgroundColor: "transparent" },
        card: {
            position: "absolute",
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.hairline,
            paddingVertical: space.xs,
            paddingHorizontal: space.xs,
            ...shadow.raised,
        },
        selectCard: {
            paddingVertical: 0,
            paddingHorizontal: 0,
            borderRadius: radius.md,
        },
        item: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            minHeight: MIN_TOUCH,
            paddingVertical: space.xs,
            paddingHorizontal: space.sm,
            borderRadius: radius.md,
            borderCurve: "continuous",
        },
        itemOn: { backgroundColor: colors.primarySoft },
        actionItem: { minHeight: 56, gap: 16, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 0 },
        actionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.actionMenuGlass.divider },
        actionLabel: { ...type.bodyStrong, fontSize: 17, lineHeight: 24, color: colors.actionMenuGlass.text },
        actionFocus: { outlineStyle: "solid", outlineWidth: 2, outlineOffset: -2, outlineColor: colors.actionMenuGlass.accent,
            backgroundColor: colors.actionMenuGlass.pressed },
        selectItem: {
            minHeight: 38,
            paddingVertical: space.xs,
            paddingHorizontal: space.md,
            borderRadius: 0,
        },
        selectItemOn: { backgroundColor: colors.surfaceAlt },
        connectedItem: { minHeight: MIN_TOUCH, paddingHorizontal: 10, paddingVertical: 10, gap: 10, borderRadius: 14, backgroundColor: "transparent" },
        connectedItemOn: { boxShadow: colors.growthDropdownGlass.selectedShadow },
        connectedLabel: { ...type.label, fontSize: 14, lineHeight: 20, color: colors.growthDropdownGlass.text },
        itemText: { flex: 1, minWidth: 0 },
        itemLabel: { ...type.body, color: colors.text },
        itemLabelOn: { ...type.bodyStrong, color: colors.primaryDark },
        selectItemLabel: { ...type.caption, color: colors.text },
        selectItemLabelOn: { ...type.label, color: colors.text },
        itemNote: { ...type.caption, color: colors.danger },
        selectItemNote: { color: colors.textMuted },
        footer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.xs,
            minHeight: MIN_TOUCH,
            marginTop: space.xs,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
        },
        footerText: { ...type.label, color: colors.primaryDark },
    });

const makeGlassStyles = material => StyleSheet.create({
    card: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 26, paddingHorizontal: 0, paddingVertical: 0,
        boxShadow: material.panelShadow },
    surface: { ...StyleSheet.absoluteFillObject, borderRadius: 26, overflow: "hidden" },
    webBlur: { backdropFilter: "blur(22px) saturate(150%)", WebkitBackdropFilter: "blur(22px) saturate(150%)" },
    content: { padding: 14, gap: 10 },
    actionContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 0 },
    connectedCard: { borderRadius: 22 },
    connectedSurface: { borderRadius: 22 },
    connectedContent: { padding: 8, gap: 4 },
    pointer: { position: "absolute", width: 20, height: 12, zIndex: 1 },
    pointerAbove: { top: -10 },
    pointerBelow: { bottom: -10, transform: [{ rotate: "180deg" }] },
});
