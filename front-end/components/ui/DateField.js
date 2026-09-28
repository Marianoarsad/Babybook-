import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Modal from "./AppModal";
import { Ionicons } from "@expo/vector-icons";
import { MIN_TOUCH, radius, shadow, space, type } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useRecordForm } from "./RecordFormSheet";
import { FieldShell } from "./Field";
import { shortDate, todayLocal } from "../../utils/dates";
import {
    availablePickerDates,
    closestAvailableDate,
    pickerDateParts,
    pickerDateValue,
    pickerYears,
    timeParts,
    timeValue,
} from "../../utils/pickers";
import numericInput from "../../utils/numericInput.cjs";

const {
    measurementFractions,
    measurementParts,
    measurementValue,
    measurementWholeValues,
} = numericInput;

const MONTHS = Array.from({ length: 12 }, (_, month) =>
    new Date(2026, month, 1).toLocaleDateString(undefined, { month: "long" }),
);
const pad = (value) => String(value).padStart(2, "0");

function clampDate(value, minimumDate, maximumDate) {
    const fallback = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayLocal();
    if (minimumDate && fallback < minimumDate) return minimumDate;
    if (maximumDate && fallback > maximumDate) return maximumDate;
    return fallback;
}

function WheelColumn({ values, value, onChange, format = String, label, styles, compact = false, weight = 1, active }) {
    const index = Math.max(0, values.indexOf(value));
    const itemHeight = compact ? 44 : 64;
    const scrollRef = useRef(null);
    const draggingRef = useRef(false);
    const offsetRef = useRef(index * itemHeight);
    const settleTimer = useRef(null);
    const clearSettle = () => {
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = null;
    };
    const selectAtOffset = (offset = offsetRef.current) => {
        const nextIndex = Math.max(0, Math.min(values.length - 1, Math.round(offset / itemHeight)));
        if (values[nextIndex] !== value) onChange(values[nextIndex]);
    };
    const scheduleSelection = () => {
        clearSettle();
        settleTimer.current = setTimeout(selectAtOffset, 100);
    };
    const scrollToValue = () => {
        if (active) scrollRef.current?.scrollTo({ x: 0, y: index * itemHeight, animated: false });
    };
    useEffect(scrollToValue, [active, index, itemHeight]);
    useEffect(() => () => clearSettle(), []);
    return (
        <View style={[styles.wheelColumn, compact && styles.dateWheelColumn, { flex: weight }]} accessibilityLabel={label}>
            <ScrollView
                ref={scrollRef}
                style={[styles.wheelScroll, compact && styles.dateWheelScroll]}
                contentContainerStyle={[styles.wheelContent, compact && styles.dateWheelContent]}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate="fast"
                onLayout={scrollToValue}
                scrollEventThrottle={16}
                onScroll={({ nativeEvent }) => {
                    offsetRef.current = nativeEvent.contentOffset.y;
                    if (!draggingRef.current) scheduleSelection();
                }}
                onScrollBeginDrag={() => {
                    draggingRef.current = true;
                    clearSettle();
                }}
                onScrollEndDrag={({ nativeEvent }) => {
                    draggingRef.current = false;
                    offsetRef.current = nativeEvent.contentOffset.y;
                    scheduleSelection();
                }}
                onMomentumScrollBegin={clearSettle}
                onMomentumScrollEnd={({ nativeEvent }) => {
                    clearSettle();
                    offsetRef.current = nativeEvent.contentOffset.y;
                    selectAtOffset();
                }}
            >
                {values.map((item, itemIndex) => (
                    <TouchableOpacity
                        key={item == null ? `empty-${itemIndex}` : item}
                        style={[
                            styles.wheelItem,
                            compact && styles.dateWheelItem,
                        ]}
                        onPress={() => item !== value && onChange(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${label} ${format(item)}`}
                        accessibilityState={{ selected: item === value }}
                    >
                        <Text style={[
                            styles.wheelText,
                            compact && styles.dateWheelText,
                            compact && item === value && styles.dateWheelTextSelected,
                            item !== value && styles.wheelTextMuted,
                        ]}>{format(item)}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

function TextButton({ label, onPress, styles }) {
    return <TouchableOpacity style={styles.textButton} onPress={onPress} accessibilityRole="button"><Text style={styles.textButtonLabel}>{label}</Text></TouchableOpacity>;
}

function PrimaryButton({ label, onPress, styles, disabled = false }) {
    return <TouchableOpacity style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]} disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityState={{ disabled }}><Text style={styles.primaryButtonLabel}>{label}</Text></TouchableOpacity>;
}

export function DateWheelPicker({
    visible,
    value,
    onChange,
    onClose,
    minimumDate,
    maximumDate,
    availableDates,
    accessibilityLabel = "Choose date",
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [draft, setDraft] = useState(() => clampDate(value, minimumDate, maximumDate));

    const restricted = Array.isArray(availableDates);
    const allowedDates = useMemo(
        () => restricted ? availablePickerDates(availableDates, minimumDate, maximumDate) : null,
        [availableDates, maximumDate, minimumDate, restricted],
    );

    useEffect(() => {
        if (!visible) return;
        const initial = clampDate(value, minimumDate, maximumDate);
        setDraft(restricted ? closestAvailableDate(allowedDates, initial) : initial);
    }, [allowedDates, maximumDate, minimumDate, restricted, value, visible]);

    const parts = pickerDateParts(draft, todayLocal());
    const years = restricted
        ? [...new Set(allowedDates.map((date) => Number(date.slice(0, 4))))]
        : pickerYears(draft, minimumDate, maximumDate);
    const months = restricted
        ? [...new Set(allowedDates
            .filter((date) => Number(date.slice(0, 4)) === parts.year)
            .map((date) => Number(date.slice(5, 7))))]
        : MONTHS.map((_, index) => index + 1);
    const days = restricted
        ? allowedDates
            .filter((date) => Number(date.slice(0, 4)) === parts.year && Number(date.slice(5, 7)) === parts.month)
            .map((date) => Number(date.slice(8, 10)))
        : Array.from(
            { length: new Date(parts.year, parts.month, 0).getDate() },
            (_, index) => index + 1,
        );
    const choose = (part, selected) => {
        if (restricted) {
            const candidates = allowedDates.filter((date) => {
                const dateParts = pickerDateParts(date, date);
                if (part === "year") return dateParts.year === selected;
                if (part === "month") return dateParts.year === parts.year && dateParts.month === selected;
                return dateParts.year === parts.year && dateParts.month === parts.month && dateParts.day === selected;
            });
            const target = pickerDateValue({ ...parts, [part]: selected });
            setDraft(closestAvailableDate(candidates, target));
            return;
        }
        const next = pickerDateValue({ ...parts, [part]: selected }, minimumDate, maximumDate);
        setDraft(next);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity
                activeOpacity={1}
                style={styles.datePickerBackdrop}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close date picker"
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.card}
                    onPress={() => {}}
                    accessibilityViewIsModal
                    accessibilityLabel={accessibilityLabel}
                >
                    <View style={styles.heading}>
                        <Text style={styles.title}>{accessibilityLabel}</Text>
                        <Text style={styles.subtitle}>{shortDate(draft)}</Text>
                    </View>
                    {restricted && !allowedDates.length ? (
                        <View style={styles.dateEmpty}><Text style={styles.dateEmptyText}>No recorded dates available.</Text></View>
                    ) : (
                        <View style={styles.dateWheels}>
                            <View pointerEvents="none" style={[styles.selectionBand, styles.compactSelectionBand]} />
                            <WheelColumn values={days} value={parts.day} onChange={(day) => choose("day", day)} label="Day" styles={styles} compact weight={0.7} active={visible} />
                            <WheelColumn values={months} value={parts.month} onChange={(month) => choose("month", month)} format={(month) => MONTHS[month - 1]} label="Month" styles={styles} compact weight={1.45} active={visible} />
                            <WheelColumn values={years} value={parts.year} onChange={(year) => choose("year", year)} label="Year" styles={styles} compact active={visible} />
                        </View>
                    )}
                    <View style={styles.actionsEnd}>
                        <View style={styles.actionGroup}>
                            <TextButton label="Cancel" onPress={onClose} styles={styles} />
                            <PrimaryButton label="Done" disabled={restricted && !allowedDates.length} onPress={() => { onChange(draft); onClose(); }} styles={styles} />
                        </View>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

function formatTime(value) {
    const { period, hour, minute } = timeParts(value);
    return `${hour}:${pad(minute)} ${period}`;
}

function PickerField({
    mode = "date",
    label,
    value,
    onChange,
    helper,
    required = false,
    minimumDate,
    maximumDate,
    placeholder,
    disabled = false,
    error,
}) {
    const { colors } = useTheme();
    const recordForm = useRecordForm();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [open, setOpen] = useState(false);
    const [pendingDate, setPendingDate] = useState("");
    const [pendingTime, setPendingTime] = useState(timeParts(value));

    const openPicker = () => {
        if (disabled) return;
        if (mode === "time") setPendingTime(timeParts(value));
        else {
            const initial = clampDate(value, minimumDate, maximumDate);
            setPendingDate(initial);
        }
        setOpen(true);
    };
    const hours = Array.from({ length: 12 }, (_, index) => index + 1);
    const minutes = Array.from({ length: 60 }, (_, index) => index);

    const trigger = <TouchableOpacity onPress={openPicker} disabled={disabled} accessibilityRole="button"
            accessibilityState={{ disabled }} accessibilityLabel={`${label || (mode === "time" ? "Time" : "Date")}: ${value || "not set"}`}
            style={styles.input}>
                <Text style={[styles.inputText, !value && styles.placeholder]}>
                    {value ? (mode === "date" ? shortDate(value) : formatTime(value)) : placeholder || `Select a ${mode}`}
                </Text>
                <Ionicons name={mode === "time" ? "time-outline" : "calendar-outline"} size={18} color={colors.textMuted} />
            </TouchableOpacity>;

    return (
        <>
            {recordForm && !label ? trigger : <FieldShell label={label} required={required} focused={open} disabled={disabled}
                error={error} helper={helper}>{trigger}</FieldShell>}

            <Modal visible={open && mode === "time"} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity activeOpacity={1} style={styles.backdrop} onPress={() => setOpen(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
                        <View style={styles.heading}><Text style={styles.title}>{label || "Select time"}</Text><Text style={styles.subtitle}>{formatTime(timeValue(pendingTime))}</Text></View>
                        <View style={styles.wheels}>
                            <View pointerEvents="none" style={[styles.selectionBand, styles.regularSelectionBand]} />
                            <WheelColumn values={["AM", "PM"]} value={pendingTime.period} onChange={(period) => setPendingTime((v) => ({ ...v, period }))} label="Period" styles={styles} active={open && mode === "time"} />
                            <WheelColumn values={hours} value={pendingTime.hour} onChange={(hour) => setPendingTime((v) => ({ ...v, hour }))} format={pad} label="Hour" styles={styles} active={open && mode === "time"} />
                            <WheelColumn values={minutes} value={pendingTime.minute} onChange={(minute) => setPendingTime((v) => ({ ...v, minute }))} format={pad} label="Minute" styles={styles} active={open && mode === "time"} />
                        </View>
                        <View style={styles.actionsEnd}>
                            <View style={styles.actionGroup}><TextButton label="Cancel" onPress={() => setOpen(false)} styles={styles} /><PrimaryButton label="Done" onPress={() => { onChange(timeValue(pendingTime)); setOpen(false); }} styles={styles} /></View>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
            <DateWheelPicker
                visible={open && mode === "date"}
                value={pendingDate}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                accessibilityLabel={label || "Select date"}
                onChange={(next) => {
                    setPendingDate(next);
                    onChange(next);
                }}
                onClose={() => setOpen(false)}
            />
        </>
    );
}

export function MeasurementField({
    label,
    value,
    onChange,
    unit,
    min,
    max,
    defaultValue = min,
    helper,
    required = false,
    error = false,
    disabled = false,
}) {
    const { colors } = useTheme();
    const recordForm = useRecordForm();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(() => measurementParts(value, min, max, defaultValue));

    const openPicker = () => {
        if (disabled) return;
        setDraft(measurementParts(value, min, max, defaultValue));
        setOpen(true);
    };
    const wholeValues = useMemo(() => measurementWholeValues(min, max), [min, max]);
    const fractions = useMemo(
        () => measurementFractions(draft.whole, min, max),
        [draft.whole, min, max],
    );
    useEffect(() => {
        if (!fractions.includes(draft.fraction)) {
            setDraft((current) => ({ ...current, fraction: fractions[0] || 0 }));
        }
    }, [draft.fraction, fractions]);

    const displayValue = value === "" || value == null
        ? "Select measurement"
        : `${Number(value).toFixed(1)} ${unit}`;

    const trigger = <TouchableOpacity
                onPress={openPicker}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                accessibilityLabel={`${label || "Measurement"}: ${displayValue}`}
                style={styles.input}
            >
                <Text style={[styles.inputText, (value === "" || value == null) && styles.placeholder]}>{displayValue}</Text>
                <Ionicons name="chevron-expand" size={18} color={colors.textMuted} />
            </TouchableOpacity>;

    return (
        <>
            {recordForm && !label ? trigger : <FieldShell label={label} required={required} focused={open} disabled={disabled}
                error={error} helper={helper}>{trigger}</FieldShell>}

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity activeOpacity={1} style={styles.backdrop} onPress={() => setOpen(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}} accessibilityViewIsModal>
                        <View style={styles.heading}>
                            <Text style={styles.title}>{label || "Choose a measurement"}</Text>
                            <Text style={styles.subtitle}>
                                {`${measurementValue(draft, min, max)} ${unit}`}
                            </Text>
                        </View>
                        <View style={styles.measurementWheels}>
                            <View pointerEvents="none" style={[styles.selectionBand, styles.regularSelectionBand]} />
                            <View style={styles.measurementNumberGroup}>
                                <WheelColumn
                                    values={wholeValues}
                                    value={draft.whole}
                                    onChange={(whole) => setDraft((current) => ({ ...current, whole }))}
                                    format={String}
                                    label={`${label || "Measurement"} whole value`}
                                    styles={styles}
                                    active={open}
                                />
                                <Text style={styles.measurementDecimal}>.</Text>
                                <WheelColumn
                                    values={fractions}
                                    value={fractions.includes(draft.fraction) ? draft.fraction : fractions[0]}
                                    onChange={(fraction) => setDraft((current) => ({ ...current, fraction }))}
                                    label={`${label || "Measurement"} decimal`}
                                    styles={styles}
                                    active={open}
                                />
                                <Text style={styles.measurementUnit}>{unit}</Text>
                            </View>
                        </View>
                        <View style={[styles.actionsEnd, value !== "" && value != null && styles.actionsBetween]}>
                            {value !== "" && value != null ? <TextButton label="Clear" onPress={() => { onChange(""); setOpen(false); }} styles={styles} /> : null}
                            <View style={styles.actionGroup}>
                                <TextButton label="Cancel" onPress={() => setOpen(false)} styles={styles} />
                                <PrimaryButton label="Done" onPress={() => { onChange(measurementValue(draft, min, max)); setOpen(false); }} styles={styles} />
                            </View>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    input: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "transparent", paddingHorizontal: space.lg },
    inputText: { ...type.body, color: colors.text },
    placeholder: { color: colors.placeholder },
    backdrop: { flex: 1, justifyContent: "center", padding: space.lg, backgroundColor: "rgba(0,0,0,0.48)" },
    card: { width: "100%", maxWidth: 380, alignSelf: "center", padding: space.md, borderRadius: radius.xl, borderCurve: "continuous", backgroundColor: colors.surface, ...shadow.raised },
    heading: { paddingHorizontal: space.sm, paddingTop: space.sm, gap: 2 },
    title: { ...type.heading, color: colors.text },
    subtitle: { ...type.caption, color: colors.textMuted, minHeight: 18 },
    actionsEnd: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingTop: space.sm },
    actionsBetween: { justifyContent: "space-between" },
    actionGroup: { flexDirection: "row", alignItems: "center", gap: space.xs },
    textButton: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.sm },
    textButtonLabel: { ...type.label, color: colors.textSecondary },
    primaryButton: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.primary },
    primaryButtonDisabled: { opacity: 0.45 },
    primaryButtonLabel: { ...type.label, color: colors.onPrimary },
    wheels: { height: 240, flexDirection: "row", alignItems: "center", position: "relative" },
    measurementWheels: { height: 240, justifyContent: "center", position: "relative" },
    measurementNumberGroup: { width: "66.6667%", height: "100%", flexDirection: "row", alignItems: "center", alignSelf: "center", position: "relative" },
    measurementDecimal: { ...type.heading, color: colors.text, paddingHorizontal: 2 },
    measurementUnit: { ...type.bodyStrong, color: colors.textSecondary, position: "absolute", right: -space.xl * 2, width: 40, textAlign: "left" },
    wheelColumn: { flex: 1, alignItems: "stretch", zIndex: 1 },
    wheelScroll: { height: 192 },
    wheelContent: { paddingVertical: 64 },
    wheelItem: { height: 64, alignItems: "center", justifyContent: "center" },
    wheelText: { fontFamily: type.body.fontFamily, fontSize: 36, color: colors.text, fontVariant: ["tabular-nums"] },
    wheelTextMuted: { color: colors.placeholder, opacity: 0.55 },
    datePickerBackdrop: {
        flex: 1,
        justifyContent: "center",
        padding: space.lg,
        backgroundColor: "rgba(0,0,0,0.36)",
    },
    dateWheels: {
        height: 240,
        flexDirection: "row",
        alignItems: "center",
        position: "relative",
    },
    dateEmpty: { height: 240, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
    dateEmptyText: { ...type.body, color: colors.textMuted, textAlign: "center" },
    selectionBand: {
        position: "absolute",
        left: 0,
        right: 0,
        backgroundColor: colors.surfaceAlt,
    },
    regularSelectionBand: { top: 88, height: 64 },
    compactSelectionBand: { top: 98, height: 44 },
    dateWheelColumn: { zIndex: 1 },
    dateWheelScroll: { height: 192 },
    dateWheelContent: { paddingVertical: 74 },
    dateWheelItem: { height: 44 },
    dateWheelText: { ...type.body, fontSize: 24, lineHeight: 30, color: colors.text, textAlign: "center" },
    dateWheelTextSelected: { ...type.bodyStrong, fontSize: 24, lineHeight: 30, color: colors.text },
});

export function DateField(props) { return <PickerField mode="date" {...props} />; }
export function TimeField(props) { return <PickerField mode="time" {...props} />; }
export default DateField;
