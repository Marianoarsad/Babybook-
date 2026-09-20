const fs = require("fs");
const path = require("path");
const assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "pickers.js"), "utf8").replace(/export function/g, "function");
const { selectableMonths, timeParts, timeValue } = new Function(`${src}\nreturn { selectableMonths, timeParts, timeValue };`)();

assert.deepStrictEqual(timeParts("00:05"), { period: "AM", hour: 12, minute: 5 });
assert.deepStrictEqual(timeParts("13:47"), { period: "PM", hour: 1, minute: 47 });
assert.strictEqual(timeValue({ period: "PM", hour: 12, minute: 3 }), "12:03");
assert.strictEqual(timeValue({ period: "AM", hour: 12, minute: 3 }), "00:03");
assert.deepStrictEqual(selectableMonths(2026, new Date(2026, 8, 15)), [8, 9, 10, 11]);
assert.deepStrictEqual(selectableMonths(2025, new Date(2026, 8, 15)), []);
console.log("picker helpers: ok");
