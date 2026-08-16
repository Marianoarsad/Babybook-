// DOH (Department of Health, Philippines) Expanded Program on Immunization
// (EPI) / National Immunization Program (NIP) routine schedule, birth to
// 24 months.
//
// SOURCING — VERIFIED 2026-08-16 against a primary document.
//
// Source: "Childhood Immunization Schedule 2026", published jointly by the
// PPS, PIDSP and PFV:
//   https://www.pidsphil.org/home/wp-content/uploads/2025/11/2026-PIDSP-Immunization-Calendar.pdf
// That calendar colour-codes which rows belong to the National Immunization
// Program (the free DOH programme) versus which are PPS/PIDSP recommendations
// a family pays for privately. ONLY the NIP rows are modelled here, because
// this app presents the schedule as what a parent gets at a health centre.
//
// How it was read, so the next person does not repeat the dead ends: the DOH
// EPI page returns HTTP 403 to automated fetches, and the PIDSP PDF defeats
// text extraction entirely — its tables are set in subset fonts whose
// ToUnicode maps cover only 85 codes, so both raw stream inflation and CMap
// decoding return garbage. It was read by rendering the PDF in a browser.
//
// Corrections this verification produced, against the previous draft:
//   - IPV was modelled as a SINGLE dose at 14 weeks and flagged as uncertain.
//     WRONG: the calendar shows a 2nd IPV dose at 9 months. Added.
//   - Japanese Encephalitis was flagged as possibly "select regions" only.
//     CONFIRMED as national, and it has a 2nd dose at 19–24 months. Added.
//   - MMR dose 2 at 12 months: CONFIRMED for the NIP row. (The 12–15 month
//     window that earlier sources described belongs to the separate
//     PIDSP/private "Measles/MMR" row, not to the NIP row.)
//
// Where a dose is given over a window rather than on a date, the START of the
// window is used as the generated due date — a target, not a deadline. This
// matches how MMR dose 2 was already handled.
//
// Deliberately excluded, all confirmed present on the calendar but NOT part of
// the free NIP for this age range: DTwP/DTaP boosters (12–18 months and
// 4–6 years), PCV booster (12–15 months), Rotavirus, Varicella, Hepatitis A,
// Influenza. Also excluded: Td (Grades 1 and 7) and HPV, which are school-based
// and outside 0–24 months. Listing private-sector vaccines inside a schedule
// the app presents as the DOH programme would tell a parent they are owed
// something free that they are not.

const SCHEDULE_VERSION = "DOH-NIP-2026-PIDSP-verified-2026-08-16";

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
    { vaccineName: "IPV", visitName: "14 Weeks", doseNumber: 1, offsetWeeks: 14 },

    {
        vaccineName: "MMR (Measles, Mumps, Rubella)",
        visitName: "9 Months",
        doseNumber: 1,
        offsetMonths: 9,
    },
    { vaccineName: "Japanese Encephalitis", visitName: "9 Months", doseNumber: 1, offsetMonths: 9 },
    // Verified 2026-08-16: the 2nd IPV dose is real and was missing. A parent
    // following the previous version of this schedule would not have been told
    // their child was owed it.
    { vaccineName: "IPV", visitName: "9 Months", doseNumber: 2, offsetMonths: 9 },

    {
        vaccineName: "MMR (Measles, Mumps, Rubella)",
        visitName: "12 Months",
        doseNumber: 2,
        offsetMonths: 12,
    },

    // Window is 19–24 months on the calendar; the start of it is the due date.
    {
        vaccineName: "Japanese Encephalitis",
        visitName: "19 Months",
        doseNumber: 2,
        offsetMonths: 19,
        notes: "Given any time from 19 to 24 months.",
    },
];

module.exports = { EPI_SCHEDULE, SCHEDULE_VERSION };
