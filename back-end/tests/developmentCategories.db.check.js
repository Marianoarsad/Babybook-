// Requires an explicitly named disposable local database; never loads .env.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { Client } = require("pg");
const url = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /^\/bb_memory_test_[a-z0-9_]+$/.test(url.pathname), "A disposable local bb_memory_test_* database is required");
const client = new Client({ connectionString: url.href });
async function main() {
    await client.connect();
    try {
        for (const table of ["memories", "milestones"]) {
            await client.query(`CREATE TABLE ${table} (id serial PRIMARY KEY, title text, photo_url text)`);
            await client.query(`INSERT INTO ${table} (title,photo_url) VALUES ($1,$2)`, ["Fictional original", "fixture:photo"]);
        }
        const migration = fs.readFileSync(path.join(__dirname, "../src/db/migrations/023_development_categories.sql"), "utf8");
        await client.query(migration); await client.query(migration);
        for (const table of ["memories", "milestones"]) {
            const original = (await client.query(`SELECT * FROM ${table}`)).rows[0];
            assert.deepEqual(original,{id:1,title:"Fictional original",photo_url:"fixture:photo",development_category:null});
            for(const category of ["social","language","cognitive","motor",null]){
                await client.query(`UPDATE ${table} SET development_category=$1`,[category]);
                assert.equal((await client.query(`SELECT development_category FROM ${table}`)).rows[0].development_category,category);
            }
            await assert.rejects(client.query(`UPDATE ${table} SET development_category='other'`),error=>error.code==="23514");
        }
        console.log("Development category migration passed: repeatable, nullable, four valid values, invalid-value rejection and preserved original records.");
    } finally { await client.end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
