import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../utils/api";
import { useRecordSave } from "../../utils/useRecords";
import { todayLocal } from "../../utils/dates";
import { useToast } from "./Toast";

import { DateField, MeasurementField } from "./DateField";

import RecordFormSheet, { RecordFormGroup, RecordFormRow } from "./RecordFormSheet";

// One form for recording a measurement, and for correcting one.
//
// What was here before lived inline in Growth.js and was three bare number
// boxes:
//
//   Add Parameters
//     Height (cm)
//     Weight (kg)
//     Head Circumference (cm) — optional
//
// with `date_recorded: todayLocal()` written silently, no way to edit or
// delete a row afterwards, validation that only asked whether the number was
// positive, and a success toast that fired whether or not the save worked.
//
// The date is the part that mattered most: a clinic weigh-in entered two days
// later was placed two days wrong on the chart and shared record. This is the
// same defect class already fixed for vaccination and illness dates.
//
// `record` absent means create; present means edit. Edit makes input mistakes
// recoverable instead of leaving them in the chart permanently.
//
// `onSaved(row, editing)` hands the saved row back so the caller refreshes
// without a second round trip.

// Where the measurement happened.
//
// A RECORD OF FACT, NEVER A QUALITY GRADE. This is the same rule migration 005
// set for `care_level`: 'home' is not "less accurate" and 'hospital' is not
// "more accurate". Do not weight, rank, discount, colour or annotate a
// measurement based on this value, and never tell a parent that the number
// they took at home counts for less. It exists so the clinician reading a
// series can see which instrument produced which point — that reading is
// theirs to make, not the app's.
const PLACES = [
    { key: "home", label: "At home", icon: "home-outline" },
    { key: "health_center", label: "Health centre", icon: "business-outline" },
    { key: "clinic", label: "Clinic", icon: "medkit-outline" },
    { key: "hospital", label: "Hospital", icon: "bed-outline" },
];

// Hard bounds. These are a TYPO GUARD, not a screening range: they exist to
// catch a decimal point in the wrong place (72 for 7.2, a height typed into
// the weight box), which is the failure that silently corrupts a chart. They
// are deliberately far wider than any real 0–6y measurement, so the app is
// never in the business of telling a parent their child's size is wrong.
const FIELDS = [
    { key: "weight", label: "Weight", unit: "kg", min: 0.3, max: 40 },
    { key: "height", label: "Height / length", unit: "cm", min: 20, max: 140 },
    { key: "head", label: "Head circumference", unit: "cm", min: 20, max: 65, optional: true },
];

export default function GrowthModal({ visible, profile, record = null, suggestedValues = null, onClose, onSaved, onDelete }) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const toast = useToast();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const editing = !!record;
    const saveRecord = useRecordSave(visible, profile.id, "growth", record?.id);

    const [date, setDate] = useState(todayLocal());
    const [values, setValues] = useState({ weight: "", height: "", head: "" });
    const [place, setPlace] = useState("");
    const [notes, setNotes] = useState("");
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setErrors({});
        setFormError("");
        if (record) {
            setDate(String(record.date_recorded || "").slice(0, 10) || todayLocal());
            setValues({
                weight: record.weight != null ? String(record.weight) : "",
                height: record.height != null ? String(record.height) : "",
                head: record.head_circumference != null ? String(record.head_circumference) : "",
            });
            setPlace(record.measured_at || "");
            setNotes(record.notes || "");
        } else {
            setDate(todayLocal());
            setValues({ weight: "", height: "", head: "" });
            setPlace("");
            setNotes("");
        }
    }, [visible, record]);

    const setValue = (key, v) => {
        setValues((prev) => ({ ...prev, [key]: v }));
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
        if (formError) setFormError("");
    };

    const validate = () => {
        const next = {};
        let form = "";

        if (!date) {
            next.date = true;
            form = "Enter the date this measurement was taken.";
        } else if (date > todayLocal()) {
            next.date = true;
            form = "That date is in the future.";
        } else if (profile?.dateOfBirth && date < String(profile.dateOfBirth).slice(0, 10)) {
            next.date = true;
            form = "That date is before this child was born.";
        }

        let anyValue = false;
        for (const f of FIELDS) {
            const raw = String(values[f.key] || "").trim();
            if (!raw) continue;
            const n = parseFloat(raw);
            if (!isFinite(n)) {
                next[f.key] = true;
                if (!form) form = `${f.label} must be a number.`;
                continue;
            }
            if (n < f.min || n > f.max) {
                next[f.key] = true;
                // Says the accepted range rather than "invalid", so a parent
                // who mistyped can see at a glance what the app expected.
                if (!form) form = `${f.label} should be between ${f.min} and ${f.max} ${f.unit}.`;
                continue;
            }
            anyValue = true;
        }
        if (!anyValue && !form) form = "Enter at least one measurement.";

        setErrors(next);
        setFormError(form);
        return !form;
    };

    const numOrNull = (key) => {
        const raw = String(values[key] || "").trim();
        if (!raw) return null;
        const n = parseFloat(raw);
        return isFinite(n) ? n : null;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const body = {
                date_recorded: date,
                weight: numOrNull("weight"),
                height: numOrNull("height"),
                head_circumference: numOrNull("head"),
                measured_at: place || null,
                notes: notes.trim() || null,
            };
            const saved = await saveRecord(body);
            if (onSaved) onSaved(saved, editing);
            toast.success(editing ? "Measurement updated" : "Measurement saved");
            // Only now. The old version closed the modal before awaiting and
            // announced success from outside the try, so a failed save lost
            // the measurement and said "saved." anyway.
            onClose();
        } catch (e) {
            // Everything typed stays put, and the modal stays open.
            toast.error(e.message || "Could not save the measurement");
            setFormError(e.message || "Could not save the measurement");
        } finally {
            setSaving(false);
        }
    };

    return (
        <RecordFormSheet visible={visible} title={editing ? "Edit Measurement" : "Add Measurement"}
            onClose={onClose} onSubmit={handleSave} busy={saving}
            cancelLabel={t("cancel")} submitLabel={t("save")} error={formError}
            record={record} onDelete={onDelete ? () => onDelete(record) : undefined} deleteTitle={"Delete measurement?"} deleteMessage={"Delete this measurement? This cannot be undone."}>
            <RecordFormGroup>

                            {/* Asked, not assumed. A measurement taken at a
                                clinic is usually entered later that day or the
                                next — the old form filed it under whichever day
                                the parent happened to open the app. */}
                            <DateField
                                label="Date measured"
                                required
                                value={date}
                                onChange={(v) => {
                                    setDate(v);
                                    if (errors.date) setErrors((p) => ({ ...p, date: false }));
                                    if (formError) setFormError("");
                                }}
                                maximumDate={todayLocal()}
                                minimumDate={
                                    profile?.dateOfBirth
                                        ? String(profile.dateOfBirth).slice(0, 10)
                                        : undefined
                                }
                            />

                            {FIELDS.map((f) => {
                                return (
                                    <View key={f.key} style={styles.fieldBlock}>
                                        <RecordFormRow error={!!errors[f.key]} label={<Text style={styles.label}>
                                            {f.label} ({f.unit})
                                            {f.optional ? (
                                                <Text style={styles.optionalTag}> — optional</Text>
                                            ) : null}
                                        </Text>}>

                                        <MeasurementField
                                            label=""
                                            value={values[f.key]}
                                            onChange={(v) => setValue(f.key, v)}
                                            unit={f.unit}
                                            min={f.min}
                                            max={f.max}
                                            defaultValue={f.key === "weight"
                                                ? suggestedValues?.weight ?? profile?.currentWeight ?? profile?.birthWeight ?? 3.2
                                                : f.key === "height"
                                                    ? suggestedValues?.height ?? profile?.currentHeight ?? profile?.birthHeight ?? 49
                                                    : suggestedValues?.head_circumference ?? 35}
                                            error={!!errors[f.key]}
                                        />
                                        </RecordFormRow>
                                    </View>
                                );
                            })}

                            <Text style={styles.label}>Where was it measured?</Text>
                            <View style={styles.chipWrap}>
                                {PLACES.map((p) => {
                                    const on = place === p.key;
                                    return (
                                        <TouchableOpacity
                                            key={p.key}
                                            // Tapping the chosen one again clears it:
                                            // optional means there has to be a way
                                            // back to "not recorded".
                                            onPress={() => setPlace(on ? "" : p.key)}
                                            style={[styles.chip, on && styles.chipOn]}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: on }}
                                            accessibilityLabel={p.label}
                                        >
                                            <Ionicons
                                                name={p.icon}
                                                size={20}
                                                color={on ? colors.primary : colors.textSecondary}
                                            />
                                            <Text style={[styles.chipText, on && styles.chipTextOn]}>
                                                {p.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <Text style={styles.placeHelper}>
                                Recorded so a health worker can see which measurements came from a
                                clinic scale. It does not change anything the app shows you.
                            </Text>

                            <RecordFormRow stacked label={<Text style={styles.label}>Notes — optional</Text>}>

                            <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                placeholder="e.g. weighed with clothes on, straight after a feed"
                                placeholderTextColor={colors.placeholder}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                accessibilityLabel="Notes, optional"
                            />
                            </RecordFormRow>
                            <Text style={styles.placeHelper}>
                                Stays with you — notes are not included in a QR consultation.
                            </Text>

            </RecordFormGroup>
        </RecordFormSheet>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({

        label: { ...type.label, color: colors.textSecondary, marginBottom: space.xs },
        optionalTag: { ...type.caption, color: colors.textMuted, fontWeight: "400" },
        fieldBlock: { marginBottom: space.md },
        input: {
            minHeight: 52,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 0,
            borderColor: colors.border,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            paddingHorizontal: space.lg,
            fontSize: type.body.fontSize,
            fontFamily: type.body.fontFamily,
            color: colors.text,
        },
        inputMultiline: { paddingVertical: space.md, minHeight: 84, textAlignVertical: "top" },

        // Amber, not coral: DESIGN.md reserves coral for overdue / error /
        // destructive, and this is a question about a typed value, not a
        // rejection of it. The save still goes through.

        chipWrap: { flexDirection: "row", gap: space.sm, marginBottom: space.xs },
        chip: {
            flex: 1,
            minWidth: 0,
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 76,
            paddingHorizontal: space.xs,
            paddingVertical: space.sm,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
        chipText: { ...type.caption, fontWeight: "700", color: colors.textSecondary, textAlign: "center", flexShrink: 1 },
        chipTextOn: { color: colors.primaryDark },
        placeHelper: { ...type.caption, color: colors.textMuted, marginBottom: space.md },

    });
