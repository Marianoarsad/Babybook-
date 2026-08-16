// Arithmetic for medicine courses and the doses given against them.
//
// READ THIS BEFORE ADDING ANYTHING HERE.
//
// Every function below counts, spreads or formats. None of them decides
// anything. This module must never gain a drug list, a dose lookup, a
// mg-per-kg calculation, a unit conversion, an interaction check, or a
// "you missed a dose" judgement. PRODUCT.md Principle 5: the app organizes and
// presents; it does not interpret, diagnose or advise — and for medicine that
// line is the whole feature. What a parent was told is the input, not
// something this file has an opinion about.
//
// `defaultDoseTimes` is the one place that could be mistaken for advice, so it
// is worth being precise: it spreads N slots evenly across a waking day and
// nothing more. The form presents them as "when you'll give it", the parent
// edits them freely, and the app never objects to what they choose.

// Evenly spread starting times for a day with `n` doses in it.
//
// Anchored to a 07:00-22:00 waking day so a twice-daily medicine lands at
// breakfast and bedtime rather than at midnight. Above 4 doses the spacing is
// computed rather than listed, because hand-writing a table to twelve would be
// pretending to a precision that is not there.
export function defaultDoseTimes(n) {
    const count = Math.max(1, Math.min(12, Math.round(Number(n) || 1)));
    const FIXED = {
        1: ["08:00"],
        2: ["08:00", "20:00"],
        3: ["08:00", "14:00", "20:00"],
        4: ["07:00", "12:00", "17:00", "22:00"],
    };
    if (FIXED[count]) return FIXED[count];
    const START = 7 * 60;
    const END = 22 * 60;
    const step = (END - START) / (count - 1);
    return Array.from({ length: count }, (_, i) => {
        const mins = Math.round(START + step * i);
        return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    });
}

// Normalize whatever came back from the API into an array of "HH:MM".
// `dose_times` is jsonb, so a driver or an older row can hand back a string,
// null, or something malformed; the UI must not crash on any of them.
export function doseTimesOf(med) {
    const raw = med && med.doseTimes;
    let list = raw;
    if (typeof raw === "string") {
        try {
            list = JSON.parse(raw);
        } catch (e) {
            list = null;
        }
    }
    if (!Array.isArray(list)) {
        // Fall back to an even spread of whatever frequency was recorded, so a
        // row saved before this feature still shows the right number of slots.
        const n = Number(med && med.frequencyPerDay);
        return n > 0 ? defaultDoseTimes(n) : [];
    }
    return list.filter((t) => typeof t === "string" && /^\d{1,2}:\d{2}/.test(t)).map((t) => t.slice(0, 5));
}

// The doses recorded for one medicine on one "YYYY-MM-DD", oldest first.
export function dosesOn(doses, medicationId, dateISO) {
    if (!Array.isArray(doses) || !dateISO) return [];
    const id = String(medicationId);
    return doses
        .filter((d) => String(d.medicationId) === id && d.date === dateISO)
        .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
}

// The last day of a planned course, or "" when it is open-ended.
// Day 1 IS the start date, so a 7-day course starting on the 1st ends on the 7th.
export function plannedEnd(startISO, courseDays) {
    const days = Number(courseDays);
    if (!startISO || !Number.isFinite(days) || days <= 0) return "";
    const d = new Date(`${String(startISO).slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + days - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Which day of the course a date falls on: 1 on the start date, 0 before it.
export function courseDay(startISO, dateISO) {
    if (!startISO || !dateISO) return 0;
    const s = new Date(`${String(startISO).slice(0, 10)}T00:00:00`);
    const d = new Date(`${String(dateISO).slice(0, 10)}T00:00:00`);
    if (isNaN(s.getTime()) || isNaN(d.getTime()) || d < s) return 0;
    return Math.round((d.getTime() - s.getTime()) / 86400000) + 1;
}

// "Day 3 of 7", or "Day 3" when the course has no planned length.
// Returns "" before the course starts, because "Day 0" is not a thing.
export function courseDayText(startISO, courseDays, dateISO) {
    const day = courseDay(startISO, dateISO);
    if (!day) return "";
    const days = Number(courseDays);
    return Number.isFinite(days) && days > 0 ? `Day ${day} of ${days}` : `Day ${day}`;
}

// Is this course still running on `dateISO`? A course the parent has marked
// finished is over regardless of its planned length, and one whose planned end
// has passed is over even if they never came back to tick it — otherwise a
// course logged in March would still be "active" in August, which is exactly
// the bug that made every illness read as ongoing.
export function isActiveOn(med, dateISO) {
    if (!med || med.resolved) return false;
    if (!med.date || !dateISO) return false;
    if (dateISO < med.date) return false;
    const end = plannedEnd(med.date, med.courseDays);
    return end ? dateISO <= end : true;
}

// The next dose time today that has not been ticked off yet, or "" if they are
// all done. Purely positional — it never says a dose is late or missed.
export function nextDoseTime(doseTimes, givenCount) {
    const times = Array.isArray(doseTimes) ? doseTimes : [];
    const given = Math.max(0, Number(givenCount) || 0);
    return given < times.length ? times[given] : "";
}

// Every dose slot across every active medicine in the next `hours`, soonest
// first, capped. This is what the notification scheduler consumes.
//
// The cap exists because iOS allows only 64 pending local notifications in
// total: one 3x-daily week-long course is 21, two are 42, and vaccination and
// checkup reminders are competing for the same budget. A rolling window
// topped up whenever the screen opens is the only way this stays reliable.
export function upcomingDoseSlots(meds, fromDate, hours = 48, cap = 24) {
    if (!Array.isArray(meds) || !(fromDate instanceof Date) || isNaN(fromDate.getTime())) return [];
    const until = new Date(fromDate.getTime() + hours * 3600000);
    const slots = [];
    for (let offset = 0; offset <= Math.ceil(hours / 24); offset++) {
        const day = new Date(fromDate.getTime() + offset * 86400000);
        const dayISO = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
        for (const med of meds) {
            if (!isActiveOn(med, dayISO)) continue;
            for (const t of doseTimesOf(med)) {
                const at = new Date(`${dayISO}T${t}:00`);
                if (isNaN(at.getTime()) || at <= fromDate || at > until) continue;
                slots.push({ medicationId: med.id, title: med.title, dose: med.doseAmount || "", at, time: t, date: dayISO });
            }
        }
    }
    slots.sort((a, b) => a.at - b.at);
    return slots.slice(0, cap);
}
