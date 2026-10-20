// Run: node utils/search.check.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "search.js"), "utf8").replace(/export function/g, "function");
const { addRecentSearch, searchSuggestions } = new Function(`${src}\nreturn { addRecentSearch, searchSuggestions };`)();

assert.deepStrictEqual(addRecentSearch(["Checkup", "MMR"], "  mmr  "), ["mmr", "Checkup"]);
assert.deepStrictEqual(addRecentSearch([], "   "), []);
assert.deepStrictEqual(addRecentSearch(["a", "b", "c"], "d", 3), ["d", "a", "b"]);
assert.deepStrictEqual(
    searchSuggestions([{ title: "MMR", date: "2026-01-01" }, { title: "mmr", date: "2025-01-01" }], ["Vaccines"], 8),
    ["MMR", "Vaccines"],
);
console.log("search helpers: ok");
