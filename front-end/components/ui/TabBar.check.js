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
let colors = theme.paletteFor(undefined, "boy", "light"), inset = 0, platform = "web", scheme = "light";
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
        if (name === "expo-blur") return { BlurView: "BlurView" };
        if (name === "react-native-svg") return { __esModule: true, default: "Svg", Path: "Path", Rect: "Rect" };
        if (name === "react-native-safe-area-context") return { useSafeAreaInsets: () => ({ bottom: inset }) };
        if (name.includes("ThemeContext")) return { useTheme: () => ({ colors, scheme }) };
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
const glass = (tree) => find(tree, (node) => node.type === "BlurView");
const items = (tree) => find(tree, (node) => node.props?.style?.flexDirection === "row").props.children;
let selected, measured;
const blurTarget = { current: "background" };
let props = { activeView: "dashboard", blurTarget, onSelect: (tab) => { selected = tab; },
    onLayout: (event) => { measured = event.nativeEvent.layout.height; } };
const render = (changes = {}) => state.render(TabBar, props = { ...props, ...changes });
(async () => {
    let tree = render();
    tree.props.onLayout({ nativeEvent: { layout: { width: 400, height: 88 } } });
    assert.equal(measured, 88);
    resolveMotion(false);
    await Promise.resolve();
    tree = render();
    for (const gender of ["boy", "girl", "neutral"]) for (const mode of ["light", "dark"]) {
        scheme = mode;
        colors = theme.paletteFor(undefined, gender, mode);
        tree = render();
        const blur = glass(tree);
        assert.equal(blur.props.blurTarget, blurTarget);
        assert.equal(blur.props.intensity, 72);
        assert.equal(blur.props.tint, mode === "dark" ? "systemMaterialDark" : "systemMaterialLight");
        assert.equal(blur.props.style.overflow, "hidden");
        assert.equal(tree.props.style[0].paddingHorizontal, theme.space.md);
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
            const icon = find(item, (node) => node.type === TabIcon);
            const label = find(item, (node) => node.type === "Text");
            assert.equal(icon.props.color, tab.props.active ? colors.primary : colors.textMuted);
            assert.equal(label.props.style.at(-1).color, tab.props.active ? colors.primary : colors.textMuted);
            assert.equal(label.props.numberOfLines, 2);
            item.props.onPress();
            assert.equal(selected, tab.props.tab);
            isolated.hooks.unmount();
        }
    }
    platform = "android";
    tree = render();
    assert.equal(glass(tree).props.blurMethod, "dimezisBlurViewSdk31Plus");
    platform = "ios";
    tree = render({ activeView: "calendar" });
    tree = render({ activeView: "viewProfile" });
    assert(items(tree).every((item) => !item.props.active));
    inset = 34; tree = render();
    assert.equal(tree.props.style[1].paddingBottom, theme.space.sm + 34);
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
    assert.equal(lift.options.useNativeDriver, true);
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
    assert(app.includes("<BlurTargetView ref={blurTargetRef}"));
    assert(app.includes("blurTarget={blurTargetRef}"));
    assert(app.includes("style={styles.fabGlass}"));
    assert(!/tabPill|styles.tabBar/.test(app));
    assert(!tabSource.includes("indicator"));
    console.log("Tab bar checks passed: glass shell, five equal tabs, six themes, active states, blur fallback, motion, safe areas and navigation.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
