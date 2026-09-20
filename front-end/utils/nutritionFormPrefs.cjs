const FORMULA_SCOOPS_MAX = 999.99;

function isFormulaScoopsValue(value) {
    const number = Number(value);
    return value !== "" && value !== "." && Number.isFinite(number) && number > 0 && number <= FORMULA_SCOOPS_MAX;
}

function isFormulaScoopsDraft(value) {
    const text = String(value ?? "");
    if (!/^\d{0,3}(?:\.\d{0,2})?$/.test(text)) return false;
    return text === "" || text === "." || Number(text) <= FORMULA_SCOOPS_MAX;
}

function formulaScoopsOrDefault(value) {
    return isFormulaScoopsValue(value) ? String(value) : "1";
}

function canStepFormulaScoops(value, direction) {
    if (direction > 0 && !isFormulaScoopsValue(value)) return true;
    if (!isFormulaScoopsValue(value)) return false;
    const next = Number(value) + direction;
    return next > 0 && next <= FORMULA_SCOOPS_MAX;
}

function stepFormulaScoops(value, direction) {
    if (!canStepFormulaScoops(value, direction)) return String(value ?? "");
    if (!isFormulaScoopsValue(value)) return "1";
    return String(Math.round((Number(value) + direction) * 100) / 100);
}

function parseObject(raw) {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw);
        return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    } catch (_) {
        return null;
    }
}

function parseNutritionPrefs(scopedRaw, legacyRaw) {
    const scoped = parseObject(scopedRaw);
    return {
        milk: scoped?.milk || parseObject(legacyRaw),
        solid: scoped?.solid || null,
    };
}

function nutritionFormDefaults(prefs, entryType, date, time) {
    const recent = prefs?.[entryType] || {};
    const milkType = recent.milkType || "Breastmilk";
    const usesFormula = milkType === "Formula" || milkType === "Mixed";
    return {
        entryType,
        milkType,
        feedMethod:
            usesFormula
                ? "bottle"
                : recent.feedMethod || "breast",
        formulaBrand: recent.formulaBrand || "",
        formulaScoops: usesFormula ? formulaScoopsOrDefault(recent.formulaScoops) : recent.formulaScoops || "",
        quantity: recent.quantity || "",
        breastmilkQuantity: recent.breastmilkQuantity || "",
        unit: recent.unit || "mL",
        durationMinutes: recent.durationMinutes || "",
        foodIntroduced: recent.foodIntroduced || "",
        reactionSeverity: recent.reactionSeverity || "none",
        reaction: recent.reaction || "",
        date,
        time,
        notes: recent.notes || "",
    };
}

function recentNutritionFields(form) {
    if (form.entryType === "solid") {
        return {
            foodIntroduced: form.foodIntroduced,
            reactionSeverity: form.reactionSeverity,
            reaction: form.reaction,
            notes: form.notes,
        };
    }
    return {
        milkType: form.milkType,
        feedMethod:
            form.milkType === "Formula" || form.milkType === "Mixed"
                ? "bottle"
                : form.feedMethod,
        formulaBrand: form.formulaBrand,
        formulaScoops: form.formulaScoops,
        quantity: form.quantity,
        breastmilkQuantity: form.breastmilkQuantity,
        unit: form.unit,
        durationMinutes: form.durationMinutes,
        notes: form.notes,
    };
}

module.exports = {
    canStepFormulaScoops,
    formulaScoopsOrDefault,
    isFormulaScoopsDraft,
    isFormulaScoopsValue,
    nutritionFormDefaults,
    parseNutritionPrefs,
    recentNutritionFields,
    stepFormulaScoops,
};
