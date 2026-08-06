// Applies additive migrations (migrations/*.sql) that have not yet run,
// tracked in a schema_migrations bookkeeping table. Unlike migrate.js
// (which runs schema.sql and DROPS every table), this is safe to run
// against a database that already has data.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool, withTransaction } = require("./pool");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function migrateUp() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id         SERIAL PRIMARY KEY,
                filename   TEXT NOT NULL UNIQUE,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);

        const files = fs
            .readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith(".sql"))
            .sort();

        const { rows } = await pool.query("SELECT filename FROM schema_migrations");
        const applied = new Set(rows.map((r) => r.filename));

        for (const file of files) {
            if (applied.has(file)) {
                console.log(`[migrate:up] skip ${file} (already applied)`);
                continue;
            }
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
            await withTransaction(async (client) => {
                await client.query(sql);
                await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
            });
            console.log(`[migrate:up] applied ${file}`);
        }

        console.log("[migrate:up] done.");
    } catch (err) {
        console.error("[migrate:up] failed:", err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

migrateUp();
