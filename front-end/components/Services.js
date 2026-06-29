import React, { useState } from "react";
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
import { SectionContainerCard, ListEntryCard } from "./common/Cards";
import { Ionicons } from "@expo/vector-icons";
import { initialUpdates, initialClinics } from "../mockData";

export default function Services() {
    const { language, t } = useLanguage();
    const [selectedCity, setSelectedCity] = useState("QUEZON CITY");

    const handleCall = (num) => {
        Linking.openURL(`tel:${num}`).catch(() => {
            alert("Could not dial this hotline automatically");
        });
    };

    return (
        <ScrollView style={styles.container}>
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
                        <Text style={styles.bulletinTitle}>{item.title}</Text>
                        <Text style={styles.bulletinBody}>{item.content}</Text>
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
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.clinicName}>{clinic.name}</Text>
                            <Text style={styles.clinicDistance}>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFDF9",
        padding: 16,
    },
    header: {
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: "800",
        color: "#456155",
    },
    headerSub: {
        fontSize: 12,
        color: "#78716C",
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
        minHeight: 110,
    },
    hotlineHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    hotlineName: {
        fontSize: 12,
        fontWeight: "700",
        color: "#064E3B",
        marginLeft: 6,
        flexShrink: 1,
    },
    callBtn: {
        backgroundColor: "#047857",
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: "center",
    },
    callBtnText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    bulletinRow: {
        borderBottomWidth: 1,
        borderBottomColor: "#F5F5F4",
        paddingBottom: 12,
        marginBottom: 12,
    },
    bulletinHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },
    categoryBadge: {
        backgroundColor: "#E6F4EA",
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 6,
        marginRight: 8,
    },
    alertBadge: {
        backgroundColor: "#FFF1F0",
    },
    categoryBadgeText: {
        fontSize: 9,
        fontWeight: "800",
        color: "#456155",
    },
    alertBadgeText: {
        color: "#EF4444",
    },
    bulletinDate: {
        fontSize: 10,
        color: "#A8A29E",
        fontWeight: "600",
    },
    bulletinTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1C1917",
        marginBottom: 4,
    },
    bulletinBody: {
        fontSize: 11,
        color: "#57534E",
        lineHeight: 16,
    },
    clinicRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F5F5F4",
        paddingBottom: 12,
    },
    clinicImg: {
        width: 60,
        height: 60,
        borderRadius: 12,
    },
    clinicName: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1C1917",
    },
    clinicDistance: {
        fontSize: 11,
        color: "#78716C",
        marginTop: 2,
    },
    ratingRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    ratingText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#D97706",
        marginLeft: 4,
    },
});
