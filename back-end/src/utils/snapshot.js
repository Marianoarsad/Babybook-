const { query } = require("../db/pool");
const { encrypt, decrypt, decryptRow, isEncrypted } = require("./crypto");
const { formatEmergencyContact, parseEmergencyContact } = require("./emergencyContact");

// Record keys the parent can choose to share (mirrors the app's labels).
const RECORD_LABELS = {
    profile: "Child Profile & Birth Info",
    vaccinations: "Vaccination History",
    allergies: "Allergies & Hereditary Conditions",
    growth: "Growth Measurements",
    milestones: "Developmental Milestones",
    checkups: "Checkups & Appointments",
    nutrition: "Nutrition & Feeding",
    medicalHistory: "Medical History (Illnesses, Medications, Hospitalizations)",
};

// The parent's own words about why this consultation is happening. Capped so a
// pasted essay cannot bloat every snapshot row.
const VISIT_REASON_MAX = 500;

// Builds a view-only snapshot of the selected records for a child.
// The snapshot is frozen into the share row so the professional always sees
// exactly what was authorized at generation time.
//
// `visitReason` lives in the snapshot rather than in a column of its own, and
// that is deliberate on two counts: `payload` is already JSONB built in this
// process, so it needs no migration; and a reason for visit belongs to THIS
// consultation, not to the child — a second code generated next month is a
// different visit with a different reason.
async function buildSnapshot(child, keys, visitReason) {
    const snap = {};

    // Only set when there is something to say. An empty string would render an
    // empty banner on the professional's screen, which is worse than no banner.
    const reason = String(visitReason || "").trim().slice(0, VISIT_REASON_MAX);
    if (reason) snap.visitReason = reason;

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
            emergencyContact: formatEmergencyContact(decrypt(child.emergency_contact)),
            emergencyContactDetails: parseEmergencyContact(decrypt(child.emergency_contact)),
        };
    }

    if (keys.includes("allergies")) {
        const { rows } = await query(
            `SELECT id, category, title, allergy_type, date_recorded, resolved, resolved_date,
                    care_level, facility FROM medical_history
             WHERE child_id = $1 AND category IN ('Allergy', 'Hereditary Condition')
             ORDER BY date_recorded DESC NULLS LAST, id DESC`,
            [child.id],
        );
        const facts = rows.map((row) => decryptRow(row, ["title", "facility"]));
        const merge = (legacy, category) => {
            const values = [...facts.filter((row) => row.category === category).map((row) => row.title), ...(legacy || [])];
            const seen = new Set();
            return values.filter((value) => {
                const text = String(value || "").trim();
                const key = text.toLocaleLowerCase();
                if (!text || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        };
        const allergies = merge(child.allergies, "Allergy");
        const allergyType = (title) => facts.find((row) => row.category === "Allergy"
            && String(row.title || "").trim().toLocaleLowerCase() === String(title).trim().toLocaleLowerCase())?.allergy_type;
        snap.allergies = {
            allergyEntries: facts.filter((row) => row.category === "Allergy"),
            hereditaryEntries: facts.filter((row) => row.category === "Hereditary Condition"),
            allergies,
            foodAllergies: allergies.filter((title) => allergyType(title) === "food"),
            unclassifiedAllergies: allergies.filter((title) => !allergyType(title)),
            hereditaryConditions: merge(child.hereditary_conditions, "Hereditary Condition"),
        };
    }

    if (keys.includes("vaccinations")) {
        const { rows } = await query(
            // dose_number and the reaction fields travel too: a reaction to a
            // previous dose is among the most decision-relevant things a
            // clinician can be told, and it could not reach them at all before.
            "SELECT vaccine_name, visit_name, due_date, date_given, status, notes, dose_number, reaction_severity, reaction FROM vaccinations WHERE child_id = $1 ORDER BY COALESCE(date_given, due_date) DESC NULLS LAST",
            [child.id]
        );
        snap.vaccinations = rows.map((r) =>
            decryptRow(r, ["vaccine_name", "visit_name", "notes", "reaction"])
        );
    }

    if (keys.includes("growth")) {
        const { rows } = await query(
            // measured_at travels: a clinician reading a series needs to know
            // which values came off a clinic scale. `notes` deliberately does
            // NOT — the parent's private aside is not part of the clinical
            // extract, the same boundary drawn for milestone descriptions.
            "SELECT id, height, weight, head_circumference, date_recorded, measured_at FROM growth_records WHERE child_id = $1 ORDER BY date_recorded DESC, id DESC",
            [child.id]
        );
        snap.growth = {
            birthWeight: child.birth_weight,
            birthLength: child.birth_length,
            birthHeadCircumference: child.birth_head_circumference,
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
            `SELECT entry_type, milk_type, feed_method, formula_brand, formula_scoops,
                    quantity, breastmilk_quantity, unit,
                    duration_minutes, breast_side,
                    food_introduced, reaction_severity, reaction, entry_date, entry_time, notes
             FROM nutrition_records WHERE child_id = $1
             ORDER BY entry_date DESC NULLS LAST, entry_time DESC NULLS LAST`,
            [child.id]
        );
        snap.nutrition = rows.map((r) => decryptRow(r, ["formula_brand", "food_introduced", "reaction", "notes"]));
    }

    if (keys.includes("medicalHistory")) {
        const { rows } = await query(
            `SELECT id, category, title, description, date_recorded, resolved, resolved_date,
                    care_level, facility, notes,
                    dose_amount, frequency_per_day, course_days, prescribed_by, treats_id
             FROM medical_history
             WHERE child_id = $1 AND category IN ('Illness', 'Medication', 'Hospitalization')
             ORDER BY date_recorded DESC NULLS LAST`,
            [child.id]
        );
        // `id` and `treats_id` ship so the professional view can name the
        // illness a medicine is for ("for Ear Infection") without a second
        // request. dose_times is deliberately left out: it is the parent's
        // phone-reminder setting, not a clinical fact.
        snap.medicalHistory = rows.map((r) =>
            decryptRow(r, ["title", "description", "facility", "notes", "dose_amount", "prescribed_by"]),
        );
    }

    assertReadableSnapshot(snap);
    return snap;
}

function assertReadableSnapshot(value) {
    if (typeof value === "string" && value.includes("enc:v1:")) {
        const error = new Error("Selected shared records cannot be decrypted");
        error.code = "SHARED_RECORDS_UNREADABLE";
        throw error;
    }
    if (value && typeof value === "object") Object.values(value).forEach(assertReadableSnapshot);
}

function authorizedSnapshot(payload, recordKeys) {
    if (!payload || Array.isArray(payload) || typeof payload !== "object") return null;
    const result = {};
    for (const key of recordKeys) {
        if (Object.hasOwn(RECORD_LABELS, key) && Object.hasOwn(payload, key)) result[key] = payload[key];
    }
    if (typeof payload.visitReason === "string") result.visitReason = payload.visitReason.slice(0, VISIT_REASON_MAX);
    assertReadableSnapshot(result);
    return result;
}

// ---------------------------------------------------------------------------
// Snapshot storage: sealing, opening, and purging.
//
// THE PROBLEM THESE SOLVE. buildSnapshot() DECRYPTS every protected field —
// allergies, illness titles, facilities, names — because the professional has
// to be able to read them. Until now that decrypted copy went straight into
// `shared_records.payload` as ordinary JSON, and expired shares were only
// marked `status='expired'`, never cleared. So for any child whose parent had
// ever generated a code, the same data the `children` and `medical_history`
// tables protect with AES-256-GCM sat in plain text one table over, and
// accumulated one row per code, forever. Field-level encryption was, in
// practice, bypassed at rest.
//
// Two defences, because they cover different windows:
//   sealPayload  — protects the snapshot while the code is live
//   purgePayload — removes it once the code is dead, so the exposure is one
//                  active consultation rather than the account's whole history
//
// WHY A STRING IN A JSONB COLUMN. `payload` is `JSONB NOT NULL`, and a JSON
// string is perfectly valid JSONB — so the ciphertext is stored as
// `"enc:v1:…"` and no migration is needed. That matters here: migrations 005
// and 006 are still unapplied to the deployed database, and this fix should not
// have to queue behind them.

// What a purged snapshot looks like. An empty object rather than NULL, because
// the column is NOT NULL — and the ROW survives on purpose: it carries the
// share history and the access log the parent relies on. Only the medical copy
// goes.
const PURGED_PAYLOAD = {};

// Snapshot object -> the value to store in the payload column.
function sealPayload(snap) {
    return JSON.stringify(encrypt(JSON.stringify(snap)));
}

// Payload column value -> the snapshot object.
//
// Handles three shapes, and must keep handling all three:
//   - a string starting `enc:v1:` — sealed by this app (the normal case)
//   - an object — a LEGACY row written before sealing existed. Still readable
//     on purpose: silently breaking every code generated before this change
//     would be a worse failure than the one being fixed.
//   - anything else / empty — a purged or unusable row; caller treats as gone.
function openPayload(stored) {
    if (stored && typeof stored === "object") return withContactDetails(stored); // legacy plaintext
    if (typeof stored !== "string") return null;
    if (!isEncrypted(stored)) {
        // A legacy row could also have been stored as a JSON string.
        try { return withContactDetails(JSON.parse(stored)); } catch { return null; }
    }
    try {
        return withContactDetails(JSON.parse(decrypt(stored)));
    } catch {
        // A payload we cannot open is not a payload we may guess at.
        return null;
    }
}

// Normalize only already-shared contact text; never look up the live child.
function withContactDetails(payload) {
    if (!payload?.profile || payload.profile.emergencyContactDetails) return payload;
    return { ...payload, profile: { ...payload.profile,
        emergencyContactDetails: parseEmergencyContact(payload.profile.emergencyContact) } };
}

// The literal to assign when clearing a snapshot. Callers add
// `payload = $n` to the UPDATE that already marks the share expired or
// revoked, so the status change and the purge are one atomic statement — a
// share can never end up dead but still holding its plaintext copy. There is
// deliberately no generic "purge where X" helper: it would mean building SQL
// from a caller-supplied string, which is how injection bugs start.
const PURGED_PAYLOAD_SQL = JSON.stringify(PURGED_PAYLOAD);

module.exports = {
    RECORD_LABELS,
    buildSnapshot,
    VISIT_REASON_MAX,
    sealPayload,
    openPayload,
    authorizedSnapshot,
    assertReadableSnapshot,
    PURGED_PAYLOAD_SQL,
};
