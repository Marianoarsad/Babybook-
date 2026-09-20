// Run: node components/PercentileChart.check.js (no native runtime required).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const babel = require("@babel/core");
let width = 280;
const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(Boolean) }),
    useMemo: (fn) => fn(),
    useState: () => [width, () => {}],
    Fragment: "Fragment",
};
const colors = { primary: "purple", surface: "white", textMuted: "muted" };
const theme = { space: {}, type: { caption: { fontFamily: "Public Sans", fontWeight: "400" } } };
function load(file) {
    const code = babel.transformSync(fs.readFileSync(file, "utf8"), {
        babelrc: false, configFile: false,
        plugins: ["@babel/plugin-transform-modules-commonjs", ["@babel/plugin-transform-react-jsx", { runtime: "classic" }]],
    }).code;
    const module = { exports: {} };
    const requireMock = (name) => {
        if (name === "react") return React;
        if (name === "react-native") return { View: "View", Text: "Text", StyleSheet: { create: (styles) => styles } };
        if (name === "react-native-svg") return { __esModule: true, default: "Svg", Text: "SvgText", ...Object.fromEntries(["Path", "Circle", "Line", "Defs", "LinearGradient", "Stop", "Rect"].map((key) => [key, key])) };
        if (name.endsWith("ThemeContext")) return { useTheme: () => ({ colors }) };
        if (name.endsWith("LanguageContext")) return { useLanguage: () => ({ language: "en", t: (key) => key }) };
        if (name.endsWith("/theme")) return theme;
        const target = path.resolve(path.dirname(file), name);
        return name.endsWith(".json") ? require(target) : load(`${target}.js`);
    };
    new Function("require", "module", "exports", code)(requireMock, module, module.exports);
    return module.exports;
}
const Chart = load(path.join(__dirname, "PercentileChart.js")).default;
const flatten = (node) => node && typeof node === "object" ? [node, ...node.children.flatMap(flatten)] : [];
let checked = 0;
for (width of [240, 280, 340, 420]) {
    for (const compact of [true, false]) {
        for (const indicator of ["weight", "height", "head"]) {
            for (const [from, to, datePreset, yearRange] of [
                ...Array.from({ length: 7 }, (_, i) => ["2026-09-01", `2026-09-0${i + 1}`, "week", null]),
                ["2026-09-01", "2026-09-30", "month", null],
                ["2026-08-28", "2026-09-04", null, null],
                ["2026-09-01", "2026-09-02", null, null],
                ["2026-09-04", "2026-09-04", null, null],
                ["2026-01-01", "2026-12-31", "year", null],
                ["2026-02-01", "2026-08-31", "year", null],
                ["2020-02-18", "2029-09-01", "year", { from: 2020, to: 2029 }],
                ["2020-02-18", "2026-09-01", "year", { from: 2020, to: 2026 }],
                ["2026-01-01", "2026-09-01", "year", { from: 2026, to: 2026 }],
            ]) {
                for (const values of [[20.13, 20.17], [20, 20], [5, 45], [45, 5]]) {
                const field = indicator === "head" ? "head_circumference" : indicator;
                const rows = [from, to].map((date_recorded, i) => ({ id: i + 1, date_recorded, [field]: values[i] }));
                const nodes = flatten(Chart({ indicator, dateOfBirth: "2020-02-18", rows, areaFill: true, compact, dateWindow: { from, to }, datePreset, yearRange, pointAlignedShortRange: true }));
                const height = compact ? 220 : 288;
                const labels = nodes.filter((node) => node.type === "SvgText");
                const x = labels.filter((node) => node.props.y === height - 5);
                const y = labels.filter((node) => node.props.y !== height - 5 && node.props.y !== 11);
                const multiYear = yearRange && yearRange.to > yearRange.from;
                const customRange = datePreset == null && !yearRange;
                const narrowTickCount = width - 68 < 240 ? 5 : 7;
                const customDayCount = Math.round(
                    (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000
                ) + 1;
                const expectedXCount = multiYear
                    ? Math.min(7, yearRange.to - yearRange.from + 1)
                    : customRange
                      ? Math.min(narrowTickCount, customDayCount)
                    : (datePreset === "month" || (datePreset === "year" && yearRange)) && width - 68 < 240
                      ? 5
                      : 7;
                assert.equal(x.length, expectedXCount);
                x.forEach((label, i) => {
                    assert.equal(label.props.x, expectedXCount === 1
                        ? 44 + (width - 68) / 2
                        : 44 + (i / (expectedXCount - 1)) * (width - 68));
                    assert.equal(label.props.textAnchor, "middle");
                    assert.equal(label.props.fontSize, datePreset === "year" && !multiYear ? 11 : 13);
                    // Conservative 8px-per-glyph bounds at the 13px font size.
                    const halfText = String(label.children[0]).length * 4;
                    assert.ok(label.props.x - halfText >= 0);
                    assert.ok(label.props.x + halfText <= width);
                });
                if (expectedXCount === 1) {
                    assert.equal(x[0].props.x, 44 + (width - 68) / 2);
                } else {
                    assert.equal(x[0].props.x, 44);
                    assert.equal(x[expectedXCount - 1].props.x, width - 24);
                }
                for (let i = 2; i < x.length; i++) assert.ok(Math.abs((x[i].props.x - x[i - 1].props.x) - (x[1].props.x - x[0].props.x)) < 1e-8);
                if (datePreset === "month" || customRange) {
                    assert.ok(x.every((label) => /^\d{2}\/\d{2}$/.test(String(label.children[0]))));
                    for (let i = 1; i < x.length; i++) assert.ok(x[i].props.x - x[i - 1].props.x >= 40);
                }
                if (datePreset === "year" && !multiYear) {
                    assert.ok(x.every((label) => String(label.children[0]).length === 3));
                    assert.ok(x.every((label) => label.props.fontSize === 11));
                }
                if (multiYear) {
                    const yearLabels = x.map((label) => label.children[0]);
                    assert.equal(new Set(yearLabels).size, yearLabels.length);
                    assert.equal(yearLabels[0], String(yearRange.from));
                    assert.equal(yearLabels.at(-1), String(yearRange.to));
                }
                assert.equal(y.length, 7);
                const centers = y.map((node) => node.props.y - (node.props.dominantBaseline ? 0 : 3.5)).sort((a, b) => a - b);
                for (let i = 1; i < centers.length; i++) assert.ok(centers[i] - centers[i - 1] >= 20);
                for (let i = 2; i < centers.length; i++) assert.ok(Math.abs((centers[i] - centers[i - 1]) - (centers[1] - centers[0])) < 1e-8);
                const guides = nodes.filter((node) => node.type === "Line");
                assert.equal(guides.length, 7);
                y.forEach((label, i) => {
                    assert.ok(Math.abs(label.props.y - 3.5 - guides[i].props.y1) < 1e-8);
                    assert.equal(label.props.x, 0);
                    assert.ok(/^\d+$/.test(String(label.children[0])));
                });
                assert.ok(!y.some((node) => node.props.dominantBaseline === "middle"));
                const ring = nodes.find((node) => node.type === "Circle" && node.props.r === 7);
                assert.ok(ring, "Latest marker stays ringed");
                assert.ok(!nodes.some((node) => node.type === "Rect"));
                for (const label of labels) {
                    assert.equal(label.props.fill, colors.textMuted);
                    assert.equal(label.props.fontWeight, "400");
                }
                checked++;
                }
            }
        }
    }
}

width = 340;
const annualRows = [
    { id: 1, date_recorded: "2025-01-10", weight: 7 },
    { id: 2, date_recorded: "2025-12-20", weight: 8 },
    { id: 3, date_recorded: "2026-06-15", weight: 9 },
    { id: 4, date_recorded: "2027-02-01", weight: 10 },
    { id: 5, date_recorded: "2027-11-30", weight: 11 },
];
const annualNodes = flatten(Chart({
    indicator: "weight",
    dateOfBirth: "2020-02-18",
    rows: annualRows,
    areaFill: true,
    compact: true,
    dateWindow: { from: "2025-01-01", to: "2027-12-31" },
    datePreset: "year",
    yearRange: { from: 2025, to: 2027 },
}));
const annualDots = annualNodes.filter((node) => node.type === "Circle" && node.props.r !== 7);
assert.equal(annualDots.length, 3, "Year view keeps one latest measurement per year");
assert.equal(annualDots[0].props.cx, 44);
assert.equal(annualDots.at(-1).props.cx, width - 24);
console.log(`Passed ${checked} chart layouts: collision-safe equal x slots, seven aligned y guides, no extra latest-value caption.`);
