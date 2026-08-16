// Self-check for utils/commonConditions.js. Run: node utils/commonConditions.check.js
// Mirrors utils/milestoneChecklist.check.js — plain assertions, no test framework.
const fs = require("fs");
const path = require("path");
const src = fs
    .readFileSync(path.join(__dirname, "commonConditions.js"), "utf8")
    .replace(/export function/g, "function")
    .replace(/export const/g, "const");
const M = new Function(`${src}\nreturn { COMMON_CONDITIONS, normalizeTitle, suggestedConditions };`)();

let fail = 0;
let ran = 0;
const eq = (name, got, want) => {
    ran++;
    const ok = got === want;
    if (!ok) fail++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}  got=${JSON.stringify(got)}${ok ? "" : ` want=${JSON.stringify(want)}`}`);
};

// ---- the list itself ----
eq("list is not empty", M.COMMON_CONDITIONS.length > 0, true);
const norms = M.COMMON_CONDITIONS.map(M.normalizeTitle);
eq("no duplicates in the list", new Set(norms).size, M.COMMON_CONDITIONS.length);
eq("no blank entries", norms.every((n) => n.length > 0), true);
// Chips render in a wrapped row under an input box; a long one pushes the
// field off screen on a phone.
eq("every entry fits on a chip", M.COMMON_CONDITIONS.every((c) => c.length <= 32), true);

// ---- normalizeTitle ----
eq("normalize trims", M.normalizeTitle("  Fever  "), "fever");
eq("normalize collapses whitespace", M.normalizeTitle("Sore   throat"), "sore throat");
eq("normalize lowercases", M.normalizeTitle("COUGH"), "cough");
eq("normalize handles null", M.normalizeTitle(null), "");
eq("normalize handles undefined", M.normalizeTitle(undefined), "");

// ---- suggestedConditions ----
const plain = M.suggestedConditions([], 8);
eq("suggests up to the limit", plain.length, 8);
eq("falls back to the common list", plain[0], M.COMMON_CONDITIONS[0]);

// The child's own history leads. A parent whose child has asthma is typing
// "Asthma" again, not scrolling for it.
const withHistory = M.suggestedConditions([{ title: "Asthma" }, { title: "Ear infection" }], 8);
eq("previous conditions come first", withHistory[0], "Asthma");
eq("previous conditions keep their order", withHistory[1], "Ear infection");
eq("common ones fill the rest", withHistory.length, 8);

// Asthma is in COMMON_CONDITIONS too — it must not appear twice.
eq("no duplicate when a previous is also common", withHistory.filter((c) => c === "Asthma").length, 1);
// ...including when the parent's spelling differs only in case or spacing.
const cased = M.suggestedConditions([{ title: "  fever " }], 8);
eq("dedupes across case and spacing", cased.filter((c) => M.normalizeTitle(c) === "fever").length, 1);
eq("keeps the parent's own wording", cased[0], "fever");

// Accepts bare strings as well as record objects, so a caller does not have to
// reshape its list first.
eq("accepts plain strings", M.suggestedConditions(["Dengue"], 3)[0], "Dengue");

// Junk in a real record list must not produce a blank chip.
const messy = M.suggestedConditions([{ title: "" }, { title: null }, null, { notATitle: "x" }], 4);
eq("skips blank and malformed entries", messy.every((c) => c && c.length > 0), true);
eq("still fills to the limit after skipping junk", messy.length, 4);

eq("limit of zero yields nothing", M.suggestedConditions([{ title: "Fever" }], 0).length, 0);
eq("no arguments still works", M.suggestedConditions().length, 8);

console.log(fail ? `\n${fail} of ${ran} failed` : `\nall ${ran} passed`);
process.exit(fail ? 1 : 0);
