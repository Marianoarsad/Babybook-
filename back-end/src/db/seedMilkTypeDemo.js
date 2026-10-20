// Only the named development account's marked milk periods are inserted/updated.
require("dotenv").config();
const { pool, withTransaction } = require("./pool");
const { encrypt, decrypt, isEncrypted } = require("../utils/crypto");

const DEMO_EMAIL = "demo.parent@babybookplus.app";
const EXPECTED_PROFILES = ["Elias Rivera", "Sofia Rivera"];
const MARKER = "[milk-chart-demo:v1:";

function manilaToday() {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = name => parts.find(value => value.type === name).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDay(iso, days) {
    const date = new Date(`${iso}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || isNaN(date) || date.toISOString().slice(0, 10) !== iso) throw new Error("Invalid demo calendar date");
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function buildMilkTypePeriods(dob, today) {
    shiftDay(dob, 0);
    if (dob > shiftDay(today, -61)) throw new Error("Milk chart samples require a profile at least 61 days old");
    return [
        ["Breastmilk", dob, shiftDay(today, -61)],
        ["Mixed", shiftDay(today, -60), shiftDay(today, -22)],
        ["Formula", shiftDay(today, -21), shiftDay(today, -7)],
        ["Breastmilk", shiftDay(today, -6), shiftDay(today, -4)],
        ["Formula", shiftDay(today, -5), shiftDay(today, -4)],
        ["Mixed", shiftDay(today, -3), shiftDay(today, -2)],
        ["Formula", shiftDay(today, -1), null],
        ["Formula", shiftDay(today, -1), shiftDay(today, -1)],
    ].map(([milk_type, start_date, end_date], i) => ({ milk_type, start_date, end_date,
        notes: `${MARKER}${String(i + 1).padStart(2, "0")}] Fictional development period for the Milk Type chart. Not a feeding log.` }));
}

async function seedMilkTypeDemo(today = manilaToday()) {
    return withTransaction(async client => {
        const { rows: users } = await client.query("SELECT id FROM users WHERE email = $1 FOR UPDATE", [DEMO_EMAIL]);
        if (users.length !== 1) throw new Error("Development demo account was not found; no records changed");
        const { rows: children } = await client.query("SELECT id, first_name, last_name, date_of_birth FROM children WHERE user_id = $1 ORDER BY id FOR UPDATE", [users[0].id]);
        const names = children.map(child => [decrypt(child.first_name), decrypt(child.last_name)].filter(Boolean).join(" "));
        if (children.length !== 2 || new Set(names).size !== 2 || names.some(name => !EXPECTED_PROFILES.includes(name))) {
            throw new Error("Expected only Elias Rivera and Sofia Rivera under the development account; no records changed");
        }
        const exists = await client.query("SELECT to_regclass('public.milk_type_periods') IS NOT NULL AS present");
        if (!exists.rows[0].present) throw new Error("Apply migration 020 before seeding milk-type periods");
        const result = [];
        for (const [index, child] of children.entries()) {
            const samples = buildMilkTypePeriods(child.date_of_birth, today);
            const { rows } = await client.query("SELECT id, milk_type, start_date, end_date, notes FROM milk_type_periods WHERE child_id = $1 FOR UPDATE", [child.id]);
            const owned = new Map();
            for (const row of rows) {
                const notes = decrypt(row.notes);
                if (isEncrypted(notes)) throw new Error("Period notes could not be decrypted; no records changed");
                if (typeof notes !== "string" || !notes.startsWith(MARKER)) continue;
                const marker = /^\[milk-chart-demo:v1:(0[1-8])\] /.exec(notes)?.[1];
                if (!marker || owned.has(marker)) throw new Error("Unexpected or duplicate milk-chart sample markers; no records changed");
                owned.set(marker, { ...row, notes });
            }
            const count = { childId: child.id, name: names[index], inserted: 0, updated: 0, unchanged: 0 };
            for (const [sampleIndex, sample] of samples.entries()) {
                const existing = owned.get(String(sampleIndex + 1).padStart(2, "0"));
                if (existing && Object.keys(sample).every(key => existing[key] === sample[key])) { count.unchanged++; continue; }
                const fields = [sample.milk_type, sample.start_date, sample.end_date, encrypt(sample.notes)];
                const saved = existing ? await client.query(
                    "UPDATE milk_type_periods SET milk_type=$1, start_date=$2, end_date=$3, notes=$4 WHERE id=$5 AND child_id=$6 RETURNING id", [...fields, existing.id, child.id])
                    : await client.query("INSERT INTO milk_type_periods (child_id, milk_type, start_date, end_date, notes) VALUES ($1,$2,$3,$4,$5) RETURNING id", [child.id, ...fields]);
                if (saved.rows.length !== 1) throw new Error("Could not confirm a mock period; no records changed");
                count[existing ? "updated" : "inserted"]++;
            }
            result.push(count);
        }
        return { today, profiles: result };
    });
}

module.exports = { DEMO_EMAIL, MARKER, buildMilkTypePeriods, manilaToday, shiftDay, seedMilkTypeDemo };
if (require.main === module) {
    seedMilkTypeDemo().then(result => console.log("[seed:milk-type-demo]", JSON.stringify(result)))
        .catch(error => { console.error("[seed:milk-type-demo] failed:", error.code || error.message); process.exitCode = 1; })
        .finally(() => pool.end());
}
