const assert = require("assert");
const { GROWTH_METRIC_KEYS, toggleRequiredKey, toggleGrowthMetric } = require("./growthMetricFilter.cjs");

assert.deepStrictEqual(GROWTH_METRIC_KEYS, ["weight", "height", "head"]);
assert.deepStrictEqual(toggleGrowthMetric(GROWTH_METRIC_KEYS, "height"), ["weight", "head"]);
assert.deepStrictEqual(toggleGrowthMetric(["weight", "head"], "height"), GROWTH_METRIC_KEYS);
assert.deepStrictEqual(toggleGrowthMetric(["head"], "head"), ["head"]);
assert.deepStrictEqual(toggleGrowthMetric(["weight"], "unknown"), ["weight"]);
assert.deepStrictEqual(toggleGrowthMetric([], "weight"), GROWTH_METRIC_KEYS);
assert.deepStrictEqual(toggleRequiredKey(["milk", "food"], "milk", ["milk", "food"]), ["food"]);
assert.deepStrictEqual(toggleRequiredKey(["food"], "food", ["milk", "food"]), ["food"]);
assert.deepStrictEqual(toggleRequiredKey([], "milk", ["milk", "food"]), ["milk", "food"]);

console.log("growth metric filter: ok");
