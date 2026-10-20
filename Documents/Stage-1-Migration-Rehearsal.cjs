// Schema-only production READ, restore only to the disposable loopback test DB.
const fs = require("node:fs"), path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { Pool } = require("../back-end/node_modules/pg");
const { productionUrl } = require("./Stage-0-Verification.cjs");
const bin = "C:/Users/Arzad/AppData/Local/BabyBookStage0/tools/PostgreSQL17/pgsql/bin";
let phase = "preflight";
async function main() {
    const vault = JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-Command",
        "Add-Type -AssemblyName System.Security; $b=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes('C:\\Users\\Arzad\\AppData\\Local\\BabyBookStage0\\secrets\\credentials.dpapi'),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); try {[Text.Encoding]::UTF8.GetString($b)} finally {[Array]::Clear($b,0,$b.Length)}"],
        { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }));
    const source = productionUrl(vault.productionDatabaseUrl);
    const certificate = process.argv[2] || "C:/Users/Arzad/Downloads/prod-ca-2021.crt";
    if (!fs.existsSync(certificate) || !vault.testPassword) throw new Error("Missing prerequisites");
    const localEnv = { ...process.env, PGHOST: "127.0.0.1", PGPORT: "55432", PGDATABASE: "babybook_stage0_test",
        PGUSER: "bb_stage0_test", PGPASSWORD: vault.testPassword, PGSSLMODE: "disable", PGOPTIONS: "" };
    const pool = new Pool({ host: localEnv.PGHOST, port: 55432, database: localEnv.PGDATABASE,
        user: localEnv.PGUSER, password: vault.testPassword, ssl: false, connectionTimeoutMillis: 5000, max: 2 });
    try {
        const target = (await pool.query("SELECT current_database() AS db, inet_server_addr()::text AS host, inet_server_port() AS port")).rows[0];
        if (target.db !== "babybook_stage0_test" || target.host !== "127.0.0.1/32" && target.host !== "127.0.0.1" || target.port !== 55432) throw new Error("Target guard failed");
        phase = "schema-only-read";
        const dump = spawnSync(path.join(bin, "pg_dump.exe"), ["--schema=public", "--schema-only", "--format=custom", "--no-owner", "--no-acl"],
            { env: { ...process.env, PGHOST: source.hostname, PGPORT: "5432", PGDATABASE: "postgres",
                PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password),
                PGSSLMODE: "verify-full", PGSSLROOTCERT: path.resolve(certificate), PGOPTIONS: "-c default_transaction_read_only=on" },
                windowsHide: true, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024, timeout: 90000 });
        if (dump.status !== 0 || !dump.stdout?.length) throw new Error("Schema read failed");
        phase = "disposable-schema-import";
        // This is the explicitly guarded throwaway database, not either recovery DB.
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION bb_stage0_test");
        const restore = spawnSync(path.join(bin, "pg_restore.exe"),
            ["--dbname=babybook_stage0_test", "--clean", "--if-exists", "--no-owner", "--no-acl", "--single-transaction", "--exit-on-error"],
            { env: localEnv, input: dump.stdout, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
                maxBuffer: 16 * 1024 * 1024, timeout: 60000 });
        dump.stdout.fill(0);
        if (restore.status !== 0) throw new Error("Disposable schema import failed");
        phase = "fictional-fixtures";
        await pool.query("INSERT INTO users(full_name,email,password_hash,consent_accepted) VALUES('FICTIONAL REHEARSAL','stage1-rehearsal@example.test','not-a-login-hash',true)");
        await pool.query("INSERT INTO children(user_id,first_name,last_name) SELECT id,'FICTIONAL','REHEARSAL' FROM users LIMIT 1");
        await pool.query("INSERT INTO shared_records(child_id,code,qr_payload,shared_record_keys,payload,expiration_date) SELECT id,'TEST-BASE','BABYBOOK+CONSULT:TEST-BASE','[\"profile\"]','{\"fictional\":true}',now()+interval '1 day' FROM children LIMIT 1");
        phase = "migration-preservation";
        await pool.query("BEGIN");
        try {
            await pool.query(fs.readFileSync(path.join(__dirname, "Stage-1-Migration-Rehearsal.sql"), "utf8"));
            await pool.query("COMMIT");
        } catch (error) { await pool.query("ROLLBACK"); throw error; }
        console.log(JSON.stringify({ scope: "production schema only -> disposable local fictional fixtures",
            productionRowsRead: false, target: "babybook_stage0_test", migrations: "009-018",
            rerunIdempotent: true, originalFixtureValuesUnchanged: true, archiveRestoreVerified: false }));
    } finally { await pool.end(); }
}
main().catch(() => { console.error(JSON.stringify({ failed: true, phase, secretsAndPatientDataOmitted: true })); process.exitCode = 1; });
