import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../../theme";
import Field from "./Field";

// Native date picker (guarded). If @react-native-community/datetimepicker is
// installed, this shows a real calendar/spinner; otherwise it falls back to a
// plain YYYY-MM-DD text field so the app still works before the install.
let DateTimePicker = null;
try {
    // eslint-disable-next-line global-require
    DateTimePicker = require("@react-native-community/datetimepicker").default;
} catch (e) {
    DateTimePicker = null;
}

function toISO(d) {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// value / onChange use "YYYY-MM-DD" strings (matches the rest of the app + API).
export default function DateField({ label, value, onChange, helper }) {
    const [show, setShow] = useState(false);

    // Fallback: no native picker available -> plain text field.
    if (!DateTimePicker) {
        return (
            <Field
                label={label}
                value={value}
                onChangeText={onChange}
                placeholder="YYYY-MM-DD"
                helper={helper || "Format: YYYY-MM-DD"}
                autoCapitalize="none"
            />
        );
    }

    const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
    const current = isNaN(parsed.getTime()) ? new Date() : parsed;

    return (
        <View style={{ gap: space.xs, marginBottom: space.md }}>
            {label ? (
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary }}>
                    {label}
                </Text>
            ) : null}
            <TouchableOpacity
                onPress={() => setShow(true)}
                accessibilityRole="button"
                accessibilityLabel={`${label || "Date"}: ${value || "not set"}`}
                style={{
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
                }}
            >
                <Text style={{ fontSize: 15, color: value ? colors.text : colors.textMuted }}>
                    {value || "Select a date"}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {helper ? (
                <Text style={{ fontSize: 12, color: colors.textMuted }}>{helper}</Text>
            ) : null}
            {show ? (
                <DateTimePicker
                    value={current}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    maximumDate={new Date()}
                    onChange={(event, selected) => {
                        // Android closes on selection; iOS stays open until dismissed.
                        if (Platform.OS !== "ios") setShow(false);
                        if (event.type === "dismissed") {
                            setShow(false);
                            return;
                        }
                        if (selected) onChange(toISO(selected));
                    }}
                />
            ) : null}
        </View>
    );
}
