const GROWTH_METRIC_KEYS = Object.freeze(["weight", "height", "head"]);

function toggleRequiredKey(keys, key, allowedKeys) {
    const selected = Array.isArray(keys) ? keys : [];
    const current = allowedKeys.filter((item) => selected.includes(item));
    if (!current.length) return [...allowedKeys];
    if (!allowedKeys.includes(key)) return current;
    if (current.includes(key)) {
        return current.length === 1 ? current : current.filter((item) => item !== key);
    }
    return allowedKeys.filter((item) => current.includes(item) || item === key);
}

function toggleGrowthMetric(keys, key) {
    return toggleRequiredKey(keys, key, GROWTH_METRIC_KEYS);
}

module.exports = { GROWTH_METRIC_KEYS, toggleRequiredKey, toggleGrowthMetric };
