// Cross-check: which demo-seed milestone titles tick a Development Checklist
// box? Run: node utils/seedMatch.check.js
//
// This exists because the failure it catches is invisible. The checklist
// matches a recorded milestone to a reference item BY TITLE, and matching is
// case- and spacing-insensitive but never fuzzy. A seed title one word off —
// "Rolled Over" against the checklist's "Rolls Over" — ticks nothing, silently,
// and the demo account shows a screen of empty checkboxes beside a gallery full
// of achieved milestones. That shipped once.
//
// It also guards something subtler: the Milestones tab opens on the child's own
// age band, so the demo needs ticks IN THAT BAND specifically. Ticks spread
// across bands the reviewer never lands on prove nothing.
//
// Unlike the other .check.js files this one reads across the front-end/back-end
// boundary, because the thing being checked spans it.
const fs = require("fs");
const path = require("path");

const SEED = path.join(__dirname, "../../back-end/src/db/seedDemoYear.js");

const src = fs
    .readFileSync(path.join(__dirname, "milestoneChecklist.js"), "utf8")
    .replace(/export (function|const)/g, "$1");
const M = new Function(`${src}\nreturn { AGE_CHECKLISTS, normalizeTitle, bandLabel };`)();

if (!fs.existsSync(SEED)) {
    console.log(`skip  seed not found at ${SEED}`);
    process.exit(0);
}
const seed = fs.readFileSync(SEED, "utf8");
const start = seed.indexOf("const milestoneRows = [");
const block = seed.slice(start, seed.indexOf("];", start));

// The first quoted string of each row is the title. Rows use double or single
// quotes depending on whether the title itself contains a quote.
const titles = [];
for (const line of block.split("\n")) {
    const m = line.match(/^\s*\[\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,/);
    if (m) titles.push((m[1] !== undefined ? m[1] : m[2]).replace(/\\"/g, '"'));
}

const byTitle = new Map(M.AGE_CHECKLISTS.map((c) => [M.normalizeTitle(c.title), c]));
const bands = {};
let matched = 0;
for (const t of titles) {
    const hit = byTitle.get(M.normalizeTitle(t));
    if (hit) {
        matched++;
        bands[hit.months] = (bands[hit.months] || 0) + 1;
        console.log(`ticks  ${M.bandLabel(hit.months).padEnd(14)} ${t}`);
    } else {
        console.log(`free   ${"".padEnd(14)} ${t}`);
    }
}

let fail = 0;
const assert = (name, ok) => {
    if (!ok) fail++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}`);
};

console.log("");
assert("the seed defines milestones at all", titles.length > 0);
assert("some seeded milestones tick a checklist box", matched > 0);
// The demo child is about a year old, so 12 months is the band the Milestones
// tab opens on. Ticks anywhere else do not demonstrate that matching works.
assert("the 12-month band has at least one tick", (bands[12] || 0) > 0);
// Free-text milestones are the half of the feature the checklist cannot reach
// (CDC 2022 dropped crawling entirely, for instance). The demo must show both.
assert("some seeded milestones are free text", matched < titles.length);

console.log(`\n${titles.length} seeded milestones, ${matched} tick a box`);
console.log("ticks per band:", JSON.stringify(bands));
console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
