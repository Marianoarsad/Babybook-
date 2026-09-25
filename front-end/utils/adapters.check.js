const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "adapters.js"), "utf8")
    .replace(/import numericInput from "\.\/numericInput\.cjs";\s*/, "")
    .replace(/export function/g, "function");
const { childToProfile, profileFormToChild } = new Function(
    "numericInput",
    source + "\nreturn { childToProfile, profileFormToChild };",
)(require("./numericInput.cjs"));

const profile = childToProfile({
    id: 1,
    first_name: "Mia",
    sex: "Female",
    pediatrician_contact_number: "0917 123 4567",
    pediatrician_clinic_hospital: "Northside Clinic",
    obgyne_contact_number: "0918 765 4321",
    preferred_health_center: "Legacy Center",
});
assert.equal(profile.pediatricianContactNumber, "09171234567");
assert.equal(profile.pediatricianClinicHospital, "Northside Clinic");
assert.equal(profile.obgynContactNumber, "09187654321");
assert.equal("preferredHealthCenter" in profile, false);

const body = profileFormToChild({
    name: "Mia Rivera",
    gender: "girl",
    pediatricianContactNumber: "",
    pediatricianClinicHospital: " Northside Clinic ",
    obgynContactNumber: "0918 765 4321",
}, { includeBirth: false });
assert.equal(body.pediatrician_contact_number, null);
assert.equal(body.pediatrician_clinic_hospital, "Northside Clinic");
assert.equal(body.obgyne_contact_number, "09187654321");
assert.equal("preferred_health_center" in body, false);

console.log("Child profile provider-detail adapter checks passed.");
