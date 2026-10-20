// node components/ui/PullToRefreshScrollView.check.js — no device, server or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const { transformFromAstSync } = require('@babel/core');
const traverse = require('@babel/traverse').default;
const { runtime, find, flush } = require('../NotificationMenu.check');

function visit(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const value of Object.values(node)) {
        for (const child of Array.isArray(value) ? value : [value]) {
            const result = visit(child, predicate); if (result) return result;
        }
    }
    return null;
}
function callback(ast, name, env) {
    const declaration = visit(ast, (node) => node.type === 'VariableDeclarator' && node.id.name === name);
    assert(declaration, name);
    const expression = declaration.init.arguments[0];
    const { code } = transformFromAstSync({ type: 'File', program: { type: 'Program', sourceType: 'script',
        body: [{ type: 'ExpressionStatement', expression }] } }, null, { babelrc: false, configFile: false });
    return new Function(...Object.keys(env), `return ${code}`)(...Object.values(env));
}

async function gestures() {
    for (const platform of ['ios', 'web']) {
        const h = runtime(); h.platform(platform);
        const Screen = h.load('ui/PullToRefreshScrollView.js').default;
        let calls = 0, finish;
        const consumerRef = { current: null };
        const props = { scope: 42, scrollRef: consumerRef, refreshing: false, onRefresh: () => {
            calls++; return new Promise((resolve) => finish = resolve);
        }, children: ['Content'] };
        const render = () => h.render(() => Screen(props));
        let tree = render(); const unmount = h.mount(tree); await flush(); tree = render();
        assert(consumerRef.current, 'Consumer receives the same mounted scroll handle used by pull-to-refresh');
        const pan = find(tree, (n) => n.props.onMoveShouldSetPanResponderCapture).props;
        const scroll = () => find(render(), (n) => n.type === 'ScrollView');
        const qualifies = () => pan.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 90, numberActiveTouches: 1 });
        const offset = (y) => { if (platform === 'web') h.dom.scrollTop = y;
            scroll().props.onScroll({ nativeEvent: { contentOffset: { y } } }); };
        assert.equal(scroll().children[0].props.accessibilityRole, 'progressbar', 'Tabs place the indicator above content');
        assert.equal(scroll().props.refreshControl, undefined);
        const arrow = find(tree, (n) => n.type === 'Svg');
        assert.equal(arrow.props.accessible, platform === 'web' ? undefined : false,
            'Decorative SVG must not forward a boolean accessible attribute to the DOM');
        if (platform === 'web') assert.equal(arrow.props['aria-hidden'], true);
        offset(120); pan.onStartShouldSetPanResponderCapture(); offset(0);
        assert.equal(qualifies(), false, 'Reaching zero during a below-top gesture never arms refresh');
        if (platform === 'web') {
            h.dom.scrollTop = 120; pan.onStartShouldSetPanResponderCapture(); h.dom.scrollTop = 0;
            assert.equal(qualifies(), false, 'DOM offset wins over a stale scroll event');
            const touch = (y) => ({ touches: [{ clientX: 0, clientY: y }], cancelable: true,
                preventDefault: () => assert.fail('Below-top scrolling must not be prevented') });
            h.dom.scrollTop = 80; h.domHandlers.get('touchstart').fn(touch(0)); h.dom.scrollTop = 0;
            h.domHandlers.get('touchmove').fn(touch(100)); h.domHandlers.get('touchend').fn();
            assert.equal(calls, 0);
            h.dom.contains = (target) => target.inside;
            pan.onStartShouldSetPanResponderCapture({ target: { inside: false } });
            assert.equal(qualifies(), false, 'Portalled modal gestures are never captured');
            pan.onStartShouldSetPanResponderCapture({ target: { inside: true, tagName: 'INPUT', parentElement: h.dom } });
            assert.equal(qualifies(), false, 'Input gestures stay with the input');
            const oldWindow = global.window;
            global.window = { getComputedStyle: () => ({ overflowY: 'scroll' }) };
            pan.onStartShouldSetPanResponderCapture({ target: { inside: true, scrollHeight: 200, clientHeight: 100, parentElement: h.dom } });
            assert.equal(qualifies(), false, 'Nested scroll controls keep their own gestures');
            if (oldWindow === undefined) delete global.window; else global.window = oldWindow;
        }
        props.blocked = true; render(); pan.onStartShouldSetPanResponderCapture(); assert.equal(qualifies(), false);
        props.blocked = false; render(); pan.onStartShouldSetPanResponderCapture(); assert(qualifies());
        pan.onPanResponderGrant(null, { dy: 90 }); pan.onPanResponderRelease(); assert.equal(calls, 1);
        assert.equal(scroll().props.scrollEnabled, true, 'Content remains scrollable while refreshing');
        pan.onStartShouldSetPanResponderCapture(); assert.equal(qualifies(), false);
        props.scope = 43; render(); h.effects().at(-1)(); finish(); await flush();
        assert.equal(find(render(), (n) => n.props.accessibilityRole === 'progressbar').props.style[1].height.value, 0,
            'Old-child completion cannot revive the indicator');
        unmount();
    }
}

const cases = [
    ['Dashboard', 'loadDashboard', ['vaccinations', 'checkups', 'nutrition', 'milestones', 'medical-history', 'calendar-events', 'shares', 'growth', 'memories']],
    ['Health', 'loadHealth', ['vaccinations', 'checkups', 'calendar-plan-statuses', 'medical-history', 'medication-doses', 'attachments']],
    ['Growth', 'loadGrowth', ['milestones', 'growth', 'memories']],
    ['NutritionTracker', 'loadNutrition', ['nutrition']],
    ['CalendarView', 'fetchEvents', ['vaccinations', 'checkups', 'medical-history', 'calendar-events', 'calendar-plan-statuses']],
];
async function loads() {
    for (const [name, loader, expected] of cases) {
        const source = fs.readFileSync(path.join(__dirname, '..', `${name}.js`), 'utf8');
        const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
        traverse(ast, { ReferencedIdentifier(p) {
            assert(p.scope.hasBinding(p.node.name) || ['setInterval', 'clearInterval'].includes(p.node.name),
                `${name}:${p.node.loc.start.line} references undefined ${p.node.name}`);
        } });
        const root = visit(ast, (n) => n.type === 'JSXOpeningElement' && n.name.name === 'PullToRefreshScrollView');
        assert(root, `${name} uses the shared scroll view`);
        for (const prop of ['scope', 'refreshing', 'onRefresh']) assert(root.attributes.some((a) => a.name?.name === prop));
        assert(!source.includes('useRefreshControl'), 'No competing native refresh control');
        assert(source.includes('useScreenRefresh('), 'Use existing scoped refresh ownership');
        const requests = new Map(), updates = [];
        let active = true;
        const read = (child, resource, options) => {
            assert.equal(child, 42); assert.equal(options.loading, 'nonblocking');
            assert(!requests.has(resource), `${name} requests ${resource} only once per batch`);
            return new Promise((resolve, reject) => requests.set(resource, { resolve, reject }));
        };
        const env = { profile: { id: 42 }, id: 42, childId: 42,
            api: { listRecords: read, listShares: (child, options) => read(child, 'shares', options),
                listAttachments: (child, options) => read(child, 'attachments', options) },
            currentChild: { current: 42 }, refreshGuard: { current: () => active }, CONDITION_CATEGORIES: [],
            vaccinationToApp: (r) => r, checkupToApp: (r) => r, medHistoryToIllness: (r) => r, medHistoryToMed: (r) => r };
        for (const setter of ['setVaccines', 'setAppts', 'setConditions', 'setMedications', 'setHospitalizations',
            'setAttachMap', 'setBundleShares', 'setVaxLoading', 'setApptsLoading', 'setHistLoading', 'setAttachLoading']) {
            env[setter] = (value) => updates.push([setter, value]);
        }
        if (name === 'Dashboard') for (const helper of ['loadActivityBundle', 'loadGrowth', 'loadMemories']) env[helper] = callback(ast, helper, env);
        if (name === 'Health') for (const helper of ['loadVaccines', 'loadAppts', 'loadMedHistory', 'loadDoses', 'loadAttachments']) env[helper] = callback(ast, helper, env);
        const run = callback(ast, loader, env);
        let done = false;
        const pending = run(() => active).then((failures) => { done = true; return failures; }, () => { done = true; return ['load']; });
        assert.deepEqual([...requests.keys()], expected);
        requests.get(expected[0]).reject(Error('Offline'));
        for (const resource of expected.slice(1, -1)) requests.get(resource).resolve([]);
        await flush(); assert.equal(done, name === 'NutritionTracker', 'Batch waits for every read, including after failures');
        if (expected.length > 1) requests.get(expected.at(-1)).resolve([]);
        assert((await pending).length, `${name} exposes errors for Retry`);
        if (name === 'Health') {
            requests.clear(); updates.length = 0;
            const stale = run(() => active); active = false; const before = updates.length;
            requests.forEach((request) => request.resolve([])); await stale;
            assert.equal(updates.length, before, 'Stale Health responses never update local state');
        }
        if (name === 'Dashboard') {
            requests.clear(); updates.length = 0;
            const next = run(() => active);
            requests.forEach((request, resource) => resource === 'shares' ? request.reject(Error('Offline')) : request.resolve([]));
            await next;
            assert(!updates.some(([setter]) => setter === 'setBundleShares'), 'Failed share read retains cached summaries');
        }
    }
}

module.exports = { gestures };
if (require.main === module) (async () => {
    await gestures(); await loads();
    console.log('Tab refresh checks passed: strict gesture-start top gating, web DOM offsets, shared indicator, blocking/duplicates, child changes, five complete awaitable batches and cached failures.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
