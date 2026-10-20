import { vaccinationToApp } from "./adapters";
import { isVaccinationDate, vaccinationInfo, IMMUNIZATION_BATCH_SIZE } from "./immunizationSummary";
import { shortDate, todayLocal } from "./dates";

export function vaccinationVisitGroup(name) {
    const label = String(name || "").replace(/\bwellness\b/gi, "").replace(/\s+/g, " ").trim();
    if (/^(at\s+)?birth\b/i.test(label)) return { label: "BIRTH", age: 0 };
    const age = /^(\d+)\s*[- ]?\s*(day|week|month|year)s?\b(?:\s+(?:visit|checkup))?$/i.exec(label);
    if (age) return { label: `${Number(age[1])} ${age[2].toUpperCase()}`,
        age: Number(age[1]) * ({ day: 1, week: 7, month: 365.25 / 12, year: 365.25 }[age[2].toLowerCase()]) };
    return { label: label.toUpperCase() || "OTHER", age: null };
}

export function viewerImmunizations(rows, today = todayLocal()) {
    const counts = { all: 0, completed: 0, scheduled: 0, overdue: 0 };
    const records = (Array.isArray(rows) ? rows : []).filter(row => row && typeof row === "object").map((row, index) => {
        const record = vaccinationToApp(row);
        const info = vaccinationInfo(record, today);
        const status = info.status === "dueSoon" ? "scheduled" : info.status;
        const date = status === "completed" ? record.completedDate : record.dueDate;
        counts[status]++;
        return { ...record, status, key: `snapshot-${index}`, group: vaccinationVisitGroup(record.visitName),
            dateLabel: isVaccinationDate(date) ? shortDate(date) : status === "completed" ? "Administration date not recorded" : "Due date not recorded",
            sortDate: isVaccinationDate(record.dueDate) ? record.dueDate : isVaccinationDate(record.completedDate) ? record.completedDate : "9999" };
    });
    counts.all = records.length;
    const groups = new Map();
    for (const record of records) {
        if (!groups.has(record.group.label)) groups.set(record.group.label, []);
        groups.get(record.group.label).push(record);
    }
    const ordered = [...groups.entries()].map(([label, entries]) => [label, entries.sort((a, b) => a.sortDate.localeCompare(b.sortDate))]);
    ordered.sort(([, a], [, b]) => {
        if (a[0].group.age != null || b[0].group.age != null) return (a[0].group.age ?? Infinity) - (b[0].group.age ?? Infinity);
        if (a[0].group.label === "OTHER" || b[0].group.label === "OTHER") return (a[0].group.label === "OTHER" ? 1 : 0) - (b[0].group.label === "OTHER" ? 1 : 0);
        return a[0].sortDate.localeCompare(b[0].sortDate);
    });
    return { counts, records: ordered.flatMap(([, entries]) => entries) };
}

export function selectViewerImmunizations(records, filter = "all", query = "", visible = IMMUNIZATION_BATCH_SIZE) {
    const search = query.trim().toLowerCase();
    const matching = records.filter(record => (filter === "all" || record.status === filter) && (!search ||
        [record.vaccineName, record.visitName, record.notes, record.doseNumber == null ? "" : `Dose ${record.doseNumber}`].join(" ").toLowerCase().includes(search)));
    const groups = new Map();
    for (const record of matching.slice(0, visible)) {
        if (!groups.has(record.group.label)) groups.set(record.group.label, []);
        groups.get(record.group.label).push(record);
    }
    return { groups: [...groups.entries()], total: matching.length, remaining: Math.max(0, matching.length - visible),
        empty: search ? "No vaccines match your search." : { all: "No immunization records available.", completed: "No completed vaccinations recorded.",
            scheduled: "No scheduled vaccinations recorded.", overdue: "No overdue vaccinations." }[filter] };
}
