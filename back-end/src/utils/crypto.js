// Application-level field encryption (encryption at rest for sensitive data).
//
// Goal: if the database is ever breached, the stored sensitive values are
// unusable ciphertext. The decryption key lives only in the backend
// environment (DATA_ENCRYPTION_KEY), never in the database.
//
// Algorithm: AES-256-GCM (authenticated encryption).
//   stored value = "enc:v1:" + base64( iv[12] | authTag[16] | ciphertext )
//
// Backward-compatible by design: decrypt() passes through any value that is
// not "enc:v1:"-prefixed, so pre-existing plaintext rows and seed data keep
// working, and encryption can be rolled out without a data migration.

const crypto = require("crypto");

const PREFIX = "enc:v1:";
let cachedKey = null;

function getKey() {
    if (cachedKey) return cachedKey;
    const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            "DATA_ENCRYPTION_KEY is not set — required to encrypt/decrypt sensitive fields."
        );
    }
    if (!process.env.DATA_ENCRYPTION_KEY) {
        // Falls back to JWT_SECRET so the app still runs, but every backend that
        // shares a database MUST use the SAME DATA_ENCRYPTION_KEY, or values
        // written by one can't be read by another.
        console.warn(
            "[crypto] DATA_ENCRYPTION_KEY not set — falling back to JWT_SECRET. Set a dedicated key in production."
        );
    }
    // Derive a stable 32-byte key from the secret.
    cachedKey = crypto.createHash("sha256").update(String(secret)).digest();
    return cachedKey;
}

function isEncrypted(value) {
    return typeof value === "string" && value.startsWith(PREFIX);
}

// Encrypt a scalar value. Non-strings and null/undefined pass through untouched.
function encrypt(value) {
    if (value === null || value === undefined) return value;
    const plain = String(value);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
    const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

// Decrypt a value. Anything not "enc:v1:"-prefixed is returned as-is
// (so existing plaintext and seed data still read correctly).
function decrypt(value) {
    if (!isEncrypted(value)) return value;
    try {
        const raw = Buffer.from(value.slice(PREFIX.length), "base64");
        const iv = raw.subarray(0, 12);
        const tag = raw.subarray(12, 28);
        const ct = raw.subarray(28);
        const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
    } catch (e) {
        // Wrong key / corrupted value — don't crash the request.
        console.error("[crypto] decrypt failed:", e.message);
        return value;
    }
}

// Return a shallow copy of `obj` with the given string fields encrypted.
function encryptFields(obj, fields) {
    if (!obj) return obj;
    const out = { ...obj };
    for (const f of fields) {
        if (out[f] !== undefined && out[f] !== null && out[f] !== "") out[f] = encrypt(out[f]);
    }
    return out;
}

// Return a shallow copy of a DB row with the given fields decrypted.
function decryptRow(row, fields) {
    if (!row) return row;
    const out = { ...row };
    for (const f of fields) {
        if (out[f] !== undefined && out[f] !== null) out[f] = decrypt(out[f]);
    }
    return out;
}

module.exports = { encrypt, decrypt, encryptFields, decryptRow, isEncrypted, ENC_PREFIX: PREFIX };
