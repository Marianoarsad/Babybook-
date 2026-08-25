// Tap-to-fill shortcuts for the "What was it?" box on the Log an Illness form.
//
// READ THIS BEFORE CHANGING ANYTHING HERE.
//
// These are TYPING SHORTCUTS, in the words a parent would actually use. They
// are not a diagnosis list, not a differential, not a symptom checklist, and
// not sourced from the DOH, the WHO, PIDSP, or any clinical instrument. The
// app is not suggesting what the child has — the parent already knows what
// they are recording, and this only saves them spelling it out on a phone
// keyboard.
//
// Two rules that must survive any future edit:
//
//   1. NEVER add a sourcing claim to this file. PRODUCT.md lists "no clinic,
//      DOH, barangay, or health-centre partnership" among the absences that
//      must never be fabricated, and attaching an authority to this list would
//      invent exactly that. It is a convenience, and it should read like one.
//
//   2. NEVER let the list become the only way in. Free text is the primary
//      input and always must be — a real child's illness will eventually be
//      something nobody put in an array, and a parent must never be stuck
//      choosing the closest wrong option. PRODUCT.md Principle 5: the app
//      organizes and presents, it does not interpret or diagnose. A feature
//      that reads as medical judgment is a correctness bug.
//
// Contrast with two neighbours that look similar and are not:
//   • utils/milestoneChecklist.js IS sourced (CDC, 2022 revision) because it
//     makes a claim about child development. This file makes no claim at all.
//   • suggestedTitles() there offers only milestones NOT yet recorded, because
//     a milestone happens once. This file does the opposite, like the nutrition
//     form's food suggestions: illnesses recur, so what a child has had before
//     is the single most likely thing a parent is typing again.

// Plain-language names, roughly ordered by how often a parent of a young child
// would reach for them. Both the English and the everyday Filipino term are
// given where the Filipino one is what families actually say.
export const COMMON_CONDITIONS = [
    "Fever",
    "Cough",
    "Colds",
    "Sore throat",
    "Diarrhea",
    "Vomiting",
    "Rash",
    "Ear infection",
    "Stomach ache",
    "Flu",
    "Skin allergy",
    "Asthma",
    "Sore eyes",
    "Chickenpox (bulutong)",
    "Hand, foot and mouth disease",
    "Dengue",
    "Measles (tigdas)",
    "Pneumonia",
    "Constipation",
    "Urinary tract infection",
];

// Same normalization the milestone checklist uses: trim, collapse runs of
// whitespace, lowercase. Compare titles through this and never with `===`, or
// "Fever " and "fever" become two different conditions in the chip row.
export function normalizeTitle(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

// The chips to show under the "What was it?" box.
//
// `previous` is this child's own recorded conditions, newest first — pass the
// illness list straight in. Those come first because a child with recurring
// asthma logs it over and over, and PRODUCT.md Principle 4 says entry must be
// fast for the parent who has been doing this for years. Common ones then fill
// the remaining slots, skipping anything already offered.
//
// Capped rather than exhaustive: twenty chips is a wall of text under an input
// box, and the free-text field is right there.
export function suggestedConditions(previous = [], limit = 8) {
    const out = [];
    const seen = new Set();
    const push = (title) => {
        const key = normalizeTitle(title);
        if (!key || seen.has(key) || out.length >= limit) return;
        seen.add(key);
        out.push(String(title).trim().replace(/\s+/g, " "));
    };
    for (const p of previous) push(typeof p === "string" ? p : p && p.title);
    for (const c of COMMON_CONDITIONS) push(c);
    return out;
}
