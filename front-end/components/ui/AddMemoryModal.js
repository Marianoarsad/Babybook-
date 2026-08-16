import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../utils/api";
import { memoryToApp, milestoneToApp } from "../../utils/adapters";
import { pickImage, pickerAvailable } from "../../utils/imagePicker";
import { todayLocal, ageAtDate, monthsBetween } from "../../utils/dates";
import { suggestedTitles } from "../../utils/milestoneChecklist";
import { useToast } from "./Toast";
import Button from "./Button";
import { DateField } from "./DateField";
import KeyboardAvoider from "./KeyboardAvoider";

// Add one entry to the Gallery — either a photo memory or a developmental
// milestone. One form, because from the parent's side they are the same act:
// "something happened today, keep it".
//
// They stay two record types underneath, and the difference is not cosmetic:
// a milestone travels to a healthcare professional in the QR consultation
// snapshot, a photo memory never leaves the account. The form says so out
// loud, because nothing in the app ever did — which is exactly why the two
// felt like duplicates.
//
// Before this, the milestone half was unreachable: the only way to record one
// was ticking a box on a fixed six-item checklist, all under nine months, in
// an app built for 0-6 years. "First steps" had nowhere to go but here, filed
// as a memory the doctor would never see.
//
// `onSaved(record, kind)` receives the already-adapted record so the caller
// prepends to the right list without refetching.
export default function AddMemoryModal({ visible, profile, milestones = [], onClose, onSaved }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { t } = useLanguage();
    const toast = useToast();

    const [kind, setKind] = useState("memory"); // "memory" | "milestone"
    const [caption, setCaption] = useState("");
    const [title, setTitle] = useState("");
    const [notes, setNotes] = useState("");
    const [date, setDate] = useState(todayLocal());
    const [photoUri, setPhotoUri] = useState("");
    const [saving, setSaving] = useState(false);

    const isMilestone = kind === "milestone";

    // Checklist items this child has not recorded yet, drawn from their own
    // age band. Tapping one fills the exact title the Development Checklist
    // matches on, which is what makes the box tick — free text that matches
    // nothing is still a valid milestone, it just isn't on the list.
    //
    // The age argument is not optional in spirit: the checklist holds ~146
    // items spanning 2 months to 5 years, so an age-blind list would offer
    // "Holds head up when on tummy" to the parent of a four-year-old.
    const chips = useMemo(
        () =>
            isMilestone
                ? suggestedTitles(milestones, monthsBetween(profile.dateOfBirth, todayLocal()))
                : [],
        [isMilestone, milestones, profile.dateOfBirth],
    );

    const reset = () => {
        setCaption("");
        setTitle("");
        setNotes("");
        setPhotoUri("");
        setDate(todayLocal());
        // `kind` deliberately survives — a parent adding two milestones in a
        // row should not have to re-pick the type each time.
    };

    const handleSave = async () => {
        const name = (isMilestone ? title : caption).trim();
        if (!name) {
            toast.error(isMilestone ? "Please enter a milestone" : "Please enter a caption");
            return;
        }
        setSaving(true);
        try {
            if (isMilestone) {
                const fields = {
                    title: name,
                    description: notes.trim() || null,
                    date_recorded: date || todayLocal(),
                    is_completed: true,
                    // Derived, never typed. This is the field the QR snapshot
                    // ships to the healthcare professional, and it was blank
                    // for every record the app itself created.
                    age_achieved: ageAtDate(profile.dateOfBirth, date || todayLocal()) || null,
                };
                const saved = photoUri
                    ? await api.createMilestoneWithPhoto(profile.id, fields, photoUri)
                    : await api.createRecord(profile.id, "milestones", { ...fields, photo_url: null });
                if (onSaved) onSaved(milestoneToApp(saved), "milestone");
                toast.success("Milestone saved");
            } else {
                const date_recorded = date || todayLocal();
                const saved = photoUri
                    ? await api.uploadMemory(profile.id, { photoUri, caption: name, notes, date_recorded })
                    : await api.createRecord(profile.id, "memories", {
                          caption: name,
                          notes: notes || null,
                          photo_url: null,
                          date_recorded,
                      });
                if (onSaved) onSaved(memoryToApp(saved), "memory");
                toast.success("Memory saved");
            }
            // Only clear on success — on failure everything typed stays put
            // instead of vanishing.
            reset();
            onClose();
        } catch (e) {
            toast.error(e.message || (isMilestone ? "Could not save milestone" : "Could not save memory"));
        } finally {
            setSaving(false);
        }
    };

    const KINDS = [
        { key: "memory", label: "Photo", icon: "image-outline" },
        { key: "milestone", label: "Milestone", icon: "trophy-outline" },
    ];

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoider>
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add to Gallery</Text>

                        {/* Which kind of entry — the only choice that changes
                            where this record goes. */}
                        <View style={styles.segment}>
                            {KINDS.map((k) => {
                                const on = kind === k.key;
                                return (
                                    <TouchableOpacity
                                        key={k.key}
                                        style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                                        onPress={() => setKind(k.key)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: on }}
                                        accessibilityLabel={`Add a ${k.label.toLowerCase()}`}
                                    >
                                        <Ionicons
                                            name={k.icon}
                                            size={16}
                                            color={on ? colors.onPrimary : colors.textSecondary}
                                        />
                                        <Text
                                            style={[styles.segmentText, on && styles.segmentTextOn]}
                                        >
                                            {k.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <ScrollView
                            style={styles.scroll}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {isMilestone ? (
                                <>
                                    <Text style={styles.modalLabel}>Milestone</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="First steps"
                                        placeholderTextColor={colors.placeholder}
                                        value={title}
                                        onChangeText={setTitle}
                                    />

                                    {chips.length > 0 && (
                                        <>
                                            <Text style={styles.chipsLabel}>
                                                From the Development Checklist
                                            </Text>
                                            <View style={styles.chips}>
                                                {chips.map((c) => (
                                                    <TouchableOpacity
                                                        key={c}
                                                        style={styles.chip}
                                                        onPress={() => setTitle(c)}
                                                        accessibilityRole="button"
                                                    >
                                                        <Text style={styles.chipText}>{c}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Text style={styles.modalLabel}>Caption</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="First steps!"
                                        placeholderTextColor={colors.placeholder}
                                        value={caption}
                                        onChangeText={setCaption}
                                    />
                                </>
                            )}

                            <Text style={styles.modalLabel}>
                                {isMilestone ? "What happened (optional)" : "Notes (optional)"}
                            </Text>
                            <TextInput
                                style={styles.modalInput}
                                value={notes}
                                onChangeText={setNotes}
                            />

                            {/* A milestone is usually logged after the fact, and
                                its date is what the stored age is derived from. */}
                            <DateField
                                label={isMilestone ? "Date it happened" : "Date"}
                                value={date}
                                onChange={setDate}
                                maximumDate={todayLocal()}
                            />

                            {pickerAvailable() && (
                                <TouchableOpacity
                                    style={styles.choosePhotoBtn}
                                    onPress={async () => {
                                        const uri = await pickImage();
                                        if (uri) setPhotoUri(uri);
                                    }}
                                >
                                    <Ionicons name="image-outline" size={16} color={colors.primary} />
                                    <Text style={styles.choosePhotoText}>
                                        {photoUri
                                            ? "Photo selected ✓ (tap to change)"
                                            : "Choose Photo from Device"}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* The distinction the app never showed. Stated as
                                fact — no nudge either way (PRODUCT.md P5). */}
                            {isMilestone && (
                                <View style={styles.noteBox}>
                                    <Ionicons
                                        name="information-circle-outline"
                                        size={15}
                                        color={colors.info}
                                    />
                                    <Text style={styles.noteText}>
                                        Milestones are included when you share records with a
                                        healthcare professional. Photos are not.
                                    </Text>
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.modalButtons}>
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

        segment: {
            flexDirection: "row",
            gap: space.sm,
            marginBottom: space.lg,
        },
        segmentBtn: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.xs,
            minHeight: 44,
            paddingHorizontal: space.sm,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        segmentBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
        segmentText: { ...type.label, color: colors.textSecondary },
        segmentTextOn: { color: colors.onPrimary },

        modalLabel: { ...type.subheading, color: colors.textMuted, marginBottom: space.sm },
        modalInput: {
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

        chipsLabel: { ...type.caption, color: colors.textMuted, marginBottom: space.sm },
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

        choosePhotoBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            minHeight: 44,
            marginBottom: space.lg,
        },
        choosePhotoText: { ...type.label, color: colors.primary },

        noteBox: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: space.sm,
            padding: space.md,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.infoBg,
            marginBottom: space.md,
        },
        noteText: { ...type.caption, color: colors.text, flex: 1 },

        modalButtons: {
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: space.md,
            marginTop: space.lg,
        },
    });
