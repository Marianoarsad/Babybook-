// Run: node components/ui/NeedsAttentionCard.check.js. All record actions use in-memory fixtures.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { transformSync } = require("@babel/core"), { parse } = require("@babel/parser");
const read = file => fs.readFileSync(path.join(__dirname, file), "utf8");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs"), require.resolve("@babel/plugin-transform-react-jsx")] }).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile(read("../../theme.js")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
let colors = theme.PALETTES.boy, owner, fontScale = 1, serial = 0;
const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(v => v != null && v !== false) }),
    useMemo: fn => fn(), useId: () => { const i = owner.cursor++; return (owner.slots[i] ??= { id: "attention-" + ++serial }).id; },
    useState: initial => { const o = owner, i = o.cursor++; o.slots[i] ??= { value: initial }; return [o.slots[i].value,
        next => { o.slots[i].value = typeof next === "function" ? next(o.slots[i].value) : next; }]; } };
const native = { View: "View", Text: "Text", Image: "Image", Pressable: "Pressable", Platform: { OS: "web" }, Animated: { View: "AnimatedView" },
    StyleSheet: { create: s => s, absoluteFillObject: { position: "absolute", inset: 0 } }, useWindowDimensions: () => ({ width: 390, fontScale }) };
function load(file, extra = "") {
    const m = { exports: {} };
    new Function("require", "module", "exports", compile(read(file) + extra))(name => {
        if (name === "react") return react;
        if (name === "react-native") return native;
        if (name === "@expo/vector-icons") return { Ionicons: "Icon" };
        if (name === "react-native-svg") return { __esModule: true, default: "Svg", Defs: "Defs", LinearGradient: "LinearGradient", Rect: "Rect", Stop: "Stop" };
        if (name.endsWith("ThemeContext")) return { useTheme: () => ({ colors }) };
        if (name.endsWith("theme")) return theme;
        if (name.endsWith(".png")) return name;
        if (name === "./useSoftPress") return { __esModule: true, default: () => ({ respond() {}, transform: [] }) };
        return { __esModule: true, default: name.slice(2) };
    }, m, m.exports);
    return m.exports;
}
const { default: Card, Control, FoldSymbol } = load("NeedsAttentionCard.js", "\nexport { Control, FoldSymbol };");
const Vaccine = load("VaccineIcon.js").default;
function renderer(fn) { const state = { slots: [], cursor: 0 }; return props => { owner = state; state.cursor = 0; return fn(props); }; }
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.children || []).flatMap(nodes)] : [];
const text = tree => typeof tree !== "object" ? String(tree ?? "") : (tree.children || []).map(text).join(" ");
const find = (tree, id) => nodes(tree).find(n => n.props.testID === id);
const style = n => Object.assign({}, ...[n.props.style].flat());
const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
const composite = (rgba, base) => {
    const [r, g, b, alpha] = rgba.match(/[\d.]+/g).map(Number);
    return "#" + [r, g, b].map((v, i) => Math.round(v * alpha + parseInt(base.slice(1 + i * 2, 3 + i * 2), 16) * (1 - alpha)).toString(16).padStart(2, "0")).join("");
};
const vaccine = { key: "ovax-1", tab: "immunizations", title: "BCG", sub: "11 months overdue", tone: "#BE123C" };
const mixed = [
    { key: "hosp-1", recordType: "hospitalization", tab: "appointments", title: "Hospitalized: recorded stay", sub: "Not yet resolved", dateText: "Since recorded date", tint: { bg: "#FFEAF0", on: "#BE123C" }, tone: "#BE123C" },
    { key: "ill-1", tab: "illnesses", title: "Recorded illness", sub: "Ongoing", icon: "thermometer", tint: { bg: "#FFF4DD", on: "#9B6412" }, tone: "#9B6412" },
    vaccine, { ...vaccine, key: "ovax-2" },
];
const unchanged = JSON.stringify(mixed);
for (colors of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    let toggles = 0, opened, seen = 0;
    const props = { items: mixed, collapsed: false, onToggle: () => toggles++, onOpenItem: item => { opened = item; }, onSeeAll: () => seen++ };
    for (const width of [176, 225, 299, 700]) for (fontScale of [1, 1.6, 2]) {
        const draw = renderer(Card); let tree = draw(props);
        nodes(find(tree, "attention-header")).find(n => n.props.onLayout).props.onLayout({ nativeEvent: { layout: { width } } });
        tree = draw(props);
        assert.equal(style(find(tree, "attention-heading")).flex === 0, width - 100 < 112 * fontScale);
        assert.equal(nodes(tree).filter(n => n.props.testID === "attention-heading").length, 1);
        assert.equal(style(tree).overflow, "visible"); assert.equal(style(tree).borderWidth, undefined);
        const header = find(tree, "attention-header"), background = find(tree, "attention-background"), tint = find(tree, "attention-top-tint");
        assert.equal(style(header).backgroundColor, undefined); assert.equal(style(header).boxShadow, undefined); assert.equal(style(header).borderRadius, undefined);
        assert(header.children.every(n => n.type !== "Surface" && n.type !== "Gradient"), "Header has no separate surface");
        assert.equal(tree.children[0], background); assert.equal(style(background).overflow, "hidden"); assert.equal(style(background).borderRadius, style(tree).borderRadius);
        assert.equal(background.props.pointerEvents, "none"); assert(background.children.includes(tint));
        assert.deepEqual(tint.props.start, { x: 0.5, y: 0 }); assert.deepEqual(tint.props.end, { x: 0.5, y: 1 });
        assert.deepEqual(tint.props.locations, [0, 0.45, 1]); assert.equal(style(tint).left, 0); assert.equal(style(tint).right, 0); assert.equal(style(tint).top, 0);
        assert(style(tint).height <= style(tree).padding + style(header).padding * 2 + 44 + 14, "Tint fades before the first row");
        const rows = nodes(tree).filter(n => n.props.testID?.startsWith("attention-item-"));
        assert.deepEqual(rows.map(n => n.props.testID), mixed.slice(0, 3).map(i => "attention-item-" + i.key));
        assert(rows.every(n => style(n).minHeight >= 72)); assert.equal(nodes(tree).filter(n => n.type === "VaccineIcon").length, 1);
        assert(rows.every(n => n.props.disabled === false));
        const chevron = rows[0].children.at(-1);
        assert.equal(style(chevron).width, 36); assert.equal(style(chevron).height, 36); assert.equal(style(chevron).borderRadius, 18);
        assert.equal(chevron.props.pointerEvents, "none"); assert.equal(chevron.children.at(-1).props.size, 22);
        assert.equal(nodes(tree).filter(n => n.type === "HospitalStayIcon").length, 1);
        assert(nodes(tree).some(n => n.type === "Icon" && n.props.name === "thermometer"));
        assert.equal(text(find(tree, "attention-count")), "4"); assert(/See all\s+4/.test(text(find(tree, "attention-see-all"))));
        assert(nodes(tree).filter(n => n.type === "Text").every(n => n.props.numberOfLines === undefined));
        const reveal = nodes(tree).find(n => n.type === "AnimatedReveal"); assert.equal(reveal.props.duration, 260); assert.equal(reveal.props.expanded, true);
    }
    fontScale = 1; const draw = renderer(Card); let tree = draw(props);
    find(tree, "attention-toggle").props.onPress(); assert.equal(toggles, 1);
    find(tree, "attention-item-ovax-1").props.onPress(); assert.equal(opened, vaccine);
    find(tree, "attention-see-all").props.onPress(); assert.equal(seen, 1);
    tree = draw({ ...props, collapsed: true });
    assert.deepEqual(find(tree, "attention-top-tint").props.colors, colors.attentionSurface.topTint, "Same parent tint when collapsed");
    assert.equal(find(tree, "attention-toggle").props["aria-expanded"], false);
    assert.equal(find(tree, "attention-records").props["aria-hidden"], true);
    assert(nodes(tree).filter(n => n.props.testID?.startsWith("attention-item-") || n.props.testID === "attention-see-all").every(n => n.props.disabled === true));
    assert.equal(find(tree, "attention-records").props.nativeID, find(tree, "attention-toggle").props["aria-controls"]);
    for (const count of [1, 3, 1000]) {
        tree = draw({ ...props, items: Array.from({ length: count }, (_, i) => ({ ...vaccine, key: "v" + i })) });
        assert.equal(text(find(tree, "attention-count")), String(count));
        assert.equal(nodes(tree).filter(n => n.props.testID?.startsWith("attention-item-")).length, Math.min(count, 3));
        assert.equal(Boolean(find(tree, "attention-see-all")), count > 3);
    }
    assert.equal(draw({ ...props, items: [] }), null);
    for (const bg of colors.attentionSurface.row) for (const ink of ["text", "overdue"]) assert(contrast(colors.attentionSurface[ink], bg) >= 4.5);
    for (const bg of colors.attentionSurface.panel) for (const tint of colors.attentionSurface.topTint)
        assert(contrast(colors.attentionSurface.title, composite(tint, bg)) >= 4.5, "Heading contrast over the ambient tint");
    for (const bg of colors.attentionSurface.count) assert(contrast(colors.attentionSurface.onCount, bg) >= 4.5, "White count contrast");
    for (const size of [24, 36, 40, 44, 48]) for (const showBackground of [false, true]) {
        const icon = renderer(Vaccine)({ size, showBackground });
        assert.equal(style(icon).width, size); assert.equal(style(icon).height, size); assert.equal(style(icon).borderRadius, size / 2);
        assert.equal(nodes(icon).filter(n => n.type === "Gradient").length, showBackground ? 1 : 0);
        const image = nodes(icon).find(n => n.type === "Image"); assert.equal(image.props.source, "../../assets/vaccine/syringe.png");
        assert.equal(image.props.resizeMode, "contain"); assert.equal(style(image).width, style(image).height);
    }
    const button = renderer(Control); let control = button({ kind: "control", radius: 22 });
    assert(style(control).minHeight >= 44); control.props.onFocus({ currentTarget: { matches: () => true } });
    control = button({ kind: "control" }); assert.equal(style(control).outlineStyle, "solid");
    control.props.onBlur(); control = button({ kind: "control" }); assert.equal(style(control).outlineStyle, "none");
    for (const collapsed of [true, false]) {
        const symbol = renderer(FoldSymbol)({ collapsed });
        assert.equal(style(symbol).position, "relative"); assert.equal(style(symbol).zIndex, 1, "SVG stays above the positioned control surface");
        assert.equal(nodes(symbol).filter(n => n.type === "Rect").length, collapsed ? 3 : 2);
    }
}
assert.equal(JSON.stringify(mixed), unchanged);

// Vaccine navigation, completion and thumbnail interactions are exercised in ImmunizationRecordsCard.check.js.
for (const file of ["../Dashboard.js", "../Health.js", "../AllActivity.js", "../Search.js", "../Notifications.js", "../CalendarView.js", "ViewerImmunizationStatusCard.js", "ActionSheet.js"])
    assert(read(file).includes("<VaccineIcon"), `Shared vaccine icon: ${file}`);
for (const file of ["../../assets/vaccine/syringe.png", "../../assets/attention/warning.png"]) {
    const png = fs.readFileSync(path.join(__dirname, file)); assert.equal(png.subarray(1, 4).toString(), "PNG"); assert.equal(png[25], 6);
}
console.log("Attention checks passed: mixed alerts, controlled fold, three-item preview, six palettes, canonical alpha artwork, accessible controls and canonical vaccine consumers.");
