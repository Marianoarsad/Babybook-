const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
    decimalOnly,
    digitsOnly,
    measurementFractions,
    measurementParts,
    measurementValue,
    measurementWholeValues,
} = require("./numericInput.cjs");

assert.equal(digitsOnly("+63 (917) 123-4567"), "639171234567");
assert.equal(decimalOnly("12a.3-4"), "12.34");
assert.equal(decimalOnly("1.2.3"), "1.23");
assert.equal(decimalOnly(".5"), ".5");
assert.deepEqual(measurementParts("7.46", 0.3, 40), { whole: 7, fraction: 5 });
assert.deepEqual(measurementParts("", 0.3, 40), { whole: 0, fraction: 3 });
assert.deepEqual(measurementParts("", 0.3, 40, 3.2), { whole: 3, fraction: 2 });
assert.equal(measurementValue({ whole: 7, fraction: 5 }, 0.3, 40), "7.5");
assert.equal(measurementValue({ whole: null, fraction: 0 }, 0.3, 40), "");
assert.deepEqual(measurementFractions(0, 0.3, 40), [3, 4, 5, 6, 7, 8, 9]);
assert.deepEqual(measurementFractions(40, 0.3, 40), [0]);
assert.deepEqual(measurementWholeValues(20, 65).slice(0, 3), [20, 21, 22]);

const dateField = fs.readFileSync(path.join(__dirname, "../components/ui/DateField.js"), "utf8");
const growth = fs.readFileSync(path.join(__dirname, "../components/ui/GrowthModal.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../App.js"), "utf8");
const emptyChild = fs.readFileSync(path.join(__dirname, "../components/EmptyChild.js"), "utf8");
assert(dateField.includes("export function MeasurementField"));
assert(!dateField.includes('"Not recorded"'));
assert(dateField.includes('"Select measurement"'));
assert(dateField.includes('label="Clear"'));
assert(growth.includes("<MeasurementField"));
assert(emptyChild.includes("<MeasurementField"));
assert(!app.includes("Current Weight (kg)"));
assert(!app.includes("Current Height (cm)"));

console.log("Numeric input and measurement wheel checks passed.");
