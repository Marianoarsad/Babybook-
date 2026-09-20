const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("@babel/core");
const { parse } = require("@babel/parser");

const root = path.resolve(__dirname, "..");
const activitySource = fs.readFileSync(path.join(__dirname, "apiActivity.cjs"), "utf8");
const apiSource = fs.readFileSync(path.join(__dirname, "api.js"), "utf8");
const compiled = transformSync(apiSource, { configFile: false, babelrc: false,
    plugins: [require("@babel/plugin-transform-modules-commonjs")] }).code;
function client(fetch, token = async () => null) {
    const timers = new Map();
    let nextTimer = 0;
    const module = { exports: {} };
    vm.runInNewContext(activitySource, { module,
        setTimeout: (work, duration) => { assert.equal(duration, 150); timers.set(++nextTimer, work); return nextTimer; },
        clearTimeout: (id) => timers.delete(id),
    });
    const activity = module.exports;
    const exports = {};
    vm.runInNewContext(compiled, { exports, process: { env: {} }, fetch,
        FormData: class { append() {} },
        require: (name) => {
            if (name === "react-native") return { Platform: { OS: "web" } };
            if (name === "./apiActivity.cjs") return activity;
            if (name === "./recordStore.cjs") return require("./recordStore.cjs");
            if (name === "./storageAdapter") return { storage: { getItem: token } };
            if (["@react-native-async-storage/async-storage", "expo-secure-store"].includes(name)) return {};
            throw new Error(`Unexpected module: ${name}`);
        },
    });
    return { api: exports.api, activity, idle() {
        const pending = [...timers.values()]; timers.clear(); pending.forEach((work) => work());
    } };
}
const response = (data, ok = true) => ({ ok, status: ok ? 200 : 422, text: async () => JSON.stringify(data) });
function checkUi() {
    let busy = true, topModal = "modal", closed = 0;
    const react = {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
        forwardRef: (render) => render, useRef: () => ({ current: "modal" }),
        useContext: () => null, useLayoutEffect: (effect) => effect(),
    };
    function load(file, mocks) {
        const exports = {};
        const code = transformSync(fs.readFileSync(path.join(root, file), "utf8"), { configFile: false, babelrc: false,
            plugins: [require("@babel/plugin-transform-react-jsx"), require("@babel/plugin-transform-modules-commonjs")] }).code;
        vm.runInNewContext(code, { exports, require: (name) => {
            if (name === "react") return react;
            if (!(name in mocks)) throw new Error(`Unexpected UI module ${name}`);
            return mocks[name];
        } });
        return exports;
    }
    const modal = load("components/ui/AppModal.js", {
        "react-native": { Modal: "NativeModal", View: "View" },
        "../../context/DatabaseLoadingContext": {
            BlockedContent: "BlockedContent", ModalLayerContext: { Provider: "LayerProvider" },
            useDatabaseLoading: () => ({ busy, topModal, register: () => () => {} }),
        },
        "./DatabaseLoadingOverlay": "Spinner",
    });
    const countSpinners = (node) => !node || typeof node !== "object" ? 0
        : (node.type === "Spinner" ? 1 : 0) + (node.props?.children || []).flat(Infinity).reduce((sum, child) => sum + countSpinners(child), 0);
    const render = () => modal.default({ visible: true, transparent: true, animationType: "slide", onRequestClose: () => closed++ });
    let tree = render();
    assert.equal(tree.type, "NativeModal");
    assert.equal(tree.props.animationType, "slide", "Existing modal animations stay intact");
    assert.equal(countSpinners(tree), 1);
    tree.props.onRequestClose(); assert.equal(closed, 0, "Back cannot dismiss a loading modal");
    topModal = "nested"; assert.equal(countSpinners(render()), 0, "Only the topmost host renders a spinner");
    busy = false; tree = render();
    assert.equal(countSpinners(tree), 0);
    tree.props.onRequestClose(); assert.equal(closed, 1, "Normal dismissal resumes afterward");

    // Execute the provider, not just its JSX transform: missing hook imports crash at render time.
    Object.assign(react, {
        createContext: () => ({ Provider: "ToastProvider" }),
        useRef: (initial) => ({ current: initial }),
        useState: (initial) => [initial, () => {}],
        useMemo: (work) => work(), useCallback: (work) => work, useEffect: () => {},
    });
    const toast = load("components/ui/Toast.js", {
        "react-native": { Animated: { Value: class {} }, Text: "Text", View: "View", Modal: "Modal",
            StyleSheet: { create: (styles) => styles }, Easing: {}, Platform: { OS: "web" } },
        "@expo/vector-icons": { Ionicons: "Icon" },
        "../../theme": { radius: {}, space: {}, shadow: {}, type: {} },
        "../../context/ThemeContext": { useTheme: () => ({ colors: {} }) },
        "../../context/DatabaseLoadingContext": { useDatabaseLoading: () => ({ busy }) },
        "expo-haptics": {}, "react-dom": {},
    });
    for (busy of [false, true]) {
        assert.equal(toast.ToastProvider({ children: "app" }).type, "ToastProvider", "Toast provider renders with and without database activity");
    }

    const theme = load("theme.js", {});
    assert.equal(theme.databaseLoaderColors.boy, "#5B9DFF");
    assert.equal(theme.databaseLoaderColors.girl, "#FF7EB3");
    let loaderTheme;
    const spinner = load("components/ui/DatabaseLoadingOverlay.js", {
        "react-native": { View: "View", AccessibilityInfo: {}, Keyboard: {}, Easing: {},
            Animated: { View: "AnimatedView", Value: class { interpolate() { return "0deg"; } } },
            Platform: { OS: "web" }, StyleSheet: { absoluteFill: {} }, findNodeHandle() {} },
        "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle" },
        "../../theme": theme,
        "../../context/ThemeContext": { useTheme: () => loaderTheme },
        "../../context/LanguageContext": { useLanguage: () => ({ t: () => "Database activity" }) },
        "../../utils/api": { getApiActivitySnapshot: () => false },
    }).default;
    const circles = (node) => !node || typeof node !== "object" ? []
        : [...(node.type === "Circle" ? [node.props] : []), ...(node.props?.children || []).flat(Infinity).flatMap(circles)];
    for (const gender of ["boy", "girl"]) for (const scheme of ["light", "dark"]) {
        loaderTheme = { colors: theme.paletteFor(undefined, gender, scheme), scheme };
        const rendered = spinner({});
        assert.equal(rendered.props.style[1].backgroundColor, loaderTheme.colors.text + "2F", "Backdrop opacity is approximately 35% lower than the previous 48 alpha");
        const footprint = rendered.props.children[0];
        assert.equal(footprint.props.style.width, 112);
        assert.equal(footprint.props.style.height, 112);
        for (const layer of footprint.props.children.flat(Infinity)) {
            const svg = layer.props.children[0];
            assert.equal(svg.props.width, 112);
            assert.equal(svg.props.height, 112);
            assert.equal(svg.props.viewBox, "0 0 96 96", "Both rings scale proportionally");
        }
        const rings = circles(rendered);
        assert.equal(rings.length, 2);
        for (const ring of rings) {
            assert.equal(ring.strokeWidth, 7.8);
            assert.equal(ring.strokeLinecap, "round");
            const extent = ring.r + ring.strokeWidth / 2;
            assert(ring.cx - extent >= 0 && ring.cx + extent <= 96 && ring.cy - extent >= 0 && ring.cy + extent <= 96,
                "Rounded strokes fit inside the SVG without clipping");
        }
        assert.equal(rings.find((ring) => ring.r === 43).stroke, "#FF7EB3", `${gender}/${scheme}: outer ring stays pink`);
        assert.equal(rings.find((ring) => ring.r === 28).stroke, "#5B9DFF", `${gender}/${scheme}: inner ring stays blue`);
    }

    function walkFiles(directory) {
        return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
            ? walkFiles(path.join(directory, entry.name)) : entry.name.endsWith(".js") ? [path.join(directory, entry.name)] : []);
    }
    for (const file of [path.join(root, "App.js"), ...walkFiles(path.join(root, "components"))]) {
        if (/[/\\](AppModal|Toast)\.js$/.test(file) || file.endsWith(".check.js")) continue;
        const tree = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["jsx"] });
        assert(!tree.program.body.some((node) => node.type === "ImportDeclaration" && node.source.value === "react-native"
            && node.specifiers.some((specifier) => specifier.imported?.name === "Modal")), `${file}: modal bypasses the loading host`);
    }
}
async function check() {
    const requests = [];
    const c = client(() => new Promise((resolve) => requests.push(resolve)));
    let notifications = 0;
    const unsubscribe = c.activity.subscribeApiActivity(() => notifications++);
    const first = c.api.login({});
    const second = c.api.register({});
    assert.equal(c.activity.getActiveRequestCount(), 2);
    assert.equal(c.activity.getApiActivitySnapshot(), true);
    let finishText;
    requests.shift()({ ok: true, text: () => new Promise((resolve) => { finishText = resolve; }) });
    await new Promise(setImmediate);
    assert.equal(c.activity.getActiveRequestCount(), 2, "Response reading remains tracked");
    finishText('{"id":1}');
    assert.equal((await first).id, 1);
    c.idle();
    assert.equal(c.activity.getApiActivitySnapshot(), true, "Other requests keep the overlay visible");
    requests.shift()(response({ id: 2 })); await second;
    assert.equal(c.activity.getActiveRequestCount(), 0);
    assert.equal(c.activity.getApiActivitySnapshot(), true, "Hold visibility between sequential calls");
    const third = c.api.login({});
    c.idle(); assert.equal(c.activity.getApiActivitySnapshot(), true, "A new call cancels pending hide");
    requests.shift()(response({})); await third;
    c.idle(); assert.equal(c.activity.getApiActivitySnapshot(), false);
    unsubscribe();
    const prior = notifications;
    const release = c.activity.beginApiActivity(); release(); release(); c.idle();
    assert.equal(c.activity.getActiveRequestCount(), 0, "Release is idempotent");
    assert.equal(notifications, prior, "Unmounted subscribers are detached");

    for (const [method, payload] of [[() => c.api.listRecords("1", "growth", { background: true }), []],
        [() => c.api.unseenAccessLog("1", { background: true }), {}], [() => c.api.markAccessLogSeen("1", { background: true }), {}]]) {
        const pending = method();
        await new Promise(setImmediate);
        assert.equal(c.activity.getActiveRequestCount(), 0);
        assert.equal(c.activity.getApiActivitySnapshot(), false);
        requests.shift()(response(payload)); await pending;
    }
    for (const fetch of [async () => { throw new Error("Offline"); },
        async () => response({ error: "Invalid input" }, false),
        async () => ({ ok: true, text: async () => { throw new Error("Read failed"); } })]) {
        const failure = client(fetch);
        await assert.rejects(failure.api.login({}));
        assert.equal(failure.activity.getActiveRequestCount(), 0);
        failure.idle(); assert.equal(failure.activity.getApiActivitySnapshot(), false);
    }
    const tokenFailure = client(async () => response({}), async () => { throw new Error("Token unavailable"); });
    await assert.rejects(tokenFailure.api.listChildren(), /Token unavailable/);
    assert.equal(tokenFailure.activity.getActiveRequestCount(), 0);
    const circular = {}; circular.self = circular;
    await assert.rejects(tokenFailure.api.login(circular));
    assert.equal(tokenFailure.activity.getActiveRequestCount(), 0);
    const upload = client(async () => { throw new Error("Photo preparation failed"); });
    const preparing = upload.api.uploadMemory("1", { photoUri: "blob:photo" });
    assert.equal(upload.activity.getActiveRequestCount(), 1, "Photo preparation is tracked before the backend request");
    await assert.rejects(preparing, /Photo preparation failed/);
    assert.equal(upload.activity.getActiveRequestCount(), 0);
    const savedUpload = client(async () => response({ id: 3 }));
    assert.equal((await savedUpload.api.uploadAttachment("1", { recordType: "growth", recordId: 1, fileUrl: "https://example.test/photo" })).id, 3);
    assert.equal(savedUpload.activity.getActiveRequestCount(), 0, "Nested upload/request counters remain balanced");

    const tabRequests = [];
    const tabs = client(() => new Promise((resolve) => tabRequests.push(resolve)));
    const options = { loading: "nonblocking" };
    const reads = [
        ...["vaccinations", "checkups", "medical-history", "growth", "nutrition", "milestones", "memories", "calendar-events", "calendar-plan-statuses", "medication-doses"]
            .map((resource) => tabs.api.listRecords("1", resource, options)),
        tabs.api.listAttachments("1", options), tabs.api.listShares("1", options), tabs.api.vaccineCatalogue(options),
        tabs.api.me(options), tabs.api.accessLog("1", options),
    ];
    await new Promise(setImmediate);
    assert.equal(tabs.activity.getActiveRequestCount(), 0, "Tab reads do not block navigation");
    assert.equal(tabs.activity.getApiActivitySnapshot(), false);
    const saving = tabs.api.updateChild("1", { allergies: ["Test"] });
    await new Promise(setImmediate);
    assert.equal(tabs.activity.getActiveRequestCount(), 1, "A simultaneous critical save still blocks");
    const saveResponse = tabRequests.pop();
    const navigationResponses = tabRequests.splice(0);
    navigationResponses.forEach((resolve, index) => resolve(response(index === navigationResponses.length - 2 ? { user: { id: "parent", email: "parent@example.test" } } : [])));
    await Promise.all(reads);
    assert.equal(tabs.activity.getActiveRequestCount(), 1, "Finishing tab reads cannot release a save's blocker");
    saveResponse(response({ id: 1 })); await saving; tabs.idle();
    assert.equal(tabs.activity.getApiActivitySnapshot(), false);
    for (const file of ["Dashboard", "Health", "Growth", "NutritionTracker", "CalendarView", "Search", "ShareRecords", "settings/ViewProfile"]) {
        const source = fs.readFileSync(path.join(root, `components/${file}.js`), "utf8");
        const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
        const traverse = require("@babel/traverse").default;
        let readCount = 0;
        traverse(ast, { CallExpression(p) {
            const call = p.node;
            if (call.callee.object?.name !== "api" || !["listRecords", "listAttachments", "listShares", "vaccineCatalogue", "me", "accessLog"].includes(call.callee.property?.name)) return;
            readCount++;
            assert(call.arguments.at(-1)?.properties?.some((property) => property.key?.name === "loading" && property.value?.value === "nonblocking"),
                `${file}: display reads must not trigger the blocking overlay`);
        } });
        assert(readCount > 0);
        assert(source.includes("Skeleton"), `${file}: preserve existing skeleton presentation`);
    }

    const context = fs.readFileSync(path.join(root, "context/DatabaseLoadingContext.js"), "utf8");
    const layerNode = parse(context, { sourceType: "module", plugins: ["jsx"] }).program.body
        .find((node) => node.declaration?.id?.name === "topModalLayer").declaration;
    const topModalLayer = new Function(`${context.slice(layerNode.start, layerNode.end)};return topModalLayer;`)();
    assert.equal(topModalLayer([]), null);
    assert.equal(topModalLayer([{ id: "child", parent: "parent" }, { id: "parent", parent: null }]), "child");
    assert.equal(topModalLayer([{ id: "parent", parent: null }, { id: "child", parent: "parent" }, { id: "confirmation", parent: "child" }]), "confirmation");
    assert.equal(topModalLayer([{ id: "a", parent: null }, { id: "b", parent: null }]), "b");
    assert(context.includes("const busy = ready && activity"), "Startup gating is independent of request activity");
    assert(context.includes("inert: busy"), "Web keyboard interaction is blocked, not just pointer input");
    assert(context.includes('hardwareBackPress'));
    const modal = fs.readFileSync(path.join(root, "components/ui/AppModal.js"), "utf8");
    assert(modal.includes("if (!busy) onRequestClose"));
    assert(modal.includes("busy && topModal === id"));
    const overlay = fs.readFileSync(path.join(root, "components/ui/DatabaseLoadingOverlay.js"), "utf8");
    assert(!overlay.includes("<Text"), "No visible loading copy");
    assert(overlay.includes("loop.stop()") && overlay.includes("if (reduceMotion) return"));
    const app = fs.readFileSync(path.join(root, "App.js"), "utf8");
    assert(app.includes('unseenAccessLog(activeProfile.id, { background: true })'));
    assert(app.includes('listRecords(childId, "reminders", { background: true })'));
    assert(app.includes('listRecords(p.id, "vaccinations", { background: true })'));
    const toast = fs.readFileSync(path.join(root, "components/ui/Toast.js"), "utf8");
    assert(toast.includes("pendingToasts.current.push"));
    assert(toast.includes("if (toast && !busy)"));
    checkUi();
    console.log("Global loading checks passed: concurrency, response reading, sequential calls, exclusions, failure cleanup, uploads, modal ordering and presentation safeguards.");
}
check().catch((error) => { console.error(error); process.exitCode = 1; });
