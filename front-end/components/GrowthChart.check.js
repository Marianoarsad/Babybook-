// Run: node components/GrowthChart.check.js — no server or native runtime.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
let colors, states = [], refs = [], cursor = 0, refCursor = 0;
let effectCursor = 0, effectSlots = [], pendingEffects = [], dimensions = { width: 390, height: 844, fontScale: 1 };
const scrollListeners = new Set(), scrollContext = { scrollY: {
    addListener(fn) { scrollListeners.add(fn); return fn; }, removeListener(fn) { scrollListeners.delete(fn); },
} };
const observers = new Set();
class ResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = []; observers.add(this); }
    observe(node) { this.targets.push(node); }
    disconnect() { observers.delete(this); }
}
const react = {
    Fragment: "Fragment",
    createElement: (type, props, ...children) => ({ type, props: props || {},
        children: [type === "Menu" && props.trigger ? props.trigger({ covered: false }) : null, ...children].flat(Infinity).filter(Boolean) }),
    useMemo: fn => fn(), useCallback: fn => fn, useContext: value => value, useRef: initial => refs[refCursor++] ||= { current: initial },
    useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial;
        return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }]; },
    useEffect(fn, deps) { const index = effectCursor++, old = effectSlots[index];
        if (!old || deps.some((value, i) => value !== old.deps[i])) pendingEffects.push(() => {
            old?.cleanup?.(); effectSlots[index] = { deps, cleanup: fn() };
        }); },
};
function load(file) {
    const code = transformSync(fs.readFileSync(file, "utf8"), { babelrc: false, configFile: false,
        plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"] }).code;
    const module = { exports: {} };
    const mocked = name => {
        if (name === "react") return react;
        if (name === "react-native") return { View: "View", Text: "Text", TouchableOpacity: "TouchableOpacity",
            Platform: { OS: "web" }, useWindowDimensions: () => dimensions, StyleSheet: { create: value => value, hairlineWidth: 1 } };
        if (name === "expo-blur") return { BlurTargetView: "BlurTargetView" };
        if (name === "@expo/vector-icons") return { Ionicons: "Icon" };
        if (name.endsWith("ThemeContext")) return { useTheme: () => ({ colors }) };
        if (name.endsWith("LanguageContext")) return { useLanguage: () => ({ t: key => key }) };
        if (name.endsWith("ScrollContext")) return { __esModule: true, default: scrollContext };
        if (name === "./PercentileChart") return { __esModule: true, default: "Plot" };
        if (name === "./ui/GrowthVisuals") return { GrowthBackground: "Background", GrowthMetricIcon: "MetricIcon" };
        if (name === "./ui/AnchoredMenu") return { __esModule: true, default: "Menu", AnchoredMenuItem: "MenuItem" };
        if (name === "./ui/Gradient") return { __esModule: true, default: "Gradient" };
        if (name === "./ui/GlassLighting") return { __esModule: true, default: "GlassLighting" };
        if (name === "./ui/Skeleton") return { SkeletonBlock: "Skeleton" };
        const target = path.resolve(path.dirname(file), name);
        return name.endsWith(".json") ? require(target) : load(target + ".js");
    };
    new Function("require", "module", "exports", "globalThis", code)(mocked, module, module.exports, { ResizeObserver });
    return module.exports;
}
const theme = load(path.join(__dirname, "../theme.js"));
const Chart = load(path.join(__dirname, "GrowthChart.js")).default;
const nodes = tree => tree && typeof tree === "object" ? [tree, ...tree.children.flatMap(nodes)] : [];
const text = tree => tree && typeof tree === "object" ? tree.children.map(text).join("") : String(tree ?? "");
const draw = props => { cursor = 0; refCursor = 0; effectCursor = 0; const tree = Chart(props);
    while (pendingEffects.length) pendingEffects.shift()(); return tree; };
const dateWindow = { from: "2026-09-01", to: "2026-09-30" };
for (colors of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    states = []; refs = []; effectSlots = []; scrollListeners.clear(); observers.clear();
    let navigated = false;
    const rows = [
        { id: 99, date_recorded: "2026-10-01", weight: 99, height: 99, head_circumference: 99 },
        { id: 1, date_recorded: "2026-09-12", weight: 10, height: 70, head_circumference: 40 },
        { id: 3, date_recorded: "2026-09-20", weight: 12, height: 72, head_circumference: 42 },
        { id: 2, date_recorded: "2026-09-20", weight: 11, height: 71, head_circumference: 41 },
        { id: 4, date_recorded: "2026-09-25", weight: "invalid", height: null, head_circumference: -1 },
    ];
    const original = JSON.stringify(rows);
    const props = { rows, dateOfBirth: "2025-01-01", dateWindow, plain: true, appearance: "growthTracking",
        onViewDetail: () => { navigated = true; }, emptyMessage: "No records in range" };
    for (const [metric, expected] of [["weight", "12 kg"], ["height", "72 cm"], ["head", "42 cm"]]) {
        let tree = draw(props);
        const trigger = nodes(tree).find(node => node.props.accessibilityLabel === "growthShowChart");
        trigger.props.ref.current = { measureInWindow: fn => fn(200, 240, 125, 44) };
        trigger.props.onPress(); tree = draw(props);
        const menu = nodes(tree).find(node => node.type === "Menu");
        assert.equal(menu.props.visible, true, "Open through the actual trigger before selecting an option");
        assert.equal(menu.props.appearance, "connectedSelect");
        assert.equal(menu.props.dimBackdrop, false);
        assert(menu.props.blurTarget);
        const covered = menu.props.trigger({ covered: true });
        assert.equal(covered.props.accessible, false); assert.equal(covered.props["aria-hidden"], true);
        assert.equal(covered.props.style.at(-1).opacity, 0);
        assert.equal(covered.props.style.at(-1).pointerEvents, "none");
        assert.equal(menu.props.header.props.accessibilityState.expanded, true);
        const options = nodes(tree).filter(node => node.type === "MenuItem");
        assert.deepEqual(options.map(node => node.props.label), ["growthWeight", "growthHeight", "growthHeadCirc"]);
        assert(options.every(node => node.props.variant === "connectedSelect"));
        for (const [index, key] of ["weight", "height", "head"].entries())
            assert.equal(options[index].props.leading.props.style[1].backgroundColor, colors.growthSurface.metric[key].line);
        assert.deepEqual(menu.props.anchor, { x: 200, y: 240, width: 125, height: 44 });
        nodes(tree).find(node => node.type === "MenuItem" && node.props.label === ({ weight: "growthWeight", height: "growthHeight", head: "growthHeadCirc" })[metric]).props.onPress();
        tree = draw(props);
        assert.equal(nodes(tree).find(node => node.type === "Menu").props.visible, false);
        const plot = nodes(tree).find(node => node.type === "Plot");
        assert.equal(plot.props.indicator, metric);
        assert.equal(plot.props.animateLine, true);
        assert.equal(plot.props.seriesTheme, colors.growthSurface.metric[metric]);
        assert.equal(plot.props.gridColor, colors.growthSurface.grid);
        assert.equal(plot.props.rows, rows);
        assert.equal(plot.props.dateWindow, dateWindow);
        assert.equal(plot.props.compact, true);
        assert.equal(plot.props.areaFill, true);
        assert.equal(plot.props.showReference, false);
        assert.equal(nodes(tree).find(node => node.type === "MetricIcon").props.metric, metric);
        assert(text(tree).includes(expected), "Latest header value follows date/ID order within the range");
        assert(!text(tree).includes("99 kg"));
        nodes(tree).find(node => node.props.accessibilityLabel === "growthViewDetail").props.onPress();
    }
    assert(navigated);
    assert.equal(JSON.stringify(rows), original, "Presentation never mutates records");
    for (const emptyRows of [[], [rows[0]], [rows[4]]]) {
        const tree = draw({ ...props, rows: emptyRows });
        assert(!nodes(tree).some(node => node.type === "Plot"));
        assert(text(tree).includes("No records in range"));
    }
    const one = draw({ ...props, rows: [rows[1]] });
    assert(nodes(one).some(node => node.type === "Plot"));
    const loading = draw({ ...props, loading: true });
    assert(nodes(loading).some(node => node.type === "Skeleton"));
    assert(!nodes(loading).some(node => node.props.selectable));
    const legacy = draw({ ...props, appearance: undefined });
    assert(!nodes(legacy).some(node => node.type === "Background" || node.type === "MetricIcon"));
    assert.equal(nodes(legacy).find(node => node.type === "Plot").props.seriesTheme, undefined);
    assert.equal(nodes(legacy).find(node => node.type === "Plot").props.animateLine, false);
    assert(nodes(draw({ ...props, showMetricDots: false })).filter(node => node.type === "MenuItem").every(node => node.props.leading === null));
    assert(!nodes(draw({ ...props, plain: false })).some(node => node.type === "Menu"), "Segmented charts do not acquire a dropdown");
}
const home = fs.readFileSync(path.join(__dirname, "Dashboard.js"), "utf8");
const viewer = fs.readFileSync(path.join(__dirname, "ProfessionalView.js"), "utf8");
assert(home.includes('appearance="growthTracking"'));
assert(!viewer.includes('appearance="growthTracking"'));
states = []; refs = []; effectSlots = []; colors = theme.PALETTES.boy;
const resizeProps = { plain: true, rows: [], dateOfBirth: "2025-01-01" };
let resizeTree = draw(resizeProps), measured = { x: 180, y: 300, width: 128, height: 44 };
const resizeTrigger = nodes(resizeTree).find(n => n.props.accessibilityLabel === "growthShowChart");
resizeTrigger.props.ref.current = { nodeType: 1, parentElement: { nodeType: 1, parentElement: null },
    measureInWindow: callback => callback(...Object.values(measured)) };
resizeTrigger.props.onPress(); resizeTree = draw(resizeProps);
measured = { x: 580, y: 100, width: 128, height: 44 }; dimensions = { width: 768, height: 1024, fontScale: 1 };
draw(resizeProps); resizeTree = draw(resizeProps);
assert.deepEqual(nodes(resizeTree).find(n => n.type === "Menu").props.anchor, measured, "Open connected controls follow their trigger after viewport changes");
measured = { x: 500, y: 120, width: 180, height: 64 }; dimensions = { ...dimensions, fontScale: 2 };
draw(resizeProps); resizeTree = draw(resizeProps);
assert.deepEqual(nodes(resizeTree).find(n => n.type === "Menu").props.anchor, measured, "Larger text remeasures the shared header width and height");
measured = { ...measured, y: 100 }; scrollContext.headerHeight = 68; draw(resizeProps); resizeTree = draw(resizeProps);
assert.deepEqual(nodes(resizeTree).find(n => n.type === "Menu").props.anchor, measured, "Header reflow after a resize remeasures the trigger");
measured = { ...measured, y: 80 }; scrollListeners.forEach(fn => fn({ value: 40 })); resizeTree = draw(resizeProps);
assert.deepEqual(nodes(resizeTree).find(n => n.type === "Menu").props.anchor, measured, "Scroll settling after a resize keeps the header connected");
assert.equal([...observers][0].targets.length, 2, "Observe trigger ancestors rather than polling each frame");
measured = { ...measured, y: 44 }; [...observers][0].callback(); resizeTree = draw(resizeProps);
assert.deepEqual(nodes(resizeTree).find(n => n.type === "Menu").props.anchor, measured, "Responsive cards above the trigger can settle without a scroll or viewport event");
nodes(resizeTree).find(n => n.type === "Menu").props.onClose(); draw(resizeProps);
assert.equal(scrollListeners.size, 0, "Closed selectors release their scroll listener");
assert.equal(observers.size, 0, "Closed selectors disconnect layout observers");
console.log("Home Growth chart checks passed: six themes, metric switching, in-range latest values, missing/invalid/single/empty data, loading, navigation and viewer isolation.");
