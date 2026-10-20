// API contracts with in-memory route dependencies; no database or environment file.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
const errors = require("../src/middleware/error"), resources = [], guards = [];
const auth = () => {}, owner = () => {};
new Function("require", "module", "exports", read("routes/records.routes.js"))(name => {
    if (name === "express") return { Router: () => ({ use: (...args) => guards.push(args) }) };
    if (name === "../middleware/error") return errors;
    if (name === "../middleware/auth") return { requireAuth: auth, requireChildOwnership: owner };
    if (name === "../utils/resource") return { createResourceRouter: config => { resources.push(config); return {}; } };
    if (name === "../utils/numericValidation") return require("../src/utils/numericValidation");
    if (name === "../utils/memoryFields") return require("../src/utils/memoryFields");
    throw Error(name);
}, { exports: {} }, {});
const config = resources.find(r => r.table === "vaccinations"), validate = config.validate;
assert.deepEqual(guards.find(r => r[0].endsWith("/vaccinations")).slice(1,3), [auth, owner]);
const pending = { status: "scheduled", due_date: "2026-10-20" }, completed = { status: "completed", due_date: null };
for (const due_date of [undefined, null, "", "2026-02-30", "2026-13-01", "20/10/2026", "2026-10-20T00:00:00Z"]) {
    assert.throws(() => validate({ due_date }, { isCreate: true }), e => e.status === 400);
    assert.throws(() => validate({ due_date }, { isCreate: false, existing: pending }), e => e.status === 400);
}
validate({ due_date: "2024-02-29" }, { isCreate: true });
validate({ notes: "Retained date" }, { isCreate: false, existing: pending });
validate({ status: "completed", due_date: null }, { isCreate: true });
validate({ notes: "Legacy completed" }, { isCreate: false, existing: completed });
assert.throws(() => validate({ status: "scheduled" }, { isCreate: false, existing: completed }), e => e.status === 400);
validate({ status: "scheduled", due_date: "2026-10-20" }, { isCreate: false, existing: completed });
for (const status of [null, "pending", "overdue", ""]) assert.throws(() => validate({ status, due_date: "2026-10-20" }, { isCreate: true }), e => e.status === 400);

const handlers = {}, queries = [], api = { exports: {} };
let existing = pending, transactions = 0;
const client = { query: async (sql, params) => { queries.push({ sql, params }); return { rows: existing ? [{ ...existing, id: 8, child_id: 3 }] : [] }; } };
new Function("require", "module", "exports", read("utils/resource.js"))(name => {
    if (name === "express") return { Router: () => Object.fromEntries(["get", "post", "put", "delete"].map(method => [method, (route, ...stack) => { handlers[`${method} ${route}`] = stack.at(-1); }])) };
    if (name === "../db/pool") return { query: () => { throw Error("Vaccination update bypassed transaction"); }, withTransaction: async fn => { transactions++; return fn(client); } };
    if (name === "../middleware/error") return errors;
    if (name === "../middleware/upload") return {};
    if (name === "./crypto") return { encryptFields: data => data, decryptRow: data => data };
    if (name === "./storage") return {};
    if (name === "./mutationReceipts") return { createOnce: () => { throw Error("Invalid creation reached persistence"); } };
    throw Error(name);
}, api, api.exports);
api.exports.createResourceRouter(config);
async function invoke(method, body) {
    let error, result;
    await handlers[method]({ body, params: { id: 8 }, child: { id: 3 } }, { json: value => { result = value; } }, value => { error = value; });
    return { error, result };
}
(async () => {
    assert.equal((await invoke("post /", { vaccine_name: "Fictional", status: "scheduled" })).error.status, 400);
    queries.length = 0;
    assert.equal((await invoke("put /:id", { notes: "Fictional note" })).error, undefined);
    assert.equal(transactions, 1);
    assert(queries[0].sql.includes("SELECT status, due_date FROM vaccinations") && queries[0].sql.endsWith("FOR UPDATE"));
    assert.deepEqual(queries[0].params, [8, 3]);
    assert(queries[1].sql.includes("AND child_id ="));
    queries.length = 0;
    assert.equal((await invoke("put /:id", { due_date: null })).error.status, 400);
    assert.equal(queries.length, 1, "Invalid updates never reach UPDATE");
    existing = completed;
    assert.equal((await invoke("put /:id", { status: "scheduled" })).error.status, 400);
    existing = null;
    assert.equal((await invoke("put /:id", { due_date: "2026-10-20" })).error.status, 404);
    console.log("Vaccination API checks passed: required dates, partial updates, legacy completion, undo, ownership and locked validation.");
})().catch(error => { console.error(error); process.exitCode = 1; });
