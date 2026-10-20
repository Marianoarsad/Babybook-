// node utils/useVaccinationFocus.check.js — fake layout/clock, no medical-record writes.
const assert = require("node:assert/strict"), fs = require("node:fs");
const { transformSync } = require("@babel/core");
const code = transformSync(fs.readFileSync(__dirname + "/useVaccinationFocus.js", "utf8"), {
    babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
function harness(reduced = false) {
    let cursor = 0, epoch = 1, effects = [], frames = new Map(), timers = new Map(), serial = 0;
    const slots = [], scrolls = [], messages = [], measured = [];
    const react = {
        useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
        useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value;
            return [slots[i], next => slots[i] = typeof next === "function" ? next(slots[i]) : next]; },
        useCallback(fn, deps) { const i = cursor++, old = slots[i];
            if (!old || deps.some((v, n) => v !== old.deps[n])) slots[i] = { fn, deps }; return slots[i].fn; },
        useEffect(fn, deps) { const i = cursor++, old = slots[i];
            if (!old || deps.some((v, n) => v !== old.deps[n])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
    };
    class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } }
    const imports = { react, "react-native": { Animated: { Value, timing: (value, config) => ({ start(cb) { value.setValue(config.toValue); cb({ finished: true }); }, stop() {} }) } },
        "./useRecords": { useSessionEpoch: () => epoch }, "./recordStore.cjs": { getEpoch: () => epoch },
        "../components/ui/useReducedMotion": { __esModule: true, default: () => reduced } };
    const module = { exports: {} };
    new Function("require", "module", "exports", "requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", code)(
        name => imports[name], module, module.exports, fn => { frames.set(++serial, fn); return serial; }, id => frames.delete(id),
        (fn, ms) => { timers.set(++serial, { fn, ms }); return serial; }, id => timers.delete(id));
    const props = { request: { intent: "focus", sourceType: "vaccination", childId: "baby", recordId: "42" }, navKey: 1, childId: "baby",
        records: [{ id: "42" }, { id: "43" }], ready: false, active: true, topInset: 80,
        scrollRef: { current: { getInnerViewRef: () => "inner", scrollTo: data => scrolls.push(data) } }, onMissing: () => messages.push("missing") };
    let result;
    return { api: module.exports, props, scrolls, messages, measured, timers,
        draw(changes) { Object.assign(props, changes); cursor = 0; result = module.exports.default(props); const pending = effects; effects = []; pending.forEach(fn => fn()); return result; },
        frame() { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); },
        node(y, height = 120) { return { measureLayout(inner, cb) { assert.equal(inner, "inner"); measured.push(() => cb(0, y, 300, height)); } }; },
        measure() { measured.splice(0).forEach(fn => fn()); }, clock() { [...timers.values()].forEach(t => t.fn()); timers.clear(); },
        epoch() { epoch++; }, unmount() { slots.forEach(s => s?.cleanup?.()); } };
}
for (const reduced of [true, false]) {
    const h = harness(reduced); let state = h.draw(); state.rowRef(h.node(1700)); state.onContentSizeChange(390, 1000); h.frame(); h.measure();
    assert.equal(h.scrolls.length, 0, "Cold data cannot consume navigation");
    state = h.draw({ ready: true }); h.frame(); h.measure(); assert.equal(h.scrolls.length, 0, "Wait for pagination height");
    state.onContentSizeChange(390, 2100); h.frame(); h.measure();
    assert.deepEqual(h.scrolls, [{ y: 1608, animated: false }]); state = h.draw();
    assert.equal(state.highlightId, "42"); assert.equal(state.pending, false); assert.equal(state.opacity.value, 1);
    assert.equal([...h.timers.values()][0].ms, reduced ? 1800 : 1500);
    state.onLayout(); h.frame(); h.measure(); assert.equal(h.scrolls.length, 1, "Consume once");
    h.clock(); assert.equal(h.draw().highlightId, null); assert.equal(state.opacity.value, 0); h.unmount();
}
const stale = harness(); let state = stale.draw({ ready: true }); state.rowRef(stale.node(500)); state.onContentSizeChange(390, 2000); stale.frame();
stale.draw({ childId: "other", navKey: 2 }); stale.measure(); assert.equal(stale.scrolls.length, 0, "Old child callbacks cannot scroll");
assert.equal(stale.draw().id, null); stale.unmount();
const session = harness(); state = session.draw({ ready: true }); state.rowRef(session.node(500)); state.onContentSizeChange(390, 2000); session.frame();
session.epoch(); session.measure(); assert.equal(session.scrolls.length, 0, "Logout invalidates pending callbacks"); session.unmount();
const missing = harness(); state = missing.draw({ records: [] }); state.sectionRef(missing.node(120, 500)); state.onContentSizeChange(390, 2000); missing.frame(); missing.measure();
assert.equal(missing.messages.length, 0, "Loading/failure is not a missing record");
state = missing.draw({ ready: true }); missing.frame(); missing.measure(); assert.deepEqual(missing.messages, ["missing"]); assert.equal(missing.scrolls[0].y, 28); missing.unmount();
const aborted = harness(); state = aborted.draw({ ready: true }); state.rowRef(aborted.node(500)); state.onContentSizeChange(390, 2000); aborted.frame(); aborted.unmount(); aborted.measure(); assert.equal(aborted.scrolls.length, 0);
for (const request of [{}, { intent: "focus", sourceType: "vaccination", childId: "other", recordId: 42 },
    { intent: "focus", sourceType: "vaccination", childId: "baby", recordId: "tmp-create" }]) assert.equal(aborted.api.vaccinationFocusId(request, "baby"), null);
const { load } = require("./immunizationSummary.check.js");
const { revealImmunization, selectImmunizations } = load("immunizationSummary.js");
const records = Array.from({ length: 24 }, (_, i) => ({ id: String(i), vaccineName: "Same vaccine", status: i === 22 ? "scheduled" : "completed" }));
const old = { filter: "completed", search: "hidden text", visible: 10 };
const revealed = revealImmunization(records, old, "22"); assert.deepEqual(revealed, { filter: "all", search: "", visible: 23 });
assert(selectImmunizations(records, revealed.filter, revealed.search, revealed.visible).groups.flatMap(([, rows]) => rows).some(r => r.id === "22"));
assert.equal(revealImmunization(records, old, "missing"), old); assert.equal(old.search, "hidden text");
assert.equal(revealImmunization(records, { filter: "all", search: "Same", visible: 10 }, "22").search, "Same");
console.log("Vaccination focus checks passed: exact IDs, cold load/retry, pagination layout, filters, missing dose, scope guards, one-shot scroll and reduced-motion highlight.");
