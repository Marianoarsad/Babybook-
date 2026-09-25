// Focused source contract. Run: node components/ui/NutritionTrendChart.check.js
const fs = require("fs");
const path = require("path");

const chart = fs.readFileSync(path.join(__dirname, "NutritionTrendChart.js"), "utf8");
const screen = fs.readFileSync(path.join(__dirname, "..", "NutritionTracker.js"), "utf8");
const checks = [
    ["combined card title", screen.includes('title="Nutrition Over Time"')],
    ["legacy cards removed", !screen.includes('title="Milk Over Time"') && !screen.includes('title="Food Over Time"')],
    ["all/milk/food selector", ["all", "milk", "food"].every((key) => screen.includes(`{ key: "${key}"`))],
    ["at most seven x-axis labels", chart.includes("Math.min(7, points.length)")],
    ["year labels are unique and span the axis", chart.includes("evenYearSlots") && chart.includes("axisX(index, years.length)")],
    ["single-year labels use smaller month abbreviations", chart.includes('month: "short"') && chart.includes("fontSize: 11")],
    ["custom ranges use distinct full-axis DD/MM labels", chart.includes("datePreset == null") && chart.includes("new Set(evenDateSlots") && chart.includes("axisX(index, slots.length)") && chart.includes("${iso.slice(8, 10)}/${iso.slice(5, 7)}")],
    ["short ranges align weekday labels to bar geometry", chart.includes("selectedDayCount <= 7") && chart.includes("weekdayAbbreviation") && chart.includes("x: bar.centerX") && chart.includes("width: bar.width")],
    ["zero-based rounded bars", chart.includes("roundedBarPath") && chart.includes("value) || 0) / yAxis.max")],
    ["seven evenly spaced left-side y-axis labels", chart.includes("const Y_TICK_COUNT = 7") && chart.includes("length: Y_TICK_COUNT") && chart.includes("intervals - index") && chart.includes("const leftPad = 42") && chart.includes("x={2}") && chart.includes('textAnchor="start"')],
    ["average caption clears the histogram", chart.includes("paddingBottom: space.md")],
    ["unit label clears the top y-axis value", chart.includes("const chartHeight = 216") && chart.includes("const padTop = 28")],
    ["dashed average line", chart.includes('strokeDasharray="6 6"') && chart.includes("geometry.yFor(average)")],
    ["latest non-empty bar emphasized", chart.includes("point.value > 0 ? index : found") && chart.includes("bar.latest ? 1 : 0.68")],
    ["line chart marks removed", !chart.includes("LinearGradient") && !chart.includes("Circle")],
    ["theme-aware Milk and Food colors", screen.includes("color={colors.primary}") && screen.includes("color={colors.accent}")],
    ["feeding pattern retains selected span", screen.includes("days: milkSpanDays") && screen.includes("const nights = milkSpanDays || 1")],
];

let failed = 0;
for (const [name, ok] of checks) {
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}`);
    if (!ok) failed++;
}
console.log(failed ? `\n${failed} of ${checks.length} failed` : `\nall ${checks.length} passed`);
process.exit(failed ? 1 : 0);
