// Run: node components/dateLayout.check.js — no server or native runtime.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("@babel/parser");
const { transformSync } = require("@babel/core");
const compile = (source) => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile(fs.readFileSync(path.join(__dirname, "../theme.js"), "utf8")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
let colors;
const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useMemo: (fn) => fn(), useState: () => [0, () => {}] };
const imports = { react: { __esModule: true, default: react, ...react },
    "react-native": { Animated: { View: "AnimatedView" }, Platform: { OS: "web" }, Pressable: "Pressable", View: "View", Text: "Text", Image: "Image", TouchableOpacity: "TouchableOpacity", StyleSheet: { create: (value) => value } },
    "../ui/Gradient": { __esModule: true, default: "Gradient" },
    "../ui/RecordIcon": { __esModule: true, default: "RecordIcon" },
    "../ui/MemoryDateRow": { __esModule: true, default: "MemoryDateRow" },
    "../ui/useSoftPress": { __esModule: true, default: () => ({ respond() {}, transform: [] }) },
    "@expo/vector-icons": { Ionicons: "Icon" }, "../../theme": theme,
    "../../context/ThemeContext": { useTheme: () => ({ colors }) } };
const cards = { exports: {} };
new Function("require", "module", "exports", "__DEV__", compile(fs.readFileSync(path.join(__dirname, "common/Cards.js"), "utf8")))(
    (name) => { assert(name in imports, name); return imports[name]; }, cards, cards.exports, false);
const nodes = (tree) => !tree || typeof tree !== "object" ? [] : [tree, ...(tree.children || []).flatMap(nodes)];
const text = (tree) => !tree || typeof tree !== "object" ? String(tree ?? "") : (tree.children || []).map(text).join("");
for (const palette of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    colors = palette;
    const dateText = "Due 14 November 2026 · 9:30 AM";
    const onPress = () => {};
    let photoOpened = false, stopped = false;
    const row = cards.exports.ListEntryCard({ title: "A long recorded title", subtitle: "Dose 2 · Clinic",
        notes: "Recorded reaction and a long note", dateText, icon: "icon", iconBg: colors.recVaccine.bg,
        label: "Status", labelTrailing: true, thumbnailUrl: "photo.jpg", onPress,
        onThumbnailPress: () => { photoOpened = true; } });
    const date = nodes(row).find((node) => node.type === "Text" && text(node) === dateText);
    const body = nodes(row).find((node) => node.children?.includes(date));
    assert.equal(body.children.filter(Boolean).at(-1), date, "Date follows every text detail, including notes");
    assert.equal(date.props.numberOfLines, undefined, "Dates and ranges can wrap on narrow screens or with large text");
    assert.equal(date.props.style.color, colors.textMuted);
    assert.equal(date.props.style.marginTop, theme.space.xs);
    assert.equal(body.props.style.minWidth, 0);
    assert.equal(body.props.style.flexShrink, 1);
    assert.equal(row.props.onPress, onPress);
    const surface = Object.assign({}, ...row.props.style);
    assert.equal(surface.borderRadius, 24);
    assert.equal(surface.marginBottom, 12);
    assert.equal(surface.overflow, "visible");
    const glass = nodes(row).find(node => node.type === "Gradient");
    assert.equal(glass.props.pointerEvents, "none");
    assert.equal(glass.props.accessible, false);
    assert.deepEqual(glass.props.colors, colors.recordItem.surface);
    const trailing = nodes(row).find((node) => node.props.style?.[0]?.alignSelf === "center");
    assert(trailing, "Badges and thumbnails keep their centered trailing position");
    nodes(row).find((node) => node.props.accessibilityRole === "imagebutton").props.onPress({ stopPropagation: () => { stopped = true; } });
    assert(photoOpened && stopped);
    for (const value of [null, undefined, ""]) {
        const undated = cards.exports.ListEntryCard({ title: "Undated item", dateText: value });
        assert.equal(nodes(undated).filter((node) => node.type === "Text").length, 1);
    }
    const memory = cards.exports.MemoryVisualCard({ title: "Memory", description: "Description", date: "2026-11-14" });
    assert.deepEqual(nodes(memory).filter((node) => node.type === "Text").map(text), ["Memory", "Description"]);
    const memoryDate = nodes(memory).find(node => node.type === "MemoryDateRow");
    assert.equal(memoryDate.props.date, "2026-11-14", "The shared date row receives the unchanged stored date");
}

// Check actual custom JSX containers: a matched date must be their last visible content.
function finalLine(file, marker) {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
    let matched = 0;
    const visit = (node) => {
        if (!node || typeof node !== "object") return;
        if (node.type === "JSXElement" && node.openingElement.name.name === "View") {
            const children = node.children.filter((child) => child.type !== "JSXText" || child.value.trim());
            const position = children.findIndex((child) => source.slice(child.start, child.end).includes(marker));
            // Compact clinical photo controls may follow the last text line.
            const followsDate = child => child.type === "JSXExpressionContainer" && (child.expression.type === "JSXEmptyExpression"
                || (child.expression.type === "ConditionalExpression" && child.expression.consequent.type === "Identifier" && child.expression.consequent.name === "thumbnail"));
            if (position >= 0 && !children.slice(position + 1).every(followsDate)) {
                // Ignore ancestors whose matched child contains the text column itself.
                if (source.slice(children[position].start, children[position].end).includes("<View")) {
                    Object.values(node).flat().forEach(visit); return;
                }
                assert.fail(`${file}: ${marker} is followed by other item content`);
            }
            if (position >= 0 && !source.slice(children[position].start, children[position].end).includes("<View")) matched++;
        }
        Object.values(node).flat().forEach(visit);
    };
    visit(ast);
    assert(matched > 0, `${file}: expected date line ${marker}`);
}
for (const [file, marker] of [
    ["ui/ImmunizationRecordsCard.js", "{vaccine.dateLabel}"],
    ["CalendarView.js", "{when}{ev.time"],
    ["Search.js", "{shortDate(item.date)}"],
    ["AllActivity.js", "{a.date}"],
    ["Dashboard.js", "{relativeTime(a.date)}"],
    ["Dashboard.js", "{nextVax.due_date}"],
    ["Services.js", "{item.date}"],
    ["ui/MilkTypeCard.js", "{period.dateLabel}"],
    ["common/RecordSummaries.js", "{shortDate(e.date)}"],
]) finalLine(file, marker);
console.log("Date layout checks passed: shared footer order/wrapping/six themes, trailing badges/thumbnails, undated rows, memories and custom app rows.");
