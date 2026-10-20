// Seeds a lived-in two-child demo account spanning 2020-2029. Sofia carries
// the family's 2020-2026 history; Elias carries the active infant experience
// plus the intentionally simulated 2027-2029 history used for UI review.
//
// Previously this covered only one relative year, so screenshots changed on
// every run and none of the long-range views had meaningful history.
//
// Separate from seed.js (which seeds a minimal "sarah@example.com" account
// for quick local dev). Safe to re-run: deletes the demo user (and
// everything that cascades from it) first.
//
// Usage:  npm run db:seed:demo
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool, query, withTransaction } = require("./pool");
const { buildSnapshot } = require("../utils/snapshot");
const { generateCode, qrPayloadForCode } = require("../utils/shareCode");
const storage = require("../utils/storage");

const DEMO_EMAIL = "demo.parent@babybookplus.app";
const DEMO_PASSWORD = "Demo1234!";
const DEMO_RESEED_CONFIRMATION = "ALLOW_DEMO_RESEED";

// ---------------------------------------------------------------------------
// Date helpers — everything is computed relative to "now" (at script run
// time) so the demo always looks current, not frozen to whenever this file
// was written.
// ---------------------------------------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date();
const TIMELINE_END = new Date("2029-12-31T12:00:00.000Z");
let randomState = 20200908;

function random() {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 4294967296;
}

function addDays(date, days) {
    return new Date(date.getTime() + days * DAY_MS);
}
function addMonths(date, months) {
    const d = new Date(date.getTime());
    d.setMonth(d.getMonth() + months);
    return d;
}
function ymd(date) {
    return date.toISOString().slice(0, 10);
}
function jitterDays(date, maxDays) {
    return addDays(date, Math.round((random() * 2 - 1) * maxDays));
}
function pick(arr) {
    return arr[Math.floor(random() * arr.length)];
}
function round1(n) {
    return Math.round(n * 10) / 10;
}
function round2(n) {
    return Math.round(n * 100) / 100;
}

// Both demo profiles deliberately continue through 2029. Sofia therefore
// exceeds the app's usual age range; this is preview data, not a clinical claim.
// Fixed dates keep defense screenshots reproducible. On 14 September 2026,
// Sofia is 10 months old and Elias is 7 months old; both are old enough for
// the Nutrition tab to demonstrate milk and complementary-food tracking.
const DOB = new Date("2026-02-14T12:00:00.000Z");
const SOFIA_DOB = new Date("2025-11-14T12:00:00.000Z");
const SOFIA_LEGACY_DOB = new Date("2020-02-18T12:00:00.000Z");
const SOFIA_DATE_SHIFT_DAYS = Math.round((SOFIA_DOB - SOFIA_LEGACY_DOB) / DAY_MS);
const demoPhoto = (seed) => `https://picsum.photos/seed/babybook-${seed}/600/600`;

function requireDemoReseedConfirmation() {
    const value = process.env.DATABASE_URL;
    if (!value) throw new Error("DATABASE_URL is required");
    const host = new URL(value).hostname;
    const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!local && process.env[DEMO_RESEED_CONFIRMATION] !== DEMO_EMAIL) {
        throw new Error(
            `Refusing non-local demo reseed. Set ${DEMO_RESEED_CONFIRMATION}=${DEMO_EMAIL} for this command only.`
        );
    }
}

async function verifyDemoSeed() {
    const { rows: accountRows } = await query(
        `SELECT u.created_at,
                COUNT(c.id)::int AS child_count,
                COUNT(c.id) FILTER (WHERE LOWER(c.sex) = 'female')::int AS female_count
         FROM users u
         LEFT JOIN children c ON c.user_id = u.id
         WHERE u.email = $1
         GROUP BY u.id`,
        [DEMO_EMAIL]
    );
    const account = accountRows[0];
    if (!account || account.child_count !== 2 || account.female_count < 1) {
        throw new Error("Demo verification failed: expected two children including a female profile");
    }
    if (new Date(account.created_at).getUTCFullYear() !== 2020) {
        throw new Error("Demo verification failed: account must begin in 2020");
    }

    const { rows: yearRows } = await query(
        `WITH demo_children AS (
             SELECT c.id FROM children c JOIN users u ON u.id = c.user_id WHERE u.email = $1
         ), activity AS (
             SELECT date_of_birth AS day FROM children WHERE id IN (SELECT id FROM demo_children)
             UNION ALL SELECT COALESCE(date_given, due_date) FROM vaccinations WHERE child_id IN (SELECT id FROM demo_children)
             UNION ALL SELECT checkup_date FROM checkups WHERE child_id IN (SELECT id FROM demo_children)
             UNION ALL SELECT date_recorded FROM medical_history WHERE child_id IN (SELECT id FROM demo_children)
             UNION ALL SELECT date_recorded FROM growth_records WHERE child_id IN (SELECT id FROM demo_children)
             UNION ALL SELECT date_recorded FROM milestones WHERE child_id IN (SELECT id FROM demo_children)
             UNION ALL SELECT entry_date FROM nutrition_records WHERE child_id IN (SELECT id FROM demo_children)
             UNION ALL SELECT date_recorded FROM memories WHERE child_id IN (SELECT id FROM demo_children)
             UNION ALL SELECT event_date FROM calendar_events WHERE child_id IN (SELECT id FROM demo_children)
         )
         SELECT DISTINCT EXTRACT(YEAR FROM day)::int AS year
         FROM activity WHERE day IS NOT NULL ORDER BY year`,
        [DEMO_EMAIL]
    );
    const years = new Set(yearRows.map((row) => row.year));
    const missing = [];
    for (let year = 2025; year <= 2029; year++) if (!years.has(year)) missing.push(year);
    if (missing.length) throw new Error(`Demo verification failed: no activity in ${missing.join(", ")}`);

    const { rows: coverage } = await query(
        `WITH demo_children AS (
             SELECT c.* FROM children c JOIN users u ON u.id = c.user_id WHERE u.email = $1
         ), growth AS (
             SELECT child_id, COUNT(DISTINCT date_recorded)::int AS days,
                    MIN(date_recorded) AS first_day, MAX(date_recorded) AS last_day
             FROM growth_records WHERE child_id IN (SELECT id FROM demo_children) GROUP BY child_id
         ), nutrition AS (
             SELECT child_id, COUNT(DISTINCT entry_date)::int AS days,
                    MIN(entry_date) AS first_day, MAX(entry_date) AS last_day
             FROM nutrition_records WHERE child_id IN (SELECT id FROM demo_children) GROUP BY child_id
         )
         SELECT c.first_name,
                c.date_of_birth,
                g.days AS growth_days, g.first_day AS growth_start, g.last_day AS growth_end,
                n.days AS nutrition_days, n.first_day AS nutrition_start, n.last_day AS nutrition_end
         FROM demo_children c
         LEFT JOIN growth g ON g.child_id = c.id
         LEFT JOIN nutrition n ON n.child_id = c.id
         ORDER BY c.first_name`,
        [DEMO_EMAIL]
    );
    for (const row of coverage) {
        const start = new Date(`${String(row.date_of_birth).slice(0, 10)}T12:00:00.000Z`);
        const expected = dayCount(start, TIMELINE_END);
        if (
            row.growth_days !== expected || row.nutrition_days !== expected ||
            String(row.growth_start).slice(0, 10) !== ymd(start) ||
            String(row.nutrition_start).slice(0, 10) !== ymd(start) ||
            String(row.growth_end).slice(0, 10) !== ymd(TIMELINE_END) ||
            String(row.nutrition_end).slice(0, 10) !== ymd(TIMELINE_END)
        ) {
            throw new Error(`Demo verification failed: incomplete daily coverage for ${row.first_name}`);
        }
    }

    const { rows: invalidRows } = await query(
        `WITH demo_children AS (
             SELECT c.id, c.date_of_birth FROM children c JOIN users u ON u.id = c.user_id WHERE u.email = $1
         ), activity AS (
             SELECT child_id, due_date AS day FROM vaccinations
             UNION ALL SELECT child_id, checkup_date FROM checkups
             UNION ALL SELECT child_id, date_recorded FROM medical_history
             UNION ALL SELECT child_id, date_recorded FROM growth_records
             UNION ALL SELECT child_id, date_recorded FROM milestones
             UNION ALL SELECT child_id, entry_date FROM nutrition_records
             UNION ALL SELECT child_id, date_recorded FROM memories
             UNION ALL SELECT child_id, event_date FROM calendar_events
         )
         SELECT COUNT(*)::int AS count
         FROM activity a JOIN demo_children c ON c.id = a.child_id
         WHERE a.day IS NOT NULL AND a.day < c.date_of_birth`,
        [DEMO_EMAIL]
    );
    if (invalidRows[0].count) {
        throw new Error("Demo verification failed: child activity predates a birth date");
    }

    console.log("[seed:demo] verified two distinct profiles with daily growth and nutrition through 2029.");
}

// Approximate WHO child-growth-standard medians for a boy, birth-12mo
// (weight kg, length cm, head circumference cm) — used as a realistic
// trajectory, not medical data.
const GROWTH_CURVE = [
    { m: 0, w: 3.3, h: 50.0, hc: 34.5 },
    { m: 1, w: 4.5, h: 54.7, hc: 37.3 },
    { m: 2, w: 5.6, h: 58.4, hc: 39.1 },
    { m: 3, w: 6.4, h: 61.4, hc: 40.5 },
    { m: 4, w: 7.0, h: 63.9, hc: 41.6 },
    { m: 5, w: 7.5, h: 65.9, hc: 42.6 },
    { m: 6, w: 7.9, h: 67.6, hc: 43.3 },
    { m: 7, w: 8.3, h: 69.2, hc: 44.0 },
    { m: 8, w: 8.6, h: 70.6, hc: 44.5 },
    { m: 9, w: 8.9, h: 72.0, hc: 45.0 },
    { m: 10, w: 9.2, h: 73.3, hc: 45.4 },
    { m: 11, w: 9.4, h: 74.5, hc: 45.8 },
    { m: 12, w: 9.6, h: 75.7, hc: 46.1 },
];

const SOFIA_LEGACY_GROWTH_ANCHORS = [
    ["2020-02-18", 49.2, 3.1, 34.0], ["2020-03-18", 53.7, 4.2, 36.6],
    ["2020-04-18", 57.1, 5.1, 38.2], ["2020-05-18", 59.8, 5.8, 39.5],
    ["2020-06-18", 62.1, 6.4, 40.6], ["2020-08-18", 65.7, 7.3, 42.2],
    ["2021-02-18", 74.0, 8.9, 45.0], ["2022-02-18", 86.0, 12.0, 48.0],
    ["2023-02-18", 95.0, 14.4, 49.0], ["2024-02-18", 103.0, 16.6, 49.5],
    ["2025-02-18", 110.0, 18.7, 50.0], ["2026-02-18", 116.0, 20.8, 50.5],
    ["2027-02-18", 122.5, 23.2, 51.0], ["2028-02-18", 128.5, 25.8, 51.4],
    ["2029-02-18", 134.0, 28.5, 51.8],
];

const SOFIA_GROWTH_ANCHORS = SOFIA_LEGACY_GROWTH_ANCHORS
    .map(([date, ...values]) => [
        ymd(addDays(new Date(`${date}T12:00:00.000Z`), SOFIA_DATE_SHIFT_DAYS)),
        ...values,
    ])
    .filter(([date]) => date <= ymd(TIMELINE_END));
SOFIA_GROWTH_ANCHORS.push(["2029-12-31", 103.5, 16.8, 49.6]);

const ELIAS_GROWTH_ANCHORS = [
    ...GROWTH_CURVE.map((g) => [ymd(addMonths(DOB, g.m)), g.h, g.w, g.hc]),
    [ymd(addMonths(DOB, 18)), 82.1, 11.0, 47.2], [ymd(addMonths(DOB, 24)), 87.0, 12.3, 48.0],
    [ymd(addMonths(DOB, 30)), 91.5, 13.4, 48.5], [ymd(addMonths(DOB, 36)), 96.0, 14.7, 49.0],
    [ymd(addMonths(DOB, 42)), 100.2, 15.8, 49.4], ["2029-12-31", 102.5, 16.5, 49.7],
];

const SOFIA_FOODS = [
    "Lugaw with egg", "Chicken tinola and rice", "Monggo with malunggay",
    "Bangus and vegetables", "Pancit with vegetables", "Fruit and yogurt",
    "Beef nilaga and rice", "Vegetable omelet", "Adobo, rice, and cucumber",
];
const ELIAS_FOODS = [
    "Mashed banana", "Lugaw with squash", "Avocado", "Sweet potato",
    "Chicken and rice", "Oats and yogurt", "Fish, rice, and vegetables",
    "Mango and oatmeal", "Vegetable omelet",
];

function dayCount(from, to) {
    return Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

function growthAt(anchors, date, phase) {
    const t = date.getTime();
    let left = anchors[0];
    let right = anchors[anchors.length - 1];
    for (let i = 1; i < anchors.length; i++) {
        if (t <= new Date(`${anchors[i][0]}T12:00:00.000Z`).getTime()) {
            left = anchors[i - 1];
            right = anchors[i];
            break;
        }
    }
    const a = new Date(`${left[0]}T12:00:00.000Z`).getTime();
    const b = new Date(`${right[0]}T12:00:00.000Z`).getTime();
    const ratio = Math.max(0, Math.min(1, (t - a) / Math.max(1, b - a)));
    const lerp = (index) => left[index] + (right[index] - left[index]) * ratio;
    const day = Math.round((t - new Date(`${anchors[0][0]}T12:00:00.000Z`).getTime()) / DAY_MS);
    return {
        height: round2(lerp(1) + Math.sin(day * 0.11 + phase) * 0.02),
        weight: round2(lerp(2) + Math.sin(day * 0.19 + phase) * 0.03),
        head: round2(lerp(3) + Math.sin(day * 0.07 + phase) * 0.01),
    };
}

function dailyGrowthRows(childId, dob, anchors, phase) {
    const rows = [];
    const birthday = ymd(dob).slice(5);
    const today = ymd(NOW);
    for (let date = new Date(dob); date <= TIMELINE_END; date = addDays(date, 1)) {
        const day = ymd(date);
        const value = growthAt(anchors, date, phase);
        const future = day > today;
        rows.push([
            childId, value.height, value.weight, value.head, day,
            day.slice(5) === birthday ? "clinic" : "home",
            future ? "Simulated future demo measurement." : "Daily demo measurement.",
        ]);
    }
    return rows;
}

function dailyNutritionRows(childId, dob, foods, phase) {
    const rows = [];
    const today = ymd(NOW);
    const pad = (n) => String(n).padStart(2, "0");
    for (let date = new Date(dob), dayIndex = 0; date <= TIMELINE_END; date = addDays(date, 1), dayIndex++) {
        const day = ymd(date);
        const ageDays = Math.floor((date.getTime() - dob.getTime()) / DAY_MS);
        const futureNote = day > today ? "Simulated future demo entry." : null;
        if (ageDays < 365) {
            const feeds = ageDays < 60 ? 7 : ageDays < 150 ? 6 : ageDays < 270 ? 5 : 4;
            for (let i = 0; i < feeds; i++) {
                const hour = Math.floor((24 / feeds) * i + ((dayIndex + i + phase) % 2));
                const milkType = ageDays < 270 ? "Breastmilk" : ageDays < 330 ? "Mixed" : "Formula";
                const breast = milkType === "Breastmilk";
                const formulaQuantity = breast ? null : 110 + ((dayIndex + i + phase) % 7) * 10;
                const breastmilkQuantity =
                    milkType === "Mixed" ? 50 + ((dayIndex + i + phase) % 4) * 10 : null;
                rows.push([
                    childId, "milk", milkType,
                    breast ? "breast" : "bottle", breast ? null : "Enfamil A+",
                    formulaQuantity, breast ? null : "mL",
                    breast ? 12 + ((dayIndex + i + phase) % 14) : null, null, null, null,
                    day, `${pad(hour)}:${pad((dayIndex * 7 + i * 11 + phase) % 60)}`, futureNote,
                    breast ? null : round2(formulaQuantity / 30), breastmilkQuantity,
                ]);
            }
            const solidMeals = ageDays < 183 ? 0 : ageDays < 240 ? 1 : ageDays < 300 ? 2 : 3;
            for (let i = 0; i < solidMeals; i++) {
                const mildReaction = ageDays === 240 && i === 0;
                rows.push([
                    childId, "solid", null, null, null, null, null, null,
                    mildReaction ? "Scrambled egg" : foods[(dayIndex + i * 3 + phase) % foods.length],
                    mildReaction ? "mild" : "none",
                    mildReaction ? "Mild rash around the mouth; resolved within hours." : null,
                    day, ["08:00", "12:00", "18:00"][i], futureNote, null, null,
                ]);
            }
        } else {
            // Keep the long-range demo useful without pretending an older
            // child still feeds like a newborn: two recorded milk servings a
            // day through age two, then one alongside regular meals.
            const milkFeeds = ageDays < 730 ? 2 : 1;
            for (let i = 0; i < milkFeeds; i++) {
                rows.push([
                    childId, "milk", "Formula", "bottle", "Growing-up milk",
                    180 + ((dayIndex + i + phase) % 4) * 20, "mL", null, null, null, null,
                    day, milkFeeds === 2 ? ["07:00", "19:30"][i] : "07:00", futureNote,
                    round2((180 + ((dayIndex + i + phase) % 4) * 20) / 30), null,
                ]);
            }
            for (let i = 0; i < 3; i++) {
                rows.push([
                    childId, "solid", null, null, null, null, null, null,
                    foods[(dayIndex + i * 3 + phase) % foods.length], "none", null,
                    day, ["07:30", "12:15", "18:30"][i], futureNote, null, null,
                ]);
            }
        }
    }
    return rows;
}

async function insertRows(client, table, columns, rows, batchSize = 400) {
    for (let start = 0; start < rows.length; start += batchSize) {
        const batch = rows.slice(start, start + batchSize);
        const values = batch.flat();
        const width = columns.length;
        const placeholders = batch.map((_, row) =>
            `(${columns.map((__, col) => `$${row * width + col + 1}`).join(",")})`
        );
        await client.query(
            `INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders.join(",")}`,
            values
        );
    }
}

// Sofia's original showcase was authored against her former 2020 birth date.
// Shift those sparse event dates by the same amount as her birthday so their
// recorded ages stay truthful, then trim anything beyond the requested demo
// horizon. Daily growth and nutrition are regenerated separately below.
const CHILD_DATE_SPECS = [
    ["medication_doses", ["given_date"], "given_date"],
    ["vaccinations", ["due_date", "date_given"], "due_date"],
    ["checkups", ["checkup_date"], "checkup_date"],
    ["medical_history", ["date_recorded", "resolved_date"], "date_recorded"],
    ["milestones", ["date_recorded"], "date_recorded"],
    ["memories", ["date_recorded"], "date_recorded"],
    ["calendar_events", ["event_date"], "event_date"],
    ["reminders", ["reminder_date"], "reminder_date"],
];

async function shiftSofiaHistory(client, childId) {
    for (const [table, columns, primaryDate] of CHILD_DATE_SPECS) {
        await client.query(
            `UPDATE ${table}
             SET ${columns.map((column) => `${column} = ${column} + $2::int`).join(", ")}
             WHERE child_id = $1`,
            [childId, SOFIA_DATE_SHIFT_DAYS]
        );
        await client.query(
            `DELETE FROM ${table} WHERE child_id = $1 AND ${primaryDate} > $2::date`,
            [childId, ymd(TIMELINE_END)]
        );
    }
}

async function removePrebirthActivity(client, childId, dob) {
    for (const [table, , primaryDate] of CHILD_DATE_SPECS) {
        await client.query(
            `DELETE FROM ${table} WHERE child_id = $1 AND ${primaryDate} < $2::date`,
            [childId, ymd(dob)]
        );
    }
}

async function seed() {
    let childId; // captured for use after the transaction commits (QR share step)
    try {
        requireDemoReseedConfirmation();
        await withTransaction(async (c) => {
            await c.query("DELETE FROM users WHERE email = $1", [DEMO_EMAIL]);

            // ---------------- USER (parent) ----------------
            const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
            const u = await c.query(
                // The phone was "+1 555-0148" -- a US number on the demo
                // account of an app built for Philippine families. Now a PH
                // mobile in the format a parent would actually type.
                `INSERT INTO users
                    (full_name, email, password_hash, phone_number, relationship, city, created_at,
                     consent_accepted, consent_date, consent_reviewed_at, retention_until)
                 VALUES ($1,$2,$3,$4,$5,$6,$7, TRUE, DATE '2020-01-05', DATE '2026-01-05', DATE '2032-01-05') RETURNING id`,
                [
                    "Jasmine Rivera",
                    DEMO_EMAIL,
                    hash,
                    "0917 555 0148",
                    "mother",
                    "Quezon City",
                    new Date("2020-01-05T12:00:00.000Z"),
                ]
            );
            const userId = u.rows[0].id;

            // ---------------- CHILD ----------------
            const child = await c.query(
                `INSERT INTO children
                    (user_id, first_name, last_name, date_of_birth, time_of_birth, sex, blood_type,
                     birth_weight, birth_length, place_of_birth, hospital, obgyne_name, pediatrician_name,
                     emergency_contact, preferred_health_center, avatar_url, allergies, hereditary_conditions,
                     created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
                 RETURNING id`,
                [
                    userId, "Elias", "Rivera", ymd(DOB), "03:47", "Male", "O+",
                    3.3, 50.0, "Metro General Hospital", "Metro General Hospital",
                    "Dr. Angela Cruz", "Dr. Michael Tan", "Daniel Rivera (Father) — +1 555-0199",
                    "Metro General Pediatric Clinic",
                    "https://images.unsplash.com/photo-1596870230751-ebdfce98ec42?q=80&w=300&auto=format&fit=crop",
                    JSON.stringify(["Mild egg sensitivity"]),
                    JSON.stringify(["Asthma (paternal grandfather)"]),
                    DOB,
                ]
            );
            childId = child.rows[0].id;

            // ---------------- SOFIA: 2020-2026 ----------------
            // Her earlier created_at makes her the default profile, so the
            // demo opens on the requested female child and exercises the
            // real multi-child switcher immediately.
            const sofia = await c.query(
                `INSERT INTO children
                    (user_id, first_name, last_name, nickname, date_of_birth, time_of_birth, sex,
                     blood_type, birth_weight, birth_length, place_of_birth, hospital, obgyne_name,
                     pediatrician_name, emergency_contact, preferred_health_center, avatar_url,
                     allergies, hereditary_conditions, created_at)
                 VALUES ($1,'Sofia','Rivera','Sofi',$2::date,'07:18','Female','A+',3.10,49.20,
                         'Quezon City','St. Luke''s Medical Center Quezon City','Dr. Angela Cruz',
                         'Dr. Michael Tan','Daniel Rivera (Father) - 0918 555 0199',
                         'Barangay Health Center - South Triangle',$3,'[]'::jsonb,
                         '["Hypertension (maternal grandmother)"]'::jsonb,$2::date::timestamptz)
                 RETURNING id`,
                [userId, ymd(SOFIA_DOB), demoPhoto("sofia-profile")]
            );
            const sofiaId = sofia.rows[0].id;

            const sofiaVaccines = [
                ["BCG", "Birth Dose", "2020-02-18", "2020-02-18", "Given before discharge."],
                ["Hepatitis B", "Birth Dose", "2020-02-18", "2020-02-18", "Birth dose completed."],
                ["Pentavalent + OPV + PCV", "6 Week Visit", "2020-03-31", "2020-04-01", "Mild fever resolved the next day."],
                ["Pentavalent + OPV + PCV", "10 Week Visit", "2020-04-28", "2020-04-29", "No reaction noted."],
                ["Pentavalent + OPV + PCV", "14 Week Visit", "2020-05-26", "2020-05-27", "Primary series completed."],
                ["Inactivated Polio Vaccine", "14 Week Visit", "2020-05-26", "2020-05-27", "Given at the health center."],
                ["MMR", "9 Month Visit", "2020-11-18", "2020-11-19", "Dose recorded on vaccination card."],
                ["MMR", "12 Month Visit", "2021-02-18", "2021-02-20", "Second dose completed."],
                ["DTaP-IPV Booster", "Preschool Booster", "2024-02-20", "2024-02-21", "School-entry booster."],
                ["Influenza", "Annual Flu Vaccine", "2025-06-10", "2025-06-12", "Annual flu vaccination."],
            ];
            for (const [name, visit, due, given, notes] of sofiaVaccines) {
                await c.query(
                    `INSERT INTO vaccinations
                        (child_id, vaccine_name, visit_name, due_date, date_given, status, notes)
                     VALUES ($1,$2,$3,$4,$5,'completed',$6)`,
                    [sofiaId, name, visit, due, given, notes]
                );
            }

            const sofiaCheckups = [
                ["Newborn Checkup", "2020-02-21", "09:00", "Feeding well; weight check arranged."],
                ["Two Month Wellness Checkup", "2020-04-20", "09:30", "Good weight gain and head control."],
                ["Six Month Wellness Checkup", "2020-08-19", "10:00", "Ready to begin complementary foods."],
                ["First Birthday Wellness Checkup", "2021-02-19", "09:15", "Walking with support and growing steadily."],
                ["Two Year Wellness Checkup", "2022-02-22", "10:30", "Speech and motor development on track."],
                ["Three Year Wellness Checkup", "2023-02-20", "09:45", "Routine examination; no concerns."],
                ["Four Year Wellness Checkup", "2024-02-21", "10:15", "Vision, hearing, and school-readiness review."],
                ["Five Year Wellness Checkup", "2025-02-20", "09:30", "Healthy and active; school health form completed."],
                ["Six Year Wellness Checkup", "2026-02-18", "10:00", "Final BabyBook+ annual review; growth remains steady."],
            ];
            for (const [title, date, time, notes] of sofiaCheckups) {
                await c.query(
                    `INSERT INTO checkups
                        (child_id, title, checkup_date, time_of_visit, doctor_name, clinic, status, notes)
                     VALUES ($1,$2,$3,$4,'Dr. Michael Tan','Metro General Pediatric Clinic','completed',$5)`,
                    [sofiaId, title, date, time, notes]
                );
            }

            const sofiaGrowth = [
                ["2020-02-18", 49.2, 3.10, 34.0], ["2020-03-18", 53.7, 4.20, 36.6],
                ["2020-04-18", 57.1, 5.10, 38.2], ["2020-05-18", 59.8, 5.80, 39.5],
                ["2020-06-18", 62.1, 6.40, 40.6], ["2020-07-18", 64.0, 6.90, 41.5],
                ["2020-08-18", 65.7, 7.30, 42.2], ["2020-09-18", 67.3, 7.60, 42.8],
                ["2020-10-18", 68.7, 7.90, 43.3], ["2020-11-18", 70.1, 8.20, 43.8],
                ["2020-12-18", 71.5, 8.50, 44.2], ["2021-01-18", 72.8, 8.70, 44.6],
                ["2021-02-18", 74.0, 8.90, 45.0], ["2022-02-18", 86.0, 12.00, 48.0],
                ["2023-02-18", 95.0, 14.40, 49.0], ["2024-02-18", 103.0, 16.60, 49.5],
                ["2025-02-18", 110.0, 18.70, 50.0], ["2026-02-18", 116.0, 20.80, 50.5],
            ];
            for (const [date, height, weight, head] of sofiaGrowth) {
                await c.query(
                    `INSERT INTO growth_records
                        (child_id, height, weight, head_circumference, date_recorded, measured_at, notes)
                     VALUES ($1,$2,$3,$4,$5,'clinic','Measured during a scheduled wellness visit.')`,
                    [sofiaId, height, weight, head, date]
                );
            }

            await c.query(
                `INSERT INTO medical_history
                    (child_id, category, title, description, date_recorded, resolved, resolved_date,
                     care_level, facility, notes, dose_amount, frequency_per_day, dose_times,
                     course_days, prescribed_by)
                 VALUES
                  ($1,'Illness','Roseola','Three days of fever followed by a light rash.','2020-10-06',TRUE,'2020-10-11','doctor','Metro General Pediatric Clinic','Recovered fully.',NULL,NULL,NULL,NULL,NULL),
                  ($1,'Illness','Hand, Foot and Mouth Disease','Mouth sores and spots on hands.','2022-07-14',TRUE,'2022-07-21','doctor','Barangay Health Center - South Triangle','Rested at home and stayed hydrated.',NULL,NULL,NULL,NULL,NULL),
                  ($1,'Medication','Paracetamol','Given for fever during hand, foot and mouth disease.','2022-07-14',TRUE,'2022-07-18',NULL,NULL,'Four-day course completed.','5 mL',3,'["08:00","14:00","20:00"]'::jsonb,4,'Dr. Michael Tan'),
                  ($1,'Allergy','No known drug allergies','Reviewed during annual wellness visits.','2024-02-21',FALSE,NULL,NULL,NULL,'No drug allergy reported.',NULL,NULL,NULL,NULL,NULL),
                  ($1,'Illness','Seasonal Flu','Fever, cough, and fatigue.','2025-08-04',TRUE,'2025-08-10','home',NULL,'Recovered with fluids and rest.',NULL,NULL,NULL,NULL,NULL)`,
                [sofiaId]
            );
            await c.query(
                `UPDATE medical_history medicine
                 SET treats_id = illness.id
                 FROM medical_history illness
                 WHERE medicine.child_id = $1 AND illness.child_id = $1
                   AND medicine.title = 'Paracetamol'
                   AND illness.title = 'Hand, Foot and Mouth Disease'`,
                [sofiaId]
            );
            await c.query(
                `INSERT INTO medication_doses
                    (child_id, medication_id, given_date, given_time, notes)
                 SELECT $1, id, dose.day::date, dose.at::time, 'Dose given as directed.'
                 FROM medical_history
                 CROSS JOIN (VALUES
                    ('2022-07-14','08:00'), ('2022-07-14','14:00'),
                    ('2022-07-14','20:00'), ('2022-07-15','08:00')
                 ) AS dose(day, at)
                 WHERE child_id = $1 AND title = 'Paracetamol'`,
                [sofiaId]
            );

            const sofiaMilestones = [
                ["Smiles responsively", "2 months", "2020-04-16", "Smiled whenever Mama sang."],
                ["Rolls from tummy to back", "4 months", "2020-06-20", "Rolled over during tummy time."],
                ["Sits without support", "7 months", "2020-09-19", "Sat steadily with her toys."],
                ["Waves bye-bye", "10 months", "2020-12-17", "Waved to Lola on a video call."],
                ["First Steps", "13 months", "2021-03-22", "Walked from the sofa to Mama."],
                ["First two-word phrase", "21 months", "2021-11-20", "Said more milk clearly."],
                ["Names familiar objects", "2 years", "2022-02-24", "Named animals in her picture book."],
                ["Pedals a tricycle", "3 years", "2023-04-02", "Pedaled across the courtyard."],
                ["Draws a person", "4 years", "2024-05-12", "Drew the whole family."],
                ["Starts kindergarten", "5 years", "2025-06-09", "First day of kindergarten."],
            ];
            for (const [title, age, date, description] of sofiaMilestones) {
                await c.query(
                    `INSERT INTO milestones
                        (child_id, title, age_achieved, description, date_recorded, is_completed, photo_url)
                     VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
                    [sofiaId, title, age, description, date, demoPhoto(`sofia-${date}`)]
                );
            }

            const sofiaNutrition = [
                ["milk", "Breastmilk", "breast", null, null, 18, null, "2020-03-05", "06:20", null, null],
                ["milk", "Breastmilk", "breast", null, null, 22, null, "2020-05-12", "09:10", null, null],
                ["milk", "Mixed", "bottle", 150, "mL", null, "Enfamil A+", "2020-08-22", "14:00", null, null],
                ["solid", null, null, null, null, null, null, "2020-08-25", "12:00", "Rice cereal", "none"],
                ["solid", null, null, null, null, null, null, "2020-09-08", "12:15", "Mashed banana", "none"],
                ["solid", null, null, null, null, null, null, "2020-10-02", "11:45", "Sweet potato", "none"],
                ["solid", null, null, null, null, null, null, "2020-11-12", "12:30", "Scrambled egg", "none"],
                ["solid", null, null, null, null, null, null, "2021-01-10", "12:00", "Soft chicken and rice", "none"],
                ["solid", null, null, null, null, null, null, "2021-03-15", "12:20", "Mango slices", "none"],
            ];
            for (const row of sofiaNutrition) {
                await c.query(
                    `INSERT INTO nutrition_records
                        (child_id, entry_type, milk_type, feed_method, quantity, unit,
                         duration_minutes, formula_brand, entry_date, entry_time,
                         food_introduced, reaction_severity)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                    [sofiaId, ...row]
                );
            }

            const sofiaMemories = [
                ["2020-02-22", "Welcome Home, Sofia", "Our first weekend together."],
                ["2021-02-20", "First Birthday", "A small garden celebration with family."],
                ["2022-12-18", "Christmas Helper", "She decorated the lowest branches herself."],
                ["2023-06-04", "First Bike Ride", "Practiced pedaling with Papa."],
                ["2024-05-12", "Family Portrait", "Her drawing included the new baby in Mama's tummy."],
                ["2025-08-24", "Meeting Baby Elias", "Proud big sister at the hospital."],
                ["2026-02-18", "Sixth Birthday", "Pancakes, balloons, and her favorite purple dress."],
            ];
            for (const [date, caption, notes] of sofiaMemories) {
                await c.query(
                    `INSERT INTO memories (child_id, photo_url, caption, notes, date_recorded)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [sofiaId, demoPhoto(`sofia-memory-${date}`), caption, notes, date]
                );
            }

            const sofiaEvents = [
                ["2020-11-29", "Christening", "Family celebration after the parish service."],
                ["2021-12-19", "Family Christmas Photos", "Annual family photo session."],
                ["2022-10-22", "Cousins Playdate", "Afternoon at Quezon Memorial Circle."],
                ["2023-06-04", "First Bike Practice", "Bring helmet and water bottle."],
                ["2024-12-14", "Preschool Program", "School holiday presentation."],
                ["2025-06-09", "First Day of Kindergarten", "Uniform and school supplies prepared."],
                ["2026-02-18", "Sixth Birthday Picnic", "Family picnic after her wellness visit."],
            ];
            for (const [date, title, description] of sofiaEvents) {
                await c.query(
                    `INSERT INTO calendar_events
                        (child_id, title, description, event_type, event_date, event_time, reminder_settings)
                     VALUES ($1,$2,$3,'custom',$4,'10:00','{"leadDays":3}'::jsonb)`,
                    [sofiaId, title, description, date]
                );
            }

            await c.query(
                `INSERT INTO reminders (child_id, reminder_type, title, reminder_date, status)
                 VALUES
                  ($1,'Vaccination','Nine-month MMR','2020-11-18','Completed'),
                  ($1,'Checkup','Two Year Wellness Checkup','2022-02-22','Completed'),
                  ($1,'Checkup','Six Year Wellness Checkup','2026-02-18','Completed')`,
                [sofiaId]
            );

            // ================= VACCINATIONS =================
            // Bundled by well-visit, matching the style already used in seed.js.
            const vaxRows = [
                [childId, "HepB (Hepatitis B)", "Birth Dose", ymd(DOB), ymd(DOB), "completed", "Given at Metro General before discharge."],
                [childId, "DTaP, IPV, Hib, PCV13", "2 Month Wellness", ymd(addMonths(DOB, 2)), ymd(jitterDays(addMonths(DOB, 2), 2)), "completed", "No adverse reaction; mild fussiness for a day."],
                [childId, "Rotavirus (RV1)", "2 Month Wellness", ymd(addMonths(DOB, 2)), ymd(jitterDays(addMonths(DOB, 2), 2)), "completed", "Oral dose, tolerated well."],
                [childId, "DTaP, IPV, Hib, PCV13", "4 Month Wellness", ymd(addMonths(DOB, 4)), ymd(jitterDays(addMonths(DOB, 4), 2)), "completed", "Routine, no issues."],
                [childId, "Rotavirus (RV1)", "4 Month Wellness", ymd(addMonths(DOB, 4)), ymd(jitterDays(addMonths(DOB, 4), 2)), "completed", "Second oral dose."],
                [childId, "DTaP, IPV, Hib, HepB, PCV13", "6 Month Wellness", ymd(addMonths(DOB, 6)), ymd(jitterDays(addMonths(DOB, 6), 3)), "completed", "Slight low-grade fever that evening, resolved by morning."],
                [childId, "Rotavirus (RV1) — Final Dose", "6 Month Wellness", ymd(addMonths(DOB, 6)), ymd(jitterDays(addMonths(DOB, 6), 3)), "completed", "Series complete."],
                [childId, "MMR (Measles, Mumps, Rubella)", "12 Month Wellness", ymd(addMonths(DOB, 12)), ymd(jitterDays(addMonths(DOB, 12), 2)), "completed", "Given with Varicella and HepA."],
                [childId, "Varicella (Chickenpox) + HepA (Dose 1)", "12 Month Wellness", ymd(addMonths(DOB, 12)), ymd(jitterDays(addMonths(DOB, 12), 2)), "completed", "No reaction observed."],
                [childId, "DTaP, Hib (Booster)", "15 Month Wellness", ymd(addMonths(DOB, 15)), null, "scheduled", "Upcoming — book with Dr. Tan."],
            ];
            for (const row of vaxRows) {
                await c.query(
                    `INSERT INTO vaccinations (child_id, vaccine_name, visit_name, due_date, date_given, status, notes)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    row
                );
            }

            // ================= CHECKUPS =================
            const wellVisits = [0, 2, 4, 6, 9, 12];
            for (const m of wellVisits) {
                const date = jitterDays(addMonths(DOB, m), 2);
                await c.query(
                    `INSERT INTO checkups (child_id, title, checkup_date, time_of_visit, doctor_name, clinic, status, notes)
                     VALUES ($1,$2,$3,$4,$5,$6,'completed',$7)`,
                    [
                        childId,
                        m === 0 ? "Newborn Discharge Checkup" : `${m} Month Wellness Checkup`,
                        ymd(date),
                        pick(["09:00", "09:30", "10:15", "14:00", "15:30"]),
                        "Dr. Michael Tan",
                        "Metro General Pediatric Clinic",
                        m === 0
                            ? "Healthy newborn, feeding well, cleared for discharge."
                            : "Growing well, met developmental milestones for age. No concerns.",
                    ]
                );
            }
            // Two sick visits, tied to the illnesses in medical_history below.
            await c.query(
                `INSERT INTO checkups (child_id, title, checkup_date, time_of_visit, doctor_name, clinic, status, notes)
                 VALUES
                  ($1,'Sick Visit — Cold Symptoms',$2,'11:00','Dr. Michael Tan','Metro General Pediatric Clinic','completed','Runny nose, mild cough, low fever. Advised rest and fluids, no medication needed.'),
                  ($1,'Sick Visit — Ear Pain & Fever',$3,'16:30','Dr. Michael Tan','Metro General Pediatric Clinic','completed','Diagnosed with otitis media. Prescribed amoxicillin, 10-day course.')`,
                [childId, ymd(addMonths(DOB, 5)), ymd(addMonths(DOB, 9.5))]
            );
            // One upcoming, not-yet-completed checkup.
            await c.query(
                `INSERT INTO checkups (child_id, title, checkup_date, time_of_visit, doctor_name, clinic, status, notes)
                 VALUES ($1,'15 Month Wellness Checkup',$2,'10:00','Dr. Michael Tan','Metro General Pediatric Clinic','scheduled','Bring vaccination card.')`,
                [childId, ymd(addMonths(DOB, 15))]
            );
            // Extra past visits (relative to now) to fill out a busy, lived-in
            // year of appointment history.
            await c.query(
                `INSERT INTO checkups (child_id, title, checkup_date, time_of_visit, doctor_name, clinic, status, notes)
                 VALUES
                  ($1,'Newborn Jaundice Follow-up',$2,'09:15','Dr. Michael Tan','Metro General Pediatric Clinic','completed','Bilirubin normalized. No phototherapy needed.'),
                  ($1,'Lactation & Feeding Consultation',$3,'10:30','Nurse Aida Reyes','Barangay Health Center — Sampaloc','completed','Latching improved. Continue exclusive breastfeeding.'),
                  ($1,'Sick Visit — Diaper Rash',$4,'15:00','Dr. Michael Tan','Metro General Pediatric Clinic','completed','Mild contact dermatitis. Advised barrier cream.'),
                  ($1,'Pediatric Dental — First Tooth Check',$5,'13:30','Dr. Liza Gomez','BrightSmile Pediatric Dental','completed','First lower incisors erupting. Gum care discussed.'),
                  ($1,'Sick Visit — Fever & Teething',$6,'16:45','Dr. Michael Tan','Metro General Pediatric Clinic','completed','Low-grade fever from teething. Fluids and rest advised.'),
                  ($1,'Growth & Nutrition Review',$7,'11:00','Dr. Michael Tan','Metro General Pediatric Clinic','completed','On track with WHO growth curve. Introduced more solids.')`,
                [
                    childId,
                    ymd(addMonths(NOW, -11)),
                    ymd(addMonths(NOW, -10)),
                    ymd(addMonths(NOW, -7)),
                    ymd(addMonths(NOW, -5)),
                    ymd(addMonths(NOW, -3)),
                    ymd(addMonths(NOW, -1)),
                ]
            );
            // Several months of advance (scheduled) appointments so the calendar
            // and appointments list look actively planned into the future.
            await c.query(
                `INSERT INTO checkups (child_id, title, checkup_date, time_of_visit, doctor_name, clinic, status, notes)
                 VALUES
                  ($1,'Follow-up — Growth & Nutrition',$2,'10:00','Dr. Michael Tan','Metro General Pediatric Clinic','scheduled','Recheck weight and discuss toddler diet.'),
                  ($1,'Pediatric Dental — Routine Cleaning',$3,'13:00','Dr. Liza Gomez','BrightSmile Pediatric Dental','scheduled','Routine cleaning and fluoride varnish.'),
                  ($1,'18-Month Wellness Checkup',$4,'09:30','Dr. Michael Tan','Metro General Pediatric Clinic','scheduled','Bring vaccination card and growth diary.'),
                  ($1,'Vaccination Visit — MMR & Varicella',$5,'14:00','Dr. Michael Tan','Metro General Pediatric Clinic','scheduled','MMR and Varicella booster doses due.'),
                  ($1,'Developmental Screening — Speech & Motor',$6,'10:45','Dr. Elena Cruz','Child Development Center — QC','scheduled','Routine milestone and speech assessment.'),
                  ($1,'Nutritionist Consult — Toddler Meal Plan',$7,'15:15','RND Karen Lim','Metro General Nutrition Unit','scheduled','Plan balanced toddler meals; iron-rich foods.'),
                  ($1,'21-Month Wellness Checkup',$8,'09:00','Dr. Michael Tan','Metro General Pediatric Clinic','scheduled','General wellness and growth review.')`,
                [
                    childId,
                    ymd(addDays(NOW, 14)),
                    ymd(addMonths(NOW, 1)),
                    ymd(addMonths(NOW, 2)),
                    ymd(addMonths(NOW, 3)),
                    ymd(addMonths(NOW, 4)),
                    ymd(addMonths(NOW, 5)),
                    ymd(addMonths(NOW, 6)),
                ]
            );
            // ================= CALENDAR EVENTS (custom) =================
            // Parent-created personal events (baptism, playdates, haircut...) —
            // a past + upcoming mix so the calendar's custom-event layer looks
            // actively used, not empty. reminder_settings matches the app shape
            // ({ leadDays }). Title/description are plaintext (decrypt is
            // pass-through), same as every other seeded row.
            await c.query(
                `INSERT INTO calendar_events (child_id, title, description, event_type, event_date, event_time, reminder_settings)
                 VALUES
                  ($1,'Baptism / Christening','Family gathering and blessing at the parish, followed by lunch.','custom',$2,'08:00','{"leadDays":7}'::jsonb),
                  ($1,'First Playdate with Cousins','Met cousins at the village playground — lots of giggles.','custom',$3,'15:30','{"leadDays":1}'::jsonb),
                  ($1,'Baby''s First Haircut','First trim at the mall salon; kept a lock of hair as a keepsake.','custom',$4,'11:00','{"leadDays":0}'::jsonb),
                  ($1,'Grandma Visits from the Province','Lola staying over for the weekend.','custom',$5,NULL,'{"leadDays":1}'::jsonb),
                  ($1,'Family Photo Session','Studio shoot booked in the afternoon — bring the blue outfit.','custom',$6,'15:00','{"leadDays":3}'::jsonb),
                  ($1,'Toddler Swim Class Trial','Trial class at the community pool.','custom',$7,'10:00','{"leadDays":3}'::jsonb)`,
                [
                    childId,
                    ymd(addMonths(NOW, -6)),
                    ymd(addMonths(NOW, -3)),
                    ymd(addMonths(NOW, -1)),
                    ymd(addDays(NOW, 10)),
                    ymd(addMonths(NOW, 1)),
                    ymd(addMonths(NOW, 2)),
                ]
            );

            // ================= MEDICAL HISTORY =================
            //
            // Every illness and the hospital stay carry a resolved_date, so the
            // lists and the healthcare professional's view show real durations
            // ("6 days", "2 days") rather than a bare start date. Before
            // migration 005 there was nowhere to put the end date and no way
            // for the app to set `resolved` at all, so a reviewer opening the
            // demo met a year of old colds presented as still happening.
            //
            // care_level records what the family DID, not how bad it was.
            const coldStart = addMonths(DOB, 5);
            const earStart = addMonths(DOB, 9.5);
            const jaundiceStart = addDays(DOB, 2);
            await c.query(
                `INSERT INTO medical_history
                    (child_id, category, title, description, date_recorded, resolved,
                     resolved_date, care_level, facility, notes,
                     dose_amount, frequency_per_day, dose_times, course_days, prescribed_by)
                 VALUES
                  ($1,'Hereditary Condition','Asthma (Paternal Grandfather)','Family history noted at birth.',$2,FALSE,NULL,NULL,NULL,'Monitor for wheezing or respiratory symptoms.',NULL,NULL,NULL,NULL,NULL),
                  ($1,'Illness','Common Cold','Runny nose, mild cough, low-grade fever.',$3,TRUE,$4,'home',NULL,'Resolved within a week with rest and fluids.',NULL,NULL,NULL,NULL,NULL),
                  ($1,'Allergy','Mild Egg Sensitivity','Slight rash around the mouth after first egg exposure.',$5,FALSE,NULL,NULL,NULL,'Pediatrician says likely mild; continue small exposures and monitor.',NULL,NULL,NULL,NULL,NULL),
                  ($1,'Illness','Ear Infection (Otitis Media)','Fussiness, tugging at ear, fever up to 38.4°C.',$6,TRUE,$7,'doctor','Metro General Pediatric Clinic','Treated with amoxicillin; follow-up exam clear.',NULL,NULL,NULL,NULL,NULL),
                  -- A finished course: real amount, frequency and length, so the
                  -- Finished list shows "10 days" rather than a bare date.
                  ($1,'Medication','Amoxicillin','Give with food. Finish the whole course even if he seems better.',$6,TRUE,$7,NULL,NULL,'10-day course completed, no side effects.','5 mL',2,$10,10,'Dr. Michael Tan'),
                  -- A course running RIGHT NOW, so the tab demonstrates the dose
                  -- tracker on a part-finished day instead of an empty state.
                  ($1,'Medication','Paracetamol (Biogesic)','For fever above 38°C. Not more than four doses in a day.',$11,FALSE,NULL,NULL,NULL,NULL,'2.5 mL',3,$12,5,NULL),
                  ($1,'Hospitalization','Neonatal Jaundice — Phototherapy','Elevated bilirubin noted before discharge; kept an extra day for phototherapy.',$8,TRUE,$9,NULL,'Metro General Hospital','Levels normalized; cleared by pediatrician, see Newborn Jaundice Follow-up checkup.',NULL,NULL,NULL,NULL,NULL)`,
                [
                    childId,
                    ymd(DOB),
                    ymd(coldStart),
                    ymd(addDays(coldStart, 6)),
                    ymd(addMonths(DOB, 8)),
                    ymd(earStart),
                    ymd(addDays(earStart, 10)),
                    ymd(jaundiceStart),
                    ymd(addDays(jaundiceStart, 2)),
                    JSON.stringify(["08:00", "20:00"]),
                    ymd(addDays(NOW, -1)),
                    JSON.stringify(["08:00", "14:00", "20:00"]),
                ]
            );

            // Link the antibiotic to the infection it treated, and record the
            // doses already given for the course that is still running. Titles
            // are seeded as plaintext (decryptRow passes unencrypted values
            // straight through), so they can be matched on directly here.
            const earRow = (
                await c.query(
                    `SELECT id FROM medical_history WHERE child_id = $1 AND title = 'Ear Infection (Otitis Media)' LIMIT 1`,
                    [childId]
                )
            ).rows[0];
            const amoxRow = (
                await c.query(
                    `SELECT id FROM medical_history WHERE child_id = $1 AND title = 'Amoxicillin' LIMIT 1`,
                    [childId]
                )
            ).rows[0];
            const paraRow = (
                await c.query(
                    `SELECT id FROM medical_history WHERE child_id = $1 AND title = 'Paracetamol (Biogesic)' LIMIT 1`,
                    [childId]
                )
            ).rows[0];
            if (earRow && amoxRow) {
                await c.query(`UPDATE medical_history SET treats_id = $1 WHERE id = $2`, [
                    earRow.id,
                    amoxRow.id,
                ]);
            }
            if (paraRow) {
                // Yesterday complete, today one of three — the state a parent
                // is actually in when they open the app mid-course.
                const doseRows = [
                    [ymd(addDays(NOW, -1)), "08:00"],
                    [ymd(addDays(NOW, -1)), "14:00"],
                    [ymd(addDays(NOW, -1)), "20:00"],
                    [ymd(NOW), "08:00"],
                ];
                for (const [d, t] of doseRows) {
                    await c.query(
                        `INSERT INTO medication_doses (child_id, medication_id, given_date, given_time)
                         VALUES ($1,$2,$3,$4)`,
                        [childId, paraRow.id, d, t]
                    );
                }
            }

            // ================= GROWTH RECORDS =================
            for (const g of GROWTH_CURVE) {
                const date = jitterDays(addMonths(DOB, g.m), 2);
                if (date > NOW) continue; // don't record future measurements
                await c.query(
                    `INSERT INTO growth_records (child_id, height, weight, head_circumference, date_recorded)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [
                        childId,
                        round1(g.h + (random() * 0.6 - 0.3)),
                        round2(g.w + (random() * 0.2 - 0.1)),
                        round1(g.hc + (random() * 0.4 - 0.2)),
                        ymd(date),
                    ]
                );
            }

            // ================= MILESTONES =================
            const PHOTO = (seed) => `https://picsum.photos/seed/babybook-${seed}/600/600`;
            // Six of these are spelled EXACTLY as the app's Development
            // Checklist spells them (front-end/utils/milestoneChecklist.js), so
            // they tick its boxes. Matching is case- and spacing-insensitive
            // but never fuzzy, so a near-miss silently ticks nothing — which is
            // how the demo once ended up showing empty checkboxes beside eleven
            // achieved milestones.
            //
            // Two of the six ("Waves bye-bye", "Pulls up to stand") are in the
            // CDC 12-month band on purpose. The demo child is about a year old,
            // so that is the band the Milestones tab opens on — without them a
            // reviewer would land on a screen with nothing ticked and conclude
            // the matching is broken.
            //
            // The rest are deliberately NOT on the checklist. They are the
            // free-text milestones a parent types themselves, they keep the
            // Gallery reading like a family's own words rather than a clinical
            // list, and they exercise the half of the feature the checklist
            // cannot reach. Note CDC's 2022 revision dropped crawling entirely,
            // which is exactly why a parent needs to be able to type it.
            const milestoneRows = [
                ["Seems happy to see you when you walk up to them", 1.5, "Smiled back for the first time during morning feeding.", true, PHOTO("smile")],
                ["Holds head up when on tummy", 2, "Lifted head and chest during tummy time.", true, null],
                ["Rolls from tummy to back", 4, "Surprised us during playtime on the mat.", true, PHOTO("rollover")],
                ["Sits without support", 6, "Sat up steady for a full minute.", true, PHOTO("sit")],
                ["Started Solid Foods", 6, "First taste of rice cereal — mixed reaction, mostly wore it.", true, PHOTO("solids")],
                ["Crawling", 8.5, "Full-speed crawl across the living room.", true, null],
                ['Waves "bye-bye"', 10, "Waved at grandma on a video call.", true, null],
                ["Pulls up to stand", 9.5, "Pulled up on the couch, very proud of himself.", true, PHOTO("stand")],
                ["First Word (\"Mama\")", 11, "Said it clearly, twice, then went back to babbling.", true, PHOTO("word")],
                ["Cruising Along Furniture", 11.5, "Cruising from the couch to the coffee table.", true, null],
                ["First Steps", 12.5, "Three wobbly steps before plopping down laughing.", true, PHOTO("steps")],
            ];
            for (const [title, m, desc, done, photo] of milestoneRows) {
                const date = jitterDays(addMonths(DOB, m), 3);
                if (date > NOW) continue;
                await c.query(
                    `INSERT INTO milestones (child_id, title, age_achieved, description, date_recorded, is_completed, photo_url)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [childId, title, `${m} months`, desc, ymd(date), done, photo]
                );
            }
            // One in-progress milestone (not yet achieved) so the checklist feels alive.
            await c.query(
                `INSERT INTO milestones (child_id, title, age_achieved, description, is_completed)
                 VALUES ($1,'Says 2-3 Words Together', NULL, 'Working on it — currently just single words.', FALSE)`,
                [childId]
            );

            // ================= NUTRITION: solid-food introductions =================
            // `severity` is the structured field the app counts and filters on;
            // `reaction` is only the description of one, so it stays null when
            // nothing happened rather than holding the string "None".
            const solidRows = [
                [6, "Rice Cereal", "none", null, "First solid food."],
                [6.5, "Mashed Banana", "none", null, null],
                [7, "Avocado", "none", null, null],
                [7.5, "Sweet Potato", "none", null, null],
                [8, "Scrambled Egg", "mild", "Mild rash around mouth — resolved within hours", "Discussed with pediatrician; continue monitoring."],
                [8.5, "Pureed Chicken", "none", null, null],
                [9, "Oats & Yogurt", "none", null, null],
                [10, "Peanut Butter (thinned)", "none", null, "Introduced per pediatrician guidance, watched closely."],
                [11, "Soft Finger Foods", "none", null, null],
                [12, "Table Foods", "none", null, "Three meals + two snacks a day now."],
            ];
            for (const [m, food, severity, reaction, notes] of solidRows) {
                const date = jitterDays(addMonths(DOB, m), 2);
                if (date > NOW) continue;
                await c.query(
                    `INSERT INTO nutrition_records
                        (child_id, entry_type, food_introduced, reaction_severity, reaction, entry_date, entry_time, notes)
                     VALUES ($1,'solid',$2,$3,$4,$5,'12:00',$6)`,
                    [childId, food, severity, reaction, ymd(date), notes]
                );
            }

            // ================= MEMORIES =================
            const memoryRows = [
                [0, "Coming Home", "Our first night as a family of three.", PHOTO("home")],
                [1, "First Bath", "He hated it for the first 30 seconds, then loved it.", PHOTO("bath")],
                [2, "Meeting Grandma", "Grandma flew in and cried happy tears.", PHOTO("grandma")],
                [3.5, "Sunday Nap", "Fell asleep mid-tummy-time, too cute not to capture.", PHOTO("nap")],
                [5, "First Cold, First Cuddles", "Rough week, lots of extra snuggling.", PHOTO("cuddle")],
                [6, "First Taste of Solids", "The face he made was priceless.", PHOTO("taste")],
                [7.5, "Beach Day", "First trip to the beach with the whole family.", PHOTO("beach")],
                [9, "Halloween Costume", "Dressed up as a tiny pumpkin.", PHOTO("costume")],
                [10.5, "Bath Time Giggles", "Discovered splashing is the best game ever.", PHOTO("giggles")],
                [12, "First Birthday", "Cake everywhere. Absolutely worth it.", PHOTO("birthday")],
                [12.5, "First Steps Caught on Camera", "Barely got the phone up in time.", PHOTO("firststeps")],
            ];
            for (const [m, caption, notes, photo] of memoryRows) {
                const date = jitterDays(addMonths(DOB, m), 2);
                if (date > NOW) continue;
                await c.query(
                    `INSERT INTO memories (child_id, photo_url, caption, notes, date_recorded)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [childId, photo, caption, notes, ymd(date)]
                );
            }

            // ================= RECORD ATTACHMENTS (seed demo photo) =================
            // A single local placeholder image stands in for the mandatory
            // supporting photo on one representative record of each of the 5
            // attachment-required types. Uploaded once to Supabase Storage
            // (see utils/storage.js) so it survives redeploys like every other
            // attachment now does — no more relying on a static /uploads route
            // (see Documents/plans/BabyBook+_Web_Demo_Hosting_Migration_Plan.md,
            // Risk 1). Put your own JPG/PNG at
            // back-end/uploads/seed/sample-record.jpg — the filename below
            // must match exactly; if it's missing, these 5 records are simply
            // seeded without an attachment.
            async function seedAttachmentRef(filename) {
                const filePath = path.join(__dirname, "../../uploads/seed", filename);
                if (!fs.existsSync(filePath)) return null;
                const buffer = fs.readFileSync(filePath);
                const ext = path.extname(filename).replace(/^\./, "");
                return storage.uploadFile(buffer, "image/jpeg", ext);
            }
            const SEED_PHOTO = await seedAttachmentRef("sample-record.jpg");

            const hepBVax = (await c.query(
                `SELECT id FROM vaccinations WHERE child_id = $1 AND vaccine_name = 'HepB (Hepatitis B)' LIMIT 1`,
                [childId]
            )).rows[0];
            const earCheckup = (await c.query(
                `SELECT id FROM checkups WHERE child_id = $1 AND title = 'Sick Visit — Ear Pain & Fever' LIMIT 1`,
                [childId]
            )).rows[0];
            const earIllness = (await c.query(
                `SELECT id FROM medical_history WHERE child_id = $1 AND title = 'Ear Infection (Otitis Media)' LIMIT 1`,
                [childId]
            )).rows[0];
            const amoxMed = (await c.query(
                `SELECT id FROM medical_history WHERE child_id = $1 AND title = 'Amoxicillin' LIMIT 1`,
                [childId]
            )).rows[0];
            const jaundiceHosp = (await c.query(
                `SELECT id FROM medical_history WHERE child_id = $1 AND title = 'Neonatal Jaundice — Phototherapy' LIMIT 1`,
                [childId]
            )).rows[0];

            const attachTargets = [
                hepBVax && ["vaccination", hepBVax.id],
                earCheckup && ["checkup", earCheckup.id],
                earIllness && ["illness", earIllness.id],
                amoxMed && ["medication", amoxMed.id],
                jaundiceHosp && ["hospitalization", jaundiceHosp.id],
            ].filter(Boolean);

            if (SEED_PHOTO) {
                for (const [recordType, recordId] of attachTargets) {
                    await c.query(
                        `INSERT INTO record_attachments (child_id, record_type, record_id, file_url) VALUES ($1,$2,$3,$4)`,
                        [childId, recordType, recordId, SEED_PHOTO]
                    );
                }
            }

            // ================= REMINDERS =================
            const vax15 = (await c.query(
                `SELECT id FROM vaccinations WHERE child_id = $1 AND status = 'scheduled' LIMIT 1`,
                [childId]
            )).rows[0];
            const checkup15 = (await c.query(
                `SELECT id FROM checkups WHERE child_id = $1 AND status = 'scheduled' LIMIT 1`,
                [childId]
            )).rows[0];
            await c.query(
                `INSERT INTO reminders (child_id, reminder_type, title, reminder_date, status, vaccination_id)
                 VALUES ($1,'Vaccination','DTaP, Hib Booster due',$2,'Pending',$3)`,
                [childId, ymd(addMonths(DOB, 15)), vax15 ? vax15.id : null]
            );
            await c.query(
                `INSERT INTO reminders (child_id, reminder_type, title, reminder_date, status, checkup_id)
                 VALUES ($1,'Checkup','15 Month Wellness Checkup',$2,'Pending',$3)`,
                [childId, ymd(addMonths(DOB, 15)), checkup15 ? checkup15.id : null]
            );
            await c.query(
                `INSERT INTO reminders (child_id, reminder_type, title, reminder_date, status)
                 VALUES ($1,'Checkup','12 Month Wellness Checkup',$2,'Completed')`,
                [childId, ymd(addMonths(DOB, 12))]
            );

            // ================= NUTRITION: daily milk intake (drives the charts) =================
            // Age-appropriate frequency/volume and milk type by month. The milk type
            // transitions over time so the "duration per milk type" analytics have
            // clear consecutive periods (Breastmilk -> Mixed -> Formula).
            function milkPlanFor(ageMonths) {
                if (ageMonths < 2) return { perDay: 7, ml: [80, 110] };
                if (ageMonths < 5) return { perDay: 6, ml: [110, 150] };
                if (ageMonths < 9) return { perDay: 5, ml: [150, 180] };
                return { perDay: 4, ml: [180, 240] };
            }
            function milkTypeFor(ageMonths) {
                if (ageMonths < 9) return { milk_type: "Breastmilk", brand: null };
                if (ageMonths < 12) return { milk_type: "Mixed", brand: "Enfamil A+" };
                return { milk_type: "Formula", brand: "Enfamil A+" };
            }
            // How each feed was given. Breastmilk months are fed at the breast
            // (minutes + side, no volume); formula is always a bottle. The
            // Mixed months genuinely mix the two within a single day, which is
            // what a mixed-fed baby looks like and what exercises the app's
            // "this day has both kinds" handling.
            function methodFor(milkType, index) {
                if (milkType === "Breastmilk") return "breast";
                if (milkType === "Formula") return "bottle";
                return index % 2 === 0 ? "breast" : "bottle";
            }
            function ageMonthsAt(date) {
                return (date.getTime() - DOB.getTime()) / (30.44 * DAY_MS);
            }
            const pad2 = (n) => String(n).padStart(2, "0");

            async function logDay(dayStart) {
                const ageM = ageMonthsAt(dayStart);
                if (ageM < 0) return;
                const mp = milkPlanFor(ageM);
                const mt = milkTypeFor(ageM);
                for (let i = 0; i < mp.perDay; i++) {
                    const hour = Math.round((24 / mp.perDay) * i + random() * 1.5);
                    const fedAt = new Date(dayStart.getTime() + hour * 60 * 60 * 1000);
                    if (fedAt > NOW) continue;
                    const time = `${pad2(fedAt.getHours())}:${pad2(fedAt.getMinutes())}`;
                    const method = methodFor(mt.milk_type, i);
                    if (method === "breast") {
                        // Roughly one feed in five has no duration, because
                        // that is what real use looks like — the field is
                        // optional and a parent logging a night feed hours
                        // later genuinely does not know the minutes. The
                        // charts have to stay readable against that.
                        const mins = i % 5 === 0 ? null : 10 + Math.round(random() * 15);
                        await c.query(
                            `INSERT INTO nutrition_records
                                (child_id, entry_type, milk_type, feed_method, duration_minutes, entry_date, entry_time)
                             VALUES ($1,'milk',$2,'breast',$3,$4,$5)`,
                            [childId, mt.milk_type, mins, ymd(fedAt), time]
                        );
                    } else {
                        const ml = Math.round(mp.ml[0] + random() * (mp.ml[1] - mp.ml[0]));
                        await c.query(
                            `INSERT INTO nutrition_records
                                (child_id, entry_type, milk_type, feed_method, formula_brand, quantity, unit, entry_date, entry_time)
                             VALUES ($1,'milk',$2,'bottle',$3,$4,'mL',$5,$6)`,
                            [childId, mt.milk_type, mt.brand, ml, ymd(fedAt), time]
                        );
                    }
                }
            }

            // Dense recent window — last 45 days, every day.
            for (let d = 45; d >= 0; d--) {
                await logDay(addDays(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()), -d));
            }
            // Sparse historical sample — 2 representative days per earlier month.
            for (let m = 0; m <= 10; m++) {
                const monthStart = addMonths(DOB, m);
                if (NOW.getTime() - monthStart.getTime() < 46 * DAY_MS) continue; // already covered above
                await logDay(jitterDays(addDays(monthStart, 8), 3));
                await logDay(jitterDays(addDays(monthStart, 20), 3));
            }

            // ================= ELIAS: SIMULATED 2027-2029 =================
            // The user explicitly requested completed future history to inspect
            // long-range screens. These are demo-only rows, never clinical claims.
            const futureVaccines = [
                ["DTaP, Hib Booster", "18 Month Wellness", ymd(addMonths(DOB, 18)), ymd(addDays(addMonths(DOB, 18), 1)), "Booster completed during wellness visit."],
                ["Hepatitis A - Dose 2", "18 Month Wellness", ymd(addMonths(DOB, 18)), ymd(addDays(addMonths(DOB, 18), 1)), "Two-dose series completed."],
                ["Influenza", "Annual Flu Vaccine", "2027-06-15", "2027-06-16", "Annual flu vaccination."],
                ["Influenza", "Annual Flu Vaccine", "2028-06-14", "2028-06-15", "Annual flu vaccination."],
                ["Influenza", "Annual Flu Vaccine", "2029-09-12", "2029-09-13", "Annual flu vaccination."],
            ];
            for (const [name, visit, due, given, notes] of futureVaccines) {
                await c.query(
                    `INSERT INTO vaccinations
                        (child_id, vaccine_name, visit_name, due_date, date_given, status, notes)
                     VALUES ($1,$2,$3,$4,$5,'completed',$6)`,
                    [childId, name, visit, due, given, notes]
                );
            }

            const futureCheckups = [
                ["18 Month Wellness Checkup", ymd(addMonths(DOB, 18)), "09:30", "Growth and language development reviewed."],
                ["Two Year Wellness Checkup", ymd(addMonths(DOB, 24)), "10:00", "Active toddler; sleep and nutrition discussed."],
                ["Pediatric Dental Checkup", ymd(addMonths(DOB, 30)), "13:30", "Routine cleaning and fluoride varnish."],
                ["Three Year Wellness Checkup", ymd(addMonths(DOB, 36)), "09:45", "Vision, hearing, and development on track."],
                ["Pediatric Dental Checkup", ymd(addMonths(DOB, 42)), "13:00", "Routine cleaning; brushing habits reviewed."],
            ];
            for (const [title, date, time, notes] of futureCheckups) {
                await c.query(
                    `INSERT INTO checkups
                        (child_id, title, checkup_date, time_of_visit, doctor_name, clinic, status, notes)
                     VALUES ($1,$2,$3,$4,'Dr. Michael Tan','Metro General Pediatric Clinic','completed',$5)`,
                    [childId, title, date, time, notes]
                );
            }

            const futureGrowth = [
                ["2027-02-22", 82.1, 11.0, 47.2], ["2027-08-23", 87.0, 12.3, 48.0],
                ["2028-02-19", 91.5, 13.4, 48.5], ["2028-08-22", 96.0, 14.7, 49.0],
                ["2029-02-20", 100.2, 15.8, 49.4], ["2029-08-22", 104.5, 17.0, 49.8],
                ["2029-11-10", 106.1, 17.6, 50.0],
            ];
            for (const [date, height, weight, head] of futureGrowth) {
                await c.query(
                    `INSERT INTO growth_records
                        (child_id, height, weight, head_circumference, date_recorded, measured_at, notes)
                     VALUES ($1,$2,$3,$4,$5,'clinic','Measured during a scheduled visit.')`,
                    [childId, height, weight, head, date]
                );
            }

            await c.query(
                `INSERT INTO medical_history
                    (child_id, category, title, description, date_recorded, resolved, resolved_date,
                     care_level, facility, notes, dose_amount, frequency_per_day, dose_times,
                     course_days, prescribed_by)
                 VALUES
                  ($1,'Illness','Viral Upper Respiratory Infection','Runny nose and mild cough.','2027-11-04',TRUE,'2027-11-10','home',NULL,'Rest, fluids, and monitoring.',NULL,NULL,NULL,NULL,NULL),
                  ($1,'Illness','Hand, Foot and Mouth Disease','Low fever and small mouth sores.','2028-05-07',TRUE,'2028-05-14','doctor','Metro General Pediatric Clinic','Recovered fully after home care.',NULL,NULL,NULL,NULL,NULL),
                  ($1,'Medication','Paracetamol','Used for fever during hand, foot and mouth disease.','2028-05-07',TRUE,'2028-05-10',NULL,NULL,'Three-day course completed.','5 mL',3,'["08:00","14:00","20:00"]'::jsonb,3,'Dr. Michael Tan'),
                  ($1,'Illness','Seasonal Flu','Fever, cough, and tiredness.','2029-01-12',TRUE,'2029-01-18','doctor','Barangay Health Center - South Triangle','Recovered without complications.',NULL,NULL,NULL,NULL,NULL)`,
                [childId]
            );

            const futureMilestones = [
                ["Uses a spoon independently", "19 months", ymd(addMonths(DOB, 19)), "Finished most of breakfast without help."],
                ["Combines two words", "22 months", ymd(addMonths(DOB, 22)), "Asked for more milk using two words."],
                ["Runs confidently", "2 years", ymd(addMonths(DOB, 24)), "Ran across the park to his sister."],
                ["Completes a simple puzzle", "2 years 7 months", ymd(addMonths(DOB, 31)), "Finished a six-piece animal puzzle."],
                ["Pedals a tricycle", "3 years", ymd(addMonths(DOB, 36)), "Pedaled around the courtyard."],
                ["Tells a short story", "3 years 6 months", ymd(addMonths(DOB, 42)), "Retold his favorite bedtime story."],
            ];
            for (const [title, age, date, description] of futureMilestones) {
                await c.query(
                    `INSERT INTO milestones
                        (child_id, title, age_achieved, description, date_recorded, is_completed, photo_url)
                     VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
                    [childId, title, age, description, date, demoPhoto(`elias-${date}`)]
                );
            }

            const futureFoods = [
                ["2027-02-04", "Chicken tinola with soft vegetables", "none", null],
                ["2027-06-12", "Mango yogurt", "none", null],
                ["2027-11-18", "Pancit with finely cut vegetables", "none", null],
                ["2028-04-08", "Peanut butter sandwich", "none", null],
                ["2028-10-21", "Grilled bangus and rice", "none", null],
                ["2029-03-16", "Vegetable omelet", "none", null],
                ["2029-09-28", "Fresh lumpia", "none", null],
            ];
            for (const [date, food, severity, reaction] of futureFoods) {
                await c.query(
                    `INSERT INTO nutrition_records
                        (child_id, entry_type, food_introduced, reaction_severity, reaction,
                         entry_date, entry_time, notes)
                     VALUES ($1,'solid',$2,$3,$4,$5,'12:00','Family meal; age-appropriate serving.')`,
                    [childId, food, severity, reaction, date]
                );
            }

            const futureMemories = [
                ["2027-02-25", "Big Sister Story Time", "Sofia read his favorite animal book."],
                [ymd(addMonths(DOB, 24)), "Second Birthday", "A sunny backyard celebration."],
                ["2028-04-15", "First Zoo Visit", "He talked about the elephants all week."],
                ["2028-12-24", "Christmas Eve Pajamas", "Matching pajamas with Ate Sofia."],
                ["2029-06-08", "First Beach Sandcastle", "Built a lopsided castle with Papa."],
                [ymd(addMonths(DOB, 36)), "Third Birthday", "A dinosaur cake and cousins everywhere."],
            ];
            for (const [date, caption, notes] of futureMemories) {
                await c.query(
                    `INSERT INTO memories (child_id, photo_url, caption, notes, date_recorded)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [childId, demoPhoto(`elias-memory-${date}`), caption, notes, date]
                );
            }

            const futureEvents = [
                ["2027-04-17", "Family Day at La Mesa Eco Park", "Picnic and toddler play area."],
                ["2027-12-16", "Barangay Christmas Party", "Family program at the covered court."],
                ["2028-06-03", "Toddler Swim Class", "Weekend trial lesson at the community pool."],
                ["2028-12-08", "Family Photo Session", "Annual family portrait."],
                ["2029-06-08", "Beach Weekend", "Family trip to Batangas."],
                ["2029-12-14", "Preschool Holiday Program", "Bring costume before 8 AM."],
            ];
            for (const [date, title, description] of futureEvents) {
                await c.query(
                    `INSERT INTO calendar_events
                        (child_id, title, description, event_type, event_date, event_time, reminder_settings)
                     VALUES ($1,$2,$3,'custom',$4,'09:00','{"leadDays":3}'::jsonb)`,
                    [childId, title, description, date]
                );
            }

            await c.query(
                `INSERT INTO reminders (child_id, reminder_type, title, reminder_date, status)
                 VALUES
                  ($1,'Checkup','Two Year Wellness Checkup',$2,'Completed'),
                  ($1,'Checkup','Three Year Wellness Checkup',$3,'Completed'),
                  ($1,'Vaccination','Annual Flu Vaccine','2029-09-13','Completed')`,
                [childId, ymd(addMonths(DOB, 24)), ymd(addMonths(DOB, 36))]
            );

            // Sofia's preview continues alongside Elias instead of going
            // blank after the present-day records.
            await c.query(
                `INSERT INTO checkups
                    (child_id, title, checkup_date, time_of_visit, doctor_name, clinic, status, notes)
                 VALUES
                  ($1,'Seven Year Wellness Checkup','2027-02-19','09:30','Dr. Michael Tan','Metro General Pediatric Clinic','completed','Simulated demo review.'),
                  ($1,'Eight Year Wellness Checkup','2028-02-19','09:30','Dr. Michael Tan','Metro General Pediatric Clinic','completed','Simulated demo review.'),
                  ($1,'Nine Year Wellness Checkup','2029-02-19','09:30','Dr. Michael Tan','Metro General Pediatric Clinic','completed','Simulated demo review.')`,
                [sofiaId]
            );
            await c.query(
                `INSERT INTO vaccinations
                    (child_id, vaccine_name, visit_name, due_date, date_given, status, notes)
                 VALUES
                  ($1,'Influenza','Annual Flu Vaccine','2027-06-10','2027-06-11','completed','Simulated demo vaccination.'),
                  ($1,'Influenza','Annual Flu Vaccine','2028-06-10','2028-06-11','completed','Simulated demo vaccination.'),
                  ($1,'Influenza','Annual Flu Vaccine','2029-06-10','2029-06-11','completed','Simulated demo vaccination.')`,
                [sofiaId]
            );
            await c.query(
                `INSERT INTO milestones
                    (child_id, title, age_achieved, description, date_recorded, is_completed, photo_url)
                 VALUES
                  ($1,'Reads a chapter book','7 years','Finished her first chapter book independently.','2027-07-18',TRUE,$2),
                  ($1,'Learns to ride a bicycle','8 years','Completed a lap without training wheels.','2028-05-21',TRUE,$3),
                  ($1,'Joins the school science fair','9 years','Presented a seed-growth project.','2029-08-16',TRUE,$4)`,
                [sofiaId, demoPhoto("sofia-2027-reading"), demoPhoto("sofia-2028-bike"), demoPhoto("sofia-2029-science")]
            );
            await c.query(
                `INSERT INTO memories (child_id, photo_url, caption, notes, date_recorded)
                 VALUES
                  ($1,$2,'Family Reading Night','Simulated future demo memory.','2027-07-18'),
                  ($1,$3,'First Bike Ride','Simulated future demo memory.','2028-05-21'),
                  ($1,$4,'Science Fair Day','Simulated future demo memory.','2029-08-16')`,
                [sofiaId, demoPhoto("sofia-memory-2027"), demoPhoto("sofia-memory-2028"), demoPhoto("sofia-memory-2029")]
            );
            await c.query(
                `INSERT INTO calendar_events
                    (child_id, title, description, event_type, event_date, event_time, reminder_settings)
                 VALUES
                  ($1,'School Family Day','Simulated future demo event.','custom','2027-09-18','09:00','{"leadDays":3}'::jsonb),
                  ($1,'School Dental Day','Simulated future demo event.','custom','2028-08-12','10:00','{"leadDays":3}'::jsonb),
                  ($1,'Science Fair','Simulated future demo event.','custom','2029-08-16','08:00','{"leadDays":3}'::jsonb)`,
                [sofiaId]
            );

            await shiftSofiaHistory(c, sofiaId);
            await removePrebirthActivity(c, sofiaId, SOFIA_DOB);
            await removePrebirthActivity(c, childId, DOB);

            // Replace the sparse showcase rows with the requested daily
            // timelines. Batching keeps the remote pooler to a few dozen
            // round trips instead of one request per record.
            await c.query(`DELETE FROM growth_records WHERE child_id = ANY($1::int[])`, [[sofiaId, childId]]);
            await c.query(`DELETE FROM nutrition_records WHERE child_id = ANY($1::int[])`, [[sofiaId, childId]]);

            const dailyGrowth = [
                ...dailyGrowthRows(sofiaId, SOFIA_DOB, SOFIA_GROWTH_ANCHORS, 3),
                ...dailyGrowthRows(childId, DOB, ELIAS_GROWTH_ANCHORS, 11),
            ];
            await insertRows(
                c,
                "growth_records",
                ["child_id", "height", "weight", "head_circumference", "date_recorded", "measured_at", "notes"],
                dailyGrowth
            );

            const dailyNutrition = [
                ...dailyNutritionRows(sofiaId, SOFIA_DOB, SOFIA_FOODS, 3),
                ...dailyNutritionRows(childId, DOB, ELIAS_FOODS, 11),
            ];
            await insertRows(
                c,
                "nutrition_records",
                [
                    "child_id", "entry_type", "milk_type", "feed_method", "formula_brand",
                    "quantity", "unit", "duration_minutes", "food_introduced", "reaction_severity", "reaction",
                    "entry_date", "entry_time", "notes", "formula_scoops", "breastmilk_quantity",
                ],
                dailyNutrition
            );

            console.log("[seed:demo] core records committed.");
        });

        // ================= ONE PAST QR CONSULTATION SHARE =================
        // Run after the transaction commits: buildSnapshot() (shared app code,
        // not seed-only) reads through the plain pool connection, so it needs
        // to see already-committed vaccination/growth/etc. rows for this child.
        const childRow = (await query(`SELECT * FROM children WHERE id = $1`, [childId])).rows[0];
        const keys = ["profile", "vaccinations", "growth", "allergies"];
        const payload = await buildSnapshot(childRow, keys);
        const code = generateCode();
        const share = (
            await query(
                `INSERT INTO shared_records
                    (child_id, code, qr_payload, shared_record_keys, payload, generate_date, expiration_date, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,'expired') RETURNING id`,
                [
                    childId,
                    code,
                    qrPayloadForCode(code),
                    JSON.stringify(keys),
                    JSON.stringify(payload),
                    addMonths(DOB, 9.5).toISOString(),
                    addDays(addMonths(DOB, 9.5), 1).toISOString(),
                ]
            )
        ).rows[0];
        await query(
            `INSERT INTO access_logs (share_id, child_id, code, professional_name, action, access_date)
             VALUES ($1,$2,$3,'Dr. Michael Tan','viewed',$4)`,
            [share.id, childId, code, addMonths(DOB, 9.5).toISOString()]
        );

        await verifyDemoSeed();

        console.log("[seed:demo] done.");
        console.log(`[seed:demo] children: Sofia Rivera (${ymd(SOFIA_DOB)}) and Elias Rivera (${ymd(DOB)})`);
        console.log(`[seed:demo] login with  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}`);
    } catch (err) {
        console.error("[seed:demo] failed:", err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

module.exports = {
    dayCount,
    dailyGrowthRows,
    dailyNutritionRows,
    SOFIA_DOB,
    DOB,
    TIMELINE_END,
    SOFIA_GROWTH_ANCHORS,
    ELIAS_GROWTH_ANCHORS,
    SOFIA_FOODS,
    ELIAS_FOODS,
};

if (require.main === module) seed();
