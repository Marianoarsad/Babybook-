// node components/ui/VaccinationProgressCard.check.js — actual JSX and six palettes; no backend.
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
const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }), useMemo: fn => fn() };
let colors;
const imports = { react: { __esModule: true, default: react, ...react }, "react-native": { Image: "Image", Text: "Text", View: "View", StyleSheet: { create: value => value, absoluteFillObject: { position: "absolute" } } },
    "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle" }, "@expo/vector-icons": { Ionicons: "Icon" },
    "../../context/ThemeContext": { useTheme: () => ({ colors }) }, "../../theme": theme,
    "../../utils/dates": { fullMonthDate: value => value === "2027-05-14" ? "May 14 2027" : "" },
    "./ConsultationsAppointmentsCard": { DashboardSurface: "Surface", DashboardControl: "Control" },
    "./Skeleton": { SkeletonBlock: "Skeleton" }, "./Gradient": { __esModule: true, default: "Gradient" }, "./VaccineIcon": { __esModule: true, default: "VaccineIcon" } };
const moduleUnderTest = { exports: {} };
new Function("require", "module", "exports", compile(read("VaccinationProgressCard.js")))(name => imports[name] || name, moduleUnderTest, moduleUnderTest.exports);
const draw = props => moduleUnderTest.exports.default(props);
for (colors of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    for (const [completed, total, expected] of [[0, 0, null], [0, 15, null], [14, 15, `${14 / 15 * 100}%`], [15, 15, "100%"]]) {
        const tree = draw({ completed, total }); const fill = find(tree, n => n.type === "Gradient");
        assert.equal(fill?.props.style[1].width ?? null, expected); assert(text(tree).includes(`${completed} of ${total} doses`));
        assert.deepEqual(find(tree, n => n.type === "Surface").props.colors, colors.vaccinationProgress.panel);
        assert.equal(find(tree, n => n.type === "VaccineIcon").props.size, 36);
        assert.equal(find(tree, n => n.props.accessibilityRole === "progressbar").props.accessibilityValue.now, completed);
        assert.equal(find(tree, n => n.type === "Control"), undefined);
    }
    for (const [props, copy] of [[{}, "No vaccinations scheduled yet."], [{ total: 2 }, "No upcoming vaccinations scheduled."], [{ total: 2, completed: 2 }, "All scheduled doses completed."], [{ error: true }, "Vaccinations could not be loaded."]]) assert(text(draw(props)).includes(copy));
    assert(find(draw({ loading: true }), n => n.type === "Skeleton"));
    let selected;
    const dose = { id: "dose-42", status: "scheduled", vaccine_name: "Saved booster", visit_name: "Saved visit", due_date: "2027-05-14" };
    const tree = draw({ total: 15, completed: 14, nextVaccine: dose, onOpen: row => selected = row });
    const control = find(tree, n => n.type === "Control"); control.props.onPress(); assert.equal(selected, dose);
    assert(text(tree).includes("Saved booster")); assert(text(tree).includes("Saved visit")); assert(text(tree).includes("May 14 2027"));
    assert.equal(nodes(tree).filter(n => n.type === "Circle").length, 1, "Unknown series has a neutral ring without a fabricated arc");
    assert.equal(find(tree, n => n.type === "Circle").props.strokeDasharray, undefined);
    assert.equal(control.props.disabled, false); assert(find(draw({ nextVaccine: { ...dose, id: "tmp-create" } }), n => n.type === "Control").props.disabled);
    assert(!text(tree).includes("93%"));
}
const dashboard = read("../Dashboard.js"), health = read("../Health.js");
assert(dashboard.includes('intent: "focus", sourceType: "vaccination", recordId: String(dose.id), childId: String(profile.id)'));
assert(health.indexOf('initialRecord?.intent === "focus"') < health.indexOf('const raw = initialRecord?.record'), "Focus cannot fall through to editing");
assert(health.includes('scrollRef={healthScrollRef} onContentSizeChange={vaccineFocus.onContentSizeChange}'));
console.log("Vaccination progress checks passed: six palettes, real counts, empty/error/loading states, neutral denominator fallback, actual metadata and exact navigation payload.");
