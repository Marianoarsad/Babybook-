const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("@babel/parser");

const source = fs.readFileSync(path.join(__dirname, "useBottomSheetMotion.js"), "utf8");
const sheetSource = fs.readFileSync(path.join(__dirname, "ActionSheet.js"), "utf8");
const medicalEventSource = fs.readFileSync(path.join(__dirname, "MedicalEventModal.js"), "utf8");
assert(sheetSource.includes('illness: { label: "Condition"'));
assert(medicalEventSource.includes('isCondition ? "Log a condition" : copy.modalTitle'));
const body = parse(source, { sourceType: "module", plugins: ["jsx"] }).program.body;
const hook = body.map((node) => node.declaration || node).find((node) => node.id?.name === "useBottomSheetMotion");

async function check(reduced = false) {
    const slots = [];
    let index = 0, dirty = false, effects = [], activeAnimation, preferenceListener;
    let visible = false, gestureEnabled = true, closed = 0;
    const collapsedHeight = 575, expandedHeight = 640;
    const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
    const useState = (initial) => {
        const position = index++;
        slots[position] ??= { value: initial };
        return [slots[position].value, (value) => {
            const next = typeof value === "function" ? value(slots[position].value) : value;
            if (!Object.is(slots[position].value, next)) dirty = true;
            slots[position].value = next;
        }];
    };
    const useRef = (initial) => { const position = index++; return slots[position] ??= { current: initial }; };
    const useMemo = (create, deps) => {
        const position = index++;
        if (!same(slots[position]?.deps, deps)) slots[position] = { deps, value: create() };
        return slots[position].value;
    };
    const useEffect = (create, deps) => {
        const position = index++;
        if (!same(slots[position]?.deps, deps)) effects.push(() => {
            slots[position]?.cleanup?.();
            slots[position] = { deps, cleanup: create() };
        });
    };
    const Animated = {
        Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } },
        timing: (value, config) => ({ value, config }),
        parallel: (steps) => ({
            start(callback) { this.callback = callback; this.steps = steps; activeAnimation = this; },
            stop() { this.callback?.({ finished: false }); },
        }),
    };
    const AccessibilityInfo = {
        isReduceMotionEnabled: async () => reduced,
        addEventListener: (_name, callback) => { preferenceListener = callback; return { remove() {} }; },
    };
    const run = new Function("useState", "useRef", "useMemo", "useCallback", "useEffect", "Animated", "Easing", "PanResponder", "AccessibilityInfo",
        `const OPEN_MS=280,CLOSE_MS=220,SETTLE_MS=160,DRAG_CAPTURE=12,DETENT_THRESHOLD=64;${source.slice(hook.start, hook.end)}; return useBottomSheetMotion;`)(
        useState, useRef, useMemo, (callback, deps) => useMemo(() => callback, deps), useEffect,
        Animated, { out: (value) => value, cubic: "cubic" }, { create: (handlers) => ({ panHandlers: handlers }) }, AccessibilityInfo);
    let motion;
    const close = () => { closed++; visible = false; };
    function render() {
        do {
            dirty = false;
            index = 0;
            motion = run({ visible, collapsedHeight, expandedHeight, onClose: close, gestureEnabled });
            const pending = effects; effects = [];
            pending.forEach((effect) => effect());
        } while (dirty);
        return motion;
    }
    function finish() {
        const current = activeAnimation;
        current.steps.forEach(({ value, config }) => value.setValue(config.toValue));
        current.callback({ finished: true });
        render();
    }
    render();
    await Promise.resolve(); render();
    assert.equal(motion.presented, false);
    visible = true; render();
    assert.equal(motion.presented, true);
    if (!reduced) {
        assert.equal(motion.height.value, 0);
        motion.startOpening();
        assert.equal(activeAnimation.steps[0].config.duration, 280);
        finish();
    }
    assert.equal(motion.height.value, collapsedHeight);

    const pan = motion.pan.panHandlers;
    assert.equal(pan.onMoveShouldSetPanResponder(null, { dx: 0, dy: 12 }), false);
    assert.equal(pan.onMoveShouldSetPanResponder(null, { dx: 40, dy: 20 }), false);
    assert.equal(pan.onMoveShouldSetPanResponder(null, { dx: 0, dy: -20 }), true);
    pan.onPanResponderGrant();
    pan.onPanResponderMove(null, { dy: -80 });
    assert.equal(motion.height.value, expandedHeight);
    pan.onPanResponderRelease(null, { dy: -64 });
    if (!reduced) finish();
    assert.equal(motion.height.value, expandedHeight, "An upward header swipe expands to the 80% detent");

    pan.onPanResponderGrant();
    pan.onPanResponderMove(null, { dy: 30 });
    pan.onPanResponderRelease(null, { dy: 30, vy: 10 });
    if (!reduced) finish();
    assert.equal(motion.height.value, expandedHeight, "A short swipe recovers regardless of velocity");
    assert.equal(closed, 0);

    pan.onPanResponderGrant();
    pan.onPanResponderRelease(null, { dy: 64 });
    if (!reduced) {
        assert.equal(activeAnimation.steps[0].config.duration, 220);
        finish();
    }
    render();
    assert.equal(closed, 1, "A downward header swipe closes from the expanded detent");
    assert.equal(motion.presented, false);

    visible = true; render();
    if (!reduced) { motion.startOpening(); finish(); }
    gestureEnabled = false; render();
    assert.equal(motion.pan.panHandlers.onMoveShouldSetPanResponder(null, { dx: 0, dy: 80 }), false,
        "Busy and non-dismissible forms do not capture close gestures");
    preferenceListener?.(reduced);
}

const actionSheet = fs.readFileSync(path.join(__dirname, "ActionSheet.js"), "utf8");
const recordSheet = fs.readFileSync(path.join(__dirname, "RecordFormSheet.js"), "utf8");
for (const consumer of [actionSheet, recordSheet]) {
    assert(consumer.includes("useBottomSheetMotion"));
    assert(consumer.includes("expandedSheetHeight"));
    assert(consumer.includes("onShow={motion.startOpening}"));
    assert(consumer.includes("...motion.pan.panHandlers"));
}
assert(actionSheet.includes("height: motion.height"));
assert(recordSheet.includes("height: motion.height"));
assert(!actionSheet.includes("motion.offset"));
assert(!recordSheet.includes("motion.offset"));
for (const consumer of [actionSheet, recordSheet]) {
    assert.equal((consumer.match(/style=\{styles\.grabber\}/g) || []).length, 2, "Each sheet shows a double grabber");
    assert(consumer.includes("width: 43.2"), "Grabbers are 20% wider than the original 36 dp");
}
assert(recordSheet.includes("gestureEnabled: canDismiss"));
assert(recordSheet.includes("canDismiss && motion.dismiss()"));

(async () => {
    await check();
    await check(true);
    console.log("Bottom sheet checks passed: staged entrance, 80% expansion, recovery, downward close, locks and reduced motion.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
