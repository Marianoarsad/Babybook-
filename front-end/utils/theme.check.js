import { PALETTES, paletteFor, themeKeyFor } from "../theme.js";
import fs from "node:fs";

const checks = [
    ["Sofia uses the girl theme", themeKeyFor("Female", "auto") === "girl"],
    ["Elias uses the boy theme", themeKeyFor("Male", "auto") === "boy"],
    ["gender values are normalized", themeKeyFor(" FEMALE ") === "girl"],
    ["manual overrides still win", paletteFor("Female", "boy") === PALETTES.boy],
];

for (const gender of ["girl", "boy", "neutral"]) {
    for (const scheme of ["light", "dark"]) {
        const palette = paletteFor(undefined, gender, scheme);
        checks.push([
            `${gender}/${scheme} growth charts use the theme ramp`,
            palette.growthMetric.weight === palette.primary
                && palette.growthMetric.height === palette.accent
                && palette.growthMetric.head === palette.primaryDark,
        ]);
        checks.push([
            `${gender}/${scheme} nutrition mix has four distinct theme colors`,
            palette.nutritionMix.breastmilk === palette.primary
                && new Set(Object.values(palette.nutritionMix)).size === 4,
        ]);
    }
}

const growthChart = fs.readFileSync(new URL("../components/GrowthChart.js", import.meta.url), "utf8");
const metricSelect = growthChart.slice(growthChart.indexOf("metricSelect:"), growthChart.indexOf("metricSelectText:"));
checks.push(["Home growth filter uses the theme surface", metricSelect.includes("backgroundColor: colors.surface,")]);

let failed = 0;
for (const [label, pass] of checks) {
    if (!pass) {
        failed += 1;
        console.error(`FAIL ${label}`);
    }
}
if (failed) process.exitCode = 1;
else console.log(`${checks.length} passed, 0 failed`);
