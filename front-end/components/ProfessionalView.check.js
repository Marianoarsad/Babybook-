// Run: node components/ProfessionalView.check.js. No server/database/device required.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const { formatConsultationInput: format, protectConsultation } = require("../utils/professionalAccess.cjs");

const compile = (source) => transformSync(source, { babelrc: false, configFile: false,
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs"), require.resolve("@babel/plugin-transform-react-jsx")] }).code;
const theme = { exports: {} };
new Function("module", "exports", compile(fs.readFileSync(path.join(__dirname, "../theme.js"), "utf8")))(theme, theme.exports);
let colors = theme.exports.PALETTES.neutral, scheme = "light", states = [], refs = [], effects = [], cursor = 0, refCursor = 0, effectCursor = 0;
const reset = () => { states = []; refs = []; effects = []; };
const render = (fn, props = {}) => { cursor = refCursor = effectCursor = 0; return fn(props); };
const react = {
    isValidElement: node => !!node && typeof node === "object" && "type" in node,
    Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useMemo: (fn) => fn(), useCallback: fn => fn, useContext: value => value, useId: () => ":test:",
    useRef: (initial) => refs[refCursor++] ||= { current: initial },
    useState: (initial) => { const index = cursor++; if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
        return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; },
    useEffect: (fn, deps) => { const index = effectCursor++, old = effects[index];
        if (!old || deps.some((dep, i) => dep !== old.deps[i])) {
            old?.cleanup?.(); effects[index] = { fn, deps };
        } },
};
const platform = { OS: "web" };
let fontScale = 1;
const animations = [];
class AnimatedValue {
    constructor(value) { this.value = value; }
    interpolate(config) { return { ...config, value: this.value }; }
}
let capture, resolveError, lastRequest;
const snapshot = { status: "ok", serverNow: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
    childName: "Sofia Rivera", recordKeys: ["profile", "growth"],
    capturedAt: "2026-10-02T00:00:00Z", payload: { profile: { dateOfBirth: "2025-11-14", sex: "Female" } } };
const imports = {
    "react-native-svg": { __esModule: true, default: "Svg", Defs: "Defs", LinearGradient: "LinearGradient", Path: "Path", Stop: "Stop" },
    "./ui/FeedingTodayCard": { MetricArtwork: "MetricArtwork" },
    "./ui/ConsultationsAppointmentsCard": { DashboardSurface: "ClinicalSurface" },
    "../utils/milkTypeHistory": { milkPeriodInfo: row => ({ ...row, type: row.milk_type, dateLabel: `${row.start_date} – ${row.end_date || "Open-ended"}` }) },
    react: { __esModule: true, default: react, ...react },
    "react-native": { View: "View", Text: "Text", Image: "Image", TouchableOpacity: "TouchableOpacity", ScrollView: "ScrollView",
        StyleSheet: { create: (value) => value }, Platform: platform, AppState: { currentState: "active" },
        useWindowDimensions: () => ({ width: 390, height: 844, fontScale }) },
    "expo-screen-capture": new Proxy({}, { get: (_, key) => capture[key] }),
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) },
    "./common/Cards": { SectionContainerCard: "SectionContainerCard", ListEntryCard: "ListEntryCard" },
    "../utils/professionalAccess.cjs": require("../utils/professionalAccess.cjs"),
    "../utils/consultationLinks.cjs": require("../utils/consultationLinks.cjs"),
    "../utils/consultationSession.cjs": require("../utils/consultationSession.cjs"),
    "@expo/vector-icons": { Ionicons: "Icon" },
    "../utils/shareStore": { RECORD_LABELS: { profile: "Child Profile", growth: "Growth", allergies: "Allergies", medicalHistory: "Medical History" } },
    "../utils/api": { api: { resolveConsult: async (request) => { lastRequest = request;
        if (resolveError) throw { data: { status: resolveError } }; return snapshot; } } },
    "../context/ThemeContext": { useTheme: () => ({ colors, scheme }) }, "../theme": theme.exports,
    "../assets/header/profile-blue.png": "profile-blue.png",
    "../context/LanguageContext": { useLanguage: () => ({ t: (key) => key }) },
    "../utils/responsive": { fitsColumns: (width, columns = 2, gap = theme.exports.space.md) =>
        !width || (width - gap * (columns - 1)) / columns >= theme.exports.TEXT_COL_MIN },
    "../utils/dates": { shortDate: (value) => value, shortTime: (value) => value,
        overdueBy: () => "", spanText: () => "ongoing", todayLocal: () => "2026-10-02" },
    "../utils/medication": { courseDayText: () => "taking", isActiveOn: () => false },
    "../utils/adapters": { feedRowSummary: () => "Milk" }, "./Dashboard": { ageText: () => "10 months" },
    "../utils/whoGrowth": { ageInDays: () => 100 },
};
Object.assign(imports["react-native"], {
    Animated: { Value: AnimatedValue, View: "AnimatedView", timing: (value, config) => ({
        start: () => { animations.push(config); value.value = config.toValue; }, stop() {} }) },
    Easing: { bezier: (...values) => values },
    AccessibilityInfo: { isReduceMotionEnabled: async () => false,
        addEventListener: () => ({ remove() {} }) },
});
for (const name of ["Field", "Button", "Gradient", "KeyboardAvoider"])
    imports[`./ui/${name}`] = { __esModule: true, default: name };
imports["./ui/SolidFoodIcon"] = { __esModule: true, default: "SolidFoodIcon" };
imports["./ui/MilkIcon"] = { __esModule: true, default: "MilkIcon" };
imports["./ui/HospitalStayIcon"] = { __esModule: true, default: "HospitalStayIcon" };
imports["./ui/GrowthIcon"] = { __esModule: true, default: "GrowthIcon" };
imports["./ui/MedicationIcon"] = { __esModule: true, default: "MedicationIcon" };
imports["./ui/VaccineIcon"] = { __esModule: true, default: "VaccineIcon" };
imports["./QrScanner"] = { __esModule: true, default: "QrScanner", scannerAvailable: () => true };
imports["./GrowthChart"] = { __esModule: true, default: "GrowthChart" };
// Exercise the actual shared summaries and pure calculations, not replacement arithmetic.
const appRoot = path.resolve(__dirname, "..");
const modules = new Map();
const overrides = {
    "context/ThemeContext.js": imports["../context/ThemeContext"],
    "context/LanguageContext.js": imports["../context/LanguageContext"],
    "theme.js": theme.exports,
    "components/ui/Gradient.js": { __esModule: true, default: "Gradient" },
    "components/ui/GlassLighting.js": { __esModule: true, default: "GlassLighting" },
    "context/ScrollContext.js": { __esModule: true, default: { scrollY: { addListener() {}, removeListener() {} } } },
    "components/ui/GrowthVisuals.js": { NeumorphicMeasurements: "NeumorphicMeasurements" },
    "components/ui/RecordIcon.js": { __esModule: true, default: "RecordIcon", AllergyIcon: "AllergyIcon", HereditaryIcon: "HereditaryIcon" },
    "components/ui/MemoryDateRow.js": { __esModule: true, default: "MemoryDateRow" },
    "components/ui/useSoftPress.js": { __esModule: true, default: () => ({ respond() {}, transform: [] }) },
};
function loadApp(relative) {
    const file = path.resolve(appRoot, relative);
    const key = path.relative(appRoot, file).replaceAll("\\", "/");
    if (overrides[key]) return overrides[key];
    if (modules.has(file)) return modules.get(file).exports;
    if (/\.(json|cjs)$/.test(file)) return require(file);
    const loaded = { exports: {} }; modules.set(file, loaded);
    new Function("require", "module", "exports", "__DEV__", compile(fs.readFileSync(file, "utf8")))(
        (name) => {
            if (name === "expo-blur") return { BlurTargetView: "BlurTargetView" };
            if (name === "react" || name === "react-native" || name === "@expo/vector-icons") return imports[name];
            assert(name.startsWith("."), `Unexpected shared-summary dependency ${name}`);
            const target = path.resolve(path.dirname(file), name);
            return loadApp(/\.(json|cjs|js)$/.test(target) ? target : target + ".js");
        }, loaded, loaded.exports, false);
    return loaded.exports;
}
const dates = loadApp("utils/dates.js");
overrides["utils/dates.js"] = { ...dates, todayLocal: () => "2026-10-02",
    recentDateRange: (days, dob, reference = "2026-10-02") => dates.recentDateRange(days, dob, reference) };
imports["./ui/RecordIcon"] = { __esModule:true, default:"RecordIcon", AllergyIcon:"AllergyIcon", HereditaryIcon:"HereditaryIcon", IllnessIcon:"IllnessIcon" };
imports["../utils/dates"] = overrides["utils/dates.js"];
imports["../utils/adapters"] = loadApp("utils/adapters.js");
imports["../utils/feedingStats"] = loadApp("utils/feedingStats.js");
imports["../utils/medication"] = loadApp("utils/medication.js");
imports["../utils/viewerRecords"] = loadApp("utils/viewerRecords.js");
imports["../utils/hospitalStays"] = loadApp("utils/hospitalStays.js");
const summaries = loadApp("components/common/RecordSummaries.js");
imports["./common/RecordSummaries"] = summaries;
const AnimatedReveal = loadApp("components/ui/AnimatedReveal.js").default;
imports["./ui/AnimatedReveal"] = { __esModule: true, default: AnimatedReveal };
overrides["components/PercentileChart.js"] = { __esModule: true, default: "PercentileChart" };
overrides["components/ui/AnchoredMenu.js"] = { __esModule: true, default: "AnchoredMenu", AnchoredMenuItem: "AnchoredMenuItem" };
overrides["components/ui/Skeleton.js"] = { SkeletonBlock: "SkeletonBlock" };
const ActualGrowthChart = loadApp("components/GrowthChart.js").default;
const cards = loadApp("components/common/Cards.js");
const moduleUnderTest = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, "ProfessionalView.js"), "utf8");
const authSource = fs.readFileSync(path.join(__dirname, "Auth.js"), "utf8");
const authForeground = new Function("colors", "scheme", `return (${authSource.match(/const professionalForeground = (.+);/)[1]});`);
assert(authSource.includes("colors={[colors.primaryDark, colors.primary]} style={styles.professionalFill}"));
assert(authSource.includes("focused && { boxShadow:"), "Gradient access button retains keyboard focus indication");
new Function("require", "module", "exports", compile(source)
    + "\nexports.check = { ProtectedRecordsView, RecordsView, ViewerChildProfileCard, ProfileRow, Row, ClinicalSummary, ClinicalSection, ClinicalRecord, ReactionWarning, FeedingSummary, NotShared, Section, Item, Capped, GrowthEntries, VaccineStatus, feedingSummary, makeStyles, abbreviateAge, SnapshotTimestamp, formatCapturedAt };")(
    (name) => { assert(name in imports, `Unexpected import ${name}`); return imports[name]; }, moduleUnderTest, moduleUnderTest.exports);
const { default: ProfessionalView, check } = moduleUnderTest.exports;
const nodes = (tree) => !tree || typeof tree !== "object" ? [] : [tree, ...(tree.type === check.ViewerChildProfileCard
    ? nodes(tree.type(tree.props)) : (tree.children || []).flatMap(nodes))];
const find = (tree, predicate) => nodes(tree).find(predicate);
const text = tree => !tree || typeof tree !== "object" ? String(tree ?? "")
    : [check.ClinicalSection, check.ClinicalRecord, check.ViewerChildProfileCard].includes(tree.type) ? text(tree.type(tree.props)) : (tree.children || []).map(text).join(" ");
const flush = () => new Promise(setImmediate);
const runEffects = () => effects.forEach((effect) => { if (!effect.ran) { effect.ran = true; effect.cleanup = effect.fn(); } });
const deferred = () => { let resolve; const promise = new Promise((fn) => { resolve = fn; }); return { promise, resolve }; };
function captureMock(overrides = {}) {
    const calls = [];
    const mock = { isAvailableAsync: async () => true,
        preventScreenCaptureAsync: async (key) => { calls.push(["prevent", key]); },
        allowScreenCaptureAsync: async (key) => { calls.push(["allow", key]); },
        enableAppSwitcherProtectionAsync: async (intensity) => { calls.push(["preview", intensity]); },
        disableAppSwitcherProtectionAsync: async () => { calls.push(["unpreview"]); }, ...overrides };
    return { mock, calls };
}

async function main() {
    const savedNow = Date.now;
    const savedColors = colors, savedScheme = scheme;
    const timestampNow = Date.parse("2026-10-04T12:00:00Z");
    Date.now = () => timestampNow;
    try {
        for (const currentScheme of ["light", "dark"]) for (const gender of ["girl", "boy", "neutral"]) {
            scheme = currentScheme; colors = theme.exports.paletteFor(undefined, gender, scheme);
            const brand = theme.exports.paletteFor(undefined, "neutral", scheme);
            for (const hours of [1, 24, 48]) {
                const capturedAt = new Date(timestampNow - hours * 3600000).toISOString();
                reset(); const timestamp = render(check.SnapshotTimestamp, { capturedAt });
                const badge = timestamp.children[0];
                assert.equal(badge.props.style[1].backgroundColor, brand.primarySoft);
                assert.equal(badge.props.style[0].maxWidth, "100%");
                assert.equal(badge.props.style[0].alignSelf, "flex-start");
                assert.equal(badge.props.style[0].borderRadius, theme.exports.radius.pill);
                assert.equal(find(badge, (node) => node.type === "Icon").props.color, brand.primaryDark);
                const label = find(badge, (node) => node.type === "Text");
                assert.equal(label.props.style[1].color, brand.primaryDark);
                assert.equal(label.props.style[0].flexShrink, 1);
                assert.equal(label.props.numberOfLines, undefined, "Long timestamps may wrap without truncation");
                assert(text(badge).includes(check.formatCapturedAt(capturedAt)));
                assert(!text(badge).includes("Records may have changed"));
                assert.equal(text(timestamp).includes("Records may have changed"), hours >= 24);
                if (hours >= 24) assert.equal(timestamp.children[1].props.style.color, colors.warning);
            }
        }
        for (const capturedAt of [null, "", "invalid timestamp"]) {
            reset(); assert.equal(render(check.SnapshotTimestamp, { capturedAt }), null);
        }
    } finally {
        Date.now = savedNow; colors = savedColors; scheme = savedScheme;
    }
    for (const [value, expected] of [["1 month", "1 mo"], ["7 months", "7 mos"], ["1 year", "1 yr"],
        ["2 years 3 months", "2 yrs 3 mos"], ["2 yr 3 mo", "2 yr 3 mo"], ["3 days 2 weeks", "3 days 2 weeks"],
        ["Age not recorded", "Age not recorded"], ["", ""], [null, ""], ["2 MONTHS", "2 mos"]]) {
        assert.equal(check.abbreviateAge(value), expected);
    }
    for (const [input, expected] of [["ab7k2p9q", "AB7K-2P9Q"], [" ab7k – 2p9q ", "AB7K-2P9Q"],
        ["abcd", "ABCD"], ["abcde", "ABCD-E"], ["abcdEFGH123", "ABCD-EFGH"], ["", ""]]) {
        const result = format(input); assert.equal(result.value, expected);
        assert(result.selection.end <= result.value.length);
    }
    assert.deepEqual(format("ABCDEFGH", "ABCD-EFGH", { start: 5, end: 5 }),
        { value: "ABCE-FGH", selection: { start: 3, end: 3 } }, "Backspace across dash is not trapped");
    assert.equal(format("ABCDEFGH", "ABCD-EFGH", { start: 4, end: 4 }).value, "ABCD-FGH", "Forward delete works");
    assert.equal(format("ABxGH", "ABCD-EFGH", { start: 2, end: 7 }).value, "ABXG-H", "Selected text replacement works");
    let typed = "";
    for (const char of "ab7k2p9q") typed = format(typed + char, typed).value;
    assert.equal(typed, "AB7K-2P9Q");
    while (typed) typed = format(typed.slice(0, -1), typed).value;
    assert.equal(typed, "", "Backspace can clear the whole field");

    for (const os of ["android", "ios"]) {
        const { mock, calls } = captureMock();
        const protection = protectConsultation(mock, os, "viewer");
        assert.equal(await protection.ready, true); await protection.dispose(); await protection.dispose();
        assert.deepEqual(calls, os === "ios" ? [["prevent", "viewer"], ["preview", 1], ["unpreview"], ["allow", "viewer"]]
            : [["prevent", "viewer"], ["allow", "viewer"]]);
    }
    for (const failure of ["isAvailableAsync", "preventScreenCaptureAsync", "enableAppSwitcherProtectionAsync"]) {
        const { mock, calls } = captureMock({ [failure]: async () => { throw new Error("Unavailable"); } });
        const protection = protectConsultation(mock, "ios", "failed");
        await assert.rejects(protection.ready); await protection.dispose();
        if (failure !== "isAvailableAsync") assert(calls.some(([call]) => call === "allow"), "Partial acquisition rolls back");
    }
    const pending = deferred();
    const { mock, calls } = captureMock({ preventScreenCaptureAsync: async () => { calls.push(["prevent", "pending"]); await pending.promise; } });
    const protection = protectConsultation(mock, "ios", "pending");
    await flush(); const disposal = protection.dispose(); pending.resolve(); await disposal;
    assert.equal(await protection.ready, false);
    assert.deepEqual(calls, [["prevent", "pending"], ["allow", "pending"]], "Early exit waits for acquisition then releases");

    const viewerProps = { session: { ...snapshot, code: "AB7K-2P9Q", professionalName: "Dr. Test" }, onEnd() {}, onExit() {} };
    platform.OS = "android"; reset(); capture = captureMock().mock;
    let tree = render(check.ProtectedRecordsView, viewerProps);
    assert(!find(tree, (node) => node.type === check.RecordsView), "Records do not mount before protection");
    runEffects(); await flush(); tree = render(check.ProtectedRecordsView, viewerProps);
    assert(find(tree, (node) => node.type === check.RecordsView)); effects[0].cleanup(); await flush();
    reset(); capture = captureMock({ isAvailableAsync: async () => false }).mock;
    render(check.ProtectedRecordsView, viewerProps); runEffects(); await flush(); tree = render(check.ProtectedRecordsView, viewerProps);
    assert(!find(tree, (node) => node.type === check.RecordsView));
    assert(find(tree, (node) => node.type === "Button" && node.props.title === "Retry"));
    capture = captureMock().mock; find(tree, (node) => node.props.title === "Retry").props.onPress();
    render(check.ProtectedRecordsView, viewerProps); runEffects(); await flush();
    assert(find(render(check.ProtectedRecordsView, viewerProps), (node) => node.type === check.RecordsView));
    effects[0].cleanup(); await flush();
    reset(); platform.OS = "web"; capture = null;
    assert(find(render(check.ProtectedRecordsView, viewerProps), (node) => node.type === check.RecordsView)); runEffects();

    reset(); let entry = render(ProfessionalView, { onExit() {} });
    find(entry, (node) => node.props.label === "Your Name (for the access log)").props.onChangeText(" Dr. Test ");
    find(entry, (node) => node.props.label === "Consultation Code").props.onChangeText("ab7k2p9q");
    entry = render(ProfessionalView, { onExit() {} });
    assert.equal(find(entry, (node) => node.props.label === "Consultation Code").props.value, "AB7K-2P9Q");
    await find(entry, (node) => node.props.title === "View Records").props.onPress();
    assert.deepEqual(lastRequest, { code: "AB7K-2P9Q", professionalName: "Dr. Test" });
    tree = render(ProfessionalView, { onExit() {} }); assert.equal(tree.props.session.professionalName, "Dr. Test");
    tree.props.onEnd(); entry = render(ProfessionalView, { onExit() {} });
    find(entry, (node) => node.props.title === "Scan QR Code").props.onPress();
    tree = render(ProfessionalView, { onExit() {} });
    const beforeScan = lastRequest;
    tree.props.onScanned("BABYBOOK+CONSULT:AB7K-2P9Q"); await flush();
    assert.equal(lastRequest, beforeScan, "Scanning must not resolve records or write an access log");
    entry = render(ProfessionalView, { onExit() {} });
    assert.equal(find(entry, (node) => node.props.label === "Consultation Code").props.value, "AB7K-2P9Q");
    await find(entry, (node) => node.props.title === "View Records").props.onPress();
    assert.equal(lastRequest, beforeScan, "A name is required before resolving");
    find(entry, (node) => node.props.label === "Your Name (for the access log)").props.onChangeText("Dr. Scan");
    entry = render(ProfessionalView, { onExit() {} });
    await find(entry, (node) => node.props.title === "View Records").props.onPress();
    assert.equal(lastRequest.professionalName, "Dr. Scan");
    for (const status of ["expired", "revoked", "invalid", "unavailable", "notfound"]) {
        reset(); resolveError = status; entry = render(ProfessionalView, { onExit() {} });
        find(entry, (node) => node.props.label === "Your Name (for the access log)").props.onChangeText("Dr. Test");
        find(entry, (node) => node.props.label === "Consultation Code").props.onChangeText("AB7K2P9Q");
        entry = render(ProfessionalView, { onExit() {} }); await find(entry, (node) => node.props.title === "View Records").props.onPress();
        assert(!find(render(ProfessionalView, { onExit() {} }), (node) => node.type === check.ProtectedRecordsView));
        assert(states[4], `${status} retains the error explanation`);
    }
    for (const gender of ["girl", "boy", "neutral"]) for (const currentScheme of ["light", "dark"]) {
        scheme = currentScheme;
        colors = theme.exports.paletteFor(undefined, gender, scheme); reset();
        assert.equal(authForeground(colors, scheme), scheme === "dark" ? colors.background : colors.onPrimary);
        tree = render(check.RecordsView, viewerProps);
        assert(text(tree).includes("Sofia Rivera"));
        assert(!/Screenshots cannot be blocked|Read Only · Shared By Parent|Viewed by/.test(text(tree)));
        assert(find(tree, (node) => node.type === check.ViewerChildProfileCard));
        const styles = check.makeStyles(colors);
        assert.equal(styles.childName.fontFamily, theme.exports.type.title.fontFamily);
        assert.equal(styles.dataValue.fontFamily, theme.exports.type.bodyStrong.fontFamily);
        assert.equal(styles.viewOnlyBanner, undefined);
        assert.equal(styles.privacyNotice, undefined);
        assert.equal(styles.entryScroll.backgroundColor, undefined, "The branded page gradient remains visible behind the access card");
        reset(); assert.equal(render(check.ClinicalSummary, { payload: {}, recordKeys: [] }), null);
        reset(); assert(text(render(check.ClinicalSummary, { payload: { allergies: { allergies: [] } }, recordKeys: ["allergies"] })).includes("No allergies"));
        reset(); assert(text(render(check.ClinicalSummary, { payload: { allergies: { allergies: ["Peanuts"] } }, recordKeys: ["allergies"] })).includes("No classified allergies"));
        reset(); tree = render(check.Item, { tone: colors.danger, statusIcon: "alert-circle", title: "Reaction", flag: "Severe" });
        assert.equal(tree.type, "ListEntryCard"); assert.equal(tree.props.iconBg, colors.dangerBg); assert.equal(tree.props.onPress, undefined);
        reset(); tree = render(check.Capped, { rows: Array.from({ length: 15 }, (_, i) => i), render: (i) => String(i), noun: "records" });
        assert.equal(tree.children.filter((value) => typeof value === "string").length, 10);
        assert.equal(tree.type, AnimatedReveal);
        find(tree, (node) => node.type === "TouchableOpacity").props.onPress();
        tree = render(check.Capped, { rows: Array.from({ length: 15 }, (_, i) => i), render: (i) => String(i), noun: "records" });
        assert.equal(tree.children.filter((value) => typeof value === "string").length, 15);
        assert(!find(tree, (node) => node.type === "TouchableOpacity"), "Final page removes Show more");
    }
    const growthRows = [
        { id: 1, date_recorded: "2026-10-01", weight: "8.1", height: "70" },
        { id: 2, date_recorded: "2026-10-01", weight: "8.2", height: null },
        { id: 3, date_recorded: "2026-09-01", weight: "7.9" },
    ];
    const rich = { ...viewerProps, session: { ...viewerProps.session, payload: {
        profile: { ...snapshot.payload.profile, hospital: "Shared hospital", emergencyContactDetails: {
            firstName: "Maria Clara", lastName: "Rivera", relationship: "Mother", contactNumber: "09171234567" } },
        growth: { measurements: growthRows, birthWeight: "3.2", birthLength: "49", birthHeadCircumference: "34.5" },
        vaccinations: [],
        milestones: [{ title: "Sat independently", age_achieved: "7 months", date_recorded: "2026-06-14", is_completed: true }],
        medicalHistory: [
            { id: 1, category: "Illness", title: "Fever", date_recorded: "2026-10-01" },
            { id: 2, category: "Medication", title: "Prescribed medicine", date_recorded: "2026-10-01",
                dose_amount: "2 ml", frequency_per_day: 3, course_days: 5, treats_id: 1, prescribed_by: "Dr. Rivera" },
            { id: 3, category: "Hospitalization", title: "Hospital stay", date_recorded: "2026-09-01", resolved: true },
        ],
        nutrition: [{ entry_type: "milk", entry_date: "2026-10-02" },
            { entry_type: "solid", entry_date: "2026-10-01", food_introduced: "Egg", reaction: "Rash" }],
        checkups: [{ title: "Past visit", checkup_date: "2026-10-01" }, { title: "Future visit", checkup_date: "2026-10-20" }],
    } } };
    reset(); tree = render(check.RecordsView, rich);
    const recordNodes = nodes(tree);
    const sections = recordNodes.filter((node) => node.type === check.Section || node.type === "SectionContainerCard");
    assert.equal(sections[0].props.title, "Child Profile");
    assert.equal(sections.filter((node) => node.props.title === "Child Profile").length, 1);
    const timestampNode = find(tree, (node) => node.type === check.SnapshotTimestamp);
    assert.equal(timestampNode.props.capturedAt, rich.session.capturedAt);
    assert(nodes(tree).indexOf(timestampNode) > nodes(tree).indexOf(find(tree, (node) => node.props.accessibilityLabel === "Back to consultation access")));
    assert(recordNodes.indexOf(timestampNode) < recordNodes.indexOf(sections[0]));
    assert(!find(sections[0], (node) => node.type === check.SnapshotTimestamp));
    assert.equal(nodes(tree).filter((node) => node.type === check.SnapshotTimestamp).length, 1);
    assert(!find(tree, (node) => node.props.accessibilityLabel === "Jump to Profile"));
    assert(find(tree, (node) => node.props.accessibilityLabel === "Jump to Growth"));
    assert(find(tree, (node) => node.props.accessibilityLabel === "Jump to Nutrition"));
    assert(text(tree).includes("Milk-type periods were not included in this older share."));
    const periods = [{ id: 77, milk_type: "Formula", start_date: "2026-09-01", end_date: null, notes: "Shared period note" }];
    const withPeriods = render(check.RecordsView, { session: { ...rich.session, payload: { ...rich.session.payload, milkTypePeriods: periods } } });
    assert(text(withPeriods).includes("Shared period note"));
    assert(!text(withPeriods).includes("Milk-type periods were not included in this older share."));
    assert(!text(tree).includes("Shared Baby Records"));
    assert(find(tree, (node) => node.props.label === "Hospital").props.value === "Shared hospital");
    const growthSection = sections.find((node) => node.props.title === "Growth");
    const latest = find(growthSection, (node) => node.type === summaries.LatestMeasurementsSummary);
    assert.equal(growthSection.props.count, undefined);
    assert.equal(latest.props.plain, true);
    assert.equal(latest.props.measurement.id, 2);
    assert.equal(latest.props.measurement.height, null, "Latest summary must not borrow an older height");
    const chart = find(growthSection, (node) => node.type === "GrowthChart");
    assert.equal(chart.props.plain, true);
    assert.equal(chart.props.showMetricDots, false);
    assert.deepEqual(chart.props.dateWindow, { from: "2026-09-03", to: "2026-10-02" });
    assert.equal(chart.props.rows, growthRows);
    assert.equal(chart.props.onViewDetail, undefined, "Viewer has no parent navigation action");
    assert(nodes(growthSection).indexOf(latest) < nodes(growthSection).indexOf(chart));
    const disclosure = find(growthSection, (node) => node.type === check.GrowthEntries);
    reset(); let entries = render(check.GrowthEntries, disclosure.props);
    assert.equal(find(entries, (node) => node.type === AnimatedReveal).props.expanded, false);
    assert(text(entries).includes("Show Entries"));
    runEffects(); await flush();
    entries = render(check.GrowthEntries, disclosure.props);
    find(entries, (node) => node.type === "TouchableOpacity").props.onPress();
    entries = render(check.GrowthEntries, disclosure.props); runEffects();
    assert(text(entries).includes("Hide Entries"));
    assert.equal(find(entries, (node) => node.type === AnimatedReveal).props.expanded, true);
    find(entries, (node) => node.type === "TouchableOpacity").props.onPress();
    entries = render(check.GrowthEntries, disclosure.props); runEffects();
    assert.equal(find(entries, (node) => node.type === AnimatedReveal).props.expanded, false);
    const history = find(entries, (node) => node.type === check.Capped);
    assert.equal(history.props.animate, false, "Outer Growth disclosure owns pagination height changes");
    const row = history.props.render(history.props.rows[0], 0);
    assert.equal(row.props.title, "01/10/2026");
    assert.equal(row.props.sub, dates.ageLabel(loadApp("utils/whoGrowth.js").ageInDays("2025-11-14", "2026-10-01")));
    const foods = sections.find((node) => node.props.title === "Solid Foods");
    assert.equal(foods.props.count, undefined);
    const foodSummary = find(foods, (node) => node.type === summaries.SolidFoodsSummary);
    reset(); const foodTree = render(summaries.SolidFoodsSummary, foodSummary.props);
    assert(text(foodTree).includes("Egg") && text(foodTree).includes("Rash") && text(foodTree).includes("Reaction recorded"));
    assert(!text(foodTree).includes("Mild"));
    assert(!sections.some((node) => node.props.title === "Feeding"));
    const care = sections.find((node) => node.props.title === "Appointments & Checkups");
    assert.equal(find(care, (node) => node.type === check.Capped).props.rows.length, 2);
    assert(!text(care).includes("LAST APPOINTMENT"));
    assert.equal(sections.findIndex(node => node.props.title === "Milk Type Periods"), sections.findIndex((node) => node.props.title === "Immunization Status") + 1);
    assert.equal(sections.indexOf(foods), sections.findIndex((node) => node.props.title === "Immunization Status") + 2);
    const medications = sections.find((node) => node.props.title === "Medication");
    const medicalHistory = sections.find((node) => node.props.title === "Medical History");
    assert.equal(sections.indexOf(medications), sections.indexOf(foods) + 1);
    assert.equal(medications.props.count, 1);
    assert.equal(medicalHistory.props.count, 2);
    const medicationList = find(medications, (node) => node.type === check.Capped);
    const medicalList = find(medicalHistory, (node) => node.type === check.Capped);
    assert.deepEqual(medicationList.props.rows.map((m) => m.id), [2]);
    assert.deepEqual(medicalList.props.rows.map((m) => m.id), [1]);
    assert(text(medicalHistory).includes("Conditions") && text(medicalHistory).includes("Hospital Stays"));
    const hospitalList = nodes(medicalHistory).filter((node) => node.type === check.Capped)[1];
    assert.deepEqual(hospitalList.props.rows.map((m) => m.id), [3]);
    const medicationRow = medicationList.props.render(medicationList.props.rows[0], 0);
    assert.deepEqual(medicationRow.props.badges, ["2 ml", "3x daily", "5 days"]);
    assert.equal(medicationRow.props.sub, "for Fever\nby Dr. Rivera");
    assert.equal(medicationRow.props.dateText, "01/10/2026");
    assert.equal(medicationRow.props.title, "Prescribed medicine");
    assert.equal(medicationRow.props.status, null);
    assert.equal(medicationRow.props.statusIcon, null);
    assert.equal(medicationRow.props.badge, undefined);
    const illnessRow = medicalList.props.render(medicalList.props.rows.find((m) => m.id === 1), 0);
    // Fixture lacks a recorded status: never invent an active illness.
    assert.equal(illnessRow.props.title, "Fever");
    assert.equal(illnessRow.props.status, "Status not recorded");
    const activeIllness = medicalList.props.render({ title: "Fever", category: "Illness", resolved: false, date_recorded: "2026-10-01", care_level: "home", facility: "Clinic" }, 0);
    assert.equal(activeIllness.props.statusIcon, null);
    assert.equal(activeIllness.props.status, "active");
    assert.equal(activeIllness.props.badge, "1 day");
    assert.equal(activeIllness.props.sub, "cared for at home\nClinic");
    assert.equal(activeIllness.props.dateText, "01/10/2026");
    assert.equal(medicalList.props.render({ category: "Illness", resolved: true }, 0).props.statusIcon, "checkmark-circle");
    reset(); const allergyView = render(check.RecordsView, { ...rich, session: { ...rich.session, payload: {
        allergies: { allergies: ["Egg", "Dust"], allergyEntries: [{ id: 99, category: "Allergy", allergy_type: "food", title: "Egg", resolved: false, date_recorded: "2026-10-01" }] }
    } } });
    const allergySection = find(allergyView, (node) => node.type === check.Section && node.props.title === "Medical History");
    assert.equal(allergySection.props.count, 1, "Only classified allergies are displayed");
    const allergyList = find(allergySection, (node) => node.type === check.Capped);
    assert.equal(allergyList.props.rows.length, 1);
    const allergyWrapper = allergyList.props.render(allergyList.props.rows[0], 0);
    assert.equal(allergyWrapper.props.style.paddingBottom, theme.exports.space.sm);
    const allergyRow = find(allergyWrapper, (node) => node.type === check.Item);
    assert.equal(allergyRow.props.title, "Egg");
    assert.equal(allergyRow.props.status, undefined);
    assert.equal(allergyRow.props.badge, undefined);
    assert.equal(allergyRow.props.statusIcon, undefined);
    assert.equal(allergyRow.props.dateText, "01/10/2026");
    assert.equal(allergyRow.props.sub, "");
    assert(!find(allergyView, (node) => node.type === check.Section && node.props.title === "Medication"));
    assert.equal(sections.at(-1), growthSection);
    const milestoneSection = sections.find((node) => node.props.icon?.props?.category === "milestone");
    const milestoneList = find(milestoneSection, (node) => node.type === check.Capped);
    const milestoneRow = milestoneList.props.render(milestoneList.props.rows[0], 0);
    assert.equal(milestoneRow.props.badge, "7 mos");
    assert.equal(find(tree, (node) => node.props.label === "Age").props.value, "10 mos");
    assert.equal(milestoneList.props.render({ title: "First steps", age_achieved: "2 years 1 month" }, 0).props.badge, "2 yrs 1 mo");
    assert.equal(milestoneList.props.render({ title: "First steps" }, 0).props.badge, "Age not recorded");
    assert.equal(milestoneRow.props.dateText, "14/06/2026");
    assert.equal(milestoneRow.props.sub, undefined);
    const careRow = find(care, (node) => node.type === check.Capped).props.render({ title: "Visit", doctor_name: "Doctor", clinic: "Clinic", checkup_date: "2026-10-01", time_of_visit: "12:00" }, 0);
    assert.equal(careRow.props.statusIcon, undefined);
    assert.equal(careRow.props.sub, "Doctor\nClinic");
    assert.equal(careRow.props.dateText, "01/10/2026");
    reset(); const badgeRow = render(check.Item, medicationRow.props);
    assert.equal(badgeRow.props.labelTrailing, true);
    assert.equal(badgeRow.props.icon.type, "MedicationIcon");
    assert.equal(badgeRow.props.icon.props.record, medicationRow.props.medicationRecord);
    assert.equal(badgeRow.props.iconBg, "transparent", "The capsule owns its circular background");
    assert.equal(badgeRow.props.subtitleNumberOfLines, 0);
    assert(!badgeRow.props.titleAccessory);
    assert.equal(badgeRow.props.trailingWidth, "45%");
    reset(); const boundedBadgeRow = render(cards.ListEntryCard, badgeRow.props);
    const trailing = find(boundedBadgeRow, (node) => Array.isArray(node.props.style) && node.props.style.some((style) => style?.width === "45%"));
    assert(trailing, "Medication badges have a bounded trailing column");
    assert.equal(trailing.children[0].props.style[1].flex, 1);
    assert.equal(trailing.children[0].props.style[1].minWidth, 0);
    assert.equal(badgeRow.props.label.children.length, 3);
    for (const [i, badge] of badgeRow.props.label.children.entries()) {
        assert.equal(badge.children[0].props.numberOfLines, undefined);
        assert.equal(badge.children[0].props.accessibilityLabel, medicationRow.props.badges[i]);
        assert.equal(badge.props.style.maxWidth, "100%");
    }
    reset(); const longBadge = render(check.Item, { title: "Medication", badges: ["A long recorded dose instruction that must remain fully readable"] });
    assert.equal(longBadge.props.label.children[0].children[0].props.numberOfLines, undefined);
    assert.equal(longBadge.props.label.props.style.flexWrap, "wrap");
    reset(); const emptyMedical = render(check.RecordsView, { ...rich, session: { ...rich.session, payload: { medicalHistory: [] } } });
    const emptyMedications = find(emptyMedical, (node) => node.type === check.Section && node.props.title === "Medication");
    assert.equal(emptyMedications.props.count, 0);
    assert(text(emptyMedications).includes("No medications to display"));
    assert(text(emptyMedications).includes("Taking") && text(emptyMedications).includes("Completed"));
    assert(text(medicalHistory).includes("Not shared"));
    assert(text(tree).includes("Record Shortcuts"));
    const viewerWith = (payload) => { reset(); return render(check.RecordsView, { ...rich, session: { ...rich.session, payload } }); };
    for (const [allergies, message] of [[{ allergies: [] }, "No allergy"], [{ allergies: ["Dust"] }, "No classified allergies to display"]]) {
        assert(text(viewerWith({ allergies })).includes(message));
    }
    const grouped = viewerWith({ medicalHistory: [
        { category: "Medication", title: "Taking", date_recorded: "2026-10-01", course_days: 5 },
        { category: "Medication", title: "Completed", resolved: true },
        { category: "Medication", title: "Ended", date_recorded: "2026-09-01", course_days: 2 },
        { category: "Medication", title: "Future", date_recorded: "2026-11-01", course_days: 2 },
        { category: "Medication", title: "Unknown" },
    ] });
    const groupedSection = find(grouped, (node) => node.type === check.Section && node.props.title === "Medication");
    assert.equal(groupedSection.props.count, 2);
    const groups = nodes(groupedSection).filter((node) => node.type === check.Capped);
    assert.deepEqual(groups.map((node) => node.props.rows.map((row) => row.title)), [["Taking"], ["Completed"]]);
    const completedMedication = groups[1].props.render(groups[1].props.rows[0], 0);
    assert.deepEqual(completedMedication.props.badges, []);
    reset(); assert.equal(render(check.Item, completedMedication.props).props.label, null);
    assert.equal(completedMedication.props.statusIcon, null);
    assert.equal(completedMedication.props.status, null);
    assert.deepEqual(medicationList.props.render({ category: "Medication", dose_amount: "As directed" }, 0).props.badges, ["As directed"]);
    const legacy = imports["../utils/viewerRecords"].medicalHistoryRows({ allergies: { allergies: ["Egg", "Dust"], foodAllergies: ["egg"] } });
    assert.deepEqual(legacy.map((row) => row.allergy_type), ["food", null]);
    const hereditaryPayload = { medicalHistory: [{ id: 11, title: "Fever", category: "Illness", date_recorded: "2026-10-01" }],
        allergies: { allergies: [], hereditaryConditions: [" asthma ", "Legacy condition", "Legacy condition"],
            hereditaryEntries: [{ id: 12, title: "Asthma", category: "Hereditary Condition", date_recorded: "2026-09-01", facility: "Clinic" }] } };
    const hereditaryView = viewerWith(hereditaryPayload);
    const hereditarySection = find(hereditaryView, (node) => node.type === check.Section && node.props.title === "Medical History");
    assert.equal(hereditarySection.props.count, 3);
    const hereditaryList = find(hereditarySection, (node) => node.type === check.Capped);
    assert.deepEqual(hereditaryList.props.rows.map((row) => row.title), ["Asthma", "Legacy condition"]);
    const historyHeadings = nodes(hereditarySection).filter((node) => node.type === "Text" && ["Hereditary", "Allergy", "Conditions"].includes(text(node))).map(text);
    assert.deepEqual(historyHeadings, ["Hereditary", "Allergy", "Conditions"]);
    const illnessList = nodes(hereditarySection).filter((node) => node.type === check.Capped)[1];
    assert.deepEqual(illnessList.props.rows.map((row) => row.title), ["Fever"]);
    const hereditaryRow = hereditaryList.props.render(hereditaryList.props.rows[0], 0);
    assert.equal(hereditaryRow.props.sub, "Clinic");
    assert.equal(hereditaryRow.props.dateText, "01/09/2026");
    assert.equal(hereditaryRow.props.status, undefined);
    assert.equal(hereditaryRow.props.badge, undefined);
    assert.equal(hereditaryList.props.render(hereditaryList.props.rows[1], 1).props.sub, "");
    assert(text(viewerWith({ allergies: { hereditaryConditions: [] } })).includes("No hereditary conditions recorded"));
    assert(text(viewerWith({ allergies: { hereditaryConditions: ["Old shared condition"] } })).includes("Illness records not shared"));
    assert.deepEqual(imports["../utils/viewerRecords"].medicalHistoryRows({ medicalHistory: hereditaryPayload.allergies.hereditaryEntries }), [], "Hereditary data requires its existing sharing permission");
    const unclassifiedView = viewerWith({ allergies: { allergies: ["Dust"] } });
    assert.equal(find(unclassifiedView, (node) => node.type === "Text" && text(node) === "No classified allergies to display").props.style[1].paddingBottom, theme.exports.space.sm);
    assert.equal(find(tree, (node) => node.props.label === "Weight (kg)").props.value, "8.2");
    assert.equal(find(tree, (node) => node.props.label === "Height (cm)").props.value, "Not recorded");
    assert.equal(find(tree, (node) => node.props.label === "Head Circumference (cm)").props.value, "Not recorded");
    const precisionView = viewerWith({ profile: rich.session.payload.profile, growth: { measurements: [
        { id: 4, date_recorded: "2026-10-02", height: "103.49", weight: "12.35", head_circumference: "47.85" },
    ] } });
    for (const [label, value] of [["Height (cm)", "103.49"], ["Weight (kg)", "12.35"], ["Head Circumference (cm)", "47.85"]])
        assert.equal(find(precisionView, (node) => node.props.label === label).props.value, value);
    assert(!find(tree, (node) => node.props.label?.startsWith("Latest ")));
    assert.equal(find(tree, (node) => node.props.label === "Emergency Contact First Name").props.value, "Maria Clara");
    assert(!find(tree, (node) => node.props.label === "Birth Weight / Length"));
    const profile = render(check.ViewerChildProfileCard, { session: rich.session, measurements: [{ height: "103.49", weight: "12.35", head_circumference: "47.85" }] });
    const profileRows = nodes(profile).filter(node => node.type === check.ProfileRow);
    assert.deepEqual(profileRows.map(node => node.props.label), ["Date of Birth", "Age", "Sex", "Blood Type", "Height (cm)", "Weight (kg)",
        "Head Circumference (cm)", "Hospital", "Pediatrician", "OB-GYNE", "Emergency Contact First Name", "Emergency Contact Last Name",
        "Emergency Contact Relationship", "Emergency Contact Contact Number"]);
    assert(text(profile).replace(/\s+/g, " ").includes(`${rich.session.recordKeys.length} record types shared · code ${rich.session.code}`));
    assert(!find(profile, node => /Touchable|Pressable|TextInput|Button/.test(String(node.type))), "The profile stays read-only");
    const longValue = "A very long shared hospital and specialist care center";
    reset(); let profileRow = render(check.ProfileRow, { label: "Hospital", value: longValue });
    const profileRowText = nodes(profileRow).filter(node => node.type === "Text");
    assert.equal(text(profileRowText[1]), longValue);
    assert(profileRowText.every(node => node.props.numberOfLines === undefined), "Labels and values never truncate");
    profileRow.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    profileRow = render(check.ProfileRow, { label: "Hospital", value: longValue });
    assert(!profileRow.props.style[1], "Readable columns stay inline");
    profileRow.props.onLayout({ nativeEvent: { layout: { width: 248 } } });
    profileRow = render(check.ProfileRow, { label: "Emergency Contact Contact Number", value: "09171234567" });
    assert.equal(profileRow.props.style[1].flexDirection, "column", "A narrow container stacks without reducing text size");
    assert.equal(nodes(profileRow).filter(node => node.type === "Text")[1].props.style[1].textAlign, "left");
    assert.equal(text(nodes(profileRow).filter(node => node.type === "Text")[1]), "09171234567");
    profileRow.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    fontScale = 1.5;
    profileRow = render(check.ProfileRow, { label: "Hospital", value: longValue });
    assert.equal(profileRow.props.style[1].flexDirection, "column", "Font scaling participates in the column allowance");
    fontScale = 1;
    profileRow = render(check.ProfileRow, { label: "Hospital", value: longValue });
    assert(!profileRow.props.style[1], "Widening or restoring font size returns to inline columns");
    reset(); assert.equal(text(render(check.ProfileRow, { label: "Blood Type", value: "" })).trim(), "Blood Type —");
    reset(); assert.equal(render(check.Row, { label: "Birth Weight", value: "3.2 kg" }).props.style[0].borderTopWidth, 1,
        "Birth Measurements retains its existing row appearance");
    for (const gender of ["girl", "boy", "neutral"]) for (const currentScheme of ["light", "dark"]) {
        colors = theme.exports.paletteFor(undefined, gender, currentScheme); scheme = currentScheme;
        reset(); const themedProfile = render(check.ViewerChildProfileCard, { session: rich.session });
        assert.deepEqual(themedProfile.props.background.props.colors, colors.clinicalSummary.panel);
        reset(); const themedProfileRow = render(check.ProfileRow, { label: "Age", value: "10 mos" });
        assert.deepEqual(find(themedProfileRow, node => node.type === "ClinicalSurface").props.colors, colors.clinicalSummary.item);
        assert.equal(find(themedProfileRow, node => node.type === "Text" && text(node) === "10 mos").props.style[0].color, colors.clinicalSummary.text);
        assert.equal(themedProfileRow.props.style[0].borderTopWidth, undefined, "Capsules have no inter-row dividers");
        reset(); const neutral = render(summaries.LatestMeasurementsSummary, { measurement: latest.props.measurement, plain: true });
        assert.equal(neutral.type, "View");
        assert.equal(neutral.props.style.backgroundColor, colors.surface);
        assert.equal(find(neutral, (node) => node.type === "Text").props.style.color, colors.text);
        reset(); const sectionIcon = render(check.Section, { icon: "calendar", title: "Card" }).props.icon;
        assert.equal(sectionIcon.props.size, 29.16);
        assert.equal(sectionIcon.props.style.lineHeight, sectionIcon.props.size);
        assert.equal(sectionIcon.props.style.width, sectionIcon.props.size);
        assert.equal(sectionIcon.props.style.height, sectionIcon.props.size);
        assert.equal(sectionIcon.props.style.includeFontPadding, false);
    }
    reset(); const missed = render(check.VaccineStatus, { rows: [
        { vaccine_name: "Missed vaccine", status: "pending", due_date: "2026-01-01" }] });
    assert(text(missed).replace(/\s+/g, " ").includes("1 missed dose") && !text(missed).includes("Missed vaccine"));
    const vaccineFixtures = [
        { vaccine_name: "Upcoming vaccine", dose_number: 2, visit_name: "Clinic visit", status: "pending", due_date: "2026-10-03" },
        { vaccine_name: "Given vaccine", status: "completed", date_given: "2026-10-01", reaction_severity: "severe", reaction: "Recorded reaction" },
        { vaccine_name: "Overdue vaccine", status: "pending", due_date: "2026-09-01" },
        { vaccine_name: "Undated vaccine", status: "pending" },
    ];
    const vaccineView = viewerWith({ vaccinations: vaccineFixtures });
    const vaccineSection = find(vaccineView, (node) => node.type === check.Section && node.props.title === "Immunization Status");
    const vaccineList = find(vaccineSection, (node) => node.type === check.Capped);
    for (const [index, vaccine] of vaccineFixtures.entries()) {
        const record = vaccineList.props.render(vaccine, index);
        const expected = vaccine.status === "completed" ? `given ${dates.shortDate(vaccine.date_given) || "—"}`
            : `due ${dates.shortDate(vaccine.due_date) || "—"}`;
        assert.equal(record.props.dateText, expected);
        assert(!record.props.sub.includes(expected));
        reset(); const item = render(check.Item, record.props);
        assert.equal(item.props.dateText, expected);
        reset(); const rendered = render(cards.ListEntryCard, item.props);
        const dateNode = find(rendered, (node) => node.type === "Text" && text(node) === expected);
        const textColumn = find(rendered, (node) => node.children?.includes(dateNode));
        assert.equal(textColumn.children.filter(Boolean).at(-1), dateNode);
    }
    assert.equal(vaccineList.props.render(vaccineFixtures[1], 1).props.flag, "severe reaction: Recorded reaction");
    reset(); const nextVisit = render(check.VaccineStatus, { rows: [vaccineFixtures[0]] });
    assert.deepEqual(nodes(nextVisit).filter((node) => node.type === "Text").map(text),
        ["Next due", "Upcoming vaccine dose 2", dates.shortDate("2026-10-03")]);
    reset(); const foodFacts = render(check.ClinicalSummary, { recordKeys: ["allergies"], payload: {
        allergies: { allergies: ["Egg", "Dust"], foodAllergies: ["Egg"], unclassifiedAllergies: [] }, nutrition: rich.session.payload.nutrition } });
    const summarySection = (tree, title) => {
        const section = find(tree, n => n.type === check.ClinicalSection && n.props.title === title.toUpperCase());
        return section ? render(check.ClinicalSection, section.props) : undefined;
    };
    const sectionList = (tree, title) => find(summarySection(tree, title), node => node.type === check.Capped);
    assert.deepEqual(sectionList(foodFacts, "Allergies").props.rows.map((entry) => entry.title), ["Egg"]);
    assert.equal(sectionList(foodFacts, "Allergies").props.render(sectionList(foodFacts, "Allergies").props.rows[0], 0).props.title, "Egg");
    assert(!text(foodFacts).includes("unclassified allergy") && !text(foodFacts).includes("No allergies"));
    assert.equal(find(foodFacts, node => node.type === check.FeedingSummary), undefined, "Excluded nutrition never mounts a feeding section");
    assert.equal(render(check.FeedingSummary, { rows: rich.session.payload.nutrition, shared: false }), null);
    assert.equal(check.feedingSummary(rich.session.payload.nutrition).reactions.length, 1);
    const feedingRows = [
        { entry_type: "milk", entry_date: "2026-09-26", milk_type: "Breastmilk", feed_method: "breast", duration_minutes: "12", notes: "Parent's observation" },
        { entry_type: "milk", entry_date: "2026-10-01", milk_type: "Formula", feed_method: "bottle", quantity: "2", unit: "oz", formula_brand: "Brand A" },
        { entry_type: "milk", entry_date: "2026-10-02", entry_time: "10:30", milk_type: "Mixed", feed_method: "bottle", quantity: "100", breastmilk_quantity: "50", unit: "mL", formula_brand: "Brand B" },
        { entry_type: "milk", entry_date: "2026-10-02", milk_type: "Mixed", feed_method: "bottle", quantity: "60", unit: "mL" },
        { entry_type: "milk", entry_date: "2026-10-02", milk_type: "Breastmilk", feed_method: "breast" },
        { entry_type: "milk", entry_date: "2026-10-02" },
        { entry_type: "milk", entry_date: "2026-10-01", milk_type: "Breastmilk", quantity: "0.1", unit: "L" },
        { entry_type: "solid", entry_date: "2026-10-02", food_introduced: "Banana", reaction_severity: "none" },
        { entry_type: "solid", entry_date: "2026-09-30", food_introduced: "Egg", reaction_severity: "mild", reaction: "Rash" },
        { entry_type: "solid", entry_date: "2026-09-20", food_introduced: "Egg", reaction_severity: "severe", reaction: "Swelling" },
        { entry_type: "solid", entry_date: "2026-09-15", food_introduced: "Lugaw" },
        { entry_type: "milk", entry_date: "2026-10-03", milk_type: "Formula", quantity: 999, unit: "mL" },
        { entry_type: "milk", entry_date: "2026-02-30", feed_method: "breast", duration_minutes: 999 },
        { entry_type: "milk", entry_date: "2026-09-25", milk_type: "Formula", quantity: 999, unit: "mL" },
    ];
    const facts = check.feedingSummary(feedingRows);
    assert.equal(facts.days, 8);
    assert.deepEqual(facts.averages, { milk: 1.1, bottle: 288.4, breast: 1.5, solid: 0.5 });
    assert.equal(facts.reactions[0].reactionSeverity, "severe");
    assert.deepEqual(check.feedingSummary([...feedingRows].reverse()).averages, facts.averages);
    assert.deepEqual(check.feedingSummary([]).averages, { milk: null, bottle: null, breast: null, solid: null });
    assert.equal(check.feedingSummary([{ entry_type: "milk", entry_date: "2026-10-01", quantity: "bad", unit: "mL" }]).averages.bottle, null);
    assert.equal(check.feedingSummary([{ entry_type: "milk", entry_date: "2026-10-01", feed_method: "bottle", quantity: 80, unit: "unknown" }]).averages.bottle, null);
    assert.equal(check.feedingSummary([{ entry_type: "milk", entry_date: "2026-10-01", feed_method: "breast", duration_minutes: -1 }]).averages.breast, null);
    const undated = check.feedingSummary([{ entry_type: "solid", food_introduced: "Peanut", reaction: "Rash" }]);
    assert.equal(undated.days, 0); assert.equal(undated.averages.solid, null); assert.equal(undated.reactions.length, 1);
    assert.deepEqual(check.feedingSummary([null, "bad", { entry_type: "other" }]).averages,
        { milk: null, bottle: null, breast: null, solid: null });
    const sharedDays = check.feedingSummary([
        { entry_type: "milk", entry_date: "2026-09-01", quantity: 100, unit: "mL" },
        { entry_type: "milk", entry_date: "2026-09-01", feed_method: "breast", duration_minutes: 20 },
        { entry_type: "solid", entry_date: "2026-10-01" },
    ]);
    assert.equal(sharedDays.days, 2, "Duplicate dates and calendar gaps do not enlarge the denominator");
    assert.deepEqual(sharedDays.averages, { milk: 1, bottle: 50, breast: 10, solid: 0.5 });
    const partial = check.feedingSummary([
        { entry_type: "milk", entry_date: "2026-10-01", milk_type: "Mixed", quantity: 100, unit: "mL" },
        { entry_type: "milk", entry_date: "2026-10-01", quantity: 2, unit: "oz" },
        { entry_type: "milk", entry_date: "2026-10-01", quantity: 0.1, unit: "L" },
    ]);
    assert.equal(partial.averages.milk, 3);
    assert.equal(partial.averages.bottle, 159.1, "Incomplete Mixed amounts are excluded; oz and L convert to mL");
    reset(); const feedingProps = { rows: feedingRows, shared: true };
    let feedingTree = render(check.FeedingSummary, feedingProps);
    const tiles = (tree) => nodes(tree).filter((node) => node.props.testID?.startsWith("feeding-metric-"));
    assert.deepEqual(tiles(feedingTree).map((tile) => text(tile).replace(/\s+/g, " ").trim()),
        ["Milk 1.1 entries", "Bottle amounts 288.4 mL", "Breastfeeding time 1.5 min", "Solid foods 0.5 entries"]);
    const perDay = find(feedingTree, (node) => node.type === "Text" && text(node) === "avg per day");
    const feedingHeader = find(feedingTree, (node) => node.props.accessibilityRole === "header");
    assert(text(feedingHeader).replace(/\s+/g, " ").trim() === "FEEDING avg per day");
    assert.equal(perDay.props.style.textTransform, "none");
    assert.equal(perDay.props.style.fontWeight, "400");
    assert(perDay.props.style.fontSize < feedingHeader.props.style.fontSize);
    assert.equal(perDay.props.style.color, colors.clinicalSummary.secondary);
    assert(tiles(feedingTree).every((tile) => !text(tile).includes("/day") && tile.props.accessibilityLabel.includes("per day")));
    assert(text(feedingTree).includes("Daily averages across logged days"));
    assert(!/Feeding Details|log window|Latest recorded|Parent notes|Logs may/.test(text(feedingTree)));
    assert.equal(tiles(render(check.FeedingSummary, { rows: feedingRows, shared: false })).length, 0);
    const reactions = find(feedingTree, (node) => node.type === check.Capped && node.props.noun === "food reactions");
    assert.equal(reactions.props.rows.length, 2);
    assert.notEqual(reactions.props.animate, false);
    const reactionRow = reactions.props.render(reactions.props.rows[0], 0);
    const reactionText = text(reactionRow);
    assert(reactionText.includes("Egg") && reactionText.includes("Severe") && !reactionText.includes("Reported")
        && reactionText.includes("20/09/2026") && !reactionText.includes("Swelling"));
    assert.equal(text(find(reactionRow, n => n.type === "View" && n.children.some(c => c?.type === "Text" && text(c) === "Egg"))?.children?.at(-1)), "20/09/2026");
    assert.equal(reactionRow.props.style.alignItems, "center");
    assert.equal(reactionRow.children.at(-1).props.style[0].alignSelf, "center");
    assert.equal(text(reactionRow.children.at(-1)).trim(), "Severe");
    assert.equal(text(reactions.props.render(reactions.props.rows[1], 1).children.at(-1)).trim(), "Mild");
    assert.equal(reactions.props.contentStyle.gap, 14);
    assert.equal(reactionRow.props.style.marginBottom, undefined);
    assert.equal(text(reactions.props.render(undated.reactions[0], 0).children.at(-1)).trim(), "Severity not recorded");
    assert.equal(facts.reactions[0].reaction, "Swelling", "Removing the displayed description preserves the stored report");
    const manyReactions = Array.from({ length: 15 }, (_, i) => ({ entry_type: "solid", food_introduced: `Food ${i}`, reaction: "Rash" }));
    reset(); const fullReactions = render(check.FeedingSummary, { rows: manyReactions, shared: true });
    assert.equal(find(fullReactions, (node) => node.type === check.Capped).props.rows.length, 15);
    reset(); const emptyFeeds = render(check.FeedingSummary, { rows: [], shared: true });
    assert.deepEqual(tiles(emptyFeeds).map((tile) => text(tile).trim()),
        ["Milk Not recorded", "Bottle amounts Not recorded", "Breastfeeding time Not recorded", "Solid foods Not recorded"]);
    assert(text(emptyFeeds).includes("No food reactions reported."));
    reset(); const largeValueTree = render(check.FeedingSummary, { shared: true,
        rows: [{ entry_type: "milk", entry_date: "2026-10-01", quantity: 999999, unit: "mL" }] });
    const largeBottle = find(largeValueTree, (node) => node.props.testID === "feeding-metric-bottle");
    assert(text(largeBottle).replace(/\s+/g, " ").includes("999999 mL"));
    assert(nodes(largeBottle).filter((node) => node.type === "Text").every((node) => node.props.numberOfLines === undefined));
    assert(!source.includes("Watermark"), "Viewer watermark context/component and all footer calls are removed");
    for (const showMetricDots of [undefined, false]) {
        reset(); let growthTree = render(ActualGrowthChart, { ...chart.props, showMetricDots });
        const options = nodes(growthTree).filter((node) => node.type === "AnchoredMenuItem");
        assert.equal(options.length, 3);
        assert(options.every((node) => showMetricDots === false ? node.props.leading === null : !!node.props.leading));
        assert.equal(options[0].props.selected, true);
        options[1].props.onPress();
        growthTree = render(ActualGrowthChart, { ...chart.props, showMetricDots });
        assert.equal(nodes(growthTree).filter((node) => node.type === "AnchoredMenuItem")[1].props.selected, true);
    }
    assert.equal(check.makeStyles(colors).feedingMetricValue.fontSize, 24);
    assert.equal(check.makeStyles(colors).feedingMetricValue.lineHeight, 31);
    for (const [width, scale, columns] of [[768, 1, 2], [320, 1, 2], [296, 1, 2], [280, 1, 2], [240.99998, 1, 2], [220, 1, 1], [320, 2, 1]]) {
        reset(); fontScale = scale;
        feedingTree = render(check.FeedingSummary, feedingProps);
        find(feedingTree, (node) => node.props.testID === "feeding-metrics").props.onLayout({ nativeEvent: { layout: { width } } });
        feedingTree = render(check.FeedingSummary, feedingProps);
        const side = Math.floor((width - 12 * (columns - 1)) / columns);
        for (const tile of tiles(feedingTree)) {
            const style = Object.assign({}, ...tile.props.style);
            assert.equal(style.width, side); assert.equal(style.aspectRatio, undefined);
            assert.equal(style.minHeight, 164);
            assert.equal(style.height, undefined, "Cards grow for wrapping content");
            assert.equal(style.alignItems, side >= 200 * scale ? "center" : "flex-start"); assert.equal(style.padding, theme.exports.space.md);
            assert.equal(style.borderWidth, undefined);
            const icon = find(tile, (node) => node.type === "MetricArtwork" || node.type === "SolidFoodIcon" || node.type === "MilkIcon");
            assert.equal(icon.props.size, 48);
            const label = find(tile, (node) => node.props.style?.textAlign === "left" && node.props.style?.color === colors.clinicalSummary.secondary);
            assert(label);
            assert(!text(tile).includes("%"));
            assert.equal(tile.props.accessibilityLabel.includes("logged days"), true);
        }
        assert(side * columns + 12 * (columns - 1) <= width);
        assert(width - (side * columns + 12 * (columns - 1)) < columns);
    }
    fontScale = 1;
    reset(); const orderedSummary = text(render(check.ClinicalSummary, { recordKeys: ["allergies", "vaccinations"], payload: {
        allergies: { allergies: ["Egg"], foodAllergies: ["Egg"] },
        vaccinations: [{ status: "due", due_date: "2000-01-01" }],
    } }));
    assert(orderedSummary.indexOf("past due date") < orderedSummary.indexOf("ALLERGIES"));
    assert(!orderedSummary.includes("Food Allergies") && !orderedSummary.includes("Allergies: Egg"));
    for (const palette of [...Object.values(theme.exports.PALETTES), ...Object.values(theme.exports.DARK_PALETTES)]) {
        const previous = colors; colors = palette;
        reset(); const themed = render(check.FeedingSummary, feedingProps);
        assert.equal(find(themed, (node) => node.props.accessibilityRole === "header").props.style.color, colors.clinicalSummary.text);
        assert.equal(find(tiles(themed)[0], node => node.type === "ClinicalSurface").props.colors, colors.clinicalSummary.item);
        assert(nodes(themed).filter((node) => node.type === "Text").every((node) => node.props.numberOfLines === undefined));
        colors = previous;
    }
    reset(); assert(text(render(check.ClinicalSummary, { recordKeys: ["allergies"], payload: {
        allergies: { allergies: ["Dust"], foodAllergies: [], unclassifiedAllergies: ["Dust"] } } })).includes("No classified allergies"));
    reset(); assert.equal(render(check.ClinicalSummary, { recordKeys: [], payload: {} }), null);
    reset(); assert(text(render(check.ClinicalSummary, { recordKeys: ["allergies"], payload: {
        allergies: { allergies: ["Dust"] } } })).includes("No classified allergies"));
    const longName = "A long recorded hereditary condition name that must remain unchanged in the item title";
    const sectionsPayload = {
        allergies: { allergies: ["Egg", "Dust", "Peanut", " EGG "], foodAllergies: ["Egg", "Peanut"],
            allergyEntries: [
                { id: 1, category: "Allergy", title: "Egg", allergy_type: "food", description: "Hidden allergy description" },
                { id: 2, category: "Allergy", title: "Peanut", allergy_type: "food" },
                { id: 3, category: "Allergy", title: "Dust", allergy_type: "non_food" },
            ],
            hereditaryConditions: [longName, "Thalassemia"] },
        medicalHistory: [
            { category: "Medication", title: "Current medicine", date_recorded: "2026-10-02", resolved: false,
                dose_amount: "5 mL", frequency_per_day: 3, course_days: 4, description: "Do not display this description" },
            { category: "Medication", title: "Completed medicine", date_recorded: "2026-10-02", resolved: true },
            { category: "Medication", title: "Old medicine", date_recorded: "2025-01-01", course_days: 3, resolved: false },
            { category: "Illness", title: "An illness", date_recorded: "2026-10-02", resolved: false },
        ],
    };
    reset(); const namedSummary = render(check.ClinicalSummary, {
        recordKeys: ["allergies", "medicalHistory"], payload: sectionsPayload });
    assert.deepEqual(sectionList(namedSummary, "Allergies").props.rows.map((entry) => entry.title), ["Egg", "Peanut", "Dust"]);
    const combinedList = sectionList(namedSummary, "Allergies");
    const nonFoodRow = render(check.ClinicalRecord, combinedList.props.render(combinedList.props.rows[2], 2).props);
    assert(text(nonFoodRow).includes("Dust") && text(nonFoodRow).includes("non-food"));
    assert(!nodes(nonFoodRow).some(node => node.props.onPress || ["RecordIcon", "MedicationIcon"].includes(node.type)));
    assert(!text(namedSummary).includes("Food Allergies") && !text(namedSummary).includes("Hidden allergy description"));
    reset(); const unknownOnly = render(check.ClinicalSummary, { recordKeys: ["allergies"],
        payload: { allergies: { allergies: ["Mold", "Dust"] } } });
    assert.equal(sectionList(unknownOnly, "Allergies"), undefined);
    assert(text(unknownOnly).includes("No classified allergies") && !text(unknownOnly).includes("unclassified allergy"));
    assert(!nodes(summarySection(unknownOnly, "Allergies")).some((node) => node.type === "View"
        && [node.props.style].flat().some((style) => style?.backgroundColor === colors.warningBg)));
    assert(!text(unknownOnly).includes("Mold") && !text(unknownOnly).includes("Dust"));
    reset(); const nonFoodOnly = render(check.ClinicalSummary, { recordKeys: ["allergies"],
        payload: { allergies: { allergyEntries: [{ title: longName, category: "Allergy", allergy_type: "non_food" }] } } });
    const nonFoodList = sectionList(nonFoodOnly, "Allergies");
    assert.equal(nonFoodList.props.rows.length, 1);
    assert.equal(nonFoodList.props.render(nonFoodList.props.rows[0], 0).props.title, longName);
    reset(); assert(text(render(check.ClinicalSummary, { recordKeys: ["allergies"], payload: {} }))
        .includes("Allergy records unavailable"));
    assert.deepEqual(sectionList(namedSummary, "Hereditary").props.rows.map(r => r.title), [longName, "Thalassemia"]);
    assert.deepEqual(sectionList(namedSummary, "Currently Taking").props.rows.map(r => r.title), ["Current medicine"]);
    for (const title of ["Illness", "Allergies", "Hereditary", "Currently Taking"]) {
        const section = summarySection(namedSummary, title);
        const sectionStyle = Object.assign({}, ...[section.props.style].flat());
        assert.equal(sectionStyle.paddingTop, title === "Illness" ? 0 : 14);
        assert.equal(sectionStyle.gap, 14);
        const heading = find(section, node => node.props.accessibilityRole === "header");
        assert.equal(heading.props.style.includeFontPadding, false);
        const list = sectionList(namedSummary, title);
        const row = render(check.ClinicalRecord, list.props.render(list.props.rows[0], 0).props);
        assert(!nodes(row).some(node => node.props.onPress || ["RecordIcon", "MedicationIcon"].includes(node.type)));
        assert(text(row).includes(list.props.rows[0].title));
        if (title === "Currently Taking") assert(text(row).includes("5 mL \u2022 3 times a day \u2022 Day 1 of 4"));
    }
    reset(); const hiddenSections = render(check.ClinicalSummary, { payload: sectionsPayload, recordKeys: [] });
    assert.equal(sectionList(hiddenSections, "Allergies"), undefined);
    assert(!text(hiddenSections).includes("unclassified allergy") && !text(hiddenSections).includes("Egg"));
    assert.equal(sectionList(hiddenSections, "Hereditary"), undefined);
    assert.equal(sectionList(hiddenSections, "Currently Taking"), undefined);
    assert.equal(hiddenSections, null);
    const permissionPayload = { ...sectionsPayload,
        vaccinations: [{ vaccine_name: "Excluded vaccine", status: "scheduled", due_date: "2000-01-01", reaction_severity: "severe", reaction: "Excluded report" }],
        nutrition: feedingRows,
        medicalHistory: [...sectionsPayload.medicalHistory,
            { id: 301, category: "Illness", title: "Past shared illness", resolved: true },
            { id: 302, category: "Hospitalization", title: "Separate hospital stay", resolved: false }],
    };
    const savedPayload = JSON.stringify(permissionPayload);
    for (const keys of [["nutrition"], ["allergies"], ["medicalHistory"], ["vaccinations"], []]) {
        reset(); const scoped = render(check.ClinicalSummary, { payload: permissionPayload, recordKeys: keys });
        const serialized = JSON.stringify(scoped);
        if (!keys.includes("medicalHistory")) assert(!/Current medicine|Past shared illness|Separate hospital stay/.test(serialized));
        if (!keys.includes("allergies")) assert(!/Thalassemia|Hidden allergy description/.test(serialized));
        if (!keys.includes("vaccinations")) assert(!/Excluded vaccine|Excluded report|past due date/.test(serialized));
        assert.equal(!!find(scoped, n => n.type === check.FeedingSummary), keys.includes("nutrition"));
    }
    reset(); const fullClinical = render(check.ClinicalSummary, { payload: permissionPayload, recordKeys: ["allergies", "medicalHistory", "nutrition", "vaccinations"] });
    assert.deepEqual(nodes(fullClinical).filter(n => n.type === check.ClinicalSection).map(n => n.props.title), ["ILLNESS", "ALLERGIES", "HEREDITARY", "CURRENTLY TAKING"]);
    assert.deepEqual(sectionList(fullClinical, "Illness").props.rows.map(r => r.title), ["An illness", "Past shared illness"]);
    assert(nodes(fullClinical).findIndex(n => n.props.testID === "clinical-safety-notices") < nodes(fullClinical).findIndex(n => n.type === check.ClinicalSection));
    assert.equal(JSON.stringify(permissionPayload), savedPayload, "Summary rendering never mutates its frozen snapshot");
    const structuredHereditary = render(check.ClinicalSummary, { recordKeys: ["allergies"], payload: {
        allergies: { hereditaryConditions: ["Inherited condition", "Legacy condition"], hereditaryEntries: [
            { id: 40, category: "Hereditary Condition", title: "Inherited condition" }] } } });
    assert.deepEqual(sectionList(structuredHereditary, "Hereditary").props.rows.map(r => r.title), ["Inherited condition", "Legacy condition"]);
    const unknownReaction = reactions.props.render(undated.reactions[0], 0);
    assert.deepEqual(find(unknownReaction, n => n.type === "ClinicalSurface").props.colors, colors.clinicalSummary.unknown.surface);
    for (const severity of ["mild", "severe"]) {
        const row = reactions.props.render({ reactionSeverity: severity, foodIntroduced: "Same food", date: "2026-10-01" }, 0);
        assert.deepEqual(find(row, n => n.type === "ClinicalSurface").props.colors, colors.clinicalSummary[severity].surface);
        assert(find(row, n => n.type === check.ReactionWarning && n.props.severity === severity));
    }
    reset(); const emptySections = render(check.ClinicalSummary, { recordKeys: ["allergies", "medicalHistory"],
        payload: { allergies: { foodAllergies: [], hereditaryConditions: [] }, medicalHistory: [] } });
    assert(text(emptySections).includes("No allergies"));
    assert(text(emptySections).includes("No hereditary conditions recorded"));
    assert(text(emptySections).includes("No medications currently being taken"));
    reset(); const longList = render(check.ClinicalSummary, { recordKeys: ["allergies"],
        payload: { allergies: { allergies: Array.from({ length: 15 }, (_, i) => `Food ${i}`),
            foodAllergies: Array.from({ length: 15 }, (_, i) => `Food ${i}`) } } });
    const cappedNames = sectionList(longList, "Allergies");
    assert.equal(cappedNames.props.rows.length, 15);
    reset(); let revealedNames = render(check.Capped, cappedNames.props);
    assert.equal(revealedNames.type, AnimatedReveal);
    assert.equal(nodes(revealedNames).filter((node) => node.type === check.ClinicalRecord).length, 10);
    find(revealedNames, (node) => node.type === "TouchableOpacity").props.onPress();
    revealedNames = render(check.Capped, cappedNames.props);
    assert.equal(nodes(revealedNames).filter((node) => node.type === check.ClinicalRecord).length, 15);
    reset(); assert(!find(render(check.GrowthEntries, { measurements: [] }), (node) => node.type === "TouchableOpacity"));
    reset(); const withheld = render(check.RecordsView, { ...rich, session: { ...rich.session,
        payload: { growth: rich.session.payload.growth, nutrition: rich.session.payload.nutrition } } });
    assert(text(withheld).includes("Profile not shared") && !find(withheld, (node) => node.type === "GrowthChart"));
    assert(!find(withheld, (node) => node.props.label === "Hospital"));
    assert(!find(withheld, (node) => node.type === check.Section && ["Medical History", "Medication"].includes(node.props.title)),
        "Withheld medical history must also withhold medications");
    reset(); const noGrowth = render(check.RecordsView, { ...rich, session: { ...rich.session,
        payload: { profile: rich.session.payload.profile } } });
    for (const label of ["Height (cm)", "Weight (kg)", "Head Circumference (cm)"])
        assert.equal(find(noGrowth, (node) => node.props.label === label).props.value, "Not shared");
    reset(); const header = render(cards.SectionContainerCard, { title: "Growth Measurements", count: 3, icon: "icon" });
    assert(text(header).includes("3"));
    for (const title of ["Medication", "Growth Measurements", "A long card header that wraps onto multiple lines"]) {
        reset(); const aligned = render(cards.SectionContainerCard, { title, icon: "icon" });
        const titleNode = find(aligned, (node) => node.type === "Text" && text(node) === title);
        assert.equal(titleNode.props.style[1].alignSelf, "center");
        assert.equal(titleNode.props.style[1].includeFontPadding, false);
        assert.equal(titleNode.props.style[1].textAlignVertical, "center");
        assert.equal(titleNode.props.numberOfLines, undefined, "Long card headings remain fully readable");
        const titleRow = nodes(aligned).find((node) => node.children?.includes(titleNode));
        assert.equal(titleRow.props.style.alignItems, "center");
        assert.equal(titleRow.children[0].props.style.alignSelf, "center");
    }
    const badge = find(header, (node) => node.type === "Text" && text(node) === "3");
    const badgeParent = nodes(header).find((node) => node.children?.includes(badge));
    assert.equal(badgeParent.props.style.backgroundColor, colors.surfaceAlt);
    reset(); const item = render(check.Item, { title: "Record", tone: colors.info, statusIcon: "analytics-outline" });
    assert.equal(item.props.iconAlign, "center");
    reset(); assert.equal(render(check.Item, { title: "Measurement", tone: colors.recGrowth.on,
        statusIcon: "analytics-outline" }).props.iconBg, colors.recGrowth.bg);
    for (const file of ["Growth.js"]) {
        assert(fs.readFileSync(path.join(__dirname, file), "utf8").includes('from "./common/RecordSummaries"'), `${file} reuses the exact summary`);
    }
    assert(fs.readFileSync(path.join(__dirname, "NutritionTracker.js"), "utf8").includes('from "./ui/SolidFoodsCard"'));
    assert(fs.readFileSync(path.join(__dirname, "ui/SolidFoodsCard.js"), "utf8").includes('solidFoodStats(solids,'), "Parent dashboard retains the shared food overview calculations");
    const snapshotSource = fs.readFileSync(path.resolve(appRoot, "../back-end/src/utils/snapshot.js"), "utf8");
    assert(snapshotSource.includes("SELECT id, height, weight, head_circumference, date_recorded, measured_at FROM growth_records WHERE child_id = $1 ORDER BY date_recorded DESC, id DESC"));
    const snapshotModule = { exports: {} }; let snapshotQuery;
    new Function("require", "module", "exports", snapshotSource)((name) => {
        if (name === "../db/pool") return { query: async (sql, args) => {
            snapshotQuery = { sql, args }; return { rows: growthRows };
        } };
        if (name === "./crypto" || name === "./emergencyContact") return {};
        throw new Error(`Unexpected snapshot import ${name}`);
    }, snapshotModule, snapshotModule.exports);
    const built = await snapshotModule.exports.buildSnapshot({ id: 42 }, ["growth"]);
    assert.deepEqual(snapshotQuery.args, [42], "Snapshot stays scoped to the authorized child");
    assert.equal(built.growth.measurements[1].id, 2);
    assert.equal(built.profile, undefined, "Growth sharing does not add a withheld profile");
    assert.equal(summaries.growthMeasurements([{ date_recorded: "2026-10-01", weight: 8 }], null)[0].day, null, "Legacy snapshots without IDs/DOB remain readable");
    console.log("Professional viewer checks passed: Neumorphic clinical sections, permission gates, text-only records, medication details, normalized hereditary data, logged-day averages, fractional-width grids, reaction severity/gaps, pagination, protected sessions and six themes.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
