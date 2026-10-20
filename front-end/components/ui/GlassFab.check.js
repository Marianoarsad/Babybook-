// Run: node components/ui/GlassFab.check.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "../..");
const compile = (file) => transformSync(fs.readFileSync(path.join(root, file), "utf8"), {
    babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", ["@babel/plugin-transform-react-jsx", { runtime: "classic" }]],
}).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile("theme.js"))(themeModule, themeModule.exports);
const theme = themeModule.exports;
let nextId = 0;
function harness(gender = "boy", scheme = "light", platform = "web") {
    const slots = [], effects = [], animations = [];
    let cursor = 0, resolveMotion, listener, removed = false, calls = 0;
    const React = {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
        useMemo: (fn) => fn(),
        useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
        useId() { const i = cursor++; return slots[i] ||= ":r" + nextId++ + ":"; },
        useState(value) {
            const i = cursor++; if (!(i in slots)) slots[i] = value;
            return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }];
        },
        useEffect(fn, deps) {
            const i = cursor++, previous = slots[i];
            if (!previous || deps.some((value, n) => value !== previous.deps[n])) effects.push(() => {
                previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
            });
        },
    };
    class Value {
        constructor(value) { this.value = value; this.stops = 0; }
        stopAnimation() { this.stops++; }
        setValue(value) { this.value = value; }
        interpolate(options) { return { source: this, ...options }; }
    }
    const animate = (kind, value, options) => {
        const animation = { kind, value, options, start() { value.setValue(options.toValue); } };
        animations.push(animation); return animation;
    };
    const native = {
        Animated: { Value, View: "AnimatedView", timing: (v, o) => animate("timing", v, o), spring: (v, o) => animate("spring", v, o) },
        Platform: { OS: platform }, Pressable: "Pressable", View: "View", StyleSheet: { create: (value) => value },
        Easing: { bezier: (...args) => args },
        AccessibilityInfo: {
            isReduceMotionEnabled: () => new Promise(resolve => { resolveMotion = resolve; }),
            addEventListener: (_, fn) => { listener = fn; return { remove() { removed = true; } }; },
        },
    };
    const svg = { __esModule: true, default: "Svg" };
    for (const name of ["Circle", "ClipPath", "Defs", "FeGaussianBlur", "Filter", "G", "LinearGradient", "Path", "RadialGradient", "Rect", "Stop"]) svg[name] = name;
    const module = { exports: {} }, colors = theme.paletteFor(undefined, gender, scheme);
    new Function("require", "module", "exports", compile("components/ui/GlassFab.js"))((name) => {
        if (name === "react") return React;
        if (name === "react-native") return native;
        if (name === "react-native-svg") return svg;
        if (name === "expo-blur") return { BlurView: "BlurView" };
        if (name.includes("ThemeContext")) return { useTheme: () => ({ colors, scheme }) };
        if (name === "../../theme") return theme;
        assert.fail("Unexpected import " + name);
    }, module, module.exports);
    return {
        colors, animations,
        draw(props = {}) {
            cursor = 0;
            const tree = module.exports.default({ onPress: () => calls++, blurTarget: "target", style: { right: 20, bottom: 124 }, ...props });
            while (effects.length) effects.shift()();
            return tree;
        },
        resolve: (value) => resolveMotion(value), motion: (value) => listener(value),
        cleanup() { for (const slot of slots) slot?.cleanup?.(); },
        get removed() { return removed; }, get calls() { return calls; },
    };
}
function nodes(tree, type) {
    if (!tree || typeof tree !== "object") return [];
    return [...(tree.type === type ? [tree] : []), ...(tree.props?.children || []).flatMap(child => nodes(child, type))];
}
const focusEvent = (visible) => ({ currentTarget: { matches: selector => { assert.equal(selector, ":focus-visible"); return visible; } } });
(async () => {
    const ids = new Set();
    for (const gender of ["boy", "girl", "neutral"]) for (const scheme of ["light", "dark"]) for (const appearance of ["default", "azureGlass"]) {
        const h = harness(gender, scheme);
        const draw = props => h.draw({ appearance, ...props });
        const azure = appearance === "azureGlass";
        let tree = draw();
        assert.equal(tree.props.accessibilityRole, "button");
        assert.equal(tree.props.delayPressIn, 0, "Web feedback does not wait for the default 50 ms delay");
        assert.equal(tree.props.accessibilityLabel, "Add a record");
        assert.equal(tree.props.style[0].width, 56); assert.equal(tree.props.style[0].height, 56);
        assert.equal(tree.props.style[0].borderRadius, 28); assert.equal(tree.props.style[0].borderWidth, undefined);
        assert.deepEqual(tree.props.style[1], { right: 20, bottom: 124 });
        assert.equal(tree.props.style[2].outlineStyle, "none");
        const blur = azure ? nodes(tree, "View").find(node => node.props.testID === "azure-fab-backdrop") : nodes(tree, "BlurView")[0];
        if (azure) {
            assert.equal(nodes(tree, "BlurView").length, 0);
            assert.equal(blur.props.style[1].backdropFilter, "blur(8px) saturate(120%)");
            assert.equal(blur.props.style[1].WebkitBackdropFilter, blur.props.style[1].backdropFilter);
            const clip = nodes(tree, "ClipPath")[0];
            assert.deepEqual(clip.props.children[0].props, { cx: "50", cy: "50", r: "50", children: [] });
            assert.equal(nodes(tree, "G").filter(node => node.props.clipPath === `url(#${clip.props.id})`).length, 1);
            assert.equal(nodes(tree, "Circle").filter(node => node.props.fill === "none").length, 1, "Only one visible glass perimeter");
            const feather = nodes(tree, "Filter")[0];
            assert.equal(feather.props.filterUnits, "userSpaceOnUse");
            assert(Number(feather.props.children[0].props.stdDeviation) > 0);
            assert(Number(feather.props.children[0].props.stdDeviation) <= 3);
            assert(nodes(tree, "G").some(node => node.props.filter === `url(#${feather.props.id})`));
            const redraw = draw();
            assert.deepEqual(nodes(tree, "Path").map(node => node.props.d), nodes(redraw, "Path").map(node => node.props.d), "Refraction geometry is deterministic across renders");
            assert.equal(nodes(tree, "AnimatedView")[0].props.style[0].boxShadow, h.colors.globalFabGlass.shadow);
        } else {
            assert.equal(blur.props.blurTarget, "target");
            assert.equal(blur.props.intensity, 76);
            assert.equal(nodes(tree, "Circle").length, 2, "Small Add buttons keep their original material");
        }
        assert.equal(blur.props.style[0].borderWidth, undefined);
        assert.equal(blur.props.style[0].overflow, "hidden");
        assert.equal(blur.props.style[0].borderRadius, 28);
        const svgs = nodes(tree, "Svg");
        assert.equal(svgs.length, 2);
        assert(svgs.every(svg => svg.props.viewBox === "0 0 100 100" && svg.props.accessible === false));
        for (const def of [...nodes(tree, "RadialGradient"), ...nodes(tree, "LinearGradient"), ...nodes(tree, "ClipPath"), ...nodes(tree, "Filter")]) {
            assert(!ids.has(def.props.id), "SVG IDs never collide between instances");
            ids.add(def.props.id);
        }
        const filledPlus = nodes(tree, "Path").find(node => node.props.d.startsWith("M50 27") && !node.props.transform);
        assert(filledPlus.props.fill.startsWith("url(#fab-"));
        assert(filledPlus.props.d.includes("A6 6"));
        const surface = nodes(tree, "RadialGradient")[0].props.children.map(stop => stop.props.stopColor);
        assert.deepEqual(surface, azure ? h.colors.globalFabGlass.surface : h.colors.fab.surface);
        if (azure) {
            assert.deepEqual(surface, ["#0665E8", "#1678ED", "#258EFF"]);
            assert(nodes(tree, "RadialGradient")[0].props.children.every(stop => stop.props.stopOpacity > 0.5 && stop.props.stopOpacity < 1));
            const legacy = h.draw();
            const plusArtwork = t => nodes(t, "Path").filter(node => node.props.d.startsWith("M50 27") || node.props.d.startsWith("M47 39")).map(node => {
                const { fill, ...props } = node.props;
                return { ...props, fill: fill?.startsWith("url(") ? "plus-gradient" : fill };
            });
            assert.deepEqual(plusArtwork(tree), plusArtwork(legacy), "All plus artwork remains unchanged");
            assert(svgs[0].props.children.slice(-2).every(node => node.type === "Path" && node.props.d.startsWith("M50 27")), "The original plus paints after all optical layers");
            assert.deepEqual(nodes(tree, "LinearGradient")[0].props.children.map(stop => stop.props.stopColor), h.colors.fab.plus);
        } else if (gender !== "girl") assert.deepEqual(surface, ["#5B9DFF", "#2F7BF6", "#1F66DB"]);
        tree.props.onPress();
        assert.equal(h.calls, 1, "The action runs synchronously");
        h.resolve(false); await Promise.resolve(); tree = draw();
        tree.props.onPressIn(focusEvent(false));
        const down = h.animations.at(-1);
        assert.equal(down.kind, "timing"); assert.equal(down.options.duration, 110); assert.equal(down.options.toValue, 1);
        const views = nodes(tree, "AnimatedView");
        assert.deepEqual(views[0].props.style.at(-1).transform[0].scale.outputRange, [1, 0.92]);
        assert.deepEqual(views[1].props.style.at(-1).transform[0].scale.outputRange, [1, 0.95]);
        assert.deepEqual(views[2].props.style.at(-1).opacity.outputRange, [1, 0.75]);
        tree.props.onPressOut();
        assert.equal(h.animations.at(-1).kind, "spring");
        assert.equal(h.animations.at(-1).options.toValue, 0);
        assert.equal(h.animations.at(-1).options.overshootClamping, true);
        assert(down.value.stops >= 2, "Release stops the interrupted press animation");
        tree.props.onPressIn(focusEvent(false)); tree.props.onBlur();
        assert.equal(down.value.value, 0, "Cancellation restores idle");
        tree.props.onFocus(focusEvent(true)); tree = draw();
        assert.equal(tree.props.style.at(-1).outlineWidth, 2);
        tree.props.onPressIn({ ...focusEvent(true), nativeEvent: { type: "keydown" } }); tree = draw();
        assert.equal(tree.props.style.at(-1).outlineWidth, 2, "Keyboard activation keeps its focus ring");
        tree.props.onPressIn(focusEvent(false)); tree = draw();
        assert.equal(tree.props.style.at(-1), false, "Pointer interaction clears keyboard focus");
        h.motion(true); tree = draw();
        const before = h.animations.length;
        tree.props.onPressIn(focusEvent(false)); tree.props.onPressOut();
        assert.equal(h.animations.length, before);
        assert.deepEqual(nodes(tree, "AnimatedView")[1].props.style.at(-1).transform[0].scale.outputRange, [1, 1]);
        tree = draw({ accessibilityLabel: "Create entry" });
        assert.equal(tree.props.accessibilityLabel, "Create entry");
        h.cleanup(); assert(h.removed); assert(down.value.stops > 0);
    }
    const native = harness("boy", "dark", "android");
    let tree = native.draw();
    assert.equal(nodes(tree, "BlurView")[0].props.blurMethod, "dimezisBlurViewSdk31Plus");
    native.resolve(false); await Promise.resolve(); tree = native.draw();
    tree.props.onPressIn({});
    assert.equal(native.animations.at(-1).options.useNativeDriver, true);
    native.cleanup();
    for (const platform of ["android", "ios"]) {
        const glass = harness("girl", "dark", platform);
        const tree = glass.draw({ appearance: "azureGlass" });
        const blur = nodes(tree, "BlurView")[0];
        assert.equal(blur.props.intensity, 40);
        assert.equal(blur.props.tint, "default");
        assert.equal(blur.props.blurTarget, "target");
        assert.equal(blur.props.blurMethod, platform === "android" ? "dimezisBlurViewSdk31Plus" : undefined);
        assert.equal(nodes(tree, "ClipPath").length, 1);
        assert.equal(nodes(tree, "Circle").filter(node => node.props.fill === "none").length, 1);
        glass.cleanup();
    }
    const race = harness();
    race.draw(); race.motion(true); race.resolve(false); await Promise.resolve();
    tree = race.draw(); tree.props.onPressIn(focusEvent(false));
    assert.equal(race.animations.length, 0, "A stale initial preference cannot override a newer reduced-motion event");
    race.cleanup();
    const app = fs.readFileSync(path.join(root, "App.js"), "utf8");
    assert(app.includes('<GlassFab onPress={() => setActionSheetVisible(true)} blurTarget={blurTargetRef}'));
    assert(app.includes('const FAB_VIEWS = ["dashboard", "health", "growth", "nutrition", "calendar"]'));
    assert(app.includes("bottom: (tabBarHeight || TAB_BAR_BASE_HEIGHT + insets.bottom) + space.md"));
    assert(app.includes("onSelect={runAction}"));
    assert.equal((app.match(/appearance="azureGlass"/g) || []).length, 1);
    for (const screen of ["Growth", "Health"])
        assert(!fs.readFileSync(path.join(root, `components/${screen}.js`), "utf8").includes('appearance="azureGlass"'), "Smaller Add buttons stay unchanged");
    assert(!app.includes("styles.fabGlass"));
    assert(!/#[0-9a-f]{6}\b/i.test(fs.readFileSync(path.join(root, "components/ui/GlassFab.js"), "utf8")));
    console.log("Glass FAB checks passed: six themes, deterministic clipped optics and single rim, exact foreground plus, localized blur/native fallback configuration, legacy small buttons, press/focus/reduced motion and unchanged action/placement.");
})().catch(error => { console.error(error); process.exitCode = 1; });
