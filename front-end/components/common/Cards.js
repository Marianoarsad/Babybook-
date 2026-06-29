import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";

// 1. SECTION CONTAINER CARD
export function SectionContainerCard({ title, subtitle, action, children }) {
    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>{title}</Text>
                    {subtitle && (
                        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
                    )}
                </View>
                {action && <View style={styles.sectionAction}>{action}</View>}
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
    iconBg = "#E6F4EA",
    action,
}) {
    return (
        <View style={[styles.metricCard, { borderColor: "#EBEBEB" }]}>
            <View style={styles.metricHeader}>
                <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
                    {icon}
                </View>
                {action && <View>{action}</View>}
            </View>
            <View style={styles.metricContent}>
                <Text style={styles.metricLabel}>{title}</Text>
                <Text style={styles.metricValue}>{value}</Text>
                {subtitle && <Text style={styles.metricSub}>{subtitle}</Text>}
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
    iconBg = "#E6F4EA",
    actions,
}) {
    return (
        <View style={styles.listCard}>
            <View style={styles.listMain}>
                <View
                    style={[
                        styles.listIconContainer,
                        { backgroundColor: iconBg },
                    ]}
                >
                    {icon}
                </View>
                <View style={styles.listTextContainer}>
                    <Text style={styles.listTitle}>{title}</Text>
                    {label && (
                        <View style={styles.listLabelContainer}>{label}</View>
                    )}
                    {subtitle && (
                        <Text style={styles.listSubtitle}>{subtitle}</Text>
                    )}
                    {notes && <Text style={styles.listNotes}>"{notes}"</Text>}
                </View>
            </View>
            {actions && <View style={styles.listActions}>{actions}</View>}
        </View>
    );
}

// 4. MEMORY VISUAL CARD
export function MemoryVisualCard({
    title,
    description,
    date,
    photoUrl,
    onClick,
}) {
    const CardComponent = onClick ? TouchableOpacity : View;
    return (
        <CardComponent onPress={onClick} style={styles.memoryCard}>
            {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.memoryImage} />
            ) : (
                <View
                    style={[
                        styles.memoryImage,
                        {
                            backgroundColor: "#F0F0F0",
                            justifyContent: "center",
                            alignItems: "center",
                        },
                    ]}
                >
                    <Text style={{ color: "#888", fontSize: 12 }}>
                        No Image
                    </Text>
                </View>
            )}
            <View style={styles.memoryOverlay}>
                {date && (
                    <View style={styles.memoryTag}>
                        <Text style={styles.memoryTagText}>{date}</Text>
                    </View>
                )}
                <Text style={styles.memoryTitle} numberOfLines={1}>
                    {title}
                </Text>
                {description && (
                    <Text style={styles.memoryDesc} numberOfLines={2}>
                        {description}
                    </Text>
                )}
            </View>
        </CardComponent>
    );
}

// 5. EMPTY STATE CARD
export function EmptyStateCard({ message }) {
    return (
        <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionContainer: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: "#F2F2F2",
        shadowColor: "#374151",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1C1917",
    },
    sectionSubtitle: {
        fontSize: 12,
        color: "#78716C",
        marginTop: 2,
    },
    sectionAction: {
        marginLeft: 8,
    },
    metricCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        shadowColor: "#374151",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 15,
        elevation: 2,
        flex: 1,
        marginHorizontal: 4,
        marginBottom: 8,
    },
    metricHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    iconWrapper: {
        padding: 10,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    metricContent: {
        marginTop: 16,
    },
    metricLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: "#A8A29E",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    metricValue: {
        fontSize: 26,
        fontWeight: "800",
        color: "#0C0A09",
        marginTop: 4,
    },
    metricSub: {
        fontSize: 12,
        color: "#78716C",
        marginTop: 4,
    },
    listCard: {
        padding: 12,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    listMain: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    listIconContainer: {
        padding: 10,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    listTextContainer: {
        flex: 1,
    },
    listTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#1C1917",
    },
    listLabelContainer: {
        marginTop: 4,
    },
    listSubtitle: {
        fontSize: 10,
        fontWeight: "700",
        color: "#A8A29E",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginTop: 2,
    },
    listNotes: {
        fontSize: 12,
        color: "#57534E",
        marginTop: 4,
        fontStyle: "italic",
    },
    listActions: {
        marginLeft: 8,
    },
    memoryCard: {
        borderRadius: 16,
        overflow: "hidden",
        height: 180,
        backgroundColor: "#E7E5E4",
        marginBottom: 12,
        position: "relative",
    },
    memoryImage: {
        width: "100%",
        height: "100%",
        position: "absolute",
    },
    memoryOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.4)",
        padding: 16,
        justifyContent: "flex-end",
    },
    memoryTag: {
        backgroundColor: "rgba(217, 119, 6, 0.2)",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: "flex-start",
        marginBottom: 6,
    },
    memoryTagText: {
        color: "#FBBF24",
        fontSize: 10,
        fontWeight: "800",
    },
    memoryTitle: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    memoryDesc: {
        color: "#D1D5DB",
        fontSize: 12,
        marginTop: 4,
    },
    emptyCard: {
        width: "100%",
        paddingVertical: 24,
        paddingHorizontal: 16,
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#D6D3D1",
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#78716C",
    },
});
