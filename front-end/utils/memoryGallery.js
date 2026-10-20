import { fullMonthDate, monthLabel } from "./dates";

export const GALLERY_DEFAULTS = Object.freeze({ category: "all", query: "", sort: "newest", visible: 10 });
const normalize = value => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

export function memoryGalleryView(items, { category = "all", query = "", sort = "newest", visible = 10 } = {}) {
    const counts = { all: items.length, memory: 0, milestone: 0 };
    for (const item of items) if (item.kind in counts) counts[item.kind]++;
    const search = normalize(query);
    const matching = items.filter(item => (category === "all" || item.kind === category)
        && (!search || normalize(`${item.title || ""} ${item.description || ""}`).includes(search)))
        .map((item, index) => ({ item, index, date: fullMonthDate(item.date) ? String(item.date).slice(0, 10) : "" }))
        .sort((a, b) => {
            if (!a.date || !b.date) return Number(!a.date) - Number(!b.date) || a.index - b.index;
            return (sort === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || a.index - b.index;
        });
    const groups = [];
    for (const { item, date } of matching.slice(0, visible)) {
        const key = date.slice(0, 7) || "undated";
        const previous = groups[groups.length - 1];
        if (previous?.key === key) previous.items.push(item);
        else groups.push({ key, label: date ? monthLabel(date) : "Undated", items: [item] });
    }
    return { counts, groups, total: matching.length, remaining: Math.max(0, matching.length - visible) };
}
