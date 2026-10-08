// No database access. Exercises the actual receipt helper with a transactional SQL double.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { ApiError } = require("../src/middleware/error");
let receipts = new Map(), records = new Map(), sequence = 0, tail = Promise.resolve();
const scopeKey = (p) => JSON.stringify(p.slice(0, 4));
async function query(sql, p) {
    if (sql.startsWith("INSERT INTO mutation_receipts")) {
        const key = scopeKey(p);
        if (receipts.has(key)) return { rows: [] };
        receipts.set(key, { payload_hash: p[4] }); return { rows: [{ operation_key: p[3] }] };
    }
    if (sql.startsWith("UPDATE mutation_receipts")) {
        receipts.set(scopeKey(p), { ...receipts.get(scopeKey(p)), record_id: p[4] }); return { rows: [] };
    }
    if (sql.startsWith("SELECT * FROM mutation_receipts")) return { rows: [receipts.get(scopeKey(p))].filter(Boolean) };
    if (sql.startsWith("SELECT * FROM growth_records")) {
        const row = records.get(p[0]); return { rows: row?.child_id === p[1] ? [row] : [] };
    }
    throw new Error(`Unexpected SQL ${sql}`);
}
function withTransaction(work) {
    const next = tail.then(async () => {
        const oldReceipts = new Map(receipts), oldRecords = new Map(records);
        try { return await work({ query }); }
        catch (error) { receipts = oldReceipts; records = oldRecords; throw error; }
    });
    tail = next.catch(() => {}); return next;
}
const moduleMock = { exports: {} };
vm.runInNewContext(fs.readFileSync(`${__dirname}/../src/utils/mutationReceipts.js`, "utf8"), {
    module: moduleMock, require: (name) => {
        if (name === "node:crypto") return require(name);
        if (name === "../db/pool") return { query, withTransaction };
        if (name === "../middleware/error") return { ApiError };
        throw new Error(name);
    },
});
const { createOnce, receiptRecord, operationKey } = moduleMock.exports;
const req = (key, child = 2, user = 1) => ({ get: () => key, child: { id: child }, user: { id: user } });
const insert = (child = 2) => async () => {
    const row = { id: ++sequence, child_id: child }; records.set(row.id, row); return row;
};
async function check() {
    const first = req("retry_1");
    const [a, b] = await Promise.all([
        createOnce(first, "growth_records", "growth_records", { height: 50, weight: 3 }, insert()),
        createOnce(first, "growth_records", "growth_records", { weight: 3, height: 50 }, insert()),
    ]);
    assert.equal(a.id, b.id); assert.equal(sequence, 1, "Only the claimant creates a row");
    await assert.rejects(createOnce(first, "growth_records", "growth_records", { weight: 4 }, insert()), (e) => e.status === 409);
    const scoped = await createOnce(req("retry_1", 3), "growth_records", "growth_records", {}, insert(3));
    assert.notEqual(scoped.id, a.id);
    await assert.rejects(receiptRecord(req("retry_1", 2, 9), "growth_records", "growth_records", "retry_1"), (e) => e.status === 404);
    records.delete(a.id);
    await assert.rejects(createOnce(first, "growth_records", "growth_records", { height: 50, weight: 3 }, insert()), (e) => e.status === 410);
    assert.equal(sequence, 2, "Deleted records cannot be resurrected by retry");
    await assert.rejects(createOnce(req("failed"), "growth_records", "growth_records", {}, async () => { throw new Error("Insert failed"); }));
    await createOnce(req("failed"), "growth_records", "growth_records", {}, insert());
    assert.equal(sequence, 3, "Failed transactions release their receipt claim");
    await createOnce(req(undefined), "growth_records", "growth_records", {}, insert());
    assert.equal(sequence, 4, "Legacy callers without a key still work");
    assert.throws(() => operationKey(req("bad key")), (e) => e.status === 400);
    assert.throws(() => operationKey(req("x".repeat(65))), (e) => e.status === 400);
    console.log("Receipt helper checks passed: replay, payload conflict, scoped access, rollback and deleted-record protection (SQL double, not a live database).");
}
check().catch((error) => { console.error(error); process.exitCode = 1; });
