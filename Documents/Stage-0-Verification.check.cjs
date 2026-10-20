const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { productionUrl, parseEncryptionCandidate, encryptedState, auditEncryption, tableEvidence } = require('./Stage-0-Verification.cjs');
const valid = 'postgresql://postgres.icssxprtxspcgmkompdj:fictional@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
assert.equal(productionUrl(valid).port, '5432');
for (const uri of [valid.replace('5432', '6543'), valid.replace('icssxprtxspcgmkompdj', 'other'), valid.replace('/postgres', '/babybook'), valid.replace('ap-southeast-1', 'us-east-1'), 'postgres://fictional@localhost:5432/postgres']) {
    assert.throws(() => productionUrl(uri));
}
assert.throws(() => productionUrl(valid + '?sslmode=disable'));
const privateCandidate = ' fictional-\u00e9-"-\\-key ';
assert.equal(parseEncryptionCandidate(JSON.stringify({ candidateKey: privateCandidate })), privateCandidate);
for (const packet of ['not-json-with-fictional-key', 'null', '[]', '{}', '"fictional-key"',
    '{"candidateKey":null}', '{"candidateKey":0}', '{"candidateKey":" "}',
    '{"candidateKey":"fictional","extra":true}', JSON.stringify({ candidateKey: 'x'.repeat(8193) }),
    ' '.repeat(16385)]) {
    assert.throws(() => parseEncryptionCandidate(packet), error =>
        error.message === 'Invalid private candidate input');
}
const key = crypto.createHash('sha256').update('fictional').digest();
const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update('fictional', 'utf8'), cipher.final()]);
const value = 'enc:v1:' + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
assert.equal(encryptedState(value, 'fictional'), 'readable');
assert.equal(encryptedState(value, 'different'), 'authentication_failed');
assert.equal(encryptedState(value, null), 'key_unavailable');
assert.equal(encryptedState('enc:v1:!', 'fictional'), 'malformed');
assert.equal(encryptedState('enc:v1:AA==', 'fictional'), 'too_short');

(async () => {
    const fake = { query: async sql => ({ rows: sql.includes('information_schema')
        ? [{ table_name: 'fictional', column_name: 'snapshot' }]
        : [{ value: { nested: [value, 'not encrypted'] } }] }) };
    const audit = await auditEncryption(fake, { local: 'fictional', production: null,
        productionJwt: 'fictional', incorrectCandidate: 'different' });
    assert.equal(audit.encryptedValues, 1);
    assert.equal(audit.candidates.local.unreadable, 0);
    assert.equal(audit.candidates.production, null);
    assert.deepEqual(audit.candidates.productionJwt, { readable: 1, unreadable: 0 });
    assert.deepEqual(audit.candidates.incorrectCandidate, { readable: 0, unreadable: 1 });
    assert(!JSON.stringify(audit).includes('enc:v1:'));
    assert(!JSON.stringify(audit).includes('fictional'));
    const tableClient = payloads => ({ query: async sql => ({ rows: sql.includes('pg_tables')
        ? [{ tablename: 'fictional' }] : sql.includes('information_schema')
            ? [{ column_name: 'name' }] : sql.includes('row_to_json')
                ? payloads.map(payload => ({ payload })) : [] }) });
    const evidence = await tableEvidence(tableClient(['{"name":"one"}', '{"name":"two"}']));
    assert.deepEqual(evidence, await tableEvidence(tableClient(['{"name":"two"}', '{"name":"one"}'])));
    assert.notDeepEqual(evidence, await tableEvidence(tableClient(['{"name":"one"}', '{"name":"one"}'])));
    assert(!JSON.stringify(evidence).includes('"two"'));
    const helper = fs.readFileSync(path.join(__dirname, 'Stage-0-Backup.cjs'), 'utf8');
    assert(!helper.includes('credentials.archivePassword'));
    assert(helper.includes("'-mhe=on', '-p'"));
    assert(helper.includes('if (!process.stdin.isTTY)'));
    assert(helper.includes("PGSSLMODE: production ? 'verify-full'"));
    assert(helper.includes('upsert: false'));
    assert(helper.includes('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'));
    // Exercise the actual candidate action with SQL/DPAPI doubles, never a live DB.
    const statements = [], output = [];
    let released = 0, ended = 0;
    const queryClient = { query: async sql => {
        statements.push(sql);
        if (sql.includes("current_setting('transaction_read_only')")) return { rows: [{ read_only: 'on' }] };
        if (sql.includes('information_schema')) return { rows: [{ table_name: 'fictional', column_name: 'snapshot' }] };
        if (sql.startsWith('SELECT ')) return { rows: [{ value }] };
        return { rows: [] };
    }, release: () => { released++; } };
    class FakePool {
        constructor(options) { assert.equal(options.ssl.rejectUnauthorized, true); }
        async connect() { return queryClient; }
        async end() { ended++; }
    }
    const privatePacket = JSON.stringify({ candidateKey: 'fictional' });
    const mockRequire = name => {
        if (name === 'node:fs') return { readFileSync: file => {
            if (file === 0) return privatePacket;
            if (path.basename(file) === '.env') return '';
            throw new Error('Unexpected fixture file access');
        } };
        if (name === 'node:path') return path;
        if (name === 'node:child_process') return { execFileSync: () => { throw new Error('Actual vault access refused'); } };
        if (name === './Stage-0-Verification.cjs') return require(name);
        if (name.endsWith(path.join('node_modules', 'pg'))) return { Pool: FakePool };
        if (name.endsWith(path.join('node_modules', 'dotenv'))) return { parse: () => ({ DATA_ENCRYPTION_KEY: 'different' }) };
        throw new Error('Unexpected fixture dependency');
    };
    const definitions = helper.slice(0, helper.indexOf('\nasync function main()'));
    assert(definitions.length > 0);
    const action = new Function('require', '__dirname', 'console', 'process', definitions +
        '\ncredentials = Object.freeze({ productionDatabaseUrl: ' + JSON.stringify(valid) +
        ', productionEncryptionKey: "different" }); return auditProductionJwt;')(
        mockRequire, __dirname, { log: line => output.push(line) }, { argv: [], stdin: { isTTY: false } });
    await action();
    const privateReport = JSON.parse(output[0]);
    assert.equal(privateReport.scope, 'production read-only');
    assert.deepEqual(privateReport.encryption.candidates.production, { readable: 0, unreadable: 1 });
    assert.deepEqual(privateReport.encryption.candidates.productionJwt, { readable: 1, unreadable: 0 });
    assert(!output.join('').includes('fictional'));
    assert(!output.join('').includes('enc:v1:'));
    assert(statements[0].includes('REPEATABLE READ READ ONLY'));
    assert.equal(statements.at(-1), 'ROLLBACK');
    assert(statements.every(sql => /^(BEGIN |SET LOCAL |SELECT |ROLLBACK$)/.test(sql)));
    assert.equal(released, 1);
    assert.equal(ended, 1);
    // Execute the existing backup path with fictional dump/archive/DB doubles.
    async function checkPreservation(preservationOnly, mismatch = false) {
        const logs = [], sql = [], dumpSettings = [];
        const original = { fictional: { columns: ['id'], rows: 1, sha256: 'fictional-row-hash' } };
        const metadata = Object.fromEntries(['columns', 'constraints', 'indexes', 'rls', 'policies', 'sequences'].map(name => [name, []]));
        const sourceClient = { query: async statement => {
            sql.push(statement);
            if (statement.includes('pg_export_snapshot')) return { rows: [{ id: 'fictional-snapshot' }] };
            if (statement.includes('auth.users')) return { rows: [{ auth_users: 0, vault_secrets: 0 }] };
            return { rows: [] };
        }, release() {} };
        const target = { end: async () => {} };
        class BackupPool {
            constructor(options) { assert.equal(options.ssl.rejectUnauthorized, true); }
            async connect() { return sourceClient; }
            async end() {}
        }
        const deps = name => {
            if (name === 'node:fs') return { readFileSync: () => Buffer.from('fictional dump'), writeFileSync() {} };
            if (name === './Stage-0-Verification.cjs') return { ...require(name),
                tableEvidence: async client => client === target && mismatch ? {} : original,
                auditEncryption: async () => ({ encryptedValues: 4, malformedValues: 0,
                    candidates: { intended: { readable: 0, unreadable: 4 } } }) };
            if (name.endsWith(path.join('node_modules', 'pg'))) return { Pool: BackupPool };
            return mockRequire(name);
        };
        const fixture = { target, metadata, dumpSettings };
        const backup = new Function('require', '__dirname', 'console', 'process', 'fixture', definitions + `
            credentials = { productionDatabaseUrl: ${JSON.stringify(valid)}, productionEncryptionKey: 'different' };
            emptyRecovery = async database => { if (database !== 'babybook_stage0_production_recovery') throw new Error('Wrong target'); return fixture.target; };
            securityMetadata = async () => fixture.metadata;
            workingDirectory = () => '/fictional';
            run = (executable, args, settings) => fixture.dumpSettings.push(settings);
            seal = () => ({ archive: '/fictional/production-application-1.7z', restored: '/fictional/restored' });
            restoreDump = (dump, database) => { if (database !== 'babybook_stage0_production_recovery') throw new Error('Wrong restore'); };
            return database;
        `)(deps, __dirname, { log: line => logs.push(line) },
            { argv: [], stdin: { isTTY: true }, env: { PGSSLROOTCERT: 'fictional-ca.crt' } }, fixture);
        await assert.rejects(backup(false, true), /Preservation mode is production backup only/);
        if (mismatch) {
            await assert.rejects(backup(true, preservationOnly), /Restored counts or row hashes differ/);
            assert.equal(logs.length, 0);
        } else {
            if (preservationOnly) await backup(true, true);
            else await assert.rejects(backup(true), /Encryption blocks recovery signoff/);
            const report = JSON.parse(logs[0]);
            assert.equal(report.ciphertextPreserved, true);
            assert.equal(report.ciphertextReadable, false);
            assert.equal(report.stage0Signoff, false);
            assert.equal(report.productionWrites, false);
            assert.equal(report.preservationOnly, preservationOnly);
            assert(!logs.join('').includes('different'));
        }
        assert.equal(dumpSettings[0].PGSSLMODE, 'verify-full');
        assert.equal(dumpSettings[0].PGSSLROOTCERT, 'fictional-ca.crt');
        assert(sql.every(statement => /^(BEGIN |SELECT |COMMIT$|ROLLBACK$)/.test(statement)));
        assert.equal(sql.at(-1), 'ROLLBACK');
    }
    await checkPreservation(true);
    await checkPreservation(false);
    await checkPreservation(true, true);
    function archiveAction(spawnChild, tty, logs) {
        return new Function('require', '__dirname', 'console', 'process', definitions + '\nreturn archiveRun;')(
            name => name === 'node:child_process' ? { spawn: spawnChild,
                execFileSync: () => { throw new Error('Vault access refused'); } } : mockRequire(name),
            __dirname, { log: line => logs.push(line) }, { argv: [], stdin: { isTTY: tty } });
    }
    const promptLogs = [], archiveCalls = [];
    const fakeSpawn = (executable, args, options) => {
        archiveCalls.push({ executable, args, options });
        const child = new EventEmitter();
        child.stdout = new PassThrough(); child.stderr = new PassThrough();
        child.kill = () => { child.emit('close', null); };
        queueMicrotask(() => {
            child.stdout.emit('data', Buffer.from('fictional-private-path\nEnter pass'));
            child.stdout.emit('data', Buffer.from('word (will not be echoed):'));
            child.stdout.emit('data', Buffer.from('\nMethod = LZMA2 7zAES\n'));
            child.stderr.emit('data', Buffer.from('fictional-private-error'));
            child.emit('close', 0);
        });
        return child;
    };
    const archiveActionCheck = archiveAction(fakeSpawn, true, promptLogs);
    const listing = await archiveActionCheck(['l', '-slt', 'fictional.7z']);
    assert.match(listing.toString(), /7zAES/);
    assert.equal(promptLogs.filter(line => line.startsWith('7-Zip password:')).length, 1);
    assert(!promptLogs.join('').includes('fictional-private'));
    assert.deepEqual(archiveCalls[0].options.stdio, ['inherit', 'pipe', 'pipe']);
    assert.equal(archiveCalls[0].options.shell, undefined);
    assert(!archiveCalls[0].args.some(arg => /^-p.+/.test(arg)));
    await assert.rejects(archiveAction(fakeSpawn, false, [])(['t', 'fictional.7z']), /interactive PowerShell/);
    assert.equal(archiveCalls.length, 1);
    for (const failure of ['exit', 'start', 'overflow']) {
        const logs = [];
        const failingSpawn = () => {
            const child = new EventEmitter();
            child.stdout = new PassThrough(); child.stderr = new PassThrough();
            child.kill = () => { child.emit('close', null); };
            queueMicrotask(() => {
                if (failure === 'start') child.emit('error', new Error('fictional-private-error'));
                else if (failure === 'overflow') child.stdout.emit('data', Buffer.alloc(16 * 1024 * 1024 + 1));
                else child.emit('close', 2);
            });
            return child;
        };
        await assert.rejects(archiveAction(failingSpawn, true, logs)(['t', 'fictional.7z']), error =>
            /^7-Zip (failed|could not start); existing archives preserved$/.test(error.message));
        assert(!logs.join('').includes('fictional-private'));
    }
    // Exercise the actual shared prompt, encryption and byte recovery on fictional files only.
    if (process.argv[2] === '--archive-interactive') {
        assert(process.stdin.isTTY, 'Interactive console required');
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'babybook-stage0-archive-check-'));
        try {
            const file = path.join(directory, 'fictional.txt'), archive = path.join(directory, 'fictional.7z'), restored = path.join(directory, 'restored');
            fs.writeFileSync(file, 'fictional test data');
            fs.mkdirSync(restored);
            const actualArchiveRun = archiveAction(spawn, true, { push: line => console.log(line) });
            for (const args of [['a', '-t7z', '-mhe=on', '-p', archive, file], ['l', '-slt', archive], ['t', archive], ['x', '-o' + restored, archive]]) {
                console.log('Fictional check: use fictional-test-password when prompted (' + args[0] + ').');
                const output = (await actualArchiveRun(args)).toString();
                if (args[0] === 'l') assert.match(output, /Method = .*7zAES/);
            }
            assert(fs.readFileSync(file).equals(fs.readFileSync(path.join(restored, 'fictional.txt'))));
            console.log('Fictional encrypted archive, password input and recovered bytes verified.');
        } finally {
            const actual = fs.realpathSync(directory);
            assert(actual.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) && path.basename(actual).startsWith('babybook-stage0-archive-check-'));
            fs.rmSync(actual, { recursive: true });
        }
    } else if (process.argv[2]) throw new Error('Unknown self-check option');
    console.log('Stage 0 source guards, archive prompt/input handling, ciphertext preservation/readability gates and secret-free reports passed.');
})().catch(() => { console.error('Stage 0 verification self-check failed (no sensitive output).'); process.exitCode = 1; });
