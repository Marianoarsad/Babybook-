const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("@babel/parser");

// Exercise the actual motion hook with controllable animation completions.
const source = fs.readFileSync(path.join(__dirname, "ActionSheet.js"), "utf8");
const hook = parse(source, { sourceType: "module", plugins: ["jsx"] }).program.body
    .find((node) => node.id?.name === "useActionSheetMotion");

async function check(reduced = false) {
    const slots = [];
    let index = 0, dirty = false, effects = [], activeAnimation, preferenceListener;
    let visible = false, height = 575, closed = 0, selected = 0;
    const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
    const useState = (initial) => {
        const position = index++;
        slots[position] ??= { value: initial };
        return [slots[position].value, (value) => {
            if (!Object.is(slots[position].value, value)) dirty = true;
            slots[position].value = value;
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
        `${source.slice(hook.start, hook.end)}; return useActionSheetMotion;`)(
        useState, useRef, useMemo, (callback, deps) => useMemo(() => callback, deps), useEffect,
        Animated, { out: (value) => value, cubic: "cubic" }, { create: (handlers) => ({ panHandlers: handlers }) }, AccessibilityInfo);
    let motion;
    const close = () => { closed++; visible = false; };
    function render() {
        do {
            dirty = false;
            index = 0;
            motion = run(visible, height, close);
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
        return current;
    }
    function open() {
        visible = true; render();
        assert.equal(motion.presented, true);
        if (!reduced) { assert.equal(activeAnimation.steps[0].config.duration, 280); finish(); }
        assert.equal(motion.offset.value, 0);
    }
    render();
    await Promise.resolve(); render();
    assert.equal(motion.presented, false);
    open();
    const pan = motion.pan.panHandlers;
    const claims = (dx, dy) => pan.onMoveShouldSetPanResponder(null, { dx, dy });
    assert.equal(claims(0, 12), false);
    assert.equal(claims(40, 20), false);
    assert.equal(claims(0, -80), false);
    assert.equal(claims(0, 20), true);
    pan.onPanResponderGrant();
    pan.onPanResponderMove(null, { dy: 30 });
    assert.equal(motion.offset.value, 30);
    pan.onPanResponderRelease(null, { dy: 30, vy: 10 });
    if (!reduced) { assert.equal(activeAnimation.steps[0].config.duration, 160); finish(); }
    assert.equal(motion.offset.value, 0);
    assert.equal(closed, 0, "Velocity alone cannot dismiss a short pull");
    pan.onPanResponderGrant();
    pan.onPanResponderMove(null, { dy: height + 100 });
    assert.equal(motion.offset.value, height);
    pan.onPanResponderTerminate();
    if (!reduced) finish();
    assert.equal(motion.offset.value, 0);
    pan.onPanResponderGrant();
    pan.onPanResponderRelease(null, { dy: 64 });
    motion.dismiss();
    if (!reduced) { assert.equal(activeAnimation.steps[0].config.duration, 220); assert.equal(motion.presented, true); finish(); }
    render();
    assert.equal(closed, 1);
    assert.equal(motion.presented, false);
    open();
    motion.dismiss(() => { selected++; visible = false; });
    motion.dismiss(() => { selected++; });
    if (!reduced) { assert.equal(selected, 0); finish(); }
    render();
    assert.equal(selected, 1, "Selection happens once, after sliding out");
    assert.equal(motion.presented, false);

    if (!reduced) {
        open();
        motion.dismiss(() => { selected++; });
        const stale = activeAnimation;
        visible = false; render();
        visible = true; render(); finish();
        stale.callback({ finished: true });
        assert.equal(selected, 1, "Reopening cancels pending selection and stale completions");
        height = 400; render(); finish();
        assert.equal(motion.offset.value, 0);
        motion.dismiss();
        preferenceListener(true); render();
        assert.equal(closed, 2, "Changing reduced motion during an exit retains the close callback");
        preferenceListener(false); render();
        open();
        motion.dismiss(() => { selected++; });
        const interrupted = activeAnimation;
        slots.forEach((slot) => slot?.cleanup?.());
        interrupted.callback({ finished: true });
        assert.equal(selected, 1, "Unmount cancels pending actions");
    }
}

assert(source.includes('animationType="none"'));
assert(source.includes('<View {...motion.pan.panHandlers}'), "Drag handlers belong only to the header");
assert(!/<ScrollView[^>]*panHandlers/.test(source));
(async () => {
    await check(); await check(true);
    console.log("Action sheet motion checks passed: drag thresholds, recovery, deferred callbacks, interruptions, resizing and reduced motion.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
