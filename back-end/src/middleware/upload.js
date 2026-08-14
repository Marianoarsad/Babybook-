const path = require("path");
const multer = require("multer");
const { ApiError } = require("./error");

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"]);

function fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext)) return cb(new ApiError(400, "Unsupported image type"));
    cb(null, true);
}

// Buffered in memory, nothing written to local disk — the buffer goes
// straight to Supabase Storage (see utils/storage.js). Render's disk is
// ephemeral, so anything written there was lost on every redeploy anyway.
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// The extension (without the dot) a route should pass to storage.uploadFile,
// derived from the uploaded file's own name.
function extOf(file) {
    return path.extname(file.originalname).replace(/^\./, "").toLowerCase();
}

module.exports = { upload, extOf };
