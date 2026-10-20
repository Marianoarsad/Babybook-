const { decryptRow, isEncrypted } = require('./crypto');

const dateOf = (value) => String(value || '').slice(0, 10);
function validDate(value) {
    const date = dateOf(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : '';
}
function shiftDate(date, days) {
    if (!validDate(date)) return '';
    const parsed = new Date(`${date}T00:00:00Z`);
    parsed.setUTCDate(parsed.getUTCDate() + days);
    return parsed.toISOString().slice(0, 10);
}
function courseEnd(record) {
    const start = validDate(record.date_recorded), days = Number(record.course_days);
    return start && Number.isInteger(days) && days > 0 && days <= 365 ? shiftDate(start, days - 1) : '';
}
function doseTimes(record) {
    let times = record.dose_times;
    if (typeof times === 'string') { try { times = JSON.parse(times); } catch (_) { times = null; } }
    if (!Array.isArray(times)) {
        // Same recorded-frequency fallback as the existing phone scheduler.
        const n = Number(record.frequency_per_day);
        if (!Number.isInteger(n) || n < 1 || n > 12) return [];
        const fixed = { 1: ['08:00'], 2: ['08:00', '20:00'], 3: ['08:00', '14:00', '20:00'], 4: ['07:00', '12:00', '17:00', '22:00'] };
        times = fixed[n] || Array.from({ length: n }, (_, i) => {
            const minutes = Math.round(420 + 900 * i / (n - 1));
            return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
        });
    }
    return [...new Set(times.filter((t) => typeof t === 'string' && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(t))
        .map((t) => { const [hour, minute] = t.split(':'); return `${hour.padStart(2, '0')}:${minute}`; })
        .filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort();
}

// Calendar arithmetic uses UTC only as a timezone-free date container.
// PostgreSQL converts the resulting local timestamps using the validated zone.
function scheduledOccurrences({ vaccinations = [], checkups = [], medications = [] }, fromLocal, throughLocal, backfill) {
    const result = [], today = dateOf(throughLocal);
    const add = (kind, id, at, column, always = false) => {
        if (!at || at > throughLocal || (!always && at <= fromLocal)) return;
        result.push({ kind, occurrence_key: `${kind}:${id}:${at}`, local_at: at,
            [column]: id, backfilled: !!backfill && !always });
    };
    for (const row of vaccinations) {
        const day = validDate(row.due_date);
        if (day && (backfill || row.status !== 'completed' || (validDate(row.date_given) && day < dateOf(row.date_given)))) {
            add('vaccination', row.id, `${day}T09:00:00`, 'vaccination_id');
        }
    }
    for (const row of checkups) {
        const day = validDate(row.checkup_date);
        if (day && (backfill || row.status !== 'completed')) add('appointment', row.id, `${day}T09:00:00`, 'checkup_id');
    }
    for (const row of medications) {
        if (row.category !== 'Medication') continue;
        const start = validDate(row.date_recorded), end = courseEnd(row), resolved = validDate(row.resolved_date);
        if (!start) continue;
        if (!row.resolved && end && end < today) add('course_ended', row.id, `${shiftDate(end, 1)}T00:00:00`, 'medication_id', true);
        // A resolved legacy course without an end date cannot be reconstructed safely.
        if (row.resolved && !resolved) continue;
        const last = [today, end, row.resolved && resolved ? backfill ? resolved : shiftDate(resolved, -1) : ''].filter(Boolean).sort()[0];
        const first = [start, dateOf(fromLocal)].sort().at(-1);
        for (let day = first; day && day <= last; day = shiftDate(day, 1)) {
            for (const time of doseTimes(row)) add('medication_dose', row.id, `${day}T${time}:00`, 'medication_id');
        }
    }
    return result;
}

function presentNotification(row, today) {
    const fields = row.access_log_id ? [] : row.vaccination_id ? ['vaccine_name', 'visit_name', 'notes', 'reaction']
        : row.checkup_id ? ['title', 'doctor_name', 'clinic', 'notes']
            : ['title', 'description', 'facility', 'notes', 'dose_amount', 'prescribed_by'];
    const record = decryptRow(row.source_record, fields);
    // Do not display raw ciphertext if a deployment has the wrong encryption key.
    for (const field of fields) if (isEncrypted(record?.[field])) record[field] = 'Record unavailable';
    const names = { shared_access: 'Records Viewed', course_ended: 'Confirm Medication Completion',
        vaccination: 'Vaccination Reminder', appointment: 'Appointment Reminder', medication_dose: 'Medication Reminder' };
    const sourceType = row.access_log_id ? 'access-log' : row.vaccination_id ? 'vaccination' : row.checkup_id ? 'checkup' : 'medical-history';
    const end = courseEnd(record || {});
    const canComplete = row.kind === 'course_ended' && record?.category === 'Medication' && !record.resolved
        && end && end < today && row.occurrence_key === `course_ended:${record.id}:${shiftDate(end, 1)}T00:00:00`;
    return { id: row.id, kind: row.kind, title: names[row.kind],
        subtitle: record?.professional_name || record?.vaccine_name || record?.title || 'Record',
        occurredAt: row.occurred_at, readAt: row.read_at, backfilled: row.backfilled, canComplete: !!canComplete,
        source: { type: sourceType, id: record?.id, record } };
}

async function syncInbox(client, childId, timeZone) {
    // Serializes this child's checkpoint only; concurrent devices cannot skip a window.
    await client.query('SELECT id FROM children WHERE id = $1 FOR UPDATE', [childId]);
    const { rows: clocks } = await client.query(`SELECT now() AS instant,
        to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD"T"HH24:MI:SS') AS local_now`, [timeZone]);
    const { instant, local_now: localNow } = clocks[0];
    const { rows: states } = await client.query(`SELECT *, to_char(synced_through AT TIME ZONE $2,
        'YYYY-MM-DD"T"HH24:MI:SS') AS local_previous FROM notification_inbox_state WHERE child_id = $1`, [childId, timeZone]);
    const first = !states[0], from = first ? `${shiftDate(dateOf(localNow), -30)}T00:00:00` : states[0].local_previous;
    const sources = await Promise.all([
        client.query(`SELECT DISTINCT v.* FROM vaccinations v JOIN reminders r ON r.vaccination_id = v.id AND r.child_id = v.child_id
            WHERE v.child_id = $1 AND r.reminder_type = 'Vaccination'`, [childId]),
        client.query(`SELECT DISTINCT c.* FROM checkups c JOIN reminders r ON r.checkup_id = c.id AND r.child_id = c.child_id
            WHERE c.child_id = $1 AND r.reminder_type = 'Checkup'`, [childId]),
        client.query("SELECT * FROM medical_history WHERE child_id = $1 AND category = 'Medication'", [childId]),
    ]);
    const scheduled = scheduledOccurrences({ vaccinations: sources[0].rows, checkups: sources[1].rows, medications: sources[2].rows }, from, localNow, first);
    // Re-read the last calendar day too: an updated/new same-day schedule may
    // have become due since the previous poll. Unique occurrence keys make this safe.
    if (!first) scheduled.push(...scheduledOccurrences({ vaccinations: sources[0].rows, checkups: sources[1].rows, medications: sources[2].rows },
        `${dateOf(localNow)}T00:00:00`, localNow, false));
    for (let offset = 0; offset < scheduled.length; offset += 1000) {
        await client.query(`INSERT INTO notifications (child_id, kind, occurrence_key, occurred_at, backfilled, vaccination_id, checkup_id, medication_id)
            SELECT $1, x.kind, x.occurrence_key, x.local_at::timestamp AT TIME ZONE $3, x.backfilled, x.vaccination_id, x.checkup_id, x.medication_id
            FROM jsonb_to_recordset($2::jsonb) AS x(kind text, occurrence_key text, local_at text, backfilled boolean, vaccination_id integer, checkup_id integer, medication_id integer)
            ON CONFLICT (child_id, occurrence_key) DO NOTHING`, [childId, JSON.stringify(scheduled.slice(offset, offset + 1000)), timeZone]);
    }
    await client.query(`INSERT INTO notifications (child_id, kind, occurrence_key, occurred_at, read_at, access_log_id)
        SELECT child_id, 'shared_access', 'shared_access:' || id, access_date,
            CASE WHEN $2::boolean AND seen_by_parent THEN $3::timestamptz ELSE NULL END, id
        FROM access_logs WHERE child_id = $1 AND access_date <= $3
        ON CONFLICT (child_id, occurrence_key) DO NOTHING`, [childId, first, instant]);
    await client.query(`INSERT INTO notification_inbox_state (child_id, initialized_at, synced_through, time_zone)
        VALUES ($1, $2, $2, $3) ON CONFLICT (child_id) DO UPDATE SET synced_through = EXCLUDED.synced_through, time_zone = EXCLUDED.time_zone`,
        [childId, instant, timeZone]);
    return { syncedAt: instant };
}

module.exports = { validDate, shiftDate, courseEnd, doseTimes, scheduledOccurrences, presentNotification, syncInbox };
