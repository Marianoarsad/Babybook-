const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const field = read("components/ui/Field.js");
const picker = read("components/ui/DateField.js");
const rows = read("components/ui/RecordFormSheet.js");

assert(field.includes("export function FieldShell"));
for (const state of ["focused", "disabled", "error", "colors.danger", "colors.borderStrong"])
    assert(field.includes(state), `Shared outlined field is missing ${state}`);
assert(field.includes("numericMode === \"digits\""));
assert(field.includes("numericMode === \"decimal\""));
assert(field.includes("accessibilityLabel={accessibilityLabel || label}"), "A hidden visual label must retain an accessible name");
assert(picker.includes('import { FieldShell } from "./Field"'));
assert.equal((picker.match(/<FieldShell/g) || []).length, 2, "Date/time and measurement triggers share the outlined shell");
assert(rows.includes("<FieldShell"), "Record-form rows must use the same outlined shell");
assert(rows.includes("outlined = true"), "Custom controls need an explicit opt-out");

for (const file of ["components/settings/EditProfile.js", "components/settings/ChangePassword.js",
    "components/ProfessionalView.js", "components/ShareRecords.js"])
    assert(!read(file).includes("<TextInput"), `${file} still bypasses the shared standard field`);

const conditionForm = read("components/ui/MedicalEventModal.js");
assert(conditionForm.includes('<FieldShell label="Allergy Type" required error={allergyTypeError}'));
assert(!conditionForm.includes('label: "Not specified"'));
const saveGuard = conditionForm.split("const handleSave = async () => {")[1].split("setSaving(true);")[0];
const validateCondition = new Function("title", "copy", "allergyType", "setTitleError", "setAllergyTypeError", saveGuard + "return true;");
for (const category of ["Illness", "Allergy", "Hereditary Condition"]) {
    for (const value of ["", "food", "non_food", "other"]) {
        let message;
        const valid = validateCondition("Egg", { category }, value, () => {}, (next) => { message = next; });
        assert.equal(!!valid, category !== "Allergy" || ["food", "non_food"].includes(value));
        if (!valid) assert.equal(message, "Choose Food or Non-food");
    }
}
console.log("Outlined field checks passed: shared states, picker triggers, record rows, standard screens and required allergy classification.");
