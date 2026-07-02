const express = require("express");
const { body } = require("express-validator");

const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { handleValidation } = require("../middleware/validate");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { generateCode, qrPayloadForCode } = require("../utils/shareCode");
const { RECORD_LABELS, buildSnapshot } = require("../utils/snapshot");

const router = express.Router();

// Mark this child's overdue active shares as expired.
async function sweepChild(childId) {
    await query(
        `UPDATE shared_records SET status = 'expired'
         WHERE child_id = $1 AND status = 'active' AND expiration_date <= now()`,
        [childId]
    );
}

// POST /api/children/:childId/shares — generate a QR consultation share
router.post(
    "/:childId/shares",
    requireAuth,
    requireChildOwnership,
    [
        body("recordKeys").isArray({ min: 1 }).withMessage("Select at least one record type"),
        body("ttlMinutes").optional().isInt({ min: 1, max: 1440 }),
    ],
    handleValidation,
    asyncHandler(async (req, res) => {
        const valid = Object.keys(RECORD_LABELS);
        const keys = req.body.recordKeys.filter((k) => valid.includes(k));
        if (keys.length === 0) throw new ApiError(400, "No valid record types selected");

        const ttl = parseInt(req.body.ttlMinutes || "60", 10);
        const payload = await buildSnapshot(req.child, keys);

        // Ensure a unique code (retry a few times on the rare collision).
        let share;
        for (let attempt = 0; attempt < 5 && !share; attempt++) {
            const code = generateCode();
            try {
                const { rows } = await query(
                    `INSERT INTO shared_records
                        (child_id, code, qr_payload, shared_record_keys, payload, expiration_date)
                     VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' minutes')::interval)
                     RETURNING *`,
                    [req.child.id, code, qrPayloadForCode(code), JSON.stringify(keys), JSON.stringify(payload), String(ttl)]
                );
                share = rows[0];
            } catch (e) {
                if (e.code !== "23505") throw e; // retry only on code collision
            }
        }
        if (!share) throw new ApiError(500, "Could not generate a unique code, please retry");
        res.status(201).json(share);
    })
);

// GET /api/children/:childId/shares — list active & past shares
router.get(
    "/:childId/shares",
    requireAuth,
    requireChildOwnership,
    asyncHandler(async (req, res) => {
        await sweepChild(req.child.id);
        const { rows } = await query(
            "SELECT * FROM shared_records WHERE child_id = $1 ORDER BY generate_date DESC",
            [req.child.id]
        );
        res.json(rows);
    })
);

// POST /api/children/:childId/shares/:id/revoke
router.post(
    "/:childId/shares/:id/revoke",
    requireAuth,
    requireChildOwnership,
    asyncHandler(async (req, res) => {
        const { rows } = await query(
            `UPDATE shared_records SET status = 'revoked'
             WHERE id = $1 AND child_id = $2 AND status = 'active' RETURNING *`,
            [req.params.id, req.child.id]
        );
        if (!rows[0]) throw new ApiError(404, "Active share not found");
        res.json(rows[0]);
    })
);

// GET /api/children/:childId/access-log — who viewed this child's records
router.get(
    "/:childId/access-log",
    requireAuth,
    requireChildOwnership,
    asyncHandler(async (req, res) => {
        const { rows } = await query(
            "SELECT * FROM access_logs WHERE child_id = $1 ORDER BY access_date DESC",
            [req.child.id]
        );
        res.json(rows);
    })
);

module.exports = router;
