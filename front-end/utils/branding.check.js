// Run: node utils/branding.check.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Jimp = require("jimp-compact");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "..");
const config = require("../app.json").expo;

(async () => {
    const theme = await import("../theme.js");
    const splash = config.plugins.find((entry) => Array.isArray(entry) && entry[0] === "expo-splash-screen")[1];
    assert.equal(config.icon, "./assets/icon.png");
    assert.equal(config.web.favicon, "./assets/favicon.png");
    assert.equal(config.android.adaptiveIcon.foregroundImage, "./assets/adaptive-icon.png");
    assert.equal(config.android.adaptiveIcon.monochromeImage, "./assets/monochrome-icon.png");
    assert.equal(splash.image, "./assets/splash-icon.png");
    assert.equal(splash.dark.image, splash.image);
    assert.equal(splash.imageWidth, 200);
    assert.equal(splash.backgroundColor, "#287BFA");
    assert.equal(splash.dark.backgroundColor, splash.backgroundColor);
    assert.equal(config.android.adaptiveIcon.backgroundColor, splash.backgroundColor);

    const assets = {};
    for (const [name, size, transparent] of [
        ["logo-mark-source.png", 1254, false],
        ["icon.png", 1024, false],
        ["favicon.png", 48, false],
        ["splash-icon.png", 1024, true],
        ["adaptive-icon.png", 1024, true],
        ["monochrome-icon.png", 1024, true],
    ]) {
        const image = assets[name] = await Jimp.read(path.join(root, "assets", name));
        assert.equal(image.bitmap.width, size, `${name} width`);
        assert.equal(image.bitmap.height, size, `${name} height`);
        let visible = 0, clear = 0;
        image.scanQuiet(0, 0, size, size, (x, y, index) => {
            const alpha = image.bitmap.data[index + 3];
            if (alpha >= 16) visible++;
            if (alpha === 0) clear++;
            if (!transparent) assert.equal(alpha, 255, `${name} must be opaque`);
            if (name === "adaptive-icon.png" && alpha >= 16) {
                assert(Math.hypot(x - (size - 1) / 2, y - (size - 1) / 2) <= size * 33 / 108,
                    "Android must not clip the plus or page corners");
            }
        });
        assert(visible > size * size * 0.05, `${name} must contain a visible mark`);
        if (transparent) {
            assert(clear > size * size * 0.25, `${name} must have real transparency`);
            for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
                assert.equal(Jimp.intToRGBA(image.getPixelColor(x, y)).a, 0, `${name} corner alpha`);
            }
        }
    }
    const mono = assets["monochrome-icon.png"].bitmap.data;
    const adaptive = assets["adaptive-icon.png"].bitmap.data;
    for (let i = 0; i < mono.length; i += 4) {
        assert.equal(mono[i + 3], adaptive[i + 3], "Monochrome silhouette must match the foreground");
        if (mono[i + 3]) assert.deepEqual([...mono.subarray(i, i + 3)], [255, 255, 255]);
    }

    let colors = theme.paletteFor(undefined, "neutral", "light");
    const compiled = transformSync(fs.readFileSync(path.join(root, "components/Splash.js"), "utf8"), {
        babelrc: false, configFile: false,
        plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"],
    }).code;

    function timingHarness(platform = "web", reduced = false) {
        const slots = [], effects = [], timers = new Map(), animations = [];
        let cursor = 0, now = 0, timerId = 0, removed = false;
        const changed = (a, b) => !a || b.some((value, i) => value !== a[i]);
        const React = {
            createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
            useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
            useState(value) {
                const i = cursor++;
                if (!(i in slots)) slots[i] = value;
                return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }];
            },
            useMemo(fn, deps) {
                const i = cursor++;
                if (changed(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() };
                return slots[i].value;
            },
            useCallback(fn, deps) { return React.useMemo(() => fn, deps); },
            useEffect(fn, deps) {
                const i = cursor++, previous = slots[i];
                if (changed(previous?.deps, deps)) effects.push(() => {
                    previous?.cleanup?.();
                    slots[i] = { deps, cleanup: fn() };
                });
            },
        };
        class Value {
            stopAnimation() {
                if (this.active) {
                    this.active.stopped = true;
                    this.active.callback({ finished: false });
                    this.active = null;
                }
            }
        }
        const component = { exports: {} };
        new Function("require", "module", "exports", "Date", "setTimeout", "clearTimeout", compiled)((name) => {
            if (name === "react") return React;
            if (name === "react-native") return {
                Image: "Image", StyleSheet: { create: (styles) => styles }, Platform: { OS: platform },
                Easing: { quad: "quad", in: (easing) => easing },
                AccessibilityInfo: {
                    isReduceMotionEnabled: () => Promise.resolve(reduced),
                    addEventListener: () => ({ remove() { removed = true; } }),
                },
                Animated: {
                    View: "AnimatedView", Value,
                    timing(value, options) {
                        const animation = { options, start(callback) { animation.callback = callback; value.active = animation; } };
                        animations.push(animation);
                        return animation;
                    },
                },
            };
            if (name === "../context/ThemeContext") return { useTheme: () => ({ colors }) };
            if (name === "../theme") return theme;
            if (name === "../assets/splash-icon.png") return name;
            throw new Error("Unexpected splash dependency: " + name);
        }, component, component.exports, { now: () => now },
        (fn, delay) => { timers.set(++timerId, { fn, at: now + delay }); return timerId; },
        (id) => timers.delete(id));
        return {
            animations,
            render(props = {}) {
                cursor = 0;
                const tree = component.exports.default(props);
                while (effects.length) effects.shift()();
                return tree;
            },
            advance(ms) {
                const target = now + ms;
                for (;;) {
                    const due = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
                    if (!due || due[1].at > target) break;
                    now = due[1].at;
                    timers.delete(due[0]);
                    due[1].fn();
                }
                now = target;
            },
            unmount() { for (const slot of slots) slot?.cleanup?.(); },
            get timers() { return timers.size; },
            get listenerRemoved() { return removed; },
        };
    }

    const layout = timingHarness();
    for (const gender of ["boy", "girl", "neutral"]) for (const scheme of ["light", "dark"]) {
        colors = theme.paletteFor(undefined, gender, scheme);
        const tree = layout.render();
        assert.equal(tree.props.style[0].backgroundColor, splash.backgroundColor);
        assert.equal(tree.props.style[0].alignItems, "center");
        assert.equal(tree.props.style[0].justifyContent, "center");
        assert.equal(tree.props.children.length, 1, "Splash must show only the logo");
        const image = tree.props.children[0];
        assert.equal(image.type, "Image");
        assert.equal(image.props.accessibilityLabel, "BabyBook+");
        assert.deepEqual(image.props.style, { width: splash.imageWidth, height: splash.imageWidth });
    }
    layout.unmount();

    const imageOf = (tree) => tree.props.children[0];
    for (const platform of ["web", "android", "ios"]) {
        const h = timingHarness(platform);
        let finished = 0;
        const props = { appReady: true, onFinished: () => finished++ };
        const image = imageOf(h.render(props));
        h.advance(5000);
        assert.equal(h.animations.length, 0, "App readiness must not dismiss an unloaded logo");
        image.props.onLoad();
        const loadedImage = imageOf(h.render(props));
        assert.equal(loadedImage.props.onLoad, image.props.onLoad, "Stable handlers avoid restarting image downloads");
        assert.equal(loadedImage.props.onError, image.props.onError);
        h.advance(600);
        loadedImage.props.onLoad();
        h.render(props);
        h.advance(499);
        assert.equal(h.animations.length, 0, "The loaded logo must remain visible for 1100ms");
        h.advance(1);
        assert.equal(h.animations.length, 1, "Repeated load events must not reset the visible interval");
        assert.equal(h.animations[0].options.useNativeDriver, platform !== "web");
        h.animations[0].callback({ finished: true });
        assert.equal(finished, 1);
        h.render(props); h.advance(5000);
        assert.equal(h.animations.length, 1, "Splash finishes only once");
        h.unmount();
        assert(h.listenerRemoved);
    }

    const slowApp = timingHarness();
    let props = { appReady: false };
    imageOf(slowApp.render(props)).props.onLoad();
    slowApp.render(props);
    slowApp.advance(5000);
    assert.equal(slowApp.animations.length, 0, "Loaded artwork must not bypass app readiness");
    slowApp.render(props = { appReady: true });
    slowApp.advance(0);
    assert.equal(slowApp.animations.length, 1, "No extra delay once the logo has already been visible");
    slowApp.unmount();

    const cached = timingHarness();
    props = { appReady: true };
    imageOf(cached.render(props)).props.onLoad();
    cached.render(props); cached.advance(1099);
    assert.equal(cached.animations.length, 0, "Cached images still get their visible interval");
    cached.advance(1);
    assert.equal(cached.animations.length, 1);
    cached.unmount();

    for (const initiallyReady of [false, true]) {
        const failed = timingHarness();
        props = { appReady: initiallyReady };
        imageOf(failed.render(props)).props.onError();
        failed.render(props); failed.advance(0);
        assert.equal(failed.animations.length, initiallyReady ? 1 : 0);
        if (!initiallyReady) {
            failed.render({ appReady: true }); failed.advance(0);
            assert.equal(failed.animations.length, 1, "An image error must not trap the user on blue");
        }
        failed.unmount();
    }

    const reduced = timingHarness("web", true);
    props = { appReady: true };
    imageOf(reduced.render(props)).props.onLoad();
    await Promise.resolve();
    reduced.render(props); reduced.advance(1100);
    assert.equal(reduced.animations[0].options.duration, 0, "Reduced motion skips the exit fade");
    reduced.unmount();

    const canceled = timingHarness();
    let canceledCompletions = 0;
    props = { appReady: true, onFinished: () => canceledCompletions++ };
    imageOf(canceled.render(props)).props.onLoad();
    canceled.render(props);
    assert.equal(canceled.timers, 1);
    canceled.unmount(); canceled.advance(5000);
    assert.equal(canceled.timers, 0);
    assert.equal(canceled.animations.length, 0, "Unmount cancels the pending timer");
    const fading = timingHarness();
    imageOf(fading.render(props)).props.onLoad();
    fading.render(props); fading.advance(1100); fading.unmount();
    assert(fading.animations[0].stopped);
    assert.equal(canceledCompletions, 0, "Stopping an exit fade must not complete startup");

    // Exercise the actual App startup branch without mounting its unrelated screens/providers.
    const app = fs.readFileSync(path.join(root, "App.js"), "utf8");
    const startupStart = app.indexOf("    const ready =");
    const viewerStart = app.indexOf("    if (professionalMode)", startupStart);
    assert(startupStart >= 0 && viewerStart > startupStart, "Locate the startup gate before the top-level viewer");
    const gateCode = app.match(/const usesReactSplash = [^;]+;/)[0] +
        app.slice(startupStart, viewerStart) +
        '\nreturn "app";';
    const gate = new Function("React", "Platform", "SplashScreen", "reactSplashDone", "setReactSplashDone",
        "useEffect", "setLoadingReady", "fontsReady", "assetsReady", "preferencesReady", "languageReady",
        "bootstrapping", "onboarded", "Splash",
        transformSync(gateCode, { babelrc: false, configFile: false,
            plugins: ["@babel/plugin-transform-react-jsx"], parserOpts: { allowReturnOutsideFunction: true } }).code);
    for (const platform of ["web", "android", "ios"]) for (const native of [false, true]) {
        for (const ready of [false, true]) for (const done of [false, true]) {
            let loadingReady, nextDone = done, hides = 0;
            const nativeSplash = native ? { hideAsync() { hides++; return Promise.resolve(); } } : null;
            const tree = gate({ createElement: (type, props) => ({ type, props }) }, { OS: platform },
                nativeSplash, done, () => { nextDone = true; }, (fn) => fn(), (value) => { loadingReady = value; },
                ready, ready, ready, ready, !ready, ready ? true : null, "Splash");
            const reactFallback = platform === "web" || !native;
            assert.equal(loadingReady, ready && (!reactFallback || done));
            assert.equal(hides, ready && platform !== "web" && native ? 1 : 0);
            if (!ready) assert.equal(reactFallback ? tree.type : tree, reactFallback ? "Splash" : null);
            else if (reactFallback && !done) {
                assert.equal(tree.type, "Splash");
                assert.equal(tree.props.appReady, true);
                tree.props.onFinished(); assert(nextDone);
            } else assert.equal(tree, "app");
        }
    }
    console.log("Branding checks passed: assets, six themes, logo-load timing, cached/slow startup, image errors, cleanup, reduced motion and web/native startup gates.");

})().catch((error) => { console.error(error); process.exitCode = 1; });
