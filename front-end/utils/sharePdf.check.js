// node utils/sharePdf.check.js — fictional records and mocked printing only.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { transformSync } = require("@babel/core");
function load(file, overrides = {}) {
    const filename = path.resolve(__dirname, file); if (filename.endsWith(".cjs")) return require(filename);
    const module = { exports: {} }, code = transformSync(fs.readFileSync(filename, "utf8"), { babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"] }).code;
    new Function("require", "module", "exports", code)(name => name in overrides ? overrides[name] : load(path.resolve(path.dirname(filename), name + (path.extname(name) ? "" : ".js")), overrides), module, module.exports);
    return module.exports;
}
const { buildRecordHtml, CATEGORY_LABELS } = load("pdfTemplate.js");
const profile = { id: "fixture", name: "PRIVATE CHILD", dateOfBirth: "2026-01-02", sex: "PRIVATE SEX", hospital: "PRIVATE HOSPITAL", allergies: ["PRIVATE ALLERGY"], hereditaryConditions: ["PRIVATE HEREDITARY"] };
const records = { vaccinations: [{ vaccine_name: "VACCINATION ONLY" }], checkups: [{ title: "CHECKUP ONLY" }], growth: [{ height: 61, weight: 6 }], milestones: [{ title: "MILESTONE ONLY" }], nutrition: [{ entry_type: "solid", food_introduced: "NUTRITION ONLY" }], medicalHistory: [{ category: "Illness", title: "ILLNESS ONLY" }, { category: "Allergy", title: "ALLERGY ONLY", allergy_type: "food" }] };
const before = JSON.stringify({ profile, records });
for (const key of Object.keys(CATEGORY_LABELS)) {
    const html = buildRecordHtml(profile, records, { scope: new Set([key]), visitReason: '  Test <script>alert("x")</script>\nSecond line  ' });
    assert(html.includes("Reason for Visit") && html.includes("&lt;script&gt;") && !html.includes("<script>"));
    assert.equal(html.includes("PRIVATE CHILD"), key === "profile");
    assert.equal(html.includes("PRIVATE SEX"), key === "profile"); assert.equal(html.includes("Date of Birth:"), key === "profile");
    assert.equal(html.includes("PRIVATE ALLERGY"), key === "allergies");
    assert.equal(html.includes("ILLNESS ONLY"), key === "medicalHistory");
    for (const [category, marker] of [["vaccinations", "VACCINATION ONLY"], ["checkups", "CHECKUP ONLY"], ["milestones", "MILESTONE ONLY"], ["nutrition", "NUTRITION ONLY"]]) assert.equal(html.includes(marker), key === category);
}
assert(!buildRecordHtml(profile, {}, { scope: new Set(), visitReason: "  " }).includes("Reason for Visit"));
assert.throws(() => buildRecordHtml(profile, {}, { visitReason: "x".repeat(501) }), /500/);
assert.equal(JSON.stringify({ profile, records }), before);
async function check() {
    let reads = [], printed = [], shared = [], failed;
    const overrides = { "react-native": { Platform: { OS: "web" } }, "./api": { api: { listRecords: async (id, resource, options) => {
        assert.equal(id, "fixture"); assert.equal(options.confirmedOnly, true); reads.push(resource); if (resource === failed) throw Error("selected read failed"); return [];
    } } }, "expo-print": { printAsync: async value => printed.push(value), printToFileAsync: async value => { printed.push(value); return { uri: "fixture.pdf" }; } },
        "expo-sharing": { isAvailableAsync: async () => true, shareAsync: async (...args) => shared.push(args) } };
    const pdf = load("exportPdf.js", overrides);
    const expected = { profile: [], allergies: ["medical-history"], vaccinations: ["vaccinations"], checkups: ["checkups"], growth: ["growth"], milestones: ["milestones"], nutrition: ["nutrition", "milk-type-periods"], medicalHistory: ["medical-history"] };
    for (const key of Object.keys(CATEGORY_LABELS)) {
        reads = []; await pdf.exportChildRecordsPdf(profile, { scope: new Set([key]), visitReason: "PDF visit note" });
        assert.deepEqual(reads, expected[key]); assert(printed.at(-1).html.includes("PDF visit note"));
    }
    reads = []; await pdf.exportChildRecordsPdf(profile); assert.equal(reads.length, 7, "Existing unscoped callers retain all records");
    failed = "growth"; const count = printed.length;
    await assert.rejects(pdf.exportChildRecordsPdf(profile, { scope: new Set(["growth"]) }), /selected read failed/); assert.equal(printed.length, count);
    reads = []; await pdf.exportChildRecordsPdf(profile, { scope: new Set(["vaccinations"]) }); assert.deepEqual(reads, ["vaccinations"]);
    overrides["react-native"].Platform.OS = "ios";
    await pdf.exportChildRecordsPdf(profile, { scope: new Set(["vaccinations"]) }); assert.equal(shared.at(-1)[1].dialogTitle, "BabyBook+ records");
    console.log("PDF sharing checks passed: independent category scope, excluded identity, selected-only confirmed reads, escaped/bounded visit notes, legacy callers, failed reads, neutral native title and data preservation.");
}
check().catch(error => { console.error(error); process.exitCode = 1; });
