const VERSION = 1;

const clean = (value, max = 200) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

function normalizeEmergencyContact(value) {
    if (!value || typeof value !== "object") {
        return { firstName: "", lastName: "", relationship: "", contactNumber: "" };
    }
    return {
        firstName: clean(value.firstName ?? value.first_name),
        lastName: clean(value.lastName ?? value.last_name),
        relationship: clean(value.relationship),
        contactNumber: clean(value.contactNumber ?? value.contact_number, 80),
    };
}

function parseEmergencyContact(value) {
    if (value && typeof value === "object") return normalizeEmergencyContact(value);
    const text = clean(value, 800);
    if (!text) return normalizeEmergencyContact(null);
    try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.v === VERSION) return normalizeEmergencyContact(parsed);
    } catch {
        // Legacy contacts are ordinary display strings, not JSON.
    }
    const match = text.match(/^(.*?)(?:\s+\(([^()]*)\))?(?:\s+-\s+(.+))?$/);
    const name = clean(match?.[1] || text);
    const nameParts = name.split(/\s+/).filter(Boolean);
    return {
        firstName: nameParts.shift() || "",
        lastName: nameParts.join(" "),
        relationship: clean(match?.[2]),
        contactNumber: clean(match?.[3], 80),
    };
}

function serializeEmergencyContact(value) {
    const contact = normalizeEmergencyContact(value);
    if (!Object.values(contact).some(Boolean)) return null;
    return JSON.stringify({ v: VERSION, ...contact });
}

function formatEmergencyContact(value) {
    const contact = parseEmergencyContact(value);
    let display = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    if (contact.relationship) display += `${display ? " " : ""}(${contact.relationship})`;
    if (contact.contactNumber) display += `${display ? " - " : ""}${contact.contactNumber}`;
    return display;
}

module.exports = {
    parseEmergencyContact,
    serializeEmergencyContact,
    formatEmergencyContact,
};
