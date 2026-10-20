const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { transformSync } = require("@babel/core");
const modules = new Map();
function load(file) {
    const filename = path.resolve(__dirname, file);
    if (filename.endsWith(".cjs")) return require(filename);
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const code = transformSync(fs.readFileSync(filename, "utf8"), { babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"] }).code;
    new Function("require", "module", "exports", code)(name => load(path.resolve(path.dirname(filename), name + (path.extname(name) ? "" : ".js"))), module, module.exports);
    return module.exports;
}
const S = load("solidFoods.js"), F = load("feedingStats.js"), A = load("adapters.js");
const today = "2026-10-16";
const entry = (id, category, date = today, extra = {}) => ({ id, entryType: "solid", foodIntroduced: `Food ${id}`, foodCategory: category, date, ...extra });
const rows = S.FOOD_CATEGORIES.map((category, i) => entry(i + 1, category));
rows.push(entry(7, ""), entry(8, "unknown"), entry(9, "fruits", "2026-10-17"), entry(10, "fruits", "2026-02-30"), { entryType: "milk", date: today }, { milk_type: "Formula", start_date: today });
const before = JSON.stringify(rows), chart = S.buildSolidFoodChart(rows, "7", today);
assert.equal(chart.points.length, 7); assert.equal(chart.total, 8); assert.equal(chart.totals.other, 3);
assert.equal(chart.points.at(-1).total, 8); assert.equal(chart.percentages.fruits, 12.5);
assert.equal(Object.values(chart.totals).reduce((a,b)=>a+b, 0), chart.total);
assert.equal(JSON.stringify(rows), before); assert(chart.axis.max >= 8); assert(chart.axis.ticks.every(Number.isInteger));
for (const range of ["7", "30", "3m", "all"]) {
    const current = S.buildSolidFoodChart(rows, range, today); assert.equal(current.total, 8);
    assert(current.points.every((point,i) => !i || point.from > current.points[i-1].from));
    assert.equal(current.granularity, range === "all" ? "month" : range === "3m" ? "week" : "day");
}
assert.equal(S.buildSolidFoodChart([], "30", today).points.length, 30);
assert.equal(S.buildSolidFoodChart([], "7", today).axis.max, 4);
assert.equal(S.buildSolidFoodChart([{ entryType: "solid", date: today, foodIntroduced: "Beef nilaga and rice" }], "7", today).total, 1);
assert.equal(S.solidFoodCategory({ foodIntroduced: "Banana" }), "other", "No name-based guesses");
assert.equal(S.foodCategoryLabel(null), "Category not recorded");
for (const [value, category] of [[" Fruit ", "fruits"], ["VEGETABLE", "vegetables"], ["grain", "grains"], ["Protein", "proteins"], [" Dairy ", "dairy"], ["OTHER", "other"]]) {
    assert.equal(S.resolveFoodCategory(value), category);
    assert.equal(S.solidFoodCategory({ foodCategory: value }), category);
    assert.equal(S.foodCategoryLabel(value), S.foodCategoryLabel(category));
    assert.equal(S.searchSolidFoods([entry(1, value)], category).length, 1);
}
for (const value of [null, undefined, 42, "unknown", "__proto__", "constructor", "mixed dish"]) assert.equal(S.resolveFoodCategory(value), null);
const distribution = counts => S.buildSolidFoodChart(counts.flatMap((count, i) => Array.from({ length: count }, (_, n) => entry(`${i}-${n}`, S.FOOD_CATEGORIES[i]))), "7", today);
assert.deepEqual(Object.values(distribution([8, 7, 5, 6, 5, 24]).displayPercentages), [14, 13, 9, 11, 9, 44]);
assert.deepEqual(Object.values(distribution([1, 1, 1, 1, 1, 1]).displayPercentages), [17, 17, 17, 17, 16, 16]);
assert.deepEqual(Object.values(distribution([0, 0, 0, 0, 0, 0]).displayPercentages), [null, null, null, null, null, null]);
assert.equal(distribution([1, 999, 0, 0, 0, 0]).displayPercentages.fruits, 0);
const axisFor = load("feedingCountChart.js").feedingCountAxis;
assert.deepEqual(axisFor(10), { max: 12, step: 2, ticks: [0, 2, 4, 6, 8, 10, 12] });
for (const peak of [1, 2, 4, 5, 9, 11, 12, 23, 100, 9999, 1000000]) {
    const axis = axisFor(peak);
    assert(axis.max >= peak * 1.1 && axis.max <= Math.max(4, peak * 1.6));
    assert(axis.ticks.length <= 7 && axis.ticks.every(Number.isInteger));
    assert(axis.ticks.every((tick, i) => tick === i * axis.step));
    assert.equal(axis.ticks.at(-1), axis.max);
}
const historic = [entry(1, "", "2026-05-16", { foodIntroduced: "Beef nilaga and rice" }),
    entry(2, "", "2026-09-27", { foodIntroduced: "Shrimp", reactionSeverity: "severe", reaction: "Rash around the arm appeared." }),
    entry(3, "", "2026-07-12", { foodIntroduced: "Scrambled eggs", reactionSeverity: "mild", reaction: "Mild rash around the mouth, resolved within hours." }),
    ...Array.from({length:9}, (_,i) => entry(i+4, "", "2026-06-15"))];
const stats = F.solidFoodStats(historic, "2026-10");
assert.deepEqual([stats.distinct, stats.newThisMonth, stats.reactions.length], [12,0,2]);
assert.equal(stats.first.foodIntroduced, "Beef nilaga and rice"); assert.equal(stats.first.date, "2026-05-16");
assert.equal(stats.reactions[0].foodIntroduced, "Shrimp"); assert.equal(stats.reactions[1].foodIntroduced, "Scrambled eggs");
assert.equal(S.searchSolidFoods(historic, "arm")[0].foodIntroduced, "Shrimp");
assert.equal(S.searchSolidFoods(historic, "27 Sep 2026")[0].foodIntroduced, "Shrimp");
assert.equal(S.searchSolidFoods(historic, "2026-07-12")[0].foodIntroduced, "Scrambled eggs");
assert.equal(S.foodReactionLabel({ reaction: "Legacy symptoms" }), "Reaction recorded");
const legacy = { entryType: "solid", foodIntroduced: "Food", foodCategory: "fruits", reactionSeverity: "", reaction: "Legacy symptoms" };
assert.equal(A.nutritionFormToRecord(legacy).reaction, "Legacy symptoms");
assert.equal(A.nutritionFormToRecord(legacy).reaction_severity, null);
assert.equal(A.nutritionToApp({ food_category: "fruits" }).foodCategory, "fruits");
assert.equal(A.nutritionFormToRecord(legacy).food_category, "fruits");
assert.equal(A.nutritionFormToRecord({ ...legacy, reactionSeverity: "none" }).reaction, null);
const store = require("./recordStore.cjs"); store.reset();
const aggregate = () => S.buildSolidFoodChart(store.getRows("fixture", "nutrition").map(A.nutritionToApp), "7", today);
const add = store.begin({ child: "fixture", resource: "nutrition", type: "create", entity: "food", body: { entry_type: "solid", food_introduced: "Food", food_category: "fruits", entry_date: today } });
assert.equal(aggregate().totals.fruits, 1); store.finish(add, { id: 1, ...add.body });
const edit = store.begin({ child: "fixture", resource: "nutrition", type: "update", id: 1, body: { food_category: "vegetables" } });
assert.equal(aggregate().totals.vegetables, 1); assert.equal(aggregate().totals.fruits, 0); store.finish(edit, { id: 1, ...add.body, ...edit.body });
const remove = store.begin({ child: "fixture", resource: "nutrition", type: "delete", id: 1 }); assert.equal(aggregate().total, 0); store.finish(remove); store.reset();
assert(!Object.keys(A.nutritionFormToRecord(legacy)).some(key => /allerg/i.test(key)));
console.log("Solid food checks passed: six categories, four ranges, real entry counts, shared totals, unknown categories, original overview/milestone/reactions, search, legacy symptoms, and store create/edit/delete refresh.");
