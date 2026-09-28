import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Animated, View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../utils/api";
import { useRecords, useRecordSave } from "../utils/useRecords";
import { nutritionToApp, nutritionFormToRecord, feedVolumeMl } from "../utils/adapters";
import { ageInDays } from "../utils/whoGrowth";
import { useToast } from "./ui/Toast";
import { DateField, TimeField } from "./ui/DateField";
import { SectionContainerCard, ListEntryCard, EmptyStateCard } from "./common/Cards";
import { AppointmentsSkeleton } from "./ui/Skeleton";
import { useRefreshControl } from "./ui/useRefreshControl";
import AnchoredMenu, { AnchoredMenuItem } from "./ui/AnchoredMenu";
import NutritionDateFilter, { nutritionDateView } from "./ui/NutritionDateFilter";
import NutritionTrendChart from "./ui/NutritionTrendChart";
import NutritionMixChart from "./ui/NutritionMixChart";
import Field from "./ui/Field";

import RecordFormSheet, { DeleteConfirmation, RecordFormGroup, RecordFormRow } from "./ui/RecordFormSheet";
import PlanDetail from "./ui/PlanDetail";
import SwipeActionRow from "./ui/SwipeActionRow";
import ShowMore from "./ui/ShowMore";
import { storage } from "../utils/storageAdapter";
import {
    canStepFormulaScoops,
    formulaScoopsOrDefault,
    isFormulaScoopsDraft,
    isFormulaScoopsValue,
    nutritionFormDefaults,
    parseNutritionPrefs,
    recentNutritionFields,
    stepFormulaScoops,
} from "../utils/nutritionFormPrefs.cjs";
import numericInput from "../utils/numericInput.cjs";
import { toggleRequiredKey } from "../utils/growthMetricFilter.cjs";

const { decimalOnly, digitsOnly } = numericInput;
import {
    todayLocal,
    nowLocalTime,
    shortDate,
    durationText,
} from "../utils/dates";
import {
    byMoment,
    buildBuckets,
    milkDurations,
    solidFoodStats,
    foodSuggestions,
    hasBreastDurations,
    todayFeedingMix,
} from "../utils/feedingStats";

const MILK_TYPES = ["Breastmilk", "Formula", "Mixed"];
const METHODS = [
    { key: "breast", label: "Breast" },
    { key: "bottle", label: "Bottle" },
];
// "L" is deliberately absent. A single feed is never measured in litres, and
// one mis-tap used to multiply that feed by 1000 in the chart. The backend
// CHECK still accepts it so any older row keeps reading correctly.
const UNITS = ["mL", "oz"];
const SEVERITIES = [
    { key: "none", label: "None" },
    { key: "mild", label: "Mild" },
    { key: "severe", label: "Severe" },
];
const PREFS_KEY = "bb_nutrition_prefs";
const childPrefsKey = (childId) => `${PREFS_KEY}:${childId}`;
const RECENT_FOODS = 6;

// What the chart plots. "Feeds" is the only measure that counts a breastfeed
// and a bottle as the same event, which is why it's the default for any child
// who is breastfed at all — summing millilitres would render a day of eight
// breastfeeds as an empty bar, identical to a day with no feeding.
const MEASURES = [
    { key: "feeds", label: "Feeds", valueOf: () => 1, unit: "feeds" },
    { key: "volume", label: "Volume", valueOf: feedVolumeMl, unit: "mL" },
    {
        key: "breast",
        label: "Breast time",
        valueOf: (e) => (e.feedMethod === "breast" ? e.durationMinutes || 0 : 0),
        unit: "min",
    },
];
const NUTRITION_CHARTS = [
    { key: "milk", label: "Milk" },
    { key: "food", label: "Food" },
];
const NUTRITION_CHART_KEYS = NUTRITION_CHARTS.map((chart) => chart.key);

const emptyForm = (prefs, entryType = "milk") =>
    nutritionFormDefaults(prefs, entryType, todayLocal(), nowLocalTime());

export default function NutritionTracker({ profile, childId, initialAction, navKey, savedDateView, onDateViewChange }) {
    // `profile` is the whole child; childId stays accepted so an older call
    // site can't silently break the screen.
    const id = profile?.id || childId;
    const dob = profile?.dateOfBirth || profile?.dob || "";
    const today = todayLocal();
    const minimumDate = dob && String(dob).slice(0, 10) <= today ? String(dob).slice(0, 10) : null;
    const toast = useToast();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const { scrollProps } = useScroll();
    const recordRows = useRecords(id, "nutrition");
    const entries = useMemo(() => recordRows.map(nutritionToApp), [recordRows]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [detailEntry, setDetailEntry] = useState(null);
    const [openSwipeId, setOpenSwipeId] = useState(null);
    const [deleteCandidate, setDeleteCandidate] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const saveRecord = useRecordSave(showModal, id, "nutrition", editingId);
    const [prefs, setPrefs] = useState(null);
    const [prefsChildId, setPrefsChildId] = useState(null);
    const [form, setForm] = useState(() => emptyForm(null));
    const [errors, setErrors] = useState({});
    const [dateView, setDateView] = useState(() => nutritionDateView(savedDateView, minimumDate));
    const [chartKeys, setChartKeys] = useState(() => [...NUTRITION_CHART_KEYS]);
    const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
    const [scopeMenuAnchor, setScopeMenuAnchor] = useState(null);
    const scopeTriggerRef = useRef(null);
    const [measure, setMeasure] = useState(null); // null = follow the data
    const [measureMenuOpen, setMeasureMenuOpen] = useState(false);
    const [measureMenuAnchor, setMeasureMenuAnchor] = useState(null);
    const measureTriggerRef = useRef(null);
    const showMilkChart = chartKeys.includes("milk");
    const showFoodChart = chartKeys.includes("food");
    const [listFilter, setListFilter] = useState("all");
    const [visibleCount, setVisibleCount] = useState(10);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await api.listRecords(id, "nutrition", { loading: "nonblocking" });
        } catch (e) {
            console.log("load nutrition:", e.message);
        } finally {
            setLoading(false);
        }
    }, [id]);
    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setDateView(nutritionDateView(savedDateView, minimumDate));
    }, [id, minimumDate]);

    const readPrefs = useCallback(async () => {
        const [scoped, legacy] = await Promise.all([
            storage.getItem(childPrefsKey(id)),
            storage.getItem(PREFS_KEY),
        ]);
        return parseNutritionPrefs(scoped, legacy);
    }, [id]);

    // Keep recent form values local to this child and entry type. The legacy
    // key remains a one-time fallback for existing milk preferences.
    useEffect(() => {
        let active = true;
        setPrefs(null);
        setPrefsChildId(null);
        readPrefs()
            .then((next) => {
                if (active) {
                    setPrefs(next);
                    setPrefsChildId(id);
                }
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [id, readPrefs]);

    const refreshControl = useRefreshControl(loading, load);

    const setF = (k, v) =>
        setForm((p) => {
            const next = { ...p, [k]: v };
            // Formula and mixed feeds use the bottle fields, so their hidden
            // method state must agree with the visible form.
            if (k === "milkType" && (v === "Formula" || v === "Mixed")) {
                next.feedMethod = "bottle";
                next.formulaScoops = formulaScoopsOrDefault(next.formulaScoops);
            }
            return next;
        });
    const clearError = (k) => setErrors((p) => (p[k] ? { ...p, [k]: undefined } : p));

    const openAdd = useCallback(
        async (entryType) => {
            setEditingId(null);
            setErrors({});
            const recent = prefsChildId === id && prefs ? prefs : await readPrefs();
            setPrefs(recent);
            setPrefsChildId(id);
            setForm(emptyForm(recent, entryType));
            setShowModal(true);
        },
        [id, prefs, prefsChildId, readPrefs],
    );

    // Deep-link from the floating "+" sheet: open straight into the Add modal,
    // preset to the right entry type. Mirrors Health.js and Growth.js.
    useEffect(() => {
        if (initialAction === "milk" || initialAction === "solid") openAdd(initialAction);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navKey]);

    const openEdit = (e) => {
        setEditingId(e.id);
        setErrors({});
        setForm({
            entryType: e.entryType || "milk",
            milkType: e.milkType || "Breastmilk",
            feedMethod:
                e.milkType === "Formula" || e.milkType === "Mixed"
                    ? "bottle"
                    : e.feedMethod || "bottle",
            formulaBrand: e.formulaBrand || "",
            formulaScoops:
                e.milkType === "Formula" || e.milkType === "Mixed"
                    ? formulaScoopsOrDefault(e.formulaScoops)
                    : "",
            quantity: e.quantity != null ? String(e.quantity) : "",
            breastmilkQuantity: e.breastmilkQuantity != null ? String(e.breastmilkQuantity) : "",
            unit: UNITS.includes(e.unit) ? e.unit : "mL",
            durationMinutes: e.durationMinutes != null ? String(e.durationMinutes) : "",
            foodIntroduced: e.foodIntroduced || "",
            // A pre-migration row has no severity. Free text alongside it means
            // something happened; blank means nothing was recorded either way.
            reactionSeverity: e.reactionSeverity || (e.reaction ? "mild" : "none"),
            reaction: e.reaction || "",
            date: e.date || todayLocal(),
            time: e.time || "",
            notes: e.notes || "",
        });
        setShowModal(true);
    };

    const isBreast =
        form.entryType === "milk" && form.milkType === "Breastmilk" && form.feedMethod === "breast";
    const showFormula = form.milkType === "Formula" || form.milkType === "Mixed";
    const canDecreaseScoops = canStepFormulaScoops(form.formulaScoops, -1);
    const canIncreaseScoops = canStepFormulaScoops(form.formulaScoops, 1);

    // Inline, field-level errors. A toast for "enter a quantity" points at
    // nothing — it fades from the top of the screen while the empty field it
    // was about sits untouched further down.
    const validate = () => {
        const next = {};
        if (form.entryType === "milk") {
            if (
                (form.milkType === "Formula" || form.milkType === "Mixed") &&
                !isFormulaScoopsValue(form.formulaScoops)
            ) {
                next.formulaScoops = "Enter a valid number of scoops.";
            }
            if (isBreast) {
                // Blank is valid — the feed itself is the record. Only a value
                // that IS entered has to make sense.
                if (form.durationMinutes.trim()) {
                    const mins = Number(form.durationMinutes);
                    if (!Number.isFinite(mins) || mins <= 0) {
                        next.durationMinutes = "Enter minutes, or leave this blank.";
                    } else if (mins > 240) {
                        next.durationMinutes = "That's over 4 hours — check the number.";
                    }
                }
            } else {
                const qty = Number(form.quantity);
                if (!form.quantity || !Number.isFinite(qty) || qty <= 0) {
                    next.quantity = "Enter how much was taken.";
                }
                if (form.milkType === "Mixed") {
                    const breastmilkQty = Number(form.breastmilkQuantity);
                    if (!form.breastmilkQuantity || !Number.isFinite(breastmilkQty) || breastmilkQty <= 0) {
                        next.breastmilkQuantity = "Enter how much breastmilk was taken.";
                    }
                }
            }
        } else if (!form.foodIntroduced.trim()) {
            next.foodIntroduced = "Enter the food.";
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        if (saving) return;
        setSaving(true);
        const body = nutritionFormToRecord(form);
        try {
            if (editingId) {
                await saveRecord(body);
                toast.success("Entry updated");
            } else {
                await saveRecord(body);
                toast.success("Entry saved");
            }
            const current = prefsChildId === id && prefs ? prefs : await readPrefs();
            const next = { ...current, [form.entryType]: recentNutritionFields(form) };
            setPrefs(next);
            setPrefsChildId(id);
            storage.setItem(childPrefsKey(id), JSON.stringify(next)).catch(() => {});
            setShowModal(false);
        } catch (e) {
            toast.error(e.message || "Could not save entry");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (entryId) => {
        if (deletingId === entryId) return false;
        setDeletingId(entryId);
        setShowModal(false);
        setDetailEntry(null);
        setOpenSwipeId(null);
        setDeleteCandidate(null);
        try {
            await api.optimisticRecord(id, "nutrition", "delete", entryId, {}, { label: "Feeding entry" });
            toast.success("Entry removed");
            return true;
        } catch (e) {
            toast.error(e.message || "Could not delete entry");
            return false;
        } finally {
            setDeletingId((current) => current === entryId ? null : current);
        }
    };

    const milk = useMemo(() => entries.filter((e) => e.entryType === "milk" && e.date), [entries]);
    const solids = useMemo(() => entries.filter((e) => e.entryType === "solid" && e.date), [entries]);
    const rangeObj = dateView.dateRange;
    const availableDates = useMemo(
        () => [...new Set(entries.map((entry) => entry.date).filter(Boolean))],
        [entries],
    );
    const applyDateView = (next) => {
        setDateView(next);
        onDateViewChange?.(next);
    };

    // Any breastfeeding at all makes "feeds" the honest default — it's the one
    // measure that counts both kinds of feed as the same event.
    const hasBreast = useMemo(() => milk.some((e) => e.feedMethod === "breast"), [milk]);
    // "Breast time" is only offered once some breastfeed actually carries a
    // duration. Duration is optional, so a child can have hundreds of
    // breastfeeds and no minutes — and a flat-zero chart reads as "no
    // feeding", which is exactly the confusion the measure switch exists to
    // prevent. Same for "Volume" when every feed was at the breast.
    const measures = useMemo(
        () =>
            MEASURES.filter(
                (m) =>
                    (m.key !== "breast" || hasBreastDurations(milk)) &&
                    (m.key !== "volume" || milk.some((e) => feedVolumeMl(e) > 0)),
            ),
        [milk],
    );
    const fallbackKey = hasBreast ? "feeds" : "volume";
    const requested = measure || fallbackKey;
    const measureKey = measures.some((m) => m.key === requested)
        ? requested
        : measures[0]?.key || "feeds";
    const activeMeasure = MEASURES.find((m) => m.key === measureKey) || MEASURES[0];
    const { bars: milkBars, total: milkTotal, granularity: milkGranularity } = useMemo(
        () => buildBuckets(milk, rangeObj, activeMeasure.valueOf),
        [milk, rangeObj.from, rangeObj.to, measureKey],
    );
    const milkBucketAverage = milkBars.length ? milkTotal / milkBars.length : 0;
    const { bars: foodBars, total: foodTotal, granularity: foodGranularity } = useMemo(
        () => buildBuckets(solids, rangeObj, () => 1),
        [solids, rangeObj.from, rangeObj.to],
    );
    const foodBucketAverage = foodBars.length ? foodTotal / foodBars.length : 0;

    const feedingMix = useMemo(() => todayFeedingMix(entries, today), [entries, today]);

    const openMeasureMenu = () => {
        measureTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setMeasureMenuAnchor({ x, y, width, height });
            setMeasureMenuOpen(true);
        });
    };
    const openScopeMenu = () => {
        scopeTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setScopeMenuAnchor({ x, y, width, height });
            setScopeMenuOpen(true);
        });
    };

    const durations = useMemo(() => milkDurations(milk), [milk]);

    // --- Solid foods ---
    const solidStats = useMemo(() => {
        const stats = solidFoodStats(solids, today.slice(0, 7));
        const ageDays = stats.first && dob ? ageInDays(dob, stats.first.date) : null;
        return { ...stats, firstAgeMonths: ageDays != null ? Math.round(ageDays / 30.4375) : null };
    }, [solids, dob, today]);

    // One-tap chips for the food field. Beyond speed, reusing a name keeps the
    // spelling consistent, without which the distinct count above reads
    // "Banana", "banana" and " Banana " as three different foods. With no
    // history yet the starter list stands in, so a parent's first solid-food
    // entry isn't typed into a bare box.
    const foodChips = useMemo(() => foodSuggestions(solids, RECENT_FOODS), [solids]);

    const LIST_FILTERS = [
        { key: "all", label: "All", count: entries.length },
        { key: "milk", label: "Milk", count: milk.length },
        { key: "solid", label: "Solids", count: solids.length },
    ];
    const listed = useMemo(() => {
        const rows = listFilter === "all" ? entries : entries.filter((e) => e.entryType === listFilter);
        return rows.slice().sort((a, b) => byMoment(b, a));
    }, [entries, listFilter]);
    useEffect(() => setVisibleCount(10), [listFilter]);

    const entryTitle = (e) => {
        if (e.entryType !== "milk") return e.foodIntroduced || "Solid food";
        const base = e.milkType || "Milk";
        if (e.feedMethod === "breast") {
            // Duration is optional, so the title falls back to the milk type
            // alone; "At the breast" still appears in the subtitle below.
            const mins = durationText(e.durationMinutes);
            return mins ? `${base} — ${mins}` : base;
        }
        if (e.milkType === "Mixed" && e.quantity != null && e.breastmilkQuantity != null) {
            return `${base} — ${e.quantity} ${e.unit || "mL"} formula + ${e.breastmilkQuantity} ${e.unit || "mL"} breastmilk`;
        }
        return e.quantity != null ? `${base} — ${e.quantity} ${e.unit || "mL"}` : base;
    };
    const nutritionDetailPlan = detailEntry ? {
        title: entryTitle(detailEntry),
        date: detailEntry.date,
        time: detailEntry.time,
        categoryLabel: detailEntry.entryType === "milk" ? "Milk feed" : "Solid food",
        color: detailEntry.entryType === "milk" ? colors.info : colors.recNutrition.on,
        details: detailEntry.entryType === "milk"
            ? [
                  { label: "Milk type", value: detailEntry.milkType || "—" },
                  { label: "Feeding method", value: detailEntry.feedMethod === "breast" ? "At the breast" : "Bottle" },
                  detailEntry.formulaBrand ? { label: "Formula brand", value: detailEntry.formulaBrand } : null,
                  detailEntry.formulaScoops != null
                      ? { label: "Scoops", value: String(detailEntry.formulaScoops) }
                      : null,
                  detailEntry.quantity != null
                      ? {
                            label: detailEntry.milkType === "Mixed" ? "Formula amount" : "Amount",
                            value: `${detailEntry.quantity} ${detailEntry.unit || "mL"}`,
                        }
                      : null,
                  detailEntry.breastmilkQuantity != null
                      ? { label: "Breastmilk amount", value: `${detailEntry.breastmilkQuantity} ${detailEntry.unit || "mL"}` }
                      : null,
                  detailEntry.durationMinutes != null
                      ? { label: "Duration", value: durationText(detailEntry.durationMinutes) }
                      : null,
              ].filter(Boolean)
            : [
                  { label: "Food", value: detailEntry.foodIntroduced || "—" },
                  {
                      label: "Reaction",
                      value: detailEntry.reactionSeverity
                          ? detailEntry.reactionSeverity.charAt(0).toUpperCase() + detailEntry.reactionSeverity.slice(1)
                          : "Not recorded",
                  },
                  detailEntry.reaction ? { label: "Reaction details", value: detailEntry.reaction } : null,
              ].filter(Boolean),
        notes: detailEntry.notes,
        showReminder: false,
        deleteLabel: detailEntry.entryType === "milk" ? "Delete milk entry" : "Delete solid food entry",
    } : null;

    return (
        <Animated.ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            refreshControl={refreshControl}
            {...scrollProps}
            keyboardShouldPersistTaps="handled"
        >
            <SectionContainerCard title="Nutrition Over Time" subtitle="Milk and solid-food trends">
                <View style={styles.chartControls}>
                    <NutritionDateFilter
                        value={dateView}
                        onChange={applyDateView}
                        minimumDate={minimumDate}
                        availableDates={availableDates}
                    />
                    <TouchableOpacity
                        ref={scopeTriggerRef}
                        style={styles.metricFilterButton}
                        onPress={openScopeMenu}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: scopeMenuOpen }}
                        accessibilityLabel={`Nutrition chart filter, ${chartKeys.length} charts shown`}
                    >
                        <Ionicons name="funnel" size={26} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.trendCharts}>
                    {showMilkChart ? (
                        <NutritionTrendChart
                            title="Milk"
                            bars={milkBars}
                            unit={activeMeasure.unit}
                            color={colors.primary}
                            dateWindow={rangeObj}
                            datePreset={dateView.preset}
                            average={milkBucketAverage}
                            granularity={milkGranularity}
                            loading={loading}
                            emptyMessage="No milk entries in this period yet."
                            headerControl={(
                                <TouchableOpacity
                                    ref={measureTriggerRef}
                                    style={styles.measureSelect}
                                    onPress={openMeasureMenu}
                                    accessibilityRole="button"
                                    accessibilityState={{ expanded: measureMenuOpen }}
                                    accessibilityLabel={`Milk chart measure, ${activeMeasure.label}`}
                                >
                                    <Text style={styles.measureSelectText} numberOfLines={1}>{activeMeasure.label}</Text>
                                    <Ionicons
                                        name={measureMenuOpen ? "chevron-up" : "chevron-down"}
                                        size={18}
                                        color={colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            )}
                        />
                    ) : null}
                    {showFoodChart ? (
                        <View style={showMilkChart ? styles.trendChartDivider : null}>
                            <NutritionTrendChart
                                title="Food"
                                bars={foodBars}
                                unit="entries"
                                color={colors.accent}
                                dateWindow={rangeObj}
                                datePreset={dateView.preset}
                                average={foodBucketAverage}
                                granularity={foodGranularity}
                                loading={loading}
                                emptyMessage="No food entries in this period yet."
                            />
                        </View>
                    ) : null}
                </View>
            </SectionContainerCard>

            <AnchoredMenu
                visible={scopeMenuOpen}
                anchor={scopeMenuAnchor}
                onClose={() => setScopeMenuOpen(false)}
                minWidth={232}
                maxWidth={232}
                dimBackdrop={false}
                animation="warp"
            >
                <View style={styles.metricChecklistHeader}>
                    <TouchableOpacity
                        style={styles.metricChecklistBack}
                        onPress={() => setScopeMenuOpen(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Close nutrition chart filter"
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.metricChecklistTitle}>Nutrition charts</Text>
                    <View style={styles.metricChecklistHeaderSpacer} />
                </View>
                {NUTRITION_CHARTS.map((chart) => {
                    const checked = chartKeys.includes(chart.key);
                    const disabled = checked && chartKeys.length === 1;
                    return (
                        <TouchableOpacity
                            key={chart.key}
                            style={[styles.metricChecklistRow, disabled && styles.metricChecklistRowDisabled]}
                            onPress={() => setChartKeys((current) => (
                                toggleRequiredKey(current, chart.key, NUTRITION_CHART_KEYS)
                            ))}
                            disabled={disabled}
                            accessibilityRole="switch"
                            accessibilityState={{ checked, disabled }}
                            accessibilityLabel={chart.label}
                        >
                            <Text style={styles.metricChecklistLabel}>{chart.label}</Text>
                            <Switch
                                value={checked}
                                disabled={disabled}
                                pointerEvents="none"
                                accessible={false}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={colors.onPrimary}
                                {...(Platform.OS === "web" ? { activeThumbColor: colors.onPrimary } : {})}
                                ios_backgroundColor={colors.border}
                            />
                        </TouchableOpacity>
                    );
                })}
            </AnchoredMenu>

            <AnchoredMenu
                visible={measureMenuOpen}
                anchor={measureMenuAnchor}
                onClose={() => setMeasureMenuOpen(false)}
                variant="select"
            >
                {measures.map((m) => (
                    <AnchoredMenuItem
                        key={m.key}
                        label={m.label}
                        selected={measureKey === m.key}
                        variant="select"
                        onPress={() => {
                            setMeasure(m.key);
                            setMeasureMenuOpen(false);
                        }}
                        accessibilityLabel={`Show ${m.label}`}
                    />
                ))}
            </AnchoredMenu>

            <SectionContainerCard title="Today’s Feeding Breakdown" subtitle={shortDate(today)}>
                <NutritionMixChart counts={feedingMix} />
            </SectionContainerCard>

            {/* Milk type over time */}
            {durations.current ? (
                <SectionContainerCard title="Milk Type" subtitle="What the baby has been drinking">
                    <View style={styles.durationBox}>
                        <Ionicons name="time-outline" size={16} color={colors.primary} />
                        <Text style={styles.durationText}>
                            Currently on <Text style={styles.durationStrong}>{durations.current.type}</Text> for{" "}
                            {durations.current.days} day{durations.current.days === 1 ? "" : "s"}
                        </Text>
                    </View>
                    {durations.periods.length > 1
                        ? durations.periods.map((p, i) => (
                              <View key={i} style={styles.periodRow}>
                                  <Text style={styles.periodType}>{p.type}</Text>
                                  <Text style={styles.periodSpan}>
                                      {shortDate(p.start)} → {shortDate(p.end)} · {p.days} day
                                      {p.days === 1 ? "" : "s"}
                                  </Text>
                              </View>
                          ))
                        : null}
                </SectionContainerCard>
            ) : null}

            {/* Solid foods. The entry list has always called these
                "introductions", but nothing ever counted them — a food logged
                forty times read as forty introductions. Distinct foods are
                derived by normalized name, so no new field was needed. */}
            {solids.length ? (
                <SectionContainerCard title="Solid Foods" subtitle="Foods this child has tried">
                    <View style={styles.tileRow}>
                        <View style={styles.tile}>
                            <Text style={styles.tileValue} numberOfLines={1}>{solidStats.distinct}</Text>
                            <Text style={styles.tileLabel} numberOfLines={2}>
                                Different foods
                            </Text>
                        </View>
                        <View style={styles.tile}>
                            <Text style={styles.tileValue} numberOfLines={1}>{solidStats.newThisMonth}</Text>
                            <Text style={styles.tileLabel} numberOfLines={2}>
                                New this month
                            </Text>
                        </View>
                        <View style={styles.tile}>
                            <Text style={styles.tileValue} numberOfLines={1}>{solidStats.reactions.length}</Text>
                            <Text style={styles.tileLabel} numberOfLines={2}>
                                With a reaction
                            </Text>
                        </View>
                    </View>

                    {/* The child's own age at their first solid, stated as a
                        fact. Deliberately not compared to any guideline — the
                        app presents, it doesn't advise (PRODUCT.md #5). */}
                    {solidStats.first ? (
                        <Text style={styles.tileFootnote}>
                            First solid food was {solidStats.first.foodIntroduced} on{" "}
                            {shortDate(solidStats.first.date)}
                            {solidStats.firstAgeMonths != null
                                ? `, at ${solidStats.firstAgeMonths} month${solidStats.firstAgeMonths === 1 ? "" : "s"} old`
                                : ""}
                        </Text>
                    ) : null}

                    {solidStats.reactions.length ? (
                        <View style={styles.reactionBlock}>
                            <Text style={styles.blockHeading}>Foods with a recorded reaction</Text>
                            {solidStats.reactions.map((e) => {
                                const severe = e.reactionSeverity === "severe";
                                return (
                                    <View
                                        key={e.id}
                                        style={[
                                            styles.reactionRow,
                                            { backgroundColor: severe ? colors.dangerBg : colors.warningBg },
                                        ]}
                                    >
                                        <Ionicons
                                            name={severe ? "alert-circle" : "alert-circle-outline"}
                                            size={16}
                                            color={severe ? colors.danger : colors.warning}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.reactionFood}>{e.foodIntroduced || "Solid food"}</Text>
                                            <Text style={styles.reactionMeta}>
                                                {severe ? "Severe" : "Mild"} · {shortDate(e.date)}
                                                {e.reaction ? ` · ${e.reaction}` : ""}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                            <Text style={styles.reactionNote}>
                                Recorded here only. If any of these becomes a known allergy, add it to the child's
                                profile so it shows on their health ID.
                            </Text>
                        </View>
                    ) : null}
                </SectionContainerCard>
            ) : null}

            {/* Entries */}
            <SectionContainerCard
                title="Nutrition Records"
                subtitle="Every milk feed and solid food logged"
            >
                {/* Without this, 300-odd milk feeds bury every solid-food
                    entry the child has. */}
                <View style={styles.chipRow}>
                    {LIST_FILTERS.map((f) => (
                        <TouchableOpacity
                            key={f.key}
                            onPress={() => setListFilter(f.key)}
                            style={[styles.chip, listFilter === f.key && styles.chipActive]}
                            accessibilityRole="button"
                            accessibilityLabel={`Show ${f.label}`}
                        >
                            <Text style={[styles.chipText, listFilter === f.key && styles.chipTextActive]}>
                                {f.label} ({f.count})
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading && listed.length === 0 ? (
                    <AppointmentsSkeleton />
                ) : (
                    !loading &&
                    listed.length === 0 && (
                        <EmptyStateCard
                            message={
                                entries.length
                                    ? "Nothing in this filter yet."
                                    : "No nutrition entries yet. Tap + to log a feed or a food."
                            }
                            icon="restaurant-outline"
                        />
                    )
                )}
                {listed.slice(0, visibleCount).map((e) => {
                    const label = `View ${entryTitle(e)}`;
                    return (
                        <SwipeActionRow
                            key={e.id}
                            open={openSwipeId === e.id}
                            onOpen={() => setOpenSwipeId(e.id)}
                            onClose={() => setOpenSwipeId(null)}
                            onPress={() => setDetailEntry(e)}
                            label={label}
                            actions={[
                                {
                                    key: "update", label: "Update", icon: "create-outline", color: colors.primaryDark,
                                    onPress: () => { setOpenSwipeId(null); openEdit(e); },
                                },
                                {
                                    key: "delete", label: "Delete", icon: "trash-outline", color: colors.onAccent, kind: "delete",
                                    onPress: () => { setOpenSwipeId(null); setDeleteCandidate(e); },
                                },
                            ]}
                        >
                            <ListEntryCard
                                style={styles.swipeListCard}
                                title={entryTitle(e)}
                                subtitle={shortDate(e.date)}
                                icon={
                                    <Ionicons
                                        name={e.entryType !== "milk" ? "restaurant-outline"
                                            : e.feedMethod === "breast" ? "heart-outline" : "water-outline"}
                                        size={18}
                                        color={e.entryType === "milk" ? colors.info : colors.recNutrition.on}
                                    />
                                }
                                iconBg={e.entryType === "milk" ? colors.infoBg : colors.recNutrition.bg}
                            />
                        </SwipeActionRow>
                    );
                })}
                <ShowMore
                    total={listed.length}
                    visible={visibleCount}
                    onPress={() => setVisibleCount((c) => c + 10)}
                    noun="entries"
                />
            </SectionContainerCard>

            <PlanDetail
                visible={!!detailEntry}
                plan={nutritionDetailPlan}
                onClose={() => setDetailEntry(null)}
                onEdit={() => {
                    const entry = detailEntry;
                    setDetailEntry(null);
                    if (entry) openEdit(entry);
                }}
                onDelete={() => setDeleteCandidate(detailEntry)}
                deleting={deletingId === detailEntry?.id}
            />

            <DeleteConfirmation
                visible={!!deleteCandidate}
                title={deleteCandidate?.entryType === "milk" ? "Delete milk entry?" : "Delete solid food entry?"}
                message="Delete this nutrition entry? This cannot be undone."
                busy={deletingId === deleteCandidate?.id}
                onCancel={() => setDeleteCandidate(null)}
                onConfirm={() => handleDelete(deleteCandidate?.id)}
            />

            {/* Add / Edit Modal */}
            <RecordFormSheet visible={showModal} title={`${editingId ? "Edit" : "Add"} ${form.entryType === "milk" ? "Milk" : "Solid Food"} Entry`}
                onClose={() => setShowModal(false)} onSubmit={handleSave} busy={saving}
                cancelLabel={"Cancel"} submitLabel={editingId ? "Update" : "Save"} error={Object.values(errors).filter(Boolean).join("\n")}
                record={editingId != null ? { id: editingId } : null} onDelete={editingId != null ? () => handleDelete(editingId) : undefined} deleteTitle={`Delete ${form.entryType === "milk" ? "milk" : "solid food"} entry?`} deleteMessage={`Delete this ${form.entryType === "milk" ? "milk" : "solid food"} entry? This cannot be undone.`}>
                <RecordFormGroup>
                                {form.entryType === "milk" ? (
                                    <View>
                                        <Text style={styles.label}>Milk Type</Text>
                                        <View style={styles.segment}>
                                            {MILK_TYPES.map((mt) => (
                                                <TouchableOpacity
                                                    key={mt}
                                                    style={[styles.segBtn, form.milkType === mt && styles.segBtnActive]}
                                                    onPress={() => setF("milkType", mt)}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={mt}
                                                >
                                                    <Text style={[styles.segText, form.milkType === mt && styles.segTextActive]}>
                                                        {mt}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {/* Formula and Mixed use the bottle fields, so
                                            Breastmilk is the only real method choice. */}
                                        {form.milkType === "Breastmilk" ? (
                                            <View>
                                                <Text style={styles.label}>Fed By</Text>
                                                <View style={styles.segment}>
                                                    {METHODS.map((m) => (
                                                        <TouchableOpacity
                                                            key={m.key}
                                                            style={[styles.segBtn, form.feedMethod === m.key && styles.segBtnActive]}
                                                            onPress={() => setF("feedMethod", m.key)}
                                                            accessibilityRole="button"
                                                            accessibilityLabel={m.label}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.segText,
                                                                    form.feedMethod === m.key && styles.segTextActive,
                                                                ]}
                                                            >
                                                                {m.label}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        ) : null}

                                        {isBreast ? (
                                            <View>
                                                <View style={styles.inlineRow}>
                                                    <Field
                                                        label="Duration (optional)"
                                                        style={{ flex: 1, marginBottom: 0 }}
                                                        keyboardType="numeric"
                                                        numericMode="digits"
                                                        placeholder="e.g. 18"
                                                        value={form.durationMinutes}
                                                        onChangeText={(v) => {
                                                            setF("durationMinutes", v);
                                                            clearError("durationMinutes");
                                                        }}
                                                        error={!!errors.durationMinutes}
                                                    />
                                                    <Text style={styles.inlineUnit}>minutes</Text>
                                                </View>
                                                {errors.durationMinutes ? (
                                                    <Text style={styles.errorText}>{errors.durationMinutes}</Text>
                                                ) : (
                                                    <Text style={styles.hint}>
                                                        Leave blank if you're not sure — the feed is still recorded.
                                                    </Text>
                                                )}
                                            </View>
                                        ) : (
                                            <View>
                                                {showFormula ? (
                                                    <View>
                                                        <View style={styles.formulaBrandField}>
                                                            <RecordFormRow divider={false} label={<Text style={styles.label}>Formula Brand</Text>}>

                                                            <TextInput
                                                                style={styles.input}
                                                                placeholder="e.g. Enfamil A+"
                                                                placeholderTextColor={colors.placeholder}
                                                                value={form.formulaBrand}
                                                                onChangeText={(v) => setF("formulaBrand", v)}
                                                                accessibilityLabel="Formula brand"
                                                            />
                                                            </RecordFormRow>
                                                        </View>
                                                        <RecordFormRow outlined={false} divider={false} label={<Text style={styles.label}>Scoops</Text>}>
                                                            <View style={styles.scoopStepper}>
                                                                <TouchableOpacity
                                                                    style={[
                                                                        styles.scoopStepButton,
                                                                        !canDecreaseScoops && styles.scoopStepButtonDisabled,
                                                                    ]}
                                                                    onPress={() => {
                                                                        setF("formulaScoops", stepFormulaScoops(form.formulaScoops, -1));
                                                                        clearError("formulaScoops");
                                                                    }}
                                                                    disabled={!canDecreaseScoops}
                                                                    accessibilityRole="button"
                                                                    accessibilityLabel="Decrease formula scoops"
                                                                    accessibilityState={{ disabled: !canDecreaseScoops }}
                                                                >
                                                                    <Ionicons name="remove" size={20} color={colors.textSecondary} />
                                                                </TouchableOpacity>
                                                                <TextInput
                                                                    style={[
                                                                        styles.scoopStepInput,
                                                                        errors.formulaScoops && styles.inputError,
                                                                    ]}
                                                                    keyboardType="decimal-pad"
                                                                    value={form.formulaScoops}
                                                                    maxLength={6}
                                                                    selectTextOnFocus
                                                                    onChangeText={(v) => {
                                                                        const next = decimalOnly(v);
                                                                        if (!isFormulaScoopsDraft(next)) return;
                                                                        setF("formulaScoops", next);
                                                                        clearError("formulaScoops");
                                                                    }}
                                                                    accessibilityLabel="Formula scoops"
                                                                />
                                                                <TouchableOpacity
                                                                    style={[
                                                                        styles.scoopStepButton,
                                                                        !canIncreaseScoops && styles.scoopStepButtonDisabled,
                                                                    ]}
                                                                    onPress={() => {
                                                                        setF("formulaScoops", stepFormulaScoops(form.formulaScoops, 1));
                                                                        clearError("formulaScoops");
                                                                    }}
                                                                    disabled={!canIncreaseScoops}
                                                                    accessibilityRole="button"
                                                                    accessibilityLabel="Increase formula scoops"
                                                                    accessibilityState={{ disabled: !canIncreaseScoops }}
                                                                >
                                                                    <Ionicons name="add" size={20} color={colors.textSecondary} />
                                                                </TouchableOpacity>
                                                            </View>
                                                            {errors.formulaScoops ? (
                                                                <Text style={styles.errorText}>{errors.formulaScoops}</Text>
                                                            ) : null}
                                                        </RecordFormRow>
                                                    </View>
                                                ) : null}

                                                {/* The unit sat behind an open/close
                                                    dropdown on a form used six times a
                                                    day. Two options belong inline. */}
                                                <View style={styles.inlineRow}>
                                                    <Field
                                                        label={form.milkType === "Mixed" ? "Formula Amount" : "Amount"}
                                                        style={{ flex: 1, marginBottom: 0 }}
                                                        keyboardType="numeric"
                                                        numericMode="decimal"
                                                        placeholder="e.g. 120"
                                                        value={form.quantity}
                                                        onChangeText={(v) => {
                                                            setF("quantity", v);
                                                            clearError("quantity");
                                                        }}
                                                        error={!!errors.quantity}
                                                    />
                                                    <View style={styles.unitSegment}>
                                                        {UNITS.map((u) => (
                                                            <TouchableOpacity
                                                                key={u}
                                                                style={[styles.unitBtn, form.unit === u && styles.segBtnActive]}
                                                                onPress={() => setF("unit", u)}
                                                                accessibilityRole="button"
                                                                accessibilityLabel={`Measure in ${u}`}
                                                            >
                                                                <Text
                                                                    style={[
                                                                        styles.segText,
                                                                        form.unit === u && styles.segTextActive,
                                                                    ]}
                                                                >
                                                                    {u}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                                {errors.quantity ? <Text style={styles.errorText}>{errors.quantity}</Text> : null}
                                                {form.milkType === "Mixed" ? (
                                                    <View>
                                                        <View style={styles.inlineRow}>
                                                            <Field
                                                                label="Breastmilk Amount"
                                                                style={{ flex: 1, marginBottom: 0 }}
                                                                keyboardType="numeric"
                                                                numericMode="decimal"
                                                                placeholder="e.g. 60"
                                                                value={form.breastmilkQuantity}
                                                                onChangeText={(v) => {
                                                                    setF("breastmilkQuantity", v);
                                                                    clearError("breastmilkQuantity");
                                                                }}
                                                                error={!!errors.breastmilkQuantity}
                                                            />
                                                            <Text style={styles.inlineUnit}>{form.unit}</Text>
                                                        </View>
                                                        {errors.breastmilkQuantity ? (
                                                            <Text style={styles.errorText}>{errors.breastmilkQuantity}</Text>
                                                        ) : null}
                                                    </View>
                                                ) : null}
                                            </View>
                                        )}
                                    </View>
                                ) : (
                                    <View>
                                        <RecordFormRow error={!!errors.foodIntroduced} divider={false} label={<Text style={styles.label}>Food</Text>}>

                                        <TextInput
                                            style={[styles.input, errors.foodIntroduced && styles.inputError]}
                                            placeholder="e.g. Mashed banana"
                                            placeholderTextColor={colors.placeholder}
                                            value={form.foodIntroduced}
                                            onChangeText={(v) => {
                                                setF("foodIntroduced", v);
                                                clearError("foodIntroduced");
                                            }}
                                            accessibilityLabel="Food"
                                        />
                                        </RecordFormRow>
                                        {errors.foodIntroduced ? (
                                            <Text style={styles.errorText}>{errors.foodIntroduced}</Text>
                                        ) : null}
                                        {foodChips.foods.length ? (
                                            <View>
                                                {/* Labelled differently in each
                                                    case on purpose — a parent
                                                    must never mistake a
                                                    suggestion for something
                                                    they already recorded. */}
                                                <Text style={styles.hint}>
                                                    {foodChips.fromHistory
                                                        ? "Recently logged — tap to reuse"
                                                        : "Common first foods — tap to fill"}
                                                </Text>
                                                <View style={styles.chipRow}>
                                                {foodChips.foods.map((f) => (
                                                    <TouchableOpacity
                                                        key={f}
                                                        style={styles.foodChip}
                                                        onPress={() => {
                                                            setF("foodIntroduced", f);
                                                            clearError("foodIntroduced");
                                                        }}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Use ${f}`}
                                                    >
                                                        <Text style={styles.foodChipText} numberOfLines={1}>
                                                            {f}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                                </View>
                                            </View>
                                        ) : null}

                                        <Text style={styles.label}>Any reaction?</Text>
                                        <View style={styles.segment}>
                                            {SEVERITIES.map((s) => (
                                                <TouchableOpacity
                                                    key={s.key}
                                                    style={[styles.segBtn, form.reactionSeverity === s.key && styles.segBtnActive]}
                                                    onPress={() => setF("reactionSeverity", s.key)}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`${s.label} reaction`}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.segText,
                                                            form.reactionSeverity === s.key && styles.segTextActive,
                                                        ]}
                                                    >
                                                        {s.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        {form.reactionSeverity !== "none" ? (
                                            <View>
                                                <RecordFormRow divider={false} label={<Text style={styles.label}>What happened</Text>}>

                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="e.g. Rash around the mouth, gone in an hour"
                                                    placeholderTextColor={colors.placeholder}
                                                    value={form.reaction}
                                                    onChangeText={(v) => setF("reaction", v)}
                                                    accessibilityLabel="What happened"
                                                />
                                                </RecordFormRow>
                                                {/* The app records what the parent
                                                    observed. Turning that into an
                                                    allergy on the child's profile is a
                                                    diagnosis, and theirs to make. */}
                                                <Text style={styles.hint}>
                                                    Saved with this food only. If it turns out to be an allergy, add it in
                                                    the child's profile.
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                )}

                                <View style={{ flexDirection: "row", gap: space.sm }}>
                                    <View style={{ flex: 1 }}>
                                        <RecordFormRow divider={false} label={<Text style={styles.label}>Date</Text>}>

                                        <DateField value={form.date} onChange={(v) => setF("date", v)} />
                                        </RecordFormRow>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <RecordFormRow divider={false} label={<Text style={styles.label}>Time</Text>}>

                                        <TimeField value={form.time} onChange={(v) => setF("time", v)} />
                                        </RecordFormRow>
                                    </View>
                                </View>

                                <RecordFormRow divider={false} label={<Text style={styles.label}>Notes (optional)</Text>}>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Anything worth remembering"
                                    placeholderTextColor={colors.placeholder}
                                    value={form.notes}
                                    onChangeText={(v) => setF("notes", v)}
                                    accessibilityLabel="Notes"
                                />
                                </RecordFormRow>

                </RecordFormGroup>
            </RecordFormSheet>
        </Animated.ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        // transparent, not colors.background: App.js paints the page gradient.

        container: { flex: 1, backgroundColor: "transparent" },
        // Padding on the content, not the ScrollView box — see Health.js.
        content: { padding: space.lg },

        // Stat tiles
        tileRow: { flexDirection: "row", gap: space.sm },
        tile: {
            flex: 1,
            minWidth: 0,
            alignItems: "center",
            gap: 2,
            paddingVertical: space.md,
            paddingHorizontal: space.xs,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.hairline,
        },
        tileValue: { ...type.heading, color: colors.text },
        tileLabel: { ...type.caption, color: colors.textMuted, textAlign: "center" },
        tileFootnote: { ...type.caption, color: colors.textMuted, marginTop: space.sm },

        // Chips — list filters and food suggestions
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md },
        chip: {
            minHeight: MIN_TOUCH,
            justifyContent: "center",
            paddingHorizontal: space.md,
            paddingVertical: 8,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        chipActive: { backgroundColor: colors.softGreen, borderColor: colors.primary },
        chipText: { ...type.caption, fontWeight: "700", color: colors.textMuted },
        chipTextActive: { color: colors.primaryDark },

        chartControls: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.sm,
            marginBottom: space.md,
        },
        metricFilterButton: {
            width: MIN_TOUCH,
            height: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
            flexShrink: 0,
        },
        metricChecklistHeader: {
            minHeight: 52,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.hairline,
        },
        metricChecklistBack: {
            width: MIN_TOUCH,
            minHeight: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
        },
        metricChecklistTitle: { ...type.bodyStrong, color: colors.text, flex: 1, textAlign: "center" },
        metricChecklistHeaderSpacer: { width: MIN_TOUCH },
        metricChecklistRow: {
            minHeight: 52,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.md,
            paddingHorizontal: space.md,
        },
        metricChecklistRowDisabled: { opacity: 0.65 },
        metricChecklistLabel: { ...type.body, color: colors.text, flex: 1 },
        measureSelect: {
            minWidth: 128,
            minHeight: MIN_TOUCH,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.sm,
            paddingHorizontal: space.md,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
        },
        measureSelectText: { ...type.label, color: colors.text },
        trendCharts: { gap: space.md },
        trendChartDivider: { paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.hairline },

        // Milk type
        durationBox: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.softGreen,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: space.md,
            paddingVertical: 10,
            marginBottom: space.md,
        },
        durationText: { ...type.caption, color: colors.textSecondary, flex: 1 },
        durationStrong: { fontWeight: "800", color: colors.primary },
        periodRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.sm,
            paddingVertical: 6,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
        },
        periodType: { ...type.label, color: colors.text },
        periodSpan: { ...type.caption, color: colors.textMuted, flexShrink: 1, textAlign: "right" },

        // Solid foods
        blockHeading: { ...type.subheading, color: colors.textMuted, marginBottom: space.sm },
        reactionBlock: { marginTop: space.lg },
        reactionRow: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: space.sm,
            padding: space.md,
            borderRadius: radius.md,
            borderCurve: "continuous",
            marginBottom: space.sm,
        },
        reactionFood: { ...type.label, color: colors.text },
        reactionMeta: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
        reactionNote: { ...type.caption, color: colors.textMuted },

        swipeListCard: { marginBottom: 0 },

        // Modal

        label: { ...type.label, color: colors.textSecondary, marginBottom: 6 },
        formulaBrandField: { paddingTop: space.md },
        hint: { ...type.caption, color: colors.textMuted, marginBottom: space.sm },
        errorText: { ...type.caption, color: colors.danger, marginTop: -space.sm, marginBottom: space.md },
        input: {
            backgroundColor: colors.surfaceAlt,
            borderWidth: 0,
            borderColor: colors.border,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            paddingHorizontal: space.lg,
            minHeight: 52,
            paddingVertical: space.sm,
            ...type.body,
            color: colors.text,
            marginBottom: space.md,
        },
        inputError: { borderWidth: 1, borderColor: colors.danger },
        scoopStepper: {
            alignSelf: "flex-end",
            flexDirection: "row",
            alignItems: "center",
            minHeight: 52,
            padding: 4,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.lg,
            borderCurve: "continuous",
        },
        scoopStepButton: {
            width: MIN_TOUCH,
            height: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.md,
            borderCurve: "continuous",
        },
        scoopStepButtonDisabled: { opacity: 0.35 },
        scoopStepInput: {
            width: 68,
            height: MIN_TOUCH,
            paddingHorizontal: space.xs,
            paddingVertical: 0,
            backgroundColor: colors.surface,
            borderWidth: 0,
            borderColor: colors.danger,
            borderRadius: radius.md,
            borderCurve: "continuous",
            textAlign: "center",
            ...type.body,
            fontVariant: ["tabular-nums"],
            color: colors.text,
            ...shadow.card,
        },
        // minWidth: 0 is load-bearing, not tidying. react-native-web renders
        // TextInput as a real <input>, and unlike View it gets no min-width
        // reset — so `min-width: auto` resolves to the element's INTRINSIC
        // width (measured: 228px here). With flex-basis at 0% the field still
        // refuses to shrink below that, and whatever shares the row gets
        // pushed out of the card: the mL/oz selector was 9px past the edge at
        // 390pt and 79px past it at 320pt, leaving "oz" unreachable.
        // Same family as the `flex: 0` trap noted in Dashboard.js, mirrored.
        inputFlex: { flex: 1, minWidth: 0, marginBottom: space.md },
        inlineRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
        // Both of inlineRow's trailing items hold their width: once the field
        // can shrink, flex would otherwise take it out of these instead and
        // clip "oz" / "minutes".
        inlineUnit: { ...type.body, color: colors.textSecondary, marginBottom: space.md, flexShrink: 0 },
        unitSegment: {
            flexDirection: "row",
            flexShrink: 0,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: "continuous",
            padding: 4,
            marginBottom: space.md,
        },
        unitBtn: {
            minWidth: 48,
            paddingVertical: 12,
            borderRadius: radius.sm,
            borderCurve: "continuous",
            alignItems: "center",
        },
        foodChip: {
            minHeight: MIN_TOUCH,
            justifyContent: "center",
            paddingHorizontal: space.md,
            paddingVertical: 8,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceAlt,
            maxWidth: "100%",
        },
        foodChipText: { ...type.caption, color: colors.textSecondary },
        segment: {
            flexDirection: "row",
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: "continuous",
            padding: 4,
            marginBottom: space.md,
        },
        segBtn: {
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 0,
            borderRadius: radius.sm,
            borderCurve: "continuous",
            alignItems: "center",
        },
        segBtnActive: { backgroundColor: colors.surface, ...shadow.card },
        // Both states are the same size, per DESIGN.md's Weight Ladder Rule —
        // growing the active label is what used to overflow tab boxes.
        segText: { ...type.caption, fontWeight: "700", color: colors.textMuted },
        segTextActive: { color: colors.primary },

    });
