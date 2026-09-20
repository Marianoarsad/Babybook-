import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AccessibilityInfo,
    Animated,
    Easing,
    PanResponder,
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    useWindowDimensions,
} from "react-native";
import Modal from "./AppModal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { recordSheetHeight } from "../../utils/responsive";
import { radius, space, shadow, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { storage } from "../../utils/storageAdapter";

// The "+" button's sheet. Lifted out of App.js, which was already very large
// and does not need this component's own storage-backed state.
//
// Two things shape the layout. First, a parent's use of these nine actions is
// wildly uneven — milk many times a day, a hospital stay perhaps once — but
// the old sheet was nine identical rows in one scrolling list, with the last
// entries below a fold the parent had to discover. Second, the app already
// owns a colour per record type (theme.js's rec* tokens, used on every list
// row elsewhere), and the sheet was rendering all nine icons in one flat
// primary.
//
// `tab` values are deep-link keys read by the destination screen. Health.js
// and Growth.js both follow the same rule: a plain tab name only switches
// tabs, an alias switches AND opens a form. Every entry here is an alias,
// because every entry here is meant to open something.
const ACTIONS = {
    milk: { label: "Milk", icon: "water-outline", tint: "recNutrition", view: "nutrition", tab: "milk" },
    food: { label: "Food", icon: "restaurant-outline", tint: "recNutrition", view: "nutrition", tab: "solid" },
    growth: { label: "Growth", icon: "resize-outline", tint: "recGrowth", view: "growth", tab: "metrics" },
    vaccine: { label: "Vaccine", icon: "medkit-outline", tint: "recVaccine", view: "health", tab: "vaccine" },
    checkup: { label: "Checkup", icon: "calendar-outline", tint: "recCheckup", view: "health", tab: "checkup" },
    medication: { label: "Medication", icon: "medical-outline", tint: "recMedication", view: "health", tab: "medication" },
    illness: { label: "Illness", icon: "thermometer-outline", tint: "recIllness", view: "health", tab: "illness" },
    hospitalization: { label: "Hospital stay", icon: "bed-outline", tint: "recHospitalization", view: "health", tab: "hospitalization" },
    // One entry, because it opens one form that saves either kind.
    memory: { label: "Photo or milestone", icon: "image-outline", tint: "recMemory", view: "growth", tab: "memory" },
};

// Fixed groups, in a fixed order. This list must never reorder itself — the
// shortcut row above it is what adapts. If both moved, the muscle memory the
// shortcut exists to build would be destroyed every time the counts shifted.
const GROUPS = [
    { title: "Everyday", keys: ["milk", "food", "growth"] },
    { title: "Health", keys: ["vaccine", "checkup", "medication", "illness", "hospitalization"] },
    { title: "Keepsake", keys: ["memory"] },
];

// Order used to seed the shortcut row before this parent has tapped anything,
// and to break ties afterwards so it never shuffles arbitrarily.
const DEFAULT_ORDER = ["milk", "food", "growth", "vaccine", "checkup", "medication", "illness", "hospitalization", "memory"];
const USAGE_KEY = "bb_action_usage";
const SHORTCUTS = 3;

function useActionSheetMotion(visible, height, onClose) {
    const [presented, setPresented] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(null);
    const offset = useRef(new Animated.Value(height)).current;
    const shade = useRef(new Animated.Value(0)).current;
    const phase = useRef("hidden");
    const generation = useRef(0);
    const animation = useRef(null);
    const pending = useRef(null);
    const wasVisible = useRef(false);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled().then((value) => active && setReduceMotion(value))
            .catch(() => active && setReduceMotion(false));
        const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
        return () => { active = false; subscription.remove(); };
    }, []);
    useEffect(() => () => {
        generation.current++;
        animation.current?.stop();
        pending.current = null;
    }, []);

    const animate = useCallback((target, duration, complete) => {
        const token = ++generation.current;
        animation.current?.stop();
        if (reduceMotion) {
            offset.setValue(target);
            shade.setValue(target === 0 ? 1 : 0);
            complete();
            return;
        }
        animation.current = Animated.parallel([
            Animated.timing(offset, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(shade, { toValue: target === 0 ? 1 : 0, duration, useNativeDriver: true }),
        ]);
        animation.current.start(({ finished }) => {
            if (finished && generation.current === token) complete();
        });
    }, [offset, shade, reduceMotion]);
    const finishClose = useCallback(() => {
        const callback = pending.current;
        pending.current = null;
        phase.current = "hidden";
        setPresented(false);
        callback?.();
    }, []);
    const dismiss = useCallback((afterClose) => {
        if (phase.current === "hidden" || phase.current === "closing") return;
        pending.current = afterClose || (() => closeRef.current());
        phase.current = "closing";
        animate(height, 220, finishClose);
    }, [animate, height, finishClose]);

    useEffect(() => {
        if (reduceMotion === null) return;
        const opening = visible && !wasVisible.current;
        wasVisible.current = visible;
        if (visible) {
            if (phase.current === "closing" && !opening) {
                animate(height, 220, finishClose);
                return;
            }
            if (phase.current === "hidden" || opening) offset.setValue(height);
            pending.current = null;
            phase.current = "opening";
            setPresented(true);
            animate(0, 280, () => { phase.current = "open"; });
        } else if (phase.current !== "hidden") {
            pending.current = null;
            phase.current = "closing";
            animate(height, 220, finishClose);
        }
    }, [visible, height, reduceMotion, animate, finishClose, offset]);

    const recover = useCallback(() => {
        if (phase.current !== "dragging") return;
        phase.current = "settling";
        animate(0, 160, () => { phase.current = "open"; });
    }, [animate]);
    const pan = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => phase.current === "open"
            && gesture.dy > 12 && gesture.dy > Math.abs(gesture.dx) * 1.25,
        onPanResponderGrant: () => { if (phase.current === "open") phase.current = "dragging"; },
        onPanResponderMove: (_event, gesture) => {
            if (phase.current !== "dragging") return;
            const distance = Math.max(0, Math.min(height, gesture.dy));
            offset.setValue(distance);
            shade.setValue(1 - distance / Math.max(1, height));
        },
        onPanResponderRelease: (_event, gesture) => {
            if (phase.current !== "dragging") return;
            if (gesture.dy >= 64) dismiss(); else recover();
        },
        onPanResponderTerminate: recover,
    }), [dismiss, height, offset, recover, shade]);
    return { presented, offset, shade, pan, dismiss };
}

export default function ActionSheet({ visible, onClose, onSelect }) {
    const { colors } = useTheme();
    const { height: windowHeight, fontScale } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const sheetHeight = recordSheetHeight(windowHeight, fontScale, insets.top, insets.bottom);
    const motion = useActionSheetMotion(visible, sheetHeight, onClose);
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [usage, setUsage] = useState({});

    useEffect(() => {
        storage
            .getItem(USAGE_KEY)
            .then((raw) => {
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") setUsage(parsed);
            })
            // A corrupt or absent counter must never stop the sheet opening —
            // it just falls back to the default order.
            .catch(() => {});
    }, []);

    const topKeys = useMemo(() => {
        return [...DEFAULT_ORDER]
            .sort((a, b) => {
                const diff = (usage[b] || 0) - (usage[a] || 0);
                return diff !== 0 ? diff : DEFAULT_ORDER.indexOf(a) - DEFAULT_ORDER.indexOf(b);
            })
            .slice(0, SHORTCUTS);
    }, [usage]);

    const choose = useCallback(
        (key) => {
            motion.dismiss(() => {
                const next = { ...usage, [key]: (usage[key] || 0) + 1 };
                setUsage(next);
                storage.setItem(USAGE_KEY, JSON.stringify(next)).catch(() => {});
                const a = ACTIONS[key];
                onSelect(a.view, a.tab);
            });
        },
        [usage, onSelect, motion.dismiss],
    );

    return (
        <Modal visible={motion.presented} transparent animationType="none" onRequestClose={() => motion.dismiss()}>
            <View style={[styles.root, { paddingTop: Math.max(insets.top, space.md) }]}>
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.text + "66", opacity: motion.shade }]} />
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => motion.dismiss()}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                />
                <Animated.View style={[styles.card, { height: sheetHeight, paddingBottom: Math.max(space.xl, insets.bottom), transform: [{ translateY: motion.offset }] }]}
                    accessibilityViewIsModal onAccessibilityEscape={() => motion.dismiss()}>
                    <View {...motion.pan.panHandlers} style={{ touchAction: "none" }}>
                        <View style={styles.grabber} />
                        <Text style={styles.title} accessibilityRole="header">
                            Add a record
                        </Text>
                    </View>

                    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                        <Text style={styles.groupTitle} accessibilityRole="header">
                            Most used
                        </Text>
                        <View style={styles.shortcutRow}>
                            {topKeys.map((key) => {
                                const a = ACTIONS[key];
                                const tint = colors[a.tint];
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        style={styles.shortcut}
                                        onPress={() => choose(key)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Add ${a.label}`}
                                    >
                                        <View style={[styles.shortcutIcon, { backgroundColor: tint.bg }]}>
                                            <Ionicons name={a.icon} size={22} color={tint.on} />
                                        </View>
                                        <Text style={styles.shortcutText} numberOfLines={1}>
                                            {a.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {GROUPS.map((g) => (
                            <View key={g.title}>
                                <Text style={styles.groupTitle} accessibilityRole="header">
                                    {g.title}
                                </Text>
                                {g.keys.map((key) => {
                                    const a = ACTIONS[key];
                                    const tint = colors[a.tint];
                                    return (
                                        <TouchableOpacity
                                            key={key}
                                            style={styles.item}
                                            onPress={() => choose(key)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Add ${a.label}`}
                                        >
                                            <View style={[styles.itemIcon, { backgroundColor: tint.bg }]}>
                                                <Ionicons name={a.icon} size={19} color={tint.on} />
                                            </View>
                                            <Text style={styles.itemText}>{a.label}</Text>
                                            <Ionicons
                                                name="chevron-forward"
                                                size={16}
                                                color={colors.textMuted}
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.cancel}
                        onPress={() => motion.dismiss()}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: { flex: 1, justifyContent: "flex-end" },
        card: {
            width: "100%",
            maxHeight: "100%",
            flexShrink: 1,
            minHeight: 0,
            backgroundColor: colors.background,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderCurve: "continuous",
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: space.xl,
            ...shadow.raised,
        },
        grabber: {
            width: 36,
            height: 4,
            borderRadius: radius.pill,
            backgroundColor: colors.border,
            alignSelf: "center",
            marginBottom: space.md,
        },
        title: { ...type.heading, color: colors.text, textAlign: "center", marginBottom: space.sm },
        scroll: { flex: 1, minHeight: 0 },
        groupTitle: {
            ...type.subheading,
            color: colors.textMuted,
            marginTop: space.md,
            marginBottom: space.sm,
        },

        // Shortcut row — three equal, larger targets.
        shortcutRow: { flexDirection: "row", gap: space.sm },
        shortcut: {
            flex: 1,
            alignItems: "center",
            gap: space.xs,
            paddingVertical: space.md,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
        },
        shortcutIcon: {
            width: 44,
            height: 44,
            borderRadius: radius.md,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
        },
        shortcutText: { ...type.label, color: colors.text },

        item: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            minHeight: MIN_TOUCH,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            marginBottom: space.sm,
        },
        itemIcon: {
            width: 36,
            height: 36,
            borderRadius: radius.md,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
        },
        itemText: { ...type.bodyStrong, color: colors.text, flex: 1 },

        cancel: {
            marginTop: space.md,
            minHeight: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
        },
        cancelText: { ...type.label, color: colors.textSecondary },
    });
