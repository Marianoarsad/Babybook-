const express = require("express");
const { withTransaction } = require("../db/pool");
const { hashShareToken } = require("../utils/shareCode");
const { openPayload, authorizedSnapshot, RECORD_LABELS, PURGED_PAYLOAD_SQL } = require("../utils/snapshot");
const { inputCredentials, privateResponse, limitAccess } = require("../utils/consultationAccess");

const router = express.Router();
router.use(privateResponse);
const fail = (status, error, http = 410) => ({ http, body: { status, error } });

async function access(req, resolving) {
    const credentials = inputCredentials(req.body);
    if (!credentials) return fail("invalid", "Unrecognized code or link", 400);
    const professionalName = typeof req.body.professionalName === "string" ? req.body.professionalName.trim() : "";
    if (resolving && (!professionalName || professionalName.length > 100 || /[\x00-\x1f\x7f]/.test(professionalName))) {
        return fail("invalid", "Enter your name (up to 100 characters) before viewing records.", 400);
    }
    return withTransaction(async (client) => {
        const params = [credentials.code];
        if (credentials.shareToken) params.push(hashShareToken(credentials.shareToken));
        const { rows } = await client.query(`
            SELECT id, child_id, code, status, shared_record_keys, expiration_date, generate_date,
                clock_timestamp() AS server_now, expiration_date <= clock_timestamp() AS overdue,
                payload = '{}'::jsonb AS purged ${resolving ? ", payload" : ""}
            FROM shared_records WHERE code = $1
                ${credentials.shareToken ? "AND share_token_hash = $2" : ""} FOR UPDATE`, params);
        const share = rows[0];
        if (!share) return fail("notfound", "Code not found", 404);
        if (share.status === "revoked") return fail("revoked", "This code was revoked by the parent");
        if (share.status === "expired" || share.overdue) {
            if (share.status === "active") await client.query(
                "UPDATE shared_records SET status = 'expired', payload = $2 WHERE id = $1 AND status = 'active'",
                [share.id, PURGED_PAYLOAD_SQL]);
            return fail("expired", "This code has expired");
        }
        if (share.purged) return fail("unavailable", "These shared records are no longer available. Ask the parent for a new code.");
        const result = { status: "ok", expiresAt: share.expiration_date, serverNow: share.server_now };
        if (!resolving) return { http: 200, body: result };
        const recordKeys = [...new Set((Array.isArray(share.shared_record_keys) ? share.shared_record_keys : [])
            .filter((key) => Object.hasOwn(RECORD_LABELS, key)))];
        let payload;
        try { payload = authorizedSnapshot(openPayload(share.payload), recordKeys); }
        catch { return fail("unreadable", "These records cannot be read safely. Ask the parent for a new code.", 503); }
        if (!payload || !Object.keys(payload).length) {
            return fail("unreadable", "These records cannot be read safely. Ask the parent for a new code.", 503);
        }
        await client.query(`
            INSERT INTO access_logs (share_id, child_id, code, professional_name, action, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [share.id, share.child_id, share.code, professionalName, "Viewed shared records", req.ip, (req.get("user-agent") || "").slice(0, 512)]);
        return { http: 200, body: { ...result, childName: payload.profile?.name || "Shared Baby Records",
            recordKeys, payload, capturedAt: share.generate_date } };
    });
}

for (const scope of ["resolve", "status"]) {
    router.post("/" + scope, async (req, res) => {
        try {
            if (!await limitAccess(req, res, scope)) return;
            const result = await access(req, scope === "resolve");
            res.status(result.http).json(result.body);
        } catch {
            res.status(503).json({ status: "temporarily_unavailable",
                error: "Sharing is temporarily unavailable. Please try again shortly." });
        }
    });
}
module.exports = router;
