import React, { useMemo } from "react";
import {
    Modal,
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { radius, space, shadow } from "../theme";
import { ageAtDate, shortDate } from "../utils/dates";

// The private ageAt() and prettyDate() that used to live here are now
// utils/dates.js's ageAtDate() and shortDate(). The age one had to move: a
// saved milestone stores the same answer in `age_achieved`, which is what the
// QR snapshot ships to a healthcare professional, so the screen and the record
// must not compute it two different ways.

// A single labelled metadata chip (icon + label + value).
function Chip({ icon, label, value, colors, styles, accent }) {
    return (
        <View style={styles.chip}>
            <View style={styles.chipLabelRow}>
                <Ionicons name={icon} size={14} color={colors.textMuted} />
                <Text style={styles.chipLabel}>{label}</Text>
            </View>
            <Text style={[styles.chipValue, accent && { color: colors.primary }]} numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}

// Full-screen "Memory Detail — Structured View" (from the Stitch design):
// a large photo card, a grid of metadata chips, then a title + notes section.
// View-only; adapts to the memory data the app actually has
// ({ title, description, date, photoUrl }).
export default function MemoryDetail({ visible, memory, dob, typeLabel, onClose }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    if (!memory) return null;
    const age = ageAtDate(dob, memory.date);

    return (
        <Modal
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
            transparent
        >
            <View style={styles.root}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.headerBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    {/* Follows the entry — this screen opens milestones too,
                        and calling one of those "Memory Detail" is the same
                        borrowed wording that made the two look identical. */}
                    <Text style={styles.headerTitle}>
                        {typeLabel ? `${typeLabel} Detail` : "Memory Detail"}
                    </Text>
                    <View style={styles.headerBtn} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Photo card */}
                    <View style={styles.photoCard}>
                        {memory.photoUrl ? (
                            <Image source={{ uri: memory.photoUrl }} style={styles.photo} />
                        ) : (
                            <View style={[styles.photo, styles.photoPlaceholder]}>
                                <Ionicons name="image-outline" size={40} color={colors.textMuted} />
                                <Text style={styles.photoPlaceholderText}>No photo attached</Text>
                            </View>
                        )}
                    </View>

                    {/* Metadata chips */}
                    <View style={styles.chipGrid}>
                        {memory.date ? (
                            <Chip
                                icon="calendar-outline"
                                label="DATE"
                                value={shortDate(memory.date)}
                                colors={colors}
                                styles={styles}
                            />
                        ) : null}
                        {age ? (
                            <Chip
                                icon="happy-outline"
                                label="AGE"
                                value={age}
                                colors={colors}
                                styles={styles}
                                accent
                            />
                        ) : null}
                        {typeLabel ? (
                            <Chip
                                icon="sparkles-outline"
                                label="TYPE"
                                value={typeLabel}
                                colors={colors}
                                styles={styles}
                            />
                        ) : null}
                    </View>

                    {/* Title + notes */}
                    <View style={styles.notesCard}>
                        <Text style={styles.memoryTitle}>{memory.title || "Untitled"}</Text>
                        <View style={styles.accentBar} />
                        <Text style={styles.notesHeading}>Notes</Text>
                        {memory.description ? (
                            <Text style={styles.notesBody}>{memory.description}</Text>
                        ) : (
                            <Text style={styles.notesEmpty}>
                                No notes were added.
                            </Text>
                        )}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            paddingTop: Platform.OS === "web" ? space.md : space.xl,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.hairline,
        },
        headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
        headerTitle: { fontSize: 18, fontWeight: "800", color: colors.primary },

        content: { padding: space.lg, paddingBottom: space.xxl },

        photoCard: {
            width: "100%",
            aspectRatio: 4 / 5,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: colors.surfaceAlt,
            ...shadow.card,
            marginBottom: space.lg,
        },
        photo: { width: "100%", height: "100%" },
        photoPlaceholder: {
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.softGreen,
        },
        photoPlaceholderText: { marginTop: space.sm, fontSize: 12, color: colors.textMuted, fontWeight: "600" },

        chipGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            marginHorizontal: -space.xs,
            marginBottom: space.lg,
        },
        chip: {
            flexGrow: 1,
            flexBasis: "45%",
            marginHorizontal: space.xs,
            marginBottom: space.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            padding: space.md,
        },
        chipLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        chipLabel: {
            fontSize: 11,
            fontWeight: "700",
            color: colors.textMuted,
            letterSpacing: 0.6,
        },
        chipValue: { marginTop: 6, fontSize: 16, fontWeight: "800", color: colors.text },

        notesCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            padding: space.lg,
            ...shadow.card,
        },
        memoryTitle: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
        accentBar: {
            width: 48,
            height: 4,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            marginTop: space.md,
            marginBottom: space.lg,
        },
        notesHeading: { fontSize: 15, fontWeight: "700", color: colors.textSecondary, marginBottom: space.sm },
        notesBody: { fontSize: 16, lineHeight: 24, color: colors.text },
        notesEmpty: { fontSize: 14, lineHeight: 20, color: colors.textMuted, fontStyle: "italic" },
    });
