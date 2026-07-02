const { Pool } = require("pg");

// SSL handling:
//   DB_SSL=true  -> force SSL (Supabase / any hosted Postgres)
//   DB_SSL=false -> force off (local Postgres)
//   unset        -> auto: on for remote hosts, off for localhost
function resolveSsl() {
    if (process.env.DB_SSL === "true") return { rejectUnauthorized: false };
    if (process.env.DB_SSL === "false") return false;

    const url = process.env.DATABASE_URL || "";
    const host = process.env.PGHOST || "";
    const target = url || host;
    const isLocal = !target || /localhost|127\.0\.0\.1/.test(target);
    // Supabase (and most managed providers) require SSL.
    return isLocal ? false : { rejectUnauthorized: false };
}

const ssl = resolveSsl();

// Prefer DATABASE_URL; fall back to discrete PG* env vars.
const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl }
    : {
          host: process.env.PGHOST || "localhost",
          port: parseInt(process.env.PGPORT || "5432", 10),
          user: process.env.PGUSER || "postgres",
          password: process.env.PGPASSWORD || "postgres",
          database: process.env.PGDATABASE || "babybook",
          ssl,
      };

const pool = new Pool(config);

// Thin query helper.
function query(text, params) {
    return pool.query(text, params);
}

// Run a function inside a transaction with a dedicated client.
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, query, withTransaction };
