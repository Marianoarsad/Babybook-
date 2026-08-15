// Self-check for utils/feedingStats.js. Run: node utils/feedingStats.check.js
// Mirrors utils/dates.check.js and whoGrowth.check.js — plain assertions, no
// test framework.
const fs = require("fs");
const path = require("path");

const strip = (f) =>
    fs
        .readFileSync(path.join(__dirname, f), "utf8")
        .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm, "")
        .replace(/export (function|const)/g, "$1");

// feedingStats depends on dates.js, so both are evaluated in one scope.
const M = new Function(
    `${strip("dates.js")}\n${strip("feedingStats.js")}\n` +
        `return { byMoment, foodKey, inRangeOf, buildBuckets, milkDurations, longestGap,
                  nightStats, solidFoodStats, recentFoodNames, foodSuggestions,
                  hasBreastDurations, STARTER_FOODS };`,
)();

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

// A fixed "now" so every windowing assertion is deterministic.
const NOW = new Date("2026-08-15T12:00:00").getTime();
const day = (n) => {
    const d = new Date(NOW - n * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const bottle = (date, time, ml) => ({
    entryType: "milk", feedMethod: "bottle", milkType: "Formula", quantity: ml, unit: "mL", date, time,
});
const breast = (date, time, mins) => ({
    entryType: "milk", feedMethod: "breast", milkType: "Breastmilk", durationMinutes: mins, date, time,
});
const solid = (date, food, severity) => ({
    entryType: "solid", foodIntroduced: food, reactionSeverity: severity, date, time: "12:00",
});

const R7 = { key: "7d", label: "7 Days", days: 7 };
const RALL = { key: "all", label: "All Time", days: null };

// ---- inRangeOf: the window, and the window before it ----
const spread = [day(1), day(3), day(6), day(9), day(12)].map((d, i) => bottle(d, "09:00", 100 + i));
eq("inRangeOf keeps only the last 7 days", M.inRangeOf(spread, R7, 0, NOW).length, 3);
eq("inRangeOf offset 1 gives the 7 days before that", M.inRangeOf(spread, R7, 1, NOW).length, 2);
eq("inRangeOf windows do not overlap",
    M.inRangeOf(spread, R7, 0, NOW).filter((a) => M.inRangeOf(spread, R7, 1, NOW).includes(a)).length, 0);
eq("inRangeOf all-time returns everything", M.inRangeOf(spread, RALL, 0, NOW).length, 5);
eq("all-time has no previous window", M.inRangeOf(spread, RALL, 1, NOW).length, 0);

// ---- buildBuckets across measures ----
const mixedDay = [
    breast(day(1), "07:00", 20),
    breast(day(1), "11:00", 15),
    bottle(day(1), "15:00", 120),
    bottle(day(0), "08:00", 150),
];
const feedsOf = () => 1;
const volOf = (e) => (e.feedMethod === "breast" ? 0 : e.quantity);
const breastOf = (e) => (e.feedMethod === "breast" ? e.durationMinutes || 0 : 0);

eq("feeds measure counts every feed", M.buildBuckets(mixedDay, R7, feedsOf, NOW).total, 4);
eq("volume measure ignores breastfeeds", M.buildBuckets(mixedDay, R7, volOf, NOW).total, 270);
eq("breast measure sums minutes", M.buildBuckets(mixedDay, R7, breastOf, NOW).total, 35);
eq("buckets split by day", M.buildBuckets(mixedDay, R7, feedsOf, NOW).bars.map((b) => b.value), [3, 1]);

// The bug the measure switch exists to prevent: a breastfeed-only day is
// invisible under volume, and must NOT be invisible under feeds.
const breastOnly = [breast(day(0), "07:00", 20), breast(day(0), "12:00", 18)];
eq("breastfeed-only day totals 0 under volume", M.buildBuckets(breastOnly, R7, volOf, NOW).total, 0);
eq("breastfeed-only day is visible under feeds", M.buildBuckets(breastOnly, R7, feedsOf, NOW).total, 2);
eq("empty input yields no bars", M.buildBuckets([], R7, feedsOf, NOW), { bars: [], days: 0, total: 0 });

// ---- longestGap ----
const gappy = [
    bottle("2026-08-14", "08:00", 100),
    bottle("2026-08-14", "10:30", 100), // 2h30
    bottle("2026-08-14", "17:00", 100), // 6h30  <- longest
    bottle("2026-08-15", "01:00", 100), // 8h... across midnight, longer
];
eq("longestGap finds the widest span", M.longestGap(gappy).minutes, 480);
eq("longestGap reports the day it started", M.longestGap(gappy).date, "2026-08-14");
eq("longestGap needs two timed feeds", M.longestGap([bottle("2026-08-14", "08:00", 100)]), null);
eq("longestGap skips untimed entries",
    M.longestGap([bottle("2026-08-14", "", 100), bottle("2026-08-14", "09:00", 100)]), null);

// ---- nightStats: 22:00-05:59 ----
const nights = [
    bottle("2026-08-14", "22:00", 90), // night (boundary, inclusive)
    bottle("2026-08-14", "23:45", 90), // night
    bottle("2026-08-15", "03:00", 90), // night
    bottle("2026-08-15", "05:59", 90), // night (boundary, inclusive)
    bottle("2026-08-15", "06:00", 90), // day (boundary, exclusive)
    bottle("2026-08-15", "21:59", 90), // day (boundary, exclusive)
    bottle("2026-08-15", "13:00", 90), // day
];
eq("nightStats counts 22:00-05:59 only", M.nightStats(nights, 7).count, 4);
eq("nightStats rate divides by nights", M.nightStats(nights, 2).perNight, 2);
eq("nightStats survives zero nights", M.nightStats(nights, 0).perNight, 0);
eq("nightStats ignores untimed entries", M.nightStats([bottle("2026-08-15", "", 90)], 1).count, 0);

// ---- solidFoodStats ----
const foods = [
    solid("2026-02-01", "Rice Cereal", "none"),
    solid("2026-02-10", "Banana", "none"),
    solid("2026-08-02", " banana ", "none"), // same food, different spelling
    solid("2026-08-05", "BANANA", "none"), // and again
    solid("2026-08-09", "Scrambled Egg", "mild"),
    solid("2026-08-11", "Peanut", "severe"),
];
const fs2 = M.solidFoodStats(foods, "2026-08");
eq("distinct foods normalize case and spacing", fs2.distinct, 4);
eq("first solid is the earliest", fs2.first.foodIntroduced, "Rice Cereal");
eq("new-this-month counts first-times only", fs2.newThisMonth, 2);
eq("reactions are only mild and severe", fs2.reactions.map((r) => r.foodIntroduced), ["Peanut", "Scrambled Egg"]);
eq("no solids yields a null first", M.solidFoodStats([], "2026-08").first, null);

// ---- recentFoodNames ----
eq("recent foods are newest first and deduped",
    M.recentFoodNames(foods, 6), ["Peanut", "Scrambled Egg", "BANANA", "Rice Cereal"]);
eq("recent foods respect the limit", M.recentFoodNames(foods, 2), ["Peanut", "Scrambled Egg"]);
eq("recent foods skip blanks", M.recentFoodNames([solid("2026-08-01", "   ", "none")], 6), []);

// ---- foodSuggestions: own history, else the starter list ----
eq("suggestions prefer this child's own foods", M.foodSuggestions(foods, 3).foods,
    ["Peanut", "Scrambled Egg", "BANANA"]);
eq("own foods are flagged as history", M.foodSuggestions(foods, 3).fromHistory, true);
eq("no history falls back to starters", M.foodSuggestions([], 4).foods, M.STARTER_FOODS.slice(0, 4));
eq("starters are flagged as NOT history", M.foodSuggestions([], 4).fromHistory, false);
// A blank-name entry is not history — it would otherwise suppress the
// starters and leave a first-time parent with no chips at all.
eq("blank-only history still falls back",
    M.foodSuggestions([solid("2026-08-01", "  ", "none")], 3).fromHistory, false);

// ---- hasBreastDurations: gates the "Breast time" chart measure ----
// Duration is optional, so breastfeeds with no minutes must not offer a
// measure that would plot a flat zero and read as "no feeding".
eq("breastfeeds with minutes enable the measure", M.hasBreastDurations(breastOnly), true);
eq("breastfeeds without minutes do not",
    M.hasBreastDurations([breast(day(0), "07:00", null), breast(day(0), "12:00", null)]), false);
eq("one timed feed among untimed ones is enough",
    M.hasBreastDurations([breast(day(0), "07:00", null), breast(day(0), "12:00", 14)]), true);
eq("bottle feeds never enable it", M.hasBreastDurations([bottle(day(0), "09:00", 120)]), false);

// A breastfeed with no duration still counts under the "feeds" measure —
// this is the whole point of duration being optional.
eq("undated-duration breastfeeds still count as feeds",
    M.buildBuckets([breast(day(0), "07:00", null), breast(day(0), "12:00", null)], R7, feedsOf, NOW).total, 2);

// ---- milkDurations ----
const types = [
    { milkType: "Breastmilk", date: "2026-01-01" },
    { milkType: "Breastmilk", date: "2026-03-01" },
    { milkType: "Mixed", date: "2026-04-01" },
    { milkType: "Formula", date: "2026-06-01" },
];
const dur = M.milkDurations(types, "2026-08-15");
eq("milk runs group consecutive types", dur.periods.map((p) => p.type), ["Breastmilk", "Mixed", "Formula"]);
eq("current run is the latest type", dur.current.type, "Formula");
eq("current run counts to today", dur.current.days, 76);
eq("no milk yields no current run", M.milkDurations([], "2026-08-15").current, null);

console.log(fail ? `\n${fail} of ${ran} failed` : `\nall ${ran} passed`);
process.exit(fail ? 1 : 0);
