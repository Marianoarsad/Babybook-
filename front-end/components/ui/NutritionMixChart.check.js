// Focused source contract. Run: node components/ui/NutritionMixChart.check.js
const fs = require("fs");
const path = require("path");

const chart = fs.readFileSync(path.join(__dirname, "NutritionMixChart.js"), "utf8");
const screen = fs.readFileSync(path.join(__dirname, "..", "NutritionTracker.js"), "utf8");
const checks = [
    ["Feeding Pattern is replaced", screen.includes('title="Today’s Feeding Breakdown"') && !screen.includes('title="Feeding Pattern"')],
    ["card is always rendered", screen.includes("<NutritionMixChart counts={feedingMix} />")],
    ["four-category donut", ["solid", "breastmilk", "formula", "mixed"].every((key) => chart.includes(`key: "${key}"`))],
    ["small percentages move outside", chart.includes("const OUTSIDE_AT = 0.08") && chart.includes("spreadLabels") && chart.includes("<Line")],
    ["empty donut remains visible", chart.includes("No feedings") && chart.includes("logged today")],
    ["legend is a centered two-column layout", chart.includes('width: "45%"') && chart.match(/justifyContent: "center"/g)?.length >= 2 && chart.includes("CATEGORIES.map")],
    ["screen-reader summary includes values", chart.includes('accessibilityRole="image"') && chart.includes("category.label") && chart.includes("percent")],
    ["theme-owned category colors", chart.includes("colors.nutritionMix")],
];

let failed = 0;
for (const [name, ok] of checks) {
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}`);
    if (!ok) failed++;
}
console.log(failed ? `\n${failed} of ${checks.length} failed` : `\nall ${checks.length} passed`);
process.exit(failed ? 1 : 0);
