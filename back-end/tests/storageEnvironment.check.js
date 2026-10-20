const assert = require("node:assert/strict");
const { assertStorageEnvironment } = require("../src/utils/storage");
const production = "https://icssxprtxspcgmkompdj.supabase.co";
const development = "https://yrkvntaqkikuofbpfmkh.supabase.co";
for (const NODE_ENV of [undefined, "development", "test", "staging"]) {
    assert.throws(() => assertStorageEnvironment(production, { NODE_ENV, DATABASE_URL: "postgres://example:example@remote.invalid/postgres" }), /Production Storage is blocked/);
}
for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.throws(() => assertStorageEnvironment(production, { NODE_ENV: "production", DATABASE_URL: `postgres://example:example@${host}/babybook` }), /Production Storage is blocked/);
}
assert.throws(() => assertStorageEnvironment(production, { NODE_ENV: "production" }), /Production Storage is blocked/);
assert.doesNotThrow(() => assertStorageEnvironment(production, { NODE_ENV: "production", DATABASE_URL: "postgres://example:example@remote.invalid/postgres" }));
assert.doesNotThrow(() => assertStorageEnvironment(development, { NODE_ENV: "development", PGHOST: "localhost" }));
assert.doesNotThrow(() => assertStorageEnvironment("http://127.0.0.1:9", { NODE_ENV: "test" }));
console.log("Storage environment guards passed (no network or database writes).");
