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
import { radius, space, type, shadow } from "../theme";
import {
    SectionContainerCard,
    ListEntryCard,
    MemoryVisualCard,
    EmptyStateCard,
} from "./common/Cards";
import { MemoriesSkeleton, AppointmentsSkeleton, SkeletonBlock } from "./ui/Skeleton";
import { useRefreshControl } from "./ui/useRefreshControl";
import ShowMore from "./ui/ShowMore";
import MemoryDetail from "./MemoryDetail";
import PercentileChart from "./PercentileChart";
import {
    WHO_MAX_DAY,
    ageInDays,
    formatPercentile,
    normalizeSex,
    percentileFromZ,
    unitFor,
    zScore,
} from "../utils/whoGrowth";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import TipStrip from "./ui/TipStrip";
import KeyboardAvoider from "./ui/KeyboardAvoider";

const METRIC_TABS = [
    { key: "weight", label: "Weight", field: "weight" },
    { key: "height", label: "Height", field: "height" },
    { key: "head", label: "Head", field: "head_circumference" },
];

// Plain description of where a measurement sits. Deliberately positional, never
// diagnostic: WHO's own cut-offs carry clinical labels ("underweight") that this
// product is not entitled to apply — see PRODUCT.md, "Never imply clinical
// authority". We say where the point is and let a health worker judge it.
function describeZ(z) {
    const a = Math.abs(z);
    if (a <= 2) return { text: "Within the range WHO reports for most children this age", flag: false };
    if (a <= 3)
        return {
            text: `${z > 0 ? "Above" : "Below"} the range WHO reports for most children this age`,
            flag: true,
        };
    return {
        text: `Well ${z > 0 ? "above" : "below"} the range WHO reports for most children this age`,
        flag: true,
    };
}

function ageLabel(days) {
    if (days == null) return "";
    if (days < 31) return `${days} day${days === 1 ? "" : "s"} old`;
    const months = Math.floor(days / 30.4375);
    if (months < 24) return `${months} month${months === 1 ? "" : "s"} old`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem ? `${years}y ${rem}m old` : `${years} year${years === 1 ? "" : "s"} old`;
}

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
    // Raw growth_records rows. The Metrics tab used to show only the two values
    // cached on the profile, so there was no history and nothing to plot.
    const [growthRows, setGrowthRows] = useState([]);
    const [metricsVisible, setMetricsVisible] = useState(10);
    const [metricKey, setMetricKey] = useState("weight");
    const [reloadTick, setReloadTick] = useState(0);
    useEffect(() => {
        let active = true;
        setGrowthLoading(true);
        (async () => {
            try {
                const [mRows, gRows] = await Promise.all([
                    api.listRecords(profile.id, "milestones"),
                    api.listRecords(profile.id, "growth").catch(() => []),
                ]);
                if (!active) return;
                setMstones(mRows.map(milestoneToApp));
                setGrowthRows(Array.isArray(gRows) ? gRows : []);
            } catch (e) {
                console.log("load growth records:", e.message);
            } finally {
                if (active) setGrowthLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id, reloadTick]);

    const refreshControl = useRefreshControl(growthLoading, () => setReloadTick((n) => n + 1));

    // WHO publishes separate curves per sex and none for an unrecorded sex.
    // adapters.js quietly defaults an unknown sex to girl for theming; that
    // default must not decide which growth curve a child is measured against,
    // so this reads the recorded value and yields null when it is absent.
    const sexKey = useMemo(() => normalizeSex(profile.sex || profile.gender), [profile.sex, profile.gender]);

    const activeMetric = METRIC_TABS.find((m) => m.key === metricKey) || METRIC_TABS[0];

    const measurements = useMemo(() => {
        return (growthRows || [])
            .map((r) => {
                const date = r.date_recorded ? String(r.date_recorded).slice(0, 10) : null;
                if (!date) return null;
                return {
                    id: r.id,
                    date,
                    day: ageInDays(profile.dateOfBirth, date),
                    weight: r.weight != null && r.weight !== "" ? Number(r.weight) : null,
                    height: r.height != null && r.height !== "" ? Number(r.height) : null,
                    head_circumference:
                        r.head_circumference != null && r.head_circumference !== ""
                            ? Number(r.head_circumference)
                            : null,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [growthRows, profile.dateOfBirth]);

    // The profile's cached currentHeight/currentWeight are only written when
    // someone saves through this screen's form, so for a seeded or imported
    // child they fall back to birth values — which read as a contradiction next
    // to a chart plotting the real latest measurement. Prefer the record.
    const latestVitals = useMemo(() => {
        const h = measurements.find((m) => m.height != null);
        const w = measurements.find((m) => m.weight != null);
        return {
            height: h ? h.height : profile.currentHeight || profile.birthHeight,
            weight: w ? w.weight : profile.currentWeight || profile.birthWeight,
        };
    }, [measurements, profile.currentHeight, profile.birthHeight, profile.currentWeight, profile.birthWeight]);

    // Where the most recent measurement of the selected metric falls.
    const reading = useMemo(() => {
        if (!sexKey || !profile.dateOfBirth) return null;
        const usable = measurements
            .filter((m) => m.day != null && m.day <= WHO_MAX_DAY && m[activeMetric.field] > 0)
            .sort((a, b) => a.day - b.day);
        const latest = usable[usable.length - 1];
        if (!latest) return null;
        const value = latest[activeMetric.field];
        const z = zScore(metricKey, sexKey, latest.day, value);
        if (z == null) return null;
        return { latest, value, z, percentile: percentileFromZ(z), ...describeZ(z) };
    }, [measurements, activeMetric.field, metricKey, sexKey, profile.dateOfBirth]);

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
                toast.error(e.message || "Could not update milestone");
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
                toast.error(e.message || "Could not add milestone");
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
            toast.error("Please enter valid parameters");
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
            // Pull the list again so the chart and history include what was
            // just saved instead of going stale until the screen remounts.
            setReloadTick((n) => n + 1);
        } catch (e) {
            console.log("save growth:", e.message);
        }
        toast.success(`Height: ${h}cm, Weight: ${w}kg saved.`);
    };

    return (
        <ScrollView style={styles.container} refreshControl={refreshControl}>
            <TipStrip tipKey="tip_growth">
                Measurements plot against WHO growth curves, so you can see where your child sits versus the
                standard for their age.
            </TipStrip>

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
                            <EmptyStateCard message="No milestones reached yet." icon="trophy-outline" />
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
                        {growthLoading ? (
                            <>
                                <SkeletonBlock width="100%" height={64} radius={radius.md} style={{ marginBottom: 16 }} />
                                <SkeletonBlock width="100%" height={200} radius={radius.lg} />
                            </>
                        ) : (
                            <>
                        <View style={styles.metricsHeaderBox}>
                            <View style={styles.metricsHeaderCol}>
                                <Text style={styles.metricsHeaderLabel}>
                                    Height
                                </Text>
                                <Text style={styles.metricsHeaderValue}>
                                    {latestVitals.height} cm
                                </Text>
                            </View>
                            <View style={styles.metricsHeaderDivider} />
                            <View style={styles.metricsHeaderCol}>
                                <Text style={styles.metricsHeaderLabel}>
                                    Weight
                                </Text>
                                <Text style={styles.metricsHeaderValue}>
                                    {latestVitals.weight} kg
                                </Text>
                            </View>
                        </View>

                        <View style={styles.metricSwitch}>
                            {METRIC_TABS.map((m) => {
                                const on = metricKey === m.key;
                                return (
                                    <TouchableOpacity
                                        key={m.key}
                                        onPress={() => setMetricKey(m.key)}
                                        style={[styles.metricChip, on && styles.metricChipOn]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: on }}
                                        accessibilityLabel={`Show ${m.label} chart`}
                                    >
                                        <Text style={[styles.metricChipText, on && styles.metricChipTextOn]}>
                                            {m.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <PercentileChart
                            indicator={metricKey}
                            sex={sexKey}
                            dateOfBirth={profile.dateOfBirth}
                            rows={growthRows}
                        />

                        {reading ? (
                            <View style={styles.readingBox}>
                                <View style={styles.readingTop}>
                                    <Text style={styles.readingValue}>
                                        {reading.value} {unitFor(metricKey)}
                                    </Text>
                                    <Text style={styles.readingPct}>
                                        {formatPercentile(reading.percentile)} percentile
                                    </Text>
                                </View>
                                <Text style={styles.readingText}>
                                    {reading.text} — measured at {ageLabel(reading.latest.day)}.
                                </Text>
                            </View>
                        ) : null}

                        {reading && reading.flag ? (
                            <View style={styles.promptBox}>
                                <Ionicons
                                    name="chatbubble-ellipses-outline"
                                    size={16}
                                    color={colors.info}
                                    style={{ marginTop: 1 }}
                                />
                                <Text style={styles.promptText}>
                                    Worth mentioning at the next check-up. Children grow at different rates
                                    and a single measurement outside the range is common — your health
                                    worker can tell you whether it means anything.
                                </Text>
                            </View>
                        ) : null}

                        <Text style={styles.sourceNote}>
                            {sexKey
                                ? `Shaded bands are the WHO Child Growth Standards for ${sexKey}, birth to 5 years. This compares your child with a reference population — it is not a medical assessment.`
                                : "Reference bands come from the WHO Child Growth Standards, birth to 5 years. They compare a child with a reference population and are not a medical assessment."}
                        </Text>
                            </>
                        )}
                    </SectionContainerCard>

                    <SectionContainerCard
                        title="Measurement History"
                        subtitle={
                            measurements.length
                                ? `${measurements.length} recorded, newest first`
                                : "Every measurement you record appears here"
                        }
                    >
                        {growthLoading ? (
                            <AppointmentsSkeleton count={3} />
                        ) : measurements.length === 0 ? (
                            <EmptyStateCard
                                message="No measurements recorded yet. Add one to start the chart."
                                icon="analytics-outline"
                            />
                        ) : (
                            <>
                                {measurements.slice(0, metricsVisible).map((m) => {
                                    const parts = [];
                                    if (m.weight != null) parts.push(`${m.weight} kg`);
                                    if (m.height != null) parts.push(`${m.height} cm`);
                                    if (m.head_circumference != null)
                                        parts.push(`head ${m.head_circumference} cm`);
                                    return (
                                        <ListEntryCard
                                            key={m.id ?? m.date}
                                            title={parts.join("  ·  ") || "No values recorded"}
                                            subtitle={
                                                m.day != null
                                                    ? `${m.date} · ${ageLabel(m.day)}`
                                                    : m.date
                                            }
                                            icon={
                                                <MaterialCommunityIcons
                                                    name="scale"
                                                    size={18}
                                                    color={colors.recGrowth.on}
                                                />
                                            }
                                            iconBg={colors.recGrowth.bg}
                                        />
                                    );
                                })}
                                <ShowMore
                                    total={measurements.length}
                                    visible={metricsVisible}
                                    onPress={() => setMetricsVisible((c) => c + 10)}
                                    noun="measurements"
                                />
                            </>
                        )}
                    </SectionContainerCard>
                </View>
            )}

            {/* Metrics Modal */}
            <Modal visible={showMetricsModal} transparent animationType="slide">
                <KeyboardAvoider>
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
                </KeyboardAvoider>
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
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: space.xs,
        marginBottom: space.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabButton: {
        flex: 1,
        paddingVertical: space.sm + 2,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        alignItems: "center",
    },
    tabButtonActive: {
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    tabButtonText: {
        ...type.caption,
        color: colors.textMuted,
    },
    tabButtonTextActive: {
        color: colors.primaryDark,
        ...type.label,
    },
    ageSelector: {
        flexDirection: "row",
        marginBottom: 16,
        gap: 8,
    },
    ageTab: {
        flex: 1,
        paddingVertical: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        alignItems: "center",
    },
    ageTabActive: {
        borderColor: colors.accentStrong,
        backgroundColor: colors.primarySoft,
    },
    ageTabText: {
        ...type.caption,
        color: colors.textSecondary,
    },
    ageTabTextActive: {
        color: colors.primaryDark,
        ...type.label,
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
        borderRadius: radius.md,
        borderCurve: "continuous",
        marginRight: 10,
    },
    checklistTitle: {
        ...type.bodyStrong,
        color: colors.text,
    },
    checklistDesc: {
        ...type.caption,
        color: colors.textMuted,
        marginTop: 2,
    },
    checkBtn: {
        width: 28,
        height: 28,
        borderRadius: radius.sm,
        borderCurve: "continuous",
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
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    addApptBtnText: {
        ...type.label,
        color: "#FFFFFF",
    },
    metricsHeaderBox: {
        flexDirection: "row",
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        borderCurve: "continuous",
        padding: 16,
        alignItems: "center",
        marginBottom: 16,
    },
    metricsHeaderCol: {
        flex: 1,
        alignItems: "center",
    },
    metricsHeaderLabel: {
        ...type.subheading,
        color: colors.textMuted,
    },
    metricsHeaderValue: {
        ...type.heading,
        color: colors.primary,
        marginTop: 4,
    },
    metricsHeaderDivider: {
        width: 1,
        height: "100%",
        backgroundColor: colors.border,
    },
    metricSwitch: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
    },
    metricChip: {
        minHeight: 34,
        justifyContent: "center",
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    metricChipOn: {
        backgroundColor: colors.softGreen,
        borderColor: colors.primary,
    },
    metricChipText: { ...type.label, color: colors.textMuted },
    metricChipTextOn: { color: colors.primaryDark },
    readingBox: {
        marginTop: 14,
        padding: 14,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.hairline,
    },
    readingTop: {
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 4,
    },
    readingValue: { ...type.title, color: colors.text },
    readingPct: { ...type.bodyStrong, color: colors.primary },
    readingText: { ...type.bodyStrong, color: colors.textSecondary },
    promptBox: {
        flexDirection: "row",
        gap: 10,
        marginTop: 10,
        padding: 14,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.infoBg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    promptText: { flex: 1, ...type.caption, color: colors.textSecondary },
    sourceNote: {
        marginTop: 12,
        ...type.caption,
        color: colors.textMuted,
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
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: 20,
        width: "100%",
        maxWidth: 340,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: {
        ...type.heading,
        color: colors.primary,
        marginBottom: 16,
    },
    modalLabel: {
        ...type.subheading,
        color: colors.textMuted,
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        height: 44,
        fontSize: type.body.fontSize,
        fontFamily: type.body.fontFamily,
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
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
    },
    modalCancelText: {
        ...type.caption,
        color: colors.textMuted,
    },
    modalSaveBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.accentStrong,
    },
    modalSaveText: {
        ...type.label,
        color: "#FFFFFF",
    },
});
