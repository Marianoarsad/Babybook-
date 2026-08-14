import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// 1. SECTION CONTAINER CARD
export function SectionContainerCard({ title, subtitle, action, children }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>{title}</Text>
                    {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
                </View>
                {action ? <View style={styles.sectionAction}>{action}</View> : null}
            </View>
            <View>{children}</View>
        </View>
    );
}

// 2. RADIO ROW — a selectable option row (circular radio indicator + label +
// optional sublabel), used by any settings screen offering a small set of
// mutually-exclusive choices (reminder lead time, theme override, ...).
// `icon`/`iconBg` are an optional leading icon tile (pass a colors.rec* tint);
// `trailing` is a free slot for a swatch dot, a color chip, etc.
export function RadioRow({ label, sublabel, selected, onPress, icon, iconBg, trailing }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.radioRow, selected && styles.radioRowActive]}
        >
            {icon ? <View style={[styles.radioIconWrap, { backgroundColor: iconBg }]}>{icon}</View> : null}
            <View style={[styles.radioIndicator, selected && styles.radioIndicatorActive]}>
                {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.radioLabel, selected && styles.radioLabelActive]}>{label}</Text>
                {sublabel ? <Text style={styles.radioSublabel}>{sublabel}</Text> : null}
            </View>
            {trailing ? <View style={styles.radioTrailing}>{trailing}</View> : null}
        </TouchableOpacity>
    );
}

// 3. LIST ENTRY CARD
// `iconBg` is effectively required — every real content type should be tinted
// with its own colors.rec* token (see theme.js) rather than falling back to a
// shared default, which is exactly how five different record types used to
// end up with the same icon color. The dev warning catches an omission at
// first render instead of it rendering as a silently-identical gray tile.
export function ListEntryCard({ title, subtitle, label, notes, icon, iconBg, actions, thumbnailUrl, onThumbnailPress }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    if (__DEV__ && !iconBg) {
        console.warn("ListEntryCard: iconBg is required — pass a colors.rec* tint for this record type.");
    }
    return (
        <View style={styles.listCard}>
            <View style={styles.listMain}>
                <View style={[styles.listIconContainer, { backgroundColor: iconBg }]}>{icon}</View>
                <View style={styles.listTextContainer}>
                    <Text style={styles.listTitle}>{title}</Text>
                    {label ? <View style={styles.listLabelContainer}>{label}</View> : null}
                    {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
                    {notes ? (
                        <Text style={styles.listNotes} numberOfLines={2}>{"“" + notes + "”"}</Text>
                    ) : null}
                </View>
            </View>
            {thumbnailUrl ? (
                <TouchableOpacity
                    onPress={onThumbnailPress}
                    style={styles.thumbWrap}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="View attached photo"
                >
                    <Image source={{ uri: thumbnailUrl }} style={styles.thumb} />
                </TouchableOpacity>
            ) : null}
            {actions ? <View style={styles.listActions}>{actions}</View> : null}
        </View>
    );
}

// 4. MEMORY VISUAL CARD — a keepsake frame, not a data thumbnail.
//
// Deliberately NOT a scrim-and-overlay treatment: a parent's own photo is
// shown at full brightness inside a mat border (like a real printed photo),
// with the caption set below the frame rather than darkened text laid over
// the image. Clinical attachment thumbnails never render through this
// component — they use ListEntryCard's `thumbnailUrl` slot instead, a
// structurally separate path, which is what keeps "keepsake" and "clinical
// record" from ever visually blending into one thing.
export function MemoryVisualCard({ title, description, date, photoUrl, onClick, style }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const CardComponent = onClick ? TouchableOpacity : View;
    return (
        <CardComponent onPress={onClick} activeOpacity={0.85} style={[styles.memoryCard, style]}>
            <View style={styles.memoryFrame}>
                {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.memoryImage} />
                ) : (
                    <View style={[styles.memoryImage, styles.memoryPlaceholder]}>
                        <Ionicons name="image-outline" size={26} color={colors.textMuted} />
                    </View>
                )}
            </View>
            <View style={styles.memoryCaption}>
                {date ? <Text style={styles.memoryDate}>{date}</Text> : null}
                <Text style={styles.memoryTitle} numberOfLines={1}>{title}</Text>
                {description ? (
                    <Text style={styles.memoryDesc} numberOfLines={2}>{description}</Text>
                ) : null}
            </View>
        </CardComponent>
    );
}

// 5. EMPTY STATE CARD
// `icon` is required — a missing icon used to silently fall through to the
// same default sparkle glyph everywhere, so five unrelated empty states
// (vaccines, medications, appointments, hospitalizations, milestones...) all
// looked identical. Every real call site now names its own icon explicitly.
export function EmptyStateCard({ message, icon }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    if (__DEV__ && !icon) {
        console.warn("EmptyStateCard: icon is required — name one specific to this empty state.");
    }
    return (
        <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
                <Ionicons name={icon || "help-circle-outline"} size={20} color={colors.primaryDark} />
            </View>
            <Text style={styles.emptyText}>{message}</Text>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    sectionContainer: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: space.lg + 2,
        borderWidth: 1,
        borderColor: colors.hairline,
        ...shadow.card,
        marginBottom: space.lg,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: space.lg,
    },
    sectionTitle: { ...type.heading, color: colors.text },
    sectionSubtitle: { ...type.caption, color: colors.textMuted, marginTop: 3 },
    sectionAction: { marginLeft: space.sm },

    radioRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: space.md - 2,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        marginBottom: space.sm,
    },
    radioRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    radioIconWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        marginRight: space.md,
    },
    radioIndicator: {
        width: 20,
        height: 20,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        marginRight: space.sm + 2,
    },
    radioIndicatorActive: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    radioLabel: { ...type.label, color: colors.text },
    radioLabelActive: { color: colors.primaryDark },
    radioSublabel: { ...type.caption, color: colors.textMuted, marginTop: 1 },
    radioTrailing: { marginLeft: space.sm },

    listCard: {
        padding: space.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: space.sm,
    },
    listMain: { flexDirection: "row", alignItems: "center", flex: 1 },
    listIconContainer: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        justifyContent: "center",
        alignItems: "center",
        marginRight: space.md,
    },
    listTextContainer: { flex: 1 },
    listTitle: { ...type.bodyStrong, color: colors.text },
    listLabelContainer: { marginTop: 4 },
    listSubtitle: { ...type.caption, color: colors.textMuted, marginTop: 3 },
    listNotes: { ...type.caption, color: colors.textSecondary, marginTop: 5, fontStyle: "italic" },
    listActions: { marginLeft: space.sm },
    thumbWrap: {
        width: 46,
        height: 46,
        borderRadius: radius.md,
        borderCurve: "continuous",
        overflow: "hidden",
        marginLeft: space.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceAlt,
    },
    thumb: { width: "100%", height: "100%" },

    memoryCard: {
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.borderStrong,
        padding: space.sm,
        backgroundColor: colors.surface,
        marginBottom: space.md,
        ...shadow.card,
    },
    memoryFrame: {
        borderRadius: radius.md,
        borderCurve: "continuous",
        overflow: "hidden",
        aspectRatio: 1,
        backgroundColor: colors.surfaceAlt,
    },
    memoryImage: { width: "100%", height: "100%" },
    memoryPlaceholder: { backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" },
    memoryCaption: { paddingTop: space.sm, paddingHorizontal: space.xs, paddingBottom: space.xs },
    memoryDate: { ...type.subheading, color: colors.textMuted, marginBottom: 3 },
    memoryTitle: { ...type.bodyStrong, color: colors.text },
    memoryDesc: { ...type.caption, color: colors.textMuted, marginTop: 3 },

    emptyCard: {
        width: "100%",
        paddingVertical: space.xl,
        paddingHorizontal: space.lg,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: colors.borderStrong,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    emptyIconWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: space.sm,
    },
    emptyText: { ...type.caption, color: colors.textSecondary, textAlign: "center" },
});
