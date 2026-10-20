// Pure snapshot checks; no backend or saved-record changes.
const assert = require("node:assert/strict");
const { load } = require("./immunizationSummary.check.js");
const { viewerImmunizations: summarize, selectViewerImmunizations: select, vaccinationVisitGroup: group } = load("viewerImmunizations.js");
const today = "2026-10-20";
const raw = [
    { vaccine_name: "Same vaccine", dose_number: 2, visit_name: "6 Month Wellness", status: "completed", due_date: "2026-08-10", date_given: "2026-08-17", reaction_severity: "severe", reaction: "Recorded reaction" },
    { vaccine_name: "Same vaccine", dose_number: 1, visit_name: "2 Month Wellness", status: "completed", date_given: "2026-04-15" },
    { vaccine_name: "Birth dose", visit_name: "At Birth (within 24 hours)", status: "completed" },
    { vaccine_name: "Today", visit_name: "15 Month Wellness", status: "scheduled", due_date: today },
    { vaccine_name: "Future", visit_name: "18-Month Wellness", status: "scheduled", due_date: "2027-05-14", notes: "Saved searchable note" },
    { vaccine_name: "Late", visit_name: "12 Months", status: "scheduled", due_date: "2026-10-19", date_given: "2026-10-19" },
    { vaccine_name: "Legacy undated", status: "scheduled" },
    { vaccine_name: "Invalid date", visit_name: "Clinic visit", status: "scheduled", due_date: "2026-02-30" },
];
const before = JSON.stringify(raw), summary = summarize(raw, today);
assert.deepEqual(summary.counts, { all: 8, completed: 3, scheduled: 4, overdue: 1 });
assert.equal(summary.counts.all, summary.counts.completed + summary.counts.scheduled + summary.counts.overdue);
assert.equal(new Set(summary.records.map(r => r.key)).size, raw.length, "Snapshot rows without IDs must not collapse");
assert.equal(summary.records.filter(r => r.vaccineName === "Same vaccine").length, 2);
assert.deepEqual(select(summary.records).groups.map(([label]) => label), ["BIRTH", "2 MONTH", "6 MONTH", "12 MONTH", "15 MONTH", "18 MONTH", "CLINIC VISIT", "OTHER"]);
assert.equal(select(summary.records, "scheduled", "SAVED SEARCHABLE").total, 1);
assert.equal(select(summary.records, "completed", "dose 2").total, 1);
assert.equal(select(summary.records, "overdue", "same").total, 0);
assert.equal(summary.records.find(r => r.vaccineName === "Late").status, "overdue", "date_given alone cannot establish completion");
assert.equal(summarize(raw, "2026-10-21").records.find(r => r.vaccineName === "Today").status, "overdue");
assert.equal(summary.records.find(r => r.vaccineName === "Same vaccine" && r.doseNumber === 2).dateLabel, "17 Aug 2026");
for (const name of ["Legacy undated", "Invalid date"]) assert.equal(summary.records.find(r => r.vaccineName === name).dateLabel, "Due date not recorded");
assert.equal(summary.records.find(r => r.vaccineName === "Birth dose").dateLabel, "Administration date not recorded");
assert.equal(JSON.stringify(raw), before);
assert.deepEqual(group("Birth Dose"), { label: "BIRTH", age: 0 });
assert.equal(group("14 Weeks").label, "14 WEEK");
assert.equal(group("4 Month Wellness").label, "4 MONTH");
assert.equal(group("Annual Flu Vaccine").label, "ANNUAL FLU VACCINE");
const many = summarize(Array.from({ length: 25 }, (_, i) => ({ ...raw[4], vaccine_name: `Dose ${i}`, due_date: "2027-01-01" })), today).records;
assert.equal(select(many).remaining, 15); assert.equal(select(many, "all", "", 20).remaining, 5);
assert.equal(select(many, "scheduled", "dose 24").remaining, 0);
assert.equal(select(many, "scheduled", "dose 24").total, 1);
assert.equal(summarize([], today).counts.all, 0);
const savedTZ = process.env.TZ;
for (const tz of ["Asia/Manila", "America/New_York", "UTC"]) {
    process.env.TZ = tz;
    assert.deepEqual(summarize(raw, today).counts, summary.counts);
    assert.equal(summarize(raw, today).records.find(r => r.vaccineName === "Future").dateLabel, "14 May 2027");
}
if (savedTZ === undefined) delete process.env.TZ; else process.env.TZ = savedTZ;
console.log("Viewer immunization selectors passed: distinct snapshot doses, exclusive statuses, grouping, dates, search, pagination and immutability.");
