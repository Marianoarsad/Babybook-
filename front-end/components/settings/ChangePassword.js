import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { api } from "../../utils/api";
import { useToast } from "../ui/Toast";
import { useTheme } from "../../context/ThemeContext";
import { space, radius, type } from "../../theme";

// Cosmetic-only heuristic (length + character variety) driving the 4-segment
// meter below. Not a security gate — the actual submit validation is
// untouched (still just "at least 8 characters").
function passwordStrength(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return Math.max(pw.length > 0 ? 1 : 0, Math.min(score, 4));
}

export default function ChangePassword() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const toast = useToast();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [saving, setSaving] = useState(false);

    const strength = passwordStrength(newPassword);
    // Index by strength (1-4) — the whole meter turns one ramp color, it
    // doesn't rainbow segment-by-segment.
    const STRENGTH_COLOR = { 1: colors.danger, 2: colors.warning, 3: colors.info, 4: colors.success };
    const strengthColor = STRENGTH_COLOR[strength];
    const STRENGTH_LABEL = { 0: "", 1: "Weak", 2: "Fair", 3: "Good", 4: "Strong" };

    const handleSubmit = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error("Please fill in all fields.");
            return;
        }
        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("New password and confirmation don't match.");
            return;
        }
        setSaving(true);
        try {
            await api.changePassword({ currentPassword, newPassword });
            toast.success("Password updated successfully.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (e) {
            toast.error(e.message || "Could not change password");
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <SectionContainerCard title="Change Password" subtitle="Use your current password to set a new one">
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Current Password</Text>
                    <TextInput
                        style={styles.input}
                        secureTextEntry
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput style={styles.input} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                    {newPassword ? (
                        <View style={styles.meterRow}>
                            <View style={styles.meterBars}>
                                {[0, 1, 2, 3].map((i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.meterBar,
                                            i < strength && { backgroundColor: strengthColor },
                                        ]}
                                    />
                                ))}
                            </View>
                            <Text style={[styles.meterLabel, { color: strengthColor }]}>
                                {STRENGTH_LABEL[strength]}
                            </Text>
                        </View>
                    ) : null}
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <TextInput
                        style={styles.input}
                        secureTextEntry
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                    />
                </View>
                <TouchableOpacity
                    onPress={handleSubmit}
                    style={styles.saveBtn}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Update Password"
                >
                    {saving ? (
                        <ActivityIndicator color={colors.onAccent} />
                    ) : (
                        <Text style={styles.saveBtnText}>Update Password</Text>
                    )}
                </TouchableOpacity>
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: space.lg },
        formGroup: { marginBottom: space.md },
        label: { ...type.subheading, color: colors.textMuted, marginBottom: space.xs },
        meterRow: { flexDirection: "row", alignItems: "center", marginTop: space.sm },
        meterBars: { flexDirection: "row", gap: 4, flex: 1 },
        meterBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.hairline },
        meterLabel: { ...type.caption, marginLeft: space.sm },
        input: {
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: space.md,
            height: 44,
            ...type.body,
            color: colors.text,
        },
        saveBtn: {
            backgroundColor: colors.accentStrong,
            borderRadius: radius.md,
            borderCurve: "continuous",
            height: 44,
            justifyContent: "center",
            alignItems: "center",
            marginTop: space.sm,
        },
        saveBtnText: { ...type.label, color: colors.onAccent },
    });
