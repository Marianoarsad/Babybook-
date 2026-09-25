const express = require("express");
const { body } = require("express-validator");

const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { handleValidation } = require("../middleware/validate");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { upload, extOf } = require("../middleware/upload");
const { encryptFields, decryptRow } = require("../utils/crypto");
const { insertEpiSchedule } = require("../utils/epiGenerator");
const { EPI_SCHEDULE, SCHEDULE_VERSION } = require("../data/epiSchedule");
const storage = require("../utils/storage");
const {
    parseEmergencyContact,
    serializeEmergencyContact,
    formatEmergencyContact,
} = require("../utils/emergencyContact");

// Sensitive child identity/medical text columns encrypted at rest.
const CHILD_ENCRYPTED = [
    "first_name", "last_name", "nickname", "blood_type", "place_of_birth",
    "hospital", "obgyne_name", "obgyne_contact_number", "pediatrician_name",
    "pediatrician_contact_number", "pediatrician_clinic_hospital", "emergency_contact",
    "preferred_health_center",
];

const router = express.Router();

const childValidators = () => [
    body("birth_weight").optional({ nullable: true }).isFloat({ min: 0.3, max: 40 })
        .withMessage("Birth weight must be between 0.3 and 40 kg"),
    body("birth_length").optional({ nullable: true }).isFloat({ min: 20, max: 140 })
        .withMessage("Birth height must be between 20 and 140 cm"),
    body("pediatrician_contact_number").optional({ values: "falsy" }).matches(/^\d+$/)
        .withMessage("Pediatrician contact number must contain digits only"),
    body("obgyne_contact_number").optional({ values: "falsy" }).matches(/^\d+$/)
        .withMessage("OB-GYNE contact number must contain digits only"),
    body("emergency_contact_details.contact_number").optional({ values: "falsy" }).matches(/^\d+$/)
        .withMessage("Emergency contact number must contain digits only"),
    body("emergency_contact_details").optional({ nullable: true }).isObject()
        .withMessage("Emergency contact details must be an object"),
];

// Columns a client may set on a child profile.
const CHILD_COLUMNS = [
    "first_name", "last_name", "nickname", "date_of_birth", "time_of_birth", "sex",
    "blood_type", "birth_weight", "birth_length", "place_of_birth", "hospital",
    "obgyne_name", "obgyne_contact_number", "pediatrician_name",
    "pediatrician_contact_number", "pediatrician_clinic_hospital", "emergency_contact",
    "preferred_health_center", "avatar_url", "allergies", "hereditary_conditions",
];

// JSONB columns must be stringified for pg.
const JSON_COLUMNS = new Set(["allergies", "hereditary_conditions"]);

function pickChildBody(body) {
    const out = {};
    for (const col of CHILD_COLUMNS) {
        if (col === "emergency_contact" && body.emergency_contact_details !== undefined) continue;
        if (body[col] !== undefined) {
            out[col] = JSON_COLUMNS.has(col) ? JSON.stringify(body[col]) : body[col];
        }
    }
    if (body.emergency_contact_details !== undefined) {
        out.emergency_contact = serializeEmergencyContact(body.emergency_contact_details);
    }
    // Encrypt sensitive text columns at rest.
    return encryptFields(out, CHILD_ENCRYPTED);
}

// Decrypt + resolve a stored avatar reference (sb://... or a legacy/pasted
// URL — resolveUrl() passes anything else through unchanged) to a viewable URL.
async function toChildResponse(row) {
    const decrypted = decryptRow(row, CHILD_ENCRYPTED);
    const emergencyContact = parseEmergencyContact(decrypted.emergency_contact);
    decrypted.emergency_contact = formatEmergencyContact(emergencyContact);
    decrypted.emergency_contact_details = {
        first_name: emergencyContact.firstName,
        last_name: emergencyContact.lastName,
        relationship: emergencyContact.relationship,
        contact_number: emergencyContact.contactNumber,
    };
    decrypted.avatar_url = await storage.resolveUrl(decrypted.avatar_url);
    return decrypted;
}

// GET /api/children — all children for the user
router.get(
    "/",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { rows } = await query(
            "SELECT * FROM children WHERE user_id = $1 ORDER BY created_at ASC",
            [req.user.id]
        );
        res.json(await Promise.all(rows.map(toChildResponse)));
    })
);

// POST /api/children
router.post(
    "/",
    requireAuth,
    [
        body("first_name").trim().notEmpty().withMessage("First name is required"),
        ...childValidators(),
    ],
    handleValidation,
    asyncHandler(async (req, res) => {
        const data = pickChildBody(req.body);
        const cols = Object.keys(data);
        const allCols = ["user_id", ...cols];
        const params = [req.user.id, ...Object.values(data)];
        const placeholders = allCols.map((_, i) => `$${i + 1}`).join(", ");
        const { rows } = await query(
            `INSERT INTO children (${allCols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
            params
        );
        const child = rows[0];

        // Don't let schedule generation failure block child creation — the
        // parent still gets their child profile either way. Flag failure so
        // the app can offer a retry via the generate-schedule endpoint.
        let scheduleGenerated = false;
        if (child.date_of_birth) {
            try {
                await insertEpiSchedule(child.id, child.date_of_birth, "all");
                scheduleGenerated = true;
            } catch (e) {
                console.error("[children] EPI schedule generation failed:", e.message);
            }
        }

        res.status(201).json({ ...(await toChildResponse(child)), scheduleGenerated });
    })
);

// POST /api/children/:childId/vaccinations/generate-schedule
// Generates/backfills the DOH EPI schedule for a child that has none (or is
// missing doses): the child predates this feature, DOB was added/corrected
// later, generation failed on first attempt, or the schedule was revised.
router.post(
    "/:childId/vaccinations/generate-schedule",
    requireAuth,
    requireChildOwnership,
    [body("mode").optional().isIn(["fill-gaps", "replace"])],
    handleValidation,
    asyncHandler(async (req, res) => {
        if (!req.child.date_of_birth) {
            throw new ApiError(400, "This child has no date of birth on file — add one first.");
        }
        const mode = req.body.mode || "fill-gaps";
        const result = await insertEpiSchedule(req.child.id, req.child.date_of_birth, mode);
        res.json({ status: "ok", ...result });
    })
);

// GET /api/children/vaccine-catalogue
//
// The vaccine names and dose counts the DOH schedule contains, so the Add
// Vaccination form can offer a list instead of an empty text box. Served from
// data/epiSchedule.js rather than duplicated in the app: a second hand-typed
// copy would drift from the schedule the reminders and due dates come from,
// and the whole point of the picker is that the two agree.
//
// Not child-scoped — the catalogue is the same for everyone — but kept behind
// auth since it sits under /api/children. Declared BEFORE "/:childId" so
// Express does not read "vaccine-catalogue" as a child id.
router.get(
    "/vaccine-catalogue",
    requireAuth,
    asyncHandler(async (req, res) => {
        const byName = new Map();
        for (const e of EPI_SCHEDULE) {
            const prev = byName.get(e.vaccineName) || { name: e.vaccineName, doses: 0 };
            prev.doses = Math.max(prev.doses, e.doseNumber || 1);
            byName.set(e.vaccineName, prev);
        }
        res.json({ scheduleVersion: SCHEDULE_VERSION, vaccines: [...byName.values()] });
    })
);

// GET /api/children/:childId
router.get(
    "/:childId",
    requireAuth,
    requireChildOwnership,
    asyncHandler(async (req, res) => {
        res.json(await toChildResponse(req.child));
    })
);

// PUT /api/children/:childId
router.put(
    "/:childId",
    requireAuth,
    requireChildOwnership,
    childValidators(),
    handleValidation,
    asyncHandler(async (req, res) => {
        const data = pickChildBody(req.body);
        const cols = Object.keys(data);
        if (cols.length === 0) throw new ApiError(400, "No updatable fields provided");
        const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
        const params = [...Object.values(data), req.child.id];
        const { rows } = await query(
            `UPDATE children SET ${setClause} WHERE id = $${cols.length + 1} RETURNING *`,
            params
        );
        res.json(await toChildResponse(rows[0]));
    })
);

// POST /api/children/:childId/avatar — set the baby's profile picture.
// Accepts a multipart "photo" (device upload) or an "avatar_url" field (paste a URL).
router.post(
    "/:childId/avatar",
    requireAuth,
    requireChildOwnership,
    upload.single("photo"),
    asyncHandler(async (req, res) => {
        // Delete the old stored file (if any) before writing the new reference.
        await storage.deleteFile(req.child.avatar_url);
        const avatarRef = req.file
            ? await storage.uploadFile(req.file.buffer, req.file.mimetype, extOf(req.file))
            : req.body.avatar_url;
        if (!avatarRef) throw new ApiError(400, "No image provided");
        const { rows } = await query(
            "UPDATE children SET avatar_url = $1 WHERE id = $2 RETURNING *",
            [avatarRef, req.child.id]
        );
        res.json(await toChildResponse(rows[0]));
    })
);

// DELETE /api/children/:childId — cascades to all records
router.delete(
    "/:childId",
    requireAuth,
    requireChildOwnership,
    asyncHandler(async (req, res) => {
        await query("DELETE FROM children WHERE id = $1", [req.child.id]);
        res.status(204).end();
    })
);

module.exports = router;
