// WHO Child Growth Standards — z-scores, percentiles, and reference curves.
//
// DATA: front-end/assets/who/who-lms.json, built from WHO's published z-score
// expanded tables (2006 standards, birth to 1856 days). Each row is
// [dayOfAge, L, M, S]. The build step verified our formula against WHO's own
// precomputed SD columns (max error 0.0005) and verified that the sampled grid
// reproduces WHO's per-day values to within 0.007 cm / 0.003 kg — far below the
// precision a measurement is actually taken at.
//
// WHAT THIS IS NOT: a diagnosis. These functions place a measurement against a
// reference population. They do not assess a child. Callers must present the
// result as a comparison, never as a verdict — see PRODUCT.md, "Never imply
// clinical authority."
import WHO from "../assets/who/who-lms.json";

export const WHO_MAX_DAY = 1856; // ~5.08 years; WHO's standards stop here
export const INDICATORS = ["weight", "height", "head"];

// WHO publishes separate curves per sex, and there is no combined table. A
// child whose sex was never recorded cannot be placed on either curve — we
// return null rather than guessing. (adapters.js defaults an unknown sex to
// girl for theming; that default must not leak into a growth comparison.)
export function normalizeSex(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "boy" || v === "boys" || v === "male" || v === "m") return "boys";
    if (v === "girl" || v === "girls" || v === "female" || v === "f") return "girls";
    return null;
}

export function ageInDays(dateOfBirth, onDate) {
    if (!dateOfBirth || !onDate) return null;
    const dob = new Date(`${String(dateOfBirth).slice(0, 10)}T00:00:00`);
    const at = new Date(`${String(onDate).slice(0, 10)}T00:00:00`);
    if (isNaN(dob.getTime()) || isNaN(at.getTime())) return null;
    const days = Math.round((at - dob) / 86400000);
    return days < 0 ? null : days;
}

// Linear interpolation between the two nearest sampled days.
export function lmsAt(indicator, sex, day) {
    const table = WHO.indicators?.[indicator]?.[sex];
    if (!table || !table.length || day == null || day < 0) return null;
    if (day > WHO_MAX_DAY) return null;

    if (day <= table[0][0]) {
        const [, L, M, S] = table[0];
        return { L, M, S };
    }
    const last = table[table.length - 1];
    if (day >= last[0]) return { L: last[1], M: last[2], S: last[3] };

    let lo = 0;
    let hi = table.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (table[mid][0] <= day) lo = mid;
        else hi = mid;
    }
    const a = table[lo];
    const b = table[hi];
    const t = (day - a[0]) / (b[0] - a[0]);
    return {
        L: a[1] + (b[1] - a[1]) * t,
        M: a[2] + (b[2] - a[2]) * t,
        S: a[3] + (b[3] - a[3]) * t,
    };
}

// The measurement sitting exactly on a given z-score line.
export function valueAtZ(L, M, S, z) {
    if (Math.abs(L) < 1e-9) return M * Math.exp(S * z);
    return M * Math.pow(1 + L * S * z, 1 / L);
}

// Where a real measurement falls, in standard deviations from the median.
export function zScore(indicator, sex, day, value) {
    const lms = lmsAt(indicator, sex, day);
    if (!lms || !(value > 0)) return null;
    const { L, M, S } = lms;
    const z = Math.abs(L) < 1e-9
        ? Math.log(value / M) / S
        : (Math.pow(value / M, L) - 1) / (L * S);
    return Number.isFinite(z) ? z : null;
}

// Normal CDF via Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7).
function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const y =
        1 -
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
            0.254829592) *
            t *
            Math.exp(-ax * ax);
    return sign * y;
}

export function percentileFromZ(z) {
    if (z == null || !Number.isFinite(z)) return null;
    return 50 * (1 + erf(z / Math.SQRT2));
}

// "3rd", "50th", "<1st", ">99th" — the vocabulary parents hear at a clinic.
export function formatPercentile(p) {
    if (p == null) return null;
    if (p < 1) return "<1st";
    if (p > 99) return ">99th";
    const n = Math.round(p);
    const rem100 = n % 100;
    if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
    switch (n % 10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
    }
}

// Plain description of where a measurement sits. Deliberately positional, never
// diagnostic: WHO's own cut-offs carry clinical labels ("underweight") that this
// product is not entitled to apply — see PRODUCT.md, "Never imply clinical
// authority". We say where the point is and let a health worker judge it.
//
// Lives here rather than in a screen because both the Growth screen's full
// chart and the Dashboard's compact one need the same wording — two screens
// describing the same z differently would be worse than either wording alone.
export function describeZ(z) {
    const a = Math.abs(z);
    if (a <= 2) return { text: "Within the range WHO reports for most children this age", flag: false };
    if (a <= 3)
        return {
            text: `${z > 0 ? "Above" : "Below"} the range WHO reports for most children this age`,
            flag: true,
        };
    return {
        text: `Well ${z > 0 ? "above" : "below"} the range WHO reports for most children this age`,
        flag: true,
    };
}

// Reference curve for one z line across an age span, for drawing.
export function referenceCurve(indicator, sex, fromDay, toDay, z, steps = 60) {
    const table = WHO.indicators?.[indicator]?.[sex];
    if (!table) return [];
    const start = Math.max(0, Math.min(fromDay, WHO_MAX_DAY));
    const end = Math.max(start, Math.min(toDay, WHO_MAX_DAY));
    const out = [];
    const seen = new Set();
    const push = (day) => {
        if (day < start || day > end || seen.has(day)) return;
        const lms = lmsAt(indicator, sex, day);
        if (!lms) return;
        seen.add(day);
        out.push({ day, value: valueAtZ(lms.L, lms.M, lms.S, z) });
    };
    // Sample WHO's own grid points inside the window so the length/height step
    // at day 730 and the newborn dip stay sharp, then fill in evenly.
    for (const row of table) if (row[0] >= start && row[0] <= end) push(row[0]);
    const span = end - start;
    if (span > 0) for (let i = 0; i <= steps; i++) push(Math.round(start + (span * i) / steps));
    push(start);
    push(end);
    out.sort((a, b) => a.day - b.day);
    return out;
}

export function unitFor(indicator) {
    return WHO.indicators?.[indicator]?.unit || "";
}

export const WHO_SOURCE = WHO.source;
