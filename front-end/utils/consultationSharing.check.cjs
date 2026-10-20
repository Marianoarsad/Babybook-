// Run: node utils/consultationSharing.check.cjs (no network or patient data).
const assert = require("node:assert/strict");
const links = require("./consultationLinks.cjs");
const server = require("../../back-end/src/utils/shareCode");
const { remainingLifetime, watchConsultation } = require("./consultationSession.cjs");
const token = server.generateShareToken(), code = server.generateCode();
const url = server.qrPayloadForCode(code, token);
assert.equal(token.length, 43);
assert.deepEqual(links.parseConsultationLink(url), { code, shareToken: token });
assert.deepEqual(server.credentialsFromQrPayload(url), { code, shareToken: token });
assert(url.startsWith("https://babybook-plus.expo.app/#consult="));
assert(!url.includes("?"));
assert(url.length <= 255);
const matrix = require("./qrcode").generateMatrix(url, "M");
assert(matrix.length >= 21);
assert(matrix.every((row) => row.length === matrix.length && row.every((cell) => typeof cell === "boolean")));
assert.equal(server.hashShareToken(token).length, 64);
assert.equal(new Set(Array.from({ length: 1000 }, server.generateCode)).size, 1000);
for (const bad of [url.replace("babybook-plus.expo.app", "evil.example"), url + "&token=" + token,
    url + "&extra=x", url.replace("#", "other#"), url.replace("https:", "http:"), url.replace(token, "short")]) {
    assert.equal(links.parseConsultationLink(bad), null);
    assert.equal(server.credentialsFromQrPayload(bad), null);
}
assert.deepEqual(links.scannedCredentials("BABYBOOK+CONSULT:AB7K-2P9Q"), { code: "AB7K-2P9Q" });
assert.equal(links.scannedCredentials({ code }), null);
assert.equal(remainingLifetime({ expiresAt: "bad", serverNow: "bad" }), 0);
assert.equal(remainingLifetime({ expiresAt: "2026-10-08T00:01:00Z", serverNow: "2026-10-08T00:00:00Z" }, 1000), 59000);

const originals = Object.fromEntries(["performance", "setInterval", "clearInterval", "setTimeout", "clearTimeout", "document", "window"]
    .map((key) => [key, global[key]]));
let clock = 0, tick, timeout, visibility, pageHidden, pageShown, offline;
global.performance = { now: () => clock };
global.setInterval = (fn) => { tick = fn; return 1; };
global.clearInterval = () => {};
global.setTimeout = (fn) => { timeout = fn; return 2; };
global.clearTimeout = () => { timeout = null; };
global.document = { visibilityState: "visible", addEventListener: (_, fn) => { visibility = fn; }, removeEventListener() {} };
global.window = { addEventListener: (key, fn) => {
    if (key === "pagehide") pageHidden = fn; if (key === "pageshow") pageShown = fn; if (key === "offline") offline = fn;
}, removeEventListener() {} };
const flush = () => new Promise(setImmediate);
const result = { status: "ok", expiresAt: "2026-10-08T00:01:00Z", serverNow: "2026-10-08T00:00:00Z" };
async function check() {
    try {
        let shown = 0, hidden = 0, ended = [], requests = 0, resolve, reject, signal;
        const api = { consultStatus: (_, opts) => {
            requests++; signal = opts.signal;
            return new Promise((yes, no) => { resolve = yes; reject = no; });
        } };
        const start = () => watchConsultation({ session: { remainingMs: 60000 }, credentials: { code, shareToken: token }, api,
            onReady: () => shown++, onHidden: () => hidden++, onEnd: (message) => ended.push(message) });
        let stop = start(); assert.equal(shown, 1);
        clock = 15000; tick(); assert.equal(requests, 1);
        resolve(result); await flush(); assert.equal(shown, 2); assert.equal(ended.length, 0);
        document.visibilityState = "hidden"; visibility(); assert.equal(hidden, 1);
        clock = 20000; tick(); assert.equal(requests, 1, "No polling while hidden");
        document.visibilityState = "visible"; visibility(); assert.equal(requests, 2); assert.equal(shown, 2, "Resume remains hidden before validation");
        reject({ data: { status: "revoked" } }); await flush(); assert.match(ended[0], /revoked/); stop();
        clock = 0; ended = []; stop = start(); clock = 60000; tick(); assert.match(ended[0], /expired/); stop();
        clock = 0; ended = []; stop = start(); clock = 15000; tick(); stop();
        assert(signal.aborted); const oldShown = shown; resolve(result); await flush(); assert.equal(shown, oldShown, "Late response after exit ignored");
        clock = 0; ended = []; stop = start(); pageHidden(); const before = shown; pageShown();
        assert.equal(shown, before); resolve(result); await flush(); assert.equal(shown, before + 1); stop();
        clock = 0; ended = []; stop = start(); offline(); assert.match(ended[0], /Connection lost/); stop();
        clock = 0; ended = []; stop = start(); clock = 15000; tick(); timeout(); assert.match(ended[0], /could not be checked/); stop();
        clock = 0; ended = []; stop = start(); clock = 15000; tick();
        document.visibilityState = "hidden"; visibility(); assert(signal.aborted);
        resolve(result); await flush(); assert.equal(ended.length, 0, "Canceled check cannot close or restore a new view");
        stop(); document.visibilityState = "visible";
        console.log("QR sharing checks passed: strict links, secure credentials, expiry, revocation, visibility, no background polling, cancellation and fail-closed network handling.");
    } finally {
        for (const [key, value] of Object.entries(originals)) {
            if (value === undefined) delete global[key]; else global[key] = value;
        }
    }
}
check().catch((error) => { console.error(error); process.exitCode = 1; });
