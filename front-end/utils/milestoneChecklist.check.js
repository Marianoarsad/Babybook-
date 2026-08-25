// Self-check for utils/milestoneChecklist.js. Run:
//   node utils/milestoneChecklist.check.js
// Mirrors dates.check.js / feedingStats.check.js — plain assertions.
const fs = require("fs");
const path = require("path");

const src = fs
    .readFileSync(path.join(__dirname, "milestoneChecklist.js"), "utf8")
    .replace(/export (function|const)/g, "$1");
const M = new Function(
    `${src}\nreturn { AGE_CHECKLISTS, CHECKPOINTS, DOMAINS, normalizeTitle, findRecorded,
                      suggestedTitles, checkpointFor, bandLabel, itemsForCheckpoint };`,
)();

let fail = 0;
let ran = 0;
const eq = (name, got, want) => {
    ran++;
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) fail++;
    console.log(
        `${ok ? "ok  " : "FAIL"}  ${name}  got=${JSON.stringify(got)}${ok ? "" : ` want=${JSON.stringify(want)}`}`,
    );
};

// ---- normalizeTitle ----
eq("normalize trims", M.normalizeTitle("  First Steps  "), "first steps");
eq("normalize collapses inner spaces", M.normalizeTitle("First   Steps"), "first steps");
eq("normalize lowercases", M.normalizeTitle("FIRST STEPS"), "first steps");
eq("normalize handles null", M.normalizeTitle(null), "");
eq("normalize handles undefined", M.normalizeTitle(undefined), "");

// ---- findRecorded ----
const recorded = [
    { id: "1", title: "Laughs" },
    { id: "2", title: "  rolls from tummy to back " },
    { id: "3", title: "First Steps" },
];
eq("finds an exact title", M.findRecorded(recorded, "First Steps").id, "3");
eq("finds through case and spacing", M.findRecorded(recorded, "Rolls from tummy to back").id, "2");
eq("returns undefined when absent", M.findRecorded(recorded, "Crawling"), undefined);
eq("blank title matches nothing", M.findRecorded(recorded, "   "), undefined);
eq("empty list matches nothing", M.findRecorded([], "Laughs"), undefined);
eq("missing list does not throw", M.findRecorded(undefined, "Laughs"), undefined);
// normalizeTitle("") is "", and a bare `find` on "" would match the first
// untitled record rather than none.
eq("untitled records are not matched", M.findRecorded([{ id: "x", title: "" }], ""), undefined);

// ---- checkpointFor: which age band a child belongs in ----
eq("exact checkpoint picks itself", M.checkpointFor(18), 18);
eq("between checkpoints rounds down", M.checkpointFor(20), 18);
eq("just under a checkpoint stays below", M.checkpointFor(23), 18);
eq("newborn lands on the first band", M.checkpointFor(0), 2);
eq("below the first checkpoint still lands on it", M.checkpointFor(1), 2);
eq("past the last checkpoint clamps to it", M.checkpointFor(72), 60);
eq("exactly the last checkpoint", M.checkpointFor(60), 60);
// A missing date of birth must not throw or land somewhere arbitrary.
eq("non-numeric age falls back to the first band", M.checkpointFor(null), 2);
eq("NaN falls back to the first band", M.checkpointFor(NaN), 2);

// ---- bandLabel ----
eq("months band reads in months", M.bandLabel(18), "18 months");
eq("two years reads in years", M.bandLabel(24), "2 years");
eq("five years reads in years", M.bandLabel(60), "5 years");
eq("every checkpoint gets a label", M.CHECKPOINTS.every((c) => !!M.bandLabel(c)), true);

// ---- itemsForCheckpoint ----
const band18 = M.itemsForCheckpoint(18);
eq("a band returns only its own items", band18.every((i) => i.months === 18), true);
eq("every checkpoint has at least one item",
    M.CHECKPOINTS.every((c) => M.itemsForCheckpoint(c).length > 0), true);
// Groups must always appear in the same order, or the screen reshuffles
// between age bands.
const domainOrder = M.DOMAINS.map((d) => d.key);
const seen18 = [...new Set(band18.map((i) => i.domain))];
eq("items come back in DOMAINS order",
    seen18, domainOrder.filter((d) => seen18.includes(d)));

// ---- suggestedTitles: age-aware chips ----
// Against a ~150-item corpus, an age-blind list would offer newborn milestones
// to a four-year-old. Suggestions come from the child's band and the one before.
const at48 = M.suggestedTitles([], 48, 6);
eq("suggestions are drawn from the child's own age",
    at48.every((t) => {
        const item = M.AGE_CHECKLISTS.find((c) => c.title === t);
        return item.months === 48 || item.months === 36;
    }), true);
eq("suggestions respect the limit", M.suggestedTitles([], 48, 3).length, 3);
eq("a newborn gets the earliest band", M.suggestedTitles([], 1, 3).every((t) =>
    M.AGE_CHECKLISTS.find((c) => c.title === t).months === 2), true);
eq("an already-recorded title drops out",
    M.suggestedTitles([{ title: "catches a large ball most of the time" }], 48, 20)
        .includes("Catches a large ball most of the time"), false);
eq("missing list does not throw", M.suggestedTitles(undefined, 48, 3).length, 3);
eq("missing age does not throw", M.suggestedTitles([], undefined, 3).length, 3);

// ---- corpus integrity ----
// A malformed data file is the main risk in a 150-item hand-written corpus,
// and every failure mode below is silent in the UI.
const ids = M.AGE_CHECKLISTS.map((c) => c.id);
eq("ids are unique", new Set(ids).size, ids.length);
eq("every item has a title", M.AGE_CHECKLISTS.every((c) => !!String(c.title || "").trim()), true);
eq("every domain is a real domain",
    M.AGE_CHECKLISTS.every((c) => domainOrder.includes(c.domain)), true);
eq("every months value is a real checkpoint",
    M.AGE_CHECKLISTS.every((c) => M.CHECKPOINTS.includes(c.months)), true);
// Two items sharing a title would make one box tick the other's record —
// findRecorded matches on title alone, so this must hold across the corpus.
const titles = M.AGE_CHECKLISTS.map((c) => M.normalizeTitle(c.title));
eq("titles are unique once normalized", new Set(titles).size, titles.length);
eq("every domain has an icon and a tint",
    M.DOMAINS.every((d) => !!d.icon && !!d.tint && !!d.label), true);
eq("checkpoints are sorted ascending",
    M.CHECKPOINTS.every((c, i) => i === 0 || c > M.CHECKPOINTS[i - 1]), true);

console.log(`\ncorpus: ${M.AGE_CHECKLISTS.length} items across ${M.CHECKPOINTS.length} checkpoints`);
console.log(fail ? `${fail} of ${ran} failed` : `all ${ran} passed`);
process.exit(fail ? 1 : 0);
