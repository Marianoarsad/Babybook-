import React, { memo, useEffect, useMemo, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, type } from "../../theme";
import { todayLocal } from "../../utils/dates";
import { IMMUNIZATION_BATCH_SIZE } from "../../utils/immunizationSummary";
import { viewerImmunizations, selectViewerImmunizations } from "../../utils/viewerImmunizations";
import { DashboardSurface as Surface, DashboardControl as Control, DashboardListTransition as ListTransition } from "./ConsultationsAppointmentsCard";
import AnimatedReveal from "./AnimatedReveal";
import AllRecordsIcon from "./AllRecordsIcon";
import ImmunizationStatusIcon from "./ImmunizationStatusIcon";
import VaccineIcon from "./VaccineIcon";

const FILTERS = [["all", "Total"], ["completed", "Completed"], ["scheduled", "Scheduled"], ["overdue", "Overdue"]];
const materialFor = (colors, status) => status === "completed" ? colors.appointmentDashboard.completed
    : status === "scheduled" ? colors.immunizationMetrics.dueSoon : status === "overdue" ? colors.immunizationMetrics.overdue : colors.appointmentDashboard.all;

export const ReadOnlyImmunizationItem = memo(function ReadOnlyImmunizationItem({ vaccine }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const tone = materialFor(colors, vaccine.status);
    const label = { completed: "Completed", scheduled: "Scheduled", overdue: "Overdue" }[vaccine.status];
    const reaction = ["mild", "severe"].includes(vaccine.reactionSeverity)
        ? `${vaccine.reactionSeverity === "severe" ? "Severe" : "Mild"} reaction${vaccine.reaction ? `: ${vaccine.reaction}` : ""}` : vaccine.reaction;
    return <View testID={`viewer-vaccine-${vaccine.key}`} style={styles.item}>
        <Surface colors={vaccine.status === "completed" ? p.row : tone.surface} highlight={p.highlight} radius={22} />
        <VaccineIcon size={34} showBackground={false} />
        <View style={styles.information}>
            <Text style={styles.itemTitle}>{vaccine.vaccineName}{vaccine.doseNumber != null ? ` · Dose ${vaccine.doseNumber}` : ""}</Text>
            <View style={styles.dateRow}><Ionicons accessible={false} name="calendar-outline" size={14} color={p.azure} />
                <Text style={[styles.date, vaccine.status === "overdue" && { color: tone.ink }]}>{vaccine.dateLabel}</Text></View>
            {reaction ? <Text style={[styles.note, { color: vaccine.reactionSeverity === "severe" ? colors.danger : p.secondary }]}>{reaction}</Text> : null}
        </View>
        <View testID="viewer-vaccine-status" style={[styles.badge, { backgroundColor: tone.surface[0] }]}>
            <Surface colors={tone.surface} highlight={p.highlight} radius={999} />
            <ImmunizationStatusIcon kind={vaccine.status === "overdue" ? "alert" : vaccine.status} material={tone} size={22} />
            <Text style={[styles.badgeText, { color: tone.ink }]}>{label}</Text>
        </View>
    </View>;
});

export default function ViewerImmunizationStatusCard({ rows }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const { fontScale } = useWindowDimensions();
    const [selection, setSelection] = useState({ filter: "all", search: "", visible: IMMUNIZATION_BATCH_SIZE });
    const [width, setWidth] = useState(0), [focused, setFocused] = useState(false);
    const [today, setToday] = useState(todayLocal());
    useEffect(() => {
        const refresh = () => setToday(todayLocal());
        const timer = setInterval(refresh, 60000);
        const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
        return () => { clearInterval(timer); subscription.remove(); };
    }, []);
    const summary = useMemo(() => viewerImmunizations(rows, today), [rows, today]);
    const results = useMemo(() => selectViewerImmunizations(summary.records, selection.filter, selection.search, selection.visible), [summary, selection]);
    const columns = width >= 600 * fontScale ? 4 : width > 0 && (width - 10) / 2 < 100 * fontScale ? 1 : 2;
    const compact = width > 0 && width / columns < 148 * fontScale;
    const groups = [];
    for (let i = 0; i < FILTERS.length; i += columns) groups.push(FILTERS.slice(i, i + columns));
    const change = values => setSelection(previous => ({ ...previous, ...values, visible: IMMUNIZATION_BATCH_SIZE }));
    return <View testID="viewer-immunizations" style={styles.panel}>
        <Surface colors={p.panel} highlight={p.highlight} radius={28} />
        <View style={styles.header}><VaccineIcon size={44} showBackground={false} /><View style={styles.information}>
            <Text accessibilityRole="header" style={styles.title}>Immunization Status</Text>
            <Text style={styles.subtitle}>Complete record of your patient's vaccinations.</Text>
        </View></View>
        <View style={styles.metrics} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
            {groups.map((group, index) => <View key={index} style={styles.metricRow}>{group.map(([key, label]) => {
                const tone = materialFor(colors, key);
                return <Control key={key} testID={`viewer-vaccine-filter-${key}`} material={tone} active={selection.filter === key}
                    onPress={() => change({ filter: key })} accessibilityRole="button" accessibilityState={{ selected: selection.filter === key }}
                    accessibilityLabel={`${label}, ${summary.counts[key]} vaccinations`} style={[styles.metric, compact && styles.compactMetric]}>
                    {key === "all" ? <AllRecordsIcon size={36} /> : <ImmunizationStatusIcon kind={key === "overdue" ? "alert" : key} material={tone} size={36} />}
                    <View style={styles.metricBody}><Text style={[styles.count, compact && styles.centered]}>{summary.counts[key]}</Text>
                        <Text style={[styles.metricLabel, compact && styles.centered, { color: tone.ink }]}>{label}</Text></View>
                    {selection.filter === key ? <Ionicons accessible={false} name="checkmark" size={12} color={tone.ink} style={styles.selected} /> : null}
                </Control>;
            })}</View>)}
        </View>
        <View style={[styles.search, Platform.OS === "web" && focused && { outlineStyle: "solid", outlineWidth: 2, outlineOffset: 3, outlineColor: p.azure }]}>
            <Surface colors={p.row} highlight={p.highlight} radius={999} /><Ionicons accessible={false} name="search" size={21} color={p.azure} />
            <TextInput testID="viewer-vaccine-search" value={selection.search} onChangeText={search => change({ search })}
                placeholder="Search vaccines or visits..." accessibilityLabel="Search vaccines or visits" placeholderTextColor={p.secondary}
                autoCapitalize="none" autoCorrect={false} style={[styles.input, Platform.OS === "web" && { outlineStyle: "none" }]}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
            {selection.search ? <Pressable onPress={() => change({ search: "" })} accessibilityRole="button" accessibilityLabel="Clear vaccine search" style={styles.clear}>
                <Ionicons accessible={false} name="close-circle" size={20} color={p.azure} /></Pressable> : null}
        </View>
        <View style={styles.reveal}><AnimatedReveal duration={240} contentStyle={styles.listSpace}><ListTransition filter={selection.filter} testID="viewer-vaccine-list-transition">
            <View style={styles.groups} testID="viewer-vaccine-results" accessibilityLiveRegion="polite">
                {results.groups.map(([label, records]) => <View key={label} style={styles.group}><Text accessibilityRole="header" style={styles.groupTitle}>{label}</Text>
                    {records.map(vaccine => <ReadOnlyImmunizationItem key={vaccine.key} vaccine={vaccine} />)}</View>)}
                {!results.total ? <Text style={styles.empty}>{results.empty}</Text> : null}
                {results.remaining > 0 ? <Control material={{ surface: p.control }} radius={999} style={styles.more}
                    onPress={() => setSelection(previous => ({ ...previous, visible: previous.visible + IMMUNIZATION_BATCH_SIZE }))}
                    accessibilityRole="button" accessibilityLabel={`Show more vaccines, ${results.remaining} remaining`}>
                    <Ionicons accessible={false} name="chevron-down" size={18} color={p.azure} /><Text style={styles.moreText}>Show more vaccines ({results.remaining} remaining)</Text>
                </Control> : null}
            </View>
        </ListTransition></AnimatedReveal></View>
    </View>;
}

const makeStyles = p => StyleSheet.create({
    panel: { borderRadius: 28, padding: 14, backgroundColor: p.panel[0], boxShadow: p.panelShadow, overflow: "visible" },
    header: { flexDirection: "row", alignItems: "center", gap: 10 }, information: { flex: 1, minWidth: 0 },
    title: { ...type.heading, fontSize: 19, lineHeight: 26, color: p.text }, subtitle: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary, marginTop: 3 },
    metrics: { gap: 10, marginTop: 18 }, metricRow: { flexDirection: "row", gap: 10 },
    metric: { flex: 1, minWidth: 0, minHeight: 106, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }, compactMetric: { flexDirection: "column", gap: 3 },
    metricBody: { flex: 1, minWidth: 0 }, centered: { textAlign: "center" },
    count: { ...type.heading, fontSize: 23, lineHeight: 29, color: p.text }, metricLabel: { ...type.caption, fontSize: 13, lineHeight: 19 }, selected: { position: "absolute", top: 8, right: 8 },
    search: { marginTop: 18, borderRadius: 999, minHeight: 48, paddingLeft: 14, paddingRight: 4, flexDirection: "row", alignItems: "center", gap: 8, boxShadow: p.rowShadow },
    input: { flex: 1, minWidth: 0, minHeight: 48, ...type.caption, fontSize: 13, color: p.text }, clear: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
    reveal: { marginHorizontal: -10 }, listSpace: { paddingHorizontal: 10, paddingTop: 20, paddingBottom: 12 }, groups: { gap: 18 }, group: { gap: 12 },
    groupTitle: { ...type.label, fontSize: 13, lineHeight: 19, color: p.secondary, paddingHorizontal: 4 },
    item: { borderRadius: 22, paddingHorizontal: 10, paddingVertical: 14, minHeight: 82, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: p.row[0], boxShadow: p.rowShadow },
    itemTitle: { ...type.bodyStrong, fontSize: 14, lineHeight: 20, color: p.text }, dateRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
    date: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, flexShrink: 1 }, note: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, marginTop: 3 },
    badge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 999, minHeight: 34, width: 98, maxWidth: "42%", flexShrink: 0, paddingHorizontal: 6, paddingVertical: 5, boxShadow: p.rowShadow },
    badgeText: { ...type.caption, fontSize: 12, lineHeight: 18, flexShrink: 1, textAlign: "center" },
    more: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, padding: 12 }, moreText: { ...type.label, color: p.azure, textAlign: "center", flexShrink: 1 },
    empty: { ...type.body, color: p.secondary, textAlign: "center", paddingVertical: 20 },
});
