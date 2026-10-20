// Run: node components/ui/MemoriesMilestonesCard.check.js — no server or record writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "../..");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile(fs.readFileSync(path.join(root, "theme.js"), "utf8")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
let colors = theme.PALETTES.boy, width = 326, fontScale = 1, sequence = 0;
const react = {
    createElement(type, props, ...children) {
        const next = { ...props, children: children.flat(Infinity).filter(child => child !== false && child != null) };
        return typeof type === "function" ? type(next) : { type, props: next };
    },
    useMemo: fn => fn(), useState: initial => [typeof initial === "number" ? width : initial, () => {}],
    useId: () => `memory-${sequence++}`, memo: component => component, useEffect: fn => fn(),
    useRef: value => ({ current: value }),
    isValidElement: element => Boolean(element?.type),
};
class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } stopAnimation() {} }
const native = { View: "View", Text: "Text", TextInput: "TextInput", Image: "Image", Pressable: "Pressable", TouchableOpacity: "TouchableOpacity",
    Animated: { View: "AnimatedView", Value }, Easing: { out: value => value, quad: "quad" },
    Platform: { OS: "web" }, useWindowDimensions: () => ({ fontScale }),
    StyleSheet: { create: value => value, absoluteFillObject: { position: "absolute", inset: 0 } } };
const svg = { __esModule: true, default: "Svg" };
for (const name of ["Circle", "Defs", "Ellipse", "LinearGradient", "Path", "Rect", "Stop"]) svg[name] = name;
const externals = { react: { __esModule: true, default: react, ...react }, "react-native": native,
    "react-native-svg": svg, "@expo/vector-icons": { Ionicons: "Ionicon" } };
const overrides = {
    "theme.js": theme,
    "context/ThemeContext.js": { useTheme: () => ({ colors }) },
    "components/ui/Gradient.js": { __esModule: true, default: "Gradient" },
    "components/ui/useSoftPress.js": { __esModule: true, default: () => ({ respond() {}, transform: [] }) },
    "components/ui/useReducedMotion.js": { __esModule: true, default: () => true },
    "components/ui/AnchoredMenu.js": { __esModule: true, default: "AnchoredMenu", AnchoredMenuItem: "AnchoredMenuItem" },
    "components/ui/Skeleton.js": { SkeletonBlock: "SkeletonBlock" },
};
const modules = new Map();
function load(relative) {
    const file = path.resolve(root, relative), key = path.relative(root, file).replaceAll("\\", "/");
    if (overrides[key]) return overrides[key];
    if (/\.png$/.test(file)) return key;
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    new Function("require", "module", "exports", "__DEV__", compile(fs.readFileSync(file, "utf8")))(name => {
        if (externals[name]) return externals[name];
        assert(name.startsWith("."), name);
        const target = path.resolve(path.dirname(file), name);
        return load(path.extname(target) ? target : target + ".js");
    }, module, module.exports, false);
    return module.exports;
}
const { default: Card, MemoryGalleryGrid } = load("components/ui/MemoriesMilestonesCard.js");
const { MemoryVisualCard } = load("components/common/Cards.js");
const { default: MemoryDateRow } = load("components/ui/MemoryDateRow.js");
const { recordIconRegistry } = load("components/ui/RecordIcon.js");
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(nodes)] : [];
const text = tree => tree && typeof tree === "object" ? (tree.props.children || []).map(text).join("") : String(tree ?? "");
const merge = styles => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));
const records = Object.freeze([
    Object.freeze({ id: "bike", title: "First Bike Ride", description: "Practiced pedaling with Papa.", date: "2029-02-28", photoUrl: "unchanged-bike.jpg" }),
    Object.freeze({ id: "helper", title: "Christmas Helper", description: "She decorated the lowest branches herself.", date: "2028-09-13", photoUrl: "unchanged-clouds.jpg" }),
    Object.freeze({ id: "birthday", title: "First Birthday", description: "A small garden celebration with family.", date: "2026-11-17", photoUrl: "unchanged-sunset.jpg" }),
    Object.freeze({ id: "home", title: "Welcome Home, Sofia", description: "Our first weekend together.", date: "2025-11-18", photoUrl: "unchanged-coast.jpg" }),
]);
const before = JSON.stringify(records);
for (const palette of [theme.PALETTES.boy, theme.PALETTES.girl, theme.PALETTES.neutral,
    theme.DARK_PALETTES.boy, theme.DARK_PALETTES.girl, theme.DARK_PALETTES.neutral]) {
    colors = palette;
    for (const [available, scale, columns] of [[256, 1, 2], [326, 1, 2], [366, 1, 2], [210, 1, 1], [256, 1.5, 1]]) {
        width = available; fontScale = scale;
        let opened = null, viewed = 0;
        const tree = Card({ records, onOpenMemory: record => opened = record, onViewAll: () => viewed++ });
        const buttons = nodes(tree).filter(node => node.type === "Pressable");
        buttons.find(node => node.props.accessibilityLabel === "See all memories and milestones").props.onPress();
        assert.equal(viewed, 1);
        const cards = buttons.filter(node => node.props.accessibilityLabel?.startsWith("View "));
        assert.equal(cards.length, 4);
        cards.forEach((node, index) => { node.props.onPress(); assert.equal(opened, records[index]); });
        const itemWrappers = nodes(tree).filter(node => node.type === "AnimatedView" && merge(node.props.style).flex === 1);
        assert.equal(itemWrappers.length, 4);
        for (const item of itemWrappers) {
            const style = merge(item.props.style);
            assert.equal(style.flex, 1);
            assert.equal(style.minWidth, 0);
            assert.equal(style.overflow, "visible");
        }
        const rows = nodes(tree).filter(node => node.type === "View" && node.props.style?.flexDirection === "row" && node.props.style.gap === 12);
        assert.equal(rows.length, Math.ceil(records.length / columns));
        for (const row of rows) assert.equal(row.props.children.length, columns);
        assert.deepEqual(nodes(tree).filter(node => node.type === "Image" && node.props.source?.uri)
            .map(node => node.props.source.uri), records.map(record => record.photoUrl));
        assert.equal(nodes(tree).filter(node => node.type === "Image" && String(node.props.source).endsWith("calendar-blue.png")).length, 4);
        for (const expected of ["Memories & Milestones", "February 28 2029", "September 13 2028", "November 17 2026", "November 18 2025"])
            assert(text(tree).includes(expected), expected);
        assert.equal(cards[0].props.accessibilityRole, "button");
    }
    const milestone = MemoryVisualCard({ ...records[0], kind: "milestone" });
    assert(text(milestone).includes("Milestone"));
    assert.equal(nodes(milestone).filter(node => node.type === "Ionicon" && node.props.name === "image-outline").length, 0);
    const ordinary = MemoryVisualCard({ title: "Without photo" });
    assert.equal(nodes(ordinary).filter(node => node.type === "Ionicon" && node.props.name === "image-outline").length, 1);
    assert(!text(ordinary).includes("Milestone"));
    assert.equal(MemoryDateRow({ date: "" }), null);
    assert(text(MemoryDateRow({ date: "invalid" })).includes("Date unavailable"));
    assert(text(Card({ records: [], onOpenMemory() {}, onViewAll() {} })).includes("No memories yet."));
    assert.deepEqual(palette.milestoneIcon.fabric, ["#FDE68A", "#FACC15", "#EAB308"]);
}
assert.equal(JSON.stringify(records), before, "Presentation never alters stored data or ordering");
assert.equal(recordIconRegistry.milestone, recordIconRegistry.milestones);
assert.notEqual(recordIconRegistry.milestone, recordIconRegistry.milk);
const home = fs.readFileSync(path.join(root, "components/Dashboard.js"), "utf8");
const growth = fs.readFileSync(path.join(root, "components/Growth.js"), "utf8");
assert(home.includes('records={memories.slice(0, 4)}') && home.includes('nav("growth", "gallery")'));
assert(growth.includes('result={galleryResult}') && growth.includes('visible: current.visible + 10'));
assert(!growth.includes('MemoryGalleryGrid'), "Home's two-column preview is separate from the full-width collection");
assert(!growth.includes('badge={item.kind') && !growth.includes('shortDate(item.date).replace'));
console.log("Memory gallery checks passed: six themes, responsive columns/large text, raw dates/calendar rows, original images/order, exact callbacks, empty/missing states and milestone identity.");

const Collection = load("components/ui/MemoriesMilestonesCollection.js").default;
const { memoryGalleryView, GALLERY_DEFAULTS } = load("utils/memoryGallery.js");
const collectionRecords = records.map((record, index) => Object.freeze({ ...record, kind: index < 2 ? "memory" : "milestone" }));
for (const palette of [theme.PALETTES.boy, theme.PALETTES.girl, theme.PALETTES.neutral,
    theme.DARK_PALETTES.boy, theme.DARK_PALETTES.girl, theme.DARK_PALETTES.neutral]) {
    colors = palette;
    for (const [available, scale] of [[288, 1], [358, 1], [398, 1], [288, 1.5]]) {
        width = available; fontScale = scale;
        let state = { ...GALLERY_DEFAULTS }, opened = null, more = 0;
        const draw = (items = collectionRecords, loading = false) => Collection({ view: state, result: memoryGalleryView(items, state), loading,
            onChangeView: patch => state = { ...state, ...patch, visible: 10 }, onShowMore: () => more++, onOpenRecord: record => opened = record });
        let tree = draw();
        assert(text(tree).includes("Memories & Milestones"));
        assert(!nodes(tree).some(node => node.props.accessibilityLabel?.startsWith("Add ")));
        const buttons = nodes(tree).filter(node => node.type === "Pressable");
        const rows = buttons.filter(node => node.props.accessibilityLabel?.startsWith("View "));
        assert.equal(rows.length, 4);
        for (const row of rows) {
            assert.equal(merge(row.props.style).width, "100%");
            assert.equal(merge(row.props.style).flexDirection, "row");
            row.props.onPress();
            assert(collectionRecords.includes(opened));
            assert.equal(nodes(row).filter(node => node.type === "Pressable").length, 1, "Chevron never adds a duplicate handler");
        }
        assert.deepEqual(buttons.filter(node => node.props.accessibilityState?.selected !== undefined)
            .map(node => node.props.accessibilityLabel), ["All, 4 total records", "Milestones, 2 total records", "Memories, 2 total records"]);
        const menu = nodes(tree).find(node => node.type === "AnchoredMenu");
        assert.equal(menu.props.dimBackdrop, false);
        assert.equal(menu.props.appearance, "glass");
        nodes(tree).find(node => node.type === "TextInput").props.onChangeText("pedaling");
        assert.equal(state.visible, 10);
        tree = draw();
        assert.equal(nodes(tree).filter(node => node.props.accessibilityLabel?.startsWith("View ")).length, 1);
        nodes(tree).find(node => node.props.accessibilityLabel === "Milestones, 2 total records").props.onPress();
        tree = draw();
        assert(text(tree).includes("No matching memories or milestones found."));
        nodes(tree).find(node => node.props.accessibilityLabel === "Clear memories search").props.onPress();
        tree = draw();
        assert.equal(nodes(tree).filter(node => node.props.accessibilityLabel?.startsWith("View ")).length, 2);
        nodes(tree).find(node => node.type === "AnchoredMenuItem" && node.props.label === "Oldest first").props.onPress();
        tree = draw();
        assert.equal(nodes(tree).find(node => node.props.accessibilityLabel?.startsWith("View ")).props.accessibilityLabel, "View Welcome Home, Sofia");
        state = { ...GALLERY_DEFAULTS, visible: 2 };
        tree = draw();
        nodes(tree).find(node => node.props.accessibilityLabel === "Show more memories and milestones, 2 remaining").props.onPress();
        assert.equal(more, 1);
        state.visible = 10;
        tree = draw();
        assert(!nodes(tree).some(node => node.props.accessibilityLabel?.startsWith("Show more memories")));
        assert(text(draw([])).includes("No memories or milestones recorded yet."));
        assert(nodes(draw([], true)).some(node => node.props.accessibilityLabel === "Loading memories and milestones"));
        state={...GALLERY_DEFAULTS};tree=draw();
        nodes(tree).find(node=>node.type==="AnchoredMenuItem"&&node.props.label==="Movement & Physical").props.onPress();
        assert.equal(state.developmentCategory,"motor");assert.equal(state.visible,10);
        assert(text(draw()).includes("No matching memories or milestones found."));
        nodes(tree).find(node=>node.type==="AnchoredMenuItem"&&node.props.label==="Not categorized").props.onPress();
        assert.equal(state.developmentCategory,"uncategorized");
    }
}
assert(growth.includes('setGalleryView({ ...GALLERY_DEFAULTS }); }, [profile.id]'));
assert(growth.includes('onOpenRecord={memory => setDetailMemory({ ...memory, childId: profile.id })}') && growth.includes('blurTarget={blurTarget}'));
assert(growth.includes('key={`gallery-${profile.id}`}'), "Collection reset key cannot collide with the date modal's profile key");
console.log("Chronological collection passed: full-width horizontal rows, exact record callbacks, search/category/sort contracts, backdrop-free glass menu, remaining counts, loading/empty states and six responsive palettes.");
