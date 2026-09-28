const assert = require("node:assert/strict");
const { conditionAttachmentType, conditionSummaries, mergeConditions } = require("./conditions.cjs");

const detailed = [
    { id: "1", category: "Allergy", title: "Egg" },
    { id: "2", category: "Illness", title: "Cold" },
    { id: "3", category: "Hereditary Condition", title: "Asthma" },
];
const merged = mergeConditions(detailed, [" egg ", "Penicillin"], ["Asthma", "Hypertension"]);
assert.deepEqual(merged.map((item) => item.title), ["Egg", "Cold", "Asthma", "Penicillin", "Hypertension"]);
assert.equal(merged.filter((item) => item.legacy).length, 2);
assert.deepEqual(conditionSummaries(detailed, ["Penicillin"], ["Asthma"]).allergies, ["Egg", "Penicillin"]);
assert.equal(conditionAttachmentType("Allergy"), "allergy");
assert.equal(conditionAttachmentType("Hereditary Condition"), "hereditary");
assert.equal(conditionAttachmentType("Hospitalization"), "hospitalization");
assert.equal(conditionAttachmentType("Illness"), "illness");
console.log("Condition merge checks passed");
