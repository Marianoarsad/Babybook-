// Run: node utils/cacheNavigation.check.js. No server, database or native runtime.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const store = require("./recordStore.cjs");
const root = path.resolve(__dirname, "..");
function load(file, requireMock = (name) => { throw new Error(`Unexpected import ${name}`); }) {
    const module = { exports: {} };
    const code = transformSync(fs.readFileSync(path.join(root, file), "utf8"), { babelrc: false, configFile: false,
        plugins: ["@babel/plugin-transform-modules-commonjs", ["@babel/plugin-transform-react-jsx", { runtime: "classic" }]] }).code;
    new Function("require", "module", "exports", code)(requireMock, module, module.exports);
    return module.exports;
}
function reactHarness(effects = false) {
    let cursor = 0, setters = 0;
    const slots = [], queued = [];
    const memo = (fn, deps) => {
        const index = cursor++, old = slots[index];
        if (!old || !deps.every((value, i) => Object.is(value, old.deps[i]))) slots[index] = { fn, deps };
        return slots[index].fn;
    };
    const React = {
        Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = { value: typeof initial === "function" ? initial() : initial };
            return [slots[index].value, (value) => { setters++; slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }];
        },
        useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
        useCallback: memo, useMemo: (fn) => fn(), useSyncExternalStore: (_, snapshot) => snapshot(),
        useEffect(fn, deps) {
            if (!effects) return;
            const index = cursor++, old = slots[index];
            if (!old || !deps.every((value, i) => Object.is(value, old.deps[i]))) queued.push(() => {
                old?.cleanup?.(); slots[index] = { deps, cleanup: fn() };
            });
        },
    };
    return { React, render(fn) { cursor = 0; return fn(); }, commit() { queued.splice(0).forEach((fn) => fn()); },
        unmount() { slots.forEach((slot) => slot.cleanup?.()); }, setterCount: () => setters };
}
const tick = () => new Promise(setImmediate);
const seed = (child, resource, rows) => store.acceptFetch(child, resource, rows, store.version(child, resource));
const theme = load("theme.js"), dictionaries = load("translations.js").translations;
function walk(node, predicate) {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;
    for (const child of node.props?.children || []) { const hit = walk(child, predicate); if (hit) return hit; }
    return null;
}
const text = (node) => node && typeof node === "object" ? [node.props?.message || "", ...(node.props?.children || []).map(text)].join(" ") : String(node ?? "");
async function check() {
    store.reset();
    const harness = reactHarness(true), pending = [];
    const hooks = load("utils/useRecords.js", (name) => name === "react" ? harness.React
        : name === "./recordStore.cjs" ? store : name === "./api" ? { api: {} } : assert.fail(name));
    const work = (isCurrent) => new Promise((resolve) => pending.push({ resolve, isCurrent }));
    const render = (scope = "A") => harness.render(() => hooks.useScreenRefresh(scope, work));
    let state = render(); harness.commit();
    assert(state.refreshing);
    pending.shift().resolve(["memories"]); await tick(); state = render();
    assert.deepEqual(state.failures, ["memories"]);
    state.refresh(); state.refresh();
    const older = pending.shift(), newer = pending.shift();
    newer.resolve([]); await tick(); older.resolve(["stale"]); await tick();
    assert.deepEqual(render().failures, [], "Older overlapping refreshes do not replace newer results");
    state.refresh(); const oldChild = pending.shift();
    state = render("B"); harness.commit();
    assert.equal(oldChild.isCurrent(), false, "Old-child work cannot mark logs seen");
    oldChild.resolve(["wrong child"]); await tick();
    assert(render("B").refreshing);
    pending.shift().resolve([]); await tick(); state = render("B");
    state.refresh(); const unmounted = pending.shift(); harness.unmount();
    const before = harness.setterCount(); unmounted.resolve(["late"]); await tick();
    assert.equal(harness.setterCount(), before, "Late responses never set unmounted screen state");
    assert.equal(state.isActive(), false);

    const apiCalls = [], screenWork = [];
    const api = {
        listRecords: async (...args) => { apiCalls.push(args); return []; },
        listShares: async (...args) => { apiCalls.push(args); return []; },
        accessLog: async (...args) => { apiCalls.push(args); return []; },
        markAccessLogSeen: async () => { apiCalls.push(["seen"]); },
        me: async (...args) => { apiCalls.push(args); return { user: {} }; },
    };
    let refreshing = true, failures = [];
    function screen(file) {
        const ui = reactHarness();
        const modules = {
            react: ui.React,
            "react-native": { View: "View", Text: "Text", Image: "Image", TouchableOpacity: "Button", TextInput: "Input", ScrollView: "Scroll",
                Animated: { ScrollView: "Scroll", View: "View", Value: class {} }, Platform: { OS: "web" }, StyleSheet: { create: (styles) => styles } },
            "@expo/vector-icons": { Ionicons: "Icon" },
        };
        const component = load(file, (name) => {
            if (modules[name]) return modules[name];
            if (name.endsWith("/theme")) return theme;
            if (name.endsWith("/api")) return { api, ACCOUNT_SCOPE: "__account__", ACCOUNT_RESOURCE: "account" };
            if (name.endsWith("/useRecords")) return { useRecordCache: store.getSnapshot, useSessionEpoch: store.getEpoch,
                useScreenRefresh: (_, work) => { screenWork.push(work); return { refreshing, failures, refresh() {}, isActive: () => true }; } };
            if (name.endsWith("/ThemeContext")) return { useTheme: () => ({ colors: theme.PALETTES.boy }) };
            if (name.endsWith("/LanguageContext")) return { useLanguage: () => ({ language: "en", t: (key) => dictionaries.en[key] || key }) };
            if (name.endsWith("/ScrollContext")) return { useScroll: () => ({ scrollProps: {} }) };
            if (name.endsWith("/responsive")) return { useScreenPadTop: () => 0, useScreenPadBottom: () => 0 };
            if (name.endsWith("/useRefreshControl")) return { useRefreshControl: () => undefined };
            if (name.endsWith("/Skeleton")) return { AppointmentsSkeleton: "Skeleton", SkeletonBlock: "Skeleton" };
            if (name.endsWith("/Cards")) return { EmptyStateCard: "Empty" };
            if (name.endsWith("/Toast")) return { useToast: () => ({ success() {}, error() {} }) };
            if (name.endsWith("/storageAdapter")) return { storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
            if (name.endsWith("/exportPdf")) return { pdfExportAvailable: () => false };
            if (name === "./Dashboard") return { ageText: () => "Age" };
            if (name === "./GeneralSettings") return { LEAD_TIME_KEY: "lead", LEAD_TIME_OPTIONS: [{ key: "1", label: "1 day before" }] };
            if (/\/(search|dates|adapters|shareStore|relationship)$/.test(name)) return load(`utils/${name.split("/").at(-1)}.js`);
            if (/\/(Avatar|Gradient|QrCodeView|ShowMore|TipStrip|PulseLoader)$/.test(name)) return name.split("/").at(-1);
            return assert.fail(`Unexpected screen import ${name}`);
        }).default;
        return { render: () => ui.render(() => component({ profile: { id: "child", name: "Baby", dateOfBirth: "2020-02-18" },
            parentName: "Parent", profiles: [], onNavigate() {} })) };
    }
    store.reset();
    const search = screen("components/Search.js");
    let tree = search.render();
    assert(text(tree).includes("Search by category"), "Cold Search keeps landing controls visible");
    walk(tree, (node) => node.type === "Input").props.onChangeText("MMR");
    assert(walk(search.render(), (node) => node.type === "Skeleton"), "Uncached results use skeletons");
    for (const resource of ["vaccinations", "checkups", "medical-history", "milestones", "memories", "calendar-events"]) seed("child", resource, []);
    tree = search.render();
    assert.equal(walk(tree, (node) => node.type === "Skeleton"), null, "Confirmed empty index is not uncached");
    seed("child", "vaccinations", [{ id: 1, vaccine_name: "MMR", due_date: "2026-10-01" }]);
    assert(text(search.render()).includes("MMR"), "Cached matching records appear while refreshing");
    failures = ["vaccinations"]; refreshing = false;
    assert(text(search.render()).includes("MMR"), "Refresh failures do not erase matching cached records");
    const profile = screen("components/settings/ViewProfile.js");
    failures = []; refreshing = true;
    assert(walk(profile.render(), (node) => node.type === "Skeleton"));
    seed("__account__", "account", [{ id: "parent", email: "parent@example.test", phoneNumber: "123", city: "Manila" }]);
    tree = profile.render();
    assert(text(tree).includes("parent@example.test"));
    assert.equal(walk(tree, (node) => node.type === "Skeleton"), null, "Profile keeps known details visible during refresh");
    const sharing = screen("components/ShareRecords.js");
    tree = sharing.render(); assert(walk(tree, (node) => node.type === "Skeleton"));
    seed("child", "shares", [{ id: 2, code: "OLD", status: "active", expiration_date: "2020-01-01", shared_record_keys: [] }]);
    seed("child", "access-log", []);
    tree = sharing.render();
    assert.equal(walk(tree, (node) => node.type === "Skeleton"), null);
    assert(text(tree).includes("expired"));
    assert.equal(walk(tree, (node) => node.type === "QrCodeView"), null, "Cached history never restores an active QR");
    const shareLoad = screenWork.at(-1);
    await shareLoad(() => false);
    assert(!apiCalls.some((call) => call[0] === "seen"));
    await shareLoad(() => true);
    assert(apiCalls.some((call) => call[0] === "seen"));
    api.accessLog = async () => { throw new Error("offline"); };
    apiCalls.length = 0;
    assert.deepEqual(await shareLoad(() => true), ["access-log"]);
    assert(!apiCalls.some((call) => call[0] === "seen"), "Failed log reads are not marked seen");
    store.reset();
    assert(!text(sharing.render()).includes("OLD"), "Account resets cannot display previous cached share history");

    let printed = 0;
    const pdf = load("utils/exportPdf.js", (name) => name === "react-native" ? { Platform: { OS: "web" } }
        : name === "./api" ? { api: { listRecords: async (_, resource, options) => {
            assert.equal(options.confirmedOnly, true); assert.notEqual(options.loading, "nonblocking");
            if (resource === "growth") throw new Error("Unavailable"); return [];
        } } } : name === "./pdfTemplate" ? { buildRecordHtml() {} }
        : name === "expo-print" ? { printAsync: async () => { printed++; } } : name === "expo-sharing" ? {} : assert.fail(name));
    await assert.rejects(pdf.exportChildRecordsPdf({ id: "child" }), /Unavailable/);
    assert.equal(printed, 0, "Exports cannot silently print missing or optimistic records");
    for (const dictionary of Object.values(dictionaries)) for (const key of ["screenRefreshing", "screenRefreshFailed", "screenDataUnavailable", "screenLastChecked", "retry"]) assert(dictionary[key]);
    console.log("Cached-navigation checks passed: guarded refreshes, cached/cold/empty screens, partial failures, share safety and confirmed exports.");
}
check().catch((error) => { console.error(error); process.exitCode = 1; });
