// Run: node components/ui/TabBar.check.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Jimp = require("jimp-compact");
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
        useLayoutEffect(fn, deps) { return React.useEffect(fn, deps); },
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
    Value, View: "AnimatedView", Text: "AnimatedText",
    timing(value, options) {
        const animation = { kind: "timing", value, options, started: false, stopped: false,
            start() { this.started = true; value.setValue(options.toValue); }, stop() { this.stopped = true; } };
        animationLog.push(animation); return animation;
    },
    spring(value, options) {
        const animation = this.timing(value, options);
        animation.kind = "spring";
        return animation;
    },
    parallel(steps) {
        return { start() { steps.forEach((step) => step.start()); }, stop() { steps.forEach((step) => step.stop()); } };
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
let colors = theme.paletteFor(undefined, "boy", "light"), inset = 0, platform = "web", scheme = "light", themeMode = "boy";
let motionListener, resolveMotion, unsubscribe = false;
const state = harness();
const native = {
    Animated, View: "View", Text: "Text", Pressable: "Pressable", Image: "Image",
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
        if (name === "react-native-safe-area-context") return { useSafeAreaInsets: () => ({ bottom: inset, left: 24, right: 12 }) };
        if (name.includes("ThemeContext")) return { useTheme: () => ({ colors, scheme, mode: themeMode }) };
        if (name.includes("LanguageContext")) return { useLanguage: () => ({ t: (key) => key }) };
        if (name === "../../theme") return theme;
        if (name === "./Gradient") return { __esModule: true, default: "Gradient" };
        if (name.startsWith("../../assets/navbar/")) return name;
        assert.fail("Unexpected import: " + name);
    },
    moduleUnderTest, moduleUnderTest.exports,
);
const { default: TabBar, TabItem, TabIcon, TAB_KEYS, TAB_ICON_SIZE, TAB_BAR_BASE_HEIGHT, TAB_ICON_ASSETS, TAB_ICON_SOURCES } = moduleUnderTest.exports;
const tabSource = fs.readFileSync(path.join(root, "components/ui/TabBar.js"), "utf8");
const itemNode = parse(tabSource, { sourceType: "module", plugins: ["jsx"] }).program.body
    .find((node) => node.type === "FunctionDeclaration" && node.id.name === "TabItem");
const itemCode = transformSync(tabSource.slice(itemNode.start, itemNode.end), {
    babelrc: false, configFile: false, plugins: [["@babel/plugin-transform-react-jsx", { runtime: "classic" }]],
}).code;
function isolatedItem() {
    const hooks = harness();
    const component = new Function("React", "Animated", "Easing", "Platform", "motion", "TabIcon", "View", "Pressable", "Text", "Gradient",
        "const { useRef, useEffect, useState } = React; " + itemCode + "; return TabItem;")(
        hooks.React, Animated, native.Easing, native.Platform, theme.motion, TabIcon, "View", "Pressable", "Text", "Gradient",
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
const row = (tree) => find(tree, (node) => node.props?.style?.flexDirection === "row");
const items = (tree) => row(tree).props.children.filter((node) => node.type === TabItem);
const indicator = (tree) => find(tree, (node) => node.props?.testID === "navbar-glass-indicator");
const indicatorStyle = (tree) => indicator(tree).props.style.at(-1);
const measureRow = (tree, width, height = 84) => row(tree).props.onLayout({ nativeEvent: { layout: { width, height } } });
const rgb = (hex) => hex.slice(1, 7).match(/../g).map((part) => parseInt(part, 16) / 255);
const luminance = (values) => values.reduce((sum, value, i) => sum + [0.2126, 0.7152, 0.0722][i]
    * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4), 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
const composite = (hex, background) => {
    const opacity = hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1;
    return rgb(hex).map((value, i) => value * opacity + background[i] * (1 - opacity));
};
let selected, measured;
const blurTarget = { current: "background" };
let props = { activeView: "health", blurTarget, onSelect: (tab) => { selected = tab; },
    onLayout: (event) => { measured = event.nativeEvent.layout.height; } };
const render = (changes = {}) => state.render(TabBar, props = { ...props, ...changes });
(async () => {
    let tree = render();
    tree.props.onLayout({ nativeEvent: { layout: { width: 400, height: TAB_BAR_BASE_HEIGHT } } });
    assert.equal(measured, TAB_BAR_BASE_HEIGHT);
    resolveMotion(false);
    await Promise.resolve();
    tree = render();
    assert.equal(indicatorStyle(tree).opacity, 0, "Indicator waits for a real row measurement");
    measureRow(tree, 342);
    tree = render();
    assert.equal(indicatorStyle(tree).width, (342 - 16) / 5);
    assert.equal(indicatorStyle(tree).height, 76);
    assert.equal(indicatorStyle(tree).transform[0].translateX.value, 4 + ((342 - 16) / 5 + 2), "Initial non-Home route is placed without animating from Home");
    assert(!animationLog.some((animation) => animation.kind === "spring"), "First measured placement is immediate");
    tree = render({ activeView: "dashboard" });
    const persistentValue = indicatorStyle(tree).transform[0].translateX;
    for (const gender of ["boy", "girl", "neutral"]) for (const mode of ["light", "dark"]) {
        scheme = mode; themeMode = gender;
        colors = theme.paletteFor(undefined, gender, mode);
        tree = render();
        const blur = glass(tree);
        assert.equal(blur.props.blurTarget, blurTarget);
        assert.equal(blur.props.intensity, 80);
        assert.equal(blur.props.tint, mode === "dark" ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight");
        assert.equal(blur.props.style.overflow, "hidden");
        assert.equal(blur.props.style.borderRadius, 44, "Tall layouts keep corner content visible");
        assert.equal(tree.props.style[0].paddingHorizontal, theme.space.md);
        assert.equal(items(tree).length, 5);
        assert.equal(tree.props.style[0].position, "absolute");
        assert.equal(tree.props.style[0].bottom, 0);
        assert.equal(tree.props.style[0].zIndex, 20);
        assert.equal(tree.props.pointerEvents, "box-none");
        assert.equal(tree.props.style[1].left, 24);
        assert.equal(tree.props.style[1].right, 12);
        assert.equal(blur.props.style.backgroundColor, undefined, "No opaque layer hides the blur target");
        for (const backdrop of ["#000000", "#FFFFFF", colors.background]) {
            const base = composite(mode === "dark" ? "#25252570" : "#F9F9F99F", rgb(backdrop));
            for (const stop of colors.navbar.gradient) {
                const glassColor = composite(stop, base);
                assert(contrast(rgb(colors.navbar.inactiveLabel), glassColor) >= 4.5, `${gender}/${mode}: inactive labels stay readable`);
                for (const selectedStop of colors.navbar.selectedGradient) {
                    assert(contrast(rgb(colors.navbar.activeLabel), composite(selectedStop, glassColor)) >= 4.5, `${gender}/${mode}: active labels stay readable`);
                }
            }
        }
        for (const tab of items(tree)) {
            const frame = TabIcon({ name: tab.props.tab, active: tab.props.active, mode: gender });
            assert.equal(frame.props.style.width, TAB_ICON_SIZE);
            assert.equal(frame.props.style.height, TAB_ICON_SIZE);
            assert.equal(frame.props.source, TAB_ICON_ASSETS[tab.props.tab][tab.props.active ? gender === "girl" ? "pink" : "blue" : "inactive"]);
            assert.equal(frame.props.resizeMode, "contain");
            assert.equal(frame.props.fadeDuration, 0);
            assert.equal(frame.props.accessible, false);
            const isolated = isolatedItem();
            const item = isolated.hooks.render(isolated.component, { ...tab.props, reduceMotion: true });
            assert.equal(item.props.accessibilityRole, "tab");
            assert.equal(item.props.accessibilityState.selected, tab.props.active);
            assert.equal(item.props["aria-selected"], tab.props.active);
            const style = item.props.style({ pressed: false })[0];
            assert.equal(style.flex, 1);
            assert.equal(style.minWidth, 0);
            assert(style.minHeight >= 44);
            assert.equal(style.justifyContent, "flex-start", "Icons align when translated labels wrap");
            const activeLayer = item.props.children[0].props.children[0].props.children[1];
            const inactiveLayer = item.props.children[0].props.children[0].props.children[0];
            assert.equal(activeLayer.props.children[0].props.active, true);
            assert.equal(inactiveLayer.props.children[0].props.active, undefined);
            assert.equal(activeLayer.props.children[0].props.mode, gender);
            assert.equal(activeLayer.props.style.at(-1).opacity.value, tab.props.active ? 1 : 0);
            assert.deepEqual(inactiveLayer.props.style.at(-1).opacity.outputRange, [1, 0]);
            assert.equal(find(item, (node) => node.type === "Gradient"), null, "Items never own selection panels");
            const label = find(item, (node) => node.type === "AnimatedText");
            assert.deepEqual(label.props.style.at(-1).color.outputRange, [colors.navbar.inactiveLabel, colors.navbar.activeLabel]);
            assert.equal(label.props.style.at(-1).color.source.value, tab.props.active ? 1 : 0);
            assert.equal(label.props.numberOfLines, undefined, "Large text wraps without truncation");
            assert.equal(label.props.allowFontScaling, undefined, "Default accessibility scaling stays enabled");
            assert.equal(label.props.style[0].fontWeight, "600", "Selection never changes label weight");
            assert.equal(indicator(tree).props.style[0].borderWidth, undefined);
            const panel = indicator(tree).props.children[0];
            assert.equal(panel.props.style.borderWidth, undefined);
            assert.equal(panel.props.style.borderColor, undefined);
            assert.equal(panel.props.style.borderRadius, 26);
            assert.deepEqual(panel.props.colors, colors.navbar.selectedGradient);
            assert.deepEqual(panel.props.children[0].props.colors, colors.navbar.selectedReflection);
            assert.equal(indicator(tree).props.pointerEvents, "none");
            assert.equal(indicatorStyle(tree).transform[0].translateX, persistentValue);
            item.props.onPress();
            assert.equal(selected, tab.props.tab);
            isolated.hooks.unmount();
        }
    }
    platform = "android";
    tree = render();
    assert.equal(glass(tree).props.blurMethod, "dimezisBlurViewSdk31Plus");
    platform = "ios";
    const springCount = () => animationLog.filter((animation) => animation.kind === "spring").length;
    let beforeSprings = springCount();
    tree = render({ activeView: "calendar" });
    assert.equal(springCount(), beforeSprings + 1);
    const firstSlide = animationLog.at(-1);
    assert.equal(firstSlide.kind, "spring");
    assert.equal(firstSlide.options.toValue, 4 + 4 * ((342 - 16) / 5 + 2));
    assert.equal(firstSlide.options.useNativeDriver, true);
    assert.equal(firstSlide.options.overshootClamping, true);
    assert.equal(firstSlide.options.isInteraction, false);
    assert.equal(firstSlide.options.stiffness, 450);
    tree = render({ activeView: "health" });
    assert(firstSlide.stopped, "Rapid navigation cancels the previous spring");
    assert.equal(indicatorStyle(tree).transform[0].translateX, persistentValue);
    assert.equal(persistentValue.value, 4 + ((342 - 16) / 5 + 2));
    const repeatedCount = springCount();
    tree = render({ activeView: "health" });
    assert.equal(springCount(), repeatedCount, "Repeated selection does not restart animation");
    measureRow(tree, 287, 128);
    tree = render();
    assert.equal(springCount(), repeatedCount, "Resize aligns immediately instead of sliding with stale dimensions");
    assert.equal(indicatorStyle(tree).width, (287 - 16) / 5);
    assert.equal(indicatorStyle(tree).height, 120);
    assert.equal(persistentValue.value, 4 + ((287 - 16) / 5 + 2));
    tree = render({ activeView: "viewProfile" });
    assert(items(tree).every((item) => !item.props.active));
    assert.equal(indicatorStyle(tree).opacity, 0);
    const hiddenCount = springCount();
    tree = render({ activeView: "growth" });
    assert.equal(springCount(), hiddenCount, "Returning from an unrelated route places the tile without a flash");
    motionListener(true);
    tree = render({ activeView: "nutrition" });
    assert.equal(springCount(), hiddenCount);
    assert.equal(persistentValue.value, 4 + 3 * ((287 - 16) / 5 + 2));
    motionListener(false);
    tree = render({ activeView: "calendar" });
    const lastSlide = animationLog.at(-1);
    motionListener(true);
    tree = render();
    assert(lastSlide.stopped, "Enabling reduced motion cancels an in-flight slide");
    inset = 34; tree = render();
    assert.equal(tree.props.style[1].paddingBottom, theme.space.md + 34);
    assert.equal(tree.props.style[1].minHeight, TAB_BAR_BASE_HEIGHT + 34);
    state.unmount();
    assert(unsubscribe, "Reduced-motion listener is cleaned up");
    assert(persistentValue.stops > 0, "Indicator stops on unmount");
    const isolated = isolatedItem();
    let itemProps = { tab: "health", label: "Health", active: false, reduceMotion: false, colors,
        styles: { item: {}, iconFrame: {}, iconLayer: {}, label: {}, itemWeb: { outlineStyle: "none" },
            itemFocused: { outlineWidth: 2 } }, onSelect() {} };
    const drawItem = (changes = {}) => isolated.hooks.render(isolated.component, itemProps = { ...itemProps, ...changes });
    drawItem();
    const initialAnimations = animationLog.length;
    let itemTree = drawItem({ active: true });
    assert.equal(animationLog.length, initialAnimations + 3, "Selection coordinates crossfade and two scale legs");
    const colorChange = animationLog.at(-3), lift = animationLog.at(-2), settle = animationLog.at(-1);
    assert.equal(colorChange.options.duration, 220);
    assert.equal(lift.options.duration + settle.options.duration, 220);
    assert.equal(lift.options.toValue, 1.05);
    assert.equal(settle.options.toValue, 1);
    assert.equal(lift.options.useNativeDriver, true);
    const transforms = find(itemTree, (node) => node.type === "AnimatedView").props.style.at(-1).transform;
    assert.deepEqual(transforms[0].translateY.outputRange, [0, -1]);
    drawItem({ active: true });
    assert.equal(animationLog.length, initialAnimations + 3, "Selected rerenders do not restart icon motion");
    drawItem({ active: false });
    assert(colorChange.stopped && lift.stopped && settle.stopped, "Deselecting cancels unfinished icon transitions");
    assert.equal(animationLog.at(-1).options.toValue, 0.96);
    const countBeforeReduce = animationLog.length;
    itemTree = drawItem({ active: true, reduceMotion: true });
    assert.equal(animationLog.length, countBeforeReduce);
    assert.equal(find(itemTree, (node) => node.type === "AnimatedText").props.style.at(-1).color.source.value, 1);
    isolated.hooks.unmount();
    platform = "web";
    const focusedItem = isolatedItem();
    let focusProps = { ...itemProps, reduceMotion: true };
    let focusTree = focusedItem.hooks.render(focusedItem.component, focusProps);
    const focusEvent = (visible) => ({ currentTarget: { matches: (selector) => {
        assert.equal(selector, ":focus-visible"); return visible;
    } } });
    focusTree.props.onFocus(focusEvent(false));
    focusTree = focusedItem.hooks.render(focusedItem.component, focusProps);
    assert(!focusTree.props.style({ pressed: false }).includes(focusProps.styles.itemFocused), "Pointer focus has no outline");
    focusTree.props.onFocus(focusEvent(true));
    focusTree = focusedItem.hooks.render(focusedItem.component, focusProps);
    assert(focusTree.props.style({ pressed: false }).includes(focusProps.styles.itemFocused), "Keyboard focus stays visible");
    focusTree.props.onPressIn(focusEvent(false));
    focusTree = focusedItem.hooks.render(focusedItem.component, focusProps);
    assert(!focusTree.props.style({ pressed: true }).includes(focusProps.styles.itemFocused), "Pointer interaction clears a prior keyboard outline");
    focusTree.props.onKeyDown(focusEvent(true));
    focusTree = focusedItem.hooks.render(focusedItem.component, focusProps);
    assert(focusTree.props.style({ pressed: false }).includes(focusProps.styles.itemFocused));
    focusTree.props.onBlur();
    focusTree = focusedItem.hooks.render(focusedItem.component, focusProps);
    assert(!focusTree.props.style({ pressed: false }).includes(focusProps.styles.itemFocused));
    focusedItem.hooks.unmount();
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
    assert(app.includes("<GlassFab onPress={() => setActionSheetVisible(true)}"));
    assert(app.includes("bottom: (tabBarHeight || TAB_BAR_BASE_HEIGHT + insets.bottom) + space.md"));
    assert(!/tabPill|styles.tabBar/.test(app));
    assert.equal((tabSource.match(/testID="navbar-glass-indicator"/g) || []).length, 1);
    assert(app.includes("Asset.loadAsync([...sources, ...TAB_ICON_SOURCES, ...HEADER_ICON_SOURCES])"));
    assert.equal(TAB_ICON_SOURCES.length, 15);
    assert.equal(new Set(Object.values(TAB_ICON_ASSETS.growth)).size, 3, "Growth restores separate blue, pink and inactive navbar artwork");
    assert.equal(TabIcon({ name: "unknown" }), null);
    for (const sources of Object.values(TAB_ICON_ASSETS)) for (const file of Object.values(sources)) {
        const png = fs.readFileSync(path.resolve(root, "components/ui", file));
        assert.equal(png.subarray(1, 4).toString(), "PNG");
        assert.equal(png.readUInt32BE(16), 128);
        assert.equal(png.readUInt32BE(20), 128);
        assert.equal(png[25], 6, "Icons preserve RGBA transparency");
        const image = await Jimp.read(png);
        let visible = 0, clear = 0;
        image.scanQuiet(0, 0, 128, 128, (x, y, index) => {
            const alpha = image.bitmap.data[index + 3];
            if (alpha >= 32) {
                visible++;
                assert(x >= 4 && x < 124 && y >= 4 && y < 124, "Icon edges stay clear of the frame");
            }
            if (alpha === 0) clear++;
        });
        assert(visible > 128 * 128 * 0.1, "Icon is not blank");
        assert(clear > 128 * 128 * 0.25, "Icon background is genuinely transparent");
        assert.equal(Jimp.intToRGBA(image.getPixelColor(0, 0)).a, 0);
    }
    console.log("Tab bar checks passed: borderless sliding glass, responsive geometry, six themes, icon/label transitions, focus-visible, reduced motion, safe areas and navigation.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
