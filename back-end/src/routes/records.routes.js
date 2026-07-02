const express = require("express");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { createResourceRouter } = require("../utils/resource");

const router = express.Router();

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
        columns: ["feeding_type", "food_introduced", "reaction", "date_recorded", "notes"],
        orderBy: "date_recorded DESC NULLS LAST, id DESC",
    },
    {
        path: "reminders",
        table: "reminders",
        columns: ["reminder_type", "title", "reminder_date", "status", "vaccination_id", "checkup_id"],
        orderBy: "reminder_date ASC, id DESC",
    },
    // --- daily trackers ---
    {
        path: "feeds",
        table: "feed_logs",
        columns: ["feed_type", "amount_ml", "grams", "fed_at", "notes"],
        orderBy: "fed_at DESC, id DESC",
    },
    {
        path: "sleeps",
        table: "sleep_logs",
        columns: ["start_at", "end_at", "total_minutes"],
        orderBy: "start_at DESC, id DESC",
    },
    {
        path: "temperatures",
        table: "temperature_logs",
        columns: ["celsius", "taken_at", "notes"],
        orderBy: "taken_at DESC, id DESC",
    },
];

for (const r of RESOURCES) {
    router.use(
        `/:childId/${r.path}`,
        requireAuth,
        requireChildOwnership,
        createResourceRouter({ table: r.table, columns: r.columns, orderBy: r.orderBy })
    );
}

module.exports = router;
