import React, { useMemo, useState } from "react";
import { Animated, Platform, Pressable, View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, TEXT_COL_MIN, recordItemStyle } from "../../theme";
import Gradient from "../ui/Gradient";
import { useTheme } from "../../context/ThemeContext";
import RecordIcon from "../ui/RecordIcon";
import MemoryDateRow from "../ui/MemoryDateRow";
import useSoftPress from "../ui/useSoftPress";

// 1. SECTION CONTAINER CARD
//
// The header stacks to a column whenever the action would leave the title less
// than TEXT_COL_MIN of width. That is not a nicety — a row header with a wide
// action used to squeeze the title into ~74pt on a 360pt screen, which broke
// "Immunization Records" mid-word into "Immunizati / on Records" and wrapped
// its subtitle down six lines. The title block had `flex: 1` (basis 0) while
// the action had no shrink constraint, so the action's intrinsic width always
// won and the title took the remainder, however small.
//
// The decision is MEASURED (onLayout) rather than taken from a screen-width
// breakpoint, because the thing that overflows is the action's own text: a
// button reading "Generate schedule" is ~162pt at the default font size and
// wider still once the OS font scale is raised. A static breakpoint cannot see
// that; a measurement can, which is what makes this hold under Dynamic Type.
//
// No oscillation: the action wrapper is `flexShrink: 0` in row mode and
// `alignSelf: "flex-start"` when stacked, so it reports the same natural width
// in both states and the predicate can't flip-flop between them.
export function SectionContainerCard({ title, subtitle, action, icon, count, children, style, background, headerStyle, titleStyle, subtitleStyle }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [headerWidth, setHeaderWidth] = useState(0);
    const [actionWidth, setActionWidth] = useState(0);

    const stacked =
        !!action &&
        headerWidth > 0 &&
        actionWidth > 0 &&
        headerWidth - actionWidth - space.sm < TEXT_COL_MIN;

    return (
        <View style={[styles.sectionContainer, style]}>
            {background}
            <View
                style={[styles.sectionHeader, stacked && styles.sectionHeaderStacked, headerStyle]}
                onLayout={(e) => setHeaderWidth(e.nativeEvent.layout.width)}
            >
                <View style={styles.sectionHeading}>
                    {icon || count != null ? <View style={styles.sectionTitleRow}>
                        {icon ? <View style={styles.sectionTitleIcon}>{icon}</View> : null}
                        <Text style={[styles.sectionTitle, styles.sectionTitleFlexible, titleStyle]}>{title}</Text>
                        {count != null ? <View style={styles.sectionCountBadge}>
                            <Text selectable style={styles.sectionCountText}>{count}</Text>
                        </View> : null}
                    </View> : <Text style={titleStyle ? [styles.sectionTitle, titleStyle] : styles.sectionTitle}>{title}</Text>}
                    {subtitle ? <Text style={subtitleStyle ? [styles.sectionSubtitle, subtitleStyle] : styles.sectionSubtitle}>{subtitle}</Text> : null}
                </View>
                {action ? (
                    <View
                        style={[styles.sectionAction, stacked && styles.sectionActionStacked]}
                        onLayout={(e) => setActionWidth(e.nativeEvent.layout.width)}
                    >
                        {action}
                    </View>
                ) : null}
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
            <View style={styles.radioBody}>
                <Text
                    style={[styles.radioLabel, selected && styles.radioLabelActive]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                >
                    {label}
                </Text>
                {sublabel ? (
                    <Text style={styles.radioSublabel} numberOfLines={2} ellipsizeMode="tail">
                        {sublabel}
                    </Text>
                ) : null}
            </View>
            {trailing ? <View style={styles.radioTrailing}>{trailing}</View> : null}
        </TouchableOpacity>
    );
}

// 3. LIST ENTRY CARD
// Leading icons are optional. When present, `iconBg` must use the record's
// colors.rec* tint rather than silently falling back to a shared gray tile.
export function ListEntryCard({ title, titleAccessory, subtitle, subtitleNumberOfLines = 3, dateText, label, labelTrailing = false, trailingWidth, notes, icon, iconBg, iconAlign = "flex-start", actions, actionsTop = false, thumbnailUrl, onThumbnailPress, onPress, accessibilityLabel, style }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    if (__DEV__ && icon && !iconBg) {
        console.warn("ListEntryCard: iconBg is required — pass a colors.rec* tint for this record type.");
    }
    // The thumbnail and the action are grouped into one shrink-proof trailing
    // block. As three unbounded siblings they each took their natural width
    // before the text got any, leaving the title ~110pt on a 360pt screen —
    // narrow enough to clip a real record name like "Pentavalent (DPT-HepB-Hib) 3".
    // The text column now shrinks last and ellipsizes rather than pushing the
    // trailing block off the card edge.
    const trailing = (label && labelTrailing) || thumbnailUrl || actions;
    const Card = onPress ? TouchableOpacity : View;
    return (
        <Card
            style={[styles.listCard, style]}
            onPress={onPress}
            activeOpacity={0.82}
            accessibilityRole={onPress ? "button" : undefined}
            accessibilityLabel={onPress ? accessibilityLabel || `View ${title}` : undefined}
        >
            <Gradient pointerEvents="none" accessible={false} colors={colors.recordItem.surface}
                style={[StyleSheet.absoluteFillObject, { borderRadius: 24, boxShadow: "inset 0 1px 2px " + colors.recordItem.highlight }]} />
            <View style={[styles.listMain, { alignItems: iconAlign }]}>
                {icon ? <View style={[styles.listIconContainer, { backgroundColor: iconBg }]}>{icon}</View> : null}
                <View style={styles.listTextContainer}>
                    {titleAccessory ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.xs }}>
                    <Text style={[styles.listTitle, { flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">
                        {title}
                    </Text>
                    {titleAccessory}
                    </View> : <Text style={styles.listTitle} numberOfLines={2} ellipsizeMode="tail">{title}</Text>}
                    {label && !labelTrailing ? <View style={styles.listLabelContainer}>{label}</View> : null}
                    {subtitle ? (
                        <Text style={styles.listSubtitle} numberOfLines={subtitleNumberOfLines} ellipsizeMode="tail">
                            {subtitle}
                        </Text>
                    ) : null}
                    {notes ? (
                        <Text style={styles.listNotes} numberOfLines={2} ellipsizeMode="tail">
                            {"“" + notes + "”"}
                        </Text>
                    ) : null}
                    {dateText ? <Text style={styles.listDate}>{dateText}</Text> : null}
                </View>
            </View>
            {trailing ? (
                <View style={[styles.listTrailing, actionsTop && styles.listTrailingTop, trailingWidth && { width: trailingWidth, minWidth: 0 }]}>
                    {label && labelTrailing ? <View style={[styles.listTrailingLabel, trailingWidth && { flex: 1, minWidth: 0, flexShrink: 1 }]}>{label}</View> : null}
                    {thumbnailUrl ? (
                        <TouchableOpacity
                            onPress={(event) => {
                                event.stopPropagation?.();
                                onThumbnailPress?.();
                            }}
                            style={styles.thumbWrap}
                            accessibilityRole="imagebutton"
                            accessibilityLabel="View attached photo"
                        >
                            <Image source={{ uri: thumbnailUrl }} style={styles.thumb} />
                        </TouchableOpacity>
                    ) : null}
                    {actions ? <View style={styles.listActions}>{actions}</View> : null}
                </View>
            ) : null}
        </Card>
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
// `kind` keeps milestones identifiable by both the shared flag and a caption;
// ordinary photo memories retain their image placeholder and record identity.
export function MemoryVisualCard({
    title,
    description,
    date,
    photoUrl,
    onClick,
    style,
    kind = "memory",
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const p = colors.memoriesSurface;
    const { respond, transform } = useSoftPress();
    const [pressed, setPressed] = useState(false), [focused, setFocused] = useState(false);
    const press = down => { setPressed(down); respond(down); };
    const focus = event => setFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    return (
        <Animated.View style={[styles.memoryCard, style, { transform, boxShadow: pressed ? p.pressedShadow : p.itemShadow }]}>
        <Gradient pointerEvents="none" accessible={false} colors={p.item}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 22, boxShadow: `inset 1px 2px 2px ${p.highlight}, inset -1px -1px 2px ${p.shade}` }]} />
        <Pressable onPress={onClick} onPressIn={() => press(true)} onPressOut={() => press(false)}
            onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); press(false); }}
            accessibilityRole={onClick ? "button" : undefined} accessibilityLabel={onClick ? `View ${title}` : undefined}
            style={[styles.memoryPressable, Platform.OS === "web" && { outlineStyle: focused ? "solid" : "none",
                outlineWidth: 2, outlineOffset: 3, outlineColor: p.accent }]}>
            <View style={styles.memoryFrame}>
                {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.memoryImage} />
                ) : (
                    <View style={[styles.memoryImage, styles.memoryPlaceholder]}>
                        {kind === "milestone" ? <RecordIcon category="milestone" size={48} />
                            : <Ionicons name="image-outline" size={26} color={colors.textMuted} />}
                    </View>
                )}
                {kind === "milestone" ? (
                    <View style={styles.memoryBadge}>
                        <RecordIcon category="milestone" size={26} />
                    </View>
                ) : null}
            </View>
            <View style={styles.memoryCaption}>
                <Text style={styles.memoryTitle}>{title}</Text>
                {description ? (
                    <Text style={styles.memoryDesc}>{description}</Text>
                ) : null}
                {kind === "milestone" ? <Text style={styles.memoryKind}>Milestone</Text> : null}
                <View style={styles.memoryDate}><MemoryDateRow date={date} /></View>
            </View>
        </Pressable>
        </Animated.View>
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
            <View style={[styles.emptyIconWrap, React.isValidElement(icon) && { backgroundColor: "transparent", borderRadius: 999 }]}>
                {React.isValidElement(icon) ? icon : <Ionicons name={icon || "help-circle-outline"} size={20} color={colors.primaryDark} />}
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
    // Stacked: title block on its own line, action beneath it hugging the left
    // edge so it lines up with the title rather than floating out to the right.
    sectionHeaderStacked: {
        flexDirection: "column",
        alignItems: "stretch",
    },
    // minWidth: 0 is load-bearing on react-native-web, where a flex child's
    // default min-width is `auto` — without it the title's intrinsic width
    // stops the block from ever shrinking and the row overflows instead.
    sectionHeading: { flex: 1, flexShrink: 1, minWidth: 0 },
    sectionTitle: { ...type.heading, color: colors.text, textTransform: "capitalize" },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
    sectionTitleIcon: { alignItems: "center", justifyContent: "center", alignSelf: "center", flexShrink: 0 },
    sectionTitleFlexible: { flexShrink: 1, alignSelf: "center", includeFontPadding: false, textAlignVertical: "center" },
    sectionCountBadge: { minWidth: 28, height: 28, paddingHorizontal: space.sm, borderRadius: radius.pill,
        borderCurve: "continuous", backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    sectionCountText: { ...type.caption, color: colors.textSecondary, textAlign: "center", fontVariant: ["tabular-nums"] },
    sectionSubtitle: { ...type.caption, color: colors.textMuted, marginTop: 3 },
    // flexShrink: 0 keeps the buttons at their natural width so their labels
    // never clip, and keeps the measured width stable across both modes.
    sectionAction: { marginLeft: space.sm, flexShrink: 0 },
    sectionActionStacked: { marginLeft: 0, marginTop: space.md, alignSelf: "flex-start" },

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
    radioBody: { flex: 1, flexShrink: 1, minWidth: 0 },
    radioLabel: { ...type.label, color: colors.text },
    radioLabelActive: { color: colors.primaryDark },
    radioSublabel: { ...type.caption, color: colors.textMuted, marginTop: 1 },
    radioTrailing: { marginLeft: space.sm },

    listCard: {
        ...recordItemStyle(colors),
        padding: space.md,
        backgroundColor: colors.surface,

        borderColor: colors.hairline,

        borderCurve: "continuous",
        flexDirection: "row",
        justifyContent: "space-between",
        // flex-start, not center: a row whose text runs to three lines used to
        // centre that block against a 40pt icon, which left the icon floating
        // in the middle of the card with ragged space above and below it.
        alignItems: "flex-start",
        marginBottom: 12,
        borderWidth: 0, borderRadius: 24,
    },
    listMain: { flexDirection: "row", alignItems: "flex-start", flex: 1, minWidth: 0 },
    listIconContainer: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        justifyContent: "center",
        alignItems: "center",
        marginRight: space.md,
        flexShrink: 0,
    },
    listTextContainer: { flex: 1, flexShrink: 1, minWidth: 0 },
    listTitle: { ...type.bodyStrong, color: colors.text },
    listLabelContainer: { marginTop: 4, alignSelf: "flex-start" },
    listSubtitle: { ...type.caption, color: colors.textMuted, marginTop: 3 },
    listNotes: { ...type.caption, color: colors.textSecondary, marginTop: 5, fontStyle: "italic" },
    listDate: { ...type.caption, color: colors.textMuted, marginTop: space.xs },
    // One shrink-proof trailing block instead of two unbounded siblings, so
    // the text column is the only thing that gives way as the card narrows.
    listTrailing: { flexDirection: "row", alignItems: "center", alignSelf: "center", flexShrink: 0 },
    listTrailingTop: { alignSelf: "flex-start" },
    listTrailingLabel: { marginLeft: space.sm, flexShrink: 0 },
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
        flexShrink: 0,
    },
    thumb: { width: "100%", height: "100%" },

    memoryCard: { borderCurve: "continuous", borderRadius: 22, overflow: "visible" },
    memoryPressable: { flex: 1, padding: 8, borderRadius: 22 },
    memoryFrame: {
        borderRadius: 17,
        borderCurve: "continuous",
        overflow: "hidden",
        aspectRatio: 1,
        backgroundColor: colors.surfaceAlt,
    },
    memoryImage: { width: "100%", height: "100%" },
    memoryPlaceholder: { backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" },
    memoryBadge: {
        position: "absolute",
        top: 6,
        left: 6,
        width: 26,
        height: 26,
        alignItems: "center",
        justifyContent: "center",
    },
    memoryCaption: { flex: 1, paddingTop: 8, paddingHorizontal: 2, paddingBottom: 4 },
    memoryDate: { marginTop: "auto" },
    memoryTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 20, color: colors.memoriesSurface.text },
    memoryDesc: { ...type.caption, color: colors.memoriesSurface.secondary, marginTop: 4 },
    memoryKind: { ...type.caption, color: colors.memoriesSurface.secondary, marginTop: 6 },

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
