// Run: node components/cardPalette.check.js (no server or native runtime needed).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("@babel/parser");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "..");
const themeModule = { exports: {} };
new Function("module", "exports", transformSync(fs.readFileSync(path.join(root, "theme.js"), "utf8"), {
    babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code)(themeModule, themeModule.exports);
const theme = themeModule.exports;
function find(node, predicate) {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;
    for (const child of Object.values(node).flat()) {
        const hit = find(child, predicate);
        if (hit) return hit;
    }
    return null;
}
function card(file, styleName) {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    const tree = parse(source, { sourceType: "module", plugins: ["jsx"] });
    const element = find(tree, (node) => node.type === "JSXElement" && node.openingElement.name.name === "Gradient"
        && node.openingElement.attributes.some((attr) => attr.name?.name === "style"
            && attr.value?.expression?.property?.name === styleName));
    assert(element, `${file}: card uses the shared Gradient`);
    const foreground = find(tree, (node) => node.type === "VariableDeclarator" && node.id.name === "cardForeground");
    const styles = find(tree, (node) => node.type === "VariableDeclarator" && node.id.name === "makeStyles");
    const alpha = find(tree, (node) => node.type === "VariableDeclarator" && node.id.name === "withAlpha");
    const withAlpha = alpha ? new Function(`return (${source.slice(alpha.init.start, alpha.init.end)})`)() : undefined;
    const styleFactory = new Function("StyleSheet", "theme", "withAlpha", `const { space, radius, type, shadow, MIN_TOUCH } = theme;
        return (${source.slice(styles.init.start, styles.init.end)})`)({ create: (value) => value }, theme, withAlpha);
    const colorFor = new Function("colors", "scheme", `return (${source.slice(foreground.init.start, foreground.init.end)})`);
    const jsx = transformSync(source.slice(element.start, element.end), {
        babelrc: false, configFile: false, plugins: [["@babel/plugin-transform-react-jsx", { runtime: "classic" }]],
    }).code.replace(/;\s*$/, "");
    return (colors, scheme, values = {}) => {
        const cardForeground = colorFor(colors, scheme);
        const context = {
            React: { Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }) },
            Gradient: "Gradient", View: "View", Text: "Text", Ionicons: "Icon", Pressable: "Pressable",
            colors, cardForeground, styles: styleFactory(colors, cardForeground),
            latestMeasurement: null, shortDate: (date) => date, t: (key) => key,
            vaxProgress: { completed: 0, total: 10 }, vaxPct: 0, nextVax: null, upcoming: null, nav() {}, ...values,
        };
        return { ...context, rendered: new Function(...Object.keys(context), `return (${jsx})`)(...Object.values(context)) };
    };
}
const rgb = (hex) => hex.slice(1, 7).match(/\w\w/g).map((value) => parseInt(value, 16) / 255);
const blend = (foreground, background, opacity) => foreground.map((value, i) => value * opacity + background[i] * (1 - opacity));
const luminance = (values) => values.reduce((sum, value, i) => sum + [0.2126, 0.7152, 0.0722][i]
    * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4), 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
const latest = card("Growth.js", "metricsHeaderBox");
const vaccination = card("Dashboard.js", "progressCard");
const text = (node) => !node || typeof node !== "object" ? String(node ?? "") : (node.children || []).map(text).join(" ");
for (const gender of ["boy", "girl", "neutral"]) for (const scheme of ["light", "dark"]) {
    const colors = theme.paletteFor(undefined, gender, scheme);
    const expectedForeground = scheme === "dark" ? colors.background : colors.onPrimary;
    const growth = latest(colors, scheme), home = vaccination(colors, scheme);
    // Next plan and Fed both reference these exact shared styles.
    assert.equal(home.styles.feedingCard.backgroundColor, colors.surface);
    assert.equal(home.styles.feedingCard.borderColor, colors.hairline);
    assert.equal(home.styles.feedingIcon.backgroundColor, colors.softGreen);
    assert.equal(home.styles.feedingLabel.color, colors.text);
    assert.equal(home.styles.feedingSub.color, colors.textSecondary);
    assert.equal(home.styles.upcomingCard, undefined);
    for (const result of [growth, home]) {
        assert.deepEqual(result.rendered.props.colors, [colors.primaryDark, colors.primary]);
        assert.equal(result.cardForeground, expectedForeground);
        const a = rgb(colors.primaryDark), b = rgb(colors.primary), foreground = rgb(result.cardForeground);
        for (let step = 0; step <= 20; step++) {
            const background = blend(a, b, step / 20);
            assert(contrast(blend(foreground, background, 0.95 * 0.99), background) >= 4.5,
                `${gender}/${scheme}: secondary text stays readable across the gradient, including hover`);
            assert(contrast(foreground, blend(foreground, background, 0.2)) >= 3,
                `${gender}/${scheme}: progress fill is distinct from its track`);
        }
    }
    for (const key of ["metricsHeaderTitle", "metricsHeaderValue", "metricsHeaderLabel", "metricsHeaderDate", "metricsHeaderUnit", "metricsHeaderEmpty"]) {
        assert.equal(growth.styles[key].color, expectedForeground);
    }
    for (const key of ["metricsHeaderLabel", "metricsHeaderDate", "metricsHeaderUnit", "metricsHeaderEmpty"]) assert.equal(growth.styles[key].opacity, 0.95);
    assert.equal(growth.styles.metricsHeaderDivider.backgroundColor, expectedForeground + "33");
    assert.equal(growth.styles.metricsHeaderBox.backgroundColor, undefined);
    assert.equal(growth.styles.metricsHeaderBox.padding, 16);
    assert.equal(growth.styles.metricsHeaderCol.flexBasis, 0);
    assert.equal(growth.styles.detailGrabber.backgroundColor, colors.border, "Measurement detail sheet is unchanged");
    assert.equal((text(growth.rendered).match(/growthNoRecordYet/g) || []).length, 3);
    const partial = latest(colors, scheme, { latestMeasurement: { date: "2026-09-18", weight: 22.15, height: null, head_circumference: 50.8 } });
    for (const value of ["22.15", "50.8", "2026-09-18"]) assert(text(partial.rendered).includes(value));
    assert.equal(home.styles.progressCard.backgroundColor, undefined);
    assert.equal(home.styles.progressCard.borderColor, expectedForeground + "33");
    assert.equal(home.styles.progressTrack.backgroundColor, expectedForeground + "33");
    assert.equal(home.styles.progressFill.backgroundColor, expectedForeground);
    assert.equal(home.styles.nextVaxRow.borderTopColor, expectedForeground + "33");
    for (const key of ["progressTitle", "progressCount", "nextVaxLabel", "nextVaxSub"]) assert.equal(home.styles[key].color, expectedForeground);
    for (const completed of [0, 5, 10]) {
        const result = vaccination(colors, scheme, { vaxProgress: { completed, total: 10 }, vaxPct: completed * 10 });
        const fill = find(result.rendered, (node) => node.props?.style?.[0] === result.styles.progressFill);
        assert.equal(fill.props.style[1].width, `${completed * 10}%`);
        assert(text(result.rendered).includes(String(completed)));
        assert.equal(find(result.rendered, (node) => node.type === "Pressable"), null);
    }
    let destination;
    const next = { id: "dose", vaccine_name: "MMR", due_date: "2026-09-20", visit_name: "Visit" };
    const result = vaccination(colors, scheme, { nextVax: next, nav: (...args) => { destination = args; } });
    const row = find(result.rendered, (node) => node.type === "Pressable");
    row.props.onPress();
    assert.deepEqual(destination, ["health", "immunizations"]);
    assert.equal(row.props.style({ focused: true }).at(-1).boxShadow, `0 0 0 3px ${expectedForeground}`);
    assert.equal(row.props.style({ hovered: true })[1].opacity, 0.99);
    assert.equal(find(vaccination(colors, scheme, { nextVax: next, upcoming: { key: "vax-dose" } }).rendered,
        (node) => node.type === "Pressable"), null, "Already-promoted next vaccine stays hidden");
}
console.log("Card palette checks passed: six themes, gradient contrast, empty/partial measurements, progress states and vaccine navigation.");
