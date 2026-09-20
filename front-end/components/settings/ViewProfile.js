import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useScreenPadBottom, useScreenPadTop } from "../../utils/responsive";
import { useScroll } from "../../context/ScrollContext";
import { space, radius, type, shadow, MIN_TOUCH } from "../../theme";
import { api, ACCOUNT_SCOPE, ACCOUNT_RESOURCE } from "../../utils/api";
import { useRecordCache, useScreenRefresh } from "../../utils/useRecords";
import { storage } from "../../utils/storageAdapter";
import { monthLabel } from "../../utils/dates";
import { LEAD_TIME_KEY, LEAD_TIME_OPTIONS } from "./GeneralSettings";
import { SkeletonBlock } from "../ui/Skeleton";
import Avatar from "../ui/Avatar";
import Gradient from "../ui/Gradient";
import { relationshipLabel } from "../../utils/relationship";

const SECTIONS = [
    {
        label: "Preferences",
        items: [
            { key: "themePreferences", icon: "contrast-outline", label: "Appearance", value: "scheme" },
            { key: "languagePreferences", icon: "language-outline", label: "Language", value: "language" },
            { key: "generalSettings", icon: "notifications-outline", label: "Reminder notifications", value: "reminder" },
        ],
    },
    {
        label: "Account & Privacy",
        items: [
            { key: "editProfile", icon: "person-outline", label: "Edit Profile" },
            { key: "changePassword", icon: "lock-closed-outline", label: "Change Password" },
            { key: "privacySettings", icon: "shield-checkmark-outline", label: "Privacy & Data" },
        ],
    },
    {
        label: "BabyBook+ & Support",
        items: [
            { key: "share", icon: "share-social-outline", label: "Share Records" },
            { key: "services", icon: "location-outline", label: "Local Services" },
            { key: "helpSupport", icon: "help-circle-outline", label: "Help & Support" },
            { key: "aboutApp", icon: "information-circle-outline", label: "About BabyBook+" },
        ],
    },
];

export const PROFILE_TITLES = Object.fromEntries(
    SECTIONS.flatMap((section) => section.items.map((item) => [item.key, item.label])),
);

const LANGUAGE_LABELS = { en: "English", fil: "Filipino", tag: "Taglish" };
const SCHEME_LABELS = { light: "Light", dark: "Dark", system: "System" };

export default function ViewProfile({
    parentName,
    parentAvatar,
    parentRelationship,
    profiles = [],
    schemeOverride = "light",
    onNavigate,
    onLogout,
}) {
    const { colors } = useTheme();
    const { language, t } = useLanguage();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const { scrollProps } = useScroll();
    const cached = useRecordCache(ACCOUNT_SCOPE, ACCOUNT_RESOURCE);
    const user = cached.rows[0];
    const accountKnown = !!user;
    const account = { email: user?.email || "", phone: user?.phoneNumber || "", city: user?.city || "", createdAt: user?.createdAt || "" };
    const [leadDays, setLeadDays] = useState("1");
    const load = useCallback(async (isCurrent) => {
        const outcomes = await Promise.allSettled([api.me({ loading: "nonblocking" }), storage.getItem(LEAD_TIME_KEY)]);
        if (isCurrent() && outcomes[1].status === "fulfilled" && outcomes[1].value) setLeadDays(outcomes[1].value);
        return ["account", "preferences"].filter((_, index) => outcomes[index].status === "rejected");
    }, []);
    const { refreshing, failures, refresh: loadAccount } = useScreenRefresh(ACCOUNT_SCOPE, load);
    const loading = refreshing && !accountKnown;
    const loadError = failures.length > 0;

    const values = {
        scheme: SCHEME_LABELS[schemeOverride] || "System",
        language: LANGUAGE_LABELS[language] || "English",
        reminder: LEAD_TIME_OPTIONS.find((option) => option.key === leadDays)?.label || "1 day before",
    };
    const role = relationshipLabel(parentRelationship) || "Caregiver";
    const joined = accountKnown ? monthLabel(account.createdAt) || "Not available" : t("screenDataUnavailable");

    return (
        <Animated.ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            keyboardShouldPersistTaps="handled"
            {...scrollProps}
        >
            <View style={styles.identity}>
                <Avatar uri={parentAvatar} name={parentName} size={88} borderWidth={3} />
                <Text style={styles.parentName} numberOfLines={2}>{parentName}</Text>
                {loading ? (
                    <SkeletonBlock width={180} height={14} radius={7} style={styles.emailSkeleton} />
                ) : (
                    <Text style={styles.email} numberOfLines={1}>{accountKnown ? account.email || "Email not recorded" : t("screenDataUnavailable")}</Text>
                )}
                <Text style={styles.role}>{role}</Text>
                {refreshing && accountKnown ? <Text style={styles.role}>{t("screenRefreshing")}</Text> : null}
            </View>

            {loadError ? (
                <View style={styles.errorRow}>
                    <Text style={styles.errorText}>{t("screenRefreshFailed")}</Text>
                    <TouchableOpacity onPress={loadAccount} style={styles.retryBtn} accessibilityRole="button">
                        <Text style={styles.retryText}>{t("retry")}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            <View style={styles.contactCard}>
                <InfoRow icon="call-outline" label="Phone" value={!accountKnown ? (refreshing ? t("screenRefreshing") : t("screenDataUnavailable")) : account.phone || "Not recorded"} colors={colors} styles={styles} />
                <View style={styles.divider} />
                <InfoRow icon="location-outline" label="City / Municipality" value={!accountKnown ? (refreshing ? t("screenRefreshing") : t("screenDataUnavailable")) : account.city || "Not recorded"} colors={colors} styles={styles} />
            </View>

            <View style={styles.highlights}>
                <View style={styles.highlightCard}>
                    <Ionicons name="happy-outline" size={22} color={colors.primary} />
                    <Text style={styles.highlightValue}>{profiles.length}</Text>
                    <Text style={styles.highlightLabel}>{profiles.length === 1 ? "Baby profile" : "Baby profiles"}</Text>
                </View>
                <View style={styles.highlightCard}>
                    <Ionicons name="calendar-outline" size={22} color={colors.primary} />
                    <Text style={styles.highlightValue} numberOfLines={1}>{joined}</Text>
                    <Text style={styles.highlightLabel}>Member since</Text>
                </View>
            </View>

            <Gradient colors={[colors.primaryDark, colors.primary]} style={styles.planCard}>
                <View style={styles.planIcon}>
                    <Ionicons name="book-outline" size={24} color={colors.primaryDark} />
                </View>
                <View style={styles.planCopy}>
                    <Text style={styles.planEyebrow}>CURRENT PLAN</Text>
                    <Text style={styles.planTitle}>BabyBook+ Free</Text>
                    <Text style={styles.planDescription}>All current features are included.</Text>
                </View>
            </Gradient>

            {SECTIONS.map((section) => (
                <View key={section.label} style={styles.section}>
                    <Text style={styles.sectionLabel}>{section.label}</Text>
                    <View style={styles.sectionCard}>
                        {section.items.map((item, index) => (
                            <React.Fragment key={item.key}>
                                {index > 0 ? <View style={styles.rowDivider} /> : null}
                                <TouchableOpacity
                                    onPress={() => onNavigate(item.key)}
                                    style={styles.settingRow}
                                    accessibilityRole="button"
                                    accessibilityLabel={item.label}
                                >
                                    <View style={styles.settingIcon}>
                                        <Ionicons name={item.icon} size={19} color={colors.primary} />
                                    </View>
                                    <Text style={styles.settingLabel}>{item.label}</Text>
                                    {item.value ? <Text style={styles.settingValue} numberOfLines={1}>{values[item.value]}</Text> : null}
                                    <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
                                </TouchableOpacity>
                            </React.Fragment>
                        ))}
                    </View>
                </View>
            ))}

            <TouchableOpacity onPress={onLogout} style={styles.logoutRow} accessibilityRole="button">
                <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
        </Animated.ScrollView>
    );
}

function InfoRow({ icon, label, value, colors, styles }) {
    return (
        <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
                <Ionicons name={icon} size={18} color={colors.primary} />
            </View>
            <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
            </View>
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: "transparent" },
        content: { paddingHorizontal: space.lg },
        identity: { alignItems: "center", paddingTop: space.xl, paddingBottom: space.lg },
        parentName: { ...type.title, color: colors.text, textAlign: "center", marginTop: space.md },
        email: { ...type.caption, color: colors.textMuted, marginTop: space.xs, maxWidth: "90%" },
        emailSkeleton: { marginTop: space.sm },
        role: { ...type.label, color: colors.primary, marginTop: space.xs },
        errorRow: {
            minHeight: MIN_TOUCH,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.dangerBg,
            borderRadius: radius.md,
            paddingLeft: space.md,
            marginBottom: space.md,
        },
        errorText: { ...type.caption, color: colors.danger, flex: 1 },
        retryBtn: { minWidth: 64, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
        retryText: { ...type.label, color: colors.danger },
        contactCard: {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.hairline,
            paddingHorizontal: space.lg,
            ...shadow.card,
        },
        infoRow: { minHeight: 62, flexDirection: "row", alignItems: "center" },
        infoIcon: {
            width: 36,
            height: 36,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            marginRight: space.md,
        },
        infoCopy: { flex: 1, minWidth: 0 },
        infoLabel: { ...type.caption, color: colors.textMuted },
        infoValue: { ...type.bodyStrong, color: colors.text },
        divider: { height: 1, backgroundColor: colors.hairline, marginLeft: 48 },
        highlights: { flexDirection: "row", gap: space.md, marginTop: space.md },
        highlightCard: {
            flex: 1,
            minWidth: 0,
            minHeight: 104,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.hairline,
            padding: space.md,
            ...shadow.card,
        },
        highlightValue: { ...type.heading, color: colors.text, marginTop: space.xs, textAlign: "center" },
        highlightLabel: { ...type.caption, color: colors.textMuted, textAlign: "center" },
        planCard: {
            minHeight: 112,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: radius.xl,
            borderCurve: "continuous",
            padding: space.lg,
            marginTop: space.md,
            ...shadow.raised,
        },
        planIcon: {
            width: 48,
            height: 48,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            backgroundColor: colors.onPrimary,
            alignItems: "center",
            justifyContent: "center",
            marginRight: space.md,
        },
        planCopy: { flex: 1 },
        planEyebrow: { ...type.caption, color: colors.onPrimary, opacity: 0.8 },
        planTitle: { ...type.heading, color: colors.onPrimary, marginTop: 2 },
        planDescription: { ...type.caption, color: colors.onPrimary, opacity: 0.9, marginTop: 2 },
        section: { marginTop: space.xl },
        sectionLabel: { ...type.subheading, color: colors.textMuted, marginBottom: space.sm, marginLeft: space.xs },
        sectionCard: {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.hairline,
            paddingHorizontal: space.md,
            ...shadow.card,
        },
        settingRow: { minHeight: 58, flexDirection: "row", alignItems: "center" },
        settingIcon: {
            width: 34,
            height: 34,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            marginRight: space.md,
        },
        settingLabel: { ...type.bodyStrong, color: colors.text, flex: 1, minWidth: 0 },
        settingValue: { ...type.caption, color: colors.textMuted, maxWidth: "32%", marginLeft: space.sm, marginRight: space.xs },
        rowDivider: { height: 1, backgroundColor: colors.hairline, marginLeft: 46 },
        logoutRow: {
            minHeight: 52,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.sm,
            backgroundColor: colors.dangerBg,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            marginTop: space.xl,
            marginBottom: space.xxl,
        },
        logoutText: { ...type.bodyStrong, color: colors.danger },
    });
