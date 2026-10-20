// node components/ShareRecords.check.js — mocked sharing/export services; no real records or QR creation.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const pure = file => { const module = { exports: {} }; new Function("module", "exports", compile(fs.readFileSync(path.join(__dirname, file), "utf8")))(module, module.exports); return module.exports; };
const theme = pure("../theme.js"), constants = pure("../utils/shareStore.js");
const all = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(all)] : [];
const find = (tree, predicate) => all(tree).find(predicate);
const text = tree => tree && typeof tree === "object" ? (tree.props.children || []).map(text).join("") : String(tree ?? "");
const tick = () => new Promise(setImmediate);
function harness(reducedMotion = true) {
    const slots = [], effects = [], calls = [], errors = [], valueChanges = [], animations = []; let cursor = 0, scope = "A", width = 390, fontScale = 1, palette = theme.PALETTES.boy, pdfEnabled = true, pending;
    const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }), useMemo: fn => fn(), useCallback: fn => fn,
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], next => slots[i] = typeof next === "function" ? next(slots[i]) : next]; },
        useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
        useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, n) => old.deps[n] !== v)) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); } };
    class Value { constructor(value) { this.value = value; } setValue(value) { valueChanges.push(value); this.value = value; } stopAnimation() {} interpolate() { return this.value; } }
    const imports = { react: { __esModule: true, default: react, ...react }, "react-native": { View: "View", Text: "Text", Image: "Image", TextInput: "Input", TouchableOpacity: "Button", StyleSheet: { create: s => s }, Platform: { OS: "web" }, Easing: { bezier() {} }, useWindowDimensions: () => ({ width, fontScale }), AccessibilityInfo: { isReduceMotionEnabled: async () => reducedMotion, addEventListener: () => ({ remove() {} }) }, Animated: { View: "AnimatedView", ScrollView: "Scroll", Value, timing: (v, config) => ({ start: fn => { animations.push(config); v.setValue(config.toValue); fn?.({ finished: true }); } }), sequence: () => ({ start() {} }) } },
        "@expo/vector-icons": { Ionicons: "Icon" }, "../theme": theme, "../utils/shareStore": constants,
        "../utils/exportPdf": { pdfExportAvailable: () => pdfEnabled, exportChildRecordsPdf: async (profile, args) => { calls.push(["pdf", profile.id, args]); if (pending) await pending; } },
        "../utils/api": { api: { createShare: async (id, args) => { calls.push(["qr", id, args]); if (pending) await pending; return { id: 99, code: "FIXTURE", status: "active", expiration_date: "2099-01-01" }; } } },
        "../utils/useRecords": { useRecordCache: () => ({ rows: [], hasFetched: true }), useScreenRefresh: id => ({ refreshing: false, failures: [], refresh() {}, isActive: () => id === scope }) },
        "../context/LanguageContext": { useLanguage: () => ({ t: key => key }) }, "../context/ThemeContext": { useTheme: () => ({ colors: palette }) },
        "../utils/responsive": { useScreenPadBottom: () => 120, useScreenPadTop: () => 80 }, "../context/ScrollContext": { useScroll: () => ({ scrollProps: {}, scrollViewRef() {} }) },
        "./ui/Toast": { useToast: () => ({ error: message => errors.push(message), success() {} }) }, "./ui/useRefreshControl": { useRefreshControl() {} },
        "./common/Cards": { EmptyStateCard: "Empty", ListEntryCard: "ListEntryCard", SectionContainerCard: "SectionContainerCard" }, "./ui/Skeleton": { AppointmentsSkeleton: "Skeleton" },
        "./ui/RecordFormSheet": { DeleteConfirmation: "DeleteConfirmation" }, "./ui/DateField": { DurationWheel: "DurationWheel" },
        "./ui/ConsultationsAppointmentsCard": { DashboardControl: "Control", DashboardSurface: "Surface" }, "./ui/RecordIcon": { __esModule: true, default: "RecordIcon", AllergyIcon: "AllergyIcon", HereditaryIcon: "HereditaryIcon" },
        "../utils/dates": { shortDate: v => v || "", toLocalISO: () => "2026-10-16" } };
    for (const name of ["KeyboardAvoider", "Avatar", "VaccineIcon", "GrowthIcon", "ShowMore", "AnimatedReveal", "PulseLoader", "PlanDetail", "SwipeActionRow"]) imports[`./ui/${name}`] = { __esModule: true, default: name };
    imports["./QrCodeView"] = { __esModule: true, default: "QrCodeView" };
    const module = { exports: {} };
    new Function("require", "module", "exports", "setInterval", "clearInterval", "requestAnimationFrame", compile(fs.readFileSync(path.join(__dirname, "ShareRecords.js"), "utf8")))(name => { assert(name in imports, name); return imports[name]; }, module, module.exports, () => 1, () => {}, fn => fn());
    const render = (child = scope) => { scope = child; cursor = 0; const tree = module.exports.default({ profile: { id: child, name: "Fixture Baby" } }); while (effects.length) effects.shift()(); return tree; };
    return { render, calls, errors, valueChanges, animations, size(w, scale = 1) { width = w; fontScale = scale; }, palette(p) { palette = p; }, pdf(enabled) { pdfEnabled = enabled; }, pending(promise) { pending = promise; } };
}
const id = (tree, value) => find(tree, n => n.props.testID === value);
const button = (tree, label) => find(tree, n => n.props.accessibilityLabel === label);
const measure = (tree, height = 420) => find(tree, n => n.props.onLayout && n.props.style?.padding === 8)?.props.onLayout({ nativeEvent: { layout: { height } } });
async function check() {
    for (const reduced of [false, true]) {
        const resize = harness(reduced); let tree = resize.render(); await tick(); tree = resize.render(); measure(tree); tree = resize.render();
        const before = resize.valueChanges.length, animationCount = resize.animations.length;
        for (const ttl of [1380, 1440, 1380, 1440]) {
            find(tree, n => n.type === "DurationWheel").props.onChange(ttl); tree = resize.render();
            measure(tree, ttl === 1440 ? 468 : 420); tree = resize.render();
        }
        assert(!resize.valueChanges.slice(before).includes(0), "23/24-hour content changes must not restart the card from zero height");
        assert.deepEqual(resize.animations.slice(animationCount).map(a => a.toValue), [468, 420, 468], "Resize from the current height to the new natural content height");
        assert(resize.animations.slice(animationCount).every(a => a.duration === (reduced ? 0 : theme.motion.standard.duration)));
        const settled = resize.animations.length; measure(tree, 468); resize.render();
        assert.equal(resize.animations.length, settled, "Repeated equal measurements must not restart resizing");
    }
    const h = harness(); let tree = h.render(); await tick(); tree = h.render(); measure(tree); tree = h.render();
    assert.equal(all(tree).filter(n => n.props.step).length, 3); assert.equal(id(tree, "share-record-grid").props.children.length, 8);
    assert(find(tree, n => n.type === "DurationWheel")); assert(button(tree, "Generate QR sharing").props.accessibilityState.selected);
    for (const key of Object.keys(constants.RECORD_LABELS)) {
        assert(id(tree, `share-record-${key}`).props.accessibilityState.checked);
        assert.equal(id(tree, `share-record-${key}`).props["aria-checked"], true);
    }
    const note = () => button(tree, "What is this visit about?"); note().props.onChangeText("Fixture visit note"); tree = h.render(); assert.equal(text(id(tree, "share-note-count")), "18/500");
    note().props.onChangeText("x".repeat(501)); tree = h.render(); assert.equal(note().props.value, "Fixture visit note"); assert(h.errors.at(-1).includes("500"));
    id(tree, "share-record-profile").props.onPress(); tree = h.render();
    assert.equal(id(tree, "share-record-profile").props["aria-checked"], false);
    button(tree, "Save as PDF sharing").props.onPress(); tree = h.render(); measure(tree); tree = h.render();
    assert(!find(tree, n => n.type === "DurationWheel")); assert.equal(note().props.value, "Fixture visit note");
    button(tree, "Save as PDF sharing").props.onPress(); tree = h.render(); assert(button(tree, "Save Records as PDF"));
    let resolve; h.pending(new Promise(r => resolve = r)); const pdfButton = button(tree, "Save Records as PDF"); const task = pdfButton.props.onPress(); pdfButton.props.onPress();
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], "pdf"); assert(!h.calls[0][2].scope.has("profile")); assert.equal(h.calls[0][2].visitReason, "Fixture visit note");
    tree = h.render(); assert(note().props.editable === false); assert(button(tree, "Generate QR sharing").props.disabled); id(tree, "share-record-growth").props.onPress();
    resolve(); await task; h.pending(null); tree = h.render(); assert(id(tree, "share-record-growth").props.accessibilityState.checked);
    button(tree, "Generate QR sharing").props.onPress(); tree = h.render(); measure(tree); tree = h.render();
    find(tree, n => n.type === "DurationWheel").props.onChange(0); tree = h.render(); await button(tree, "Generate Consultation QR").props.onPress(); assert.equal(h.calls.length, 1);
    find(tree, n => n.type === "DurationWheel").props.onChange(1439); tree = h.render();
    h.pending(new Promise(r => resolve = r)); const qr = button(tree, "Generate Consultation QR"); const generating = qr.props.onPress(); qr.props.onPress();
    assert.equal(h.calls.length, 2); assert.equal(h.calls[1][2].ttlMinutes, 1439); assert(!h.calls[1][2].recordKeys.includes("profile"));
    tree = h.render(); assert(find(tree, n => n.type === "DurationWheel").props.disabled);
    resolve(); await generating; h.pending(null); tree = h.render();
    for (const key of Object.keys(constants.RECORD_LABELS)) { if (id(tree, `share-record-${key}`).props.accessibilityState.checked) id(tree, `share-record-${key}`).props.onPress(); tree = h.render(); }
    assert(button(tree, "Generate Consultation QR").props.disabled); await button(tree, "Generate Consultation QR").props.onPress(); assert.equal(h.calls.length, 2); assert(text(tree).includes("Select at least one record category"));
    tree = h.render("B"); tree = h.render("B"); assert.equal(note().props.value, ""); assert.equal(find(tree, n => n.type === "DurationWheel").props.value, 60);
    assert(Object.keys(constants.RECORD_LABELS).every(key => id(tree, `share-record-${key}`).props.accessibilityState.checked));
    for (const [width, scale, cols] of [[320, 1, 1], [390, 1, 2], [768, 1, 2], [1024, 1, 3], [390, 2, 1]]) {
        h.size(width, scale); id(tree, "share-record-grid").props.onLayout({ nativeEvent: { layout: { width: width - 64 } } }); tree = h.render();
        assert.equal(id(tree, "share-record-profile").props.style[1].width, Math.floor((width - 64 - (cols - 1) * 12 - 1) / cols));
    }
    for (const set of [theme.PALETTES, theme.DARK_PALETTES]) for (const p of Object.values(set)) { h.palette(p); tree = h.render(); assert.equal(Object.keys(p.shareSurface.tiles).length, 8); }
    h.pdf(false); tree = h.render(); assert(button(tree, "Save as PDF sharing").props.disabled);
    const failed = harness(); tree = failed.render(); await tick(); tree = failed.render(); measure(tree); tree = failed.render();
    failed.pending(Promise.reject(Error("Fixture failure"))); await button(tree, "Generate Consultation QR").props.onPress(); tree = failed.render(); assert.equal(button(tree, "Generate Consultation QR").props.disabled, false); assert(failed.errors.includes("Fixture failure"));
    const stale = harness(); tree = stale.render(); await tick(); tree = stale.render(); measure(tree); tree = stale.render();
    let resolveOld, resolveNew;
    stale.pending(new Promise(r => resolveOld = r)); const oldRequest = button(tree, "Generate Consultation QR").props.onPress();
    stale.render("B"); stale.render("B"); stale.render("A"); tree = stale.render("A"); measure(tree); tree = stale.render();
    stale.pending(new Promise(r => resolveNew = r)); const newRequest = button(tree, "Generate Consultation QR").props.onPress();
    resolveOld(); await oldRequest; tree = stale.render();
    assert(!find(tree, n => n.type === "PlanDetail" && n.props.visible), "A response from an abandoned draft cannot reopen its QR");
    assert(button(tree, "Generate Consultation QR").props.disabled, "An old request cannot unlock the new operation");
    resolveNew(); await newRequest; tree = stale.render(); assert(find(tree, n => n.type === "PlanDetail" && n.props.visible));
    console.log("Share builder checks passed: eight permissions, QR default, responsive cards, bounded/preserved notes, mode switching, matching QR/PDF scope, empty/duration validation, synchronous duplicate lock, failure recovery and baby reset.");
}
check().catch(error => { console.error(error); process.exitCode = 1; });
