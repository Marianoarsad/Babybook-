import MemoriesMilestonesCollection from "./ui/MemoriesMilestonesCollection";
import { GALLERY_DEFAULTS, memoryGalleryView } from "../utils/memoryGallery";
import DevelopmentChecklistCard from "./ui/DevelopmentChecklistCard";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    } from "react-native";
import { api } from "../utils/api";
import { useRecords, useScreenRefresh } from "../utils/useRecords";
import { milestoneToApp, memoryToApp } from "../utils/adapters";
import { useToast } from "./ui/Toast";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { radius, space, type, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import {
    SectionContainerCard,
    EmptyStateCard,
} from "./common/Cards";
import { AppointmentsSkeleton, SkeletonBlock } from "./ui/Skeleton";
import PullToRefreshScrollView from "./ui/PullToRefreshScrollView";
import ShowMore from "./ui/ShowMore";
import AnimatedReveal from "./ui/AnimatedReveal";
import MemoryDetail from "./MemoryDetail";
import PercentileChart from "./PercentileChart";
import { GrowthBackground, GrowthControl, GrowthMetricIcon } from "./ui/GrowthVisuals";
import { wholeNumberLabel } from "../utils/whoGrowth";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import TipStrip from "./ui/TipStrip";
import { LatestMeasurementsSummary, growthMeasurements } from "./common/RecordSummaries";
import {
    todayLocal,
    shortDate,
    numericDateRange,
    monthsBetween,
    ageLabel,
    recentDateRange,
} from "../utils/dates";
import AddMemoryModal from "./ui/AddMemoryModal";
import GrowthModal from "./ui/GrowthModal";
import NeumorphicTabs from "./ui/NeumorphicTabs";
import GlassFab from "./ui/GlassFab";
import GrowthIcon from "./ui/GrowthIcon";
import { HistoryBackground, MeasurementHistoryRow } from "./ui/GrowthHistoryVisuals";
import { MedicineSurface } from "./ui/MedicineVisuals";
import OptionSheet from "./ui/OptionSheet";
import PlanDetail from "./ui/PlanDetail";
import SwipeActionRow from "./ui/SwipeActionRow";
import { DeleteConfirmation } from "./ui/RecordFormSheet";
import GlassChartFilterPopover from "./ui/GlassChartFilterPopover";
import GlassDateRangeFilterModal from "./ui/GlassDateRangeFilterModal";
import { growthPreset } from "../utils/dateFilter";
import { GROWTH_METRIC_KEYS, toggleGrowthMetric } from "../utils/growthMetricFilter.cjs";
import {
    CHECKPOINTS,
    bandLabel,
    checkpointFor,
    findRecorded,
    itemsForCheckpoint,
    resolveDevelopmentCategory,
} from "../utils/milestoneChecklist";

// Display names for growth_records.measured_at (migration 007). Reading only:
// the app never treats one place as more or less trustworthy than another.
const PLACE_LABELS = {
    home: "At home",
    health_center: "Health center",
    clinic: "Clinic",
    hospital: "Hospital",
};

const METRIC_TABS = [
    { key: "weight", labelKey: "growthWeight", field: "weight", unit: "kg" },
    { key: "height", labelKey: "growthHeight", field: "height", unit: "cm" },
    { key: "head", labelKey: "growthHeadCirc", filterLabelKey: "growthHeadFilter", field: "head_circumference", unit: "cm" },
];

const defaultGrowthRange = (dateOfBirth) => recentDateRange(30, dateOfBirth);
const yearRangeToDates = (range) => ({
    from: `${range.from}-01-01`,
    to: `${range.to}-12-31`,
});
const normalizeDateView = (saved, dateOfBirth) => {
    const today = todayLocal();
    const currentYear = Number(today.slice(0, 4));
    const yearRange = saved?.yearRange || (saved?.selectedYear
        ? { from: saved.selectedYear, to: saved.selectedYear }
        : { from: currentYear, to: currentYear });
    const savedPreset = saved?.appliedDatePreset;
    const preset = savedPreset === "all"
        ? "year"
        : ["week", "month", "year"].includes(savedPreset)
          ? savedPreset
          : null;
    const dateRange = saved?.dateRange
        || (preset === "year" ? yearRangeToDates(yearRange) : defaultGrowthRange(dateOfBirth));
    return { dateRange, preset, yearRange };
};

// ageLabel now lives in utils/dates.js -- the Dashboard's Growth Chart needs
// the same string, and a second copy is how formatters drift apart.



const GROWTH_TABS = [
    { key: "metrics", label: "Growth" },
    { key: "milestones", label: "Milestones" },
    { key: "gallery", label: "Gallery" },
];

export default function Growth({
    profile,
    onUpdateProfile,
    milestones,
    setMilestones,
    initialTab,
    navKey,
    savedDateView,
    onDateViewChange,
    blurTarget,
}) {
    const { language, t } = useLanguage();
    const toast = useToast();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    // Leftmost tab, same rule as Health.js. Note this does NOT open the Log
    // Growth form: that is fired by the deep-link effect below only when
    // initialTab === "metrics" arrives from the FAB, never from the default.
    const [growthTab, setGrowthTab] = useState("metrics");

    // The checklist band this child's own age falls in. Everything about the
    // Milestones tab keys off this: the tab used to open on the youngest band
    // regardless of the child, so a parent of a three-year-old was shown
    // two-month milestones every single time.
    const ageMonths = useMemo(
        () => monthsBetween(profile.dateOfBirth, todayLocal()),
        [profile.dateOfBirth],
    );
    const ownBand = useMemo(() => checkpointFor(ageMonths), [ageMonths]);
    const [selectedBand, setSelectedBand] = useState(ownBand);
    const [bandSheetOpen, setBandSheetOpen] = useState(false);
    const [bandMenuAnchor, setBandMenuAnchor] = useState(null);

    // Rows for the age menu. "Your baby" is suppressed when the birth date was
    // never recorded: monthsBetween returns null there and checkpointFor falls
    // back to the first band, so labelling it would tell a parent their child
    // is two months old on the strength of a missing field.
    const bandOptions = useMemo(
        () =>
            CHECKPOINTS.map((c) => ({
                key: c,
                label: bandLabel(c),
                note: ageMonths != null && c === ownBand ? "Your baby" : null,
            })),
        [ageMonths, ownBand],
    );

    // Follow the child when the selected child changes — without this, a
    // switch from a newborn to a five-year-old keeps the newborn's band.
    useEffect(() => {
        setSelectedBand(ownBand);
    }, [ownBand]);

    const bandItems = useMemo(() => itemsForCheckpoint(selectedBand), [selectedBand]);
    // Apply a deep-link tab request from the floating log button, and — for
    // "Log Growth"/"Schedule Checkup" — open the matching form directly
    // instead of just switching tabs, the same way NutritionTracker.js
    // already does for "Log Milk"/"Log Food".
    // Same rule Health.js follows: a plain tab name only switches tabs, an
    // alias switches and opens a form. "metrics" is the one legacy exception,
    // kept because the FAB's Log Growth shortcut has always used it.
    useEffect(() => {
        const tabFor = {
            milestones: "milestones",
            metrics: "metrics",
            gallery: "gallery",
            memory: "gallery",
        };
        if (initialTab && tabFor[initialTab]) {
            setGrowthTab(tabFor[initialTab]);
            if (initialTab === "metrics") setShowMetricsModal(true);
            if (initialTab === "memory") setShowAddMemory(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navKey]);

    // Milestones load from / persist to the backend. Nutrition moved to its
    // own top-level screen (App.js) — see NutritionTracker.js. Checkups moved
    // to the Health screen — see Health.js.
    const milestoneRows = useRecords(profile.id, "milestones");
    const mstones = useMemo(() => milestoneRows.map(milestoneToApp), [milestoneRows]);
    const [milestoneBusy, setMilestoneBusy] = useState(null);
    const memoryRows = useRecords(profile.id, "memories");
    const memories = useMemo(() => memoryRows.map(memoryToApp), [memoryRows]);
    const [galleryView, setGalleryView] = useState(() => ({ ...GALLERY_DEFAULTS }));
    const changeGalleryView = patch => setGalleryView(current => ({ ...current, ...patch, visible: 10 }));
    useEffect(() => { setGalleryView({ ...GALLERY_DEFAULTS }); }, [profile.id]);
    const [showAddMemory, setShowAddMemory] = useState(false);
    const [detailMemory, setDetailMemory] = useState(null);
    useEffect(() => setDetailMemory(null), [profile.id]);
    // Raw growth_records rows. The Metrics tab used to show only the two values
    // cached on the profile, so there was no history and nothing to plot.
    const growthRows = useRecords(profile.id, "growth");
    const [metricsVisible, setMetricsVisible] = useState(10);
    const [metricKeys, setMetricKeys] = useState(() => [...GROWTH_METRIC_KEYS]);
    const [metricMenuOpen, setMetricMenuOpen] = useState(false);
    const [metricMenuAnchor, setMetricMenuAnchor] = useState(null);
    const metricTriggerRef = useRef(null);
    const initialDateView = normalizeDateView(savedDateView, profile.dateOfBirth);
    const savedYearRange = initialDateView.yearRange;
    const [yearRange, setYearRange] = useState(savedYearRange);
    const [dateRange, setDateRange] = useState(initialDateView.dateRange);
    const [appliedDatePreset, setAppliedDatePreset] = useState(initialDateView.preset);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const loadGrowth = useCallback(async () => {
        const resources = ["milestones", "growth", "memories"];
        const results = await Promise.allSettled(resources.map((resource) =>
            api.listRecords(profile.id, resource, { loading: "nonblocking" })));
        return resources.filter((_, index) => results[index].status === "rejected");
    }, [profile.id]);
    const { refreshing: growthLoading, failures: refreshFailures, refresh: refreshGrowth } =
        useScreenRefresh(profile.id, loadGrowth);

    useEffect(() => {
        const restored = normalizeDateView(savedDateView, profile.dateOfBirth);
        const initial = { ...restored.dateRange };
        setDateRange(initial);
        setAppliedDatePreset(restored.preset);
        setYearRange(restored.yearRange);
        setDatePickerOpen(false);
        setMetricKeys([...GROWTH_METRIC_KEYS]);
        setMetricMenuOpen(false);
    }, [profile.id, profile.dateOfBirth]);


    const visibleMetrics = useMemo(
        () => METRIC_TABS.filter((metric) => metricKeys.includes(metric.key)),
        [metricKeys],
    );

    const measurements = useMemo(() => growthMeasurements(growthRows, profile.dateOfBirth), [growthRows, profile.dateOfBirth]);

    // A shared date must describe one visit, so this strip is the newest log as
    // a snapshot rather than a mix of values taken on different dates.
    const latestMeasurement = measurements[0] || null;
    const availableMeasurementDates = useMemo(
        () => [...new Set(measurements
            .filter((measurement) => METRIC_TABS.some((metric) => Number(measurement[metric.field]) > 0))
            .map((measurement) => measurement.date))].sort(),
        [measurements],
    );
    const measurementYears = useMemo(
        () => [...new Set(measurements.map((m) => Number(m.date.slice(0, 4))))].sort((a, b) => b - a),
        [measurements],
    );
    const today = todayLocal();
    const currentYear = Number(today.slice(0, 4));
    const birthYear = Number(String(profile.dateOfBirth || "").slice(0, 4));
    const fallbackStartYear = Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= currentYear
        ? birthYear
        : currentYear;
    const historyYearRange = useMemo(() => ({
        from: measurementYears[measurementYears.length - 1] || fallbackStartYear,
        to: measurementYears[0] || currentYear,
    }), [currentYear, fallbackStartYear, measurementYears]);
    const yearOptions = useMemo(
        () => Array.from(
            { length: Math.max(1, historyYearRange.to - historyYearRange.from + 1) },
            (_, index) => historyYearRange.from + index,
        ),
        [historyYearRange],
    );
    const effectiveDateRange = dateRange;
    const filteredMeasurements = useMemo(
        () => measurements.filter((m) => m.date >= effectiveDateRange.from && m.date <= effectiveDateRange.to),
        [measurements, effectiveDateRange],
    );
    const filteredGrowthRows = useMemo(
        () => growthRows.filter((r) => {
            const date = r.date_recorded ? String(r.date_recorded).slice(0, 10) : "";
            return date >= effectiveDateRange.from && date <= effectiveDateRange.to;
        }),
        [growthRows, effectiveDateRange],
    );
    const sharedChartWindow = useMemo(() => {
        const dates = filteredGrowthRows
            .filter((row) => visibleMetrics.some((metric) => Number(row[metric.field]) > 0))
            .map((row) => String(row.date_recorded).slice(0, 10))
            .sort();
        return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
    }, [filteredGrowthRows, visibleMetrics]);
    // The API returns growth rows by date DESC, id DESC, so the first valid
    // value is also the last plotted value for that metric in this filter.
    const latestChartValues = useMemo(
        () => Object.fromEntries(METRIC_TABS.map((metric) => {
            const row = filteredGrowthRows.find(
                (item) => item[metric.field] != null && item[metric.field] !== "",
            );
            const value = row ? Number(row[metric.field]) : null;
            return [
                metric.key,
                Number.isFinite(value) ? `${wholeNumberLabel(value)} ${metric.unit}` : null,
            ];
        })),
        [filteredGrowthRows],
    );
    const chartDateWindow = dateRange;
    const dateLabel = appliedDatePreset
        ? t({ week: "dateFilterWeekly", month: "dateFilterMonthly", year: "dateFilterYearly" }[appliedDatePreset])
        : numericDateRange(dateRange.from, dateRange.to);
    const datePickerMin = profile.dateOfBirth && String(profile.dateOfBirth).slice(0, 10) <= today
        ? String(profile.dateOfBirth).slice(0, 10) : null;

    const openMetricMenu = () => {
        metricTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setMetricMenuAnchor({ x, y, width, height });
            setMetricMenuOpen(true);
        });
    };

    // Achieved milestones the parent actually authored — one carrying a photo
    // or a note. A bare checklist tick is a record, not a keepsake: the
    // Development Checklist now offers ~146 items, and including every tick
    // here would bury a family's photographs under rows of plain text they
    // never wrote. Ticks still show on the checklist itself, with their date.
    const completedMilestones = useMemo(
        () => mstones.filter((m) => m.isCompleted && (m.photoUrl || m.description)),
        [mstones],
    );

    const galleryItems = useMemo(() => [
        ...memories.map(memory => ({ ...memory, kind: "memory" })),
        ...completedMilestones.map(milestone => ({ ...milestone, kind: "milestone" })),
    ], [memories, completedMilestones]);
    const galleryResult = useMemo(() => memoryGalleryView(galleryItems, galleryView), [galleryItems, galleryView]);

    const todayStr = () => todayLocal();
    const handleToggleMilestone = async (title) => {
        const existing = findRecorded(mstones, title);
        setMilestoneBusy(title);
        try {
            await api.optimisticRecord(profile.id, "milestones", existing ? "update" : "create", existing?.id,
                { ...(existing ? {} : { title }), development_category: resolveDevelopmentCategory(existing || { title }, "milestone") || null,
                    is_completed: existing ? !existing.isCompleted : true, date_recorded: todayStr() },
                { entity: existing?.id || title.trim().toLowerCase().replace(/\s+/g, " "), label: "Milestone" });
        } catch (e) { toast.error(e.message || "Could not save milestone"); }
        finally { setMilestoneBusy((current) => current === title ? null : current); }
    };

    // Metric adding state
    const [showMetricsModal, setShowMetricsModal] = useState(false);
    // Editing, details, the single open swipe row, and confirmed deletion stay
    // separate so a late optimistic response cannot act on a newly opened row.
    const [editingGrowth, setEditingGrowth] = useState(null);
    const [detailGrowth, setDetailGrowth] = useState(null);
    const [openGrowthSwipeId, setOpenGrowthSwipeId] = useState(null);
    const [deleteGrowthCandidate, setDeleteGrowthCandidate] = useState(null);
    const [deletingGrowthId, setDeletingGrowthId] = useState(null);

    // The form owns validation, the save, and the toast now — see
    // ui/GrowthModal.js. All this has to do is refresh the list so the chart
    // and history include what just changed.
    const handleGrowthSaved = () => {}; // Confirmed rows are published by the shared client.

    const handleDeleteGrowth = async (id) => {
        if (deletingGrowthId === id) return false;
        setDeletingGrowthId(id);
        setDeleteGrowthCandidate(null); setOpenGrowthSwipeId(null); setDetailGrowth(null); setShowMetricsModal(false);
        try {
            await api.optimisticRecord(profile.id, "growth", "delete", id, {}, { label: "Measurement" });
            toast.success(t("growthMeasurementRemoved"));
            return true;
        } catch (e) { toast.error(e.message || t("growthMeasurementRemoveFailed")); return false; }
        finally { setDeletingGrowthId((current) => current === id ? null : current); }
    };

    const growthDetailPlan = detailGrowth ? {
        title: t("growthMeasurementDetails"),
        date: detailGrowth.date,
        showTime: false,
        categoryLabel: t("growthMeasurementDetails"),
        color: colors.recGrowth.on,
        details: [
            { label: t("growthDetailAge"), value: detailGrowth.day != null ? ageLabel(detailGrowth.day) : "—" },
            { label: t("growthWeight"), value: detailGrowth.weight != null ? `${detailGrowth.weight} kg` : "—" },
            { label: t("growthHeight"), value: detailGrowth.height != null ? `${detailGrowth.height} cm` : "—" },
            { label: t("growthHeadCirc"), value: detailGrowth.head_circumference != null ? `${detailGrowth.head_circumference} cm` : "—" },
            { label: t("growthDetailLocation"), value: PLACE_LABELS[detailGrowth.measured_at] || "—" },
        ],
        notes: detailGrowth.notes,
        showReminder: false,
        deleteLabel: t("delete"),
    } : null;

    return (
        <PullToRefreshScrollView scope={profile.id} refreshing={growthLoading} onRefresh={refreshGrowth}
            error={refreshFailures.length ? "Some records could not be refreshed. Please retry." : ""}
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            keyboardShouldPersistTaps="handled"
        >
            <TipStrip tipKey="tip_growth">
                {t("growthTip")}
            </TipStrip>

            <NeumorphicTabs tabs={GROWTH_TABS} value={growthTab} onChange={setGrowthTab}
                style={styles.tabContainer} />

            {/* Age/profile changes reopen the independently collapsible categories. */}
            {growthTab === "milestones" && (
                <DevelopmentChecklistCard key={`development-${profile.id}-${selectedBand}`}
                    items={bandItems} milestones={mstones} selectedBand={selectedBand}
                    subtitle={t("growthMilestonesSub")} busy={milestoneBusy}
                    onToggle={handleToggleMilestone} onChooseAge={anchor => {
                        setBandMenuAnchor(anchor);
                        setBandSheetOpen(true);
                    }} />
            )}

            {growthTab === "gallery" && <MemoriesMilestonesCollection key={`gallery-${profile.id}`}
                result={galleryResult} view={galleryView} loading={growthLoading}
                onChangeView={changeGalleryView}
                onShowMore={() => setGalleryView(current => ({ ...current, visible: current.visible + 10 }))}
                onOpenRecord={memory => setDetailMemory({ ...memory, childId: profile.id })} blurTarget={blurTarget} />}

            {/* GROWTH TAB: PHYSICAL METRICS */}
            {growthTab === "metrics" && (
                <View>
                    <SectionContainerCard
                        style={styles.trackingPanel}
                        background={<MedicineSurface />}
                        title={t("growthMetricsTitle")}
                        subtitle={t("growthMetricsSub")}
                        action={
                            <GlassFab
                                onPress={() => {
                                    setEditingGrowth(null);
                                    setShowMetricsModal(true);
                                }}
                                style={{ width: MIN_TOUCH, height: MIN_TOUCH }}
                                accessibilityLabel={t("growthAddMetrics")}
                            />
                        }
                    >
                        {growthLoading ? (
                            <>
                                <SkeletonBlock width="100%" height={96} radius={radius.md} style={{ marginBottom: 16 }} />
                                <SkeletonBlock width="100%" height={200} radius={radius.lg} />
                            </>
                        ) : (
                            <>
                        <LatestMeasurementsSummary measurement={latestMeasurement} appearance="neumorphic" />

                        <View style={styles.chartControls}>
                            <GrowthControl
                                onPress={() => setDatePickerOpen(true)}
                                style={styles.dateSelect}
                                accessibilityRole="button"
                                accessibilityLabel={`${t("growthDateFilter")}: ${dateLabel}`}
                            >
                                <Ionicons name="calendar-outline" size={19} color={colors.growthSurface.series} />
                                <Text style={styles.dateSelectText} numberOfLines={1}>{dateLabel}</Text>
                                <Ionicons name="chevron-down" size={16} color={colors.growthSurface.series} />
                            </GrowthControl>

                            <GrowthControl
                                ref={metricTriggerRef}
                                circular
                                onPress={openMetricMenu}
                                style={styles.metricFilterButton}
                                accessibilityRole="button"
                                accessibilityState={{ expanded: metricMenuOpen }}
                                accessibilityLabel={t("growthChartFilterButton").replace(
                                    "{count}",
                                    metricKeys.length,
                                )}
                            >
                                <MaterialCommunityIcons name="tune" size={26} color={colors.growthSurface.series} />
                            </GrowthControl>
                        </View>

                        <Text style={styles.chartHelp}>{t("growthAllChartHelp")}</Text>

                        <View style={styles.allCharts}>
                            {visibleMetrics.map((metric) => (
                                <View key={metric.key} style={[styles.allChart, { boxShadow: colors.growthSurface.metric[metric.key].shadow }]}>
                                    <GrowthBackground metric={metric.key} radius={24} />
                                    <View style={styles.allChartTitleRow}>
                                        <GrowthMetricIcon metric={metric.key} size={36} />
                                        <Text style={styles.allChartTitle}>{t(metric.labelKey)}</Text>
                                        {latestChartValues[metric.key] ? (
                                            <Text selectable style={[styles.allChartLatest, { color: colors.growthSurface.metric[metric.key].accent }]}>
                                                {latestChartValues[metric.key]}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <PercentileChart
                                        animateLine
                                        indicator={metric.key}
                                        dateOfBirth={profile.dateOfBirth}
                                        rows={filteredGrowthRows}
                                        compact
                                        name={t(metric.labelKey)}
                                        showReference={false}
                                        seriesTheme={colors.growthSurface.metric[metric.key]}
                                        gridColor={colors.growthSurface.grid}
                                        areaFill
                                        dateWindow={chartDateWindow}
                                        datePreset={appliedDatePreset}
                                        yearRange={appliedDatePreset === "year" ? yearRange : null}
                                        axisWindow={sharedChartWindow}
                                        pointAlignedShortRange
                                        emptyMessage={appliedDatePreset === "year"
                                            ? t("growthNoMeasurementsYears").replace("{from}", yearRange.from).replace("{to}", yearRange.to)
                                            : t("growthNoMeasurementsRange")}
                                    />
                                </View>
                            ))}
                        </View>

                            </>
                        )}
                    </SectionContainerCard>

                    <SectionContainerCard
                        title={t("growthMeasurementHistory")}
                        style={styles.historyPanel} background={<HistoryBackground />}
                        headerStyle={styles.historyHeader} titleStyle={styles.historyHeading} subtitleStyle={styles.historySubtitle}
                        subtitle={
                            measurements.length
                                ? t("growthMeasurementCount").replace("{count}", measurements.length)
                                : t("growthMeasurementHistoryEmptyHelp")
                        }
                    >
                        {growthLoading ? (
                            <View style={styles.historyPlaceholder}><AppointmentsSkeleton count={3} /></View>
                        ) : measurements.length === 0 ? (
                            <View style={styles.historyPlaceholder}><EmptyStateCard
                                message={t("growthMeasurementHistoryEmpty")}
                                icon={<GrowthIcon />}
                            /></View>
                        ) : (
                            <AnimatedReveal contentStyle={styles.historyList}>
                                {measurements.slice(0, metricsVisible).map((m) => {
                                    const label = `${t("growthViewMeasurement")}: ${shortDate(m.date)}`;
                                    return (
                                        <SwipeActionRow style={styles.historyRow} foregroundStyle={styles.historyForeground} pressScale={0.985}
                                            key={m.id ?? m.date}
                                            open={openGrowthSwipeId === m.id}
                                            onOpen={() => setOpenGrowthSwipeId(m.id)}
                                            onClose={() => setOpenGrowthSwipeId(null)}
                                            onPress={() => setDetailGrowth(m)}
                                            label={label}
                                            actions={[
                                                {
                                                    key: "update", label: t("growthUpdateMeasurement"), icon: "create-outline",
                                                    color: colors.primaryDark,
                                                    onPress: () => {
                                                        setOpenGrowthSwipeId(null);
                                                        setEditingGrowth(m.raw || null);
                                                        setShowMetricsModal(true);
                                                    },
                                                },
                                                {
                                                    key: "delete", label: t("delete"), icon: "trash-outline",
                                                    color: colors.onAccent, kind: "delete",
                                                    onPress: () => {
                                                        setOpenGrowthSwipeId(null);
                                                        setDeleteGrowthCandidate(m);
                                                    },
                                                },
                                            ]}
                                        >
                                            <MeasurementHistoryRow date={shortDate(m.date)}
                                                age={m.day != null ? ageLabel(m.day) : null} />
                                        </SwipeActionRow>
                                    );
                                })}
                                <ShowMore
                                    total={measurements.length}
                                    visible={metricsVisible}
                                    onPress={() => setMetricsVisible((c) => c + 10)}
                                    noun="measurements" appearance="measurementHistory"
                                />
                            </AnimatedReveal>
                        )}
                    </SectionContainerCard>
                </View>
            )}

            <PlanDetail
                visible={!!detailGrowth}
                plan={growthDetailPlan}
                heroContent={<GrowthIcon size={56} />}
                onClose={() => setDetailGrowth(null)}
                onEdit={() => {
                    setEditingGrowth(detailGrowth?.raw || null);
                    setDetailGrowth(null);
                    setShowMetricsModal(true);
                }}
                onDelete={() => setDeleteGrowthCandidate(detailGrowth)}
                deleting={deletingGrowthId === detailGrowth?.id}
            />

            <DeleteConfirmation
                visible={!!deleteGrowthCandidate}
                title={t("growthDeleteConfirm")}
                message={t("growthDeleteConfirm")}
                busy={deletingGrowthId === deleteGrowthCandidate?.id}
                onCancel={() => setDeleteGrowthCandidate(null)}
                onConfirm={() => handleDeleteGrowth(deleteGrowthCandidate?.id)}
            />

            {/* One form for adding a measurement and for correcting one.
                It owns its own validation, save and toast now: the old
                inline version announced success from outside its try/catch
                and lost the measurement on a failed request. */}
            <GrowthModal
                visible={showMetricsModal}
                profile={profile}
                record={editingGrowth}
                suggestedValues={latestMeasurement}
                onDelete={(record) => handleDeleteGrowth(record.id)}
                onClose={() => {
                    setShowMetricsModal(false);
                    setEditingGrowth(null);
                }}
                onSaved={handleGrowthSaved}
            />

            <MemoryDetail
                visible={!!detailMemory}
                memory={detailMemory}
                recordKind={detailMemory?.kind || "memory"}
                profile={profile}
                onClose={() => setDetailMemory(null)}
            />

            <GlassDateRangeFilterModal
                key={profile.id}
                visible={datePickerOpen}
                title={t("growthChooseDates")}
                subtitle={t("growthDateFormHelp")}
                value={{ dateRange, preset: appliedDatePreset, yearRange }}
                minimumDate={datePickerMin}
                availableDates={availableMeasurementDates}
                years={yearOptions}
                resolvePreset={growthPreset}
                blurTarget={blurTarget}
                onClose={() => setDatePickerOpen(false)}
                onApply={(next) => {
                    setDateRange(next.dateRange);
                    setAppliedDatePreset(next.preset);
                    const nextYears = next.preset === "year" ? next.yearRange : yearRange;
                    setYearRange(nextYears);
                    onDateViewChange?.({ dateRange: next.dateRange, appliedDatePreset: next.preset, yearRange: { ...nextYears } });
                    setDatePickerOpen(false);
                }}
            />

            <OptionSheet
                visible={bandSheetOpen}
                anchor={bandMenuAnchor}
                title="Choose an age"
                options={bandOptions}
                selectedKey={selectedBand}
                onSelect={(key) => {
                    setSelectedBand(key);
                    setBandSheetOpen(false);
                }}
                onClose={() => setBandSheetOpen(false)}
            />

            <GlassChartFilterPopover
                visible={metricMenuOpen}
                anchor={metricMenuAnchor}
                onClose={() => setMetricMenuOpen(false)}
                blurTarget={blurTarget}
                title={t("growthChartFilterTitle")}
                closeLabel={t("growthCloseChartFilter")}
                options={METRIC_TABS.map(metric => ({
                    key: metric.key,
                    label: t(metric.filterLabelKey || metric.labelKey),
                    icon: <GrowthMetricIcon metric={metric.key} size={40} circular />,
                }))}
                selectedKeys={metricKeys}
                onToggle={key => setMetricKeys(current => toggleGrowthMetric(current, key))}
                testIDPrefix="growth-chart-toggle"
            />

            {/* One form for both kinds. `milestones` feeds its suggestion
                chips, which offer only checklist items this child has not
                recorded yet — so tapping one cannot create a duplicate. */}
            <AddMemoryModal
                visible={showAddMemory}
                profile={profile}
                milestones={mstones}
                onClose={() => setShowAddMemory(false)}
                onSaved={() => {}}
            />
        </PullToRefreshScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "transparent", // lets App.js's page gradient show through
    },
    // See the note on Health.js's `content`: padding on the ScrollView's own
    // box does not scroll, so the bottom clearance has to live on the content.
    content: {
        padding: space.lg,
    },
    tabContainer: { marginBottom: space.lg },
    // Opens the age menu. Shows the band being viewed so the age is readable
    // without opening anything — the twelve-pill scroller it replaced pushed
    // most bands, sometimes the selected one, off-screen.
    historyPanel: { padding: 0, borderRadius: 28, borderWidth: 0, backgroundColor: colors.growthHistory.panel[0], boxShadow: colors.growthHistory.panelShadow },
    historyHeader: { paddingHorizontal: 20, paddingTop: 20, marginBottom: 8 },
    // Keep shadow clearance inside the measured reveal, which clips its bounds.
    historyList: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
    historyPlaceholder: { paddingHorizontal: 20, paddingBottom: 20 },
    historyHeading: { ...type.title, fontSize: 20, lineHeight: 28, color: colors.growthHistory.title },
    historySubtitle: { ...type.caption, color: colors.growthHistory.secondary },
    historyRow: { marginBottom: 12, borderRadius: 24, boxShadow: colors.growthHistory.itemShadow },
    historyForeground: { borderRadius: 24, backgroundColor: "transparent" },
    trackingPanel: {
        borderRadius: 28,
        borderWidth: 0,
        backgroundColor: colors.medicineSurface.section[0],
        boxShadow: colors.medicineSurface.shadow,
    },
    chartControls: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.sm,
        marginBottom: 12,
    },
    dateSelect: {
        minHeight: MIN_TOUCH,
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        minWidth: 0,
        maxWidth: "100%",
        flexShrink: 1,
        paddingHorizontal: space.md,
        borderWidth: 0,
        borderColor: colors.border,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: "transparent",
    },
    dateSelectText: { ...type.label, color: colors.text, flexShrink: 1 },
    metricFilterButton: {
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        flexShrink: 0,
    },
    chartHelp: { ...type.body, color: colors.textSecondary, marginBottom: space.md },
    allCharts: { gap: space.md },
    allChart: { padding: space.sm, borderRadius: 24 },
    allChartTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        paddingBottom: space.xs,
    },
    allChartTitle: { ...type.bodyStrong, color: colors.text, flex: 1, minWidth: 0 },
    allChartLatest: {
        ...type.heading,
        marginLeft: "auto",
        flexShrink: 0,
        fontVariant: ["tabular-nums"],
    },

});
