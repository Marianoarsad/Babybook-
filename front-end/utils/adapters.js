// Maps between the backend's child shape (snake_case) and the app's profile
// shape (camelCase, gender as "girl"/"boy").

const GIRL_AVATAR =
    "https://images.unsplash.com/photo-1519689680058-324335c77eb2?q=80&w=300&auto=format&fit=crop";
const BOY_AVATAR =
    "https://images.unsplash.com/photo-1596870230751-ebdfce98ec42?q=80&w=300&auto=format&fit=crop";

function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
}

// Backend child row -> app profile object used throughout the UI.
export function childToProfile(c) {
    const isGirl = (c.sex || "").toLowerCase() !== "male" && (c.sex || "").toLowerCase() !== "boy";
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.first_name || "Baby";
    const birthWeight = num(c.birth_weight);
    const birthHeight = num(c.birth_length);
    return {
        id: String(c.id),
        name: fullName,
        firstName: c.first_name || "",
        lastName: c.last_name || "",
        nickname: c.nickname || "",
        placeOfBirth: c.place_of_birth || "",
        timeOfBirth: c.time_of_birth ? String(c.time_of_birth).slice(0, 5) : "",
        preferredHealthCenter: c.preferred_health_center || "",
        dateOfBirth: c.date_of_birth ? String(c.date_of_birth).slice(0, 10) : "",
        gender: isGirl ? "girl" : "boy",
        sex: c.sex || (isGirl ? "Female" : "Male"),
        bloodType: c.blood_type || "",
        birthWeight: birthWeight ?? 3.0,
        birthHeight: birthHeight ?? 49.0,
        hospital: c.hospital || "",
        obgynName: c.obgyne_name || "",
        pediatricianName: c.pediatrician_name || "",
        emergencyContact: c.emergency_contact || "",
        avatarUrl: c.avatar_url || (isGirl ? GIRL_AVATAR : BOY_AVATAR),
        allergies: Array.isArray(c.allergies) ? c.allergies : [],
        hereditaryConditions: Array.isArray(c.hereditary_conditions) ? c.hereditary_conditions : [],
        // Growth lives in its own table; fall back to birth values until loaded.
        currentHeight: birthHeight ?? 49.0,
        currentWeight: birthWeight ?? 3.0,
    };
}

// App add/edit form -> backend child body.
//   form: { name, dateOfBirth, gender ("girl"/"boy"), weight, height }
//   includeBirth: only send birth_weight/length when creating (avoid overwriting
//   birth data with "current" values on edit).
export function profileFormToChild(form, { includeBirth = true } = {}) {
    const parts = (form.name || "").trim().split(/\s+/);
    const first = parts.shift() || form.name || "Baby";
    const last = parts.join(" ");
    const body = {
        first_name: first,
        last_name: last || null,
        date_of_birth: form.dateOfBirth || null,
        sex: form.gender === "boy" ? "Male" : "Female",
    };
    if (includeBirth) {
        if (form.weight) body.birth_weight = num(form.weight);
        if (form.height) body.birth_length = num(form.height);
    }
    if (form.bloodType) body.blood_type = form.bloodType;
    if (form.hospital) body.hospital = form.hospital;
    if (form.pediatrician) body.pediatrician_name = form.pediatrician;
    if (form.obgyne) body.obgyne_name = form.obgyne;
    if (form.emergencyContact) body.emergency_contact = form.emergencyContact;
    if (form.nickname) body.nickname = form.nickname;
    if (form.placeOfBirth) body.place_of_birth = form.placeOfBirth;
    if (form.timeOfBirth) body.time_of_birth = form.timeOfBirth;
    if (form.preferredHealthCenter) body.preferred_health_center = form.preferredHealthCenter;
    if (form.avatarUrl) body.avatar_url = form.avatarUrl;
    return body;
}

// Backend nutrition_records row -> app nutrition entry (unified milk + solid).
//
// `feedMethod` falls back to "bottle" when the row records a volume, which is
// what every pre-migration milk row is. It stays "" when there's nothing to
// infer from, so "not recorded" never masquerades as a real answer.
export function nutritionToApp(n) {
    const quantity = n.quantity != null && n.quantity !== "" ? Number(n.quantity) : null;
    return {
        id: String(n.id),
        entryType: n.entry_type || "milk",
        milkType: n.milk_type || "",
        feedMethod: n.feed_method || (quantity != null ? "bottle" : ""),
        formulaBrand: n.formula_brand || "",
        quantity,
        unit: n.unit || "",
        durationMinutes: n.duration_minutes != null && n.duration_minutes !== "" ? Number(n.duration_minutes) : null,
        // breast_side is deliberately not surfaced — the form doesn't collect
        // it and nothing renders it. See the column comment in schema.sql.
        foodIntroduced: n.food_introduced || "",
        reactionSeverity: n.reaction_severity || "",
        reaction: n.reaction || "",
        date: n.entry_date ? String(n.entry_date).slice(0, 10) : "",
        time: n.entry_time ? String(n.entry_time).slice(0, 5) : "",
        notes: n.notes || "",
    };
}

// App nutrition form -> backend nutrition_records body.
//
// Every branch writes every field, nulling the ones that don't apply. Editing
// a bottle feed into a breastfeed has to clear the old volume, or the row ends
// up claiming both a quantity and a duration.
export function nutritionFormToRecord(form) {
    const body = { entry_type: form.entryType || "milk", notes: form.notes || null };
    if (form.date) body.entry_date = form.date;
    if (form.time) body.entry_time = form.time;
    if ((form.entryType || "milk") === "milk") {
        // Formula is by definition a bottle, so the form hides the choice.
        const method = form.milkType === "Formula" ? "bottle" : form.feedMethod || "bottle";
        body.milk_type = form.milkType || null;
        body.feed_method = method;
        body.food_introduced = null;
        body.reaction_severity = null;
        body.reaction = null;
        if (method === "breast") {
            // Duration is optional; blank saves as NULL rather than 0, so
            // "not recorded" and "a zero-minute feed" stay distinguishable.
            const mins = String(form.durationMinutes ?? "").trim();
            body.duration_minutes = mins === "" ? null : Number(mins);
            // The form no longer collects which breast — see the column
            // comment in schema.sql.
            body.breast_side = null;
            body.quantity = null;
            body.unit = null;
            body.formula_brand = null;
        } else {
            body.quantity = form.quantity === "" || form.quantity == null ? null : Number(form.quantity);
            body.unit = form.unit || null;
            body.formula_brand =
                form.milkType === "Formula" || form.milkType === "Mixed" ? form.formulaBrand || null : null;
            body.duration_minutes = null;
            body.breast_side = null;
        }
    } else {
        body.food_introduced = form.foodIntroduced || null;
        body.reaction_severity = form.reactionSeverity || null;
        // The description only means anything alongside an actual reaction.
        body.reaction = form.reactionSeverity && form.reactionSeverity !== "none" ? form.reaction || null : null;
        body.milk_type = null;
        body.feed_method = null;
        body.formula_brand = null;
        body.quantity = null;
        body.unit = null;
        body.duration_minutes = null;
        body.breast_side = null;
    }
    return body;
}

// Normalize a milk quantity to millilitres (for charting/comparison).
export function toMilliliters(quantity, unit) {
    if (quantity == null) return 0;
    if (unit === "oz") return quantity * 29.5735;
    if (unit === "L") return quantity * 1000;
    return quantity; // mL
}

// Volume of a single feed in mL. A breastfeed contributes none — there is no
// measured volume to contribute. Anything asking "did this child feed" must
// count entries rather than summing this, or a day of eight breastfeeds
// totals zero and reads as a day with no feeding at all.
export function feedVolumeMl(e) {
    if (!e || e.feedMethod === "breast") return 0;
    return toMilliliters(e.quantity, e.unit);
}

// One-line description of a RAW nutrition_records row, for the four places
// that render feeds without adapting them first: the Dashboard's Recent
// Activity, All Activity, the professional portal and the PDF export. All
// four had their own copy of the same template, all four built it from
// quantity alone, and all four therefore printed a bare milk type — or a
// literal "?" — for every feed given at the breast.
export function feedRowSummary(n) {
    if (!n) return "";
    if ((n.entry_type || "milk") !== "milk") {
        return `Solid food${n.food_introduced ? ` • ${n.food_introduced}` : ""}`;
    }
    const base = n.milk_type || "Milk";
    if (n.feed_method === "breast") {
        // Duration is optional, so "at the breast" is the fallback rather than
        // a bare milk type — the record still says what kind of feed it was.
        const mins = Number(n.duration_minutes);
        return Number.isFinite(mins) && mins > 0 ? `${base} • ${mins} min` : `${base} • at the breast`;
    }
    const qty = n.quantity != null && n.quantity !== "" ? Number(n.quantity) : null;
    return qty != null ? `${base} • ${qty} ${n.unit || "mL"}` : base;
}

// Backend checkup row -> app appointment shape (Growth appointments list).
export function checkupToApp(c) {
    return {
        id: String(c.id),
        title: c.title || "Checkup",
        provider: c.doctor_name || "",
        date: c.checkup_date ? String(c.checkup_date).slice(0, 10) : "",
        time: c.time_of_visit || "",
        notes: c.notes || "",
        isCompleted: c.status === "completed",
    };
}

// Backend milestone row -> app milestone shape (Growth checklist + Gallery).
//
// `ageAchieved` is the child's age when it happened. It was queried, encrypted,
// decrypted and shipped to the professional portal, then dropped on the floor
// here — so the one screen that renders it could only ever show blanks.
export function milestoneToApp(m) {
    return {
        id: String(m.id),
        title: m.title,
        isCompleted: !!m.is_completed,
        date: m.date_recorded ? String(m.date_recorded).slice(0, 10) : "",
        ageAchieved: m.age_achieved || "",
        description: m.description || "",
        photoUrl: m.photo_url || "",
    };
}

// Backend medical_history row (category Illness or Hospitalization) -> app shape.
//
// `resolvedDate` is when it ended — the day the child got better, or the day
// they were discharged. `resolved` on its own is a bare boolean the app could
// never set, so an illness recorded in March still claimed to be happening in
// August; the date is what makes "better now" and "better since the 16th" two
// different facts. `careLevel` and `facility` are new alongside it.
export function medHistoryToIllness(r) {
    return {
        id: String(r.id),
        title: r.title,
        date: r.date_recorded ? String(r.date_recorded).slice(0, 10) : "",
        resolved: !!r.resolved,
        resolvedDate: r.resolved_date ? String(r.resolved_date).slice(0, 10) : "",
        // "" means nobody answered, which is different from "at home" — the
        // app must not render an unanswered field as a recorded one.
        careLevel: r.care_level || "",
        facility: r.facility || "",
        desc: r.description || "",
    };
}

// Backend medical_history row (category Medication) -> app medication shape.
//
// The old version returned three fields and invented one of them: `duration`
// fell back to the string "As prescribed" whenever `notes` was empty — and the
// form never wrote `notes`, so every medicine a parent had ever recorded
// displayed a duration nobody entered. A blank field must read as "not
// recorded"; the UI decides how to say that, this function does not make it up.
export function medHistoryToMed(r) {
    return {
        id: String(r.id),
        title: r.title,
        // Started on / finished, shared with the illness shape (migration 005).
        date: r.date_recorded ? String(r.date_recorded).slice(0, 10) : "",
        resolved: !!r.resolved,
        resolvedDate: r.resolved_date ? String(r.resolved_date).slice(0, 10) : "",
        // How much per dose, exactly as it was typed. Never parsed or converted.
        doseAmount: r.dose_amount || "",
        frequencyPerDay:
            r.frequency_per_day != null && r.frequency_per_day !== "" ? Number(r.frequency_per_day) : null,
        // jsonb: normalized by doseTimesOf() in utils/medication.js, because a
        // driver or an older row can hand this back as a string or as null.
        doseTimes: r.dose_times ?? null,
        courseDays: r.course_days != null && r.course_days !== "" ? Number(r.course_days) : null,
        prescribedBy: r.prescribed_by || "",
        treatsId: r.treats_id != null ? String(r.treats_id) : "",
        // What the parent was told: "with food", "finish the whole course".
        instructions: r.description || "",
        notes: r.notes || "",
    };
}

// Backend medication_doses row -> app dose shape. One row per dose given.
export function medicationDoseToApp(d) {
    return {
        id: String(d.id),
        medicationId: String(d.medication_id),
        date: d.given_date ? String(d.given_date).slice(0, 10) : "",
        time: d.given_time ? String(d.given_time).slice(0, 5) : "",
        notes: d.notes || "",
    };
}

// Backend memory row -> app memory shape.
export function memoryToApp(m) {
    return {
        id: String(m.id),
        title: m.caption || "Memory",
        description: m.notes || "",
        date: m.date_recorded ? String(m.date_recorded).slice(0, 10) : "",
        photoUrl: m.photo_url || "",
    };
}

// Backend vaccination row -> app vaccine shape used by the Health screen.
export function vaccinationToApp(v) {
    return {
        id: String(v.id),
        vaccineName: v.vaccine_name,
        visitName: v.visit_name || "",
        dueDate: v.due_date ? String(v.due_date).slice(0, 10) : "",
        completedDate: v.date_given ? String(v.date_given).slice(0, 10) : undefined,
        isCompleted: v.status === "completed",
        notes: v.notes || "",
        isAutoGenerated: v.source === "epi",
        // Which dose in a series. Lived inside vaccine_name as a trailing digit
        // until migration 004; null on anything recorded before that.
        doseNumber: v.dose_number != null && v.dose_number !== "" ? Number(v.dose_number) : null,
        // What happened after the dose. "" means nobody recorded an answer,
        // which is a different fact from "none" — the app must not show them
        // the same way.
        reactionSeverity: v.reaction_severity || "",
        reaction: v.reaction || "",
    };
}
