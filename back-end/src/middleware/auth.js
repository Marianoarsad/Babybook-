const { verifyToken } = require("../utils/jwt");
const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("./error");

// Requires a valid Bearer token; attaches req.user = { id, email }.
const requireAuth = asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new ApiError(401, "Authentication required");

    let decoded;
    try {
        decoded = verifyToken(token);
    } catch (e) {
        throw new ApiError(401, "Invalid or expired token");
    }

    const { rows } = await query(
        "SELECT id, full_name, email FROM users WHERE id = $1",
        [decoded.sub]
    );
    if (!rows[0]) throw new ApiError(401, "User no longer exists");
    req.user = rows[0];
    next();
});

// Ensures :childId belongs to the authenticated user; attaches req.child.
const requireChildOwnership = asyncHandler(async (req, res, next) => {
    const childId = parseInt(req.params.childId, 10);
    if (!Number.isInteger(childId)) throw new ApiError(400, "Invalid child id");

    const { rows } = await query(
        "SELECT * FROM children WHERE id = $1 AND user_id = $2",
        [childId, req.user.id]
    );
    if (!rows[0]) throw new ApiError(404, "Child not found");
    req.child = rows[0];
    next();
});

module.exports = { requireAuth, requireChildOwnership };
