const assert = require("assert");
const {
    parseEmergencyContact,
    serializeEmergencyContact,
    formatEmergencyContact,
} = require("./emergencyContact");

const legacy = parseEmergencyContact("Daniel Rivera (Father) - 0918 555 0199");
assert.deepStrictEqual(legacy, {
    firstName: "Daniel",
    lastName: "Rivera",
    relationship: "Father",
    contactNumber: "0918 555 0199",
});
assert.strictEqual(
    formatEmergencyContact(serializeEmergencyContact(legacy)),
    "Daniel Rivera (Father) - 0918 555 0199",
);
assert.strictEqual(formatEmergencyContact("Call Aunt Rosa"), "Call Aunt Rosa");
assert.strictEqual(serializeEmergencyContact({}), null);

console.log("emergency contact checks passed");
