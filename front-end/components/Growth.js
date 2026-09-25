import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    Animated,View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    } from "react-native";
import Modal from "./ui/AppModal";
import { Calendar } from "react-native-calendars";
import { api } from "../utils/api";
import { useRecords } from "../utils/useRecords";
import { milestoneToApp, memoryToApp } from "../utils/adapters";
import { useToast } from "./ui/Toast";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { radius, space, type, shadow, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
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
import { ageInDays, wholeNumberLabel } from "../utils/whoGrowth";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import TipStrip from "./ui/TipStrip";
import Gradient from "./ui/Gradient";
import {
    todayLocal,
    shortDate,
    numericDateRange,
    monthLabel,
    monthsBetween,
    ageLabel,
    setRangeEndpoint,
    dateRangePreset,
    dateEndpointBounds,
    shiftMonthClamped,
    weekOfMonth,
    weekRangeFromSelection,
    monthRangeFromSelection,
} from "../utils/dates";
import AddMemoryModal from "./ui/AddMemoryModal";
import GrowthModal from "./ui/GrowthModal";
import OptionSheet from "./ui/OptionSheet";
import PlanDetail from "./ui/PlanDetail";
import SwipeActionRow from "./ui/SwipeActionRow";
import { DeleteConfirmation } from "./ui/RecordFormSheet";
import AnchoredMenu, { AnchoredMenuItem } from "./ui/AnchoredMenu";
import { DateWheelPicker } from "./ui/DateField";
import {
    CHECKPOINTS,
    DOMAINS,
    bandLabel,
    checkpointFor,
    findRecorded,
    itemsForCheckpoint,
} from "../utils/milestoneChecklist";

// Display names for growth_records.measured_at (migration 007). Reading only:
// the app never treats one place as more or less trustworthy than another.
const PLACE_LABELS = {
    home: "At home",
    health_center: "Health centre",
    clinic: "Clinic",
    hospital: "Hospital",
};

const METRIC_TABS = [
    { key: "weight", labelKey: "growthWeight", field: "weight", unit: "kg" },
    { key: "height", labelKey: "growthHeight", field: "height", unit: "cm" },
    { key: "head", labelKey: "growthHeadCirc", filterLabelKey: "growthHeadFilter", field: "head_circumference", unit: "cm" },
];
const METRIC_FILTERS = [{ key: "all", labelKey: "growthAll" }, ...METRIC_TABS];
const QUICK_DATE_ACTIONS = [
    { key: "week", labelKey: "growthThisWeek", shortLabelKey: "growthWeekShort" },
    { key: "month", labelKey: "growthThisMonth", shortLabelKey: "growthMonthShort" },
    { key: "year", labelKey: "growthThisYear", shortLabelKey: "growthYearShort" },
];
const MONTHS = Array.from({ length: 12 }, (_, month) =>
    new Date(2026, month, 1).toLocaleDateString("en-GB", { month: "short" }),
);

const currentMonthRange = (dateOfBirth) => dateRangePreset("month", dateOfBirth);
const yearRangeToDates = (range) => ({
    from: `${range.from}-01-01`,
    to: `${range.to}-12-31`,
});
const monthSelectionFromRange = (range) => ({
    from: range?.from?.slice(0, 7) || null,
    to: range?.to?.slice(0, 7) || null,
});
const weekSelectionFromRange = (range) => {
    const month = range?.to?.slice(0, 7) || todayLocal().slice(0, 7);
    const to = weekOfMonth(range?.to) || 1;
    return {
        month,
        from: range?.from?.startsWith(month) ? weekOfMonth(range.from) : to,
        to,
    };
};
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
          : saved ? null : "month";
    const dateRange = saved?.dateRange
        || (preset === "year" ? yearRangeToDates(yearRange) : currentMonthRange(dateOfBirth));
    return { dateRange, preset, yearRange };
};

// ageLabel now lives in utils/dates.js -- the Dashboard's Growth Chart needs
// the same string, and a second copy is how formatters drift apart.



export default function Growth({
    profile,
    onUpdateProfile,
    milestones,
    setMilestones,
    initialTab,
    navKey,
    savedDateView,
    onDateViewChange,
}) {
    const { language, t } = useLanguage();
    const toast = useToast();
    const { colors, scheme } = useTheme();
    const cardForeground = scheme === "dark" ? colors.background : colors.onPrimary;
    const styles = useMemo(() => makeStyles(colors, cardForeground), [colors, cardForeground]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const { scrollProps } = useScroll();
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
    // How many of this band's items the parent has recorded. Declared here
    // rather than beside `bandItems` because it needs `mstones`, which is
    // initialised below the band state.
    const bandRecordedCount = useMemo(
        () => bandItems.filter((i) => findRecorded(mstones, i.title)?.isCompleted).length,
        [bandItems, mstones],
    );
    const memoryRows = useRecords(profile.id, "memories");
    const memories = useMemo(() => memoryRows.map(memoryToApp), [memoryRows]);
    const [memoriesVisible, setMemoriesVisible] = useState(10);
    // Gallery filter: "all" | "memory" | "milestone".
    const [galleryFilter, setGalleryFilter] = useState("all");
    const [showAddMemory, setShowAddMemory] = useState(false);
    const [growthLoading, setGrowthLoading] = useState(true);
    const [detailMemory, setDetailMemory] = useState(null);
    // Raw growth_records rows. The Metrics tab used to show only the two values
    // cached on the profile, so there was no history and nothing to plot.
    const growthRows = useRecords(profile.id, "growth");
    const [metricsVisible, setMetricsVisible] = useState(10);
    const [metricKey, setMetricKey] = useState("all");
    const [metricMenuOpen, setMetricMenuOpen] = useState(false);
    const [metricMenuAnchor, setMetricMenuAnchor] = useState(null);
    const metricTriggerRef = useRef(null);
    const initialDateView = normalizeDateView(savedDateView, profile.dateOfBirth);
    const savedYearRange = initialDateView.yearRange;
    const [yearRange, setYearRange] = useState(savedYearRange);
    const [draftYearRange, setDraftYearRange] = useState(savedYearRange);
    const [dateRange, setDateRange] = useState(initialDateView.dateRange);
    const [appliedDatePreset, setAppliedDatePreset] = useState(initialDateView.preset);
    const [draftDateRange, setDraftDateRange] = useState(initialDateView.dateRange);
    const [draftDatePreset, setDraftDatePreset] = useState(initialDateView.preset);
    const [draftMonthRange, setDraftMonthRange] = useState(
        monthSelectionFromRange(initialDateView.dateRange),
    );
    const [draftWeekRange, setDraftWeekRange] = useState(
        weekSelectionFromRange(initialDateView.dateRange),
    );
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [dateWheelOpen, setDateWheelOpen] = useState(false);
    const [datePickerStep, setDatePickerStep] = useState("form");
    const [editingDate, setEditingDate] = useState(null);
    const [editingYear, setEditingYear] = useState(null);
    const [editingMonth, setEditingMonth] = useState(null);
    const [editingWeek, setEditingWeek] = useState(null);
    const [pendingDate, setPendingDate] = useState(null);
    const [visibleMonth, setVisibleMonth] = useState(`${todayLocal().slice(0, 7)}-01`);
    const [reloadTick, setReloadTick] = useState(0);
    useEffect(() => {
        let active = true;
        setGrowthLoading(true);
        (async () => {
            try {
                const [mRows, gRows, memRows] = await Promise.all([
                    api.listRecords(profile.id, "milestones", { loading: "nonblocking" }),
                    api.listRecords(profile.id, "growth", { loading: "nonblocking" }).catch(() => []),
                    // The Gallery tab's photo memories. This screen never
                    // fetched them, which is why that tab was showing
                    // completed milestones under a "Memories" heading while
                    // the Dashboard's "See all photo memories" pointed here.
                    api.listRecords(profile.id, "memories", { loading: "nonblocking" }).catch(() => []),
                ]);
                if (!active) return;
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

    useEffect(() => {
        const restored = normalizeDateView(savedDateView, profile.dateOfBirth);
        const initial = { ...restored.dateRange };
        setDateRange(initial);
        setAppliedDatePreset(restored.preset);
        setDraftDateRange(initial);
        setDraftDatePreset(restored.preset);
        setDraftMonthRange(monthSelectionFromRange(initial));
        setDraftWeekRange(weekSelectionFromRange(initial));
        const restoredYears = restored.yearRange;
        setYearRange(restoredYears);
        setDraftYearRange(restoredYears);
    }, [profile.id, profile.dateOfBirth]);

    const refreshControl = useRefreshControl(growthLoading, () => setReloadTick((n) => n + 1));

    const selectedMetricFilter = METRIC_FILTERS.find((m) => m.key === metricKey) || METRIC_FILTERS[0];

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
                    measured_at: r.measured_at || null,
                    notes: r.notes || null,
                    raw: r,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [growthRows, profile.dateOfBirth]);

    // A shared date must describe one visit, so this strip is the newest log as
    // a snapshot rather than a mix of values taken on different dates.
    const latestMeasurement = measurements[0] || null;
    const availableWeeksByMonth = useMemo(() => {
        const available = {};
        measurements.forEach((measurement) => {
            if (!METRIC_TABS.some((metric) => Number(measurement[metric.field]) > 0)) return;
            const month = measurement.date.slice(0, 7);
            const week = weekOfMonth(measurement.date);
            if (!available[month]) available[month] = new Set();
            if (week) available[month].add(week);
        });
        return available;
    }, [measurements]);
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
            .filter((row) => METRIC_TABS.some((metric) => Number(row[metric.field]) > 0))
            .map((row) => String(row.date_recorded).slice(0, 10))
            .sort();
        return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
    }, [filteredGrowthRows]);
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
    const calendarMarks = pendingDate ? {
        [pendingDate]: { selected: true, selectedColor: colors.primary, selectedTextColor: colors.onPrimary },
    } : {};
    const selectedQuickAction = draftDatePreset;
    const draftDateReady = !!draftDateRange?.from && !!draftDateRange?.to
        && draftDateRange.from <= draftDateRange.to;
    const datePickerMin = profile.dateOfBirth && String(profile.dateOfBirth).slice(0, 10) <= today
        ? String(profile.dateOfBirth).slice(0, 10)
        : null;
    const visibleYear = Number(visibleMonth.slice(0, 4));
    const selectedMonth = visibleMonth.slice(0, 7);
    const activeDateBounds = dateEndpointBounds(draftDateRange, editingDate, datePickerMin, today);
    const earliestMonth = datePickerMin?.slice(0, 7)
        || measurements[measurements.length - 1]?.date?.slice(0, 7)
        || today.slice(0, 7);
    const latestMonth = today.slice(0, 7);
    const activeMonthMin = editingMonth === "to" && draftMonthRange?.from > earliestMonth
        ? draftMonthRange.from
        : earliestMonth;
    const activeMonthMax = editingMonth === "from" && draftMonthRange?.to < latestMonth
        ? draftMonthRange.to
        : latestMonth;
    const calendarTheme = useMemo(() => ({
        calendarBackground: colors.surface,
        textSectionTitleColor: colors.textMuted,
        selectedDayBackgroundColor: colors.primary,
        selectedDayTextColor: colors.onPrimary,
        todayTextColor: colors.primary,
        dayTextColor: colors.text,
        textDisabledColor: colors.border,
        arrowColor: colors.primary,
        monthTextColor: colors.text,
        textMonthFontWeight: "800",
        textDayFontWeight: "600",
        textDayHeaderFontWeight: "700",
    }), [colors]);

    const openMetricMenu = () => {
        metricTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setMetricMenuAnchor({ x, y, width, height });
            setMetricMenuOpen(true);
        });
    };

    const openDateField = (endpoint) => {
        const value = draftDateRange?.[endpoint] || null;
        const fallback = endpoint === "to" ? draftDateRange?.from : draftDateRange?.to;
        const focusDate = value || fallback || today;
        setEditingDate(endpoint);
        setPendingDate(focusDate);
        setDateWheelOpen(true);
    };

    const openYearField = (endpoint) => {
        setEditingYear(endpoint);
        setDatePickerStep("years");
    };

    const openMonthField = (endpoint) => {
        setEditingMonth(endpoint);
        setVisibleMonth(`${draftMonthRange?.[endpoint] || today.slice(0, 7)}-01`);
        setDatePickerStep("rangeMonths");
    };

    const openWeekField = (endpoint) => {
        setEditingWeek(endpoint);
        setVisibleMonth(`${draftWeekRange?.month || today.slice(0, 7)}-01`);
        setDatePickerStep("weeks");
    };

    const applyWeekSelection = (selection) => {
        setDraftWeekRange(selection);
        setDraftDateRange(selection.from && selection.to
            ? weekRangeFromSelection(
                selection.month,
                selection.from,
                selection.to,
                datePickerMin,
                today,
            )
            : { from: null, to: null });
    };

    const selectQuickAction = (key) => {
        if (draftDatePreset === key) {
            setDraftDatePreset(null);
            return;
        }
        setDraftDatePreset(key);
        if (key === "week") {
            let anchor = draftDateRange?.to || today;
            if (datePickerMin && anchor < datePickerMin) anchor = datePickerMin;
            if (anchor > today) anchor = today;
            const month = anchor.slice(0, 7);
            const available = [...(availableWeeksByMonth[month] || [])].sort((a, b) => a - b);
            const preferred = weekOfMonth(anchor);
            const week = available.includes(preferred) ? preferred : available[available.length - 1] || null;
            applyWeekSelection({ month, from: week, to: week });
            setVisibleMonth(`${month}-01`);
            return;
        }
        if (key === "month") {
            const minMonth = earliestMonth;
            const maxMonth = today.slice(0, 7);
            const current = monthSelectionFromRange(draftDateRange);
            let from = current.from && current.from >= minMonth ? current.from : minMonth;
            let to = current.to && current.to <= maxMonth ? current.to : maxMonth;
            if (from > to) from = to;
            const next = { from, to };
            setDraftMonthRange(next);
            setDraftDateRange(monthRangeFromSelection(next, datePickerMin, today));
            return;
        }
        const from = Math.max(
            historyYearRange.from,
            Math.min(historyYearRange.to, Number(draftDateRange?.from?.slice(0, 4)) || historyYearRange.to),
        );
        const to = Math.max(
            from,
            Math.min(historyYearRange.to, Number(draftDateRange?.to?.slice(0, 4)) || from),
        );
        const next = { from, to };
        setDraftYearRange(next);
        setDraftDateRange(yearRangeToDates(next));
    };

    const stepBack = () => {
        if (["years", "rangeMonths", "weeks"].includes(datePickerStep)) setDatePickerStep("form");
        else if (datePickerStep === "months") setDatePickerStep("calendar");
        else if (datePickerStep === "calendar") setDatePickerStep("form");
        else setDatePickerOpen(false);
    };

    const filterFieldKeys = draftDatePreset === "week"
        ? [["from", "growthStartingWeek"], ["to", "growthEndingWeek"]]
        : draftDatePreset === "month"
          ? [["from", "growthStartingMonth"], ["to", "growthEndingMonth"]]
          : draftDatePreset === "year"
            ? [["from", "growthStartingYear"], ["to", "growthEndingYear"]]
            : [["from", "growthStartingDate"], ["to", "growthEndingDate"]];
    const filterTitleKey = draftDatePreset === "week"
        ? "growthChooseWeeks"
        : draftDatePreset === "month"
          ? "growthChooseMonths"
          : draftDatePreset === "year" ? "growthChooseYears" : "growthChooseDates";
    const filterHelpKey = draftDatePreset === "week"
        ? "growthWeekFormHelp"
        : draftDatePreset === "month"
          ? "growthMonthFormHelp"
          : draftDatePreset === "year" ? "growthYearFormHelp" : "growthDateFormHelp";
    const filterFieldValue = (endpoint) => {
        if (draftDatePreset === "week") {
            const value = draftWeekRange?.[endpoint];
            return value
                ? `${t("growthWeekNumber").replace("{week}", value)} · ${monthLabel(`${draftWeekRange.month}-01`)}`
                : t("growthSelectWeek");
        }
        if (draftDatePreset === "month") {
            const value = draftMonthRange?.[endpoint];
            return value ? monthLabel(`${value}-01`) : t("growthSelectMonth");
        }
        if (draftDatePreset === "year") {
            return draftYearRange?.[endpoint] || t("growthSelectYear");
        }
        return draftDateRange?.[endpoint]
            ? shortDate(draftDateRange[endpoint])
            : t("growthSelectDate");
    };
    const filterFieldHasValue = (endpoint) => draftDatePreset === "week"
        ? !!draftWeekRange?.[endpoint]
        : draftDatePreset === "month"
          ? !!draftMonthRange?.[endpoint]
          : draftDatePreset === "year"
            ? !!draftYearRange?.[endpoint]
            : !!draftDateRange?.[endpoint];
    const openFilterField = (endpoint) => {
        if (draftDatePreset === "week") openWeekField(endpoint);
        else if (draftDatePreset === "month") openMonthField(endpoint);
        else if (draftDatePreset === "year") openYearField(endpoint);
        else openDateField(endpoint);
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

    // One chronological history of everything worth keeping: photo memories
    // and achieved milestones together, newest first.
    //
    // Milestones belong here because the Development Checklist only shows six
    // reference items (utils/milestoneChecklist.js) and draws a tick when a
    // record matches one by title. A milestone like "First Steps" is not among
    // those six, so this timeline is the only place it appears — which is also
    // why the add form had to be able to create one.
    const galleryItems = useMemo(() => {
        const items = [
            ...memories.map((m) => ({ ...m, kind: "memory" })),
            ...completedMilestones.map((m) => ({ ...m, kind: "milestone" })),
        ];
        return items.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    }, [memories, completedMilestones]);

    const filteredGallery = useMemo(
        () =>
            galleryFilter === "all"
                ? galleryItems
                : galleryItems.filter((i) => i.kind === galleryFilter),
        [galleryItems, galleryFilter],
    );

    // Group the visible slice into month buckets. Grouping after the cap, not
    // before, so "Show more" reveals the next ten items rather than the next
    // whole month.
    const galleryMonths = useMemo(() => {
        const buckets = [];
        for (const item of filteredGallery.slice(0, memoriesVisible)) {
            const label = monthLabel(item.date) || "Undated";
            const last = buckets[buckets.length - 1];
            if (last && last.label === label) last.items.push(item);
            else buckets.push({ label, items: [item] });
        }
        return buckets;
    }, [filteredGallery, memoriesVisible]);

    const GALLERY_FILTERS = [
        { key: "all", label: "All", noun: "items" },
        { key: "memory", label: "Photos", noun: "photos" },
        { key: "milestone", label: "Milestones", noun: "milestones" },
    ];

    const todayStr = () => todayLocal();
    const handleToggleMilestone = async (title) => {
        const existing = findRecorded(mstones, title);
        setMilestoneBusy(title);
        try {
            await api.optimisticRecord(profile.id, "milestones", existing ? "update" : "create", existing?.id,
                { ...(existing ? {} : { title }), is_completed: existing ? !existing.isCompleted : true, date_recorded: todayStr() },
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
        <Animated.ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            refreshControl={refreshControl}
            {...scrollProps}
            keyboardShouldPersistTaps="handled"
        >
            <TipStrip tipKey="tip_growth">
                {t("growthTip")}
            </TipStrip>

            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
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
                    <SectionContainerCard
                        title="Development Checklist"
                        subtitle={t("growthMilestonesSub")}
                    >
                        {/* One control instead of twelve scrolling pills. It
                            always shows the age being viewed, so a parent can
                            read it without opening anything, and it starts on
                            their own child's band. */}
                        <TouchableOpacity
                            style={styles.bandTrigger}
                            onPress={() => setBandSheetOpen(true)}
                            accessibilityRole="button"
                            accessibilityLabel={`Age ${bandLabel(selectedBand)}. Choose a different age`}
                        >
                            <Text style={styles.bandTriggerText}>{bandLabel(selectedBand)}</Text>
                            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        {/* A count, never a score. "Recorded" because it counts
                            entries the parent made, not development. No bar and
                            no percentage — those read as a grade. */}
                        <Text style={styles.bandCount}>
                            {`${bandRecordedCount} of ${bandItems.length} recorded`}
                        </Text>

                        {DOMAINS.map((domain) => {
                            const items = bandItems.filter((i) => i.domain === domain.key);
                            if (!items.length) return null;
                            const tint = colors[domain.tint] || { bg: colors.surfaceAlt, on: colors.primary };
                            return (
                                <View key={domain.key} style={styles.domainGroup}>
                                    <View style={styles.domainHeader}>
                                        <View style={[styles.domainIcon, { backgroundColor: tint.bg }]}>
                                            <Ionicons name={domain.icon} size={14} color={tint.on} />
                                        </View>
                                        <Text style={styles.domainLabel}>{domain.label}</Text>
                                    </View>

                                    {items.map((item) => {
                                        const rec = findRecorded(mstones, item.title);
                                        const isDone = !!rec && rec.isCompleted;
                                        return (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={styles.checklistRow}
                                                onPress={() => handleToggleMilestone(item.title)}
                                                disabled={rec?._pending || milestoneBusy === item.title}
                                                accessibilityRole="checkbox"
                                                accessibilityState={{
                                                    checked: isDone,
                                                    disabled: rec?._pending || milestoneBusy === item.title,
                                                    busy: rec?._pending || milestoneBusy === item.title,
                                                }}
                                                accessibilityLabel={item.title}
                                            >
                                                {/* The parent's own photo is the
                                                    only image on this row that
                                                    means anything. The stock
                                                    Unsplash pictures of other
                                                    people's babies are gone —
                                                    they carried no information
                                                    and 146 of them would be a
                                                    lot of network for nothing. */}
                                                {isDone && rec.photoUrl ? (
                                                    <Image
                                                        source={{ uri: rec.photoUrl }}
                                                        style={styles.checklistImg}
                                                    />
                                                ) : null}

                                                <View style={{ flex: 1, marginRight: 8 }}>
                                                    <Text style={styles.checklistTitle}>
                                                        {item.title}
                                                    </Text>
                                                    {isDone && rec.date ? (
                                                        <Text style={styles.checklistDone}>
                                                            {`Recorded ${shortDate(rec.date)}`}
                                                            {rec.ageAchieved ? ` · ${rec.ageAchieved}` : ""}
                                                        </Text>
                                                    ) : null}
                                                </View>

                                                {/* Unticked is neutral, never
                                                    coral or amber — DESIGN.md
                                                    reserves those for overdue,
                                                    error and caution, and a
                                                    milestone not yet reached is
                                                    none of the three. */}
                                                <View
                                                    style={[
                                                        styles.checkBtn,
                                                        isDone && styles.checkBtnActive,
                                                    ]}
                                                >
                                                    {(<Ionicons
                                                            name={isDone ? "checkmark" : "square-outline"}
                                                            size={18}
                                                            color={isDone ? colors.onPrimary : colors.primary}
                                                        />)}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            );
                        })}

                        {/* Principle 5 surface: state the recorded facts and
                            hand the reading to a health worker. */}
                        <View style={styles.promptBox}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={16}
                                color={colors.info}
                                style={{ marginTop: 1 }}
                            />
                            <Text style={styles.promptText}>
                                Children develop at their own pace, and reaching something later than
                                this list says is common. Nothing here is a test or a score — if
                                anything about your child's development worries you, your health
                                worker is the person to ask.
                            </Text>
                        </View>

                        <Text style={styles.sourceNote}>
                            Based on the CDC&apos;s &ldquo;Learn the Signs. Act Early.&rdquo;
                            developmental milestones (2022 revision), which describe what most
                            children can do by each age. This is a shortened list — see cdc.gov for
                            the full one, and note that health centres and day care centres in the
                            Philippines use their own ECCD Checklist. The list ends at 5 years
                            because published milestone checklists do.
                        </Text>
                    </SectionContainerCard>
                </View>
            )}

            {/* GROWTH TAB: GALLERY — one photo timeline, memories and
                achieved milestones together, newest first, grouped by month.
                Two-up: the same MemoryVisualCard was rendered full width here
                while the Dashboard showed it at 48%, so this tab fitted about
                one and a half items per screen. */}
            {growthTab === "gallery" && (
                <View>
                    <SectionContainerCard
                        title="Gallery"
                        subtitle="Photos and milestones, newest first"
                        action={
                            <TouchableOpacity
                                onPress={() => setShowAddMemory(true)}
                                style={styles.addBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Add a photo or milestone"
                            >
                                <Ionicons name="add" size={16} color={colors.onPrimary} />
                            </TouchableOpacity>
                        }
                    >
                        {!growthLoading && galleryItems.length > 0 && (
                            <View style={styles.galleryFilters}>
                                {GALLERY_FILTERS.map((f) => {
                                    const on = galleryFilter === f.key;
                                    const n =
                                        f.key === "all"
                                            ? galleryItems.length
                                            : galleryItems.filter((i) => i.kind === f.key).length;
                                    return (
                                        <TouchableOpacity
                                            key={f.key}
                                            onPress={() => {
                                                setGalleryFilter(f.key);
                                                setMemoriesVisible(10);
                                            }}
                                            style={[styles.galleryChip, on && styles.galleryChipOn]}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: on }}
                                            accessibilityLabel={`${f.label}, ${n} item${n === 1 ? "" : "s"}`}
                                        >
                                            <Text
                                                style={[
                                                    styles.galleryChipText,
                                                    on && styles.galleryChipTextOn,
                                                ]}
                                            >
                                                {f.label} {n}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {growthLoading && <MemoriesSkeleton count={2} />}

                        {!growthLoading && galleryItems.length === 0 && (
                            <EmptyStateCard
                                message="Nothing here yet. Tap + to save a photo or record a milestone."
                                icon="image-outline"
                            />
                        )}
                        {!growthLoading && galleryItems.length > 0 && filteredGallery.length === 0 && (
                            <EmptyStateCard
                                message="No entries of this kind yet."
                                icon="filter-outline"
                            />
                        )}

                        {!growthLoading &&
                            galleryMonths.map((bucket) => (
                                <View key={bucket.label}>
                                    <Text style={styles.galleryMonth}>{bucket.label}</Text>
                                    <View style={styles.galleryGrid}>
                                        {bucket.items.map((item, idx) => (
                                            <MemoryVisualCard
                                                key={`${item.kind}-${item.id || idx}`}
                                                style={styles.galleryTile}
                                                title={item.title}
                                                description={item.description}
                                                // The month header already
                                                // states the year, so the tile
                                                // drops it. The kind is spelled
                                                // out here too — the trophy
                                                // badge alone would leave the
                                                // distinction resting on one
                                                // small glyph.
                                                date={[
                                                    shortDate(item.date).replace(/\s\d{4}$/, ""),
                                                    item.kind === "milestone" ? "Milestone" : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                                photoUrl={item.photoUrl}
                                                badge={item.kind === "milestone" ? "trophy" : null}
                                                placeholderIcon={
                                                    item.kind === "milestone"
                                                        ? "trophy-outline"
                                                        : "image-outline"
                                                }
                                                onClick={() => setDetailMemory(item)}
                                            />
                                        ))}
                                    </View>
                                </View>
                            ))}

                        {!growthLoading && (
                            <ShowMore
                                total={filteredGallery.length}
                                visible={memoriesVisible}
                                onPress={() => setMemoriesVisible((c) => c + 10)}
                                noun={
                                    (GALLERY_FILTERS.find((f) => f.key === galleryFilter) || {})
                                        .noun || "items"
                                }
                            />
                        )}
                    </SectionContainerCard>
                </View>
            )}

            {/* GROWTH TAB: PHYSICAL METRICS */}
            {growthTab === "metrics" && (
                <View>
                    <SectionContainerCard
                        title={t("growthMetricsTitle")}
                        subtitle={t("growthMetricsSub")}
                        action={
                            <TouchableOpacity
                                onPress={() => {
                                    setEditingGrowth(null);
                                    setShowMetricsModal(true);
                                }}
                                style={styles.addBtn}
                                accessibilityRole="button"
                                accessibilityLabel={t("growthAddMetrics")}
                            >
                                <Ionicons name="add" size={22} color={colors.onPrimary} />
                            </TouchableOpacity>
                        }
                    >
                        {growthLoading ? (
                            <>
                                <SkeletonBlock width="100%" height={96} radius={radius.md} style={{ marginBottom: 16 }} />
                                <SkeletonBlock width="100%" height={200} radius={radius.lg} />
                            </>
                        ) : (
                            <>
                        <Gradient colors={[colors.primaryDark, colors.primary]} style={styles.metricsHeaderBox}>
                            <View style={styles.metricsHeaderHeading}>
                                <Text style={styles.metricsHeaderTitle} numberOfLines={1}>
                                    {t("growthLatestMeasurements")}
                                </Text>
                                {latestMeasurement ? (
                                    <Text selectable style={styles.metricsHeaderDate} numberOfLines={1}>
                                        {shortDate(latestMeasurement.date)}
                                    </Text>
                                ) : null}
                            </View>
                            <View style={styles.metricsHeaderRow}>
                                {[
                                    { key: "weight", field: "weight", labelKey: "growthWeight", unit: "kg" },
                                    { key: "height", field: "height", labelKey: "growthHeight", unit: "cm" },
                                    { key: "head", field: "head_circumference", labelKey: "growthHeadCirc", unit: "cm" },
                                ].map((col, i) => {
                                    const value = latestMeasurement?.[col.field];
                                    return (
                                        <React.Fragment key={col.key}>
                                            {i > 0 ? <View style={styles.metricsHeaderDivider} /> : null}
                                            <View style={styles.metricsHeaderCol}>
                                                <Text style={styles.metricsHeaderLabel} numberOfLines={1}>
                                                    {t(col.labelKey)}
                                                </Text>
                                                {value != null ? (
                                                    <>
                                                        <Text selectable style={styles.metricsHeaderValue} numberOfLines={1}>
                                                            {value}
                                                        </Text>
                                                        <Text style={styles.metricsHeaderUnit} numberOfLines={1}>
                                                            {col.unit}
                                                        </Text>
                                                    </>
                                                ) : (
                                                    <Text style={styles.metricsHeaderEmpty}>
                                                        {latestMeasurement ? "—" : t("growthNoRecordYet")}
                                                    </Text>
                                                )}
                                            </View>
                                        </React.Fragment>
                                    );
                                })}
                            </View>
                        </Gradient>

                        <View style={styles.chartControls}>
                            <TouchableOpacity
                                onPress={() => {
                                    setDraftDateRange({ ...dateRange });
                                    setDraftYearRange({ ...yearRange });
                                    setDraftMonthRange(monthSelectionFromRange(dateRange));
                                    setDraftWeekRange(weekSelectionFromRange(dateRange));
                                    setDraftDatePreset(appliedDatePreset);
                                    setDatePickerStep("form");
                                    setEditingDate(null);
                                    setEditingYear(null);
                                    setEditingMonth(null);
                                    setEditingWeek(null);
                                    setPendingDate(null);
                                    setDateWheelOpen(false);
                                    setDatePickerOpen(true);
                                }}
                                style={styles.dateSelect}
                                accessibilityRole="button"
                                accessibilityLabel={`${t("growthDateFilter")}: ${dateLabel}`}
                            >
                                <Ionicons name="calendar-outline" size={19} color={colors.primary} />
                                <Text style={styles.dateSelectText} numberOfLines={1}>{dateLabel}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                ref={metricTriggerRef}
                                onPress={openMetricMenu}
                                style={styles.metricSelect}
                                accessibilityRole="button"
                                accessibilityState={{ expanded: metricMenuOpen }}
                                accessibilityLabel={t("growthShowChart").replace(
                                    "{metric}",
                                    t(selectedMetricFilter.labelKey),
                                )}
                            >
                                <View style={styles.metricSelectValue}>
                                    {metricKey !== "all" ? (
                                        <View
                                            style={[
                                                styles.metricDot,
                                                { backgroundColor: colors.growthMetric[metricKey] },
                                            ]}
                                        />
                                    ) : null}
                                    <Text style={styles.metricSelectText} numberOfLines={1}>
                                        {t(selectedMetricFilter.filterLabelKey || selectedMetricFilter.labelKey)}
                                    </Text>
                                </View>
                                <Ionicons
                                    name={metricMenuOpen ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color={colors.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.chartHelp}>{t("growthAllChartHelp")}</Text>

                        {metricKey === "all" ? (
                            <View style={styles.allCharts}>
                                {METRIC_TABS.map((metric, index) => (
                                    <View key={metric.key} style={[styles.allChart, index > 0 && styles.allChartDivider]}>
                                        <View style={styles.allChartTitleRow}>
                                            <Text style={styles.allChartTitle}>{t(metric.labelKey)}</Text>
                                            {latestChartValues[metric.key] ? (
                                                <Text selectable style={styles.allChartLatest}>
                                                    {latestChartValues[metric.key]}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <PercentileChart
                                            indicator={metric.key}
                                            dateOfBirth={profile.dateOfBirth}
                                            rows={filteredGrowthRows}
                                            compact
                                            name={t(metric.labelKey)}
                                            showReference={false}
                                            seriesColor={colors.growthMetric[metric.key]}
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
                        ) : (
                            <>
                                <View style={styles.allChartTitleRow}>
                                    <Text style={styles.allChartTitle}>{t(selectedMetricFilter.labelKey)}</Text>
                                    {latestChartValues[metricKey] ? (
                                        <Text selectable style={styles.allChartLatest}>
                                            {latestChartValues[metricKey]}
                                        </Text>
                                    ) : null}
                                </View>
                                <PercentileChart
                                    indicator={metricKey}
                                    dateOfBirth={profile.dateOfBirth}
                                    rows={filteredGrowthRows}
                                    name={t("growthLegendSaved")}
                                    simple
                                    showReference={false}
                                    seriesColor={colors.growthMetric[metricKey]}
                                    areaFill
                                    dateWindow={chartDateWindow}
                                    datePreset={appliedDatePreset}
                                    yearRange={appliedDatePreset === "year" ? yearRange : null}
                                    pointAlignedShortRange
                                    emptyMessage={appliedDatePreset === "year"
                                        ? t("growthNoMeasurementsYears").replace("{from}", yearRange.from).replace("{to}", yearRange.to)
                                        : t("growthNoMeasurementsRange")}
                                />
                            </>
                        )}

                            </>
                        )}
                    </SectionContainerCard>

                    <SectionContainerCard
                        title={t("growthMeasurementHistory")}
                        subtitle={
                            measurements.length
                                ? t("growthMeasurementCount").replace("{count}", measurements.length)
                                : t("growthMeasurementHistoryEmptyHelp")
                        }
                    >
                        {growthLoading ? (
                            <AppointmentsSkeleton count={3} />
                        ) : measurements.length === 0 ? (
                            <EmptyStateCard
                                message={t("growthMeasurementHistoryEmpty")}
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
                                    const place = PLACE_LABELS[m.measured_at] || null;
                                    const label = `${t("growthViewMeasurement")}: ${shortDate(m.date)}`;
                                    return (
                                        <SwipeActionRow
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
                                            <ListEntryCard
                                                style={styles.swipeListCard}
                                                title={parts.join("  ·  ") || t("growthNoValues")}
                                                subtitle={[
                                                    shortDate(m.date),
                                                    m.day != null ? ageLabel(m.day) : null,
                                                    place,
                                                ].filter(Boolean).join(" · ")}
                                                notes={m.notes || null}
                                                icon={<MaterialCommunityIcons name="scale" size={18} color={colors.recGrowth.on} />}
                                                iconBg={colors.recGrowth.bg}
                                                showChevron
                                            />
                                        </SwipeActionRow>
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

            <PlanDetail
                visible={!!detailGrowth}
                plan={growthDetailPlan}
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
                dob={profile.dateOfBirth}
                // The Gallery now opens both kinds, so the label follows the
                // entry instead of always claiming "Milestone".
                typeLabel={detailMemory?.kind === "memory" ? "Photo Memory" : "Milestone"}
                onClose={() => setDetailMemory(null)}
            />

            {/* The age menu. Every band stays freely selectable; the child's
                own is marked rather than forced. */}
            <Modal
                visible={datePickerOpen}
                transparent
                animationType="fade"
                onRequestClose={stepBack}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.datePickerBackdrop}
                    onPress={() => setDatePickerOpen(false)}
                    accessibilityRole="button"
                    accessibilityLabel={t("cancel")}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.datePickerCard} onPress={() => {}}>
                        {datePickerStep === "form" ? (
                            <>
                                <View style={styles.datePickerHeading}>
                                    <Text style={styles.datePickerTitle}>{t(filterTitleKey)}</Text>
                                    <Text style={styles.datePickerRange}>{t(filterHelpKey)}</Text>
                                </View>
                                <View style={styles.dateForm}>
                                    <View style={styles.quickActions}>
                                        <Text style={styles.quickActionsTitle}>{t("growthQuickActions")}</Text>
                                        <View style={styles.quickActionChips}>
                                            {QUICK_DATE_ACTIONS.map(({ key, labelKey, shortLabelKey }) => {
                                                const selected = selectedQuickAction === key;
                                                return (
                                                    <TouchableOpacity
                                                        key={key}
                                                        style={[styles.quickActionChip, selected && styles.quickActionChipSelected]}
                                                        onPress={() => selectQuickAction(key)}
                                                        accessibilityRole="button"
                                                        accessibilityState={{ selected }}
                                                        accessibilityLabel={t(labelKey)}
                                                        hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                                                    >
                                                        <Text
                                                            style={[styles.quickActionText, selected && styles.quickActionTextSelected]}
                                                            numberOfLines={1}
                                                        >
                                                            {t(shortLabelKey)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                    {filterFieldKeys.map(([endpoint, labelKey]) => (
                                        <View key={endpoint} style={styles.dateFieldGroup}>
                                            <Text style={styles.dateFieldLabel}>{t(labelKey)}</Text>
                                            <TouchableOpacity
                                                style={styles.dateField}
                                                onPress={() => openFilterField(endpoint)}
                                                accessibilityRole="button"
                                                accessibilityLabel={`${t(labelKey)}: ${filterFieldValue(endpoint)}`}
                                            >
                                                <Text style={[styles.dateFieldText, !filterFieldHasValue(endpoint) && styles.dateFieldPlaceholder]}>
                                                    {filterFieldValue(endpoint)}
                                                </Text>
                                                <Ionicons name="calendar-outline" size={19} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                                <View style={[styles.datePickerActions, styles.datePickerActionsEnd]}>
                                    <View style={styles.datePickerRightActions}>
                                        <TouchableOpacity style={styles.datePickerTextButton} onPress={() => setDatePickerOpen(false)} accessibilityRole="button">
                                            <Text style={styles.datePickerCancel}>{t("cancel")}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.datePickerApply, !draftDateReady && styles.datePickerApplyDisabled]}
                                            disabled={!draftDateReady}
                                            onPress={() => {
                                                const nextRange = { from: draftDateRange.from, to: draftDateRange.to };
                                                const nextPreset = draftDatePreset;
                                                setDateRange(nextRange);
                                                setAppliedDatePreset(nextPreset);
                                                if (nextPreset === "year") setYearRange({ ...draftYearRange });
                                                onDateViewChange?.({
                                                    dateRange: nextRange,
                                                    appliedDatePreset: nextPreset,
                                                    yearRange: nextPreset === "year" ? { ...draftYearRange } : { ...yearRange },
                                                });
                                                setDatePickerOpen(false);
                                            }}
                                            accessibilityRole="button"
                                            accessibilityState={{ disabled: !draftDateReady }}
                                        >
                                            <Text style={styles.datePickerApplyLabel}>{t("growthDone")}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </>
                        ) : datePickerStep === "calendar" ? (
                            <>
                                <View style={styles.datePickerHeading}>
                                    <Text style={styles.datePickerTitle}>
                                        {t(editingDate === "to" ? "growthEndingDate" : "growthStartingDate")}
                                    </Text>
                                    <Text style={styles.datePickerRange}>
                                        {pendingDate ? shortDate(pendingDate) : t("growthTapDate")}
                                    </Text>
                                </View>
                                <Calendar
                                    key={visibleMonth}
                                    current={visibleMonth}
                                    minDate={activeDateBounds.min || undefined}
                                    maxDate={activeDateBounds.max || undefined}
                                    markedDates={calendarMarks}
                                    theme={calendarTheme}
                                    disableArrowLeft={!!activeDateBounds.min && selectedMonth <= activeDateBounds.min.slice(0, 7)}
                                    disableArrowRight={!!activeDateBounds.max && selectedMonth >= activeDateBounds.max.slice(0, 7)}
                                    onMonthChange={({ dateString }) => setVisibleMonth(`${dateString.slice(0, 7)}-01`)}
                                    renderHeader={(month) => (
                                        <TouchableOpacity
                                            style={styles.calendarMonthButton}
                                            onPress={() => {
                                                const monthDate = month?.toString("yyyy-MM-dd") || visibleMonth;
                                                setVisibleMonth(`${monthDate.slice(0, 7)}-01`);
                                                setDatePickerStep("months");
                                            }}
                                            accessibilityRole="button"
                                            accessibilityLabel={t("growthChooseMonth")}
                                        >
                                            <Text style={styles.calendarMonthText}>{month?.toString("MMMM yyyy")}</Text>
                                            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    )}
                                    onDayPress={({ dateString }) => setPendingDate(dateString)}
                                />
                                <View style={[styles.datePickerActions, styles.datePickerActionsEnd]}>
                                    <TouchableOpacity style={styles.datePickerTextButton} onPress={stepBack} accessibilityRole="button">
                                        <Text style={styles.datePickerCancel}>{t("back")}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.datePickerApply, !pendingDate && styles.datePickerApplyDisabled]}
                                        disabled={!pendingDate}
                                        onPress={() => {
                                            const next = setRangeEndpoint(draftDateRange, editingDate, pendingDate);
                                            setDraftDateRange(next);
                                            setDraftMonthRange(monthSelectionFromRange(next));
                                            setDraftWeekRange(weekSelectionFromRange(next));
                                            setDraftDatePreset(null);
                                            setDatePickerStep("form");
                                        }}
                                        accessibilityRole="button"
                                        accessibilityState={{ disabled: !pendingDate }}
                                    >
                                        <Text style={styles.datePickerApplyLabel}>{t("growthConfirmDate")}</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : datePickerStep === "weeks" ? (
                            <>
                                <View style={styles.datePickerHeading}>
                                    <Text style={styles.datePickerTitle}>
                                        {t(editingWeek === "to" ? "growthEndingWeek" : "growthStartingWeek")}
                                    </Text>
                                    <Text style={styles.datePickerRange}>{t("growthChooseWeek")}</Text>
                                </View>
                                <View style={styles.monthPickerHeader}>
                                    <TouchableOpacity
                                        style={[styles.monthPickerArrow, selectedMonth <= earliestMonth && styles.controlDisabled]}
                                        disabled={selectedMonth <= earliestMonth}
                                        onPress={() => setVisibleMonth(shiftMonthClamped(visibleMonth, -1))}
                                        accessibilityRole="button"
                                        accessibilityLabel={t("growthPreviousMonth")}
                                    >
                                        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <Text style={styles.monthPickerTitle}>{monthLabel(visibleMonth)}</Text>
                                    <TouchableOpacity
                                        style={[styles.monthPickerArrow, selectedMonth >= latestMonth && styles.controlDisabled]}
                                        disabled={selectedMonth >= latestMonth}
                                        onPress={() => setVisibleMonth(shiftMonthClamped(visibleMonth, 1))}
                                        accessibilityRole="button"
                                        accessibilityLabel={t("growthNextMonth")}
                                    >
                                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.monthGrid}>
                                    {[1, 2, 3, 4].map((week) => {
                                        const sameMonth = draftWeekRange?.month === selectedMonth;
                                        const hasData = availableWeeksByMonth[selectedMonth]?.has(week);
                                        const conflicts = sameMonth && (
                                            (editingWeek === "from" && draftWeekRange.to && week > draftWeekRange.to)
                                            || (editingWeek === "to" && draftWeekRange.from && week < draftWeekRange.from)
                                        );
                                        const disabled = !hasData || conflicts;
                                        const selected = sameMonth && draftWeekRange?.[editingWeek] === week;
                                        const label = t("growthWeekNumber").replace("{week}", week);
                                        return (
                                            <TouchableOpacity
                                                key={week}
                                                style={[styles.monthOption, styles.weekOption, selected && styles.monthOptionSelected]}
                                                disabled={disabled}
                                                onPress={() => {
                                                    let next = sameMonth
                                                        ? { ...draftWeekRange, [editingWeek]: week }
                                                        : { month: selectedMonth, from: week, to: week };
                                                    if (next.from > next.to) {
                                                        next = editingWeek === "from"
                                                            ? { ...next, to: week }
                                                            : { ...next, from: week };
                                                    }
                                                    applyWeekSelection(next);
                                                    setDatePickerStep("form");
                                                }}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected, disabled }}
                                                accessibilityLabel={label}
                                            >
                                                <Text style={[
                                                    styles.monthOptionText,
                                                    selected && styles.monthOptionTextSelected,
                                                    disabled && styles.monthOptionTextDisabled,
                                                ]}>{label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <View style={[styles.datePickerActions, styles.datePickerActionsEnd]}>
                                    <TouchableOpacity style={styles.datePickerTextButton} onPress={stepBack} accessibilityRole="button">
                                        <Text style={styles.datePickerCancel}>{t("back")}</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : datePickerStep === "rangeMonths" ? (
                            <>
                                <View style={styles.datePickerHeading}>
                                    <Text style={styles.datePickerTitle}>
                                        {t(editingMonth === "to" ? "growthEndingMonth" : "growthStartingMonth")}
                                    </Text>
                                    <Text style={styles.datePickerRange}>{t("growthChooseMonthRange")}</Text>
                                </View>
                                <View style={styles.monthPickerHeader}>
                                    <TouchableOpacity
                                        style={[styles.monthPickerArrow, visibleYear <= Number(activeMonthMin.slice(0, 4)) && styles.controlDisabled]}
                                        disabled={visibleYear <= Number(activeMonthMin.slice(0, 4))}
                                        onPress={() => setVisibleMonth(`${visibleYear - 1}-${visibleMonth.slice(5, 7)}-01`)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t("growthPreviousYear")}
                                    >
                                        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <Text style={styles.monthPickerTitle}>{monthLabel(visibleMonth)}</Text>
                                    <TouchableOpacity
                                        style={[styles.monthPickerArrow, visibleYear >= Number(activeMonthMax.slice(0, 4)) && styles.controlDisabled]}
                                        disabled={visibleYear >= Number(activeMonthMax.slice(0, 4))}
                                        onPress={() => setVisibleMonth(`${visibleYear + 1}-${visibleMonth.slice(5, 7)}-01`)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t("growthNextYear")}
                                    >
                                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.monthGrid}>
                                    {MONTHS.map((label, index) => {
                                        const month = `${visibleYear}-${String(index + 1).padStart(2, "0")}`;
                                        const disabled = month < activeMonthMin || month > activeMonthMax;
                                        const selected = draftMonthRange?.[editingMonth] === month;
                                        return (
                                            <TouchableOpacity
                                                key={month}
                                                style={[styles.monthOption, selected && styles.monthOptionSelected]}
                                                disabled={disabled}
                                                onPress={() => {
                                                    let next = { ...draftMonthRange, [editingMonth]: month };
                                                    if (next.from > next.to) {
                                                        next = editingMonth === "from"
                                                            ? { ...next, to: month }
                                                            : { ...next, from: month };
                                                    }
                                                    setDraftMonthRange(next);
                                                    setDraftDateRange(monthRangeFromSelection(next, datePickerMin, today));
                                                    setDatePickerStep("form");
                                                }}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected, disabled }}
                                                accessibilityLabel={`${label} ${visibleYear}`}
                                            >
                                                <Text style={[
                                                    styles.monthOptionText,
                                                    selected && styles.monthOptionTextSelected,
                                                    disabled && styles.monthOptionTextDisabled,
                                                ]}>{label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <View style={[styles.datePickerActions, styles.datePickerActionsEnd]}>
                                    <TouchableOpacity style={styles.datePickerTextButton} onPress={stepBack} accessibilityRole="button">
                                        <Text style={styles.datePickerCancel}>{t("back")}</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : datePickerStep === "months" ? (
                            <>
                                <View style={styles.monthPickerHeader}>
                                    <TouchableOpacity
                                        style={[
                                            styles.monthPickerArrow,
                                            !!activeDateBounds.min && visibleYear <= Number(activeDateBounds.min.slice(0, 4)) && styles.controlDisabled,
                                        ]}
                                        disabled={!!activeDateBounds.min && visibleYear <= Number(activeDateBounds.min.slice(0, 4))}
                                        onPress={() => setVisibleMonth(`${visibleYear - 1}-${visibleMonth.slice(5, 7)}-01`)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t("growthPreviousYear")}
                                    >
                                        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <Text style={styles.monthPickerTitle}>
                                        {new Date(`${visibleMonth}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                                    </Text>
                                    <TouchableOpacity
                                        style={[
                                            styles.monthPickerArrow,
                                            !!activeDateBounds.max && visibleYear >= Number(activeDateBounds.max.slice(0, 4)) && styles.controlDisabled,
                                        ]}
                                        disabled={!!activeDateBounds.max && visibleYear >= Number(activeDateBounds.max.slice(0, 4))}
                                        onPress={() => setVisibleMonth(`${visibleYear + 1}-${visibleMonth.slice(5, 7)}-01`)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t("growthNextYear")}
                                    >
                                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.monthGrid}>
                                    {MONTHS.map((label, index) => {
                                        const month = `${visibleYear}-${String(index + 1).padStart(2, "0")}`;
                                        const disabled = (activeDateBounds.min && month < activeDateBounds.min.slice(0, 7))
                                            || (activeDateBounds.max && month > activeDateBounds.max.slice(0, 7));
                                        const selected = month === selectedMonth;
                                        return (
                                            <TouchableOpacity
                                                key={month}
                                                style={[styles.monthOption, selected && styles.monthOptionSelected]}
                                                disabled={disabled}
                                                onPress={() => {
                                                    setVisibleMonth(`${month}-01`);
                                                    setDatePickerStep("calendar");
                                                }}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected, disabled }}
                                                accessibilityLabel={`${label} ${visibleYear}`}
                                            >
                                                <Text style={[
                                                    styles.monthOptionText,
                                                    selected && styles.monthOptionTextSelected,
                                                    disabled && styles.monthOptionTextDisabled,
                                                ]}>{label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <View style={[styles.datePickerActions, styles.datePickerActionsEnd]}>
                                    <TouchableOpacity style={styles.datePickerTextButton} onPress={stepBack} accessibilityRole="button">
                                        <Text style={styles.datePickerCancel}>{t("back")}</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={styles.datePickerHeading}>
                                    <Text style={styles.datePickerTitle}>
                                        {t(editingYear === "to" ? "growthEndingYear" : "growthStartingYear")}
                                    </Text>
                                    <Text style={styles.datePickerRange}>{t("growthChooseYear")}</Text>
                                </View>
                                <View style={styles.monthGrid}>
                                    {yearOptions.map((year) => {
                                        const disabled = editingYear === "from"
                                            ? year > draftYearRange.to
                                            : year < draftYearRange.from;
                                        const selected = draftYearRange?.[editingYear] === year;
                                        return (
                                            <TouchableOpacity
                                                key={year}
                                                style={[styles.monthOption, selected && styles.monthOptionSelected]}
                                                disabled={disabled}
                                                onPress={() => {
                                                    const next = { ...draftYearRange, [editingYear]: year };
                                                    if (next.from > next.to) {
                                                        if (editingYear === "from") next.to = year;
                                                        else next.from = year;
                                                    }
                                                    setDraftYearRange(next);
                                                    setDraftDateRange(yearRangeToDates(next));
                                                    setDatePickerStep("form");
                                                }}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected, disabled }}
                                                accessibilityLabel={String(year)}
                                            >
                                                <Text style={[
                                                    styles.monthOptionText,
                                                    selected && styles.monthOptionTextSelected,
                                                    disabled && styles.monthOptionTextDisabled,
                                                ]}>{year}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <View style={[styles.datePickerActions, styles.datePickerActionsEnd]}>
                                    <TouchableOpacity style={styles.datePickerTextButton} onPress={stepBack} accessibilityRole="button">
                                        <Text style={styles.datePickerCancel}>{t("back")}</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <DateWheelPicker
                visible={datePickerOpen && dateWheelOpen}
                value={pendingDate || draftDateRange?.[editingDate] || today}
                minimumDate={activeDateBounds.min || undefined}
                maximumDate={activeDateBounds.max || undefined}
                accessibilityLabel={t(editingDate === "to" ? "growthEndingDate" : "growthStartingDate")}
                onChange={(selected) => {
                    setPendingDate(selected);
                    const next = setRangeEndpoint(draftDateRange, editingDate, selected);
                    setDraftDateRange(next);
                    setDraftMonthRange(monthSelectionFromRange(next));
                    setDraftWeekRange(weekSelectionFromRange(next));
                    setDraftDatePreset(null);
                }}
                onClose={() => setDateWheelOpen(false)}
            />

            <OptionSheet
                visible={bandSheetOpen}
                title="Choose an age"
                options={bandOptions}
                selectedKey={selectedBand}
                onSelect={(key) => {
                    setSelectedBand(key);
                    setBandSheetOpen(false);
                }}
                onClose={() => setBandSheetOpen(false)}
            />

            <AnchoredMenu
                visible={metricMenuOpen}
                anchor={metricMenuAnchor}
                onClose={() => setMetricMenuOpen(false)}
                minWidth={Math.min(metricMenuAnchor?.width || 240, 300)}
            >
                {METRIC_FILTERS.map((metric) => (
                    <AnchoredMenuItem
                        key={metric.key}
                        label={t(metric.filterLabelKey || metric.labelKey)}
                        selected={metricKey === metric.key}
                        leading={
                            metric.key === "all" ? null : (
                                <View
                                    style={[
                                        styles.metricDot,
                                        { backgroundColor: colors.growthMetric[metric.key] },
                                    ]}
                                />
                            )
                        }
                        onPress={() => {
                            setMetricKey(metric.key);
                            setMetricMenuOpen(false);
                        }}
                        accessibilityLabel={t("growthShowChart").replace(
                            "{metric}",
                            t(metric.labelKey),
                        )}
                    />
                ))}
            </AnchoredMenu>

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
        </Animated.ScrollView>
    );
}

const makeStyles = (colors, cardForeground) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "transparent", // lets App.js's page gradient show through
    },
    // See the note on Health.js's `content`: padding on the ScrollView's own
    // box does not scroll, so the bottom clearance has to live on the content.
    content: {
        padding: space.lg,
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
        minWidth: 0,
        paddingVertical: space.sm + 2,
        // Zero, so the longest label gets the button's full share of the row —
        // the same fix Health.js's tab bar already carries.
        paddingHorizontal: 0,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    tabButtonActive: {
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    // Both states are the SAME SIZE, differing only in weight and colour —
    // DESIGN.md's Weight Ladder Rule. This spread `type.label` (14px) AFTER
    // `type.caption` (13px), so selecting a tab GREW its own text inside a
    // flex:1 box with nothing to absorb the extra width. It is the identical
    // defect already fixed in Health.js, which had survived here unnoticed
    // because Growth has three tabs rather than four and clipped later.
    tabButtonText: {
        ...type.caption,
        color: colors.textMuted,
    },
    tabButtonTextActive: {
        color: colors.primaryDark,
        fontWeight: "700",
    },
    // Opens the age menu. Shows the band being viewed so the age is readable
    // without opening anything — the twelve-pill scroller it replaced pushed
    // most bands, sometimes the selected one, off-screen.
    bandTrigger: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: MIN_TOUCH,
        paddingHorizontal: space.md,
        marginBottom: space.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
    },
    bandTriggerText: {
        ...type.bodyStrong,
        color: colors.text,
    },
    // "4 of 12 recorded". A count, never a percentage or a bar — this screen
    // must not read as a score (PRODUCT.md Principle 5).
    bandCount: {
        ...type.caption,
        color: colors.textMuted,
        marginBottom: space.md,
    },
    domainGroup: { marginBottom: space.lg },
    domainHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginBottom: space.sm,
    },
    domainIcon: {
        width: 24,
        height: 24,
        borderRadius: radius.sm,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    domainLabel: {
        ...type.label,
        color: colors.textSecondary,
    },
    checklistRow: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: MIN_TOUCH,
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceAlt,
        paddingBottom: 12,
    },
    checklistImg: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        marginRight: 10,
    },
    checklistTitle: {
        ...type.body,
        color: colors.text,
    },
    // "Recorded 12 Mar 2025 · 5 months" — the parent's own record behind the
    // tick, in the app's success tone rather than a neutral grey.
    checklistDone: {
        ...type.caption,
        color: colors.success,
        marginTop: 4,
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
    metricsHeaderBox: {
        borderRadius: radius.md,
        borderCurve: "continuous",
        padding: 16,
        marginBottom: 16,
    },
    metricsHeaderHeading: {
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        paddingBottom: space.xs,
        marginBottom: space.sm,
    },
    metricsHeaderTitle: { ...type.bodyStrong, color: cardForeground, flexShrink: 1 },
    metricsHeaderRow: { flexDirection: "row", alignItems: "stretch" },
    metricsHeaderCol: {
        // Longhand, and minWidth: 0 explicitly. Three columns in a row is
        // the exact shape both react-native-web flex traps live in --
        // `flex: 0` collapsing a box (Dashboard.js) and `min-width: auto`
        // refusing to shrink one (NutritionTracker.js).
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        alignItems: "center",
    },
    metricsHeaderLabel: {
        ...type.subheading,
        color: cardForeground,
        opacity: 0.95,
    },
    metricsHeaderValue: {
        ...type.heading,
        color: cardForeground,
        marginTop: 4,
        fontVariant: ["tabular-nums"],
    },
    metricsHeaderUnit: { ...type.caption, color: cardForeground, opacity: 0.95 },
    metricsHeaderDate: {
        ...type.caption,
        fontFamily: "PublicSans_400Regular",
        fontWeight: "400",
        color: cardForeground,
        opacity: 0.95,
        textAlign: "left",
    },
    metricsHeaderEmpty: {
        ...type.caption,
        color: cardForeground,
        opacity: 0.95,
        textAlign: "center",
        marginTop: space.sm,
    },
    metricsHeaderDivider: {
        width: 1,
        height: "100%",
        backgroundColor: cardForeground + "33",
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
        flex: 1,
        minWidth: 0,
        paddingHorizontal: space.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
    },
    dateSelectText: { ...type.label, color: colors.text, flexShrink: 1 },
    metricSelect: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: MIN_TOUCH,
        paddingHorizontal: space.md,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        flex: 1,
        minWidth: 0,
    },
    metricSelectValue: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        flex: 1,
        minWidth: 0,
    },
    metricSelectText: { ...type.body, flexShrink: 1, color: colors.text },
    metricDot: { width: 8, height: 8, borderRadius: 4 },
    chartHelp: { ...type.body, color: colors.textSecondary, marginBottom: space.md },
    allCharts: { gap: space.md },
    allChart: { paddingTop: space.sm },
    allChartDivider: {
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        paddingTop: space.lg,
    },
    allChartTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        paddingBottom: space.xs,
    },
    allChartTitle: { ...type.bodyStrong, color: colors.text },
    allChartLatest: {
        ...type.caption,
        color: colors.textMuted,
        fontVariant: ["tabular-nums"],
    },
    swipeListCard: { marginBottom: 0 },
    datePickerBackdrop: {
        flex: 1,
        justifyContent: "center",
        padding: space.lg,
        backgroundColor: "rgba(0,0,0,0.48)",
    },
    datePickerCard: {
        width: "100%",
        maxWidth: 380,
        alignSelf: "center",
        padding: space.md,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        ...shadow.raised,
    },
    datePickerHeading: { paddingHorizontal: space.sm, paddingTop: space.sm, gap: 2 },
    datePickerTitle: { ...type.heading, color: colors.text },
    datePickerRange: { ...type.caption, color: colors.textMuted, minHeight: 18 },
    dateForm: { gap: space.md, paddingHorizontal: space.sm, paddingVertical: space.lg },
    quickActions: { gap: space.sm, paddingBottom: space.xs },
    quickActionsTitle: { ...type.label, color: colors.textSecondary },
    quickActionChips: {
        flexDirection: "row",
        gap: space.xs,
    },
    quickActionChip: {
        height: 36,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: space.xs,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
    },
    quickActionChipSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    quickActionText: { ...type.caption, color: colors.textSecondary, textAlign: "center" },
    quickActionTextSelected: { color: colors.primaryDark },
    dateFieldGroup: { gap: space.xs },
    dateFieldLabel: { ...type.label, color: colors.textSecondary },
    dateField: {
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.sm,
        paddingHorizontal: space.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
    },
    dateFieldText: { ...type.body, color: colors.text, flexShrink: 1 },
    dateFieldPlaceholder: { color: colors.placeholder },
    calendarMonthButton: {
        minHeight: MIN_TOUCH,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.xs,
        paddingHorizontal: space.sm,
    },
    calendarMonthText: { ...type.label, color: colors.text },
    datePickerActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.sm,
        paddingTop: space.sm,
    },
    datePickerActionsEnd: { justifyContent: "flex-end" },
    datePickerRightActions: { flexDirection: "row", alignItems: "center", gap: space.xs },
    datePickerTextButton: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.sm },
    datePickerCancel: { ...type.label, color: colors.textSecondary },
    datePickerApply: {
        minHeight: MIN_TOUCH,
        justifyContent: "center",
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
    },
    datePickerApplyLabel: { ...type.label, color: colors.onPrimary },
    datePickerApplyDisabled: { opacity: 0.45 },
    monthPickerHeader: {
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: space.xs,
    },
    monthPickerArrow: {
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
    },
    controlDisabled: { opacity: 0.35 },
    monthPickerTitle: { ...type.label, color: colors.text },
    monthGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingVertical: space.md,
    },
    monthOption: {
        width: "33.333%",
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.md,
        borderCurve: "continuous",
    },
    weekOption: { width: "50%" },
    monthOptionSelected: { backgroundColor: colors.primary },
    monthOptionText: { ...type.label, color: colors.textSecondary },
    monthOptionTextSelected: { color: colors.onPrimary },
    monthOptionTextDisabled: { color: colors.placeholder, opacity: 0.55 },

    // Gallery tab
    addBtn: {
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    galleryFilters: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
    galleryChip: {
        flex: 1,
        minHeight: MIN_TOUCH,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: space.sm,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    galleryChipOn: { backgroundColor: colors.softGreen, borderColor: colors.primary },
    galleryChipText: { ...type.caption, color: colors.textMuted },
    galleryChipTextOn: { color: colors.primaryDark, fontWeight: "700" },
    galleryMonth: { ...type.subheading, color: colors.textMuted, marginTop: space.sm, marginBottom: space.sm },
    galleryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    galleryTile: { width: "48%" },
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
});
