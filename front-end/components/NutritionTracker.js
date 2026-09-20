import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Animated, View, Text, StyleSheet, TouchableOpacity, TextInput, } from "react-native";
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

import RecordFormSheet, { RecordFormGroup, RecordFormRow } from "./ui/RecordFormSheet";
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
import {
    todayLocal,
    nowLocalTime,
    shortDate,
    shortTime,
    durationText,
    minutesBetween,
    shortDateRange,
} from "../utils/dates";
import {
    byMoment,
    inRangeOf,
    buildBuckets,
    milkDurations,
    longestGap,
    nightStats,
    solidFoodStats,
    foodSuggestions,
    hasBreastDurations,
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
const CHART_SCOPES = [
    { key: "all", label: "All" },
    { key: "milk", label: "Milk" },
    { key: "food", label: "Food" },
];

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
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const saveRecord = useRecordSave(showModal, id, "nutrition", editingId);
    const [prefs, setPrefs] = useState(null);
    const [prefsChildId, setPrefsChildId] = useState(null);
    const [form, setForm] = useState(() => emptyForm(null));
    const [errors, setErrors] = useState({});
    const [dateView, setDateView] = useState(() => nutritionDateView(savedDateView, minimumDate));
    const [chartScope, setChartScope] = useState("all");
    const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
    const [scopeMenuAnchor, setScopeMenuAnchor] = useState(null);
    const scopeTriggerRef = useRef(null);
    const [measure, setMeasure] = useState(null); // null = follow the data
    const [measureMenuOpen, setMeasureMenuOpen] = useState(false);
    const [measureMenuAnchor, setMeasureMenuAnchor] = useState(null);
    const measureTriggerRef = useRef(null);
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
    const selectedRangeLabel = shortDateRange(rangeObj.from, rangeObj.to);
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
    const { bars: milkBars, days: milkSpanDays, total: milkTotal, granularity: milkGranularity } = useMemo(
        () => buildBuckets(milk, rangeObj, activeMeasure.valueOf),
        [milk, rangeObj.from, rangeObj.to, measureKey],
    );
    const milkBucketAverage = milkBars.length ? milkTotal / milkBars.length : 0;
    const { bars: foodBars, total: foodTotal, granularity: foodGranularity } = useMemo(
        () => buildBuckets(solids, rangeObj, () => 1),
        [solids, rangeObj.from, rangeObj.to],
    );
    const foodBucketAverage = foodBars.length ? foodTotal / foodBars.length : 0;

    // --- Today ---
    const todayStats = useMemo(() => {
        const rows = milk.filter((e) => e.date === today);
        const volume = rows.reduce((sum, e) => sum + feedVolumeMl(e), 0);
        const breastMinutes = rows.reduce(
            (sum, e) => sum + (e.feedMethod === "breast" ? e.durationMinutes || 0 : 0),
            0,
        );
        const solidCount = solids.filter((e) => e.date === today).length;
        return { count: rows.length, volume, breastMinutes, solidCount };
    }, [milk, solids, today]);

    const lastFeed = useMemo(() => {
        const sorted = milk.filter((e) => e.time && e.date <= today).sort(byMoment);
        return sorted.length ? sorted[sorted.length - 1] : null;
    }, [milk, today]);
    const sinceLastFeed = useMemo(() => {
        if (!lastFeed) return null;
        const mins = minutesBetween(lastFeed.date, lastFeed.time, today, nowLocalTime());
        return mins != null && mins >= 0 ? mins : null;
    }, [lastFeed, today]);

    // --- Pattern ---
    const pattern = useMemo(() => {
        const rows = inRangeOf(milk, rangeObj);
        const prevRows = inRangeOf(milk, rangeObj, 1);
        const nights = milkSpanDays || 1;
        return {
            gap: longestGap(rows),
            now: nightStats(rows, nights),
            prev: nightStats(prevRows, nights),
        };
    }, [milk, rangeObj.from, rangeObj.to, milkSpanDays]);

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
    const entrySubtitle = (e) => {
        const when = [shortDate(e.date), shortTime(e.time)].filter(Boolean).join(" · ");
        if (e.entryType !== "milk") return ["Solid food", when].filter(Boolean).join(" · ");
        return [
            when,
            e.feedMethod === "breast" ? "At the breast" : null,
            e.formulaBrand || null,
            e.formulaScoops != null ? `${e.formulaScoops} scoop${e.formulaScoops === 1 ? "" : "s"}` : null,
        ]
            .filter(Boolean)
            .join(" · ");
    };
    const entryNotes = (e) => {
        if (e.entryType === "solid" && (e.reactionSeverity === "mild" || e.reactionSeverity === "severe")) {
            const label = e.reactionSeverity === "severe" ? "Severe reaction" : "Mild reaction";
            return e.reaction ? `${label}: ${e.reaction}` : label;
        }
        return e.notes || undefined;
    };

    const tiles = [
        { key: "feeds", label: "Feeds today", value: String(todayStats.count) },
        todayStats.breastMinutes > 0
            ? { key: "breast", label: "At the breast", value: durationText(todayStats.breastMinutes) }
            : null,
        todayStats.volume > 0
            ? { key: "volume", label: "Bottle today", value: `${Math.round(todayStats.volume)} mL` }
            : null,
        {
            key: "since",
            label: "Since last feed",
            value: sinceLastFeed != null ? durationText(sinceLastFeed) || "Just now" : "—",
        },
    ].filter(Boolean);

    return (
        <Animated.ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            refreshControl={refreshControl}
            {...scrollProps}
            keyboardShouldPersistTaps="handled"
        >
            {/* Today — the glance layer. Everything here is derived from the
                entries already loaded; none of it costs a request. */}
            <SectionContainerCard title="Today" subtitle={shortDate(today)}>
                <View style={styles.tileRow}>
                    {tiles.map((t) => (
                        <View key={t.key} style={styles.tile}>
                            <Text style={styles.tileValue} numberOfLines={1}>
                                {t.value}
                            </Text>
                            <Text style={styles.tileLabel} numberOfLines={2}>
                                {t.label}
                            </Text>
                        </View>
                    ))}
                </View>
                {todayStats.solidCount > 0 ? (
                    <Text style={styles.tileFootnote}>
                        Plus {todayStats.solidCount} solid-food {todayStats.solidCount === 1 ? "entry" : "entries"}
                    </Text>
                ) : null}
            </SectionContainerCard>

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
                        style={styles.metricSelect}
                        onPress={openScopeMenu}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: scopeMenuOpen }}
                        accessibilityLabel={`Nutrition chart, ${CHART_SCOPES.find((scope) => scope.key === chartScope)?.label}`}
                    >
                        <View style={styles.metricSelectValue}>
                            {chartScope !== "all" ? (
                                <View style={[styles.metricDot, { backgroundColor: chartScope === "milk" ? colors.primary : colors.accent }]} />
                            ) : null}
                            <Text style={styles.metricSelectText} numberOfLines={1}>
                                {CHART_SCOPES.find((scope) => scope.key === chartScope)?.label}
                            </Text>
                        </View>
                        <Ionicons name={scopeMenuOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {chartScope !== "food" ? (
                    <View style={styles.measureControlRow}>
                        <TouchableOpacity
                            ref={measureTriggerRef}
                            style={[styles.metricSelect, styles.measureSelect]}
                            onPress={openMeasureMenu}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: measureMenuOpen }}
                            accessibilityLabel={`Milk chart measure, ${activeMeasure.label}`}
                        >
                            <Text style={styles.metricSelectText} numberOfLines={1}>Milk · {activeMeasure.label}</Text>
                            <Ionicons name={measureMenuOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                ) : null}

                <View style={styles.trendCharts}>
                    {chartScope !== "food" ? (
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
                        />
                    ) : null}
                    {chartScope !== "milk" ? (
                        <View style={chartScope === "all" ? styles.trendChartDivider : null}>
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
                minWidth={Math.min(scopeMenuAnchor?.width || 180, 240)}
            >
                {CHART_SCOPES.map((scope) => (
                    <AnchoredMenuItem
                        key={scope.key}
                        label={scope.label}
                        selected={chartScope === scope.key}
                        leading={scope.key === "all" ? null : (
                            <View style={[styles.metricDot, { backgroundColor: scope.key === "milk" ? colors.primary : colors.accent }]} />
                        )}
                        onPress={() => {
                            setChartScope(scope.key);
                            setScopeMenuOpen(false);
                        }}
                        accessibilityLabel={`Show ${scope.label} nutrition chart`}
                    />
                ))}
            </AnchoredMenu>

            <AnchoredMenu
                visible={measureMenuOpen}
                anchor={measureMenuAnchor}
                onClose={() => setMeasureMenuOpen(false)}
                minWidth={Math.min(measureMenuAnchor?.width || 180, 240)}
            >
                {measures.map((m) => (
                    <AnchoredMenuItem
                        key={m.key}
                        label={m.label}
                        selected={measureKey === m.key}
                        onPress={() => {
                            setMeasure(m.key);
                            setMeasureMenuOpen(false);
                        }}
                        accessibilityLabel={`Show ${m.label}`}
                    />
                ))}
            </AnchoredMenu>

            {/* Pattern */}
            {pattern.gap || pattern.now.count ? (
                <SectionContainerCard title="Feeding Pattern" subtitle={`Across ${selectedRangeLabel}`}>
                    {pattern.gap ? (
                        <View style={styles.factRow}>
                            <View style={[styles.factIcon, { backgroundColor: colors.infoBg }]}>
                                <Ionicons name="hourglass-outline" size={16} color={colors.info} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.factLabel}>Longest gap between feeds</Text>
                                <Text style={styles.factValue}>
                                    {durationText(pattern.gap.minutes)}, starting {shortDate(pattern.gap.date)}
                                </Text>
                            </View>
                        </View>
                    ) : null}
                    <View style={styles.factRow}>
                        <View style={[styles.factIcon, { backgroundColor: colors.recNutrition.bg }]}>
                            <Ionicons name="moon-outline" size={16} color={colors.recNutrition.on} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.factLabel}>Night feeds (10pm–6am)</Text>
                            <Text style={styles.factValue}>
                                {pattern.now.count} total · {pattern.now.perNight.toFixed(1)} a night
                            </Text>
                            {pattern.prev ? (
                                <Text style={styles.factSub}>
                                    Previous period: {pattern.prev.count} total ·{" "}
                                    {pattern.prev.perNight.toFixed(1)} a night
                                </Text>
                            ) : null}
                        </View>
                    </View>
                </SectionContainerCard>
            ) : null}

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
                action={
                    <View style={styles.addActions}>
                        <TouchableOpacity
                            onPress={() => openAdd("milk")}
                            style={styles.addBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Add milk entry"
                        >
                            <Ionicons name="water-outline" size={18} color={colors.onAccent} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => openAdd("solid")}
                            style={styles.addBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Add solid food entry"
                        >
                            <Ionicons name="restaurant-outline" size={18} color={colors.onAccent} />
                        </TouchableOpacity>
                    </View>
                }
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
                {listed.slice(0, visibleCount).map((e) => (
                    <ListEntryCard
                        key={e.id}
                        title={entryTitle(e)}
                        subtitle={entrySubtitle(e)}
                        notes={entryNotes(e)}
                        icon={
                            <Ionicons
                                name={
                                    e.entryType !== "milk"
                                        ? "restaurant-outline"
                                        : e.feedMethod === "breast"
                                          ? "heart-outline"
                                          : "water-outline"
                                }
                                size={18}
                                color={e.entryType === "milk" ? colors.info : colors.recNutrition.on}
                            />
                        }
                        iconBg={e.entryType === "milk" ? colors.infoBg : colors.recNutrition.bg}
                        actions={
                            <View style={{ flexDirection: "row" }}>
                                <TouchableOpacity
                                    onPress={() => openEdit(e)}
                                    style={styles.rowIconBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel="Edit entry"
                                >
                                    <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDelete(e.id)}
                                    style={styles.rowIconBtn}
                                    disabled={deletingId === e.id}
                                    accessibilityRole="button"
                                    accessibilityLabel="Delete entry"
                                    accessibilityState={{ disabled: deletingId === e.id, busy: deletingId === e.id }}
                                >
                                    {(<Ionicons name="trash-outline" size={20} color={colors.danger} />)}
                                </TouchableOpacity>
                            </View>
                        }
                    />
                ))}
                <ShowMore
                    total={listed.length}
                    visible={visibleCount}
                    onPress={() => setVisibleCount((c) => c + 10)}
                    noun="entries"
                />
            </SectionContainerCard>

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
                                                <Text style={styles.label}>Duration (optional)</Text>
                                                <View style={styles.inlineRow}>
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            styles.inputFlex,
                                                            errors.durationMinutes && styles.inputError,
                                                        ]}
                                                        keyboardType="numeric"
                                                        placeholder="e.g. 18"
                                                        placeholderTextColor={colors.placeholder}
                                                        value={form.durationMinutes}
                                                        onChangeText={(v) => {
                                                            setF("durationMinutes", v);
                                                            clearError("durationMinutes");
                                                        }}
                                                        accessibilityLabel="Duration in minutes, optional"
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
                                                        <RecordFormRow divider={false} label={<Text style={styles.label}>Scoops</Text>}>
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
                                                                        if (!isFormulaScoopsDraft(v)) return;
                                                                        setF("formulaScoops", v);
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

                                                <Text style={styles.label}>
                                                    {form.milkType === "Mixed" ? "Formula Amount" : "Amount"}
                                                </Text>
                                                {/* The unit sat behind an open/close
                                                    dropdown on a form used six times a
                                                    day. Two options belong inline. */}
                                                <View style={styles.inlineRow}>
                                                    <TextInput
                                                        style={[styles.input, styles.inputFlex, errors.quantity && styles.inputError]}
                                                        keyboardType="numeric"
                                                        placeholder="e.g. 120"
                                                        placeholderTextColor={colors.placeholder}
                                                        value={form.quantity}
                                                        onChangeText={(v) => {
                                                            setF("quantity", v);
                                                            clearError("quantity");
                                                        }}
                                                        accessibilityLabel={form.milkType === "Mixed" ? "Formula amount" : "Amount"}
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
                                                        <Text style={styles.label}>Breastmilk Amount</Text>
                                                        <View style={styles.inlineRow}>
                                                            <TextInput
                                                                style={[
                                                                    styles.input,
                                                                    styles.inputFlex,
                                                                    errors.breastmilkQuantity && styles.inputError,
                                                                ]}
                                                                keyboardType="numeric"
                                                                placeholder="e.g. 60"
                                                                placeholderTextColor={colors.placeholder}
                                                                value={form.breastmilkQuantity}
                                                                onChangeText={(v) => {
                                                                    setF("breastmilkQuantity", v);
                                                                    clearError("breastmilkQuantity");
                                                                }}
                                                                accessibilityLabel="Breastmilk amount"
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
                                        <RecordFormRow divider={false} label={<Text style={styles.label}>Food</Text>}>

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
        metricSelect: {
            minHeight: MIN_TOUCH,
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: space.md,
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
        },
        metricSelectValue: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.sm },
        metricSelectText: { ...type.body, color: colors.text, flexShrink: 1 },
        metricDot: { width: 8, height: 8, borderRadius: radius.pill, flexShrink: 0 },
        measureControlRow: { flexDirection: "row", marginBottom: space.md },
        measureSelect: { flex: 1 },
        trendCharts: { gap: space.md },
        trendChartDivider: { paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.hairline },

        // Pattern facts
        factRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md, marginBottom: space.md },
        factIcon: {
            width: 32,
            height: 32,
            borderRadius: radius.md,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
        },
        factLabel: { ...type.caption, color: colors.textMuted },
        factValue: { ...type.bodyStrong, color: colors.text },
        factSub: { ...type.caption, color: colors.textMuted, marginTop: 2 },

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

        // Bare 20px icons were the whole tap target (20 x 21.6). The button
        // takes the 44pt box; the glyph inside stays the same size.
        rowIconBtn: {
            width: MIN_TOUCH,
            height: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
        },
        addActions: { flexDirection: "row", gap: space.xs },
        addBtn: {
            width: MIN_TOUCH,
            height: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accentStrong,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            ...shadow.accent,
        },

        // Modal

        label: { ...type.label, color: colors.textSecondary, marginBottom: 6 },
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
