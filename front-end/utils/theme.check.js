import { PALETTES, paletteFor, themeKeyFor } from "../theme.js";

const checks = [
    ["Sofia uses the girl theme", themeKeyFor("Female", "auto") === "girl"],
    ["Elias uses the boy theme", themeKeyFor("Male", "auto") === "boy"],
    ["gender values are normalized", themeKeyFor(" FEMALE ") === "girl"],
    ["manual overrides still win", paletteFor("Female", "boy") === PALETTES.boy],
];

let failed = 0;
for (const [label, pass] of checks) {
    if (!pass) {
        failed += 1;
        console.error(`FAIL ${label}`);
    }
}
if (failed) process.exitCode = 1;
else console.log(`${checks.length} passed, 0 failed`);
