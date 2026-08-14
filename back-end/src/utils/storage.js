// File storage on Supabase Storage — replaces the old local-disk uploads.
//
// Why: local disk (multer.diskStorage) was served publicly and unauthenticated
// via express.static, and Render's filesystem is wiped on every redeploy/idle
// spin-down, so uploaded photos (immunisation cards, prescriptions, discharge
// papers, children's faces) were both exposed and impermanent. Supabase
// Storage buckets are private by default; every read goes through a
// short-lived signed URL, and objects survive redeploys.
//
// Storage refs are written into the SAME file_url/photo_url/avatar_url
// columns the app already had — no schema migration — as "sb://<key>",
// mirroring crypto.js's "enc:v1:" prefix trick: anything not carrying the
// prefix (an old dead local URL, or a URL a parent pasted directly into
// avatar_url) passes through resolveUrl() unchanged.

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const PREFIX = "sb://";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "attachments";
const SIGNED_URL_TTL = 3600; // 1 hour — long enough to cover a normal viewing session

let client = null;
function getClient() {
    if (client) return client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — required for file storage."
        );
    }
    client = createClient(url, key);
    return client;
}

function isStorageRef(value) {
    return typeof value === "string" && value.startsWith(PREFIX);
}

// Uploads a buffer, returns an "sb://<key>" reference to store in the DB —
// never a public URL.
async function uploadFile(buffer, mimeType, ext) {
    const key = `${crypto.randomUUID()}${ext ? "." + ext.replace(/^\./, "") : ""}`;
    const { error } = await getClient()
        .storage.from(BUCKET)
        .upload(key, buffer, { contentType: mimeType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return PREFIX + key;
}

// Resolves an "sb://<key>" reference to a fresh short-lived signed URL.
// Anything else (legacy dead local URL, a pasted external URL) is returned
// as-is. Never throws — a resolve failure degrades to a broken image, not a
// broken screen.
async function resolveUrl(ref, expiresInSeconds = SIGNED_URL_TTL) {
    if (!isStorageRef(ref)) return ref;
    const key = ref.slice(PREFIX.length);
    try {
        const { data, error } = await getClient()
            .storage.from(BUCKET)
            .createSignedUrl(key, expiresInSeconds);
        if (error) return null;
        return data.signedUrl;
    } catch (e) {
        console.error("[storage] resolveUrl failed:", e.message);
        return null;
    }
}

// Resolves `field` on every row in parallel — for list/GET responses.
async function resolveUrlField(rows, field, expiresInSeconds = SIGNED_URL_TTL) {
    return Promise.all(
        rows.map(async (row) => ({ ...row, [field]: await resolveUrl(row[field], expiresInSeconds) }))
    );
}

// Best-effort delete, mirrors the old unlinkFor()'s "don't fail the request" behavior.
async function deleteFile(ref) {
    if (!isStorageRef(ref)) return;
    const key = ref.slice(PREFIX.length);
    try {
        await getClient().storage.from(BUCKET).remove([key]);
    } catch (e) {
        console.error("[storage] deleteFile failed:", e.message);
    }
}

module.exports = { uploadFile, resolveUrl, resolveUrlField, deleteFile, isStorageRef, BUCKET };
