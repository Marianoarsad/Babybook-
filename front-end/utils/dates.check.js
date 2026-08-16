// Self-check for utils/dates.js. Run: node utils/dates.check.js
// Mirrors utils/whoGrowth.check.js — plain assertions, no test framework.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "dates.js"), "utf8").replace(/export function/g, "function");
const M = new Function(
    `${src}\nreturn { todayLocal, toLocalISO, shortDate, monthLabel, shortTime, overdueBy,
                      nowLocalTime, durationText, minutesBetween, ageAtDate, monthsBetween,
                      spanText };`,
)();

let fail = 0;
let ran = 0;
const eq = (name, got, want) => {
    ran++;
    const ok = got === want;
    if (!ok) fail++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}  got=${JSON.stringify(got)}${ok ? "" : ` want=${JSON.stringify(want)}`}`);
};
// Local calendar date, offset by n days — matches how the app reasons about dates.
const localDay = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

eq("todayLocal is local, not UTC", M.todayLocal(), localDay(0));
eq("shortDate iso", M.shortDate("2025-07-19"), "19 Jul 2025");
eq("shortDate datetime", M.shortDate("2027-02-06T09:00:00Z"), "06 Feb 2027");
eq("shortDate empty", M.shortDate(""), "");
eq("shortDate junk", M.shortDate("not-a-date"), "");
eq("monthLabel", M.monthLabel("2026-08-12"), "August 2026");
eq("monthLabel jan", M.monthLabel("2025-01-31"), "January 2025");
eq("monthLabel empty", M.monthLabel(""), "");
eq("monthLabel junk", M.monthLabel("nope"), "");
eq("toLocalISO round-trip", M.toLocalISO(new Date(2026, 7, 15)), "2026-08-15");
eq("toLocalISO non-date", M.toLocalISO("2026-08-15"), "");
eq("shortTime hh:mm:ss", M.shortTime("09:00:00"), "9:00 AM");
eq("shortTime pm", M.shortTime("15:15"), "3:15 PM");
eq("shortTime midnight", M.shortTime("00:30"), "12:30 AM");
eq("shortTime noon", M.shortTime("12:05"), "12:05 PM");
eq("shortTime empty", M.shortTime(""), "");
eq("overdueBy future", M.overdueBy(localDay(-5)), "");
eq("overdueBy today", M.overdueBy(localDay(0)), "Due today");
eq("overdueBy 1 day", M.overdueBy(localDay(1)), "1 day overdue");
eq("overdueBy 5 days", M.overdueBy(localDay(5)), "5 days overdue");
eq("overdueBy 3 weeks", M.overdueBy(localDay(21)), "3 weeks overdue");
eq("overdueBy 6 months", M.overdueBy(localDay(183)), "6 months overdue");
eq("overdueBy 2 years", M.overdueBy(localDay(800)), "2 years overdue");
eq("overdueBy empty", M.overdueBy(""), "");

// nowLocalTime — the device's clock, not UTC. Same trap as todayLocal.
const nowHHMM = (() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
})();
eq("nowLocalTime is local, not UTC", M.nowLocalTime(), nowHHMM);

eq("durationText minutes only", M.durationText(45), "45m");
eq("durationText hours and minutes", M.durationText(130), "2h 10m");
eq("durationText whole hours", M.durationText(180), "3h");
eq("durationText rounds", M.durationText(89.6), "1h 30m");
eq("durationText zero", M.durationText(0), "");
eq("durationText negative", M.durationText(-20), "");
eq("durationText junk", M.durationText("abc"), "");

eq("minutesBetween same day", M.minutesBetween("2026-08-15", "09:00", "2026-08-15", "11:30"), 150);
eq("minutesBetween across midnight", M.minutesBetween("2026-08-14", "23:30", "2026-08-15", "01:00"), 90);
eq("minutesBetween seconds tolerated", M.minutesBetween("2026-08-15", "09:00:00", "2026-08-15", "09:20:00"), 20);
eq("minutesBetween missing time defaults midnight", M.minutesBetween("2026-08-15", "", "2026-08-15", "02:00"), 120);
eq("minutesBetween negative when reversed", M.minutesBetween("2026-08-15", "11:00", "2026-08-15", "09:00"), -120);
eq("minutesBetween missing date", M.minutesBetween("", "09:00", "2026-08-15", "11:00"), null);

// ---- ageAtDate: the age stored on a milestone and shown on a memory ----
const DOB = "2025-03-12";
eq("ageAtDate months", M.ageAtDate(DOB, "2025-08-12"), "5 months");
eq("ageAtDate one month is singular", M.ageAtDate(DOB, "2025-04-12"), "1 month");
eq("ageAtDate on the birth date is zero", M.ageAtDate(DOB, DOB), "0 months");
// The day-of-month has not come round yet, so this is NOT a full 5 months.
eq("ageAtDate day-of-month rollback", M.ageAtDate(DOB, "2025-08-11"), "4 months");
// 24 months is where the wording switches from months to years.
eq("ageAtDate 23 months still months", M.ageAtDate(DOB, "2027-02-12"), "23 months");
eq("ageAtDate 24 months becomes years", M.ageAtDate(DOB, "2027-03-12"), "2 yr");
eq("ageAtDate years and months", M.ageAtDate(DOB, "2027-05-12"), "2 yr 2 mo");
// A date before the birth is not an age — it is bad data, and must not
// render as "0 months" as though the child were a newborn that day.
eq("ageAtDate before birth is blank", M.ageAtDate(DOB, "2025-03-11"), "");
eq("ageAtDate missing dob", M.ageAtDate("", "2026-01-01"), "");
eq("ageAtDate missing date", M.ageAtDate(DOB, ""), "");
eq("ageAtDate junk", M.ageAtDate(DOB, "not-a-date"), "");
eq("ageAtDate tolerates a datetime", M.ageAtDate(DOB, "2025-08-12T09:00:00Z"), "5 months");

// ---- monthsBetween: what ageAtDate formats, and what picks the age band ----
eq("monthsBetween counts whole months", M.monthsBetween(DOB, "2025-08-12"), 5);
eq("monthsBetween rolls back an incomplete month", M.monthsBetween(DOB, "2025-08-11"), 4);
eq("monthsBetween on the birth date is zero", M.monthsBetween(DOB, DOB), 0);
eq("monthsBetween crosses years", M.monthsBetween(DOB, "2027-03-12"), 24);
// null, not 0 — "before the child was born" and "newborn" are different facts,
// and a band picker given 0 would silently show the 2-month list.
eq("monthsBetween before birth is null", M.monthsBetween(DOB, "2025-03-11"), null);
eq("monthsBetween missing dob is null", M.monthsBetween("", "2026-01-01"), null);
eq("monthsBetween junk is null", M.monthsBetween(DOB, "not-a-date"), null);
// The two must never disagree — ageAtDate is only a formatting of this.
eq("monthsBetween at the 24-month switch", M.monthsBetween(DOB, "2027-02-12"), 23);
eq("ageAtDate agrees with it there", M.ageAtDate(DOB, "2027-02-12"), "23 months");

// ---- spanText: how long an illness or a hospital stay lasted ----
eq("spanText same day", M.spanText("2026-08-10", "2026-08-10"), "Same day");
eq("spanText one day is singular", M.spanText("2026-08-10", "2026-08-11"), "1 day");
eq("spanText days", M.spanText("2026-08-10", "2026-08-13"), "3 days");
eq("spanText switches to weeks at 14", M.spanText("2026-08-01", "2026-08-15"), "2 weeks");
eq("spanText switches to months at 60", M.spanText("2026-01-01", "2026-04-01"), "3 months");
eq("spanText tolerates a datetime", M.spanText("2026-08-10T00:00:00Z", "2026-08-13"), "3 days");
// No end date means it has not ended. "Ongoing" is the whole reason this
// record type exists — the app could not say it at all before.
eq("spanText no end is ongoing", M.spanText("2026-08-10", ""), "Ongoing since 10 Aug 2026");
eq("spanText no end, null", M.spanText("2026-08-10", null), "Ongoing since 10 Aug 2026");
// An end before the start is bad data. State the certain fact rather than
// rendering a negative duration as though it meant something.
eq("spanText reversed falls back to the end date", M.spanText("2026-08-13", "2026-08-10"), "10 Aug 2026");
eq("spanText no start", M.spanText("", "2026-08-13"), "");
eq("spanText junk start", M.spanText("not-a-date", "2026-08-13"), "");
eq("spanText junk end falls back", M.spanText("2026-08-10", "not-a-date"), "");

console.log(fail ? `\n${fail} of ${ran} failed` : `\nall ${ran} passed`);
process.exit(fail ? 1 : 0);
