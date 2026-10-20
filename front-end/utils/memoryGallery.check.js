// Run: node utils/memoryGallery.check.js — immutable, in-memory records only.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const compile = file => transformSync(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const dates = { exports: {} };
new Function("module", "exports", compile("dates.js"))(dates, dates.exports);
const gallery = { exports: {} };
const categories = { exports: {} };
new Function("module", "exports", compile("milestoneChecklist.js"))(categories, categories.exports);
new Function("require", "module", "exports", compile("memoryGallery.js"))(name => name.endsWith("dates") ? dates.exports : categories.exports, gallery, gallery.exports);
const { memoryGalleryView, GALLERY_DEFAULTS } = gallery.exports;
const fixtures = Object.freeze([
    ...Array.from({ length: 12 }, (_, i) => Object.freeze({ id: String(i), kind: i % 2 ? "milestone" : "memory",
        date: `2026-06-${String(20 - i).padStart(2, "0")}`, title: `Moment ${i}`, description: i === 11 ? "First wave to Lola" : "A saved description" })),
    Object.freeze({ id: "same-date", kind: "memory", date: "2026-06-20", title: "Tie", description: "" }),
    Object.freeze({ id: "future", kind: "memory", date: "2029-02-28", title: "First Bike Ride", description: "Practiced pedaling with Papa." }),
    Object.freeze({ id: "old", kind: "milestone", date: "2025-11-18", title: "First smile", description: "A family moment" }),
    Object.freeze({ id: "missing", kind: "memory", date: "", title: "Undated photo" }),
    Object.freeze({ id: "invalid", kind: "milestone", date: "2026-02-31", title: "Invalid date" }),
]);
const original = JSON.stringify(fixtures);
const flattened = result => result.groups.flatMap(group => group.items);
let result = memoryGalleryView(fixtures);
assert.equal(result.total, 17);
assert.equal(result.remaining, 7);
assert.equal(flattened(result).length, 10);
assert.equal(flattened(result)[0], fixtures[13]);
assert.deepEqual(flattened(result).slice(1, 3), [fixtures[0], fixtures[12]], "Equal dates retain source order");
assert.deepEqual(result.counts, { all: 17, memory: 9, milestone: 8 });
assert.deepEqual(result.groups.map(group => group.label), ["February 2029", "June 2026"]);
result = memoryGalleryView(fixtures, { ...GALLERY_DEFAULTS, visible: 20 });
assert.equal(result.remaining, 0);
assert.equal(flattened(result).length, 17);
assert.equal(new Set(flattened(result).map(item => `${item.kind}-${item.id}`)).size, 17);
assert.deepEqual(flattened(result).slice(-2), [fixtures[15], fixtures[16]]);
assert.equal(result.groups.at(-1).label, "Undated");
result = memoryGalleryView(fixtures, { sort: "oldest", visible: 20 });
assert.equal(flattened(result)[0], fixtures[14]);
assert.deepEqual(result.groups.map(group => group.label), ["November 2025", "June 2026", "February 2029", "Undated"]);
assert.deepEqual(flattened(result).slice(-2), [fixtures[15], fixtures[16]], "Undated records stay last in both orders");
result = memoryGalleryView(fixtures, { query: "  FIRST   WAVE   to lola " });
assert.equal(result.total, 1, "Search includes descriptions beyond the first page");
assert.equal(flattened(result)[0], fixtures[11]);
assert.deepEqual(result.counts, { all: 17, memory: 9, milestone: 8 }, "Counts are collection totals");
assert.equal(memoryGalleryView(fixtures, { category: "memory", query: "First wave" }).total, 0);
assert.equal(memoryGalleryView(fixtures, { category: "milestone", query: "First wave" }).total, 1);
assert.equal(memoryGalleryView(fixtures, { query: "BIKE RIDE" }).total, 1);
assert.equal(memoryGalleryView(fixtures, { query: "   " }).total, 17);
assert.equal(memoryGalleryView(fixtures, { query: "no such record" }).groups.length, 0);
for (const category of ["memory", "milestone"]) {
    result = memoryGalleryView(fixtures, { category, visible: 100 });
    assert(flattened(result).every(record => record.kind === category));
    assert.equal(result.total, result.counts[category]);
}
assert.deepEqual(memoryGalleryView([]), { counts: { all: 0, memory: 0, milestone: 0 }, groups: [], total: 0, remaining: 0 });
assert.equal(JSON.stringify(fixtures), original, "Search, sort, groups and pagination never mutate records");
const categorized = Object.freeze([
    Object.freeze({ id: "saved", kind: "memory", title: "Moment", date: "2026-06-01", developmentCategory: "social" }),
    Object.freeze({ id: "legacy", kind: "milestone", title: "  SITS  without support ", date: "2026-06-02" }),
    Object.freeze({ id: "override", kind: "milestone", title: "Sits without support", date: "2026-06-03", developmentCategory: "language" }),
    Object.freeze({ id: "unknown", kind: "milestone", title: "A unique family moment", date: "" }),
    Object.freeze({ id: "photo", kind: "memory", title: "Sits without support", date: "" }),
]);
assert.deepEqual(flattened(memoryGalleryView(categorized, { developmentCategory: "motor" })).map(item=>item.id), ["legacy"]);
assert.deepEqual(flattened(memoryGalleryView(categorized, { developmentCategory: "language" })).map(item=>item.id), ["override"]);
assert.equal(memoryGalleryView(categorized, { developmentCategory: "social", category: "milestone" }).total,0);
assert.equal(memoryGalleryView(categorized, { developmentCategory: "social", query: "moment" }).total,1);
assert.equal(memoryGalleryView(categorized, { developmentCategory: "uncategorized" }).total,2);
assert.equal(memoryGalleryView(categorized, { developmentCategory: "cognitive" }).total,0);
for(const domain of categories.exports.DOMAINS){
    assert.equal(categories.exports.resolveDevelopmentCategory({developmentCategory:domain.key},"memory"),domain.key);
    assert.equal(categories.exports.developmentCategoryLabel({developmentCategory:domain.key},"memory"),domain.label);
}
assert.equal(categories.exports.milestoneDomain("First steps"),"");
assert.equal(categories.exports.developmentCategoryLabel({title:"Unknown"},"milestone"),"Not categorized");
console.log("Gallery selector passed: full-collection search, combined categories, stable chronological sorts, undated handling, ten-record pages, counts and immutable original data.");
