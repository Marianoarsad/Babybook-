// Run only with DATABASE_URL explicitly pointing to a disposable local bb_solid_test_* database.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { Client } = require("pg");
const url = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1", "::1"].includes(url.hostname) && /^\/bb_solid_test_[a-z0-9_]+$/.test(url.pathname), "A disposable local Solid Foods test database is required");
const client = new Client({ connectionString: url.href });
async function main() {
    await client.connect();
    try {
        await client.query("CREATE TABLE nutrition_records (id serial PRIMARY KEY, food_introduced text, reaction_severity text, reaction text)");
        await client.query("INSERT INTO nutrition_records (food_introduced, reaction_severity, reaction) VALUES ($1,$2,$3)", ["Disposable food", "severe", "Original symptoms"]);
        const before = (await client.query("SELECT * FROM nutrition_records")).rows[0];
        const migration = fs.readFileSync(path.join(__dirname, "../src/db/migrations/021_solid_food_category.sql"), "utf8");
        await client.query(migration); await client.query(migration);
        const after = (await client.query("SELECT * FROM nutrition_records")).rows[0];
        assert.equal(after.food_category, null); delete after.food_category; assert.deepEqual(after, before);
        for (const category of ["fruits", "vegetables", "grains", "proteins", "dairy", "other", null]) {
            await client.query("UPDATE nutrition_records SET food_category=$1 WHERE id=$2", [category, before.id]);
            const saved = (await client.query("SELECT * FROM nutrition_records WHERE id=$1", [before.id])).rows[0];
            assert.equal(saved.food_category, category); assert.equal(saved.reaction, before.reaction); assert.equal(saved.reaction_severity, before.reaction_severity);
        }
        await assert.rejects(client.query("UPDATE nutrition_records SET food_category='guessed'"), e => e.code === "23514");
        console.log("Disposable PostgreSQL checks passed: migration repeatability, nullable historical rows, six categories, constraint enforcement, and unchanged reaction data.");
    } finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
