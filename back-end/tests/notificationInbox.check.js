// node tests/notificationInbox.check.js — SQL double only; never opens a database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'notification-test-secret-not-a-real-key';
process.env.DATA_ENCRYPTION_KEY = 'notification-test-encryption-not-a-real-key';
const helpers = require('../src/utils/notificationInbox');
const { encrypt } = require('../src/utils/crypto');
let clock = new Date('2026-10-05T02:00:00Z'), nextId = 1;
const states = new Map(), ledger = [];
const med = { id: 11, child_id: 1, category: 'Medication', title: encrypt('Medicine'), date_recorded: '2026-10-01',
    course_days: 3, frequency_per_day: 2, dose_times: ['08:00', '20:00'], resolved: false };
const vaccinations = [{ id: 21, child_id: 1, vaccine_name: encrypt('Vaccine'), due_date: '2026-10-05', status: 'scheduled' },
    { id: 22, child_id: 2, vaccine_name: 'Private child', due_date: '2026-10-05' }];
const checkups = [{ id: 31, child_id: 1, title: encrypt('Checkup'), checkup_date: '2026-10-06', status: 'scheduled' }];
const access = [{ id: 41, child_id: 1, professional_name: 'Viewer', access_date: '2026-10-04T02:00:00Z', seen_by_parent: false },
    { id: 42, child_id: 1, professional_name: 'Earlier viewer', access_date: '2026-07-01T02:00:00Z', seen_by_parent: true },
    ...Array.from({ length: 8 }, (_, i) => ({ id: 50 + i, child_id: 1, access_date: `2026-10-0${i % 4 + 1}T03:00:00Z`, professional_name: `Viewer ${i}`, seen_by_parent: false }))];
function local(instant, zone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
function insert(row) {
    if (ledger.some((old) => old.child_id === row.child_id && old.occurrence_key === row.occurrence_key)) return;
    ledger.push({ id: nextId++, read_at: null, backfilled: false, ...row });
}
async function query(sql, params = []) {
    if (sql.includes('FROM users WHERE id')) return { rows: [1, 2].includes(Number(params[0])) ? [{ id: Number(params[0]), email: 'test@example.invalid' }] : [] };
    if (sql.includes('FROM children WHERE id') && sql.includes('user_id')) return { rows: Number(params[0]) === Number(params[1]) && [1, 2].includes(Number(params[0])) ? [{ id: Number(params[0]), user_id: Number(params[1]) }] : [] };
    if (sql.includes('FROM children') && sql.includes('FOR UPDATE')) return { rows: [{ id: params[0] }] };
    if (sql.includes('SELECT now() AS instant')) return { rows: [{ instant: clock, local_now: local(clock, params[0]) }] };
    if (sql.startsWith('SELECT *, to_char(synced_through')) {
        const state = states.get(params[0]); return { rows: state ? [{ ...state, local_previous: local(state.synced_through, params[1]) }] : [] };
    }
    if (sql.includes('SELECT DISTINCT v.*')) return { rows: vaccinations.filter((row) => row.child_id === params[0]) };
    if (sql.includes('SELECT DISTINCT c.*')) return { rows: checkups.filter((row) => row.child_id === params[0]) };
    if (sql.startsWith('SELECT * FROM medical_history')) return { rows: params[0] === 1 ? [med] : [] };
    if (sql.startsWith('INSERT INTO notifications') && sql.includes('jsonb_to_recordset')) {
        for (const row of JSON.parse(params[1])) insert({ ...row, child_id: params[0], occurred_at: new Date(`${row.local_at}${params[2] === 'Asia/Manila' ? '+08:00' : 'Z'}`).toISOString() });
        return { rows: [] };
    }
    if (sql.startsWith('INSERT INTO notifications') && sql.includes('FROM access_logs')) {
        for (const row of access.filter((row) => row.child_id === params[0] && new Date(row.access_date) <= params[2])) {
            insert({ child_id: params[0], kind: 'shared_access', occurrence_key: `shared_access:${row.id}`, occurred_at: row.access_date,
                access_log_id: row.id, read_at: params[1] && row.seen_by_parent ? params[2] : null });
        }
        return { rows: [] };
    }
    if (sql.startsWith('INSERT INTO notification_inbox_state')) {
        states.set(params[0], { initialized_at: states.get(params[0])?.initialized_at || params[1], synced_through: params[1], time_zone: params[2] });
        return { rows: [] };
    }
    if (sql.startsWith('SELECT n.*')) {
        const rows = ledger.filter((row) => row.child_id === params[0] && (params[1] === 'all' || !row.read_at))
            .filter((row) => !params[2] || new Date(row.occurred_at) < new Date(params[2]) || (new Date(row.occurred_at).getTime() === new Date(params[2]).getTime() && row.id < params[3]))
            .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at) || b.id - a.id).slice(0, params[4]);
        return { rows: rows.map((row) => ({ ...row, source_record: row.access_log_id ? access.find((source) => source.id === row.access_log_id)
            : row.vaccination_id ? vaccinations.find((source) => source.id === row.vaccination_id)
                : row.checkup_id ? checkups.find((source) => source.id === row.checkup_id) : med })) };
    }
    if (sql.includes('count(*)::integer AS total')) {
        const rows = ledger.filter((row) => row.child_id === params[0]); return { rows: [{ total: rows.length, unread: rows.filter((row) => !row.read_at).length }] };
    }
    if (sql.startsWith('SELECT to_char(now()')) return { rows: [{ today: local(clock, states.get(params[0])?.time_zone || 'Asia/Manila').slice(0, 10) }] };
    if (sql.startsWith('UPDATE notifications')) {
        const row = ledger.find((row) => row.child_id === params[0] && row.id === Number(params[1]));
        if (row) row.read_at ||= clock.toISOString(); return { rows: row ? [row] : [] };
    }
    if (sql.startsWith('UPDATE access_logs')) { access.find((row) => row.child_id === params[0] && row.id === params[1]).seen_by_parent = true; return { rows: [] }; }
    throw new Error(`Unexpected SQL: ${sql}`);
}
require.cache[require.resolve('../src/db/pool')] = { exports: { query, withTransaction: async (fn) => fn({ query }) } };
const app = express(); app.use(express.json()); app.use('/api/children', require('../src/routes/notifications.routes'));
app.use(require('../src/middleware/error').errorHandler);
const token = jwt.sign({ sub: '1' }, process.env.JWT_SECRET, { expiresIn: '5m' });
const call = (method, route) => request(app)[method](`/api/children/${route}`).set('Authorization', `Bearer ${token}`);
async function main() {
    assert.equal(helpers.validDate('2026-02-30'), ''); assert.equal(helpers.courseEnd({ date_recorded: '2024-02-28', course_days: 3 }), '2024-03-01');
    assert.deepEqual(helpers.doseTimes({ dose_times: ['8:00', '08:00', '8:00:00', '25:00', '12:99', '20:00'] }), ['08:00', '20:00']);
    assert.deepEqual(helpers.doseTimes({ dose_times: 'bad', frequency_per_day: 3 }), ['08:00', '14:00', '20:00']);
    const beforeNine = helpers.scheduledOccurrences({ vaccinations: [vaccinations[0]] }, '2026-10-05T00:00:00', '2026-10-05T08:59:59', false);
    assert.equal(beforeNine.length, 0);
    assert.equal(helpers.scheduledOccurrences({ vaccinations: [vaccinations[0]] }, '2026-10-05T00:00:00', '2026-10-05T09:00:00', false).length, 1);
    const legacy = helpers.scheduledOccurrences({ medications: [{ ...med, date_recorded: '2026-07-01' }] }, '2026-09-05T00:00:00', '2026-10-05T10:00:00', true);
    assert.equal(legacy.length, 1); assert.equal(legacy[0].kind, 'course_ended'); assert.equal(legacy[0].backfilled, false);
    assert.equal(helpers.scheduledOccurrences({ medications: [{ ...med, resolved: true, resolved_date: null }] }, '2026-10-01T00:00:00', '2026-10-05T10:00:00', true).length, 0);
    await request(app).get('/api/children/1/notifications').expect(401);
    await call('get', '2/notifications').expect(404);
    await call('get', '1oops/notifications').expect(400);
    await call('post', '1/notifications/sync').send({ timeZone: 'not/a/timezone' }).expect(400);
    await call('post', '1/notifications/sync').send({ timeZone: 'Asia/Manila' }).expect(200);
    assert(!ledger.some((row) => row.checkup_id), 'Future appointments must not appear');
    assert.equal(ledger.find((row) => row.vaccination_id)?.occurred_at, '2026-10-05T01:00:00.000Z');
    const size = ledger.length;
    await Promise.all([call('post', '1/notifications/sync').send({ timeZone: 'Asia/Manila' }).expect(200), call('post', '1/notifications/sync').send({ timeZone: 'Asia/Manila' }).expect(200)]);
    assert.equal(ledger.length, size, 'Occurrence keys deduplicate concurrent/repeated syncs');
    const first = (await call('get', '1/notifications').expect(200)).body;
    assert.equal(first.rows.length, 10); assert(first.nextCursor); assert.equal(first.total, size);
    assert(!JSON.stringify(first).includes('enc:v1:')); assert(!JSON.stringify(first).includes('Private child'));
    assert(first.rows.some((row) => row.title === 'Vaccination Reminder' && row.subtitle === 'Vaccine'));
    const second = (await call('get', `1/notifications?cursor=${first.nextCursor}`).expect(200)).body;
    assert(first.rows.every((row) => !second.rows.some((other) => other.id === row.id)), 'No overlapping pages at equal timestamps');
    assert.equal([...first.rows, ...second.rows].length, size);
    const target = first.rows.find((row) => row.kind === 'shared_access' && !row.readAt);
    const read = (await call('post', `1/notifications/${target.id}/read`).expect(200)).body;
    assert.equal(read.id, target.id);
    assert.equal((await call('post', `1/notifications/${target.id}/read`).expect(200)).body.readAt, read.readAt, 'Read retries are idempotent');
    const unread = (await call('get', '1/notifications?filter=unread&limit=100').expect(200)).body;
    assert.equal(unread.unreadCount, first.unreadCount - 1); assert(!unread.rows.some((row) => row.id === target.id));
    await call('post', '2/notifications/1/read').expect(404);
    await call('get', '1/notifications?filter=invalid').expect(400);
    await call('get', '1/notifications?limit=101').expect(400);
    await call('get', '1/notifications?cursor=bad').expect(400);
    clock = new Date('2026-10-06T01:05:00Z');
    await call('post', '1/notifications/sync').send({ timeZone: 'Asia/Manila' }).expect(200);
    assert(ledger.some((row) => row.checkup_id), 'Due appointments appear during catch-up');
    const ended = ledger.find((row) => row.kind === 'course_ended');
    assert(helpers.presentNotification({ ...ended, source_record: med }, '2026-10-06').canComplete);
    assert(!helpers.presentNotification({ ...ended, source_record: { ...med, resolved: true } }, '2026-10-06').canComplete);
    assert(!helpers.presentNotification({ ...ended, source_record: { ...med, course_days: 4 } }, '2026-10-06').canComplete);
    const migration = fs.readFileSync(path.join(__dirname, '../src/db/migrations/017_notification_inbox.sql'), 'utf8');
    for (const table of ['access_logs', 'vaccinations', 'checkups', 'medical_history', 'children']) assert(migration.includes(`REFERENCES ${table}(id) ON DELETE CASCADE`));
    assert(migration.includes('ENABLE ROW LEVEL SECURITY')); assert(migration.includes('REVOKE ALL ON notification_inbox_state, notifications FROM authenticated'));
    assert(!/\b(title|description|body|notes)\s+(TEXT|JSONB)/i.test(migration), 'Do not persist medical content in notification receipts');
    console.log('Notification inbox checks passed: due boundaries, backfill, course safety, authenticated ownership, pagination, decryption, read syncing, retries and catch-up (SQL double; no live database).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
