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
    const nutrition = read("components/NutritionTracker.js");
    const growthChart = read("components/GrowthChart.js");
    const anchoredMenu = read("components/ui/AnchoredMenu.js");
    const app = read("App.js");
    assert(!/offlineSummary|OfflineSummary|cacheSummary|getSummary|offlinePrompt/.test(home + app));
    assert(!fs.existsSync(path.join(root, "components/OfflineSummaryView.js")));
    assert(!fs.existsSync(path.join(root, "utils/offlineSummary.js")));
    assert(app.includes("void removeLegacyOfflineSummaries();"), "Cleanup must not block startup");
    const vaccines = home.indexOf("{/* Vaccination progress */}");
    const profile = home.indexOf("{/* Child Health ID");
    const growth = home.indexOf("<GrowthChart");
    const today = home.indexOf('<SectionContainerCard title="Today"');
    const plans = home.indexOf("{/* Upcoming appointment");
    assert(vaccines < profile && profile < growth && growth < today && today < plans, "Home card order");
    const next = home.slice(plans);
    for (const style of ["feedingCard", "feedingIcon", "feedingLabel", "feedingSub"]) {
        assert(next.includes("styles." + style), "Next plan shares Fed style: " + style);
    }
    assert(next.includes('nav("calendar")'));
    assert(home.slice(today, plans).includes('nav("nutrition")'));
    assert(home.slice(growth, today).includes('nav("growth")'));
    assert(home.slice(vaccines, profile).includes('nav("health", "immunizations")'));
    assert(!home.includes("todayFeeding"), "Compact Fed card is removed");
    assert(!nutrition.includes('<SectionContainerCard title="Today"'), "Today card moved out of Nutrition");
    assert(!home.includes('upcoming?.key !== `vax-${nextVax.id}`'), "Soonest vaccine always remains visible");
    for (const contract of ["Animated.timing(attentionFold", "motion.standard.duration", "isReduceMotionEnabled", "accessibilityState={{ expanded: !attentionCollapsed }}"]) {
        assert(home.includes(contract), "Needs attention fold contract: " + contract);
    }
    assert(growthChart.includes('variant="select"'), "Home growth selector uses anchored select behavior");
    assert(!growthChart.includes(" fold"), "Input selects inherit the shared fold instead of opting in per screen");
    assert(!growthChart.includes("minWidth={Math.min(metricMenuAnchor"), "Home growth menu follows trigger width");
    for (const contract of ['animationMode = animation || (select ? "fold" : "scale")', "folding && !panelHeight", "outputRange: [0, panelHeight]", "motion.standard.duration", "isReduceMotionEnabled"]) {
        assert(anchoredMenu.includes(contract), "Anchored menu fold contract: " + contract);
    }
    console.log("Home card checks passed: cleanup, card order, collapsible attention, persistent next vaccine, moved Today summary, and anchored growth selector.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
