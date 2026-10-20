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
    `${strip("dates.js")}\nconst numericInput = { digitsOnly: (value) => String(value ?? "").replace(/\\D/g, "") };\nconst conditionRecords = { conditionAttachmentType: () => null };\n${strip("adapters.js")}\n${strip("feedingStats.js")}\n` +
        `return { dailyFeedingSummary, feedingPercentage, nutritionToApp, byMoment, foodKey, todayNutritionStats, feedingMixCategory, todayFeedingMix, inRangeOf, buildBuckets, milkDurations, longestGap,
                  nightStats, solidFoodStats, recentFoodNames, foodSuggestions,
                  hasBreastDurations, feedVolumeMl, STARTER_FOODS };`,
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

eq("today summary combines milk, bottle, breast, solids and last feed", M.todayNutritionStats([
    breast("2026-08-15", "07:00", 20),
    bottle("2026-08-15", "09:30", 120),
    solid("2026-08-15", "Banana", "none"),
], "2026-08-15", "10:00"), {
    count: 2, totalCount: 3, volume: 120, breastMinutes: 20, solidCount: 1,
    lastFeedDate: "2026-08-15", lastFeedTime: "09:30", sinceLastFeed: 30,
});
eq("today summary finds the latest milk feed across midnight", M.todayNutritionStats([
    bottle("2026-08-14", "23:30", 90),
], "2026-08-15", "01:00"), {
    count: 0, totalCount: 0, volume: 0, breastMinutes: 0, solidCount: 0,
    lastFeedDate: "2026-08-14", lastFeedTime: "23:30", sinceLastFeed: 90,
});
eq("untimed milk remains counted without replacing the last timed feed", M.todayNutritionStats([
    bottle("2026-08-15", "08:00", 90),
    bottle("2026-08-15", "", 60),
], "2026-08-15", "10:00"), {
    count: 2, totalCount: 2, volume: 150, breastMinutes: 0, solidCount: 0,
    lastFeedDate: "2026-08-15", lastFeedTime: "08:00", sinceLastFeed: 120,
});
eq("empty today summary is stable", M.todayNutritionStats([], "2026-08-15", "10:00"), {
    count: 0, totalCount: 0, volume: 0, breastMinutes: 0, solidCount: 0,
    lastFeedDate: "", lastFeedTime: "", sinceLastFeed: null,
});
eq("today feeding mix counts the four requested categories", M.todayFeedingMix([
    breast("2026-08-15", "07:00", 20),
    bottle("2026-08-15", "09:30", 120),
    { ...bottle("2026-08-15", "12:00", 90), milkType: "Mixed" },
    solid("2026-08-15", "Banana", "none"),
    solid("2026-08-14", "Lugaw", "none"),
], "2026-08-15"), { solid: 1, breastmilk: 1, formula: 1, mixed: 1, total: 4 });
eq("legacy breast-method rows count as breast milk", M.todayFeedingMix([
    { entryType: "milk", milkType: "", feedMethod: "breast", date: "2026-08-15" },
    { entryType: "milk", milkType: "", feedMethod: "bottle", date: "2026-08-15" },
], "2026-08-15"), { solid: 0, breastmilk: 1, formula: 0, mixed: 0, total: 1 });
eq("feeding entries share the donut classifier", [
    M.feedingMixCategory(solid("2026-08-15", "Banana", "none")),
    M.feedingMixCategory(breast("2026-08-15", "07:00", 20)),
    M.feedingMixCategory(bottle("2026-08-15", "09:30", 120)),
    M.feedingMixCategory({ ...bottle("2026-08-15", "12:00", 90), milkType: "Mixed" }),
].join(","), "solid,breastmilk,formula,mixed");
eq("empty today feeding mix is stable", M.todayFeedingMix([], "2026-08-15"), {
    solid: 0, breastmilk: 0, formula: 0, mixed: 0, total: 0,
});

// ---- inRangeOf: the window, and the window before it ----
const spread = [day(1), day(3), day(6), day(9), day(12)].map((d, i) => bottle(d, "09:00", 100 + i));
eq("inRangeOf keeps only the last 7 days", M.inRangeOf(spread, R7, 0, NOW).length, 3);
eq("inRangeOf offset 1 gives the 7 days before that", M.inRangeOf(spread, R7, 1, NOW).length, 2);
eq("inRangeOf windows do not overlap",
    M.inRangeOf(spread, R7, 0, NOW).filter((a) => M.inRangeOf(spread, R7, 1, NOW).includes(a)).length, 0);
eq("inRangeOf all-time returns everything", M.inRangeOf(spread, RALL, 0, NOW).length, 5);
eq("all-time has no previous window", M.inRangeOf(spread, RALL, 1, NOW).length, 0);

const explicit = { from: "2026-08-09", to: "2026-08-15" };
eq("explicit range includes both endpoints", M.inRangeOf(spread, explicit).length, 3);
eq("explicit previous range has the same length", M.inRangeOf(spread, explicit, 1).length, 2);
eq("explicit empty range keeps its selected-day denominator",
    M.buildBuckets([], explicit, () => 1).days, 7);

// ---- buildBuckets across measures ----
const mixedDay = [
    breast(day(1), "07:00", 20),
    breast(day(1), "11:00", 15),
    bottle(day(1), "15:00", 120),
    bottle(day(0), "08:00", 150),
];
const feedsOf = () => 1;
const volOf = M.feedVolumeMl;
const breastOf = (e) => (e.feedMethod === "breast" ? e.durationMinutes || 0 : 0);

eq("feeds measure counts every feed", M.buildBuckets(mixedDay, R7, feedsOf, NOW).total, 4);
eq("volume measure ignores breastfeeds", M.buildBuckets(mixedDay, R7, volOf, NOW).total, 270);
eq("mixed volume includes formula and breastmilk", M.feedVolumeMl({
    entryType: "milk", feedMethod: "bottle", milkType: "Mixed",
    quantity: 90, breastmilkQuantity: 60, unit: "mL",
}), 150);
eq("breast measure sums minutes", M.buildBuckets(mixedDay, R7, breastOf, NOW).total, 35);
eq("daily histogram preserves empty periods", M.buildBuckets(mixedDay, R7, feedsOf, NOW).bars.map((b) => b.value), [0, 0, 0, 0, 0, 3, 1]);
eq("short ranges use daily buckets", M.buildBuckets(mixedDay, R7, feedsOf, NOW).granularity, "day");

const weekly = M.buildBuckets(
    [bottle("2026-06-15", "08:00", 120)],
    { from: "2026-06-01", to: "2026-06-30" },
    feedsOf,
);
eq("month-sized ranges use weekly buckets", weekly.granularity, "week");
eq("weekly histogram preserves every calendar slot", weekly.bars.map((b) => b.value), [0, 0, 1, 0, 0]);

const monthly = M.buildBuckets(
    [bottle("2026-04-15", "08:00", 120)],
    { from: "2026-01-01", to: "2026-09-30" },
    feedsOf,
);
eq("long ranges use monthly buckets", monthly.granularity, "month");
eq("monthly histogram preserves every calendar slot", monthly.bars.map((b) => b.value), [0, 0, 0, 1, 0, 0, 0, 0, 0]);

const foodEntries = [
    solid(day(1), "Banana", "none"),
    solid(day(1), "Lugaw", "none"),
    solid(day(0), "Papaya", "none"),
];
eq("food histogram counts solid-food entries", M.buildBuckets(foodEntries, R7, feedsOf, NOW).total, 3);
eq("food histogram preserves empty periods", M.buildBuckets(foodEntries, R7, feedsOf, NOW).bars.map((b) => b.value), [0, 0, 0, 0, 0, 2, 1]);

// The bug the measure switch exists to prevent: a breastfeed-only day is
// invisible under volume, and must NOT be invisible under feeds.
const breastOnly = [breast(day(0), "07:00", 20), breast(day(0), "12:00", 18)];
eq("breastfeed-only day totals 0 under volume", M.buildBuckets(breastOnly, R7, volOf, NOW).total, 0);
eq("breastfeed-only day is visible under feeds", M.buildBuckets(breastOnly, R7, feedsOf, NOW).total, 2);
eq("empty input yields no bars", M.buildBuckets([], R7, feedsOf, NOW), { bars: [], days: 0, total: 0, granularity: "day" });

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
eq("legacy free-text reactions stay visible", M.solidFoodStats([
    { ...solid("2026-08-01", "Egg", ""), reaction: "Rash" },
    { ...solid("2026-08-02", "Banana", "none"), reaction: "No reaction" },
], "2026-08").reactions.map((e) => e.foodIntroduced).join(","), "Egg");

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
    { milkType: "Mixed", date: "2027-01-01" }, // simulated future row
];
const dur = M.milkDurations(types, "2026-08-15");
eq("milk runs group consecutive types", dur.periods.map((p) => p.type), ["Breastmilk", "Mixed", "Formula"]);
eq("current run is the latest type", dur.current.type, "Formula");
eq("current run counts to today", dur.current.days, 76);
eq("future rows cannot become the current milk type", dur.periods.some((p) => p.start > "2026-08-15"), false);
eq("no milk yields no current run", M.milkDurations([], "2026-08-15").current, null);

// The daily dashboard uses recorded events, not a comparison of unlike units.
const dailyDate = "2026-10-14";
const dailyRows = [bottle(dailyDate, "19:13", 150), solid(dailyDate, "Chicken tinola", "none"), bottle(dailyDate, "16:00", 140),
    solid(dailyDate, "Vegetable omelet", "none"), solid(dailyDate, "Pancit", "none"), bottle(dailyDate, "10:00", 130), bottle(dailyDate, "08:00", 120)];
const daily = M.dailyFeedingSummary(dailyRows, dailyDate);
eq("daily seven entries produce four milk / three solids and 540 mL", [daily.totalEntries, daily.milkEntries, daily.solidFoodEntries, daily.loggedMilkVolumeMl, daily.lastFeedingTime], [7, 4, 3, 540, "19:13"]);
eq("daily entry-count percentages", [M.feedingPercentage(daily.milkPercentage), M.feedingPercentage(daily.solidFoodPercentage)], ["57%", "43%"]);
eq("daily calculation does not mutate source order", dailyRows[0].time, "19:13");
const emptyDaily = M.dailyFeedingSummary([], dailyDate);
eq("empty day has zero counts and missing volume/time", [emptyDaily.totalEntries, emptyDaily.milkPercentage, emptyDaily.solidFoodPercentage, emptyDaily.loggedMilkVolumeMl, emptyDaily.lastFeedingTime], [0, 0, 0, null, null]);
eq("milk-only day includes duration-only and legacy unspecified milk", M.dailyFeedingSummary([breast(dailyDate, "08:00", 10), { date: dailyDate, milkType: "" }], dailyDate).milkPercentage, 100);
eq("duration-only milk has no invented measured volume", M.dailyFeedingSummary([breast(dailyDate, "08:00", 10)], dailyDate).loggedMilkVolumeMl, null);
eq("solid-only day is 100 percent with no milk measurement", [M.dailyFeedingSummary([solid(dailyDate, "Lugaw")], dailyDate).solidFoodPercentage, M.dailyFeedingSummary([solid(dailyDate, "Lugaw")], dailyDate).loggedMilkVolumeMl], [100, null]);
eq("partial milk measurements sum only known portions", M.dailyFeedingSummary([bottle(dailyDate, "08:00", null), { ...bottle(dailyDate, "09:00", null), milkType: "Mixed", breastmilkQuantity: 40 }], dailyDate).loggedMilkVolumeMl, 40);
eq("mixed feed sums both measured amounts", M.dailyFeedingSummary([{ ...bottle(dailyDate, "08:00", 70), milkType: "Mixed", breastmilkQuantity: 30 }], dailyDate).loggedMilkVolumeMl, 100);
eq("oz and legacy litres convert to mL", Number(M.dailyFeedingSummary([{ ...bottle(dailyDate, "08:00", 2), unit: "oz" }, { ...bottle(dailyDate, "09:00", 0.1), unit: "L" }], dailyDate).loggedMilkVolumeMl.toFixed(3)), 159.147);
eq("invalid amounts and unknown units are not invented measurements", M.dailyFeedingSummary([bottle(dailyDate, "08:00", NaN), bottle(dailyDate, "08:00", -10), { ...bottle(dailyDate, "08:00", 40), unit: "unknown" }], dailyDate).loggedMilkVolumeMl, null);
eq("last feeding time includes solids", M.dailyFeedingSummary([bottle(dailyDate, "08:00", 20), { ...solid(dailyDate, "Lugaw"), time: "23:59:00" }], dailyDate).lastFeedingTime, "23:59");
eq("untimed and invalid clock values do not create a time", M.dailyFeedingSummary([{ ...solid(dailyDate, "Lugaw"), time: "" }, bottle(dailyDate, "24:00", 20), bottle(dailyDate, "12:70", 20)], dailyDate).lastFeedingTime, null);
eq("midnight remains a real recorded time", M.dailyFeedingSummary([bottle(dailyDate, "00:00", 20)], dailyDate).lastFeedingTime, "00:00");
eq("local dates isolate days without UTC conversion", M.dailyFeedingSummary([bottle("2026-10-13", "23:59", 10), bottle(dailyDate, "00:01", 20), { date: dailyDate, entryType: "invalid" }], dailyDate).totalEntries, 1);
eq("alternate date computes the correct daily data", M.dailyFeedingSummary([bottle("2026-10-13", "23:59", 10), bottle(dailyDate, "00:01", 20)], "2026-10-13").loggedMilkVolumeMl, 10);
eq("tiny nonzero share stays distinguishable from no entries", [M.feedingPercentage(0.1), M.feedingPercentage(0)], ["<1%", "0%"]);
// Exercise the same subscription source as useRecords with disposable session-only fixtures.
const store = require("./recordStore.cjs");
store.reset(); store.confirm("fixture-a", "nutrition", { id: 1, entry_type: "milk", milk_type: "Formula", quantity: 100, unit: "mL", entry_date: dailyDate, entry_time: "08:00" });
const fixtureSummary = child => M.dailyFeedingSummary(store.getRows(child, "nutrition").map(M.nutritionToApp), dailyDate);
eq("daily store fixture starts with saved volume", fixtureSummary("fixture-a").loggedMilkVolumeMl, 100);
const add = store.begin({ child: "fixture-a", resource: "nutrition", type: "create", entity: "new-solid", body: { entry_type: "solid", food_introduced: "Lugaw", entry_date: dailyDate, entry_time: "12:00" } });
eq("optimistic addition updates counts and latest time", [fixtureSummary("fixture-a").totalEntries, fixtureSummary("fixture-a").lastFeedingTime], [2, "12:00"]);
store.finish(add, { id: 2, ...add.body });
const edit = store.begin({ child: "fixture-a", resource: "nutrition", type: "update", id: 1, body: { quantity: 150 } });
eq("optimistic edit recalculates volume", fixtureSummary("fixture-a").loggedMilkVolumeMl, 150);
store.update(edit, { status: "failed" });
eq("failed edit rolls the metric back", fixtureSummary("fixture-a").loggedMilkVolumeMl, 100);
store.dismiss(edit);
const remove = store.begin({ child: "fixture-a", resource: "nutrition", type: "delete", id: 2 });
eq("optimistic deletion updates the donut", fixtureSummary("fixture-a").milkPercentage, 100);
store.finish(remove);
eq("another child's summary has no leaked records", fixtureSummary("fixture-b").totalEntries, 0);
store.reset();

console.log(fail ? `\n${fail} of ${ran} failed` : `\nall ${ran} passed`);
process.exit(fail ? 1 : 0);
