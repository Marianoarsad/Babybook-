const VIEWER_ORIGIN = "https://babybook-plus.expo.app";

function parseConsultationLink(value, origin = VIEWER_ORIGIN) {
    if (typeof value !== "string" || value.length > 2048) return null;
    try {
        // React Native's URLSearchParams support varies; the QR uses one fixed root URL.
        const prefix = origin + "/#", text = value.trim();
        if (!text.startsWith(prefix)) return null;
        const fields = text.slice(prefix.length).split("&").map((field) => {
            const pair = field.split("=");
            return pair.length === 2 ? pair.map(decodeURIComponent) : [];
        });
        if (fields.length !== 2 || fields.some(([key]) => !["consult", "token"].includes(key))
            || fields[0][0] === fields[1][0]) return null;
        const params = Object.fromEntries(fields);
        const code = params.consult.toUpperCase();
        const shareToken = params.token;
        return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) && /^[A-Za-z0-9_-]{43}$/.test(shareToken)
            ? { code, shareToken } : null;
    } catch { return null; }
}

function scannedCredentials(value) {
    const link = parseConsultationLink(value);
    if (link) return link;
    if (typeof value !== "string" || value.length > 2048) return null;
    const code = value.trim().replace(/^BABYBOOK\+CONSULT:/i, "").replace(/\s/g, "").toUpperCase();
    return /^[A-Z0-9]{6,12}$/.test(code.replace(/-/g, "")) ? { code } : null;
}

function browserConsultation() {
    if (typeof window === "undefined") return null;
    return parseConsultationLink(window.location.href, window.location.origin)
        || (window.location.hash.startsWith("#consult") ? { code: "", invalid: true } : null);
}

function clearBrowserConsultation() {
    if (typeof window !== "undefined" && window.location.hash.startsWith("#consult")) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
}

module.exports = { parseConsultationLink, scannedCredentials, browserConsultation, clearBrowserConsultation };
