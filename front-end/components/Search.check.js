// node components/Search.check.js — disposable in-memory history; no API or database writes.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
function pure(file) {
    const filename = path.resolve(__dirname, file);
    if (filename.endsWith(".cjs")) return require(filename);
    const module = { exports: {} };
    new Function("require", "module", "exports", compile(fs.readFileSync(filename, "utf8")))(name => pure(path.resolve(path.dirname(filename), name + (path.extname(name) ? "" : ".js"))), module, module.exports);
    return module.exports;
}
const theme = pure("../theme.js"), dictionaries = pure("../translations.js").translations;
const all = node => node && typeof node === "object" ? [node, ...(node.props.children || []).flatMap(all)] : [];
const find = (tree, test) => all(tree).find(test);
const text = node => node && typeof node === "object" ? (node.props.children || []).map(text).join("") : String(node ?? "");
const tick = () => new Promise(setImmediate);
const luminance = hex => hex.slice(1, 7).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
function harness(saved = ["Four Year Wellness Checkup", "MMR"]) {
    const slots = [], effects = [], values = new Map([["bb_search_history:A", JSON.stringify(saved)]]), writes = [], navigation = [];
    let cursor = 0, palette = theme.PALETTES.boy, fontScale = 1, width = 390, language = "en", fetched = true, refreshing = false, failures = [], pendingRead;
    const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
        useMemo: fn => fn(), useCallback: fn => fn,
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
            return [slots[i], next => slots[i] = typeof next === "function" ? next(slots[i]) : next]; },
        useEffect(fn, deps) { const i = cursor++, old = slots[i];
            if (!old || deps.some((d, n) => d !== old.deps[n])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
    };
    const fixture = { vaccinations: [{ id: 1, vaccine_name: "MMR", due_date: "2026-10-12" }], checkups: [], "medical-history": [], milestones: [], memories: [], "calendar-events": [] };
    const imports = { react: { __esModule: true, default: react, ...react }, "react-native": { View: "View", Text: "Text", Image: "Image", KeyboardAvoidingView: "KeyboardAvoidingView", TouchableOpacity: "Button", TextInput: "Input", Animated: { ScrollView: "Scroll" }, StyleSheet: { create: s => s }, Platform: { OS: "web" }, useWindowDimensions: () => ({ width, fontScale }) },
        "@expo/vector-icons": { Ionicons: "Icon" }, "../context/ThemeContext": { useTheme: () => ({ colors: palette }) },
        "../context/LanguageContext": { useLanguage: () => ({ t: key => dictionaries[language][key] || dictionaries.en[key] }) },
        "../theme": theme, "../utils/responsive": { useScreenPadTop: () => 80, useScreenPadBottom: () => 120 },
        "../context/ScrollContext": { useScroll: () => ({ scrollProps: {}, scrollViewRef() {} }) },
        "../utils/api": { api: { listRecords: async () => [] } },
        "../utils/useRecords": { useRecordCache: (_, resource) => ({ rows: fixture[resource], hasFetched: fetched }), useSessionEpoch: () => 1,
            useScreenRefresh: () => ({ refreshing, failures, refresh() {} }) },
        "../utils/storageAdapter": { storage: { getItem: async key => pendingRead ? pendingRead : values.get(key),
            setItem: async (key, value) => { values.set(key, value); writes.push(["set", key, value]); },
            removeItem: async key => { values.delete(key); writes.push(["remove", key]); } } },
        "../utils/search": pure("../utils/search.js"), "../utils/dates": pure("../utils/dates.js"), "../utils/adapters": pure("../utils/adapters.js"),
        "./ui/ConsultationsAppointmentsCard": { DashboardSurface: "Surface", DashboardControl: "Control" },
        "./common/Cards": { EmptyStateCard: "Empty" }, "./ui/Skeleton": { AppointmentsSkeleton: "Skeleton" },
        "./ui/useRefreshControl": { useRefreshControl: () => undefined }, "../assets/navbar/calendar-blue.png": "calendar-blue.png" };
    for (const name of ["RecordIcon", "HospitalStayIcon", "VaccineIcon", "MedicationIcon"]) imports[`./ui/${name}`] = { __esModule: true, default: name };
    const module = { exports: {} };
    new Function("require", "module", "exports", compile(fs.readFileSync(path.join(__dirname, "Search.js"), "utf8")))(name => { assert(name in imports, name); return imports[name]; }, module, module.exports);
    return { writes, values, navigation, fixture,
        render(child = "A") { cursor = 0; const tree = module.exports.default({ profile: { id: child }, onNavigate: (...args) => navigation.push(args) }); while (effects.length) effects.shift()(); return tree; },
        palette(next) { palette = next; }, size(next, scale = 1) { width = next; fontScale = scale; }, language(next) { language = next; },
        status(known, busy, errors = []) { fetched = known; refreshing = busy; failures = errors; },
        deferRead(promise) { pendingRead = promise; }, unmount() { slots.forEach(s => s?.cleanup?.()); } };
}
const input = tree => find(tree, n => n.type === "Input");
const byId = (tree, id) => find(tree, n => n.props.testID === id);
const button = (tree, label) => find(tree, n => n.props.accessibilityLabel === label);
async function check() {
    const h = harness(); let tree = h.render(); await tick(); tree = h.render();
    assert.equal(tree.type, "KeyboardAvoidingView"); assert.equal(tree.props.style.backgroundColor, "transparent");
    assert.equal(input(tree).props.style.position, "relative", "Input text paints above its absolute gradient");
    const history = all(tree).filter(n => n.props.testID === "search-history-row");
    assert.deepEqual(history.map(text), ["Four Year Wellness Checkup", "MMR"]);
    for (const row of history) {
        assert.equal(row.props.style.width, "100%"); assert.equal(row.props.style.overflow, "visible");
        assert.deepEqual(all(row).filter(n => n.type === "Icon").map(n => n.props.name), ["close"]);
        assert.equal(all(row).filter(n => n.type === "Control").length, 2);
    }
    const categories = byId(tree, "search-category-grid").props.children;
    assert.deepEqual(categories.map(n => n.props.accessibilityLabel), ["Vaccines", "Conditions", "Milestones", "Calendar", "Checkups", "Medication", "Memories"]);
    const destinations = [["health", "immunizations"], ["health", "illnesses"], ["growth", "milestones"], ["calendar", null], ["health", "appointments"], ["health", "medications"], ["growth", "gallery"]];
    categories.forEach((n, i) => { n.props.onPress(); assert.deepEqual(h.navigation.at(-1), destinations[i]); }); assert.equal(h.writes.length, 0);
    assert(find(categories[0], n => n.type === "VaccineIcon")); assert(find(categories[5], n => n.type === "MedicationIcon"));
    assert(find(categories[4], n => n.type === "Image"));
    for (const suggestion of all(tree).filter(n => n.props.testID === "search-suggestion")) assert(suggestion.props.children.every(n => n.type === "Text"));
    const before = JSON.stringify(h.fixture);
    button(tree, "Remove Four Year Wellness Checkup from search history.").props.onPress(); tree = h.render();
    assert.equal(input(tree).props.value, ""); assert.deepEqual(JSON.parse(h.values.get("bb_search_history:A")), ["MMR"]);
    button(tree, "Search for MMR").props.onPress(); tree = h.render(); assert.equal(input(tree).props.value, "MMR");
    button(tree, "MMR").props.onPress(); assert.deepEqual(h.navigation.at(-1), ["health", "immunizations"]);
    button(tree, "Clear search").props.onPress(); tree = h.render();
    button(tree, "Clear All").props.onPress(); tree = h.render(); assert(text(tree).includes("No recent searches yet.")); assert(!h.values.has("bb_search_history:A"));
    assert.equal(JSON.stringify(h.fixture), before); assert(h.writes.every(write => write[1] === "bb_search_history:A"));
    const suggestion = byId(tree, "search-suggestion"); suggestion.props.onPress(); tree = h.render();
    assert.equal(input(tree).props.value, text(suggestion)); assert.deepEqual(JSON.parse(h.values.get("bb_search_history:A")), [text(suggestion)]);
    button(tree, "Clear search").props.onPress(); tree = h.render(); input(tree).props.onChangeText("  MMR  "); tree = h.render(); input(tree).props.onSubmitEditing(); tree = h.render();
    assert.equal(JSON.parse(h.values.get("bb_search_history:A"))[0], "MMR");
    button(tree, "Clear search").props.onPress(); tree = h.render();
    for (const [width, scale, expected] of [[320, 1, 2], [390, 1, 2], [768, 1, 4], [1280, 1, 4], [320, 2, 1]]) {
        h.size(width, scale); byId(tree, "search-category-grid").props.onLayout({ nativeEvent: { layout: { width: width - 32 } } }); tree = h.render();
        const cardWidth = byId(tree, "search-category-grid").props.children[0].props.style[1].width;
        assert.equal(cardWidth, Math.floor((width - 32 - (expected - 1) * 12 - 1) / expected));
        assert(cardWidth * expected + (expected - 1) * 12 <= width - 32 - 0.5, "Fractional layout rounding must not wrap the final tile");
    }
    for (const set of [theme.PALETTES, theme.DARK_PALETTES]) for (const palette of Object.values(set)) {
        h.palette(palette); tree = h.render(); assert(palette.searchSurface.background.length === 3); assert.equal(Object.keys(palette.searchSurface.categories).length, 7);
        const p = palette.searchSurface;
        for (const background of [...p.background, ...p.surface]) assert(contrast(p.secondary, background) >= 4.5);
        for (const material of Object.values(p.categories)) for (const background of material.surface) assert(contrast(p.text, background) >= 4.5);
    }
    for (const lang of ["en", "fil", "tag"]) { h.language(lang); tree = h.render(); assert(text(tree).includes(dictionaries[lang].searchHistoryDescription)); }
    h.language("en"); h.status(false, true); input(tree).props.onChangeText("missing"); tree = h.render(); assert(find(tree, n => n.type === "Skeleton"));
    h.status(true, false); tree = h.render(); assert(find(tree, n => n.type === "Empty").props.message.includes("No matches"));
    h.status(false, false, ["memories"]); tree = h.render(); assert(text(tree).includes(dictionaries.en.screenRefreshFailed));
    assert.equal(find(tree, n => n.type === "Empty").props.message, dictionaries.en.screenDataUnavailable);
    h.unmount();
    const other = harness(); other.render("B"); await tick(); assert(text(other.render("B")).includes("No recent searches yet.")); other.unmount();
    const late = harness(); let resolve; late.deferRead(new Promise(r => resolve = r)); late.render(); late.unmount(); resolve('["Old account search"]'); await tick();
    assert(!text(late.render("B")).includes("Old account search")); late.unmount();
    const app = fs.readFileSync(path.join(__dirname, "../App.js"), "utf8");
    assert(app.includes('const pageGradient = currentView === "search" ? colors.searchSurface.background'));
    assert.equal((app.match(/colors=\{pageGradient\}/g) || []).length, 2);
    console.log("Search checks passed: responsive floating layout, seven canonical routes/icons, text-only history/suggestions, isolated delete/clear/recall/persistence, live search/results/states, six palettes, localization and child/unmount guards.");
}
check().catch(error => { console.error(error); process.exitCode = 1; });
