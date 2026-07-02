const { validationResult } = require("express-validator");

// Collects express-validator errors into a 422 response.
function handleValidation(req, res, next) {
    const result = validationResult(req);
    if (!result.isEmpty()) {
        return res.status(422).json({
            error: "Validation failed",
            details: result.array().map((e) => ({ field: e.path, message: e.msg })),
        });
    }
    next();
}

module.exports = { handleValidation };
