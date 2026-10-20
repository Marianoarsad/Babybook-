// Run: node components/ui/GlassDateRangeFilterModal.check.js. In-memory fixtures only.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "../..");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
function load(file, imports = {}) {
    const m = { exports: {} };
    new Function("require", "module", "exports", compile(fs.readFileSync(path.join(root, file), "utf8")) + (file.endsWith("GlassDateRangeFilterModal.js") ? "\nexports.__control = GlassControl; exports.__styles = makeStyles;" : file.endsWith("GlassLighting.js") ? "\nexports.__lighting = exports.default;" : ""))(name => {
        assert(name in imports, `Unexpected import: ${name}`); return imports[name];
    }, m, m.exports); return m.exports;
}
const dates = load("utils/dates.js"), theme = load("theme.js");
const logic = load("utils/dateFilter.js", { "./dates": dates });
const dictionaries = load("translations.js").translations;
const today = "2026-10-17", minimumDate = "2026-05-16";
const availableDates = ["2026-05-16", "2026-09-18", "2026-10-02", "2026-10-09", "2026-10-16"];
const context = { today, minimumDate, availableDates, years: [2026], earliestMonth: "2026-05" };
const value = { dateRange: { from: "2026-09-17", to: "2026-10-16" }, preset: null, yearRange: { from: 2026, to: 2026 } };
const frozen = JSON.stringify({ value, availableDates });
let draft = logic.dateFilterDraft(value, today);
assert.deepEqual(logic.growthPreset("month", draft, context).dateRange, { from: "2026-09-01", to: "2026-10-17" });
assert.deepEqual(logic.nutritionPreset("month", draft, context).dateRange, { from: "2026-10-01", to: "2026-10-17" });
assert.deepEqual(logic.growthPreset("week", draft, context).dateRange, { from: "2026-10-15", to: "2026-10-17" });
assert.deepEqual(logic.nutritionPreset("week", draft, context).dateRange, { from: "2026-10-15", to: "2026-10-17" });
const earlier = logic.dateFilterDraft({ ...value, dateRange: { from: "2026-09-17", to: "2026-09-18" } });
assert.equal(logic.growthPreset("week", earlier, context).weekRange.month, "2026-09");
assert.equal(logic.nutritionPreset("week", earlier, context).weekRange.month, "2026-10");
const noData = logic.growthPreset("week", draft, { ...context, availableDates: [] });
assert.equal(noData.dateRange, null); assert(logic.dateFilterError(noData, minimumDate, today, [2026]));
draft = logic.growthPreset("year", draft, context);
assert.deepEqual(draft.dateRange, { from: "2026-01-01", to: "2026-12-31" });
assert.equal(logic.dateFilterError(draft, minimumDate, today, [2026]), "");
assert.equal(logic.growthPreset("year", draft, context).preset, null);
draft = logic.commitFilterDate(draft, "from", "2026-09-18");
assert.equal(draft.preset, null); assert.match(logic.dateFilterError(draft, minimumDate, today, [2026]), /future/);
draft = logic.commitFilterDate(draft, "to", "2026-10-16");
assert.equal(logic.dateFilterError(draft, minimumDate, today, [2026]), "");
draft = logic.nutritionPreset("week", draft, context);
assert.deepEqual(logic.selectFilterPeriod(draft, "from", 2, "2026-09", minimumDate, today).dateRange, { from: "2026-09-08", to: "2026-09-14" });
const monthly = logic.nutritionPreset("month", draft, context);
assert.deepEqual(logic.selectFilterPeriod(monthly, "from", 5, "2026-10", minimumDate, today).dateRange, { from: minimumDate, to: today });
const yearly = { ...draft, preset: "year", yearRange: { from: 2025, to: 2026 } };
assert.deepEqual(logic.selectFilterPeriod(yearly, "from", 2026, "2026-10", minimumDate, today).dateRange, { from: "2026-01-01", to: "2026-12-31" });
const leap = { dateRange: { from: "2028-02-29", to: "2028-02-29" }, preset: null };
assert.equal(logic.dateFilterError(leap, null, "2028-03-01", [2028]), "");
assert(logic.dateFilterError({ ...leap, dateRange: { from: "2026-02-29", to: "2028-03-01" } }, null, "2028-03-01", [2028]));
assert(logic.dateFilterError({ ...leap, dateRange: { from: "2028-03-02", to: "2028-03-01" } }, null, "2028-03-03", [2028]));
assert.equal(JSON.stringify({ value, availableDates }), frozen, "Preset/date operations must not mutate source data");

const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(nodes)] : [];
let nextId = 0;
function harness(view = "default", overrides = {}) {
    const slots = [], queued = [], calls = []; let cursor = 0;
    const React = { Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
        useId() { const i = cursor++; return slots[i] ||= "fixture-id-" + (++nextId); }, useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
            return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
        useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; }, useMemo: fn => fn(),
        useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || !deps.every((v, j) => Object.is(v, old.deps[j])))
            queued.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); } };
    class Value { constructor(value) { this.value = value; } stopAnimation() {} setValue(v) { this.value = v; } interpolate() { return this.value; } }
    const imports = { react: { __esModule: true, default: React, ...React }, "react-native": {
        Animated: { Value, View: "AnimatedView", timing: (value, settings) => ({ start: cb => { value.setValue(settings.toValue); cb?.({ finished: true }); } }) },
        Easing: { bezier() {} }, Platform: { OS: "web" }, Pressable: "Pressable", ScrollView: "Scroll", Text: "Text", View: "View", Image: "Image",
        StyleSheet: { create: v => v, absoluteFillObject: {} }, useWindowDimensions: () => ({ width: 320, height: 568, fontScale: 1.3 }) },
        "react-native-svg": { __esModule: true, default: "Svg", Defs: "Defs", LinearGradient: "LinearGradient", RadialGradient: "RadialGradient", Stop: "Stop", Rect: "Rect", Path: "Path" },
        "../../assets/navbar/calendar-blue.png": "calendar-blue.png", "../../assets/navbar/calendar-pink.png": "calendar-pink.png",
        "expo-blur": { BlurView: "Blur" }, "@expo/vector-icons": { Ionicons: "Icon" }, "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 20, bottom: 10 }) },
        "./AppModal": { __esModule: true, default: "AppModal" }, "./Gradient": { __esModule: true, default: "Gradient" }, "./GlassLighting": { __esModule: true, default: "GlassLighting" }, "./DateField": { DateWheelPicker: "DateWheel" },
        "./useReducedMotion": { __esModule: true, default: () => true }, "./useSoftPress": { __esModule: true, default: () => ({ respond() {}, transform: [] }) },
        "../../context/ThemeContext": { useTheme: () => ({ colors: theme.PALETTES.boy, scheme: "light" }) },
        "../../context/LanguageContext": { useLanguage: () => ({ t: key => dictionaries.en[key] || key }) },
        "../../theme": theme, "../../utils/dates": dates, "../../utils/dateFilter": logic };
    const loaded = load(view === "__lighting" ? "components/ui/GlassLighting.js" : "components/ui/GlassDateRangeFilterModal.js", imports), Component = loaded[view];
    const props = { visible: true, value, title: "Choose Dates", subtitle: "Fixture", minimumDate, availableDates,
        resolvePreset: logic.growthPreset, years: [2026], onApply: range => calls.push(range), onClose: () => { calls.push("close"); props.visible = false; }, ...overrides };
    const render = () => { cursor = 0; const tree = Component(props); queued.splice(0).forEach(fn => fn()); return tree; };
    const get = (key, expected) => nodes(render()).find(n => n.props[key] === expected);
    render(); render();
    return { props, calls, render, get };
}
const h = harness();
assert.equal(nodes(h.render()).find(n => n.type === "DateWheel").props.headerAccessory, undefined, "Custom dates need no period controls");
h.get("testID", "date-preset-month").props.onPress();
assert.equal(h.calls.length, 0, "Quick actions only change the draft");
h.get("label", "Cancel").props.onPress(); h.render(); assert.equal(h.render(), null);
h.props.visible = true; h.render(); assert.equal(h.get("testID", "date-preset-month").props.selected, false);
h.get("testID", "date-preset-year").props.onPress();
h.get("testID", "date-field-from").props.onPress();
const wheel = nodes(h.render()).find(n => n.type === "DateWheel");
assert(wheel.props.visible); assert.deepEqual(wheel.props.availableDates, availableDates);
wheel.props.onClose(); assert.equal(h.get("testID", "date-preset-year").props.selected, true, "Picker cancellation retains preset");
h.get("testID", "date-field-from").props.onPress();
nodes(h.render()).find(n => n.type === "DateWheel").props.onChange("2026-09-18");
assert.equal(h.get("testID", "date-preset-year").props.selected, false);
assert.equal(h.get("testID", "date-filter-done").props.disabled, true, "Custom range must correct future year endpoint");
nodes(h.render()).find(n => n.type === "DateWheel").props.onClose();
h.get("testID", "date-field-to").props.onPress();
nodes(h.render()).find(n => n.type === "DateWheel").props.onChange("2026-10-16");
const done = h.get("testID", "date-filter-done"); assert.equal(done.props.disabled, false);
done.props.onPress(); done.props.onPress(); assert.equal(h.calls.filter(x => x !== "close").length, 1);
assert.deepEqual(h.calls.at(-1), { ...value, dateRange: { from: "2026-09-18", to: "2026-10-16" } });
h.get("label", "Close date filter").props.onPress(); h.render();
h.props.value = h.calls.find(x => x !== "close"); h.props.visible = true; h.render();
assert.equal(h.get("testID", "date-field-from").props.label, "18 Sep 2026", "Reopening restores the applied filter");
assert(h.get("testID", "date-filter-blur-fallback"), "Readable fallback exists without CSS blur");
const period = harness();
period.get("testID", "date-preset-week").props.onPress();
assert(!period.get("testID", "date-filter-adjust"), "No Adjust period control clutters the main layout");
period.get("testID", "date-field-from").props.onPress();
const periodWheel = nodes(period.render()).find(n => n.type === "DateWheel");
assert(periodWheel.props.headerAccessory);
const contextualPeriod = nodes(periodWheel.props.headerAccessory).find(n => n.props.testID === "date-picker-period");
contextualPeriod.props.onPress();
assert.equal(period.get("label", "Week 2").props.disabled, false);
period.get("label", "Week 2").props.onPress();
assert.equal(period.calls.length, 0, "Specialized period controls remain pending");
period.get("testID", "date-filter-done").props.onPress();
assert.equal(period.calls[0].preset, "week"); assert.equal(period.calls[0].dateRange.from, "2026-10-08");
const lighting = harness("__lighting", { material: theme.PALETTES.boy.dateFilterGlass, radius: 28, panel: true });
lighting.render().props.onLayout({ nativeEvent: { layout: { width: 360, height: 620 } } });
const svg = nodes(lighting.render()).find(n => n.type === "Svg");
assert.equal(svg.props.viewBox, "0 0 360 620");
const lighting2 = harness("__lighting", { material: theme.PALETTES.girl.dateFilterGlass, radius: 24 });
const ids1 = nodes(lighting.render()).filter(n => n.props.id).map(n => n.props.id);
const ids2 = nodes(lighting2.render()).filter(n => n.props.id).map(n => n.props.id);
assert(ids1.every(id => !ids2.includes(id)), "Each material instance owns its SVG definitions");
assert.equal(lighting.render().props.pointerEvents, "none", "Light layers never intercept controls");
const yearFlow = harness(); yearFlow.get("testID", "date-preset-year").props.onPress(); yearFlow.get("testID", "date-field-to").props.onPress();
const yearWheel = nodes(yearFlow.render()).find(n => n.type === "DateWheel");
nodes(yearWheel.props.headerAccessory).find(n => n.props.testID === "date-picker-period").props.onPress();
yearFlow.get("label", "2026").props.onPress();
assert.equal(yearFlow.get("testID", "date-preset-year").props.selected, true);
assert.equal(yearFlow.calls.length, 0, "Period changes stay pending");
const dateSource = fs.readFileSync(path.join(root, "components/ui/DateField.js"), "utf8");
assert(dateSource.includes("    headerAccessory,") && dateSource.includes("{headerAccessory}"));
assert(dateSource.includes("maxHeight: Math.max(100, height - insets.top - insets.bottom"), "Field picker fits short safe-area viewports");
const wheelSource = dateSource.slice(dateSource.indexOf("export function DateWheelPicker"), dateSource.indexOf("function formatTime"));
assert(wheelSource.includes('<View style={styles.datePickerBackdrop}>'));
assert(wheelSource.includes('accessibilityRole="button" accessibilityLabel="Close date picker" />'), "Backdrop is a sibling instead of an ancestor button");
const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
for (const palettes of [theme.PALETTES, theme.DARK_PALETTES]) for (const p of Object.values(palettes)) {
    assert.notEqual(p.dateFilterGlass.fieldShadow, p.dateFilterGlass.controlShadow); assert.notEqual(p.dateFilterGlass.activeShadow, p.dateFilterGlass.controlShadow);
    assert(p.dateFilterGlass.panel.every(color => color.startsWith("rgba("))); assert(p.dateFilterGlass.active.length === 3);
    for (const color of p.dateFilterGlass.active.slice(1)) assert((1.05 / (luminance(color) + 0.05)) >= 4.5, "White labels retain AA contrast below the top gloss");
}
for (const file of ["components/Growth.js", "components/ui/NutritionDateFilter.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8"); assert(source.includes("<GlassDateRangeFilterModal")); assert(!source.includes("<DateWheelPicker"));
}
console.log("Glass date filters: preset policies, date validation, period selection, pending/apply/cancel/reopen, date-wheel cancellation, duplicate Apply guard, fallback, palettes and unchanged inputs passed.");
