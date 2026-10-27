const assert = require("node:assert/strict");

// Operator-only cleanup; callers supply a verified encrypted backup, never an HTTP endpoint.
async function retireMilkPeriods(client, { open, seal, backup, apply = false }) {
    await client.query("BEGIN");
    try {
        await client.query("LOCK TABLE milk_type_periods, shared_records IN SHARE ROW EXCLUSIVE MODE");
        const periods = (await client.query("SELECT * FROM milk_type_periods ORDER BY id")).rows;
        const shares = (await client.query("SELECT id, payload FROM shared_records ORDER BY id")).rows;
        const affected = [];
        for (const row of shares) {
            const payload = open(row.payload);
            if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Snapshot unreadable; cleanup cancelled");
            if (Object.hasOwn(payload, "milkTypePeriods")) {
                const { milkTypePeriods, ...remaining } = payload;
                affected.push({ ...row, remaining });
            }
        }
        const counts = { periods: periods.length, snapshots: affected.length };
        if (!apply || !periods.length && !affected.length) {
            await client.query("ROLLBACK");
            return { ...counts, applied: false };
        }
        const saved = { periods, shares: affected.map(({ remaining, ...row }) => row) };
        if (await backup(saved) !== true) throw new Error("Verified backup required; cleanup cancelled");
        for (const row of affected) {
            const sealed = seal(row.remaining);
            // sealPayload returns JSON text for the JSONB parameter.
            assert.deepEqual(open(JSON.parse(sealed)), row.remaining);
            const result = await client.query("UPDATE shared_records SET payload = $1::jsonb WHERE id = $2 RETURNING payload", [sealed, row.id]);
            assert.equal(result.rowCount, 1);
            assert.deepEqual(open(result.rows[0].payload), row.remaining);
        }
        const result = await client.query("DELETE FROM milk_type_periods");
        assert.equal(result.rowCount, periods.length);
        assert.equal((await client.query("SELECT count(*)::int AS count FROM milk_type_periods")).rows[0].count, 0);
        await client.query("COMMIT");
        return { ...counts, applied: true };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
}

module.exports = { retireMilkPeriods };
