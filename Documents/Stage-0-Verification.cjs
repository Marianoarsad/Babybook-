const crypto = require('node:crypto');
const PRODUCTION_PROJECT = 'icssxprtxspcgmkompdj';
const DEVELOPMENT_PROJECT = 'yrkvntaqkikuofbpfmkh';
const quote = name => '"' + name.replaceAll('"', '""') + '"';

function productionUrl(value) {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
        || !/^aws-[0-9]+-ap-southeast-1\.pooler\.supabase\.com$/.test(url.hostname)
        || url.port !== '5432' || url.pathname !== '/postgres'
        || decodeURIComponent(url.username) !== `postgres.${PRODUCTION_PROJECT}` || !url.password
        || url.search || url.hash) {
        throw new Error('Expected the confirmed production Session pooler; source refused');
    }
    return url;
}

// Private stdin protocol for a one-run candidate; never include its input in an error.
function parseEncryptionCandidate(input) {
    if (typeof input !== 'string' || Buffer.byteLength(input, 'utf8') > 16384) {
        throw new Error('Invalid private candidate input');
    }
    let parsed;
    try { parsed = JSON.parse(input); } catch { throw new Error('Invalid private candidate input'); }
    if (!parsed || Array.isArray(parsed) || Object.keys(parsed).length !== 1
        || typeof parsed.candidateKey !== 'string' || !parsed.candidateKey.trim()
        || parsed.candidateKey.length > 8192) {
        throw new Error('Invalid private candidate input');
    }
    return parsed.candidateKey; // Preserve exact characters; no trimming or normalization.
}

function encryptedState(value, secret) {
    const encoded = value.slice(7);
    const raw = Buffer.from(encoded, 'base64');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || raw.toString('base64') !== encoded) return 'malformed';
    if (raw.length < 28) return 'too_short';
    if (!secret) return 'key_unavailable';
    try {
        const key = crypto.createHash('sha256').update(String(secret)).digest();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        decipher.update(raw.subarray(28));
        decipher.final();
        return 'readable';
    } catch { return 'authentication_failed'; }
}

function encryptedValues(value) {
    if (typeof value === 'string') return value.startsWith('enc:v1:') ? [value] : [];
    if (!value || typeof value !== 'object') return [];
    return Object.values(value).flatMap(encryptedValues);
}

async function auditEncryption(client, secrets) {
    const fields = await client.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND data_type IN ('text','character varying','json','jsonb') ORDER BY table_name,column_name");
    const result = { encryptedValues: 0, malformedValues: 0, candidates: {} };
    for (const [name, secret] of Object.entries(secrets)) {
        result.candidates[name] = secret ? { readable: 0, unreadable: 0 } : null;
    }
    for (const field of fields.rows) {
        const rows = await client.query(`SELECT ${quote(field.column_name)} AS value FROM public.${quote(field.table_name)} WHERE ${quote(field.column_name)}::text LIKE '%enc:v1:%'`);
        for (const row of rows.rows) for (const value of encryptedValues(row.value)) {
            result.encryptedValues++;
            if (['malformed', 'too_short'].includes(encryptedState(value, null))) result.malformedValues++;
            for (const [name, secret] of Object.entries(secrets)) {
                if (secret) result.candidates[name][encryptedState(value, secret) === 'readable' ? 'readable' : 'unreadable']++;
            }
        }
    }
    return result;
}

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Row payloads stay in memory; reports contain only aggregate hashes/counts.
async function tableEvidence(client, columns = null) {
    await client.query("SET TIME ZONE 'UTC'");
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    const result = {};
    for (const { tablename } of tables) {
        if (columns && !columns[tablename]) continue;
        const names = columns?.[tablename] || (await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [tablename]
        )).rows.map(row => row.column_name);
        const rows = (await client.query(`SELECT row_to_json(r)::text AS payload FROM (SELECT ${names.map(quote).join(',')} FROM public.${quote(tablename)}) r`)).rows;
        result[tablename] = { columns: names, rows: rows.length, sha256: sha256(rows.map(row => sha256(row.payload)).sort().join('\n')) };
    }
    return result;
}

module.exports = { PRODUCTION_PROJECT, DEVELOPMENT_PROJECT, quote, productionUrl, parseEncryptionCandidate, encryptedState, auditEncryption, tableEvidence, sha256 };
