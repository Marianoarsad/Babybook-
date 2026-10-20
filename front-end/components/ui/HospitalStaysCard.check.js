// Run: node components/ui/HospitalStaysCard.check.js — no backend or record writes.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const read = file => fs.readFileSync(path.join(__dirname, file), "utf8");
const themeModule = { exports: {} }; new Function("module", "exports", compile(read("../../theme.js")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(nodes)] : [];
const find = (tree, fn) => nodes(tree).find(fn);
const text = tree => tree && typeof tree === "object" ? (tree.props.children || []).map(text).join("") : String(tree ?? "");
const merge = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
function harness(file = "HospitalStaysCard.js") {
    const slots = []; let cursor = 0, serial = 0, colors = theme.PALETTES.boy, fontScale = 1;
    const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }), memo: fn => fn,
        useMemo: fn => fn(), useId: () => "hospital-test-" + serial++, useState(initial) {
            const i = cursor++; if (!(i in slots)) slots[i] = initial;
            return [slots[i], next => slots[i] = typeof next === "function" ? next(slots[i]) : next];
        } };
    const imports = { "./AllRecordsIcon": { __esModule: true, default: "AllRecordsIcon" }, "./ImmunizationStatusIcon": { __esModule: true, default: "ImmunizationStatusIcon" }, react: { __esModule: true, default: react, ...react }, "react-native": {
        View: "View", Pressable: "Pressable", Text: "Text", Image: "Image", Platform: { OS: "web" }, Animated: { View: "AnimatedView" },
        StyleSheet: { create: value => value, absoluteFillObject: { position: "absolute", inset: 0 } }, useWindowDimensions: () => ({ fontScale }) },
        "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Defs: "Defs", Ellipse: "Ellipse", LinearGradient: "LinearGradient", RadialGradient: "RadialGradient", Path: "Path", Rect: "Rect", Stop: "Stop" },
        "@expo/vector-icons": { Ionicons: "Icon" }, "../../context/ThemeContext": { useTheme: () => ({ colors }) }, "../../theme": theme,
        "./ConsultationsAppointmentsCard": { DashboardSurface: "Surface", DashboardControl: "Control", DashboardListTransition: "ListTransition", AppointmentStatusIcon: "StatusIcon" },
        "./AnimatedReveal": { __esModule: true, default: "AnimatedReveal" }, "./Skeleton": { AppointmentsSkeleton: "Skeleton", SkeletonBlock: "SkeletonBlock" },
        "./HospitalBuildingIcon": { __esModule: true, default: "Building" }, "./HospitalStayIcon": { __esModule: true, default: "HospitalStayIcon" },
        "./useSoftPress": { __esModule: true, default: () => ({ respond() {}, transform: [] }) } };
    const module = { exports: {} };
    new Function("require", "module", "exports", compile(read(file)))(name => { assert(name in imports, name); return imports[name]; }, module, module.exports);
    return { api: module.exports, palette(value) { colors = value; }, scale(value) { fontScale = value; }, draw(fn, props) { cursor = 0; return fn(props); } };
}
const h = harness(), calls = [];
const stays = ["current", "past", "other"].flatMap((stayStatus, group) => Array.from({ length: [24, 23, 1][group] }, (_, i) => ({ id: `${stayStatus}-${i}`, stayStatus,
    title: "Recorded condition", facility: "Recorded hospital", statusLabel: stayStatus === "past" ? "Discharged" : "Ongoing", dateLabel: "Recorded dates", durationLabel: "3 days" })));
let props = { summary: { stays, counts: { all: 48, current: 24, past: 23 }, totalDays: 69, excludedStays: 0 }, onAdd: () => calls.push("add"), onOpen: stay => calls.push(stay) };
const draw = changes => h.draw(h.api.default, props = { ...props, ...changes });
const metrics = tree => find(tree, n => n.type === h.api.HospitalStayMetrics);
const items = tree => nodes(tree).filter(n => n.type === h.api.HospitalStayItem);
const more = tree => find(tree, n => n.props.accessibilityLabel?.startsWith("Show more"));
let tree = draw(); assert.equal(metrics(tree).props.filter, "all"); assert.equal(items(tree).length, 10); assert(more(tree).props.accessibilityLabel.includes("38 remaining"));
for (const filter of ["current", "past", "all"]) {
    metrics(tree).props.onSelect(filter); tree = draw(); assert.equal(items(tree).length, 10);
    assert(items(tree).every(n => filter === "all" || n.props.stay.stayStatus === filter));
    more(tree).props.onPress(); tree = draw(); assert.equal(items(tree).length, 20);
    assert.equal(new Set(items(tree).map(n => n.props.stay.id)).size, 20);
    assert(more(tree).props.accessibilityLabel.includes(`${props.summary.counts[filter] - 20} remaining`));
}
metrics(tree).props.onSelect("past"); tree = draw(); more(tree).props.onPress(); tree = draw(); more(tree).props.onPress(); tree = draw();
assert.equal(items(tree).length, 23); assert(!more(tree));
for (const [filter, message] of [["all", "No hospital stays recorded yet"], ["current", "No ongoing hospital stays."], ["past", "No past hospital stays recorded."]]) {
    metrics(tree).props.onSelect(filter); tree = draw({ summary: { stays: [], counts: { all: 0, current: 0, past: 0 }, totalDays: 0, excludedStays: 0 } });
    assert(text(tree).includes(message)); assert.equal(items(tree).length, 0); assert(!more(tree)); assert(find(tree, n => n.props.testID === "hospital-empty"));
}
tree = draw({ summary: props.summary, loading: true }); assert(!metrics(tree)); assert(find(tree, n => n.props.accessibilityRole === "progressbar"));
tree = draw({ loading: false, loadFailed: true, onRetry: () => calls.push("retry") }); assert(!metrics(tree));
find(tree, n => n.props.accessibilityLabel === "Retry loading hospital stays").props.onPress(); assert.equal(calls.at(-1), "retry");
find(tree, n => n.props.accessibilityLabel === "Log a hospital stay").props.onPress(); assert.equal(calls.at(-1), "add");
tree = draw({ loadFailed: false, summary: { ...props.summary, stays: [stays[0]], counts: { all: 1, current: 1, past: 0 } } });
metrics(tree).props.onSelect("all"); tree = draw(); assert.equal(items(tree).length, 1); assert(!find(tree, n => n.props.testID === "hospital-empty"));
assert.equal(find(tree, n => n.type === "ListTransition").props.testID, "hospital-list-transition");
const luminance = hex => hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (const colors of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    for (const background of [...colors.appointmentDashboard.row, ...colors.feedingBreakdown.entries]) assert(contrast(colors.appointmentDashboard.secondary, background) >= 4.5);
    const m = harness(); m.palette(colors);
    let metricProps = { summary: { counts: { all: 3, current: 1, past: 2 }, totalDays: 12, excludedStays: 0 }, filter: "current", onSelect: key => calls.push(key) };
    for (const [width, scale, rows] of [[240, 1, 2], [311, 1, 2], [700, 1, 1], [311, 1.6, 4]]) {
        m.scale(scale); let mt = m.draw(m.api.HospitalStayMetrics, metricProps); mt.props.onLayout({ nativeEvent: { layout: { width } } }); mt = m.draw(m.api.HospitalStayMetrics, metricProps);
        assert.equal(mt.props.children.filter(Boolean).length, rows);
        assert.equal(nodes(mt).filter(n => n.type === "Control").length, 3, "Only All/Current/Past are filter buttons");
        const total = find(mt, n => n.props.testID === "hospital-total-days"); assert(!total.props.onPress && !total.props.accessibilityRole);
        assert(text(total).includes("Discharged stays only"));
        for (const button of nodes(mt).filter(n => n.type === "Control")) {
            const key = button.props.testID.replace("hospital-filter-", ""); assert.equal(button.props.accessibilityState.selected, key === "current");
            assert(merge(button.props.style).minHeight >= 44); button.props.onPress(); assert.equal(calls.at(-1), key);
        }
    }
    let mt = m.draw(m.api.HospitalStayMetrics, { ...metricProps, summary: { ...metricProps.summary, totalDays: null, excludedStays: 2 } });
    assert(text(mt).includes("Not recorded")); assert(text(mt).includes("Total Days excludes 2 discharged stays"));
    const r = harness(); r.palette(colors);
    for (const stayStatus of ["current", "past"]) {
        const stay = { ...stays[0], stayStatus }; let photo;
        const row = r.draw(r.api.HospitalStayItem, { stay, onOpen: value => calls.push(value), thumbnailUrl: "saved-photo.jpg", onOpenAttachment: value => photo = value });
        const icon = find(row, n => n.type === "HospitalStayIcon"); assert.deepEqual(Object.keys(icon.props).filter(key => key !== "children"), ["size"]);
        const buttons = nodes(row).filter(n => n.type === "Pressable"); assert.equal(buttons.length, 2);
        assert(!nodes(buttons[0]).some(n => n !== buttons[0] && n.type === "Pressable"));
        buttons[0].props.onPress(); assert.equal(calls.at(-1), stay); buttons[1].props.onPress(); assert.equal(photo, stay);
        assert.equal(merge(row.props.style).overflow, "visible");
    }
    const art = harness("HospitalStayIcon.js"); art.palette(colors);
    for (const size of [24, 40, 56]) {
        const icon = art.draw(art.api.default, { size }); assert.equal(icon.props.style.width, size); assert.equal(icon.props.style.height, size);
        const stops = nodes(icon).filter(n => n.type === "Stop").map(n => n.props.stopColor);
        for (const color of ["#FB7185", "#F43F5E", "#E11D48"]) assert(stops.includes(color), "Record art remains red across all themes");
        const bare = art.draw(art.api.default, { size, showBackground: false }); assert.equal(nodes(bare).filter(n => n.type === "Circle").length, 1, "Only the resting person's head remains without a background");
        assert.equal(find(icon, n => n.type === "Svg").props.viewBox, "0 0 100 100");
    }
    const building = harness("HospitalBuildingIcon.js"); building.palette(colors);
    const emptyArt = building.draw(building.api.default, { empty: true, size: 150 });
    assert(nodes(emptyArt).filter(n => n.type === "Stop").some(n => n.props.stopColor === colors.hospitalStayIcon.emptyBuilding[1]));
}
for (const file of ["../Health.js", "../CalendarView.js", "../ProfessionalView.js", "../Search.js", "ActionSheet.js", "NeedsAttentionCard.js"]) {
    assert(read(file).includes("<HospitalStayIcon"), `${file} renders the canonical artwork`);
}
assert(read("../Dashboard.js").includes('recordType: "hospitalization"'));
assert.equal((read("ActionSheet.js").match(/<HospitalStayIcon/g) || []).length, 2, "Both action-sheet placements share the same icon");
assert(!/\bsetHospitalizations\b/.test(read("../Health.js")));
assert(read("../Health.js").includes('key={`hospital-${profile.id}`} summary={hospitalSummary}'));
console.log("Hospital card checks passed: filters/pagination/empty/loading states, responsive metrics, informational totals, photos/navigation, canonical red artwork and six palettes.");
