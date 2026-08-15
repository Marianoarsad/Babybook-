// Pure statistics over a child's nutrition entries.
//
// Lifted out of NutritionTracker.js so the arithmetic a parent reads can be
// checked without rendering a screen — same reasoning as whoGrowth.js and
// dates.js, and covered by feedingStats.check.js. Nothing here touches the
// network, the theme, or React.
//
// Every function takes app-shape entries (utils/adapters.js `nutritionToApp`),
// where a feed is `{ entryType, feedMethod, milkType, quantity, unit,
// durationMinutes, foodIntroduced, reactionSeverity, date, time }`.
// `durationMinutes` is null on plenty of real breastfeeds — it is optional.
import { minutesBetween, todayLocal } from "./dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Chronological, oldest first. Entry dates and times are separate plain
// columns, so anything comparing two feeds has to stitch them back together.
export const byMoment = (a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));

export const foodKey = (name) => String(name || "").trim().toLowerCase();

function periodStart(d, gran) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (gran === "day") return x;
    if (gran === "week") {
        x.setDate(x.getDate() - x.getDay()); // week starting Sunday
        return x;
    }
    return new Date(d.getFullYear(), d.getMonth(), 1); // month
}
function bucketLabel(d, gran) {
    const s = periodStart(d, gran);
    if (gran === "month") return MONTHS[s.getMonth()];
    return `${s.getMonth() + 1}/${s.getDate()}`;
}

// Entries inside a range. `offsetPeriods: 1` returns the window immediately
// before it, same length — that's how the night-feed comparison gets its
// "previous 7 days" without a second definition of what a period is.
// A range with no `days` (All Time) has no previous window, by definition.
export function inRangeOf(entries, rangeObj, offsetPeriods = 0, now = Date.now()) {
    if (!rangeObj || !rangeObj.days) return offsetPeriods ? [] : entries.slice();
    const span = rangeObj.days * 86400000;
    const end = now - offsetPeriods * span;
    const start = end - span;
    return entries.filter((e) => {
        const t = new Date(`${e.date}T00:00:00`).getTime();
        return !isNaN(t) && t > start && t <= end;
    });
}

// Buckets for the bar chart. `valueOf` decides what is being summed — feeds,
// millilitres, or minutes at the breast. The measure used to be hardcoded to
// millilitres, which drew a day of eight breastfeeds as an empty bar.
export function buildBuckets(entries, rangeObj, valueOf, now = Date.now()) {
    if (!entries.length) return { bars: [], days: 0, total: 0 };
    const rows = inRangeOf(entries, rangeObj, 0, now);
    if (!rows.length) return { bars: [], days: 0, total: 0 };
    const dates = rows.map((e) => new Date(e.date));
    const minD = new Date(Math.min.apply(null, dates));
    const spanDays = rangeObj.days || Math.max(1, Math.round((now - minD.getTime()) / 86400000) + 1);
    const gran = spanDays <= 14 ? "day" : spanDays <= 120 ? "week" : "month";
    const map = {};
    let total = 0;
    for (const e of rows) {
        const d = new Date(e.date);
        const key = periodStart(d, gran).getTime();
        if (!map[key]) map[key] = { value: 0, sort: key, label: bucketLabel(d, gran) };
        const v = valueOf(e) || 0;
        map[key].value += v;
        total += v;
    }
    const bars = Object.keys(map)
        .map((k) => map[k])
        .sort((a, b) => a.sort - b.sort);
    return { bars, days: spanDays, total };
}

function dayDiffInclusive(a, b) {
    return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
}

// Consecutive same-milk-type runs. Editing an entry's type re-groups the runs,
// so a previous period ends and a new one begins exactly as specified.
export function milkDurations(milk, today = todayLocal()) {
    if (!milk.length) return { periods: [], current: null };
    const sorted = milk.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const runs = [];
    for (const e of sorted) {
        const last = runs[runs.length - 1];
        const t = e.milkType || "Unspecified";
        if (last && last.type === t) last.end = e.date;
        else runs.push({ type: t, start: e.date, end: e.date });
    }
    const periods = runs.map((r) => ({
        type: r.type,
        start: r.start,
        end: r.end,
        days: dayDiffInclusive(r.start, r.end),
    }));
    const lastRun = runs[runs.length - 1];
    const current = lastRun
        ? { type: lastRun.type, start: lastRun.start, days: dayDiffInclusive(lastRun.start, today) }
        : null;
    return { periods, current };
}

// Longest stretch between consecutive feeds, and the day it started. The
// number a parent actually watches for — "is she going longer between feeds
// now" — and nothing in the app reported it. Entries without a time can't be
// placed on a clock, so they're skipped rather than assumed to be midnight.
export function longestGap(rows) {
    const sorted = rows.filter((e) => e.time).sort(byMoment);
    let best = null;
    for (let i = 1; i < sorted.length; i++) {
        const mins = minutesBetween(sorted[i - 1].date, sorted[i - 1].time, sorted[i].date, sorted[i].time);
        if (mins != null && mins > 0 && (!best || mins > best.minutes)) {
            best = { minutes: mins, date: sorted[i - 1].date };
        }
    }
    return best;
}

// A "night feed" is one logged between 22:00 and 05:59. An entry with no time
// is not a night feed — it's a feed with no time. The hour must be parsed from
// a non-empty string, because `Number("")` is 0, which would otherwise sail
// through the `< 6` test and count every untimed entry as a night feed.
export function nightStats(rows, nights) {
    const count = rows.filter((e) => {
        const raw = String(e.time || "").slice(0, 2);
        if (!raw.trim()) return false;
        const h = Number(raw);
        return Number.isFinite(h) && (h >= 22 || h < 6);
    }).length;
    return { count, perNight: nights > 0 ? count / nights : 0 };
}

// Distinct foods, when each was first tried, and which ones drew a reaction.
// Names are matched case- and whitespace-insensitively, without which
// "Banana", "banana" and " Banana " count as three separate foods.
export function solidFoodStats(solids, monthPrefix) {
    const firstByFood = new Map();
    for (const e of solids.slice().sort(byMoment)) {
        const key = foodKey(e.foodIntroduced);
        if (key && !firstByFood.has(key)) firstByFood.set(key, e);
    }
    const firsts = [...firstByFood.values()];
    return {
        distinct: firstByFood.size,
        first: firsts.length ? firsts.slice().sort(byMoment)[0] : null,
        newThisMonth: monthPrefix ? firsts.filter((e) => e.date.slice(0, 7) === monthPrefix).length : 0,
        reactions: solids
            .filter((e) => e.reactionSeverity === "mild" || e.reactionSeverity === "severe")
            .sort((a, b) => byMoment(b, a)),
    };
}

// Distinct food names already logged, newest first — the one-tap chips on the
// add form. Reusing a name is what keeps `solidFoodStats().distinct` honest.
export function recentFoodNames(solids, limit) {
    const seen = [];
    for (const e of solids.slice().sort((a, b) => byMoment(b, a))) {
        const name = String(e.foodIntroduced || "").trim();
        if (name && !seen.some((s) => foodKey(s) === foodKey(name))) seen.push(name);
        if (seen.length >= limit) break;
    }
    return seen;
}

// First foods a Filipino family is most likely to start with. These exist ONLY
// so the very first solid-food entry isn't typed into a bare box — they are
// text shortcuts for a free-text field, exactly like the recent-food chips
// they stand in for.
//
// They are deliberately not advice: no ages, no order, no quantities, no
// "recommended", and no claim that any health authority endorses them.
// PRODUCT.md Principle 5 makes the app a recorder, not an adviser, and its
// list of absences forbids implying a DOH or barangay relationship. The
// screen labels these "Common first foods", which is a statement about what
// Filipino families commonly do, not about what this family should do.
export const STARTER_FOODS = [
    "Lugaw",
    "Mashed banana",
    "Kalabasa",
    "Kamote",
    "Papaya",
    "Avocado",
    "Malunggay",
    "Egg yolk",
];

// Chips for the food field: this child's own history when there is any,
// the starter list when there isn't. `fromHistory` lets the screen label the
// two cases differently — a parent must never mistake a suggestion for
// something they already recorded.
export function foodSuggestions(solids, limit) {
    const own = recentFoodNames(solids, limit);
    if (own.length) return { foods: own, fromHistory: true };
    return { foods: STARTER_FOODS.slice(0, limit), fromHistory: false };
}

// Whether any breastfeed actually carries a duration. Duration is optional, so
// a child can have plenty of breastfeeds and no minutes at all — in which case
// offering a "Breast time" chart measure would plot a flat zero and read as
// "no feeding", the very confusion the measure switch exists to prevent.
export function hasBreastDurations(milk) {
    return milk.some((e) => e.feedMethod === "breast" && e.durationMinutes > 0);
}
