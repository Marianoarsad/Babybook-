// SQL double only: no environment file, credentials or database connection.
const assert = require("node:assert/strict"), fs = require("node:fs");
let rows, serial, writes, missingAccount, wrongProfiles, missingColumn, failChild;
const children = [{ id: 106, first_name: "Elias", last_name: "Rivera", date_of_birth: "2026-02-14" },
    { id: 107, first_name: "Sofia", last_name: "Rivera", date_of_birth: "2025-11-14" }];
const original = [
    { id: 1, child_id: 106, food_introduced: "Existing food", entry_date: "2026-08-16", notes: "Existing notes" },
    { id: 2, child_id: 107, food_introduced: "Beef nilaga and rice", entry_date: "2026-05-16", notes: null },
    { id: 3, child_id: 107, food_introduced: "Shrimp", entry_date: "2026-09-27", reaction_severity: "severe", reaction: "Original symptoms", notes: null },
    { id: 4, child_id: 999, food_introduced: "Another account", entry_date: "2026-01-01", notes: "Untouched" },
];
const crypt = { encrypt: value => value == null ? value : "enc:v1:" + value,
    decrypt: value => value === "enc:v1:unreadable" ? value : typeof value === "string" ? value.replace(/^enc:v1:/, "") : value,
    isEncrypted: value => typeof value === "string" && value.startsWith("enc:v1:") };
function reset() { rows = structuredClone(original); serial = 10; writes = 0; missingAccount = wrongProfiles = missingColumn = false; failChild = null; }
const client = { async query(sql, values) {
    if (sql.startsWith("SELECT id FROM users")) { assert.deepEqual(values, ["demo.parent@babybookplus.app"]); return { rows: missingAccount ? [] : [{ id: 99 }] }; }
    if (sql.startsWith("SELECT id, first_name")) { assert.deepEqual(values, [99]); return { rows: wrongProfiles ? [children[0]] : children }; }
    if (sql.includes("information_schema")) return { rows: [{ present: !missingColumn }] };
    if (sql.startsWith("SELECT id, food_introduced")) { assert(sql.includes("child_id=$1 AND entry_type='solid'")); return { rows: rows.filter(row => row.child_id === values[0]) }; }
    writes++;
    const updating = sql.startsWith("UPDATE"), childId = values[updating ? 8 : 0];
    assert([106, 107].includes(childId));
    if (childId === failChild) throw Error("Injected second-profile failure");
    const fields = values.slice(updating ? 0 : 1, updating ? 7 : 8);
    const [food_introduced, food_category, reaction_severity, reaction, entry_date, entry_time, notes] = fields;
    assert(crypt.isEncrypted(food_introduced) && crypt.isEncrypted(notes));
    assert.equal(reaction_severity, "none"); assert.equal(reaction, null);
    let row;
    if (updating) {
        assert(sql.includes("WHERE id=$8 AND child_id=$9 AND entry_type='solid'"));
        row = rows.find(row => row.id === values[7] && row.child_id === childId); assert(row);
    } else {
        assert(sql.startsWith("INSERT INTO nutrition_records"));
        row = { id: serial++, child_id: childId }; rows.push(row);
    }
    Object.assign(row, { food_introduced, food_category, reaction_severity, reaction, entry_date, entry_time, notes });
    return { rows: [{ id: row.id }] };
} };
const poolModule = { pool: {}, withTransaction: async fn => {
    const before = structuredClone(rows); try { return await fn(client); } catch (error) { rows = before; throw error; }
} };
function load(file, extra = {}) {
    const module = { exports: {} };
    new Function("require", "module", "exports", fs.readFileSync(__dirname + "/" + file, "utf8"))(name => {
        if (name === "dotenv") return { config() {} };
        if (name === "./pool") return poolModule;
        if (name === "../utils/crypto") return crypt;
        if (name in extra) return extra[name];
        throw Error(name);
    }, module, module.exports);
    return module.exports;
}
const helpers = load("seedMilkTypeDemo.js"), S = load("seedSolidFoodDemo.js", { "./seedMilkTypeDemo": helpers }), today = "2026-10-16";
async function main() {
    reset(); const samples = S.buildSolidFoodEntries(today), recent = samples.filter(row => row.entry_date >= "2026-10-10");
    assert.equal(samples.length, 52); assert.equal(recent.length, 34);
    assert.deepEqual(Array.from({ length: 7 }, (_, i) => recent.filter(row => row.entry_date === helpers.shiftDay(today, i - 6)).length), [4, 6, 5, 3, 7, 4, 5]);
    assert.deepEqual(S.CATEGORIES.map(c => recent.filter(row => row.food_category === c).length), [8, 7, 5, 6, 5, 3]);
    assert.deepEqual(S.CATEGORIES.map(c => samples.filter(row => row.food_category === c).length), [11, 10, 8, 9, 8, 6]);
    assert.equal(new Set(samples.map(row => row.notes)).size, 52);
    assert(samples.every(row => row.entry_date <= today && row.reaction_severity === "none" && row.reaction === null));
    assert.throws(() => S.buildSolidFoodEntries("2026-02-30"));
    const first = await S.seedSolidFoodDemo(today); assert(first.profiles.every(p => p.inserted === 52));
    assert.equal(rows.length, original.length + 104); assert.deepEqual(rows.slice(0, original.length), original);
    const after = JSON.stringify(rows); writes = 0;
    const repeat = await S.seedSolidFoodDemo(today); assert(repeat.profiles.every(p => p.unchanged === 52)); assert.equal(writes, 0); assert.equal(JSON.stringify(rows), after);
    const next = await S.seedSolidFoodDemo("2026-10-17"); assert(next.profiles.every(p => p.updated === 52)); assert.equal(rows.length, original.length + 104); assert.deepEqual(rows.slice(0, original.length), original);
    for (const flag of ["account", "profiles", "column"]) {
        reset(); missingAccount = flag === "account"; wrongProfiles = flag === "profiles"; missingColumn = flag === "column";
        await assert.rejects(() => S.seedSolidFoodDemo(today)); assert.equal(writes, 0); assert.deepEqual(rows, original);
    }
    reset(); rows[0].entry_date = "2026-09-01"; await assert.rejects(() => S.seedSolidFoodDemo(today)); assert.equal(writes, 0);
    reset(); await assert.rejects(() => S.seedSolidFoodDemo("2026-03-01")); assert.equal(writes, 0);
    reset(); failChild = 107; await assert.rejects(() => S.seedSolidFoodDemo(today)); assert.deepEqual(rows, original, "Both profiles roll back atomically");
    reset(); rows.push({ ...original[0], id: 5, notes: "enc:v1:unreadable" }); await assert.rejects(() => S.seedSolidFoodDemo(today)); assert.equal(writes, 0);
    for (const marker of ["001", "000", "053", "bad"]) {
        reset(); rows.push({ ...original[0], id: 5, notes: `[solid-chart-demo:v1:${marker}] Sample` });
        if (marker === "001") rows.push({ ...original[0], id: 6, notes: `[solid-chart-demo:v1:${marker}] Duplicate` });
        await assert.rejects(() => S.seedSolidFoodDemo(today)); assert.equal(writes, 0);
    }
    console.log("Solid Food demo checks passed: 52 samples per profile, six categories, calendar dates/totals, encryption, identity/schema/milestone guards, preservation, idempotency and rollback.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
