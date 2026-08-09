import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Image,
} from "react-native";
import { api } from "../utils/api";
import { milestoneToApp } from "../utils/adapters";
import { useToast } from "./ui/Toast";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import {
    SectionContainerCard,
    ListEntryCard,
    MemoryVisualCard,
    EmptyStateCard,
} from "./common/Cards";
import { MemoriesSkeleton } from "./ui/Skeleton";
import ShowMore from "./ui/ShowMore";
import MemoryDetail from "./MemoryDetail";
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
    initialTab,
    navKey,
}) {
    const { language, t } = useLanguage();
    const toast = useToast();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const Alert = {
        alert: (title, message) => {
            const m = message || title || "";
            if (title === "Error" || /invalid|fail|denied|unable/i.test(String(title))) toast.error(m);
            else toast.success(m);
        },
    };
    const [growthTab, setGrowthTab] = useState("milestones");
    const [selectedAgeGroup, setSelectedAgeGroup] = useState("0-3m");
    // Apply a deep-link tab request from the floating log button, and — for
    // "Log Growth"/"Schedule Checkup" — open the matching form directly
    // instead of just switching tabs, the same way NutritionTracker.js
    // already does for "Log Milk"/"Log Food".
    useEffect(() => {
        const valid = ["milestones", "metrics", "gallery"];
        if (initialTab && valid.includes(initialTab)) {
            setGrowthTab(initialTab);
            if (initialTab === "metrics") setShowMetricsModal(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navKey]);

    // Milestones load from / persist to the backend. Nutrition moved to its
    // own top-level screen (App.js) — see NutritionTracker.js. Checkups moved
    // to the Health screen — see Health.js.
    const [mstones, setMstones] = useState([]);
    const [memoriesVisible, setMemoriesVisible] = useState(10);
    const [growthLoading, setGrowthLoading] = useState(true);
    const [detailMemory, setDetailMemory] = useState(null);
    useEffect(() => {
        let active = true;
        setGrowthLoading(true);
        (async () => {
            try {
                const mRows = await api.listRecords(profile.id, "milestones");
                if (!active) return;
                setMstones(mRows.map(milestoneToApp));
            } catch (e) {
                console.log("load growth records:", e.message);
            } finally {
                if (active) setGrowthLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);

    const completedMilestones = useMemo(() => mstones.filter((m) => m.isCompleted), [mstones]);

    const todayStr = () => new Date().toISOString().split("T")[0];
    const handleToggleMilestone = async (title) => {
        const existing = mstones.find((m) => m.title === title);
        if (existing) {
            const now = !existing.isCompleted;
            setMstones((prev) =>
                prev.map((m) => (m.id === existing.id ? { ...m, isCompleted: now, date: todayStr() } : m)),
            );
            try {
                await api.updateRecord(profile.id, "milestones", existing.id, {
                    is_completed: now,
                    date_recorded: todayStr(),
                });
            } catch (e) {
                setMstones((prev) => prev.map((m) => (m.id === existing.id ? existing : m)));
                Alert.alert("Error", e.message || "Could not update milestone");
            }
        } else {
            try {
                const saved = await api.createRecord(profile.id, "milestones", {
                    title,
                    is_completed: true,
                    date_recorded: todayStr(),
                });
                setMstones((prev) => [milestoneToApp(saved), ...prev]);
            } catch (e) {
                Alert.alert("Error", e.message || "Could not add milestone");
            }
        }
    };

    // Metric adding state
    const [showMetricsModal, setShowMetricsModal] = useState(false);
    const [metricHeight, setMetricHeight] = useState("68.2");
    const [metricWeight, setMetricWeight] = useState("7.4");
    const [metricHead, setMetricHead] = useState("");

    const handleSaveMetrics = async () => {
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
        // Persist as a growth record (feeds the QR consultation snapshot).
        try {
            await api.createRecord(profile.id, "growth", {
                height: h,
                weight: w,
                head_circumference: parseFloat(metricHead) || null,
                date_recorded: new Date().toISOString().split("T")[0],
            });
        } catch (e) {
            console.log("save growth:", e.message);
        }
        Alert.alert(
            "Metrics Saved",
            `Height: ${h}cm, Weight: ${w}kg saved.`,
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
                        numberOfLines={1}
                        style={[
                            styles.tabButtonText,
                            { textAlign: "center" },
                            growthTab === "milestones" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Milestones
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
                        numberOfLines={1}
                        style={[
                            styles.tabButtonText,
                            { textAlign: "center" },
                            growthTab === "metrics" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Growth
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        growthTab === "gallery" && styles.tabButtonActive,
                    ]}
                    onPress={() => setGrowthTab("gallery")}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabButtonText,
                            { textAlign: "center" },
                            growthTab === "gallery" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Gallery
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
                                const matchingMilestone = mstones.find(
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
                                            onPress={() => handleToggleMilestone(item.title)}
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
                                                        : colors.primary
                                                }
                                            />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                    </SectionContainerCard>
                </View>
            )}

            {/* GROWTH TAB: GALLERY */}
            {growthTab === "gallery" && (
                <View>
                    <SectionContainerCard
                        title={t("dashMemoriesTitle")}
                        subtitle={t("dashMemoriesSub")}
                    >
                        {growthLoading && <MemoriesSkeleton count={2} />}
                        {!growthLoading &&
                            completedMilestones
                                .slice(0, memoriesVisible)
                                .map((m, idx) => (
                                    <MemoryVisualCard
                                        key={m.id || idx}
                                        title={m.title}
                                        description={m.description}
                                        date={m.date}
                                        photoUrl={m.photoUrl}
                                        onClick={() => setDetailMemory(m)}
                                    />
                                ))}
                        {!growthLoading && completedMilestones.length === 0 && (
                            <EmptyStateCard message="No milestones reached yet." />
                        )}
                        {!growthLoading && (
                            <ShowMore
                                total={completedMilestones.length}
                                visible={memoriesVisible}
                                onPress={() => setMemoriesVisible((c) => c + 10)}
                                noun="memories"
                            />
                        )}
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
                                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
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
                                    color={colors.primary}
                                />
                            }
                            iconBg={colors.tintGreen}
                        />
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

                        <Text style={styles.modalLabel}>
                            Head Circumference (cm) — optional
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            style={styles.modalInput}
                            placeholder="e.g. 43.5"
                            placeholderTextColor={colors.placeholder}
                            value={metricHead}
                            onChangeText={setMetricHead}
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

            <MemoryDetail
                visible={!!detailMemory}
                memory={detailMemory}
                dob={profile.dateOfBirth}
                typeLabel="Milestone"
                onClose={() => setDetailMemory(null)}
            />
        </ScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 16,
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: colors.surfaceAlt,
        borderRadius: 24,
        padding: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
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
        color: colors.textMuted,
    },
    tabButtonTextActive: {
        color: colors.primary,
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
        borderColor: colors.border,
        borderRadius: 16,
        alignItems: "center",
    },
    ageTabActive: {
        borderColor: colors.accentStrong,
        backgroundColor: colors.softCoral,
    },
    ageTabText: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    ageTabTextActive: {
        color: colors.accentStrong,
        fontWeight: "700",
    },
    checklistRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceAlt,
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
        color: colors.text,
    },
    checklistDesc: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
    },
    checkBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
    },
    checkBtnActive: {
        backgroundColor: colors.primary,
    },
    addApptBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.accentStrong,
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
        backgroundColor: colors.surfaceAlt,
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
        color: colors.textMuted,
        textTransform: "uppercase",
    },
    metricsHeaderValue: {
        fontSize: 18,
        fontWeight: "800",
        color: colors.primary,
        marginTop: 4,
    },
    metricsHeaderDivider: {
        width: 1,
        height: "100%",
        backgroundColor: colors.border,
    },
    modalBg: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalCard: {
        backgroundColor: colors.background,
        borderRadius: 24,
        padding: 20,
        width: "100%",
        maxWidth: 340,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: colors.primary,
        marginBottom: 16,
    },
    modalLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: colors.textMuted,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        fontSize: 14,
        color: colors.text,
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
        backgroundColor: colors.surfaceAlt,
    },
    modalCancelText: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.textMuted,
    },
    modalSaveBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: colors.accentStrong,
    },
    modalSaveText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});
