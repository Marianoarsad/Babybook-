import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// A bottom-sheet list for picking one option out of many.
//
// Built for the Development Checklist's age menu, which replaced a horizontal
// row of twelve pills: in a scroller most options sat off-screen, the selected
// one could scroll out of view, and keeping it visible needed a hard-coded
// pixel stride that went wrong the moment the pill padding changed.
//
// Lives in ui/ beside ActionSheet.js and AddMemoryModal.js, and follows
// ActionSheet's structure deliberately — dimmed ground, top-rounded card,
// grabber, scrolling rows, a close control at the foot — so the app has one
// bottom-sheet idiom rather than two that almost match.
//
//   options:     [{ key, label, note }] — `note` is muted text on the right
//   selectedKey: the currently chosen key
//
// Rows are a fixed height so the selected one can be scrolled into view on
// open without measuring. Keep ROW_STRIDE in step with styles.item.
const ROW_STRIDE = 52;

export default function OptionSheet({
    visible,
    title,
    options = [],
    selectedKey,
    onSelect,
    onClose,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const scrollRef = useRef(null);

    // The whole point of the menu is that it opens on the current choice. With
    // twelve ages the last few sit below the fold, so selecting without
    // scrolling would look like it opened at the top.
    useEffect(() => {
        if (!visible || !scrollRef.current) return;
        const index = options.findIndex((o) => o.key === selectedKey);
        if (index < 1) return;
        scrollRef.current.scrollTo({ x: 0, y: (index - 1) * ROW_STRIDE, animated: false });
    }, [visible, selectedKey, options]);

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
                    {title ? (
                        <Text style={styles.title} accessibilityRole="header">
                            {title}
                        </Text>
                    ) : null}

                    <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false}>
                        {options.map((o) => {
                            const on = o.key === selectedKey;
                            return (
                                <TouchableOpacity
                                    key={String(o.key)}
                                    style={[styles.item, on && styles.itemOn]}
                                    onPress={() => onSelect(o.key)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: on }}
                                    accessibilityLabel={o.note ? `${o.label}, ${o.note}` : o.label}
                                >
                                    <Text style={[styles.itemText, on && styles.itemTextOn]}>
                                        {o.label}
                                    </Text>
                                    {o.note ? <Text style={styles.itemNote}>{o.note}</Text> : null}
                                    {/* A checkmark as well as the tint — colour
                                        must never be the only signal. */}
                                    {on ? (
                                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.cancel}
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                    >
                        <Text style={styles.cancelText}>Close</Text>
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
        scroll: { maxHeight: 460 },
        item: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            minHeight: MIN_TOUCH,
            paddingHorizontal: space.md,
            marginBottom: space.xs,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
        },
        itemOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        itemText: { ...type.body, color: colors.text, flex: 1 },
        itemTextOn: { ...type.bodyStrong, color: colors.primaryDark },
        itemNote: { ...type.caption, color: colors.textMuted },
        cancel: {
            minHeight: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
            marginTop: space.md,
        },
        cancelText: { ...type.label, color: colors.textSecondary },
    });
