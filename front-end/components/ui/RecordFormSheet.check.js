const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("@babel/parser");
const { canDeleteRecord, deleteRecordAndClose, headerActionIcon } = require("./recordFormActions.cjs");

async function check() {
    let staleClosed = false;
    assert.equal(await deleteRecordAndClose(async () => true, () => { staleClosed = true; }, () => false), true);
    assert.equal(staleClosed, false, "A late deletion must not close a different form");
    for (const [cancel, save] of [["Cancel", "Save Record"], ["Kanselahin", "I-save ang Record"], ["Cancel", "Save na ang Record"]]) {
        assert.equal(headerActionIcon(cancel, "cancel", cancel), "close");
        assert.equal(headerActionIcon(save, "save", save), "checkmark");
        assert.equal(headerActionIcon("Save", "save", save), "checkmark");
        assert.equal(headerActionIcon("Cancel", "cancel", cancel), "close");
        for (const label of ["Add", "Update", "Schedule", "Confirm", "Create Profile", "Log out"]) {
            assert.equal(headerActionIcon(label, "save", save), null);
            assert.equal(headerActionIcon(label, "cancel", cancel), null);
        }
    }
    const remove = () => true;
    assert.equal(canDeleteRecord(null, remove), false, "Create forms cannot delete");
    assert.equal(canDeleteRecord({ id: 1 }, undefined), false, "Profiles/create-only records have no delete callback");
    assert.equal(canDeleteRecord({ id: 1 }, remove), true);
    let closed = 0;
    const close = () => { closed++; };
    assert.equal(await deleteRecordAndClose(async () => false, close), false);
    assert.equal(await deleteRecordAndClose(async () => undefined, close), false);
    assert.equal(closed, 0, "A caught error/unspecified result must not discard the draft");
    await assert.rejects(deleteRecordAndClose(async () => { throw new Error("Offline"); }, close), /Offline/);
    assert.equal(closed, 0);
    assert.equal(await deleteRecordAndClose(async () => true, close), true);
    assert.equal(closed, 1);

    const root = path.resolve(__dirname, "..");
    const files = ["../App.js", "EmptyChild.js", "Health.js", "CalendarView.js", "NutritionTracker.js",
        "Growth.js", "ui/GrowthModal.js", "ui/MedicineModal.js", "ui/MedicalEventModal.js", "ui/AddMemoryModal.js",
        "ui/Field.js", "ui/DateField.js", "ui/RecordFormSheet.js"];
    let sheets = 0;
    function walk(node, visit) {
        if (!node || typeof node !== "object") return;
        if (node.type) visit(node);
        for (const [key, value] of Object.entries(node)) {
            if (key === "loc") continue;
            if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
            else if (value && typeof value === "object") walk(value, visit);
        }
    }
    for (const file of files) {
        const source = fs.readFileSync(path.join(root, file), "utf8");
        const tree = parse(source, { sourceType: "module", plugins: ["jsx"] });
        walk(tree, (node) => {
            if (node.type !== "JSXOpeningElement" || node.name.name !== "RecordFormSheet") return;
            sheets++;
            const attributes = new Map(node.attributes.map((a) => [a.name?.name, a]));
            for (const name of ["title", "onClose", "onSubmit", "busy", "cancelLabel", "submitLabel"])
                assert(attributes.has(name), `${file}: missing ${name}`);
            if (attributes.has("onDelete")) assert(attributes.has("record"), `${file}: deleting requires an existing record`);
            if (["../App.js", "EmptyChild.js", "ui/AddMemoryModal.js"].includes(file))
                assert(!attributes.has("onDelete"), `${file}: no profile/create-only deletion`);
        });
    }
    assert.equal(sheets, 12, "All twelve scoped record form presentations use the shared sheet");
    const sheet = fs.readFileSync(path.join(root, "ui/RecordFormSheet.js"), "utf8");
    assert(sheet.includes('animationType={reduceMotion ? "none" : "slide"}'));
    assert(sheet.includes("if (deleteLock.current || busy || !onDelete) return"));
    assert(sheet.includes("submitLock.current"));
    assert(sheet.includes("accessibilityElementsHidden={confirming}"));
    assert(sheet.includes('sheet: { height: sheetHeight,'));
    assert(/sheet:\s*\{[^}]*width: "100%"/.test(sheet));
    assert(!/sheet:\s*\{[^}]*maxWidth/.test(sheet), "Record sheets must span the screen on every display width");
    assert(sheet.includes('accessibilityLabel={cancelLabel}'));
    assert(sheet.includes('accessibilityLabel={submitLabel}'));
    assert(sheet.includes('ScrollView style={{ flex: 1, minHeight: 0 }}'));
    const menu = fs.readFileSync(path.join(root, "ui/ActionSheet.js"), "utf8");
    for (const source of [sheet, menu]) assert(source.includes("recordSheetHeight("), "Both sheets share their height calculation");
    const responsive = fs.readFileSync(path.join(root, "../utils/responsive.js"), "utf8");
    const sizing = parse(responsive, { sourceType: "module" }).program.body
        .find((node) => node.declaration?.id?.name === "recordSheetHeight").declaration;
    const recordSheetHeight = new Function("space", "type", "MIN_TOUCH",
        `${responsive.slice(sizing.start, sizing.end)}; return recordSheetHeight;`)(
        { sm: 8, md: 12, xl: 24 }, { heading: { lineHeight: 23 }, label: { lineHeight: 18 } }, 44);
    assert.equal(recordSheetHeight(800), 575, "Retain the original add-record menu height at normal text size");
    for (const height of [0, 320, 600, 844, 1080]) for (const scale of [1, 2, 3]) {
        for (const top of [0, 44]) for (const bottom of [0, 34]) {
            const actual = recordSheetHeight(height, scale, top, bottom);
            assert(actual >= 0 && actual <= Math.max(0, height - Math.max(top, 12)), "Fit the available safe area");
            assert(actual >= recordSheetHeight(height, 1, top, bottom), "Accommodate larger text without shrinking the sheet");
        }
    }
    const medical = fs.readFileSync(path.join(root, "ui/MedicalEventModal.js"), "utf8");
    assert(medical.includes('modalTitle: "Log an illness"'));
    assert(medical.includes('modalTitle: "Log a hospital stay"'));
    console.log("Record form checks passed: 12 forms, localized header icons, shared compact sizing, scrolling, delete guards and reduced motion.");
}

check().catch((error) => { console.error(error); process.exitCode = 1; });
