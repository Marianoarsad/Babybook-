import { compactDate, weekdayAbbreviation, todayLocal } from "./dates";
import { milkDay, milkTypeWindow } from "./milkTypeHistory";

export function feedingCountAxis(highest) {
    if (highest <= 0) return { max: 4, step: 1, ticks: [0, 1, 2, 3, 4] };
    const padded = highest * 1.1, target = padded / 6, power = 10 ** Math.floor(Math.log10(target));
    const step = Math.max(1, Math.ceil([1, 2, 2.5, 5, 10].find(value => value * power >= target) * power));
    const max = Math.ceil(padded / step) * step;
    return { max, step, ticks: Array.from({ length: max / step + 1 }, (_, i) => i * step) };
}

// UTC here represents calendar ordinals, never timestamps from feeding records.
const iso = ordinal => new Date(ordinal * 86400000).toISOString().slice(0, 10);


export function buildFeedingCountChart(feeds, categories, classify, range = "7", today = todayLocal()) {
    const emptyValues = () => Object.fromEntries(categories.map(type => [type, 0]));
    const valid = feeds.filter(feed => milkDay(feed.date) && milkDay(feed.date).iso <= today);
    const window = milkTypeWindow(range, [], valid, today);
    const granularity = range === "all" ? "month" : range === "3m" ? "week" : "day";
    const bucketStart = ordinal => {
        const date = new Date(ordinal * 86400000);
        return granularity === "month" ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 86400000
            : granularity === "week" ? ordinal - date.getUTCDay() : ordinal;
    };
    const points = [], byStart = new Map();
    for (let start = bucketStart(window.first); start <= window.last;) {
        const date = new Date(start * 86400000);
        const next = granularity === "month" ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 86400000 : start + (granularity === "week" ? 7 : 1);
        const from = iso(Math.max(start, window.first)), to = iso(Math.min(next - 1, window.last));
        const local = new Date(`${from}T00:00:00`);
        const point = { from, to, values: emptyValues(), total: 0, entries: [],
            label: granularity === "day" ? weekdayAbbreviation(local) : granularity === "week" ? "Week of" : local.toLocaleDateString("en-US", { month: "short" }),
            subLabel: granularity === "month" ? String(local.getFullYear()) : compactDate(from) };
        points.push(point); byStart.set(start, point); start = next;
    }
    let excluded = 0;
    for (const feed of valid) {
        const day = milkDay(feed.date).ordinal;
        if (day < window.first || day > window.last) continue;
        const type = classify(feed);
        if (!type) { excluded++; continue; }
        const point = byStart.get(bucketStart(day));
        point.values[type]++; point.total++; point.entries.push(feed);
    }
    const totals = emptyValues();
    for (const point of points) for (const type of categories) totals[type] += point.values[type];
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
    const percentages = Object.fromEntries(categories.map(type => [type, total ? totals[type] / total * 100 : null]));
    return { window, granularity, points, totals, total, percentages, excluded,
        axis: feedingCountAxis(Math.max(0, ...points.map(point => point.total))) };
}
