// Run: node components/ui/DevelopmentChecklistCard.check.js — isolated fixtures, no server writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "../..");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const modules = new Map();
let colors, width = 390, fontScale = 1, current, hook = 0;
const state = new Map();
const react = {
    Fragment: "Fragment",
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity).filter(v => v != null && v !== false) } }),
    useMemo: fn => fn(), useId: () => `${current}-${hook++}`,
    useState(initial) {
        const id = `${current}/${hook++}`;
        if (!state.has(id)) state.set(id, initial);
        return [state.get(id), value => state.set(id, typeof value === "function" ? value(state.get(id)) : value)];
    },
    useRef: () => ({ current: { measureInWindow: fn => fn(16, 180, width - 32, 58) } }),
};
const native = { View: "View", Text: "Text", Image: "Image", Platform: { OS: "web" },
    useWindowDimensions: () => ({ width, fontScale }), StyleSheet: { create: s => s } };
const svg = { __esModule: true, default: "Svg" };
for (const name of ["Circle", "Defs", "LinearGradient", "Path", "Stop"]) svg[name] = name;
const mocks = {
    "context/ThemeContext.js": { useTheme: () => ({ colors }) },
    "components/ui/ConsultationsAppointmentsCard.js": { DashboardSurface: "Surface", DashboardControl: "Control" },
    "components/ui/RecordIcon.js": { __esModule: true, default: "RecordIcon" },
    "components/ui/AnimatedReveal.js": { __esModule: true, default: "AnimatedReveal" },
    "components/ui/Gradient.js": { __esModule: true, default: "Gradient" },
};
function load(relative) {
    const file = path.resolve(root, relative), key = path.relative(root, file).replaceAll("\\", "/");
    if (mocks[key]) return mocks[key];
    if (file.endsWith(".png")) return key;
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    new Function("require", "module", "exports", compile(fs.readFileSync(file, "utf8")))(name => {
        if (name === "react") return { __esModule: true, default: react, ...react };
        if (name === "react-native") return native;
        if (name === "react-native-svg") return svg;
        if (name === "@expo/vector-icons") return { Ionicons: "Ionicon" };
        assert(name.startsWith("."), name);
        const target = path.resolve(path.dirname(file), name);
        return load(path.extname(target) ? target : target + ".js");
    }, module, module.exports);
    return module.exports;
}
function render(node, location = "root") {
    if (!node || typeof node !== "object") return node;
    const id = `${location}/${node.props.key ?? ""}/${node.type.name || node.type}`;
    if (typeof node.type === "function") {
        current = id; hook = 0;
        return render(node.type(node.props), id);
    }
    return { ...node, props: { ...node.props, children: node.props.children.map((child, index) => render(child, `${id}/${index}`)) } };
}
const nodes = node => node && typeof node === "object" ? [node, ...node.props.children.flatMap(nodes)] : [];
const text = node => node && typeof node === "object" ? node.props.children.map(text).join("") : String(node ?? "");
const style = value => Object.assign({}, ...[value].flat(Infinity).filter(Boolean));
const { default: Card } = load("components/ui/DevelopmentChecklistCard.js");
const theme = load("theme.js"), M = load("utils/milestoneChecklist.js");
const items = Object.freeze(M.itemsForCheckpoint(9).map(Object.freeze));
const records = Object.freeze(items.filter(i => i.domain === "social" || i.title === "Sits without support")
    .map((item, index) => Object.freeze({ id: `record-${index}`, title: item.title, isCompleted: true,
        date: index < 3 ? "2026-10-18" : "2026-06-16", photoUrl: index < 3 ? "" : "original-wave.jpg", ageAchieved: index < 3 ? "" : "7 months" })));
const before = JSON.stringify(records);
let toggled = [], anchor;
const props = { items, milestones: records, selectedBand: 9, subtitle: "Localized checklist description",
    onToggle: title => toggled.push(title), onChooseAge: value => anchor = value };
const show = (next = props, key = "development-baby-9") => render(react.createElement(Card, { ...next, key }));
const byId = (tree, id) => nodes(tree).find(node => node.props.testID === id);
const headers = tree => nodes(tree).filter(node => node.type === "Control" && node.props["aria-expanded"] != null);
const rows = tree => nodes(tree).filter(node => node.props.accessibilityRole === "checkbox");

for (const palette of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    colors = palette;
    for (const [w, scale] of [[320, 1], [390, 1], [430, 1], [320, 1.6]]) {
        state.clear(); width = w; fontScale = scale;
        let tree = show();
        assert(text(tree).includes("Development Checklist"));
        assert(text(tree).includes(props.subtitle));
        assert(text(tree).includes("4 of 11 recorded"));
        assert(text(tree).includes("36% complete"));
        assert.equal(nodes(tree).find(n => n.type === "RecordIcon").props.category, "milestone");
        assert.equal(rows(tree).length, 11);
        assert.equal(rows(tree).filter(r => r.props.accessibilityState.checked).length, 4);
        assert.equal(rows(tree).filter(r => r.props["aria-checked"]).length, 4);
        assert.deepEqual(headers(tree).map(h => h.props.accessibilityLabel.match(/\d of \d/)[0]), ["3 of 3", "0 of 2", "0 of 2", "1 of 4"]);
        for (const header of headers(tree)) {
            assert.equal(style(header.props.style).paddingBottom, 16);
            assert.equal(style(header.props.style).paddingTop, 12);
        }
        for (const reveal of nodes(tree).filter(n => n.type === "AnimatedReveal"))
            assert.equal(reveal.props.contentStyle.paddingTop, 12);
        assert.deepEqual(nodes(tree).filter(n => n.type === "Image" && n.props.source.uri).map(n => n.props.source.uri), ["original-wave.jpg"]);
        assert(text(tree).includes("Recorded 16 Jun 2026"));
        assert(text(tree).includes("7 months"));
        assert(text(tree).includes("Nothing here is a test or a score"));
        assert(text(tree).includes("ECCD Checklist"));
        assert.equal(byId(tree, "development-progress").props.accessibilityValue.now, 4);
        byId(tree, "development-age").props.onPress();
        assert.deepEqual(anchor, { x: 16, y: 180, width: width - 32, height: 58 });
        toggled = [];
        rows(tree)[0].props.onPress();
        assert.deepEqual(toggled, [items[0].title]);
        headers(tree)[0].props.onPress(); tree = show();
        assert.equal(headers(tree)[0].props["aria-expanded"], false);
        assert.equal(headers(tree)[1].props["aria-expanded"], true);
        assert(rows(tree).slice(0, 3).every(r => r.props.tabIndex === -1));
        assert.equal(byId(tree, "development-progress").props.accessibilityValue.now, 4);
        tree = show({ ...props, items: M.itemsForCheckpoint(12), selectedBand: 12 }, "development-baby-12");
        assert(headers(tree).every(h => h.props["aria-expanded"]));
        tree = show(props, "development-other-baby-9");
        assert(headers(tree).every(h => h.props["aria-expanded"]));
        tree = show({ ...props, busy: items[0].title, milestones: records.map((r, i) => i === 3 ? { ...r, _pending: true } : r) });
        assert.equal(rows(tree)[0].props.disabled, true);
        assert.equal(rows(tree).at(-1).props.disabled, true);
        assert.equal(rows(tree).at(-1).props.accessibilityState.busy, true);
    }
}
assert.equal(JSON.stringify(records), before);

// Exercise Growth's real save callback with a disposable in-memory API, including rollback.
const growth = fs.readFileSync(path.join(root, "components/Growth.js"), "utf8");
assert(growth.includes('key={`development-${profile.id}-${selectedBand}`}'));
const handlerStart = growth.indexOf("const handleToggleMilestone =");
const handlerEnd = growth.indexOf("\n    };", handlerStart) + 7;
const handlerSource = growth.slice(handlerStart, handlerEnd);
let stored = records.map(r => ({ ...r })), calls = [], failNext = false, pendingTitle, errors = [];
const api = { async optimisticRecord(baby, type, action, id, payload, options) {
    calls.push({ baby, type, action, id, payload, options });
    if (failNext) throw new Error("Simulated failed save");
    if (id) stored = stored.map(r => r.id === id ? { ...r, isCompleted: payload.is_completed, date: payload.date_recorded } : r);
    else stored.push({ id: "created-once", title: payload.title, isCompleted: payload.is_completed, date: payload.date_recorded });
} };
const toggle = title => new Function("mstones", "findRecorded", "resolveDevelopmentCategory", "setMilestoneBusy", "api", "profile", "todayStr", "toast",
    `${handlerSource}; return handleToggleMilestone;`)(stored, M.findRecorded, M.resolveDevelopmentCategory,
        value => pendingTitle = typeof value === "function" ? value(pendingTitle) : value,
        api, { id: "disposable-baby" }, () => "2026-10-18", { error: value => errors.push(value) })(title);
(async () => {
    await toggle(items[3].title);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].action, "create");
    assert.equal(M.summarizeChecklist(items, stored).completed, 5);
    await toggle(items[3].title);
    assert.equal(calls[1].action, "update");
    assert.equal(calls[1].id, "created-once");
    assert.equal(stored.filter(r => r.title === items[3].title).length, 1);
    assert.equal(M.summarizeChecklist(items, stored).completed, 4);
    const saved = JSON.stringify(stored); failNext = true;
    await toggle(items[3].title);
    assert.equal(JSON.stringify(stored), saved);
    assert.equal(errors.length, 1);
    assert.equal(pendingTitle, null);
    console.log("Development checklist: six palettes, compact/large text, spacing, age/collapse, data, counts and mocked save checks passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
