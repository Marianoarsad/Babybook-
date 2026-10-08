// Generates human-readable consultation codes and the QR payload string.
// Mirrors the front-end shareStore format so codes are consistent.

const crypto = require("node:crypto");
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes ambiguous chars
const DEFAULT_VIEWER_URL = "https://babybook-plus.expo.app/";

function generateCode() {
    let s = "";
    for (let i = 0; i < 8; i++) {
        s += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
        if (i === 3) s += "-";
    }
    return s; // e.g. "AB7K-2P9Q"
}

function viewerUrl() {
    const url = new URL(process.env.CONSULT_VIEWER_URL || DEFAULT_VIEWER_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
        || url.pathname !== "/" || /^(localhost|127\.|\[::1\])/.test(url.hostname)) {
        throw new Error("A stable HTTPS viewer root is required");
    }
    return url;
}

function generateShareToken() {
    return crypto.randomBytes(32).toString("base64url");
}

function hashShareToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function qrPayloadForCode(code, token) {
    if (!token) return "BABYBOOK+CONSULT:" + code;
    const url = viewerUrl();
    url.hash = new URLSearchParams({ consult: code, token }).toString();
    if (url.href.length > 255) throw new Error("Viewer link is too long");
    return url.href;
}

// Normalizes a professional's manually-typed (or copy-pasted) code before
// matching. Handles the two things real-world text input does to a code
// like "AB7K-2P9Q" that the strict [A-Z0-9-] charset otherwise rejects:
//   - stray whitespace around/inside it (trailing spaces, a line break from
//     copy-pasting the QR caption, a space typed either side of the dash)
//   - "smart" typography some keyboards/browsers substitute for a plain
//     hyphen ("-") when autocorrect/smart-punctuation is on: en dash (–),
//     em dash (—), minus sign (−), and similar Unicode dash variants
// U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure dash, U+2013 en
// dash, U+2014 em dash, U+2015 horizontal bar, U+2212 minus sign, U+FE58
// small em dash, U+FE63 small hyphen-minus, U+FF0D fullwidth hyphen-minus.
const DASH_VARIANTS = /[‐‑‒–—―−﹘﹣－]/g;

// Zero-width and bidi-control characters: zero-width space/non-joiner/joiner
// (U+200B-U+200D), left/right-to-left marks (U+200E-U+200F), embedding/
// override/pop-directional-formatting marks (U+202A-U+202E), word joiner and
// invisible operators (U+2060-U+2064), byte-order mark (U+FEFF). These are
// invisible in the UI but can silently ride along in copy-pasted text (e.g.
// copying styled text, some mobile keyboards, or clipboard managers) and
// would otherwise make an apparently-clean, correctly-copied code fail the
// strict [A-Z0-9-] charset below. Ordinary whitespace (\s) does NOT cover
// these, so they need to be stripped separately.
//
// Built from numeric code points (rather than the literal characters) so
// nothing invisible/unverifiable ends up embedded in this source file.
const INVISIBLE_CODEPOINTS = [
    0x200b, 0x200c, 0x200d, // zero-width space / non-joiner / joiner
    0x200e, 0x200f, // left-to-right / right-to-left marks
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e, // bidi embedding/override marks
    0x2060, 0x2061, 0x2062, 0x2063, 0x2064, // word joiner / invisible operators
    0xfeff, // byte-order mark / zero-width no-break space
];
const INVISIBLE_CHARS = new RegExp(
    "[" + INVISIBLE_CODEPOINTS.map((c) => "\\u" + c.toString(16).padStart(4, "0")).join("") + "]",
    "g"
);

function normalizeCode(text) {
    return String(text)
        .replace(INVISIBLE_CHARS, "")
        .trim()
        .replace(/\s+/g, "")
        .replace(DASH_VARIANTS, "-")
        .toUpperCase();
}

function credentialsFromQrPayload(text) {
    if (typeof text !== "string" || !text.trim() || text.length > 2048) return null;
    if (/^https?:\/\//i.test(text.trim())) {
        try {
            const url = new URL(text.trim()), base = viewerUrl();
            const fields = new URLSearchParams(url.hash.slice(1));
            if (url.origin !== base.origin || url.pathname !== base.pathname || url.search
                || url.username || url.password || fields.getAll("consult").length !== 1
                || fields.getAll("token").length !== 1 || [...fields.keys()].some(k => !["consult", "token"].includes(k))) return null;
            const code = normalizeCode(fields.get("consult"));
            const shareToken = fields.get("token");
            return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) && /^[A-Za-z0-9_-]{43}$/.test(shareToken)
                ? { code, shareToken } : null;
        } catch { return null; }
    }
    const t = normalizeCode(text);
    const m = t.match(/BABYBOOK\+CONSULT:([A-Z0-9-]+)/i);
    if (m && /^[A-Z0-9-]{6,12}$/.test(m[1])) return { code: m[1] };
    if (/^[A-Z0-9-]{6,12}$/i.test(t)) return { code: t };
    return null;
}

function codeFromQrPayload(text) {
    return credentialsFromQrPayload(text)?.code || null;
}

module.exports = { generateCode, generateShareToken, hashShareToken, qrPayloadForCode,
    codeFromQrPayload, credentialsFromQrPayload };
