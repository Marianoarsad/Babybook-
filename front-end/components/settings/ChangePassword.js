import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { api } from "../../utils/api";
import { useToast } from "../ui/Toast";
import { useTheme } from "../../context/ThemeContext";
import { space, radius } from "../../theme";

export default function ChangePassword() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const toast = useToast();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [saving, setSaving] = useState(false);

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
        label: {
            fontSize: 10,
            fontWeight: "700",
            color: colors.textMuted,
            textTransform: "uppercase",
            marginBottom: 4,
        },
        input: {
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: space.md,
            height: 44,
            fontSize: 13,
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
        saveBtnText: { color: colors.onAccent, fontWeight: "700", fontSize: 13 },
    });
