import { toLocalISO } from "./dates";
import { plannedEnd } from "./medication";

export function buildCalendarEvents(vaccinations, checkups, medHistory, customEvents, planStatuses) {
    const byDate = {};
    const statusByKey = new Map((planStatuses || []).map((status) => [
        `${status.source_type}:${status.source_id}:${String(status.occurrence_date).slice(0, 10)}`,
        status,
    ]));
    const add = (dateStr, event) => {
        if (!dateStr) return;
        const key = String(dateStr).slice(0, 10);
        const planKey = `${event.sourceType}:${event.sourceId}:${key}`;
        const status = statusByKey.get(planKey);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push({
            ...event,
            date: key,
            planKey,
            planStatusId: status?.id || null,
            completed: status ? status.completed : !!event.sourceCompleted,
            pending: !!status?._pending,
        });
    };
    
    (vaccinations || []).forEach((v) =>
        add(v.due_date, {
            id: `vax-${v.id}`,
            sourceType: "vaccination",
            sourceId: v.id,
            category: "vaccination",
            title: v.vaccine_name,
            subtitle: v.visit_name || "",
            notes: v.notes || "",
            sourceCompleted: v.status === "completed",
            time: "",
            sourceRecord: v,
        }),
    );
    (checkups || []).forEach((c) =>
        add(c.checkup_date, {
            id: `chk-${c.id}`,
            sourceType: "checkup",
            sourceId: c.id,
            category: "checkup",
            title: c.title || "Checkup",
            subtitle: c.doctor_name || c.clinic || "",
            notes: c.notes || "",
            sourceCompleted: c.status === "completed",
            time: c.time_of_visit ? String(c.time_of_visit).slice(0, 5) : "",
            sourceRecord: c,
        }),
    );
    (medHistory || []).forEach((m) => {
        const category =
            m.category === "Medication"
                ? "medication"
                : m.category === "Hospitalization"
                  ? "hospitalization"
                  : "illness";
        const start = m.date_recorded ? String(m.date_recorded).slice(0, 10) : "";
        const rawEnd = category === "medication" ? m.resolved_date || plannedEnd(start, m.course_days) : start;
        const rangeEnd = rawEnd ? String(rawEnd).slice(0, 10) : start;
        const entry = {
            id: `med-${m.id}`,
            sourceType: "medical-history",
            sourceId: m.id,
            category,
            title: m.title,
            subtitle: m.category,
            notes: m.description || m.notes || "",
            sourceCompleted: !!m.resolved,
            time: "",
            rangeStart: start,
            rangeEnd,
            sourceRecord: m,
        };
        add(start, entry);
        // A course runs for days, and marking only its first day made a
        // week of antibiotics look like a one-off event. Fill in every
        // day up to the end — the actual finish date if the parent
        // recorded one, otherwise the planned one. Capped so a
        // mistyped course length cannot paint a year of the calendar.
        if (m.category === "Medication" && m.date_recorded) {
            const last = rangeEnd;
            if (last && last > start) {
                const cursor = new Date(`${start}T00:00:00`);
                for (let i = 0; i < 120; i++) {
                    cursor.setDate(cursor.getDate() + 1);
                    const iso = toLocalISO(cursor);
                    if (!iso || iso > last) break;
                    add(iso, { ...entry, id: `med-${m.id}-${iso}`, courseOccurrence: true });
                }
            }
        }
    });
    (customEvents || []).forEach((e) =>
        add(e.event_date, {
            id: `cal-${e.id}`,
            rawId: e.id,
            sourceType: "calendar-event",
            sourceId: e.id,
            sourceCompleted: false,
            category: "custom",
            title: e.title,
            subtitle: "",
            notes: e.description || "",
            time: e.event_time ? String(e.event_time).slice(0, 5) : "",
            reminderSettings: e.reminder_settings || null,
            sourceRecord: e,
        }),
    );
    
    return byDate;
}
