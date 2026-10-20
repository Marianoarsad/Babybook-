import VaccineIcon from "./ui/VaccineIcon";
import { recordListLayout } from "../theme";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { usePullToRefresh } from "./ui/PullToRefreshScrollView";
import { useScreenPadTop, useScreenPadBottom } from "../utils/responsive";
import { todayLocal, toLocalISO, numericDate, shortDate } from "../utils/dates";
import { plannedEnd } from "../utils/medication";
import { medicationStatus } from "../utils/viewerRecords";
import { api } from "../utils/api";
import store from "../utils/recordStore.cjs";
import { useToast } from "./ui/Toast";
import { ListEntryCard, EmptyStateCard } from "./common/Cards";
import AnimatedReveal from "./ui/AnimatedReveal";
import ShowMore from "./ui/ShowMore";
import { AppointmentsSkeleton } from "./ui/Skeleton";
import RecordFormSheet, { RecordFormGroup } from "./ui/RecordFormSheet";
import { DateField } from "./ui/DateField";
import MedicationIcon from "./ui/MedicationIcon";
import PlanDetail from "./ui/PlanDetail";
import { MIN_TOUCH, radius, shadow, space, type } from "../theme";

export function notificationGroups(rows, now = new Date()) {
    const today = toLocalISO(now), previous = new Date(now); previous.setDate(previous.getDate() - 1);
    const yesterday = toLocalISO(previous), groups = new Map();
    for (const row of rows) {
        const date = new Date(row.occurredAt), valid = !!row.occurredAt && Number.isFinite(date.getTime());
        const key = valid ? toLocalISO(date) : "undated";
        if (!groups.has(key)) {
            const label = valid ? `${String(date.getDate()).padStart(2, "0")} ${date.toLocaleDateString("en-US", { month: "short" })} ${String(date.getFullYear()).slice(-2)}` : "Date not recorded";
            groups.set(key, { key, title: `${key === today ? "Today, " : key === yesterday ? "Yesterday, " : ""}${label}`, rows: [] });
        }
        groups.get(key).rows.push(row);
    }
    return [...groups.values()];
}

// Existing PlanDetail presentation, without mutation controls on a reminder.
export function notificationDetail(row) {
    const record = row?.source?.record;
    if (!record) return null;
    const medication = row.source.type === "medical-history", vaccine = row.source.type === "vaccination";
    const fields = vaccine ? { Vaccine: record.vaccine_name, Visit: record.visit_name, Dose: record.dose_number, Given: shortDate(record.date_given) }
        : medication ? { Dose: record.dose_amount, Frequency: record.frequency_per_day ? `${record.frequency_per_day} times a day` : "",
            "Course length": record.course_days ? `${record.course_days} days` : "", "Prescribed by": record.prescribed_by,
            "Course ends": shortDate(plannedEnd(record.date_recorded, record.course_days)), Completed: shortDate(record.resolved_date) }
            : { Provider: record.doctor_name, Clinic: record.clinic };
    return { title: record.vaccine_name || record.title || "Record",
        date: vaccine ? record.due_date : medication ? record.date_recorded : record.checkup_date,
        time: record.time_of_visit, showTime: !!record.time_of_visit,
        categoryLabel: vaccine ? "Vaccination" : medication ? "Medication" : "Appointment",
        status: medication ? medicationStatus(record, todayLocal()) : record.status === "completed" ? "Completed" : "Scheduled",
        details: Object.entries(fields).filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => ({ label, value: String(value) })),
        medicationRecord: medication ? record : undefined, notes: record.notes || record.description, showReminder: false };
}

export default function Notifications({ profile, inbox, onNavigate }) {
    const { colors } = useTheme(), toast = useToast();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padTop = useScreenPadTop(), padBottom = useScreenPadBottom();
    const groups = notificationGroups(inbox.rows);
    const [detail, setDetail] = useState(null), [candidate, setCandidate] = useState(null);
    const [endDate, setEndDate] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
    const alive = useRef(true), epoch = useRef(store.getEpoch()).current, locked = useRef(false), attempt = useRef(null);
    const current = () => alive.current && store.getEpoch() === epoch;
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const pull = usePullToRefresh({ scope: profile.id, refreshing: inbox.refreshing, onRefresh: inbox.refresh,
        blocked: inbox.loadingMore || !!detail || !!candidate, error: inbox.error, label: "notifications" });
    const { refresh, refreshError, pullPhase, scrollViewRef } = pull;
    const open = async (row) => {
        if (!await inbox.markRead(row) || !current()) return;
        if (row.kind === "shared_access") onNavigate("share", null, { section: "accessLog", accessEntry: row.source.record });
        else if (row.canComplete) {
            attempt.current = null; setError(""); setEndDate(plannedEnd(row.source.record.date_recorded, row.source.record.course_days)); setCandidate(row.source.record);
        } else setDetail(notificationDetail(row));
    };
    const complete = async () => {
        if (locked.current || !candidate || !current()) return;
        const start = String(candidate.date_recorded).slice(0, 10), selected = new Date(`${endDate}T00:00:00`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !Number.isFinite(selected.getTime()) || toLocalISO(selected) !== endDate || endDate < start || endDate > todayLocal()) {
            setError("Choose a completion date between the start date and today."); return;
        }
        locked.current = true; setBusy(true); setError("");
        try {
            const latest = await api.listRecords(profile.id, "medical-history", { background: true, confirmedOnly: true, sessionEpoch: epoch });
            if (!current()) return;
            const med = latest.find((record) => String(record.id) === String(candidate.id));
            if (!med) throw new Error("This medication was removed. Refresh notifications.");
            if (!med.resolved) {
                if (med.category !== "Medication" || medicationStatus(med, todayLocal()) !== "Course ended"
                    || String(med.date_recorded).slice(0, 10) !== start || Number(med.course_days) !== Number(candidate.course_days)) {
                    throw new Error("This course has changed. Refresh notifications before completing it.");
                }
                await api.saveRecord(profile.id, "medical-history", med.id, { resolved: true, resolved_date: endDate }, attempt);
            }
            if (current()) { setCandidate(null); toast.success("Medication marked completed"); inbox.refresh(); }
        } catch (e) { if (current()) setError(e.message || "Could not confirm completion. Please retry."); }
        finally { locked.current = false; if (current()) setBusy(false); }
    };
    return <>
        <View style={styles.root} {...pull.panHandlers}>
        <Animated.ScrollView ref={scrollViewRef} style={[styles.root, pull.webStyle]}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            {...pull.scrollProps}
            keyboardShouldPersistTaps="handled">
            <View style={styles.filters} accessibilityRole="tablist">
                {["all", "unread"].map((filter) => <TouchableOpacity key={filter} style={[styles.filter, inbox.filter === filter && styles.filterActive]}
                    onPress={() => inbox.selectFilter(filter)} accessibilityRole="tab" accessibilityState={{ selected: inbox.filter === filter }}>
                    <Text style={[styles.filterText, inbox.filter === filter && styles.filterTextActive]}>{filter === "all" ? "All" : "Unread"}</Text>
                </TouchableOpacity>)}
            </View>
            {pull.indicator}
            {refreshError ? <View style={styles.refreshRow}>
                <Text accessibilityRole="alert" style={styles.error}>{refreshError}</Text>
                <TouchableOpacity onPress={refresh} disabled={inbox.refreshing || pullPhase === "refreshing"}
                    accessibilityRole="button" accessibilityLabel="Retry refreshing notifications" style={styles.refresh}>
                    <Text style={styles.refreshText}>Retry</Text>
                </TouchableOpacity>
            </View> : null}
            {!inbox.loaded && inbox.refreshing ? <View style={recordListLayout.inset}><AppointmentsSkeleton count={3} /></View> : null}
            {inbox.loaded && !inbox.rows.length ? <View style={recordListLayout.inset}><EmptyStateCard icon="notifications-outline"
                message={inbox.filter === "unread" ? "You're all caught up. No unread notifications." : "No notifications yet."} /></View> : null}
            <AnimatedReveal contentStyle={recordListLayout.content}>
                {groups.map((group) => <View key={group.key} style={styles.group}>
                    <Text accessibilityRole="header" style={styles.groupTitle}>{group.title}</Text>
                    <View style={styles.groupCard}>
                        {group.rows.map((row, index) => {
                            const tone = row.kind === "vaccination" ? colors.recVaccine : row.kind === "appointment" ? colors.recCheckup
                                : row.kind === "shared_access" ? { on: colors.primary, bg: colors.surfaceAlt } : colors.recMedication;
                            const isMedication = !["shared_access", "vaccination", "appointment"].includes(row.kind);
                            const icon = row.kind === "shared_access" ? "eye-outline" : row.kind === "appointment" ? "calendar-outline" : undefined;
                            const date = new Date(row.occurredAt), valid = !!row.occurredAt && Number.isFinite(date.getTime());
                            const time = valid ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "";
                            return <ListEntryCard key={row.id} title={row.title} subtitle={`${row.subtitle}${row.backfilled ? " · Scheduled reminder" : ""}`}
                                subtitleNumberOfLines={2} dateText={valid ? `${numericDate(toLocalISO(date))}, ${time}` : "Date not recorded"}
                                icon={row.kind === "vaccination" ? <VaccineIcon /> : isMedication ? <MedicationIcon record={row.source?.record} /> : <Ionicons name={icon} size={22} color={tone.on} />} iconBg={isMedication || row.kind === "vaccination" ? "transparent" : tone.bg} iconAlign="center"
                                label={!row.readAt ? <View style={styles.unreadDot} /> : null} labelTrailing
                                accessibilityLabel={`${row.readAt ? "Read" : "Unread"}: ${row.title}, ${row.subtitle}`}
                                onPress={() => open(row)} style={styles.row} />;
                        })}
                    </View>
                </View>)}
                {inbox.loadingMore ? <Text style={styles.hint}>Loading more…</Text> : null}
                {!inbox.loadingMore && inbox.cursor ? <ShowMore total={inbox.filter === "unread" ? inbox.unreadCount : inbox.total}
                    visible={inbox.rows.length} onPress={inbox.loadMore} noun="notifications" /> : null}
            </AnimatedReveal>
        </Animated.ScrollView>
        </View>
        <PlanDetail visible={!!detail} plan={detail} onClose={() => setDetail(null)}
            heroContent={detail?.medicationRecord ? <MedicationIcon record={detail.medicationRecord} size={48} /> : undefined} />
        <RecordFormSheet visible={!!candidate} title="Mark Medication Completed?" onClose={() => !busy && setCandidate(null)}
            onSubmit={complete} submitLabel="Confirm Completion" busy={busy} error={error}>
            <RecordFormGroup>
                <MedicationIcon record={candidate} size={44} />
                <Text style={styles.candidate}>{candidate?.title}</Text>
                <DateField label="Completed on" value={endDate} onChange={setEndDate} disabled={busy}
                    minimumDate={String(candidate?.date_recorded || "").slice(0, 10)} maximumDate={todayLocal()} />
            </RecordFormGroup>
        </RecordFormSheet>
    </>;
}

const makeStyles = (colors) => StyleSheet.create({
    root: { flex: 1, backgroundColor: "transparent" }, content: {  paddingHorizontal: 0},
    filters: { flexDirection: "row", padding: space.xs, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, borderCurve: "continuous", marginBottom: space.md  , marginHorizontal: 20},
    filter: { flex: 1, minHeight: MIN_TOUCH, justifyContent: "center", alignItems: "center", paddingHorizontal: space.sm, borderRadius: radius.md },
    filterActive: { backgroundColor: colors.surface, ...shadow.card },
    filterText: { ...type.bodyStrong, color: colors.textMuted }, filterTextActive: { color: colors.primaryDark },
    refreshRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm , marginHorizontal: 20},
    refresh: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.sm },
    refreshText: { ...type.caption, color: colors.primaryDark }, hint: { ...type.caption, color: colors.textMuted },
    error: { ...type.caption, color: colors.danger, flex: 1 }, group: { marginBottom: space.xl },
    groupTitle: { ...type.heading, color: colors.text, marginBottom: space.md },
    groupCard: { borderRadius: radius.xl, borderCurve: "continuous",   borderColor: colors.hairline,  ...shadow.card  , backgroundColor: "transparent", borderWidth: 0, overflow: "visible", boxShadow: "none"},
    row: { borderWidth: 0,   padding: space.lg  , borderRadius: 24, marginBottom: 12},
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
    unreadDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.primary },
    candidate: { ...type.bodyStrong, color: colors.text, marginBottom: space.md },
});
