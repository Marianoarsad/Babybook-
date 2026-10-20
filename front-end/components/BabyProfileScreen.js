import React, { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BlurTargetView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { type } from "../theme";
import { api } from "../utils/api";
import { useRecords, useRecordCache, useScreenRefresh } from "../utils/useRecords";
import { ageText, latestProfileMeasurements, commonMeasurementDate } from "../utils/babyProfile";
import { shortDate, shortTime } from "../utils/dates";
import conditions from "../utils/conditions.cjs";
import Gradient from "./ui/Gradient";
import AnchoredMenu, { AnchoredMenuItem } from "./ui/AnchoredMenu";
import { ProfilePanel, ProfilePhoto, ProfileControl, ProfileIcon, ProfileMetrics } from "./ui/ProfileVisuals";

export function BabyProfileContent({ profile, growth, medical, growthLoading, growthUnavailable, conditionsLoading, conditionsUnavailable, onChangePhoto }) {
    const { colors } = useTheme();
    const p = colors.profileSurface;
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { width, fontScale } = useWindowDimensions();
    const narrow = width / fontScale < 360;
    const measurements = latestProfileMeasurements(growth);
    const commonDate = commonMeasurementDate(measurements);
    const facts = conditions.conditionSummaries(medical, profile.allergies, profile.hereditaryConditions);
    const emergency = profile.emergencyContactDetails || {};
    const emergencyName = [emergency.firstName, emergency.lastName].filter(Boolean).join(" ");
    const emergencyLabel = emergencyName ? `${emergencyName}${emergency.relationship ? ` (${emergency.relationship})` : ""}` : profile.emergencyContact || (emergency.relationship ? `Relationship: ${emergency.relationship}` : "");
    const birth = [
        ["calendar-outline", "Date of Birth", profile.dateOfBirth && shortDate(profile.dateOfBirth)],
        ["time-outline", "Time of Birth", profile.timeOfBirth && shortTime(profile.timeOfBirth)],
        ["scale-outline", "Birth Weight", profile.hasRecordedBirthWeight !== false && profile.birthWeight != null && `${profile.birthWeight} kg`],
        ["resize-outline", "Birth Height", profile.hasRecordedBirthHeight !== false && profile.birthHeight != null && `${profile.birthHeight} cm`],
        ["ellipse-outline", "Birth Head Circumference", profile.birthHeadCircumference != null && `${profile.birthHeadCircumference} cm`],
        ["business-outline", "Place of Birth", profile.placeOfBirth || profile.hospital],
        ["business-outline", "Hospital", profile.placeOfBirth && profile.hospital !== profile.placeOfBirth && profile.hospital],
        ["medical-outline", "OB-GYNE", profile.obgynName],
        ["call-outline", "OB-GYNE Contact", profile.obgynContactNumber],
    ].filter(row => row[2]);
    const header = (title, icon) => <View style={styles.sectionHeader}>{icon}<Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text></View>;
    const conditionSection = (title, kind, values, empty) => <ProfilePanel testID={`profile-${kind}`} kind={kind}>
        {header(title, <ProfileIcon kind={kind === "mint" ? "allergies" : "hereditary"} size={48} showBackground={false} />)}
        {values.length ? values.map((value, index) => <ProfilePanel key={`${value}:${index}`} kind={kind === "mint" ? "mintItem" : "lavenderItem"} radius={18} style={{ padding: 14 }}>
            <Text style={styles.value}>{value}</Text>
        </ProfilePanel>) : <Text style={styles.secondary}>{conditionsLoading ? "Loading records\u2026" : conditionsUnavailable ? "Records unavailable. Pull to refresh." : empty}</Text>}
    </ProfilePanel>;
    return <>
        <ProfilePanel testID="profile-identity">
            <View style={styles.identityRow}>
                <ProfilePhoto key={profile.id} profile={profile} size={96} onChangePhoto={onChangePhoto} />
                <View style={styles.body}>
                    <Text style={styles.name}>{profile.name}</Text>
                    {profile.nickname ? <Text style={styles.secondary}>{"\u201c"}{profile.nickname}{"\u201d"}</Text> : null}
                    <View style={styles.identityFact}><Ionicons name={profile.hasRecordedSex === false ? "time-outline" : profile.gender === "girl" ? "female" : "male"} size={18} color={p.secondary} />
                        <Text style={styles.secondary}>{[profile.hasRecordedSex !== false ? profile.sex : "", ageText(profile.dateOfBirth)].filter(Boolean).join(" \u2022 ") || "Not recorded"}</Text></View>
                    {profile.dateOfBirth ? <View style={styles.identityFact}><Ionicons name="calendar-outline" size={18} color={p.secondary} /><Text style={styles.secondary}>Born {shortDate(profile.dateOfBirth)}</Text></View> : null}
                </View>
            </View>
        </ProfilePanel>
        <ProfilePanel testID="profile-growth">
            {header("Growth Measurements", <ProfileIcon kind="growth" size={44} showBackground={false} />)}
            <ProfilePanel kind="surface" radius={20} style={{ paddingHorizontal: 8 }}>
                <ProfileMetrics headLabel="Head circumference" measurements={measurements} showDates={!commonDate} loading={growthLoading} unavailable={growthUnavailable} />
                {commonDate ? <Text style={[styles.secondary, styles.divider]}>Last measured: {shortDate(commonDate)}</Text> : null}
                {growthLoading || growthUnavailable ? <Text style={styles.secondary}>{growthLoading ? "Loading measurements\u2026" : "Measurements unavailable. Pull to refresh."}</Text> : null}
            </ProfilePanel>
        </ProfilePanel>
        {conditionSection("Allergies", "mint", facts.allergies, "No allergies recorded.")}
        {conditionSection("Hereditary", "lavender", facts.hereditary, "No hereditary conditions recorded.")}
        <ProfilePanel testID="profile-blood">
            {header("Blood Type", <ProfileIcon kind="blood" tone="pink" size={48} showBackground={false} />)}
            <ProfilePanel kind="surface" radius={18} style={{ padding: 14 }}><Text style={styles.value}>{profile.bloodType || "Not recorded"}</Text></ProfilePanel>
        </ProfilePanel>
        <ProfilePanel testID="profile-birth">
            {header("Birth Information", <ProfileIcon name="calendar" size={44} showBackground={false} />)}
            <ProfilePanel kind="surface" radius={20} style={{ paddingVertical: 2, gap: 0 }}>
                {birth.length ? birth.map(([icon, label, value], index) => {
                    const stacked = narrow && (String(value).length > 18 || label.length > 18 || label.includes("Contact"));
                    return <View key={label} style={[styles.detailRow, index > 0 && styles.rowDivider, stacked && { flexWrap: "wrap" }]}>
                        <Ionicons name={icon} size={18} color={p.secondary} />
                        <Text style={[styles.secondary, styles.body]}>{label}</Text>
                        <Text style={[styles.value, stacked ? { flexBasis: "100%", paddingLeft: 26 } : styles.detailValue]}>{value}</Text>
                    </View>;
                }) : <Text style={[styles.secondary, { paddingVertical: 14 }]}>No birth information recorded.</Text>}
            </ProfilePanel>
        </ProfilePanel>
        <ProfilePanel testID="profile-contacts">
            {header("Pediatrician & Emergency Contact", <ProfileIcon kind="ped" tone="lavender" size={44} showBackground={false} />)}
            <ProfilePanel kind="surface" radius={20} style={{ gap: 14 }}>
                <View style={styles.contactRow}><ProfileIcon name="medical-outline" tone="lavender" size={44} /><View style={styles.body}>
                    <Text style={styles.secondary}>Pediatrician</Text>
                    <Text style={styles.value}>{profile.pediatricianName || "Not recorded"}</Text>
                    {profile.pediatricianClinicHospital ? <Text style={styles.secondary}>{profile.pediatricianClinicHospital}</Text> : null}
                    {profile.pediatricianContactNumber ? <Text style={styles.secondary}>{profile.pediatricianContactNumber}</Text> : null}
                </View></View>
                <View style={[styles.contactRow, styles.divider]}><ProfileIcon kind="emergency" tone="pink" size={44} /><View style={styles.body}>
                    <Text style={styles.secondary}>Emergency Contact</Text>
                    <Text style={styles.value}>{emergencyLabel || "Not recorded"}</Text>
                    {emergency.contactNumber ? <Text style={styles.secondary}>{emergency.contactNumber}</Text> : null}
                </View></View>
            </ProfilePanel>
        </ProfilePanel>
    </>;
}

export default function BabyProfileScreen({ profile, onBack, onEdit }) {
    const { colors } = useTheme();
    const p = colors.profileSurface;
    const insets = useSafeAreaInsets();
    const menuRef = useRef(null), blurTarget = useRef(null);
    const [anchor, setAnchor] = useState(null);
    const growth = useRecords(profile?.id, "growth");
    const medical = useRecords(profile?.id, "medical-history");
    const growthCache = useRecordCache(profile?.id, "growth");
    const medicalCache = useRecordCache(profile?.id, "medical-history");
    const load = useCallback(async () => {
        if (!profile) return [];
        const results = await Promise.allSettled(["growth", "medical-history"].map(resource => api.listRecords(profile.id, resource, { loading: "nonblocking" })));
        return results.filter(result => result.status === "rejected").map(() => "Some records could not be refreshed.");
    }, [profile?.id]);
    const { refreshing, failures, refresh } = useScreenRefresh(profile?.id, load);
    const edit = photo => { setAnchor(null); onEdit({ photo }); };
    return <>
        <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
            <Gradient colors={p.panel} style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16,
                    paddingTop: Math.max(insets.top, 12), paddingBottom: 12 }}>
                    <ProfileControl radius={24} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={controlStyle}>
                        <Ionicons name="chevron-back" size={26} color={p.accent} />
                    </ProfileControl>
                    <Text accessibilityRole="header" style={{ ...type.heading, fontSize: 21, color: p.text, flex: 1, textAlign: "center" }}>Baby Profile</Text>
                    {profile ? <ProfileControl ref={menuRef} radius={24} accessibilityRole="button" accessibilityLabel="More profile options"
                        accessibilityState={{ expanded: !!anchor }} style={controlStyle}
                        onPress={() => menuRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }))}>
                        <Ionicons name="ellipsis-horizontal" size={24} color={p.accent} />
                    </ProfileControl> : <View style={controlStyle} />}
                </View>
                <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.accent} />} contentContainerStyle={{ paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16), paddingBottom: insets.bottom + 28, gap: 16 }}>
                    {failures.length ? <ProfileControl onPress={refresh} style={{ padding: 14 }} accessibilityRole="button" accessibilityLabel="Retry profile records">
                        <Text style={{ ...type.body, color: p.secondary }}>Some records could not be refreshed. Tap to retry.</Text>
                    </ProfileControl> : null}
                    {profile ? <BabyProfileContent profile={profile} growth={growth} medical={medical}
                        growthLoading={!growthCache.hasFetched && refreshing} growthUnavailable={!growthCache.hasFetched && !refreshing}
                        conditionsLoading={!medicalCache.hasFetched && refreshing} conditionsUnavailable={!medicalCache.hasFetched && !refreshing}
                        onChangePhoto={() => edit(true)} /> : <Text style={{ ...type.body, color: p.text }}>This baby profile is no longer available.</Text>}
                </ScrollView>
            </Gradient>
        </BlurTargetView>
        <AnchoredMenu visible={!!anchor} anchor={anchor} onClose={() => setAnchor(null)} appearance="actions" blurTarget={blurTarget} dimBackdrop={false}>
            <AnchoredMenuItem variant="action" label="Edit Profile" leading={<ProfileIcon kind="edit" size={40} />} onPress={() => edit(false)} />
        </AnchoredMenu>
    </>;
}
const controlStyle = { width: 48, height: 48, flexShrink: 0, alignItems: "center", justifyContent: "center" };
const makeStyles = colors => {
    const p = colors.profileSurface;
    return StyleSheet.create({
        sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
        sectionTitle: { ...type.heading, fontSize: 18, lineHeight: 24, color: p.text, flex: 1 },
        name: { ...type.heading, fontSize: 23, lineHeight: 29, color: p.text },
        secondary: { ...type.body, fontSize: 14, lineHeight: 21, color: p.secondary, flexShrink: 1 },
        value: { ...type.bodyStrong, fontSize: 15, lineHeight: 22, color: p.text },
        body: { flex: 1, minWidth: 0, gap: 3 }, identityRow: { flexDirection: "row", alignItems: "center", gap: 16 },
        identityFact: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
        detailRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11 },
        detailValue: { flex: 1.2, minWidth: 0, textAlign: "right" },
        rowDivider: { borderTopWidth: 1, borderTopColor: p.divider },
        divider: { paddingTop: 12, borderTopWidth: 1, borderTopColor: p.divider },
        contactRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    });
};
