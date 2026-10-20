import { medHistoryToIllness } from "./adapters";
import { shortDate, todayLocal, toLocalISO } from "./dates";

function calendarDay(value) {
    const iso = String(value || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || toLocalISO(new Date(`${iso}T00:00:00`)) !== iso) return null;
    const [year, month, day] = iso.split("-").map(Number);
    return { iso, ordinal: Date.UTC(year, month - 1, day) / 86400000 };
}

// Hospital days include both dates. Calendar planner checkboxes never imply discharge.
export function hospitalStayInfo(record, today = todayLocal()) {
    const admission = calendarDay(record.date_recorded ?? record.date);
    const discharge = calendarDay(record.resolved_date ?? record.resolvedDate);
    const now = calendarDay(today);
    const stayStatus = record.resolved === true ? "past" : record.resolved === false ? "current" : "other";
    const end = stayStatus === "past" ? discharge : stayStatus === "current" ? now : null;
    const days = admission && end && now && end.ordinal >= admission.ordinal && end.ordinal <= now.ordinal
        ? end.ordinal - admission.ordinal + 1 : null;
    const admitted = admission ? shortDate(admission.iso) : "Admission date not recorded";
    const dateLabel = stayStatus === "past" ? `${admitted} – ${discharge ? shortDate(discharge.iso) : "Discharge date not recorded"}`
        : stayStatus === "current" ? admission ? `Ongoing since ${shortDate(admission.iso)}` : admitted : admitted;
    const statusLabel = stayStatus === "past" ? "Discharged" : stayStatus === "current" ? "Ongoing" : "Status not recorded";
    const durationLabel = days == null ? "Duration not recorded" : `${days.toLocaleString()} ${days === 1 ? "day" : "days"}${stayStatus === "current" ? " so far" : ""}`;
    return { stayStatus, statusLabel, days, dateLabel, durationLabel };
}

export function hospitalStaySummary(medicalHistory, today = todayLocal()) {
    const rows = medicalHistory.filter(record => record.category === "Hospitalization");
    const counts = { all: rows.length, current: 0, past: 0 };
    let totalDays = 0, excludedStays = 0, measuredStays = 0;
    const stays = [...rows].sort((a, b) => String(b.date_recorded || "").localeCompare(String(a.date_recorded || ""))
        || (Number(b.id) - Number(a.id) || 0)).map(record => {
        const info = hospitalStayInfo(record, today);
        if (info.stayStatus !== "other") counts[info.stayStatus]++;
        if (info.stayStatus === "past") {
            if (info.days == null) excludedStays++;
            else { totalDays += info.days; measuredStays++; }
        }
        return { ...medHistoryToIllness(record), resolved: record.resolved, ...info };
    });
    // A sum of separate discharged stays, not a union of hospitalized calendar dates.
    return { stays, counts, totalDays: counts.past && !measuredStays ? null : totalDays, excludedStays };
}
