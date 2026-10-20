// Run: node components/ui/GlassHeaderButton.check.js — no server or database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(__dirname, "GlassHeaderButton.js"), "utf8");
const compile = text => transformSync(text, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"] }).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile(fs.readFileSync(path.join(root, "theme.js"), "utf8")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
let nextId = 0;
function harness(gender = "boy", scheme = "light", platform = "web") {
    const slots = [], effects = [], animations = [];
    let cursor = 0, resolveMotion, listener, removed = false, calls = 0;
    const React = {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
        useMemo: fn => fn(),
        useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
        useId() { const i = cursor++; return slots[i] ||= ":r" + nextId++ + ":"; },
        useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value;
            return [slots[i], next => slots[i] = typeof next === "function" ? next(slots[i]) : next]; },
        useEffect(fn, deps) { const i = cursor++, previous = slots[i];
            if (!previous || deps.some((value, n) => value !== previous.deps[n])) effects.push(() => {
                previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
            }); },
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
    const native = { View: "View", Text: "Text", Image: "Image", Pressable: "Pressable", Platform: { OS: platform },
        StyleSheet: { create: value => value, absoluteFillObject: { position: "absolute", inset: 0 } },
        Easing: { bezier: (...args) => args },
        Animated: { Value, View: "AnimatedView", timing: (v, o) => animate("timing", v, o), spring: (v, o) => animate("spring", v, o) },
        AccessibilityInfo: { isReduceMotionEnabled: () => new Promise(resolve => resolveMotion = resolve),
            addEventListener: (_, fn) => { listener = fn; return { remove() { removed = true; } }; } },
    };
    const svg = { __esModule: true, default: "Svg" };
    for (const name of ["Circle", "Defs", "FeGaussianBlur", "Filter", "LinearGradient", "Mask", "Path", "RadialGradient", "Stop"]) svg[name] = name;
    const module = { exports: {} }, colors = theme.paletteFor(undefined, gender, scheme);
    new Function("require", "module", "exports", compile(source))(name => {
        if (name === "react") return React;
        if (name === "react-native") return native;
        if (name === "react-native-svg") return svg;
        if (name === "expo-blur") return { BlurView: "BlurView" };
        if (name === "./Gradient") return { __esModule: true, default: "Gradient" };
        if (name.includes("ThemeContext")) return { useTheme: () => ({ colors, scheme, mode: gender }) };
        if (name === "../../theme") return theme;
        if (name.endsWith(".png")) return path.resolve(__dirname, name);
        assert.fail("Unexpected import " + name);
    }, module, module.exports);
    return { colors, animations, sources: module.exports.HEADER_ICON_SOURCES,
        draw(props = {}) { cursor = 0;
            const tree = module.exports.default({ icon: "notifications", onPress: () => calls++, accessibilityLabel: "Notifications, 13 unread", ...props });
            while (effects.length) effects.shift()(); return tree; },
        resolve: value => resolveMotion(value), motion: value => listener(value),
        cleanup() { for (const slot of slots) slot?.cleanup?.(); },
        get removed() { return removed; }, get calls() { return calls; },
    };
}
function nodes(tree, type) {
    if (!tree || typeof tree !== "object") return [];
    return [...(tree.type === type ? [tree] : []), ...(tree.props?.children || []).flatMap(child => nodes(child, type))];
}
const merged = styles => Object.assign({}, ...styles.filter(Boolean));
const focus = visible => ({ currentTarget: { matches: selector => { assert.equal(selector, ":focus-visible"); return visible; } } });
const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).slice(0, 3).map(c => parseInt(c, 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
(async () => {
    const Jimp = require("jimp-compact");
    for (const file of harness().sources) {
        const image = await Jimp.read(file);
        assert.equal(image.bitmap.width, 128); assert.equal(image.bitmap.height, 128);
        for (const [x, y] of [[0, 0], [127, 0], [0, 127], [127, 127]]) assert.equal(image.getPixelColor(x, y) & 255, 0, "No opaque asset background");
        let visible = 0;
        image.scan(0, 0, 128, 128, function(x, y, index) { if (this.bitmap.data[index + 3] > 24) {
            visible++; assert(x >= 6 && x <= 121 && y >= 6 && y <= 121, "Consistent transparent padding");
        } });
        assert(visible > 2000, "Foreground asset is present");
        if (file.includes("search")) assert.equal(image.getPixelColor(52, 52) & 255, 0, "Search center stays open");
    }
    const ids = new Set();
    for (const gender of ["boy", "girl", "neutral"]) for (const scheme of ["light", "dark"]) {
        const h = harness(gender, scheme);
        for (const icon of ["notifications", "search", "qr", "profile"]) {
            const blurTarget = { current: "background-only" };
            let tree = h.draw({ icon, style: { marginRight: 4 }, blurTarget });
            assert.equal(tree.props.accessibilityRole, "button");
            assert.equal(tree.props.accessibilityState.disabled, false);
            assert.equal(tree.props.delayPressIn, 0);
            assert.equal(tree.props.style[0].width, 44); assert.equal(tree.props.style[0].height, 44);
            assert.equal(merged(tree.props.style).borderWidth, undefined);
            assert.equal(merged(tree.props.style).marginRight, 4);
            const face = nodes(tree, "View").find(n => n.props.style.width === 40);
            assert.equal(face.props.style.height, 40); assert.equal(face.props.style.borderRadius, 20);
            assert.equal(face.props.style.borderWidth, undefined);
            assert.equal(nodes(tree, "BlurView").length, 0, "Web tint is independent of native blur");
            const blur = nodes(tree, "View").find(n => n.props.testID === "header-glass-backdrop");
            assert.equal(merged(blur.props.style).backdropFilter, "blur(16px)");
            assert.equal(merged(blur.props.style).WebkitBackdropFilter, "blur(16px)");
            assert(parseInt(h.colors.headerButton.centerTint.slice(7), 16) / 255 <= 0.08);
            assert.equal(blur.props.pointerEvents, "none");
            assert.equal(nodes(blur, "Svg").length, 0, "Foreground glyph is never blurred");
            const edge = nodes(tree, "LinearGradient").find(n => n.props.id.endsWith("-edge"));
            assert.equal(edge.props.children[1].props.stopOpacity, "0.95");
            assert.equal(edge.props.children[3].props.stopOpacity, "0.4", "Rim brightness varies around the lens");
            assert.equal(nodes(tree, "Mask").length, 1);
            assert.equal(nodes(tree, "Svg")[0].props.style.position, "absolute", "Material paints above the positioned backdrop");
            const rim = nodes(tree, "RadialGradient").find(n => n.props.id.endsWith("-rim"));
            assert.equal(rim.props.gradientUnits, "userSpaceOnUse");
            assert.equal(rim.props.children[0].props.offset, "0.65");
            assert.equal(rim.props.children[0].props.stopOpacity, "0");
            assert.equal(nodes(tree, "Filter").length, 1);
            assert(nodes(tree, "Circle").every(n => n.props.stroke === undefined), "Refraction uses no circular stroke");
            const glyph = nodes(tree, "Image")[0];
            const size = icon === "notifications" ? 28 : icon === "search" || icon === "profile" ? 26 : 24;
            assert.equal(merged(glyph.props.style).width, size); assert.equal(merged(glyph.props.style).height, size);
            assert.equal(merged(glyph.props.style).left, (40 - size) / 2);
            assert.equal(glyph.props.source, path.join(root, "assets/header", icon + (gender === "girl" ? "-pink.png" : "-blue.png")));
            assert.equal(glyph.props.resizeMode, "contain"); assert.equal(glyph.props.fadeDuration, 0);
            assert.equal(glyph.props.accessible, false);
            assert.equal(nodes(blur, "Image").length, 0, "Foreground assets remain sharp");
            assert.equal(new Set(h.sources).size, 8);
            assert(nodes(tree, "Svg").every(n => n.props.accessible === false && n.props["aria-hidden"] === true));
            for (const definition of [...nodes(tree, "LinearGradient"), ...nodes(tree, "RadialGradient")]) {
                assert(!/[^a-zA-Z0-9_-]/.test(definition.props.id));
            }
            if (icon === "notifications") for (const definition of [...nodes(tree, "LinearGradient"), ...nodes(tree, "RadialGradient")]) {
                assert(!ids.has(definition.props.id), "Instance IDs are unique"); ids.add(definition.props.id);
            }
        }
        assert.equal(h.draw({ icon: "profile", selected: true }).props.accessibilityState.selected, true);
        assert.equal(h.draw({ icon: "profile", selected: true }).props["aria-current"], "page");
        assert.equal(h.draw({ icon: "profile", selected: false }).props.accessibilityState.selected, false);
        assert.equal(h.draw({ icon: "profile", selected: false }).props["aria-current"], undefined);
        assert.equal(h.draw().props.accessibilityState.selected, undefined);
        for (const count of [0, 1, 9, 10, 99]) {
            const tree = h.draw({ badgeCount: count }), badge = nodes(tree, "Gradient")[0];
            assert.equal(Boolean(badge), count > 0);
            if (badge) {
                assert.deepEqual(badge.props.colors, h.colors.headerButton.badge);
                assert.equal(badge.props.style.top, 0); assert.equal(badge.props.style.right, 0);
                assert.equal(badge.props.style.minHeight, 18); assert.equal(badge.props.style.borderWidth, undefined);
                assert.equal(nodes(badge, "Text")[0].props.children[0], count > 9 ? "9+" : count);
            }
        }
        for (const color of h.colors.headerButton.badge) assert((1.05 / (luminance(color) + 0.05)) >= 4.5, "Badge text contrast");
        h.resolve(false); await Promise.resolve(); let tree = h.draw();
        tree.props.onPress(); assert.equal(h.calls, 1, "Actions run immediately");
        tree.props.onPressIn(focus(false));
        const down = h.animations.at(-1); assert.equal(down.kind, "timing"); assert.equal(down.options.duration, 110);
        assert.deepEqual(nodes(tree, "AnimatedView")[0].props.style.at(-1).transform[1].scale.outputRange, [1, 0.95]);
        tree.props.onPressOut(); assert.equal(h.animations.at(-1).kind, "spring");
        assert.equal(h.animations.at(-1).options.overshootClamping, true);
        assert.equal(h.animations.at(-1).options.stiffness, 2000);
        for (let i = 0; i < 6; i++) { tree.props.onPressIn(focus(false)); tree.props.onPressOut(); }
        assert(down.value.stops >= 14, "Rapid taps cancel interrupted animations");
        tree.props.onHoverIn(); assert.equal(h.animations.at(-1).options.duration, 160);
        assert.equal(h.animations.at(-1).options.toValue, 1);
        tree.props.onHoverOut(); assert.equal(h.animations.at(-1).options.toValue, 0);
        tree.props.onPressIn(focus(false)); tree.props.onBlur(); assert.equal(down.value.value, 0);
        tree.props.onFocus(focus(true)); tree = h.draw();
        assert.equal(merged(tree.props.style).outlineWidth, 2);
        tree.props.onPressIn({ ...focus(true), nativeEvent: { type: "keydown" } }); tree = h.draw();
        assert.equal(merged(tree.props.style).outlineWidth, 2);
        tree.props.onPressIn(focus(false)); tree = h.draw();
        assert.equal(merged(tree.props.style).outlineStyle, "none", "Pointer press clears keyboard focus");
        tree = h.draw({ disabled: true });
        assert.equal(tree.props.onPress, undefined); assert.equal(tree.props.accessibilityState.disabled, true);
        assert.equal(down.value.value, 0, "Disabling restores idle");
        const before = h.animations.length; tree.props.onPressIn(focus(false)); tree.props.onHoverIn();
        assert.equal(h.animations.length, before);
        h.motion(true); tree = h.draw(); tree.props.onPressIn(focus(false)); tree.props.onPressOut();
        assert.equal(h.animations.length, before);
        assert.deepEqual(nodes(tree, "AnimatedView")[0].props.style.at(-1).transform[1].scale.outputRange, [1, 1]);
        assert.deepEqual(nodes(tree, "AnimatedView")[0].props.style.at(-1).transform[0].translateY.outputRange, [0, 0]);
        h.cleanup(); assert(h.removed); assert(down.value.stops > 0);
    }
    const native = harness("boy", "dark", "android"); native.draw(); native.resolve(false); await Promise.resolve();
    const tree = native.draw(); assert.equal(nodes(tree, "BlurView")[0].props.blurMethod, "dimezisBlurViewSdk31Plus"); assert.equal(nodes(tree, "BlurView")[0].props.intensity, 30); assert.equal(nodes(tree, "BlurView")[0].props.blurReductionFactor, 2); assert.equal(nodes(tree, "BlurView")[0].props.tint, "default"); assert.equal(tree.props.onHoverIn, undefined); assert.equal(tree.props.delayPressIn, undefined);
    tree.props.onPressIn({}); assert.equal(native.animations.at(-1).options.useNativeDriver, true); native.cleanup();
    for (const scheme of ["light", "dark"]) {
        const ios = harness("boy", scheme, "ios");
        const blur = nodes(ios.draw(), "BlurView")[0];
        assert.equal(blur.props.intensity, 30);
        assert.equal(blur.props.tint, scheme === "dark" ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight");
        assert.equal(blur.props.blurMethod, undefined); ios.cleanup();
    }
    const race = harness(); race.draw(); race.motion(true); race.resolve(false); await Promise.resolve();
    race.draw().props.onPressIn(focus(false)); assert.equal(race.animations.length, 0); race.cleanup();
    const unmounted = harness(); unmounted.draw(); unmounted.cleanup(); unmounted.resolve(false); await Promise.resolve();
    assert(unmounted.removed);
    const previousMatchMedia = globalThis.matchMedia, listeners = new Set();
    globalThis.matchMedia = () => ({ matches: false,
        addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) });
    try {
        const bell = harness(), profile = harness(); bell.draw(); profile.draw({ icon: "profile" });
        assert.equal(listeners.size, 2); bell.cleanup(); assert.equal(listeners.size, 1);
        for (const fn of listeners) fn({ matches: true });
        const tree = profile.draw({ icon: "profile" });
        assert.deepEqual(nodes(tree, "AnimatedView")[0].props.style.at(-1).transform[1].scale.outputRange, [1, 1], "Sibling removal preserves reduced-motion listener");
        profile.cleanup(); assert.equal(listeners.size, 0);
    } finally {
        if (previousMatchMedia) globalThis.matchMedia = previousMatchMedia; else delete globalThis.matchMedia;
    }
    assert(!/#[0-9a-f]{6}\b/i.test(source), "Material colors come from tokens");
    console.log("Glass header checks passed: six palettes, background-only blur, translucent depth/reflections/rim, eight 3D assets, badges/contrast, dimensions, focus, hover, interruption, disabled state, reduced-motion races and native-driver feedback.");
})().catch(error => { console.error(error); process.exitCode = 1; });
