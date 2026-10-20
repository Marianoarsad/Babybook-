import { todayLocal, toLocalISO, weekOfMonth, weekRangeFromSelection, monthRangeFromSelection, setRangeEndpoint } from "./dates";

export const yearFilterDates = ({ from, to }) => ({ from: `${from}-01-01`, to: `${to}-12-31` });

export function dateFilterDraft(value, today = todayLocal()) {
    const range = value.dateRange || {};
    const month = range.to?.slice(0, 7) || today.slice(0, 7);
    const week = weekOfMonth(range.to) || 1;
    return { ...value, dateRange: { ...range },
        monthRange: { from: range.from?.slice(0, 7) || month, to: month },
        weekRange: { month, from: range.from?.startsWith(month) ? weekOfMonth(range.from) : week, to: week },
        yearRange: { ...(value.yearRange || { from: Number(today.slice(0, 4)), to: Number(today.slice(0, 4)) }) } };
}

export function nutritionPreset(key, draft, { today, minimumDate, availableDates, years }) {
    if (draft.preset === key) return { ...draft, preset: null };
    if (key === "week") {
        const anchor = availableDates.filter(date => date <= today).sort().at(-1) || today;
        const week = weekOfMonth(anchor), month = anchor.slice(0, 7);
        return { ...draft, preset: key, weekRange: { month, from: week, to: week },
            dateRange: weekRangeFromSelection(month, week, week, minimumDate, today) };
    }
    if (key === "month") {
        const month = today.slice(0, 7), monthRange = { from: month, to: month };
        return { ...draft, preset: key, monthRange, dateRange: monthRangeFromSelection(monthRange, minimumDate, today) };
    }
    const yearRange = { from: years.at(-1), to: years.at(-1) };
    return { ...draft, preset: key, yearRange, dateRange: yearFilterDates(yearRange) };
}

export function growthPreset(key, draft, { today, minimumDate, availableDates, years, earliestMonth }) {
    if (draft.preset === key) return { ...draft, preset: null };
    if (key === "week") {
        let anchor = draft.dateRange?.to || today;
        if (minimumDate && anchor < minimumDate) anchor = minimumDate;
        if (anchor > today) anchor = today;
        const month = anchor.slice(0, 7);
        const available = [...new Set(availableDates.filter(date => date.startsWith(month)).map(weekOfMonth))].sort((a, b) => a - b);
        const preferred = weekOfMonth(anchor);
        const week = available.includes(preferred) ? preferred : available.at(-1) || null;
        return { ...draft, preset: key, weekRange: { month, from: week, to: week },
            dateRange: week ? weekRangeFromSelection(month, week, week, minimumDate, today) : null };
    }
    if (key === "month") {
        const current = draft.dateRange || {};
        let from = current.from?.slice(0, 7) >= earliestMonth ? current.from.slice(0, 7) : earliestMonth;
        const to = current.to?.slice(0, 7) <= today.slice(0, 7) ? current.to.slice(0, 7) : today.slice(0, 7);
        if (from > to) from = to;
        const monthRange = { from, to };
        return { ...draft, preset: key, monthRange, dateRange: monthRangeFromSelection(monthRange, minimumDate, today) };
    }
    const from = Math.max(years[0], Math.min(years.at(-1), Number(draft.dateRange?.from?.slice(0, 4)) || years.at(-1)));
    const to = Math.max(from, Math.min(years.at(-1), Number(draft.dateRange?.to?.slice(0, 4)) || from));
    const yearRange = { from, to };
    return { ...draft, preset: key, yearRange, dateRange: yearFilterDates(yearRange) };
}

export function selectFilterPeriod(draft, endpoint, selected, month, minimumDate, today) {
    const kind = draft.preset;
    const old = draft[`${kind}Range`];
    const value = kind === "month" ? `${month.slice(0, 4)}-${String(selected).padStart(2, "0")}` : selected;
    let range = kind === "week" && old.month !== month
        ? { month, from: selected, to: selected } : { ...old, [endpoint]: value };
    if (range.from > range.to) range = endpoint === "from" ? { ...range, to: value } : { ...range, from: value };
    const dateRange = kind === "week" ? weekRangeFromSelection(range.month, range.from, range.to, minimumDate, today)
        : kind === "month" ? monthRangeFromSelection(range, minimumDate, today) : yearFilterDates(range);
    return { ...draft, [`${kind}Range`]: range, dateRange };
}

export function commitFilterDate(draft, endpoint, selected) {
    return dateFilterDraft({ ...draft, preset: null, dateRange: setRangeEndpoint(draft.dateRange, endpoint, selected) });
}

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "")
    && toLocalISO(new Date(`${value}T00:00:00`)) === value;

export function dateFilterError(draft, minimumDate, maximumDate, years) {
    const { from, to } = draft.dateRange || {};
    if (!validDate(from) || !validDate(to)) return "Choose a valid starting and ending date.";
    if (from > to) return "Starting date must be on or before ending date.";
    // Full-year chart buckets intentionally include the days outside the child's recorded history.
    if (draft.preset === "year") {
        const range = draft.yearRange || {}, expected = yearFilterDates(range);
        return years.includes(range.from) && years.includes(range.to) && from === expected.from && to === expected.to
            ? "" : "Choose a year within the available history.";
    }
    if (minimumDate && from < minimumDate) return "Starting date is before the available date range.";
    if (maximumDate && to > maximumDate) return "Ending date cannot be in the future.";
    return "";
}
