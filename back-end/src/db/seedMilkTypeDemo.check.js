// Fictional SQL double only: no environment file, credentials or database connection.
const assert = require("node:assert/strict"), fs = require("node:fs");
let rows, serial, failChild, accountMissing, wrongProfiles, missingTable, writes;
const children = [{ id: 106, first_name: "Elias", last_name: "Rivera", date_of_birth: "2026-02-14" },
    { id: 107, first_name: "Sofia", last_name: "Rivera", date_of_birth: "2025-11-14" }];
const original = [{ id: 1, child_id: 106, milk_type: "Mixed", start_date: "2026-01-01", end_date: null, notes: "Existing unmarked period" },
    { id: 2, child_id: 999, milk_type: "Formula", start_date: "2026-01-01", end_date: null, notes: "Other account period" }];
function reset() { rows = structuredClone(original); serial = 10; failChild = null; accountMissing = wrongProfiles = missingTable = false; writes = 0; }
const client = { async query(sql, values) {
    if (sql.startsWith("SELECT id FROM users")) { assert.deepEqual(values, ["demo.parent@babybookplus.app"]); return { rows: accountMissing ? [] : [{ id: 99 }] }; }
    if (sql.startsWith("SELECT id, first_name")) { assert.deepEqual(values, [99]); return { rows: wrongProfiles ? [children[0]] : children }; }
    if (sql.includes("to_regclass")) return { rows: [{ present: !missingTable }] };
    if (sql.startsWith("SELECT id, milk_type")) return { rows: rows.filter(row => row.child_id === values[0]) };
    writes++;
    if (sql.startsWith("INSERT")) {
        const [child_id, milk_type, start_date, end_date, notes] = values;
        assert([106, 107].includes(child_id)); assert(notes.startsWith("enc:v1:"));
        if (child_id === failChild) throw Error("Injected second-profile failure");
        const row = { id: serial++, child_id, milk_type, start_date, end_date, notes }; rows.push(row); return { rows: [{ id: row.id }] };
    }
    if (sql.startsWith("UPDATE")) {
        assert(sql.includes("WHERE id=$5 AND child_id=$6"));
        const [milk_type, start_date, end_date, notes, id, child_id] = values;
        const row = rows.find(row => row.id === id && row.child_id === child_id);
        assert(row && [106, 107].includes(child_id));
        Object.assign(row, { milk_type, start_date, end_date, notes }); return { rows: [{ id }] };
    }
    throw Error("Unexpected SQL: " + sql);
} };
const testModule = { exports: {} };
new Function("require", "module", "exports", fs.readFileSync(__dirname + "/seedMilkTypeDemo.js", "utf8"))(name => {
    if (name === "dotenv") return { config() {} };
    if (name === "./pool") return { pool: {}, withTransaction: async fn => {
        const before = structuredClone(rows); try { return await fn(client); } catch (e) { rows = before; throw e; }
    } };
    if (name === "../utils/crypto") return { encrypt: value => "enc:v1:" + value,
        decrypt: value => value === "enc:v1:unreadable" ? value : typeof value === "string" ? value.replace(/^enc:v1:/, "") : value,
        isEncrypted: value => typeof value === "string" && value.startsWith("enc:v1:") };
    throw Error(name);
}, testModule, testModule.exports);
const S = testModule.exports, today = "2026-10-15";
async function main() {
    reset(); const samples = S.buildMilkTypePeriods("2026-02-14", today);
    assert.equal(samples.length, 8); assert.equal(samples[0].start_date, "2026-02-14");
    assert.deepEqual(samples.slice(3).map(p => [p.milk_type, p.start_date, p.end_date]), [
        ["Breastmilk", "2026-10-09", "2026-10-11"], ["Formula", "2026-10-10", "2026-10-11"],
        ["Mixed", "2026-10-12", "2026-10-13"], ["Formula", "2026-10-14", null], ["Formula", "2026-10-14", "2026-10-14"]]);
    assert(samples.every(p => Object.keys(p).sort().join() === "end_date,milk_type,notes,start_date"));
    assert.equal(new Set(samples.map(p => p.notes)).size, 8);
    assert.throws(() => S.buildMilkTypePeriods("2026-02-30", today));
    assert.throws(() => S.buildMilkTypePeriods("2026-10-01", today));
    assert.match(S.manilaToday(), /^\d{4}-\d{2}-\d{2}$/);
    const first = await S.seedMilkTypeDemo(today); assert(first.profiles.every(p => p.inserted === 8));
    assert.deepEqual(rows.slice(0, 2), original); assert.equal(rows.length, 18);
    const after = JSON.stringify(rows); writes = 0;
    const retry = await S.seedMilkTypeDemo(today); assert(retry.profiles.every(p => p.unchanged === 8)); assert.equal(writes, 0); assert.equal(JSON.stringify(rows), after);
    const nextDay = await S.seedMilkTypeDemo("2026-10-16"); assert(nextDay.profiles.every(p => p.updated === 8)); assert.equal(rows.length, 18); assert.deepEqual(rows.slice(0, 2), original);
    for (const flag of ["account", "profiles", "table"]) {
        reset(); accountMissing = flag === "account"; wrongProfiles = flag === "profiles"; missingTable = flag === "table";
        await assert.rejects(() => S.seedMilkTypeDemo(today)); assert.equal(writes, 0); assert.deepEqual(rows, original);
    }
    reset(); failChild = 107; await assert.rejects(() => S.seedMilkTypeDemo(today)); assert.deepEqual(rows, original, "One transaction rolls back both profiles");
    reset(); rows.push({ ...original[0], id: 3, notes: "enc:v1:unreadable" });
    await assert.rejects(() => S.seedMilkTypeDemo(today)); assert.equal(writes, 0);
    reset(); rows.push({ ...original[0], id: 3, notes: "[milk-chart-demo:v1:01] Duplicate" }, { ...original[0], id: 4, notes: "[milk-chart-demo:v1:01] Duplicate" });
    await assert.rejects(() => S.seedMilkTypeDemo(today)); assert.equal(writes, 0);
    console.log("Milk demo seed checks passed: eight intervals, overlaps, calendar dates, account/profile guards, encrypted notes, preservation, idempotency and transaction rollback.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
