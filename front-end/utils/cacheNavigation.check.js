// Run: node utils/cacheNavigation.check.js. No server, database or native runtime.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const store = require("./recordStore.cjs");
const root = path.resolve(__dirname, "..");
const shareSource = fs.readFileSync(path.join(root, "components/ShareRecords.js"), "utf8");
function load(file, requireMock = (name) => { throw new Error(`Unexpected import ${name}`); }) {
    const module = { exports: {} };
    const code = transformSync(fs.readFileSync(path.join(root, file), "utf8"), { babelrc: false, configFile: false,
        plugins: ["@babel/plugin-transform-modules-commonjs", ["@babel/plugin-transform-react-jsx", { runtime: "classic" }]] }).code;
    new Function("require", "module", "exports", code)(requireMock, module, module.exports);
    return module.exports;
}
function reactHarness(effects = false) {
    let cursor = 0, setters = 0;
    const slots = [], queued = [];
    const memo = (fn, deps) => {
        const index = cursor++, old = slots[index];
        if (!old || !deps.every((value, i) => Object.is(value, old.deps[i]))) slots[index] = { fn, deps };
        return slots[index].fn;
    };
    const React = {
        Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = { value: typeof initial === "function" ? initial() : initial };
            return [slots[index].value, (value) => { setters++; slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }];
        },
        useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
        useCallback: memo, useMemo: (fn) => fn(), useSyncExternalStore: (_, snapshot) => snapshot(),
        useEffect(fn, deps) {
            if (!effects) return;
            const index = cursor++, old = slots[index];
            if (!old || !deps.every((value, i) => Object.is(value, old.deps[i]))) queued.push(() => {
                old?.cleanup?.(); slots[index] = { deps, cleanup: fn() };
            });
        },
    };
    return { React, render(fn) { cursor = 0; return fn(); }, commit() { queued.splice(0).forEach((fn) => fn()); },
        unmount() { slots.forEach((slot) => slot.cleanup?.()); }, setterCount: () => setters };
}
const tick = () => new Promise(setImmediate);
const seed = (child, resource, rows) => store.acceptFetch(child, resource, rows, store.version(child, resource));
const theme = load("theme.js"), dictionaries = load("translations.js").translations;
const { formatShareCountdown } = load("utils/shareStore.js");
function walk(node, predicate) {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;
    for (const child of node.props?.children || []) { const hit = walk(child, predicate); if (hit) return hit; }
    return null;
}
const text = (node) => node && typeof node === "object"
    ? [node.props?.message, node.props?.title, node.props?.subtitle, ...(node.props?.children || [])].filter(Boolean).map(text).join(" ")
    : String(node ?? "");
async function check() {
    const countdownNow = Date.parse("2026-09-28T00:00:00Z");
    assert.deepEqual(formatShareCountdown("2026-09-28T01:30:00Z", countdownNow), { text: "2h", accessibilityLabel: "2 hours remaining" });
    assert.deepEqual(formatShareCountdown("2026-09-28T00:59:59Z", countdownNow), { text: "60m", accessibilityLabel: "60 minutes remaining" });
    assert.deepEqual(formatShareCountdown("2026-09-28T00:00:59Z", countdownNow), { text: "59s", accessibilityLabel: "59 seconds remaining" });
    assert.deepEqual(formatShareCountdown("2026-09-28T00:00:00Z", countdownNow), { text: "0s", accessibilityLabel: "Expired" });
    assert.deepEqual(formatShareCountdown("invalid", countdownNow), { text: "Active", accessibilityLabel: "Active share" });
    store.reset();
    const harness = reactHarness(true), pending = [];
    const hooks = load("utils/useRecords.js", (name) => name === "react" ? harness.React
        : name === "./recordStore.cjs" ? store : name === "./api" ? { api: {} } : assert.fail(name));
    const work = (isCurrent) => new Promise((resolve) => pending.push({ resolve, isCurrent }));
    const render = (scope = "A") => harness.render(() => hooks.useScreenRefresh(scope, work));
    let state = render(); harness.commit();
    assert(state.refreshing);
    pending.shift().resolve(["memories"]); await tick(); state = render();
    assert.deepEqual(state.failures, ["memories"]);
    state.refresh(); state.refresh();
    const older = pending.shift(), newer = pending.shift();
    newer.resolve([]); await tick(); older.resolve(["stale"]); await tick();
    assert.deepEqual(render().failures, [], "Older overlapping refreshes do not replace newer results");
    state.refresh(); const oldChild = pending.shift();
    state = render("B"); harness.commit();
    assert.equal(oldChild.isCurrent(), false, "Old-child work cannot mark logs seen");
    oldChild.resolve(["wrong child"]); await tick();
    assert(render("B").refreshing);
    pending.shift().resolve([]); await tick(); state = render("B");
    state.refresh(); const unmounted = pending.shift(); harness.unmount();
    const before = harness.setterCount(); unmounted.resolve(["late"]); await tick();
    assert.equal(harness.setterCount(), before, "Late responses never set unmounted screen state");
    assert.equal(state.isActive(), false);

    const apiCalls = [], screenWork = [];
    const api = {
        listRecords: async (...args) => { apiCalls.push(args); return []; },
        listShares: async (...args) => { apiCalls.push(args); return []; },
        accessLog: async (...args) => { apiCalls.push(args); return []; },
        revokeShare: async (...args) => { apiCalls.push(["revoke", ...args]); return {}; },
        markAccessLogSeen: async () => { apiCalls.push(["seen"]); },
        me: async (...args) => { apiCalls.push(args); return { user: {} }; },
    };
    let refreshing = true, failures = [];
    function screen(file) {
        const ui = reactHarness();
        class AnimatedValue {
            constructor(value) { this.value = value; }
            setValue(value) { this.value = value; }
            stopAnimation(callback) { callback?.(this.value); }
            interpolate() { return this.value; }
        }
        const modules = {
            react: ui.React,
            "react-native": { View: "View", Text: "Text", Image: "Image", KeyboardAvoidingView: "KeyboardAvoidingView", TouchableOpacity: "Button", Pressable: "Button", TextInput: "Input", ScrollView: "Scroll",
                AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }), announceForAccessibility() {} },
                useWindowDimensions: () => ({ width: 360, height: 720 }),
                Animated: { ScrollView: "Scroll", View: "View", Value: AnimatedValue,
                    timing: (value, config) => ({ start: (callback) => { value.setValue(config.toValue); callback?.({ finished: true }); } }),
                    sequence: () => ({ start() {} }) },
                Easing: { bezier: () => undefined }, Platform: { OS: "web" }, StyleSheet: { create: (styles) => styles } },
            "@expo/vector-icons": { Ionicons: "Icon" },
        };
        const component = load(file, (name) => {
            if (modules[name]) return modules[name];
            if (name.endsWith("/RecordIcon")) return {__esModule:true,default:"RecordIcon",AllergyIcon:"AllergyIcon",HereditaryIcon:"HereditaryIcon"};
            if (name.endsWith("/ConsultationsAppointmentsCard")) return { DashboardSurface: "Surface", DashboardControl: "Button" };
            if (name.endsWith("calendar-blue.png") || name.endsWith("nutrition-blue.png")) return "calendar-blue.png";
            if (name.endsWith("/theme")) return theme;
            if (name.endsWith("/api")) return { api, ACCOUNT_SCOPE: "__account__", ACCOUNT_RESOURCE: "account" };
            if (name.endsWith("/useRecords")) return { useRecordCache: store.getSnapshot, useSessionEpoch: store.getEpoch,
                useScreenRefresh: (_, work) => { screenWork.push(work); return { refreshing, failures, refresh() {}, isActive: () => true }; } };
            if (name.endsWith("/ThemeContext")) return { useTheme: () => ({ colors: theme.PALETTES.boy }) };
            if (name.endsWith("/LanguageContext")) return { useLanguage: () => ({ language: "en", t: (key) => dictionaries.en[key] || key }) };
            if (name.endsWith("/ScrollContext")) return { useScroll: (ref) => ({ scrollProps: {}, scrollViewRef: (node) => { if (ref) ref.current = node; } }) };
            if (name.endsWith("/responsive")) return { useScreenPadTop: () => 0, useScreenPadBottom: () => 0 };
            if (name.endsWith("/useRefreshControl")) return { useRefreshControl: () => undefined };
            if (name.endsWith("/useSoftPress")) return () => ({ respond() {}, transform: [] });
            if (name.endsWith("/Skeleton")) return { AppointmentsSkeleton: "Skeleton", SkeletonBlock: "Skeleton" };
            if (name.endsWith("/Cards")) return { EmptyStateCard: "Empty", ListEntryCard: "ListEntryCard", SectionContainerCard: "SectionContainerCard" };
            if (name.endsWith("/Toast")) return { useToast: () => ({ success() {}, error() {} }) };
            if (name.endsWith("/storageAdapter")) return { storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
            if (name.endsWith("/exportPdf")) return { pdfExportAvailable: () => true, exportChildRecordsPdf: async () => {} };
            if (name.endsWith("/DateField")) return { DurationWheel: "DurationWheel" };
            if (name.endsWith("/RecordFormSheet")) return { DeleteConfirmation: "DeleteConfirmation" };
            if (name.endsWith("/SwipeActionRow")) return "SwipeActionRow";
            if (name.endsWith("/AnimatedReveal")) return "AnimatedReveal";
            if (name === "./Dashboard") return { ageText: () => "Age" };
            if (name === "./GeneralSettings") return { LEAD_TIME_KEY: "lead", LEAD_TIME_OPTIONS: [{ key: "1", label: "1 day before" }] };
            if (name.endsWith("/adapters")) return load("utils/adapters.js", (dependency) =>
                ["./numericInput.cjs", "./conditions.cjs"].includes(dependency) ? require(dependency) : assert.fail(dependency));
            if (/\/(search|dates|shareStore|relationship)$/.test(name)) return load(`utils/${name.split("/").at(-1)}.js`);
            if (/\/(Avatar|Gradient|KeyboardAvoider|GrowthIcon|MedicationIcon|VaccineIcon|HospitalStayIcon|QrCodeView|ShowMore|TipStrip|PulseLoader|Field|PlanDetail)$/.test(name)) return name.split("/").at(-1);
            return assert.fail(`Unexpected screen import ${name}`);
        }).default;
        return { render: (overrides = {}) => ui.render(() => component({ profile: { id: "child", name: "Baby", dateOfBirth: "2020-02-18" },
            parentName: "Parent", profiles: [], onNavigate() {}, ...overrides })) };
    }
    store.reset();
    const search = screen("components/Search.js");
    let tree = search.render();
    assert(text(tree).includes("Search by category"), "Cold Search keeps landing controls visible");
    walk(tree, (node) => node.type === "Input").props.onChangeText("MMR");
    assert(walk(search.render(), (node) => node.type === "Skeleton"), "Uncached results use skeletons");
    for (const resource of ["vaccinations", "checkups", "medical-history", "milestones", "memories", "calendar-events"]) seed("child", resource, []);
    tree = search.render();
    assert.equal(walk(tree, (node) => node.type === "Skeleton"), null, "Confirmed empty index is not uncached");
    seed("child", "vaccinations", [{ id: 1, vaccine_name: "MMR", due_date: "2026-10-01" }]);
    assert(text(search.render()).includes("MMR"), "Cached matching records appear while refreshing");
    failures = ["vaccinations"]; refreshing = false;
    assert(text(search.render()).includes("MMR"), "Refresh failures do not erase matching cached records");
    const profile = screen("components/settings/ViewProfile.js");
    failures = []; refreshing = true;
    assert(walk(profile.render(), (node) => node.type === "Skeleton"));
    seed("__account__", "account", [{ id: "parent", email: "parent@example.test", phoneNumber: "123", city: "Manila" }]);
    tree = profile.render();
    assert(text(tree).includes("parent@example.test"));
    assert.equal(walk(tree, (node) => node.type === "Skeleton"), null, "Profile keeps known details visible during refresh");
    const sharing = screen("components/ShareRecords.js");
    tree = sharing.render(); assert(walk(tree, (node) => node.type === "Skeleton"));
    seed("child", "shares", [
        { id: 2, code: "OLD", status: "active", generate_date: "2020-01-01", expiration_date: "2020-01-02", shared_record_keys: [] },
        { id: 3, code: "REVOKED", status: "revoked", generate_date: "2026-09-19", expiration_date: "2026-09-20", shared_record_keys: ["growth"] },
        { id: 4, code: "LIVE", status: "active", generate_date: "2026-09-20", expiration_date: "2099-01-01", shared_record_keys: ["growth"] },
    ]);
    seed("child", "access-log", [
        { id: 7, share_id: 2, code: "OLD", professional_name: "Dr Match", action: "Viewed shared records", access_date: "2026-09-20T08:00:00Z", user_agent: "Chrome/1 Android", ip_address: "203.0.113.7" },
        { id: 8, share_id: 99, code: "OTHER", professional_name: "Dr Other", action: "Viewed shared records", access_date: "2026-09-20T09:00:00Z" },
    ]);
    const previousFrame = global.requestAnimationFrame, sectionFrames = [], sectionScrolls = [];
    global.requestAnimationFrame = (fn) => sectionFrames.push(fn);
    try {
        const linked = screen("components/ShareRecords.js"), target = (tree, title) => walk(tree,
            (node) => node.props?.onLayout && walk(node, (child) => child.type === "SectionContainerCard" && child.props.title === title));
        let linkedTree = linked.render({ initialSection: "activeRecentShares" });
        walk(linkedTree, (node) => node.type === "Scroll").props.ref({ scrollTo: (value) => sectionScrolls.push(value) });
        target(linkedTree, "Active & recent shares").props.onLayout({ nativeEvent: { layout: { y: 600 } } });
        linked.render({ initialSection: undefined }); sectionFrames.shift()();
        assert.equal(sectionScrolls.length, 0, "A header tap cancels an older scheduled section jump");
        linkedTree = linked.render({ initialSection: "accessLog" });
        target(linkedTree, "Access log").props.onLayout({ nativeEvent: { layout: { y: 800 } } }); sectionFrames.shift()();
        assert.equal(sectionScrolls.pop().y, 800, "Card-driven Access Log navigation still scrolls to its section");
        linkedTree = linked.render({ initialSection: "activeRecentShares" });
        target(linkedTree, "Active & recent shares").props.onLayout({ nativeEvent: { layout: { y: 600 } } });
        walk(linkedTree, (node) => node.type === "Scroll").props.ref(null); sectionFrames.shift()();
        assert.equal(sectionScrolls.length, 0, "Unmounted section jumps do not scroll or announce");
    } finally { global.requestAnimationFrame = previousFrame; }
    tree = sharing.render();
    assert.equal(walk(tree, (node) => node.type === "Skeleton"), null);
    assert.equal(walk(tree, (node) => node.type === "QrCodeView"), null, "Cached history never restores an active QR");
    const accessRow = walk(tree, (node) => node.type === "ListEntryCard" && node.props?.title === "Dr Match");
    assert(accessRow, "Access-log rows show the viewer name");
    assert.equal(accessRow.props.icon, undefined, "Access-log rows have no leading icon");
    assert(accessRow.props.dateText.includes("2026") && !accessRow.props.subtitle,
        "Access-log rows show only the access date below the name");
    assert(accessRow.props.labelTrailing && text(accessRow.props.label).includes("OLD"), "Access-log rows show the matching QR code badge");
    accessRow.props.onPress();
    tree = sharing.render();
    const accessDetail = walk(tree, (node) => node.type === "PlanDetail");
    assert(accessDetail?.props.visible, "Tapping an access-log row opens the shared record detail display");
    assert.equal(accessDetail.props.plan.title, "Dr Match");
    assert(accessDetail.props.plan.details.some((detail) => detail.label === "QR code" && detail.value === "OLD"));
    assert(accessDetail.props.plan.details.some((detail) => detail.label === "Device" && detail.value === "Chrome on Android"));
    assert(accessDetail.props.plan.details.some((detail) => detail.label === "IP address" && detail.value === "203.0.113.7"));
    assert.equal(accessDetail.props.plan.showNotes, false);
    assert.equal(accessDetail.props.onEdit, undefined);
    assert.equal(accessDetail.props.onDelete, undefined);
    accessDetail.props.onClose();
    tree = sharing.render();
    const oldShare = walk(tree, (node) => node.props?.accessibilityLabel === "View share details OLD");
    assert(oldShare, "Share-history rows are tappable");
    assert(text(oldShare.props.label).includes("expired"), "Expired status remains in the trailing badge");
    assert.equal(oldShare.props.icon, undefined, "Share-history rows have no leading icon");
    assert(oldShare.props.labelTrailing, "Share statuses use the centered trailing badge slot");
    assert(oldShare.props.dateText.includes("2020") && !oldShare.props.dateText.includes("record") && !oldShare.props.dateText.includes("expired"),
        "Share rows show only their generated date below the code");
    oldShare.props.onPress();
    tree = sharing.render();
    const oldDetail = walk(tree, (node) => node.type === "PlanDetail" && node.props?.plan?.title === "OLD");
    assert(oldDetail?.props.visible && oldDetail.props.plan.details[0].value === "Expired", "Expired shares open the shared read-only detail display");
    assert.equal(oldDetail.props.heroContent, null, "Expired shares do not redisplay a QR code");
    assert.deepEqual(oldDetail.props.plan.details.map((detail) => detail.label), ["Status", "Access Expiry"]);
    assert.match(oldDetail.props.plan.details[1].value, /^\d{1,2}:\d{2} (AM|PM), \d{2}\/\d{2}\/\d{4}$/);
    assert.equal(oldDetail.props.plan.showDate, false);
    assert.equal(oldDetail.props.plan.showTime, false);
    assert.equal(oldDetail.props.plan.showTitle, true, "Read-only shares retain their code title because they have no QR card");
    assert.equal(oldDetail.props.plan.categoryLabel, undefined, "Share details omit the Type field");
    assert(text(oldDetail).includes("Dr Match"), "The selected QR shows its matching access events");
    assert(!text(oldDetail).includes("Dr Other"), "The selected QR excludes other shares' access events");
    assert.equal(oldDetail.props.onDelete, undefined, "Expired share details do not offer revocation");
    oldDetail.props.onClose();
    tree = sharing.render();
    assert.equal(walk(tree, (node) => node.type === "QrCodeView"), null);
    const revokedShare = walk(tree, (node) => node.props?.accessibilityLabel === "View share details REVOKED");
    assert(revokedShare, "Revoked history rows identify their read-only destination");
    revokedShare.props.onPress();
    tree = sharing.render();
    const revokedDetail = walk(tree, (node) => node.type === "PlanDetail" && node.props?.plan?.title === "REVOKED");
    assert(revokedDetail?.props.visible && revokedDetail.props.plan.details[0].value === "Revoked");
    assert.equal(revokedDetail.props.heroContent, null, "Revoked shares do not redisplay a QR code");
    assert(text(revokedDetail).includes("Growth Measurements"), "Shared records use the record-selection row labels");
    assert.equal(revokedDetail.props.onDelete, undefined);
    revokedDetail.props.onClose();
    tree = sharing.render();
    const liveShare = walk(tree, (node) => node.type === "SwipeActionRow" && node.props?.label === "View QR code LIVE");
    assert(liveShare, "Active history rows identify their QR destination");
    assert.equal(liveShare.props.actions.length, 1);
    assert.equal(liveShare.props.actions[0].label, "Revoke", "Active shares reveal Revoke through the swipe action");
    liveShare.props.actions[0].onPress();
    tree = sharing.render();
    let revokeConfirmation = walk(tree, (node) => node.type === "DeleteConfirmation" && node.props?.visible);
    assert(revokeConfirmation, "Swipe Revoke opens confirmation");
    assert(!apiCalls.some((call) => call[0] === "revoke"), "Opening confirmation does not revoke the share");
    revokeConfirmation.props.onCancel();
    tree = sharing.render();
    assert.equal(walk(tree, (node) => node.type === "DeleteConfirmation" && node.props?.visible), null, "Cancel keeps the share active");
    const liveCard = walk(liveShare, (node) => node.type === "ListEntryCard");
    assert(text(liveCard.props.label).includes("h"), "Active shares retain their stepped countdown badge");
    assert.equal(liveCard.props.actions, undefined, "Active share rows have no trailing X action");
    liveShare.props.onPress();
    tree = sharing.render();
    const liveDetail = walk(tree, (node) => node.type === "PlanDetail" && node.props?.plan?.title === "LIVE");
    assert(liveDetail?.props.visible && walk(liveDetail.props.heroContent, (node) => node.type === "QrCodeView"), "Active shares display their QR above the detail rows");
    assert.equal(liveDetail.props.plan.showTitle, false, "Active shares show their code only inside the QR card");
    assert.equal(walk(liveDetail.props.heroContent, (node) => node.type === "QrCodeView").props.size, 312, "Active QR matches the detail-card width");
    const qrCard = liveDetail.props.heroContent.props.children[0];
    assert(text(qrCard).includes("LIVE"), "The enlarged share code appears inside the QR card below the image");
    assert(liveDetail.props.onDelete && liveDetail.props.deleteAccessibilityLabel === "Revoke QR code LIVE", "Active share details retain Revoke");
    liveDetail.props.onDelete();
    tree = sharing.render();
    revokeConfirmation = walk(tree, (node) => node.type === "DeleteConfirmation" && node.props?.visible);
    assert.equal(revokeConfirmation.props.deleteLabel, "Revoke Share");
    assert(revokeConfirmation.props.message.includes("LIVE") && revokeConfirmation.props.message.includes("immediately lose access"));
    assert(!apiCalls.some((call) => call[0] === "revoke"));
    await revokeConfirmation.props.onConfirm();
    assert(apiCalls.some((call) => call[0] === "revoke" && call[1] === "child" && call[2] === 4), "Confirmation revokes the selected share once");
    tree = sharing.render();
    assert.equal(walk(tree, (node) => node.type === "DeleteConfirmation" && node.props?.visible), null);
    assert(walk(tree, (node) => node.type === "DurationWheel"), "QR is selected by default");
    walk(tree, (node) => node.props?.accessibilityLabel === "Generate QR sharing").props.onPress();
    tree = sharing.render();
    assert(walk(tree, (node) => node.type === "DurationWheel"), "QR mode reveals the duration wheel");
    assert(walk(tree, (node) => node.props?.accessibilityLabel === "Generate Consultation QR"));
    walk(tree, (node) => node.props?.accessibilityLabel === "Save as PDF sharing").props.onPress();
    tree = sharing.render();
    assert.equal(walk(tree, (node) => node.type === "DurationWheel"), null, "Switching to PDF hides QR controls");
    assert(walk(tree, (node) => node.props?.accessibilityLabel === "Save Records as PDF"));
    walk(tree, (node) => node.props?.accessibilityLabel === "Save as PDF sharing").props.onPress();
    tree = sharing.render();
    assert(walk(tree, (node) => node.props?.accessibilityLabel === "Save Records as PDF"), "Tapping the active method keeps it selected");
    assert(!shareSource.includes("styles.histRevoke"), "The trailing X revoke control is removed");
    const shareLoad = screenWork.at(-1);
    await shareLoad(() => false);
    assert(!apiCalls.some((call) => call[0] === "seen"));
    await shareLoad(() => true);
    assert(apiCalls.some((call) => call[0] === "seen"));
    api.accessLog = async () => { throw new Error("offline"); };
    apiCalls.length = 0;
    assert.deepEqual(await shareLoad(() => true), ["access-log"]);
    assert(!apiCalls.some((call) => call[0] === "seen"), "Failed log reads are not marked seen");
    store.reset();
    assert(!text(sharing.render()).includes("OLD"), "Account resets cannot display previous cached share history");

    let printed = 0;
    const pdf = load("utils/exportPdf.js", (name) => name === "react-native" ? { Platform: { OS: "web" } }
        : name === "./api" ? { api: { listRecords: async (_, resource, options) => {
            assert.equal(options.confirmedOnly, true); assert.notEqual(options.loading, "nonblocking");
            if (resource === "growth") throw new Error("Unavailable"); return [];
        } } } : name === "./pdfTemplate" ? { buildRecordHtml() {} }
        : name === "expo-print" ? { printAsync: async () => { printed++; } } : name === "expo-sharing" ? {} : assert.fail(name));
    await assert.rejects(pdf.exportChildRecordsPdf({ id: "child" }), /Unavailable/);
    assert.equal(printed, 0, "Exports cannot silently print missing or optimistic records");
    for (const dictionary of Object.values(dictionaries)) for (const key of ["screenRefreshing", "screenRefreshFailed", "screenDataUnavailable", "screenLastChecked", "retry"]) assert(dictionary[key]);
    console.log("Cached-navigation checks passed: guarded refreshes, cached/cold/empty screens, partial failures, share safety and confirmed exports.");
}
check().catch((error) => { console.error(error); process.exitCode = 1; });
