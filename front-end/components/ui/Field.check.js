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
assert(picker.includes('import { FieldShell } from "./Field"'));
assert.equal((picker.match(/<FieldShell/g) || []).length, 2, "Date/time and measurement triggers share the outlined shell");
assert(rows.includes("<FieldShell"), "Record-form rows must use the same outlined shell");
assert(rows.includes("outlined = true"), "Custom controls need an explicit opt-out");

for (const file of ["components/settings/EditProfile.js", "components/settings/ChangePassword.js",
    "components/ProfessionalView.js", "components/ShareRecords.js"])
    assert(!read(file).includes("<TextInput"), `${file} still bypasses the shared standard field`);

console.log("Outlined field checks passed: shared states, picker triggers, record rows and standard screens.");
