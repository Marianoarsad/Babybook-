// Integration tests for the BabyBook+ API.
// Requires a reachable PostgreSQL (point DATABASE_URL at a throwaway DB) and
// `npm install`. The suite migrates the schema fresh before running.
//
//   DATABASE_URL=postgres://...test npm test

const fs = require("fs");
const path = require("path");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const app = require("../src/app");
const { pool } = require("../src/db/pool");

beforeAll(async () => {
    const sql = fs.readFileSync(path.join(__dirname, "../src/db/schema.sql"), "utf8");
    await pool.query(sql);
});

afterAll(async () => {
    await pool.end();
});

describe("BabyBook+ API", () => {
    let token;
    let childId;

    test("health check", async () => {
        const res = await request(app).get("/api/health");
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test("register returns a token", async () => {
        const res = await request(app).post("/api/auth/register").send({
            fullName: "Test Parent",
            email: `t${Date.now()}@example.com`,
            password: "password123",
            consentAccepted: true,
        });
        expect(res.status).toBe(201);
        expect(res.body.token).toBeTruthy();
        token = res.body.token;
    });

    test("rejects unauthenticated child access", async () => {
        const res = await request(app).get("/api/children");
        expect(res.status).toBe(401);
    });

    test("creates and lists a child", async () => {
        const create = await request(app)
            .post("/api/children")
            .set("Authorization", `Bearer ${token}`)
            .send({ first_name: "Maya", last_name: "Chen", blood_type: "O+" });
        expect(create.status).toBe(201);
        childId = create.body.id;

        const list = await request(app)
            .get("/api/children")
            .set("Authorization", `Bearer ${token}`);
        expect(list.status).toBe(200);
        expect(list.body.length).toBe(1);
    });

    test("adds a vaccination record", async () => {
        const res = await request(app)
            .post(`/api/children/${childId}/vaccinations`)
            .set("Authorization", `Bearer ${token}`)
            .send({ vaccine_name: "HepB", visit_name: "Birth Dose", status: "completed", date_given: "2025-12-16" });
        expect(res.status).toBe(201);
        expect(res.body.vaccine_name).toBe("HepB");
    });

    // Nutrition branches on HOW the milk was given. Before feed_method
    // existed, every milk row demanded a quantity, so a parent feeding at the
    // breast had no way to record a feed except by inventing a number.
    describe("vaccination detail", () => {
        const post = (body) =>
            request(app)
                .post(`/api/children/${childId}/vaccinations`)
                .set("Authorization", `Bearer ${token}`)
                .send(body);

        test("saves a dose number in its own column", async () => {
            const res = await post({
                vaccine_name: "Pentavalent (DTwP-HepB-Hib) 2",
                due_date: "2026-03-12",
                status: "scheduled",
                dose_number: 2,
            });
            expect(res.status).toBe(201);
            expect(res.body.dose_number).toBe(2);
        });

        // The date a dose was actually given, which used to be forced to today.
        test("accepts a back-dated date_given", async () => {
            const created = await post({ vaccine_name: "BCG", status: "scheduled" });
            const res = await request(app)
                .put(`/api/children/${childId}/vaccinations/${created.body.id}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "completed", date_given: "2026-07-01" });
            expect(res.status).toBe(200);
            expect(String(res.body.date_given).slice(0, 10)).toBe("2026-07-01");
        });

        test("records a reaction and returns it decrypted", async () => {
            const created = await post({ vaccine_name: "MMR (Measles, Mumps, Rubella) 1" });
            const res = await request(app)
                .put(`/api/children/${childId}/vaccinations/${created.body.id}`)
                .set("Authorization", `Bearer ${token}`)
                .send({
                    status: "completed",
                    date_given: "2026-08-01",
                    reaction_severity: "mild",
                    reaction: "Slight fever overnight",
                });
            expect(res.status).toBe(200);
            expect(res.body.reaction_severity).toBe("mild");
            expect(res.body.reaction).toBe("Slight fever overnight");
        });

        test("rejects a severity outside the vocabulary", async () => {
            const res = await post({ vaccine_name: "OPV 1", reaction_severity: "catastrophic" });
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        // Rows predating migration 004 have neither field; "not recorded" and
        // "no reaction" must stay distinguishable.
        test("a vaccine with no reaction recorded returns null, not 'none'", async () => {
            const res = await post({ vaccine_name: "PCV 1", due_date: "2026-02-12" });
            expect(res.status).toBe(201);
            expect(res.body.reaction_severity).toBeNull();
            expect(res.body.dose_number).toBeNull();
        });

        test("the vaccine catalogue lists the DOH schedule", async () => {
            const res = await request(app)
                .get(`/api/children/vaccine-catalogue`)
                .set("Authorization", `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.vaccines)).toBe(true);
            const ipv = res.body.vaccines.find((v) => v.name === "IPV");
            // Verified 2026-08-16 against the 2026 PIDSP calendar: IPV is a
            // two-dose vaccine, which the schedule previously got wrong.
            expect(ipv.doses).toBe(2);
        });
    });

    // An illness and a hospital stay are the same row, and until migration 005
    // neither could ever END: the client wrote resolved=FALSE at creation and
    // had no way to write TRUE, so every past cold still claimed to be
    // happening on the Dashboard and in the professional's QR view.
    describe("medical event detail", () => {
        const post = (body) =>
            request(app)
                .post(`/api/children/${childId}/medical-history`)
                .set("Authorization", `Bearer ${token}`)
                .send(body);

        test("an illness can be closed with an end date", async () => {
            const created = await post({
                category: "Illness",
                title: "Common Cold",
                date_recorded: "2026-08-01",
                resolved: false,
            });
            expect(created.status).toBe(201);
            expect(created.body.resolved).toBe(false);
            expect(created.body.resolved_date).toBeNull();

            const res = await request(app)
                .put(`/api/children/${childId}/medical-history/${created.body.id}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ resolved: true, resolved_date: "2026-08-07" });
            expect(res.status).toBe(200);
            expect(res.body.resolved).toBe(true);
            expect(String(res.body.resolved_date).slice(0, 10)).toBe("2026-08-07");
        });

        // The date used to be forced to today by the client, so an illness
        // logged three days late was filed three days late.
        test("accepts a back-dated start", async () => {
            const res = await post({
                category: "Illness",
                title: "Ear Infection",
                date_recorded: "2026-06-15",
            });
            expect(res.status).toBe(201);
            expect(String(res.body.date_recorded).slice(0, 10)).toBe("2026-06-15");
        });

        test("records the care level", async () => {
            const res = await post({ category: "Illness", title: "Fever", care_level: "doctor" });
            expect(res.status).toBe(201);
            expect(res.body.care_level).toBe("doctor");
        });

        test("rejects a care level outside the vocabulary", async () => {
            const res = await post({ category: "Illness", title: "Fever", care_level: "witchcraft" });
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        // "nobody answered" and "cared for at home" must stay distinguishable.
        test("an unanswered care level is null, not 'home'", async () => {
            const res = await post({ category: "Illness", title: "Rash" });
            expect(res.status).toBe(201);
            expect(res.body.care_level).toBeNull();
            expect(res.body.resolved_date).toBeNull();
            expect(res.body.facility).toBeNull();
        });

        test("a hospital stay stores an encrypted facility and returns it decrypted", async () => {
            const created = await post({
                category: "Hospitalization",
                title: "Dengue admission",
                facility: "Cebu Doctors' University Hospital",
                date_recorded: "2026-05-02",
                resolved: true,
                resolved_date: "2026-05-06",
            });
            expect(created.status).toBe(201);
            expect(created.body.facility).toBe("Cebu Doctors' University Hospital");

            // Stored ciphertext, not plaintext.
            const { rows } = await pool.query(
                "SELECT facility FROM medical_history WHERE id = $1",
                [created.body.id],
            );
            expect(rows[0].facility.startsWith("enc:v1:")).toBe(true);
        });
    });

    describe("nutrition entries", () => {
        const post = (body) =>
            request(app)
                .post(`/api/children/${childId}/nutrition`)
                .set("Authorization", `Bearer ${token}`)
                .send(body);

        test("saves a breastfeed with minutes and no volume", async () => {
            const res = await post({
                entry_type: "milk",
                milk_type: "Breastmilk",
                feed_method: "breast",
                duration_minutes: 18,
                entry_date: "2026-08-15",
                entry_time: "14:20",
            });
            expect(res.status).toBe(201);
            expect(res.body.duration_minutes).toBe(18);
            expect(res.body.quantity).toBeNull();
        });

        // Duration is optional: a parent logging a 3am feed at 7am does not
        // know the minutes, and requiring them would only swap an invented
        // volume for an invented duration.
        test("saves a breastfeed with no duration at all", async () => {
            const res = await post({
                entry_type: "milk", milk_type: "Breastmilk", feed_method: "breast",
                entry_date: "2026-08-15", entry_time: "03:10",
            });
            expect(res.status).toBe(201);
            expect(res.body.duration_minutes).toBeNull();
            expect(res.body.quantity).toBeNull();
        });

        test("rejects a breastfeed that also carries a volume", async () => {
            const res = await post({
                entry_type: "milk", milk_type: "Breastmilk", feed_method: "breast",
                duration_minutes: 15, quantity: 120, unit: "mL",
            });
            expect(res.status).toBe(400);
        });

        test("saves a bottle feed with volume", async () => {
            const res = await post({
                entry_type: "milk", milk_type: "Formula", feed_method: "bottle",
                quantity: 120, unit: "mL", formula_brand: "Enfamil A+",
            });
            expect(res.status).toBe(201);
            expect(Number(res.body.quantity)).toBe(120);
            expect(res.body.formula_brand).toBe("Enfamil A+");
        });

        test("rejects a bottle feed with no quantity", async () => {
            const res = await post({
                entry_type: "milk", milk_type: "Formula", feed_method: "bottle", unit: "mL",
            });
            expect(res.status).toBe(400);
        });

        // A pre-migration client sends no feed_method at all. It has to keep
        // behaving exactly as it did, or every older app version breaks.
        test("a milk entry with no feed_method still uses the old rules", async () => {
            const ok = await post({
                entry_type: "milk", milk_type: "Breastmilk", quantity: 90, unit: "mL",
            });
            expect(ok.status).toBe(201);

            const bad = await post({ entry_type: "milk", milk_type: "Breastmilk" });
            expect(bad.status).toBe(400);
        });

        test("saves a solid with a structured reaction", async () => {
            const res = await post({
                entry_type: "solid",
                food_introduced: "Scrambled Egg",
                reaction_severity: "mild",
                reaction: "Rash around the mouth",
            });
            expect(res.status).toBe(201);
            expect(res.body.reaction_severity).toBe("mild");
            expect(res.body.food_introduced).toBe("Scrambled Egg");
        });

        test("rejects unknown enum values", async () => {
            const method = await post({
                entry_type: "milk", milk_type: "Breastmilk", feed_method: "telepathy", quantity: 90, unit: "mL",
            });
            expect(method.status).toBe(400);

            const severity = await post({
                entry_type: "solid", food_introduced: "Avocado", reaction_severity: "catastrophic",
            });
            expect(severity.status).toBe(400);
        });

        test("rejects an implausible duration", async () => {
            const res = await post({
                entry_type: "milk", milk_type: "Breastmilk", feed_method: "breast", duration_minutes: 600,
            });
            expect(res.status).toBe(400);
        });
    });

    test("full QR share -> resolve -> access-log flow", async () => {
        // parent creates a share
        const share = await request(app)
            .post(`/api/children/${childId}/shares`)
            .set("Authorization", `Bearer ${token}`)
            .send({ recordKeys: ["profile", "vaccinations"], ttlMinutes: 60 });
        expect(share.status).toBe(201);
        const code = share.body.code;
        expect(code).toBeTruthy();

        // professional resolves it (public, no auth)
        const resolve = await request(app)
            .post("/api/consult/resolve")
            .send({ code, professionalName: "Dr. Chen" });
        expect(resolve.status).toBe(200);
        expect(resolve.body.status).toBe("ok");
        expect(resolve.body.payload.profile.name).toContain("Maya");
        expect(resolve.body.payload.vaccinations.length).toBe(1);

        // access log recorded the view
        const log = await request(app)
            .get(`/api/children/${childId}/access-log`)
            .set("Authorization", `Bearer ${token}`);
        expect(log.status).toBe(200);
        expect(log.body[0].professional_name).toBe("Dr. Chen");

        // revoke -> no longer resolves
        await request(app)
            .post(`/api/children/${childId}/shares/${share.body.id}/revoke`)
            .set("Authorization", `Bearer ${token}`);
        const after = await request(app).post("/api/consult/resolve").send({ code });
        expect(after.status).toBe(410);
        expect(after.body.status).toBe("revoked");
    });

    test("blocks access to another user's child", async () => {
        const other = await request(app).post("/api/auth/register").send({
            fullName: "Other", email: `o${Date.now()}@example.com`, password: "password123", consentAccepted: true,
        });
        const res = await request(app)
            .get(`/api/children/${childId}/vaccinations`)
            .set("Authorization", `Bearer ${other.body.token}`);
        expect(res.status).toBe(404);
    });
});
