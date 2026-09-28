// Focused source contract. Run: node components/ui/NutritionDateFilter.check.js
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "NutritionDateFilter.js"), "utf8");
const checks = [
    ["first visit defaults to a rolling seven-day custom range", source.includes("start.getDate() - 6") && source.includes("dateRange: { from, to: today }") && source.includes("preset: null")],
    ["rolling range clamps to the child's birth date", source.includes("minimumDate > rollingFrom") && source.includes("minimumDate <= today")],
    ["saved child view still wins", source.indexOf("saved?.dateRange?.from") < source.indexOf("start.getDate() - 6")],
    ["Growth-style form padding", source.includes('form: { gap: space.md, paddingHorizontal: space.sm, paddingVertical: space.lg }')],
    ["quick actions stay on the form screen", source.indexOf("ACTIONS.map") > source.indexOf("!picker ?")],
    ["week picker uses a 2x2 grid", source.includes('style={styles.weekGridButton}') && source.includes('weekGridButton: { width: "50%" }')],
    ["picker uses a focused heading", source.includes('Choose a {pickerKind}.') && source.includes('picker === "from" ? "Starting" : "Ending"')],
    ["date inputs use the centered wheel modal", source.includes("dateWheelEndpoint") && source.includes("<DateWheelPicker")],
    ["date wheel receives record-bearing dates", source.includes("availableDates={availableDates}")],
    ["trigger sizes to its label instead of filling the chart controls", source.includes('maxWidth: "100%", flexShrink: 1') && !source.includes("trigger: { minHeight: MIN_TOUCH, flex: 1")],
];

let failed = 0;
for (const [name, ok] of checks) {
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}`);
    if (!ok) failed++;
}
console.log(failed ? `\n${failed} of ${checks.length} failed` : `\nall ${checks.length} passed`);
process.exit(failed ? 1 : 0);
