import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, shadow, type } from "../../theme";

// 1. SECTION CONTAINER CARD
export function SectionContainerCard({ title, subtitle, action, children }) {
    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>{title}</Text>
                    {subtitle ? (
                        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
                    ) : null}
                </View>
                {action ? <View style={styles.sectionAction}>{action}</View> : null}
            </View>
            <View>{children}</View>
        </View>
    );
}

// 2. METRIC WIDGET CARD
export function MetricWidgetCard({
    title,
    value,
    subtitle,
    icon,
    iconBg = colors.tintGreen,
    action,
}) {
    return (
        <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
                <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
                    {icon}
                </View>
                {action ? <View>{action}</View> : null}
            </View>
            <View style={styles.metricContent}>
                <Text style={styles.metricLabel} numberOfLines={1}>{title}</Text>
                <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
                {subtitle ? (
                    <Text style={styles.metricSub} numberOfLines={1}>{subtitle}</Text>
                ) : null}
            </View>
        </View>
    );
}

// 3. LIST ENTRY CARD
export function ListEntryCard({
    title,
    subtitle,
    label,
    notes,
    icon,
    iconBg = colors.tintGreen,
    actions,
}) {
    return (
        <View style={styles.listCard}>
            <View style={styles.listMain}>
                <View style={[styles.listIconContainer, { backgroundColor: iconBg }]}>
                    {icon}
                </View>
                <View style={styles.listTextContainer}>
                    <Text style={styles.listTitle}>{title}</Text>
                    {label ? (
                        <View style={styles.listLabelContainer}>{label}</View>
                    ) : null}
                    {subtitle ? (
                        <Text style={styles.listSubtitle}>{subtitle}</Text>
                    ) : null}
                    {notes ? (
                        <Text style={styles.listNotes} numberOfLines={2}>
                            {"“" + notes + "”"}
                        </Text>
                    ) : null}
                </View>
            </View>
            {actions ? <View style={styles.listActions}>{actions}</View> : null}
        </View>
    );
}

// 4. MEMORY VISUAL CARD
export function MemoryVisualCard({ title, description, date, photoUrl, onClick }) {
    const CardComponent = onClick ? TouchableOpacity : View;
    return (
        <CardComponent
            onPress={onClick}
            activeOpacity={0.85}
            style={styles.memoryCard}
        >
            {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.memoryImage} />
            ) : (
                <View style={[styles.memoryImage, styles.memoryPlaceholder]}>
                    <Ionicons name="image-outline" size={26} color={colors.textMuted} />
                </View>
            )}
            <View style={styles.memoryScrim} />
            <View style={styles.memoryOverlay}>
                {date ? (
                    <View style={styles.memoryTag}>
                        <Text style={styles.memoryTagText}>{date}</Text>
                    </View>
                ) : null}
                <Text style={styles.memoryTitle} numberOfLines={1}>{title}</Text>
                {description ? (
                    <Text style={styles.memoryDesc} numberOfLines={2}>
                        {description}
                    </Text>
                ) : null}
            </View>
        </CardComponent>
    );
}

// 5. EMPTY STATE CARD
export function EmptyStateCard({ message, icon = "sparkles-outline" }) {
    return (
        <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
                <Ionicons name={icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.emptyText}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
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
    sectionTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: colors.text,
        letterSpacing: 0.1,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 3,
        lineHeight: 16,
    },
    sectionAction: {
        marginLeft: space.sm,
    },

    metricCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: space.lg,
        borderWidth: 1,
        borderColor: colors.hairline,
        ...shadow.card,
        flex: 1,
        marginHorizontal: space.xs,
        marginBottom: space.sm,
    },
    metricHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    iconWrapper: {
        width: 46,
        height: 46,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        justifyContent: "center",
        alignItems: "center",
    },
    metricContent: {
        marginTop: space.lg,
    },
    metricLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.textSecondary,
        letterSpacing: 0.1,
    },
    metricValue: {
        fontSize: 27,
        fontWeight: "800",
        color: colors.text,
        marginTop: 5,
        letterSpacing: -0.3,
    },
    metricSub: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 4,
        fontWeight: "500",
    },

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
    listMain: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    listIconContainer: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        justifyContent: "center",
        alignItems: "center",
        marginRight: space.md,
    },
    listTextContainer: {
        flex: 1,
    },
    listTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.text,
    },
    listLabelContainer: {
        marginTop: 4,
    },
    listSubtitle: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.textMuted,
        marginTop: 3,
    },
    listNotes: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 5,
        fontStyle: "italic",
        lineHeight: 18,
    },
    listActions: {
        marginLeft: space.sm,
    },

    memoryCard: {
        borderRadius: radius.lg + 2,
        borderCurve: "continuous",
        overflow: "hidden",
        height: 180,
        backgroundColor: colors.surfaceAlt,
        marginBottom: space.md,
        position: "relative",
        ...shadow.soft,
    },
    memoryImage: {
        width: "100%",
        height: "100%",
        position: "absolute",
    },
    memoryPlaceholder: {
        backgroundColor: colors.softGreen,
        justifyContent: "center",
        alignItems: "center",
    },
    memoryScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(28,25,23,0.34)",
    },
    memoryOverlay: {
        ...StyleSheet.absoluteFillObject,
        padding: space.lg,
        justifyContent: "flex-end",
    },
    memoryTag: {
        backgroundColor: "rgba(255,255,255,0.92)",
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
        alignSelf: "flex-start",
        marginBottom: space.sm,
    },
    memoryTagText: {
        color: colors.accentStrong,
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.3,
    },
    memoryTitle: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "800",
    },
    memoryDesc: {
        color: "rgba(255,255,255,0.88)",
        fontSize: 12,
        marginTop: 3,
        lineHeight: 16,
    },

    emptyCard: {
        width: "100%",
        paddingVertical: space.xl,
        paddingHorizontal: space.lg,
        backgroundColor: colors.softGreen,
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
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: space.sm,
    },
    emptyText: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 18,
    },
});
