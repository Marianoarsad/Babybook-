import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    ScrollView,
    Pressable,
    TouchableOpacity,
    Animated,
    Easing,
    useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, motion, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// A menu that opens directly beneath the control that summoned it, rather than
// sliding a sheet up from the bottom of the screen.
//
// This exists alongside ui/OptionSheet.js on purpose, and the split is by
// SHAPE, not by feature:
//
//   OptionSheet  — a long list you commit to reading (12 age bands, a vaccine
//                  catalogue). It owns the bottom of the screen, and its size
//                  has nothing to do with whatever opened it.
//   AnchoredMenu — a short list that belongs to a specific control, and reads
//                  as an extension of it. Losing the connection to the anchor
//                  is losing the point.
//
// If you are adding a third, decide which of those two it is before writing a
// new component.
//
//   anchor: { x, y, width, height } in window coordinates, from the trigger's
//           measureInWindow(). The menu left-aligns to `x` and drops below
//           `y + height`, clamped so it never leaves the screen.
export default function AnchoredMenu({
    visible,
    anchor,
    onClose,
    children,
    minWidth = 240,
    // 300, not 340: at 340 on a 360pt screen the panel left 8px of page beside
    // it and read as a full-width sheet rather than a menu hanging off the
    // title. The reference leaves a visible strip of content down the side.
    maxWidth = 300,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { width: winW, height: winH } = useWindowDimensions();

    // Kept mounted for the exit animation — unmounting on `visible` going false
    // would snap the menu away instead of letting it scale back down.
    const [mounted, setMounted] = useState(visible);
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.timing(anim, {
                toValue: 1,
                duration: motion.entrance.duration,
                easing: Easing.bezier(...motion.entrance.bezier),
                useNativeDriver: true,
            }).start();
            return;
        }
        Animated.timing(anim, {
            toValue: 0,
            duration: motion.standard.duration,
            easing: Easing.bezier(...motion.standard.bezier),
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) setMounted(false);
        });
    }, [visible, anim]);

    if (!mounted) return null;

    const a = anchor || { x: space.lg, y: 0, width: 0, height: 0 };
    // Clamp horizontally so a menu anchored near the right edge folds back on
    // screen instead of running off it.
    const left = Math.max(space.sm, Math.min(a.x, winW - maxWidth - space.sm));
    const top = a.y + a.height + space.xs;
    // Whatever vertical room is left below the anchor, minus a margin — the
    // list scrolls inside this rather than overflowing the screen.
    const maxHeight = Math.max(160, winH - top - space.xxl);

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose}>
            {/* A light scrim, not a heavy modal backdrop: this is a menu hanging
                off a control, and the page behind it should stay legible. */}
            <Animated.View style={[styles.scrim, { opacity: anim }]} />
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
            />
            <Animated.View
                accessibilityViewIsModal
                style={[
                    styles.card,
                    {
                        left,
                        top,
                        minWidth,
                        maxWidth,
                        maxHeight,
                        opacity: anim,
                        // Grows out of its own top-left corner, so it reads as
                        // unfolding from the control rather than appearing over
                        // it. transformOrigin needs RN 0.74+ (this project is
                        // on 0.85).
                        transformOrigin: "top left",
                        transform: [
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
                    showsVerticalScrollIndicator={false}
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
export function AnchoredMenuItem({ label, note, selected, leading, onPress, accessibilityLabel }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <TouchableOpacity
            style={[styles.item, selected && styles.itemOn]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: !!selected }}
            accessibilityLabel={accessibilityLabel || (note ? `${label}, ${note}` : label)}
        >
            {leading || null}
            <View style={styles.itemText}>
                <Text style={[styles.itemLabel, selected && styles.itemLabelOn]} numberOfLines={2}>
                    {label}
                </Text>
                {note ? <Text style={styles.itemNote}>{note}</Text> : null}
            </View>
            {/* A checkmark as well as the tint — colour must never be the only
                signal that a row is the selected one. */}
            {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
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
        itemText: { flex: 1, minWidth: 0 },
        itemLabel: { ...type.body, color: colors.text },
        itemLabelOn: { ...type.bodyStrong, color: colors.primaryDark },
        itemNote: { ...type.caption, color: colors.danger },
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
