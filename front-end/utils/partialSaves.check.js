const assert = require("node:assert/strict");
const fs = require("node:fs");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const vm = require("node:vm");
const { transformSync } = require("@babel/core");
const store = require("./recordStore.cjs");
function handler(file, name, context) {
    const source = fs.readFileSync(`${__dirname}/../components/${file}`, "utf8");
    const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
    let expression;
    traverse(ast, { VariableDeclarator(p) { if (p.node.id.name === name) expression = p.node.init; } });
    assert(expression, `${file}: ${name} exists`);
    return new Function(...Object.keys(context), `return (${source.slice(expression.start, expression.end)});`)(...Object.values(context));
}
async function check() {
    const react = {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
        useState: (initial) => [initial, () => {}], useRef: (initial) => ({ current: initial }),
        useEffect: () => {}, useCallback: (fn) => fn, useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    };
    function load(file, mocks) {
        const exports = {};
        const code = transformSync(fs.readFileSync(`${__dirname}/${file}`, "utf8"), {
            configFile: false, babelrc: false,
            plugins: [require("@babel/plugin-transform-react-jsx"), require("@babel/plugin-transform-modules-commonjs")],
        }).code;
        vm.runInNewContext(code, { exports, require: (name) => {
            if (name === "react") return react;
            assert(name in mocks, `Unexpected UI import ${name}`); return mocks[name];
        } }); return exports;
    }
    const hooks = load("useRecords.js", { "./recordStore.cjs": store, "./api": { api: {} } });
    assert.equal(hooks.useRecords(1, "growth"), store.getRows(1, "growth"));
    assert.equal(typeof hooks.useRecordSave(true, 1, "growth"), "function");
    const feedback = load("../components/ui/MutationFeedback.js", {
        "react-native": { Pressable: "Button", Text: "Text", View: "View" },
        "../../context/ThemeContext": { useTheme: () => ({ colors: {} }) },
        "../../theme": { MIN_TOUCH: 44, radius: {}, shadow: {}, space: {}, type: {} },
        "../../utils/api": { api: {} }, "../../utils/recordStore.cjs": store,
        "../../utils/useRecords": hooks, "./Toast": { useToast: () => ({}) },
    }).default;
    store.reset(); assert.equal(feedback({ profiles: [], top: 0 }), null);
    const operation = store.begin({ child: 1, resource: "growth", type: "delete", id: 1, body: {} });
    for (const status of ["saving", "uncertain", "failed"]) {
        store.update(operation, { status });
        assert.equal(feedback({ profiles: [{ id: 1, name: "Baby" }], top: 0 }).type, "View", `Recovery UI renders ${status}`);
    }
    store.reset();
    for (const file of ["ui/MedicineModal.js", "ui/MedicalEventModal.js"]) {
        let closed = 0, announced = 0, busy = false, failPhoto = true;
        const errors = [], savedIds = [];
        const context = {
            name: "Medicine", title: "Fever", instructions: "As prescribed", startDate: "2026-09-18",
            finished: false, over: false, endDate: "", doseAmount: "", frequency: 2, times: ["08:00", "20:00"],
            courseDays: "", prescribedBy: "", treatsId: null, notes: "Retain this", careLevel: "Home",
            facility: "", isIllness: true, kind: "illness", copy: { category: "Illness", attachType: "illness", savedToast: "Saved" },
            photoUri: "photo", profile: { id: 1 }, editing: false, todayLocal: () => "2026-09-18",
            setNameError() {}, setTitleError() {}, setSaving: (v) => { busy = v; },
            saveRecord: async () => ({ id: 45 }),
            api: { uploadAttachment: async (_child, options) => {
                savedIds.push(options.recordId); if (failPhoto) throw new Error("Photo failed");
            } },
            medHistoryToMed: (row) => row, medHistoryToIllness: (row) => row,
            onSaved: () => { announced++; }, onClose: () => { closed++; },
            toast: { success: () => { announced++; }, error: (e) => errors.push(e) },
        };
        const save = handler(file, "handleSave", context);
        await save();
        assert.equal(closed, 0); assert.equal(announced, 0); assert.equal(busy, false);
        assert.match(errors[0], /saved.*photo.*Retry/);
        assert.equal(context.photoUri, "photo"); assert.equal(context.notes, "Retain this");
        failPhoto = false; await save();
        assert.equal(closed, 1); assert.equal(announced, 2); assert.deepEqual(savedIds, [45, 45]);
    }
    let completed = 0, closed = 0, failPhoto = true, failStatus = false;
    const order = [], errors = [];
    const context = {
        completingVaccine: false, completeVaxTarget: { id: 3 }, completeAttachUri: "photo", profile: { id: 1 },
        completeDate: "2026-09-18", completeReaction: "none", completeReactionNote: "Retain this",
        attachUrlFor: () => null, setCompletingVaccine() {}, setAttachMap() {}, setCompleteAttachUri() {},
        setCompleteVaxTarget: () => { closed++; },
        api: { uploadAttachment: async () => { order.push("photo"); if (failPhoto) throw new Error("Photo failed"); return { id: 1 }; } },
        applyVaccineToggle: async () => { order.push("status"); if (failStatus) throw new Error("Status failed"); completed++; },
        toast: { error: (e) => errors.push(e) },
    };
    const complete = handler("Health.js", "handleConfirmCompleteWithPhoto", context);
    await complete(); assert.equal(completed, 0); assert.equal(closed, 0); assert.deepEqual(order, ["photo"]);
    failPhoto = false; failStatus = true; await complete(); assert.equal(closed, 0);
    failStatus = false; await complete(); assert.equal(completed, 1); assert.equal(closed, 1);
    assert.deepEqual(order.slice(-2), ["photo", "status"]);
    // Catch accidental render-time setters: they cause re-render loops even when bundling succeeds.
    const source = fs.readFileSync(`${__dirname}/../components/Health.js`, "utf8");
    traverse(parse(source, { sourceType: "module", plugins: ["jsx"] }), { Function(p) {
        if (p.node.id?.name !== "Health") return;
        for (const statement of p.node.body.body) {
            assert(!(/^set[A-Z]/.test(statement.expression?.callee?.name || "")), "No unconditional render-time state setters");
        }
    } });
    console.log("Partial-save checks passed: retained drafts, photo-before-clinical-status, no premature success/close and no render-time setters.");
}
check().catch((error) => { console.error(error); process.exitCode = 1; });
