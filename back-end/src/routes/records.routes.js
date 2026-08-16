const express = require("express");
const { ApiError } = require("../middleware/error");
const { requireAuth, requireChildOwnership } = require("../middleware/auth");
const { createResourceRouter } = require("../utils/resource");

const router = express.Router();

const VALID_UNITS = ["oz", "mL", "L"];
const VALID_MILK = ["Formula", "Breastmilk", "Mixed"];
const VALID_METHODS = ["breast", "bottle"];
const VALID_SIDES = ["left", "right", "both"];
const VALID_SEVERITY = ["none", "mild", "severe"];

const blank = (v) => v === undefined || v === null || v === "";

// Reject anything outside a column's vocabulary. Runs on update as well as
// create — a bad enum is wrong whenever it arrives.
function checkEnum(value, allowed, message) {
    if (!blank(value) && !allowed.includes(value)) throw new ApiError(400, message);
}

// Nutrition validation. Branches on HOW the milk was given, not just on the
// entry type: a breastfeed has no measurable volume, so demanding a quantity
// for every milk row (as this did) left a parent feeding at the breast with
// no way to record it except by making a number up.
function validateNutrition(data, { isCreate }) {
    if (!blank(data.entry_type) && !["milk", "solid"].includes(data.entry_type)) {
        throw new ApiError(400, "entry_type must be 'milk' or 'solid'");
    }
    checkEnum(data.unit, VALID_UNITS, "Invalid unit — use oz, mL, or L");
    checkEnum(data.milk_type, VALID_MILK, "Invalid milk type");
    checkEnum(data.feed_method, VALID_METHODS, "Feed method must be 'breast' or 'bottle'");
    checkEnum(data.breast_side, VALID_SIDES, "Breast side must be 'left', 'right' or 'both'");
    checkEnum(data.reaction_severity, VALID_SEVERITY, "Reaction must be 'none', 'mild' or 'severe'");

    if (!blank(data.duration_minutes)) {
        const mins = Number(data.duration_minutes);
        if (!Number.isFinite(mins) || mins <= 0) throw new ApiError(400, "Duration must be greater than 0");
        if (mins > 240) throw new ApiError(400, "Duration must be 240 minutes or less");
    }
    if (!blank(data.quantity) && Number(data.quantity) <= 0) {
        throw new ApiError(400, "Quantity must be greater than 0");
    }

    if (!isCreate) return;

    const type = data.entry_type || "milk";
    if (type === "solid") {
        if (blank(data.food_introduced)) {
            throw new ApiError(400, "Food introduced is required for a solid-food entry");
        }
        return;
    }

    if (blank(data.milk_type)) throw new ApiError(400, "Milk type is required");
    if (data.feed_method === "breast") {
        // Duration is optional on purpose. A parent who fed at 3am and logs it
        // at 7am does not know whether it ran 12 minutes or 22, and demanding
        // a number would just move the original problem: instead of inventing
        // a volume they would invent a duration. That the feed happened, and
        // when, is the record — the minutes are a bonus. Range is still
        // enforced above for any value that IS given.
        if (!blank(data.quantity)) {
            throw new ApiError(400, "A breastfeed has no measured volume — remove the quantity");
        }
    } else {
        // 'bottle', or no method at all. The second case is what keeps
        // pre-migration clients and rows valid: they behave exactly as before.
        if (blank(data.quantity)) throw new ApiError(400, "Quantity is required");
        if (blank(data.unit)) throw new ApiError(400, "Unit is required");
    }
}

// Map each child-scoped collection to its table + writable columns.
const RESOURCES = [
    {
        path: "vaccinations",
        table: "vaccinations",
        // dose_number and reaction_severity stay OUT of `encrypted`: an integer
        // and a fixed vocabulary gain no privacy from encryption and would lose
        // the ability to be counted or filtered in SQL. `reaction` is free text
        // about a child's health, so it is encrypted like every other such field.
        columns: [
            "vaccine_name", "visit_name", "due_date", "date_given", "status", "notes",
            "dose_number", "reaction_severity", "reaction",
        ],
        orderBy: "COALESCE(date_given, due_date) DESC NULLS LAST, id DESC",
        encrypted: ["vaccine_name", "visit_name", "notes", "reaction"],
    },
    {
        path: "checkups",
        table: "checkups",
        columns: ["title", "checkup_date", "time_of_visit", "doctor_name", "clinic", "status", "notes"],
        orderBy: "checkup_date DESC NULLS LAST, id DESC",
        encrypted: ["title", "doctor_name", "clinic", "notes"],
    },
    {
        path: "medical-history",
        table: "medical_history",
        // resolved_date / care_level stay OUT of `encrypted`: a date and a
        // three-value vocabulary, where encryption buys no privacy and blocks
        // any future counting. `facility` is in, because it locates a real
        // family at a real place on a real date. Same call for the medication
        // fields: `dose_amount` and `prescribed_by` are free text and are
        // encrypted; the frequency, the course length, the times array and the
        // treats_id foreign key are not.
        columns: [
            "category",
            "title",
            "description",
            "date_recorded",
            "resolved",
            "resolved_date",
            "care_level",
            "facility",
            "notes",
            // Medication rows only (migration 006).
            "dose_amount",
            "frequency_per_day",
            "dose_times",
            "course_days",
            "prescribed_by",
            "treats_id",
        ],
        orderBy: "date_recorded DESC NULLS LAST, id DESC",
        encrypted: ["title", "description", "facility", "notes", "dose_amount", "prescribed_by"],
        // jsonb, and the client sends an array — see the note in pickBody.
        json: ["dose_times"],
    },
    {
        // One row per dose actually given. Kept separate from the medication
        // record for the same reason a feed is not stored on the child: it is
        // an event that happens many times, not a property of the thing.
        path: "medication-doses",
        table: "medication_doses",
        columns: ["medication_id", "given_date", "given_time", "notes"],
        orderBy: "given_date DESC, given_time DESC NULLS LAST, id DESC",
        encrypted: ["notes"],
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
        encrypted: ["title", "age_achieved", "description"],
        // A milestone can carry the parent's own photo, so its stored ref has
        // to be signed on the way out. The seed's external picsum URLs are not
        // storage refs and pass through resolveUrl() untouched.
        photoColumn: "photo_url",
    },
    {
        path: "nutrition",
        table: "nutrition_records",
        // feed_method / breast_side / reaction_severity are fixed-vocabulary
        // enums and duration_minutes is an integer, so none of them join the
        // `encrypted` list below — ciphertext on a three-value enum buys no
        // privacy and blocks aggregating in SQL later.
        columns: [
            "entry_type", "milk_type", "feed_method", "formula_brand", "quantity", "unit",
            "duration_minutes", "breast_side",
            "food_introduced", "reaction_severity", "reaction", "entry_date", "entry_time", "notes",
        ],
        orderBy: "entry_date DESC NULLS LAST, entry_time DESC NULLS LAST, id DESC",
        validate: validateNutrition,
        encrypted: ["formula_brand", "food_introduced", "reaction", "notes"],
    },
    {
        path: "reminders",
        table: "reminders",
        columns: ["reminder_type", "title", "reminder_date", "status", "vaccination_id", "checkup_id"],
        orderBy: "reminder_date ASC, id DESC",
        encrypted: ["title"],
    },
    {
        path: "calendar-events",
        table: "calendar_events",
        columns: ["title", "description", "event_type", "event_date", "event_time", "reminder_settings"],
        orderBy: "event_date ASC, id DESC",
        encrypted: ["title", "description"],
    },
];

for (const r of RESOURCES) {
    router.use(
        `/:childId/${r.path}`,
        requireAuth,
        requireChildOwnership,
        // Spread rather than listing keys — the old hand-copied list silently
        // dropped any new resource option (photoColumn was the first).
        createResourceRouter(r)
    );
}

module.exports = router;
