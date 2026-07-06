const express = require("express");
const { body } = require("express-validator");

const { query } = require("../db/pool");
const { asyncHandler } = require("../middleware/error");
const { handleValidation } = require("../middleware/validate");
const { codeFromQrPayload } = require("../utils/shareCode");
const { decrypt } = require("../utils/crypto");

const router = express.Router();

// PUBLIC — no authentication. This is the healthcare-professional QR flow.
// POST /api/consult/resolve  { code, professionalName }
// Resolves a consultation code to its view-only snapshot and logs the access.
router.post(
    "/resolve",
    [body("code").notEmpty().withMessage("A consultation code is required")],
    handleValidation,
    asyncHandler(async (req, res) => {
        const code = codeFromQrPayload(req.body.code);
        if (!code) return res.status(400).json({ status: "invalid", error: "Unrecognized code" });

        const { rows } = await query("SELECT * FROM shared_records WHERE code = $1", [code]);
        const share = rows[0];
        if (!share) return res.status(404).json({ status: "notfound", error: "Code not found" });

        if (share.status === "revoked") {
            return res.status(410).json({ status: "revoked", error: "This code was revoked by the parent" });
        }
        const expired = share.status === "expired" || new Date(share.expiration_date) <= new Date();
        if (expired) {
            if (share.status !== "expired") {
                await query("UPDATE shared_records SET status = 'expired' WHERE id = $1", [share.id]);
            }
            return res.status(410).json({ status: "expired", error: "This code has expired" });
        }

        // Resolve the child's display name and record the access.
        const childRes = await query(
            "SELECT first_name, last_name FROM children WHERE id = $1",
            [share.child_id]
        );
        const child = childRes.rows[0] || {};
        const childName = [decrypt(child.first_name), decrypt(child.last_name)].filter(Boolean).join(" ");

        const professionalName = (req.body.professionalName || "").trim() || "Unnamed professional";
        await query(
            `INSERT INTO access_logs (share_id, child_id, code, professional_name, action)
             VALUES ($1, $2, $3, $4, $5)`,
            [share.id, share.child_id, share.code, professionalName, "Viewed shared records"]
        );

        res.json({
            status: "ok",
            childName,
            recordKeys: share.shared_record_keys,
            payload: share.payload,
            expiresAt: share.expiration_date,
        });
    })
);

module.exports = router;
