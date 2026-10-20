// node components/HeaderNavigation.check.js — no database, server or device.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('@babel/core');
const { parse } = require('@babel/parser');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const compile = (source) => transformSync(source, { babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] }).code;
const load = (file, requireMock) => {
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', compile(read(file)))(requireMock, mod, mod.exports);
    return mod.exports;
};
let slots = [], cursor = 0;
const React = {
    createContext: (current) => ({ current }), useContext: (context) => context.current,
    useRef: (initial) => slots[cursor++] ||= { current: initial }, useMemo: (fn) => fn(), useCallback: (fn) => fn,
    useState: (initial) => { const index = cursor++; slots[index] ??= { value: initial }; return [slots[index].value, (value) => slots[index].value = value]; },
    useEffect() {}, createElement: (type, props, ...children) => ({ type, props, children }),
};
const render = (fn) => { cursor = 0; return fn(); };
const native = { Animated: { Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } }, event: () => () => {} },
    View: 'View', Image: 'Image', Text: 'Text', StyleSheet: { create: (value) => value } };
const scrollModule = load('context/ScrollContext.js', (name) => name === 'react' ? React : native);
const controller = render(() => scrollModule.useScrollController(80, 60));
scrollModule.ScrollContext.current = controller;
slots = []; const localA = { current: null }, a = render(() => scrollModule.useScroll(localA));
slots = []; const localB = { current: null }, b = render(() => scrollModule.useScroll(localB));
const movements = [], nodeA = { scrollTo: (value) => movements.push(['A', value]) }, nodeB = { scrollTo: (value) => movements.push(['B', value]) };
a.scrollViewRef(nodeA); assert.equal(localA.current, nodeA);
controller.scrollY.setValue(300); controller.resetScroll(); assert.equal(movements.length, 0, 'Header reset alone does not scroll a screen');
controller.scrollY.setValue(300); controller.scrollToTop();
assert.deepEqual(movements.pop(), ['A', { x: 0, y: 0, animated: false }]); assert.equal(controller.scrollY.value, 0);
b.scrollViewRef(nodeB); a.scrollViewRef(null); assert.equal(localA.current, null);
controller.scrollToTop(); assert.equal(movements.pop()[0], 'B', 'Late outgoing detach does not unregister the new screen');
b.scrollViewRef(null); controller.scrollToTop(); assert.equal(movements.length, 0, 'Unmounted refs are not scrolled');

const app = read('App.js'), ast = parse(app, { sourceType: 'module', plugins: ['jsx'] });
function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const value of Object.values(node)) {
        if (value && typeof value === 'object') {
            const result = Array.isArray(value) ? value.map((item) => find(item, predicate)).find(Boolean) : find(value, predicate);
            if (result) return result;
        }
    }
    return null;
}
const expression = (node, env) => new Function(...Object.keys(env), `return (${app.slice(node.start, node.end)});`)(...Object.values(env));
const declaration = (name) => find(ast, (node) => node.type === 'VariableDeclarator' && node.id.name === name).init;
let unseen = 5, refreshes = 0;
const state = { view: 'dashboard', tab: 'old', payload: { section: 'accessLog' }, key: 0, history: { current: [] } };
const changeView = expression(declaration('changeView'), { setCurrentView: (fn) => state.view = fn(state.view),
    setNavTab: (value) => state.tab = value, setNavPayload: (value) => state.payload = value, setNavKey: (fn) => state.key = fn(state.key),
    historyRef: state.history, scroll: controller, profileFlow: { current: null }, setHomeRestore() {}, currentView: state.view });
const header = () => expression(declaration('openHeaderView'), { currentView: state.view, scroll: controller, changeView });
const button = (label) => find(ast, (node) => node.type === 'JSXOpeningElement' && node.attributes?.some((attr) => attr.name?.name === 'accessibilityLabel' && attr.value?.value === label));
const action = (element, name) => element.attributes.find((attr) => attr.name?.name === name).value.expression;
const backgroundTarget = find(ast, node => node.type === 'JSXElement' && node.openingElement.name?.name === 'BlurTargetView');
assert(backgroundTarget, 'Shared background target remains');
assert(!find(backgroundTarget, node => node.type === 'JSXOpeningElement' && ['GlassHeaderButton', 'NotificationMenu'].includes(node.name?.name)), 'Blur target excludes foreground controls');
assert(find(backgroundTarget, node => node.type === 'JSXAttribute' && node.name?.name === 'style' && node.value?.expression?.elements?.some(element => element?.property?.name === 'headerBg')), 'Scroll-fading header ground is captured');
const bell = find(ast, (node) => node.type === 'JSXOpeningElement' && node.name?.name === 'NotificationMenu');
for (const [view, element, event] of [
    ['notifications', bell, 'onOpen'], ['search', button('Search records'), 'onPress'],
    ['share', button('Share records by QR code'), 'onPress'], ['viewProfile', button('Open profile and settings'), 'onPress'],
]) {
    if (view !== 'viewProfile') assert.equal(action(element, 'blurTarget').name, 'blurTargetRef');
    state.view = 'dashboard'; state.history.current = []; state.payload = { section: 'accessLog' };
    movements.length = 0; a.scrollViewRef(nodeA);
    const tap = () => expression(action(element, event), { openHeaderView: header(), setUnseenCount: (value) => unseen = value,
        notificationInbox: { refresh: () => refreshes++ } })();
    tap(); assert.equal(state.view, view); assert.deepEqual(state.history.current, ['dashboard']);
    assert.equal(state.payload, null); assert.equal(state.tab, null); assert.equal(movements.length, 0, 'Different destination mounts normally');
    controller.scrollY.setValue(500); tap(); assert.equal(movements.pop()[0], 'A'); assert.equal(controller.scrollY.value, 0);
    assert.deepEqual(state.history.current, ['dashboard'], 'Repeated taps do not add history entries');
}
assert.equal(unseen, 0); assert.equal(refreshes, 2, 'Existing bell refresh and QR badge actions remain');
const goBack = expression(declaration('goBack'), { historyRef: state.history, setCurrentView: (value) => state.view = value,
    setNavTab: (value) => state.tab = value, setNavPayload: (value) => state.payload = value, setNavKey: (fn) => state.key = fn(state.key), scroll: controller, currentView: state.view, profileFlow: { current: null } });
controller.scrollY.setValue(200); goBack(); assert.equal(state.view, 'dashboard'); assert.equal(controller.scrollY.value, 0);
for (const file of ['components/Notifications.js', 'components/Search.js', 'components/ShareRecords.js', 'components/settings/ViewProfile.js']) {
    assert(read(file).includes('ref={scrollViewRef}'), `${file} registers its root without changing screen keys`);
}
assert(!app.includes('key={navKey}'), 'Header taps never force a screen remount');

const theme = load('theme.js', () => assert.fail('Theme needs no imports'));
const { default: unusedDefault, ...themeTokens } = theme;
const stylesFor = expression(declaration('makeStyles'), { ...themeTokens, StyleSheet: native.StyleSheet });
let colors;
const avatar = load('components/ui/Avatar.js', (name) => name === 'react' ? React : name === 'react-native' ? native
    : name.endsWith('/theme') ? theme : { useTheme: () => ({ colors }) });
const profileButton = button('Open profile and settings');
assert.equal(profileButton.name.name, 'GlassHeaderButton');
assert.equal(profileButton.attributes.find(attr => attr.name?.name === 'icon').value.value, 'profile');
assert.equal(expression(action(profileButton, 'selected'), { currentView: 'viewProfile' }), true);
assert.equal(expression(action(profileButton, 'selected'), { currentView: 'dashboard' }), false);
assert(!find(ast, node => node.type === 'JSXOpeningElement' && node.name?.name === 'Avatar'), 'Header always uses the user icon');
const merged = (style) => Object.assign({}, ...(Array.isArray(style) ? style : [style]));
for (const gender of ['girl', 'boy', 'neutral']) for (const scheme of ['light', 'dark']) {
    colors = theme.paletteFor(undefined, gender, scheme); const styles = stylesFor(colors);
    assert.equal(styles.headerRight.gap, theme.space.xs);
    assert.equal(styles.headerRight.flexShrink, 0);
    for (const label of ['Search records', 'Share records by QR code']) {
        assert.equal(button(label).name.name, 'GlassHeaderButton');
    }
    assert.equal(action(button('Share records by QR code'), 'badgeCount').name, 'unseenCount');
    for (const label of ['Search records', 'Share records by QR code', 'Open profile and settings']) assert(!button(label).attributes.some(attr => attr.name?.name === 'style'), 'Row owns equal spacing');
    const props = { uri: 'https://example.invalid/avatar.jpg', name: 'Maria Rivera', size: 36, borderWidth: 0, style: { backgroundColor: "transparent" } };
    slots = []; let tree = render(() => avatar.default(props)); assert.equal(tree.type, 'Image');
    assert.equal(merged(tree.props.style).borderWidth, 0); assert.equal(merged(tree.props.style).borderRadius, 18);
    tree.props.onError(); tree = render(() => avatar.default(props)); assert.equal(tree.type, 'View'); assert.equal(tree.children[0].children[0], 'MR');
    assert.equal(merged(tree.props.style).backgroundColor, 'transparent');
    slots = []; tree = render(() => avatar.default({ ...props, uri: '' })); assert.equal(tree.children[0].children[0], 'MR');
    slots = []; tree = render(() => avatar.default({ name: 'Maria Rivera' })); assert.equal(merged(tree.props.style).backgroundColor, colors.primarySoft, 'Other avatars retain their fill');
}
console.log('Header navigation checks passed: root ref ownership, actual scroll/reset, all four actions/repeated taps/history, no remounts, avatar fallbacks, glass header integration, equal spacing, profile selection, unchanged shared avatars and six themes.');
