import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, type } from "../../theme";
import { fullMonthDate } from "../../utils/dates";
import { DashboardSurface as Surface, DashboardControl as Control } from "./ConsultationsAppointmentsCard";
import Gradient from "./Gradient";
import VaccineIcon from "./VaccineIcon";
import { SkeletonBlock } from "./Skeleton";

export default function VaccinationProgressCard({ completed = 0, total = 0, nextVaccine, loading, error, onOpen }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard, material = colors.vaccinationProgress;
    const styles = useMemo(() => makeStyles(p, material), [p, material]);
    const fraction = total > 0 ? Math.max(0, Math.min(1, completed / total)) : 0;
    const remaining = nextVaccine && nextVaccine.status !== "completed" ? 1 : 0;
    const navigable = nextVaccine?.id != null && !String(nextVaccine.id).startsWith("tmp-");
    return <View testID="vaccination-progress" style={styles.panel}>
        <Surface colors={material.panel} highlight={p.highlight} radius={24} />
        <View style={styles.header}>
            <View style={styles.headerIcon}><Surface colors={p.control} highlight={p.highlight} radius={18} />
                <VaccineIcon size={36} showBackground={false} /></View>
            <Text style={styles.title}>Vaccination Progress</Text>
            <Text style={styles.count}>{loading || error ? "—" : `${completed} of ${total} doses`}</Text>
        </View>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel={loading ? "Loading vaccination progress" : error ? "Vaccination progress unavailable" : `Vaccination progress, ${completed} of ${total} doses`}
            accessibilityValue={loading || error ? undefined : { min: 0, max: Math.max(1, total), now: Math.min(Math.max(0, completed), Math.max(1, total)) }}>
            {!loading && !error && fraction > 0 ? <Gradient colors={material.fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.fill, { width: `${fraction * 100}%` }]} /> : null}
        </View>
        {loading ? <SkeletonBlock width="100%" height={100} radius={22} />
            : nextVaccine ? <Control material={{ surface: material.row }} radius={22} style={styles.upcoming}
                onPress={() => onOpen(nextVaccine)} disabled={!navigable} accessibilityRole="button"
                accessibilityLabel={`Next vaccine: ${nextVaccine.vaccine_name || "Vaccination"}, ${nextVaccine.visit_name || ""}, due ${fullMonthDate(nextVaccine.due_date) || "date unavailable"}`}
                accessibilityState={{ disabled: !navigable }}>
                <View style={styles.ring} accessible accessibilityLabel={`${remaining} dose remaining for this scheduled entry. Series progress unavailable.`}>
                    {/* The saved dose has no series denominator; a neutral ring must not imply one. */}
                    <Svg accessible={false} aria-hidden width="60" height="60" viewBox="0 0 60 60" style={StyleSheet.absoluteFillObject}>
                        <Circle cx="30" cy="30" r="26" fill="none" stroke={material.track} strokeWidth="5" />
                    </Svg>
                    <Text style={styles.remaining}>{remaining}</Text>
                </View>
                <View style={styles.information}>
                    <Text style={styles.name}>Next vaccine: {nextVaccine.vaccine_name || "Vaccination"}</Text>
                    {nextVaccine.visit_name ? <Text style={styles.visit}>{nextVaccine.visit_name}</Text> : null}
                    <View style={styles.dateRow}><Image accessible={false} source={require("../../assets/navbar/calendar-blue.png")} resizeMode="contain" style={styles.calendar} />
                        <Text style={styles.date}>{fullMonthDate(nextVaccine.due_date) || "Date unavailable"}</Text></View>
                </View>
                <View pointerEvents="none" style={styles.chevron}>
                    <Surface colors={p.control} highlight={p.highlight} radius={18} />
                    <Ionicons accessible={false} name="chevron-forward" size={22} color={p.azure} />
                </View>
            </Control> : <Text style={styles.empty}>{error ? "Vaccinations could not be loaded. Pull down to retry."
                : !total ? "No vaccinations scheduled yet." : completed >= total ? "All scheduled doses completed." : "No upcoming vaccinations scheduled."}</Text>}
    </View>;
}

const makeStyles = (p, material) => StyleSheet.create({
    panel: { padding: 16, borderRadius: 24, boxShadow: p.panelShadow, marginBottom: 16, gap: 14 },
    header: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    headerIcon: { width: 36, height: 36, borderRadius: 18, boxShadow: p.rowShadow },
    title: { ...type.bodyStrong, fontSize: 16, lineHeight: 22, color: p.text, flex: 1, minWidth: 120 },
    count: { ...type.label, fontSize: 12, lineHeight: 18, color: p.text, marginLeft: "auto", textAlign: "right" },
    track: { height: 10, borderRadius: 5, backgroundColor: material.track, overflow: "hidden", boxShadow: "inset 0 1px 3px " + material.trackShade },
    fill: { height: "100%", borderRadius: 5, boxShadow: "inset 0 1px 2px " + p.highlight },
    upcoming: { minHeight: MIN_TOUCH, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    ring: { width: 60, height: 60, flexShrink: 0, alignItems: "center", justifyContent: "center" },
    remaining: { ...type.heading, fontSize: 23, lineHeight: 27, color: p.text },
    information: { flex: 1, minWidth: 0, gap: 4 },
    name: { ...type.bodyStrong, fontSize: 14, lineHeight: 20, color: p.text },
    visit: { ...type.caption, fontSize: 12, lineHeight: 17, color: p.secondary },
    dateRow: { flexDirection: "row", alignItems: "center", gap: 5 }, calendar: { width: 16, height: 16, flexShrink: 0 },
    date: { ...type.caption, fontSize: 12, lineHeight: 17, color: p.secondary, flex: 1, minWidth: 0 },
    chevron: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: p.rowShadow },
    empty: { ...type.caption, color: p.secondary, lineHeight: 20, paddingVertical: 12 },
});
