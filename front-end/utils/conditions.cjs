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

function conditionSummaries(records = [], allergies = [], hereditary = []) {
    const merged = mergeConditions(records, allergies, hereditary);
    return {
        allergies: merged.filter((record) => record.category === "Allergy").map((record) => record.title),
        hereditary: merged.filter((record) => record.category === "Hereditary Condition").map((record) => record.title),
    };
}

module.exports = {
    CONDITION_CATEGORIES,
    conditionAttachmentType,
    conditionKey,
    conditionSummaries,
    mergeConditions,
};
