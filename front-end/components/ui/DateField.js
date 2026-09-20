import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Modal from "./AppModal";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { MIN_TOUCH, radius, shadow, space, type } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useRecordForm } from "./RecordFormSheet";
import { shortDate, todayLocal } from "../../utils/dates";
import { timeParts, timeValue } from "../../utils/pickers";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const pad = (value) => String(value).padStart(2, "0");

function clampDate(value, minimumDate, maximumDate) {
    const fallback = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayLocal();
    if (minimumDate && fallback < minimumDate) return minimumDate;
    if (maximumDate && fallback > maximumDate) return maximumDate;
    return fallback;
}

function WheelColumn({ values, value, onChange, format = String, label, styles }) {
    const index = Math.max(0, values.indexOf(value));
    return (
        <View style={styles.wheelColumn} accessibilityLabel={label}>
            <ScrollView
                key={`${label}-${value}`}
                style={styles.wheelScroll}
                contentContainerStyle={styles.wheelContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={64}
                decelerationRate="fast"
                contentOffset={{ x: 0, y: index * 64 }}
                onMomentumScrollEnd={({ nativeEvent }) => {
                    const nextIndex = Math.max(0, Math.min(values.length - 1, Math.round(nativeEvent.contentOffset.y / 64)));
                    onChange(values[nextIndex]);
                }}
            >
                {values.map((item) => (
                    <TouchableOpacity
                        key={item}
                        style={[styles.wheelItem, item === value && styles.wheelItemSelected]}
                        onPress={() => onChange(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${label} ${format(item)}`}
                        accessibilityState={{ selected: item === value }}
                    >
                        <Text style={[styles.wheelText, item !== value && styles.wheelTextMuted]}>{format(item)}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

function TextButton({ label, onPress, styles }) {
    return <TouchableOpacity style={styles.textButton} onPress={onPress} accessibilityRole="button"><Text style={styles.textButtonLabel}>{label}</Text></TouchableOpacity>;
}

function PrimaryButton({ label, onPress, styles }) {
    return <TouchableOpacity style={styles.primaryButton} onPress={onPress} accessibilityRole="button"><Text style={styles.primaryButtonLabel}>{label}</Text></TouchableOpacity>;
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
}) {
    const { colors } = useTheme();
    const recordForm = useRecordForm();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState("calendar");
    const [pendingDate, setPendingDate] = useState("");
    const [visibleMonth, setVisibleMonth] = useState(todayLocal());
    const [pendingTime, setPendingTime] = useState(timeParts(value));

    const openPicker = () => {
        if (mode === "time") setPendingTime(timeParts(value));
        else {
            const initial = clampDate(value, minimumDate, maximumDate);
            setPendingDate(initial);
            setVisibleMonth(`${initial.slice(0, 7)}-01`);
            setStep("calendar");
        }
        setOpen(true);
    };

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

    const year = Number(visibleMonth.slice(0, 4));
    const selectedMonth = visibleMonth.slice(0, 7);
    const hours = Array.from({ length: 12 }, (_, index) => index + 1);
    const minutes = Array.from({ length: 60 }, (_, index) => index);

    return (
        <View style={[styles.fieldWrap, recordForm && { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm,
            paddingVertical: space.sm, marginBottom: label ? space.md : 0, borderBottomWidth: label ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.hairline }]}>
            {label ? <Text style={[styles.label, recordForm && { flex: 1, marginBottom: 0, color: colors.text }]}>{label}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}</Text> : null}
            <TouchableOpacity onPress={openPicker} accessibilityRole="button" accessibilityLabel={`${label || (mode === "time" ? "Time" : "Date")}: ${value || "not set"}`} style={[styles.input,
                recordForm && { flex: 1.35, minWidth: 0, backgroundColor: colors.surfaceAlt, borderWidth: 0, borderRadius: radius.lg }]}>
                <Text style={[styles.inputText, !value && styles.placeholder]}>
                    {value ? (mode === "date" ? shortDate(value) : formatTime(value)) : placeholder || `Select a ${mode}`}
                </Text>
                <Ionicons name={mode === "time" ? "time-outline" : "calendar-outline"} size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {helper ? <Text style={[styles.helper, recordForm && { flexBasis: "100%" }]}>{helper}</Text> : null}

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity activeOpacity={1} style={styles.backdrop} onPress={() => setOpen(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
                        {mode === "time" ? (
                            <>
                                <View style={styles.heading}><Text style={styles.title}>{label || "Select time"}</Text><Text style={styles.subtitle}>{formatTime(timeValue(pendingTime))}</Text></View>
                                <View style={styles.wheels}>
                                    <WheelColumn values={["AM", "PM"]} value={pendingTime.period} onChange={(period) => setPendingTime((v) => ({ ...v, period }))} label="Period" styles={styles} />
                                    <WheelColumn values={hours} value={pendingTime.hour} onChange={(hour) => setPendingTime((v) => ({ ...v, hour }))} format={pad} label="Hour" styles={styles} />
                                    <WheelColumn values={minutes} value={pendingTime.minute} onChange={(minute) => setPendingTime((v) => ({ ...v, minute }))} format={pad} label="Minute" styles={styles} />
                                </View>
                                <View style={styles.actionsEnd}>
                                    <View style={styles.actionGroup}><TextButton label="Cancel" onPress={() => setOpen(false)} styles={styles} /><PrimaryButton label="Done" onPress={() => { onChange(timeValue(pendingTime)); setOpen(false); }} styles={styles} /></View>
                                </View>
                            </>
                        ) : step === "calendar" ? (
                            <>
                                <View style={styles.heading}><Text style={styles.title}>{label || "Select date"}</Text><Text style={styles.subtitle}>{shortDate(pendingDate)}</Text></View>
                                <Calendar
                                    key={visibleMonth}
                                    current={visibleMonth}
                                    minDate={minimumDate || undefined}
                                    maxDate={maximumDate || undefined}
                                    markedDates={{ [pendingDate]: { selected: true, selectedColor: colors.primary, selectedTextColor: colors.onPrimary } }}
                                    theme={calendarTheme}
                                    disableArrowLeft={!!minimumDate && selectedMonth <= minimumDate.slice(0, 7)}
                                    disableArrowRight={!!maximumDate && selectedMonth >= maximumDate.slice(0, 7)}
                                    onMonthChange={({ dateString }) => setVisibleMonth(`${dateString.slice(0, 7)}-01`)}
                                    renderHeader={(month) => <TouchableOpacity style={styles.monthHeader} onPress={() => setStep("months")} accessibilityRole="button" accessibilityLabel="Choose month"><Text style={styles.monthHeaderText}>{month?.toString("MMMM yyyy")}</Text><Ionicons name="chevron-down" size={16} color={colors.textSecondary} /></TouchableOpacity>}
                                    onDayPress={({ dateString }) => setPendingDate(dateString)}
                                />
                                <View style={styles.actionsEnd}>
                                    <View style={styles.actionGroup}><TextButton label="Cancel" onPress={() => setOpen(false)} styles={styles} /><PrimaryButton label="Done" onPress={() => { onChange(pendingDate); setOpen(false); }} styles={styles} /></View>
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={styles.monthPickerHeader}>
                                    <TouchableOpacity style={styles.arrow} onPress={() => setVisibleMonth(`${year - 1}-${visibleMonth.slice(5, 7)}-01`)} disabled={!!minimumDate && year <= Number(minimumDate.slice(0, 4))} accessibilityRole="button" accessibilityLabel="Previous year"><Ionicons name="chevron-back" size={20} color={colors.textSecondary} /></TouchableOpacity>
                                    <Text style={styles.monthHeaderText}>{year}</Text>
                                    <TouchableOpacity style={styles.arrow} onPress={() => setVisibleMonth(`${year + 1}-${visibleMonth.slice(5, 7)}-01`)} disabled={!!maximumDate && year >= Number(maximumDate.slice(0, 4))} accessibilityRole="button" accessibilityLabel="Next year"><Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /></TouchableOpacity>
                                </View>
                                <View style={styles.monthGrid}>
                                    {MONTHS.map((month, index) => {
                                        const key = `${year}-${pad(index + 1)}`;
                                        const disabled = (!!minimumDate && key < minimumDate.slice(0, 7)) || (!!maximumDate && key > maximumDate.slice(0, 7));
                                        const selected = key === selectedMonth;
                                        return <TouchableOpacity key={key} style={[styles.monthCell, selected && styles.monthCellSelected]} disabled={disabled} onPress={() => { setVisibleMonth(`${key}-01`); setStep("calendar"); }} accessibilityRole="button" accessibilityState={{ disabled, selected }}><Text style={[styles.monthCellText, selected && styles.monthCellTextSelected, disabled && styles.disabled]}>{month}</Text></TouchableOpacity>;
                                    })}
                                </View>
                                <View style={styles.actionsEnd}><TextButton label="Back" onPress={() => setStep("calendar")} styles={styles} /></View>
                            </>
                        )}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    fieldWrap: { gap: space.xs, marginBottom: space.md },
    label: { ...type.label, color: colors.textSecondary },
    helper: { ...type.caption, color: colors.textMuted },
    input: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, borderCurve: "continuous", paddingHorizontal: space.md },
    inputText: { ...type.body, color: colors.text },
    placeholder: { color: colors.placeholder },
    backdrop: { flex: 1, justifyContent: "center", padding: space.lg, backgroundColor: "rgba(0,0,0,0.48)" },
    card: { width: "100%", maxWidth: 380, alignSelf: "center", padding: space.md, borderRadius: radius.xl, borderCurve: "continuous", backgroundColor: colors.surface, ...shadow.raised },
    heading: { paddingHorizontal: space.sm, paddingTop: space.sm, gap: 2 },
    title: { ...type.heading, color: colors.text },
    subtitle: { ...type.caption, color: colors.textMuted, minHeight: 18 },
    monthHeader: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, paddingHorizontal: space.sm },
    monthHeaderText: { ...type.label, color: colors.text },
    actionsEnd: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingTop: space.sm },
    actionGroup: { flexDirection: "row", alignItems: "center", gap: space.xs },
    textButton: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.sm },
    textButtonLabel: { ...type.label, color: colors.textSecondary },
    primaryButton: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.primary },
    primaryButtonLabel: { ...type.label, color: colors.onPrimary },
    monthPickerHeader: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xs },
    arrow: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, borderCurve: "continuous" },
    monthGrid: { flexDirection: "row", flexWrap: "wrap", paddingVertical: space.md },
    monthCell: { width: "33.333%", minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderCurve: "continuous" },
    monthCellSelected: { backgroundColor: colors.primary },
    monthCellText: { ...type.label, color: colors.textSecondary },
    monthCellTextSelected: { color: colors.onPrimary },
    disabled: { color: colors.placeholder, opacity: 0.55 },
    wheels: { flexDirection: "row", alignItems: "center", paddingVertical: space.xl },
    wheelColumn: { flex: 1, alignItems: "stretch", borderRightWidth: 1, borderRightColor: colors.hairline },
    wheelScroll: { height: 192 },
    wheelContent: { paddingVertical: 64 },
    wheelItem: { height: 64, alignItems: "center", justifyContent: "center" },
    wheelItemSelected: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.hairline },
    wheelText: { fontFamily: type.body.fontFamily, fontSize: 36, color: colors.text, fontVariant: ["tabular-nums"] },
    wheelTextMuted: { color: colors.placeholder, opacity: 0.55 },
});

export function DateField(props) { return <PickerField mode="date" {...props} />; }
export function TimeField(props) { return <PickerField mode="time" {...props} />; }
export default DateField;
