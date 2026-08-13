import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionContainerCard } from "../common/Cards";
import { api } from "../../utils/api";
import { useToast } from "../ui/Toast";
import { useTheme } from "../../context/ThemeContext";
import { space, radius, type, shadow } from "../../theme";
import { exportChildRecordsPdf, pdfExportAvailable } from "../../utils/exportPdf";
import { CATEGORY_LABELS } from "../../utils/pdfTemplate";

// Consent status/retention + the existing withdraw-and-delete flow, surfaced
// as its own destination instead of only appearing in the annual reminder.
export default function PrivacySettings({ profile, onAccountDeleted }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const toast = useToast();

    const [user, setUser] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [renewing, setRenewing] = useState(false);

    const exportKeys = Object.keys(CATEGORY_LABELS);
    const [exportSelected, setExportSelected] = useState(() => new Set(exportKeys));
    const [exporting, setExporting] = useState(false);
    const toggleExportKey = (key) => {
        setExportSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };
    const handleExport = async () => {
        if (!profile) return;
        if (exportSelected.size === 0) {
            toast.error("Select at least one category to export.");
            return;
        }
        setExporting(true);
        try {
            await exportChildRecordsPdf(profile, { scope: exportSelected });
        } catch (e) {
            toast.error(e.message || "Could not export records");
        } finally {
            setExporting(false);
        }
    };

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

    // Consent-status banner — the one thing worth knowing at a glance before
    // reading the detail rows below. Only two states are backed by real data
    // (consentReviewDue is a plain yes/no from the API), so the banner uses
    // the "overdue" ramp when review is due and "completed" otherwise rather
    // than inventing a third "upcoming" bucket we have no date to drive.
    const reviewDue = !!user?.consentReviewDue;
    const bannerColor = reviewDue ? colors.overdue : colors.completed;
    const bannerBg = reviewDue ? colors.overdueBg : colors.completedBg;

    return (
        <ScrollView style={styles.container}>
            <View style={[styles.consentBanner, { backgroundColor: bannerBg }, reviewDue && shadow.active(colors.warning)]}>
                <Ionicons
                    name={reviewDue ? "alert-circle" : "checkmark-circle"}
                    size={20}
                    color={bannerColor}
                />
                <Text style={[styles.consentBannerText, { color: bannerColor }]}>
                    {reviewDue
                        ? "Annual consent review is due — renew below to keep your data active."
                        : "Your consent is up to date."}
                </Text>
            </View>

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

            <SectionContainerCard
                title="Export My Child's Records"
                subtitle="Download a PDF — also works offline once saved"
            >
                {pdfExportAvailable() ? (
                    <>
                        <View style={styles.exportGrid}>
                            {exportKeys.map((key) => {
                                const on = exportSelected.has(key);
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        style={styles.exportRow}
                                        onPress={() => toggleExportKey(key)}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked: on }}
                                    >
                                        <View style={[styles.checkbox, on && styles.checkboxOn]}>
                                            {on && <Ionicons name="checkmark" size={13} color={colors.onPrimary} />}
                                        </View>
                                        <Text style={styles.exportLabel}>{CATEGORY_LABELS[key]}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <TouchableOpacity
                            onPress={handleExport}
                            style={styles.renewBtn}
                            disabled={exporting || !profile}
                            accessibilityRole="button"
                            accessibilityLabel="Export selected records as PDF"
                        >
                            {exporting ? (
                                <ActivityIndicator color={colors.onAccent} />
                            ) : (
                                <Text style={styles.renewBtnText}>Export as PDF</Text>
                            )}
                        </TouchableOpacity>
                    </>
                ) : (
                    <Text style={styles.warnText}>PDF export isn't available on this build.</Text>
                )}
            </SectionContainerCard>

            <SectionContainerCard
                title="QR Consultation Access Log"
                subtitle="What's recorded when a healthcare professional views shared records"
            >
                <Text style={styles.warnText}>
                    When a healthcare professional resolves a consultation code, we record their name, the
                    exact time, their network (IP) address, and a summary of their device. This is shown in
                    your Share Records access log and helps you notice a code being viewed from somewhere
                    unexpected.
                </Text>
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
        consentBanner: {
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            padding: space.md,
            marginBottom: space.lg,
        },
        consentBannerText: { ...type.bodyStrong, flex: 1 },
        row: {
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.hairline,
        },
        rowLabel: { ...type.label, color: colors.textMuted },
        rowValue: { ...type.label, color: colors.text },
        exportGrid: { marginBottom: space.md },
        exportRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
        exportLabel: { ...type.label, color: colors.text },
        checkbox: {
            width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.primary,
            alignItems: "center", justifyContent: "center", backgroundColor: colors.surface,
        },
        checkboxOn: { backgroundColor: colors.primary },
        renewBtn: {
            height: 44,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.accentStrong,
            justifyContent: "center",
            alignItems: "center",
            marginTop: space.md,
        },
        renewBtnText: { ...type.label, color: colors.onAccent },
        warnText: { ...type.caption, color: colors.textSecondary, marginBottom: space.md },
        deleteBtn: {
            height: 44,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.danger,
            justifyContent: "center",
            alignItems: "center",
        },
        deleteBtnText: { ...type.label, color: colors.onPrimary },
        cancelBtn: { alignItems: "center", paddingVertical: 12, marginTop: space.xs },
        cancelBtnText: { ...type.label, color: colors.textSecondary },
    });
