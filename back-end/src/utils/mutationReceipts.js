const { createHash } = require("node:crypto");
const { query, withTransaction } = require("../db/pool");
const { ApiError } = require("../middleware/error");

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, canonical(value[key])])
    );
    return value;
}
function operationKey(req) {
    const key = req.get("X-Operation-Key");
    if (key !== undefined && !/^[A-Za-z0-9_-]{1,64}$/.test(key)) throw new ApiError(400, "Invalid operation key");
    return key;
}
const scope = (req, resource, key) => [req.user.id, req.child.id, resource, key];
async function receiptRecord(req, resource, table, key, client = { query }) {
    const { rows } = await client.query(
        "SELECT * FROM mutation_receipts WHERE user_id=$1 AND child_id=$2 AND resource=$3 AND operation_key=$4", scope(req, resource, key)
    );
    if (!rows[0]) throw new ApiError(404, "Operation not found");
    const record = await client.query(`SELECT * FROM ${table} WHERE id=$1 AND child_id=$2`, [rows[0].record_id, req.child.id]);
    if (!record.rows[0]) throw new ApiError(410, "The original record was deleted");
    return { receipt: rows[0], record: record.rows[0] };
}
async function createOnce(req, resource, table, body, insert) {
    const key = operationKey(req);
    if (!key) return insert({ query });
    const hash = createHash("sha256").update(JSON.stringify(canonical(body))).digest("hex");
    return withTransaction(async (client) => {
        const claim = await client.query(
            `INSERT INTO mutation_receipts (user_id,child_id,resource,operation_key,payload_hash)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING operation_key`, [...scope(req, resource, key), hash]
        );
        if (!claim.rows.length) {
            const existing = await receiptRecord(req, resource, table, key, client);
            if (existing.receipt.payload_hash !== hash) throw new ApiError(409, "Operation key was used for a different submission");
            return existing.record;
        }
        const record = await insert(client);
        await client.query(
            "UPDATE mutation_receipts SET record_id=$5 WHERE user_id=$1 AND child_id=$2 AND resource=$3 AND operation_key=$4",
            [...scope(req, resource, key), record.id]
        );
        return record;
    });
}
module.exports = { canonical, operationKey, receiptRecord, createOnce };
