// No database connection: exercise the real routes with fictional SQL/storage doubles.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const express = require("express"), request = require("supertest");
const { ApiError } = require("../src/middleware/error");
const { validateMemoryFields } = require("../src/utils/memoryFields");
const read = file => fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
const records = {
    memories: { id: 7, child_id: 1, caption: "enc:Original", notes: "enc:Original notes", date_recorded: "2029-02-28", photo_url: "private:original", is_favorite: false },
    milestones: { id: 8, child_id: 1, title: "enc:Original milestone", description: "enc:Original notes", age_achieved: "enc:7 months", is_completed: true, date_recorded: "2026-06-16", photo_url: "private:milestone", is_favorite: false },
};
const initial = structuredClone(records);
let fail = false;
const crypto = {
    encrypt: value => value == null ? value : "enc:" + value,
    encryptFields(data, fields) { return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, fields.includes(key) ? crypto.encrypt(value) : value])); },
    decryptRow(row, fields) { return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, fields.includes(key) && typeof value === "string" ? value.replace(/^enc:/, "") : value])); },
};
const query = async (sql, values) => {
    if (fail) throw new Error("Simulated database failure");
    if (sql.startsWith("SELECT id, full_name")) return { rows: [{ id: Number(values[0]) }] };
    if (sql.startsWith("SELECT * FROM children")) return { rows: values[0] === 1 && values[1] === 1 ? [{ id: 1 }] : [] };
    const match = /^UPDATE (memories|milestones) SET (.*?) WHERE id = \$\d+ AND child_id = \$\d+ RETURNING \*/.exec(sql);
    assert(match, sql);
    const row = records[match[1]];
    if (String(values.at(-2)) !== String(row.id) || values.at(-1) !== row.child_id) return { rows: [] };
    const columns = match[2].split(", ").map(part => part.split(" = ")[0]);
    columns.forEach((key, i) => { row[key] = values[i]; });
    return { rows: [{ ...row }] };
};
const storage = { resolveUrlField: async rows => rows.map(row => ({ ...row, photo_url: row.photo_url.replace("private:", "signed:") })) };
function load(file, mocks) {
    const module = { exports: {} };
    new Function("require", "module", "exports", read(file))(name => Object.hasOwn(mocks, name) ? mocks[name] : require(path.resolve(__dirname, "../src", path.dirname(file), name)), module, module.exports);
    return module.exports;
}
const auth = load("middleware/auth.js", { "../db/pool": { query }, "../utils/jwt": { verifyToken: token => ({ sub: Number(token) }) } });
const resource = load("utils/resource.js", { express, "../db/pool": { query }, "./crypto": crypto, "./storage": storage, "../middleware/upload": { upload: { single: () => (req, res, next) => next() } } });
const configs = [];
const generic = load("routes/records.routes.js", { express, "../middleware/auth": auth, "../utils/resource": { createResourceRouter: config => { configs.push(config); return resource.createResourceRouter(config); } } });
const memories = load("routes/memories.routes.js", { express, "../db/pool": { query }, "../middleware/auth": auth, "../utils/crypto": crypto, "../utils/storage": storage, "../middleware/upload": { upload: { single: () => (req, res, next) => next() } } });
const app = express(); app.use(express.json(), generic, memories);
app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
async function main() {
    for (const kind of ["memories", "milestones"]) {
        const row = records[kind], url = `/1/${kind}/${row.id}`;
        await request(app).put(url).send({ is_favorite: true }).expect(401);
        await request(app).put(url).set("Authorization", "Bearer 2").send({ is_favorite: true }).expect(404);
        await request(app).put(url.replace("/1/", "/2/")).set("Authorization", "Bearer 1").send({ is_favorite: true }).expect(404);
        const put = body => request(app).put(url).set("Authorization", "Bearer 1").send(body);
        const response = await put({ is_favorite: true }).expect(200);
        assert.equal(response.body.is_favorite, true); assert(response.body.photo_url.startsWith("signed:"));
        assert.equal(row.photo_url, initial[kind].photo_url);
        for (const value of ["true", 1, null, {}, []]) await put({ is_favorite: value }).expect(400);
        for (const date of ["2029-02-29", "2026-13-01", "10/18/2026", 123]) await put({ date_recorded: date }).expect(400);
        await put({ [kind === "memories" ? "caption" : "title"]: "  " }).expect(400);
        const notesKey = kind === "memories" ? "notes" : "description";
        await put({ [notesKey]: "Updated notes" }).expect(200);
        assert.equal(row[notesKey], "enc:Updated notes"); assert.equal(row.date_recorded, initial[kind].date_recorded);
        if (kind === "milestones") { assert.equal(row.is_completed, true); assert.equal(row.age_achieved, initial[kind].age_achieved); }
        await put({ is_favorite: false }).expect(200); assert.equal(row.is_favorite, false);
        await request(app).put(`/1/${kind}/999`).set("Authorization", "Bearer 1").send({ is_favorite: true }).expect(404);
        if (kind === "memories") await put({ photo_url: "signed:replacement" }).expect(400);
        fail = true; await put({ is_favorite: true }).expect(500); fail = false;
        assert.equal(row.is_favorite, false);
    }
    validateMemoryFields({ date_recorded: "2028-02-29", notes: null });
    const milestone = configs.find(config => config.path === "milestones");
    assert(milestone.columns.includes("is_favorite") && !milestone.encrypted.includes("is_favorite"));
    const migration = read("db/migrations/022_memory_favorites.sql");
    assert.equal((migration.match(/ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE/g) || []).length, 2);
    assert(!/\bDROP\b|\bDELETE\b|\bUPDATE\b/.test(migration));
    assert(!read("utils/snapshot.js").includes("is_favorite"));
    console.log("Memory detail API checks passed: owner/child isolation, metadata encryption, partial updates, preserved dates/age/photos, boolean/date validation, failure handling and private additive Favorites.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
