// Only a named disposable local database is accepted; never load the app's .env here.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { Client } = require("pg");
const url = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /^\/bb_memory_test_[a-z0-9_]+$/.test(url.pathname), "A disposable local bb_memory_test_* database is required");
const client = new Client({ connectionString: url.href });
async function main() {
    await client.connect();
    try {
        for (const table of ["memories", "milestones"]) {
            await client.query(`CREATE TABLE ${table} (id serial PRIMARY KEY, title text, date_recorded date, photo_url text)`);
            await client.query(`INSERT INTO ${table} (title,date_recorded,photo_url) VALUES ($1,$2,$3)`, ["Disposable original", "2029-02-28", "private:original"]);
        }
        const before = {};
        for (const table of ["memories", "milestones"]) before[table] = (await client.query(`SELECT * FROM ${table}`)).rows[0];
        const migration = fs.readFileSync(path.join(__dirname, "../src/db/migrations/022_memory_favorites.sql"), "utf8");
        await client.query(migration); await client.query(migration);
        for (const table of ["memories", "milestones"]) {
            const after = (await client.query(`SELECT * FROM ${table}`)).rows[0];
            assert.equal(after.is_favorite, false); delete after.is_favorite; assert.deepEqual(after, before[table]);
            await client.query(`UPDATE ${table} SET is_favorite=true`);
            assert.equal((await client.query(`SELECT is_favorite FROM ${table}`)).rows[0].is_favorite, true);
            await assert.rejects(client.query(`UPDATE ${table} SET is_favorite=null`), error => error.code === "23502");
        }
        console.log("Disposable PostgreSQL Favorites checks passed: repeatable additive migration, false defaults, boolean updates, NOT NULL and unchanged original data.");
    } finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
