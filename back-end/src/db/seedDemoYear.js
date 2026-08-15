// Seeds a rich, ~1-year "lived-in" demo account so the app can be reviewed
// with realistic data before deployment — a full first year of growth,
// vaccinations, checkups, milestones, feeding history, an illness or two,
// daily feed/sleep logs, photo memories, and one past QR consultation share.
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

// ---------------------------------------------------------------------------
// Date helpers — everything is computed relative to "now" (at script run
// time) so the demo always looks current, not frozen to whenever this file
// was written.
// ---------------------------------------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date();

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
    return addDays(date, Math.round((Math.random() * 2 - 1) * maxDays));
}
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function round1(n) {
    return Math.round(n * 10) / 10;
}
function round2(n) {
    return Math.round(n * 100) / 100;
}

// Baby is a little over a year old — enough history for a full year of
// records, plus a couple of "upcoming" items so the app doesn't look frozen
// in the past (a 15-month checkup/vaccination still pending, etc.).
const DOB = addDays(addMonths(NOW, -12), -18);

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

async function seed() {
    let childId; // captured for use after the transaction commits (QR share step)
    try {
        await withTransaction(async (c) => {
            await c.query("DELETE FROM users WHERE email = $1", [DEMO_EMAIL]);

            // ---------------- USER (parent) ----------------
            const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
            const u = await c.query(
                `INSERT INTO users
                    (full_name, email, password_hash, phone_number, gender, created_at,
                     consent_accepted, consent_date, consent_reviewed_at, retention_until)
                 VALUES ($1,$2,$3,$4,$5,$6, TRUE, now(), now(), (CURRENT_DATE + INTERVAL '6 years')) RETURNING id`,
                ["Jasmine Rivera", DEMO_EMAIL, hash, "+1 555-0148", "Female", addDays(DOB, -7)]
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
            await c.query(
                `INSERT INTO medical_history (child_id, category, title, description, date_recorded, resolved, notes)
                 VALUES
                  ($1,'Hereditary Condition','Asthma (Paternal Grandfather)','Family history noted at birth.',$2,FALSE,'Monitor for wheezing or respiratory symptoms.'),
                  ($1,'Illness','Common Cold','Runny nose, mild cough, low-grade fever.',$3,TRUE,'Resolved within a week with rest and fluids.'),
                  ($1,'Allergy','Mild Egg Sensitivity','Slight rash around the mouth after first egg exposure.',$4,FALSE,'Pediatrician says likely mild; continue small exposures and monitor.'),
                  ($1,'Illness','Ear Infection (Otitis Media)','Fussiness, tugging at ear, fever up to 38.4°C.',$5,TRUE,'Treated with amoxicillin; follow-up exam clear.'),
                  ($1,'Medication','Amoxicillin','400mg/5mL suspension, twice daily.',$5,TRUE,'10-day course completed, no side effects.'),
                  ($1,'Hospitalization','Neonatal Jaundice — Phototherapy','Elevated bilirubin noted before discharge; kept an extra day for phototherapy.',$6,TRUE,'Levels normalized; cleared by pediatrician, see Newborn Jaundice Follow-up checkup.')`,
                [childId, ymd(DOB), ymd(addMonths(DOB, 5)), ymd(addMonths(DOB, 8)), ymd(addMonths(DOB, 9.5)), ymd(addDays(DOB, 2))]
            );

            // ================= GROWTH RECORDS =================
            for (const g of GROWTH_CURVE) {
                const date = jitterDays(addMonths(DOB, g.m), 2);
                if (date > NOW) continue; // don't record future measurements
                await c.query(
                    `INSERT INTO growth_records (child_id, height, weight, head_circumference, date_recorded)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [
                        childId,
                        round1(g.h + (Math.random() * 0.6 - 0.3)),
                        round2(g.w + (Math.random() * 0.2 - 0.1)),
                        round1(g.hc + (Math.random() * 0.4 - 0.2)),
                        ymd(date),
                    ]
                );
            }

            // ================= MILESTONES =================
            const PHOTO = (seed) => `https://picsum.photos/seed/babybook-${seed}/600/600`;
            const milestoneRows = [
                ["Social Smile", 1.5, "Smiled back for the first time during morning feeding.", true, PHOTO("smile")],
                ["Held Head Up (Tummy Time)", 2, "Lifted head and chest during tummy time.", true, null],
                ["Rolled Over (Tummy to Back)", 4, "Surprised us during playtime on the mat.", true, PHOTO("rollover")],
                ["Sat Without Support", 6, "Sat up steady for a full minute.", true, PHOTO("sit")],
                ["Started Solid Foods", 6, "First taste of rice cereal — mixed reaction, mostly wore it.", true, PHOTO("solids")],
                ["Crawling", 8.5, "Full-speed crawl across the living room.", true, null],
                ["Waved Bye-Bye", 10, "Waved at grandma on a video call.", true, null],
                ["Pulled to Stand", 9.5, "Pulled up on the couch, very proud of himself.", true, PHOTO("stand")],
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
                    const hour = Math.round((24 / mp.perDay) * i + Math.random() * 1.5);
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
                        const mins = i % 5 === 0 ? null : 10 + Math.round(Math.random() * 15);
                        await c.query(
                            `INSERT INTO nutrition_records
                                (child_id, entry_type, milk_type, feed_method, duration_minutes, entry_date, entry_time)
                             VALUES ($1,'milk',$2,'breast',$3,$4,$5)`,
                            [childId, mt.milk_type, mins, ymd(fedAt), time]
                        );
                    } else {
                        const ml = Math.round(mp.ml[0] + Math.random() * (mp.ml[1] - mp.ml[0]));
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

        console.log("[seed:demo] done.");
        console.log(`[seed:demo] baby: Elias Rivera, born ${ymd(DOB)} (~${Math.floor((NOW - DOB) / (30.44 * DAY_MS))} months old)`);
        console.log(`[seed:demo] login with  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}`);
    } catch (err) {
        console.error("[seed:demo] failed:", err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

seed();
