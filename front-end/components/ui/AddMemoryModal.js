import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../utils/api";
import { memoryToApp } from "../../utils/adapters";
import { pickImage, pickerAvailable } from "../../utils/imagePicker";
import { todayLocal } from "../../utils/dates";
import { useToast } from "./Toast";
import Button from "./Button";
import KeyboardAvoider from "./KeyboardAvoider";

// Add a photo memory. Lived inline in Dashboard.js until the Gallery tab
// needed the same form — a gallery you cannot add to is the obvious gap. One
// component, two call sites, rather than a second copy that would drift.
//
// `onSaved` receives the already-adapted memory so a caller can prepend it to
// its own list without refetching.
export default function AddMemoryModal({ visible, profile, onClose, onSaved }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { t } = useLanguage();
    const toast = useToast();

    const [caption, setCaption] = useState("");
    const [notes, setNotes] = useState("");
    const [photoUri, setPhotoUri] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!caption.trim()) {
            toast.error("Please enter a caption");
            return;
        }
        setSaving(true);
        try {
            const date_recorded = todayLocal();
            const saved = photoUri
                ? await api.uploadMemory(profile.id, { photoUri, caption, notes, date_recorded })
                : await api.createRecord(profile.id, "memories", {
                      caption,
                      notes: notes || null,
                      photo_url: null,
                      date_recorded,
                  });
            if (onSaved) onSaved(memoryToApp(saved));
            toast.success("Memory saved");
            // Only clear on success — on failure the typed caption, notes and
            // chosen photo stay put instead of vanishing.
            setCaption("");
            setNotes("");
            setPhotoUri("");
            onClose();
        } catch (e) {
            toast.error(e.message || "Could not save memory");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoider>
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add Photo Memory</Text>

                        <Text style={styles.modalLabel}>Caption</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="First steps!"
                            placeholderTextColor={colors.placeholder}
                            value={caption}
                            onChangeText={setCaption}
                        />

                        <Text style={styles.modalLabel}>Notes (optional)</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={notes}
                            onChangeText={setNotes}
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
            maxWidth: 360,
            borderWidth: 1,
            borderColor: colors.hairline,
            ...shadow.raised,
        },
        modalTitle: { ...type.title, color: colors.text, marginBottom: space.lg },
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
        choosePhotoBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            minHeight: 44,
            marginBottom: space.lg,
        },
        choosePhotoText: { ...type.label, color: colors.primary },
        modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: space.md },
    });
