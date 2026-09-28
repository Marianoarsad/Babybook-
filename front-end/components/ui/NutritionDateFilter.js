import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Modal from "./AppModal";
import { Ionicons } from "@expo/vector-icons";
import { DateWheelPicker } from "./DateField";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { MIN_TOUCH, radius, shadow, space, type } from "../../theme";
import {
    monthLabel,
    monthRangeFromSelection,
    setRangeEndpoint,
    shiftMonthClamped,
    shortDate,
    numericDateRange,
    todayLocal,
    toLocalISO,
    weekOfMonth,
    weekRangeFromSelection,
} from "../../utils/dates";

const ACTIONS = [
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const pad = (value) => String(value).padStart(2, "0");
const yearDates = ({ from, to }) => ({ from: `${from}-01-01`, to: `${to}-12-31` });
const monthSelection = (range) => ({
    from: range?.from?.slice(0, 7) || todayLocal().slice(0, 7),
    to: range?.to?.slice(0, 7) || todayLocal().slice(0, 7),
});

export function nutritionDateView(saved, minimumDate, referenceDate = todayLocal()) {
    const today = String(referenceDate).slice(0, 10);
    const year = Number(today.slice(0, 4));
    if (saved?.dateRange?.from && saved?.dateRange?.to) {
        return {
            dateRange: saved.dateRange,
            preset: ["week", "month", "year"].includes(saved.preset) ? saved.preset : null,
            yearRange: saved.yearRange || { from: year, to: year },
        };
    }
    const start = new Date(`${today}T00:00:00`);
    start.setDate(start.getDate() - 6);
    const rollingFrom = toLocalISO(start);
    const from = minimumDate && minimumDate > rollingFrom && minimumDate <= today
        ? minimumDate
        : rollingFrom;
    return {
        dateRange: { from, to: today },
        preset: null,
        yearRange: { from: year, to: year },
    };
}

export default function NutritionDateFilter({
    value,
    onChange,
    minimumDate,
    availableDates = [],
    style,
}) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const today = todayLocal();
    const minDate = minimumDate && minimumDate <= today ? minimumDate : null;
    const earliestMonth = minDate?.slice(0, 7) || availableDates.slice().sort()[0]?.slice(0, 7) || today.slice(0, 7);
    const latestMonth = today.slice(0, 7);
    const minYear = Number(earliestMonth.slice(0, 4));
    const maxYear = Number(today.slice(0, 4));
    const years = Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, index) => minYear + index);
    const availableWeeks = useMemo(() => {
        const result = {};
        availableDates.forEach((date) => {
            const month = date.slice(0, 7);
            if (!result[month]) result[month] = new Set();
            result[month].add(weekOfMonth(date));
        });
        return result;
    }, [availableDates]);

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value);
    const [picker, setPicker] = useState(null);
    const [dateWheelEndpoint, setDateWheelEndpoint] = useState(null);
    const [visibleMonth, setVisibleMonth] = useState(today);

    const begin = () => {
        setDraft(value);
        setPicker(null);
        setDateWheelEndpoint(null);
        setVisibleMonth(`${value.dateRange.to.slice(0, 7)}-01`);
        setOpen(true);
    };
    const chooseAction = (key) => {
        if (draft.preset === key) {
            setDraft((current) => ({ ...current, preset: null }));
            return;
        }
        if (key === "week") {
            const dates = availableDates.filter((date) => date <= today).sort();
            const anchor = dates[dates.length - 1] || today;
            const week = weekOfMonth(anchor);
            setVisibleMonth(`${anchor.slice(0, 7)}-01`);
            setDraft((current) => ({
                ...current,
                preset: key,
                weekRange: { month: anchor.slice(0, 7), from: week, to: week },
                dateRange: weekRangeFromSelection(anchor.slice(0, 7), week, week, minDate, today),
            }));
            return;
        }
        if (key === "month") {
            const current = today.slice(0, 7);
            setVisibleMonth(`${current}-01`);
            setDraft((old) => ({
                ...old,
                preset: key,
                monthRange: { from: current, to: current },
                dateRange: monthRangeFromSelection({ from: current, to: current }, minDate, today),
            }));
            return;
        }
        const next = { from: maxYear, to: maxYear };
        setDraft((old) => ({ ...old, preset: key, yearRange: next, dateRange: yearDates(next) }));
    };

    const weekRange = draft.weekRange || (() => {
        const month = draft.dateRange.to.slice(0, 7);
        const to = weekOfMonth(draft.dateRange.to);
        return { month, from: draft.dateRange.from.startsWith(month) ? weekOfMonth(draft.dateRange.from) : to, to };
    })();
    const months = draft.monthRange || monthSelection(draft.dateRange);
    const yearRange = draft.yearRange || {
        from: Number(draft.dateRange.from.slice(0, 4)),
        to: Number(draft.dateRange.to.slice(0, 4)),
    };
    const visibleYear = Number(visibleMonth.slice(0, 4));
    const selectedMonth = visibleMonth.slice(0, 7);
    const pickerKind = draft.preset || "date";

    const fieldLabel = (endpoint) => {
        if (draft.preset === "week") {
            return weekRange[endpoint] ? `Week ${weekRange[endpoint]} · ${monthLabel(`${weekRange.month}-01`)}` : "Select week";
        }
        if (draft.preset === "month") return monthLabel(`${months[endpoint]}-01`);
        if (draft.preset === "year") return String(yearRange[endpoint]);
        return shortDate(draft.dateRange[endpoint]);
    };
    const setEndpoint = (endpoint, selected) => {
        if (draft.preset === "week") {
            const sameMonth = weekRange.month === selectedMonth;
            let next = sameMonth ? { ...weekRange, [endpoint]: selected } : { month: selectedMonth, from: selected, to: selected };
            if (next.from > next.to) next = endpoint === "from" ? { ...next, to: selected } : { ...next, from: selected };
            setDraft((old) => ({ ...old, weekRange: next, dateRange: weekRangeFromSelection(next.month, next.from, next.to, minDate, today) }));
        } else if (draft.preset === "month") {
            const month = `${visibleYear}-${pad(selected)}`;
            let next = { ...months, [endpoint]: month };
            if (next.from > next.to) next = endpoint === "from" ? { ...next, to: month } : { ...next, from: month };
            setDraft((old) => ({ ...old, monthRange: next, dateRange: monthRangeFromSelection(next, minDate, today) }));
        } else {
            let next = { ...yearRange, [endpoint]: selected };
            if (next.from > next.to) next = endpoint === "from" ? { ...next, to: selected } : { ...next, from: selected };
            setDraft((old) => ({ ...old, yearRange: next, dateRange: yearDates(next) }));
        }
        setPicker(null);
    };

    const label = value.preset
        ? t({ week: "dateFilterWeekly", month: "dateFilterMonthly", year: "dateFilterYearly" }[value.preset])
        : numericDateRange(value.dateRange.from, value.dateRange.to);

    return (
        <>
            <TouchableOpacity style={[styles.trigger, style]} onPress={begin} accessibilityRole="button" accessibilityLabel={`Filter nutrition dates, ${label}`}>
                <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                <Text style={styles.triggerText} numberOfLines={1}>{label}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => picker ? setPicker(null) : setOpen(false)}>
                <TouchableOpacity activeOpacity={1} style={styles.backdrop} onPress={() => setOpen(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
                        {!picker ? (
                            <>
                                <View style={styles.heading}>
                                    <Text style={styles.title}>Filter nutrition records</Text>
                                    <Text style={styles.subtitle}>Choose the period shown in the charts and feeding pattern.</Text>
                                </View>
                                <View style={styles.form}>
                                    <View style={styles.actions}>
                                        {ACTIONS.map((action) => {
                                            const selected = draft.preset === action.key;
                                            return (
                                                <TouchableOpacity key={action.key} style={[styles.action, selected && styles.actionSelected]} onPress={() => chooseAction(action.key)} accessibilityRole="button" accessibilityState={{ selected }}>
                                                    <Text style={[styles.actionText, selected && styles.actionTextSelected]}>{action.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                    <View style={styles.fields}>
                                        {["from", "to"].map((endpoint) => (
                                            <View key={endpoint} style={styles.fieldGroup}>
                                                <Text style={styles.fieldLabel}>{endpoint === "from" ? "Starting" : "Ending"} {pickerKind}</Text>
                                                <TouchableOpacity style={styles.field} onPress={() => {
                                                    if (!draft.preset) {
                                                        setDateWheelEndpoint(endpoint);
                                                        return;
                                                    }
                                                    setPicker(endpoint);
                                                    if (draft.preset === "week") setVisibleMonth(`${weekRange.month}-01`);
                                                    else if (draft.preset === "month") setVisibleMonth(`${months[endpoint]}-01`);
                                                }} accessibilityRole="button">
                                                    <Text style={styles.fieldText}>{fieldLabel(endpoint)}</Text>
                                                    <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </>
                        ) : (
                            <View style={styles.heading}>
                                <Text style={styles.title}>{picker === "from" ? "Starting" : "Ending"} {pickerKind}</Text>
                                <Text style={styles.subtitle}>Choose a {pickerKind}.</Text>
                            </View>
                        )}

                        {picker && (draft.preset === "week" ? (
                            <>
                                <PickerHeader
                                    label={monthLabel(visibleMonth)}
                                    previousDisabled={selectedMonth <= earliestMonth}
                                    nextDisabled={selectedMonth >= latestMonth}
                                    onPrevious={() => setVisibleMonth(shiftMonthClamped(visibleMonth, -1))}
                                    onNext={() => setVisibleMonth(shiftMonthClamped(visibleMonth, 1))}
                                    styles={styles}
                                    colors={colors}
                                />
                                <View style={styles.grid}>
                                    {[1, 2, 3, 4].map((week) => {
                                        const disabled = !availableWeeks[selectedMonth]?.has(week)
                                            || (weekRange.month === selectedMonth && ((picker === "from" && week > weekRange.to) || (picker === "to" && week < weekRange.from)));
                                        return <GridButton key={week} label={`Week ${week}`} selected={weekRange.month === selectedMonth && weekRange[picker] === week} disabled={disabled} onPress={() => setEndpoint(picker, week)} styles={styles} style={styles.weekGridButton} />;
                                    })}
                                </View>
                            </>
                        ) : draft.preset === "month" ? (
                            <>
                                <PickerHeader label={String(visibleYear)} previousDisabled={visibleYear <= minYear} nextDisabled={visibleYear >= maxYear} onPrevious={() => setVisibleMonth(`${visibleYear - 1}-${visibleMonth.slice(5, 7)}-01`)} onNext={() => setVisibleMonth(`${visibleYear + 1}-${visibleMonth.slice(5, 7)}-01`)} styles={styles} colors={colors} />
                                <View style={styles.grid}>
                                    {MONTHS.map((month, index) => {
                                        const key = `${visibleYear}-${pad(index + 1)}`;
                                        const disabled = key < earliestMonth || key > latestMonth || (picker === "from" ? key > months.to : key < months.from);
                                        return <GridButton key={key} label={month} selected={months[picker] === key} disabled={disabled} onPress={() => setEndpoint(picker, index + 1)} styles={styles} />;
                                    })}
                                </View>
                            </>
                        ) : (
                            <View style={styles.grid}>
                                {years.map((year) => {
                                    const disabled = picker === "from" ? year > yearRange.to : year < yearRange.from;
                                    return <GridButton key={year} label={String(year)} selected={yearRange[picker] === year} disabled={disabled} onPress={() => setEndpoint(picker, year)} styles={styles} />;
                                })}
                            </View>
                        ))}

                        <View style={styles.footer}>
                            {picker ? (
                                <TouchableOpacity style={styles.textButton} onPress={() => setPicker(null)}><Text style={styles.textButtonText}>Back</Text></TouchableOpacity>
                            ) : (
                                <>
                                    <TouchableOpacity style={styles.textButton} onPress={() => setOpen(false)}><Text style={styles.textButtonText}>Cancel</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.applyButton} onPress={() => { onChange(draft); setOpen(false); }}><Text style={styles.applyText}>Apply</Text></TouchableOpacity>
                                </>
                            )}
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
            <DateWheelPicker
                visible={open && !!dateWheelEndpoint}
                value={dateWheelEndpoint ? draft.dateRange[dateWheelEndpoint] : today}
                minimumDate={(dateWheelEndpoint === "to" ? draft.dateRange.from : minDate) || undefined}
                maximumDate={dateWheelEndpoint === "from" ? draft.dateRange.to : today}
                availableDates={availableDates}
                accessibilityLabel={`${dateWheelEndpoint === "to" ? "Ending" : "Starting"} date`}
                onChange={(selected) => setDraft((old) => ({
                    ...old,
                    dateRange: setRangeEndpoint(old.dateRange, dateWheelEndpoint, selected),
                }))}
                onClose={() => setDateWheelEndpoint(null)}
            />
        </>
    );
}

function PickerHeader({ label, previousDisabled, nextDisabled, onPrevious, onNext, styles, colors }) {
    return (
        <View style={styles.pickerHeader}>
            <TouchableOpacity style={styles.arrow} disabled={previousDisabled} onPress={onPrevious}><Ionicons name="chevron-back" size={20} color={previousDisabled ? colors.placeholder : colors.textSecondary} /></TouchableOpacity>
            <Text style={styles.pickerTitle}>{label}</Text>
            <TouchableOpacity style={styles.arrow} disabled={nextDisabled} onPress={onNext}><Ionicons name="chevron-forward" size={20} color={nextDisabled ? colors.placeholder : colors.textSecondary} /></TouchableOpacity>
        </View>
    );
}

function GridButton({ label, selected, disabled, onPress, styles, style }) {
    return (
        <TouchableOpacity style={[styles.gridButton, style, selected && styles.gridButtonSelected]} disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected, disabled }}>
            <Text style={[styles.gridText, selected && styles.gridTextSelected, disabled && styles.disabled]}>{label}</Text>
        </TouchableOpacity>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    trigger: { minHeight: MIN_TOUCH, minWidth: 0, maxWidth: "100%", flexShrink: 1, flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, borderCurve: "continuous", backgroundColor: colors.surface },
    triggerText: { ...type.label, color: colors.text, flexShrink: 1 },
    backdrop: { flex: 1, justifyContent: "center", padding: space.lg, backgroundColor: "rgba(0,0,0,0.48)" },
    card: { width: "100%", maxWidth: 380, alignSelf: "center", padding: space.md, borderRadius: radius.xl, borderCurve: "continuous", backgroundColor: colors.surface, ...shadow.raised },
    heading: { paddingHorizontal: space.sm, paddingTop: space.sm, gap: 2 },
    title: { ...type.heading, color: colors.text },
    subtitle: { ...type.caption, color: colors.textMuted, minHeight: 18 },
    form: { gap: space.md, paddingHorizontal: space.sm, paddingVertical: space.lg },
    actions: { flexDirection: "row", gap: space.sm, paddingBottom: space.xs },
    action: { flex: 1, minWidth: 0, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, borderCurve: "continuous" },
    actionSelected: { backgroundColor: colors.softGreen, borderColor: colors.primary },
    actionText: { ...type.caption, color: colors.textMuted, fontWeight: "700" },
    actionTextSelected: { color: colors.primaryDark },
    fields: { gap: space.md },
    fieldGroup: { gap: 4 },
    fieldLabel: { ...type.label, color: colors.textSecondary },
    field: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, borderCurve: "continuous", backgroundColor: colors.surfaceAlt },
    fieldText: { ...type.body, color: colors.text },
    pickerHeader: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xs },
    pickerTitle: { ...type.label, color: colors.text },
    arrow: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, borderCurve: "continuous" },
    grid: { flexDirection: "row", flexWrap: "wrap", paddingVertical: space.md },
    gridButton: { width: "33.333%", minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderCurve: "continuous" },
    weekGridButton: { width: "50%" },
    gridButtonSelected: { backgroundColor: colors.primary },
    gridText: { ...type.label, color: colors.textSecondary },
    gridTextSelected: { color: colors.onPrimary },
    disabled: { color: colors.placeholder, opacity: 0.55 },
    footer: { minHeight: MIN_TOUCH, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: space.xs, paddingTop: space.sm },
    textButton: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.sm },
    textButtonText: { ...type.label, color: colors.textSecondary },
    applyButton: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: radius.pill, borderCurve: "continuous", backgroundColor: colors.primary },
    applyText: { ...type.label, color: colors.onPrimary },
});
