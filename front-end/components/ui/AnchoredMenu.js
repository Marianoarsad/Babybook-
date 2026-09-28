import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    AccessibilityInfo,
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    TouchableOpacity,
    Animated,
    Easing,
    useWindowDimensions,
} from "react-native";
import Modal from "./AppModal";
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
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { width: winW, height: winH } = useWindowDimensions();
    const select = variant === "select";
    const animationMode = animation || (select ? "fold" : "scale");
    const folding = animationMode === "fold";
    const warping = animationMode === "warp";

    // Kept mounted for the exit animation — unmounting on `visible` going false
    // would snap the menu away instead of letting it animate closed.
    const [mounted, setMounted] = useState(visible);
    const [panelHeight, setPanelHeight] = useState(0);
    const [reduceMotion, setReduceMotion] = useState(true);
    const anim = useRef(new Animated.Value(0)).current;
    const scrollRef = useRef(null);

    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled()
            .then((enabled) => active && setReduceMotion(enabled))
            .catch(() => {});
        const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
        return () => {
            active = false;
            subscription?.remove?.();
        };
    }, []);

    // Mount/prepare and exit are keyed only by visibility. Fold menus clear the
    // old measurement on every open because option counts can change while the
    // menu is closed (for example Nutrition's available measures).
    useEffect(() => {
        if (visible) {
            anim.stopAnimation();
            anim.setValue(0);
            if (folding) setPanelHeight(0);
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
    }, [visible, anim, folding, reduceMotion]);

    useEffect(() => {
        if (!visible || !mounted || (folding && !panelHeight)) return;
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
    }, [visible, mounted, anim, folding, warping, panelHeight, reduceMotion]);

    useEffect(() => {
        if (!visible || !mounted || !initialScrollOffset || (folding && !panelHeight)) return;
        scrollRef.current?.scrollTo({ x: 0, y: initialScrollOffset, animated: false });
    }, [visible, mounted, initialScrollOffset, folding, panelHeight]);

    if (!mounted) return null;

    const a = anchor || { x: space.lg, y: 0, width: 0, height: 0 };
    const panelWidth = select && a.width
        ? Math.min(a.width, winW - space.sm * 2)
        : maxWidth;
    // Clamp horizontally so a menu anchored near the right edge folds back on
    // screen instead of running off it.
    const left = Math.max(space.sm, Math.min(a.x, winW - panelWidth - space.sm));
    const top = a.y + a.height + space.xs;
    // Whatever vertical room is left below the anchor, minus a margin — the
    // list scrolls inside this rather than overflowing the screen.
    const maxHeight = Math.max(160, winH - top - space.xxl);

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose}>
            {/* A light scrim, not a heavy modal backdrop: this is a menu hanging
                off a control, and the page behind it should stay legible. */}
            <Animated.View style={[styles.scrim, (select || !dimBackdrop) && styles.selectScrim, { opacity: anim }]} />
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
            />
            <Animated.View
                accessibilityViewIsModal
                onLayout={folding && !panelHeight
                    ? (event) => setPanelHeight(event.nativeEvent.layout.height)
                    : undefined}
                style={[
                    styles.card,
                    select && styles.selectCard,
                    {
                        left,
                        top,
                        ...(select ? { width: panelWidth } : { minWidth, maxWidth }),
                        maxHeight,
                        opacity: anim,
                        ...(folding && panelHeight
                            ? {
                                  height: anim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [0, panelHeight],
                                  }),
                                  overflow: "hidden",
                              }
                            : null),
                        // The default menu scales from its top-left corner;
                        // fold mode clips its measured height from the top.
                        // transformOrigin needs RN 0.74+ (this project is on 0.85).
                        transformOrigin: warping ? "top right" : "top left",
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
                <ScrollView
                    ref={scrollRef}
                    showsVerticalScrollIndicator={select}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    {children}
                </ScrollView>
            </Animated.View>
        </Modal>
    );
}

// A row inside the menu. Exported so callers don't rebuild the same layout and
// drift apart on padding.
export function AnchoredMenuItem({ label, note, selected, leading, onPress, accessibilityLabel, variant = "menu" }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const select = variant === "select";
    return (
        <TouchableOpacity
            style={[styles.item, select && styles.selectItem, selected && (select ? styles.selectItemOn : styles.itemOn)]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: !!selected }}
            accessibilityLabel={accessibilityLabel || (note ? `${label}, ${note}` : label)}
        >
            {leading || null}
            <View style={styles.itemText}>
                <Text style={[styles.itemLabel, select && styles.selectItemLabel, selected && (select ? styles.selectItemLabelOn : styles.itemLabelOn)]} numberOfLines={2}>
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
        selectItem: {
            minHeight: 38,
            paddingVertical: space.xs,
            paddingHorizontal: space.md,
            borderRadius: 0,
        },
        selectItemOn: { backgroundColor: colors.surfaceAlt },
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
