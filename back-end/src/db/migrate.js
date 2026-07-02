// Runs schema.sql against the configured database.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./pool");

async function migrate() {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    try {
        await pool.query(sql);
        console.log("[migrate] schema applied successfully.");
    } catch (err) {
        console.error("[migrate] failed:", err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

migrate();
