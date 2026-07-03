const express = require("express");
const { body } = require("express-validator");

const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { handleValidation } = require("../middleware/validate");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { upload, publicUrlFor } = require("../middleware/upload");

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
    return out;
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
        res.json(rows);
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
        res.status(201).json(rows[0]);
    })
);

// GET /api/children/:childId
router.get(
    "/:childId",
    requireAuth,
    requireChildOwnership,
    asyncHandler(async (req, res) => {
        res.json(req.child);
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
        res.json(rows[0]);
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
        const avatarUrl = req.file ? publicUrlFor(req.file.filename) : req.body.avatar_url;
        if (!avatarUrl) throw new ApiError(400, "No image provided");
        const { rows } = await query(
            "UPDATE children SET avatar_url = $1 WHERE id = $2 RETURNING *",
            [avatarUrl, req.child.id]
        );
        res.json(rows[0]);
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
