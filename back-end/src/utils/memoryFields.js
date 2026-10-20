const { ApiError } = require("../middleware/error");

function validateMemoryFields(data, milestone = false) {
    const title = milestone ? "title" : "caption";
    for (const field of [title, milestone ? "description" : "notes", ...(milestone ? ["age_achieved"] : [])]) {
        if (data[field] != null && typeof data[field] !== "string") throw new ApiError(400, `${field} must be text`);
    }
    if (Object.hasOwn(data, title) && (typeof data[title] !== "string" || !data[title].trim())) throw new ApiError(400, "A title is required");
    if (data.date_recorded != null) {
        const value = data.date_recorded;
        const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
        if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ApiError(400, "A valid record date is required");
    }
    if (Object.hasOwn(data, "is_favorite") && typeof data.is_favorite !== "boolean") throw new ApiError(400, "is_favorite must be a boolean");
}

module.exports = { validateMemoryFields };
