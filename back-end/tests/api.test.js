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

    // A medicine is a course, not a one-line note. Before migration 006 the
    // record held a name and a free-text "dosage guidelines" string, the start
    // was forced to today, and there was nowhere at all to record that a dose
    // had actually been given.
    describe("medication tracking", () => {
        let medId;
        let illnessId;
        const post = (body) =>
            request(app)
                .post(`/api/children/${childId}/medical-history`)
                .set("Authorization", `Bearer ${token}`)
                .send(body);

        test("saves a full course", async () => {
            const ill = await post({ category: "Illness", title: "Ear Infection", date_recorded: "2026-04-01" });
            illnessId = ill.body.id;

            const res = await post({
                category: "Medication",
                title: "Amoxicillin",
                description: "Give with food.",
                date_recorded: "2026-04-02",
                dose_amount: "5 mL",
                frequency_per_day: 2,
                dose_times: ["08:00", "20:00"],
                course_days: 10,
                prescribed_by: "Dr. Tan",
                treats_id: illnessId,
            });
            expect(res.status).toBe(201);
            medId = res.body.id;
            expect(res.body.dose_amount).toBe("5 mL");
            expect(res.body.frequency_per_day).toBe(2);
            expect(res.body.course_days).toBe(10);
            expect(res.body.prescribed_by).toBe("Dr. Tan");
            expect(res.body.treats_id).toBe(illnessId);
            expect(res.body.dose_times).toEqual(["08:00", "20:00"]);
            // The start date is no longer forced to today.
            expect(String(res.body.date_recorded).slice(0, 10)).toBe("2026-04-02");
        });

        test("the free-text fields are encrypted at rest", async () => {
            const { rows } = await pool.query(
                "SELECT dose_amount, prescribed_by, frequency_per_day FROM medical_history WHERE id = $1",
                [medId],
            );
            expect(rows[0].dose_amount.startsWith("enc:v1:")).toBe(true);
            expect(rows[0].prescribed_by.startsWith("enc:v1:")).toBe(true);
            // The integer is deliberately NOT encrypted — ciphertext on a
            // number buys no privacy and blocks counting.
            expect(rows[0].frequency_per_day).toBe(2);
        });

        test("rejects a frequency outside the sane range", async () => {
            const res = await post({ category: "Medication", title: "X", frequency_per_day: 99 });
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        // "nobody answered" and "once a day" must stay distinguishable.
        test("an unanswered schedule is null, not a default", async () => {
            const res = await post({ category: "Medication", title: "Paracetamol" });
            expect(res.status).toBe(201);
            expect(res.body.frequency_per_day).toBeNull();
            expect(res.body.dose_amount).toBeNull();
            expect(res.body.course_days).toBeNull();
            expect(res.body.dose_times).toBeNull();
        });

        test("records and lists doses given", async () => {
            const a = await request(app)
                .post(`/api/children/${childId}/medication-doses`)
                .set("Authorization", `Bearer ${token}`)
                .send({ medication_id: medId, given_date: "2026-04-02", given_time: "08:00" });
            expect(a.status).toBe(201);
            expect(String(a.body.given_time).slice(0, 5)).toBe("08:00");

            await request(app)
                .post(`/api/children/${childId}/medication-doses`)
                .set("Authorization", `Bearer ${token}`)
                .send({ medication_id: medId, given_date: "2026-04-02", given_time: "20:00" });

            const list = await request(app)
                .get(`/api/children/${childId}/medication-doses`)
                .set("Authorization", `Bearer ${token}`);
            expect(list.status).toBe(200);
            expect(list.body.filter((d) => d.medication_id === medId).length).toBe(2);
        });

        // Tapping a filled slot undoes it — a double-tap has to be correctable.
        test("a dose can be removed again", async () => {
            const made = await request(app)
                .post(`/api/children/${childId}/medication-doses`)
                .set("Authorization", `Bearer ${token}`)
                .send({ medication_id: medId, given_date: "2026-04-03", given_time: "08:00" });
            const del = await request(app)
                .delete(`/api/children/${childId}/medication-doses/${made.body.id}`)
                .set("Authorization", `Bearer ${token}`);
            expect(del.status).toBe(204);
        });

        test("marking the course finished stores the end date", async () => {
            const res = await request(app)
                .put(`/api/children/${childId}/medical-history/${medId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ resolved: true, resolved_date: "2026-04-11" });
            expect(res.status).toBe(200);
            expect(res.body.resolved).toBe(true);
            expect(String(res.body.resolved_date).slice(0, 10)).toBe("2026-04-11");
            // A partial update must not wipe the course details.
            expect(res.body.dose_amount).toBe("5 mL");
            expect(res.body.frequency_per_day).toBe(2);
        });

        // Deleting the illness must not take the medicine with it — what the
        // child was given stays true regardless of why.
        test("removing the linked illness leaves the medicine, unlinked", async () => {
            await request(app)
                .delete(`/api/children/${childId}/medical-history/${illnessId}`)
                .set("Authorization", `Bearer ${token}`);
            const list = await request(app)
                .get(`/api/children/${childId}/medical-history`)
                .set("Authorization", `Bearer ${token}`);
            const med = list.body.find((m) => m.id === medId);
            expect(med).toBeTruthy();
            expect(med.treats_id).toBeNull();
        });

        // Doses belong to their medicine and go with it.
        test("doses cascade when the medicine is deleted", async () => {
            await request(app)
                .delete(`/api/children/${childId}/medical-history/${medId}`)
                .set("Authorization", `Bearer ${token}`);
            const { rows } = await pool.query(
                "SELECT count(*)::int n FROM medication_doses WHERE medication_id = $1",
                [medId],
            );
            expect(rows[0].n).toBe(0);
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

    // This block owns its OWN child, deliberately.
    //
    // It used to share the suite-wide `childId`, and asserted the snapshot held
    // exactly one vaccination. That was true when it was written and silently
    // stopped being true the moment the "vaccination detail" tests above were
    // added — they post four more vaccinations to that same child, so the count
    // became 5 and this test failed for a reason that had nothing to do with
    // QR sharing. A test that breaks when an unrelated test is added is not
    // testing what it claims to.
    //
    // With its own child the counts are exact and stay exact, so the assertions
    // can be specific again.
    describe("QR consultation share", () => {
        let shareChildId;
        let shareCode;
        let shareId;

        beforeAll(async () => {
            const create = await request(app)
                .post("/api/children")
                .set("Authorization", `Bearer ${token}`)
                .send({ first_name: "Rosa", last_name: "Share", blood_type: "A+", allergies: ["peanut"] });
            expect(create.status).toBe(201);
            shareChildId = create.body.id;

            const vax = await request(app)
                .post(`/api/children/${shareChildId}/vaccinations`)
                .set("Authorization", `Bearer ${token}`)
                .send({ vaccine_name: "BCG", visit_name: "At Birth", status: "completed", date_given: "2025-12-16" });
            expect(vax.status).toBe(201);
        });

        test("parent generates a share and a professional resolves it", async () => {
            const share = await request(app)
                .post(`/api/children/${shareChildId}/shares`)
                .set("Authorization", `Bearer ${token}`)
                .send({
                    recordKeys: ["profile", "vaccinations", "allergies"],
                    ttlMinutes: 60,
                    visitReason: "Cough for four days",
                });
            expect(share.status).toBe(201);
            shareCode = share.body.code;
            shareId = share.body.id;
            expect(shareCode).toBeTruthy();
            // The snapshot must never travel back to the parent's own client —
            // it has no use for it and it is the child's records in full.
            expect(share.body.payload).toBeUndefined();

            const resolve = await request(app)
                .post("/api/consult/resolve")
                .send({ code: shareCode, professionalName: "Dr. Chen" });
            expect(resolve.status).toBe(200);
            expect(resolve.body.status).toBe("ok");
            expect(resolve.body.payload.profile.name).toContain("Rosa");
            // Exactly one, and this child's own — no longer a hostage to what
            // other tests happen to create.
            expect(resolve.body.payload.vaccinations.length).toBe(1);
            expect(resolve.body.payload.vaccinations[0].vaccine_name).toBe("BCG");
            expect(resolve.body.payload.allergies.allergies).toContain("peanut");
            // The parent's reason for the visit reaches the professional.
            expect(resolve.body.payload.visitReason).toBe("Cough for four days");
        });

        test("the stored snapshot is encrypted at rest, not plaintext", async () => {
            // Straight to the column, past the API. The snapshot is a DECRYPTED
            // copy of records the rest of the schema protects, so if it lands in
            // the clear then field-level encryption has been bypassed for any
            // child who ever had a code generated.
            const { rows } = await pool.query(
                "SELECT payload FROM shared_records WHERE code = $1",
                [shareCode],
            );
            const stored = JSON.stringify(rows[0].payload);
            expect(stored).toContain("enc:v1:");
            expect(stored).not.toContain("Rosa");
            expect(stored).not.toContain("peanut");
            expect(stored).not.toContain("BCG");
        });

        test("the view is written to the parent's access log", async () => {
            const log = await request(app)
                .get(`/api/children/${shareChildId}/access-log`)
                .set("Authorization", `Bearer ${token}`);
            expect(log.status).toBe(200);
            expect(log.body[0].professional_name).toBe("Dr. Chen");
        });

        test("revoking stops resolution AND destroys the stored snapshot", async () => {
            await request(app)
                .post(`/api/children/${shareChildId}/shares/${shareId}/revoke`)
                .set("Authorization", `Bearer ${token}`);

            const after = await request(app).post("/api/consult/resolve").send({ code: shareCode });
            expect(after.status).toBe(410);
            expect(after.body.status).toBe("revoked");

            // Revoking withdraws access; leaving the readable copy behind would
            // honour the letter of that and not the intent.
            const { rows } = await pool.query(
                "SELECT payload FROM shared_records WHERE code = $1",
                [shareCode],
            );
            expect(rows[0].payload).toEqual({});
        });
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
