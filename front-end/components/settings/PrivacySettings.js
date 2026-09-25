import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionContainerCard } from "../common/Cards";
import { api } from "../../utils/api";
import { useToast } from "../ui/Toast";
import { useTheme } from "../../context/ThemeContext";
import { useScreenPadBottom, useScreenPadTop } from "../../utils/responsive";
import { useScroll } from "../../context/ScrollContext";
import { SkeletonBlock } from "../ui/Skeleton";
import { space, radius, type, shadow, MIN_TOUCH } from "../../theme";

// Consent status/retention + the existing withdraw-and-delete flow, surfaced
// as its own destination instead of only appearing in the annual reminder.
export default function PrivacySettings({ onAccountDeleted }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();

    const { scrollProps } = useScroll();
    const toast = useToast();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [renewing, setRenewing] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const load = async () => {
        try {
            const { user } = await api.me();
            setUser(user);
        } catch (e) {
            console.log("privacy load:", e.message);
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            await load();
            setLoading(false);
        })();
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
        if (deleting) return;
        setDeleting(true);
        try {
            await api.deleteAccount();
            onAccountDeleted && onAccountDeleted();
        } catch (e) {
            toast.error(e.message || "Could not delete account");
        } finally {
            setDeleting(false);
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
        <Animated.ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            keyboardShouldPersistTaps="handled"
            {...scrollProps}
        >
            {loading ? (
                <SkeletonBlock width="100%" height={52} radius={radius.lg} style={{ marginBottom: space.lg }} />
            ) : (
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
            )}

            <SectionContainerCard
                title="Data Privacy Act of 2012 (RA 10173)"
                subtitle="Your consent and data-retention status"
            >
                {loading ? (
                    [0, 1, 2].map((i) => (
                        <View key={i} style={styles.row}>
                            <SkeletonBlock width="44%" height={12} radius={6} />
                            <SkeletonBlock width="28%" height={12} radius={6} />
                        </View>
                    ))
                ) : (
                    <>
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
                    </>
                )}
                <TouchableOpacity
                    onPress={handleRenew}
                    style={styles.renewBtn}
                    disabled={renewing || loading}
                    accessibilityRole="button"
                    accessibilityLabel="Renew data retention for another year"
                    accessibilityState={{ disabled: renewing || loading, busy: renewing }}
                >
                    {(<Text style={styles.renewBtnText}>Renew data retention for another year</Text>)}
                </TouchableOpacity>
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
                            disabled={deleting}
                            accessibilityRole="button"
                            accessibilityLabel="Permanently delete everything"
                            accessibilityState={{ disabled: deleting, busy: deleting }}
                        >
                            {(<Text style={styles.deleteBtnText}>Permanently delete everything</Text>)}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setConfirmDelete(false)}
                            style={styles.cancelBtn}
                            disabled={deleting}
                            accessibilityRole="button"
                            accessibilityLabel="Go back"
                        >
                            <Text style={styles.cancelBtnText}>Go back</Text>
                        </TouchableOpacity>
                    </>
                )}
            </SectionContainerCard>
        </Animated.ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        // transparent, not colors.background: App.js paints the page gradient.

        container: { flex: 1, backgroundColor: "transparent" },
        // Padding on the content so the bottom clearance scrolls with it.
        content: { padding: space.lg },
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
        // Neither child was flexed, so a long value ran past the card edge.
        row: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: space.md,
            minHeight: MIN_TOUCH,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.hairline,
        },
        rowLabel: { ...type.label, color: colors.textMuted, flex: 1, minWidth: 0 },
        rowValue: { ...type.label, color: colors.text, flexShrink: 1, textAlign: "right" },
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
