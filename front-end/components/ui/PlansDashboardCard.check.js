// Run: node components/ui/PlansDashboardCard.check.js — no server or record writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile(fs.readFileSync(path.join(__dirname, "../../theme.js"), "utf8")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
const code = compile(fs.readFileSync(path.join(__dirname, "PlansDashboardCard.js"), "utf8")
    + "\nmodule.exports.PlanTab = PlanTab; module.exports.StatusArtwork = StatusArtwork; module.exports.ClipboardArtwork = ClipboardArtwork;");
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(nodes)] : [];
const merge = styles => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));
const find = (tree, predicate) => nodes(tree).find(predicate);
function harness(platform = "web") {
    const slots = [], effects = [], animations = [];
    let cursor = 0, colors = theme.PALETTES.boy, reduced = false;
    const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
        useId: () => "plans-test", useMemo: fn => fn(),
        useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
            return [slots[i], next => slots[i] = typeof next === "function" ? next(slots[i]) : next]; },
        useLayoutEffect(fn, deps) { const i = cursor++, previous = slots[i];
            if (!previous || deps.some((value, n) => value !== previous.deps[n])) effects.push(() => {
                previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
            }); },
    };
    class Value {
        constructor(value) { this.value = value; }
        setValue(value) { this.value = value; }
        stopAnimation() { this.stopped = true; }
        interpolate(options) { return { source: this, ...options }; }
    }
    const animate = (kind, value, options) => {
        const animation = { kind, ...options, stopped: false, start() { animations.push(this); value.setValue(options.toValue); },
            stop() { this.stopped = true; } };
        return animation;
    };
    const native = { View: "View", Text: "Text", Pressable: "Pressable", Image: "Image", ScrollView: "ScrollView",
        StyleSheet: { create: styles => styles, absoluteFillObject: { position: "absolute", inset: 0 } },
        Platform: { OS: platform }, Easing: { out: fn => fn, cubic: "cubic" },
        Animated: { Value, View: "AnimatedView", Text: "AnimatedText",
            timing: (value, options) => animate("timing", value, options), spring: (value, options) => animate("spring", value, options) } };
    const imports = { react: { __esModule: true, default: react, ...react }, "react-native": native,
        "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Defs: "Defs", Ellipse: "Ellipse",
            LinearGradient: "LinearGradient", Path: "Path", Rect: "Rect", Stop: "Stop" },
        "../../context/ThemeContext": { useTheme: () => ({ colors }) }, "../../theme": theme,
        "./AnimatedReveal": { __esModule: true, default: "AnimatedReveal" },
        "./CalendarVisuals": { CalendarControl: "CalendarControl" }, "./Gradient": { __esModule: true, default: "Gradient" },
        "./useReducedMotion": { __esModule: true, default: () => reduced },
        "./useSoftPress": { __esModule: true, default: () => ({ respond() {}, transform: [] }) },
        "../../assets/navbar/calendar-blue.png": "calendar-blue.png" };
    const module = { exports: {} };
    new Function("require", "module", "exports", code)(name => { assert(name in imports, name); return imports[name]; }, module, module.exports);
    return { api: module.exports, animations,
        draw(component, props) { cursor = 0; const tree = component(props); while (effects.length) effects.shift()(); return tree; },
        palette(value) { colors = value; }, motion(value) { reduced = value; },
        cleanup() { for (const slot of slots) slot?.cleanup?.(); } };
}
const luminance = hex => hex.slice(1, 7).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
    .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
const h = harness(), changes = [], focused = [], scrolls = [];
let props = { value: "today", counts: { today: 0, upcoming: 2, overdue: 16, completed: 19 },
    onChange: value => changes.push(value), title: "Today's Plan", children: "selected content" };
const draw = changes => h.draw(h.api.default, props = { ...props, ...changes });
let tree = draw();
const tabs = tree => nodes(tree).filter(node => node.type === h.api.PlanTab);
const strip = tree => find(tree, node => node.type === "ScrollView");
const panel = tree => find(tree, node => node.props.testID === "plans-content-panel");
const entrance = tree => find(tree, node => node.type === "AnimatedView");
assert.equal(h.animations.length, 0, "No initial entrance animation");
assert.equal(nodes(tree).filter(node => node.props.testID === "plans-content-panel").length, 1);
assert.equal(panel(tree).props.accessibilityRole, "tabpanel");
assert.equal(panel(tree).props["aria-labelledby"], tabs(tree)[0].props.id);
strip(tree).props.ref.current = { scrollTo: value => scrolls.push(value) };
strip(tree).props.onLayout({ nativeEvent: { layout: { width: 280 } } });
tabs(tree).forEach((tab, index) => {
    tab.props.onLayout({ nativeEvent: { layout: { x: index * 210, width: 200 } } });
    tab.props.tabRef({ focus: () => focused.push(tab.props.tab.key) });
});
tree = draw();
assert.deepEqual(strip(tree).props.snapToOffsets, [0, 210, 420, 630]);
assert.equal(strip(tree).props.style.scrollSnapType, "x proximity", "Web snapping is explicit; RN Web ignores snapToOffsets");
for (const value of ["upcoming", "completed", "overdue"]) {
    const previousAnimation = h.animations.at(-1);
    tree = draw({ value, children: value + " content" });
    if (previousAnimation) assert(previousAnimation.stopped, "Rapid switches cancel the preceding entrance");
    assert.equal(h.animations.at(-1).duration, 220);
    assert.equal(panel(tree).props["aria-labelledby"], tabs(tree).find(tab => tab.props.active).props.id);
    assert.equal(nodes(tree).filter(node => node.props.testID === "plans-content-panel").length, 1);
    assert.deepEqual(entrance(tree).props.children, [value + " content"], "No outgoing category is kept mounted");
    assert.equal(scrolls.at(-1).x, value === "completed" ? 566 : value === "upcoming" ? 210 : 420);
}
const keyEvent = key => { const target = {}; return { key, target, currentTarget: target, preventDefault() { this.prevented = true; } }; };
tabs(tree)[2].props.onKeyDown(keyEvent("ArrowRight"));
assert.equal(changes.at(-1), "completed"); assert.equal(focused.at(-1), "completed");
tabs(tree)[0].props.onKeyDown(keyEvent("ArrowLeft")); assert.equal(changes.at(-1), "completed");
tabs(tree)[3].props.onKeyDown(keyEvent("Home")); assert.equal(changes.at(-1), "today");
tabs(tree)[0].props.onKeyDown(keyEvent("End")); assert.equal(changes.at(-1), "completed");
tabs(tree)[0].props.onKeyDown(keyEvent("Tab")); assert.equal(changes.at(-1), "completed", "Tab is not trapped");
for (const width of [320, 375, 430, 900]) {
    strip(tree).props.onLayout({ nativeEvent: { layout: { width } } }); tree = draw({ value: "completed" });
    assert(scrolls.at(-1).x >= 0 && scrolls.at(-1).x <= Math.max(0, 846 - width));
}
h.motion(true); tree = draw();
const before = h.animations.length;
tree = draw({ value: "today" });
assert.equal(h.animations.length, before);
assert.equal(entrance(tree).props.style.opacity.value, 1);
assert.equal(scrolls.at(-1).animated, false);
for (const colors of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    h.palette(colors); tree = draw();
    assert.equal(merge(tree.props.style).overflow, "visible");
    assert.equal(merge(panel(tree).props.style).overflow, "visible");
    assert.equal(merge(tree.props.style).boxShadow, colors.plansDashboard.panelShadow);
    const reveal = find(tree, node => node.type === "AnimatedReveal");
    assert(reveal.props.contentStyle.padding >= 14, "Height transitions reserve space for row shadows");
    assert(colors.plansDashboard.active.every(color => contrast(colors.calendarSurface.onActive, color) >= 4.5));
    assert(colors.plansDashboard.content.every(color => contrast(colors.calendarSurface.text, color) >= 4.5));
    for (const item of tabs(tree)) {
        const child = harness(); child.palette(colors); child.motion(true);
        const render = changes => child.draw(child.api.PlanTab, { ...item.props, ...changes });
        let button = render();
        assert.equal(button.props.accessibilityRole, "tab");
        assert.equal(button.props["aria-selected"], item.props.active);
        assert.equal(button.props["aria-controls"], panel(tree).props.nativeID);
        assert.equal(button.props.tabIndex, item.props.active ? 0 : -1);
        assert(button.props.accessibilityLabel.includes(String(item.props.count)));
        assert(merge(button.props.style).minHeight >= theme.MIN_TOUCH);
        assert.equal(merge(button.props.style).flexShrink, 0);
        assert.equal(merge(button.props.style).scrollSnapAlign, "start");
        assert.equal(find(button, node => node.type === "AnimatedText").props.numberOfLines, undefined);
        button.props.onPress(); assert.equal(changes.at(-1), item.props.tab.key);
        button.props.onFocus({ currentTarget: { matches: () => true } }); button = render();
        assert.equal(merge(button.props.style).outlineColor, colors.calendarSurface.focus);
        child.motion(false); button = render({ active: !item.props.active });
        assert.equal(child.animations.at(-1).kind, "spring");
        assert.equal(child.animations.at(-1).overshootClamping, true);
        button = render({ active: item.props.active });
        assert(child.animations.at(-2).stopped, "Rapid tab changes cancel unfinished springs");
        child.motion(true); render({ active: !item.props.active });
        assert.equal(child.animations.length, 2);
        child.cleanup();
    }
}
let added = false;
const empty = h.draw(h.api.PlansEmptyState, { message: "No plans recorded for this day.",
    onAddPlan: () => added = true, addPlanLabel: "Add a plan for 10 Oct 2026" });
const addButton = find(empty, node => node.type === h.api.PlanAddButton);
addButton.props.onPress(); assert(added);
assert(!nodes(h.draw(h.api.PlansEmptyState, { message: "No overdue vaccines or checkups." })).some(node => node.type === h.api.PlanAddButton));
const artwork = h.draw(h.api.StatusArtwork, { kind: "today" });
assert.equal(find(artwork, node => node.type === "Image").props.source, "calendar-blue.png");
assert.equal(merge(artwork.props.style).width, merge(artwork.props.style).height);
assert.equal(merge(artwork.props.style).borderRadius, merge(artwork.props.style).width / 2);
const native = harness("android"), nativeTree = native.draw(native.api.default, props);
assert.equal(panel(nativeTree).props.accessibilityRole, undefined, "Web-only tabpanel role is not sent as a native role");
assert.equal(strip(nativeTree).props.style, undefined);
h.cleanup();
console.log("Plans dashboard checks passed: one panel, keyboard/focus, measured snapping and bounds, six themes/contrast, interruption and reduced motion.");
