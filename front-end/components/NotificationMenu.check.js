// node components/NotificationMenu.check.js — no server, database or device.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('@babel/core');
const { parse } = require('@babel/parser');
const compile = (source) => transformSync(source, { babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs'), require.resolve('@babel/plugin-transform-react-jsx')] }).code;
let epoch = 1, calls = 0, failSync = false, failRead = false, delaySync, delayRead, delayMedical, failSave = false, commitThenFail = false;
let medicine = { id: 11, child_id: 42, category: 'Medication', title: 'Medicine', date_recorded: '2026-09-01', course_days: 5, resolved: false };
let medicalRows = [medicine], saveCalls = 0, toastCalls = 0, refreshCalls = 0, unseen = 0;
let data = Array.from({ length: 15 }, (_, index) => ({ id: index + 1, kind: 'medication_dose', title: 'Medication Reminder', subtitle: 'Medicine',
    occurredAt: '2026-10-05T01:00:00Z', readAt: null, source: { type: 'medical-history', record: medicine } }));
const accessRow = { id: 51, child_id: 42, professional_name: 'Viewer', access_date: '2026-10-05T01:00:00Z' };
let accessRows = [accessRow];
const api = {
    syncNotifications: async () => { if (delaySync) await delaySync; if (failSync) throw Error('Offline'); },
    listNotifications: async (child, { filter, cursor, limit = 10 }) => {
        const own = data.filter((row) => row.source.record.child_id === child);
        const filtered = own.filter((row) => filter !== 'unread' || !row.readAt).sort((a, b) => b.id - a.id);
        const offset = Number(cursor || 0), rows = filtered.slice(offset, offset + limit);
        return { rows, nextCursor: offset + rows.length < filtered.length ? String(offset + rows.length) : null,
            unreadCount: own.filter((row) => !row.readAt).length, total: own.length };
    },
    unseenAccessLog: async (child) => ({ rows: accessRows.filter((row) => row.child_id === child) }),
    markNotificationRead: async (_, id) => {
        calls++; if (delayRead) await delayRead; if (failRead) throw Error('Offline');
        data = data.map((row) => row.id === id ? { ...row, readAt: '2026-10-05T02:00:00Z' } : row);
        return { id, readAt: '2026-10-05T02:00:00Z' };
    },
    listRecords: async () => { if (delayMedical) await delayMedical; return medicalRows; },
    saveRecord: async (_, resource, id, body) => {
        assert.equal(resource, 'medical-history'); saveCalls++;
        if (!failSave || commitThenFail) medicalRows = medicalRows.map((row) => row.id === id ? { ...row, ...body } : row);
        if (failSave) throw Error('Save interrupted. Retry.');
    },
};
const themeModule = { exports: {} };
new Function('module', 'exports', compile(fs.readFileSync(path.join(__dirname, '../theme.js'), 'utf8')))(themeModule, themeModule.exports);
const theme = themeModule.exports;
function runtime() {
    let states = [], refs = [], effects = [], cursor = 0, refCursor = 0;
    let os = 'ios', reduced = false, animations = [], announcements = [], reduceListener, headerScrolls = 0;
    const domHandlers = new Map(), dom = { addEventListener: (name, fn, options) => domHandlers.set(name, { fn, options }), removeEventListener: (name) => domHandlers.delete(name) };
    const React = {
        Fragment: 'Fragment', createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter((child) => child != null && child !== false) }),
        useState: (initial) => { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
            return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
        useRef: (initial) => refs[refCursor++] ||= { current: initial }, useMemo: (fn) => fn(), useCallback: (fn) => fn,
        useEffect: (fn) => effects.push(fn),
    };
    let colors = theme.paletteFor(undefined, 'girl', 'light');
    class Value {
        constructor(value) { this.value = value; }
        setValue(value) { this.value = value; }
        interpolate(config) { return { value: this.value, ...config }; }
    }
    const timing = (value, config) => {
        const animation = { start: (done) => { value.setValue(config.toValue); done?.({ finished: true }); }, stop() {}, config };
        animations.push(animation); return animation;
    };
    const sharedScroll = () => headerScrolls++;
    const native = { View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Platform: { get OS() { return os; } },
        Easing: { out: (fn) => fn, cubic: 'cubic', linear: 'linear' }, PanResponder: { create: (handlers) => ({ panHandlers: handlers }) },
        AccessibilityInfo: { isReduceMotionEnabled: async () => reduced, addEventListener: (_, fn) => { reduceListener = fn; return { remove() {} }; }, announceForAccessibility: (message) => announcements.push(message) },
        Animated: { ScrollView: 'ScrollView', View: 'AnimatedView', Value, timing,
            forkEvent: (event, listener) => (...args) => { event?.(...args); listener(...args); }, unforkEvent() {},
            parallel: (items) => ({ start: (done) => { items.forEach((item) => item.start()); done?.({ finished: true }); }, stop() {} }),
            loop: (item) => ({ start() { animations.push({ loop: true, config: item.config }); }, stop() { animations.push({ stopped: true }); } }) },
        StyleSheet: { create: (value) => value, hairlineWidth: 1 }, AppState: { addEventListener: () => ({ remove() {} }) } };
    const mocks = {
        react: React, 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
        'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
        './common/Cards': { ListEntryCard: 'Row', EmptyStateCard: 'Empty' }, './ui/AnimatedReveal': { __esModule: true, default: 'Reveal' },
        './ui/MedicationIcon': { __esModule: true, default: 'MedicationIcon' },
        './ui/VaccineIcon': { __esModule: true, default: 'VaccineIcon' },
        './ui/GlassHeaderButton': { __esModule: true, default: 'GlassHeaderButton' },
        './ui/ShowMore': { __esModule: true, default: 'More' }, './ui/Skeleton': { AppointmentsSkeleton: 'Skeleton' },
        './ui/useRefreshControl': { useRefreshControl: () => undefined }, './ui/RecordFormSheet': { __esModule: true, default: 'Sheet', RecordFormGroup: 'Group' },
        './ui/PlanDetail': { __esModule: true, default: 'Detail' }, './ui/DateField': { DateField: 'Date' },
    };
    const cache = new Map();
    function load(file) {
        file = path.resolve(__dirname, file); if (cache.has(file)) return cache.get(file).exports;
        const mod = { exports: {} }; cache.set(file, mod);
        function requireMock(name) {
            if (name in mocks) return mocks[name];
            if (name.endsWith('/ThemeContext')) return { useTheme: () => ({ colors }) };
            if (name.endsWith('/ScrollContext')) return { useScroll: (ref) => ({ scrollProps: { onScroll: sharedScroll }, scrollViewRef: (node) => { if (ref) ref.current = node; } }) };
            if (name.endsWith('/responsive')) return { useScreenPadTop: () => 80, useScreenPadBottom: () => 90 };
            if (name.endsWith('/api')) return { api };
            if (name.endsWith('/recordStore.cjs')) return { __esModule: true, default: { getEpoch: () => epoch } };
            if (name.endsWith('/useRecords')) return { useSessionEpoch: () => epoch };
            if (name.endsWith('/Toast')) return { useToast: () => ({ info: () => toastCalls++, success() {} }) };
            const dependency = path.resolve(path.dirname(file), name + (path.extname(name) ? '' : '.js'));
            const exports = load(dependency);
            return name.endsWith('/dates') ? { ...exports, todayLocal: () => '2026-10-05' } : exports;
        }
        new Function('require', 'module', 'exports', 'setInterval', 'clearInterval', compile(fs.readFileSync(file, 'utf8')))(requireMock, mod, mod.exports, () => 1, () => {});
        return mod.exports;
    }
    return { load, render: (fn) => { cursor = 0; refCursor = 0; effects = []; return fn(); }, effect: () => effects[0](),
        mount: (tree) => { const scroll = find(tree, (node) => node.type === 'ScrollView');
            if (typeof scroll?.props.ref === 'function') scroll.props.ref({ getScrollableNode: () => dom });
            else if (scroll?.props.ref) scroll.props.ref.current = { getScrollableNode: () => dom };
            const cleanup = effects.map((fn) => fn()); return () => cleanup.forEach((fn) => fn?.()); },
        effects: () => effects, domHandlers, dom, animations, announcements, platform: (next) => os = next,
        reduceMotion: (next) => { reduced = next; reduceListener?.(next); }, headerScrolls: () => headerScrolls,
        palette: (gender, scheme) => { colors = theme.paletteFor(undefined, gender, scheme); return colors; } };
}
const nodes = (tree) => tree && typeof tree === 'object' ? [tree, ...(tree.children || []).flatMap(nodes)] : [];
const find = (tree, predicate) => nodes(tree).find(predicate);
const flush = () => new Promise(setImmediate);
async function checkPullRefresh() {
    const h = runtime(), Screen = h.load('Notifications.js').default;
    let refreshes = 0, finish;
    const props = { profile: { id: 42 }, onNavigate() {}, inbox: { rows: [], filter: 'unread', loaded: true, refreshing: false,
        selectFilter() {}, refresh: () => { refreshes++; return new Promise((resolve) => finish = resolve); } } };
    const render = () => h.render(() => Screen(props));
    let tree = render(); const unmount = h.mount(tree); await flush(); tree = render();
    const pan = find(tree, (n) => n.props.onMoveShouldSetPanResponderCapture).props;
    const scroll = () => find(render(), (n) => n.type === 'ScrollView');
    const indicator = () => find(render(), (n) => n.props.accessibilityRole === 'progressbar');
    const begin = () => {
        assert.equal(pan.onStartShouldSetPanResponderCapture(), false, 'Taps are not intercepted');
        assert(pan.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 10, numberActiveTouches: 1 }));
        pan.onPanResponderGrant(null, { dy: 0 });
    };
    const move = (dy, touches = 1) => pan.onPanResponderMove(null, { dy, numberActiveTouches: touches });
    assert.equal(scroll().props.refreshControl, undefined, 'No duplicate native refresh indicator');
    assert.equal(find(tree, (n) => n.props.accessibilityLabel === 'Retry refreshing notifications'), undefined);
    assert.equal(scroll().children[0].props.accessibilityRole, 'tablist');
    assert.equal(scroll().children[1].props.accessibilityRole, 'progressbar', 'Indicator follows All/Unread');
    begin(); move(40);
    assert.equal(indicator().props.style[1].height.value, 24); assert.equal(scroll().props.scrollEnabled, false);
    assert.equal(find(render(), (n) => n.type === 'Path').props.strokeWidth, 2.2);
    const rotating = indicator().children[0].props.style.transform[0].rotate;
    assert.equal(rotating.value, 0.5, 'Rotation follows pull distance');
    move(85); assert.equal(find(render(), (n) => n.type === 'Path').props.strokeWidth, 3.6);
    assert(h.announcements.includes('Release to refresh'));
    move(40); assert.equal(find(render(), (n) => n.type === 'Path').props.strokeWidth, 2.2, 'Pulling back disarms refresh');
    pan.onPanResponderRelease(); assert.equal(refreshes, 0); assert.equal(indicator().props.style[1].height.value, 0);
    assert.equal(scroll().props.scrollEnabled, true); assert(h.animations.some((a) => a.config?.duration === 220));
    begin(); move(90); pan.onPanResponderTerminate(); assert.equal(refreshes, 0);
    begin(); move(35); move(40, 2); move(90); pan.onPanResponderRelease(); assert.equal(refreshes, 0, 'Multitouch cancels rather than refreshing');
    begin(); move(90); pan.onPanResponderStart(null, { numberActiveTouches: 2 }); pan.onPanResponderRelease();
    assert.equal(refreshes, 0, 'An added finger cancels immediately, even without another move');
    pan.onStartShouldSetPanResponderCapture();
    assert.equal(pan.onMoveShouldSetPanResponderCapture(null, { dx: 40, dy: 10, numberActiveTouches: 1 }), false);
    assert.equal(pan.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 90, numberActiveTouches: 1 }), false, 'Horizontal-start gestures stay with their original control');
    pan.onStartShouldSetPanResponderCapture();
    assert.equal(pan.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: -40, numberActiveTouches: 1 }), false);
    scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } }); pan.onStartShouldSetPanResponderCapture();
    assert.equal(pan.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 90, numberActiveTouches: 1 }), false);
    assert.equal(h.headerScrolls(), 1, 'Scroll still drives the global header');
    scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
    props.inbox.loadingMore = true; render(); pan.onStartShouldSetPanResponderCapture();
    assert.equal(pan.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 90, numberActiveTouches: 1 }), false);
    props.inbox.loadingMore = false; render(); begin(); move(80); pan.onPanResponderRelease();
    assert.equal(refreshes, 1); assert.equal(indicator().props.style[1].height.value, 48);
    assert.equal(scroll().props.scrollEnabled, true, 'Reading remains scrollable during refresh');
    render(); const stopSpin = h.effects()[3]();
    assert(h.animations.some((a) => a.loop && a.config.duration === 900));
    pan.onPanResponderRelease(); pan.onStartShouldSetPanResponderCapture();
    assert.equal(pan.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 90, numberActiveTouches: 1 }), false);
    assert.equal(refreshes, 1, 'One request per refresh');
    props.inbox.refreshing = true; render(); finish(); await flush();
    assert.equal(indicator().props.style[1].height.value, 48, 'Hold until the current inbox refresh ends');
    props.inbox.refreshing = false; render(); h.effects()[4](); stopSpin();
    assert.equal(indicator().props.style[1].height.value, 0);
    h.reduceMotion(true); render(); const animationCount = h.animations.length;
    begin(); move(40); assert.equal(indicator().children[0].props.style.transform[0].rotate, '0deg');
    pan.onPanResponderRelease(); assert.equal(h.animations.length, animationCount, 'Reduced motion settles without animation');
    props.inbox.refresh = async () => { refreshes++; throw Error('Offline'); }; render();
    begin(); move(85); pan.onPanResponderRelease(); await flush(); tree = render();
    assert(find(tree, (n) => n.props.accessibilityLabel === 'Retry refreshing notifications'));
    assert.equal(scroll().props.scrollEnabled, true, 'Refresh failure restores scrolling');
    await find(tree, (n) => n.props.accessibilityLabel === 'Retry refreshing notifications').props.onPress(); assert.equal(refreshes, 3);
    for (const gender of ['girl', 'boy', 'neutral']) for (const scheme of ['light', 'dark']) {
        const colors = h.palette(gender, scheme); assert.equal(find(render(), (n) => n.type === 'Path').props.stroke, colors.primary);
        assert.equal(indicator().props.style[0].alignItems, 'center');
    }
    props.inbox.refresh = () => { refreshes++; return new Promise((resolve) => finish = resolve); }; render();
    begin(); move(90); pan.onPanResponderRelease(); unmount(); finish(); await flush();
    pan.onStartShouldSetPanResponderCapture();
    assert.equal(pan.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 90, numberActiveTouches: 1 }), false, 'Unmounted screen ignores gestures');

    const web = runtime(); web.platform('web'); const WebScreen = web.load('Notifications.js').default;
    let webRefreshes = 0, prevented = 0;
    const webProps = { ...props, inbox: { ...props.inbox, error: '', refreshing: false, refresh: async () => webRefreshes++ } };
    const webRender = () => web.render(() => WebScreen(webProps));
    tree = webRender(); const webUnmount = web.mount(tree); await flush(); tree = webRender();
    assert.equal(web.domHandlers.get('touchmove').options.passive, false, 'Browser touch move can prevent native page refresh');
    const touch = (x, y) => ({ touches: [{ clientX: x, clientY: y }], cancelable: true, preventDefault: () => prevented++ });
    web.domHandlers.get('touchstart').fn(touch(10, 100));
    web.domHandlers.get('touchmove').fn(touch(12, 145));
    const webPan = find(webRender(), (n) => n.props.onMoveShouldSetPanResponderCapture).props;
    assert.equal(webPan.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 45, numberActiveTouches: 1 }), false, 'Browser touch has only one gesture owner');
    web.domHandlers.get('touchmove').fn(touch(12, 190)); web.domHandlers.get('touchend').fn(); await flush();
    assert.equal(webRefreshes, 1); assert.equal(prevented, 2);
    find(webRender(), (n) => n.type === 'ScrollView').props.onScroll({ nativeEvent: { contentOffset: { y: 50 } } });
    web.domHandlers.get('touchstart').fn(touch(10, 100)); web.domHandlers.get('touchmove').fn(touch(10, 190)); web.domHandlers.get('touchend').fn();
    assert.equal(prevented, 2, 'Normal browser scrolling is not prevented'); assert.equal(webRefreshes, 1);
    find(webRender(), (n) => n.type === 'ScrollView').props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
    web.domHandlers.get('touchstart').fn(touch(10, 100)); web.domHandlers.get('touchmove').fn(touch(10, 190)); web.domHandlers.get('touchcancel').fn();
    assert.equal(webRefreshes, 1, 'Cancelled browser pull does not refresh');
    web.domHandlers.get('touchstart').fn(touch(10, 100)); web.domHandlers.get('touchmove').fn(touch(10, 190));
    web.domHandlers.get('touchstart').fn({ touches: [{ clientX: 10, clientY: 190 }, { clientX: 40, clientY: 190 }] });
    web.domHandlers.get('touchend').fn(); assert.equal(webRefreshes, 1, 'Added browser touch cancels an armed pull');
    webPan.onStartShouldSetPanResponderCapture(); assert(webPan.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 10, numberActiveTouches: 1 }));
    webPan.onPanResponderGrant(null, { dy: 0 }); webPan.onPanResponderMove(null, { dy: 90, numberActiveTouches: 1 }); webPan.onPanResponderRelease(); await flush();
    assert.equal(webRefreshes, 2, 'Desktop pointer dragging also refreshes');
    webUnmount(); assert.equal(web.domHandlers.size, 0, 'DOM listeners are removed on navigation');
}
async function main() {
    const hooks = runtime(), useInbox = hooks.load('../utils/useNotificationInbox.js').default;
    const onUnseen = (n) => unseen = n;
    let child = 42, hook;
    const renderHook = () => hook = hooks.render(() => useInbox(child, onUnseen));
    renderHook(); const cleanup = hooks.effect(); await flush(); renderHook();
    assert.equal(hook.rows.length, 10); assert.equal(hook.unreadCount, 15); assert.equal(unseen, 1); assert.equal(toastCalls, 0);
    assert.equal(calls, 0, 'Opening/loading alone never marks read');
    await hook.loadMore(); renderHook(); assert.equal(hook.rows.length, 15); assert.equal(hook.cursor, null);
    hook.selectFilter('unread'); renderHook(); assert.equal(hook.rows.length, 0, 'Filter switches do not display stale rows');
    await flush(); renderHook(); assert.equal(hook.filter, 'unread');
    await hook.markRead(hook.rows[0]); renderHook(); assert.equal(hook.unreadCount, 14); assert.equal(hook.rows.length, 9);
    failRead = true; await hook.markRead(hook.rows[0]); renderHook(); assert.equal(hook.unreadCount, 14); assert(hook.error); failRead = false;
    let release; delayRead = new Promise((resolve) => release = resolve);
    const beforeCalls = calls, row = hook.rows[0], pending = hook.markRead(row);
    assert.equal(await hook.markRead(row), false); release(); await pending; delayRead = null; renderHook();
    assert.equal(calls, beforeCalls + 1, 'Double taps make one write'); assert.equal(hook.unreadCount, 13);
    data = data.map((row) => row.id === 3 ? { ...row, readAt: 'read on another device' } : row);
    accessRows.push({ ...accessRow, id: 52 }); await hook.refresh(); renderHook();
    assert.equal(hook.unreadCount, 12); assert.equal(toastCalls, 1); assert.equal(unseen, 2);
    failSync = true; await hook.refresh(); renderHook(); assert(hook.loaded && hook.rows.length && hook.error); failSync = false;
    delaySync = new Promise((resolve) => release = resolve); const stale = hook.refresh();
    child = 43; renderHook(); assert.equal(hook.rows.length, 0); assert.equal(hook.unreadCount, 0);
    cleanup(); release(); await stale; delaySync = null; renderHook(); assert.equal(hook.rows.length, 0);

    const ui = runtime(), module = ui.load('Notifications.js'), bell = ui.load('NotificationMenu.js').default;
    const blurTarget = { current: "header-background" };
    let opened = 0; const bellTree = ui.render(() => bell({ count: 13, onOpen: () => opened++, blurTarget }));
    assert.equal(bellTree.props.blurTarget, blurTarget);
    assert.equal(bellTree.props.accessibilityLabel, 'Notifications, 13 unread'); bellTree.props.onPress(); assert.equal(opened, 1);
    const today = new Date('2026-10-05T12:00:00'), yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const grouped = module.notificationGroups([{ occurredAt: today.toISOString() }, { occurredAt: yesterday.toISOString() }, { occurredAt: null }], today);
    assert(grouped[0].title.startsWith('Today')); assert(grouped[1].title.startsWith('Yesterday')); assert.equal(grouped[2].key, 'undated');
    const course = { id: 20, kind: 'course_ended', title: 'Confirm Medication Completion', subtitle: 'Medicine', occurredAt: today.toISOString(), canComplete: true, source: { type: 'medical-history', record: medicine } };
    const accessNotice = { id: 21, kind: 'shared_access', title: 'Records Viewed', subtitle: 'Viewer', occurredAt: today.toISOString(), source: { type: 'access-log', record: accessRow } };
    let navigated, readCount = 0;
    const props = { profile: { id: 42 }, onNavigate: (...args) => navigated = args, inbox: { rows: [course, accessNotice], filter: 'all', loaded: true, refreshing: false,
        markRead: async () => { readCount++; return true; }, selectFilter() {}, refresh: () => refreshCalls++ } };
    const renderScreen = () => ui.render(() => module.default(props));
    let tree = renderScreen(); const unmount = ui.effect();
    assert.equal(find(tree, (n) => n.type === 'ScrollView').props.contentContainerStyle[1].paddingBottom, 90);
    await find(tree, (n) => n.type === 'Row' && n.props.title === 'Records Viewed').props.onPress();
    assert.deepEqual(navigated, ['share', null, { section: 'accessLog', accessEntry: accessRow }]);
    const openCourse = async () => { tree = renderScreen(); await find(tree, (n) => n.type === 'Row' && n.props.title === course.title).props.onPress(); tree = renderScreen(); };
    await openCourse(); assert.equal(find(tree, (n) => n.type === 'Date').props.value, '2026-09-05');
    find(tree, (n) => n.type === 'Sheet').props.onClose(); tree = renderScreen(); assert.equal(saveCalls, 0);
    await openCourse(); find(tree, (n) => n.type === 'Date').props.onChange('2026-10-06'); tree = renderScreen();
    await find(tree, (n) => n.type === 'Sheet').props.onSubmit(); assert.equal(saveCalls, 0);
    find(tree, (n) => n.type === 'Date').props.onChange('2026-09-05'); tree = renderScreen();
    const submit = find(tree, (n) => n.type === 'Sheet').props.onSubmit;
    await Promise.all([submit(), submit()]); assert.equal(saveCalls, 1); assert(medicalRows[0].resolved);
    medicalRows = [medicine]; await openCourse(); failSave = commitThenFail = true;
    await find(tree, (n) => n.type === 'Sheet').props.onSubmit(); tree = renderScreen(); assert(find(tree, (n) => n.type === 'Sheet').props.error);
    failSave = false; const savedBeforeRetry = saveCalls;
    await find(tree, (n) => n.type === 'Sheet').props.onSubmit(); assert.equal(saveCalls, savedBeforeRetry, 'Interrupted successful saves reconcile before retry');
    medicalRows = [{ ...medicine, course_days: 7 }]; await openCourse(); await find(tree, (n) => n.type === 'Sheet').props.onSubmit();
    tree = renderScreen(); assert(find(tree, (n) => n.type === 'Sheet').props.error.includes('changed'));
    medicalRows = []; await find(tree, (n) => n.type === 'Sheet').props.onSubmit(); tree = renderScreen();
    assert(find(tree, (n) => n.type === 'Sheet').props.error.includes('removed'));
    medicalRows = [medicine]; delayMedical = new Promise((resolve) => release = resolve);
    const staleSubmit = find(tree, (n) => n.type === 'Sheet').props.onSubmit, beforeStale = saveCalls;
    const saving = staleSubmit(); unmount(); epoch++; release(); await saving; delayMedical = null;
    assert.equal(saveCalls, beforeStale, 'No completion writes after logout/unmount');
    for (const gender of ['girl', 'boy', 'neutral']) for (const scheme of ['light', 'dark']) {
        const colors = ui.palette(gender, scheme); tree = renderScreen();
        const rows = nodes(tree).filter((n) => n.type === 'Row');
        for (const row of rows) { assert.equal(row.props.iconAlign, 'center'); assert(row.props.dateText); }
        assert.equal(rows[0].props.iconBg, 'transparent');
        assert.equal(rows[0].props.icon.type, 'MedicationIcon');
    }
    assert(readCount >= 2);
    const appSource = fs.readFileSync(path.join(__dirname, '../App.js'), 'utf8'); parse(appSource, { sourceType: 'module', plugins: ['jsx'] });
    assert(appSource.includes('notifications: "Notifications"')); assert(appSource.includes('currentView === "notifications"'));
    assert(appSource.includes('count={notificationInbox.unreadCount}')); assert(appSource.includes('initialAccessEntry={navPayload?.accessEntry}'));
    await checkPullRefresh();
    console.log('Notification screen checks passed: inbox/navigation/course safety, native and browser pull thresholds/cancellation, spinning/bold indicator, retry, scrolling, reduced motion, duplicate gestures, cleanup and six themes.');
}
module.exports = { runtime, find, flush };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
