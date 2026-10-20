// Run: node utils/hospitalStays.check.js — in-memory fixtures only.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { transformSync } = require("@babel/core");
const modules = new Map();
function load(file) {
    const filename = path.resolve(__dirname, file);
    if (filename.endsWith(".cjs")) return require(filename);
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const code = transformSync(fs.readFileSync(filename, "utf8"), { babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"] }).code;
    new Function("require", "module", "exports", code)(name => load(path.resolve(path.dirname(filename), name + (path.extname(name) ? "" : ".js"))), module, module.exports);
    return module.exports;
}
const { hospitalStaySummary: summarize, hospitalStayInfo: info } = load("hospitalStays.js");
const today = "2026-10-15";
const stay = (id, start, end, resolved = true) => ({ id, category: "Hospitalization", title: `Stay ${id}`, facility: "Recorded hospital", date_recorded: start, resolved_date: end, resolved, description: "Saved notes" });
const rows = [stay(1, "2026-01-03", "2026-01-07"), stay(2, "2025-08-12", "2025-08-15"), stay(3, "2024-02-20", "2024-02-22")];
assert.deepEqual(summarize([], today), { stays: [], counts: { all: 0, current: 0, past: 0 }, totalDays: 0, excludedStays: 0 });
const before = JSON.stringify(rows), summary = summarize(rows, today);
assert.equal(summary.totalDays, 12); assert.deepEqual(summary.counts, { all: 3, current: 0, past: 3 });
assert.deepEqual(summary.stays.map(row => row.days), [5, 4, 3]); assert.equal(JSON.stringify(rows), before);
assert.equal(summary.stays[0].facility, "Recorded hospital"); assert.equal(summary.stays[0].desc, "Saved notes");
const current = info(stay(4, "2026-10-14", null, false), today);
assert.equal(current.days, 2); assert.equal(current.stayStatus, "current"); assert.equal(current.durationLabel, "2 days so far");
assert(current.dateLabel.includes("Ongoing since")); assert(!current.dateLabel.includes("Discharge"));
assert.equal(summarize([...rows, stay(4, "2026-10-14", null, false)], today).totalDays, 12, "Ongoing stays never enter Total Days");
assert.equal(info(stay(1, today, today), today).days, 1);
assert.equal(info(stay(1, "2024-02-28", "2024-03-01"), today).days, 3, "Leap-day boundaries are calendar days");
assert.equal(info(stay(1, "2025-12-31", "2026-01-01"), today).days, 2);
assert.equal(info(stay(1, "2026-01-01", null, false), today).stayStatus, "current", "Old admission does not imply discharge");
assert.equal(info(stay(1, today, today, null), today).stayStatus, "other");
assert.deepEqual(summarize([stay(1, today, today, null)], today).counts, { all: 1, current: 0, past: 0 });
for (const [start, end] of [[null, today], [today, null], [today, "bad"], ["2026-02-30", today], [today, "2026-10-14"], [today, "2026-10-16"]]) {
    assert.equal(info(stay(1, start, end), today).days, null);
    const missing = summarize([stay(1, start, end)], today);
    assert.equal(missing.counts.past, 1); assert.equal(missing.totalDays, null); assert.equal(missing.excludedStays, 1);
}
assert.equal(info(stay(1, "2026-10-16", null, false), today).days, null);
assert.equal(summarize([...rows, stay(4, today, null)], today).totalDays, 12);
assert.equal(summarize([...rows, stay(4, today, null)], today).excludedStays, 1);
assert.equal(summarize([stay(1, "2026-01-01", "2026-01-03"), stay(2, "2026-01-01", "2026-01-03")], today).totalDays, 6, "Separate overlapping records sum separately");
assert.equal(summarize([{ ...rows[0], category: "Illness" }, ...rows], today).counts.all, 3);
assert.equal(info({ date: today, resolvedDate: today, resolved: true }, today).days, 1, "Details support the existing adapted record shape");
const store = require("./recordStore.cjs"); store.reset();
const read = child => summarize(store.getRows(child, "medical-history"), today);
store.acceptFetch("a", "medical-history", rows, store.startFetch("a", "medical-history"));
store.confirm("a", "medical-history", stay(4, today, null, false), 4);
assert.equal(read("a").counts.current, 1);
store.confirm("a", "medical-history", stay(4, today, today), 4);
assert.equal(read("a").counts.current, 0); assert.equal(read("a").totalDays, 13);
store.confirm("a", "medical-history", null, 4, true); assert.equal(read("a").totalDays, 12);
store.acceptFetch("b", "medical-history", [stay(8, today, null, false)], store.startFetch("b", "medical-history"));
assert.equal(read("b").counts.all, 1); assert.equal(read("b").totalDays, 0); assert.equal(read("a").counts.all, 3);
assert.deepEqual(read("a").stays.map(row => row.id), ["1", "2", "3"]);
store.reset();
console.log("Hospital summary checks passed: inclusive dates, clinical status, discharged-only totals, partial/missing data, overlaps, updates and child isolation.");
