const express = require("express");

const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { upload, extOf } = require("../middleware/upload");
const { encrypt, decryptRow } = require("../utils/crypto");
const storage = require("../utils/storage");
const { createOnce, receiptRecord } = require("../utils/mutationReceipts");
const { validateMemoryFields } = require("../utils/memoryFields");

const MEM_ENCRYPTED = ["caption", "notes"];

const router = express.Router();

// All routes here are child-scoped and owner-guarded.
router.use("/:childId/memories", requireAuth, requireChildOwnership);

// GET /api/children/:childId/memories
router.get(
    "/:childId/memories",
    asyncHandler(async (req, res) => {
        const { rows } = await query(
            "SELECT * FROM memories WHERE child_id = $1 ORDER BY date_recorded DESC NULLS LAST, id DESC",
            [req.child.id]
        );
        const resolved = await storage.resolveUrlField(rows, "photo_url");
        res.json(resolved.map((r) => decryptRow(r, MEM_ENCRYPTED)));
    })
);

// POST /api/children/:childId/memories  (multipart: photo + caption/notes/date_recorded)
router.post(
    "/:childId/memories",
    upload.single("photo"),
    asyncHandler(async (req, res) => {
        const photoRef = req.file
            ? await storage.uploadFile(req.file.buffer, req.file.mimetype, extOf(req.file))
            : req.body.photo_url || null;
        const { caption, notes, date_recorded } = req.body;
        const record = await createOnce(req, "memories", "memories", { photo_url: photoRef, caption, notes, date_recorded }, async (client) => {
        const { rows } = await client.query(
            `INSERT INTO memories (child_id, photo_url, caption, notes, date_recorded)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.child.id, photoRef, encrypt(caption || null), encrypt(notes || null), date_recorded || null]
        );
        return rows[0];
        });
        const [resolved] = await storage.resolveUrlField([record], "photo_url");
        res.status(201).json(decryptRow(resolved, MEM_ENCRYPTED));
    })
);

router.get("/:childId/memories/operations/:key", asyncHandler(async (req, res) => {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(req.params.key)) throw new ApiError(400, "Invalid operation key");
    const { record } = await receiptRecord(req, "memories", "memories", req.params.key);
    const [resolved] = await storage.resolveUrlField([record], "photo_url");
    res.json(decryptRow(resolved, MEM_ENCRYPTED));
}));

// DELETE /api/children/:childId/memories/:id — also removes the stored file
router.delete(
    "/:childId/memories/:id",
    asyncHandler(async (req, res) => {
        const { rows } = await query(
            "SELECT * FROM memories WHERE id = $1 AND child_id = $2",
            [req.params.id, req.child.id]
        );
        const memory = rows[0];
        if (!memory) throw new ApiError(404, "Memory not found");

        await query("DELETE FROM memories WHERE id = $1", [memory.id]);
        await storage.deleteFile(memory.photo_url);
        res.status(204).end();
    })
);

// Metadata-only updates preserve the original storage reference and image bytes.
router.put("/:childId/memories/:id", asyncHandler(async (req, res) => {
    const fields = ["caption", "notes", "date_recorded", "is_favorite"].filter(key => Object.hasOwn(req.body, key));
    if (!fields.length) throw new ApiError(400, "No editable fields supplied");
    validateMemoryFields(req.body);
    const values = fields.map(key => MEM_ENCRYPTED.includes(key) ? encrypt(req.body[key]) : req.body[key]);
    const { rows } = await query(
        `UPDATE memories SET ${fields.map((key, i) => `${key} = $${i + 1}`).join(", ")} WHERE id = $${fields.length + 1} AND child_id = $${fields.length + 2} RETURNING *`,
        [...values, req.params.id, req.child.id]
    );
    if (!rows[0]) throw new ApiError(404, "Memory not found");
    const [resolved] = await storage.resolveUrlField(rows, "photo_url");
    res.json(decryptRow(resolved, MEM_ENCRYPTED));
}));

module.exports = router;
