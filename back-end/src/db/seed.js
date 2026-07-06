// Seeds a demo parent + child with sample records so the app has data on first run.
// Mirrors the front-end mock data. Idempotent-ish: clears demo user first.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool, query, withTransaction } = require("./pool");

const DEMO_EMAIL = "sarah@example.com";
const DEMO_PASSWORD = "password123";

async function seed() {
    try {
        await withTransaction(async (c) => {
            await c.query("DELETE FROM users WHERE email = $1", [DEMO_EMAIL]);

            const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
            const u = await c.query(
                `INSERT INTO users
                    (full_name, email, password_hash, gender,
                     consent_accepted, consent_date, consent_reviewed_at, retention_until)
                 VALUES ($1, $2, $3, $4, TRUE, now(), now(), (CURRENT_DATE + INTERVAL '6 years')) RETURNING id`,
                ["Sarah Chen", DEMO_EMAIL, hash, "Female"]
            );
            const userId = u.rows[0].id;

            const child = await c.query(
                `INSERT INTO children
                    (user_id, first_name, last_name, date_of_birth, sex, blood_type,
                     birth_weight, birth_length, hospital, pediatrician_name, obgyne_name,
                     allergies, hereditary_conditions)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
                [
                    userId, "Maya", "Chen", "2025-12-16", "Female", "O+",
                    3.2, 49.0, "St. Jude Medical Center", "Dr. Sarah Chen", "Dr. James Miller",
                    JSON.stringify(["Penicillin"]), JSON.stringify(["Asthma (maternal)"]),
                ]
            );
            const childId = child.rows[0].id;

            await c.query(
                `INSERT INTO vaccinations (child_id, vaccine_name, visit_name, due_date, date_given, status, notes)
                 VALUES
                  ($1,'HepB (Hepatitis B)','Birth Dose','2025-12-16','2025-12-16','completed','Given at St. Jude'),
                  ($1,'DTaP, IPV, Hib, HepB, PCV13','4 Month Wellness','2026-04-16','2026-04-16','completed','Routine'),
                  ($1,'DTaP, IPV, Hib, HepB, PCV13, RV','6 Month Wellness','2026-06-16',NULL,'scheduled','Upcoming')`,
                [childId]
            );

            await c.query(
                `INSERT INTO growth_records (child_id, height, weight, head_circumference, date_recorded)
                 VALUES ($1,68.2,7.4,43.5,'2026-06-01')`,
                [childId]
            );

            await c.query(
                `INSERT INTO milestones (child_id, title, date_recorded, is_completed)
                 VALUES ($1,'First Smile','2026-02-14',TRUE),($1,'Rolled Over','2026-04-12',TRUE)`,
                [childId]
            );

            await c.query(
                `INSERT INTO checkups (child_id, title, doctor_name, clinic, checkup_date, status)
                 VALUES ($1,'6-Month Developmental Screening','Dr. Sarah Chen','St. Jude','2026-06-25','scheduled')`,
                [childId]
            );

            await c.query(
                `INSERT INTO medical_history (child_id, category, title, date_recorded, resolved)
                 VALUES ($1,'Allergy','Penicillin','2026-01-10',FALSE)`,
                [childId]
            );

            console.log("[seed] done.");
            console.log(`[seed] login with  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}`);
        });
    } catch (err) {
        console.error("[seed] failed:", err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

seed();
