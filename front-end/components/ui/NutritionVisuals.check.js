// Run: node components/ui/NutritionVisuals.check.js — no native runtime.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
let colors, context, id = 0, mediaListener;
const renderers = new Set(), defaults = new Map();
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
    Fragment: "Fragment", memo: fn => fn,
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(v => v != null && v !== false) }),
    useState: initial => { const owner = context, i = owner.cursor++; owner.slots[i] ||= { value: initial }; return [owner.slots[i].value, value => {
        const next = typeof value === "function" ? value(owner.slots[i].value) : value;
        if (!Object.is(owner.slots[i].value, next)) { owner.slots[i].value = next; owner.dirty = true; }
    }]; },
    useRef: initial => { const i = context.cursor++; return context.slots[i] ||= { current: initial }; },
    useId: () => { const i = context.cursor++; return (context.slots[i] ||= { value: ":nutrition-" + (++id) + ":" }).value; },
    useMemo: (fn, deps) => { const i = context.cursor++; if (!same(context.slots[i]?.deps, deps)) context.slots[i] = { value: fn(), deps }; return context.slots[i].value; },
    useEffect: (fn, deps) => { const owner = context, i = owner.cursor++; if (!same(owner.slots[i]?.deps, deps)) owner.effects.push(() => { owner.slots[i]?.cleanup?.(); owner.slots[i] = { deps, cleanup: fn() }; }); },
};
react.useLayoutEffect = react.useEffect;
const animations = [];
class Value {
    constructor(value) { this.value = value; this.listeners = new Map(); this.id = 0; }
    setValue(value) { this.value = value; for (const listener of this.listeners.values()) listener({ value }); }
    stopAnimation() { this.stopped = true; }
    addListener(listener) { const id = ++this.id; this.listeners.set(id, listener); return id; }
    removeListener(id) { this.listeners.delete(id); }
    interpolate(config) { return new Interpolation(this, config); }
    get() { return this.value; }
}
class Interpolation {
    constructor(source, config) { this.source = source; Object.assign(this, config); }
    get() {
        const input = Math.max(this.inputRange[0], Math.min(this.inputRange.at(-1), this.source.get()));
        let index = 0;
        while (index < this.inputRange.length - 2 && input > this.inputRange[index + 1]) index++;
        let amount = (input - this.inputRange[index]) / (this.inputRange[index + 1] - this.inputRange[index]);
        amount = this.easing ? this.easing(amount) : amount;
        const from = this.outputRange[index], to = this.outputRange[index + 1];
        if (typeof from === "number") return from + (to - from) * amount;
        const numbers = to.match(/-?\d+(?:\.\d+)?/g).map(Number); let n = 0;
        return from.replace(/-?\d+(?:\.\d+)?/g, match => { const a = Number(match); return String(a + (numbers[n++] - a) * amount); });
    }
    addListener(listener) { return this.source.addListener(() => listener({ value: this.get() })); }
    removeListener(id) { this.source.removeListener(id); }
    interpolate(config) { return new Interpolation(this, config); }
}
const Animated = { Value, View: "AnimatedView", createAnimatedComponent: component => "Animated" + component,
    timing: (value, config) => { const animation = { value, config, start(callback) { this.callback = callback; animations.push(animation); },
        advance(milliseconds) { if (this.stopped) return; value.setValue(Math.min(1, milliseconds / config.duration)); if (milliseconds >= config.duration) { this.finished = true; this.callback?.({ finished: true }); } },
        stop() { this.stopped = true; this.callback?.({ finished: false }); } }; return animation; } };
const originalMedia = global.matchMedia;
global.matchMedia = () => ({ matches: false, addEventListener: (_, fn) => { mediaListener = fn; }, removeEventListener() {} });
function load(file) {
    const module = { exports: {} };
    const code = transformSync(fs.readFileSync(file, "utf8"), { babelrc: false, configFile: false,
        plugins: [require.resolve("@babel/plugin-transform-modules-commonjs"), require.resolve("@babel/plugin-transform-react-jsx")] }).code;
    const mocked = name => {
        if (name === "react") return react;
        if (name === "react-native") return { View: "View", Text: "Text", Pressable: "Pressable", Animated,
            Platform: { OS: "web" }, StyleSheet: { create: s => s, absoluteFillObject: { position: "absolute", inset: 0 } }, AccessibilityInfo: {} };
        if (name === "react-native-svg") return { __esModule: true, default: "Svg", Text: "SvgText",
            ...Object.fromEntries(["Circle", "ClipPath", "Defs", "Ellipse", "G", "LinearGradient", "Line", "Path", "RadialGradient", "Rect", "Stop"].map(key => [key, key])) };
        if (name.endsWith("ThemeContext")) return { useTheme: () => ({ colors }) };
        if (name.endsWith("LanguageContext")) return { useLanguage: () => ({ language: "en", t: key => key }) };
        if (name === "./Gradient") return { __esModule: true, default: "Gradient" };
        if (name === "./useSoftPress") return { __esModule: true, default: () => ({ respond() {}, transform: [] }) };
        const target = path.resolve(path.dirname(file), name);
        return name.endsWith(".json") ? require(target) : load(target + ".js");
    };
    new Function("require", "module", "exports", code)(mocked, module, module.exports);
    return module.exports;
}
const theme = load(path.join(__dirname, "../../theme.js"));
const Chart = load(path.join(__dirname, "NutritionTrendChart.js")).default;
const artwork = load(path.join(__dirname, "SolidFoodIcon.js"));
const milkArtwork = load(path.join(__dirname, "MilkIcon.js"));
const visuals = load(path.join(__dirname, "NutritionVisuals.js"));
const nodes = tree => tree && typeof tree === "object" ? [tree, ...tree.children.flatMap(nodes)] : [];
const reelNodes = tree => nodes(tree).filter(node => node.type?.name === "DigitReel");
const reelOffset = tree => sample(nodes(tree).find(node => node.type === "AnimatedView").props.style.transform[0].translateY);
function renderer(fn) {
    const owner = { slots: [], cursor: 0, effects: [], dirty: false };
    const instance = {
        draw(props) {
            const saved = context; context = owner; let tree, passes = 0;
            do { owner.dirty = false; owner.cursor = 0; tree = fn(props); const pending = owner.effects; owner.effects = []; pending.forEach(effect => effect());
                assert(++passes < 12, "Render settles without a state loop");
            } while (owner.dirty);
            context = saved; return tree;
        },
        unmount() { owner.slots.forEach(slot => slot?.cleanup?.()); renderers.delete(instance); },
        get dirty() { return owner.dirty; },
    };
    renderers.add(instance); return instance;
}
const reset = () => { [...renderers].forEach(instance => instance.unmount()); defaults.clear(); animations.length = 0; };
const draw = (fn, props) => { if (!defaults.has(fn)) defaults.set(fn, renderer(fn)); return defaults.get(fn).draw(props); };
const sample = value => value instanceof Interpolation ? value.get() : value;
const bars = [0, 2, 4, 0, 1, 3, 0].map((value, i) => ({ value, sort: "2026-10-0" + (i + 1) }));
const originalBars = JSON.stringify(bars), ids = new Set();
const luminance = hex => hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (const [palettes, dark] of [[theme.PALETTES, false], [theme.DARK_PALETTES, true]]) {
    const { boy, girl, neutral } = palettes;
    assert.deepEqual(boy.nutritionSurface.bar, [boy.accent, boy.primary]);
    assert.deepEqual(boy.nutritionSurface.latestBar, dark ? [boy.primaryDark, boy.primary] : [boy.primary, boy.primaryDark]);
    assert.deepEqual(girl.nutritionSurface.bar, ["#F7A6D0", "#EB78AF"], "Girl bars retain the existing pink ramp");
    assert.deepEqual(girl.nutritionSurface.latestBar, ["#EB78AF", "#C72F7C"]);
    assert.equal(neutral, boy, "Neutral keeps its existing Boy palette alias");
    for (const key of Object.keys(girl.nutritionSurface).filter(key => !["bar", "latestBar"].includes(key))) {
        assert.deepEqual(boy.nutritionSurface[key], girl.nutritionSurface[key], `Only bar colors differ: ${key}`);
    }
}
for (colors of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    for (const bg of colors.nutritionSurface.card) {
        assert(contrast(colors.nutritionSurface.axis, bg) >= 4.5, "Nutrition axis/caption contrast meets AA");
        assert(contrast(colors.text, bg) >= 4.5);
    }
    for (const width of [200, 255, 310, 600]) {
        reset();
        const props = { title: "Milk", unit: "feeds", bars, average: 10 / 7, granularity: "day", color: colors.nutritionSurface.series,
            dateWindow: { from: "2026-10-01", to: "2026-10-07" }, emptyMessage: "No entries", headerIcon: "Artwork" };
        let tree = draw(Chart, props);
        nodes(tree).find(n => n.props.onLayout).props.onLayout({ nativeEvent: { layout: { width } } });
        tree = draw(Chart, props);
        const svg = nodes(tree).find(n => n.type === "Svg");
        assert.equal(svg.props.width, width); assert.equal(svg.props.height, 216);
        for (const title of ["Milk", "Food"]) {
            const chart = draw(Chart, { ...props, title });
            for (const [suffix, shades] of [["-bar", colors.nutritionSurface.bar], ["-latest", colors.nutritionSurface.latestBar]]) {
                const gradient = nodes(chart).find(n => n.type === "LinearGradient" && n.props.id.endsWith(suffix));
                assert.deepEqual(gradient.children.map(stop => stop.props.stopColor), shades, `${title} renders the active theme's ${suffix} gradient`);
            }
        }
        const paths = nodes(tree).filter(n => n.type === "AnimatedPath");
        assert.equal(paths.length, 4, "Zero buckets never become visible bars");
        const baseline = 188;
        for (const bar of paths) {
            const path = sample(bar.props.d);
            assert(path.startsWith("M "));
            assert(path.endsWith(baseline + " Z"), "Bottom closes directly across the baseline without a curve");
            assert.equal((path.match(/Q /g) || []).length, 2, "Only upper corners are curved");
            const numbers = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
            assert(numbers.every(Number.isFinite));
            assert([0, 2, 4, 6, 8, 9, 11, 13].every(index => numbers[index] >= 42 && numbers[index] <= width - 24), "Bars stay within chart gutters");
        }
        assert(paths[2].props.fill.endsWith("-bar)"));
        assert(paths.at(-1).props.fill.endsWith("-latest)"), "Latest nonzero bucket retains emphasis even with a trailing zero");
        const average = nodes(tree).find(n => n.type === "Line" && n.props.strokeDasharray === "6 6");
        assert.equal(average.props.y1, baseline - (10 / 7) / 6 * 160);
        assert.equal(nodes(tree).filter(n => n.type === "Line").length, 8);
        const gradient = nodes(tree).find(n => n.type === "LinearGradient");
        assert(!ids.has(gradient.props.id)); ids.add(gradient.props.id);
        assert.equal(animations.at(-1).config.duration, 1200);
        assert.equal(Number(sample(paths[0].props.d).split(" ")[5]), baseline, "Initial bars start at the baseline");
        const previous = animations.at(-1);
        tree = draw(Chart, { ...props, average: 2 });
        assert(previous.stopped, "Interrupted data transitions cancel their predecessor");
        mediaListener({ matches: true });
        const count = animations.length;
        tree = draw(Chart, props);
        assert.equal(animations.length, count, "Reduced motion settles without starting an animation");
        tree = draw(Chart, props);
        assert(nodes(tree).filter(n => n.type === "AnimatedPath").every(n => typeof n.props.d === "string"));
        tree = draw(Chart, { ...props, dateWindow: { from: "2026-10-01", to: "2026-10-31" } });
        assert(!nodes(tree).some(n => n.type === "AnimatedG"));
        assert(nodes(tree).some(n => n.type === "Path" && n.props.strokeWidth === 2.5), "Long ranges retain their line chart");
        tree = draw(Chart, { ...props, bars: [] });
        assert(!nodes(tree).some(n => n.type === "Svg"));
        assert(nodes(tree).some(n => n.type === "Text" && n.children.includes("No entries")));
    }
    for (const Icon of [artwork.default, milkArtwork.default]) for (const size of [24, 40, 48, 56]) {
        reset(); const wrapper = draw(Icon, { size });
        const tree = typeof wrapper.type === "function" ? draw(wrapper.type, wrapper.props) : wrapper;
        assert.equal(tree.props.style.width, size); assert.equal(tree.props.style.height, size);
        assert(nodes(tree).some(n => n.type === "Circle" && Number(n.props.r) === 49));
        const plainWrapper = draw(Icon, { size, showBackground: false });
        assert(!nodes(typeof plainWrapper.type === "function" ? draw(plainWrapper.type, plainWrapper.props) : plainWrapper).some(n => n.type === "Circle"));
        assert.equal(tree.props.pointerEvents, "none");
    }
    reset(); const ref = { current: null }; let tapped = false;
    let control = draw(visuals.NutritionControl, { ref, circular: true, onPress: () => { tapped = true; } });
    assert.equal(control.props.ref, ref); control.props.onPress(); assert(tapped);
    control.props.onFocus({ currentTarget: { matches: () => true } });
    control = draw(visuals.NutritionControl, { ref, circular: true });
    assert.equal(control.props.style.at(-1).outlineStyle, "solid");
}
assert.equal(JSON.stringify(bars), originalBars, "Visual changes never mutate input buckets");
reset(); colors = Object.values(theme.PALETTES)[0];
const resolvedMedia = global.matchMedia;
global.matchMedia = () => ({ matches: undefined, addEventListener: (_, listener) => { mediaListener = listener; }, removeEventListener() {} });
const pendingChart = renderer(Chart);
const pendingProps = { title: "Milk", unit: "feeds", bars, average: 2, granularity: "day", color: colors.nutritionSurface.series,
    dateWindow: { from: "2026-10-01", to: "2026-10-07" } };
let pendingTree = pendingChart.draw(pendingProps);
nodes(pendingTree).find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 310 } } });
pendingTree = pendingChart.draw(pendingProps);
assert.equal(animations.length, 0, "Motion waits until the accessibility preference resolves");
assert(nodes(pendingTree).filter(node => node.type === "AnimatedPath").every(node => Number(node.props.d.split(" ")[5]) === 188), "Bars never flash at full height before their initial reveal");
mediaListener({ matches: false }); pendingChart.draw(pendingProps);
assert.equal(animations.length, 1);
reset(); global.matchMedia = resolvedMedia;
const numberModule = load(path.join(__dirname, "RollingNumber.js"));
const propsFor = (title, value, unit) => ({ title, unit, average: value, granularity: "day",
    bars: bars.map(bar => ({ ...bar, value })), color: colors.nutritionSurface.series,
    dateWindow: { from: "2026-10-01", to: "2026-10-07" }, emptyMessage: "No entries" });
const mountChart = (instance, props) => {
    const tree = instance.draw(props);
    nodes(tree).find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 310 } } });
    return instance.draw(props);
};
const summary = tree => nodes(tree).find(node => node.type?.name === "RollingNumber");
const milk = renderer(Chart), food = renderer(Chart);
let milkProps = propsFor("Milk", 4, "feeds"), foodProps = propsFor("Food", 3, "entries");
let milkTree = mountChart(milk, milkProps), foodTree = mountChart(food, foodProps);
assert.equal(animations.length, 2, "Each card owns one animation clock");
const milkAnimation = animations[0], foodAnimation = animations[1];
let milkMotion = summary(milkTree).props.motion;
const digits = renderer(summary(milkTree).type);
const milkReels = reelNodes(digits.draw(summary(milkTree).props)).map(node => {
    const instance = renderer(node.type); instance.draw(node.props); return instance;
});
assert.equal(milkMotion.progress, milkAnimation.value, "Bars and digit reels use the exact same animation clock");
milkAnimation.advance(600);
assert.equal(sample(milkMotion.numbers), 2, "Number count is halfway at 600ms");
assert(sample(milkMotion.bars) > 0.5, "Bars advance ahead of the digits on the same clock");
assert.equal(sample(summary(foodTree).props.motion.numbers), 0, "Food progresses independently");
milkAnimation.advance(900);
assert.equal(sample(milkMotion.bars), 1, "Bars finish at 900ms");
assert(sample(milkMotion.numbers) > 3 && sample(milkMotion.numbers) < 4, "Digits keep scrolling after bars finish");
nodes(milkTree).find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 310.2 } } });
milkTree = milk.draw(milkProps);
assert(!milkAnimation.stopped, "Subpixel layout noise cannot cut Nutrition motion short");
assert.equal(summary(milkTree).props.motion.progress, milkAnimation.value);
const digitTree = digits.draw(summary(milkTree).props);
const milkReelTrees = reelNodes(digitTree).map((node, index) => milkReels[index].draw(node.props));
assert(milkReelTrees.every(tree => reelOffset(tree) < 0), "Every digit column visibly scrolls, including the decimal zero");
const measure = nodes(digitTree).find(node => node.props.onLayout);
measure.props.onLayout({ nativeEvent: { layout: { width: 25, height: 51 } } });
assert(reelNodes(digits.draw(summary(milkTree).props)).every(node => node.props.cell.height === 51), "Digit clipping follows measured large-text height");
assert(nodes(milkTree).some(node => node.props.accessibilityLabel?.includes("average 4.0 feeds")), "Accessibility exposes the final value throughout motion");
milkAnimation.advance(1200);
milkTree = milk.draw(milkProps);
assert.equal(summary(milkTree).props.motion.animated, false);
assert.deepEqual(digits.draw(summary(milkTree).props).children, ["4.0", " ", "feeds"], "Settled value retains formatting, units and selectable text");
assert.equal(animations.length, 2);

milkProps = propsFor("Milk", 8, "mL");
milkTree = milk.draw(milkProps);
assert.equal(animations.length, 3, "Milk-only metric change starts only Milk");
foodTree = food.draw({ ...foodProps, bars: foodProps.bars.map(bar => ({ ...bar })) });
assert.equal(animations.length, 3, "Equal bucket data does not replay or cancel an active chart");
assert(!foodAnimation.stopped);
const interrupted = animations.at(-1);
interrupted.advance(450);
milkMotion = summary(milkTree).props.motion;
const visibleValue = sample(milkMotion.numbers);
const visibleHeight = milkMotion.fromHeights[bars[0].sort] +
    (milkMotion.toHeights[bars[0].sort] - milkMotion.fromHeights[bars[0].sort]) * sample(milkMotion.bars);
milkProps = propsFor("Milk", 2, "mL");
milkTree = milk.draw(milkProps); milkMotion = summary(milkTree).props.motion;
assert(interrupted.stopped);
assert.equal(milkMotion.fromValue, visibleValue, "Rapid changes resume from the displayed number");
assert(Math.abs(milkMotion.fromHeights[bars[0].sort] - visibleHeight) < 0.000001, "Rapid changes retain displayed bar heights");
animations.at(-1).advance(600);
assert(sample(milkMotion.numbers) < visibleValue && sample(milkMotion.numbers) > 2, "Decreases roll downward toward the new value");
animations.at(-1).advance(1200);
milkTree = milk.draw(milkProps);
const countBeforeResize = animations.length;
nodes(milkTree).find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 255 } } });
milkTree = milk.draw(milkProps);
assert.equal(animations.length, countBeforeResize, "Resize settles without replaying");
milkProps = propsFor("Milk", 0, "mL");
milkTree = milk.draw(milkProps);
assert.equal(nodes(milkTree).filter(node => node.type === "AnimatedPath").length, 7, "Previously visible bars can shrink to zero");
animations.at(-1).advance(1200);
milkTree = milk.draw(milkProps);
assert(!nodes(milkTree).some(node => node.type === "AnimatedPath"), "Zero bars disappear after settling");
assert.equal(summary(milkTree).props.motion.label, "0.0");
foodAnimation.advance(1200); foodTree = food.draw(foodProps);
foodProps = { ...foodProps, dateWindow: { from: "2026-10-02", to: "2026-10-08" },
    bars: foodProps.bars.slice(1).concat({ sort: "2026-10-08", value: 3 }) };
foodTree = food.draw(foodProps);
const foodMotion = summary(foodTree).props.motion;
assert(foodMotion.fromHeights["2026-10-02"] > 0, "Retained date buckets preserve their displayed heights");
assert.equal(foodMotion.fromHeights["2026-10-08"] || 0, 0, "New date buckets start at the baseline");
const pendingFood = animations.at(-1);
foodProps = { ...foodProps, average: 5, dateWindow: { from: "2026-10-01", to: "2026-10-31" } };
foodTree = food.draw(foodProps);
assert(pendingFood.stopped);
assert(!nodes(foodTree).some(node => node.type === "AnimatedPath"));
assert(nodes(foodTree).some(node => node.type === "Path" && node.props.strokeWidth === 2.5));
animations.at(-1).advance(600);
assert(sample(summary(foodTree).props.motion.numbers) > 3, "Long-range lines remain unchanged while their summary value rolls");

for (const [from, digit, direction] of [[0, 0, 1], [0, 9, 1], [9.5, 2, 1], [2.3, 9, -1], [0, 0, -1]]) {
    const segment = numberModule.digitReel(from, digit, direction);
    const distance = direction * (segment.to - segment.from);
    assert(distance >= 10 && distance < 20, "Every reel travels a bounded full cycle before its final digit");
    assert.equal((segment.to % 10 + 10) % 10, digit);
    assert(segment.last - segment.first <= 21, "Reel markup remains bounded");
}
{
    const instance = renderer(numberModule.DigitReel);
    const progress = new Value(0), height = 34;
    const props = { progress, fromDigit: "0", toDigit: "9", direction: 1,
        cell: { width: 18, height }, style: { fontSize: 28, lineHeight: height } };
    const tree = instance.draw(props);
    assert(nodes(tree).filter(node => node.type === "Text").length >= 20, "A full strip replaces the two swapped glyphs");
    let previous = reelOffset(tree), firstStep, finalStep;
    const visited = new Set();
    for (let frame = 1; frame <= 72; frame++) {
        progress.setValue(frame / 72);
        const offset = reelOffset(tree), step = previous - offset;
        assert(step > 0 && step < height, "60fps samples move continuously without skipping an entire glyph");
        visited.add(Math.floor(-offset / height) % 10);
        firstStep ??= step; finalStep = step; previous = offset;
        assert.equal(instance.dirty, false, "Animation frames update transforms without React state renders");
    }
    assert.equal(visited.size, 10, "Every intermediate digit is visibly traversed");
    assert(finalStep < firstStep / 100, "The fast scroll eases into a gentle landing");
    assert.equal(reelOffset(tree), -19 * height);

    progress.setValue(0.41);
    const visiblePosition = tree => {
        const firstRow = nodes(tree).find(node => node.type === "Text").props.key;
        return ((firstRow - reelOffset(tree) / height) % 10 + 10) % 10;
    };
    const before = visiblePosition(tree);
    const nextProgress = new Value(0);
    let nextTree = instance.draw({ ...props, progress: nextProgress, toDigit: "2" });
    assert(Math.abs(visiblePosition(nextTree) - before) < 1e-8, "Retargeting preserves the current visible glyph and fractional offset");
    assert.equal(progress.listeners.size, 0, "The old clock is detached after retargeting");
    progress.setValue(0);
    assert(Math.abs(visiblePosition(nextTree) - before) < 1e-8, "A stale clock cannot reset the replacement reel");
    nextProgress.setValue(0.6);
    const reverseProgress = new Value(0);
    nextTree = instance.draw({ ...props, progress: reverseProgress, toDigit: "1", direction: -1 });
    const reverseStart = reelOffset(nextTree);
    reverseProgress.setValue(0.5);
    assert(reelOffset(nextTree) > reverseStart, "Decreasing values roll downward continuously");
    instance.unmount();
    assert.equal(nextProgress.listeners.size, 0);
    assert.equal(reverseProgress.listeners.size, 0);
}
for (const [from, to, label] of [[9.9, 10, "10"], [10, 9.9, "9.9"], [0, 1000, "1000"], [10, 10, "10.0"]]) {
    const instance = renderer(numberModule.RollingNumber);
    const progress = new Value(0);
    const props = { motion: { fromValue: from, toValue: to, label, progress, animated: true }, unit: "feeds", style: { fontSize: 28, lineHeight: 34 } };
    instance.draw(props); progress.setValue(0.5);
    const tree = instance.draw(props);
    assert(reelNodes(tree).every(node => Number.isFinite(node.props.cell.width)));
    assert.deepEqual(instance.draw({ ...props, motion: { ...props.motion, animated: false } }).children, [label, " ", "feeds"]);
    instance.unmount(); assert.equal(progress.listeners.size, 0);
}
const clocks = animations.map(animation => animation.value);
const unfinished = animations.at(-1);
reset();
assert(clocks.every(clock => clock.listeners.size === 0), "Unmount removes all clock and digit listeners");
assert(unfinished.stopped, "Unmount cancels unfinished chart animations");

// Growth reuses the same digit cells without Nutrition's rounding or inline units.
{
for (const label of ["16.81", "103.49", "49.61"]) {
    const instance = renderer(numberModule.CountUpNumber);
    const digitInstance = renderer(numberModule.RollingNumber);
    let props = { label, style: { fontSize: 24, lineHeight: 30, marginTop: 4 }, width: 280, reducedMotion: false };
    let tree = instance.draw(props), value = summary(tree).props;
    assert.equal(tree.props.accessibilityLabel, label);
    assert.equal(value.motion.fromValue, 0);
    const animation = animations.at(-1);
    assert.equal(animation.config.duration, 1200);
    digitInstance.draw(value);
    animation.advance(600);
    assert.equal(sample(value.motion.numbers), Number(label) / 2);
    const digitTree = digitInstance.draw(value);
    const cells = reelNodes(digitTree);
    assert.equal(cells.length, label.replace(".", "").length, "Both decimal places retain their own rolling cell");
    assert.equal(nodes(digitTree).filter(node => node.type === "Text" && node.children[0] === ".").length, 1);
    assert.equal(digitTree.props.style.marginTop, 4, "Spacing belongs to the complete number rather than every digit");
    const count = animations.length;
    instance.draw({ ...props, style: { ...props.style, color: "new-theme" } });
    assert.equal(animations.length, count, "Theme and unchanged values do not replay numbers");
    instance.draw({ ...props, width: 280.2 });
    assert(!animation.stopped, "Subpixel layout noise cannot cut Growth values short");
    assert.equal(animations.length, count);
    props = { ...props, label: "12.34" };
    tree = instance.draw(props);
    assert(animation.stopped);
    assert.equal(summary(tree).props.motion.fromValue, Number(label) / 2, "Interrupted values resume from their displayed reading");
    const replacement = animations.at(-1);
    assert.notEqual(replacement.value, animation.value, "Retargeting starts a replacement clock without resetting the stopped one");
    assert.equal(animation.value.get(), 0.5);
    replacement.advance(1200); tree = instance.draw(props);
    assert.equal(summary(tree).props.motion.label, "12.34");
    assert.equal(summary(tree).props.motion.animated, false);
    assert.deepEqual(digitInstance.draw(summary(tree).props).children, ["12.34"], "Saved precision is selectable after settling without an inline unit");
    props = { ...props, label: "9.87" };
    tree = instance.draw(props);
    assert.equal(summary(tree).props.motion.fromValue, 12.34);
    const decrease = animations.at(-1);
    decrease.advance(400);
    props = { ...props, width: 320 };
    tree = instance.draw(props);
    assert(decrease.stopped, "Resize settles the current number without replay");
    assert.equal(summary(tree).props.motion.animated, false);
    props = { ...props, label: "11.11" };
    instance.draw(props);
    const pending = animations.at(-1);
    tree = instance.draw({ ...props, reducedMotion: true });
    assert(pending.stopped);
    assert.equal(summary(tree).props.motion.label, "11.11");
    assert.equal(summary(tree).props.motion.animated, false);
    instance.unmount(); digitInstance.unmount();
    assert.equal(animation.value.listeners.size, 0);
    assert.equal(replacement.value.listeners.size, 0);
}
reset();
const PercentileChart = load(path.join(__dirname, "../PercentileChart.js")).default;
colors = theme.paletteFor(undefined, "boy", "light");
const plot = renderer(PercentileChart);
const rows = [
    { id: 1, date_recorded: "2026-10-01", weight: 16.81, height: 103.49, head_circumference: 49.61 },
    { id: 2, date_recorded: "2026-10-04", weight: 17.12, height: 104.21, head_circumference: 49.78 },
    { id: 3, date_recorded: "2026-10-04", weight: 16.99, height: 104.10, head_circumference: 49.70 },
    { id: 4, date_recorded: "2026-10-04", weight: 16.99, height: 104.10, head_circumference: 49.70 },
    { id: 5, date_recorded: "2026-10-07", weight: 17.3, height: 104.50, head_circumference: 49.82 },
];
const originalRows = JSON.stringify(rows);
let plotProps = { rows, indicator: "weight", dateOfBirth: "2022-01-01", areaFill: true, compact: true,
    dateWindow: { from: "2026-10-01", to: "2026-10-31" }, datePreset: "month", animateLine: true };
let plotTree = plot.draw(plotProps);
nodes(plotTree).find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 320 } } });
plotTree = plot.draw(plotProps);
const seriesNode = tree => nodes(tree).find(node => node.type?.name === "GrowthChartSeries");
const assertEndpoint = (tree, x, y) => {
    assert.equal(tree.props.opacity, 1, "The series cannot hide the travelling marker during a restart or settle");
    for (const radius of [7, 3.5]) {
        const circles = nodes(tree).filter(node => node.props.r === radius);
        assert.equal(circles.length, 1, "There is only one latest-point double ring");
        const dot = circles[0];
        assert.equal(sample(dot.props.opacity), 1, "Both endpoint rings stay visible throughout the reveal");
        assert(Math.abs(sample(dot.props.cx) - x) < 1e-7, "Endpoint x follows the drawn line tip");
        assert(Math.abs(sample(dot.props.cy) - y) < 1e-7, "Endpoint y follows every rise and fall");
    }
};
const series = renderer(seriesNode(plotTree).type);
let seriesProps = seriesNode(plotTree).props;
assert.equal(seriesProps.path.vertices.length, rows.length, "Repeated-day segments are retained in the complete path");
const vertices = seriesProps.path.vertices;
assert.equal(vertices[1].x, vertices[2].x);
assert(vertices[2].distance > vertices[1].distance, "Vertical same-day segments contribute to the traced distance");
assert.equal(vertices[3].distance, vertices[2].distance, "Duplicate coordinates retain their data without adding path distance");
assert.equal(seriesProps.path.length, vertices.slice(1).reduce((sum, c, i) => sum + Math.hypot(c.x - vertices[i].x, c.y - vertices[i].y), 0));
let lineTree = series.draw(seriesProps);
const lineAnimation = animations.at(-1);
assert.equal(lineAnimation.config.duration, 900);
let line = nodes(lineTree).find(node => node.type === "AnimatedPath");
assert.equal(sample(line.props.strokeDashoffset), seriesProps.path.length);
assert.equal(sample(nodes(lineTree).find(node => node.type === "AnimatedRect").props.width), 0);
assertEndpoint(lineTree, vertices[0].x, vertices[0].y);
const endpointType = nodes(lineTree).find(node => node.props.r === 7).type;
for (let i = 1; i < vertices.length; i++) {
    const from = vertices[i - 1], to = vertices[i];
    const distance = (from.distance + to.distance) / 2;
    lineAnimation.advance(900 * distance / seriesProps.path.length);
    assertEndpoint(lineTree, (from.x + to.x) / 2, (from.y + to.y) / 2);
    assert(Math.abs(sample(line.props.strokeDashoffset) - (seriesProps.path.length - distance)) < 1e-7,
        "The marker and stroke share one travelled-distance clock");
    const fillFront = sample(nodes(lineTree).find(node => node.type === "AnimatedRect").props.width);
    assert(Math.abs(fillFront - (sample(nodes(lineTree).find(node => node.props.r === 7).props.cx) - vertices[0].x)) < 1e-7,
        "Area shading follows behind the same moving endpoint");
}
lineAnimation.advance(450);
assert.equal(sample(line.props.strokeDashoffset), seriesProps.path.length / 2);
series.draw({ ...seriesProps, width: 320.2 });
assert(!lineAnimation.stopped, "Subpixel layout noise cannot cut the Growth line reveal short");
const front = sample(nodes(lineTree).find(node => node.type === "AnimatedRect").props.width);
assert(front > 0 && front < vertices.at(-1).x - vertices[0].x, "The fill reveals only behind the travelling line");
lineAnimation.advance(900); lineTree = series.draw(seriesProps);
assert.equal(nodes(lineTree).find(node => node.type === "Path" && node.props.strokeWidth === 2.5).props.d, seriesProps.path.line);
assertEndpoint(lineTree, seriesProps.path.latest.x, seriesProps.path.latest.y);
assert.equal(nodes(lineTree).find(node => node.props.r === 7).type, endpointType, "Completion retains the same endpoint component");
assert(nodes(lineTree).filter(node => node.type === "Circle").every(node => node.props.opacity === 1));
const count = animations.length;
series.draw({ ...seriesProps, lineColor: "theme-change" });
assert.equal(animations.length, count);
for (const indicator of ["height", "head", "weight"]) {
    plotProps = { ...plotProps, indicator };
    plotTree = plot.draw(plotProps); seriesProps = seriesNode(plotTree).props;
    lineTree = series.draw(seriesProps);
    assert(nodes(lineTree).some(node => node.type === "AnimatedPath"), "Every metric draws from its own beginning");
    assertEndpoint(lineTree, seriesProps.path.vertices[0].x, seriesProps.path.vertices[0].y);
    assert.equal(nodes(lineTree).find(node => node.props.r === 7).props.stroke, seriesProps.latestColor);
}
const interrupted = animations.at(-1);
plotProps = { ...plotProps, dateWindow: { from: "2026-10-01", to: "2026-10-08" } };
plotTree = plot.draw(plotProps); seriesProps = seriesNode(plotTree).props;
lineTree = series.draw(seriesProps);
assert(interrupted.stopped, "A new range cancels the old reveal");
assertEndpoint(lineTree, seriesProps.path.vertices[0].x, seriesProps.path.vertices[0].y);
const resized = animations.at(-1);
nodes(plotTree).find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 280 } } });
plotTree = plot.draw(plotProps); seriesProps = seriesNode(plotTree).props;
lineTree = series.draw(seriesProps);
assert(resized.stopped);
assert(!nodes(lineTree).some(node => node.type === "AnimatedPath"), "Resize settles without redrawing");
assertEndpoint(lineTree, seriesProps.path.latest.x, seriesProps.path.latest.y);
seriesProps = { ...seriesProps, dataKey: "another range" };
series.draw(seriesProps); const reducedAnimation = animations.at(-1);
mediaListener({ matches: true }); lineTree = series.draw(seriesProps);
assert(reducedAnimation.stopped);
assert(!nodes(lineTree).some(node => node.type === "AnimatedPath"));
assertEndpoint(lineTree, seriesProps.path.latest.x, seriesProps.path.latest.y);
plotTree = plot.draw({ ...plotProps, rows: [rows[0]] });
lineTree = series.draw(seriesNode(plotTree).props);
assert.equal(nodes(lineTree).filter(node => node.type === "Circle").length, 2, "A single point immediately retains its latest double ring");
assert(!nodes(lineTree).some(node => node.type === "Path"));
assertEndpoint(lineTree, seriesNode(plotTree).props.path.latest.x, seriesNode(plotTree).props.path.latest.y);
plotTree = plot.draw({ ...plotProps, rows: [rows[0], { ...rows[0], id: 99 }] });
lineTree = series.draw(seriesNode(plotTree).props);
assert(!nodes(lineTree).some(node => node.type === "AnimatedPath"), "Coincident points do not create an invalid zero-length animation");
assertEndpoint(lineTree, seriesNode(plotTree).props.path.latest.x, seriesNode(plotTree).props.path.latest.y);
assert(!seriesNode(plot.draw({ ...plotProps, rows: [] })), "Empty chart messaging remains intact");
assert.equal(JSON.stringify(rows), originalRows, "Animation never changes measurements");
series.draw({ ...seriesProps, animate: false });
const staticCount = animations.length;
series.draw({ ...seriesProps, animate: false, dataKey: "professional" });
assert.equal(animations.length, staticCount, "Professional/default series remain static");
const fresh = renderer(seriesNode(plotTree).type);
global.matchMedia = () => ({ matches: undefined, addEventListener: (_, fn) => { mediaListener = fn; }, removeEventListener() {} });
lineTree = fresh.draw({ ...seriesProps, animate: true });
assert.equal(lineTree.props.opacity, 0, "The full line never flashes before the motion preference resolves");
const waiting = animations.length;
mediaListener({ matches: false }); fresh.draw({ ...seriesProps, animate: true });
assert.equal(animations.length, waiting + 1);
const unmounted = animations.at(-1);
fresh.unmount(); assert(unmounted.stopped, "Unmount cancels an unfinished Growth reveal");
global.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
const reducedSeries = renderer(seriesNode(plotTree).type);
const reducedCount = animations.length;
const reducedTree = reducedSeries.draw({ ...seriesProps, animate: true });
assertEndpoint(reducedTree, seriesProps.path.latest.x, seriesProps.path.latest.y);
assert.equal(animations.length, reducedCount, "Initial reduced motion shows the final chart without starting an animation");
const instant = renderer(numberModule.CountUpNumber);
const instantTree = instant.draw({ label: "103.49", width: 0, reducedMotion: true,
    style: { fontSize: 24, lineHeight: 30 } });
assert.equal(summary(instantTree).props.motion.label, "103.49", "Reduced-motion readings are final even before layout");
}
reset(); global.matchMedia = originalMedia;
console.log("Nutrition/Growth motion passed: continuous digit reels, precision/handoff, shared clocks, visible travelling double rings, synchronized path/fill tips, vertical/duplicate/descending segments, interruption, resize, reduced motion and cleanup.");
