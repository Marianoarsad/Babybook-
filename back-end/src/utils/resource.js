const express = require("express");
const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");

// Builds a child-scoped CRUD router for a simple record table.
//   table:   DB table name
//   columns: writable column names (snake_case) clients may set
//   orderBy: ORDER BY clause for list (default newest first)
//
// The returned router (mergeParams) expects req.child to be set by
// requireChildOwnership at mount time. All queries are parameterized and
// always constrained by child_id, so a user can only touch their own data.
function createResourceRouter({ table, columns, orderBy = "created_at DESC, id DESC", validate }) {
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
            res.json(rows);
        })
    );

    // CREATE
    router.post(
        "/",
        asyncHandler(async (req, res) => {
            const data = pickBody(req.body);
            if (validate) validate(data, { isCreate: true });
            const cols = Object.keys(data);
            const values = Object.values(data);
            const allCols = ["child_id", ...cols];
            const params = [req.child.id, ...values];
            const placeholders = allCols.map((_, i) => `$${i + 1}`).join(", ");
            const { rows } = await query(
                `INSERT INTO ${table} (${allCols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
                params
            );
            res.status(201).json(rows[0]);
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
            res.json(rows[0]);
        })
    );

    // UPDATE (partial)
    router.put(
        "/:id",
        asyncHandler(async (req, res) => {
            const data = pickBody(req.body);
            if (validate) validate(data, { isCreate: false });
            const cols = Object.keys(data);
            if (cols.length === 0) throw new ApiError(400, "No updatable fields provided");
            const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
            const params = [...Object.values(data), req.params.id, req.child.id];
            const { rows } = await query(
                `UPDATE ${table} SET ${setClause} WHERE id = $${cols.length + 1} AND child_id = $${cols.length + 2} RETURNING *`,
                params
            );
            if (!rows[0]) throw new ApiError(404, "Record not found");
            res.json(rows[0]);
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
