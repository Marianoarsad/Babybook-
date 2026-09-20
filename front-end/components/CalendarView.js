import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Animated, PanResponder, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import Modal from "./ui/AppModal";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { useTheme } from "../context/ThemeContext";
import { space, radius, shadow, type, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
import { api } from "../utils/api";
import { useRecords, useRecordSave } from "../utils/useRecords";
import { buildCalendarEvents } from "../utils/calendarEvents";
import { AppointmentsSkeleton } from "./ui/Skeleton";
import ShowMore from "./ui/ShowMore";
import { useRefreshControl } from "./ui/useRefreshControl";
import { DateField, TimeField } from "./ui/DateField";
import { useToast } from "./ui/Toast";
import { scheduleReminder } from "../utils/notifications";
import { storage } from "../utils/storageAdapter";
import { LEAD_TIME_KEY, LEAD_TIME_OPTIONS } from "./settings/GeneralSettings";

import RecordFormSheet, { DeleteConfirmation, RecordFormGroup, RecordFormRow } from "./ui/RecordFormSheet";
import PlanDetail from "./ui/PlanDetail";
import { shortDate, shortTime, shiftMonthClamped, todayLocal, toLocalISO } from "../utils/dates";
import { plannedEnd } from "../utils/medication";
import { selectableMonths } from "../utils/pickers";
import { shouldClaimHorizontalSwipe, shouldOpenSwipe } from "../utils/swipeMath";

// Category -> theme-derived marker/accent color. Kept to semantic status tones
// (not brand hex) so it stays consistent across the girl/boy palette switch.
const CATEGORY_META = {
    vaccination: { label: "Vaccination" },
    checkup: { label: "Checkup" },
    illness: { label: "Illness" },
    medication: { label: "Medication" },
    hospitalization: { label: "Hospitalization" },
    custom: { label: "Custom Event" },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const LIST_PAGE = 3;
const SWIPE_ACTION_WIDTH = 72;
const SWIPE_FOREGROUND_OVERLAP = 12;
const EmptyCalendarHeader = () => null;
const PLAN_RESOURCES = {
    vaccination: "vaccinations",
    checkup: "checkups",
    "medical-history": "medical-history",
    "calendar-event": "calendar-events",
};

function SwipePlanRow({ open, onOpen, onClose, onPress, actions, label, styles, children }) {
    const revealWidth = actions.length * SWIPE_ACTION_WIDTH;
    const revealDistance = revealWidth - SWIPE_FOREGROUND_OVERLAP;
    const translateX = useRef(new Animated.Value(0)).current;
    const dragStart = useRef(0);
    const openRef = useRef(open);
    const onOpenRef = useRef(onOpen);
    const onCloseRef = useRef(onClose);

    openRef.current = open;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;

    const settle = useCallback((isOpen) => {
        Animated.spring(translateX, {
            toValue: isOpen ? -revealDistance : 0,
            speed: 18,
            bounciness: 0,
            useNativeDriver: true,
        }).start();
    }, [revealDistance, translateX]);

    useEffect(() => settle(open), [open, settle]);

    const pan = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_event, gesture) =>
                    shouldClaimHorizontalSwipe(gesture.dx, gesture.dy),
                onPanResponderGrant: () => {
                    translateX.stopAnimation((value) => {
                        dragStart.current = value;
                    });
                },
                onPanResponderMove: (_event, gesture) => {
                    translateX.setValue(Math.max(-revealDistance, Math.min(0, dragStart.current + gesture.dx)));
                },
                onPanResponderRelease: (_event, gesture) => {
                    const nextOpen = shouldOpenSwipe({
                        dx: gesture.dx,
                        wasOpen: openRef.current,
                        revealWidth: revealDistance,
                    });
                    settle(nextOpen);
                    (nextOpen ? onOpenRef.current : onCloseRef.current)();
                },
                onPanResponderTerminate: () => settle(openRef.current),
            }),
        [revealDistance, settle, translateX],
    );

    const runAction = (name) => actions.find((action) => action.key === name)?.onPress();
    const actionOpacity = translateX.interpolate({
        inputRange: [-24, -6, 0],
        outputRange: [1, 0, 0],
        extrapolate: "clamp",
    });

    return (
        <View
            style={styles.swipeRow}
            accessible={!open}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint="Swipe left for actions"
            onAccessibilityTap={open ? onClose : onPress}
            accessibilityActions={actions.map((action) => ({ name: action.key, label: action.label }))}
            onAccessibilityAction={(event) => runAction(event.nativeEvent.actionName)}
            {...pan.panHandlers}
        >
            <Animated.View
                style={[styles.swipeActions, { width: revealWidth, opacity: actionOpacity }]}
                pointerEvents={open ? "auto" : "none"}
                accessibilityElementsHidden={!open}
                importantForAccessibility={open ? "auto" : "no-hide-descendants"}
            >
                {actions.map((action) => (
                    <TouchableOpacity
                        key={action.key}
                        style={[
                            styles.swipeAction,
                            action.key === "update" && styles.swipeLeadingAction,
                            action.kind === "delete" && styles.swipeDeleteAction,
                        ]}
                        onPress={action.onPress}
                        accessibilityRole="button"
                        accessibilityLabel={`${action.label} ${label}`}
                    >
                        <Ionicons
                            name={action.icon}
                            size={19}
                            color={action.color}
                        />
                    </TouchableOpacity>
                ))}
            </Animated.View>
            <Animated.View style={[styles.swipeForeground, { transform: [{ translateX }] }]}>
                <TouchableOpacity activeOpacity={1} disabled={!open && !onPress} onPress={open ? onClose : onPress} accessible={false}>
                    {children}
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

function monthText(value, short = false) {
    const date = new Date(`${String(value || "").slice(0, 10)}T00:00:00`);
    return isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: short ? "short" : "long" });
}

// One fixed colour per category, from theme.js's eventCategory token.
//
// This used to switch on colors.primary (checkup) and colors.accent (custom),
// both of which come from the GENDER palette — so those two were always the
// same hue family as each other, and the legend's meaning changed with the
// child: a checkup marker was pink for a girl and blue for a boy. Measured, the
// old set had three confusable pairs and "custom" scored 3.1-3.3:1 against
// white, under the 4.5:1 minimum. See the note on eventCategory in theme.js.
function categoryColor(colors, category) {
    return (colors.eventCategory && colors.eventCategory[category]) || colors.eventCategory.custom;
}

function todayISO() {
    return todayLocal();
}

// Calendar tab: monthly view over aggregated records (vaccinations,
// checkups, medical history) — see CLAUDE.md §9. Reminders aren't fetched
// separately: today's schema ties every reminder 1:1 to a vaccination or
// checkup, so showing both would just duplicate the same event twice.
export default function CalendarView({ profile, onNavigate }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const { scrollProps } = useScroll();
    const toast = useToast();

    const [selectedDate, setSelectedDate] = useState(todayISO());
    const [loading, setLoading] = useState(true);
    const [savingEvent, setSavingEvent] = useState(false);
    const [deletingEventId, setDeletingEventId] = useState(null);
    const [detailEvent, setDetailEvent] = useState(null);
    const [upcomingVisible, setUpcomingVisible] = useState(LIST_PAGE);
    const [overdueVisible, setOverdueVisible] = useState(LIST_PAGE);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [monthPickerYear, setMonthPickerYear] = useState(new Date().getFullYear());
    const [savingPlanKey, setSavingPlanKey] = useState(null);
    const [openSwipeId, setOpenSwipeId] = useState(null);
    const [deleteCandidate, setDeleteCandidate] = useState(null);

    const [showEventModal, setShowEventModal] = useState(false);
    const [editingEventId, setEditingEventId] = useState(null);
    const [editingEvent, setEditingEvent] = useState(null);
    const [formTitle, setFormTitle] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formDate, setFormDate] = useState(todayISO());
    const [formTime, setFormTime] = useState("");
    const [formLead, setFormLead] = useState("1");

    const childId = profile?.id;
    const vaccinations = useRecords(childId, "vaccinations");
    const checkups = useRecords(childId, "checkups");
    const medHistory = useRecords(childId, "medical-history");
    const customEvents = useRecords(childId, "calendar-events");
    const planStatuses = useRecords(childId, "calendar-plan-statuses");
    const eventsByDate = useMemo(() => buildCalendarEvents(vaccinations, checkups, medHistory, customEvents, planStatuses),
        [vaccinations, checkups, medHistory, customEvents, planStatuses]);
    const saveEvent = useRecordSave(showEventModal, childId, "calendar-events", editingEventId);

    const loadEvents = useCallback(async () => {
        if (!childId) return;
        setLoading(true);
        try {
            const [vaccinations, checkups, medHistory, customEvents, planStatuses] = await Promise.all([
                api.listRecords(childId, "vaccinations", { loading: "nonblocking" }).catch(() => []),
                api.listRecords(childId, "checkups", { loading: "nonblocking" }).catch(() => []),
                api.listRecords(childId, "medical-history", { loading: "nonblocking" }).catch(() => []),
                api.listRecords(childId, "calendar-events", { loading: "nonblocking" }).catch(() => []),
                api.listRecords(childId, "calendar-plan-statuses", { loading: "nonblocking" }).catch(() => []),
            ]);

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

    useEffect(() => {
        setUpcomingVisible(LIST_PAGE);
        setOverdueVisible(LIST_PAGE);
        setOpenSwipeId(null);
    }, [selectedDate, childId]);

    const markedDates = useMemo(() => {
        const marks = {};
        Object.entries(eventsByDate).forEach(([date, events]) => {
            const seen = new Set();
            const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
            marks[date] = {
                // Keep one compact band per category. Multiple records still
                // remain available in the selected-day list.
                periods: events
                    .filter((event) => {
                        if (seen.has(event.category)) return false;
                        seen.add(event.category);
                        return true;
                    })
                    .slice(0, 3)
                    .map((event) => ({
                        color: categoryColor(colors, event.category),
                        startingDay: !event.rangeStart || date === event.rangeStart || dayOfWeek === 1,
                        endingDay: !event.rangeEnd || date === event.rangeEnd || dayOfWeek === 0,
                    })),
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
            textMonthFontFamily: type.heading.fontFamily,
            textMonthFontWeight: type.heading.fontWeight,
            textDayFontFamily: type.caption.fontFamily,
            textDayFontWeight: type.caption.fontWeight,
            textDayHeaderFontFamily: type.caption.fontFamily,
            textDayHeaderFontWeight: "700",
            // react-native-calendars draws its day cells at 32pt, which is the
            // whole tap target for picking a date — the most-tapped control on
            // this screen. `stylesheet.day.basic` is the library's own
            // documented override hook; only the box grows, the type and the
            // rounded event bands are drawn immediately beneath it.
            "stylesheet.day.basic": {
                base: {
                    width: "100%",
                    height: MIN_TOUCH,
                    alignItems: "center",
                    justifyContent: "center",
                },
                text: { ...type.caption, marginTop: 0 },
                selected: { width: 36, height: 36, borderRadius: radius.pill },
            },
            "stylesheet.calendar.main": {
                container: { paddingLeft: 0, paddingRight: 0, backgroundColor: colors.surface },
                week: { marginVertical: 2, flexDirection: "row", justifyContent: "space-around" },
            },
            "stylesheet.marking": {
                period: { height: 3, marginVertical: 1 },
                startingDay: { borderTopLeftRadius: 2, borderBottomLeftRadius: 2, marginLeft: 4 },
                endingDay: { borderTopRightRadius: 2, borderBottomRightRadius: 2, marginRight: 4 },
            },
        }),
        [colors],
    );

    const byTime = (a, b) =>
        (a.time || "99:99").localeCompare(b.time || "99:99") || (a.title || "").localeCompare(b.title || "");
    const dayEvents = useMemo(() => [...(eventsByDate[selectedDate] || [])].sort(byTime), [eventsByDate, selectedDate]);
    const flatEvents = useMemo(() => Object.values(eventsByDate).flat(), [eventsByDate]);
    const today = todayISO();
    const upcomingFrom = selectedDate > today ? selectedDate : today;
    const upcomingEvents = useMemo(
        () =>
            flatEvents
                .filter(
                    (event) =>
                        event.date > upcomingFrom &&
                        !event.completed &&
                        !event.courseOccurrence &&
                        ["vaccination", "checkup", "medication", "custom"].includes(event.category),
                )
                .sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b)),
        [flatEvents, upcomingFrom],
    );
    const overdueEvents = useMemo(
        () =>
            flatEvents
                .filter(
                    (event) =>
                        event.date < today &&
                        !event.completed &&
                        !event.courseOccurrence &&
                        ["vaccination", "checkup"].includes(event.category),
                )
                .sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b)),
        [flatEvents, today],
    );

    const monthOptions = [-1, 0, 1].map((offset) => ({ offset, date: shiftMonthClamped(selectedDate, offset) }));

    const changeMonth = (offset) => {
        const next = shiftMonthClamped(selectedDate, offset);
        if (next) setSelectedDate(next);
    };

    const openMonthPicker = () => {
        const selectedYear = Number(selectedDate.slice(0, 4));
        setMonthPickerYear(Math.max(selectedYear, new Date().getFullYear()));
        setShowMonthPicker(true);
    };

    const selectMonth = (monthIndex) => {
        const current = new Date(`${selectedDate}T00:00:00`);
        const lastDay = new Date(monthPickerYear, monthIndex + 1, 0).getDate();
        const next = new Date(monthPickerYear, monthIndex, Math.min(current.getDate(), lastDay));
        setSelectedDate(toLocalISO(next));
        setShowMonthPicker(false);
    };

    const handleMonthChange = (month) => {
        const current = new Date(`${selectedDate}T00:00:00`);
        const target = new Date(`${month.dateString}T00:00:00`);
        const offset = (target.getFullYear() - current.getFullYear()) * 12 + target.getMonth() - current.getMonth();
        if (offset) changeMonth(offset);
    };

    const openCreateModal = () => {
        setEditingEventId(null);
        setEditingEvent(null);
        setFormTitle("");
        setFormDescription("");
        setFormDate(selectedDate);
        setFormTime("");
        setShowEventModal(true);
    };

    const openEditModal = (ev) => {
        setEditingEventId(ev.rawId);
        setEditingEvent(ev);
        setFormTitle(ev.title);
        setFormDescription(ev.notes || "");
        setFormDate(ev.date || selectedDate);
        setFormTime(ev.time || "");
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
        if (savingEvent) return;
        setSavingEvent(true);
        const body = {
            title: formTitle.trim(),
            description: formDescription || null,
            event_type: "custom",
            event_date: formDate,
            event_time: formTime || null,
            reminder_settings: { leadDays: Number(formLead) || 0 },
        };
        try {
            await saveEvent(body);
            await scheduleEventReminder(formTitle.trim(), formDate, formLead);
            setShowEventModal(false);
            toast.success(editingEventId ? "Event updated" : "Event added");
        } catch (e) {
            toast.error(e.message || "Could not save event");
        } finally {
            setSavingEvent(false);
        }
    };

    const handleDeleteEvent = async (ev) => {
        if (!ev || deletingEventId === ev.id) return false;
        const resource = PLAN_RESOURCES[ev.sourceType];
        if (!resource) {
            toast.error("This plan cannot be deleted here");
            return false;
        }
        setDeletingEventId(ev.id);
        try {
            if (resource === "calendar-events") {
                setDetailEvent(null); setDeleteCandidate(null); setOpenSwipeId(null);
                await api.optimisticRecord(childId, resource, "delete", ev.sourceId, {}, { label: ev.title });
            } else {
                await api.deleteRecord(childId, resource, ev.sourceId);
                setDetailEvent(null); setDeleteCandidate(null); setOpenSwipeId(null);
                await loadEvents();
            }
            toast.success("Plan deleted");
            return true;
        } catch (e) {
            toast.error(e.message || "Could not delete event");
            return false;
        } finally {
            setDeletingEventId((current) => current === ev.id ? null : current);
        }
    };

    const togglePlan = async (event) => {
        if (event.pending || !event.planKey) return;
        const completed = !event.completed;
        setSavingPlanKey(event.planKey);
        try {
            await api.optimisticRecord(childId, "calendar-plan-statuses", event.planStatusId ? "update" : "create", event.planStatusId,
                event.planStatusId ? { completed } : {
                    source_type: event.sourceType, source_id: event.sourceId, occurrence_date: event.date, completed,
                }, { entity: event.planKey, label: event.title });
        } catch (error) { toast.error(error.message || "Could not update plan"); }
        finally { setSavingPlanKey((current) => current === event.planKey ? null : current); }
    };

    const renderEventContent = (ev, showDate, checklist, tone) => {
        const meta = CATEGORY_META[ev.category] || { label: ev.category };
        const when = showDate ? shortDate(ev.date) : ev.time ? shortTime(ev.time) : "All day";
        return (
            <>
                <View style={styles.eventWhen}>
                    <Text style={[styles.eventWhenText, { color: tone }]} numberOfLines={2}>
                        {when}
                    </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.eventTitle} numberOfLines={2} ellipsizeMode="tail">
                        {ev.title}
                    </Text>
                    <Text style={styles.eventSubtitle} numberOfLines={2} ellipsizeMode="tail">
                        {meta.label}
                        {showDate && ev.time ? ` · ${shortTime(ev.time)}` : ""}
                        {ev.subtitle ? ` · ${ev.subtitle}` : ""}
                    </Text>
                </View>
                {checklist ? (
                    <TouchableOpacity
                        style={styles.checkButton}
                        onPress={(pressEvent) => {
                            pressEvent.stopPropagation?.();
                            togglePlan(ev);
                        }}
                        disabled={ev.pending || savingPlanKey === ev.planKey}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${ev.completed ? "Uncheck" : "Complete"} ${ev.title}`}
                        accessibilityState={{ checked: ev.completed, disabled: ev.pending || savingPlanKey === ev.planKey, busy: ev.pending || savingPlanKey === ev.planKey }}
                    >
                        {(<Ionicons name={ev.completed ? "checkmark-circle" : "ellipse-outline"} size={24} color={ev.completed ? colors.success : colors.textMuted} />)}
                    </TouchableOpacity>
                ) : ev.completed ? <Ionicons name="checkmark-circle" size={18} color={colors.success} style={styles.eventComplete} /> : null}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.eventChevron} />
            </>
        );
    };

    const renderEventRow = (ev, showDate = false, checklist = false) => {
        const meta = CATEGORY_META[ev.category] || { label: ev.category };
        const tone = categoryColor(colors, ev.category);
        return (
            <TouchableOpacity
                key={ev.id}
                style={[styles.eventRow, { backgroundColor: tone + "12", borderColor: tone + "40" }]}
                onPress={() => setDetailEvent(ev)}
                accessibilityRole="button"
                accessibilityLabel={`${meta.label}: ${ev.title}`}
            >
                {renderEventContent(ev, showDate, checklist, tone)}
            </TouchableOpacity>
        );
    };

    const updateHealthPlan = (ev) => {
        const tab = {
            vaccination: "immunizations",
            checkup: "appointments",
            medication: "medications",
            illness: "illnesses",
            hospitalization: "appointments",
        }[ev.category];
        setOpenSwipeId(null);
        if (tab) onNavigate?.("health", tab, { sourceType: ev.sourceType, record: ev.sourceRecord });
    };

    const renderSwipeableRow = (ev, showDate = false, checklist = false, onPress = null) => {
        const custom = ev.category === "custom";
        const meta = CATEGORY_META[ev.category] || { label: ev.category };
        const tone = custom ? categoryColor(colors, ev.category) : colors.success;
        const actions = custom
            ? [
                  { key: "update", label: "Update", icon: "create-outline", color: colors.primaryDark, onPress: () => { setOpenSwipeId(null); openEditModal(ev); } },
                  { key: "delete", label: "Delete", icon: "trash-outline", color: colors.onAccent, kind: "delete", onPress: () => { setOpenSwipeId(null); setDeleteCandidate(ev); } },
              ]
            : [
                  { key: "update", label: "Update", icon: "create-outline", color: colors.primaryDark, onPress: () => updateHealthPlan(ev) },
                  { key: "delete", label: "Delete", icon: "trash-outline", color: colors.onAccent, kind: "delete", onPress: () => { setOpenSwipeId(null); setDeleteCandidate(ev); } },
              ];

        return (
            <SwipePlanRow
                key={ev.id}
                open={openSwipeId === ev.id}
                onOpen={() => setOpenSwipeId(ev.id)}
                onClose={() => setOpenSwipeId(null)}
                onPress={onPress}
                actions={actions}
                label={`${meta.label}: ${ev.title}`}
                styles={styles}
            >
                <View
                    style={[
                        styles.eventRow,
                        styles.swipeEventRow,
                        custom
                            ? { backgroundColor: tone + "12", borderColor: tone + "40" }
                            : { backgroundColor: colors.successBg, borderColor: colors.success + "55" },
                    ]}
                >
                    {renderEventContent(ev, showDate, checklist, tone)}
                </View>
            </SwipePlanRow>
        );
    };

    const detailPlan = detailEvent ? (() => {
        const record = detailEvent.sourceRecord || {};
        const details = [];
        if (detailEvent.category === "vaccination") {
            if (record.dose_number) details.push({ label: "Dose", value: String(record.dose_number) });
            if (record.visit_name) details.push({ label: "Visit", value: record.visit_name });
            if (record.date_given) details.push({ label: "Given", value: shortDate(record.date_given) });
        } else if (detailEvent.category === "checkup") {
            if (record.doctor_name) details.push({ label: "Provider", value: record.doctor_name });
            if (record.clinic) details.push({ label: "Clinic", value: record.clinic });
        } else if (detailEvent.category === "medication") {
            if (record.dose_amount) details.push({ label: "Dose", value: record.dose_amount });
            if (record.prescribed_by) details.push({ label: "Prescribed by", value: record.prescribed_by });
            if (detailEvent.rangeEnd && detailEvent.rangeEnd !== detailEvent.rangeStart) {
                details.push({ label: "Course ends", value: shortDate(detailEvent.rangeEnd) });
            }
        } else if (detailEvent.category === "illness" || detailEvent.category === "hospitalization") {
            if (record.facility) details.push({ label: "Facility", value: record.facility });
            if (record.care_level) details.push({ label: "Care", value: record.care_level });
        }
        const lead = detailEvent.reminderSettings?.leadDays;
        const reminderLabel = lead == null ? null : Number(lead) === 0 ? "Same day" : `${lead} day${Number(lead) === 1 ? "" : "s"} before`;
        return {
            ...detailEvent,
            categoryLabel: (CATEGORY_META[detailEvent.category] || {}).label || detailEvent.category,
            color: categoryColor(colors, detailEvent.category),
            status: detailEvent.completed ? "Done" : detailEvent.date < today ? "Overdue" : "Scheduled",
            details,
            reminderLabel,
            showReminder: detailEvent.category === "custom",
            deleteLabel: detailEvent.category === "custom" ? "Delete event" : "Delete health record",
        };
    })() : null;

    return (
        <View style={styles.container}>
            <Animated.ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: padTop, paddingBottom: padBottom }]}
                refreshControl={refreshControl}
                {...scrollProps}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.monthCard}>
                    <Text style={styles.selectedDate} selectable>
                        {shortDate(selectedDate)}
                    </Text>
                    <View style={styles.monthStrip}>
                        {monthOptions.map(({ offset, date }) => (
                            <TouchableOpacity
                                key={offset}
                                onPress={() => offset === 0 ? openMonthPicker() : changeMonth(offset)}
                                style={[styles.monthOption, offset === 0 && styles.monthOptionActive]}
                                accessibilityRole="button"
                                accessibilityLabel={`${monthText(date)} ${date.slice(0, 4)}`}
                                accessibilityState={{ selected: offset === 0 }}
                            >
                                <Text
                                    style={[styles.monthOptionText, offset === 0 && styles.monthOptionTextActive]}
                                    numberOfLines={1}
                                >
                                    {monthText(date, offset !== 0)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.weekdayRow}>
                        {WEEKDAYS.map((day) => (
                            <Text key={day} style={styles.weekdayText}>
                                {day}
                            </Text>
                        ))}
                    </View>
                    <Calendar
                        current={selectedDate}
                        firstDay={1}
                        enableSwipeMonths
                        disableMonthChange
                        customHeader={EmptyCalendarHeader}
                        markingType="multi-period"
                        markedDates={markedDates}
                        onDayPress={(day) => setSelectedDate(day.dateString)}
                        onMonthChange={handleMonthChange}
                        theme={calendarTheme}
                        style={styles.monthCalendar}
                    />
                </View>

                <View style={styles.legendRow}>
                    {Object.entries(CATEGORY_META).map(([key, meta]) => (
                        <View key={key} style={styles.legendItem}>
                            <View style={[styles.legendBand, { backgroundColor: categoryColor(colors, key) }]} />
                            <Text style={styles.legendText} numberOfLines={1}>{meta.label}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.planSection}>
                    <View style={styles.planHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.planTitle}>
                                {selectedDate === today ? "Today's plan" : `Plan for ${shortDate(selectedDate)}`}
                            </Text>
                            <Text style={styles.planCount} selectable>
                                {dayEvents.length} {dayEvents.length === 1 ? "plan" : "plans"}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={openCreateModal}
                            style={styles.addPlanAction}
                            accessibilityRole="button"
                            accessibilityLabel={`Add a plan for ${shortDate(selectedDate)}`}
                        >
                            <Text style={styles.addPlanText}>Add plan</Text>
                        </TouchableOpacity>
                    </View>
                    {loading && !dayEvents.length ? (
                        <AppointmentsSkeleton />
                    ) : dayEvents.length ? (
                        dayEvents.map((event) => renderSwipeableRow(event, false, true, () => setDetailEvent(event)))
                    ) : (
                        <Text style={styles.planEmpty}>No plans recorded for this day.</Text>
                    )}
                </View>

                <View style={styles.planSection}>
                    <View style={styles.planHeader}>
                        <Text style={styles.planTitle}>Upcoming plans</Text>
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText} selectable>{upcomingEvents.length}</Text>
                        </View>
                    </View>
                    {upcomingEvents.length ? (
                        <>
                            {upcomingEvents.slice(0, upcomingVisible).map((event) => renderSwipeableRow(event, true, false, () => setDetailEvent(event)))}
                            <ShowMore
                                total={upcomingEvents.length}
                                visible={upcomingVisible}
                                noun="plans"
                                onPress={() => setUpcomingVisible((value) => Math.min(value + 10, upcomingEvents.length))}
                            />
                        </>
                    ) : (
                        <Text style={styles.planEmpty}>No upcoming plans.</Text>
                    )}
                </View>

                <View style={styles.planSection}>
                    <View style={styles.planHeader}>
                        <Text style={styles.planTitle}>Overdue</Text>
                        <View style={[styles.countBadge, overdueEvents.length > 0 && styles.overdueBadge]}>
                            <Text style={[styles.countBadgeText, overdueEvents.length > 0 && styles.overdueBadgeText]} selectable>
                                {overdueEvents.length}
                            </Text>
                        </View>
                    </View>
                    {overdueEvents.length ? (
                        <>
                            {overdueEvents.slice(0, overdueVisible).map((event) => renderEventRow(event, true))}
                            <ShowMore
                                total={overdueEvents.length}
                                visible={overdueVisible}
                                noun="overdue plans"
                                onPress={() => setOverdueVisible((value) => Math.min(value + 10, overdueEvents.length))}
                            />
                        </>
                    ) : (
                        <Text style={styles.planEmpty}>No overdue vaccines or checkups.</Text>
                    )}
                </View>
            </Animated.ScrollView>

            <Modal visible={showMonthPicker} transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
                <TouchableOpacity activeOpacity={1} style={styles.modalBg} onPress={() => setShowMonthPicker(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.monthPickerCard} onPress={() => {}}>
                        <View style={styles.monthPickerHeading}>
                            <Text style={styles.monthPickerTitle}>{monthPickerYear}</Text>
                            <Text style={styles.monthPickerHint}>Choose an available month</Text>
                        </View>
                        <View style={styles.monthGrid}>
                            {MONTHS.map((label, index) => {
                                const enabled = selectableMonths(monthPickerYear).includes(index);
                                const selected = Number(selectedDate.slice(0, 4)) === monthPickerYear && Number(selectedDate.slice(5, 7)) === index + 1;
                                return (
                                    <TouchableOpacity
                                        key={label}
                                        style={[styles.monthCell, selected && styles.monthCellSelected]}
                                        disabled={!enabled}
                                        onPress={() => selectMonth(index)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${label} ${monthPickerYear}`}
                                        accessibilityState={{ disabled: !enabled, selected }}
                                    >
                                        <Text style={[styles.monthCellText, selected && styles.monthCellTextSelected, !enabled && styles.monthCellDisabled]}>{label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <TouchableOpacity style={styles.monthPickerBack} onPress={() => setShowMonthPicker(false)} accessibilityRole="button">
                            <Text style={styles.monthPickerBackText}>Back</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <PlanDetail
                visible={!!detailEvent}
                plan={detailPlan}
                onClose={() => setDetailEvent(null)}
                onEdit={() => {
                    if (detailEvent?.category === "custom") {
                        const event = detailEvent;
                        setDetailEvent(null);
                        openEditModal(event);
                    } else {
                        updateHealthPlan(detailEvent);
                    }
                }}
                onDelete={() => setDeleteCandidate(detailEvent)}
                deleting={deletingEventId === detailEvent?.id}
            />

            <DeleteConfirmation visible={!!deleteCandidate} title={"Delete plan?"}
 message={deleteCandidate ? `Delete "${deleteCandidate.title}"? This cannot be undone.` : ""} busy={!!deletingEventId}
 onCancel={() => setDeleteCandidate(null)} onConfirm={() => handleDeleteEvent(deleteCandidate)} />

            <RecordFormSheet visible={showEventModal} title={editingEventId ? "Edit Event" : "Add Custom Event"}
                onClose={() => setShowEventModal(false)} onSubmit={handleSaveEvent} busy={savingEvent}
                cancelLabel={"Cancel"} submitLabel={editingEventId ? "Save" : "Add"}
                record={editingEventId != null ? { id: editingEventId } : null} onDelete={editingEventId != null ? () => handleDeleteEvent(editingEvent) : undefined} deleteTitle={"Delete plan?"} deleteMessage={`Delete "${editingEvent?.title || ""}"? This cannot be undone.`}>
                <RecordFormGroup>

                            <RecordFormRow label={<Text style={styles.formLabel}>Title</Text>}>

                            <TextInput
                                style={styles.formInput}
                                value={formTitle}
                                onChangeText={setFormTitle}
                                placeholder="e.g. Grandma's visit"
                                placeholderTextColor={colors.placeholder}
                            />
                            </RecordFormRow>

                            <RecordFormRow label={<Text style={styles.formLabel}>Description (optional)</Text>}>

                            <TextInput style={styles.formInput} value={formDescription} onChangeText={setFormDescription} />
                            </RecordFormRow>

                            <RecordFormRow label={<Text style={styles.formLabel}>Date</Text>}>

                            <DateField value={formDate} onChange={setFormDate} />
                            </RecordFormRow>

                            <RecordFormRow label={<Text style={styles.formLabel}>Time (optional)</Text>}>

                            <TimeField value={formTime} onChange={setFormTime} />
                            </RecordFormRow>

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

                </RecordFormGroup>
            </RecordFormSheet>
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
        monthCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            paddingHorizontal: space.sm,
            paddingTop: space.lg,
            paddingBottom: space.md,
            marginBottom: space.md,
            ...shadow.card,
        },
        selectedDate: {
            ...type.label,
            color: colors.textSecondary,
            textAlign: "center",
            fontVariant: ["tabular-nums"],
            marginBottom: space.md,
        },
        monthStrip: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md },
        monthOption: {
            flex: 1,
            minHeight: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: space.xs,
            backgroundColor: colors.surfaceAlt,
        },
        monthOptionActive: { backgroundColor: colors.primary, ...shadow.card },
        monthOptionText: { ...type.caption, color: colors.textMuted },
        monthOptionTextActive: { color: colors.onPrimary, fontWeight: "700" },
        monthPickerCard: {
            width: "100%",
            maxWidth: 360,
            padding: space.md,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            ...shadow.raised,
        },
        monthPickerHeading: { alignItems: "center", padding: space.sm, gap: 2 },
        monthPickerTitle: { ...type.heading, color: colors.text },
        monthPickerHint: { ...type.caption, color: colors.textMuted },
        monthGrid: { flexDirection: "row", flexWrap: "wrap", paddingVertical: space.md },
        monthCell: { width: "33.333%", minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderCurve: "continuous" },
        monthCellSelected: { backgroundColor: colors.primary },
        monthCellText: { ...type.label, color: colors.textSecondary },
        monthCellTextSelected: { color: colors.onPrimary },
        monthCellDisabled: { color: colors.placeholder, opacity: 0.55 },
        monthPickerBack: { minHeight: MIN_TOUCH, alignSelf: "flex-end", justifyContent: "center", paddingHorizontal: space.sm },
        monthPickerBackText: { ...type.label, color: colors.textSecondary },
        weekdayRow: { flexDirection: "row", paddingHorizontal: 5, marginBottom: space.xs },
        weekdayText: {
            ...type.caption,
            flex: 1,
            color: colors.textMuted,
            fontWeight: "700",
            textAlign: "center",
        },
        monthCalendar: { backgroundColor: colors.surface },
        // Six equal, centered cells keep the legend aligned with the calendar.
        legendRow: {
            flexDirection: "row",
            flexWrap: "wrap",
            rowGap: space.md,
            marginBottom: space.md,
        },
        legendItem: {
            // Explicit longhand, never `flex: 0` — react-native-web passes
            // that through to CSS as `0 1 0%`, and a 0% basis overrides any
            // width, collapsing the item to nothing. Same trap documented in
            // Dashboard.js.
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: "33.33%",
            alignItems: "center",
            justifyContent: "center",
            gap: space.xs,
        },
        // Same rounded-band shape used under dates in the month grid.
        legendBand: {
            width: 16,
            height: 4,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            flexShrink: 0,
        },
        // The band sits above the text so the longest label fits its third at 320pt.
        legendText: { ...type.caption, fontSize: 12, color: colors.textSecondary, textAlign: "center", width: "100%" },
        planSection: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            padding: space.lg,
            marginBottom: space.md,
            ...shadow.card,
        },
        planHeader: {
            minHeight: MIN_TOUCH,
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            marginBottom: space.sm,
        },
        planTitle: { ...type.heading, color: colors.text },
        planCount: { ...type.caption, color: colors.textMuted, marginTop: 2, fontVariant: ["tabular-nums"] },
        countBadge: {
            minWidth: 28,
            height: 28,
            paddingHorizontal: space.sm,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: colors.surfaceAlt,
            alignItems: "center",
            justifyContent: "center",
        },
        countBadgeText: {
            ...type.caption,
            color: colors.textSecondary,
            textAlign: "center",
            fontVariant: ["tabular-nums"],
        },
        overdueBadge: { backgroundColor: colors.dangerBg },
        overdueBadgeText: { color: colors.danger, fontWeight: "700" },
        addPlanAction: {
            minHeight: MIN_TOUCH,
            justifyContent: "center",
            paddingHorizontal: space.sm,
        },
        addPlanText: { ...type.label, color: colors.primaryDark },
        planEmpty: { ...type.caption, color: colors.textMuted, paddingVertical: space.md },
        eventRow: {
            flexDirection: "row",
            alignItems: "center",
            padding: space.md,
            borderWidth: 1,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            marginBottom: space.sm,
        },
        swipeRow: {
            position: "relative",
            overflow: "hidden",
            borderRadius: radius.lg,
            borderCurve: "continuous",
            marginBottom: space.sm,
        },
        swipeActions: {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            flexDirection: "row",
            justifyContent: "flex-end",
        },
        swipeForeground: {
            position: "relative",
            zIndex: 1,
            width: "100%",
            overflow: "hidden",
            borderRadius: radius.lg,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
        },
        swipeAction: {
            width: SWIPE_ACTION_WIDTH,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
        },
        swipeLeadingAction: {
            paddingLeft: space.lg,
        },
        swipeDeleteAction: { backgroundColor: colors.danger },
        swipeEventRow: { marginBottom: 0, minHeight: 72 },
        eventWhen: {
            width: 76,
            alignSelf: "stretch",
            justifyContent: "center",
            paddingRight: space.sm,
            borderRightWidth: 1,
            borderRightColor: colors.hairline,
            marginRight: space.md,
        },
        eventWhenText: { ...type.caption, fontWeight: "700", fontVariant: ["tabular-nums"] },
        eventComplete: { marginLeft: space.sm, flexShrink: 0 },
        eventChevron: { marginLeft: space.xs, flexShrink: 0 },
        checkButton: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: space.xs, alignItems: "center", justifyContent: "center", flexShrink: 0 },
        eventTitle: { ...type.label, color: colors.text },
        eventSubtitle: { ...type.caption, color: colors.textMuted, marginTop: 2 },
        modalBg: {
            flex: 1,
            backgroundColor: "rgba(28,25,23,0.55)",
            justifyContent: "center",
            alignItems: "center",
            padding: space.xl,
        },

        modalSubtitle: { fontSize: type.caption.fontSize, fontWeight: "700", color: colors.textMuted, marginBottom: space.md },
        modalNotes: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: space.sm },
        deleteConfirmText: { ...type.body, color: colors.textSecondary, marginTop: space.sm },
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
            borderWidth: 0,
            borderColor: colors.border,
            borderRadius: radius.lg,
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

        modalDeleteBtn: {
            minWidth: 92,
            minHeight: MIN_TOUCH,
            paddingHorizontal: space.lg,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            backgroundColor: colors.danger,
            alignItems: "center",
            justifyContent: "center",
        },
        modalDeleteText: { ...type.label, color: colors.onAccent },
    });
