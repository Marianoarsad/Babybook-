// Self-check for utils/dates.js. Run: node utils/dates.check.js
// Mirrors utils/whoGrowth.check.js — plain assertions, no test framework.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "dates.js"), "utf8").replace(/export function/g, "function");
const M = new Function(
    `${src}\nreturn { todayLocal, toLocalISO, shiftMonthClamped, shortDate, monthLabel, shortTime, overdueBy,
                      nowLocalTime, durationText, minutesBetween, ageAtDate, monthsBetween,
                      spanText, ageLabel, compactDate, shortDateRange, numericDateRange, setRangeEndpoint,
                      dateRangePreset, evenDateSlots, evenYearSlots,
                      dateEndpointBounds, weekOfMonth, weekRangeFromSelection,
                      monthRangeFromSelection };`,
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
const currentYear = new Date().getFullYear();
const pastYear = currentYear - 1;
eq("compactDate", M.compactDate(`${currentYear}-09-04`), "4 Sept");
eq("compactDate with year", M.compactDate("2026-09-04", true), "4 Sept 2026");
eq("shortDateRange same day", M.shortDateRange(`${currentYear}-09-04`, `${currentYear}-09-04`), "4 Sept");
eq("shortDateRange same month", M.shortDateRange(`${currentYear}-09-01`, `${currentYear}-09-04`), "1–4 Sept");
eq("shortDateRange past year", M.shortDateRange(`${pastYear}-09-01`, `${pastYear}-09-04`), `1–4 Sept ${pastYear}`);
eq("shortDateRange across months", M.shortDateRange(`${currentYear}-08-28`, `${currentYear}-09-04`), `28 Aug–4 Sept ${currentYear}`);
eq("shortDateRange invalid", M.shortDateRange("", "2026-09-04"), "");
eq("numericDateRange", M.numericDateRange("2026-09-01", "2026-09-14"), "01/09/2026 - 14/09/2026");
eq("numericDateRange same day", M.numericDateRange("2026-09-04", "2026-09-04"), "04/09/2026 - 04/09/2026");
eq("numericDateRange invalid", M.numericDateRange("", "2026-09-04"), "");
const axisSlots = M.evenDateSlots("2026-09-01", "2026-09-30");
eq("date axis has seven slots", axisSlots.length, 7);
eq("date axis reaches both edges", `${axisSlots[0]}|${axisSlots[6]}`, "2026-09-01|2026-09-30");
eq("short date axes keep seven slots", M.evenDateSlots("2026-09-01", "2026-09-02").length, 7);
eq("date axis rejects reversed ranges", M.evenDateSlots("2026-09-02", "2026-09-01").length, 0);
eq("28-day month reaches day 28", M.evenDateSlots("2026-02-01", "2026-02-28").at(-1), "2026-02-28");
eq("29-day month reaches day 29", M.evenDateSlots("2028-02-01", "2028-02-29").at(-1), "2028-02-29");
eq("30-day month reaches day 30", M.evenDateSlots("2026-04-01", "2026-04-30").at(-1), "2026-04-30");
eq("31-day month reaches day 31", M.evenDateSlots("2026-05-01", "2026-05-31").at(-1), "2026-05-31");
eq("short year ranges show every year", JSON.stringify(M.evenYearSlots(2020, 2023)), "[2020,2021,2022,2023]");
eq("long year ranges keep seven labels", M.evenYearSlots(2020, 2029).length, 7);
eq("year labels keep both endpoints", `${M.evenYearSlots(2020, 2029)[0]}|${M.evenYearSlots(2020, 2029).at(-1)}`, "2020|2029");
eq("year labels reject reversed ranges", M.evenYearSlots(2029, 2020).length, 0);
eq("range sets start", JSON.stringify(M.setRangeEndpoint({}, "from", "2026-09-02")), '{"from":"2026-09-02","to":null}');
eq("range keeps later end", JSON.stringify(M.setRangeEndpoint({ from: "2026-09-01", to: "2026-09-05" }, "from", "2026-09-03")), '{"from":"2026-09-03","to":"2026-09-05"}');
eq("range moves end after start", JSON.stringify(M.setRangeEndpoint({ from: "2026-09-01", to: "2026-09-05" }, "from", "2026-09-07")), '{"from":"2026-09-07","to":"2026-09-07"}');
eq("range moves start before end", JSON.stringify(M.setRangeEndpoint({ from: "2026-09-05", to: "2026-09-08" }, "to", "2026-09-02")), '{"from":"2026-09-02","to":"2026-09-02"}');
eq("ending date cannot precede start", JSON.stringify(M.dateEndpointBounds({ from: "2026-08-12", to: "2026-09-01" }, "to", "2020-01-01", "2026-09-13")), '{"min":"2026-08-12","max":"2026-09-13"}');
eq("starting date cannot follow end", JSON.stringify(M.dateEndpointBounds({ from: "2026-08-12", to: "2026-09-01" }, "from", "2020-01-01", "2026-09-13")), '{"min":"2020-01-01","max":"2026-09-01"}');
eq("preset today", JSON.stringify(M.dateRangePreset("today", "2025-01-01", "2026-09-05")), '{"from":"2026-09-05","to":"2026-09-05"}');
eq("preset week starts Monday", JSON.stringify(M.dateRangePreset("week", "2025-01-01", "2026-09-05")), '{"from":"2026-08-31","to":"2026-09-05"}');
eq("preset week on Monday", JSON.stringify(M.dateRangePreset("week", "2025-01-01", "2026-09-07")), '{"from":"2026-09-07","to":"2026-09-07"}');
eq("preset month", JSON.stringify(M.dateRangePreset("month", "2025-01-01", "2026-09-05")), '{"from":"2026-09-01","to":"2026-09-05"}');
eq("preset leap month", JSON.stringify(M.dateRangePreset("month", "2025-01-01", "2028-02-29")), '{"from":"2028-02-01","to":"2028-02-29"}');
eq("preset year clamps to birth", JSON.stringify(M.dateRangePreset("year", "2026-04-12", "2026-09-05")), '{"from":"2026-04-12","to":"2026-09-05"}');
eq("week 1 from date", M.weekOfMonth("2026-09-07"), 1);
eq("week 4 includes month tail", M.weekOfMonth("2026-09-30"), 4);
eq("invalid week date", M.weekOfMonth(""), null);
eq("week range", JSON.stringify(M.weekRangeFromSelection("2026-09", 2, 4)), '{"from":"2026-09-08","to":"2026-09-30"}');
eq("week range clamps birth and today", JSON.stringify(M.weekRangeFromSelection("2026-09", 1, 4, "2026-09-04", "2026-09-19")), '{"from":"2026-09-04","to":"2026-09-19"}');
eq("week range handles leap February", JSON.stringify(M.weekRangeFromSelection("2028-02", 4, 4)), '{"from":"2028-02-22","to":"2028-02-29"}');
eq("week range rejects inversion", M.weekRangeFromSelection("2026-09", 3, 2), null);
eq("month range crosses year", JSON.stringify(M.monthRangeFromSelection({ from: "2025-12", to: "2026-02" })), '{"from":"2025-12-01","to":"2026-02-28"}');
eq("month range clamps endpoints", JSON.stringify(M.monthRangeFromSelection({ from: "2026-08", to: "2026-09" }, "2026-08-12", "2026-09-19")), '{"from":"2026-08-12","to":"2026-09-19"}');
eq("month range rejects inversion", M.monthRangeFromSelection({ from: "2026-09", to: "2026-08" }), null);
eq("monthLabel", M.monthLabel("2026-08-12"), "August 2026");
eq("monthLabel jan", M.monthLabel("2025-01-31"), "January 2025");
eq("monthLabel empty", M.monthLabel(""), "");
eq("monthLabel junk", M.monthLabel("nope"), "");
eq("toLocalISO round-trip", M.toLocalISO(new Date(2026, 7, 15)), "2026-08-15");
eq("toLocalISO non-date", M.toLocalISO("2026-08-15"), "");
eq("month shift keeps day", M.shiftMonthClamped("2026-08-15", 1), "2026-09-15");
eq("month shift crosses year", M.shiftMonthClamped("2026-12-15", 1), "2027-01-15");
eq("month shift clamps February", M.shiftMonthClamped("2026-01-31", 1), "2026-02-28");
eq("month shift clamps leap February", M.shiftMonthClamped("2028-01-31", 1), "2028-02-29");
eq("month shift rejects junk", M.shiftMonthClamped("nope", 1), "");
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

// ---- ageLabel: a child's age from a day count ----
eq("ageLabel null", M.ageLabel(null), "");
eq("ageLabel day zero", M.ageLabel(0), "0 days old");
eq("ageLabel one day is singular", M.ageLabel(1), "1 day old");
eq("ageLabel stays in days below 31", M.ageLabel(30), "30 days old");
// 31 days is the switch, and 31 / 30.4375 floors to 1.
eq("ageLabel switches to months at 31", M.ageLabel(31), "1 month old");
eq("ageLabel months are singular at one", M.ageLabel(40), "1 month old");
eq("ageLabel months", M.ageLabel(340), "11 months old");
// Under two years stays in months -- 23 months reads better than "1y 11m".
// 701, not 700: 700 / 30.4375 is 22.999, which floors to 22.
eq("ageLabel 23 months stays months", M.ageLabel(701), "23 months old");
eq("ageLabel switches to years at 24 months", M.ageLabel(731), "2 years old");
eq("ageLabel years plus months", M.ageLabel(1000), "2y 8m old");
eq("ageLabel whole years have no month part", M.ageLabel(1096), "3 years old");

console.log(fail ? `\n${fail} of ${ran} failed` : `\nall ${ran} passed`);
process.exit(fail ? 1 : 0);
