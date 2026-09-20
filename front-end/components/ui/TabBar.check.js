// Run: node components/ui/TabBar.check.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const { parse } = require("@babel/parser");
const root = path.resolve(__dirname, "../..");
function harness() {
    const slots = [], effects = [];
    let cursor = 0;
    const changed = (a, b) => !a || !b || b.some((value, i) => value !== a[i]);
    const React = {
        Fragment: "Fragment",
        createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
        useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
        useState(value) {
            const i = cursor++;
            if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value;
            return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }];
        },
        useMemo(fn) { return fn(); },
        useEffect(fn, deps) {
            const i = cursor++, previous = slots[i];
            if (changed(previous?.deps, deps)) effects.push(() => {
                previous?.cleanup?.();
                slots[i] = { deps, cleanup: fn() };
            });
        },
    };
    return {
        React,
        render(component, props) { cursor = 0; const tree = component(props); while (effects.length) effects.shift()(); return tree; },
        unmount() { for (const slot of slots) slot?.cleanup?.(); },
    };
}
const animationLog = [];
class Value {
    constructor(value) { this.value = value; this.stops = 0; }
    setValue(value) { this.value = value; }
    stopAnimation() { this.stops++; }
    interpolate(options) { return { source: this, ...options }; }
}
const Animated = {
    Value, View: "AnimatedView",
    timing(value, options) {
        const animation = { value, options, started: false, stopped: false,
            start() { this.started = true; value.setValue(options.toValue); }, stop() { this.stopped = true; } };
        animationLog.push(animation); return animation;
    },
    sequence(steps) {
        return { start() { steps.forEach((step) => step.start()); }, stop() { steps.forEach((step) => step.stop()); } };
    },
};
function compile(file, extra = "") {
    return transformSync(fs.readFileSync(path.join(root, file), "utf8") + extra, {
        babelrc: false, configFile: false,
        plugins: ["@babel/plugin-transform-modules-commonjs", ["@babel/plugin-transform-react-jsx", { runtime: "classic" }]],
    }).code;
}
const themeModule = { exports: {} };
new Function("module", "exports", compile("theme.js"))(themeModule, themeModule.exports);
const theme = themeModule.exports;
let colors = theme.paletteFor(undefined, "boy", "light"), inset = 0, platform = "web";
let motionListener, resolveMotion, unsubscribe = false;
const state = harness();
const native = {
    Animated, View: "View", Text: "Text", Pressable: "Pressable",
    StyleSheet: { create: (styles) => styles },
    Easing: { bezier: (...values) => values },
    Platform: { get OS() { return platform; } },
    AccessibilityInfo: {
        isReduceMotionEnabled: () => new Promise((resolve) => { resolveMotion = resolve; }),
        addEventListener: (_, listener) => { motionListener = listener; return { remove() { unsubscribe = true; } }; },
    },
};
const moduleUnderTest = { exports: {} };
new Function("require", "module", "exports", compile("components/ui/TabBar.js", "\nmodule.exports.TabItem = TabItem;"))(
    (name) => {
        if (name === "react") return state.React;
        if (name === "react-native") return native;
        if (name === "react-native-svg") return { __esModule: true, default: "Svg", Path: "Path", Rect: "Rect" };
        if (name === "react-native-safe-area-context") return { useSafeAreaInsets: () => ({ bottom: inset }) };
        if (name.includes("ThemeContext")) return { useTheme: () => ({ colors }) };
        if (name.includes("LanguageContext")) return { useLanguage: () => ({ t: (key) => key }) };
        if (name === "../../theme") return theme;
        assert.fail("Unexpected import: " + name);
    },
    moduleUnderTest, moduleUnderTest.exports,
);
const { default: TabBar, TabItem, TabIcon, TAB_KEYS, TAB_ICON_SIZE, TAB_BAR_BASE_HEIGHT } = moduleUnderTest.exports;
const tabSource = fs.readFileSync(path.join(root, "components/ui/TabBar.js"), "utf8");
const itemNode = parse(tabSource, { sourceType: "module", plugins: ["jsx"] }).program.body
    .find((node) => node.type === "FunctionDeclaration" && node.id.name === "TabItem");
const itemCode = transformSync(tabSource.slice(itemNode.start, itemNode.end), {
    babelrc: false, configFile: false, plugins: [["@babel/plugin-transform-react-jsx", { runtime: "classic" }]],
}).code;
function isolatedItem() {
    const hooks = harness();
    const component = new Function("React", "Animated", "Easing", "Platform", "motion", "TabIcon", "View", "Pressable", "Text",
        "const { useRef, useEffect } = React; " + itemCode + "; return TabItem;")(
        hooks.React, Animated, native.Easing, native.Platform, theme.motion, TabIcon, "View", "Pressable", "Text",
    );
    return { hooks, component };
}
function find(node, predicate) {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;
    for (const child of node.props?.children || []) { const hit = find(child, predicate); if (hit) return hit; }
    return null;
}
const indicator = (tree) => find(tree, (node) => node.type === "AnimatedView");
const items = (tree) => find(tree, (node) => node.props?.style?.flexDirection === "row").props.children;
let selected, measured;
let props = { activeView: "dashboard", onSelect: (tab) => { selected = tab; }, onLayout: (event) => { measured = event.nativeEvent.layout.height; } };
const render = (changes = {}) => state.render(TabBar, props = { ...props, ...changes });
(async () => {
    let tree = render();
    assert.equal(indicator(tree), null, "No misplaced indicator before measurement");
    tree.props.onLayout({ nativeEvent: { layout: { width: 400, height: 88 } } });
    tree = render();
    assert.equal(measured, 88);
    resolveMotion(false);
    await Promise.resolve();
    tree = render();
    for (const gender of ["boy", "girl", "neutral"]) for (const scheme of ["light", "dark"]) {
        colors = theme.paletteFor(undefined, gender, scheme);
        tree = render();
        assert.equal(tree.props.style[0].backgroundColor, colors.surface);
        assert.equal(indicator(tree).props.style[0].backgroundColor, colors.primary);
        assert.equal(items(tree).length, 5);
        for (const tab of items(tree)) {
            const frame = TabIcon({ name: tab.props.tab, color: colors.text });
            assert.equal(frame.props.width, TAB_ICON_SIZE);
            assert.equal(frame.props.height, TAB_ICON_SIZE);
            assert.equal(frame.props.viewBox, "0 0 32 32");
            assert.equal(frame.props.accessible, false);
            const isolated = isolatedItem();
            const item = isolated.hooks.render(isolated.component, { ...tab.props, reduceMotion: true });
            assert.equal(item.props.accessibilityRole, "tab");
            assert.equal(item.props.accessibilityState.selected, tab.props.active);
            const style = item.props.style({ pressed: false })[0];
            assert.equal(style.flex, 1);
            assert.equal(style.minWidth, 0);
            assert(style.minHeight >= 44);
            assert.equal(find(item, (node) => node.type === "Text").props.numberOfLines, 2);
            item.props.onPress();
            assert.equal(selected, tab.props.tab);
            isolated.hooks.unmount();
        }
    }
    for (const width of [320, 375, 390, 430, 768]) {
        tree.props.onLayout({ nativeEvent: { layout: { width, height: 88 } } });
        for (const tab of TAB_KEYS) {
            tree = render({ activeView: tab });
            const mark = indicator(tree).props.style[1];
            assert.equal(mark.width, width / 5 * 0.6);
            assert.equal(mark.transform[0].translateX.value, width / 5 * (TAB_KEYS.indexOf(tab) + 0.2));
            tree = render();
        }
    }
    render({ activeView: "health" });
    const oldAnimation = animationLog.at(-1);
    render({ activeView: "growth" });
    assert(oldAnimation.stopped, "Rapid changes stop the old indicator animation");
    assert.equal(animationLog.at(-1).options.duration, 220);
    assert.equal(animationLog.at(-1).options.useNativeDriver, false);
    platform = "ios";
    render({ activeView: "nutrition" });
    assert.equal(animationLog.at(-1).options.useNativeDriver, true);
    const before = animationLog.length;
    motionListener(true);
    render();
    tree = render({ activeView: "calendar" });
    assert.equal(animationLog.length, before, "Reduced motion disables indicator animation");
    tree = render({ activeView: "viewProfile" });
    assert.equal(indicator(tree), null, "Secondary screens have no falsely selected tab");
    assert(items(tree).every((item) => !item.props.active));
    inset = 34; tree = render();
    assert.equal(tree.props.style[1].paddingBottom, theme.space.md + 34);
    assert.equal(tree.props.style[0].minHeight, TAB_BAR_BASE_HEIGHT);
    state.unmount();
    assert(unsubscribe, "Reduced-motion listener is cleaned up");
    const isolated = isolatedItem();
    let itemProps = { tab: "health", label: "Health", active: false, reduceMotion: false, colors,
        styles: { item: {}, iconFrame: {}, label: {} }, onSelect() {} };
    const drawItem = (changes) => isolated.hooks.render(isolated.component, itemProps = { ...itemProps, ...changes });
    drawItem({});
    const initialAnimations = animationLog.length;
    let itemTree = drawItem({ active: true });
    assert.equal(animationLog.length, initialAnimations + 2, "New selection starts one lift and settle");
    const lift = animationLog.at(-2), settle = animationLog.at(-1);
    assert.equal(lift.options.duration + settle.options.duration, 220);
    const transforms = find(itemTree, (node) => node.type === "AnimatedView").props.style.transform;
    assert.deepEqual(transforms[0].translateY.outputRange, [0, -2]);
    assert.deepEqual(transforms[1].scale.outputRange, [1, 1.06]);
    drawItem({ active: true });
    assert.equal(animationLog.length, initialAnimations + 2, "Repeated selected renders do not restart motion");
    drawItem({ active: false });
    assert(lift.stopped && settle.stopped, "Deselecting stops both icon animation legs");
    assert.equal(lift.value.value, 0);
    drawItem({ active: true, reduceMotion: true });
    assert.equal(animationLog.length, initialAnimations + 2, "Reduced motion suppresses icon effects");
    isolated.hooks.unmount();
    // Shared content clearance must include the measured bar and the floating add button.
    const responsive = { exports: {} };
    new Function("require", "module", "exports", compile("utils/responsive.js"))(
        (name) => name === "../theme" ? theme : name.includes("ScrollContext") ? { useScroll: () => ({ tabBarHeight: 150 }) }
            : name === "react-native-safe-area-context" ? { useSafeAreaInsets: () => ({ bottom: inset }) } : {},
        responsive, responsive.exports,
    );
    assert.equal(responsive.exports.useScreenPadBottom(), 150 + 56 + theme.space.md + theme.space.lg);
    const app = fs.readFileSync(path.join(root, "App.js"), "utf8");
    assert(app.includes("changeView(view);"));
    assert(app.includes("useScrollController(headerHeight, tabBarHeight)"));
    assert(!/tabPill|styles.tabBar/.test(app));
    console.log("Tab bar checks passed: five tabs, six themes, equal frames/columns, resize, rapid switching, reduced motion, safe areas and navigation.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
