import React, { useId, useMemo, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { type } from "../../theme";
import { api } from "../../utils/api";
import { useRecordSave } from "../../utils/useRecords";
import { shortDate } from "../../utils/dates";
import { MILK_TYPES, MILK_RANGES, currentMilkPeriods, milkPeriodInfo, searchMilkHistory } from "../../utils/milkTypeHistory";
import { DashboardSurface as Surface, DashboardControl as Control, DashboardListTransition as ListTransition } from "./ConsultationsAppointmentsCard";
import MilkIcon from "./MilkIcon";
import MilkFeedingStackedChart, { MilkAnalyticIcon } from "./MilkFeedingStackedChart";
import { buildMilkFeedingChart } from "../../utils/milkFeedingChart";
import { feedingPercentage } from "../../utils/feedingStats";
import AnimatedReveal from "./AnimatedReveal";
import RecordFormSheet, { DeleteConfirmation, RecordFormGroup } from "./RecordFormSheet";
import { DateField } from "./DateField";
import Field from "./Field";
import PlanDetail from "./PlanDetail";
import { SkeletonBlock } from "./Skeleton";
import Modal from "./AppModal";
import useBottomSheetMotion from "./useBottomSheetMotion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import KeyboardAvoider from "./KeyboardAvoider";
import useSoftPress from "./useSoftPress";

export function MilkPeriodRow({ period, onOpen }) {
    const { colors } = useTheme(), p = { ...colors.appointmentDashboard, ...colors.milkTypeDashboard };
    const styles = useMemo(() => makeStyles(p), [p]);
    const { respond, transform } = useSoftPress();
    const [pressed, setPressed] = useState(false), [focused, setFocused] = useState(false);
    const press = down => { setPressed(down); respond(down); };
    const focus = e => setFocused(Platform.OS === "web" && Boolean(e.currentTarget?.matches?.(":focus-visible")));
    return <Pressable onPress={() => onOpen(period)} onPressIn={() => press(true)} onPressOut={() => press(false)}
        onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); press(false); }}
        accessibilityRole="button" accessibilityLabel={`View ${period.type}. ${period.durationLabel}. ${period.dateLabel}. ${period.status || "Derived from feeding history"}`}>
        <Animated.View style={[styles.record, { transform, boxShadow: pressed ? p.pressedShadow : p.rowShadow }, Platform.OS === "web" && {
            outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: p.azure }]}>
        <Surface colors={p.row} highlight={p.highlight} radius={22} />
        <View style={styles.recordIcon}><MilkIcon size={48} /></View><View style={styles.body}><Text style={styles.recordTitle}>{period.type}</Text>
            <Text style={styles.caption}>{period.durationLabel}</Text>
            {period.active ? <Text style={[styles.caption, { color: p.azure }]}>Current recorded period</Text> : null}
            <View style={styles.dateLine}><Ionicons accessible={false} name="calendar-outline" size={15} color={p.secondary} /><Text style={styles.caption}>{period.dateLabel}</Text></View>
        </View><View accessible={false} pointerEvents="none" style={styles.chevron}><Surface colors={p.control} highlight={p.highlight} radius={20} /><Ionicons name="chevron-forward" size={23} color={p.azure} /></View>
        </Animated.View>
    </Pressable>;
}

export function MilkHistorySheet({ visible, onClose, children, overlays }) {
    const { colors } = useTheme(), p = { ...colors.appointmentDashboard, ...colors.milkTypeDashboard };
    const styles = useMemo(() => makeStyles(p), [p]);
    const { height } = useWindowDimensions(), insets = useSafeAreaInsets();
    const sheetHeight = Math.max(0, height - insets.top - 24);
    const motion = useBottomSheetMotion({ visible, collapsedHeight: sheetHeight * 0.85, expandedHeight: sheetHeight, onClose });
    return <Modal visible={motion.presented} transparent animationType="none" onShow={motion.startOpening} onRequestClose={() => motion.dismiss()}>
        <KeyboardAvoider><View style={styles.sheetRoot}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: p.scrim, opacity: motion.shade }]} />
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => motion.dismiss()} accessibilityRole="button" accessibilityLabel="Close milk-type history" />
            <Animated.View testID="milk-history-sheet" accessibilityViewIsModal onAccessibilityEscape={() => motion.dismiss()}
                style={[styles.sheet, { height: motion.height }]}>
                <Surface colors={p.panel} highlight={p.highlight} radius={28} />
                <View {...motion.pan.panHandlers} style={styles.sheetHeader}>
                    <View style={styles.grabber} /><View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.title}>Milk Type History</Text>
                        <Control material={{ surface: p.control }} radius={22} style={styles.close} onPress={() => motion.dismiss()}
                            accessibilityRole="button" accessibilityLabel="Close history"><Ionicons name="close" size={24} color={p.azure} /></Control></View>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.sheetContent, { paddingBottom: 24 + insets.bottom }]}>{children}</ScrollView>
            </Animated.View>
        </View></KeyboardAvoider>{overlays}
    </Modal>;
}

function MilkPeriodEditor({ childId, record, today, visible, onClose }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const [form, setForm] = useState(() => record ? { milk_type: record.milk_type, start_date: record.start, end_date: record.end || null, notes: record.notes || "" }
        : { milk_type: "Breastmilk", start_date: today, end_date: null, notes: "" });
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const save = useRecordSave(visible, childId, "milk-type-periods", record?.id);
    const set = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setError(""); };
    const submit = async () => {
        if (!milkPeriodInfo(form, today).valid) { setError("Choose a milk type and valid dates. End date must be on or after start date."); return; }
        setBusy(true); setError("");
        try { await save(form); onClose(); } catch (e) { setError(e.message || "Could not save this period. Please retry."); } finally { setBusy(false); }
    };
    const remove = async () => {
        setBusy(true); setError("");
        try { await api.deleteRecord(childId, "milk-type-periods", record.id); return true; } finally { setBusy(false); }
    };
    return <RecordFormSheet visible={visible} title={`${record ? "Edit" : "Add"} Milk Type Period`} onClose={onClose}
        onSubmit={submit} busy={busy} error={error} submitLabel={record ? "Save Changes" : "Save Period"}
        record={record} onDelete={record ? remove : undefined} deleteTitle="Delete milk-type period?" deleteMessage="This deletes only this saved period. Feeding entries are preserved.">
        <RecordFormGroup><Text style={styles.sectionTitle}>Milk Type</Text>
            <View style={styles.typeOptions}>{MILK_TYPES.map(t => <Control key={t} material={colors.milkType[t]} active={form.milk_type === t}
                style={styles.typeOption} onPress={() => set("milk_type", t)} disabled={busy} accessibilityRole="button" accessibilityLabel={t}
                accessibilityState={{ selected: form.milk_type === t, disabled: busy }}><Text style={[styles.caption, { color: colors.milkType[t].ink }]}>{t}</Text></Control>)}</View>
            <DateField label="Start Date" value={form.start_date} onChange={date => set("start_date", date)} required disabled={busy} />
            <View style={styles.switchRow}><Text style={styles.caption}>Open-ended period</Text><Switch value={form.end_date == null} disabled={busy} accessibilityLabel="Open-ended period"
                onValueChange={open => set("end_date", open ? null : form.start_date)} /></View>
            {form.end_date != null ? <DateField label="End Date" value={form.end_date} onChange={date => set("end_date", date)} minimumDate={form.start_date} disabled={busy} /> : null}
            <Text style={styles.caption}>Both calendar dates count. An open-ended period is current only once its start date arrives.</Text>
            <Field label="Notes" value={form.notes} onChangeText={notes => set("notes", notes)} multiline editable={!busy} />
        </RecordFormGroup>
    </RecordFormSheet>;
}

export default function MilkTypeCard({ childId, periods, feeds, legacy, today, loading, loadFailed, feedsUnavailable, feedsFailed, onRetry, onOpenEntry }) {
    const { colors } = useTheme(), p = { ...colors.appointmentDashboard, ...colors.milkTypeDashboard };
    const styles = useMemo(() => makeStyles(p), [p]);
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0), [range, setRange] = useState("7"), [query, setQuery] = useState("");
    const [visible, setVisible] = useState(10), [legacyVisible, setLegacyVisible] = useState(10);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [detail, setDetail] = useState(null), [editor, setEditor] = useState(null), [deleteCandidate, setDeleteCandidate] = useState(null);
    const [deleting, setDeleting] = useState(false), [deleteError, setDeleteError] = useState("");
    const chart = useMemo(() => buildMilkFeedingChart(feeds, range, today), [feeds, range, today]);
    const window = chart.window;
    const current = useMemo(() => currentMilkPeriods(periods, legacy.current, today), [periods, legacy.current, today]);
    const rows = useMemo(() => periods.map(row => milkPeriodInfo(row, today)).sort((a, b) => b.start.localeCompare(a.start) || Number(b.id) - Number(a.id)), [periods, today]);
    const legacyRows = useMemo(() => legacy.periods.map((row, index) => ({ ...row, id: `legacy-${index}`, durationLabel: `${row.days.toLocaleString()} ${row.days === 1 ? "day" : "days"}`,
        dateLabel: `${shortDate(row.start)} – ${shortDate(row.end)}`, status: "Derived from feeding history" })), [legacy.periods]);
    const matching = useMemo(() => searchMilkHistory(rows, query), [rows, query]);
    const matchingLegacy = useMemo(() => searchMilkHistory(legacyRows, query), [legacyRows, query]);
    const selected = detail?.legacy ? legacyRows.find(row => row.id === detail.id) : rows.find(row => String(row.id) === String(detail?.id));
    const open = row => setDetail({ id: row.id, legacy: String(row.id).startsWith("legacy-") });
    const sourceEntries = selected?.sourceIds ? feeds.filter(feed => selected.sourceIds.includes(feed.id)) : [];
    const plan = selected ? { title: selected.type, categoryLabel: detail.legacy ? "Feeding-derived history" : "Milk Type Period", color: p.azure,
        status: selected.status, date: selected.start, showTime: false, showReminder: false, notes: selected.notes,
        showNotes: !detail.legacy, deleteLabel: "Delete period", details: [{ label: "Start", value: shortDate(selected.start) || "Not recorded" },
            { label: "End", value: selected.end ? shortDate(selected.end) : "Open-ended" }, { label: "Duration", value: selected.durationLabel }] } : null;
    const remove = async () => {
        setDeleting(true); setDeleteError("");
        try { await api.deleteRecord(childId, "milk-type-periods", deleteCandidate.id); setDeleteCandidate(null); setDetail(null); }
        catch (e) { setDeleteError(e.message || "Could not delete this period."); } finally { setDeleting(false); }
    };
    const more = (total, count, setCount, noun) => total > count ? <Control material={{ surface: p.control }} radius={999} style={styles.more}
        onPress={() => setCount(count + 10)} accessibilityRole="button" accessibilityLabel={`Show more ${noun}, ${total - count} remaining`}>
        <Ionicons name="chevron-down" size={18} color={p.azure} /><Text style={styles.moreText}>Show more ({total - count} remaining)</Text></Control> : null;
    const search = <View><View style={styles.search}><Surface colors={p.row} highlight={p.highlight} radius={999} /><Ionicons name="search-outline" size={20} color={p.secondary} />
        <TextInput testID="milk-search" value={query} onChangeText={text => { setQuery(text); setVisible(10); setLegacyVisible(10); }} placeholder="Search milk type or date..."
            placeholderTextColor={p.secondary} style={styles.searchInput} accessibilityLabel="Search all milk-type history" />
        {query ? <Control material={{ surface: p.control }} radius={22} style={styles.clear} onPress={() => { setQuery(""); setVisible(10); setLegacyVisible(10); }} accessibilityRole="button" accessibilityLabel="Clear milk history search"><Ionicons name="close" size={18} color={p.azure} /></Control> : null}
    </View></View>;
    const history = full => <>
        <View style={styles.sectionHeading}><View style={styles.body}><Text style={styles.sectionTitle}>{full ? "Saved Periods" : "Recent Records"}</Text>
            <Text style={styles.caption}>Your latest recorded milk-type periods.</Text></View>
            {!full ? <Control material={{ surface: p.row }} radius={22} style={styles.viewAll} onPress={() => setHistoryOpen(true)} accessibilityRole="button" accessibilityLabel="View all milk-type history">
                <Text style={styles.moreText}>View All</Text><Ionicons name="chevron-forward" size={17} color={p.azure} /></Control> : null}</View>
        <View style={styles.gutter}><AnimatedReveal duration={240} contentStyle={styles.list}>
            {matching.slice(0, full ? visible : 5).map(row => <MilkPeriodRow key={row.id} period={row} onOpen={open} />)}
            {!matching.length && !loading && !loadFailed ? <View testID="milk-empty" style={styles.empty}><MilkIcon size={62} /><Text style={styles.emptyTitle}>{query ? "No periods match your search." : legacyRows.length ? "No saved milk-type periods yet." : "No milk-type history recorded yet."}</Text>
                {!query ? <Text style={styles.caption}>Add a milk-type record to start tracking changes over time.</Text> : null}</View> : null}
            {loading ? <SkeletonBlock height={100} borderRadius={22} /> : null}
            {full ? more(matching.length, visible, setVisible, "saved periods") : null}
        </AnimatedReveal></View>
        <Text style={styles.sectionTitle}>History derived from feeding logs</Text>{full ? <Text style={styles.caption}>Existing feeding-derived runs are preserved. These are not saved periods or continuous consumption measurements.</Text> : null}
        <View style={styles.gutter}><AnimatedReveal duration={240} contentStyle={styles.list}>
            {matchingLegacy.slice(0, full ? legacyVisible : 5).map(row => <MilkPeriodRow key={row.id} period={row} onOpen={open} />)}
            {!matchingLegacy.length && !feedsUnavailable ? <Text style={styles.caption}>{query ? "No feeding-derived history matches your search." : "No feeding-derived milk history yet."}</Text> : null}
            {full ? more(matchingLegacy.length, legacyVisible, setLegacyVisible, "feeding-derived periods") : null}
        </AnimatedReveal></View>
    </>;
    const overlays = <>
        <PlanDetail visible={Boolean(selected) && !deleteCandidate} plan={plan} heroContent={<MilkIcon size={56} />} onClose={() => setDetail(null)}
            onEdit={selected && !detail.legacy ? () => { setEditor({ record: selected }); setDetail(null); } : undefined}
            onDelete={selected && !detail.legacy ? () => { setDeleteCandidate(selected); setDeleteError(""); } : undefined} deleting={deleting}>
            {detail?.legacy ? <View style={styles.list}><Text style={styles.sectionTitle}>Source feeding entries</Text>{sourceEntries.map(feed => <Control key={feed.id} material={{ surface: p.row }} style={styles.more}
                onPress={() => { setDetail(null); setHistoryOpen(false); onOpenEntry(feed); }} accessibilityRole="button" accessibilityLabel={`View source ${feed.milkType} entry, ${shortDate(feed.date)} ${feed.time || ""}`}><Text style={styles.caption}>{feed.milkType} · {shortDate(feed.date)} {feed.time || ""}</Text></Control>)}</View> : null}
        </PlanDetail>
        {editor ? <MilkPeriodEditor key={editor.record?.id || "new"} visible childId={childId} record={editor.record} today={today} onClose={() => setEditor(null)} /> : null}
        <DeleteConfirmation visible={Boolean(deleteCandidate)} title="Delete milk-type period?" message="This deletes only this saved period. Feeding entries are preserved."
            busy={deleting} error={deleteError} onCancel={() => setDeleteCandidate(null)} onConfirm={remove} />
    </>;
    const notice = loadFailed ? <View style={styles.notice}><Text style={styles.caption}>Saved milk-type periods could not be refreshed. {periods.length ? "Showing the last loaded periods." : "Feeding history is shown separately below."}</Text>
        <Control material={{ surface: p.control }} onPress={onRetry} style={styles.more} accessibilityRole="button" accessibilityLabel="Retry loading milk-type periods"><Text style={styles.moreText}>Retry</Text></Control></View> : null;
    return <View testID="milk-type-card" style={styles.panel} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        <Surface colors={p.panel} highlight={p.highlight} radius={28} />
        <View style={styles.header}><View style={styles.headerIcon}><MilkIcon size={52} /></View><View style={styles.body}><Text style={styles.title}>Milk Type</Text>
            <Text style={styles.subtitle}>What the baby has been drinking.</Text></View>
            <Control material={{ surface: p.control }} radius={24} style={styles.add} onPress={() => setEditor({ record: null })} accessibilityRole="button" accessibilityLabel="Add milk-type period">
                <Ionicons name="add" size={28} color={p.azure} /></Control></View>
        {notice}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ranges} style={styles.rangeScroll}>{MILK_RANGES.map(option => <Control key={option.key} testID={`milk-range-${option.key}`} material={p.all} active={range === option.key} radius={999}
            style={[styles.range, { minWidth: 88 * fontScale, width: Math.max(88 * fontScale, (width - 56) / 4), borderColor: range === option.key ? p.azure : p.divider }]} onPress={() => setRange(option.key)} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: range === option.key }}>
            <Text style={[styles.rangeText, { color: range === option.key ? p.azure : p.secondary }]}>{option.label}</Text></Control>)}</ScrollView>
        <Text style={styles.caption}>{shortDate(window.from)} – {shortDate(window.to)}</Text>
        <View testID="milk-analysis" style={styles.chart}><Surface colors={p.row} highlight={p.highlight} radius={24} />
            <ListTransition filter={range}><MilkFeedingStackedChart key={range} chart={chart} unavailable={feedsUnavailable} stale={feedsFailed} onOpenEntry={onOpenEntry} /></ListTransition>
            <View testID="milk-metrics" style={[styles.metrics, width > 0 && width < 310 * fontScale && styles.stacked]}>{MILK_TYPES.map(t => <View key={t} accessible
                accessibilityLabel={`${t}, ${feedsUnavailable ? "feeding count unavailable" : `${chart.totals[t]} recorded feedings${chart.total ? `, ${feedingPercentage(chart.percentages[t])} of categorized feeds` : ""}`}`}
                style={[styles.metric, width >= 560 * fontScale && styles.wideMetric, width > 0 && width < 310 * fontScale && styles.compactMetric,
                    { backgroundColor: colors.milkType[t].surface[0], boxShadow: colors.milkType[t].shadow }]}>
                <Surface colors={colors.milkType[t].surface} highlight={p.highlight} radius={18} /><MilkAnalyticIcon kind={t} />
                <View style={styles.metricBody}><Text style={styles.value}>{feedsUnavailable ? "\u2014" : chart.totals[t].toLocaleString()}</Text>
                    <Text style={[styles.metricLabel, { color: colors.milkType[t].ink }]}>{t}</Text>
                    <Text style={styles.metricNote}>{feedsUnavailable ? "Unavailable" : chart.total ? `${feedingPercentage(chart.percentages[t])} of feeds` : "Feedings"}</Text>
                </View></View>)}</View>
        </View>
        <View style={styles.divider} />
        {search}
        {history(false)}
        {!historyOpen ? overlays : null}
        <MilkHistorySheet visible={historyOpen} onClose={() => setHistoryOpen(false)} overlays={historyOpen ? overlays : null}>
        {current.periods.length > 0 ? <View testID="milk-current" style={styles.current}><Surface colors={p.all.surface} highlight={p.highlight} radius={18} /><MilkIcon size={32} />
            <View style={styles.body}><Text style={styles.caption}>{current.source}</Text>{current.periods.map((row, index) => <Text key={row.id || index} style={styles.currentText}>Currently on {row.type} · {row.durationLabel}</Text>)}</View></View> : null}
            {search}{notice}
            {feedsUnavailable || feedsFailed ? <Text style={styles.caption}>Feeding-derived history may be incomplete until its records refresh.</Text> : null}
            {history(true)}
        </MilkHistorySheet>
    </View>;
}

const makeStyles = p => StyleSheet.create({
    panel: { padding: 16, borderRadius: 28, backgroundColor: p.panel[0], boxShadow: p.panelShadow, marginBottom: 24, gap: 18, overflow: "visible" },
    header: { flexDirection: "row", alignItems: "center", gap: 12 }, title: { ...type.heading, fontSize: 20, lineHeight: 26, color: p.text, minWidth: 0, flexShrink: 1 },
    headerIcon: { borderRadius: 26, boxShadow: p.iconShadow }, recordIcon: { borderRadius: 24, boxShadow: p.iconShadow },
    subtitle: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary }, add: { width: 48, height: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", boxShadow: p.iconShadow },
    caption: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, flexShrink: 1 }, current: { borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, boxShadow: p.rowShadow },
    body: { flex: 1, minWidth: 0, gap: 3 }, currentText: { ...type.bodyStrong, fontSize: 13, lineHeight: 20, color: p.text }, notice: { gap: 6 },
    rangeScroll: { marginHorizontal: -8, flexGrow: 0, overflow: "visible" }, ranges: { flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingVertical: 6 }, range: { minHeight: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 }, rangeText: { ...type.caption, fontWeight: "600", fontSize: 13, lineHeight: 19 },
    chart: { borderRadius: 24, padding: 16, gap: 18, backgroundColor: p.row[0], boxShadow: p.chartShadow, overflow: "visible" },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: p.divider }, sectionTitle: { ...type.bodyStrong, fontSize: 16, lineHeight: 23, color: p.text },
    metrics: { flexDirection: "row", gap: 10 }, stacked: { flexDirection: "column" }, metric: { flex: 1, minWidth: 0, padding: 8, gap: 8, borderRadius: 18, alignItems: "center" },
    wideMetric: { flexDirection: "row", justifyContent: "center" }, compactMetric: { flexDirection: "row", flex: 0, justifyContent: "center", gap: 16 },
    metricBody: { minWidth: 0, gap: 3, alignItems: "center" },
    value: { ...type.heading, fontSize: 22, lineHeight: 28, color: p.text }, metricLabel: { ...type.caption, fontSize: 12, lineHeight: 18, textAlign: "center", fontWeight: "600", flexShrink: 1 }, metricNote: { ...type.caption, fontSize: 11, lineHeight: 17, textAlign: "center", color: p.secondary, flexShrink: 1 },
    search: { minHeight: 48, borderRadius: 999, paddingLeft: 14, paddingRight: 4, flexDirection: "row", alignItems: "center", gap: 8, boxShadow: p.rowShadow }, searchInput: { position: "relative", flex: 1, minWidth: 0, minHeight: 48, color: p.text, fontSize: 13, ...(Platform.OS === "web" ? { outlineColor: p.azure, outlineOffset: 2 } : {}) }, clear: { width: 44, alignItems: "center", justifyContent: "center" },
    sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12 }, viewAll: { paddingHorizontal: 10, flexDirection: "row", gap: 2, alignItems: "center", flexShrink: 0 },
    gutter: { marginHorizontal: -10 }, list: { padding: 12, gap: 14 }, record: { borderRadius: 22, minHeight: 108, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: p.rowShadow }, recordTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 22, color: p.text },
    dateLine: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
    chevron: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: p.iconShadow },
    sheetRoot: { flex: 1, justifyContent: "flex-end" }, sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: p.panel[0], overflow: "hidden" },
    sheetHeader: { padding: 18, gap: 12 }, grabber: { width: 44, height: 4, borderRadius: 2, backgroundColor: p.divider, alignSelf: "center" },
    close: { width: 44, height: 44, marginLeft: "auto", alignItems: "center", justifyContent: "center" }, sheetContent: { padding: 18, gap: 18 },
    more: { minHeight: 48, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, moreText: { ...type.label, color: p.azure, textAlign: "center", flexShrink: 1 },
    empty: { padding: 16, gap: 10, alignItems: "center" }, emptyTitle: { ...type.bodyStrong, color: p.text, textAlign: "center" }, typeOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, typeOption: { flexGrow: 1, padding: 10, alignItems: "center", justifyContent: "center" }, switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
});
