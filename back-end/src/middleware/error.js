// Centralized error handling.

// Throw `new ApiError(status, message)` anywhere to produce a clean response.
class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function notFound(req, res, next) {
    res.status(404).json({ error: "Not found", path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    if (status >= 500) console.error("[error]", err);

    // Postgres unique-violation -> 409
    if (err.code === "23505") {
        return res.status(409).json({ error: "Resource already exists" });
    }
    // Postgres FK / check violations -> 400
    if (err.code === "23503" || err.code === "23514" || err.code === "22P02") {
        return res.status(400).json({ error: "Invalid request data" });
    }

    res.status(status).json({ error: err.message || "Server error" });
}

// Wrap async route handlers so thrown errors reach errorHandler.
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ApiError, notFound, errorHandler, asyncHandler };
