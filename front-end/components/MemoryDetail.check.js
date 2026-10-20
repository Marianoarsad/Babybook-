// Run with node components/MemoryDetail.check.js. Only fictional records and API doubles.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "..");
const compile = source => transformSync(source, { babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const themeModule = { exports: {} }; new Function("module", "exports", compile(fs.readFileSync(root + "/theme.js", "utf8")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
let colors = theme.PALETTES.boy, width = 390, fontScale = 1, current, epoch = 1, raw, calls = [], closed = 0, messages = [], failure = null, deferred = null;
const profile = { id: "1", dateOfBirth: "2025-11-18" };
const sample = { id: 7, caption: "First Bike Ride", notes: "Practiced pedaling with Papa.", date_recorded: "2029-02-28", photo_url: "original:photo", is_favorite: false };
const element = (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity).filter(child => child !== false && child != null) } });
const react = {
    createElement: element,
    useMemo: fn => fn(),
    useRef(value) { const i = current.index++; return current.slots[i] ||= { current: value }; },
    useState(value) { const owner = current, i = owner.index++; if (!(i in owner.slots)) owner.slots[i] = typeof value === "function" ? value() : value; return [owner.slots[i], next => { owner.slots[i] = typeof next === "function" ? next(owner.slots[i]) : next; }]; },
    useEffect(fn, deps) { const owner = current, i = owner.index++, previous = owner.slots[i]; if (!previous || !deps || deps.some((dep, n) => dep !== previous.deps[n])) { previous?.cleanup?.(); owner.slots[i] = { deps, cleanup: fn() }; } },
};
function mount(component, props) {
    const owner = { slots: [], index: 0, component, props };
    owner.render = () => { owner.index = 0; current = owner; return owner.tree = component(owner.props); };
    owner.unmount = () => owner.slots.forEach(slot => slot?.cleanup?.());
    owner.render(); return owner;
}
const native = { View: "View", Text: "Text", ScrollView: "ScrollView", Image: "Image", TextInput: "TextInput", TouchableOpacity: "TouchableOpacity",
    StyleSheet: { create: styles => styles }, useWindowDimensions: () => ({ width, fontScale }) };
const toast = Object.fromEntries(["error", "success", "info"].map(key => [key, value => messages.push([key, value])]));
async function write(...args) { calls.push(args); if (deferred) await deferred; if (failure) throw failure; raw = { ...raw, ...args[3] }; return raw; }
const api = { updateRecord: write, deleteRecord: async (...args) => { calls.push(args); if (failure) throw failure; raw = null; }, createMilestoneWithPhoto: () => assert.fail("Edit must not upload"), uploadMemory: () => assert.fail("Edit must not upload") };
const externals = {
    react: { __esModule: true, default: react, ...react }, "react-native": native,
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    "expo-blur": { BlurTargetView: "BlurTargetView" },
    "@expo/vector-icons": { Ionicons: "Ionicon" }, "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Path: "Path" },
};
const overrides = {
    "theme.js": theme, "context/ThemeContext.js": { useTheme: () => ({ colors }) }, "context/LanguageContext.js": { useLanguage: () => ({ t: key => key }) },
    "utils/useRecords.js": { useSessionEpoch: () => epoch, useConfirmedRecords: () => raw ? [raw] : [], useRecordSave: (visible, child, resource, id) => body => write(child, resource, id, body) },
    "utils/api.js": { api }, "utils/recordStore.cjs": { getEpoch: () => epoch }, "utils/imagePicker.js": { pickerAvailable: () => true },
    "utils/memoryPhoto.js": { exportMemoryPhoto: async (...args) => { calls.push(args); return "cancelled"; } },
    "utils/milestoneChecklist.js": { suggestedTitles: () => [] },
    "components/ui/AppModal.js": { __esModule: true, default: "Modal" }, "components/ui/Gradient.js": { __esModule: true, default: "Gradient" },
    "components/ui/RecordIcon.js": { __esModule: true, default: "RecordIcon" }, "components/ui/ImageViewer.js": { __esModule: true, default: "ImageViewer" },
    "components/ui/AnchoredMenu.js": { __esModule: true, default: "Menu", AnchoredMenuItem: "MenuItem" },
    "components/ui/RecordFormSheet.js": { __esModule: true, default: "Form", RecordFormGroup: "Group", RecordFormRow: "Row", DeleteConfirmation: "DeleteConfirmation" },
    "components/ui/DateField.js": { DateField: "DateField" }, "components/ui/ConsultationsAppointmentsCard.js": { DashboardSurface: "Surface", DashboardControl: "Control" },
    "components/ui/Toast.js": { useToast: () => toast },
};
const modules = new Map();
function load(file) {
    file = path.resolve(file);
    const key = path.relative(root, file).replaceAll("\\", "/"); if (overrides[key]) return overrides[key];
    if (file.endsWith(".png")) return key;
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    new Function("require", "module", "exports", compile(fs.readFileSync(file, "utf8")))(name => {
        if (externals[name]) return externals[name];
        assert(name.startsWith("."), name); const target = path.resolve(path.dirname(file), name);
        return load(path.extname(target) ? target : target + ".js");
    }, module, module.exports); return module.exports;
}
const Detail = load(root + "/components/MemoryDetail.js").default;
const Form = load(root + "/components/ui/AddMemoryModal.js").default;
const adapters = load(root + "/utils/adapters.js");
function nodes(tree) { return !tree || typeof tree !== "object" ? [] : [tree, ...(tree.props.children || []).flatMap(nodes)]; }
function find(owner, label) { const node = nodes(owner.render()).find(node => node.props.accessibilityLabel === label); assert(node, label); return node; }
function open(kind = "memory") {
    const wrapper = mount(Detail, { visible: true, memory: { id: raw.id, childId: "1" }, profile, recordKind: kind, onClose: () => closed++ });
    return mount(wrapper.tree.type, wrapper.tree.props);
}
async function main() {
    assert.equal(mount(Detail, { visible: true, memory: { id: 7, childId: "2" }, profile }).tree, null);
    for (const palette of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
        colors = palette;
        for (const size of [320, 390]) {
            width = size; raw = { ...sample }; const owner = open();
            const tree = nodes(owner.tree);
            assert(tree.some(node => node.props.testID === "memory-photo-frame"));
            assert(!tree.some(node => node.props.accessibilityLabel === "Edit record"));
            assert(!tree.some(node => node.props.name === "search"));
            const sections = tree.find(node => node.type === "ScrollView").props.children;
            assert.deepEqual(sections.slice(0, 4).map(node => node.props.testID), ["memory-photo-frame", "memory-details-panel", "memory-metadata-row", "memory-action-tray"]);
            const metadata = sections[2]; assert.equal(metadata.props.style.flexDirection, "row"); assert.equal(metadata.props.children.length, 3);
            const metrics = tree.filter(node => typeof node.type === "function" && node.props.label && node.props.palette);
            assert.deepEqual(metrics.map(node => node.props.value), ["28 Feb 2029", "3 yr 3 mo", "Photo Memory"]);
            assert.equal(tree.find(node => node.props.testID === "memory-action-tray").props.children.length, 5);
            find(owner, "View complete photo").props.onPress();
            assert(nodes(owner.render()).find(node => node.type === "ImageViewer").props.visible);
            assert.equal(nodes(owner.tree).find(node => node.type === "ImageViewer").props.uri, sample.photo_url);
            owner.unmount();
        }
    }
    raw = { ...sample }; let owner = open(); calls = [];
    find(owner, "Delete").props.onPress(); assert.equal(calls.length, 0);
    let confirmation = nodes(owner.render()).find(node => node.type === "DeleteConfirmation");
    assert(confirmation.props.visible); confirmation.props.onCancel(); assert(!nodes(owner.render()).find(node => node.type === "DeleteConfirmation").props.visible);
    failure = new Error("Offline"); await find(owner, "Add to Favorites").props.onPress(); assert.equal(raw.is_favorite, false);
    assert(messages.some(([kind, text]) => kind === "error" && text === "Offline")); failure = null;
    let release; deferred = new Promise(resolve => release = resolve);
    const first = find(owner, "Add to Favorites").props.onPress();
    await find(owner, "Add to Favorites").props.onPress(); assert.equal(calls.length, 2, "Only the failed request and one pending request execute");
    assert.equal(raw.is_favorite, false); release(); await first; deferred = null;
    assert.equal(raw.is_favorite, true); assert(find(owner, "Favorited").props.accessibilityState.selected);
    assert.deepEqual(calls.at(-1).slice(0, 4), ["1", "memories", 7, { is_favorite: true }]);
    const more = find(owner, "More record actions"); more.props.ref.current = { measureInWindow: callback => callback(330, 12, 44, 44) };
    more.props.onPress();
    const menu = nodes(owner.render()).find(node => node.type === "Menu"); assert(menu.props.visible); assert.equal(menu.props.appearance, "actions");
    assert(menu.props.blurTarget.current === null);
    assert.deepEqual(menu.props.children.map(node => node.props.label), ["Edit", "Share", "Download", "Remove from Favorites", "Delete"]);
    assert.deepEqual(menu.props.children.map(node => node.props.divider), [true, true, true, true, false]);
    assert(menu.props.children.every(node => node.props.variant === "action" && node.props.leading));
    menu.props.children[0].props.onPress(); assert(nodes(owner.render()).some(node => node.type === Form && node.props.editMemory.id === "7"));
    find(owner, "Delete").props.onPress(); failure = new Error("Delete failed");
    await nodes(owner.render()).find(node => node.type === "DeleteConfirmation").props.onConfirm(); assert(raw); assert.equal(closed, 0);
    assert.equal(nodes(owner.render()).find(node => node.type === "DeleteConfirmation").props.error, "Delete failed");
    failure = null; await nodes(owner.render()).find(node => node.type === "DeleteConfirmation").props.onConfirm(); assert.equal(raw, null); assert(closed > 0); owner.unmount();
    raw = { ...sample, photo_url: "" }; owner = open(); assert(find(owner, "Share").props.disabled); assert(find(owner, "Download").props.disabled);
    assert(!nodes(owner.tree).some(node => node.props.accessibilityLabel === "View complete photo")); owner.unmount();
    for (const kind of ["memory", "milestone"]) {
        raw = kind === "memory" ? { ...sample } : { id: 8, title: "Sits without support", description: "Original notes", date_recorded: "2026-06-16", age_achieved: "7 months", is_completed: true, photo_url: "original:milestone" };
        const memory = (kind === "memory" ? adapters.memoryToApp : adapters.milestoneToApp)(raw);
        let formClosed = 0; const form = mount(Form, { visible: true, profile, editMemory: memory, recordKind: kind, onClose: () => formClosed++ }); form.render();
        assert.equal(form.tree.props.title, kind === "memory" ? "Edit Memory" : "Edit Milestone");
        assert(!nodes(form.tree).some(node => node.props.accessibilityLabel?.startsWith("Add a ")));
        const dateField = nodes(form.tree).find(node => node.type === "DateField");
        if (kind === "memory") assert.equal(dateField.props.maximumDate, "2029-02-28");
        const fields = nodes(form.tree).filter(node => node.type === "TextInput"); fields.at(-1).props.onChangeText("New notes");
        calls = []; failure = new Error("Try again"); await form.render().props.onSubmit(); assert.equal(formClosed, 0);
        assert.equal(nodes(form.render()).filter(node => node.type === "TextInput").at(-1).props.value, "New notes");
        failure = null; await form.render().props.onSubmit(); assert.equal(formClosed, 1);
        const [child, resource, id, body] = calls.at(-1);
        assert.equal(child, "1"); assert.equal(resource, kind === "memory" ? "memories" : "milestones"); assert.equal(String(id), memory.id);
        assert.equal(body.date_recorded, memory.date); assert(!Object.hasOwn(body, "photo_url")); assert(!Object.hasOwn(body, "is_completed")); assert(!Object.hasOwn(body, "age_achieved"));
        form.unmount();
    }
    raw = { id: 8, title: "Milestone", description: "Original", date_recorded: "2026-06-16", age_achieved: "7 months", is_completed: false, photo_url: "original:photo" };
    let edited = adapters.milestoneToApp(raw);
    let form = mount(Form, { visible: true, profile, editMemory: edited, recordKind: "milestone", onClose() {} });
    nodes(form.render()).find(node => node.type === "DateField").props.onChange("2026-07-18");
    calls = []; await form.render().props.onSubmit();
    assert.equal(calls.at(-1)[3].age_achieved, "8 months"); assert.equal(raw.is_completed, false); assert.equal(raw.photo_url, "original:photo"); form.unmount();
    raw = { ...sample }; let editClosed = 0;
    form = mount(Form, { visible: true, profile, editMemory: adapters.memoryToApp(raw), onClose() { editClosed++; } }); form.render();
    deferred = new Promise(resolve => release = resolve); messages = []; calls = [];
    const saving = form.render().props.onSubmit(); await form.render().props.onSubmit(); assert.equal(calls.length, 1);
    form.unmount(); release(); await saving; deferred = null; assert.equal(editClosed, 0); assert.equal(messages.length, 0);
    raw = { ...sample }; owner = open(); calls = []; epoch++;
    await find(owner, "Add to Favorites").props.onPress(); assert.equal(calls.length, 0); owner.unmount();
    console.log("Memory detail checks passed: six palettes/phone sizes, historical dates and age, exact image viewer, synced confirmed Favorites, duplicate/failure/session guards, delete confirmation, missing photos, and metadata-only edits retaining dates/age/completion/photos.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
