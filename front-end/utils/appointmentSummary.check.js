// Run: node utils/appointmentSummary.check.js — disposable in-memory records only.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const modules = new Map();
function load(file) {
    const filename = path.resolve(__dirname, file);
    if (filename.endsWith(".cjs")) return require(filename);
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const code = transformSync(fs.readFileSync(filename, "utf8"), { babelrc: false, configFile: false,
        plugins: ["@babel/plugin-transform-modules-commonjs"] }).code;
    new Function("require", "module", "exports", code)(name => load(path.resolve(path.dirname(filename), name + (path.extname(name) ? "" : ".js"))), module, module.exports);
    return module.exports;
}
const { appointmentSummary } = load("appointmentSummary.js");
const today = "2026-10-14";
const record = (id, date, status = "scheduled") => ({ id, title: `Visit ${id}`, checkup_date: date, status, doctor_name: "Dr. Tan", notes: "Saved notes", time_of_visit: "09:30:00" });
const plan = (sourceId, date, completed, extra = {}) => ({ id: sourceId + 100, source_type: "checkup", source_id: sourceId, occurrence_date: date, completed, ...extra });
const summarize = (rows = [], statuses = []) => appointmentSummary(rows, statuses, today);
assert.deepEqual(summarize().counts, { all: 0, completed: 0, upcoming: 0, overdue: 0 });
const rows = [record(1, "2026-10-13"), record(2, today), record(3, "2026-10-16"), record(4, "2026-10-12", "completed")];
const before = JSON.stringify(rows);
const summary = summarize(rows);
assert.deepEqual(summary.counts, { all: 4, completed: 1, upcoming: 2, overdue: 1 });
assert.deepEqual(summary.appointments.map(row => row.id), ["3", "2", "1", "4"]);
assert.equal(JSON.stringify(rows), before, "Derivation never mutates saved records or their order");
assert.equal(summary.appointments[0].provider, "Dr. Tan");
assert.equal(summary.appointments[0].notes, "Saved notes");
assert.equal(summary.appointments[0].time, "09:30:00");
assert.equal(summarize([record(1, "2026-10-13")]).counts.completed, 0, "Past does not mean completed");
assert.equal(summarize([record(1, today)]).counts.upcoming, 1, "Today's incomplete appointments are upcoming, regardless of time");
assert.deepEqual(summarize(rows, [plan(1, "2026-10-13", true), plan(4, "2026-10-12", false)]).counts,
    { all: 4, completed: 1, upcoming: 2, overdue: 1 }, "An unchecked planner override wins over clinical completion");
const overridden = summarize(rows, [plan(1, "2026-10-13", true, { _pending: true })]).appointments.find(row => row.id === "1");
assert.equal(overridden.calendarStatus, "completed");
assert.equal(overridden.isCompleted, false, "Calendar completion never fabricates clinical completion");
assert.equal(overridden.calendarPending, true);
assert.equal(summarize(rows, [plan(1, "2026-10-11", true)]).counts.completed, 1, "Old-date overrides do not follow rescheduled visits");
assert.equal(summarize(rows, [plan(1, "2026-10-13", true, { source_type: "vaccination" })]).counts.completed, 1);
assert.equal(summarize([record(1, today)], [plan("1", today, true)]).counts.completed, 1, "String and numeric IDs match");
for (const date of [null, "", "bad", "2026-02-30", "2026-13-01"]) {
    assert.equal(summarize([record(1, date)]).appointments[0].calendarStatus, "other");
    assert.equal(summarize([record(1, date, "completed")]).counts.completed, 1);
}
for (const status of ["cancelled", "rescheduled", "pending", null]) {
    assert.deepEqual(summarize([record(1, "2026-10-12", status)]).counts, { all: 1, completed: 0, upcoming: 0, overdue: 0 });
}
assert.deepEqual(summarize([record(1, today), record(2, today)]).appointments.map(row => row.id), ["2", "1"], "Equal dates retain API's descending ID order");
assert.equal(appointmentSummary([record(1, today)], [], "2026-10-15").counts.overdue, 1, "Rollover changes status without changing records");

const store = require("./recordStore.cjs");
store.reset();
const fixture = child => summarize(store.getRows(child, "checkups"), store.getRows(child, "calendar-plan-statuses"));
store.acceptFetch("baby-a", "checkups", rows, store.startFetch("baby-a", "checkups"));
store.acceptFetch("baby-a", "calendar-plan-statuses", [], store.startFetch("baby-a", "calendar-plan-statuses"));
assert.deepEqual(fixture("baby-a").counts, summary.counts);
store.confirm("baby-a", "checkups", record(5, today), 5);
assert.equal(fixture("baby-a").counts.upcoming, 3, "Adding updates all counts");
store.confirm("baby-a", "checkups", record(5, "2026-10-10"), 5);
assert.equal(fixture("baby-a").counts.overdue, 2, "Editing updates category and sorting");
assert.equal(fixture("baby-a").appointments.at(-1).id, "5");
store.confirm("baby-a", "checkups", null, 5, true);
assert.deepEqual(fixture("baby-a").counts, summary.counts, "Confirmed deletion updates counts");
const pending = store.begin({ child: "baby-a", resource: "calendar-plan-statuses", type: "create", id: null,
    body: { source_type: "checkup", source_id: 1, occurrence_date: "2026-10-13", completed: true } });
assert.equal(fixture("baby-a").counts.completed, 2, "Checklist changes update immediately");
store.update(pending, { status: "failed" });
store.dismiss(pending);
assert.deepEqual(fixture("baby-a").counts, summary.counts, "Failed checklist changes roll back");
store.confirm("baby-a", "calendar-plan-statuses", plan(1, "2026-10-13", true), 101);
assert.equal(fixture("baby-a").counts.completed, 2);
store.confirm("baby-a", "calendar-plan-statuses", plan(1, "2026-10-13", false), 101);
assert.deepEqual(fixture("baby-a").counts, summary.counts, "Unchecking restores the appropriate filter");
store.acceptFetch("baby-b", "checkups", [record(9, today)], store.startFetch("baby-b", "checkups"));
assert.equal(fixture("baby-b").counts.all, 1);
assert.equal(fixture("baby-b").counts.completed, 0, "Completion cannot leak across babies");
assert.equal(fixture("baby-a").counts.all, 4);
store.reset();
console.log("Appointment summary checks passed: completion precedence, local dates, ordering, missing/other statuses, record updates, rollback and child isolation.");
