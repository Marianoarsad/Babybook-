import { shortDate, shiftMonthClamped, todayLocal, toLocalISO } from "./dates";

export const MILK_TYPES = ["Breastmilk", "Formula", "Mixed"];
export const MILK_RANGES = [{ key: "7", label: "7 Days" }, { key: "30", label: "30 Days" }, { key: "3m", label: "3 Months" }, { key: "all", label: "All Time" }];

export function milkDay(value) {
    const iso = String(value || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || toLocalISO(new Date(`${iso}T00:00:00`)) !== iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    return { iso, ordinal: Date.UTC(y, m - 1, d) / 86400000 };
}

export function milkPeriodInfo(row, today = todayLocal()) {
    const start = milkDay(row.start_date), end = milkDay(row.end_date), now = milkDay(today);
    const open = row.end_date == null;
    const valid = Boolean(MILK_TYPES.includes(row.milk_type) && start && (open || end && end.ordinal >= start.ordinal));
    const active = Boolean(valid && now && start.ordinal <= now.ordinal && (open || end.ordinal >= now.ordinal));
    const last = active ? now : end;
    const days = valid && last && last.ordinal >= start.ordinal ? last.ordinal - start.ordinal + 1 : null;
    const status = !valid ? "Dates incomplete or invalid" : active ? "Current recorded period" : start.iso > today ? "Future recorded period" : "Recorded period";
    return { ...row, start: start?.iso || "", end: end?.iso || "", type: row.milk_type || "Unspecified", valid, active, days, status,
        dateLabel: `${start ? shortDate(start.iso) : "Start not recorded"} – ${open ? "Open-ended" : end ? shortDate(end.iso) : "End not recorded"}`,
        durationLabel: days == null ? "Duration unavailable" : `${days.toLocaleString()} ${days === 1 ? "day" : "days"}${active ? " so far" : ""}` };
}

export function milkTypeWindow(range, periods, feeds, today = todayLocal()) {
    const now = milkDay(today);
    let from = today;
    if (range === "all") {
        const starts = [...periods.filter(p => milkPeriodInfo(p, today).valid).map(p => milkDay(p.start_date)?.iso),
            ...feeds.map(f => milkDay(f.date)?.iso)].filter(date => date && date <= today);
        from = starts.sort()[0] || today;
    } else if (range === "3m") from = shiftMonthClamped(today, -3);
    else {
        const date = new Date(`${today}T00:00:00`);
        date.setDate(date.getDate() - (range === "30" ? 29 : 6));
        from = toLocalISO(date);
    }
    return { from, to: today, first: milkDay(from)?.ordinal, last: now?.ordinal };
}

export function searchMilkHistory(rows, query) {
    const needle = query.trim().toLocaleLowerCase();
    return rows.filter(row => [row.type, row.start, row.end, row.dateLabel, row.notes].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle));
}

export function currentMilkPeriods(periods, legacy, today = todayLocal()) {
    const active = periods.map(p => milkPeriodInfo(p, today)).filter(p => p.active);
    if (active.length) return { source: "Saved periods", periods: active };
    return { source: "From feeding history", periods: legacy ? [{ ...legacy, durationLabel: `${legacy.days.toLocaleString()} ${legacy.days === 1 ? "day" : "days"}` }] : [] };
}
