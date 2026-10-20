import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { type } from "../../theme";
import { shortDate } from "../../utils/dates";
import { conditionDuration } from "../../utils/viewerRecords";
import conditionRecords from "../../utils/conditions.cjs";
import { DashboardSurface as Surface, DashboardControl as Control, DashboardListTransition as ListTransition } from "./ConsultationsAppointmentsCard";
import RecordIcon, { IllnessIcon } from "./RecordIcon";
import ConditionsArtwork from "./ConditionsArtwork";
import AllRecordsIcon from "./AllRecordsIcon";
import SwipeActionRow from "./SwipeActionRow";
import AnimatedReveal from "./AnimatedReveal";
import { AppointmentsSkeleton, SkeletonBlock } from "./Skeleton";

const { conditionSavedStatus } = conditionRecords;
const FILTERS = [ ["all", "All"], ["Illness", "Illnesses"], ["Allergy", "Allergies"], ["Hereditary Condition", "Hereditary"] ];
const EMPTY = { all: "No illnesses or conditions recorded yet", Illness: "No illness records yet.", Allergy: "No allergy information recorded yet.", "Hereditary Condition": "No hereditary history recorded yet." };

export function ConditionsSummaryMetrics({ counts, filter, onSelect }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const columns = width >= 600 * fontScale ? 4 : width > 0 && (width - 10) / 2 < 100 * fontScale ? 1 : 2;
    const compact = width > 0 && width / columns < 148 * fontScale;
    const groups = [];
    for (let i = 0; i < FILTERS.length; i += columns) groups.push(FILTERS.slice(i, i + columns));
    const material = { all: p.all, Illness: p.overdue, Allergy: p.completed,
        "Hereditary Condition": { ...p.headerIcon, active: colors.conditionArtwork.hereditaryActive, ink: colors.conditionCategory.hereditary.on } };
    return <View testID="condition-metrics" style={styles.metrics} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {groups.map((group, i) => <View key={i} style={styles.metricRow}>
            {group.map(([key, label]) => <Control key={key} testID={`condition-filter-${key}`} material={material[key]} active={filter === key}
                style={[styles.metric, compact && styles.compactMetric]} onPress={() => onSelect(key)} accessibilityRole="button"
                accessibilityLabel={`${label}, ${counts[key]} ${key === "Allergy" ? "allergy information " : ""}${counts[key] === 1 ? "record" : "records"}`}
                accessibilityState={{ selected: filter === key }}>
                {key === "all" ? <AllRecordsIcon /> : key === "Illness" ? <ConditionsArtwork kind="microbe" /> : <RecordIcon category={key} />}
                <View style={styles.metricBody}><Text style={[styles.count, compact && styles.centered]}>{counts[key].toLocaleString()}</Text>
                    <Text style={[styles.metricLabel, compact && styles.centered, { color: material[key].ink, fontWeight: filter === key ? "700" : "500" }]}>{label}</Text>
                </View>
            </Control>)}
        </View>)}
    </View>;
}

export function ConditionRecordItem({ record, today, open, onSwipeOpen, onSwipeClose, onOpen, onEdit, onDelete }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const illness = record.category === "Illness";
    const category = record.category === "Allergy" ? "Allergy information" : illness ? "Illness" : "Hereditary";
    const tone = colors.conditionCategory[illness ? "illness" : record.category === "Allergy" ? "allergy" : "hereditary"];
    const savedStatus = conditionSavedStatus(record);
    const dated = Boolean(record.date);
    const dateLabel = illness && record.resolved === true && record.resolvedDate && dated
        ? `${shortDate(record.date)} - ${shortDate(record.resolvedDate)}` : dated ? `${illness ? "Started" : "Recorded"} ${shortDate(record.date)}` : "";
    const duration = illness ? conditionDuration({ date_recorded: record.date, resolved: record.resolved, resolved_date: record.resolvedDate }, today) : "";
    return <SwipeActionRow open={open} onOpen={onSwipeOpen} onClose={onSwipeClose} pressScale={0.985}
        onPress={() => onOpen(record)} label={`View ${record.title}. ${category}${illness ? `. ${savedStatus}` : ""}`}
        style={styles.item} foregroundStyle={{ backgroundColor: p.row[0] }} actions={[
            { key: "update", label: "Update", icon: "create-outline", color: colors.primaryDark, onPress: () => { onSwipeClose(); onEdit(record); } },
            { key: "delete", label: "Delete", icon: "trash-outline", color: colors.onAccent, kind: "delete", onPress: () => { onSwipeClose(); onDelete(record); } },
        ]}>
        <View testID={`condition-record-${record.id}`} style={styles.itemBody}>
            <Surface colors={p.row} highlight={p.highlight} />
            <RecordIcon category={record.category} size={44} />
            <View style={styles.information}>
                <Text style={styles.itemTitle}>{record.title}</Text>
                <View style={styles.categoryRow}>
                    <Text style={[styles.category, { color: tone.on }]}>{category}</Text>
                    {illness ? <View style={[styles.status, { backgroundColor: record.resolved ? colors.successBg : colors.warningBg }]}>
                        <Text style={[styles.statusText, { color: record.resolved ? colors.success : colors.warning }]}>{savedStatus}</Text>
                    </View> : null}
                </View>
                {dateLabel ? <View style={styles.metaPair}><Ionicons accessible={false} name="calendar-outline" size={13} color={p.secondary} /><Text style={styles.metadata}>{dateLabel}</Text></View> : null}
                {illness && dated ? <View style={styles.metaPair}><Ionicons accessible={false} name="time-outline" size={13} color={p.secondary} /><Text style={styles.metadata}>{duration}</Text></View> : null}
                {record.desc ? <Text style={styles.notes} numberOfLines={2}>{record.desc}</Text> : null}
            </View>
            <View accessible={false} pointerEvents="none" style={styles.chevron}>
                <Surface colors={p.control} highlight={p.highlight} radius={17} /><Ionicons accessible={false} name="chevron-forward" size={21} color={p.chevron} />
            </View>
        </View>
    </SwipeActionRow>;
}

export default function IllnessesConditionsCard({ summary, today, loading, loadFailed, onRetry, onAdd, onOpen, onEdit, onDelete }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const [selection, setSelection] = useState({ filter: "all", visible: 10 });
    const [openSwipe, setOpenSwipe] = useState(null);
    const { filter, visible } = selection;
    const filtered = useMemo(() => filter === "all" ? summary.records : summary.records.filter(record => record.category === filter), [summary.records, filter]);
    const remaining = Math.max(0, filtered.length - visible);
    return <View testID="conditions-card" style={styles.panel}>
        <Surface colors={p.panel} highlight={p.highlight} radius={28} />
        <View style={styles.header}><IllnessIcon size={44} showBackground={false} /><Text style={styles.title}>Illnesses & Conditions</Text>
            <Control material={{ surface: p.control }} radius={22} style={styles.add} onPress={onAdd} accessibilityRole="button" accessibilityLabel="Log a condition">
                <Ionicons accessible={false} name="add" size={28} color={p.azure} />
            </Control>
        </View>
        <Text style={styles.subtitle}>Record and manage illnesses, allergies, and hereditary conditions.</Text>
        {loading ? <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading conditions"><SkeletonBlock height={95} borderRadius={22} /><AppointmentsSkeleton count={2} /></View>
        : loadFailed ? <View style={styles.empty}><Text style={styles.emptyText}>Conditions could not be loaded.</Text>
            <Control material={{ surface: p.control }} style={styles.more} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading conditions"><Text style={styles.moreText}>Retry</Text></Control>
        </View> : <>
            <ConditionsSummaryMetrics counts={summary.counts} filter={filter} onSelect={next => { if (next !== filter) { setOpenSwipe(null); setSelection({ filter: next, visible: 10 }); } }} />
            <AnimatedReveal duration={240} contentStyle={styles.listSpace}>
                <ListTransition filter={filter} testID="condition-list-transition"><View testID="condition-results" style={styles.items} accessibilityLiveRegion="polite">
                    {filtered.slice(0, visible).map(record => <ConditionRecordItem key={record.id} record={record} today={today} open={openSwipe === record.id}
                        onSwipeOpen={() => setOpenSwipe(record.id)} onSwipeClose={() => setOpenSwipe(null)} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />)}
                    {!filtered.length ? <View testID="condition-empty" style={styles.empty}>
                        <Surface colors={p.row} highlight={p.highlight} /><ConditionsArtwork kind="clipboard" size={filter === "all" ? 150 : 86} />
                        <Text style={styles.emptyTitle}>{EMPTY[filter]}</Text>
                        {filter === "all" ? <><Text style={styles.emptyText}>Keep track of your child's illnesses, allergies, and hereditary conditions in one place.</Text><Text style={styles.emptyText}>Tap the + button to add a record.</Text></> : null}
                    </View> : null}
                    {remaining > 0 ? <Control material={{ surface: p.control }} radius={999} style={styles.more} onPress={() => { setOpenSwipe(null); setSelection(previous => ({ ...previous, visible: previous.visible + 10 })); }}
                        accessibilityRole="button" accessibilityLabel={`Show more conditions, ${remaining} remaining`}>
                        <Ionicons accessible={false} name="chevron-down" size={18} color={p.azure} /><Text style={styles.moreText}>Show more ({remaining.toLocaleString()} remaining)</Text>
                    </Control> : null}
                </View></ListTransition>
            </AnimatedReveal>
        </>}
    </View>;
}

const makeStyles = p => StyleSheet.create({
    panel: { padding: 14, borderRadius: 28, backgroundColor: p.panel[0], boxShadow: p.panelShadow, marginBottom: 20, overflow: "visible" },
    header: { flexDirection: "row", alignItems: "center", gap: 10 }, title: { ...type.heading, fontSize: 18, lineHeight: 24, color: p.text, flex: 1, minWidth: 0 },
    subtitle: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary, marginTop: 8 }, add: { width: 44, height: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    metrics: { marginTop: 16, gap: 10 }, metricRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
    metric: { flex: 1, minWidth: 0, minHeight: 108, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 22 },
    compactMetric: { flexDirection: "column", gap: 6 }, centered: { textAlign: "center" }, metricBody: { flex: 1, minWidth: 0 },
    count: { ...type.heading, fontSize: 23, lineHeight: 29, color: p.text }, metricLabel: { ...type.caption, fontSize: 13, lineHeight: 19, marginTop: 2 },
    listSpace: { paddingHorizontal: 2, paddingTop: 16, paddingBottom: 10 }, items: { gap: 10 }, item: { borderRadius: 22, backgroundColor: p.row[0], boxShadow: p.rowShadow, overflow: "visible" },
    itemBody: { minHeight: 90, borderRadius: 22, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }, information: { flex: 1, minWidth: 0 },
    itemTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 21, color: p.text }, categoryRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 3 },
    category: { ...type.caption, fontSize: 13, lineHeight: 19 }, status: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }, statusText: { ...type.caption, fontSize: 11, lineHeight: 16 },
    metaPair: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }, metadata: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, flexShrink: 1 }, notes: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, marginTop: 4 },
    chevron: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: p.rowShadow },
    more: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, gap: 8, marginTop: 4 }, moreText: { ...type.label, color: p.azure, textAlign: "center", flexShrink: 1 },
    empty: { padding: 18, borderRadius: 22, gap: 10, alignItems: "center" }, emptyTitle: { ...type.bodyStrong, color: p.text, textAlign: "center" }, emptyText: { ...type.caption, lineHeight: 20, textAlign: "center", color: p.secondary }, loading: { marginTop: 16, gap: 16 },
});
