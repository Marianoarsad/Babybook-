import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    ScrollView,
    TouchableOpacity,
    useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

export default function ActionSheet({ visible, onClose, onSelect }) {
    const { colors } = useTheme();
    const { height: windowHeight } = useWindowDimensions();
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
            const next = { ...usage, [key]: (usage[key] || 0) + 1 };
            setUsage(next);
            storage.setItem(USAGE_KEY, JSON.stringify(next)).catch(() => {});
            const a = ACTIONS[key];
            onSelect(a.view, a.tab);
        },
        [usage, onSelect],
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.root}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                />
                <View style={styles.card} accessibilityViewIsModal>
                    <View style={styles.grabber} />
                    <Text style={styles.title} accessibilityRole="header">
                        Add a record
                    </Text>

                    <ScrollView style={[styles.scroll, { maxHeight: windowHeight * 0.55 }]} showsVerticalScrollIndicator={false}>
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
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,25,23,0.45)" },
        card: {
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
        // maxHeight is applied inline as a fraction of the window — a fixed
        // 460 was taller than the room a short phone actually has once the
        // grabber, title, cancel row and safe-area inset are accounted for.
        scroll: {},
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
