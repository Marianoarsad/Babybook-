// In-memory fixtures only: node utils/milkTypeHistory.check.js
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
const M = load("milkTypeHistory.js"), { milkDurations } = load("feedingStats.js"), { buildRecordHtml } = load("pdfTemplate.js");
const today = "2026-10-15", period = (id, type, start, end = null) => ({ id, milk_type: type, start_date: start, end_date: end });
const records = [period(1, "Breastmilk", "2024-02-28", "2026-10-15"), period(2, "Formula", "2026-10-09"),
    period(3, "Mixed", today, today), period(4, "Formula", today, today), period(5, "Formula", today, today), period(6, "Mixed", "2026-10-16")];
const before = JSON.stringify(records), window = M.milkTypeWindow("7", records, [], today);
assert.equal(window.from, "2026-10-09"); assert.equal(window.to, today);
assert.equal(M.milkTypeWindow("30", [], [], today).from, "2026-09-16");
assert.equal(M.milkTypeWindow("3m", [], [], "2026-05-31").from, "2026-02-28");
assert.equal(M.milkTypeWindow("all", records, [], today).from, "2024-02-28");
assert.equal(M.milkTypeWindow("all", [], [{ date: "2020-01-01" }], today).from, "2020-01-01");
assert.equal(M.milkPeriodInfo(period(1, "Mixed", "2024-02-28", "2024-03-01"), today).days, 3);
assert.equal(M.milkPeriodInfo(period(1, "Mixed", "2026-03-07", "2026-03-09"), today).days, 3, "DST boundaries count calendar dates");
assert.equal(M.milkPeriodInfo(period(1, "Formula", today), today).days, 1);
assert.equal(M.milkPeriodInfo(records[5], today).active, false);
for (const row of [period(1, "Formula", "bad"), period(1, "Formula", "2026-02-30"), period(1, "Formula", today, "2026-10-14"), period(1, "other", today)]) {
    assert.equal(M.milkPeriodInfo(row, today).valid, false);
}
assert.equal(records.map(p => M.milkPeriodInfo(p, today)).length, 6, "Every overlapping period remains accessible");
assert.equal(JSON.stringify(records), before, "Period presentation never changes saved records");
const feed = (id, milkType, date) => ({ id, entryType: "milk", milkType, date });
const feeds = [feed("a", "Formula", today), feed("b", "Formula", today), feed("c", "Mixed", today), feed("d", "Breastmilk", "2026-10-09"),
    feed("e", "Breastmilk", "2026-10-08"), feed("f", "Mixed", "2026-10-16"), feed("g", "Formula", "bad")];
assert.equal(M.currentMilkPeriods(records, null, today).periods.length, 5, "Every explicit active period is preserved");
const legacy = milkDurations(feeds.filter(f => f.date !== "bad"), today);
assert.equal(M.currentMilkPeriods([], legacy.current, today).source, "From feeding history");
assert.equal(M.currentMilkPeriods([records[5]], legacy.current, today).periods[0].type, legacy.current.type);
assert.deepEqual(legacy.periods.flatMap(p => p.sourceIds).sort(), ["a", "b", "c", "d", "e"].sort(), "Source links preserve all legacy entries");
const searchable = records.map(p => M.milkPeriodInfo(p, today));
assert.equal(M.searchMilkHistory(searchable, "Formula").length, 3);
assert.equal(M.searchMilkHistory(searchable, "09 Oct 2026").length, 1);
assert.equal(M.searchMilkHistory([{ ...searchable[0], notes: "Clinician note" }], "clinician").length, 1);
const store = require("./recordStore.cjs"); store.reset();
const read = () => store.getConfirmed("fixture-child", "milk-type-periods");
store.confirm("fixture-child", "milk-type-periods", records[1]); assert.equal(M.currentMilkPeriods(read(), null, today).periods.length, 1);
store.confirm("fixture-child", "milk-type-periods", { ...records[1], end_date: "2026-10-14" }, 2); assert.equal(M.currentMilkPeriods(read(), null, today).periods.length, 0);
store.confirm("fixture-child", "milk-type-periods", null, 2, true); assert.equal(read().length, 0);
assert.equal(store.getConfirmed("other-child", "milk-type-periods").length, 0);
const html = buildRecordHtml({}, { milkTypePeriods: [{ ...records[1], notes: '<script>private</script>' }] }, { scope: new Set(["nutrition"]) });
assert(html.includes("Milk Type Periods") && html.includes("Open-ended") && html.includes("&lt;script&gt;private&lt;/script&gt;"));
assert(html.includes(new Date(2026, 9, 9).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })), "PDF dates retain their calendar day in western timezones");
assert(!buildRecordHtml({}, { milkTypePeriods: records }, { scope: new Set(["profile"]) }).includes("Milk Type Periods"));
assert(!buildRecordHtml({}, { nutrition: [] }, { scope: new Set(["nutrition"]) }).includes("Milk Type Periods"), "Older snapshots do not claim empty periods");
console.log("Milk-type checks passed: calendar ranges, overlapping history, legacy fallback, source links, search, confirmed mutations, child isolation and scoped PDF.");
