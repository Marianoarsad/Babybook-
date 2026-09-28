import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../utils/api";
import { useRecordSave } from "../../utils/useRecords";
import { medHistoryToIllness } from "../../utils/adapters";
import { todayLocal } from "../../utils/dates";
import { suggestedConditions } from "../../utils/commonConditions";
import { useToast } from "./Toast";
import conditionRecords from "../../utils/conditions.cjs";

import { DateField } from "./DateField";
import PhotoAttach from "./PhotoAttach";

import RecordFormSheet, { RecordFormGroup, RecordFormRow } from "./RecordFormSheet";

// One medical-history form for illnesses, allergies, hereditary conditions,
// and hospital stays.
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

const CONDITION_COPY = {
    Illness: {
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
    Allergy: {
        modalTitle: "Log an allergy",
        editTitle: "Edit allergy",
        category: "Allergy",
        attachType: "allergy",
        titleLabel: "What is the allergy or sensitivity?",
        titlePlaceholder: "Egg allergy",
        titleError: "Please name the allergy or sensitivity",
        startLabel: "When was it first noticed?",
        statusLabel: "Is it still active?",
        ongoing: "Still active",
        ended: "No longer active",
        endLabel: "When did it stop?",
        notesLabel: "Notes (optional)",
        notesPlaceholder: "Reaction, triggers, or what the doctor said",
        photoLabel: "Photo (optional)",
        photoHelper: "A reaction photo, test result, or clinic note — if you have one.",
        savedToast: "Allergy saved",
        failToast: "Could not save the allergy",
    },
    "Hereditary Condition": {
        modalTitle: "Log a hereditary condition",
        editTitle: "Edit hereditary condition",
        category: "Hereditary Condition",
        attachType: "hereditary",
        titleLabel: "What is the hereditary condition?",
        titlePlaceholder: "Asthma (paternal grandfather)",
        titleError: "Please name the hereditary condition",
        startLabel: "When was it recorded?",
        hasStatus: false,
        notesLabel: "Notes (optional)",
        notesPlaceholder: "Which relative has it, or what the doctor said",
        photoLabel: "Photo (optional)",
        photoHelper: "A family-history note or clinic document — if you have one.",
        savedToast: "Hereditary condition saved",
        failToast: "Could not save the hereditary condition",
    },
};

const COPY = {
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

const CATEGORY_OPTIONS = conditionRecords.CONDITION_CATEGORIES.map((category) => ({
    category,
    label: category === "Hereditary Condition" ? "Hereditary" : category,
}));

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
    onDelete,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { t } = useLanguage();
    const toast = useToast();
    const [category, setCategory] = useState("Illness");
    const isCondition = kind === "illness";
    const copy = isCondition ? CONDITION_COPY[category] || CONDITION_COPY.Illness : COPY.hospitalization;
    const isIllness = isCondition && category === "Illness";
    const supportsStatus = copy.hasStatus !== false;
    const editing = !!record;
    const saveRecord = useRecordSave(visible, profile.id, "medical-history", record?.legacy ? null : record?.id);

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
        setCategory(record && CONDITION_COPY[record.category] ? record.category : "Illness");
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
                resolved: supportsStatus ? over : false,
                // Clearing the flag has to clear the date with it, or a record
                // reopened after being marked better keeps a stale end date.
                resolved_date: supportsStatus && over ? endDate || todayLocal() : null,
                care_level: isIllness ? careLevel || null : null,
                facility: kind === "hospitalization" ? facility.trim() || null : null,
            };
            const saved = await saveRecord(body);
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
                    throw new Error(`Record saved, but its photo could not be saved: ${e.message}. Retry to finish without creating another record.`);
                }
            }
            if (onSaved) await onSaved(medHistoryToIllness(saved), kind, editing && !record?.legacy);
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
        <RecordFormSheet visible={visible} title={editing ? copy.editTitle : isCondition ? "Log a condition" : copy.modalTitle}
            onClose={onClose} onSubmit={handleSave} busy={saving}
            cancelLabel={t("cancel")} submitLabel={t("save")} error={titleError}
            record={record} onDelete={kind === "illness" && onDelete ? () => onDelete(record) : undefined} deleteTitle={`Delete ${copy.category.toLowerCase()} record?`} deleteMessage={`Delete "${record?.title || ""}"? This cannot be undone.`}>
            <RecordFormGroup>

                            {isCondition && (
                                <>
                                    <Text style={styles.label}>Record type</Text>
                                    <View style={styles.categoryRow}>
                                        {CATEGORY_OPTIONS.map((option) => {
                                            const selected = category === option.category;
                                            return (
                                                <TouchableOpacity
                                                    key={option.category}
                                                    style={[styles.categoryBtn, selected && styles.optionBtnOn, editing && styles.categoryBtnDisabled]}
                                                    onPress={() => {
                                                        if (editing) return;
                                                        setCategory(option.category);
                                                        setTitleError("");
                                                    }}
                                                    disabled={editing}
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected, disabled: editing }}
                                                    accessibilityLabel={`${option.label} record type`}
                                                >
                                                    <Text style={[styles.categoryText, selected && styles.optionTextOn]} numberOfLines={1}>
                                                        {option.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </>
                            )}

                            <RecordFormRow error={!!titleError} label={<Text style={styles.label}>{copy.titleLabel}</Text>}>

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
                            </RecordFormRow>

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

                            {kind === "hospitalization" && (
                                <>
                                    <RecordFormRow label={<Text style={styles.label}>Which hospital? (optional)</Text>}>

                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Cebu Doctors' University Hospital"
                                        placeholderTextColor={colors.placeholder}
                                        value={facility}
                                        onChangeText={setFacility}
                                        accessibilityLabel="Hospital name"
                                    />
                                    </RecordFormRow>
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

                            {supportsStatus && (
                            <>
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
                                </>
                            )}
                            </>
                            )}

                            <RecordFormRow stacked label={<Text style={styles.label}>{copy.notesLabel}</Text>}>

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
                            </RecordFormRow>

                            <PhotoAttach
                                required={false}
                                uri={photoUri}
                                onChangeUri={setPhotoUri}
                                label={copy.photoLabel}
                                helper={copy.photoHelper}
                            />

            </RecordFormGroup>
        </RecordFormSheet>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({

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
            backgroundColor: colors.surfaceAlt,
            borderWidth: 0,
            borderColor: colors.border,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            paddingHorizontal: space.md,
            minHeight: 52,
            paddingVertical: space.sm,
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
        inputError: { borderWidth: 1, borderColor: colors.danger },

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
        categoryRow: { flexDirection: "row", gap: space.sm, marginBottom: space.lg },
        categoryBtn: {
            flex: 1,
            minWidth: 0,
            minHeight: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: space.xs,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        categoryBtnDisabled: { opacity: 0.78 },
        categoryText: { ...type.caption, fontWeight: "600", color: colors.textSecondary },
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
        optionWide: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", justifyContent: "flex-start", paddingHorizontal: space.lg },
        optionBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
        optionText: { ...type.label, color: colors.textSecondary, flexShrink: 1 },
        optionTextOn: { color: colors.onPrimary },

    });
