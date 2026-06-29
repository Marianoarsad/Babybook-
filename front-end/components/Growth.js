import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Image,
    Alert,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import {
    SectionContainerCard,
    ListEntryCard,
    MemoryVisualCard,
    EmptyStateCard,
} from "./common/Cards";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const ageChecklists = [
    {
        id: "mc1",
        ageGroup: "0-3m",
        title: "Responsive Social Smile",
        guidance:
            "Smiles back at you or reacts happily when you speak, cuddle, or make playful faces.",
        photoUrl:
            "https://images.unsplash.com/photo-1519689680058-324335c77ebe?auto=format&fit=crop&q=80&w=600",
    },
    {
        id: "mc2",
        ageGroup: "0-3m",
        title: "Lifts Head During Tummy Time",
        guidance:
            "While resting on the tummy, starts lifting their head and supporting their weight on forearms.",
        photoUrl:
            "https://images.unsplash.com/photo-1510154268590-7842d3ed4c32?auto=format&fit=crop&q=80&w=600",
    },
    {
        id: "mc3",
        ageGroup: "4-6m",
        title: "Rolls Over (Tummy to Back)",
        guidance:
            "Pushes off and rolls from stomach to back, and later from back to tummy.",
        photoUrl:
            "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=600",
    },
    {
        id: "mc4",
        ageGroup: "4-6m",
        title: "Reaches & Grabbing Action",
        guidance:
            "Puts out hands deliberately to touch, close fingers, and grasp visual playthings.",
        photoUrl:
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600",
    },
    {
        id: "mc5",
        ageGroup: "7-9m",
        title: "Steadily Sits Without Support",
        guidance:
            "Can sit vertically alone, maintaining balanced posture without leaning on their hands.",
        photoUrl:
            "https://images.unsplash.com/photo-1596854407944-bf87f6f94791?auto=format&fit=crop&q=80&w=600",
    },
    {
        id: "mc6",
        ageGroup: "7-9m",
        title: "Expresses Babble Vocalizations",
        guidance:
            'Produces repetitive double consonantal sounds like "ba-ba", "ma-ma", or "da-da".',
        photoUrl:
            "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&q=80&w=600",
    },
];

export default function Growth({
    profile,
    onUpdateProfile,
    milestones,
    setMilestones,
    appointments,
    setAppointments,
}) {
    const { language, t } = useLanguage();
    const [growthTab, setGrowthTab] = useState("milestones");
    const [selectedAgeGroup, setSelectedAgeGroup] = useState("0-3m");

    // Metric adding state
    const [showMetricsModal, setShowMetricsModal] = useState(false);
    const [metricHeight, setMetricHeight] = useState("68.2");
    const [metricWeight, setMetricWeight] = useState("7.4");

    // Appointment adding state
    const [showApptModal, setShowApptModal] = useState(false);
    const [apptTitle, setApptTitle] = useState("Developmental Assessment");
    const [apptDoctor, setApptDoctor] = useState("Dr. Sarah Chen");
    const [apptDate, setApptDate] = useState("2026-06-30");
    const [apptTime, setApptTime] = useState("10:00");
    const [apptNotes, setApptNotes] = useState("");

    const handleSaveMetrics = () => {
        const h = parseFloat(metricHeight);
        const w = parseFloat(metricWeight);
        if (isNaN(h) || isNaN(w) || h <= 0 || w <= 0) {
            Alert.alert("Error", "Please enter valid parameters");
            return;
        }
        onUpdateProfile({
            ...profile,
            currentHeight: h,
            currentWeight: w,
        });
        setShowMetricsModal(false);
        Alert.alert(
            "Metrics Saved",
            `Height: ${h}cm, Weight: ${w}kg saved to profile.`,
        );
    };

    const handleAddAppointment = () => {
        if (!apptTitle || !apptDoctor || !apptDate) {
            Alert.alert("Error", "Please fill out required fields");
            return;
        }
        const newAppt = {
            id: `a-${Date.now()}`,
            profileId: profile.id,
            title: apptTitle,
            provider: apptDoctor,
            date: apptDate,
            time: apptTime,
            notes: apptNotes,
            reminderActive: true,
            isCompleted: false,
        };
        setAppointments((prev) => [...prev, newAppt]);
        setShowApptModal(false);
        Alert.alert(
            "Appointment Slotted",
            `Pediatric session scheduled successfully.`,
        );
    };

    return (
        <ScrollView style={styles.container}>
            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        growthTab === "milestones" && styles.tabButtonActive,
                    ]}
                    onPress={() => setGrowthTab("milestones")}
                >
                    <Text
                        style={[
                            styles.tabButtonText,
                            growthTab === "milestones" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        {t("growthMilestonesTitle")}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        growthTab === "metrics" && styles.tabButtonActive,
                    ]}
                    onPress={() => setGrowthTab("metrics")}
                >
                    <Text
                        style={[
                            styles.tabButtonText,
                            growthTab === "metrics" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        {t("growthMetricsTitle")}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        growthTab === "appointments" && styles.tabButtonActive,
                    ]}
                    onPress={() => setGrowthTab("appointments")}
                >
                    <Text
                        style={[
                            styles.tabButtonText,
                            growthTab === "appointments" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Checkups
                    </Text>
                </TouchableOpacity>
            </View>

            {/* GROWTH TAB: MILESTONES */}
            {growthTab === "milestones" && (
                <View>
                    {/* Age selection group */}
                    <View style={styles.ageSelector}>
                        {["0-3m", "4-6m", "7-9m"].map((group) => (
                            <TouchableOpacity
                                key={group}
                                style={[
                                    styles.ageTab,
                                    selectedAgeGroup === group &&
                                        styles.ageTabActive,
                                ]}
                                onPress={() => setSelectedAgeGroup(group)}
                            >
                                <Text
                                    style={[
                                        styles.ageTabText,
                                        selectedAgeGroup === group &&
                                            styles.ageTabTextActive,
                                    ]}
                                >
                                    {group}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Guidelines checklist */}
                    <SectionContainerCard
                        title="Development Checklist"
                        subtitle={t("growthMilestonesSub")}
                    >
                        {ageChecklists
                            .filter((c) => c.ageGroup === selectedAgeGroup)
                            .map((item, index) => {
                                const matchingMilestone = milestones.find(
                                    (m) => m.title === item.title,
                                );
                                const isDone = matchingMilestone
                                    ? matchingMilestone.isCompleted
                                    : false;

                                return (
                                    <View
                                        key={item.id || index}
                                        style={styles.checklistRow}
                                    >
                                        <Image
                                            source={{ uri: item.photoUrl }}
                                            style={styles.checklistImg}
                                        />
                                        <View
                                            style={{ flex: 1, marginRight: 8 }}
                                        >
                                            <Text style={styles.checklistTitle}>
                                                {item.title}
                                            </Text>
                                            <Text style={styles.checklistDesc}>
                                                {item.guidance}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setMilestones((prev) =>
                                                    prev.map((m) => {
                                                        if (
                                                            m.title ===
                                                            item.title
                                                        ) {
                                                            return {
                                                                ...m,
                                                                isCompleted:
                                                                    !m.isCompleted,
                                                                date: new Date()
                                                                    .toISOString()
                                                                    .split(
                                                                        "T",
                                                                    )[0],
                                                            };
                                                        }
                                                        return m;
                                                    }),
                                                );
                                            }}
                                            style={[
                                                styles.checkBtn,
                                                isDone && styles.checkBtnActive,
                                            ]}
                                        >
                                            <Ionicons
                                                name={
                                                    isDone
                                                        ? "checkmark"
                                                        : "square-outline"
                                                }
                                                size={18}
                                                color={
                                                    isDone
                                                        ? "#FFFFFF"
                                                        : "#456155"
                                                }
                                            />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                    </SectionContainerCard>

                    {/* Memories list */}
                    <SectionContainerCard
                        title={t("dashMemoriesTitle")}
                        subtitle={t("dashMemoriesSub")}
                    >
                        {milestones
                            .filter((m) => m.isCompleted)
                            .map((m, idx) => (
                                <MemoryVisualCard
                                    key={m.id || idx}
                                    title={m.title}
                                    description={m.description}
                                    date={m.date}
                                    photoUrl={m.photoUrl}
                                />
                            ))}
                    </SectionContainerCard>
                </View>
            )}

            {/* GROWTH TAB: PHYSICAL METRICS */}
            {growthTab === "metrics" && (
                <View>
                    <SectionContainerCard
                        title="Physical Metrics Logs"
                        subtitle="Record parameters to track baby's physical development indices"
                        action={
                            <TouchableOpacity
                                onPress={() => setShowMetricsModal(true)}
                                style={styles.addApptBtn}
                            >
                                <Ionicons
                                    name="add"
                                    size={16}
                                    color="#FFFFFF"
                                    style={{ marginRight: 4 }}
                                />
                                <Text style={styles.addApptBtnText}>
                                    {t("growthAddMetrics")}
                                </Text>
                            </TouchableOpacity>
                        }
                    >
                        <View style={styles.metricsHeaderBox}>
                            <View style={styles.metricsHeaderCol}>
                                <Text style={styles.metricsHeaderLabel}>
                                    Height
                                </Text>
                                <Text style={styles.metricsHeaderValue}>
                                    {profile.currentHeight ||
                                        profile.birthHeight}{" "}
                                    cm
                                </Text>
                            </View>
                            <View style={styles.metricsHeaderDivider} />
                            <View style={styles.metricsHeaderCol}>
                                <Text style={styles.metricsHeaderLabel}>
                                    Weight
                                </Text>
                                <Text style={styles.metricsHeaderValue}>
                                    {profile.currentWeight ||
                                        profile.birthWeight}{" "}
                                    kg
                                </Text>
                            </View>
                        </View>

                        <ListEntryCard
                            title="Recent Growth Parameters"
                            subtitle="Latest clinic update"
                            label={
                                <Text style={{ fontSize: 13, color: "#444" }}>
                                    Height:{" "}
                                    {profile.currentHeight ||
                                        profile.birthHeight}
                                    cm | Weight:{" "}
                                    {profile.currentWeight ||
                                        profile.birthWeight}
                                    kg
                                </Text>
                            }
                            icon={
                                <MaterialCommunityIcons
                                    name="scale"
                                    size={18}
                                    color="#456155"
                                />
                            }
                            iconBg="#E6F4EA"
                        />
                    </SectionContainerCard>
                </View>
            )}

            {/* GROWTH TAB: CLINIC APPOINTMENTS */}
            {growthTab === "appointments" && (
                <View>
                    <SectionContainerCard
                        title="Clinical Consults & Appointments"
                        subtitle="Manage scheduled wellness checks and specialist visits"
                        action={
                            <TouchableOpacity
                                onPress={() => setShowApptModal(true)}
                                style={styles.addApptBtn}
                            >
                                <Ionicons
                                    name="add"
                                    size={16}
                                    color="#FFFFFF"
                                    style={{ marginRight: 4 }}
                                />
                                <Text style={styles.addApptBtnText}>
                                    Add Appt
                                </Text>
                            </TouchableOpacity>
                        }
                    >
                        {appointments.map((appt, idx) => (
                            <ListEntryCard
                                key={appt.id || idx}
                                title={appt.title}
                                subtitle={`${appt.date} @ ${appt.time}`}
                                label={
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: "#456155",
                                            fontWeight: "600",
                                        }}
                                    >
                                        Doctor: {appt.provider}
                                    </Text>
                                }
                                notes={appt.notes}
                                icon={
                                    <Ionicons
                                        name="calendar-outline"
                                        size={18}
                                        color="#456155"
                                    />
                                }
                                iconBg="#E6F4EA"
                            />
                        ))}
                    </SectionContainerCard>
                </View>
            )}

            {/* Metrics Modal */}
            <Modal visible={showMetricsModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {t("growthAddMetrics")}
                        </Text>

                        <Text style={styles.modalLabel}>Height (cm)</Text>
                        <TextInput
                            keyboardType="numeric"
                            style={styles.modalInput}
                            value={metricHeight}
                            onChangeText={setMetricHeight}
                        />

                        <Text style={styles.modalLabel}>Weight (kg)</Text>
                        <TextInput
                            keyboardType="numeric"
                            style={styles.modalInput}
                            value={metricWeight}
                            onChangeText={setMetricWeight}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowMetricsModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveMetrics}
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

            {/* Appointments Modal */}
            <Modal visible={showApptModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>New Appointment</Text>

                        <Text style={styles.modalLabel}>Appointment Title</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={apptTitle}
                            onChangeText={setApptTitle}
                        />

                        <Text style={styles.modalLabel}>
                            Pediatrician / Provider
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={apptDoctor}
                            onChangeText={setApptDoctor}
                        />

                        <View style={{ flexDirection: "row", gap: 8 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalLabel}>Date</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={apptDate}
                                    onChangeText={setApptDate}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalLabel}>Time</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={apptTime}
                                    onChangeText={setApptTime}
                                />
                            </View>
                        </View>

                        <Text style={styles.modalLabel}>
                            Clinic Guidelines / Notes
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={apptNotes}
                            onChangeText={setApptNotes}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowApptModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddAppointment}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>
                                    Schedule
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
    tabContainer: {
        flexDirection: "row",
        backgroundColor: "#F5F5F4",
        borderRadius: 24,
        padding: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#E7E5E4",
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: "center",
    },
    tabButtonActive: {
        backgroundColor: "#FFFFFF",
        shadowColor: "#374151",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    tabButtonText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#78716C",
    },
    tabButtonTextActive: {
        color: "#456155",
        fontWeight: "750",
    },
    ageSelector: {
        flexDirection: "row",
        marginBottom: 16,
        gap: 8,
    },
    ageTab: {
        flex: 1,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 16,
        alignItems: "center",
    },
    ageTabActive: {
        borderColor: "#FF8A7A",
        backgroundColor: "#FFF1F0",
    },
    ageTabText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#57534E",
    },
    ageTabTextActive: {
        color: "#FF8A7A",
        fontWeight: "700",
    },
    checklistRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F5F5F4",
        paddingBottom: 12,
    },
    checklistImg: {
        width: 48,
        height: 48,
        borderRadius: 12,
        marginRight: 10,
    },
    checklistTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1C1917",
    },
    checklistDesc: {
        fontSize: 11,
        color: "#78716C",
        marginTop: 2,
    },
    checkBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#456155",
        justifyContent: "center",
        alignItems: "center",
    },
    checkBtnActive: {
        backgroundColor: "#456155",
    },
    addApptBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FF8A7A",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    addApptBtnText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "700",
    },
    metricsHeaderBox: {
        flexDirection: "row",
        backgroundColor: "#F5F5F4",
        borderRadius: 16,
        padding: 16,
        alignItems: "center",
        marginBottom: 16,
    },
    metricsHeaderCol: {
        flex: 1,
        alignItems: "center",
    },
    metricsHeaderLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: "#888",
        textTransform: "uppercase",
    },
    metricsHeaderValue: {
        fontSize: 18,
        fontWeight: "800",
        color: "#456155",
        marginTop: 4,
    },
    metricsHeaderDivider: {
        width: 1,
        height: "100%",
        backgroundColor: "#E7E5E4",
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
});
