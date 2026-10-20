// Run: node components/ui/AnimatedReveal.check.js. No device/server required.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const { parse } = require("@babel/parser");
const compile = (source) => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"] }).code;
let states, refs, effects, pending, cursor, refCursor, effectCursor, reduced, listener, removals, animations;
function reset() { states = []; refs = []; effects = []; pending = []; reduced = false; removals = 0; animations = []; }
const effect = (fn, deps) => {
    const index = effectCursor++, previous = effects[index];
    if (!previous || deps.some((value, i) => value !== previous.deps[i])) pending.push(() => {
        previous?.cleanup?.(); effects[index] = { deps, cleanup: fn() };
    });
};
const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState: (initial) => { const index = cursor++; if (!(index in states)) states[index] = initial;
        return [states[index], (value) => { states[index] = value; }]; },
    useRef: (initial) => refs[refCursor++] ||= { current: initial }, useEffect: effect, useLayoutEffect: effect };
class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } }
const native = { View: "View", Animated: { View: "AnimatedView", Value,
    timing: (value, config) => { const entry = { value, ...config, stopped: false }; return {
        start: (complete) => { entry.complete = complete; animations.push(entry); }, stop: () => { entry.stopped = true; } }; } },
    Easing: { bezier: (...values) => values }, AccessibilityInfo: {
        isReduceMotionEnabled: async () => reduced,
        addEventListener: (_, callback) => { listener = callback; return { remove: () => { removals++; } }; } } };
const loaded = { exports: {} };
new Function("require", "module", "exports", compile(fs.readFileSync(path.join(__dirname, "AnimatedReveal.js"), "utf8")))(
    (name) => name === "react" ? { __esModule: true, default: react, ...react } : name === "react-native" ? native
        : { motion: { standard: { duration: 220, bezier: [0.4, 0, 0.2, 1] } } }, loaded, loaded.exports);
const render = (props = {}) => { cursor = refCursor = effectCursor = 0; return loaded.exports.default(props); };
const commit = () => { const work = pending; pending = []; work.forEach((fn) => fn()); };
const measure = (tree, height) => tree.children[0].props.onLayout({ nativeEvent: { layout: { height } } });

async function main() {
    reset(); let tree = render(); commit();
    assert.equal(tree.props.style.height, undefined, "Already-visible rows do not wait for measurement");
    measure(tree, 180); tree = render(); commit();
    assert.equal(tree.props.style.height.value, 180);
    assert.equal(animations.length, 0, "Initial layout settles immediately");
    assert.equal(render().props.style.overflow,"visible","Settled content does not clip external shadows");
    await Promise.resolve(); render(); commit();
    measure(tree, 420); tree = render(); commit();
    assert.equal(animations.at(-2).toValue, 420);
    assert.equal(animations.at(-2).duration, 220);
    assert.deepEqual(animations.at(-2).easing, [0.4, 0, 0.2, 1]);
    assert.equal(animations.at(-2).useNativeDriver, false);
    assert.equal(animations.at(-1).toValue, 1, "Existing rows never fade out during pagination");
    assert.equal(render().props.style.overflow,"hidden","Height changes retain their reveal mask");
    const previous = animations.at(-2);
    measure(tree, 680); render(); commit();
    assert(previous.stopped, "Rapid changes interrupt the previous height animation");
    assert.equal(animations.at(-2).toValue, 680);
    previous.complete({finished:false});
    assert.equal(render().props.style.overflow,"hidden","Interrupted animations do not release the new mask");
    animations.at(-2).complete({finished:true});
    assert.equal(render().props.style.overflow,"visible","Finishing releases shadow clipping");
    tree = render({ expanded: false }); commit();
    assert.equal(animations.at(-2).toValue, 0);
    assert.equal(animations.at(-1).toValue, 0);
    assert.equal(tree.props.style.overflow,"hidden","Collapsed content remains clipped");
    assert.equal(tree.props.pointerEvents, "none");
    assert.equal(tree.props.accessibilityElementsHidden, true);
    assert.equal(tree.props.importantForAccessibility, "no-hide-descendants");
    tree = render({ expanded: true }); commit();
    assert.equal(animations.at(-2).toValue, 680);
    assert.equal(tree.props.pointerEvents, "auto");
    render({ expanded: false, duration: 260 }); commit();
    assert.equal(animations.at(-2).duration, 260, "Attention can request its own timing");
    tree = render({ expanded: true }); commit();
    assert.equal(animations.at(-2).duration, 220, "Other callers retain the existing default");
    listener(true); tree = render(); commit();
    assert.equal(tree.props.style.height.value, 680);
    const before = animations.length;
    measure(tree, 740); tree = render(); commit();
    assert.equal(tree.props.style.height.value, 740);
    assert.equal(animations.length, before, "Reduced motion settles without tweening");
    assert.equal(render().props.style.overflow,"visible","Reduced motion leaves settled shadows visible");
    effects.forEach((entry) => entry?.cleanup?.()); assert.equal(removals, 1);
    reset(); tree = render({ expanded: false }); commit();
    measure(tree, 240); tree = render({ expanded: false }); commit();
    assert.equal(tree.props.style.height.value, 0, "Initially-hidden entries stay hidden after measurement");
    await Promise.resolve(); render({ expanded: false }); commit();
    render({ expanded: true }); commit(); assert.equal(animations.at(-2).toValue, 240);
    effects.forEach((entry) => entry?.cleanup?.());

    // Every existing parent ShowMore must live inside a reveal, not beside it.
    let buttons = 0, plannerOwnsReveal = false;
    for (const file of ["ui/PlansDashboardCard.js", "ui/ConsultationsAppointmentsCard.js", "ui/HospitalStaysCard.js", "ui/IllnessesConditionsCard.js", "ui/ImmunizationRecordsCard.js", "Health.js", "Growth.js", "NutritionTracker.js", "CalendarView.js", "ShareRecords.js", "AllActivity.js"]) {
        const ast = parse(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), { sourceType: "module", plugins: ["jsx"] });
        const visit = (node, parents = []) => {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) { node.forEach((child) => visit(child, parents)); return; }
            if (node.type === "JSXElement") {
                const name = node.openingElement.name.name;
                const moreLabel = node.openingElement.attributes.find(attribute => attribute.name?.name === "accessibilityLabel")?.value?.expression;
                const appointmentMore = ["ui/ConsultationsAppointmentsCard.js", "ui/HospitalStaysCard.js", "ui/IllnessesConditionsCard.js", "ui/ImmunizationRecordsCard.js"].includes(file) && name === "Control"
                    && moreLabel?.type === "TemplateLiteral" && moreLabel.quasis[0].value.raw.startsWith("Show more");
                if (name === "ShowMore" || appointmentMore) { buttons++; assert(parents.includes("AnimatedReveal") ||
                    file === "CalendarView.js" && plannerOwnsReveal && parents.includes("PlansDashboardCard"), `${file}: unanimated ShowMore`); }
                parents = [...parents, name];
            }
            if (file === "ui/PlansDashboardCard.js" && node.type === "JSXExpressionContainer" && node.expression?.name === "children") {
                assert(parents.includes("AnimatedReveal"), "Planner children retain their shared reveal"); plannerOwnsReveal = true;
            }
            Object.values(node).forEach((child) => { if (child && typeof child === "object") visit(child, parents); });
        };
        visit(ast);
    }
    assert.equal(buttons, 15);
    assert(plannerOwnsReveal);
    console.log("Reveal checks passed: measured height, first layout, pagination, interruption, collapse, reduced motion, cleanup and all 15 parent ShowMore controls.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
