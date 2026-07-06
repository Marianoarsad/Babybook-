import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { api } from "../../utils/api";
import { useToast } from "../ui/Toast";
import { useTheme } from "../../context/ThemeContext";
import { space, radius } from "../../theme";

// Consent status/retention + the existing withdraw-and-delete flow, surfaced
// as its own destination instead of only appearing in the annual reminder.
export default function PrivacySettings({ onAccountDeleted }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const toast = useToast();

    const [user, setUser] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [renewing, setRenewing] = useState(false);

    const load = async () => {
        try {
            const { user } = await api.me();
            setUser(user);
        } catch (e) {
            console.log("privacy load:", e.message);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleRenew = async () => {
        setRenewing(true);
        try {
            await api.renewConsent();
            toast.success("Data retention renewed for another year.");
            await load();
        } catch (e) {
            toast.error(e.message || "Could not renew consent");
        } finally {
            setRenewing(false);
        }
    };

    const handleDelete = async () => {
        try {
            await api.deleteAccount();
            onAccountDeleted && onAccountDeleted();
        } catch (e) {
            toast.error(e.message || "Could not delete account");
        }
    };

    const retentionDate = user?.retentionUntil
        ? new Date(user.retentionUntil).toLocaleDateString()
        : "—";
    const consentDate = user?.consentDate ? new Date(user.consentDate).toLocaleDateString() : "—";

    return (
        <ScrollView style={styles.container}>
            <SectionContainerCard
                title="Data Privacy Act of 2012 (RA 10173)"
                subtitle="Your consent and data-retention status"
            >
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Consent accepted on</Text>
                    <Text style={styles.rowValue}>{consentDate}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Data retained until</Text>
                    <Text style={styles.rowValue}>{retentionDate}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Annual review due</Text>
                    <Text style={styles.rowValue}>{user?.consentReviewDue ? "Yes — review now" : "Not yet"}</Text>
                </View>
                <TouchableOpacity
                    onPress={handleRenew}
                    style={styles.renewBtn}
                    disabled={renewing}
                    accessibilityRole="button"
                    accessibilityLabel="Renew data retention for another year"
                >
                    <Text style={styles.renewBtnText}>Renew data retention for another year</Text>
                </TouchableOpacity>
            </SectionContainerCard>

            <SectionContainerCard title="Withdraw Consent" subtitle="Permanently delete your account and all child records">
                {!confirmDelete ? (
                    <TouchableOpacity
                        onPress={() => setConfirmDelete(true)}
                        style={styles.deleteBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Withdraw and delete my data"
                    >
                        <Text style={styles.deleteBtnText}>Withdraw & delete my data</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <Text style={styles.warnText}>
                            This permanently deletes your account and all of your child's records. This cannot be undone.
                        </Text>
                        <TouchableOpacity
                            onPress={handleDelete}
                            style={styles.deleteBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Permanently delete everything"
                        >
                            <Text style={styles.deleteBtnText}>Permanently delete everything</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setConfirmDelete(false)}
                            style={styles.cancelBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Go back"
                        >
                            <Text style={styles.cancelBtnText}>Go back</Text>
                        </TouchableOpacity>
                    </>
                )}
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: space.lg },
        row: {
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.hairline,
        },
        rowLabel: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
        rowValue: { fontSize: 13, fontWeight: "600", color: colors.text },
        renewBtn: {
            height: 44,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.accentStrong,
            justifyContent: "center",
            alignItems: "center",
            marginTop: space.md,
        },
        renewBtnText: { color: colors.onAccent, fontWeight: "700", fontSize: 13 },
        warnText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: space.md },
        deleteBtn: {
            height: 44,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.danger,
            justifyContent: "center",
            alignItems: "center",
        },
        deleteBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
        cancelBtn: { alignItems: "center", paddingVertical: 12, marginTop: space.xs },
        cancelBtnText: { color: colors.textSecondary, fontWeight: "700", fontSize: 13 },
    });
