const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { ApiError } = require("./error");

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = `mem_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, name);
    },
});

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"]);

function fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext)) return cb(new ApiError(400, "Unsupported image type"));
    cb(null, true);
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Build the public URL the app uses to load the photo.
function publicUrlFor(filename) {
    const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
    return `${base}/uploads/${filename}`;
}

module.exports = { upload, publicUrlFor, UPLOAD_DIR };
