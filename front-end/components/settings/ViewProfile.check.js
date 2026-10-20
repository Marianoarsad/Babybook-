// Run from front-end: node components/settings/ViewProfile.check.js. Fixture-only account and logout services.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const pure = file => { const m = { exports: {} }; new Function("module", "exports", compile(fs.readFileSync(path.join(__dirname, file), "utf8")))(m, m.exports); return m.exports; };
const theme = pure("../../theme.js"), relationship = pure("../../utils/relationship.js");
const all = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(all)] : [];
const find = (tree, predicate) => all(tree).find(predicate);
const text = tree => tree && typeof tree === "object" ? (tree.props.children || []).map(text).join("") : String(tree ?? "");
function harness() {
    const slots = new Map(), calls = [], errors = [], presses = []; let state, cursor, pending, work, active = true;
    const env = { account: [{ email: "parent@example.test", phoneNumber: "09170000000", city: "Fixture City" }], refreshing: false, failures: [], language: "en", lead: "0", width: 390, fontScale: 1, palette: theme.PALETTES.boy };
    const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }), Fragment: "Fragment", useMemo: fn => fn(), useCallback: fn => fn,
        useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial; const owned = state; return [state[i], next => owned[i] = typeof next === "function" ? next(owned[i]) : next]; },
        useRef(initial) { const i = cursor++; return state[i] ||= { current: initial }; } };
    const imports = { react: { __esModule: true, default: react, ...react }, "react-native": { View: "View", Text: "Text", TouchableOpacity: "Button", Pressable: "Pressable", Animated: { View: "AnimatedView", ScrollView: "Scroll" }, Platform: { OS: "web" }, StyleSheet: { create: s => s }, useWindowDimensions: () => ({ width: env.width, fontScale: env.fontScale }) },
        "@expo/vector-icons": { Ionicons: "Icon" }, "../../theme": theme, "../../utils/relationship": relationship,
        "../../context/ThemeContext": { useTheme: () => ({ colors: env.palette }) }, "../../context/LanguageContext": { useLanguage: () => ({ language: env.language, t: key => key }) },
        "../../utils/responsive": { useScreenPadTop: () => 80, useScreenPadBottom: () => 96 }, "../../utils/ScrollContext": {}, "../../context/ScrollContext": { useScroll: () => ({ scrollViewRef() {}, scrollProps: {} }) },
        "../../utils/api": { ACCOUNT_SCOPE: "account", ACCOUNT_RESOURCE: "account", api: { me: async () => ({ user: env.account[0] }) } },
        "../../utils/useRecords": { useRecordCache: () => ({ rows: env.account }), useScreenRefresh: (_, load) => { work = load; return { refreshing: env.refreshing, failures: env.failures, refresh: () => calls.push("retry"), isActive: () => active }; } },
        "../../utils/storageAdapter": { storage: { getItem: async () => env.lead } }, "./GeneralSettings": { LEAD_TIME_KEY: "fixture-reminder", LEAD_TIME_OPTIONS: [{ key: "0", label: "Same day" }, { key: "1", label: "1 day before" }, { key: "7", label: "1 week before" }] },
        "../ui/Skeleton": { SkeletonBlock: "Skeleton" }, "../ui/ConsultationsAppointmentsCard": { DashboardSurface: "Surface" },
        "../ui/useSoftPress": { __esModule: true, default: () => ({ respond: down => presses.push(down), transform: [] }) },
        "../ui/Toast": { useToast: () => ({ error: message => errors.push(message) }) } };
    for (const name of ["Avatar", "Gradient", "PulseLoader"]) imports["../ui/" + name] = { __esModule: true, default: name };
    const m = { exports: {} }; new Function("require", "module", "exports", compile(fs.readFileSync(path.join(__dirname, "ViewProfile.js"), "utf8")) + "\nexports.__row = SettingsRow; exports.__styles = makeStyles;")(
        name => { assert(name in imports, name); return imports[name]; }, m, m.exports);
    const run = (key, fn) => { state = slots.get(key) || []; slots.set(key, state); cursor = 0; return fn(); };
    const defaults = { parentName: "Jamie Example", parentRelationship: "mother", parentAvatar: "fixture-photo", schemeOverride: "system", onNavigate: key => calls.push(key), onLogout: async () => { calls.push("logout"); if (pending) await pending; } };
    return { env, calls, errors, presses, render: props => run("screen", () => m.exports.default({ ...defaults, ...props })),
        row: (item, value) => run(item.key, () => m.exports.__row({ item, value, onNavigate: defaults.onNavigate, p: env.palette.profileSettings, styles: m.exports.__styles(env.palette) })),
        load: current => work(() => current), pending: task => pending = task, active: value => active = value, titles: m.exports.PROFILE_TITLES };
}
const rows = tree => all(tree).filter(n => typeof n.type === "function" && n.type.name === "SettingsRow");
const byId = (tree, id) => find(tree, n => n.props.testID === id);
const contrast = (a, b) => { const l = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0); const x = l(a), y = l(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
async function check() {
    const h = harness(); let tree = h.render(); await h.load(true); tree = h.render();
    assert(text(tree).includes("Jamie Example") && text(tree).includes("parent@example.test") && text(tree).includes("Mother"));
    assert.equal(find(tree, n => n.type === "Avatar").props.uri, "fixture-photo");
    assert.equal(find(tree, n => n.type === "Avatar").props.name, "Jamie Example");
    const infos = () => all(tree).filter(n => typeof n.type === "function" && n.type.name === "InfoRow");
    assert.deepEqual(infos().map(n => n.props.value), ["09170000000", "Fixture City"]);
    assert.equal(rows(tree).length, 9); assert.equal(rows(tree).find(n => n.props.item.key === "generalSettings").props.value, "Same day");
    assert(!byId(tree, "profile-plan").props.onPress, "No fictional subscription route");
    assert(!find(byId(tree, "profile-plan"), n => n.props.accessibilityRole === "button"));
    for (const row of rows(tree)) {
        const item = row.props.item, rendered = h.row(item, row.props.value), target = byId(rendered, "profile-setting-" + item.key), before = h.calls.length;
        target.props.onPress(); assert.equal(h.calls.length, before + (item.disabled ? 0 : 1));
        assert.equal(target.props.accessibilityState.disabled, !!item.disabled);
        if (!item.disabled) assert.equal(h.calls.at(-1), item.key);
        assert.equal(all(rendered).filter(n => n.props.icon === "chevron-forward").length, item.disabled ? 0 : 1);
        assert.equal(h.titles[item.key], item.label);
    }
    h.env.account[0] = { email: "updated@example.test", phoneNumber: "09990000000", city: "Updated City" }; h.env.language = "fil";
    tree = h.render({ parentName: "Updated Parent", schemeOverride: "dark", parentRelationship: "father" });
    assert(text(tree).includes("Updated Parent") && text(tree).includes("updated@example.test") && text(tree).includes("Father"));
    assert.deepEqual(infos().map(n => n.props.value), ["09990000000", "Updated City"]);
    assert.equal(rows(tree)[0].props.value, "Dark"); assert.equal(rows(tree)[1].props.value, "Filipino");
    h.env.lead = "7"; await h.load(true); tree = h.render(); assert.equal(rows(tree)[2].props.value, "1 week before");
    h.env.lead = "0"; await h.load(false); tree = h.render(); assert.equal(rows(tree)[2].props.value, "1 week before", "Ignore stale preference reads");
    h.env.refreshing = true; tree = h.render(); assert(!find(tree, n => n.type === "Skeleton"));
    h.env.account = []; tree = h.render(); assert(find(tree, n => n.type === "Skeleton"));
    h.env.refreshing = false; h.env.failures = ["account"]; tree = h.render(); assert(text(tree).includes("screenDataUnavailable"));
    find(tree, n => n.props.accessibilityLabel === "retry").props.onPress(); assert.equal(h.calls.at(-1), "retry");
    h.env.account = [{}]; h.env.failures = []; tree = h.render({ parentRelationship: "" }); assert(text(tree).includes("Caregiver") && text(tree).includes("Email not recorded")); assert(infos().every(n => n.props.value === "Not recorded"));
    const item = rows(tree)[0].props.item;
    h.env.width = 320; let row = h.row(item, "System"); assert(find(row, n => Array.isArray(n.props.style) && n.props.style.some(s => s?.flexDirection === "column")));
    h.env.width = 390; row = h.row(item, "System"); assert(!find(row, n => Array.isArray(n.props.style) && n.props.style.some(s => s?.flexDirection === "column")));
    h.env.fontScale = 2; row = h.row(item, "System"); assert(find(row, n => Array.isArray(n.props.style) && n.props.style.some(s => s?.flexDirection === "column")));
    let target = byId(row, "profile-setting-themePreferences"); target.props.onFocus({ currentTarget: { matches: () => true } }); row = h.row(item, "System");
    assert(byId(row, "profile-setting-themePreferences").props.style.some(s => s?.outlineStyle === "solid")); target.props.onPressIn(); target.props.onPressOut(); assert.deepEqual(h.presses.slice(-2), [true, false]);
    const before = JSON.stringify(h.env.account); tree = h.render(); let resolve;
    h.pending(new Promise(r => resolve = r)); const logout = byId(tree, "profile-sign-out").props.onPress, first = logout(); logout();
    assert.equal(h.calls.filter(c => c === "logout").length, 1); assert(byId(h.render(), "profile-sign-out").props.disabled);
    resolve(); await first; h.pending(null); assert(!byId(h.render(), "profile-sign-out").props.disabled); assert.equal(JSON.stringify(h.env.account), before);
    h.pending(Promise.reject(Error("Fixture logout failure"))); await byId(h.render(), "profile-sign-out").props.onPress(); assert(h.errors.includes("Fixture logout failure")); assert(!byId(h.render(), "profile-sign-out").props.disabled);
    h.pending(null);
    for (const palettes of [theme.PALETTES, theme.DARK_PALETTES]) for (const palette of Object.values(palettes)) {
        h.env.palette = palette; tree = h.render(); const p = palette.profileSettings;
        assert.equal(p.panel.length, 3); assert.equal(p.background.length, 3); assert(p.plan.every(c => contrast(c, p.onPlan) >= 4.5));
        assert(contrast(p.logout.at(-1), p.logoutInk) >= 4.5); assert(p.icons.purple && p.icons.mint && p.icons.rose);
        assert(p.control.every(c => contrast(c, p.accent) >= 4.5), "Role badge text stays readable across its gradient");
        assert(p.panel.every(c => contrast(c, palette.primary) >= 3), "Shared Avatar initials retain large-text contrast on the profile face");
        assert.equal(byId(tree, "profile-contact").props.style.borderRadius, 24);
    }
    assert.notDeepEqual(theme.PALETTES.boy.profileSettings.plan, theme.PALETTES.girl.profileSettings.plan);
    const app = fs.readFileSync(path.join(__dirname, "../../App.js"), "utf8"), api = fs.readFileSync(path.join(__dirname, "../../utils/api.js"), "utf8");
    assert(app.includes('currentView === "viewProfile" ? colors.profileSettings.background'));
    assert(app.includes("onLogout={handleLogOut}")); assert(/async function clearToken\(\)\s*\{\s*recordStore.reset\(\)/.test(api));
    console.log("Profile settings checks passed: dynamic account/preferences, updates/loading/errors, nine rows/eight routes, disabled Local Services, informational plan, responsive/focus/press behavior, guarded logout, data preservation, six palettes and contrast.");
}
check().catch(error => { console.error(error); process.exitCode = 1; });
