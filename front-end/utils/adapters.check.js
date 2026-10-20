const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "adapters.js"), "utf8")
    .replace(/import numericInput from "\.\/numericInput\.cjs";\s*/, "")
    .replace(/import conditionRecords from "\.\/conditions\.cjs";\s*/, "")
    .replace(/export function/g, "function");
const { childToProfile, profileFormToChild, medHistoryToIllness, nutritionToApp } = new Function(
    "numericInput",
    "conditionRecords",
    source + "\nreturn { childToProfile, profileFormToChild, medHistoryToIllness, nutritionToApp };",
)(require("./numericInput.cjs"), require("./conditions.cjs"));
assert.equal(nutritionToApp({ quantity: "bad" }).feedMethod, "", "Invalid legacy quantities cannot establish a bottle method");
assert.equal(nutritionToApp({ quantity: "80" }).feedMethod, "bottle");
assert.equal(nutritionToApp({ quantity: null }).feedMethod, "");
assert.equal(nutritionToApp({ feed_method: "breast", quantity: "80" }).feedMethod, "breast");

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
assert.equal(profile.birthHeadCircumference, null);
assert.equal(childToProfile({ id: 1, birth_head_circumference: "34.5" }).birthHeadCircumference, 34.5);
assert.equal(profileFormToChild({ name: "Mia", birthHeadCircumference: "34.5" }, { includeBirth: false }).birth_head_circumference, 34.5);
assert.equal(profileFormToChild({ name: "Mia", birthHeadCircumference: "" }).birth_head_circumference, null);
assert.equal("birth_head_circumference" in body, false);
assert.equal(medHistoryToIllness({ id: 1, category: "Allergy", allergy_type: "food" }).allergyType, "food");
assert.equal(medHistoryToIllness({ id: 2, category: "Allergy" }).allergyType, "");

console.log("Child profile provider-detail adapter checks passed.");

const missingProfile = childToProfile({ id: 99 });
assert.equal(missingProfile.hasRecordedAvatar, false);
assert.equal(missingProfile.hasRecordedSex, false);
assert.equal(missingProfile.hasRecordedBirthWeight, false);
assert.equal(missingProfile.hasRecordedBirthHeight, false);
assert.equal(missingProfile.birthWeight, 3, "Legacy consumers keep their fallback");
const recordedProfile = childToProfile({ id: 100, avatar_url: "/photo.jpg", sex: "Male", birth_weight: "3.21", birth_length: "50" });
for (const flag of ["hasRecordedAvatar", "hasRecordedSex", "hasRecordedBirthWeight", "hasRecordedBirthHeight"]) assert.equal(recordedProfile[flag], true);
