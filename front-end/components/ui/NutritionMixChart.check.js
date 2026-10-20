// Run: node components/ui/NutritionMixChart.check.js. Uses disposable in-memory data only.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { transformSync } = require("@babel/core");
const { parse } = require("@babel/parser");
const read = file => fs.readFileSync(path.resolve(__dirname, file), "utf8");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs"), require.resolve("@babel/plugin-transform-react-jsx")] }).code;
let colors, owner, serial = 0, fontScale = 1, reduced = true;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = { Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(v => v != null && v !== false) }),
    useState: initial => { const state = owner, i = state.cursor++; state.slots[i] ??= { value: typeof initial === "function" ? initial() : initial };
        return [state.slots[i].value, next => { next = typeof next === "function" ? next(state.slots[i].value) : next;
            if (!Object.is(next, state.slots[i].value)) { state.slots[i].value = next; state.dirty = true; } }]; },
    useRef: initial => { const i = owner.cursor++; return owner.slots[i] ??= { current: initial }; },
    useMemo: fn => fn(), useId: () => { const i = owner.cursor++; return (owner.slots[i] ??= { id: "feeding-" + ++serial }).id; },
    useEffect: (fn, deps) => { const state = owner, i = state.cursor++; if (!same(state.slots[i]?.deps, deps)) state.effects.push(() => { state.slots[i]?.cleanup?.(); state.slots[i] = { deps, cleanup: fn() }; }); } };
const animations = [];
class Value {
    constructor(value) { this.value = value; this.listeners = new Map(); this.serial = 0; }
    setValue(value) { this.value = value; this.listeners.forEach(fn => fn({ value })); }
    stopAnimation() {}
    addListener(fn) { const id = ++this.serial; this.listeners.set(id, fn); return id; }
    removeListener(id) { this.listeners.delete(id); }
    interpolate(config) { return { value: this, ...config }; }
}
const Animated = { Value, View: "AnimatedView", timing: (value, config) => {
    const animation = { value, config, start() { animations.push(this); }, stop() { this.stopped = true; }, advance(fraction) { if (!this.stopped) value.setValue(fraction); } }; return animation;
} };
function load(file, extra = "") {
    const module = { exports: {} };
    new Function("require", "module", "exports", compile(read(file) + extra))(name => {
        if (name === "react") return react;
        if (name === "react-native") return { View: "View", Text: "Text", Pressable: "Pressable", Animated, Platform: { OS: "web" },
            Easing: { bezier: () => value => value }, StyleSheet: { create: s => s, absoluteFillObject: { position: "absolute", inset: 0 } }, useWindowDimensions: () => ({ width: 390, fontScale }) };
        if (name === "react-native-svg") return { __esModule: true, default: "Svg", ...Object.fromEntries(["Circle", "Defs", "LinearGradient", "RadialGradient", "Stop", "Text"].map(n => [n, n === "Text" ? "SvgText" : n])) };
        if (name === "@expo/vector-icons") return { Ionicons: "Icon" };
        if (name.endsWith("ThemeContext")) return { useTheme: () => ({ colors }) };
        if (name.endsWith("theme")) return theme;
        if (name.endsWith("feedingStats")) return feedingStats;
        if (name.endsWith("dates")) return dates;
        if (name === "./useReducedMotion") return { __esModule: true, default: () => reduced };
        if (name === "./useSoftPress") return { __esModule: true, default: () => ({ respond() {}, transform: [] }) };
        if (name === "./FeedingTodayCard") return { MetricArtwork: "MetricArtwork" };
        if (name === "../common/Cards") return { SectionContainerCard: "SectionContainerCard" };
        if (name === "./Skeleton") return { SkeletonBlock: "SkeletonBlock" };
        if (name === "./NutritionMixChart") return chartModule;
        return { __esModule: true, default: name.slice(2) };
    }, module, module.exports);
    return module.exports;
}
function pure(file) { const module = { exports: {} }; new Function("module", "exports", compile(read(file)))(module, module.exports); return module.exports; }
const theme = pure("../../theme.js"), dates = pure("../../utils/dates.js");
const feedingStats = load("../../utils/feedingStats.js");
const chartModule = load("NutritionMixChart.js"), Chart = chartModule.default;
const { default: Card, FeedingSummaryMetrics: Metrics, Control } = load("FeedingBreakdownCard.js", "\nexport { Control };");
function renderer(fn) {
    const state = { slots: [], effects: [], cursor: 0 };
    return { draw(props) { owner = state; let tree, passes = 0; do { state.dirty = false; state.cursor = 0; tree = fn(props); const effects = state.effects; state.effects = []; effects.forEach(f => f()); assert(++passes < 10); } while (state.dirty); return tree; },
        unmount() { state.slots.forEach(slot => slot?.cleanup?.()); } };
}
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.children || []).flatMap(nodes)] : [];
const find = (tree, id) => nodes(tree).find(n => n.props.testID === id);
const style = node => Object.assign({}, ...[node.props.style].flat());
const text = tree => typeof tree !== "object" ? String(tree ?? "") : (tree.children || []).map(text).join(" ");
const fixture = { totalEntries: 7, milkEntries: 4, solidFoodEntries: 3, milkPercentage: 400 / 7, solidFoodPercentage: 300 / 7,
    loggedMilkVolumeMl: 540, lastFeedingTime: "19:13", entries: Array.from({ length: 7 }, (_, i) => ({ id: i, entryType: i < 3 ? "solid" : "milk", date: "2026-10-14", time: i ? "" : "19:13" })) };
const empty = { ...fixture, totalEntries: 0, milkEntries: 0, solidFoodEntries: 0, milkPercentage: 0, solidFoodPercentage: 0, loggedMilkVolumeMl: null, lastFeedingTime: null, entries: [] };
const circleLength = 2 * Math.PI * 70;
const arcFraction = (tree, key) => Number(find(tree, "feeding-arc-" + key)?.props.strokeDasharray.split(" ")[0] || 0) / circleLength;
const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
for (colors of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    for (const bg of [...colors.feedingBreakdown.panel, ...colors.feedingBreakdown.entries, ...colors.feedingBreakdown.milk, ...colors.feedingBreakdown.solid, ...colors.feedingBreakdown.time]) {
        assert(contrast(colors.feedingBreakdown.text, bg) >= 4.5); assert(contrast(colors.feedingBreakdown.secondary, bg) >= 4.5);
    }
    for (const width of [220, 311, 700]) for (fontScale of [1, 1.6, 2]) {
        const chart = renderer(Chart); let tree = chart.draw({ summary: fixture }); find(tree, "feeding-donut").props.onLayout({ nativeEvent: { layout: { width } } }); tree = chart.draw({ summary: fixture });
        assert(Math.abs(arcFraction(tree, "solid") - 3 / 7) < 1e-9); assert(Math.abs(arcFraction(tree, "milk") - 4 / 7) < 1e-9);
        assert.equal(find(tree, "feeding-arc-solid").props.strokeDashoffset, -0); assert.equal(find(tree, "feeding-arc-milk").props.strokeDashoffset, -3 / 7 * circleLength);
        assert.equal(nodes(tree).find(n => n.type === "Svg").props.width, Math.min(width, 252));
        assert(nodes(tree).some(n => n.type === "MilkIcon" && n.props.showBackground === false));
        assert(tree.props.accessibilityLabel.includes("not nutritional intake")); chart.unmount();
        const metrics = renderer(Metrics); let tiles = metrics.draw({ summary: fixture }); find(tiles, "feeding-summary-metrics").props.onLayout({ nativeEvent: { layout: { width } } }); tiles = metrics.draw({ summary: fixture });
        assert.equal(text(find(tiles, "feeding-summary-milk")).trim(), "540 mL Logged milk volume");
        assert(text(find(tiles, "feeding-summary-time")).includes("7:13 PM"));
        const columns = width >= 600 * fontScale ? 4 : (width - 10) / 2 < 104 * fontScale ? 1 : 2;
        assert.equal(tiles.children.length, 4 / columns); assert(tiles.children.every(row => row.children.length === columns)); metrics.unmount();
    }
    fontScale = 1;
    const chart = renderer(Chart); let tree = chart.draw({ summary: empty }); assert.equal(arcFraction(tree, "milk"), 0); assert(tree.props.accessibilityLabel.includes("No feedings"));
    tree = chart.draw({ summary: { ...fixture, solidFoodPercentage: .1, milkPercentage: 99.9 } }); assert.equal(nodes(tree).filter(n => n.type === "SvgText").length, 2, "Tiny share is labeled through the legend only"); chart.unmount();
    const legend = renderer(chartModule.NutritionMixLegend); tree = legend.draw({ summary: fixture }); find(tree, "feeding-legends").props.onLayout({ nativeEvent: { layout: { width: 220 } } }); tree = legend.draw({ summary: fixture }); assert.equal(style(tree).flexDirection, "column"); assert(text(tree).includes("57%")); legend.unmount();
    let opened, toggled = 0, retries = 0;
    const card = renderer(Card), props = { date: "2026-10-14", summary: fixture, entriesVisible: false, onToggleEntries: () => toggled++, onOpenEntry: e => { opened = e; }, entryTitle: e => "Entry " + e.id, onRetry: () => retries++ };
    tree = card.draw(props); assert.equal(style(tree).overflow, "visible"); assert.equal(style(tree).borderWidth, 0);
    const disclosure = find(tree, "feeding-entries-toggle"); disclosure.props.onPress(); assert.equal(toggled, 1); assert.equal(disclosure.props["aria-expanded"], false);
    assert.equal(find(tree, "feeding-breakdown-history").props["aria-hidden"], true);
    let rows = nodes(tree).filter(n => n.type?.name === "Control" && n.props.surface === "row"); assert.equal(rows.length, 7); assert(rows.every(n => n.props.disabled));
    tree = card.draw({ ...props, entriesVisible: true }); rows = nodes(tree).filter(n => n.type?.name === "Control" && n.props.surface === "row"); assert(rows.every(n => !n.props.disabled)); rows[0].props.onPress(); assert.equal(opened, fixture.entries[0]);
    tree = card.draw({ ...props, entriesVisible: true, summary: { ...fixture, entries: [{ ...fixture.entries[0], time: "24:00" }] } });
    assert(!text(find(tree, "feeding-breakdown-history")).includes("12:00"), "Invalid times never become invented history timestamps");
    const info = tree.props.action; info.props.ref.current = { measureInWindow: fn => fn(20, 30, 44, 44) }; info.props.onPress(); tree = card.draw(props); assert.equal(nodes(tree).find(n => n.type === "AnchoredMenu").props.visible, true); assert(text(tree).includes("not milk volume"));
    tree = card.draw({ ...props, summary: empty, loading: true }); assert(find(tree, "feeding-breakdown-unavailable")); assert.equal(nodes(tree).filter(n => n.type === Metrics).length, 0);
    tree = card.draw({ ...props, summary: empty, loadFailed: true }); nodes(tree).find(n => n.props.accessibilityLabel === "Retry feeding records").props.onPress(); assert.equal(retries, 1);
    tree = card.draw({ ...props, summary: empty }); assert(text(tree).includes("No feeding entries logged today.")); assert.equal(find(tree, "feeding-entries-toggle"), undefined);
    tree = card.draw({ ...props, loading: true, loadFailed: true }); assert(nodes(tree).some(n => n.type === Metrics), "Cached records stay visible during refresh failures"); card.unmount();
    const metrics = renderer(Metrics); tree = metrics.draw({ summary: empty }); assert(text(find(tree, "feeding-summary-milk")).includes("Not logged")); assert(text(find(tree, "feeding-summary-time")).includes("Not logged")); metrics.unmount();
    const control = renderer(Control); tree = control.draw({}); tree.props.onFocus({ currentTarget: { matches: () => true } }); tree = control.draw({}); assert.equal(style(tree).outlineStyle, "solid"); tree.props.onBlur(); tree = control.draw({}); assert.equal(style(tree).outlineStyle, "none"); control.unmount();
}
reduced = false; animations.length = 0;
const moving = renderer(Chart), milkOnly = { ...fixture, milkPercentage: 100, solidFoodPercentage: 0 }, solidOnly = { ...fixture, milkPercentage: 0, solidFoodPercentage: 100 };
moving.draw({ summary: milkOnly }); moving.draw({ summary: solidOnly }); const first = animations.at(-1); assert.equal(first.config.duration, 320);
first.advance(.5); let movingTree = moving.draw({ summary: solidOnly }); assert.equal(arcFraction(movingTree, "milk"), .5); assert.equal(arcFraction(movingTree, "solid"), .5);
moving.draw({ summary: fixture }); assert(first.stopped, "Interrupted motion cancels the prior clock"); const second = animations.at(-1); second.advance(.5); movingTree = moving.draw({ summary: fixture }); assert(Math.abs(arcFraction(movingTree, "solid") - (.5 + 3 / 7) / 2) < 1e-9);
second.advance(1); movingTree = moving.draw({ summary: fixture }); assert(Math.abs(arcFraction(movingTree, "milk") - 4 / 7) < 1e-9);
reduced = true; movingTree = moving.draw({ summary: milkOnly }); assert.equal(arcFraction(movingTree, "milk"), 1); assert(second.stopped); moving.unmount(); assert.equal(second.value.listeners.size, 0);
const screen = read("../NutritionTracker.js");
assert(screen.includes("dailyFeedingSummary(entries, today)")); assert(screen.includes("summary={feedingSummary}")); assert(screen.includes("onOpenEntry={setDetailEntry}"));
assert(screen.includes("setShowFeedingEntries(false); }, [id, today])")); assert(screen.includes("setInterval(updateDay, 60000)")); assert(screen.includes('state === "active"'));
assert(!screen.includes("todayFeedingMix") && !screen.includes("mixLegendOpen"));
function walk(node, predicate) { if (!node || typeof node !== "object") return null; if (predicate(node)) return node;
    for (const child of Object.values(node).flat()) { const found = walk(child, predicate); if (found) return found; } return null; }
const clock = walk(parse(screen, { sourceType: "module", plugins: ["jsx"] }), node => node.type === "ArrowFunctionExpression" && screen.slice(node.start, node.end).includes("const updateDay ="));
let day = "2026-10-14", tick, foreground, cleared = false, removed = false, observedDays = [];
const startClock = new Function("setToday", "todayLocal", "setInterval", "clearInterval", "AppState", `return (${screen.slice(clock.start, clock.end)})`)(
    value => observedDays.push(value), () => day, (fn, delay) => { assert.equal(delay, 60000); tick = fn; return 7; },
    token => { assert.equal(token, 7); cleared = true; }, { addEventListener: (event, fn) => { assert.equal(event, "change"); foreground = fn; return { remove() { removed = true; } }; } });
const stopClock = startClock(); day = "2026-10-15"; tick(); foreground("background"); assert.deepEqual(observedDays, [day]);
day = "2026-10-16"; foreground("active"); assert.deepEqual(observedDays, ["2026-10-15", day]); stopClock(); assert(cleared && removed);
console.log("Daily breakdown checks passed: exact two-category arcs, six palettes, responsive metrics/legends, missing/loading/error states, approved icons, disclosure/detail/info actions, keyboard focus and interruptible/reduced motion.");
