const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { requireAuth, requireChildOwnership } = require('../middleware/auth');
const { ApiError, asyncHandler } = require('../middleware/error');
const { syncInbox, presentNotification } = require('../utils/notificationInbox');
const router = express.Router();
router.use('/:childId/notifications', requireAuth, (req, res, next) => {
    if (!/^[1-9]\d*$/.test(req.params.childId) || Number(req.params.childId) > 2147483647) return next(new ApiError(400, 'Invalid child id'));
    next();
}, requireChildOwnership);

router.post('/:childId/notifications/sync', asyncHandler(async (req, res) => {
    let zone = req.body?.timeZone || 'Asia/Manila';
    if (typeof zone !== 'string' || zone.length > 100) throw new ApiError(400, 'Invalid time zone');
    try { zone = new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone; }
    catch (_) { throw new ApiError(400, 'Invalid time zone'); }
    res.json(await withTransaction((client) => syncInbox(client, req.child.id, zone)));
}));

router.get('/:childId/notifications', asyncHandler(async (req, res) => {
    const filter = req.query.filter || 'all';
    if (!['all', 'unread'].includes(filter)) throw new ApiError(400, 'Invalid notification filter');
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400, 'Invalid page size');
    let cursor = null;
    if (req.query.cursor) {
        if (typeof req.query.cursor !== 'string' || req.query.cursor.length > 256) throw new ApiError(400, 'Invalid notification cursor');
        try { cursor = JSON.parse(Buffer.from(String(req.query.cursor), 'base64url').toString('utf8')); }
        catch (_) { throw new ApiError(400, 'Invalid notification cursor'); }
        if (!cursor || !Number.isInteger(cursor.id) || cursor.id < 1 || cursor.id > 2147483647 || typeof cursor.at !== 'string'
            || !/^\d{4}-\d{2}-\d{2}T/.test(cursor.at) || !Number.isFinite(Date.parse(cursor.at))) throw new ApiError(400, 'Invalid notification cursor');
    }
    const childId = req.child.id;
    const { rows } = await query(`SELECT n.*, COALESCE(to_jsonb(a), to_jsonb(v), to_jsonb(c), to_jsonb(m)) AS source_record
        FROM notifications n
        LEFT JOIN access_logs a ON a.id = n.access_log_id AND a.child_id = n.child_id
        LEFT JOIN vaccinations v ON v.id = n.vaccination_id AND v.child_id = n.child_id
        LEFT JOIN checkups c ON c.id = n.checkup_id AND c.child_id = n.child_id
        LEFT JOIN medical_history m ON m.id = n.medication_id AND m.child_id = n.child_id
        WHERE n.child_id = $1 AND ($2 = 'all' OR n.read_at IS NULL)
            AND ($3::timestamptz IS NULL OR (n.occurred_at, n.id) < ($3::timestamptz, $4::integer))
        ORDER BY n.occurred_at DESC, n.id DESC LIMIT $5`, [childId, filter, cursor?.at || null, cursor?.id || null, limit + 1]);
    const { rows: counts } = await query(`SELECT count(*)::integer AS total,
        count(*) FILTER (WHERE read_at IS NULL)::integer AS unread FROM notifications WHERE child_id = $1`, [childId]);
    const { rows: dates } = await query(`SELECT to_char(now() AT TIME ZONE COALESCE(
        (SELECT time_zone FROM notification_inbox_state WHERE child_id = $1), 'Asia/Manila'), 'YYYY-MM-DD') AS today`, [childId]);
    const page = rows.slice(0, limit), last = page.at(-1);
    res.set('Cache-Control', 'no-store');
    res.json({ rows: page.filter((row) => row.source_record).map((row) => presentNotification(row, dates[0].today)),
        total: counts[0].total, unreadCount: counts[0].unread,
        nextCursor: rows.length > limit ? Buffer.from(JSON.stringify({ at: new Date(last.occurred_at).toISOString(), id: last.id })).toString('base64url') : null });
}));

router.post('/:childId/notifications/:id/read', asyncHandler(async (req, res) => {
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) > 2147483647 || Number(req.params.id) < 1) throw new ApiError(400, 'Invalid notification id');
    const result = await withTransaction(async (client) => {
        const { rows } = await client.query(`UPDATE notifications SET read_at = COALESCE(read_at, now())
            WHERE child_id = $1 AND id = $2 RETURNING id, read_at, access_log_id`, [req.child.id, req.params.id]);
        if (!rows[0]) throw new ApiError(404, 'Notification not found');
        if (rows[0].access_log_id) await client.query('UPDATE access_logs SET seen_by_parent = TRUE WHERE child_id = $1 AND id = $2', [req.child.id, rows[0].access_log_id]);
        return { id: rows[0].id, readAt: rows[0].read_at };
    });
    res.json(result);
}));
module.exports = router;
