// Stage 0 operator helper. Sources are READ ONLY; restores and rehearsals target
// named, isolated local PostgreSQL 17 databases. Never pass a secret in argv.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { PRODUCTION_PROJECT, DEVELOPMENT_PROJECT, quote, productionUrl,
    parseEncryptionCandidate, auditEncryption, tableEvidence, sha256 } = require('./Stage-0-Verification.cjs');
const backend = path.resolve(__dirname, '../back-end');
const { Pool } = require(path.join(backend, 'node_modules/pg'));
const dotenv = require(path.join(backend, 'node_modules/dotenv'));
const root = 'C:/Users/Arzad/BabyBook+ Backups';
const stage0Root = 'C:/Users/Arzad/AppData/Local/BabyBookStage0';
const bin = path.join(stage0Root, 'tools/PostgreSQL17/pgsql/bin');
const zip = path.join(stage0Root, 'tools/7-Zip/7z.exe');
const env = dotenv.parse(fs.readFileSync(path.join(backend, '.env')));
const mode = process.argv[2];
const modes = ['db', 'production-db', 'production-preservation', 'attachments', 'audit-local', 'audit-production',
    'audit-production-jwt', 'verify-development', 'recover-attachments', 'rehearse-migrations'];
let phase = 'preflight', staging, credentials;

function readCredentials() {
    // DPAPI plaintext is captured privately, never forwarded to tool output.
    return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command',
        "Add-Type -AssemblyName System.Security; $b=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes('C:\\Users\\Arzad\\AppData\\Local\\BabyBookStage0\\secrets\\credentials.dpapi'),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); try {[Text.Encoding]::UTF8.GetString($b)} finally {[Array]::Clear($b,0,$b.Length)}"
    ], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }));
}

function run(executable, args, extraEnv = {}) {
    return execFileSync(executable, args, {
        env: { ...process.env, ...extraEnv }, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 16 * 1024 * 1024, timeout: 180000,
    });
}

function workingDirectory() {
    if (!staging) staging = fs.mkdtempSync(path.join(root, '.stage0-'));
    return staging;
}

async function archiveRun(args) {
    if (!process.stdin.isTTY) throw new Error('Use your own interactive PowerShell terminal');
    console.log('7-Zip step: ' + ({ a: 'create encrypted archive', l: 'check encryption', t: 'test archive', x: 'recover archive' })[args[0]] + '. Wait for the password prompt.');
    // Forward only password prompts live; archive listings/errors can contain PHI.
    return new Promise((resolve, reject) => {
        const child = spawn(zip, args, { windowsHide: true, stdio: ['inherit', 'pipe', 'pipe'] });
        const output = [];
        let size = 0, tail = '', overflow = false;
        child.stdout.on('data', data => {
            size += data.length;
            if (size > 16 * 1024 * 1024) { overflow = true; child.kill(); return; }
            output.push(data);
            const text = tail + data.toString('utf8');
            let end = 0;
            for (const match of text.matchAll(/\r?\nEnter password(?: \(will not be echoed\))?:/g)) {
                console.log('7-Zip password: type or paste (Shift+Insert), then press Enter. No characters or asterisks will appear. Never paste at PS C:> or in a command.');
                end = match.index + match[0].length;
            }
            tail = text.slice(Math.max(end, text.length - 64));
        });
        child.stderr.resume();
        child.on('error', () => reject(new Error('7-Zip could not start; existing archives preserved')));
        child.on('close', code => {
            if (code !== 0 || overflow) reject(new Error('7-Zip failed; existing archives preserved'));
            else { console.log('7-Zip step completed.'); resolve(Buffer.concat(output)); }
        });
    });
}

async function seal(files, label) {
    phase = 'interactive archive encryption/recovery';
    const archive = path.join(root, label + '-' + Date.now() + '.7z');
    await archiveRun(['a', '-t7z', '-mhe=on', '-p', archive, ...files]);
    const details = (await archiveRun(['l', '-slt', archive])).toString();
    if (!/Method = .*7zAES/.test(details)) throw new Error('AES archive verification failed');
    await archiveRun(['t', archive]);
    const restored = path.join(workingDirectory(), 'archive-check');
    fs.mkdirSync(restored);
    await archiveRun(['x', '-o' + restored, archive]);
    for (const file of files) {
        if (!fs.readFileSync(file).equals(fs.readFileSync(path.join(restored, path.basename(file))))) throw new Error('Archive recovery mismatch');
    }
    return { archive, restored };
}

async function openArchive(prefix) {
    const name = process.argv[3];
    if (!name || !new RegExp('^' + prefix + '-[0-9]+\\.7z$').test(name) || path.basename(name) !== name) throw new Error('Supply only the known archive basename');
    const actual = fs.realpathSync(path.join(root, name));
    if (path.dirname(actual) !== fs.realpathSync(root)) throw new Error('Archive path escaped backup directory');
    const destination = path.join(workingDirectory(), 'recovered');
    fs.mkdirSync(destination);
    await archiveRun(['x', '-o' + destination, actual]);
    return destination;
}

function localSource() {
    const url = new URL(env.DATABASE_URL);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/babybook' || url.search || url.hash) throw new Error('Only existing local babybook is permitted');
    return { url, pool: new Pool({ connectionString: env.DATABASE_URL, ssl: false, connectionTimeoutMillis: 10000 }) };
}

function productionSource() {
    if (!credentials.productionDatabaseUrl || !credentials.productionEncryptionKey) throw new Error('Run ImportProduction first');
    const url = productionUrl(credentials.productionDatabaseUrl);
    // Separate fields prevent URI sslmode options overriding certificate checks.
    return { url, pool: new Pool({ host: url.hostname, port: 5432, database: 'postgres',
        user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
        ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000 }) };
}

const recoveryNames = ['babybook_stage0_recovery', 'babybook_stage0_production_recovery', 'babybook_stage0_migration_rehearsal'];
function isolatedPool(database = 'postgres') {
    if (database !== 'postgres' && !recoveryNames.includes(database)) throw new Error('Recovery target refused');
    return new Pool({ host: '127.0.0.1', port: 55432, user: 'bb_stage0_admin',
        password: credentials.adminPassword, database, ssl: false, connectionTimeoutMillis: 5000 });
}

async function emptyRecovery(database) {
    if (!recoveryNames.includes(database)) throw new Error('Recovery target refused');
    const admin = isolatedPool();
    try {
        const server = (await admin.query("SELECT current_setting('server_version_num')::int AS version, current_setting('data_directory') AS directory")).rows[0];
        if (server.version < 170000 || server.version >= 180000
            || path.resolve(server.directory).toLowerCase() !== path.resolve(stage0Root, 'data17').toLowerCase()) throw new Error('Not isolated Stage 0 cluster');
        const found = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
        if (!found.rows.length) await admin.query('CREATE DATABASE ' + quote(database) + ' OWNER bb_stage0_admin TEMPLATE template0');
        await admin.query('REVOKE CONNECT ON DATABASE ' + quote(database) + ' FROM PUBLIC');
        const privilege = (await admin.query("SELECT has_database_privilege('bb_stage0_test',$1,'CONNECT') AS allowed", [database])).rows[0];
        if (privilege.allowed) throw new Error('Test role can access recovery');
    } finally { await admin.end(); }
    const target = isolatedPool(database);
    try {
        const objects = (await target.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'")).rows[0].count;
        if (objects !== 0) throw new Error('Recovery database is nonempty; contents preserved');
        return target;
    } catch (error) { await target.end(); throw error; }
}

function restoreDump(dump, database) {
    phase = 'isolated PostgreSQL 17 restore';
    run(path.join(bin, 'pg_restore.exe'), ['--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', '-d', database, dump], {
        PGHOST: '127.0.0.1', PGPORT: '55432', PGUSER: 'bb_stage0_admin',
        PGPASSWORD: credentials.adminPassword, PGSSLMODE: 'disable', PGOPTIONS: '',
    });
}

async function securityMetadata(client) {
    const queries = {
        columns: "SELECT table_name,column_name,data_type,column_default,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
        constraints: "SELECT c.relname AS table_name,con.conname,con.contype,con.convalidated,pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,con.conname",
        indexes: "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
        rls: "SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind IN ('r','p') ORDER BY relname",
        policies: "SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname",
        grants: "SELECT * FROM information_schema.role_table_grants WHERE table_schema='public' ORDER BY table_name,grantee,privilege_type",
        extensions: "SELECT extname,extversion,n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY extname",
        sequences: "SELECT sequencename,start_value,min_value,max_value,increment_by,cycle,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename",
    };
    const result = {};
    for (const [name, sql] of Object.entries(queries)) result[name] = (await client.query(sql)).rows;
    return result;
}

async function database(production, preservationOnly = false) {
    if (preservationOnly && !production) throw new Error('Preservation mode is production backup only');
    if (!process.stdin.isTTY) throw new Error('Encrypted backup requires interactive terminal');
    const source = production ? productionSource() : localSource();
    const databaseName = production ? 'babybook_stage0_production_recovery' : 'babybook_stage0_recovery';
    let target, client;
    try {
        target = await emptyRecovery(databaseName);
        client = await source.pool.connect();
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const snapshot = (await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
        const tables = await tableEvidence(client), metadata = await securityMetadata(client);
        if (production) {
            const managed = (await client.query('SELECT (SELECT count(*)::int FROM auth.users) AS auth_users,(SELECT count(*)::int FROM vault.secrets) AS vault_secrets')).rows[0];
            const extra = (await client.query("SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('public','auth','storage','extensions','vault','graphql','graphql_public','realtime','supabase_migrations','information_schema','pgbouncer','pgsodium','pgsodium_masks','_realtime','net') AND nspname NOT LIKE 'pg_%'")).rows;
            if (managed.auth_users || managed.vault_secrets || extra.length) throw new Error('Additional data needs reviewed backup scope');
            // Platform configuration is evidence, not blindly reapplied to local PG.
            metadata.storageBuckets = (await client.query('SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id')).rows;
            metadata.storagePolicies = (await client.query("SELECT * FROM pg_policies WHERE schemaname='storage' ORDER BY tablename,policyname")).rows;
        }
        const label = production ? 'production-application' : 'local-development';
        const dump = path.join(workingDirectory(), label + '.dump');
        phase = production ? 'verified-TLS production dump (read only)' : 'local dump (read only)';
        run(path.join(bin, 'pg_dump.exe'), ['-Fc', '--no-owner', '--no-acl', ...(production ? ['--schema=public'] : []), '--snapshot=' + snapshot, '--file=' + dump], {
            PGHOST: source.url.hostname, PGPORT: source.url.port || '5432', PGDATABASE: production ? 'postgres' : 'babybook',
            PGUSER: decodeURIComponent(source.url.username), PGPASSWORD: decodeURIComponent(source.url.password),
            PGSSLMODE: production ? 'verify-full' : 'disable',
            PGSSLROOTCERT: production ? (process.env.PGSSLROOTCERT || 'system') : '', PGOPTIONS: '',
        });
        await client.query('COMMIT');
        const manifest = { createdAt: new Date().toISOString(), project: production ? PRODUCTION_PROJECT : null,
            scope: production ? 'all public application tables INCLUDING legacy tables; separate Storage backup required' : 'local development ONLY',
            fullSupabasePlatformBackup: false, tables, metadata, sha256: sha256(fs.readFileSync(dump)) };
        const manifestPath = path.join(workingDirectory(), 'database-manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest));
        const sealed = await seal([dump, manifestPath], label);
        restoreDump(path.join(sealed.restored, path.basename(dump)), databaseName);
        if (JSON.stringify(await tableEvidence(target)) !== JSON.stringify(tables)) throw new Error('Restored counts or row hashes differ');
        const recovered = await securityMetadata(target);
        for (const key of ['columns', 'constraints', 'indexes', 'rls', 'policies', 'sequences']) {
            if (JSON.stringify(recovered[key]) !== JSON.stringify(metadata[key])) throw new Error('Restored schema/sequence evidence differs');
        }
        const audit = await auditEncryption(target, { intended: production ? credentials.productionEncryptionKey : (env.DATA_ENCRYPTION_KEY || env.JWT_SECRET) });
        const ciphertextReadable = Boolean(audit.candidates.intended && !audit.candidates.intended.unreadable);
        console.log(JSON.stringify({ scope: manifest.scope, archive: path.basename(sealed.archive), restoredTables: Object.keys(tables).length,
            rowsAndSchemaMatch: true, encryptedArchiveRecovery: true, ciphertextPreserved: true, ciphertextReadable,
            preservationOnly, stage0Signoff: false, encryption: audit, productionWrites: false, providerRolesAndGrantsRestored: false }));
        phase = 'ciphertext readability gate';
        if (!ciphertextReadable && !preservationOnly) throw new Error('Encryption blocks recovery signoff');
    } finally {
        if (client) { try { await client.query('ROLLBACK'); } catch {} client.release(); }
        await source.pool.end(); if (target) await target.end();
    }
}

async function audit(production, productionJwt = null) {
    const source = production ? productionSource() : localSource();
    let client;
    try {
        client = await source.pool.connect();
        phase = 'read-only ciphertext classification';
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL statement_timeout='30s'");
        await client.query("SET LOCAL lock_timeout='3s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout='30s'");
        const readOnly = await client.query("SELECT current_setting('transaction_read_only') AS read_only");
        if (readOnly.rows[0].read_only !== 'on') throw new Error('Read-only transaction required');
        const candidates = { local: env.DATA_ENCRYPTION_KEY || env.JWT_SECRET,
            production: credentials.productionEncryptionKey || null, localJwtFallback: env.JWT_SECRET || null };
        if (productionJwt !== null) candidates.productionJwt = productionJwt;
        const result = await auditEncryption(client, candidates);
        console.log(JSON.stringify({ scope: production ? 'production read-only' : 'original local read-only',
            keyEquality: credentials.productionEncryptionKey ? (env.DATA_ENCRYPTION_KEY || env.JWT_SECRET) === credentials.productionEncryptionKey : 'unverified', encryption: result }));
    } finally { if (client) { try { await client.query('ROLLBACK'); } catch {} client.release(); } await source.pool.end(); }
}

async function auditProductionJwt() {
    phase = 'private candidate input';
    if (process.stdin.isTTY) throw new Error('Use the masked AuditProductionJwt PowerShell action');
    const candidate = parseEncryptionCandidate(fs.readFileSync(0, 'utf8'));
    // Additional candidate only: no vault, environment file, key or record updates.
    await audit(true, candidate);
}

function storageClient(development) {
    const { createClient } = require(path.join(backend, 'node_modules/@supabase/supabase-js'));
    const project = development ? DEVELOPMENT_PROJECT : PRODUCTION_PROJECT;
    const key = development ? credentials.developmentStorageKey : env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('Run ImportDevelopment first');
    if (!development && new URL(env.SUPABASE_URL).hostname !== project + '.supabase.co') throw new Error('Production Storage project refused');
    return createClient('https://' + project + '.supabase.co', key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) }) },
    }).storage;
}

async function privateBuckets(storage, names) {
    const result = await storage.listBuckets();
    if (result.error || !names.every(name => result.data.some(bucket => bucket.id === name && !bucket.public))) throw new Error('Service key/private buckets not verified');
}

async function development() {
    phase = 'development private Storage/key verification';
    await privateBuckets(storageClient(true), ['attachments', 'stage0-recovery']);
    console.log(JSON.stringify({ project: DEVELOPMENT_PROJECT, privateBuckets: ['attachments', 'stage0-recovery'], serviceKeyVerified: true, writes: false }));
}

async function attachments() {
    if (!process.stdin.isTTY) throw new Error('Encrypted backup requires interactive terminal');
    const storage = storageClient(false), bucket = 'attachments';
    await privateBuckets(storage, [bucket]);
    const files = [], objects = [];
    async function walk(prefix = '') {
        for (let offset = 0; ; offset += 1000) {
            const list = await storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
            if (list.error) throw new Error('Attachment listing failed');
            for (const item of list.data) {
                const key = prefix ? prefix + '/' + item.name : item.name;
                if (!item.id) { await walk(key); continue; }
                const result = await storage.from(bucket).download(key);
                if (result.error) throw new Error('Attachment download failed');
                const bytes = Buffer.from(await result.data.arrayBuffer());
                const file = path.join(workingDirectory(), sha256(key) + '.bin');
                fs.writeFileSync(file, bytes); files.push(file);
                objects.push({ key, file: path.basename(file), size: bytes.length, sha256: sha256(bytes), metadata: item.metadata });
            }
            if (list.data.length < 1000) break;
        }
    }
    phase = 'read-only production private attachment backup';
    await walk();
    const manifest = path.join(workingDirectory(), 'attachment-manifest.json');
    fs.writeFileSync(manifest, JSON.stringify({ createdAt: new Date().toISOString(), project: PRODUCTION_PROJECT, bucket, objects }));
    files.push(manifest);
    const sealed = await seal(files, 'private-attachments');
    console.log(JSON.stringify({ scope: 'production private attachments', archive: path.basename(sealed.archive), objects: objects.length,
        encryptedArchiveRecovery: true, recoveredBytesMatch: true, productionUploadsOrDeletes: false, isolatedReupload: 'pending' }));
}

async function recoverAttachments() {
    const storage = storageClient(true), bucket = 'stage0-recovery';
    await privateBuckets(storage, [bucket]);
    const list = await storage.from(bucket).list('', { limit: 1 });
    if (list.error || list.data.length) throw new Error('Recovery bucket nonempty; no overwrite permitted');
    const directory = await openArchive('private-attachments');
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'attachment-manifest.json')));
    if (manifest.project !== PRODUCTION_PROJECT || manifest.bucket !== 'attachments' || !manifest.objects.length) throw new Error('Manifest scope refused');
    // Validate every path and hash BEFORE the first upload.
    for (const object of manifest.objects) {
        if (!/^[a-f0-9]{64}\.bin$/.test(object.file) || object.file !== sha256(object.key) + '.bin'
            || object.key.split('/').some(segment => !segment || segment === '.' || segment === '..') || object.key.includes('\\')) throw new Error('Manifest path refused');
        const bytes = fs.readFileSync(path.join(directory, object.file));
        if (bytes.length !== object.size || sha256(bytes) !== object.sha256) throw new Error('Recovered attachment hash mismatch');
    }
    phase = 'isolated private development bucket recovery';
    for (const object of manifest.objects) {
        const bytes = fs.readFileSync(path.join(directory, object.file));
        const uploaded = await storage.from(bucket).upload(object.key, bytes, { upsert: false, contentType: object.metadata?.mimetype || 'application/octet-stream' });
        if (uploaded.error) throw new Error('Private recovery upload failed; objects preserved');
        const downloaded = await storage.from(bucket).download(object.key);
        if (downloaded.error || sha256(Buffer.from(await downloaded.data.arrayBuffer())) !== object.sha256) throw new Error('Private recovery hash mismatch');
        const unsigned = await fetch('https://' + DEVELOPMENT_PROJECT + '.supabase.co/storage/v1/object/public/' + bucket + '/' + object.key.split('/').map(encodeURIComponent).join('/'), { signal: AbortSignal.timeout(15000) });
        if (![400, 401, 403, 404].includes(unsigned.status)) throw new Error('Unsigned privacy check inconclusive');
        const signed = await storage.from(bucket).createSignedUrl(object.key, 60);
        if (signed.error) throw new Error('Private signed URL failed');
        const response = await fetch(signed.data.signedUrl, { signal: AbortSignal.timeout(15000) });
        if (!response.ok || sha256(Buffer.from(await response.arrayBuffer())) !== object.sha256) throw new Error('Signed bytes mismatch');
    }
    console.log(JSON.stringify({ project: DEVELOPMENT_PROJECT, bucket, recoveredObjects: manifest.objects.length, bytesMatch: true,
        unsignedAccessDenied: true, shortSignedAccessVerified: true, productionWrites: false, privateRecoveredObjectsPreserved: true }));
}

async function rehearseMigrations() {
    const directory = await openArchive('production-application'), dump = path.join(directory, 'production-application.dump');
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'database-manifest.json')));
    if (manifest.project !== PRODUCTION_PROJECT || sha256(fs.readFileSync(dump)) !== manifest.sha256) throw new Error('Production archive scope/hash refused');
    const databaseName = 'babybook_stage0_migration_rehearsal', target = await emptyRecovery(databaseName);
    try {
        restoreDump(dump, databaseName);
        if (JSON.stringify(await tableEvidence(target)) !== JSON.stringify(manifest.tables)) throw new Error('Restored rows differ');
        const audit = await auditEncryption(target, { production: credentials.productionEncryptionKey });
        if (!audit.candidates.production || audit.candidates.production.unreadable) throw new Error('Encryption gate failed; no migrations applied');
        const applied = new Set((await target.query('SELECT filename FROM schema_migrations')).rows.map(row => row.filename));
        const folder = path.join(backend, 'src/db/migrations');
        const pending = fs.readdirSync(folder).filter(name => name.endsWith('.sql') && !applied.has(name)).sort();
        if (pending.length !== 9 || pending.some(name => !/^(009|01[0-7])_/.test(name))) throw new Error('Migration gap changed; review required');
        const client = await target.connect();
        try {
            // Atomic rehearsal; NOT an authorization to apply the batch in production.
            await client.query('BEGIN');
            for (const name of pending) {
                await client.query(fs.readFileSync(path.join(folder, name), 'utf8'));
                await client.query('INSERT INTO schema_migrations(filename) VALUES($1)', [name]);
            }
            // Migration ledger changes are expected; original clinical and legacy
            // tables must be byte-for-byte unchanged on their original columns.
            const original = Object.fromEntries(Object.entries(manifest.tables).filter(([name]) => name !== 'schema_migrations'));
            const columns = Object.fromEntries(Object.entries(original).map(([name, data]) => [name, data.columns]));
            if (JSON.stringify(await tableEvidence(client, columns)) !== JSON.stringify(original)) throw new Error('Original/legacy rows changed');
            await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
        console.log(JSON.stringify({ isolatedDatabase: databaseName, migrations: pending, originalAndLegacyRowsUnchanged: true,
            productionWrites: false, productionMigrationApproval: 'requires a scoped release review' }));
    } finally { await target.end(); }
}

async function main() {
    if (!modes.includes(mode)) throw new Error('Unknown mode');
    credentials = readCredentials();
    const actions = { db: () => database(false), 'production-db': () => database(true),
        'production-preservation': () => database(true, true), attachments,
        'audit-local': () => audit(false), 'audit-production': () => audit(true),
        'audit-production-jwt': auditProductionJwt, 'verify-development': development,
        'recover-attachments': recoverAttachments, 'rehearse-migrations': rehearseMigrations };
    try { await actions[mode](); }
    finally {
        if (staging) {
            const resolved = fs.realpathSync(staging), backupRoot = fs.realpathSync(root);
            if (!resolved.startsWith(backupRoot + path.sep) || !path.basename(resolved).startsWith('.stage0-')) throw new Error('Staging cleanup refused');
            fs.rmSync(resolved, { recursive: true }); // Fresh working files only; archives kept.
        }
    }
}
main().catch(() => {
    // Never forward PG/SDK/7-Zip exceptions: they may contain secrets or PHI.
    console.error(JSON.stringify({ failed: true, phase, secretsAndPatientDataOmitted: true,
        nextStep: 'See Documents/Stage-0-Next-Actions.md. Do not rotate keys or retry against important data.' }));
    process.exitCode = 1;
});
