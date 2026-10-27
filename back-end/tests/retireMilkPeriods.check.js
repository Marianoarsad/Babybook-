const assert = require("node:assert/strict");
const { retireMilkPeriods } = require("../src/utils/retireMilkPeriods");
function fixture() {
    let periods = [{ id: 1, notes: "Fictional period" }];
    let shares = [{ id: 9, payload: { nutrition: [{ quantity: 120 }], profile: { name: "Fixture" }, milkTypePeriods: periods } }];
    let original, commits = 0;
    const query = async (sql, args) => {
        if (sql === "BEGIN") original = structuredClone({ periods, shares });
        if (sql === "ROLLBACK") ({ periods, shares } = original);
        if (sql === "COMMIT") commits++;
        if (sql.startsWith("SELECT * FROM milk_type")) return { rows: periods };
        if (sql.startsWith("SELECT id, payload")) return { rows: shares };
        if (sql.startsWith("UPDATE shared")) { shares[0].payload = JSON.parse(args[0]); return { rowCount: 1, rows: [shares[0]] }; }
        if (sql.startsWith("DELETE FROM milk_type")) { const rowCount = periods.length; periods = []; return { rowCount }; }
        if (sql.startsWith("SELECT count")) return { rows: [{ count: periods.length }] };
        return {};
    };
    return { client: { query }, state: () => ({ periods, shares, commits }) };
}
const codec = { open: value => value, seal: JSON.stringify };
async function main() {
    let f = fixture();
    assert.deepEqual(await retireMilkPeriods(f.client, codec), { periods: 1, snapshots: 1, applied: false });
    assert.equal(f.state().periods.length, 1);
    for (const failure of [async () => false, async () => { throw Error("Backup failure"); }]) {
        f = fixture(); await assert.rejects(retireMilkPeriods(f.client, { ...codec, apply: true, backup: failure }));
        assert.equal(f.state().periods.length, 1); assert(f.state().shares[0].payload.milkTypePeriods);
    }
    f = fixture();
    await assert.rejects(retireMilkPeriods(f.client, { ...codec, apply: true, open: () => null, backup: async () => true }));
    assert.equal(f.state().commits, 0);
    let saved;
    f = fixture(); await retireMilkPeriods(f.client, { ...codec, apply: true, backup: async data => { saved = structuredClone(data); return true; } });
    assert.equal(saved.periods[0].notes, "Fictional period");
    assert.equal(f.state().periods.length, 0);
    assert.deepEqual(f.state().shares[0].payload, { nutrition: [{ quantity: 120 }], profile: { name: "Fixture" } });
    assert.deepEqual(await retireMilkPeriods(f.client, { ...codec, apply: true }), { periods: 0, snapshots: 0, applied: false });
    console.log("Period cleanup passed: dry run, required backup, rollback, unreadable snapshot refusal, field-only removal and idempotence.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
