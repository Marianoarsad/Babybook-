// Run: node components/ui/ConsultationsAppointmentsCard.check.js — no server or record writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile(fs.readFileSync(path.join(__dirname, "../../theme.js"), "utf8")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
const labels = { completed: "Completed", upcoming: "Upcoming", overdue: "Overdue", other: "Status not recorded" };
const code = compile(fs.readFileSync(path.join(__dirname, "ConsultationsAppointmentsCard.js"), "utf8") + "\nmodule.exports.Control = Control; module.exports.ListTransition = ListTransition;");
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(nodes)] : [];
const find = (tree, predicate) => nodes(tree).find(predicate);
const merge = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const text = tree => tree && typeof tree === "object" ? (tree.props.children || []).map(text).join("") : String(tree ?? "");
function harness(platform = "web") {
    const slots = [], effects = [], animations = [];
    let cursor = 0, colors = theme.PALETTES.boy, reduced = false, fontScale = 1, ids = 0;
    const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
        useId: () => "appointment-test-" + ids++, useMemo: fn => fn(),
        useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
            return [slots[i], next => slots[i] = typeof next === "function" ? next(slots[i]) : next]; },
        useLayoutEffect(fn, deps) { const i = cursor++, previous = slots[i];
            if (!previous || deps.some((value, n) => value !== previous.deps[n])) effects.push(() => {
                previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
            }); },
    };
    class Value {
        constructor(value) { this.value = value; }
        setValue(value) { this.value = value; }
        stopAnimation() { if (this.animation) this.animation.stopped = true; }
        interpolate(options) { return { source: this, ...options }; }
    }
    const native = { View: "View", Text: "Text", Pressable: "Pressable", Image: "Image", StyleSheet: { create: value => value, absoluteFillObject: { position: "absolute", inset: 0 } },
        Platform: { OS: platform }, Easing: { out: fn => fn, quad: "quad" }, useWindowDimensions: () => ({ fontScale }),
        Animated: { Value, View: "AnimatedView", timing(value, options) { const animation = { ...options,
            start() { animations.push(this); value.animation = this; value.setValue(options.toValue); }, stop() { this.stopped = true; } }; return animation; } } };
    const imports = { "./AllRecordsIcon": { __esModule: true, default: "AllRecordsIcon" }, "./ImmunizationStatusIcon": { __esModule: true, default: "ImmunizationStatusIcon" }, react: { __esModule: true, default: react, ...react }, "react-native": native,
        "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Defs: "Defs", LinearGradient: "LinearGradient", Path: "Path", Rect: "Rect", Stop: "Stop" },
        "@expo/vector-icons": { Ionicons: "Icon" }, "../../context/ThemeContext": { useTheme: () => ({ colors }) }, "../../theme": theme,
        "../../utils/appointmentSummary": { APPOINTMENT_STATUS_LABELS: labels },
        "../../utils/dates": { shortDate: value => value || "", shortTime: value => value || "" },
        "./AnimatedReveal": { __esModule: true, default: "AnimatedReveal" }, "./Gradient": { __esModule: true, default: "Gradient" },
        "./Skeleton": { AppointmentsSkeleton: "AppointmentsSkeleton", SkeletonBlock: "SkeletonBlock" },
        "./useReducedMotion": { __esModule: true, default: () => reduced },
        "./useSoftPress": { __esModule: true, default: () => ({ respond() {}, transform: [] }) } };
    imports["../../assets/navbar/calendar-blue.png"] = "calendar-blue.png";
    const module = { exports: {} };
    new Function("require", "module", "exports", code)(name => { assert(name in imports, name); return imports[name]; }, module, module.exports);
    return { api: module.exports, animations,
        draw(component, props) { cursor = 0; const tree = component(props); while (effects.length) effects.shift()(); return tree; },
        palette(value) { colors = value; }, motion(value) { reduced = value; }, scale(value) { fontScale = value; },
        cleanup() { slots.forEach(slot => slot?.cleanup?.()); } };
}
const h = harness(), calls = [];
const appointments = ["completed", "upcoming", "overdue", "other"].flatMap((calendarStatus, i) => Array.from({ length: [24, 23, 21, 2][i] }, (_, n) =>
    ({ id: `${calendarStatus}-${n}`, title: `Visit ${n}`, calendarStatus, date: "2026-10-14", time: "09:30", provider: "Dr. Tan", notes: "Saved notes" })));
let props = { summary: { appointments, counts: { all: 70, completed: 24, upcoming: 23, overdue: 21 } }, onAdd: () => calls.push("add"), onOpen: appt => calls.push(appt) };
const draw = changes => h.draw(h.api.default, props = { ...props, ...changes });
const metrics = tree => find(tree, node => node.type === h.api.AppointmentSummaryMetrics);
const items = tree => nodes(tree).filter(node => node.type === h.api.AppointmentItem);
const more = tree => find(tree, node => node.props.accessibilityLabel?.startsWith("Show more"));
let tree = draw();
assert.equal(metrics(tree).props.selectedFilter, "all");
assert.equal(items(tree).length, 10);
assert.equal(more(tree).props.accessibilityLabel, "Show more appointments, 60 remaining");
more(tree).props.onPress(); tree = draw();
assert.equal(items(tree).length, 20);
assert.equal(new Set(items(tree).map(node => node.props.appointment.id)).size, 20);
for (const key of ["completed", "upcoming", "overdue", "all"]) {
    metrics(tree).props.onSelect(key); tree = draw();
    assert.equal(metrics(tree).props.selectedFilter, key);
    assert.equal(items(tree).length, 10, "Changing filter resets the batch");
    assert(items(tree).every(node => key === "all" || node.props.appointment.calendarStatus === key));
    more(tree).props.onPress(); tree = draw();
    assert.equal(items(tree).length, 20);
    assert.equal(more(tree).props.accessibilityLabel.includes(`${props.summary.counts[key] - 20} remaining`), true);
}
metrics(tree).props.onSelect("completed"); tree = draw();
more(tree).props.onPress(); tree = draw(); more(tree).props.onPress(); tree = draw();
assert.equal(items(tree).length, 24); assert(!more(tree));
tree = draw({ summary: { appointments: appointments.filter(appt => appt.calendarStatus !== "completed"), counts: { all: 46, completed: 0, upcoming: 23, overdue: 21 } } });
assert.equal(items(tree).length, 0, "Data changes remove stale filtered entries");
assert(text(tree).includes("No completed consultations yet.")); assert(!more(tree));
for (const [filter, message] of [["all", "No consultations or appointments recorded yet."], ["upcoming", "No upcoming appointments."], ["overdue", "No overdue appointments."]]) {
    metrics(tree).props.onSelect(filter);
    tree = draw({ summary: { appointments: [], counts: { all: 0, completed: 0, upcoming: 0, overdue: 0 } } });
    assert(text(tree).includes(message)); assert(!more(tree));
}
tree = draw({ loading: true });
assert(!metrics(tree), "Unknown counts never appear as zeros during initial loading");
assert(find(tree, node => node.props.accessibilityRole === "progressbar"));
tree = draw({ loading: false, loadFailed: true, onRetry: () => calls.push("retry") });
assert(!metrics(tree)); find(tree, node => node.props.accessibilityLabel === "Retry loading appointments").props.onPress(); assert.equal(calls.at(-1), "retry");
find(tree, node => node.props.accessibilityLabel === "Add appointment").props.onPress(); assert.equal(calls.at(-1), "add");

const luminance = hex => hex.slice(1, 7).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
    .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (const colors of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    const p = colors.appointmentDashboard;
    const m = harness(); m.palette(colors);
    let selection;
    const metricProps = { counts: { all: 70, completed: 24, upcoming: 23, overdue: 21 }, selectedFilter: "upcoming", onSelect: value => selection = value };
    for (const [width, scale, rows] of [[240, 1, 2], [311, 1, 2], [700, 1, 1], [311, 1.6, 4], [240, 2, 4]]) {
        m.scale(scale); let mt = m.draw(m.api.AppointmentSummaryMetrics, metricProps);
        mt.props.onLayout({ nativeEvent: { layout: { width } } }); mt = m.draw(m.api.AppointmentSummaryMetrics, metricProps);
        assert.equal(mt.props.children.filter(Boolean).length, rows);
        const buttons = nodes(mt).filter(node => node.type === m.api.Control);
        assert.equal(buttons.length, 4); assert(!find(mt, node => node.props.accessibilityRole === "tab"));
        for (const button of buttons) {
            const key = button.props.testID.replace("appointment-filter-", "");
            button.props.onPress(); assert.equal(selection, key);
            assert.equal(button.props.accessibilityState.selected, key === "upcoming");
            assert(merge(button.props.style).minHeight >= 44);
            for (const background of [...p[key].surface, ...p[key].active]) assert(contrast(p[key].ink, background) >= 4.5, `${key} contrast ${background}`);
            const control = harness(); control.palette(colors);
            let ct = control.draw(control.api.Control, button.props);
            assert.equal(ct.props["aria-pressed"], key === "upcoming");
            ct.props.onFocus({ currentTarget: { matches: () => true } }); ct = control.draw(control.api.Control, button.props);
            assert.equal(merge(ct.props.style).outlineStyle, "solid"); control.cleanup();
        }
    }
    const r = harness(); r.palette(colors);
    const appt = appointments[0]; let photo;
    const row = r.draw(r.api.AppointmentItem, { appointment: appt, onOpen: value => calls.push(value), thumbnailUrl: "saved-photo.jpg", onOpenAttachment: value => photo = value });
    const buttons = nodes(row).filter(node => node.type === "Pressable");
    assert.equal(buttons.length, 2); assert(!nodes(buttons[0]).some(node => node !== buttons[0] && node.type === "Pressable"), "Photo is a sibling, never a nested button");
    buttons[0].props.onPress(); assert.equal(calls.at(-1), appt); buttons[1].props.onPress(); assert.equal(photo, appt);
    assert.equal(merge(row.props.style).overflow, "visible");
    assert.equal(nodes(row).filter(node => node.type === r.api.AppointmentStatusIcon).length, 1);
    assert.equal(nodes(row).filter(node => node.type === "Text" && text(node) === "Completed").length, 0, "No duplicate status badge");
    assert.equal(find(row, node => node.type === "Text" && text(node).includes("Saved notes")).props.numberOfLines, 2);
    for (const background of p.row) assert(contrast(p.secondary, background) >= 4.5);
    for (const kind of ["headerIcon", "all", "completed", "upcoming", "overdue", "other"]) {
        const artwork = r.draw(r.api.AppointmentStatusIcon, { kind });
        assert.equal(artwork.props.style.width, artwork.props.style.height);
        assert.equal(artwork.props.style.borderRadius, 22);
        if (kind === "all" || kind === "other") assert.equal(find(artwork, node => node.type === "Image").props.source, "calendar-blue.png");
        else assert.equal(find(artwork, node => node.type === "Svg").props.style.position, "relative");
    }
    m.cleanup(); r.cleanup();
}
const motion = harness(); let transitionProps = { filter: "all", children: "current records" };
const controlHarness = harness(), controlProps = { material: theme.PALETTES.boy.appointmentDashboard.all, children: "Action", onPress: () => calls.push("control") };
let control = controlHarness.draw(controlHarness.api.Control, controlProps);
assert.equal(merge(control.props.style).minHeight, 44);
assert.equal(merge(find(control, n => n.type === "AnimatedView").props.style).inset, 0);
control = controlHarness.draw(controlHarness.api.Control, { ...controlProps, faceSize: 32, radius: 16 });
const face = merge(find(control, n => n.type === "AnimatedView").props.style);
assert.deepEqual([face.width, face.height, face.marginLeft, face.marginTop], [32, 32, -16, -16]);
assert.equal(merge(control.props.style).minHeight, 44);
control = controlHarness.draw(controlHarness.api.Control, { ...controlProps, appearance: "text" });
assert(!find(control, n => n.type === "AnimatedView"));
control.props.onFocus({ currentTarget: { matches: () => true } });
control = controlHarness.draw(controlHarness.api.Control, { ...controlProps, appearance: "text" });
assert.equal(merge(control.props.style).outlineStyle, "solid");
control.props.onPress(); assert.equal(calls.at(-1), "control"); controlHarness.cleanup();
const transition = changes => motion.draw(motion.api.ListTransition, transitionProps = { ...transitionProps, ...changes });
transition(); assert.equal(motion.animations.length, 0);
transition({ filter: "completed" }); assert.equal(motion.animations.at(-1).duration, 220);
const interrupted = motion.animations.at(-1); transition({ filter: "upcoming" }); assert(interrupted.stopped);
motion.motion(true); const before = motion.animations.length; const settled = transition({ filter: "overdue" });
assert.equal(motion.animations.length, before); assert.equal(settled.props.style.opacity.source.value, 1); motion.cleanup();

const health = fs.readFileSync(path.join(__dirname, "../Health.js"), "utf8");
assert(!/\bsetAppts\b/.test(health), "Checkups use the shared store, not a competing local collection");
assert(health.includes('key={profile.id} summary={appointmentData}'), "Baby switches reset card selection and pagination");
assert(health.includes('label: "Calendar plan"'), "Details distinguish Calendar planning from clinical status");
const effect = health.match(/useEffect\(\(\) => \{(\s+const update = \(\) => setAppointmentDay[\s\S]*?)\n    \}, \[\]\);/);
assert(effect);
let tick, foreground, removed = false, cleared = false, day = "2026-10-14", actualDay;
const cleanup = new Function("setAppointmentDay", "todayLocal", "setInterval", "clearInterval", "AppState", `return (() => {${effect[1]}})();`)(
    value => actualDay = value, () => day, (fn, ms) => { tick = fn; assert.equal(ms, 60000); return 42; }, id => { assert.equal(id, 42); cleared = true; },
    { addEventListener(name, fn) { assert.equal(name, "change"); foreground = fn; return { remove() { removed = true; } }; } });
day = "2026-10-15"; tick(); assert.equal(actualDay, day); day = "2026-10-16"; foreground("background"); assert.equal(actualDay, "2026-10-15"); foreground("active"); assert.equal(actualDay, day);
cleanup(); assert(cleared && removed); h.cleanup();
console.log("Appointment card checks passed: filters/pagination/reset, live data/empty/loading states, six palettes, responsive metrics, keyboard focus, navigation/photos, status artwork, motion and day rollover.");
