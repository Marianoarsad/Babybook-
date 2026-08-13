import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, type } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// Cross-platform date / time picker.
//
//   • Web  -> native browser <input type="date"|"time"> (calendar / clock
//             picker, keyboard-friendly, responsive). Its value format is
//             already "YYYY-MM-DD" / "HH:MM", matching the app + API.
//   • iOS / Android -> @react-native-community/datetimepicker opened from a
//             tap target, formatted back to the same strings.
//
// value / onChange always use "YYYY-MM-DD" (date) or "HH:MM" (time) strings.
let DateTimePicker = null;
try {
    // eslint-disable-next-line global-require
    DateTimePicker = require("@react-native-community/datetimepicker").default;
} catch (e) {
    DateTimePicker = null;
}

const pad = (n) => String(n).padStart(2, "0");

function toISODate(d) {
    if (!d) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toHM(d) {
    if (!d) return "";
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Build a Date from the current string value so the picker opens on it.
function parseValue(mode, value) {
    if (mode === "time") {
        const d = new Date();
        if (value && /^\d{1,2}:\d{2}/.test(value)) {
            const [h, m] = value.split(":");
            d.setHours(Number(h), Number(m), 0, 0);
        }
        return d;
    }
    const d = value ? new Date(`${value}T00:00:00`) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
}

function PickerField({
    mode = "date", // "date" | "time"
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
    const [show, setShow] = useState(false);

    const labelNode = label ? (
        <Text style={{ ...type.label, color: colors.textSecondary }}>
            {label}
            {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
    ) : null;
    const helperNode = helper ? (
        <Text style={{ ...type.caption, color: colors.textMuted }}>{helper}</Text>
    ) : null;

    // --- Web: real browser date/time input ---
    if (Platform.OS === "web") {
        return (
            <View style={{ gap: space.xs, marginBottom: space.md }}>
                {labelNode}
                <input
                    type={mode}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label={label || (mode === "time" ? "Time" : "Date")}
                    min={mode === "date" ? minimumDate : undefined}
                    max={mode === "date" ? maximumDate : undefined}
                    style={{
                        height: 48,
                        width: "100%",
                        boxSizing: "border-box",
                        backgroundColor: colors.surfaceAlt,
                        border: `1px solid ${colors.border}`,
                        borderRadius: radius.md,
                        padding: "0 12px",
                        fontSize: type.body.fontSize,
                        color: value ? colors.text : colors.placeholder,
                        fontFamily: "PublicSans_400Regular, inherit",
                        outline: "none",
                    }}
                />
                {helperNode}
            </View>
        );
    }

    // --- Native fallback (no picker library): plain, still usable ---
    if (!DateTimePicker) {
        return (
            <View style={{ gap: space.xs, marginBottom: space.md }}>
                {labelNode}
                <View style={inputBox(colors)}>
                    <Text style={{ ...type.body, color: value ? colors.text : colors.placeholder }}>
                        {value || placeholder || (mode === "time" ? "HH:MM" : "YYYY-MM-DD")}
                    </Text>
                    <Ionicons name={mode === "time" ? "time-outline" : "calendar-outline"} size={18} color={colors.textMuted} />
                </View>
                {helperNode}
            </View>
        );
    }

    // --- iOS / Android: tap target opens the native picker ---
    const parsed = parseValue(mode, value);
    return (
        <View style={{ gap: space.xs, marginBottom: space.md }}>
            {labelNode}
            <TouchableOpacity
                onPress={() => setShow(true)}
                accessibilityRole="button"
                accessibilityLabel={`${label || (mode === "time" ? "Time" : "Date")}: ${value || "not set"}`}
                style={inputBox(colors)}
            >
                <Text style={{ fontSize: 15, color: value ? colors.text : colors.placeholder }}>
                    {value || placeholder || (mode === "time" ? "Select a time" : "Select a date")}
                </Text>
                <Ionicons name={mode === "time" ? "time-outline" : "calendar-outline"} size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {helperNode}
            {show ? (
                <DateTimePicker
                    value={parsed}
                    mode={mode}
                    is24Hour
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minimumDate={minimumDate ? new Date(`${minimumDate}T00:00:00`) : undefined}
                    maximumDate={maximumDate ? new Date(`${maximumDate}T00:00:00`) : undefined}
                    onChange={(event, selected) => {
                        if (Platform.OS !== "ios") setShow(false);
                        if (event.type === "dismissed") {
                            setShow(false);
                            return;
                        }
                        if (selected) onChange(mode === "time" ? toHM(selected) : toISODate(selected));
                    }}
                />
            ) : null}
        </View>
    );
}

const inputBox = (colors) => ({
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: space.md,
});

export function DateField(props) {
    return <PickerField mode="date" {...props} />;
}
export function TimeField(props) {
    return <PickerField mode="time" {...props} />;
}
export default DateField;
