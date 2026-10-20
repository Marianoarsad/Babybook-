const CONDITION_CATEGORIES = Object.freeze(["Illness", "Allergy", "Hereditary Condition"]);

const conditionKey = (category, title) =>
    `${category}:${String(title || "").trim().toLocaleLowerCase()}`;

function conditionAttachmentType(category) {
    if (category === "Allergy") return "allergy";
    if (category === "Hereditary Condition") return "hereditary";
    if (category === "Hospitalization") return "hospitalization";
    return "illness";
}

function mergeConditions(records = [], allergies = [], hereditary = []) {
    const detailed = records.filter((record) => CONDITION_CATEGORIES.includes(record.category));
    const seen = new Set(detailed.map((record) => conditionKey(record.category, record.title)));
    const legacy = [];
    for (const [category, values] of [["Allergy", allergies], ["Hereditary Condition", hereditary]]) {
        for (const title of Array.isArray(values) ? values : []) {
            const trimmed = String(title || "").trim();
            const key = conditionKey(category, trimmed);
            if (!trimmed || seen.has(key)) continue;
            seen.add(key);
            legacy.push({
                id: `legacy:${category}:${trimmed}`,
                category,
                title: trimmed,
                date: "",
                resolved: false,
                resolvedDate: "",
                careLevel: "",
                facility: "",
                desc: "",
                legacy: true,
            });
        }
    }
    return [...detailed, ...legacy];
}

function conditionsSummary(records = [], allergies = [], hereditary = []) {
    const merged = mergeConditions(records, allergies, hereditary);
    return { records: merged, counts: {
        all: merged.length,
        Illness: merged.filter(record => record.category === "Illness").length,
        Allergy: merged.filter(record => record.category === "Allergy").length,
        "Hereditary Condition": merged.filter(record => record.category === "Hereditary Condition").length,
    } };
}

function conditionSavedStatus(record) {
    if (record.legacy || typeof record.resolved !== "boolean") return "Not recorded";
    if (record.category === "Hereditary Condition") return "Recorded";
    if (record.category === "Allergy") return record.resolved ? "No longer active" : "Active";
    return record.resolved ? "Better" : "Ongoing";
}

function conditionSummaries(records = [], allergies = [], hereditary = []) {
    const merged = mergeConditions(records, allergies, hereditary);
    return {
        allergies: merged.filter((record) => record.category === "Allergy").map((record) => record.title),
        hereditary: merged.filter((record) => record.category === "Hereditary Condition").map((record) => record.title),
    };
}

module.exports = {
    CONDITION_CATEGORIES,
    conditionsSummary,
    conditionSavedStatus,
    conditionAttachmentType,
    conditionKey,
    conditionSummaries,
    mergeConditions,
};
