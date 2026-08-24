// Who the account holder is to the child.
//
// One list, three consumers: the Create an Account form (Auth.js), Edit Profile
// and View Profile. Kept here rather than copied into each, for the reason
// recorded at the top of utils/dates.js -- near-identical constants copied into
// three screens is how they drift, and here a drift would mean a value the
// database's CHECK constraint rejects.
//
// THE KEYS MUST MATCH the CHECK in back-end/src/db/migrations/008_user_profile.sql
// and the RELATIONSHIPS array in back-end/src/routes/auth.routes.js. A key that
// exists here and not there is a 400 the parent cannot act on.
//
// This replaced a two-option toggle -- "Female (Mama)" / "Male (Papa)" -- that
// wrote users.gender. The app calls this person the Primary Guardian on every
// screen and then made them pick a gender to stand in for a relationship; in a
// Filipino household the record is very often held by a lola, a tita, or an
// older sibling, and there was no way to say so.
//
// It is a family role, NEVER a legal or custodial status, and nothing in the
// app may rank these or gate a feature on them. A grandparent holding the
// record has exactly the authority over it that a mother does.
export const RELATIONSHIPS = [
    { key: "mother", label: "Mother" },
    { key: "father", label: "Father" },
    { key: "grandparent", label: "Grandparent" },
    { key: "guardian", label: "Guardian" },
    { key: "other", label: "Other" },
];

export const RELATIONSHIP_KEYS = RELATIONSHIPS.map((r) => r.key);

// Display label for a stored key. Returns "" for null/unknown so callers can
// choose their own absence wording -- the app says "Not recorded", which is a
// different statement from a guess.
export function relationshipLabel(key) {
    const hit = RELATIONSHIPS.find((r) => r.key === key);
    return hit ? hit.label : "";
}

export function isRelationship(key) {
    return RELATIONSHIP_KEYS.includes(key);
}
