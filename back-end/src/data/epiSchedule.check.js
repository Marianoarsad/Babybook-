// Self-check for the DOH schedule and the dedupe that decides whether a dose
// already exists. Run: node src/data/epiSchedule.check.js
//
// Needs no database — everything here is pure. Mirrors the front-end's
// utils/*.check.js convention (plain assertions, no test framework), because
// the jest suite runs schema.sql and therefore drops every table, which is far
// too heavy a price for checking a static schedule.
//
// The failure this exists to catch is silent and expensive: a wrong dedupe key
// duplicates every dose in every child's record, and a wrong offset tells a
// parent to bring their baby in on the wrong day.
const { EPI_SCHEDULE, SCHEDULE_VERSION } = require("./epiSchedule");
const { generateEpiSchedule, epiDedupeKey } = require("../utils/epiGenerator");

let fail = 0;
let ran = 0;
const eq = (name, got, want) => {
    ran++;
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) fail++;
    console.log(
        `${ok ? "ok  " : "FAIL"}  ${name}  got=${JSON.stringify(got)}${ok ? "" : ` want=${JSON.stringify(want)}`}`,
    );
};

// ---- schedule integrity ----
eq("every entry names a vaccine", EPI_SCHEDULE.every((e) => !!e.vaccineName), true);
eq("every entry names a visit", EPI_SCHEDULE.every((e) => !!e.visitName), true);
eq(
    "every entry has exactly one offset unit",
    EPI_SCHEDULE.every(
        (e) =>
            ["offsetDays", "offsetWeeks", "offsetMonths"].filter((k) => e[k] !== undefined).length === 1,
    ),
    true,
);
eq("a version is declared", typeof SCHEDULE_VERSION === "string" && SCHEDULE_VERSION.length > 0, true);

// ---- the 2026-08-16 verification against the PIDSP calendar ----
const dosesOf = (name) => EPI_SCHEDULE.filter((e) => e.vaccineName === name).length;
// IPV was modelled as a single dose and flagged as uncertain. It is two.
eq("IPV has two doses", dosesOf("IPV"), 2);
eq(
    "the 2nd IPV dose is at 9 months",
    EPI_SCHEDULE.find((e) => e.vaccineName === "IPV" && e.doseNumber === 2).offsetMonths,
    9,
);
eq("Japanese Encephalitis has two doses", dosesOf("Japanese Encephalitis"), 2);
eq("MMR has two doses", dosesOf("MMR (Measles, Mumps, Rubella)"), 2);
// Confirmed NOT part of the free NIP for this age range, so they must stay out
// — listing them would tell a parent they are owed something free that
// they are not.
for (const excluded of ["Rotavirus", "Varicella", "Hepatitis A", "Influenza", "HPV", "Td"]) {
    eq(`${excluded} is excluded`, dosesOf(excluded), 0);
}

// ---- generated dates ----
const { entries } = generateEpiSchedule("2025-01-01");
eq("every schedule entry generates a dose", entries.length, EPI_SCHEDULE.length);
const find = (n, v) => entries.find((e) => e.vaccination.vaccine_name === n && e.vaccination.visit_name === v);
eq("BCG is due on the birth date", find("BCG", "At Birth").vaccination.due_date, "2025-01-01");
eq("6-week doses land 42 days on", find("OPV 1", "6 Weeks").vaccination.due_date, "2025-02-12");
eq("9-month doses land on the calendar month", find("IPV 2", "9 Months").vaccination.due_date, "2025-10-01");
eq("19-month doses cross the year", find("Japanese Encephalitis 2", "19 Months").vaccination.due_date, "2026-08-01");
eq("dose number reaches its own column", find("IPV 2", "9 Months").vaccination.dose_number, 2);
eq("single-dose vaccines carry no dose number", find("BCG", "At Birth").vaccination.dose_number, null);
// A missing DOB must yield nothing rather than a schedule dated from today.
eq("no date of birth yields no doses", generateEpiSchedule(null).entries.length, 0);
eq("an unparseable date of birth yields no doses", generateEpiSchedule("not-a-date").entries.length, 0);

// ---- dedupe: the regression that would duplicate every child's record ----
// Giving IPV a dose number renames a stored "IPV" to "IPV 1". These must be
// recognised as the same dose, or regeneration inserts a second copy.
eq(
    "an unnumbered name matches its dose-1 form",
    epiDedupeKey("IPV", "14 Weeks"),
    epiDedupeKey("IPV 1", "14 Weeks"),
);
eq(
    "a genuinely different dose does NOT match",
    epiDedupeKey("IPV 2", "9 Months") === epiDedupeKey("IPV 1", "14 Weeks"),
    false,
);
// Same vaccine, same dose number, different visit — still different doses.
eq(
    "the visit distinguishes doses",
    epiDedupeKey("Japanese Encephalitis 1", "9 Months") ===
        epiDedupeKey("Japanese Encephalitis 2", "19 Months"),
    false,
);
eq("a missing visit does not throw", epiDedupeKey("BCG", null), "BCG|");
eq("a missing name does not throw", epiDedupeKey(null, "At Birth"), "|At Birth");
// Only a TRAILING number is a dose number — a name ending in a digit that is
// part of the name itself must survive.
eq("interior digits are kept", epiDedupeKey("Penta 5 in 1", "6 Weeks"), "Penta 5 in|6 Weeks");

// The generator must never emit two entries that collide, or it would
// duplicate against itself on the very first run.
const keys = entries.map((e) => epiDedupeKey(e.vaccination.vaccine_name, e.vaccination.visit_name));
eq("no two generated doses share a dedupe key", new Set(keys).size, keys.length);

console.log(`\n${EPI_SCHEDULE.length} doses in the schedule (${SCHEDULE_VERSION})`);
console.log(fail ? `${fail} of ${ran} failed` : `all ${ran} passed`);
process.exit(fail ? 1 : 0);
