// Focused source contract. Run: node components/ui/NutritionDateFilter.check.js
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "NutritionDateFilter.js"), "utf8");
const checks = [
    ["Growth-style form padding", source.includes('form: { gap: space.md, paddingHorizontal: space.sm, paddingVertical: space.lg }')],
    ["quick actions stay on the form screen", source.indexOf("ACTIONS.map") > source.indexOf("!picker ?") && source.includes("picker && (!draft.preset")],
    ["picker uses a focused heading", source.includes('Choose a {pickerKind}.') && source.includes('picker === "from" ? "Starting" : "Ending"')],
];

let failed = 0;
for (const [name, ok] of checks) {
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}`);
    if (!ok) failed++;
}
console.log(failed ? `\n${failed} of ${checks.length} failed` : `\nall ${checks.length} passed`);
process.exit(failed ? 1 : 0);
