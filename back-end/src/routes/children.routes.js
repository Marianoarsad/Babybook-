const express = require("express");
const { body } = require("express-validator");

const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { handleValidation } = require("../middleware/validate");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { upload, extOf } = require("../middleware/upload");
const { encryptFields, decryptRow } = require("../utils/crypto");
const { insertEpiSchedule } = require("../utils/epiGenerator");
const storage = require("../utils/storage");

// Sensitive child identity/medical text columns encrypted at rest.
const CHILD_ENCRYPTED = [
    "first_name", "last_name", "nickname", "blood_type", "place_of_birth",
    "hospital", "obgyne_name", "pediatrician_name", "emergency_contact",
    "preferred_health_center",
];

const router = express.Router();

// Columns a client may set on a child profile.
const CHILD_COLUMNS = [
    "first_name", "last_name", "nickname", "date_of_birth", "time_of_birth", "sex",
    "blood_type", "birth_weight", "birth_length", "place_of_birth", "hospital",
    "obgyne_name", "pediatrician_name", "emergency_contact",
    "preferred_health_center", "avatar_url", "allergies", "hereditary_conditions",
];

// JSONB columns must be stringified for pg.
const JSON_COLUMNS = new Set(["allergies", "hereditary_conditions"]);

function pickChildBody(body) {
    const out = {};
    for (const col of CHILD_COLUMNS) {
        if (body[col] !== undefined) {
            out[col] = JSON_COLUMNS.has(col) ? JSON.stringify(body[col]) : body[col];
        }
    }
    // Encrypt sensitive text columns at rest.
    return encryptFields(out, CHILD_ENCRYPTED);
}

// Decrypt + resolve a stored avatar reference (sb://... or a legacy/pasted
// URL — resolveUrl() passes anything else through unchanged) to a viewable URL.
async function toChildResponse(row) {
    const decrypted = decryptRow(row, CHILD_ENCRYPTED);
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
    [body("first_name").trim().notEmpty().withMessage("First name is required")],
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
