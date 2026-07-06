const { query } = require("../db/pool");
const { decrypt, decryptRow } = require("./crypto");

// Record keys the parent can choose to share (mirrors the app's labels).
const RECORD_LABELS = {
    profile: "Child Profile & Birth Info",
    vaccinations: "Vaccination History",
    allergies: "Allergies & Hereditary Conditions",
    growth: "Growth Measurements",
    milestones: "Developmental Milestones",
    checkups: "Checkups & Appointments",
    nutrition: "Nutrition & Feeding",
};

// Builds a view-only snapshot of the selected records for a child.
// The snapshot is frozen into the share row so the professional always sees
// exactly what was authorized at generation time.
async function buildSnapshot(child, keys) {
    const snap = {};

    if (keys.includes("profile")) {
        snap.profile = {
            name: [decrypt(child.first_name), decrypt(child.last_name)].filter(Boolean).join(" "),
            dateOfBirth: child.date_of_birth,
            sex: child.sex,
            bloodType: decrypt(child.blood_type),
            birthWeight: child.birth_weight,
            birthLength: child.birth_length,
            hospital: decrypt(child.hospital),
            pediatrician: decrypt(child.pediatrician_name),
            obgyne: decrypt(child.obgyne_name),
            emergencyContact: decrypt(child.emergency_contact),
        };
    }

    if (keys.includes("allergies")) {
        snap.allergies = {
            allergies: child.allergies || [],
            hereditaryConditions: child.hereditary_conditions || [],
        };
    }

    if (keys.includes("vaccinations")) {
        const { rows } = await query(
            "SELECT vaccine_name, visit_name, due_date, date_given, status, notes FROM vaccinations WHERE child_id = $1 ORDER BY COALESCE(date_given, due_date) DESC NULLS LAST",
            [child.id]
        );
        snap.vaccinations = rows.map((r) => decryptRow(r, ["vaccine_name", "visit_name", "notes"]));
    }

    if (keys.includes("growth")) {
        const { rows } = await query(
            "SELECT height, weight, head_circumference, date_recorded FROM growth_records WHERE child_id = $1 ORDER BY date_recorded DESC",
            [child.id]
        );
        snap.growth = {
            birthWeight: child.birth_weight,
            birthLength: child.birth_length,
            measurements: rows,
        };
    }

    if (keys.includes("milestones")) {
        const { rows } = await query(
            "SELECT title, age_achieved, date_recorded, is_completed FROM milestones WHERE child_id = $1 ORDER BY date_recorded DESC NULLS LAST",
            [child.id]
        );
        snap.milestones = rows.map((r) => decryptRow(r, ["title", "age_achieved"]));
    }

    if (keys.includes("checkups")) {
        const { rows } = await query(
            "SELECT title, doctor_name, clinic, checkup_date, time_of_visit, status, notes FROM checkups WHERE child_id = $1 ORDER BY checkup_date DESC NULLS LAST",
            [child.id]
        );
        snap.checkups = rows.map((r) => decryptRow(r, ["title", "doctor_name", "clinic", "notes"]));
    }

    if (keys.includes("nutrition")) {
        const { rows } = await query(
            `SELECT entry_type, milk_type, formula_brand, quantity, unit, food_introduced, reaction, entry_date, entry_time, notes
             FROM nutrition_records WHERE child_id = $1
             ORDER BY entry_date DESC NULLS LAST, entry_time DESC NULLS LAST`,
            [child.id]
        );
        snap.nutrition = rows.map((r) => decryptRow(r, ["formula_brand", "food_introduced", "reaction", "notes"]));
    }

    return snap;
}

module.exports = { RECORD_LABELS, buildSnapshot };
