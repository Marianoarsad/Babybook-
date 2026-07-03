const express = require("express");
const fs = require("fs");
const path = require("path");

const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { upload, publicUrlFor, UPLOAD_DIR } = require("../middleware/upload");

const router = express.Router();

// Record types that support a supporting photo/document.
const TYPES = new Set(["vaccination", "medication", "illness", "hospitalization", "checkup"]);

// All routes here are child-scoped and owner-guarded.
router.use("/:childId/attachments", requireAuth, requireChildOwnership);

// Remove the stored file for an attachment row (best-effort).
function unlinkFor(fileUrl) {
    if (fileUrl && fileUrl.includes("/uploads/")) {
        const filePath = path.join(UPLOAD_DIR, path.basename(fileUrl.split("/uploads/")[1]));
        fs.promises.unlink(filePath).catch(() => {});
    }
}

// GET /api/children/:childId/attachments
// Returns every attachment for the child; the app maps them by record_type + record_id.
router.get(
    "/:childId/attachments",
    asyncHandler(async (req, res) => {
        const { rows } = await query(
            "SELECT * FROM record_attachments WHERE child_id = $1 ORDER BY id DESC",
            [req.child.id]
        );
        res.json(rows);
    })
);

// POST /api/children/:childId/attachments  (multipart: photo + record_type + record_id)
// Creates or REPLACES the attachment for a given record (one image per record).
router.post(
    "/:childId/attachments",
    upload.single("photo"),
    asyncHandler(async (req, res) => {
        const { record_type, record_id } = req.body;
        if (!TYPES.has(record_type)) throw new ApiError(400, "Invalid record type");
        if (!record_id) throw new ApiError(400, "record_id is required");

        const fileUrl = req.file ? publicUrlFor(req.file.filename) : req.body.file_url;
        if (!fileUrl) throw new ApiError(400, "An image is required");

        // Replace any existing attachment for this record (remove old file first).
        const existing = await query(
            "SELECT * FROM record_attachments WHERE child_id = $1 AND record_type = $2 AND record_id = $3",
            [req.child.id, record_type, record_id]
        );
        for (const a of existing.rows) unlinkFor(a.file_url);
        await query(
            "DELETE FROM record_attachments WHERE child_id = $1 AND record_type = $2 AND record_id = $3",
            [req.child.id, record_type, record_id]
        );

        const { rows } = await query(
            `INSERT INTO record_attachments (child_id, record_type, record_id, file_url)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.child.id, record_type, record_id, fileUrl]
        );
        res.status(201).json(rows[0]);
    })
);

// DELETE /api/children/:childId/attachments/:id — remove row + stored file.
router.delete(
    "/:childId/attachments/:id",
    asyncHandler(async (req, res) => {
        const { rows } = await query(
            "SELECT * FROM record_attachments WHERE id = $1 AND child_id = $2",
            [req.params.id, req.child.id]
        );
        const att = rows[0];
        if (!att) throw new ApiError(404, "Attachment not found");
        await query("DELETE FROM record_attachments WHERE id = $1", [att.id]);
        unlinkFor(att.file_url);
        res.status(204).end();
    })
);

module.exports = router;
