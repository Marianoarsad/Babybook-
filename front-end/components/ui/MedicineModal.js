import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../utils/api";
import { medHistoryToMed } from "../../utils/adapters";
import { todayLocal } from "../../utils/dates";
import { defaultDoseTimes, doseTimesOf } from "../../utils/medication";
import { useToast } from "./Toast";
import Button from "./Button";
import { DateField, TimeField } from "./DateField";
import OptionSheet from "./OptionSheet";
import PhotoAttach from "./PhotoAttach";
import KeyboardAvoider from "./KeyboardAvoider";

// Add or edit a medicine course.
//
// What this replaced was a name box, a free-text "Dosage guidelines" box, and a
// compulsory photo — with the start date silently forced to today. There was no
// amount, no frequency, no course length, no way to say the course had
// finished, and nowhere to record a dose actually being given, while the tab
// itself was titled "Medication Reminders" and the app had never sent one.
//
// THE LINE THIS FORM MUST NOT CROSS. PRODUCT.md Principle 5: the app organizes
// and presents, it never interprets or advises. Concretely, and permanently:
//
//   • No drug list. The name suggestions below are drawn ONLY from medicines
//     already on this child's own record. A built-in list of paediatric drug
//     names would read as the app proposing a medicine, which is a different
//     act entirely from `commonConditions.js` naming things that happen TO a
//     child. Do not add one.
//   • No suggested dose, no strength, no mg-per-kg, no unit conversion, no
//     interaction or allergy cross-check, no maximum.
//   • The dose times are pre-filled by spreading N slots across a waking day
//     and are labelled as when the PARENT will give it. That is arithmetic and
//     a convenience. Never reword it into a recommendation.
//
// `record` absent means add, present means edit. `onSaved(adapted, wasEdit)`
// hands back the adapted row so the caller updates its list without refetching.

const OTHER = "__other__";

export default function MedicineModal({
    visible,
    profile,
    record = null,
    previousNames = [],
    conditions = [],
    onClose,
    onSaved,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { t } = useLanguage();
    const toast = useToast();
    const editing = !!record;

    const [name, setName] = useState("");
    const [treatsId, setTreatsId] = useState("");
    const [treatsOpen, setTreatsOpen] = useState(false);
    const [doseAmount, setDoseAmount] = useState("");
    const [frequency, setFrequency] = useState(2);
    const [freqOther, setFreqOther] = useState("");
    const [times, setTimes] = useState(defaultDoseTimes(2));
    const [startDate, setStartDate] = useState(todayLocal());
    const [courseDays, setCourseDays] = useState("");
    const [finished, setFinished] = useState(false);
    const [endDate, setEndDate] = useState("");
    const [prescribedBy, setPrescribedBy] = useState("");
    const [instructions, setInstructions] = useState("");
    const [photoUri, setPhotoUri] = useState("");
    const [nameError, setNameError] = useState("");
    const [saving, setSaving] = useState(false);

    // Load the record being edited, or start clean. Keyed on the id rather than
    // the object so a parent re-render mid-typing does not wipe the form.
    useEffect(() => {
        if (!visible) return;
        const freq = record && record.frequencyPerDay ? record.frequencyPerDay : 2;
        setName(record ? record.title || "" : "");
        setTreatsId(record ? record.treatsId || "" : "");
        setDoseAmount(record ? record.doseAmount || "" : "");
        setFrequency(freq);
        setFreqOther(freq > 4 ? String(freq) : "");
        setTimes(record ? doseTimesOf(record) : defaultDoseTimes(2));
        setStartDate(record && record.date ? record.date : todayLocal());
        setCourseDays(record && record.courseDays ? String(record.courseDays) : "");
        setFinished(record ? !!record.resolved : false);
        setEndDate(record ? record.resolvedDate || "" : "");
        setPrescribedBy(record ? record.prescribedBy || "" : "");
        setInstructions(record ? record.instructions || "" : "");
        setPhotoUri("");
        setNameError("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, record && record.id]);

    // Changing how many times a day re-spreads the times, but only by adding or
    // trimming slots — a time the parent has already adjusted is left alone.
    const applyFrequency = (n) => {
        setFrequency(n);
        setTimes((prev) => {
            const spread = defaultDoseTimes(n);
            return spread.map((fallback, i) => prev[i] || fallback);
        });
    };

    const treatsLabel = useMemo(() => {
        const hit = conditions.find((c) => String(c.id) === String(treatsId));
        return hit ? hit.title : "";
    }, [conditions, treatsId]);

    const handleSave = async () => {
        const title = name.trim();
        if (!title) {
            setNameError("Please enter the medicine's name");
            return;
        }
        setSaving(true);
        try {
            const body = {
                category: "Medication",
                title,
                // The parent's own words about how to take it, not a dosage.
                description: instructions.trim() || null,
                date_recorded: startDate || todayLocal(),
                resolved: finished,
                // Clearing the flag clears the date with it, or a course
                // reopened after being marked done keeps a stale end date.
                resolved_date: finished ? endDate || todayLocal() : null,
                dose_amount: doseAmount.trim() || null,
                frequency_per_day: frequency || null,
                dose_times: times.slice(0, frequency),
                course_days: courseDays.trim() ? Number(courseDays.trim()) : null,
                prescribed_by: prescribedBy.trim() || null,
                treats_id: treatsId ? Number(treatsId) : null,
            };
            const saved = editing
                ? await api.updateRecord(profile.id, "medical-history", record.id, body)
                : await api.createRecord(profile.id, "medical-history", body);
            // Optional now: a parent giving paracetamol at home has no
            // prescription to photograph, and requiring one made the commonest
            // medicine in the app unloggable. Posting replaces any existing
            // image for the record, so this is also how an edit swaps it.
            if (photoUri) {
                try {
                    await api.uploadAttachment(profile.id, {
                        recordType: "medication",
                        recordId: saved.id,
                        photoUri,
                    });
                } catch (e) {
                    console.log("upload attachment:", e.message);
                }
            }
            if (onSaved) onSaved(medHistoryToMed(saved), editing);
            toast.success(editing ? "Medicine updated" : "Medicine saved");
            onClose();
        } catch (e) {
            // Everything typed stays put on failure.
            toast.error(e.message || "Could not save the medicine");
        } finally {
            setSaving(false);
        }
    };

    const FREQ = [1, 2, 3, 4];
    const STATUS = [
        { key: false, label: "Still taking", icon: "ellipse-outline" },
        { key: true, label: "Finished", icon: "checkmark-circle-outline" },
    ];

    return (
        <>
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoider>
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {editing ? "Edit medicine" : "Add a medicine"}
                        </Text>

                        <ScrollView
                            style={styles.scroll}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={styles.label}>What is the medicine called?</Text>
                            <TextInput
                                style={[styles.input, nameError && styles.inputError]}
                                placeholder="Write it as it appears on the label"
                                placeholderTextColor={colors.placeholder}
                                value={name}
                                onChangeText={(v) => {
                                    setName(v);
                                    if (nameError) setNameError("");
                                }}
                                accessibilityLabel="Medicine name"
                            />

                            {/* ONLY medicines this child has already been given.
                                Never a built-in drug list — see the header. */}
                            {previousNames.length > 0 && (
                                <>
                                    <Text style={styles.hint}>Given before</Text>
                                    <View style={styles.chips}>
                                        {previousNames.slice(0, 6).map((c) => (
                                            <TouchableOpacity
                                                key={c}
                                                style={styles.chip}
                                                onPress={() => {
                                                    setName(c);
                                                    setNameError("");
                                                }}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Use ${c}`}
                                            >
                                                <Text style={styles.chipText}>{c}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            {conditions.length > 0 && (
                                <>
                                    <Text style={styles.label}>What is it for? (optional)</Text>
                                    <TouchableOpacity
                                        style={styles.picker}
                                        onPress={() => setTreatsOpen(true)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Choose what this medicine is for"
                                    >
                                        <Text
                                            style={[styles.pickerText, !treatsLabel && styles.pickerEmpty]}
                                            numberOfLines={1}
                                        >
                                            {treatsLabel || "Choose from what you've recorded"}
                                        </Text>
                                        <Ionicons
                                            name="chevron-down"
                                            size={16}
                                            color={colors.textMuted}
                                        />
                                    </TouchableOpacity>
                                </>
                            )}

                            <Text style={styles.label}>How much each time?</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="5 mL"
                                placeholderTextColor={colors.placeholder}
                                value={doseAmount}
                                onChangeText={setDoseAmount}
                                accessibilityLabel="Amount per dose"
                            />
                            {/* Says where the number comes from without ever
                                supplying one. PRODUCT.md Principle 5. */}
                            <Text style={styles.hintTight}>
                                Copy this from the label or from what the doctor told you.
                            </Text>

                            <Text style={styles.label}>How many times a day?</Text>
                            <View style={[styles.row, styles.rowWrap]}>
                                {FREQ.map((n) => {
                                    const on = frequency === n && !freqOther;
                                    return (
                                        <TouchableOpacity
                                            key={n}
                                            style={[styles.freqChip, on && styles.optionOn]}
                                            onPress={() => {
                                                setFreqOther("");
                                                applyFrequency(n);
                                            }}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: on }}
                                            accessibilityLabel={`${n} times a day`}
                                        >
                                            <Text style={[styles.optionText, on && styles.optionTextOn]}>
                                                {n}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                                <TextInput
                                    style={[styles.freqInput, freqOther && styles.freqInputOn]}
                                    placeholder="Other"
                                    placeholderTextColor={colors.placeholder}
                                    value={freqOther}
                                    keyboardType="number-pad"
                                    onChangeText={(v) => {
                                        const digits = v.replace(/[^0-9]/g, "").slice(0, 2);
                                        setFreqOther(digits);
                                        const n = Number(digits);
                                        if (n >= 1 && n <= 12) applyFrequency(n);
                                    }}
                                    accessibilityLabel="Other number of times a day"
                                />
                            </View>

                            <Text style={styles.label}>When will you give it?</Text>
                            <Text style={styles.hintTight}>
                                Starting times you can change. Your phone will remind you at these
                                times.
                            </Text>
                            {times.slice(0, frequency).map((tval, i) => (
                                <TimeField
                                    key={i}
                                    label={`Dose ${i + 1}`}
                                    value={tval}
                                    onChange={(v) =>
                                        setTimes((prev) => prev.map((x, j) => (j === i ? v : x)))
                                    }
                                />
                            ))}

                            {/* Editable, not assumed. Forced to today before, so
                                a course started on Monday and logged on Thursday
                                was filed as Thursday. */}
                            <DateField
                                label="Started on"
                                value={startDate}
                                onChange={setStartDate}
                                maximumDate={todayLocal()}
                            />

                            <Text style={styles.label}>For how many days?</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Leave blank if there's no set number"
                                placeholderTextColor={colors.placeholder}
                                value={courseDays}
                                keyboardType="number-pad"
                                onChangeText={(v) => setCourseDays(v.replace(/[^0-9]/g, "").slice(0, 3))}
                                accessibilityLabel="Number of days"
                            />

                            <Text style={styles.label}>Is the course done?</Text>
                            <View style={styles.row}>
                                {STATUS.map((s) => {
                                    const on = finished === s.key;
                                    return (
                                        <TouchableOpacity
                                            key={String(s.key)}
                                            style={[styles.option, on && styles.optionOn]}
                                            onPress={() => setFinished(s.key)}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: on }}
                                            accessibilityLabel={s.label}
                                        >
                                            <Ionicons
                                                name={s.icon}
                                                size={15}
                                                color={on ? colors.onPrimary : colors.textSecondary}
                                            />
                                            <Text
                                                style={[styles.optionText, on && styles.optionTextOn]}
                                                numberOfLines={1}
                                            >
                                                {s.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {finished && (
                                <DateField
                                    label="Finished on"
                                    value={endDate}
                                    onChange={setEndDate}
                                    minimumDate={startDate || undefined}
                                    maximumDate={todayLocal()}
                                    placeholder="Pick a date"
                                />
                            )}

                            <Text style={styles.label}>Who prescribed it? (optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Leave blank if you bought it yourself"
                                placeholderTextColor={colors.placeholder}
                                value={prescribedBy}
                                onChangeText={setPrescribedBy}
                                accessibilityLabel="Prescribed by"
                            />

                            <Text style={styles.label}>Instructions (optional)</Text>
                            <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                placeholder="Anything you were told — with food, finish the whole course"
                                placeholderTextColor={colors.placeholder}
                                value={instructions}
                                onChangeText={setInstructions}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                accessibilityLabel="Instructions"
                            />

                            <PhotoAttach
                                required={false}
                                uri={photoUri}
                                onChangeUri={setPhotoUri}
                                label="Photo (optional)"
                                helper="The prescription or the bottle label — if you have one."
                            />
                        </ScrollView>

                        {/* Beside the buttons, outside the ScrollView, because
                            that is the only part of a form this long guaranteed
                            to be on screen. The coral field border says which,
                            this says what. */}
                        {nameError ? (
                            <View style={styles.errorRow}>
                                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                                <Text style={styles.errorText}>{nameError}</Text>
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

            {/* A sibling of the form's Modal rather than a child of it: two
                stacked native Modals fight over which is on top, and Health.js
                already renders its vaccine picker this way. */}
            <OptionSheet
                visible={treatsOpen}
                title="What is this medicine for?"
                options={[
                    { key: OTHER, label: "Not linked to anything", note: "Leave it unlinked" },
                    ...conditions.map((c) => ({
                        key: String(c.id),
                        label: c.title,
                        note: c.resolved ? "Better" : "Ongoing",
                    })),
                ]}
                selectedKey={treatsId || OTHER}
                onSelect={(key) => {
                    setTreatsId(key === OTHER ? "" : key);
                    setTreatsOpen(false);
                }}
                onClose={() => setTreatsOpen(false)}
            />
        </>
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
            // 440, not 360 — the sheet was narrower than every reference
            // phone width (390, 430), wasting room the fields needed.
            maxWidth: 440,
            maxHeight: "88%",
            borderWidth: 1,
            borderColor: colors.hairline,
            ...shadow.raised,
        },
        modalTitle: { ...type.title, color: colors.text, marginBottom: space.lg },
        scroll: { flexGrow: 0 },

        // Sentence case, matching DateField's own label — this form holds
        // several of them, and mixing cases reads as two different designers.
        label: {
            ...type.label,
            fontWeight: "700",
            color: colors.textSecondary,
            marginBottom: space.sm,
        },
        hint: { ...type.caption, color: colors.textMuted, marginBottom: space.sm },
        hintTight: { ...type.caption, color: colors.textMuted, marginTop: -space.md, marginBottom: space.lg },

        input: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: space.md,
            height: 48,
            fontSize: type.body.fontSize,
            fontFamily: type.body.fontFamily,
            color: colors.text,
            marginBottom: space.lg,
        },
        inputMultiline: { height: 84, paddingTop: space.md, paddingBottom: space.md },
        inputError: { borderColor: colors.danger },

        chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.lg },
        chip: {
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            minHeight: 36,
            justifyContent: "center",
            borderRadius: radius.pill,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceAlt,
        },
        chipText: { ...type.caption, color: colors.textSecondary },

        picker: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: space.md,
            height: 48,
            marginBottom: space.lg,
        },
        pickerText: { ...type.body, color: colors.text, flex: 1 },
        pickerEmpty: { color: colors.placeholder },

        row: { flexDirection: "row", gap: space.sm, marginBottom: space.lg, alignItems: "center" },
        // Wraps, because four 44px targets plus a text field do not fit across
        // a phone-width modal — the "Other" box was being clipped to a single
        // letter. Wrapping to a second line is better than shrinking a touch
        // target below the 44px floor.
        rowWrap: { flexWrap: "wrap" },
        option: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.xs,
            minHeight: MIN_TOUCH,
            paddingHorizontal: space.sm,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        freqChip: {
            width: MIN_TOUCH,
            height: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        freqInput: {
            width: 96,
            height: MIN_TOUCH,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: space.sm,
            textAlign: "center",
            fontSize: type.body.fontSize,
            fontFamily: type.body.fontFamily,
            color: colors.text,
        },
        freqInputOn: { borderColor: colors.primary },
        optionOn: { backgroundColor: colors.primary, borderColor: colors.primary },
        optionText: { ...type.label, color: colors.textSecondary, flexShrink: 1 },
        optionTextOn: { color: colors.onPrimary },

        errorRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
        errorText: { ...type.caption, color: colors.danger, flex: 1 },

        buttons: {
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: space.md,
            marginTop: space.lg,
        },
    });
