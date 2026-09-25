function digitsOnly(value) {
    return String(value ?? "").replace(/\D/g, "");
}

function decimalOnly(value, fractionDigits = 2) {
    const text = String(value ?? "");
    const dot = text.indexOf(".");
    const wholeSource = dot === -1 ? text : text.slice(0, dot);
    const fractionSource = dot === -1 ? "" : text.slice(dot + 1);
    const whole = digitsOnly(wholeSource);
    if (dot === -1) return whole;
    return `${whole}.${digitsOnly(fractionSource).slice(0, fractionDigits)}`;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function measurementParts(value, min, max, fallback = min) {
    if (value === "" || value === null || value === undefined) {
        return measurementParts(fallback, min, max, min);
    }
    const number = Number(value);
    if (!Number.isFinite(number)) return measurementParts(fallback, min, max, min);
    const rounded = clamp(Math.round((number + Number.EPSILON) * 10) / 10, min, max);
    const whole = Math.floor(rounded);
    return { whole, fraction: Math.round((rounded - whole) * 10) };
}

function measurementWholeValues(min, max) {
    const first = Math.floor(min);
    const last = Math.floor(max);
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function measurementFractions(whole, min, max) {
    return Array.from({ length: 10 }, (_, fraction) => fraction)
        .filter((fraction) => {
            const value = whole + fraction / 10;
            return value >= min && value <= max;
        });
}

function measurementValue(parts, min, max) {
    if (parts?.whole === null || parts?.whole === undefined) return "";
    const value = clamp(Number(parts.whole) + Number(parts.fraction || 0) / 10, min, max);
    return value.toFixed(1);
}

module.exports = {
    decimalOnly,
    digitsOnly,
    measurementFractions,
    measurementParts,
    measurementValue,
    measurementWholeValues,
};
