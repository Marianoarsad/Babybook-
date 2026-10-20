import { PALETTES, DARK_PALETTES, colors, paletteFor, themeKeyFor } from "../theme.js";
import fs from "node:fs";

const checks = [
    ["legacy default uses official blue", colors === PALETTES.boy],
    ["neutral mode remains compatible", themeKeyFor(undefined) === "neutral" && themeKeyFor("Female", "neutral") === "neutral"],
    ["Sofia uses the girl theme", themeKeyFor("Female", "auto") === "girl"],
    ["Elias uses the boy theme", themeKeyFor("Male", "auto") === "boy"],
    ["gender values are normalized", themeKeyFor(" FEMALE ") === "girl"],
    ["manual overrides still win", paletteFor("Female", "boy") === PALETTES.boy],
];

for (const scheme of ["light", "dark"]) {
    const palettes = scheme === "dark" ? DARK_PALETTES : PALETTES;
    checks.push(
        [`${scheme} neutral branding reuses every Boy token`, palettes.neutral === palettes.boy],
        [`${scheme} missing gender defaults to blue`, paletteFor(undefined, "auto", scheme) === palettes.boy],
        [`${scheme} unknown gender defaults to blue`, paletteFor("Other", "auto", scheme) === palettes.boy],
        [`${scheme} saved neutral override resolves to blue`, paletteFor("Female", "neutral", scheme) === palettes.boy],
        [`${scheme} automatic Girl theme stays pink`, paletteFor("Female", "auto", scheme) === palettes.girl],
        [`${scheme} automatic Boy theme stays blue`, paletteFor("Male", "auto", scheme) === palettes.boy],
        [`${scheme} manual Girl override still wins`, paletteFor("Male", "girl", scheme) === palettes.girl],
    );
}

for (const gender of ["girl", "boy", "neutral"]) {
    for (const scheme of ["light", "dark"]) {
        const palette = paletteFor(undefined, gender, scheme);
        checks.push([
            `${gender}/${scheme} connected metric glass stays azure and translucent`,
            palette.growthDropdownGlass.accent === palette.appointmentDashboard.azure
                && palette.growthDropdownGlass.popoverPanel.every(color => /^rgba\(.+,0\.\d+\)$/.test(color))
                && palette.growthDropdownGlass.selected.length === 2,
        ]);
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
checks.push(["Growth selector uses its scoped glass material", metricSelect.includes("colors.growthDropdownGlass.panelShadow")
    && growthChart.includes("colors.growthDropdownGlass.popoverPanel")]);

let failed = 0;
for (const [label, pass] of checks) {
    if (!pass) {
        failed += 1;
        console.error(`FAIL ${label}`);
    }
}
if (failed) process.exitCode = 1;
else console.log(`${checks.length} passed, 0 failed`);
