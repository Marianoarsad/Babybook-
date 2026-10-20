import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, type } from "../../theme";
import { overdueBy } from "../../utils/dates";
import { DUE_SOON_DAYS, IMMUNIZATION_BATCH_SIZE, selectImmunizations, revealImmunization } from "../../utils/immunizationSummary";
import { DashboardSurface as Surface, DashboardControl as Control, DashboardListTransition as ListTransition } from "./ConsultationsAppointmentsCard";
import VaccineIcon from "./VaccineIcon";
import ImmunizationStatusIcon from "./ImmunizationStatusIcon";
import AllRecordsIcon from "./AllRecordsIcon";
import AnimatedReveal from "./AnimatedReveal";
import { ImmunizationsSkeleton } from "./Skeleton";
import useSoftPress from "./useSoftPress";

const FILTERS = [["all", "All"], ["completed", "Completed"], ["dueSoon", "Due Soon"], ["overdue", "Overdue"]];

export const ImmunizationSummaryMetrics = memo(function ImmunizationSummaryMetrics({ counts, filter, onSelect, disabled }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const columns = width >= 600 * fontScale ? 4 : width > 0 && (width - 10) / 2 < 100 * fontScale ? 1 : 2;
    const compact = width > 0 && width / columns < 148 * fontScale;
    const materials = { all: p.all, completed: p.completed, ...colors.immunizationMetrics };
    const groups = [];
    for (let i = 0; i < FILTERS.length; i += columns) groups.push(FILTERS.slice(i, i + columns));
    return <View testID="immunization-metrics" style={styles.metrics} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {groups.map((group, i) => <View key={i} style={styles.metricRow}>{group.map(([key, label]) => <Control key={key}
            testID={`immunization-filter-${key}`} material={materials[key]} active={filter === key} disabled={disabled}
            style={[styles.metric, compact && styles.compactMetric]} onPress={() => onSelect(key)} accessibilityRole="button"
            accessibilityLabel={`${label}, ${counts ? counts[key] : "count unavailable"}${counts ? counts[key] === 1 ? " dose" : " doses" : ""}${key === "dueSoon" ? `, today through ${DUE_SOON_DAYS} days ahead` : ""}`}
            accessibilityState={{ selected: filter === key, disabled: !!disabled }}>
            {key === "all" ? <AllRecordsIcon /> : <ImmunizationStatusIcon kind={key} material={materials[key]} />}
            <View style={styles.metricBody}><Text style={[styles.count, compact && styles.centered]}>{counts ? counts[key].toLocaleString() : "—"}</Text>
                <Text style={[styles.metricLabel, compact && styles.centered, { color: materials[key].ink, fontWeight: filter === key ? "700" : "500" }]}>{label}</Text>
                {key === "dueSoon" ? <Text style={[styles.metricHint, compact && styles.centered]}>Next {DUE_SOON_DAYS} days</Text> : null}
            </View>
            {filter === key ? <Ionicons accessible={false} name="checkmark" size={13} color={materials[key].ink} style={styles.selectedMark} /> : null}
        </Control>)}</View>)}
    </View>;
});

export const VaccineRecordItem = memo(function VaccineRecordItem({ vaccine, onOpen, onToggle, busy, pending, thumbnailUrl, onOpenAttachment, navigationRef, onNavigationLayout, navigationHighlight }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const { respond, transform } = useSoftPress();
    const { width, fontScale } = useWindowDimensions();
    const [focused, setFocused] = useState(false), [pressed, setPressed] = useState(false), [brokenPhoto, setBrokenPhoto] = useState("");
    const focus = e => setFocused(Platform.OS === "web" && Boolean(e.currentTarget?.matches?.(":focus-visible")));
    const press = down => { setPressed(down); respond(down); };
    const tone = vaccine.status === "completed" ? p.completed : colors.immunizationMetrics[vaccine.status];
    const overdue = vaccine.status === "overdue" ? overdueBy(vaccine.dueDate) : "";
    return <Animated.View ref={navigationRef} collapsable={false} onLayout={onNavigationLayout} testID={`vaccine-row-${vaccine.id}`} style={[styles.item, { transform, boxShadow: pressed ? p.pressedShadow : p.rowShadow }]}>
        <Surface colors={p.row} highlight={p.highlight} />
        {navigationHighlight ? <Animated.View pointerEvents="none" testID="vaccine-navigation-highlight" style={[StyleSheet.absoluteFillObject,
            { borderRadius: 22, borderWidth: 2, borderColor: p.azure, backgroundColor: colors.vaccinationProgress.focus, opacity: navigationHighlight }]} /> : null}
        <View style={styles.itemContent}>
            <Pressable onPress={() => onOpen(vaccine)} onPressIn={() => press(true)} onPressOut={() => press(false)}
                onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); press(false); }} accessibilityRole="button"
                accessibilityLabel={`View ${vaccine.vaccineName} details. ${vaccine.statusLabel}. ${vaccine.dateLabel}`}
                style={[styles.itemBody, Platform.OS === "web" && { outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 2, outlineColor: p.azure }]}>
                <VaccineIcon size={44} />
                <View testID="vaccine-row-information" style={styles.information}>
                    <View style={styles.titleRow}><Text style={styles.itemTitle}>{vaccine.vaccineName}</Text>
                        {vaccine.isAutoGenerated ? <View style={[styles.epi, { backgroundColor: colors.successBg }]}><Text style={[styles.epiText, { color: colors.success }]}>EPI</Text></View> : null}
                    </View>
                    {vaccine.visitName ? <Text style={styles.notes}>{vaccine.visitName}</Text> : null}
                    {vaccine.doseNumber != null ? <Text style={styles.notes}>Dose {vaccine.doseNumber}</Text> : null}
                    <Text style={[styles.status, { color: tone?.ink || p.secondary }]}>{vaccine.statusLabel}{overdue ? ` · ${overdue}` : ""}</Text>
                    {vaccine.reactionSeverity && vaccine.reactionSeverity !== "none" ? <Text style={[styles.notes, { color: vaccine.reactionSeverity === "severe" ? colors.danger : p.secondary }]}>
                        {vaccine.reactionSeverity === "severe" ? "Severe reaction" : "Mild reaction"}{vaccine.reaction ? `: ${vaccine.reaction}` : ""}
                    </Text> : vaccine.reaction ? <Text style={styles.notes}>{vaccine.reaction}</Text> : null}
                    {vaccine.notes ? <Text style={styles.notes}>{vaccine.notes}</Text> : null}
                    <View style={styles.metaPair}><Ionicons accessible={false} name="calendar-outline" size={13} color={p.secondary} /><Text style={styles.metadata}>{vaccine.dateLabel}</Text></View>
                </View>
            </Pressable>
            {thumbnailUrl ? <View style={styles.footer}>
                <Pressable key={thumbnailUrl} onPress={() => onOpenAttachment(vaccine)} style={styles.attachment} accessibilityRole="button" accessibilityLabel={`View attached photo for ${vaccine.vaccineName}`}>
                    {brokenPhoto === thumbnailUrl ? <Ionicons accessible={false} name="image-outline" size={24} color={p.azure} /> : <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} onError={() => setBrokenPhoto(thumbnailUrl)} accessible={false} />}
                    <Text style={styles.attachmentText}>View photo</Text>
                </Pressable>
            </View> : null}
        </View>
        <Control material={{ surface: p.control }} radius={999} onPress={() => onToggle(vaccine.id)} disabled={busy} style={[styles.doseAction, (width < 360 || fontScale >= 1.5) && styles.compactDoseAction]}
            accessibilityRole="button" accessibilityLabel={`${vaccine.isCompleted ? "Undo recorded dose of" : "Mark given"} ${vaccine.vaccineName}`}
            accessibilityState={{ disabled: !!busy, busy: !!pending }}>
            <Ionicons accessible={false} name={vaccine.isCompleted ? "arrow-undo-outline" : "checkmark-circle-outline"} size={17} color={p.azure} />
            <Text style={styles.actionText}>{pending ? "Saving…" : vaccine.isCompleted ? "Undo" : "Mark given"}</Text>
        </Control>
    </Animated.View>;
});

export default function ImmunizationRecordsCard({ summary, loading, loadFailed, onRetry, onAdd, onOpen, onToggle, busyId, completing,
    attachmentUrl, onOpenAttachment, canGenerate, generating, onGenerate, navigationFocus }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const [selection, setSelection] = useState({ filter: "all", search: "", visible: IMMUNIZATION_BATCH_SIZE });
    const [searchFocused, setSearchFocused] = useState(false);
    const { filter, search, visible } = selection;
    const results = useMemo(() => selectImmunizations(summary.records, filter, search, visible), [summary.records, filter, search, visible]);
    const selectFilter = useCallback(next => setSelection(previous => previous.filter === next ? previous : { ...previous, filter: next, visible: IMMUNIZATION_BATCH_SIZE }), []);
    const changeSearch = value => setSelection(previous => ({ ...previous, search: value, visible: IMMUNIZATION_BATCH_SIZE }));
    useEffect(() => {
        if (navigationFocus?.pending) setSelection(previous => revealImmunization(summary.records, previous, navigationFocus.id));
    }, [navigationFocus?.pending, navigationFocus?.id, summary.records]);
    return <View ref={navigationFocus?.sectionRef} collapsable={false} onLayout={navigationFocus?.onLayout} testID="immunizations-card" style={styles.panel}>
        <Surface colors={p.panel} highlight={p.highlight} radius={28} />
        <View style={styles.header}><VaccineIcon size={44} showBackground={false} /><Text style={styles.title}>Immunization Records</Text>
            <Control material={{ surface: p.control }} radius={22} style={styles.add} onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add vaccination"><Ionicons accessible={false} name="add" size={28} color={p.azure} /></Control>
        </View>
        <Text style={styles.subtitle}>Track your child's vaccinations and upcoming schedules.</Text>
        <ImmunizationSummaryMetrics counts={loading || loadFailed ? null : summary.counts} filter={filter} disabled={loading || loadFailed}
            onSelect={selectFilter} />
        <View style={[styles.search, Platform.OS === "web" && searchFocused && { outlineStyle: "solid", outlineWidth: 2, outlineOffset: 3, outlineColor: p.azure }]}>
            <Surface colors={p.row} highlight={p.highlight} radius={999} /><Ionicons accessible={false} name="search" size={20} color={p.chevron} />
            <TextInput testID="vaccine-search" value={search} onChangeText={changeSearch} placeholder="Search vaccines or visits..." placeholderTextColor={p.secondary}
                accessibilityLabel="Search vaccines or visits" style={[styles.searchInput, Platform.OS === "web" && { outlineStyle: "none" }]} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} />
            {search ? <Pressable onPress={() => changeSearch("")} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear vaccine search"><Ionicons accessible={false} name="close-circle" size={20} color={p.chevron} /></Pressable> : null}
        </View>
        {canGenerate ? <Control material={{ surface: p.control }} style={styles.more} onPress={onGenerate} disabled={generating} accessibilityRole="button" accessibilityLabel="Generate vaccination schedule" accessibilityState={{ disabled: !!generating, busy: !!generating }}><Text style={styles.moreText}>{generating ? "Generating…" : "Generate schedule"}</Text></Control> : null}
        {loading ? <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading vaccinations"><ImmunizationsSkeleton count={3} /></View>
        : loadFailed ? <View style={styles.empty}><Text style={styles.emptyText}>Vaccinations could not be loaded.</Text><Control material={{ surface: p.control }} style={styles.more} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading vaccinations"><Text style={styles.moreText}>Retry</Text></Control></View>
        : <View style={styles.reveal}><AnimatedReveal duration={navigationFocus?.pending ? 0 : 240} contentStyle={styles.listSpace}><ListTransition filter={filter} testID="vaccine-list-transition">
            <View testID="vaccine-results" style={styles.groups} accessibilityLiveRegion="polite">
                {results.groups.map(([label, records]) => <View key={label} style={styles.group}><Text style={styles.groupTitle}>{label.toUpperCase()}</Text>
                    {records.map(vaccine => <VaccineRecordItem key={vaccine.id} vaccine={vaccine} onOpen={onOpen} onToggle={onToggle}
                        navigationRef={navigationFocus?.pending && String(vaccine.id) === navigationFocus.id ? navigationFocus.rowRef : undefined}
                        onNavigationLayout={navigationFocus?.onLayout}
                        navigationHighlight={String(vaccine.id) === navigationFocus?.highlightId ? navigationFocus.opacity : null}
                        busy={busyId != null || completing} pending={busyId === vaccine.id} thumbnailUrl={attachmentUrl?.(vaccine)} onOpenAttachment={onOpenAttachment} />)}
                </View>)}
                {!results.total ? <View testID="vaccine-empty" style={styles.empty}><Surface colors={p.row} highlight={p.highlight} /><VaccineIcon size={48} /><Text style={styles.emptyText}>{results.emptyMessage}</Text></View> : null}
                {results.remaining > 0 ? <Control material={{ surface: p.control }} radius={999} style={styles.more} onPress={() => setSelection(previous => ({ ...previous, visible: previous.visible + IMMUNIZATION_BATCH_SIZE }))}
                    accessibilityRole="button" accessibilityLabel={`Show more vaccinations, ${results.remaining} remaining`}><Ionicons accessible={false} name="chevron-down" size={18} color={p.azure} /><Text style={styles.moreText}>Show more ({results.remaining.toLocaleString()} remaining)</Text></Control> : null}
            </View>
        </ListTransition></AnimatedReveal></View>}
    </View>;
}

const makeStyles = p => StyleSheet.create({
    panel: { padding: 14, borderRadius: 28, backgroundColor: p.panel[0], boxShadow: p.panelShadow, marginBottom: 20, overflow: "visible" },
    header: { flexDirection: "row", alignItems: "center", gap: 10 }, title: { ...type.heading, fontSize: 18, lineHeight: 24, color: p.text, flex: 1, minWidth: 0 },
    subtitle: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary, marginTop: 8 }, add: { width: 44, height: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    metrics: { marginTop: 16, gap: 10 }, metricRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
    metric: { flex: 1, minWidth: 0, minHeight: 106, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }, compactMetric: { flexDirection: "column", gap: 6 },
    metricBody: { flex: 1, minWidth: 0 }, count: { ...type.heading, fontSize: 23, lineHeight: 29, color: p.text }, metricLabel: { ...type.caption, fontSize: 13, lineHeight: 19, marginTop: 2 },
    metricHint: { ...type.caption, fontSize: 10, lineHeight: 15, color: p.secondary }, centered: { textAlign: "center" }, selectedMark: { position: "absolute", top: 8, right: 8 },
    search: { marginTop: 18, paddingLeft: 14, paddingRight: 4, minHeight: 48, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8, boxShadow: p.rowShadow },
    searchInput: { position: "relative", ...type.caption, fontSize: 13, color: p.text, minHeight: 48, minWidth: 0, flex: 1 }, clear: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
    reveal: { marginHorizontal: -10 }, listSpace: { paddingHorizontal: 12, paddingTop: 18, paddingBottom: 10 }, groups: { gap: 18 }, group: { gap: 10 }, groupTitle: { ...type.label, fontSize: 12, lineHeight: 18, color: p.secondary, paddingHorizontal: 3 },
    item: { borderRadius: 22, backgroundColor: p.row[0], overflow: "visible", flexDirection: "row", alignItems: "center" }, itemContent: { flex: 1, minWidth: 0 }, itemBody: { minWidth: 0, minHeight: 100, borderRadius: 22, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    information: { flex: 1, minWidth: 0 }, titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 }, itemTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 21, color: p.text, flexShrink: 1 },
    epi: { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 }, epiText: { ...type.caption, fontSize: 10, lineHeight: 14 },
    status: { ...type.caption, fontSize: 12, lineHeight: 18, marginTop: 3 }, notes: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, marginTop: 2 },
    metaPair: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }, metadata: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, flexShrink: 1 },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, paddingHorizontal: 12, paddingBottom: 12 },
    attachment: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 }, thumbnail: { width: 36, height: 36, borderRadius: 9 }, attachmentText: { ...type.caption, color: p.azure },
    doseAction: { flexShrink: 0, maxWidth: 104, marginRight: 12, minHeight: MIN_TOUCH, paddingHorizontal: 8, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, compactDoseAction: { width: 64, paddingHorizontal: 6, flexDirection: "column", gap: 3 }, actionText: { ...type.label, fontSize: 12, color: p.azure, flexShrink: 1, textAlign: "center" },
    more: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, gap: 8, marginTop: 6 }, moreText: { ...type.label, color: p.azure, textAlign: "center", flexShrink: 1 },
    empty: { padding: 20, borderRadius: 22, gap: 12, alignItems: "center" }, emptyText: { ...type.caption, lineHeight: 20, textAlign: "center", color: p.secondary }, loading: { marginTop: 16 },
});
