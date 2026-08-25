// Self-check for utils/medication.js. Run: node utils/medication.check.js
// Mirrors utils/commonConditions.check.js — plain assertions, no test framework.
const fs = require("fs");
const path = require("path");
const src = fs
    .readFileSync(path.join(__dirname, "medication.js"), "utf8")
    .replace(/export function/g, "function")
    .replace(/export const/g, "const");
const M = new Function(
    `${src}\nreturn { defaultDoseTimes, doseTimesOf, dosesOn, plannedEnd, courseDay,
                      courseDayText, isActiveOn, nextDoseTime, upcomingDoseSlots };`,
)();

let fail = 0;
let ran = 0;
const eq = (name, got, want) => {
    ran++;
    const ok = got === want;
    if (!ok) fail++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}  got=${JSON.stringify(got)}${ok ? "" : ` want=${JSON.stringify(want)}`}`);
};

// ---- defaultDoseTimes ----
eq("once a day", M.defaultDoseTimes(1).join(","), "08:00");
eq("twice a day", M.defaultDoseTimes(2).join(","), "08:00,20:00");
eq("three times a day", M.defaultDoseTimes(3).join(","), "08:00,14:00,20:00");
eq("four times a day", M.defaultDoseTimes(4).join(","), "07:00,12:00,17:00,22:00");
// Above four the spacing is computed. It must stay inside the waking day and
// never wrap past midnight.
eq("five is computed, five slots", M.defaultDoseTimes(5).length, 5);
eq("five starts at 07:00", M.defaultDoseTimes(5)[0], "07:00");
eq("five ends at 22:00", M.defaultDoseTimes(5)[4], "22:00");
eq("six stays inside the day", M.defaultDoseTimes(6).every((t) => t >= "07:00" && t <= "22:00"), true);
eq("every slot is HH:MM", M.defaultDoseTimes(7).every((t) => /^\d{2}:\d{2}$/.test(t)), true);
eq("slots are in order", M.defaultDoseTimes(9).every((t, i, a) => i === 0 || a[i - 1] < t), true);
// Junk must not produce an empty or absurd schedule.
eq("zero clamps to one", M.defaultDoseTimes(0).length, 1);
eq("negative clamps to one", M.defaultDoseTimes(-3).length, 1);
eq("above twelve clamps", M.defaultDoseTimes(50).length, 12);
eq("junk clamps to one", M.defaultDoseTimes("abc").length, 1);

// ---- doseTimesOf ----
eq("reads a real array", M.doseTimesOf({ doseTimes: ["08:00", "20:00"] }).join(","), "08:00,20:00");
eq("parses a json string", M.doseTimesOf({ doseTimes: '["09:00"]' }).join(","), "09:00");
eq("trims seconds", M.doseTimesOf({ doseTimes: ["08:00:00"] }).join(","), "08:00");
eq("drops malformed entries", M.doseTimesOf({ doseTimes: ["08:00", "nope", 5, null] }).join(","), "08:00");
// A row saved before this feature has no times but does have a frequency, and
// must still show the right number of slots rather than none.
eq("falls back to frequency", M.doseTimesOf({ frequencyPerDay: 3 }).join(","), "08:00,14:00,20:00");
eq("no times and no frequency is empty", M.doseTimesOf({}).length, 0);
eq("unparseable json falls back", M.doseTimesOf({ doseTimes: "{{{", frequencyPerDay: 2 }).length, 2);
eq("null medicine is empty", M.doseTimesOf(null).length, 0);

// ---- dosesOn ----
const DOSES = [
    { medicationId: "7", date: "2026-08-16", time: "14:00" },
    { medicationId: "7", date: "2026-08-16", time: "08:00" },
    { medicationId: "7", date: "2026-08-15", time: "08:00" },
    { medicationId: "9", date: "2026-08-16", time: "08:00" },
];
eq("counts only this medicine, this day", M.dosesOn(DOSES, "7", "2026-08-16").length, 2);
eq("sorted oldest first", M.dosesOn(DOSES, "7", "2026-08-16")[0].time, "08:00");
eq("matches a numeric id against a string one", M.dosesOn(DOSES, 7, "2026-08-16").length, 2);
eq("another day", M.dosesOn(DOSES, "7", "2026-08-15").length, 1);
eq("a day with nothing", M.dosesOn(DOSES, "7", "2026-08-14").length, 0);
eq("no date is empty", M.dosesOn(DOSES, "7", "").length, 0);
eq("no list is empty", M.dosesOn(null, "7", "2026-08-16").length, 0);

// ---- plannedEnd / courseDay ----
// Day 1 IS the start date, so a 7-day course starting on the 1st ends on the
// 7th — not the 8th. Off by one here would misreport every course length.
eq("7-day course ends on day 7", M.plannedEnd("2026-08-01", 7), "2026-08-07");
eq("1-day course ends the same day", M.plannedEnd("2026-08-01", 1), "2026-08-01");
eq("spans a month boundary", M.plannedEnd("2026-08-28", 7), "2026-09-03");
eq("no length is open-ended", M.plannedEnd("2026-08-01", null), "");
eq("zero days is open-ended", M.plannedEnd("2026-08-01", 0), "");
eq("no start is empty", M.plannedEnd("", 7), "");

eq("start date is day 1", M.courseDay("2026-08-01", "2026-08-01"), 1);
eq("third day is day 3", M.courseDay("2026-08-01", "2026-08-03"), 3);
eq("before it starts is zero", M.courseDay("2026-08-01", "2026-07-31"), 0);

eq("courseDayText with a length", M.courseDayText("2026-08-01", 7, "2026-08-03"), "Day 3 of 7");
eq("courseDayText open-ended", M.courseDayText("2026-08-01", null, "2026-08-03"), "Day 3");
eq("courseDayText before the start is blank", M.courseDayText("2026-08-01", 7, "2026-07-30"), "");

// ---- isActiveOn ----
const OPEN = { date: "2026-08-01", courseDays: null, resolved: false, frequencyPerDay: 3 };
const WEEK = { date: "2026-08-01", courseDays: 7, resolved: false, frequencyPerDay: 3 };
eq("active on the start date", M.isActiveOn(WEEK, "2026-08-01"), true);
eq("active mid-course", M.isActiveOn(WEEK, "2026-08-04"), true);
eq("active on the last day", M.isActiveOn(WEEK, "2026-08-07"), true);
// The day after a 7-day course it is over, even though nobody ticked it —
// otherwise a course logged in March still reads as current in August, which
// is precisely the bug that made every illness look ongoing.
eq("over the day after it ends", M.isActiveOn(WEEK, "2026-08-08"), false);
eq("not active before it starts", M.isActiveOn(WEEK, "2026-07-31"), false);
eq("open-ended stays active", M.isActiveOn(OPEN, "2027-01-01"), true);
// Marked finished beats the planned length in both directions.
eq("finished beats the plan", M.isActiveOn({ ...WEEK, resolved: true }, "2026-08-02"), false);
eq("finished beats open-ended", M.isActiveOn({ ...OPEN, resolved: true }, "2026-08-02"), false);
eq("no start date is not active", M.isActiveOn({ resolved: false }, "2026-08-02"), false);
eq("null medicine is not active", M.isActiveOn(null, "2026-08-02"), false);

// ---- nextDoseTime ----
eq("none given yet", M.nextDoseTime(["08:00", "14:00", "20:00"], 0), "08:00");
eq("one given", M.nextDoseTime(["08:00", "14:00", "20:00"], 1), "14:00");
eq("all given", M.nextDoseTime(["08:00", "14:00"], 2), "");
eq("more given than scheduled", M.nextDoseTime(["08:00"], 5), "");
eq("no schedule", M.nextDoseTime([], 0), "");

// ---- upcomingDoseSlots ----
const NOW = new Date("2026-08-04T09:00:00");
const slots = M.upcomingDoseSlots([{ id: "7", title: "Amoxicillin", doseAmount: "5 mL", ...WEEK }], NOW, 48, 24);
// 04th: 14:00, 20:00. 05th: 08:00, 14:00, 20:00. 06th: 08:00 (09:00 is past
// the 48h edge). The 08:00 slot on the 4th is already behind us.
eq("skips slots already past", slots.every((s) => s.at > NOW), true);
eq("first upcoming slot", slots[0].time, "14:00");
eq("first slot is today", slots[0].date, "2026-08-04");
eq("stays inside the window", slots.every((s) => s.at <= new Date(NOW.getTime() + 48 * 3600000)), true);
eq("slots are chronological", slots.every((s, i, a) => i === 0 || a[i - 1].at <= s.at), true);
eq("carries what the reminder needs", slots[0].title + "|" + slots[0].dose, "Amoxicillin|5 mL");
// The cap is the iOS 64-notification budget. It must bite.
eq("respects the cap", M.upcomingDoseSlots([{ id: "7", title: "X", ...OPEN }], NOW, 48, 2).length, 2);
// A finished course must schedule nothing at all.
eq("finished course schedules nothing", M.upcomingDoseSlots([{ id: "7", title: "X", ...WEEK, resolved: true }], NOW, 48, 24).length, 0);
// A course that ended before now likewise.
eq("expired course schedules nothing", M.upcomingDoseSlots([{ id: "7", title: "X", date: "2026-01-01", courseDays: 3 }], NOW, 48, 24).length, 0);
eq("no medicines is empty", M.upcomingDoseSlots([], NOW, 48, 24).length, 0);
eq("bad date is empty", M.upcomingDoseSlots([{ id: "7", ...WEEK }], new Date("nope"), 48, 24).length, 0);
// A medicine with no schedule at all schedules nothing, rather than the app
// inventing times it was never given.
eq(
    "no schedule means no reminders",
    M.upcomingDoseSlots([{ id: "7", title: "X", date: "2026-08-01", courseDays: 7 }], NOW, 48, 24).length,
    0,
);

console.log(fail ? `\n${fail} of ${ran} failed` : `\nall ${ran} passed`);
process.exit(fail ? 1 : 0);
