const express = require("express");

const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { upload, extOf } = require("../middleware/upload");
const storage = require("../utils/storage");

const router = express.Router();

// Record types that support a supporting photo/document.
const TYPES = new Set(["vaccination", "medication", "illness", "hospitalization", "checkup"]);

// All routes here are child-scoped and owner-guarded.
router.use("/:childId/attachments", requireAuth, requireChildOwnership);

// GET /api/children/:childId/attachments
// Returns every attachment for the child; the app maps them by record_type + record_id.
router.get(
    "/:childId/attachments",
    asyncHandler(async (req, res) => {
        const { rows } = await query(
            "SELECT * FROM record_attachments WHERE child_id = $1 ORDER BY id DESC",
            [req.child.id]
        );
        res.json(await storage.resolveUrlField(rows, "file_url"));
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

        const fileRef = req.file
            ? await storage.uploadFile(req.file.buffer, req.file.mimetype, extOf(req.file))
            : req.body.file_url;
        if (!fileRef) throw new ApiError(400, "An image is required");

        // Replace any existing attachment for this record (remove old file first).
        const existing = await query(
            "SELECT * FROM record_attachments WHERE child_id = $1 AND record_type = $2 AND record_id = $3",
            [req.child.id, record_type, record_id]
        );
        for (const a of existing.rows) await storage.deleteFile(a.file_url);
        await query(
            "DELETE FROM record_attachments WHERE child_id = $1 AND record_type = $2 AND record_id = $3",
            [req.child.id, record_type, record_id]
        );

        const { rows } = await query(
            `INSERT INTO record_attachments (child_id, record_type, record_id, file_url)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.child.id, record_type, record_id, fileRef]
        );
        const [resolved] = await storage.resolveUrlField(rows, "file_url");
        res.status(201).json(resolved);
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
        await storage.deleteFile(att.file_url);
        res.status(204).end();
    })
);

module.exports = router;
