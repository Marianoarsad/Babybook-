const express = require("express");
const { query } = require("../db/pool");
const { ApiError, asyncHandler } = require("../middleware/error");
const { upload, extOf } = require("../middleware/upload");
const { encryptFields, decryptRow } = require("./crypto");
const storage = require("./storage");

// Builds a child-scoped CRUD router for a simple record table.
//   table:       DB table name
//   columns:     writable column names (snake_case) clients may set
//   orderBy:     ORDER BY clause for list (default newest first)
//   validate:    optional (data, { isCreate }) => void, throws on invalid input
//   encrypted:   column names to encrypt at rest (decrypted on the way out)
//   photoColumn: column holding a storage ref. Setting it does the three
//                things memories.routes.js does by hand: CREATE accepts a
//                multipart photo, every response resolves the ref to a
//                short-lived signed URL, and DELETE removes the stored file.
//                Without it a stored "sb://<key>" would reach the app raw and
//                render as a broken tile.
//   photoField:  multipart field name carrying that photo (default "photo")
//
// The returned router (mergeParams) expects req.child to be set by
// requireChildOwnership at mount time. All queries are parameterized and
// always constrained by child_id, so a user can only touch their own data.
function createResourceRouter({
    table,
    columns,
    orderBy = "created_at DESC, id DESC",
    validate,
    encrypted = [],
    json = [],
    photoColumn = null,
    photoField = "photo",
}) {
    const router = express.Router({ mergeParams: true });

    const pickBody = (body) => {
        const out = {};
        for (const col of columns) {
            if (body[col] === undefined) continue;
            // node-postgres serializes a plain object to JSON but turns a JS
            // ARRAY into a Postgres array literal ({a,b}), which a jsonb column
            // rejects outright — "invalid input syntax for type json". Columns
            // declared here are stringified so an array reaches jsonb as JSON.
            // null stays null rather than becoming the string "null".
            out[col] =
                json.includes(col) && body[col] !== null && typeof body[col] === "object"
                    ? JSON.stringify(body[col])
                    : body[col];
        }
        return out;
    };

    // Decrypt, then swap any stored ref for a signed URL. A resource with no
    // photoColumn skips the storage round-trip entirely.
    const present = async (rows) => {
        const decrypted = rows.map((r) => decryptRow(r, encrypted));
        return photoColumn ? storage.resolveUrlField(decrypted, photoColumn) : decrypted;
    };
    const presentOne = async (row) => (await present([row]))[0];

    // multer passes non-multipart requests straight through, so mounting this
    // does not disturb the ordinary JSON create.
    const acceptPhoto = photoColumn ? [upload.single(photoField)] : [];

    // LIST
    router.get(
        "/",
        asyncHandler(async (req, res) => {
            const { rows } = await query(
                `SELECT * FROM ${table} WHERE child_id = $1 ORDER BY ${orderBy}`,
                [req.child.id]
            );
            res.json(await present(rows));
        })
    );

    // CREATE
    router.post(
        "/",
        ...acceptPhoto,
        asyncHandler(async (req, res) => {
            const data = pickBody(req.body);
            // A multipart create carries the file itself; the resulting ref
            // wins over any photo URL the same body also sent.
            if (photoColumn && req.file) {
                data[photoColumn] = await storage.uploadFile(
                    req.file.buffer,
                    req.file.mimetype,
                    extOf(req.file)
                );
            }
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
            res.status(201).json(await presentOne(rows[0]));
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
            res.json(await presentOne(rows[0]));
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
            res.json(await presentOne(rows[0]));
        })
    );

    // DELETE — RETURNING gives us the stored ref to clean up in one query.
    router.delete(
        "/:id",
        asyncHandler(async (req, res) => {
            const { rows } = await query(
                `DELETE FROM ${table} WHERE id = $1 AND child_id = $2 RETURNING *`,
                [req.params.id, req.child.id]
            );
            if (!rows[0]) throw new ApiError(404, "Record not found");
            // Best-effort, like memories.routes.js — a failed file delete must
            // not fail a request whose row is already gone.
            if (photoColumn) await storage.deleteFile(rows[0][photoColumn]);
            res.status(204).end();
        })
    );

    return router;
}

module.exports = { createResourceRouter };
