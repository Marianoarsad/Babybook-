// DOH (Department of Health, Philippines) Expanded Program on Immunization
// (EPI) routine schedule, ages 0–12 months.
//
// SOURCING NOTE (2026-08): the official DOH EPI page and the current PIDSP
// (Pediatric Infectious Disease Society of the Philippines) immunization
// calendar PDF could not be fetched directly while building this file (403
// and a corrupted PDF, respectively). This schedule was cross-referenced
// from three independent secondary sources instead. Rows marked "medium"
// confidence below MUST be checked against a primary DOH/PIDSP document
// before this is used in the actual capstone defense — an incorrect
// immunization date is a health-data accuracy issue, not a cosmetic one.
//
//   HIGH confidence (consistent across all sources checked):
//     BCG, Hepatitis B birth dose, Pentavalent 1–3, OPV 1–3, PCV 1–3.
//   MEDIUM confidence (re-verify before shipping to a real user):
//     - IPV: modeled here as a SINGLE dose at 14 weeks. One source notes
//       an optional 2nd IPV dose at 9 months used by some LGUs — not
//       included, since guessing a second dose is worse than omitting it.
//     - Japanese Encephalitis: modeled at 9 months. One source describes
//       this as "select regions" rather than nationwide DOH-wide — included
//       because it's part of the standard PIDSP calendar, but flagged.
//     - MMR dose 2: modeled at 12 months. Two sources give a 12–15 month
//       window rather than a fixed date; 12 months is used as the
//       generated due date (a target, not a hard deadline).
//
// Deliberately excluded (out of scope for 0–60 months / this feature):
//   HPV (Grade 4, school-based), Td (Grades 1 & 7, school-based),
//   Ligtas Tigdas MR (outbreak-response campaign, not routine),
//   private-sector-only vaccines (Rotavirus, Varicella, Hepatitis A,
//   Influenza) — not part of free DOH EPI.

const SCHEDULE_VERSION = "DOH-EPI-2026-08-DRAFT";

const EPI_SCHEDULE = [
    { vaccineName: "BCG", visitName: "At Birth", offsetDays: 0 },
    { vaccineName: "Hepatitis B", visitName: "At Birth (within 24 hours)", offsetDays: 1 },

    { vaccineName: "Pentavalent (DTwP-HepB-Hib)", visitName: "6 Weeks", doseNumber: 1, offsetWeeks: 6 },
    { vaccineName: "OPV", visitName: "6 Weeks", doseNumber: 1, offsetWeeks: 6 },
    { vaccineName: "PCV", visitName: "6 Weeks", doseNumber: 1, offsetWeeks: 6 },

    { vaccineName: "Pentavalent (DTwP-HepB-Hib)", visitName: "10 Weeks", doseNumber: 2, offsetWeeks: 10 },
    { vaccineName: "OPV", visitName: "10 Weeks", doseNumber: 2, offsetWeeks: 10 },
    { vaccineName: "PCV", visitName: "10 Weeks", doseNumber: 2, offsetWeeks: 10 },

    { vaccineName: "Pentavalent (DTwP-HepB-Hib)", visitName: "14 Weeks", doseNumber: 3, offsetWeeks: 14 },
    { vaccineName: "OPV", visitName: "14 Weeks", doseNumber: 3, offsetWeeks: 14 },
    { vaccineName: "PCV", visitName: "14 Weeks", doseNumber: 3, offsetWeeks: 14 },
    {
        vaccineName: "IPV",
        visitName: "14 Weeks",
        offsetWeeks: 14,
        notes: "Modeled as a single dose — some LGUs add a 2nd dose at 9 months. Verify locally.",
    },

    {
        vaccineName: "MMR (Measles, Mumps, Rubella)",
        visitName: "9 Months",
        doseNumber: 1,
        offsetMonths: 9,
    },
    {
        vaccineName: "Japanese Encephalitis",
        visitName: "9 Months",
        offsetMonths: 9,
        notes: "Availability varies by region in some sources — confirm with local health center.",
    },

    {
        vaccineName: "MMR (Measles, Mumps, Rubella)",
        visitName: "12 Months (window: 12–15 months)",
        doseNumber: 2,
        offsetMonths: 12,
    },
];

module.exports = { EPI_SCHEDULE, SCHEDULE_VERSION };
