// Shared date formatting for anything a parent reads.
//
// Raw ISO strings were being rendered straight to screen across the app —
// "Due: 2025-07-19", "2026-04-19 | Resolved", and on the Health screen's
// checkups, "2027-02-06 @ 09:00:00", seconds and all. PRODUCT.md's audience is
// explicitly non-technical, and near-identical formatters had already been
// copied into MemoryDetail, OfflineSummaryView, ProfessionalView and Dashboard.
// One home for them, so a date looks the same wherever it appears.

// Today's date in the DEVICE's timezone, as YYYY-MM-DD.
//
// Use this instead of `new Date().toISOString().slice(0, 10)`, which is UTC.
// The app's users are in the Philippines (UTC+8), so between 00:00 and 08:00
// local the UTC date is still YESTERDAY. That made "today's feedings" count
// the wrong day, shifted overdue maths by one, and — worst — stamped newly
// saved records with `date_recorded` a day in the past.
//
// Every date this app stores is a plain calendar date with no timezone, so the
// device's own idea of "today" is the correct one.
export function todayLocal() {
    return toLocalISO(new Date());
}

// A Date object's calendar date in the DEVICE's timezone, as YYYY-MM-DD.
// `date.toISOString().slice(0, 10)` is the trap this replaces: it converts to
// UTC first, so a Date built from local midnight comes back as the previous
// day anywhere east of Greenwich — which silently shifted the Calendar's
// day-stepper by one every time it was used.
export function toLocalISO(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "";
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${mm}-${dd}`;
}

// "12 Mar 2025". Returns "" for anything unparseable so callers can fall back.
export function shortDate(value) {
    if (!value) return "";
    const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// "August 2026" — group header for the Gallery's month buckets.
export function monthLabel(value) {
    if (!value) return "";
    const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// "9:00 AM" from a "HH:MM" or "HH:MM:SS" time-of-day string. Seconds are
// dropped: nothing this app records happens on a second boundary.
export function shortTime(value) {
    if (!value) return "";
    const [h, m] = String(value).split(":");
    const hour = Number(h);
    if (!Number.isFinite(hour)) return "";
    const suffix = hour < 12 ? "AM" : "PM";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}:${m || "00"} ${suffix}`;
}

// The current time of day in the DEVICE's timezone, as "HH:MM" — the shape
// every `entry_time` / `time_of_visit` column stores. Same reasoning as
// todayLocal(): a UTC clock is eight hours wrong for this app's users.
export function nowLocalTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// "2h 10m" / "45m" / "3h" from a count of minutes. Used for gaps between
// feeds and for time spent at the breast, so a parent reads an elapsed span
// rather than doing division. Returns "" for anything non-positive.
export function durationText(minutes) {
    const mins = Math.round(Number(minutes));
    if (!Number.isFinite(mins) || mins <= 0) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (!h) return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
}

// Minutes between two "YYYY-MM-DD" + "HH:MM" pairs, or null if either is
// unusable. Entry dates and times are stored as separate plain columns, so
// nothing in this app can subtract two feeds without stitching them first.
export function minutesBetween(dateA, timeA, dateB, timeB) {
    const at = (d, t) => {
        if (!d) return NaN;
        const stamp = new Date(`${String(d).slice(0, 10)}T${String(t || "00:00").slice(0, 5)}:00`);
        return stamp.getTime();
    };
    const a = at(dateA, timeA);
    const b = at(dateB, timeB);
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 60000);
}

// How old the child was on a given date: "5 months" / "1 yr 2 mo". Both
// arguments are "YYYY-MM-DD"; returns "" when either is missing, unparseable,
// or the date falls before the birth.
//
// Lifted out of MemoryDetail.js, which was the only screen that could answer
// "how old was she when this happened". A saved milestone now stores the same
// answer in `age_achieved`, which is what the QR snapshot ships to the
// healthcare professional — so the derivation has to live somewhere both can
// reach, and it must not drift between them.
export function ageAtDate(dob, date) {
    const months = monthsBetween(dob, date);
    if (months == null) return "";
    if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
    const yrs = Math.floor(months / 12);
    const mo = months % 12;
    return mo ? `${yrs} yr ${mo} mo` : `${yrs} yr`;
}

// How old a child was, from a count of days. "11 months old".
//
// Lifted out of Growth.js, which held the only copy, because the Dashboard's
// Growth Chart now has to say the same thing. Date formatting belongs here for
// the reason recorded at the top of this file: near-identical formatters
// copied into four components is exactly how toISOString().slice(0, 10)
// reached twelve call sites before anyone noticed it was returning yesterday.
//
// Distinct from ageText(dob) in Dashboard.js, which takes a birth date and
// renders "2 years 3 months". This one takes days and ends in "old", because
// it is used mid-sentence beside a measurement.
export function ageLabel(days) {
    if (days == null) return "";
    if (days < 31) return `${days} day${days === 1 ? "" : "s"} old`;
    const months = Math.floor(days / 30.4375);
    if (months < 24) return `${months} month${months === 1 ? "" : "s"} old`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem ? `${years}y ${rem}m old` : `${years} year${years === 1 ? "" : "s"} old`;
}

// Whole months between two "YYYY-MM-DD" dates, or null when either is missing,
// unparseable, or the second falls before the first.
//
// Split out of ageAtDate so the Development Checklist can pick the age band a
// child belongs in using exactly the arithmetic that renders their age. Two
// definitions of "how many months old" would eventually disagree, and the one
// place that would show is a parent landing on the wrong band.
export function monthsBetween(dob, date) {
    if (!dob || !date) return null;
    const b = new Date(`${String(dob).slice(0, 10)}T00:00:00`);
    const d = new Date(`${String(date).slice(0, 10)}T00:00:00`);
    if (isNaN(b.getTime()) || isNaN(d.getTime()) || d < b) return null;
    let months = (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth());
    // Not a full month yet if the day-of-month hasn't come round again.
    if (d.getDate() < b.getDate()) months -= 1;
    return months < 0 ? 0 : months;
}

// "3 days overdue" / "5 months overdue" for a date already in the past.
// Returns "" when the date is in the future or unparseable, so a caller can
// treat "" as "not overdue".
export function overdueBy(value) {
    if (!value) return "";
    const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return "";
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 0) return "";
    if (days === 0) return "Due today";
    if (days === 1) return "1 day overdue";
    if (days < 14) return `${days} days overdue`;
    if (days < 60) {
        const w = Math.round(days / 7);
        return `${w} week${w === 1 ? "" : "s"} overdue`;
    }
    if (days < 365) {
        const mo = Math.round(days / 30.4375);
        return `${mo} month${mo === 1 ? "" : "s"} overdue`;
    }
    const y = Math.floor(days / 365.25);
    return `${y} year${y === 1 ? "" : "s"} overdue`;
}

// How long something lasted, in plain words. Both arguments are "YYYY-MM-DD".
//
//   spanText("2026-08-10", "2026-08-13")  -> "3 days"
//   spanText("2026-08-10", "2026-08-10")  -> "Same day"
//   spanText("2026-08-10", "")            -> "Ongoing since 10 Aug 2026"
//
// An illness and a hospital stay both answer "how long was this going on",
// and the Health lists, the Dashboard and the healthcare professional's view
// all need to say it the same way. Four components growing four copies of the
// same formatter is precisely how `toISOString().slice(0, 10)` reached twelve
// call sites before anyone noticed it was returning yesterday.
export function spanText(start, end) {
    if (!start) return "";
    const s = new Date(`${String(start).slice(0, 10)}T00:00:00`);
    if (isNaN(s.getTime())) return "";
    if (!end) return `Ongoing since ${shortDate(start)}`;
    const e = new Date(`${String(end).slice(0, 10)}T00:00:00`);
    // An end before the start is bad data, not a negative duration. Say what
    // is certain (when it ended) rather than inventing "-3 days".
    if (isNaN(e.getTime()) || e < s) return shortDate(end);
    const days = Math.round((e.getTime() - s.getTime()) / 86400000);
    if (days === 0) return "Same day";
    if (days === 1) return "1 day";
    if (days < 14) return `${days} days`;
    if (days < 60) {
        const w = Math.round(days / 7);
        return `${w} week${w === 1 ? "" : "s"}`;
    }
    const mo = Math.round(days / 30.4375);
    return `${mo} month${mo === 1 ? "" : "s"}`;
}
