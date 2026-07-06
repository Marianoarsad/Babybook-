const express = require("express");
const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { encryptFields, decryptRow } = require("./crypto");

// Builds a child-scoped CRUD router for a simple record table.
//   table:     DB table name
//   columns:   writable column names (snake_case) clients may set
//   orderBy:   ORDER BY clause for list (default newest first)
//   validate:  optional (data, { isCreate }) => void, throws on invalid input
//   encrypted: column names to encrypt at rest (decrypted on the way out)
//
// The returned router (mergeParams) expects req.child to be set by
// requireChildOwnership at mount time. All queries are parameterized and
// always constrained by child_id, so a user can only touch their own data.
function createResourceRouter({ table, columns, orderBy = "created_at DESC, id DESC", validate, encrypted = [] }) {
    const router = express.Router({ mergeParams: true });

    const pickBody = (body) => {
        const out = {};
        for (const col of columns) {
            if (body[col] !== undefined) out[col] = body[col];
        }
        return out;
    };

    // LIST
    router.get(
        "/",
        asyncHandler(async (req, res) => {
            const { rows } = await query(
                `SELECT * FROM ${table} WHERE child_id = $1 ORDER BY ${orderBy}`,
                [req.child.id]
            );
            res.json(rows.map((r) => decryptRow(r, encrypted)));
        })
    );

    // CREATE
    router.post(
        "/",
        asyncHandler(async (req, res) => {
            const data = pickBody(req.body);
            if (validate) validate(data, { isCreate: true });
            const encData = encrypted.length ? encryptFields(data, encrypted) : data;
            const cols = Object.keys(encData);
            const values = Object.values(encData);
            const allCols = ["child_id", ...cols];
            const params = [req.child.id, ...values];
            const placeholders = allCols.map((_, i) => `$${i + 1}`).join(", ");
            const { rows } = await query(
                `INSERT INTO ${table} (${allCols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
                params
            );
            res.status(201).json(decryptRow(rows[0], encrypted));
        })
    );

    // READ ONE
    router.get(
        "/:id",
        asyncHandler(async (req, res) => {
            const { rows } = await query(
                `SELECT * FROM ${table} WHERE id = $1 AND child_id = $2`,
                [req.params.id, req.child.id]
            );
            if (!rows[0]) throw new ApiError(404, "Record not found");
            res.json(decryptRow(rows[0], encrypted));
        })
    );

    // UPDATE (partial)
    router.put(
        "/:id",
        asyncHandler(async (req, res) => {
            const data = pickBody(req.body);
            if (validate) validate(data, { isCreate: false });
            const encData = encrypted.length ? encryptFields(data, encrypted) : data;
            const cols = Object.keys(encData);
            if (cols.length === 0) throw new ApiError(400, "No updatable fields provided");
            const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
            const params = [...Object.values(encData), req.params.id, req.child.id];
            const { rows } = await query(
                `UPDATE ${table} SET ${setClause} WHERE id = $${cols.length + 1} AND child_id = $${cols.length + 2} RETURNING *`,
                params
            );
            if (!rows[0]) throw new ApiError(404, "Record not found");
            res.json(decryptRow(rows[0], encrypted));
        })
    );

    // DELETE
    router.delete(
        "/:id",
        asyncHandler(async (req, res) => {
            const { rowCount } = await query(
                `DELETE FROM ${table} WHERE id = $1 AND child_id = $2`,
                [req.params.id, req.child.id]
            );
            if (rowCount === 0) throw new ApiError(404, "Record not found");
            res.status(204).end();
        })
    );

    return router;
}

module.exports = { createResourceRouter };
