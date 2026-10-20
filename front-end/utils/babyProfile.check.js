const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync(require.resolve("./babyProfile.js"), "utf8").replace(/export function/g, "function");
const { latestProfileMeasurements: latest, commonMeasurementDate: common } = new Function(source + ";return {latestProfileMeasurements,commonMeasurementDate}")();
const rows = [
 {id: 1, date_recorded: "2026-01-01", weight: "7.80", height: 68, head_circumference: "49.7"},
 {id: 2, date_recorded: "2026-01-03", weight: 8, height: "", head_circumference: 0},
 {id: 10, date_recorded: "2026-01-03", weight: "8.10"},
 {id: 11, date_recorded: "2026-01-04", weight: Infinity, height: -1, head_circumference: "bad"},
 {id: 12, date_recorded: "2026-02-30", weight: 99},
 {id: 13, weight: 98},
];
const saved = JSON.stringify(rows);
const metrics = latest(rows);
assert.deepEqual(metrics.map(m => m.value), ["8.10", 68, "49.7"]);
assert.equal(common(metrics), "");
assert.equal(common(latest(rows.slice(0, 1))), "2026-01-01");
assert.equal(common(latest([])), "");
assert(latest([]).every(m => m.value === null && !m.date));
assert.equal(latest([{date_recorded:"2029-12-31",weight:9}])[0].value,9,"Saved future dates are retained");
assert.equal(JSON.stringify(rows), saved,"Selectors never modify records");
assert.equal(latest([...rows].reverse())[0].value,"8.10","ID tie order is deterministic");
console.log("Baby profile measurement checks passed: independent dates, precision, invalid values, partial records, ties, empty/future dates.");
