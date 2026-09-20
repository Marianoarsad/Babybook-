import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Modal from "./AppModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, radius, shadow, space, type } from "../../theme";
import { shortDate, shortTime } from "../../utils/dates";
import Gradient from "./Gradient";

function longDate(value) {
    const date = new Date(`${String(value || "").slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? "Date not recorded"
        : date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
          });
}

function DetailRow({ label, value, color, styles }) {
    if (!value) return null;
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <View style={styles.detailValueRow}>
                {color ? <View style={[styles.colorDot, { backgroundColor: color }]} /> : null}
                <Text style={styles.detailValue} selectable>{value}</Text>
            </View>
        </View>
    );
}

export default function PlanDetail({ visible, plan, onClose, onEdit, onDelete, deleting = false }) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    if (!plan) return null;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <Gradient
                colors={colors.pageGradient}
                locations={[0, 0.5, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.root}
            >
                <View style={[styles.header, { paddingTop: Math.max(space.lg, insets.top + space.sm) }]}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.headerPill}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                    >
                        <Ionicons name="chevron-back" size={22} color={colors.text} />
                        <Text style={styles.headerPillText}>{shortDate(plan.date) || "Back"}</Text>
                    </TouchableOpacity>
                    {onEdit ? (
                        <TouchableOpacity
                            onPress={onEdit}
                            style={styles.headerPill}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${plan.title}`}
                        >
                            <Text style={styles.headerPillText}>Edit</Text>
                        </TouchableOpacity>
                    ) : <View />}
                </View>

                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                >
                    <View>
                        <Text style={styles.title} selectable>{plan.title || "Untitled plan"}</Text>
                        <Text style={styles.date} selectable>{longDate(plan.date)}</Text>
                        <Text style={styles.time} selectable>{plan.time ? shortTime(plan.time) : "All-day"}</Text>
                    </View>

                    <View style={styles.rows}>
                        <DetailRow label="Type" value={plan.categoryLabel} color={plan.color} styles={styles} />
                        <DetailRow label="Status" value={plan.status} styles={styles} />
                        {(plan.details || []).map((detail) => (
                            <DetailRow key={`${detail.label}:${detail.value}`} {...detail} styles={styles} />
                        ))}
                        {plan.showReminder === false ? null : (
                            <DetailRow label="Alert" value={plan.reminderLabel || "None"} styles={styles} />
                        )}
                    </View>

                    <View style={styles.notesCard}>
                        <Text style={styles.notesLabel}>Notes</Text>
                        <Text style={plan.notes ? styles.notes : styles.notesEmpty} selectable>
                            {plan.notes || "No notes added."}
                        </Text>
                    </View>

                    {onDelete ? (
                        <TouchableOpacity
                            onPress={onDelete}
                            style={styles.deleteButton}
                            disabled={deleting}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${plan.title}`}
                            accessibilityState={{ disabled: deleting, busy: deleting }}
                        >
                            {(<Text style={styles.deleteText}>{plan.deleteLabel || "Delete plan"}</Text>)}
                        </TouchableOpacity>
                    ) : null}
                </ScrollView>
            </Gradient>
        </Modal>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
    },
    headerPill: {
        minHeight: MIN_TOUCH,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    headerPillText: { ...type.subheading, color: colors.text },
    content: { flexGrow: 1, padding: space.xl, paddingTop: space.lg, gap: space.xl },
    title: { ...type.title, fontSize: 30, lineHeight: 36, color: colors.text },
    date: { ...type.body, color: colors.text, marginTop: space.md },
    time: { ...type.body, color: colors.textMuted, marginTop: 2 },
    rows: { gap: space.md },
    detailRow: {
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    detailLabel: { ...type.body, color: colors.text },
    detailValueRow: { flex: 1, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: space.sm },
    colorDot: { width: 14, height: 14, borderRadius: radius.pill },
    detailValue: { ...type.body, color: colors.textMuted, textAlign: "right", flexShrink: 1 },
    notesCard: {
        padding: space.lg,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    notesLabel: { ...type.subheading, color: colors.text, marginBottom: space.sm },
    notes: { ...type.body, lineHeight: 24, color: colors.textSecondary },
    notesEmpty: { ...type.body, color: colors.textMuted, fontStyle: "italic" },
    deleteButton: {
        minHeight: 54,
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
        marginTop: "auto",
        paddingHorizontal: space.xl,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    deleteText: { ...type.subheading, color: colors.danger },
});
