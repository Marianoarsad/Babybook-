import React, { useState, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Image,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useToast } from "./ui/Toast";
import { useTheme } from "../context/ThemeContext";
import { space, type, radius, MIN_TOUCH } from "../theme";
import { useScreenPadBottom } from "../utils/responsive";
import { SectionContainerCard, ListEntryCard } from "./common/Cards";
import { Ionicons } from "@expo/vector-icons";
import { initialUpdates, initialClinics } from "../mockData";

export default function Services() {
    const { language, t } = useLanguage();
    const toast = useToast();
    const padBottom = useScreenPadBottom();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [selectedCity, setSelectedCity] = useState("QUEZON CITY");

    const handleCall = (num) => {
        Linking.openURL(`tel:${num}`).catch(() => {
            toast.error("Could not dial this hotline automatically");
        });
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingBottom: padBottom }]}
        >
            {/* Services Title Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t("servicesHeader")}</Text>
                <Text style={styles.headerSub}>{t("servicesSub")}</Text>
            </View>

            {/* Emergency Hotlines */}
            <SectionContainerCard
                title={t("servicesHotlinesTitle")}
                subtitle={t("servicesHotlinesSub")}
            >
                <View style={styles.hotlinesGrid}>
                    <View style={styles.hotlineBox}>
                        <View style={styles.hotlineHeader}>
                            <Ionicons name="call" size={20} color="#047857" />
                            <Text style={styles.hotlineName}>
                                Local Public Safety
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => handleCall("911")}
                            style={styles.callBtn}
                        >
                            <Text style={styles.callBtnText}>Call 911</Text>
                        </TouchableOpacity>
                    </View>

                    <View
                        style={[
                            styles.hotlineBox,
                            {
                                borderColor: "#BFDBFE",
                                backgroundColor: "#EFF6FF",
                            },
                        ]}
                    >
                        <View style={styles.hotlineHeader}>
                            <Ionicons name="medkit" size={20} color="#1D4ED8" />
                            <Text
                                style={[
                                    styles.hotlineName,
                                    { color: "#1E3A8A" },
                                ]}
                            >
                                Poison Control
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => handleCall("8123456")}
                            style={[
                                styles.callBtn,
                                { backgroundColor: "#1D4ED8" },
                            ]}
                        >
                            <Text style={styles.callBtnText}>
                                Call 8123-456
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SectionContainerCard>

            {/* Barangay Announcements */}
            <SectionContainerCard
                title="NCR Barangay Bulletin Board"
                subtitle="Latest municipal bulletins for guardians"
            >
                {initialUpdates.map((item, idx) => (
                    <View key={item.id || idx} style={styles.bulletinRow}>
                        <View style={styles.bulletinHeader}>
                            <View
                                style={[
                                    styles.categoryBadge,
                                    item.category === "ALERT" &&
                                        styles.alertBadge,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.categoryBadgeText,
                                        item.category === "ALERT" &&
                                            styles.alertBadgeText,
                                    ]}
                                >
                                    {item.category}
                                </Text>
                            </View>
                            <Text style={styles.bulletinDate}>{item.date}</Text>
                        </View>
                        <Text style={styles.bulletinTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.bulletinBody} numberOfLines={4}>{item.content}</Text>
                    </View>
                ))}
            </SectionContainerCard>

            {/* Nearby health clinics */}
            <SectionContainerCard
                title={t("servicesClinicsTitle")}
                subtitle={t("servicesClinicsSub")}
            >
                {initialClinics.map((clinic, idx) => (
                    <View key={clinic.id || idx} style={styles.clinicRow}>
                        <Image
                            source={{ uri: clinic.imageUrl }}
                            style={styles.clinicImg}
                        />
                        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                            <Text style={styles.clinicName} numberOfLines={2}>{clinic.name}</Text>
                            <Text style={styles.clinicDistance} numberOfLines={2}>
                                {clinic.distance} | {clinic.address}
                            </Text>
                            <View style={styles.ratingRow}>
                                <Ionicons
                                    name="star"
                                    size={12}
                                    color="#FBBF24"
                                />
                                <Text style={styles.ratingText}>
                                    {clinic.rating} Rating
                                </Text>
                            </View>
                        </View>
                    </View>
                ))}
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    // Padding on the content, not the ScrollView box — see Health.js.
    content: { padding: space.lg },
    header: {
        marginBottom: 16,
    },
    headerTitle: {
        ...type.title,
        fontWeight: "800",
        color: colors.primary,
    },
    headerSub: {
        ...type.caption,
        color: colors.textMuted,
        marginTop: 4,
    },
    hotlinesGrid: {
        flexDirection: "row",
        gap: 12,
        marginTop: 4,
    },
    hotlineBox: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#A7F3D0",
        backgroundColor: "#ECFDF5",
        borderRadius: 16,
        padding: 12,
        justifyContent: "space-between",
        gap: space.md,
    },
    hotlineHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    hotlineName: {
        ...type.caption,
        fontWeight: "700",
        color: "#064E3B",
        marginLeft: 6,
        flexShrink: 1,
    },
    callBtn: {
        backgroundColor: "#047857",
        minHeight: MIN_TOUCH,
        justifyContent: "center",
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: "center",
    },
    callBtnText: {
        color: "#FFFFFF",
        ...type.caption,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    bulletinRow: {
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceAlt,
        paddingBottom: 12,
        marginBottom: 12,
    },
    bulletinHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },
    categoryBadge: {
        backgroundColor: colors.recCheckup.bg,
        paddingVertical: 3,
        paddingHorizontal: 6,
        borderRadius: 6,
        marginRight: 8,
    },
    alertBadge: {
        backgroundColor: colors.dangerBg,
    },
    categoryBadgeText: {
        fontSize: 11,
        fontWeight: "800",
        color: colors.recCheckup.on,
    },
    alertBadgeText: {
        color: colors.danger,
    },
    bulletinDate: {
        ...type.caption,
        color: colors.textMuted,
        fontWeight: "600",
    },
    bulletinTitle: {
        ...type.caption,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 4,
    },
    bulletinBody: {
        ...type.caption,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    clinicRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceAlt,
        paddingBottom: 12,
    },
    clinicImg: {
        width: 60,
        height: 60,
        flexShrink: 0,
        borderRadius: 12,
    },
    clinicName: {
        ...type.body,
        fontWeight: "700",
        color: colors.text,
    },
    clinicDistance: {
        ...type.caption,
        color: colors.textMuted,
        marginTop: 2,
    },
    ratingRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    ratingText: {
        ...type.caption,
        fontWeight: "700",
        color: colors.warning,
        marginLeft: 4,
    },
});
