// Run: node components/ui/FeedingTodayCard.check.js — no records or server required.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
let colors, owner, fontScale = 1, id = 0;
const react = {
    Fragment: "Fragment", memo: fn => fn, useMemo: fn => fn(), useId: () => `:feeding-${++id}:`,
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(v => v != null && v !== false) }),
    useState: initial => { const current = owner, i = current.cursor++; current.slots[i] ??= initial;
        return [current.slots[i], next => { current.slots[i] = next; }]; },
};
const native = { View: "View", Text: "Text", Pressable: "Pressable", Animated: { View: "AnimatedView" }, Platform: { OS: "web" },
    StyleSheet: { create: s => s, absoluteFillObject: { position: "absolute", inset: 0 } },
    useWindowDimensions: () => ({ width: 390, height: 844, fontScale }) };
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs"), require.resolve("@babel/plugin-transform-react-jsx")] }).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile(fs.readFileSync(path.join(__dirname, "../../theme.js"), "utf8")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
const source = name => fs.readFileSync(path.join(__dirname, name), "utf8");
const iconNames = ["Circle", "Defs", "Ellipse", "G", "LinearGradient", "Path", "RadialGradient", "Rect", "Stop"];
const svg = { __esModule: true, default: "Svg", ...Object.fromEntries(iconNames.map(name => [name, name])) };
function load(file) {
    const module = { exports: {} };
    const mock = name => {
        if (name === "react") return react;
        if (name === "react-native") return native;
        if (name === "react-native-svg") return svg;
        if (name === "@expo/vector-icons") return { Ionicons: "Icon" };
        if (name.endsWith("ThemeContext")) return { useTheme: () => ({ colors }) };
        if (name.endsWith("theme")) return theme;
        if (name.endsWith("dates")) return { shortDate: date => date, shortTime: time => time, durationText: n => `${n} min` };
        if (name.endsWith("adapters")) return { feedRowSummary: entry => entry.summary };
        if (name.endsWith("Cards")) return { SectionContainerCard: "SectionContainerCard" };
        if (name === "./Gradient") return { __esModule: true, default: "Gradient" };
        if (name === "./useSoftPress") return { __esModule: true, default: () => ({ respond() {}, transform: [] }) };
        return { __esModule: true, default: name.slice(2) };
    };
    new Function("require", "module", "exports", compile(source(file)))(mock, module, module.exports);
    return module.exports.default;
}
const Card = load("FeedingTodayCard.js"), MilkIcon = load("MilkIcon.js");
function renderer(fn) {
    const state = { slots: [], cursor: 0 };
    return props => { owner = state; state.cursor = 0; return fn(props); };
}
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.children || []).flatMap(nodes)] : [];
const text = tree => typeof tree !== "object" ? String(tree ?? "") : (tree.children || []).map(text).join(" ");
const find = (tree, testID) => nodes(tree).find(n => n.props.testID === testID);
const style = node => Object.assign({}, ...[node.props.style].flat());
const stats = { count: 4, solidCount: 3, volume: 540.4, breastMinutes: 0, totalCount: 7 };
const latestEntries = [
    { id: "milk", entry_type: "milk", entry_date: "2026-10-14", entry_time: "18:34", summary: "Formula · 150 mL" },
    { id: "food", entry_type: "solid", entry_date: "2026-10-14", entry_time: "18:00", summary: "Solid food · Chicken tinola and rice" },
];
let tapped = 0;
const props = { date: "2026-10-14", stats, mix: { breastmilk: 0, formula: 4, mixed: 0, solid: 3 },
    lastMilkText: "Last milk: 6:34 PM · 1 hr ago", latestEntries, reactions: [], onViewAll: () => tapped++ };
const snapshot = JSON.stringify(props);
const luminance = hex => hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (colors of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    for (const width of [216, 266, 306, 346, 700]) for (fontScale of [1, 1.6, 2]) {
        const draw = renderer(Card);
        let tree = draw(props);
        find(tree, "feeding-today-metrics").props.onLayout({ nativeEvent: { layout: { width } } });
        tree = draw(props);
        const grid = find(tree, "feeding-today-metrics"), columns = (width - 12) / 2 < 112 * fontScale ? 1 : 2;
        assert.equal(grid.children.length, 4 / columns);
        assert(grid.children.every(row => row.children.length === columns));
        const inline = (width - 12 * (columns - 1)) / columns >= 200 * fontScale;
        for (const key of ["milk", "solid", "volume", "breast"]) {
            const tile = find(tree, "feeding-today-" + key), s = style(tile);
            assert.equal(s.flex, 1); assert.equal(s.minWidth, 0);
            assert.equal(s.flexDirection === "row", inline);
            assert.equal(s.overflow, "visible"); assert.equal(s.borderRadius, 22);
            assert.equal(s.height, undefined); assert.equal(s.boxShadow, colors.feedingToday.tileShadow);
            assert(tile.props.accessibilityLabel.startsWith({ milk: "Milk feeds", solid: "Solid meals", volume: "Bottle volume logged", breast: "Breastfeeding time" }[key]));
        }
        assert.equal(style(tree).overflow, "visible"); assert.equal(style(tree).borderWidth, 0);
        assert.equal(tree.props.title, "Feeding Today"); assert.equal(tree.props.subtitle, props.date);
        assert.equal(nodes(tree).filter(n => n.type === "MilkIcon").length, 1, "No decorative header bottle or extra latest milk icon");
        const rows = nodes(tree).filter(n => n.props.testID === "feeding-today-entry");
        assert.deepEqual(rows.map(row => row.props.key), ["milk", "food"]);
        assert(rows.every(row => style(row).overflow === "visible" && style(row).borderRadius === 24));
        assert(rows.every(row => row.props.onPress === undefined), "Informational rows stay informational");
        assert(nodes(tree).filter(n => n.type === "Text").every(n => n.props.numberOfLines === undefined), "Labels and saved values are not truncated");
        for (const copy of ["7 entries logged", "540 mL", "Not logged", props.lastMilkText, ...latestEntries.map(e => e.summary)]) assert(text(tree).includes(copy));
        for (const key of ["panel", "milk", "solid", "volume", "breast"]) for (const background of colors.feedingToday[key]) {
            assert(contrast(colors.feedingToday.text, background) >= 4.5);
            assert(contrast(colors.feedingToday.secondary, background) >= 4.5);
        }
    }
    const draw = renderer(Card);
    let tree = draw(props);
    const footer = nodes(tree).find(n => n.type === "Pressable");
    assert(style(footer).minHeight >= 44); footer.props.onPress();
    footer.props.onFocus({ currentTarget: { matches: () => true } });
    tree = draw(props); assert.equal(style(nodes(tree).find(n => n.type === "Pressable")).outlineStyle, "solid");
    const empty = draw({ ...props, stats: { count: 0, totalCount: 0, solidCount: 0, volume: 0, breastMinutes: 0 }, latestEntries: [] });
    assert(text(empty).includes("No feeding records logged today.")); assert(!find(empty, "feeding-today-entry"));
    assert(text(draw({ ...props, stats: { ...stats, totalCount: 1, breastMinutes: 20 } })).includes("1 entry logged"));
    assert(text(draw({ ...props, stats: { ...stats, breastMinutes: 20 } })).includes("20 min"));
    const untimed = draw({ ...props, latestEntries: [{ ...latestEntries[0], entry_time: null }] });
    assert(text(untimed).includes("Time not recorded"));
    const warning = draw({ ...props, reactions: [{ food_introduced: "Egg", reaction_severity: "severe" }, { reaction_severity: "mild" }] });
    const alert = nodes(warning).find(n => n.props.accessibilityRole === "alert");
    assert(text(alert).includes("Severe")); assert(text(alert).includes("+1 more")); assert.equal(style(alert).backgroundColor, colors.dangerBg);
    for (const size of [18, 24, 40, 56]) for (const backgroundShape of ["circle", "rounded-square", "none"]) {
        const icon = renderer(MilkIcon)({ size, backgroundShape });
        assert.equal(style(icon).width, size); assert.equal(style(icon).height, size);
        assert.equal(icon.props.pointerEvents, "none"); assert.equal(icon.props.accessible, false);
        assert.equal(nodes(icon).some(n => n.type === "Circle"), backgroundShape === "circle");
        assert.equal(nodes(icon).some(n => n.type === "Rect" && Number(n.props.rx) === 28), backgroundShape === "rounded-square");
        const noBackground = renderer(MilkIcon)({ size, backgroundShape, showBackground: false });
        assert(!nodes(noBackground).some(n => n.type === "Circle" || n.type === "Rect" && Number(n.props.rx) === 28));
        assert(nodes(icon).some(n => n.type === "G" && n.props.transform === "rotate(16 50 50)"));
        assert.deepEqual(nodes(icon).filter(n => n.type === "Stop").slice(6, 9).map(n => n.props.stopColor), colors.nutritionArtwork.blue);
        assert(!nodes(icon).some(n => n.type === "Stop" && colors.nutritionArtwork.pink.includes(n.props.stopColor)), "Milk never uses the old pink cap");
        const ids = nodes(icon).filter(n => /Gradient$/.test(n.type)).map(n => n.props.id);
        const next = renderer(MilkIcon)({});
        assert(!nodes(next).some(n => ids.includes(n.props.id)), "SVG definitions are instance-scoped");
    }
}
assert.equal(tapped, 6); assert.equal(JSON.stringify(props), snapshot, "Rendering never mutates inputs");
for (const file of ["../Dashboard.js", "../AllActivity.js", "../NutritionTracker.js", "../ProfessionalView.js", "ActionSheet.js"]) {
    assert(source(file).includes("<MilkIcon"), file + " uses the shared milk artwork");
}
assert(!source("../NutritionTracker.js").includes('"heart-outline"'));
assert(!source("../NutritionTracker.js").includes('"water-outline"'));
assert(!source("SolidFoodIcon.js").includes("MilkBottleIcon"));
assert.equal((source("ActionSheet.js").match(/key === "milk" \? <MilkIcon/g) || []).length, 2);
assert(source("../Dashboard.js").includes('onViewAll={() => nav("nutrition")}'));
assert(!/fetch\(|useRecords|api\./.test(source("FeedingTodayCard.js")));
console.log("Feeding Today checks passed: responsive tiles, six palettes, data/alerts/navigation, unclipped surfaces and shared Milk artwork.");
