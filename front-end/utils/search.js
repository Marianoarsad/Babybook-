const clean = (value) => String(value || "").trim().replace(/\s+/g, " ");

export function addRecentSearch(history, term, limit = 6) {
    const next = clean(term);
    if (!next) return history;
    return [next, ...(history || []).filter((item) => clean(item).toLowerCase() !== next.toLowerCase())].slice(0, limit);
}

export function searchSuggestions(items, fallbacks, limit = 8) {
    const recentTitles = [...(items || [])]
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
        .map((item) => clean(item.title))
        .filter((title) => title && title.length <= 32);
    const seen = new Set();
    return [...recentTitles, ...(fallbacks || [])].filter((term) => {
        const key = clean(term).toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, limit);
}
