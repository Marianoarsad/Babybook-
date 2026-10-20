// Actual JSX and state transitions with fictional data; no UI/runtime or API access.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
function pure(file) {
    const filename = path.resolve(__dirname, file), module = { exports: {} };
    if (filename.endsWith(".cjs")) return require(filename);
    new Function("require", "module", "exports", compile(fs.readFileSync(filename, "utf8")))(name => pure(path.resolve(path.dirname(filename), name + (path.extname(name) ? "" : ".js"))), module, module.exports);
    return module.exports;
}
const theme = pure("../../theme.js"), selectors = pure("../../utils/milkTypeHistory.js");
const all = tree => tree && typeof tree === "object" ? [tree, ...(tree.type?.name === "FeedingStackedPlot" ? all(tree.type(tree.props)) : (tree.props.children || []).flatMap(all))] : [];
const find = (tree, predicate) => all(tree).find(predicate);
const text = tree => tree && typeof tree === "object" ? (tree.props.children || []).map(text).join(" ") : String(tree ?? "");
const slots = []; let cursor = 0, fontScale = 1, palette = theme.PALETTES.boy;
const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }), useMemo: fn => fn(), useId: () => "test",
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => slots[i] = typeof value === "function" ? value(slots[i]) : value]; } };
const defaults = name => ({ __esModule: true, default: name });
const imports = { react: { __esModule: true, default: react, ...react }, "react-native": { Platform: { OS: "web" }, View: "View", Text: "Text", ScrollView: "ScrollView", Switch: "Switch", TextInput: "Input", Pressable: "Pressable", Animated: { View: "AnimatedView" }, StyleSheet: { create: s => s }, useWindowDimensions: () => ({ fontScale, height: 844 }) },
    "react-native-svg": { __esModule: true, default: "Svg", Defs: "Defs", Line: "Line", LinearGradient: "LinearGradient", Rect: "Rect", Stop: "Stop", Path: "Path", Text: "SvgText" },
    "@expo/vector-icons": { Ionicons: "Icon" }, "../../context/ThemeContext": { useTheme: () => ({ colors: palette }) }, "../../theme": theme,
    "../../utils/api": { api: { deleteRecord: async () => {} } }, "../../utils/useRecords": { useRecordSave: () => async () => {} }, "../../utils/dates": pure("../../utils/dates.js"),
    "../../utils/milkFeedingChart": pure("../../utils/milkFeedingChart.js"), "../../utils/feedingStats": pure("../../utils/feedingStats.js"),
    "../../utils/milkTypeHistory": selectors, "./ConsultationsAppointmentsCard": { DashboardSurface: "Surface", DashboardControl: "Control", DashboardListTransition: "Transition" },
    "./MilkIcon": defaults("MilkIcon"), "./AnimatedReveal": defaults("Reveal"), "./RecordFormSheet": { ...defaults("Form"), DeleteConfirmation: "Delete", RecordFormGroup: "Group" },
    "./DateField": { DateField: "Date" }, "./Field": defaults("Field"), "./PlanDetail": defaults("Detail"), "./Skeleton": { SkeletonBlock: "Skeleton" },
    "./AppModal": defaults("Modal"), "./KeyboardAvoider": defaults("KeyboardAvoider"), "./useBottomSheetMotion": { ...defaults(() => ({ presented: true, dismiss() {}, pan: { panHandlers: {} } })) },
    "./useSoftPress": defaults(() => ({ respond() {}, transform: [] })), "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) } };
const modulePlot = { exports: {} };
new Function("require", "module", "exports", compile(fs.readFileSync(path.join(__dirname, "FeedingStackedPlot.js"), "utf8")))(name => { assert(name in imports, name); return imports[name]; }, modulePlot, modulePlot.exports);
imports["./FeedingStackedPlot"] = modulePlot.exports;
const moduleChart = { exports: {} };
new Function("require", "module", "exports", compile(fs.readFileSync(path.join(__dirname, "MilkFeedingStackedChart.js"), "utf8")))(name => { assert(name in imports, name); return imports[name]; }, moduleChart, moduleChart.exports);
imports["./MilkFeedingStackedChart"] = moduleChart.exports;
const moduleUI = { exports: {} };
new Function("require", "module", "exports", compile(fs.readFileSync(path.join(__dirname, "MilkTypeCard.js"), "utf8")))(name => { assert(name in imports, name); return imports[name]; }, moduleUI, moduleUI.exports);
const UI = moduleUI.exports, today = "2026-10-15", periods = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, milk_type: i % 2 ? "Formula" : "Mixed", start_date: today, end_date: today }));
let props = { childId: "fixture", periods, feeds: [{ id: "f1", entryType: "milk", milkType: "Formula", date: today }], legacy: { current: null, periods: [] }, today, onRetry() {}, onOpenEntry() {} };
const render = changes => { cursor = 0; props = { ...props, ...changes }; return UI.default(props); };
const sheet = tree => find(tree, node => node.type === UI.MilkHistorySheet);
const active = tree => sheet(tree)?.props.visible ? sheet(tree) : { props: { children: tree.props.children.filter(n => n?.type !== UI.MilkHistorySheet) } };
const rows = tree => all(active(tree)).filter(node => node.type === UI.MilkPeriodRow);
const button = (tree, prefix) => find(active(tree), node => node.props.accessibilityLabel?.startsWith(prefix));
let tree = render(); assert.equal(rows(tree).length, 5); assert(!find(tree, n => n.props.testID === "milk-empty"));
assert(!text(active(tree)).includes("Days logged"));
assert(!find(active(tree), n => n.props.testID === "milk-current"));
assert(find(sheet(tree), n => n.props.testID === "milk-current"));
assert(find(tree, n => n.type === moduleChart.exports.default));
assert(!button(tree, "Show more saved"));
button(tree, "View all milk").props.onPress(); tree = render(); assert(sheet(tree).props.visible); assert.equal(rows(tree).length, 10);
button(tree, "Show more saved").props.onPress(); tree = render(); assert.equal(rows(tree).length, 20);
button(tree, "Show more saved").props.onPress(); tree = render(); assert.equal(rows(tree).length, 24); assert(!button(tree, "Show more saved"));
find(tree, n => n.props.testID === "milk-search").props.onChangeText("Formula"); tree = render(); assert.equal(rows(tree).length, 10);
assert(rows(tree).every(node => node.props.period.type === "Formula"));
button(tree, "Clear milk").props.onPress(); tree = render(); assert.equal(rows(tree).length, 10);
find(tree, n => n.props.testID === "milk-range-30").props.onPress(); tree = render(); assert.equal(find(tree, n => n.props.testID === "milk-range-30").props.accessibilityState.selected, true);
rows(tree)[0].props.onOpen(rows(tree)[0].props.period); tree = render();
let detail = find(sheet(tree).props.overlays, n => n.type === "Detail"); assert.equal(detail.props.plan.title, "Formula");
detail.props.onClose(); tree = render(); assert(sheet(tree).props.visible); assert.equal(rows(tree).length, 10);
sheet(tree).props.onClose(); tree = render(); assert.equal(rows(tree).length, 5);
find(tree, n => n.props.testID === "milk-search").props.onChangeText("2026-10-15"); tree = render();
button(tree, "View all milk").props.onPress(); tree = render(); assert.equal(find(sheet(tree), n => n.props.testID === "milk-search").props.value, "2026-10-15");
button(tree, "Show more saved").props.onPress(); tree = render(); assert.equal(rows(tree).length, 20);
sheet(tree).props.onClose(); tree = render(); button(tree, "View all milk").props.onPress(); tree = render(); assert.equal(rows(tree).length, 20);
tree = render({ periods: periods.slice(0, 3) }); assert.equal(rows(tree).length, 3); assert(!button(tree, "Show more saved"));
tree = render({ periods }); button(tree, "Clear milk").props.onPress(); tree = render(); sheet(tree).props.onClose(); tree = render();
button(tree, "Add milk").props.onPress(); tree = render(); assert(find(tree, n => typeof n.type === "function" && n.type.name === "MilkPeriodEditor"));

find(tree, n => n.props.testID === "milk-type-card").props.onLayout({ nativeEvent: { layout: { width: 390 } } }); tree = render();
const metrics = find(tree, n => n.props.testID === "milk-metrics"); assert.equal(metrics.props.style[1], false);
fontScale = 1.5; tree = render(); assert.equal(find(tree, n => n.props.testID === "milk-metrics").props.style[1].flexDirection, "column"); fontScale = 1;
assert(find(tree, n => n.props.horizontal));
for (const palettes of [theme.PALETTES, theme.DARK_PALETTES]) for (const name of ["boy", "girl", "neutral"]) {
    palette = palettes[name]; tree = render();
    assert(palette.milkTypeDashboard.chartShadow); assert.equal(find(tree, n => n.props.testID === "milk-analysis").props.style.boxShadow, palette.milkTypeDashboard.chartShadow);
    assert.equal(find(tree, n => n.props.testID === "milk-metrics").props.children.length, 3);
}
palette = theme.PALETTES.boy;

// Actual stacked SVG, calendar labels, fixed axis, top-only rounding and selection.
slots.length = 0; cursor = 0;
const feedChart = imports["../../utils/milkFeedingChart"].buildMilkFeedingChart([
    { id: "b", milkType: "Breastmilk", date: today }, { id: "f", milkType: "Formula", date: today },
    { id: "m", milkType: "Mixed", date: today }, { id: "f2", milkType: "Formula", date: "2026-10-14" }
], "7", today);
let openedFeed = null;
const chartProps = { chart: feedChart, onOpenEntry: feed => openedFeed = feed };
const renderChart = changes => { cursor = 0; return moduleChart.exports.default({ ...chartProps, ...changes }); };
let chartTree = renderChart(); find(chartTree, n => n.props.testID === "milk-stacked-chart").props.onLayout({ nativeEvent: { layout: { width: 280 } } });
chartTree = renderChart(); assert(find(chartTree, n => n.props.testID === "milk-y-axis"));
assert.equal(all(chartTree).filter(n => n.props.testID?.startsWith("milk-date-")).length, 7);
const shapes = all(chartTree).filter(n => n.props.testID?.startsWith("milk-segment-"));
assert.equal(shapes.length, 4); assert.equal(shapes.filter(n => n.type === "Path").length, 2);
assert.equal(shapes.filter(n => n.type === "Rect").length, 2);
assert.equal(text(find(chartTree, n => n.props.testID === "milk-total-" + today)), "3");
assert(all(chartTree).filter(n => n.type === "Line").every(n => n.props.y1 === n.props.y2));
find(chartTree, n => n.props.testID === `milk-segment-${today}-Mixed`).props.onPress(); chartTree = renderChart();
let chartDetail = find(chartTree, n => n.type === "Detail"); assert(chartDetail.props.visible); assert(chartDetail.props.plan.title.startsWith("Mixed"));
find(chartTree, n => n.props.accessibilityLabel?.startsWith("View Mixed feeding")).props.onPress(); assert.equal(openedFeed.id, "m");
chartTree = renderChart(); assert.equal(find(chartTree, n => n.type === "Detail").props.visible, false);
find(chartTree, n => n.props.accessibilityLabel === "View milk feeding chart data and help").props.onPress(); chartTree = renderChart();
assert.equal(all(chartTree).filter(n => n.props.accessibilityLabel?.includes("feeds. Breastmilk")).length, 7);
chartTree = renderChart({ unavailable: true }); assert(find(chartTree, n => n.props.testID === "milk-y-axis")); assert(find(chartTree, n => n.props.testID === "milk-chart-empty"));
assert.equal(all(chartTree).filter(n => n.props.testID?.startsWith("milk-segment-")).length, 0);
slots.length = 0;
cursor = 0; let opened = 0;
const rowProps = { period: selectors.milkPeriodInfo(periods[0], today), onOpen: () => opened++ };
let row = UI.MilkPeriodRow(rowProps); assert.equal(all(row).filter(n => n.type === "Pressable").length, 1);
row.props.onPressIn(); cursor = 0; row = UI.MilkPeriodRow(rowProps);
assert.equal(find(row, n => n.type === "AnimatedView").props.style[1].boxShadow, palette.appointmentDashboard.pressedShadow);
row.props.onPress(); assert.equal(opened, 1);
row.props.onPressOut(); cursor = 0; row = UI.MilkPeriodRow(rowProps);
assert.equal(find(row, n => n.type === "AnimatedView").props.style[1].boxShadow, palette.milkTypeDashboard.rowShadow);
slots.length = 0;
tree = render({ periods: [] }); assert(find(tree, n => n.props.testID === "milk-empty"));
tree = render({ loadFailed: true }); assert(!find(tree, n => n.props.testID === "milk-empty")); assert(button(tree, "Retry loading"));
tree = render({ feedsUnavailable: true }); assert(text(tree).includes("Unavailable"));
const registry = fs.readFileSync(path.join(__dirname, "RecordIcon.js"), "utf8"); assert(registry.includes('milk: MilkIcon, "milk-type-periods": MilkIcon'));
console.log("Milk Type JSX checks passed: five-row previews, separate history/search/pagination, detail return, ranges, responsive metrics, stacked SVG/axes/totals/selection, add/empty/error states and canonical artwork.");
