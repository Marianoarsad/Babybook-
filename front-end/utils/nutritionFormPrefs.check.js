const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
    canStepFormulaScoops,
    formulaScoopsOrDefault,
    isFormulaScoopsDraft,
    isFormulaScoopsValue,
    nutritionFormDefaults,
    parseNutritionPrefs,
    recentNutritionFields,
    stepFormulaScoops,
} = require("./nutritionFormPrefs.cjs");

const milk = {
    entryType: "milk", milkType: "Mixed", feedMethod: "breast", formulaBrand: "A+",
    formulaScoops: "4.5", quantity: "135", breastmilkQuantity: "60", unit: "mL", durationMinutes: "",
    notes: "Evening feed", date: "2026-09-01", time: "08:00",
};
const solid = {
    entryType: "solid", foodIntroduced: "Banana", reactionSeverity: "mild",
    reaction: "Small rash", notes: "Observed", date: "2026-09-02", time: "09:00",
};
const prefs = {
    milk: recentNutritionFields(milk),
    solid: recentNutritionFields(solid),
};
assert.equal(prefs.milk.feedMethod, "bottle");
assert.equal(prefs.milk.date, undefined);
assert.equal(prefs.solid.time, undefined);
assert.deepEqual(
    nutritionFormDefaults(prefs, "milk", "2026-09-19", "10:30"),
    {
        entryType: "milk", milkType: "Mixed", feedMethod: "bottle", formulaBrand: "A+",
        formulaScoops: "4.5", quantity: "135", breastmilkQuantity: "60", unit: "mL", durationMinutes: "",
        foodIntroduced: "", reactionSeverity: "none", reaction: "",
        date: "2026-09-19", time: "10:30", notes: "Evening feed",
    },
);
assert.equal(nutritionFormDefaults(prefs, "solid", "2026-09-19", "10:31").foodIntroduced, "Banana");
assert.equal(formulaScoopsOrDefault(""), "1");
assert.equal(formulaScoopsOrDefault("2.5"), "2.5");
assert.equal(stepFormulaScoops("1.5", 1), "2.5");
assert.equal(stepFormulaScoops("1.5", -1), "0.5");
assert.equal(stepFormulaScoops("", 1), "1");
assert.equal(canStepFormulaScoops("0.5", -1), false);
assert.equal(canStepFormulaScoops("999.99", 1), false);
assert.equal(isFormulaScoopsDraft("4.25"), true);
assert.equal(isFormulaScoopsDraft("4.256"), false);
assert.equal(isFormulaScoopsValue("0"), false);
assert.equal(isFormulaScoopsValue("0.5"), true);
assert.deepEqual(parseNutritionPrefs("{bad", '{"milkType":"Formula","unit":"oz"}'), {
    milk: { milkType: "Formula", unit: "oz" },
    solid: null,
});
assert.deepEqual(parseNutritionPrefs('{"solid":{"foodIntroduced":"Pear"}}', '{"unit":"oz"}'), {
    milk: { unit: "oz" },
    solid: { foodIntroduced: "Pear" },
});

const tracker = fs.readFileSync(path.join(__dirname, "../components/NutritionTracker.js"), "utf8");
assert(tracker.indexOf(">Formula Brand<") < tracker.indexOf(">Scoops<"));
assert(tracker.indexOf(">Scoops<") < tracker.indexOf('form.milkType === "Mixed" ? "Formula Amount" : "Amount"'));
assert(tracker.indexOf('form.milkType === "Mixed" ? "Formula Amount" : "Amount"') < tracker.indexOf('label="Breastmilk Amount"'));
assert(tracker.includes('form.milkType === "Breastmilk" ? ('));
assert(tracker.includes("prefsChildId === id && prefs"));
assert(tracker.includes('accessibilityLabel="Decrease formula scoops"'));
assert(tracker.includes('accessibilityLabel="Increase formula scoops"'));
assert(!tracker.includes('placeholder="e.g. 4"'));
assert.equal((tracker.match(/<RecordFormRow/g) || []).length, 7);
console.log("Nutrition form preference and layout checks passed.");
