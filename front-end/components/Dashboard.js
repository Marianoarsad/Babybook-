import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Modal,
    Alert,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import {
    SectionContainerCard,
    MetricWidgetCard,
    ListEntryCard,
    MemoryVisualCard,
    EmptyStateCard,
} from "./common/Cards";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { storage } from "../utils/storageAdapter";

export default function Dashboard({
    profile,
    profiles,
    onSelectProfile,
    onOpenAddModal,
    onOpenEditModal,
    onUpdateProfile,
    feedLogs,
    setFeedLogs,
    sleepLogs,
    setSleepLogs,
    milestones,
    setMilestones,
    onChangeView,
}) {
    const { language, t } = useLanguage();

    // Temperature State
    const [bodyTemp, setBodyTemp] = useState("36.5");
    const [tempInput, setTempInput] = useState("36.5");
    const [showTempModal, setShowTempModal] = useState(false);

    // Quick Logging state
    const [showFeedModal, setShowFeedModal] = useState(false);
    const [feedType, setFeedType] = useState("milk");
    const [feedAmount, setFeedAmount] = useState("150");
    const [feedNotes, setFeedNotes] = useState("");

    // Sleep Logging State
    const [isSleeping, setIsSleeping] = useState(false);
    const [sleepStartTime, setSleepStartTime] = useState(null);

    useEffect(() => {
        const loadTemp = async () => {
            try {
                const saved = await storage.getItem(
                    `bb_temp_${profile.id}`,
                );
                if (saved) {
                    setBodyTemp(saved);
                    setTempInput(saved);
                } else {
                    setBodyTemp("36.5");
                    setTempInput("36.5");
                }
            } catch (e) {
                console.log(e);
            }
        };
        loadTemp();
    }, [profile.id]);

    const handleSaveTemp = async () => {
        const val = parseFloat(tempInput);
        if (isNaN(val) || val < 34 || val > 43) {
            Alert.alert(
                "Invalid Entry",
                "Please write a normal pediatric temperature between 34°C and 43°C",
            );
            return;
        }
        try {
            setBodyTemp(tempInput);
            await storage.setItem(`bb_temp_${profile.id}`, tempInput);
            setShowTempModal(false);
        } catch (e) {
            console.log(e);
        }
    };

    const handleAddFeed = () => {
        if (!feedAmount) {
            Alert.alert("Error", "Please enter feed amount");
            return;
        }
        const newLog = {
            id: `f-${Date.now()}`,
            timestamp: new Date().toISOString(),
            feedType,
            amountMl: feedType === "milk" ? parseInt(feedAmount) : null,
            grams: feedType === "solids" ? parseInt(feedAmount) : null,
            notes: feedNotes,
        };
        setFeedLogs((prev) => [newLog, ...prev]);
        setShowFeedModal(false);
        setFeedNotes("");
    };

    const toggleSleep = () => {
        if (!isSleeping) {
            setIsSleeping(true);
            setSleepStartTime(new Date());
        } else {
            const endTime = new Date();
            const diffMs = endTime - sleepStartTime;
            const diffMins = Math.round(diffMs / 60000) || 1;

            const newLog = {
                id: `s-${Date.now()}`,
                startTimestamp: sleepStartTime.toISOString(),
                endTimestamp: endTime.toISOString(),
                totalMinutes: diffMins,
            };
            setSleepLogs((prev) => [newLog, ...prev]);
            setIsSleeping(false);
            setSleepStartTime(null);
            Alert.alert(
                "Sleep Saved",
                `Recorded ${diffMins} minutes of comfortable baby sleep.`,
            );
        }
    };

    const activeTemp = parseFloat(bodyTemp);
    const tempStatus =
        activeTemp > 37.8
            ? t("dashTempStatusHot")
            : activeTemp < 35.8
              ? t("dashTempStatusCold")
              : t("dashTempStatusNormal");

    const tempColor =
        activeTemp > 37.8
            ? "#EF4444"
            : activeTemp < 35.8
              ? "#3B82F6"
              : "#10B981";

    return (
        <ScrollView style={styles.container}>
            {/* Baby Switcher Bar */}
            <View style={styles.profileBar}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.profilesScroll}
                >
                    {profiles.map((p) => (
                        <TouchableOpacity
                            key={p.id}
                            onPress={() => onSelectProfile(p.id)}
                            style={[
                                styles.profileTab,
                                profile.id === p.id && styles.profileTabActive,
                            ]}
                        >
                            <Image
                                source={{ uri: p.avatarUrl }}
                                style={styles.avatarMini}
                            />
                            <Text
                                style={[
                                    styles.profileName,
                                    profile.id === p.id &&
                                        styles.profileNameActive,
                                ]}
                            >
                                {p.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                        onPress={onOpenAddModal}
                        style={styles.addProfileButton}
                    >
                        <Ionicons name="plus" size={16} color="#456155" />
                        <Text style={styles.addProfileText}>Add</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Active Profile Header Info Card */}
            <View style={styles.babyCard}>
                <Image
                    source={{ uri: profile.avatarUrl }}
                    style={styles.babyAvatar}
                />
                <View style={styles.babyInfo}>
                    <Text style={styles.babyNameTitle}>{profile.name}</Text>
                    <Text style={styles.babyDob}>
                        DOB: {profile.dateOfBirth}
                    </Text>
                    <Text style={styles.babyBio}>
                        Height: {profile.currentHeight || profile.birthHeight}{" "}
                        cm | Weight:{" "}
                        {profile.currentWeight || profile.birthWeight} kg
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={onOpenEditModal}
                    style={styles.editButton}
                >
                    <Ionicons name="pencil" size={16} color="#456155" />
                </TouchableOpacity>
            </View>

            {/* Metric Widget Section */}
            <View style={styles.widgetsGrid}>
                <MetricWidgetCard
                    title={t("dashFeedingTitle")}
                    value={
                        feedLogs[0]
                            ? feedLogs[0].feedType === "milk"
                                ? `${feedLogs[0].amountMl} ml`
                                : `${feedLogs[0].grams} g`
                            : "No record"
                    }
                    subtitle={
                        feedLogs[0]
                            ? `Last: ${feedLogs[0].notes || feedLogs[0].feedType}`
                            : "Ready to record"
                    }
                    icon={
                        <MaterialCommunityIcons
                            name="baby-bottle-outline"
                            size={24}
                            color="#456155"
                        />
                    }
                    iconBg="#E6F4EA"
                    action={
                        <TouchableOpacity
                            onPress={() => setShowFeedModal(true)}
                            style={styles.widgetActionBtn}
                        >
                            <Ionicons
                                name="plus-circle"
                                size={20}
                                color="#FF8A7A"
                            />
                        </TouchableOpacity>
                    }
                />

                <MetricWidgetCard
                    title={t("dashSleepTitle")}
                    value={
                        isSleeping
                            ? "Sleeping..."
                            : sleepLogs[0]
                              ? `${sleepLogs[0].totalMinutes} mins`
                              : "No record"
                    }
                    subtitle={
                        isSleeping ? "Active timer running" : "Ready to record"
                    }
                    icon={
                        <Ionicons
                            name="moon-outline"
                            size={24}
                            color="#456155"
                        />
                    }
                    iconBg="#E6F4EA"
                    action={
                        <TouchableOpacity
                            onPress={toggleSleep}
                            style={[
                                styles.widgetActionBtn,
                                isSleeping && styles.widgetActionActive,
                            ]}
                        >
                            <Ionicons
                                name={isSleeping ? "square" : "play-circle"}
                                size={20}
                                color={isSleeping ? "#EF4444" : "#FF8A7A"}
                            />
                        </TouchableOpacity>
                    }
                />
            </View>

            <View style={[styles.widgetsGrid, { marginTop: 0 }]}>
                <MetricWidgetCard
                    title={t("dashTempTitle")}
                    value={`${bodyTemp}°C`}
                    subtitle={tempStatus}
                    icon={
                        <Ionicons
                            name="thermometer-outline"
                            size={24}
                            color="#456155"
                        />
                    }
                    iconBg="#E6F4EA"
                    action={
                        <TouchableOpacity
                            onPress={() => setShowTempModal(true)}
                            style={styles.widgetActionBtn}
                        >
                            <Ionicons
                                name="create-outline"
                                size={20}
                                color="#FF8A7A"
                            />
                        </TouchableOpacity>
                    }
                />
            </View>

            {/* Interactive Logs List */}
            <SectionContainerCard
                title={
                    language === "en"
                        ? "Recent Feeding Logs"
                        : "Kamakailang Talaan ng Pagpapakain"
                }
                subtitle={t("dashFeedingSub")}
            >
                {feedLogs.slice(0, 3).map((log, index) => (
                    <ListEntryCard
                        key={log.id || index}
                        title={
                            log.feedType === "milk"
                                ? `Milk Feed: ${log.amountMl}ml`
                                : `Solid Feed: ${log.grams}g`
                        }
                        subtitle={new Date(log.timestamp).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" },
                        )}
                        notes={log.notes}
                        icon={
                            <Ionicons
                                name={
                                    log.feedType === "milk"
                                        ? "water-outline"
                                        : "restaurant-outline"
                                }
                                size={18}
                                color="#456155"
                            />
                        }
                        iconBg="#F5F5F4"
                    />
                ))}
                {feedLogs.length === 0 && (
                    <EmptyStateCard message="No feeding logs recorded today" />
                )}
            </SectionContainerCard>

            {/* Milestones memory grids */}
            <SectionContainerCard
                title={t("dashMemoriesTitle")}
                subtitle={t("dashMemoriesSub")}
            >
                <View style={styles.memoriesGrid}>
                    {milestones
                        .filter((m) => m.isCompleted)
                        .slice(0, 2)
                        .map((m, idx) => (
                            <MemoryVisualCard
                                key={m.id || idx}
                                title={m.title}
                                description={m.description}
                                date={m.date}
                                photoUrl={m.photoUrl}
                            />
                        ))}
                    {milestones.filter((m) => m.isCompleted).length === 0 && (
                        <EmptyStateCard message={t("dashEmptyMemories")} />
                    )}
                </View>
            </SectionContainerCard>

            {/* Temperature Modal */}
            <Modal visible={showTempModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {t("dashTempTitle")}
                        </Text>
                        <Text style={styles.modalLabel}>
                            Biometric Fever Assessment (Celsius)
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            style={styles.modalInput}
                            value={tempInput}
                            onChangeText={setTempInput}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowTempModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveTemp}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>
                                    {t("save")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Feeding Modal */}
            <Modal visible={showFeedModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {t("dashFeedingTitle")}
                        </Text>

                        <View style={styles.genderContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.genderButton,
                                    feedType === "milk" &&
                                        styles.genderButtonActive,
                                ]}
                                onPress={() => {
                                    setFeedType("milk");
                                    setFeedAmount("150");
                                }}
                            >
                                <Text
                                    style={[
                                        styles.genderButtonText,
                                        feedType === "milk" &&
                                            styles.genderButtonTextActive,
                                    ]}
                                >
                                    Milk (Bottle / Breast)
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.genderButton,
                                    feedType === "solids" &&
                                        styles.genderButtonActive,
                                ]}
                                onPress={() => {
                                    setFeedType("solids");
                                    setFeedAmount("80");
                                }}
                            >
                                <Text
                                    style={[
                                        styles.genderButtonText,
                                        feedType === "solids" &&
                                            styles.genderButtonTextActive,
                                    ]}
                                >
                                    Solids / Puree
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalLabel, { marginTop: 12 }]}>
                            {feedType === "milk"
                                ? "Volume (ml)"
                                : "Weight (grams)"}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            style={styles.modalInput}
                            value={feedAmount}
                            onChangeText={setFeedAmount}
                        />

                        <Text style={[styles.modalLabel, { marginTop: 12 }]}>
                            Custom notes (e.g. Cerelac, Formula, etc.)
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Optional remarks"
                            value={feedNotes}
                            onChangeText={setFeedNotes}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowFeedModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddFeed}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>
                                    {t("addRecord")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFDF9",
        padding: 16,
    },
    profileBar: {
        marginBottom: 16,
    },
    profilesScroll: {
        alignItems: "center",
    },
    profileTab: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
    },
    profileTabActive: {
        borderColor: "#FF8A7A",
        backgroundColor: "#FFF1F0",
    },
    avatarMini: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 6,
    },
    profileName: {
        fontSize: 12,
        fontWeight: "600",
        color: "#57534E",
    },
    profileNameActive: {
        color: "#FF8A7A",
        fontWeight: "700",
    },
    addProfileButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    addProfileText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#456155",
        marginLeft: 4,
    },
    babyCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#EBEBEB",
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        shadowColor: "#374151",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
        elevation: 1,
    },
    babyAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 12,
    },
    babyInfo: {
        flex: 1,
    },
    babyNameTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#456155",
    },
    babyDob: {
        fontSize: 11,
        color: "#78716C",
        marginTop: 2,
    },
    babyBio: {
        fontSize: 11,
        color: "#57534E",
        fontWeight: "600",
        marginTop: 4,
    },
    editButton: {
        padding: 8,
        backgroundColor: "#F5F5F4",
        borderRadius: 12,
    },
    widgetsGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    widgetActionBtn: {
        padding: 4,
    },
    widgetActionActive: {
        transform: [{ scale: 1.1 }],
    },
    memoriesGrid: {
        marginTop: 4,
    },
    modalBg: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalCard: {
        backgroundColor: "#FFFDF9",
        borderRadius: 24,
        padding: 20,
        width: "100%",
        maxWidth: 340,
        borderWidth: 1,
        borderColor: "#E7E5E4",
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#456155",
        marginBottom: 16,
    },
    modalLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#78716C",
        textTransform: "uppercase",
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        fontSize: 14,
        color: "#1C1917",
        marginBottom: 16,
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
    },
    modalCancelBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: "#F5F5F4",
    },
    modalCancelText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#78716C",
    },
    modalSaveBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: "#FF8A7A",
    },
    modalSaveText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    genderContainer: {
        flexDirection: "row",
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 12,
        padding: 4,
        marginBottom: 12,
    },
    genderButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: "center",
    },
    genderButtonActive: {
        backgroundColor: "#FFFFFF",
        shadowColor: "#374151",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    genderButtonText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#78716C",
    },
    genderButtonTextActive: {
        color: "#456155",
        fontWeight: "700",
    },
});
