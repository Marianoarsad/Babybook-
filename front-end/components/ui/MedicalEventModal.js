import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../utils/api";
import { medHistoryToIllness } from "../../utils/adapters";
import { todayLocal } from "../../utils/dates";
import { suggestedConditions } from "../../utils/commonConditions";
import { useToast } from "./Toast";
import Button from "./Button";
import { DateField } from "./DateField";
import PhotoAttach from "./PhotoAttach";
import KeyboardAvoider from "./KeyboardAvoider";

// One form for the two things that go wrong: an illness, and a hospital stay.
//
// They are the same row underneath (medical_history, differing only by
// `category`), they had the same three bugs, and keeping one implementation is
// what guarantees they stay fixed together.
//
// What was here before was two boxes and a mandatory photo:
//
//   Add Clinical Record          <- not what the form adds
//     Condition / Illness Title
//     Doctor Remarks & Advice    <- most illnesses never involve a doctor
//     Supporting Photo *         <- hard-blocked save
//
// with the date silently forced to today and `resolved` written FALSE by a
// client that had no way to ever write TRUE. So a cold logged in March still
// said "not yet resolved" in August — on the Dashboard's Needs Attention card,
// on the sibling alert dot, and at the top of the healthcare professional's QR
// view, which ranks a "current" hospital stay above everything else in the app.
//
// `record` absent means create; present means edit. Edit is the whole point:
// it is what finally makes "this is over now" something a parent can say.
// `onSaved(adapted, kind)` hands back the adapted row so the caller updates its
// list without refetching.

const COPY = {
    illness: {
        modalTitle: "Log an illness",
        editTitle: "Edit illness",
        category: "Illness",
        attachType: "illness",
        titleLabel: "What was it?",
        titlePlaceholder: "Fever",
        titleError: "Please say what it was",
        startLabel: "When did it start?",
        statusLabel: "Is it over?",
        ongoing: "Still ongoing",
        ended: "Better now",
        endLabel: "When did they get better?",
        notesLabel: "Notes (optional)",
        notesPlaceholder: "Symptoms, what the doctor said, medicine given",
        photoLabel: "Photo (optional)",
        photoHelper: "A clinic slip, a prescription, or the rash itself — if you have one.",
        savedToast: "Illness saved",
        failToast: "Could not save the illness",
    },
    hospitalization: {
        modalTitle: "Log a hospital stay",
        editTitle: "Edit hospital stay",
        category: "Hospitalization",
        attachType: "hospitalization",
        titleLabel: "Why was your child admitted?",
        titlePlaceholder: "Dengue",
        titleError: "Please say why they were admitted",
        startLabel: "Admitted on",
        statusLabel: "Have they been discharged?",
        ongoing: "Still admitted",
        ended: "Discharged",
        endLabel: "Discharged on",
        notesLabel: "Notes (optional)",
        notesPlaceholder: "What was done, what to watch for at home",
        photoLabel: "Photo (optional)",
        photoHelper: "Discharge papers or a hospital receipt — if you have one.",
        savedToast: "Hospital stay saved",
        failToast: "Could not save the hospital stay",
    },
};

// Where the child was cared for. A record of what the family DID, never a
// severity rating — PRODUCT.md Principle 5. "At home" is not "mild", and the
// app must never start treating it as one.
const CARE_LEVELS = [
    { key: "home", label: "At home", icon: "home-outline" },
    { key: "doctor", label: "Saw a doctor", icon: "medkit-outline" },
    { key: "hospital", label: "Admitted to hospital", icon: "bed-outline" },
];

export default function MedicalEventModal({
    visible,
    kind = "illness",
    profile,
    record = null,
    previous = [],
    onClose,
    onSaved,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { t } = useLanguage();
    const toast = useToast();
    const copy = COPY[kind] || COPY.illness;
    const isIllness = kind === "illness";
    const editing = !!record;

    const [title, setTitle] = useState("");
    const [facility, setFacility] = useState("");
    const [startDate, setStartDate] = useState(todayLocal());
    const [over, setOver] = useState(false);
    const [endDate, setEndDate] = useState("");
    const [careLevel, setCareLevel] = useState("");
    const [notes, setNotes] = useState("");
    const [photoUri, setPhotoUri] = useState("");
    const [titleError, setTitleError] = useState("");
    const [saving, setSaving] = useState(false);

    // Load the record being edited, or start clean. Keyed on the id rather
    // than the object so a parent re-render mid-typing does not wipe the form.
    useEffect(() => {
        if (!visible) return;
        setTitle(record ? record.title || "" : "");
        setFacility(record ? record.facility || "" : "");
        setStartDate(record && record.date ? record.date : todayLocal());
        setOver(record ? !!record.resolved : false);
        setEndDate(record ? record.resolvedDate || "" : "");
        setCareLevel(record ? record.careLevel || "" : "");
        setNotes(record ? record.desc || "" : "");
        setPhotoUri("");
        setTitleError("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, record && record.id]);

    // What this child has had before, then common ones. Deliberately the
    // opposite of the milestone chips, which offer only what has NOT been
    // recorded: a milestone happens once, an illness comes back.
    const chips = useMemo(
        () => (isIllness ? suggestedConditions(previous, 8) : []),
        [isIllness, previous],
    );

    const handleSave = async () => {
        const name = title.trim();
        if (!name) {
            // Inline, beside the field that is wrong — DESIGN.md reserves
            // toasts for things that happened, not for things you must fix.
            setTitleError(copy.titleError);
            return; // the effect below scrolls the error into view

        }
        setSaving(true);
        try {
            const body = {
                category: copy.category,
                title: name,
                description: notes.trim() || null,
                date_recorded: startDate || todayLocal(),
                resolved: over,
                // Clearing the flag has to clear the date with it, or a record
                // reopened after being marked better keeps a stale end date.
                resolved_date: over ? endDate || todayLocal() : null,
                care_level: isIllness ? careLevel || null : null,
                facility: isIllness ? null : facility.trim() || null,
            };
            const saved = editing
                ? await api.updateRecord(profile.id, "medical-history", record.id, body)
                : await api.createRecord(profile.id, "medical-history", body);
            // Optional now. A fever managed at home has no document to
            // photograph, and requiring one made the commonest illness in the
            // app unloggable. Posting replaces any existing image for the
            // record, so this is also how an edit swaps the photo.
            if (photoUri) {
                try {
                    await api.uploadAttachment(profile.id, {
                        recordType: copy.attachType,
                        recordId: saved.id,
                        photoUri,
                    });
                } catch (e) {
                    console.log("upload attachment:", e.message);
                }
            }
            if (onSaved) onSaved(medHistoryToIllness(saved), kind, editing);
            toast.success(copy.savedToast);
            onClose();
        } catch (e) {
            // Everything typed stays put on failure.
            toast.error(e.message || copy.failToast);
        } finally {
            setSaving(false);
        }
    };

    const STATUS = [
        { key: false, label: copy.ongoing, icon: "ellipse-outline" },
        { key: true, label: copy.ended, icon: "checkmark-circle-outline" },
    ];

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoider>
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {editing ? copy.editTitle : copy.modalTitle}
                        </Text>

                        <ScrollView
                            style={styles.scroll}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={styles.label}>{copy.titleLabel}</Text>
                            <TextInput
                                style={[styles.input, titleError && styles.inputError]}
                                placeholder={copy.titlePlaceholder}
                                placeholderTextColor={colors.placeholder}
                                value={title}
                                onChangeText={(v) => {
                                    setTitle(v);
                                    if (titleError) setTitleError("");
                                }}
                                accessibilityLabel={copy.titleLabel}
                            />

                            {chips.length > 0 && (
                                <View style={styles.chips}>
                                    {chips.map((c) => (
                                        <TouchableOpacity
                                            key={c}
                                            style={styles.chip}
                                            onPress={() => {
                                                setTitle(c);
                                                setTitleError("");
                                            }}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Use ${c}`}
                                        >
                                            <Text style={styles.chipText}>{c}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {!isIllness && (
                                <>
                                    <Text style={styles.label}>Which hospital? (optional)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Cebu Doctors' University Hospital"
                                        placeholderTextColor={colors.placeholder}
                                        value={facility}
                                        onChangeText={setFacility}
                                        accessibilityLabel="Hospital name"
                                    />
                                </>
                            )}

                            {/* Editable, not assumed. Forced to today before,
                                so a parent logging Tuesday's fever on Friday
                                filed it as Friday. */}
                            <DateField
                                label={copy.startLabel}
                                value={startDate}
                                onChange={setStartDate}
                                maximumDate={todayLocal()}
                            />

                            <Text style={styles.label}>{copy.statusLabel}</Text>
                            <View style={styles.row}>
                                {STATUS.map((s) => {
                                    const on = over === s.key;
                                    return (
                                        <TouchableOpacity
                                            key={String(s.key)}
                                            style={[styles.optionBtn, on && styles.optionBtnOn]}
                                            onPress={() => setOver(s.key)}
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
                                                style={[
                                                    styles.optionText,
                                                    on && styles.optionTextOn,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {s.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* The end date cannot precede the start, and
                                cannot be in the future. Both are enforced by
                                the picker rather than caught after the fact. */}
                            {over && (
                                <DateField
                                    label={copy.endLabel}
                                    value={endDate}
                                    onChange={setEndDate}
                                    minimumDate={startDate || undefined}
                                    maximumDate={todayLocal()}
                                    placeholder="Pick a date"
                                />
                            )}

                            {isIllness && (
                                <>
                                    <Text style={styles.label}>How was it treated?</Text>
                                    <View style={styles.stack}>
                                        {CARE_LEVELS.map((c) => {
                                            const on = careLevel === c.key;
                                            return (
                                                <TouchableOpacity
                                                    key={c.key}
                                                    style={[
                                                        styles.optionBtn,
                                                        styles.optionWide,
                                                        on && styles.optionBtnOn,
                                                    ]}
                                                    // Tapping the chosen one
                                                    // again clears it: this is
                                                    // optional, and there must
                                                    // be a way back to "not
                                                    // recorded".
                                                    onPress={() => setCareLevel(on ? "" : c.key)}
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: on }}
                                                    accessibilityLabel={c.label}
                                                >
                                                    <Ionicons
                                                        name={c.icon}
                                                        size={15}
                                                        color={
                                                            on
                                                                ? colors.onPrimary
                                                                : colors.textSecondary
                                                        }
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.optionText,
                                                            on && styles.optionTextOn,
                                                        ]}
                                                    >
                                                        {c.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* Names the other record rather than
                                        creating it, so the two do not silently
                                        duplicate. No advice, no warning. */}
                                    {careLevel === "hospital" && (
                                        <View style={styles.noteBox}>
                                            <Ionicons
                                                name="information-circle-outline"
                                                size={15}
                                                color={colors.info}
                                            />
                                            <Text style={styles.noteText}>
                                                You can also record the stay itself under
                                                Hospitalizations, on the Checkups tab.
                                            </Text>
                                        </View>
                                    )}
                                </>
                            )}

                            <Text style={styles.label}>{copy.notesLabel}</Text>
                            <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                placeholder={copy.notesPlaceholder}
                                placeholderTextColor={colors.placeholder}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                accessibilityLabel={copy.notesLabel}
                            />

                            <PhotoAttach
                                required={false}
                                uri={photoUri}
                                onChangeUri={setPhotoUri}
                                label={copy.photoLabel}
                                helper={copy.photoHelper}
                            />
                        </ScrollView>

                        {/* The message sits with the buttons, outside the
                            ScrollView, because that is the only part of this
                            form guaranteed to be on screen. The form is long
                            enough that a parent filling in the notes box is
                            nowhere near the first field, and an error rendered
                            up there is a Save button that appears to do
                            nothing. The coral border on the field says WHICH,
                            this says WHAT. */}
                        {titleError ? (
                            <View style={styles.errorRow}>
                                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                                <Text style={styles.errorText}>{titleError}</Text>
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
            maxWidth: 360,
            maxHeight: "88%",
            borderWidth: 1,
            borderColor: colors.hairline,
            ...shadow.raised,
        },
        modalTitle: { ...type.title, color: colors.text, marginBottom: space.lg },
        scroll: { flexGrow: 0 },

        // Matches DateField's own label rather than the uppercase
        // `type.subheading` the older modals use: this form contains two
        // DateFields, and "WHAT WAS IT?" sitting above "When did it start?"
        // reads as two different designers. Sentence case is also what
        // DESIGN.md's Inputs spec describes (14px/700, secondary ink) and it
        // is plainer for a non-technical parent.
        label: {
            ...type.label,
            fontWeight: "700",
            color: colors.textSecondary,
            marginBottom: space.sm,
        },
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
        inputMultiline: {
            height: 84,
            paddingTop: space.md,
            paddingBottom: space.md,
        },
        inputError: { borderColor: colors.danger },
        errorRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            marginTop: space.md,
        },
        errorText: { ...type.caption, color: colors.danger, flex: 1 },

        chips: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: space.sm,
            marginBottom: space.lg,
            marginTop: -space.sm,
        },
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

        row: { flexDirection: "row", gap: space.sm, marginBottom: space.lg },
        stack: { gap: space.sm, marginBottom: space.lg },
        optionBtn: {
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
        // Stacked rows read left-aligned; the two-up row stays centred.
        optionWide: { flex: 0, justifyContent: "flex-start", paddingHorizontal: space.lg },
        optionBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
        optionText: { ...type.label, color: colors.textSecondary, flexShrink: 1 },
        optionTextOn: { color: colors.onPrimary },

        noteBox: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: space.sm,
            padding: space.md,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.infoBg,
            marginBottom: space.lg,
            marginTop: -space.sm,
        },
        noteText: { ...type.caption, color: colors.text, flex: 1 },

        buttons: {
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: space.md,
            marginTop: space.lg,
        },
    });
