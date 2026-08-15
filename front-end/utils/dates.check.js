// Self-check for utils/dates.js. Run: node utils/dates.check.js
// Mirrors utils/whoGrowth.check.js — plain assertions, no test framework.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "dates.js"), "utf8").replace(/export function/g, "function");
const M = new Function(
    `${src}\nreturn { todayLocal, toLocalISO, shortDate, monthLabel, shortTime, overdueBy,
                      nowLocalTime, durationText, minutesBetween };`,
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

console.log(fail ? `\n${fail} of ${ran} failed` : `\nall ${ran} passed`);
process.exit(fail ? 1 : 0);
