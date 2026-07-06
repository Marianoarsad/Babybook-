const express = require("express");
const fs = require("fs");
const path = require("path");

const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { upload, publicUrlFor, UPLOAD_DIR } = require("../middleware/upload");
const { encrypt, decryptRow } = require("../utils/crypto");

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
        res.json(rows.map((r) => decryptRow(r, MEM_ENCRYPTED)));
    })
);

// POST /api/children/:childId/memories  (multipart: photo + caption/notes/date_recorded)
router.post(
    "/:childId/memories",
    upload.single("photo"),
    asyncHandler(async (req, res) => {
        const photoUrl = req.file ? publicUrlFor(req.file.filename) : req.body.photo_url || null;
        const { caption, notes, date_recorded } = req.body;
        const { rows } = await query(
            `INSERT INTO memories (child_id, photo_url, caption, notes, date_recorded)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.child.id, photoUrl, encrypt(caption || null), encrypt(notes || null), date_recorded || null]
        );
        res.status(201).json(decryptRow(rows[0], MEM_ENCRYPTED));
    })
);

// DELETE /api/children/:childId/memories/:id — also removes the local file
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

        // Best-effort cleanup of the stored file.
        if (memory.photo_url && memory.photo_url.includes("/uploads/")) {
            const filename = memory.photo_url.split("/uploads/")[1];
            const filePath = path.join(UPLOAD_DIR, path.basename(filename));
            fs.promises.unlink(filePath).catch(() => {});
        }
        res.status(204).end();
    })
);

module.exports = router;
