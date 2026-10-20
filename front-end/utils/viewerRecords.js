import { isActiveOn, plannedEnd } from "./medication";
import { spanText, toLocalISO } from "./dates";

export function medicationStatus(record, today) {
    if (record.resolved === true) return "completed";
    const date = String(record.date_recorded || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || toLocalISO(new Date(`${date}T00:00:00`)) !== date) return "Status not recorded";
    const med = { date, courseDays: record.course_days, resolved: false };
    if (isActiveOn(med, today)) return "taking";
    const end = plannedEnd(date, med.courseDays);
    return end && end < today ? "Course ended" : date > today ? "Not started" : "Status not recorded";
}

export function medicalHistoryRows(payload) {
    const rows = (payload.medicalHistory || []).filter((row) => !["Medication", "Allergy", "Hereditary Condition"].includes(row.category));
    if (!payload.allergies) return rows;
    const entries = [...(payload.allergies.allergyEntries || []), ...(payload.allergies.hereditaryEntries || [])];
    const seen = new Set(entries.map((row) => `${row.category}:${String(row.title || "").trim().toLowerCase()}`));
    const food = new Set((payload.allergies.foodAllergies || []).map((title) => String(title).trim().toLowerCase()));
    const legacy = [["Allergy", payload.allergies.allergies || []],
        ["Hereditary Condition", payload.allergies.hereditaryConditions || []]].flatMap(([category, titles]) => titles.filter((title) => {
        const name = String(title || "").trim().toLowerCase();
        const key = `${category}:${name}`;
        if (!name || seen.has(key)) return false;
        seen.add(key); return true;
    }).map((title) => ({ title, category, legacy: true,
        allergy_type: category === "Allergy" && food.has(String(title).trim().toLowerCase()) ? "food" : null })));
    return [...rows, ...entries, ...legacy].sort((a, b) => String(b.date_recorded || "").localeCompare(String(a.date_recorded || "")));
}

export function conditionDuration(record, today) {
    if (!record.date_recorded || typeof record.resolved !== "boolean" || (record.resolved && !record.resolved_date)) return "Duration not recorded";
    const end = record.resolved ? record.resolved_date : today;
    const startDate = new Date(`${String(record.date_recorded).slice(0, 10)}T00:00:00`);
    const endDate = new Date(`${String(end).slice(0, 10)}T00:00:00`);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate < startDate) return "Duration not recorded";
    return spanText(record.date_recorded, end);
}
