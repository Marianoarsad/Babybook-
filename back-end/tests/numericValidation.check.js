const assert = require("node:assert/strict");
const { isNumberWithin } = require("../src/utils/numericValidation");

assert(isNumberWithin("7.5", { min: 0.3, max: 40, maxDecimals: 1 }));
assert(!isNumberWithin("7.55", { min: 0.3, max: 40, maxDecimals: 1 }));
assert(!isNumberWithin("12kg", { min: 0.3, max: 40 }));
assert(isNumberWithin("240", { min: 1, max: 240, integer: true }));
assert(!isNumberWithin("2.5", { min: 1, max: 240, integer: true }));
assert(!isNumberWithin("0", { min: 1 }));

console.log("Numeric API validation checks passed.");
