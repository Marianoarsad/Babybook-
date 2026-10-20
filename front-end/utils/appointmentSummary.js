import { checkupToApp } from "./adapters";
import { buildCalendarEvents } from "./calendarEvents";
import { todayLocal, toLocalISO } from "./dates";

export const APPOINTMENT_STATUS_LABELS = {
    completed: "Completed", upcoming: "Upcoming", overdue: "Overdue", other: "Status not recorded",
};

// Calendar checkboxes are planner completion, independent of clinical checkup status.
export function appointmentSummary(checkups, planStatuses, today = todayLocal()) {
    const events = Object.values(buildCalendarEvents([], checkups, [], [], planStatuses)).flat();
    const byId = new Map(events.map(event => [String(event.sourceId), event]));
    const counts = { all: checkups.length, completed: 0, upcoming: 0, overdue: 0 };
    const appointments = [...checkups].sort((a, b) => String(b.checkup_date || "").localeCompare(String(a.checkup_date || ""))
        || (Number(b.id) - Number(a.id) || 0)).map(record => {
        const appt = checkupToApp(record), event = byId.get(appt.id);
        const completed = event ? event.completed : appt.isCompleted;
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(appt.date) && toLocalISO(new Date(`${appt.date}T00:00:00`)) === appt.date;
        const calendarStatus = completed ? "completed" : record.status !== "scheduled" && record.status !== "completed"
            ? "other" : !validDate ? "other" : appt.date < today ? "overdue" : "upcoming";
        if (calendarStatus !== "other") counts[calendarStatus]++;
        return { ...appt, calendarStatus, calendarPending: !!event?.pending };
    });
    return { appointments, counts };
}
