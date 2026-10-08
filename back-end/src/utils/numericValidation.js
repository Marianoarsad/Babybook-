function isNumberWithin(value, { min, max, integer = false, maxDecimals } = {}) {
    if (value === "" || value === null || value === undefined) return false;
    const text = String(value);
    if (!/^(?:\d+|\d*\.\d+)$/.test(text)) return false;
    if (maxDecimals !== undefined && text.includes(".") && text.split(".")[1].length > maxDecimals) return false;
    const number = Number(text);
    if (!Number.isFinite(number) || (integer && !Number.isInteger(number))) return false;
    if (min !== undefined && number < min) return false;
    if (max !== undefined && number > max) return false;
    return true;
}

module.exports = { isNumberWithin };
