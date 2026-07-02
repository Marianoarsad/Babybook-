require("dotenv").config();
const app = require("./app");
const { pool } = require("./db/pool");

const PORT = process.env.PORT || 4000;

// Verify the database is reachable before accepting traffic.
async function start() {
    try {
        await pool.query("SELECT 1");
        console.log("[db] connection OK");
    } catch (err) {
        console.error("[db] connection FAILED:", err.message);
        console.error("Check your DATABASE_URL / PG* env vars and that PostgreSQL is running.");
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`[server] BabyBook+ API listening on http://localhost:${PORT}`);
    });
}

start();
