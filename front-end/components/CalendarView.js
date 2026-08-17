import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Animated, View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Calendar, CalendarProvider, WeekCalendar } from "react-native-calendars";
import { useTheme } from "../context/ThemeContext";
import { space, radius, shadow, type, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
import { api } from "../utils/api";
import { EmptyStateCard } from "./common/Cards";
import { AppointmentsSkeleton } from "./ui/Skeleton";
import { useRefreshControl } from "./ui/useRefreshControl";
import { DateField, TimeField } from "./ui/DateField";
import { useToast } from "./ui/Toast";
import { scheduleReminder } from "../utils/notifications";
import { storage } from "../utils/storageAdapter";
import { LEAD_TIME_KEY, LEAD_TIME_OPTIONS } from "./settings/GeneralSettings";
import TipStrip from "./ui/TipStrip";
import KeyboardAvoider from "./ui/KeyboardAvoider";
import { todayLocal, toLocalISO } from "../utils/dates";
import { plannedEnd } from "../utils/medication";

// Category -> theme-derived dot/accent color. Kept to semantic status tones
// (not brand hex) so it stays consistent across the girl/boy palette switch.
const CATEGORY_META = {
    vaccination: { label: "Vaccination", icon: "medkit-outline" },
    checkup: { label: "Checkup", icon: "calendar-outline" },
    illness: { label: "Illness", icon: "thermometer-outline" },
    medication: { label: "Medication", icon: "medical-outline" },
    hospitalization: { label: "Hospitalization", icon: "bed-outline" },
    custom: { label: "Custom Event", icon: "bookmark-outline" },
};

function categoryColor(colors, category) {
    switch (category) {
        case "vaccination":
            return colors.info;
        case "checkup":
            return colors.primary;
        case "illness":
            return colors.warning;
        case "medication":
            return colors.success;
        case "hospitalization":
            return colors.danger;
        default:
            return colors.accent;
    }
}

function todayISO() {
    return todayLocal();
}

// Calendar tab: Month/Week/Day views over aggregated records (vaccinations,
// checkups, medical history) — see CLAUDE.md §9. Reminders aren't fetched
// separately: today's schema ties every reminder 1:1 to a vaccination or
// checkup, so showing both would just duplicate the same event twice.
export default function CalendarView({ profile }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const { scrollProps } = useScroll();
    const toast = useToast();

    const [viewMode, setViewMode] = useState("month"); // month | week | day
    const [selectedDate, setSelectedDate] = useState(todayISO());
    const [monthKey, setMonthKey] = useState(0); // bump to force Calendar to re-center on "current"
    const [eventsByDate, setEventsByDate] = useState({});
    const [loading, setLoading] = useState(true);
    const [detailEvent, setDetailEvent] = useState(null);

    const [showEventModal, setShowEventModal] = useState(false);
    const [editingEventId, setEditingEventId] = useState(null);
    const [formTitle, setFormTitle] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formDate, setFormDate] = useState(todayISO());
    const [formTime, setFormTime] = useState("");
    const [formLead, setFormLead] = useState("1");

    const childId = profile?.id;

    const loadEvents = useCallback(async () => {
        if (!childId) return;
        setLoading(true);
        try {
            const [vaccinations, checkups, medHistory, customEvents] = await Promise.all([
                api.listRecords(childId, "vaccinations").catch(() => []),
                api.listRecords(childId, "checkups").catch(() => []),
                api.listRecords(childId, "medical-history").catch(() => []),
                api.listRecords(childId, "calendar-events").catch(() => []),
            ]);

            const byDate = {};
            const add = (dateStr, event) => {
                if (!dateStr) return;
                const key = String(dateStr).slice(0, 10);
                if (!byDate[key]) byDate[key] = [];
                byDate[key].push(event);
            };

            (vaccinations || []).forEach((v) =>
                add(v.due_date, {
                    id: `vax-${v.id}`,
                    category: "vaccination",
                    title: v.vaccine_name,
                    subtitle: v.visit_name || "",
                    notes: v.notes || "",
                    completed: v.status === "completed",
                }),
            );
            (checkups || []).forEach((c) =>
                add(c.checkup_date, {
                    id: `chk-${c.id}`,
                    category: "checkup",
                    title: c.title || "Checkup",
                    subtitle: c.doctor_name || c.clinic || "",
                    notes: c.notes || "",
                    completed: c.status === "completed",
                }),
            );
            (medHistory || []).forEach((m) => {
                const category =
                    m.category === "Medication"
                        ? "medication"
                        : m.category === "Hospitalization"
                          ? "hospitalization"
                          : "illness";
                const entry = {
                    id: `med-${m.id}`,
                    category,
                    title: m.title,
                    subtitle: m.category,
                    notes: m.description || m.notes || "",
                    completed: !!m.resolved,
                };
                add(m.date_recorded, entry);
                // A course runs for days, and marking only its first day made a
                // week of antibiotics look like a one-off event. Fill in every
                // day up to the end — the actual finish date if the parent
                // recorded one, otherwise the planned one. Capped so a
                // mistyped course length cannot paint a year of the calendar.
                if (m.category === "Medication" && m.date_recorded) {
                    const last = m.resolved_date || plannedEnd(m.date_recorded, m.course_days);
                    if (last && last > String(m.date_recorded).slice(0, 10)) {
                        const cursor = new Date(`${String(m.date_recorded).slice(0, 10)}T00:00:00`);
                        for (let i = 0; i < 120; i++) {
                            cursor.setDate(cursor.getDate() + 1);
                            const iso = toLocalISO(cursor);
                            if (!iso || iso > last) break;
                            add(iso, { ...entry, id: `med-${m.id}-${iso}` });
                        }
                    }
                }
            });
            (customEvents || []).forEach((e) =>
                add(e.event_date, {
                    id: `cal-${e.id}`,
                    rawId: e.id,
                    category: "custom",
                    title: e.title,
                    subtitle: e.event_time ? String(e.event_time).slice(0, 5) : "",
                    notes: e.description || "",
                    reminderSettings: e.reminder_settings || null,
                }),
            );

            setEventsByDate(byDate);
        } catch (e) {
            console.log("calendar load:", e.message);
        } finally {
            setLoading(false);
        }
    }, [childId]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const refreshControl = useRefreshControl(loading, loadEvents);

    useEffect(() => {
        (async () => {
            const saved = await storage.getItem(LEAD_TIME_KEY);
            if (saved) setFormLead(saved);
        })();
    }, []);

    const markedDates = useMemo(() => {
        const marks = {};
        Object.entries(eventsByDate).forEach(([date, events]) => {
            marks[date] = {
                dots: events.slice(0, 4).map((e) => ({ key: e.id, color: categoryColor(colors, e.category) })),
            };
        });
        marks[selectedDate] = {
            ...(marks[selectedDate] || {}),
            selected: true,
            selectedColor: colors.primary,
        };
        return marks;
    }, [eventsByDate, selectedDate, colors]);

    const calendarTheme = useMemo(
        () => ({
            calendarBackground: colors.surface,
            textSectionTitleColor: colors.textMuted,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: colors.onPrimary,
            todayTextColor: colors.primary,
            dayTextColor: colors.text,
            textDisabledColor: colors.border,
            dotColor: colors.primary,
            arrowColor: colors.primary,
            monthTextColor: colors.text,
            textMonthFontWeight: "800",
            textDayFontWeight: "600",
            textDayHeaderFontWeight: "700",
            // react-native-calendars draws its day cells at 32pt, which is the
            // whole tap target for picking a date — the most-tapped control on
            // this screen. `stylesheet.day.basic` is the library's own
            // documented override hook; only the box grows, the type and the
            // dot markers are untouched.
            "stylesheet.day.basic": {
                base: {
                    width: MIN_TOUCH,
                    height: MIN_TOUCH,
                    alignItems: "center",
                    justifyContent: "center",
                },
            },
        }),
        [colors],
    );

    const jumpToToday = useCallback(() => {
        const t = todayISO();
        setSelectedDate(t);
        setMonthKey((k) => k + 1);
    }, []);

    const dayEvents = eventsByDate[selectedDate] || [];

    const shiftDay = (deltaDays) => {
        const d = new Date(`${selectedDate}T00:00:00`);
        d.setDate(d.getDate() + deltaDays);
        // toISOString() here converted local midnight to UTC, so stepping a
        // day in UTC+8 landed on the previous date.
        setSelectedDate(toLocalISO(d));
    };

    const openCreateModal = () => {
        setEditingEventId(null);
        setFormTitle("");
        setFormDescription("");
        setFormDate(selectedDate);
        setFormTime("");
        setShowEventModal(true);
    };

    const openEditModal = (ev) => {
        setEditingEventId(ev.rawId);
        setFormTitle(ev.title);
        setFormDescription(ev.notes || "");
        setFormDate(selectedDate);
        setFormTime(ev.subtitle || "");
        setFormLead(ev.reminderSettings?.leadDays != null ? String(ev.reminderSettings.leadDays) : formLead);
        setDetailEvent(null);
        setShowEventModal(true);
    };

    const scheduleEventReminder = async (title, dateStr, leadDays) => {
        const lead = Number(leadDays) || 0;
        const target = new Date(`${dateStr}T09:00:00`);
        target.setDate(target.getDate() - lead);
        if (target.getTime() > Date.now()) {
            await scheduleReminder("Upcoming: " + title, `On your calendar for ${dateStr}`, target);
        }
    };

    const handleSaveEvent = async () => {
        if (!formTitle.trim()) {
            toast.error("Please enter a title");
            return;
        }
        if (!formDate) {
            toast.error("Please choose a date");
            return;
        }
        const body = {
            title: formTitle.trim(),
            description: formDescription || null,
            event_type: "custom",
            event_date: formDate,
            event_time: formTime || null,
            reminder_settings: { leadDays: Number(formLead) || 0 },
        };
        try {
            if (editingEventId) {
                await api.updateRecord(childId, "calendar-events", editingEventId, body);
            } else {
                await api.createRecord(childId, "calendar-events", body);
            }
            await scheduleEventReminder(formTitle.trim(), formDate, formLead);
            setShowEventModal(false);
            await loadEvents();
            toast.success(editingEventId ? "Event updated" : "Event added");
        } catch (e) {
            toast.error(e.message || "Could not save event");
        }
    };

    const handleDeleteEvent = async (ev) => {
        try {
            await api.deleteRecord(childId, "calendar-events", ev.rawId);
            setDetailEvent(null);
            await loadEvents();
            toast.success("Event deleted");
        } catch (e) {
            toast.error(e.message || "Could not delete event");
        }
    };

    const renderEventRow = (ev) => {
        const meta = CATEGORY_META[ev.category] || { label: ev.category, icon: "ellipse-outline" };
        return (
            <TouchableOpacity
                key={ev.id}
                style={styles.eventRow}
                onPress={() => setDetailEvent(ev)}
                accessibilityRole="button"
                accessibilityLabel={`${meta.label}: ${ev.title}`}
            >
                <View style={[styles.eventIconWrap, { backgroundColor: categoryColor(colors, ev.category) + "22" }]}>
                    <Ionicons name={meta.icon} size={18} color={categoryColor(colors, ev.category)} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.eventTitle} numberOfLines={2} ellipsizeMode="tail">
                        {ev.title}
                    </Text>
                    <Text style={styles.eventSubtitle} numberOfLines={2} ellipsizeMode="tail">
                        {meta.label}
                        {ev.subtitle ? ` · ${ev.subtitle}` : ""}
                    </Text>
                </View>
                {ev.completed ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.switcherRow}>
                {["month", "week", "day"].map((mode) => (
                    <TouchableOpacity
                        key={mode}
                        onPress={() => setViewMode(mode)}
                        style={[styles.switcherBtn, viewMode === mode && styles.switcherBtnActive]}
                        accessibilityRole="button"
                        accessibilityLabel={`${mode} view`}
                    >
                        <Text
                            numberOfLines={1}
                            style={[styles.switcherText, viewMode === mode && styles.switcherTextActive]}
                        >
                            {mode === "month" ? "Monthly" : mode === "week" ? "Weekly" : "Daily"}
                        </Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={jumpToToday} style={styles.todayBtn} accessibilityRole="button" accessibilityLabel="Jump to today">
                    <Text style={styles.todayBtnText} numberOfLines={1}>
                        Today
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={openCreateModal}
                    style={styles.addEventBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Add custom event"
                >
                    <Ionicons name="add" size={20} color={colors.onAccent} />
                </TouchableOpacity>
            </View>

            <Animated.ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: padTop, paddingBottom: padBottom }]}
                refreshControl={refreshControl}
                {...scrollProps}
                keyboardShouldPersistTaps="handled"
            >
                <TipStrip tipKey="tip_calendar">
                    Appointments and vaccine due dates appear here automatically. Tap any date to add your own
                    event.
                </TipStrip>

                <View style={styles.legendRow}>
                    {Object.entries(CATEGORY_META).map(([key, meta]) => (
                        <View key={key} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: categoryColor(colors, key) }]} />
                            <Text style={styles.legendText}>{meta.label}</Text>
                        </View>
                    ))}
                </View>

                {viewMode === "month" && (
                    <Calendar
                        key={monthKey}
                        current={selectedDate}
                        markingType="multi-dot"
                        markedDates={markedDates}
                        onDayPress={(day) => setSelectedDate(day.dateString)}
                        theme={calendarTheme}
                        style={styles.calendarCard}
                    />
                )}

                {viewMode === "week" && (
                    <CalendarProvider date={selectedDate} onDateChanged={setSelectedDate}>
                        <WeekCalendar firstDay={1} markedDates={markedDates} theme={calendarTheme} style={styles.calendarCard} />
                    </CalendarProvider>
                )}

                {viewMode === "day" && (
                    <View style={styles.dayNav}>
                        <TouchableOpacity onPress={() => shiftDay(-1)} accessibilityRole="button" accessibilityLabel="Previous day">
                            <Ionicons name="chevron-back" size={22} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.dayNavLabel}>
                            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                            })}
                        </Text>
                        <TouchableOpacity onPress={() => shiftDay(1)} accessibilityRole="button" accessibilityLabel="Next day">
                            <Ionicons name="chevron-forward" size={22} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.eventsSection}>
                    <Text style={styles.eventsSectionTitle}>
                        {selectedDate === todayISO() ? "Today" : selectedDate}
                    </Text>
                    {loading && !dayEvents.length ? (
                        <AppointmentsSkeleton />
                    ) : dayEvents.length ? (
                        dayEvents.map(renderEventRow)
                    ) : (
                        <EmptyStateCard message="No appointments or events on this day." icon="calendar-outline" />
                    )}
                </View>
            </Animated.ScrollView>

            <Modal visible={!!detailEvent} transparent animationType="fade" onRequestClose={() => setDetailEvent(null)}>
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        {detailEvent ? (
                            <>
                                <Text style={styles.modalTitle}>{detailEvent.title}</Text>
                                <Text style={styles.modalSubtitle}>
                                    {(CATEGORY_META[detailEvent.category] || {}).label} · {selectedDate}
                                </Text>
                                {detailEvent.subtitle ? <Text style={styles.modalNotes}>{detailEvent.subtitle}</Text> : null}
                                {detailEvent.notes ? <Text style={styles.modalNotes}>{detailEvent.notes}</Text> : null}
                                {detailEvent.category === "custom" ? (
                                    <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
                                        <TouchableOpacity
                                            onPress={() => openEditModal(detailEvent)}
                                            style={[styles.modalCloseBtn, { flex: 1, backgroundColor: colors.surfaceAlt }]}
                                            accessibilityRole="button"
                                            accessibilityLabel="Edit event"
                                        >
                                            <Text style={[styles.modalCloseText, { color: colors.text }]}>Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteEvent(detailEvent)}
                                            style={[styles.modalCloseBtn, { flex: 1, backgroundColor: colors.danger }]}
                                            accessibilityRole="button"
                                            accessibilityLabel="Delete event"
                                        >
                                            <Text style={styles.modalCloseText}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : null}
                                <TouchableOpacity
                                    onPress={() => setDetailEvent(null)}
                                    style={styles.modalCloseBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel="Close"
                                >
                                    <Text style={styles.modalCloseText}>Close</Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>

            <Modal visible={showEventModal} transparent animationType="slide" onRequestClose={() => setShowEventModal(false)}>
                <KeyboardAvoider>
                <View style={styles.modalBg}>
                    <ScrollView
                        contentContainerStyle={{ width: "100%", alignItems: "center" }}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>{editingEventId ? "Edit Event" : "Add Custom Event"}</Text>

                            <Text style={styles.formLabel}>Title</Text>
                            <TextInput
                                style={styles.formInput}
                                value={formTitle}
                                onChangeText={setFormTitle}
                                placeholder="e.g. Grandma's visit"
                                placeholderTextColor={colors.placeholder}
                            />

                            <Text style={styles.formLabel}>Description (optional)</Text>
                            <TextInput style={styles.formInput} value={formDescription} onChangeText={setFormDescription} />

                            <Text style={styles.formLabel}>Date</Text>
                            <DateField value={formDate} onChange={setFormDate} />

                            <Text style={styles.formLabel}>Time (optional)</Text>
                            <TimeField value={formTime} onChange={setFormTime} />

                            <Text style={styles.formLabel}>Remind me</Text>
                            <View style={styles.leadRow}>
                                {LEAD_TIME_OPTIONS.map((opt) => (
                                    <TouchableOpacity
                                        key={opt.key}
                                        onPress={() => setFormLead(opt.key)}
                                        style={[styles.leadOption, formLead === opt.key && styles.leadOptionActive]}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: formLead === opt.key }}
                                    >
                                        <Text style={[styles.leadOptionText, formLead === opt.key && styles.leadOptionTextActive]}>
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    onPress={() => setShowEventModal(false)}
                                    style={styles.modalCancelBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancel"
                                >
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSaveEvent}
                                    style={styles.modalSaveBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel="Save event"
                                >
                                    <Text style={styles.modalSaveText}>{editingEventId ? "Save" : "Add"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
                </KeyboardAvoider>
            </Modal>
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        // transparent, not colors.background: App.js paints the page gradient.

        container: { flex: 1, backgroundColor: "transparent" },
        // paddingBottom applied inline — space.xxl (32) left the last event
        // underneath the tab bar and the floating button.
        scrollContent: { padding: space.lg },
        // Wraps. Three mode buttons + Today + the add button came to ~310pt of
        // the 328pt available at 360pt with no wrap and no scroll, so a 320pt
        // screen — or a raised font scale on any screen — pushed the add button
        // clean off the edge with no way to reach it.
        switcherRow: {
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            gap: space.xs,
        },
        switcherBtn: {
            minHeight: MIN_TOUCH,
            justifyContent: "center",
            paddingVertical: 8,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceAlt,
        },
        switcherBtnActive: { backgroundColor: colors.softGreen },
        switcherText: { ...type.caption, fontWeight: "700", color: colors.textMuted },
        switcherTextActive: { color: colors.primaryDark },
        todayBtn: {
            marginLeft: "auto",
            minHeight: MIN_TOUCH,
            justifyContent: "center",
            paddingVertical: 8,
            paddingHorizontal: space.md,
        },
        // This label sits on the bare page, which is now the tinted top of the
        // gradient rather than flat grey — `accentStrong` (= primary) fell to
        // 3.77:1 there. primaryDark is the token for text on a pale brand wash.
        todayBtnText: { ...type.caption, fontWeight: "800", color: colors.primaryDark },
        addEventBtn: {
            width: MIN_TOUCH,
            height: MIN_TOUCH,
            borderRadius: radius.pill,
            backgroundColor: colors.accentStrong,
            alignItems: "center",
            justifyContent: "center",
        },
        legendRow: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: space.md,
            marginBottom: space.md,
        },
        legendItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },
        legendDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        legendText: {
            fontSize: type.caption.fontSize,
            fontWeight: "700",
            color: colors.textSecondary,
        },
        calendarCard: {
            borderRadius: radius.lg,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.hairline,
            ...shadow.card,
            marginBottom: space.lg,
        },
        dayNav: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            marginBottom: space.lg,
            ...shadow.card,
        },
        dayNavLabel: { fontSize: 14, fontWeight: "800", color: colors.text },
        eventsSection: { marginTop: space.xs },
        eventsSectionTitle: { fontSize: 13, fontWeight: "800", color: colors.textMuted, marginBottom: space.sm },
        eventRow: {
            flexDirection: "row",
            alignItems: "center",
            padding: space.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            marginBottom: space.sm,
        },
        eventIconWrap: {
            width: 38,
            height: 38,
            borderRadius: radius.md,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            marginRight: space.md,
        },
        eventTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
        eventSubtitle: { fontSize: type.caption.fontSize, color: colors.textMuted, marginTop: 2 },
        modalBg: {
            flex: 1,
            backgroundColor: "rgba(28,25,23,0.55)",
            justifyContent: "center",
            alignItems: "center",
            padding: space.xl,
        },
        modalCard: {
            backgroundColor: colors.background,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            padding: space.xl,
            width: "100%",
            maxWidth: 360,
            borderWidth: 1,
            borderColor: colors.hairline,
            ...shadow.raised,
        },
        modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 4 },
        modalSubtitle: { fontSize: type.caption.fontSize, fontWeight: "700", color: colors.textMuted, marginBottom: space.md },
        modalNotes: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: space.sm },
        modalCloseBtn: {
            height: 44,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.accentStrong,
            alignItems: "center",
            justifyContent: "center",
            marginTop: space.sm,
        },
        modalCloseText: { color: colors.onAccent, fontWeight: "800", fontSize: 13 },
        formLabel: {
            fontSize: type.caption.fontSize,
            fontWeight: "700",
            color: colors.textMuted,
            textTransform: "uppercase",
            marginBottom: 4,
            marginTop: space.sm,
        },
        formInput: {
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: space.md,
            height: 44,
            fontSize: 16,
            color: colors.text,
        },
        leadRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: 2 },
        leadOption: {
            minHeight: MIN_TOUCH,
            justifyContent: "center",
            paddingVertical: 8,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        leadOptionActive: { borderColor: colors.primary, backgroundColor: colors.softGreen },
        leadOptionText: { fontSize: type.caption.fontSize, fontWeight: "700", color: colors.textMuted },
        leadOptionTextActive: { color: colors.primaryDark },
        modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: space.md, marginTop: space.lg },
        modalCancelBtn: {
            paddingVertical: 12,
            paddingHorizontal: space.lg,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            backgroundColor: colors.surfaceAlt,
        },
        modalCancelText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
        modalSaveBtn: {
            paddingVertical: 12,
            paddingHorizontal: space.lg,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            backgroundColor: colors.accentStrong,
            ...shadow.accent,
        },
        modalSaveText: { fontSize: 14, fontWeight: "800", color: colors.onAccent },
    });
