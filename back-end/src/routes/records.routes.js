const express = require("express");
const { ApiError } = require("../middleware/error");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { createResourceRouter } = require("../utils/resource");

const router = express.Router();

const VALID_UNITS = ["oz", "mL", "L"];
const VALID_MILK = ["Formula", "Breastmilk", "Mixed"];

// Nutrition validation — reject invalid units and missing required fields.
function validateNutrition(data, { isCreate }) {
    if (data.entry_type !== undefined && !["milk", "solid"].includes(data.entry_type)) {
        throw new ApiError(400, "entry_type must be 'milk' or 'solid'");
    }
    if (data.unit !== undefined && data.unit !== null && data.unit !== "" && !VALID_UNITS.includes(data.unit)) {
        throw new ApiError(400, "Invalid unit — use oz, mL, or L");
    }
    if (data.milk_type !== undefined && data.milk_type !== null && data.milk_type !== "" && !VALID_MILK.includes(data.milk_type)) {
        throw new ApiError(400, "Invalid milk type");
    }
    if (isCreate) {
        const type = data.entry_type || "milk";
        if (type === "milk") {
            if (!data.milk_type) throw new ApiError(400, "Milk type is required");
            if (data.quantity === undefined || data.quantity === null || data.quantity === "")
                throw new ApiError(400, "Quantity is required");
            if (Number(data.quantity) <= 0) throw new ApiError(400, "Quantity must be greater than 0");
            if (!data.unit) throw new ApiError(400, "Unit is required");
        } else if (!data.food_introduced) {
            throw new ApiError(400, "Food introduced is required for a solid-food entry");
        }
    }
}

// Map each child-scoped collection to its table + writable columns.
const RESOURCES = [
    {
        path: "vaccinations",
        table: "vaccinations",
        columns: ["vaccine_name", "visit_name", "due_date", "date_given", "status", "notes"],
        orderBy: "COALESCE(date_given, due_date) DESC NULLS LAST, id DESC",
    },
    {
        path: "checkups",
        table: "checkups",
        columns: ["title", "checkup_date", "time_of_visit", "doctor_name", "clinic", "status", "notes"],
        orderBy: "checkup_date DESC NULLS LAST, id DESC",
    },
    {
        path: "medical-history",
        table: "medical_history",
        columns: ["category", "title", "description", "date_recorded", "resolved", "notes"],
        orderBy: "date_recorded DESC NULLS LAST, id DESC",
    },
    {
        path: "growth",
        table: "growth_records",
        columns: ["height", "weight", "head_circumference", "date_recorded"],
        orderBy: "date_recorded DESC, id DESC",
    },
    {
        path: "milestones",
        table: "milestones",
        columns: ["title", "age_achieved", "description", "date_recorded", "is_completed", "photo_url"],
        orderBy: "date_recorded DESC NULLS LAST, id DESC",
    },
    {
        path: "nutrition",
        table: "nutrition_records",
        columns: [
            "entry_type", "milk_type", "formula_brand", "quantity", "unit",
            "food_introduced", "reaction", "entry_date", "entry_time", "notes",
        ],
        orderBy: "entry_date DESC NULLS LAST, entry_time DESC NULLS LAST, id DESC",
        validate: validateNutrition,
    },
    {
        path: "reminders",
        table: "reminders",
        columns: ["reminder_type", "title", "reminder_date", "status", "vaccination_id", "checkup_id"],
        orderBy: "reminder_date ASC, id DESC",
    },
];

for (const r of RESOURCES) {
    router.use(
        `/:childId/${r.path}`,
        requireAuth,
        requireChildOwnership,
        createResourceRouter({ table: r.table, columns: r.columns, orderBy: r.orderBy, validate: r.validate })
    );
}

module.exports = router;
