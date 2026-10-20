// Unit contracts only; no database, environment file or real records.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), express = require("express");
const read = file => fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
const resources = [], guards = [];
const router = { use(...args) { guards.push(args); } }, moduleRoutes = { exports: {} };
const auth = () => {}, owner = () => {};
new Function("require", "module", "exports", read("routes/records.routes.js"))(name => {
    if (name === "express") return { Router: () => router };
    if (name === "../middleware/error") return require("../src/middleware/error");
    if (name === "../middleware/auth") return { requireAuth: auth, requireChildOwnership: owner };
    if (name === "../utils/numericValidation") return require("../src/utils/numericValidation");
    if (name === "../utils/memoryFields") return require("../src/utils/memoryFields");
    if (name === "../utils/resource") return { createResourceRouter: config => { resources.push(config); return express.Router(); } };
    throw Error(name);
}, moduleRoutes, moduleRoutes.exports);
const resource = resources.find(r => r.path === "nutrition"), route = guards.find(r => r[0].endsWith("/nutrition"));
assert.deepEqual(route.slice(1,3), [auth,owner]); assert(resource.columns.includes("food_category"));
for (const category of [null, "fruits", "vegetables", "grains", "proteins", "dairy", "other"]) {
    resource.validate({ entry_type: "solid", food_introduced: "Food", food_category: category }, { isCreate: true });
    resource.validate({ food_category: category }, { isCreate: false });
}
resource.validate({ entry_type: "solid", food_introduced: "Legacy" }, { isCreate: true });
resource.validate({ notes: "Legacy update" }, { isCreate: false });
for (const value of ["Fruit", "", 42, {}, ["fruits"]]) assert.throws(() => resource.validate({ food_category: value }, { isCreate: false }), e => e.status === 400);
const migration = read("db/migrations/021_solid_food_category.sql"), schema = read("db/schema.sql");
assert(!/\bDROP\b|UPDATE |DELETE |INSERT |NOT NULL|DEFAULT /i.test(migration));
assert(migration.includes("ADD COLUMN IF NOT EXISTS food_category TEXT"));
assert(schema.includes("nutrition_food_category_check"));
assert(read("utils/snapshot.js").includes("food_introduced, food_category, reaction_severity"));
assert(!resource.encrypted.includes("food_category"));
assert(resource.encrypted.includes("food_introduced") && resource.encrypted.includes("reaction"));
assert(!/allerg/i.test(migration));
console.log("Solid food API contracts passed: optional category, enum validation, legacy requests, additive migration, snapshot field, ownership and existing encryption.");
