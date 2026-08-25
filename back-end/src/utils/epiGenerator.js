// Builds and persists the auto-generated DOH EPI vaccination + reminder rows
// for a child, dated from their date of birth. See data/epiSchedule.js for
// the schedule itself and its sourcing caveats.
const { withTransaction } = require("../db/pool");
const { encryptFields, decrypt } = require("./crypto");
const { EPI_SCHEDULE, SCHEDULE_VERSION } = require("../data/epiSchedule");

const VACCINATION_ENCRYPTED = ["vaccine_name", "visit_name", "notes"];
const REMINDER_ENCRYPTED = ["title"];

function addOffset(dobStr, entry) {
    const d = new Date(dobStr + "T00:00:00Z");
    if (entry.offsetDays) d.setUTCDate(d.getUTCDate() + entry.offsetDays);
    if (entry.offsetWeeks) d.setUTCDate(d.getUTCDate() + entry.offsetWeeks * 7);
    if (entry.offsetMonths) d.setUTCMonth(d.getUTCMonth() + entry.offsetMonths);
    return d.toISOString().slice(0, 10);
}

// `pg` parses a DATE column into a JS Date built from LOCAL date components
// (not UTC) — req.child.date_of_birth arrives as a Date object, not a
// string. Using .toISOString() on it would shift the calendar date by a day
// in any timezone ahead of UTC. Extract via local getters instead so the
// calendar date pg intended is preserved regardless of server timezone.
function toDobStr(dateOfBirth) {
    if (!dateOfBirth) return null;
    if (dateOfBirth instanceof Date) {
        if (isNaN(dateOfBirth.getTime())) return null;
        const y = dateOfBirth.getFullYear();
        const m = String(dateOfBirth.getMonth() + 1).padStart(2, "0");
        const d = String(dateOfBirth.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    const s = String(dateOfBirth).slice(0, 10);
    return isNaN(new Date(s).getTime()) ? null : s;
}

// Pure — builds the schedule entries for a date of birth without touching
// the database. Returns [] if dateOfBirth is missing/unparseable — never
// guess a DOB. Past due dates are kept (not filtered): a parent registering
// an older child needs to see what was missed, not have it hidden.
function generateEpiSchedule(dateOfBirth) {
    const dobStr = toDobStr(dateOfBirth);
    if (!dobStr) return { entries: [], scheduleVersion: SCHEDULE_VERSION };

    const today = new Date().toISOString().slice(0, 10);

    const entries = EPI_SCHEDULE.map((e) => {
        const due_date = addOffset(dobStr, e);
        const vaccine_name = e.doseNumber ? `${e.vaccineName} ${e.doseNumber}` : e.vaccineName;
        return {
            vaccination: {
                vaccine_name,
                visit_name: e.visitName,
                due_date,
                status: "scheduled",
                date_given: null,
                notes: e.notes || null,
                source: "epi",
                // Also carried in its own column now, so "is dose 2 done?" is a
                // real question rather than a string match on the name.
                dose_number: e.doseNumber || null,
            },
            // Only schedule a reminder for doses still ahead — a past-dated
            // reminder is harmless but pointless to write.
            needsReminder: due_date >= today,
        };
    });

    return { entries, scheduleVersion: SCHEDULE_VERSION };
}

// Identity of a scheduled dose, for deciding whether it already exists.
//
// Compares the vaccine name WITHOUT its trailing dose number. The 2026
// verification gave IPV a dose number for the first time, which renames a
// stored "IPV" to "IPV 1"; a raw name+visit key would read that as a new dose
// and insert a duplicate into every child whose schedule predates the change.
// Stripping the trailing digit makes "IPV" and "IPV 1" the same dose at the
// same visit, while "IPV 2 | 9 Months" stays genuinely new — doses are told
// apart by visit_name, which is what actually differs between them.
function epiDedupeKey(name, visit) {
    const base = String(name || "").replace(/\s+\d+$/, "").trim();
    return `${base}|${visit || ""}`;
}

function buildInsert(table, cols, rows) {
    const values = [];
    const params = [];
    rows.forEach((row, i) => {
        const base = i * cols.length;
        values.push(`(${cols.map((_, j) => `$${base + j + 1}`).join(", ")})`);
        params.push(...cols.map((c) => row[c]));
    });
    return { text: `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${values.join(", ")} RETURNING id`, params };
}

// Persists the schedule for a child. mode:
//   "all"        — insert every entry (used right after child creation,
//                   where no vaccinations can exist yet — skips the gap check).
//   "fill-gaps"  — insert only entries with no existing vaccine_name+visit_name
//                   row. Never touches completed doses (they're just not deleted).
//   "replace"    — delete unattached scheduled rows first, then fill-gaps.
async function insertEpiSchedule(childId, dateOfBirth, mode = "all") {
    const { entries } = generateEpiSchedule(dateOfBirth);
    if (entries.length === 0) return { inserted: 0 };

    return withTransaction(async (client) => {
        if (mode === "replace") {
            await client.query(
                `DELETE FROM vaccinations
                 WHERE child_id = $1 AND status = 'scheduled'
                   AND id NOT IN (SELECT record_id FROM record_attachments WHERE record_type = 'vaccination')`,
                [childId]
            );
        }

        let toInsert = entries;
        if (mode === "fill-gaps" || mode === "replace") {
            const { rows: existing } = await client.query(
                "SELECT vaccine_name, visit_name FROM vaccinations WHERE child_id = $1",
                [childId]
            );
            const existingKeys = new Set(
                existing.map((r) => epiDedupeKey(decrypt(r.vaccine_name), decrypt(r.visit_name)))
            );
            toInsert = entries.filter(
                (e) => !existingKeys.has(epiDedupeKey(e.vaccination.vaccine_name, e.vaccination.visit_name))
            );
        }
        if (toInsert.length === 0) return { inserted: 0 };

        const vaxCols = ["child_id", "vaccine_name", "visit_name", "due_date", "status", "date_given", "notes", "source", "dose_number"];
        const vaxRows = toInsert.map((e) => ({
            child_id: childId,
            ...encryptFields(e.vaccination, VACCINATION_ENCRYPTED),
        }));
        const vaxInsert = buildInsert("vaccinations", vaxCols, vaxRows);
        const { rows: insertedVax } = await client.query(vaxInsert.text, vaxInsert.params);

        const reminderRows = [];
        toInsert.forEach((e, i) => {
            if (!e.needsReminder) return;
            reminderRows.push({
                child_id: childId,
                reminder_type: "Vaccination",
                title: e.vaccination.vaccine_name,
                reminder_date: e.vaccination.due_date,
                status: "Pending",
                vaccination_id: insertedVax[i].id,
            });
        });
        if (reminderRows.length > 0) {
            const remCols = ["child_id", "reminder_type", "title", "reminder_date", "status", "vaccination_id"];
            const remEncrypted = reminderRows.map((r) => encryptFields(r, REMINDER_ENCRYPTED));
            const remInsert = buildInsert("reminders", remCols, remEncrypted);
            await client.query(remInsert.text, remInsert.params);
        }

        return { inserted: toInsert.length };
    });
}

module.exports = { generateEpiSchedule, insertEpiSchedule, epiDedupeKey, SCHEDULE_VERSION };
