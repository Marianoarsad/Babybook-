// Run: node components/ui/AnchoredMenu.check.js — real menu lifecycle, no server or record writes.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"] }).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile(fs.readFileSync(path.join(__dirname, "../../theme.js"), "utf8")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
const nodes = node => node && typeof node === "object" ? [node, ...node.props.children.flatMap(nodes)] : [];
const flatten = styles => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));
function harness(platform = "web", palette = theme.PALETTES.boy) {
    const slots = [], effects = [], animations = [], scrolls = [];
    let cursor = 0, reduced = false, dimensions = { width: 390, height: 844 }, insets = { top: 0, bottom: 0, left: 0, right: 0 }, sdk = 35, webBlur = false;
    const react = {
        Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity).filter(v => v != null && v !== false) } }),
        useMemo: fn => fn(), useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial }; },
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
            return [slots[i], value => slots[i] = typeof value === "function" ? value(slots[i]) : value]; },
        useEffect(fn, deps) { const i = cursor++, previous = slots[i];
            if (!previous || deps.some((v, n) => v !== previous.deps[n])) effects.push(() => {
                previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
            }); },
    };
    class Value {
        constructor(value) { this.value = value; }
        setValue(value) { this.value = value; }
        stopAnimation() { if (this.running) { this.running.stopped = true; this.running.complete?.({ finished: false }); this.running = null; } }
        interpolate(config) { return { source: this, ...config }; }
    }
    const native = { View: "View", Text: "Text", ScrollView: "ScrollView", Pressable: "Pressable", TouchableOpacity: "TouchableOpacity",
        Platform: { OS: platform, get Version() { return sdk; } }, StyleSheet: { create: v => v, flatten, hairlineWidth: 1, absoluteFill: {}, absoluteFillObject: {} },
        useWindowDimensions: () => dimensions, Easing: { bezier: (...v) => v },
        Animated: { View: "AnimatedView", Value, timing(value, config) {
            const entry = { ...config, value, stopped: false, finish() { if (!this.stopped) { value.setValue(this.toValue); this.complete?.({ finished: true }); } } };
            return { start(complete) { entry.complete = complete; animations.push(entry); value.running = entry; } };
        } },
    };
    const imports = { react: { __esModule: true, default: react, ...react }, "react-native": native,
        "expo-blur": { BlurView: "BlurView" }, "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
        "react-native-safe-area-context": { useSafeAreaInsets: () => insets },
        "@expo/vector-icons": { Ionicons: "Icon" }, "../../theme": theme,
        "../../context/ThemeContext": { useTheme: () => ({ colors: palette, scheme: Object.values(theme.DARK_PALETTES).includes(palette) ? "dark" : "light" }) },
        "./AppModal": { __esModule: true, default: "Modal" }, "./Gradient": { __esModule: true, default: "Gradient" },
        "./GlassLighting": { __esModule: true, default: "GlassLighting" },
        "./useReducedMotion": { __esModule: true, default: () => reduced },
    };
    const module = { exports: {} };
    new Function("require", "module", "exports", "globalThis", compile(fs.readFileSync(path.join(__dirname, "AnchoredMenu.js"), "utf8")))(
        name => { assert(name in imports, name); return imports[name]; }, module, module.exports, { CSS: { supports: () => webBlur } });
    const options = { exports: {} };
    new Function("require", "module", "exports", compile(fs.readFileSync(path.join(__dirname, "OptionSheet.js"), "utf8")))(
        name => name === "./AnchoredMenu" ? module.exports : imports[name], options, options.exports);
    let props = { visible: true, variant: "select", anchor: { x: 24, y: 180, width: 300, height: 52 },
        initialScrollOffset: 132, onClose() {}, children: "Options" };
    function draw(changes) {
        props = { ...props, ...changes }; cursor = 0;
        const tree = module.exports.default(props);
        const scroll = nodes(tree).find(n => n.type === "ScrollView");
        if (scroll) scroll.props.ref.current = { scrollTo: value => scrolls.push(value) };
        while (effects.length) effects.shift()();
        return tree;
    }
    const panel = tree => nodes(tree).find(n => n.type === "AnimatedView" && n.props.accessibilityViewIsModal);
    const content = tree => nodes(tree).find(n => n.type === "ScrollView");
    return { draw, panel, content, animations, scrolls,
        drawItem(props) { cursor = 0; return module.exports.AnchoredMenuItem(props); },
        drawOptions: props => draw(options.exports.default(props).props),
        motion: value => reduced = value,
        resize: value => dimensions = value,
        safeArea: value => insets = value, sdk: value => sdk = value, webBlur: value => webBlur = value };
}

for (const platform of ["web", "ios", "android"]) {
    const h = harness(platform);
    let tree = h.draw();
    assert.equal(h.panel(tree).props.onLayout, undefined, "Fold targets must not be measured from the animated outer viewport");
    assert.equal(typeof h.content(tree).props.onContentSizeChange, "function");
    h.content(tree).props.onContentSizeChange(298, 114);
    tree = h.draw();
    assert.deepEqual(flatten(h.panel(tree).props.style).height.outputRange, [0, 116], "Include the panel border");
    assert.equal(h.animations.at(-1).duration, 220);
    assert.equal(h.animations.at(-1).useNativeDriver, false);
    assert.equal(h.scrolls.at(-1).y, 132);
    for (const intermediate of [0, 2, 25, 78]) {
        h.animations.at(-1).value.setValue(intermediate / 116);
        h.panel(tree).props.onLayout?.({ nativeEvent: { layout: { height: intermediate } } });
        tree = h.draw();
        assert.equal(flatten(h.panel(tree).props.style).height.outputRange[1], 116, "Intermediate frames cannot shrink the target");
    }
    h.animations.at(-1).finish();
    assert.equal(flatten(h.panel(h.draw()).props.style).opacity.value, 1);

    let selected;
    const options = harness(platform);
    let optionTree = options.drawOptions({ visible: true, anchor: { x: 20, y: 170, width: 300, height: 58 }, title: "Choose an age",
        selectedKey: 9, options: [{ key: 9, label: "9 months", note: "Your baby" }, { key: 12, label: "12 months" }],
        onSelect: value => selected = value, onClose() {} });
    options.content(optionTree).props.onContentSizeChange(298, 160); optionTree = options.draw();
    assert.equal(flatten(options.panel(optionTree).props.style).height.outputRange[1], 162);
    const choices = nodes(optionTree).filter(n => n.props.label === "9 months" || n.props.label === "12 months");
    assert.equal(choices[0].props.selected, true);
    assert.equal(choices[0].props.accessibilityLabel, "9 months, Your baby");
    choices[1].props.onPress();
    assert.equal(selected, 12, "OptionSheet preserves the numeric age key");
    h.content(tree).props.onContentSizeChange(298, 0);
    tree = h.draw();
    assert.equal(flatten(h.panel(tree).props.style).height.outputRange[1], 116, "Ignore transient zero content measurements");
    h.content(tree).props.onContentSizeChange(298, 900);
    tree = h.draw();
    const capped = flatten(h.panel(tree).props.style);
    assert.equal(capped.height.outputRange[1], capped.maxHeight, "Long lists scroll within the existing viewport cap");
    h.resize({ width: 320, height: 640 }); tree = h.draw();
    const compact = flatten(h.panel(tree).props.style);
    assert.equal(compact.height.outputRange[1], compact.maxHeight);
    assert(compact.height.outputRange[1] < capped.height.outputRange[1]);
    h.content(tree).props.onContentSizeChange(298, 153);
    tree = h.draw();
    assert.equal(flatten(h.panel(tree).props.style).height.outputRange[1], 155, "Wrapped/changed content replaces the natural measurement");
    tree = h.draw({ visible: false });
    const exit = h.animations.at(-1);
    tree = h.draw({ visible: true }); tree = h.draw();
    assert(exit.stopped, "Reopening cancels the old close animation");
    assert.equal(flatten(h.panel(tree).props.style).height.outputRange[1], 155, "Reopen without a content event cannot deadlock at zero");
    h.animations.at(-1).finish();
    tree = h.draw({ visible: false }); h.animations.at(-1).finish();
    assert.equal(h.draw(), null, "Completed close releases the modal");
    tree = h.draw({ visible: true }); tree = h.draw();
    h.content(tree).props.onContentSizeChange(298, 76); tree = h.draw();
    assert.equal(flatten(h.panel(tree).props.style).height.outputRange[1], 78);
    h.motion(true); tree = h.draw();
    assert.equal(h.animations.at(-1).duration, 0, "Reduced motion has no tween");
    h.animations.at(-1).finish();
    assert.equal(flatten(h.panel(h.draw()).props.style).opacity.value, 1);

    for (const mode of [{ variant: "menu" }, { variant: "menu", appearance: "glass", animation: "warp", dimBackdrop: false }]) {
        const other = harness(platform);
        let menu = other.draw(mode);
        if (mode.appearance) other.panel(menu).props.onLayout({ nativeEvent: { layout: { height: 270 } } });
        menu = other.draw();
        const style = flatten(other.panel(menu).props.style);
        assert.equal(style.height, undefined, "Ordinary/glass menus keep their existing non-fold sizing");
        assert.equal(other.content(menu).props.onContentSizeChange, undefined);
        assert.equal(style.transform.length, mode.appearance ? 2 : 1);
    }
}
console.log("Anchored menus passed: stable natural height, intermediate frames, borders, caps/resizing, changing content, scroll offset, reopen/cancellation, reduced motion, and scale/glass modes on web/iOS/Android mocks.");

for (const platform of ["web", "ios", "android"]) {
    for (const palette of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
        const h = harness(platform, palette), target = { current: {} };
        h.webBlur(true);
        let tree = h.draw({ variant: "menu", appearance: "actions", blurTarget: target,
            anchor: { x: 330, y: 12, width: 44, height: 44 }, onClose() {} });
        h.panel(tree).props.onLayout({ nativeEvent: { layout: { height: 340 } } }); tree = h.draw();
        let style = flatten(h.panel(tree).props.style);
        assert.equal(style.width, 300); assert.equal(style.top, 68); assert.equal(style.borderRadius, 26);
        if (platform === "web") {
            assert.equal(style.backdropFilter, "blur(22px) saturate(150%)", "The animated panel samples the page directly, without an opacity ancestor");
            assert(!nodes(tree).some(n => n !== h.panel(tree) && flatten(n.props.style).backdropFilter), "No nested backdrop sampler can be isolated by animated opacity");
        }
        assert.equal(style.backgroundColor, "transparent"); assert.equal(flatten(h.content(tree).props.contentContainerStyle).gap, 0);
        const scrim = nodes(tree).find(n => n.type === "AnimatedView" && !n.props.accessibilityViewIsModal);
        assert.equal(flatten(scrim.props.style).backgroundColor, "transparent");
        assert(nodes(tree).some(n => n.props.material === palette.actionMenuGlass));
        assert(nodes(tree).some(n => n.type === "Path"), "Action menu has a trigger pointer");
        if (platform !== "web") assert.equal(nodes(tree).find(n => n.type === "BlurView").props.blurTarget, target);
        tree = h.draw({ anchor: { x: 330, y: 720, width: 44, height: 44 } });
        style = flatten(h.panel(tree).props.style); assert(style.top < 720 - 340); assert(style.transformOrigin.endsWith("bottom"));
        h.resize({ width: 320, height: 300 }); h.safeArea({ top: 20, bottom: 20, left: 40, right: 40 });
        tree = h.draw({ anchor: { x: 240, y: 20, width: 44, height: 44 } }); style = flatten(h.panel(tree).props.style);
        assert.equal(style.width, 240); assert.equal(style.left, 40); assert(style.top + style.maxHeight <= 280);
        assert(style.maxHeight < 340, "Short screens scroll the action rows");
        h.motion(true); h.draw(); assert.equal(h.animations.at(-1).duration, 0);
        if (platform === "android") {
            h.sdk(30); tree = h.draw(); assert(!nodes(tree).some(n => n.type === "BlurView"));
            assert(nodes(tree).some(n => n.type === "Gradient" && n.props.colors[0] === palette.actionMenuGlass.fallback));
        }
        if (platform === "web") {
            h.webBlur(false); tree = h.draw();
            assert.equal(flatten(h.panel(tree).props.style).backdropFilter, undefined);
            assert(nodes(tree).some(n => n.type === "Gradient" && n.props.colors[0] === palette.actionMenuGlass.fallback));
        }
        let pressed = 0;
        const item = harness(platform, palette), props = { variant: "action", label: "Remove from Favorites", leading: "Icon", divider: true, onPress: () => pressed++ };
        let row = item.drawItem(props); assert.equal(flatten(row.props.style).minHeight, 56); assert.equal(flatten(row.props.style).borderBottomWidth, 1);
        const label = nodes(row).find(n => n.type === "Text"); assert.equal(label.props.numberOfLines, undefined);
        assert.equal(flatten(label.props.style).color, palette.actionMenuGlass.text);
        row.props.onPress(); assert.equal(pressed, 1);
        row.props.onFocus(); row = item.drawItem(props);
        if (platform === "web") assert.equal(flatten(row.props.style).outlineWidth, 2);
        row = item.drawItem({ ...props, disabled: true }); assert(row.props.disabled && row.props.accessibilityState.disabled);
        assert.equal(flatten(row.props.style).opacity, 0.5);
    }
}
console.log("Action menus passed: six palettes, scoped material/rows, icon slots/dividers, focus/disabled actions, local blur/fallback, pointer/flipping, safe-area sizing, short-screen scrolling and reduced motion.");

for (const platform of ["web", "ios", "android"]) {
    for (const appearance of [undefined, "glass", "actions"]) {
        const h = harness(platform);
        let tree = h.draw({ variant: "menu", appearance, anchor: { x: 330, y: 540, width: 44, height: 44 } });
        h.panel(tree).props.onLayout?.({ nativeEvent: { layout: { height: 340 } } });
        tree = h.draw(); h.animations.at(-1).finish();
        const open = flatten(h.panel(tree).props.style);
        tree = h.draw({ visible: false, anchor: null });
        const exit = h.animations.at(-1);
        exit.value.setValue(0.5);
        tree = h.draw();
        const closing = flatten(h.panel(tree).props.style);
        for (const key of ["left", "top", "width", "maxHeight", "transformOrigin"])
            assert.equal(closing[key], open[key], `${platform}/${appearance}: clearing the trigger must not move the exit frame (${key})`);
        tree = h.draw({ visible: true, anchor: { x: 300, y: 20, width: 44, height: 44 } });
        tree = h.draw();
        assert(exit.stopped, "Reopening cancels the old exit callback");
        exit.finish();
        assert(h.panel(h.draw()), "A cancelled exit must not unmount the reopened menu");
        assert.equal(flatten(h.panel(tree).props.style).top, appearance ? 76 : 68);
        h.animations.at(-1).finish(); h.draw({ visible: false, anchor: null });
        h.animations.at(-1).finish(); assert.equal(h.draw(), null);
    }
}
console.log("Menu exit positions survive cleared anchors and interrupted closes on all platforms.");

for (const platform of ["web", "ios", "android"]) {
    for (const palette of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
        const h = harness(platform, palette), coverage = [];
        const trigger = ({ covered }) => { coverage.push(covered); return { type: "Trigger", props: { covered, children: [] } }; };
        const anchor = { x: 240, y: 320, width: 128, height: 44 };
        let tree = h.draw({ visible: false, anchor, variant: "select", appearance: "connectedSelect", trigger,
            header: { type: "Header", props: { children: [] } }, blurTarget: { current: {} }, initialScrollOffset: 0 });
        assert.equal(coverage.at(-1), false); assert(!h.panel(tree));
        tree = h.draw({ visible: true }); tree = h.draw();
        let style = flatten(h.panel(tree).props.style);
        assert.equal(coverage.at(-1), true);
        assert.deepEqual(style.height.outputRange, [44, 44], "The header stays visible while natural options are measured");
        h.content(tree).props.onContentSizeChange(128, 156); tree = h.draw();
        style = flatten(h.panel(tree).props.style);
        assert.equal(style.left, 240); assert.equal(style.top, 320); assert.equal(style.width, 128);
        assert.equal(style.borderRadius, 22); assert.equal(style.opacity, 1);
        assert.equal(style.borderWidth, 0); assert.equal(style.paddingHorizontal, 0);
        assert.deepEqual(style.height.outputRange, [44, 200]); assert.equal(h.animations.at(-1).duration, 220);
        assert.equal(h.content(tree).props.showsVerticalScrollIndicator, false, "Normal closing folds must not flash a scrollbar");
        assert.equal(h.panel(tree).props.onLayout, undefined, "Connected folds cannot measure animated outer frames");
        assert(!nodes(tree).some(n => n.type === "Path"), "A connected selector has no detached pointer");
        assert.equal(flatten(nodes(tree).find(n => n.type === "AnimatedView" && !n.props.accessibilityViewIsModal).props.style).backgroundColor, "transparent");
        assert(nodes(tree).some(n => n.type === "Header"));
        assert.equal(flatten(h.content(tree).props.contentContainerStyle).padding, 8);
        h.animations.at(-1).finish(); tree = h.draw({ visible: false, anchor: null });
        h.animations.at(-1).value.setValue(0.5); tree = h.draw();
        assert.equal(coverage.at(-1), true, "Original trigger remains covered during closing");
        style = flatten(h.panel(tree).props.style); assert.equal(style.left, 240); assert.equal(style.top, 320);
        const exit = h.animations.at(-1);
        tree = h.draw({ visible: true, anchor }); tree = h.draw(); assert(exit.stopped);
        assert.deepEqual(flatten(h.panel(tree).props.style).height.outputRange, [44, 200]);
        h.resize({ width: 320, height: 420 }); h.safeArea({ top: 20, bottom: 20, left: 0, right: 0 });
        tree = h.draw({ anchor: { x: 160, y: 370, width: 128, height: 44 } }); style = flatten(h.panel(tree).props.style);
        assert.equal(style.width, 128); assert.equal(style.top, 288, "Shift the whole unit only enough to fit header and one row");
        assert.equal(style.top + style.maxHeight, 392);
        assert.equal(style.height.outputRange[1], style.maxHeight, "Short screens cap only the options viewport");
        assert.equal(h.content(tree).props.showsVerticalScrollIndicator, true);
        h.content(tree).props.onContentSizeChange(128, 240); tree = h.draw();
        assert.equal(flatten(h.panel(tree).props.style).height.outputRange[1], style.maxHeight, "Wrapped rows remain scrollable");
        h.motion(true); h.draw(); assert.equal(h.animations.at(-1).duration, 0);
        h.draw({ visible: false, anchor: null }); h.animations.at(-1).finish(); tree = h.draw();
        assert.equal(coverage.at(-1), false); assert(!h.panel(tree));
        const rowHarness = harness(platform, palette);
        const row = rowHarness.drawItem({ variant: "connectedSelect", selected: true, label: "Height" });
        assert.equal(flatten(row.props.style).minHeight, 44);
        assert.equal(flatten(row.props.style).backgroundColor, "transparent");
        assert.equal(row.props.accessibilityState.selected, true);
        if (platform === "web") assert.equal(row.props["aria-pressed"], true);
        assert(nodes(row).some(n => n.type === "Gradient" && n.props.colors === palette.growthDropdownGlass.selected));
        assert.equal(nodes(row).find(n => n.type === "Text").props.numberOfLines, undefined);
    }
}
console.log("Connected growth selectors passed: six palettes/three platforms, shared width/header, seamless corners, no backdrop/pointer, natural reveal, covered trigger lifecycle, viewport scrolling, interruption and reduced motion.");
