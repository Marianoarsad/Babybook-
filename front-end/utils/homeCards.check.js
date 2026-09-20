// Run: node utils/homeCards.check.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const compiled = transformSync(read("utils/storageAdapter.js"), {
    babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const original = {
    "bb_offline_summary:child-1": "snapshot",
    "bb_offline_summary:child-2": "snapshot",
    bb_seen_offlineSummary: "1",
    bb_token: "session",
    bb_theme_override: "boy",
    bb_seen_setup: "1",
    bb_seen_onboarding: "1",
    "other:bb_offline_summary:child": "unrelated",
    bb_offline_summary_preferences: "unrelated",
};
function adapter(mode, values, options = {}) {
    const data = new Map(Object.entries(values));
    const removed = [];
    let failRemoval = options.failRemoval;
    const remove = async (key) => {
        if (failRemoval) { failRemoval = false; throw new Error("Storage unavailable"); }
        removed.push(key);
        data.delete(key);
    };
    const native = {
        getAllKeys: async () => {
            if (options.failKeys) throw new Error("Storage unavailable");
            return [...data.keys()];
        },
        getItem: async (key) => data.get(key) ?? null,
        setItem: async (key, value) => data.set(key, value),
        removeItem: remove,
    };
    const web = {
        get length() { return data.size; },
        key: (index) => [...data.keys()][index],
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value),
        removeItem: remove,
    };
    const module = { exports: {} };
    new Function("require", "module", "exports", "window", "localStorage", "console", compiled)(
        () => {
            if (mode === "fallback") throw new Error("No native storage");
            return { default: native };
        },
        module, module.exports, mode === "web" ? { localStorage: web } : undefined, web, { log() {} },
    );
    return { ...module.exports, data, removed };
}
(async () => {
    for (const mode of ["web", "native"]) {
        const test = adapter(mode, original);
        await test.removeLegacyOfflineSummaries();
        assert.deepEqual(test.removed.sort(), ["bb_offline_summary:child-1", "bb_offline_summary:child-2", "bb_seen_offlineSummary"]);
        for (const [key, value] of Object.entries(original)) {
            if (!test.removed.includes(key)) assert.equal(test.data.get(key), value);
        }
        await test.removeLegacyOfflineSummaries();
        assert.equal(test.removed.length, 3, "Repeat launch is safe");
    }
    const failed = adapter("native", original, { failRemoval: true });
    await failed.removeLegacyOfflineSummaries();
    await failed.removeLegacyOfflineSummaries();
    assert.equal(failed.data.has("bb_offline_summary:child-1"), false, "Next launch retries failed deletion");
    assert.equal(failed.data.get("bb_token"), "session");
    for (const test of [adapter("native", original, { failKeys: true }), adapter("fallback", original)]) {
        await assert.doesNotReject(test.removeLegacyOfflineSummaries());
        assert.equal(test.removed.length, 0);
    }
    const home = read("components/Dashboard.js");
    const app = read("App.js");
    assert(!/offlineSummary|OfflineSummary|cacheSummary|getSummary|offlinePrompt/.test(home + app));
    assert(!fs.existsSync(path.join(root, "components/OfflineSummaryView.js")));
    assert(!fs.existsSync(path.join(root, "utils/offlineSummary.js")));
    assert(app.includes("void removeLegacyOfflineSummaries();"), "Cleanup must not block startup");
    const growth = home.indexOf("<GrowthChart");
    const vaccines = home.indexOf("{/* Vaccination progress */}");
    const plans = home.indexOf("{/* Upcoming appointment");
    const fed = home.indexOf("{/* Today's feeding summary");
    assert(growth < vaccines && vaccines < plans && plans < fed, "Home card order");
    const next = home.slice(plans, fed);
    for (const style of ["feedingCard", "feedingIcon", "feedingLabel", "feedingSub"]) {
        assert(next.includes("styles." + style), "Next plan shares Fed style: " + style);
    }
    assert(next.includes('nav("calendar")'));
    assert(home.slice(fed).includes('nav("nutrition")'));
    assert(home.slice(growth, vaccines).includes('nav("growth")'));
    assert(home.slice(vaccines, plans).includes('nav("health", "immunizations")'));
    console.log("Home card checks passed: targeted web/native cleanup, retries, removed feature, card order, shared Fed palette and navigation.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
