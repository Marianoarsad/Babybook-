// node tests/sharingAccess.check.js — real handlers with mocked database transactions; no saved data.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), express = require("express");
const load = (file, imports, suffix = "") => { const module = { exports: {} }; new Function("require", "module", "exports", fs.readFileSync(path.join(__dirname, "../src", file), "utf8") + suffix)(name => { assert(name in imports, name); return imports[name]; }, module, module.exports); return module.exports; };
const crypto = { encrypt: v => v, decrypt: v => v, decryptRow: v => ({ ...v }), isEncrypted: () => false };
const snapshots = load("utils/snapshot.js", { "../db/pool": { query: async () => ({ rows: [] }) }, "./crypto": crypto, "./emergencyContact": require("../src/utils/emergencyContact") });
const code = require("../src/utils/shareCode"), jwt = require("../src/utils/jwt");
let share, writes = [];
const accessHelpers = load("utils/consultationAccess.js", { "node:crypto": require("node:crypto"), "../db/pool": { query() { throw Error("Unexpected database call"); } }, "./shareCode": code });
const consult = load("routes/consult.routes.js", { express, "../db/pool": { withTransaction: async fn => fn({ query: async (sql, args) => {
    if (sql.includes("SELECT id")) return { rows: share ? [share] : [] };
    writes.push([sql, args]); return { rows: [] };
} }) }, "../utils/shareCode": code, "../utils/snapshot": snapshots, "../utils/consultationAccess": accessHelpers }, "\nmodule.exports.access = access;");
const request = { body: { code: "AB7K-2P9Q", professionalName: "Fixture clinician" }, ip: "127.0.0.1", get: () => "Fixture agent" };
const payload = { profile: { name: "EXCLUDED CHILD" }, growth: [{ weight: 6 }], medicalHistory: [{ title: "EXCLUDED HISTORY" }], allergies: { allergies: ["EXCLUDED ALLERGY"] }, nutrition: [], milkTypePeriods: [], visitReason: "Parent supplied note" };
async function check() {
    const original = JSON.stringify(payload);
    share = { id: 1, child_id: 2, status: "active", overdue: false, purged: false, shared_record_keys: ["growth", "unknown"], payload, expiration_date: "2099-01-01", server_now: "2026-10-16", generate_date: "2026-10-16" };
    let result = await consult.access(request, true);
    assert.equal(result.http, 200); assert.deepEqual(result.body.recordKeys, ["growth"]);
    assert.deepEqual(Object.keys(result.body.payload), ["growth", "visitReason"]); assert.equal(result.body.childName, "Shared Baby Records");
    assert(!JSON.stringify(result.body).includes("EXCLUDED")); assert.equal(writes.length, 1); assert(writes[0][0].includes("INSERT INTO access_logs"));
    writes = []; result = await consult.access(request, false); assert.equal(result.http, 200); assert(!result.body.payload); assert.equal(writes.length, 0);
    share.overdue = true; result = await consult.access(request, true); assert.equal(result.http, 410); assert.equal(result.body.status, "expired"); assert(writes[0][0].includes("UPDATE shared_records")); assert(!result.body.payload);
    share.overdue = false; share.status = "revoked"; writes = []; result = await consult.access(request, true); assert.equal(result.body.status, "revoked"); assert.equal(writes.length, 0);
    share.status = "active"; share.purged = true; assert.equal((await consult.access(request, true)).body.status, "unavailable");
    share.purged = false; share.payload = { growth: "enc:v1:unreadable" }; assert.equal((await consult.access(request, true)).body.status, "unreadable");
    assert.equal((await consult.access({ ...request, body: { code: "bad" } }, true)).http, 400);
    assert.equal(JSON.stringify(payload), original);
    const routes = consult.stack.filter(layer => layer.route).map(layer => [layer.route.path, Object.keys(layer.route.methods)]);
    assert.deepEqual(routes, [["/resolve", ["post"]], ["/status", ["post"]]], "Share credentials expose no record mutation routes");
    const headers = {}; accessHelpers.privateResponse({}, { set: values => Object.assign(headers, values) }, () => {}); assert(headers["Cache-Control"].includes("no-store"));
    const auth = load("middleware/auth.js", { "../utils/jwt": jwt, "../db/pool": { query() { throw Error("Share credentials must be rejected before reading records"); } }, "./error": require("../src/middleware/error") });
    const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = "fixture-only-sharing-check-secret";
    try {
        for (const bearer of [request.body.code, code.generateShareToken(), code.qrPayloadForCode(request.body.code)]) {
            let error; await auth.requireAuth({ headers: { authorization: `Bearer ${bearer}` } }, {}, e => error = e);
            assert.equal(error.status, 401, "Share credentials are not parent edit credentials");
        }
    } finally { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; }
    console.log("Sharing access checks passed: selected-only server snapshots, note inclusion, expiry/revocation/purge, unreadable fail-closed behavior, private responses and rejection of share credentials by parent authentication.");
}
check().catch(error => { console.error(error); process.exitCode = 1; });
