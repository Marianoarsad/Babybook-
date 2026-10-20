import { shortDate, todayLocal, toLocalISO } from "./dates";

export const DUE_SOON_DAYS = 30;
export const IMMUNIZATION_BATCH_SIZE = 10;
export const IMMUNIZATION_EMPTY = {
    all: "No immunization records available.",
    completed: "No completed vaccinations recorded yet.",
    dueSoon: "No vaccinations due soon.",
    overdue: "No overdue vaccinations.",
};

function dayNumber(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "") || toLocalISO(new Date(`${value}T00:00:00`)) !== value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
}

export function vaccinationInfo(vaccine, today = todayLocal()) {
    const due = dayNumber(vaccine.dueDate), now = dayNumber(today);
    // isCompleted comes only from the saved clinical status, never a Calendar checkbox.
    const status = vaccine.isCompleted === true ? "completed" : due == null || now == null ? "scheduled"
        : due < now ? "overdue" : due <= now + DUE_SOON_DAYS ? "dueSoon" : "scheduled";
    const statusLabel = { completed: "Completed", overdue: "Overdue", dueSoon: "Due soon", scheduled: "Scheduled" }[status];
    const dateLabel = status === "completed"
        ? dayNumber(vaccine.completedDate) == null ? "Administration date not recorded" : `Given ${shortDate(vaccine.completedDate)}`
        : due == null ? "Due date not recorded" : `Due ${shortDate(vaccine.dueDate)}`;
    return { status, statusLabel, dateLabel };
}

export function immunizationSummary(vaccines, today = todayLocal()) {
    const counts = { all: 0, completed: 0, dueSoon: 0, overdue: 0 };
    const seen = new Set();
    const records = vaccines.filter(record => {
        const id = String(record.id);
        if (seen.has(id)) return false;
        seen.add(id); return true;
    }).sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
        .map(record => ({ ...record, ...vaccinationInfo(record, today) }));
    counts.all = records.length;
    for (const record of records) if (record.status in counts) counts[record.status]++;
    return { counts, records };
}

export function selectImmunizations(records, filter = "all", search = "", visible = IMMUNIZATION_BATCH_SIZE) {
    const q = search.trim().toLowerCase();
    const matching = records.filter(record => (filter === "all" || record.status === filter)
        && (!q || [record.vaccineName, record.visitName, record.notes, record.doseNumber == null ? "" : `Dose ${record.doseNumber}`]
            .join(" ").toLowerCase().includes(q)));
    const groups = new Map();
    for (const record of matching.slice(0, visible)) {
        const label = record.visitName || "Other";
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(record);
    }
    return { groups: Array.from(groups.entries()), remaining: Math.max(0, matching.length - visible), total: matching.length,
        emptyMessage: q ? "No vaccines match your search." : IMMUNIZATION_EMPTY[filter] };
}

// Reveal one stable dose ID without changing its saved clinical state.
export function revealImmunization(records, selection, id) {
    const index = records.findIndex(record => String(record.id) === String(id));
    if (index < 0) return selection;
    const hidden = !selectImmunizations([records[index]], selection.filter, selection.search, 1).total;
    return { filter: hidden ? "all" : selection.filter, search: hidden ? "" : selection.search,
        visible: Math.max(selection.visible, IMMUNIZATION_BATCH_SIZE, index + 1) };
}
