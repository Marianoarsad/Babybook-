// Unit contracts only; no database, environment file or real records.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), express = require("express");
const read = file => fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
const resources = [], guards = [];
const router = { use(...args) { guards.push(args); } }, moduleRoutes = { exports: {} };
const auth = () => {}, owner = () => {};
new Function("require", "module", "exports", read("routes/records.routes.js"))(name => {
    if (name === "express") return { Router: () => router };
    if (name === "../middleware/error") return require("../src/middleware/error");
    if (name === "../middleware/auth") return { requireAuth: auth, requireChildOwnership: owner };
    if (name === "../utils/numericValidation") return require("../src/utils/numericValidation");
    if (name === "../utils/memoryFields") return require("../src/utils/memoryFields");
    if (name === "../utils/resource") return { createResourceRouter: config => { resources.push(config); return express.Router(); } };
    throw Error(name);
}, moduleRoutes, moduleRoutes.exports);
const resource = resources.find(r => r.path === "milk-type-periods"), route = guards.find(r => r[0].endsWith("/milk-type-periods"));
assert.deepEqual(route.slice(1, 3), [auth, owner]);
assert.deepEqual(resource.encrypted, ["notes"]);
assert.deepEqual(resource.columns, ["milk_type", "start_date", "end_date", "notes"]);
const valid = { milk_type: "Formula", start_date: "2026-10-15", end_date: null, notes: "Saved note" };
resource.validate(valid, { isCreate: true }); resource.validate({ notes: "Edited" }, { isCreate: false });
for (const delta of [{ milk_type: "Other" }, { milk_type: null }, { start_date: null }, { start_date: "2026-02-30" },
    { end_date: "" }, { end_date: "2026-10-14" }, { notes: {} }]) {
    assert.throws(() => resource.validate({ ...valid, ...delta }, { isCreate: true }), e => e.status === 400);
}
for (const data of [{ milk_type: null }, { start_date: "" }, { end_date: "bad" }]) assert.throws(() => resource.validate(data, { isCreate: false }), e => e.status === 400);
const migration = read("db/migrations/020_milk_type_periods.sql"), schema = read("db/schema.sql"), generic = read("utils/resource.js");
assert(!/\bDROP\b|INSERT INTO|UPDATE nutrition_records/i.test(migration), "No historical backfill or destructive schema change");
assert(migration.includes("end_date >= start_date") && migration.includes("ON DELETE CASCADE"));
assert(migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("REVOKE ALL ON SEQUENCE"));
assert(schema.replace(/\r/g, "").includes(migration.trim().replace(/\r/g, "")));
assert(generic.includes("createOnce(") && generic.includes("AND child_id ="), "Existing receipt and child-scoped CRUD pipeline reused");
// This process uses a fictional key only; it never loads .env or opens a DB.
process.env.DATA_ENCRYPTION_KEY = "milk-period-test-key-only";
const crypto = require("../src/utils/crypto"), notes = crypto.encrypt("Fictional period note");
const queries = [], snapshotModule = { exports: {} };
new Function("require", "module", "exports", read("utils/snapshot.js"))(name => {
    if (name === "../db/pool") return { query: async (sql, params) => {
        queries.push(sql); assert.deepEqual(params, [42]); assert(sql.includes("child_id = $1"));
        return { rows: sql.includes("FROM milk_type_periods") ? [{ id: 1, ...valid, notes }] : [] };
    } };
    if (name === "./crypto") return crypto;
    if (name === "./emergencyContact") return require("../src/utils/emergencyContact");
    throw Error(name);
}, snapshotModule, snapshotModule.exports);
async function main() {
    const S = snapshotModule.exports;
    const snap = await S.buildSnapshot({ id: 42 }, ["nutrition"]);
    assert.equal(queries.length, 2); assert.equal(snap.milkTypePeriods[0].notes, "Fictional period note");
    assert.deepEqual(S.authorizedSnapshot(snap, ["profile"]), {});
    assert.equal(S.authorizedSnapshot(snap, ["nutrition"]).milkTypePeriods.length, 1);
    assert(!Object.hasOwn(S.authorizedSnapshot({ nutrition: [] }, ["nutrition"]), "milkTypePeriods"));
    assert.throws(() => S.authorizedSnapshot({ milkTypePeriods: [{ notes: "enc:v1:unreadable" }] }, ["nutrition"]), e => e.code === "SHARED_RECORDS_UNREADABLE");
    assert.deepEqual(S.openPayload(JSON.parse(S.sealPayload(snap))).milkTypePeriods, snap.milkTypePeriods);
    console.log("Milk-type API contracts passed: validation, ownership guards, encrypted notes, additive schema, receipt reuse, nutrition-only snapshots and old-share compatibility.");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
