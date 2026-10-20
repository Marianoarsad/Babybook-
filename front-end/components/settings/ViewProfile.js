import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated, Platform, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useScreenPadBottom, useScreenPadTop } from "../../utils/responsive";
import { useScroll } from "../../context/ScrollContext";
import { space, type, MIN_TOUCH } from "../../theme";
import { api, ACCOUNT_SCOPE, ACCOUNT_RESOURCE } from "../../utils/api";
import { useRecordCache, useScreenRefresh } from "../../utils/useRecords";
import { storage } from "../../utils/storageAdapter";
import { LEAD_TIME_KEY, LEAD_TIME_OPTIONS } from "./GeneralSettings";
import { SkeletonBlock } from "../ui/Skeleton";
import Avatar from "../ui/Avatar";
import Gradient from "../ui/Gradient";
import { DashboardSurface as Surface } from "../ui/ConsultationsAppointmentsCard";
import useSoftPress from "../ui/useSoftPress";
import PulseLoader from "../ui/PulseLoader";
import { useToast } from "../ui/Toast";
import { relationshipLabel } from "../../utils/relationship";

const SECTIONS = [
    { label: "Preferences", description: "Customize your app experience.", items: [
        { key: "themePreferences", icon: "contrast-outline", label: "Appearance", value: "scheme", material: "brand" },
        { key: "languagePreferences", icon: "language-outline", label: "Language", value: "language", material: "language" },
        { key: "generalSettings", icon: "notifications-outline", label: "Reminder notifications", value: "reminder", material: "mint" },
    ] },
    { label: "Account & Privacy", description: "Manage your account and keep your data secure.", items: [
        { key: "editProfile", icon: "person-outline", label: "Edit Profile", material: "brand" },
        { key: "changePassword", icon: "lock-closed-outline", label: "Change Password", material: "purple" },
        { key: "privacySettings", icon: "shield-checkmark-outline", label: "Privacy & Data", material: "mint" },
    ] },
    { label: "Support", description: "Get help and learn more about BabyBook+.", items: [
        { key: "services", icon: "location-outline", label: "Local Services", disabled: true, material: "disabled" },
        { key: "helpSupport", icon: "help-circle-outline", label: "Help & Support", material: "brand" },
        { key: "aboutApp", icon: "information-circle-outline", label: "About BabyBook+", material: "rose" },
    ] },
];

export const PROFILE_TITLES = {
    share: "Share Records",
    ...Object.fromEntries(SECTIONS.flatMap(section => section.items.map(item => [item.key, item.label]))),
};
const LANGUAGE_LABELS = { en: "English", fil: "Filipino", tag: "Taglish" };
const SCHEME_LABELS = { light: "Light", dark: "Dark", system: "System" };

function CircularIcon({ icon, material, p, size = 42 }) {
    return <View accessible={false} pointerEvents="none" style={{ width: size, height: size, borderRadius: size / 2,
        alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: p.iconShadow }}>
        <Surface colors={material.surface} highlight={p.highlight} radius={size / 2} />
        <Ionicons name={icon} size={size * 0.55} color={material.ink} />
    </View>;
}

function SettingsRow({ item, value, onNavigate, p, styles }) {
    const { width, fontScale = 1 } = useWindowDimensions();
    const [rowWidth, setRowWidth] = useState(0), [focused, setFocused] = useState(false), [pressed, setPressed] = useState(false);
    const { respond, transform } = useSoftPress();
    const stacked = (rowWidth || width - 64) < 300 * fontScale;
    const focus = event => setFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    const press = down => { setPressed(down); respond(down); };
    return <Animated.View style={{ transform }}>
        <Pressable testID={"profile-setting-" + item.key} onLayout={event => setRowWidth(event.nativeEvent.layout.width)}
            disabled={!!item.disabled} onPress={() => { if (!item.disabled) onNavigate(item.key); }}
            accessibilityRole="button" accessibilityLabel={item.label} accessibilityValue={value ? { text: value } : undefined}
            accessibilityState={{ disabled: !!item.disabled }} onFocus={focus} onKeyDown={focus}
            onBlur={() => { setFocused(false); press(false); }} onPressIn={() => press(true)} onPressOut={() => press(false)}
            style={[styles.settingRow, item.disabled && styles.settingRowDisabled, pressed && { backgroundColor: p.pressTint },
                Platform.OS === "web" && { outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 1, outlineColor: p.accent }]}>
            <CircularIcon icon={item.icon} material={p.icons[item.material]} p={p} />
            <View style={[styles.settingCopy, stacked && styles.settingCopyStacked]}>
                <Text style={[styles.settingLabel, item.disabled && { color: p.muted }]}>{item.label}</Text>
                {value ? <Text style={[styles.settingValue, stacked && styles.settingValueStacked]}>{value}</Text> : null}
            </View>
            {!item.disabled ? <CircularIcon icon="chevron-forward" material={p.icons.brand} p={p} size={32} /> : null}
        </Pressable>
    </Animated.View>;
}

export default function ViewProfile({ parentName, parentAvatar, parentRelationship, schemeOverride = "light", onNavigate, onLogout }) {
    const { colors } = useTheme(), p = colors.profileSettings;
    const { language, t } = useLanguage(), toast = useToast();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom(), padTop = useScreenPadTop();
    const { scrollProps, scrollViewRef } = useScroll();
    const cached = useRecordCache(ACCOUNT_SCOPE, ACCOUNT_RESOURCE), user = cached.rows[0];
    const accountKnown = !!user;
    const account = { email: user?.email || "", phone: user?.phoneNumber || "", city: user?.city || "" };
    const [leadDays, setLeadDays] = useState("1"), [signingOut, setSigningOut] = useState(false);
    const logoutPending = useRef(false), { respond, transform } = useSoftPress();
    const [logoutFocused, setLogoutFocused] = useState(false), [logoutPressed, setLogoutPressed] = useState(false);
    const load = useCallback(async isCurrent => {
        const outcomes = await Promise.allSettled([api.me({ loading: "nonblocking" }), storage.getItem(LEAD_TIME_KEY)]);
        if (isCurrent() && outcomes[1].status === "fulfilled" && outcomes[1].value) setLeadDays(outcomes[1].value);
        return ["account", "preferences"].filter((_, index) => outcomes[index].status === "rejected");
    }, []);
    const { refreshing, failures, refresh: loadAccount, isActive } = useScreenRefresh(ACCOUNT_SCOPE, load);
    const loading = refreshing && !accountKnown, loadError = failures.length > 0;
    const values = { scheme: SCHEME_LABELS[schemeOverride] || "System", language: LANGUAGE_LABELS[language] || "English",
        reminder: LEAD_TIME_OPTIONS.find(option => option.key === leadDays)?.label || "1 day before" };
    const role = relationshipLabel(parentRelationship) || "Caregiver";
    const handleLogout = async () => {
        if (logoutPending.current) return;
        logoutPending.current = true; setSigningOut(true);
        try { await onLogout(); }
        catch (error) { if (isActive()) toast.error(error.message || "Could not sign out. Please try again."); }
        finally { logoutPending.current = false; if (isActive()) setSigningOut(false); }
    };
    const logoutFocus = event => setLogoutFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    const logoutPress = down => { setLogoutPressed(down); respond(down); };

    return <Animated.ScrollView ref={scrollViewRef} style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
        keyboardShouldPersistTaps="handled" {...scrollProps}>
        <View style={styles.identity}>
            <Gradient colors={p.avatarRing} style={styles.avatarRing}>
                <Gradient colors={p.panel} style={styles.avatarFace}>
                    <Avatar uri={parentAvatar} name={parentName} size={86} style={{ backgroundColor: "transparent" }} />
                </Gradient>
            </Gradient>
            <Text accessibilityRole="header" style={styles.parentName}>{parentName}</Text>
            {loading ? <SkeletonBlock width={180} height={14} radius={7} style={styles.emailSkeleton} />
                : <Text style={styles.email}>{accountKnown ? account.email || "Email not recorded" : t("screenDataUnavailable")}</Text>}
            <View style={styles.roleBadge}><Surface colors={p.control} highlight={p.highlight} radius={999} /><Text style={styles.role}>{role}</Text></View>
            {refreshing && accountKnown ? <Text style={styles.refreshText}>{t("screenRefreshing")}</Text> : null}
        </View>
        {loadError ? <View style={styles.errorRow}><Text style={styles.errorText}>{t("screenRefreshFailed")}</Text>
            <TouchableOpacity onPress={loadAccount} style={styles.retryBtn} accessibilityRole="button" accessibilityLabel={t("retry")}>
                <Text style={styles.retryText}>{t("retry")}</Text></TouchableOpacity></View> : null}

        <View testID="profile-contact" style={styles.contactCard}><Surface colors={p.panel} highlight={p.highlight} radius={24} />
            <InfoRow icon="call-outline" label="Phone" value={!accountKnown ? (refreshing ? t("screenRefreshing") : t("screenDataUnavailable")) : account.phone || "Not recorded"} p={p} styles={styles} />
            <View style={styles.divider} />
            <InfoRow icon="location-outline" label="City / Municipality" value={!accountKnown ? (refreshing ? t("screenRefreshing") : t("screenDataUnavailable")) : account.city || "Not recorded"} p={p} styles={styles} />
        </View>
        <View testID="profile-plan" style={styles.planCard}><Surface colors={p.plan} highlight={p.highlight} radius={24} />
            <CircularIcon icon="book-outline" material={p.icons.brand} p={p} size={56} />
            <View style={styles.planCopy}><Text style={styles.planEyebrow}>CURRENT PLAN</Text><Text style={styles.planTitle}>BabyBook+ Free</Text>
                <Text style={styles.planDescription}>All current features are included.</Text></View>
        </View>
        {SECTIONS.map(section => <View key={section.label} style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionLabel}>{section.label}</Text><Text style={styles.sectionDescription}>{section.description}</Text>
            <View testID={"profile-group-" + section.label} style={styles.sectionCard}><Surface colors={p.panel} highlight={p.highlight} radius={24} />
                {section.items.map((item, index) => <React.Fragment key={item.key}>
                    {index > 0 ? <View style={styles.rowDivider} /> : null}
                    <SettingsRow item={item} value={values[item.value]} onNavigate={onNavigate} p={p} styles={styles} />
                </React.Fragment>)}
            </View>
        </View>)}
        <Animated.View style={[styles.logoutWrap, { transform, boxShadow: logoutPressed ? p.pressedShadow : p.logoutShadow }]}>
            <Surface colors={p.logout} highlight={p.highlight} radius={999} />
            <Pressable testID="profile-sign-out" onPress={handleLogout} disabled={signingOut} accessibilityRole="button" accessibilityLabel="Sign Out"
                accessibilityState={{ disabled: signingOut, busy: signingOut }} onFocus={logoutFocus} onKeyDown={logoutFocus}
                onBlur={() => { setLogoutFocused(false); logoutPress(false); }} onPressIn={() => logoutPress(true)} onPressOut={() => logoutPress(false)}
                style={[styles.logoutRow, Platform.OS === "web" && { outlineStyle: logoutFocused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: p.logoutInk }]}>
                {signingOut ? <PulseLoader color={p.logoutInk} /> : <Ionicons name="log-out-outline" size={23} color={p.logoutInk} />}
                <Text style={styles.logoutText}>{signingOut ? "Signing out..." : "Sign Out"}</Text>
            </Pressable>
        </Animated.View>
    </Animated.ScrollView>;
}

function InfoRow({ icon, label, value, p, styles }) {
    return <View style={styles.infoRow}><CircularIcon icon={icon} material={p.icons.brand} p={p} />
        <View style={styles.infoCopy}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View></View>;
}

const makeStyles = colors => {
    const p = colors.profileSettings;
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: "transparent" }, content: { paddingHorizontal: space.lg },
        identity: { alignItems: "center", paddingTop: 12, paddingBottom: 20, gap: 6 },
        avatarRing: { width: 92, height: 92, borderRadius: 46, padding: 3, boxShadow: p.avatarShadow, marginBottom: 6 },
        avatarFace: { width: 86, height: 86, borderRadius: 43, boxShadow: "inset 1px 2px 3px " + p.highlight },
        parentName: { ...type.title, fontSize: 22, lineHeight: 29, color: p.text, textAlign: "center", maxWidth: "100%" },
        email: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.muted, textAlign: "center", maxWidth: "100%", ...(Platform.OS === "web" ? { overflowWrap: "anywhere" } : {}) },
        emailSkeleton: { marginVertical: 3 }, roleBadge: { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 999, boxShadow: p.iconShadow },
        role: { ...type.label, fontSize: 13, lineHeight: 18, color: p.accent }, refreshText: { ...type.caption, color: p.muted },
        errorRow: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", backgroundColor: colors.dangerBg, borderRadius: 16, paddingLeft: space.md, marginBottom: space.md },
        errorText: { ...type.caption, color: colors.danger, flex: 1 }, retryBtn: { minWidth: 64, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center" }, retryText: { ...type.label, color: colors.danger },
        contactCard: { borderRadius: 24, backgroundColor: p.panel[0], boxShadow: p.panelShadow, paddingHorizontal: 16 },
        infoRow: { minHeight: 72, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 14 },
        infoCopy: { flex: 1, minWidth: 0, gap: 3 }, infoLabel: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.muted },
        infoValue: { ...type.bodyStrong, fontSize: 16, lineHeight: 22, color: p.text }, divider: { height: 1, backgroundColor: p.divider, marginLeft: 56 },
        planCard: { minHeight: 112, padding: 18, marginTop: 16, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: p.plan[0], boxShadow: p.planShadow },
        planCopy: { flex: 1, minWidth: 0, gap: 3 }, planEyebrow: { ...type.caption, fontSize: 11, lineHeight: 16, color: p.onPlan },
        planTitle: { ...type.heading, fontSize: 19, lineHeight: 25, color: p.onPlan, textTransform: "capitalize" }, planDescription: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.onPlan },
        section: { marginTop: 22 }, sectionLabel: { ...type.heading, fontSize: 19, lineHeight: 25, color: p.text },
        sectionDescription: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.muted, marginTop: 3, marginBottom: 10 },
        sectionCard: { borderRadius: 24, backgroundColor: p.panel[0], boxShadow: p.panelShadow, paddingHorizontal: 10 },
        settingRow: { minHeight: 64, paddingHorizontal: 4, paddingVertical: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 12 },
        settingRowDisabled: { opacity: 0.65 }, settingCopy: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
        settingCopyStacked: { flexDirection: "column", alignItems: "stretch", gap: 3 }, settingLabel: { ...type.label, fontSize: 14, lineHeight: 20, color: p.text, flex: 1, minWidth: 0 },
        settingValue: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.muted, maxWidth: "38%", flexShrink: 1, textAlign: "right" },
        settingValueStacked: { maxWidth: "100%", textAlign: "left" }, rowDivider: { height: 1, backgroundColor: p.divider, marginLeft: 58, marginRight: 4 },
        logoutWrap: { borderRadius: 999, marginTop: 22, marginBottom: 24 }, logoutRow: { minHeight: 56, padding: 14, gap: 9, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center" },
        logoutText: { ...type.bodyStrong, fontSize: 16, lineHeight: 22, color: p.logoutInk },
    });
};
