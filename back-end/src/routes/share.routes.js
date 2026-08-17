const express = require("express");
const { body } = require("express-validator");

const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { handleValidation } = require("../middleware/validate");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { generateCode, qrPayloadForCode } = require("../utils/shareCode");
const { RECORD_LABELS, buildSnapshot, sealPayload, PURGED_PAYLOAD_SQL } = require("../utils/snapshot");

const router = express.Router();

// Every column of a share EXCEPT `payload`.
//
// The parent's own app never needs the snapshot — it lists codes, their status
// and what was shared — so there is no reason to ship a copy of the child's
// medical records to the client on every history refresh. That was true when
// the payload was plaintext and it is still true now it is sealed: sending
// ciphertext the client cannot read is pure waste, and `SELECT *` would start
// leaking any sensitive column added here in future.
const SHARE_COLUMNS =
    "id, child_id, code, qr_payload, shared_record_keys, generate_date, expiration_date, status, created_at";

// Mark this child's overdue active shares as expired, AND drop the snapshot
// they were holding. One statement, so a share can never be left dead but still
// carrying a readable copy of the child's records. The row itself survives —
// the parent's share history and access log are built from it.
async function sweepChild(childId) {
    await query(
        `UPDATE shared_records SET status = 'expired', payload = $2
         WHERE child_id = $1 AND status = 'active' AND expiration_date <= now()`,
        [childId, PURGED_PAYLOAD_SQL]
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
        // Optional. Travels inside the snapshot, not as a column — see the note
        // on buildSnapshot for why.
        const payload = await buildSnapshot(req.child, keys, req.body.visitReason);

        // Ensure a unique code (retry a few times on the rare collision).
        let share;
        for (let attempt = 0; attempt < 5 && !share; attempt++) {
            const code = generateCode();
            try {
                const { rows } = await query(
                    `INSERT INTO shared_records
                        (child_id, code, qr_payload, shared_record_keys, payload, expiration_date)
                     VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' minutes')::interval)
                     RETURNING ${SHARE_COLUMNS}`,
                    // sealPayload, not JSON.stringify: the snapshot holds
                    // DECRYPTED medical data, and storing it in the clear would
                    // undo the field-level encryption every other table relies
                    // on. See the note in utils/snapshot.js.
                    [req.child.id, code, qrPayloadForCode(code), JSON.stringify(keys), sealPayload(payload), String(ttl)]
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
            `SELECT ${SHARE_COLUMNS} FROM shared_records WHERE child_id = $1 ORDER BY generate_date DESC`,
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
            // Revoking drops the snapshot too. A parent who revokes a code is
            // withdrawing access, and leaving the readable copy behind would
            // honour the letter of that and not the intent.
            `UPDATE shared_records SET status = 'revoked', payload = $3
             WHERE id = $1 AND child_id = $2 AND status = 'active' RETURNING ${SHARE_COLUMNS}`,
            [req.params.id, req.child.id, PURGED_PAYLOAD_SQL]
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

// GET /api/children/:childId/access-log/unseen — count + rows the parent hasn't seen yet
router.get(
    "/:childId/access-log/unseen",
    requireAuth,
    requireChildOwnership,
    asyncHandler(async (req, res) => {
        const { rows } = await query(
            "SELECT * FROM access_logs WHERE child_id = $1 AND seen_by_parent = FALSE ORDER BY access_date DESC",
            [req.child.id]
        );
        res.json({ count: rows.length, rows });
    })
);

// POST /api/children/:childId/access-log/mark-seen — clear the unseen flag
router.post(
    "/:childId/access-log/mark-seen",
    requireAuth,
    requireChildOwnership,
    asyncHandler(async (req, res) => {
        await query(
            "UPDATE access_logs SET seen_by_parent = TRUE WHERE child_id = $1 AND seen_by_parent = FALSE",
            [req.child.id]
        );
        res.json({ status: "ok" });
    })
);

module.exports = router;
