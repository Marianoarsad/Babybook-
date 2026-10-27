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
const route = guards.find(r => r[0].endsWith("/milk-type-periods"));
assert.deepEqual(route.slice(1, 3), [auth, owner]);
assert(!resources.some(r => r.path === "milk-type-periods"));
let response, error;
route[3]({ method: "GET", path: "/" }, { json: value => response = value }, e => error = e);
assert.deepEqual(response, []);
for (const method of ["POST", "PUT", "DELETE"]) {
 route[3]({ method, path: "/" }, {}, e => error = e);
 assert.equal(error.status || error.statusCode, 410);
}
console.log("Retired milk period endpoint: auth/ownership preserved, empty reads, rejected mutations.");
