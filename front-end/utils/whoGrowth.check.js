// Self-check for utils/whoGrowth.js — run with: node utils/whoGrowth.check.js
//
// This file computes health comparisons for children, so the maths is checked
// against WHO's OWN published numbers rather than against our expectations of
// them. Every "want" below is a value read directly from the WHO z-score
// expanded tables, not one we derived.
//
// whoGrowth.js is written as an ES module for Metro, so the three lines below
// rewrite it to CommonJS in memory. That is the only trick here; the code under
// test is the shipped file, untouched on disk.
const fs = require("fs");
const path = require("path");
const Module = require("module");

const HERE = __dirname;
let src = fs.readFileSync(path.join(HERE, "whoGrowth.js"), "utf8");
src = src.replace(
    /import\s+WHO\s+from\s+["'][^"']+["'];/,
    `const WHO = require(${JSON.stringify(path.join(HERE, "../assets/who/who-lms.json"))});`
);
src = src.replace(/export\s+const\s+/g, "const ").replace(/export\s+function\s+/g, "function ");
src +=
    "\nmodule.exports = { WHO_MAX_DAY, normalizeSex, signedAgeInDays, ageInDays, measurementAgeDomain, chartAxisTicks, evenAxisRatio, wholeNumberLabel, latestPointPerDay, integerAxisRange, lmsAt, valueAtZ, zScore, percentileFromZ, percentileRank, formatPercentile, referenceCurve, unitFor };";

const mod = new Module("whoGrowth");
mod._compile(src, path.join(HERE, "whoGrowth.js"));
const W = mod.exports;

let pass = 0;
let fail = 0;
function eq(label, got, want, tol = 1e-9) {
    const ok =
        want === null
            ? got === null
            : typeof want === "number"
              ? got != null && Math.abs(got - want) <= tol
              : got === want;
    if (ok) {
        pass++;
    } else {
        fail++;
        console.log(`FAIL ${label}\n     got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`);
    }
}

// --- LMS lookup reproduces the published table at day 0 ---
const wb0 = W.lmsAt("weight", "boys", 0);
eq("weight boys L", wb0.L, 0.3487);
eq("weight boys M", wb0.M, 3.3464);
eq("weight boys S", wb0.S, 0.14602);
eq("height boys median", W.lmsAt("height", "boys", 0).M, 49.8842);
eq("head boys median", W.lmsAt("head", "boys", 0).M, 34.4618);
eq("head girls median", W.lmsAt("head", "girls", 0).M, 33.8787);

// --- our formula reproduces WHO's own SD columns ---
eq("weight +2SD", W.valueAtZ(wb0.L, wb0.M, wb0.S, 2), 4.419, 0.001);
eq("weight -2SD", W.valueAtZ(wb0.L, wb0.M, wb0.S, -2), 2.459, 0.001);
eq("weight -3SD", W.valueAtZ(wb0.L, wb0.M, wb0.S, -3), 2.08, 0.001);
const hb0 = W.lmsAt("head", "boys", 0);
eq("head +2SD", W.valueAtZ(hb0.L, hb0.M, hb0.S, 2), 37.002, 0.001);

// --- zScore inverts valueAtZ ---
eq("median is z 0", W.zScore("weight", "boys", 0, 3.3464), 0, 1e-6);
eq("4.419kg is z 2", W.zScore("weight", "boys", 0, 4.419), 2, 0.002);
for (const z of [-3, -1.5, 0, 0.7, 2.5]) {
    const lms = W.lmsAt("height", "girls", 400);
    const v = W.valueAtZ(lms.L, lms.M, lms.S, z);
    eq(`round-trip z=${z}`, W.zScore("height", "girls", 400, v), z, 1e-6);
}

// --- percentiles ---
eq("z 0 -> 50th", W.percentileFromZ(0), 50, 1e-6);
eq("z 1.96 -> 97.5th", W.percentileFromZ(1.96), 97.5, 0.01);
eq("z -2 -> 2.275th", W.percentileFromZ(-2), 2.275, 0.01);
eq("ordinal 1", W.formatPercentile(1), "1st");
eq("ordinal 2", W.formatPercentile(2), "2nd");
eq("ordinal 3", W.formatPercentile(3), "3rd");
eq("ordinal 11", W.formatPercentile(11), "11th");
eq("clamps low", W.formatPercentile(0.4), "<1st");
eq("clamps high", W.formatPercentile(99.6), ">99th");
eq("plain rank rounds", W.percentileRank(46.4).count, 46);
eq("plain rank keeps low open", W.percentileRank(0.4).kind, "under");
eq("plain rank keeps high open", W.percentileRank(99.6).kind, "over");

// --- the two features that a coarser sampling grid destroyed ---
// WHO switches from measuring length (lying down) to height (standing) at 2
// years, and the reference drops ~0.67cm across that single day.
eq("2-year length/height step", W.lmsAt("height", "boys", 730).M - W.lmsAt("height", "boys", 731).M, 0.6715, 0.002);
// Newborns lose weight before regaining it; the median dips after birth.
eq("newborn weight dip", W.lmsAt("weight", "boys", 1).M < W.lmsAt("weight", "boys", 0).M, true);
eq("day 1 median weight", W.lmsAt("weight", "boys", 1).M, 3.3174);

// --- guards: never guess ---
eq("blank sex", W.normalizeSex(""), null);
eq("unknown sex", W.normalizeSex("unspecified"), null);
eq("Male", W.normalizeSex("Male"), "boys");
eq("girls", W.normalizeSex("girls"), "girls");
eq("past WHO range", W.lmsAt("weight", "boys", 2000), null);
eq("negative age", W.lmsAt("weight", "boys", -5), null);
eq("zero measurement", W.zScore("weight", "boys", 100, 0), null);
eq("age in days", W.ageInDays("2024-01-01", "2024-01-31"), 30);
eq("measured before birth", W.ageInDays("2024-06-01", "2024-01-01"), null);
eq("missing date of birth", W.ageInDays(null, "2024-01-01"), null);
eq("signed day before birth", W.signedAgeInDays("2024-06-01", "2024-01-01"), -152);
eq("signed day at birth", W.signedAgeInDays("2024-06-01", "2024-06-01"), 0);
eq("signed day after birth", W.signedAgeInDays("2024-06-01", "2024-06-11"), 10);

// --- filtered charts fit the dates that actually contain measurements ---
const fitted = W.measurementAgeDomain([{ day: 120 }, { day: 180 }, { day: 240 }]);
eq("measurement domain starts at first point", fitted.from, 120);
eq("measurement domain ends at last point", fitted.to, 240);
eq("single measurement gets a centered domain", W.measurementAgeDomain([{ day: 42 }]).from, 41);
eq("single measurement domain stays centered", W.measurementAgeDomain([{ day: 42 }]).to, 43);
eq("empty measurement domain", W.measurementAgeDomain([]), null);
const axisTicks = W.chartAxisTicks(10, 20);
eq("chart axis has five ticks", axisTicks.length, 5);
eq("chart axis starts at its lowest value", axisTicks[0], 10);
eq("chart axis ends at its highest value", axisTicks[4], 20);
eq("chart axis ticks ascend evenly", axisTicks[2], 15);
eq("single chart item is centered", W.evenAxisRatio(0, 1), 0.5);
eq("first chart item reaches the left edge", W.evenAxisRatio(0, 4), 0);
eq("middle chart items are evenly spaced", W.evenAxisRatio(1, 4), 1 / 3);
eq("last chart item reaches the right edge", W.evenAxisRatio(3, 4), 1);
eq("whole labels round down", W.wholeNumberLabel(22.4), "22");
eq("whole labels round up", W.wholeNumberLabel(22.6), "23");
eq("whole labels keep missing values blank", W.wholeNumberLabel(null), "");
eq("whole labels reject junk", W.wholeNumberLabel("not-a-number"), "");
const dailyPoints = W.latestPointPerDay([
    { id: 4, day: 2, date: "2026-09-03", value: 7.2 },
    { id: 2, day: 0, date: "2026-09-01", value: 7.0 },
    { id: 5, day: 2, date: "2026-09-03", value: 7.3 },
]);
eq("daily chart keeps one point per date", dailyPoints.length, 2);
eq("daily chart keeps the latest same-day record", dailyPoints[1].id, 5);
eq("daily chart points stay chronological", dailyPoints[0].date, "2026-09-01");
const narrowIntegerAxis = W.integerAxisRange(7.2, 7.8);
eq("integer axis centers a narrow decimal range", JSON.stringify(narrowIntegerAxis), '{"min":6,"max":10}');
eq("integer axis produces five unique whole ticks", JSON.stringify(W.chartAxisTicks(narrowIntegerAxis.min, narrowIntegerAxis.max)), "[6,7,8,9,10]");
const sevenTickAxis = W.integerAxisRange(7.2, 7.8, 7);
eq("parent axis produces seven whole ticks", W.chartAxisTicks(sevenTickAxis.min, sevenTickAxis.max, 7).length, 7);
eq("parent axis ticks stay distinct", new Set(W.chartAxisTicks(sevenTickAxis.min, sevenTickAxis.max, 7)).size, 7);
const wideIntegerAxis = W.integerAxisRange(10.2, 20.1);
eq("integer axis contains a wider range", wideIntegerAxis.min <= 10.2 && wideIntegerAxis.max >= 20.1, true);
const negativeIntegerAxis = W.integerAxisRange(-0.5, 1.5);
eq("integer axis handles negative ranges", negativeIntegerAxis.min <= -0.5 && negativeIntegerAxis.max >= 1.5, true);
eq("integer axis rejects invalid input", W.integerAxisRange(5, 5), null);

// --- reference curves ---
const curve = W.referenceCurve("weight", "boys", 0, 365, 0);
eq("curve populated", curve.length > 20, true);
eq("curve starts at 0", curve[0].day, 0);
eq("curve ends at 365", curve[curve.length - 1].day, 365);
eq("curve sorted", curve.every((p, i) => i === 0 || p.day > curve[i - 1].day), true);
eq("curve clamps to WHO range", W.referenceCurve("weight", "boys", 0, 5000, 0).slice(-1)[0].day, 1856);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
