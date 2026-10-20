const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { transformSync } = require("@babel/core");
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
const { buildMilkFeedingChart: build, milkFeedAxis, milkFeedType } = load("milkFeedingChart.js");
const today = "2026-10-16", feed = (id, milkType, date = today, extra = {}) => ({ id, entryType: "milk", milkType, date, ...extra });
const feeds = [feed(1, "Breastmilk", today, { durationMinutes: null }), feed(2, "Formula"), feed(3, "Formula"), feed(4, "Mixed"),
    feed(5, "", today, { feedMethod: "breast" }), feed(6, ""), feed(7, "Formula", "2026-10-09"), feed(8, "Mixed", "2026-10-17"),
    feed(9, "Formula", "2026-02-30"), feed(10, "Mixed", today, { entryType: "solid" })];
const before = JSON.stringify(feeds), chart = build(feeds, "7", today);
assert.equal(chart.points.length, 7); assert.equal(chart.points[0].from, "2026-10-10"); assert.equal(chart.points[6].from, today);
assert.deepEqual(chart.totals, { Breastmilk: 2, Formula: 2, Mixed: 1 }); assert.equal(chart.total, 5); assert.equal(chart.excluded, 1);
assert.equal(chart.percentages.Mixed, 20); assert.equal(chart.points[6].total, 5); assert(chart.points.slice(0, 6).every(p => p.total === 0));
assert.equal(milkFeedType(feed(1, "Mixed")), "Mixed"); assert.equal(chart.points[6].entries.length, 5, "Mixed counts once, missing durations still count");
assert.equal(JSON.stringify(feeds), before); assert(chart.axis.max >= chart.total); assert(chart.axis.ticks.includes(0));
for (const highest of [0, 1, 4, 5, 9, 23, 100, 9999]) {
    const axis = milkFeedAxis(highest); assert(axis.max >= highest); assert(axis.ticks.every(Number.isInteger));
    assert(axis.ticks.length <= 7); assert.equal(axis.ticks.at(-1), axis.max);
}
const empty = build([], "7", today); assert.equal(empty.points.length, 7); assert.equal(empty.total, 0); assert.equal(empty.percentages.Formula, null); assert.equal(empty.axis.max, 4);
assert.equal(build([{ milk_type: "Formula", start_date: "2026-10-01", end_date: today }], "7", today).total, 0, "Historical periods never create feeding counts");
const month = build([feed(1, "Formula", "2026-09-17"), feed(2, "Mixed", "2026-10-16"), feed(3, "Formula", "2026-09-16")], "30", today);
assert.equal(month.points.length, 30); assert.equal(month.total, 2); assert.equal(month.window.from, "2026-09-17");
const weeks = build([feed(1, "Formula", "2026-07-16"), feed(2, "Formula", "2026-07-18"), feed(3, "Mixed", "2026-07-19"), feed(4, "Mixed", today)], "3m", today);
assert.equal(weeks.granularity, "week"); assert.equal(weeks.points[0].from, "2026-07-16"); assert.equal(weeks.points[0].to, "2026-07-18");
assert.equal(weeks.points[0].total, 2); assert.equal(weeks.points[1].total, 1); assert.equal(weeks.points.at(-1).to, today); assert.equal(weeks.total, 4);
const all = build([feed(1, "Formula", "2026-08-31"), feed(2, "Mixed", "2026-10-01"), feed(3, "Mixed", "2026-11-01")], "all", today);
assert.equal(all.granularity, "month"); assert.equal(all.points.length, 3); assert.equal(all.points[0].from, "2026-08-31");
assert.equal(all.points[1].total, 0); assert.equal(all.total, 2); assert.equal(all.points.at(-1).to, today);
const dst = build([feed(1, "Formula", "2026-03-07"), feed(2, "Mixed", "2026-03-08"), feed(3, "Breastmilk", "2026-03-09")], "7", "2026-03-10");
assert.equal(dst.points.length, 7); assert.equal(dst.total, 3); assert.equal(dst.points.find(p => p.from === "2026-03-08").values.Mixed, 1);
const leap = build([], "3m", "2024-05-31"); assert.equal(leap.window.from, "2024-02-29");
assert.equal(build(feeds.slice(0, 1), "7", today).total, 1); assert.equal(build([...feeds, feed(99, "Mixed")], "7", today).total, 6);
console.log("Milk feeding chart checks passed: real counts, zero dates, units, category shares, Mixed/legacy classification, invalid/future entries, dynamic axes, daily/weekly/monthly ranges, DST and no period-derived consumption.");
