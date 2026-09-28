// Focused source contract. Run: node components/ui/NutritionTrendChart.check.js
const fs = require("fs");
const path = require("path");

const chart = fs.readFileSync(path.join(__dirname, "NutritionTrendChart.js"), "utf8");
const screen = fs.readFileSync(path.join(__dirname, "..", "NutritionTracker.js"), "utf8");
const checks = [
    ["combined card title", screen.includes('title="Nutrition Over Time"')],
    ["legacy cards removed", !screen.includes('title="Milk Over Time"') && !screen.includes('title="Food Over Time"')],
    ["Milk/Food checklist replaces All selector", screen.includes("const NUTRITION_CHARTS") && ["milk", "food"].every((key) => screen.includes(`{ key: "${key}"`)) && !screen.includes("const CHART_SCOPES")],
    ["at most seven x-axis labels", chart.includes("Math.min(7, points.length)")],
    ["year labels are unique and span the axis", chart.includes("evenYearSlots") && chart.includes("axisX(index, years.length)")],
    ["single-year labels use smaller month abbreviations", chart.includes('month: "short"') && chart.includes("fontSize: 11")],
    ["custom ranges use distinct full-axis DD/MM labels", chart.includes("datePreset == null") && chart.includes("new Set(evenDateSlots") && chart.includes("axisX(index, slots.length)") && chart.includes("${iso.slice(8, 10)}/${iso.slice(5, 7)}")],
    ["short ranges align weekday labels to bar geometry", chart.includes("selectedDayCount <= 7") && chart.includes("weekdayAbbreviation") && chart.includes("x: bar.centerX") && chart.includes("width: bar.width")],
    ["zero-based rounded bars", chart.includes("roundedBarPath") && chart.includes("value) || 0) / yAxis.max")],
    ["seven evenly spaced left-side y-axis labels", chart.includes("const Y_TICK_COUNT = 7") && chart.includes("length: Y_TICK_COUNT") && chart.includes("intervals - index") && chart.includes("const leftPad = 42") && chart.includes("x={2}") && chart.includes('textAnchor="start"')],
    ["average caption clears the histogram", chart.includes("paddingBottom: space.md")],
    ["Milk measure filter shares the average header", chart.includes("headerControl") && chart.includes("styles.averageHeader") && screen.includes("headerControl={(") && !screen.includes("measureControlRow")],
    ["Milk measure filter matches the Home chart control", screen.includes("minWidth: 128") && screen.includes("borderRadius: radius.pill") && screen.includes("measureSelectText: { ...type.label") && screen.includes("size={18}") && screen.includes("color={colors.textSecondary}")],
    ["Milk measure menu is an inline trigger-width select", /visible=\{measureMenuOpen\}[\s\S]*?variant="select"/.test(screen) && /selected=\{measureKey === m\.key\}[\s\S]*?variant="select"/.test(screen)],
    ["Nutrition chart switcher uses the funnel checklist", screen.includes('accessibilityLabel={`Nutrition chart filter, ${chartKeys.length} charts shown`}') && screen.includes('animation="warp"') && screen.includes('accessibilityRole="switch"')],
    ["Nutrition chart switches use a white thumb in both states", screen.includes("thumbColor={colors.onPrimary}") && screen.includes("activeThumbColor: colors.onPrimary")],
    ["Nutrition chart switcher keeps one chart visible", screen.includes("checked && chartKeys.length === 1") && screen.includes("toggleRequiredKey(current, chart.key, NUTRITION_CHART_KEYS)")],
    ["Nutrition chart visibility follows checked keys", screen.includes("showMilkChart ?") && screen.includes("showFoodChart ?") && screen.includes("showMilkChart ? styles.trendChartDivider")],
    ["Milk measure label has no redundant prefix", !screen.includes("Milk · {activeMeasure.label}")],
    ["unit label clears the top y-axis value", chart.includes("const chartHeight = 216") && chart.includes("const padTop = 28")],
    ["seven-day threshold selects bars or lines", chart.includes("selectedDayCount > 7") && chart.includes("const lineMode") && chart.includes("!lineMode ? (")],
    ["dashed average line stays in bar mode", chart.includes('strokeDasharray="6 6"') && chart.includes("geometry.yFor(average)")],
    ["latest non-empty bar emphasized", chart.includes("point.value > 0 ? index : found") && chart.includes("bar.latest ? 1 : 0.68")],
    ["long ranges use Growth-style line treatment", chart.includes("LinearGradient") && chart.includes('strokeWidth={2.5}') && chart.includes('r={7}') && chart.includes('strokeDasharray={lineMode ? "4 4" : undefined}')],
    ["line spans the full plot width", chart.includes("leftPad + (index / (points.length - 1)) * plotW")],
    ["chart accessibility follows its visual type", chart.includes('lineMode ? "line chart" : "bar chart"')],
    ["theme-aware Milk and Food colors", screen.includes("color={colors.primary}") && screen.includes("color={colors.accent}")],
    ["legacy feeding pattern is removed", !screen.includes("const pattern =") && !screen.includes('title="Feeding Pattern"')],
];

let failed = 0;
for (const [name, ok] of checks) {
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}`);
    if (!ok) failed++;
}
console.log(failed ? `\n${failed} of ${checks.length} failed` : `\nall ${checks.length} passed`);
process.exit(failed ? 1 : 0);
