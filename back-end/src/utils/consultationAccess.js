const crypto = require("node:crypto");
const { query } = require("../db/pool");
const { credentialsFromQrPayload } = require("./shareCode");

function inputCredentials(body) {
    const credentials = credentialsFromQrPayload(body?.code);
    if (!credentials) return null;
    if (body.shareToken !== undefined) {
        if (typeof body.shareToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.shareToken)
            || (credentials.shareToken && credentials.shareToken !== body.shareToken)) return null;
        credentials.shareToken = body.shareToken;
    }
    return credentials;
}

function privateResponse(req, res, next) {
    res.set({ "Cache-Control": "no-store, max-age=0", Pragma: "no-cache",
        "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" });
    next();
}

async function limitAccess(req, res, scope) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Access protection is unavailable");
    const digest = crypto.createHmac("sha256", secret)
        .update(String(req.ip || req.socket?.remoteAddress || "unknown").slice(0, 150)).digest("hex");
    // Only disposable abuse counters are discarded, never clinical/history tables.
    await query("DELETE FROM consultation_access_limits WHERE window_start < now() - interval '24 hours'");
    const { rows } = await query(`
        INSERT INTO consultation_access_limits (bucket_key, window_start, attempts) VALUES ($1, now(), 1)
        ON CONFLICT (bucket_key) DO UPDATE SET
            attempts = CASE WHEN consultation_access_limits.window_start <= now() - interval '5 minutes'
                THEN 1 ELSE consultation_access_limits.attempts + 1 END,
            window_start = CASE WHEN consultation_access_limits.window_start <= now() - interval '5 minutes'
                THEN now() ELSE consultation_access_limits.window_start END
        RETURNING attempts, GREATEST(1, CEIL(EXTRACT(EPOCH FROM window_start + interval '5 minutes' - now())))::int AS retry_seconds`,
        [scope + ":" + digest]);
    if (rows[0].attempts <= (scope === "resolve" ? 20 : 600)) return true;
    res.set("Retry-After", String(rows[0].retry_seconds));
    res.status(429).json({ status: "rate_limited", retryAfterSeconds: rows[0].retry_seconds,
        error: "Too many attempts. Please wait a few minutes before trying again." });
    return false;
}

module.exports = { inputCredentials, privateResponse, limitAccess };
