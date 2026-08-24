import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../utils/api";
import { todayLocal } from "../../utils/dates";
import { ageInDays, normalizeSex, zScore, WHO_MAX_DAY } from "../../utils/whoGrowth";
import { useToast } from "./Toast";
import Button from "./Button";
import { DateField } from "./DateField";
import KeyboardAvoider from "./KeyboardAvoider";

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
// The date is the part that mattered most. Growth is the one record in this
// app whose meaning IS the date-value pair: WHO's tables are indexed per day
// of age, so a clinic weigh-in entered two days later was placed two days
// wrong on the chart, and reached the healthcare professional's QR view with a
// percentile computed for the wrong age. Same defect class the project already
// fixed for vaccination `date_given` and for illness dates.
//
// `record` absent means create; present means edit. Edit is what makes a typo
// recoverable: before this, 72 kg entered for 7.2 poisoned the chart and every
// percentile derived from it, permanently.
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
    { key: "weight", label: "Weight", unit: "kg", indicator: "weight", min: 0.3, max: 40, placeholder: "e.g. 8.4" },
    { key: "height", label: "Height / length", unit: "cm", indicator: "height", min: 20, max: 140, placeholder: "e.g. 72" },
    { key: "head", label: "Head circumference", unit: "cm", indicator: "head", min: 20, max: 65, placeholder: "e.g. 45.2", optional: true },
];

// Beyond this the number is almost certainly mistyped rather than unusual —
// WHO's own charts stop drawing at ±3. The hint says "check what you typed",
// never anything about the child; the save is still allowed, because a real
// measurement the app finds surprising is still the parent's to record.
const TYPO_Z = 6;

export default function GrowthModal({ visible, profile, record = null, onClose, onSaved }) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const toast = useToast();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const editing = !!record;

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

    const sexKey = normalizeSex(profile?.sex || profile?.gender);
    const dayAtDate = ageInDays(profile?.dateOfBirth, date);

    // Live "did you mean" hint per field. Reads the same WHO engine the chart
    // uses, so the form and the chart can never disagree about a value.
    const typoHint = (field) => {
        const raw = parseFloat(values[field.key]);
        if (!isFinite(raw) || !sexKey || dayAtDate == null || dayAtDate > WHO_MAX_DAY) return null;
        if (raw < field.min || raw > field.max) return null; // already a hard error
        const z = zScore(field.indicator, sexKey, dayAtDate, raw);
        if (z == null || Math.abs(z) <= TYPO_Z) return null;
        return `Double-check this — ${raw} ${field.unit} is far outside what WHO records at this age.`;
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
            const saved = editing
                ? await api.updateRecord(profile.id, "growth", record.id, body)
                : await api.createRecord(profile.id, "growth", body);
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
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoider>
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {editing ? "Edit Measurement" : "Add Measurement"}
                        </Text>

                        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
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
                                const hint = typoHint(f);
                                return (
                                    <View key={f.key} style={styles.fieldBlock}>
                                        <Text style={styles.label}>
                                            {f.label} ({f.unit})
                                            {f.optional ? (
                                                <Text style={styles.optionalTag}> — optional</Text>
                                            ) : null}
                                        </Text>
                                        <TextInput
                                            style={[styles.input, errors[f.key] && styles.inputError]}
                                            keyboardType="numeric"
                                            inputMode="decimal"
                                            placeholder={f.placeholder}
                                            placeholderTextColor={colors.placeholder}
                                            value={values[f.key]}
                                            onChangeText={(v) => setValue(f.key, v)}
                                            accessibilityLabel={`${f.label} in ${f.unit}`}
                                        />
                                        {hint ? (
                                            <View style={styles.hintRow}>
                                                <Ionicons
                                                    name="help-circle-outline"
                                                    size={14}
                                                    color={colors.warning}
                                                />
                                                <Text style={styles.hintText}>{hint}</Text>
                                            </View>
                                        ) : null}
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
                                                size={15}
                                                color={on ? colors.onPrimary : colors.textSecondary}
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

                            <Text style={styles.label}>Notes — optional</Text>
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
                            <Text style={styles.placeHelper}>
                                Stays with you — notes are not included in a QR consultation.
                            </Text>
                        </ScrollView>

                        {/* Beside the buttons, outside the ScrollView: the same
                            reasoning as MedicalEventModal. This form is taller
                            than the sheet, so an error rendered at the first
                            field is a Save button that appears to do nothing.
                            The coral border says which, this says what. */}
                        {formError ? (
                            <View style={styles.errorRow}>
                                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                                <Text style={styles.errorText}>{formError}</Text>
                            </View>
                        ) : null}

                        <View style={styles.buttons}>
                            <Button
                                title={t("cancel")}
                                variant="secondary"
                                fullWidth={false}
                                disabled={saving}
                                onPress={onClose}
                            />
                            <Button
                                title={t("save")}
                                variant="accent"
                                fullWidth={false}
                                loading={saving}
                                onPress={handleSave}
                            />
                        </View>
                    </View>
                </View>
            </KeyboardAvoider>
        </Modal>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        modalBg: {
            flex: 1,
            backgroundColor: "rgba(28,25,23,0.55)",
            justifyContent: "center",
            alignItems: "center",
            padding: space.xl,
        },
        modalCard: {
            backgroundColor: colors.background,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            padding: space.xl,
            width: "100%",
            maxWidth: 440,
            maxHeight: "88%",
            borderWidth: 1,
            borderColor: colors.hairline,
            ...shadow.raised,
        },
        modalTitle: { ...type.title, color: colors.text, marginBottom: space.lg },
        scroll: { flexGrow: 0 },

        label: { ...type.label, color: colors.textSecondary, marginBottom: space.xs },
        optionalTag: { ...type.caption, color: colors.textMuted, fontWeight: "400" },
        fieldBlock: { marginBottom: space.md },
        input: {
            minHeight: 52,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            paddingHorizontal: space.lg,
            fontSize: type.body.fontSize,
            fontFamily: type.body.fontFamily,
            color: colors.text,
        },
        inputError: { borderColor: colors.danger },
        inputMultiline: { paddingVertical: space.md, minHeight: 84, textAlignVertical: "top" },

        // Amber, not coral: DESIGN.md reserves coral for overdue / error /
        // destructive, and this is a question about a typed value, not a
        // rejection of it. The save still goes through.
        hintRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: space.xs },
        hintText: { ...type.caption, color: colors.warning, flex: 1, minWidth: 0 },

        chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.xs },
        chip: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            minHeight: MIN_TOUCH,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
        },
        chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipText: { ...type.caption, fontWeight: "700", color: colors.textSecondary },
        chipTextOn: { color: colors.onPrimary },
        placeHelper: { ...type.caption, color: colors.textMuted, marginBottom: space.md },

        errorRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: space.md,
            marginBottom: space.xs,
        },
        errorText: { ...type.caption, color: colors.danger, flex: 1, minWidth: 0 },

        buttons: {
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: space.md,
            marginTop: space.md,
        },
    });
