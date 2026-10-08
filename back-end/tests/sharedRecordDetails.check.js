// Run: node tests/sharedRecordDetails.check.js. No database or credentials needed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { body, validationResult } = require("express-validator");
const numeric = require("../src/utils/numericValidation");
const contacts = require("../src/utils/emergencyContact");
const read = (file) => fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
const resources = [];
const routes = { exports: {} };
new Function("require", "module", "exports", read("routes/records.routes.js")
    + "\nmodule.exports.validateMedicalHistory = validateMedicalHistory;")((name) => {
    if (name === "express") return express;
    if (name === "../middleware/error") return require("../src/middleware/error");
    if (name === "../utils/numericValidation") return numeric;
    if (name === "../middleware/auth") return { requireAuth() {}, requireChildOwnership() {} };
    if (name === "../utils/resource") return { createResourceRouter: (resource) => {
        resources.push(resource); return express.Router();
    } };
    throw new Error(`Unexpected route dependency ${name}`);
}, routes, routes.exports);

const snapshots = { exports: {} };
const allergyRows = [
    { id: 1, category: "Allergy", title: "Egg", allergy_type: "food", date_recorded: "2026-10-01", resolved: false, care_level: "home", facility: "Shared clinic" },
    { category: "Allergy", title: "Dust", allergy_type: "non_food" },
    { category: "Allergy", title: "Peanuts", allergy_type: null },
    { category: "Hereditary Condition", title: "Asthma" },
];
new Function("require", "module", "exports", read("utils/snapshot.js"))((name) => {
    if (name === "../db/pool") return { query: async (sql, params) => {
        assert.deepEqual(params, [42]);
        if (sql.includes("FROM medical_history")) {
            if (sql.includes("'Hereditary Condition'")) {
                assert(sql.includes("WHERE child_id = $1"));
                assert(sql.includes("date_recorded, resolved, resolved_date"));
                return { rows: allergyRows };
            }
            return { rows: [{ id: 8, category: "Illness", title: "Fever" }] };
        }
        if (sql.includes("FROM growth_records")) return { rows: [] };
        throw new Error(`Unexpected snapshot query ${sql}`);
    } };
    if (name === "./emergencyContact") return contacts;
    if (name === "./crypto") return {
        encrypt: (value) => "enc:" + value,
        decrypt: (value) => typeof value === "string" && value.startsWith("enc:") ? value.slice(4) : value,
        decryptRow: (row) => row, isEncrypted: (value) => value.startsWith("enc:"),
    };
    throw new Error(`Unexpected snapshot dependency ${name}`);
}, snapshots, snapshots.exports);

async function main() {
    const validate = routes.exports.validateMedicalHistory;
    validate({ category: "Allergy", allergy_type: "food" }, { isCreate: true });
    validate({ allergy_type: "non_food" }, { isCreate: false, existing: { category: "Allergy", allergy_type: null } });
    validate({ title: "Egg" }, { isCreate: false, existing: { category: "Allergy", allergy_type: "food" } });
    validate({ resolved: true }, { isCreate: false, existing: { category: "Medication" } });
    for (const allergy_type of [undefined, null, ""]) {
        assert.throws(() => validate({ category: "Allergy", allergy_type }, { isCreate: true }), (error) => error.status === 400);
        assert.throws(() => validate({ allergy_type }, { isCreate: false, existing: { category: "Allergy", allergy_type: "food" } }), (error) => error.status === 400);
    }
    assert.throws(() => validate({ title: "Legacy" }, { isCreate: false, existing: { category: "Allergy", allergy_type: null } }), (error) => error.status === 400);
    assert.throws(() => validate({ allergy_type: "food" }, { isCreate: false, existing: { category: "Illness" } }), (error) => error.status === 400);
    for (const data of [{ category: "Allergy", allergy_type: "other" }, { category: "Illness", allergy_type: "food" }]) {
        assert.throws(() => validate(data, { isCreate: true }), (error) => error.status === 400);
    }
    assert(resources.find((resource) => resource.path === "medical-history").columns.includes("allergy_type"));
    const childSource = read("routes/children.routes.js");
    const validatorText = childSource.slice(childSource.indexOf("const childValidators = () => ")
        + "const childValidators = ".length, childSource.indexOf("// Columns a client may set"));
    const validators = new Function("body", "isNumberWithin", `return ${validatorText.trim().replace(/;$/, "")}`)(body, numeric.isNumberWithin);
    for (const value of [null, "34.5", 20, 65, "34.55", "bad", "34.555", 19, 66]) {
        const req = { body: { birth_head_circumference: value } };
        for (const chain of validators()) await chain.run(req);
        assert.equal(validationResult(req).isEmpty(), [null, "34.5", 20, 65, "34.55"].includes(value), `Birth head validation: ${value}`);
    }
    assert(childSource.includes('"birth_head_circumference", "place_of_birth"'));
    const schema = read("db/schema.sql");
    const medicalSchema = schema.slice(schema.indexOf("CREATE TABLE medical_history"), schema.indexOf("CREATE INDEX idx_medical"));
    assert(medicalSchema.includes("allergy_type IN ('food', 'non_food')"));
    assert(!schema.slice(schema.indexOf("CREATE TABLE checkups"), schema.indexOf("CREATE TABLE medical_history")).includes("allergy_type"));
    assert(schema.includes("CHECK (birth_head_circumference BETWEEN 20 AND 65)"));
    const migration = read("db/migrations/016_shared_record_details.sql");
    assert(!/\bDROP\b|UPDATE\s+children|UPDATE\s+medical_history/i.test(migration));
    assert(migration.includes("IF NOT EXISTS") && migration.includes("pg_constraint"));

    const emergency = { firstName: "Maria Clara", lastName: "Rivera", relationship: "Mother", contactNumber: "09171234567" };
    const child = { id: 42, first_name: "Mia", allergies: ["egg", "Sesame"], birth_head_circumference: "34.5",
        emergency_contact: contacts.serializeEmergencyContact(emergency) };
    const payload = await snapshots.exports.buildSnapshot(child, ["profile", "growth", "allergies"]);
    assert.deepEqual(payload.profile.emergencyContactDetails, emergency);
    assert.equal(payload.growth.birthHeadCircumference, "34.5");
    assert.deepEqual(payload.allergies.foodAllergies, ["Egg"]);
    assert.deepEqual(payload.allergies.unclassifiedAllergies, ["Peanuts", "Sesame"]);
    assert.deepEqual(payload.allergies.allergies, ["Egg", "Dust", "Peanuts", "Sesame"]);
    assert.equal(payload.allergies.allergyEntries.length, 3);
    assert.equal(payload.allergies.allergyEntries[0].date_recorded, "2026-10-01");
    assert.equal(payload.allergies.allergyEntries[0].resolved, false);
    assert.equal(payload.allergies.allergyEntries[0].facility, "Shared clinic");
    assert.deepEqual(payload.allergies.hereditaryEntries.map((row) => row.title), ["Asthma"]);
    const privatePayload = await snapshots.exports.buildSnapshot(child, []);
    assert.equal(privatePayload.profile, undefined);
    assert.equal(privatePayload.growth, undefined);
    assert.equal(privatePayload.allergies, undefined);
    const historyOnly = await snapshots.exports.buildSnapshot(child, ["medicalHistory"]);
    assert.equal(historyOnly.allergies, undefined, "History permission does not authorize allergy details");
    assert.equal(historyOnly.medicalHistory[0].category, "Illness");
    const legacy = { profile: { emergencyContact: "Maria Rivera (Mother) - 09171234567" } };
    const normalized = snapshots.exports.openPayload(legacy);
    assert.equal(normalized.profile.emergencyContactDetails.firstName, "Maria");
    assert.equal(normalized.profile.emergencyContactDetails.contactNumber, "09171234567");
    assert.equal(legacy.profile.emergencyContactDetails, undefined, "Do not rewrite frozen legacy snapshots");
    assert.deepEqual(snapshots.exports.openPayload(JSON.parse(snapshots.exports.sealPayload(payload))), JSON.parse(JSON.stringify(payload)));
    assert.equal(snapshots.exports.openPayload("broken JSON"), null);
    console.log("Shared record details checks passed: nullable fields, validation, additive schema, classification, scoped snapshots and legacy contacts.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
