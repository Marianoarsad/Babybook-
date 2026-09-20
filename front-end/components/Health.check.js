const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Exercise the actual deletion closure without loading React Native or a DB.
const source = fs.readFileSync(path.join(__dirname, "Health.js"), "utf8");
const match = source.match(/const deleteHealthRecord = async \(candidate = null\) => \{([\s\S]*?)\n    \};\n\n    const selectedHealthRecord/);
assert.ok(match, "Health deletion handler must be found");

async function check(kind, fail = false, busy = false, fromForm = false) {
    const state = {
        medications: [{ id: "1" }, { id: "2" }],
        illnesses: [{ id: "1" }, { id: "2" }],
        appts: [{ id: "1" }, { id: "2" }],
        vaccines: [{ id: "1" }, { id: "2" }],
        doses: [{ medicationId: "1" }, { medicationId: "2" }],
        attachments: { "medication:1": "photo", "illness:1": "photo", "checkup:1": "photo", "vaccination:1": "photo" },
        candidate: { kind, record: { id: "1", title: "Test record" } },
        detail: true,
        busy,
    };
    const calls = [];
    const errors = [];
    const setter = (key) => (value) => {
        state[key] = typeof value === "function" ? value(state[key]) : value;
    };
    const context = {
        healthDeleteCandidate: fromForm ? null : state.candidate,
        deletingHealthRecord: busy,
        profile: { id: "child" },
        api: { deleteRecord: async (...args) => {
            calls.push(args);
            if (fail) throw new Error("offline");
            // Confirmed API deletion owns the shared dose cascade.
            if (kind === "medication") state.doses = state.doses.filter((dose) => dose.medicationId !== "1");
        } },
        setDeletingHealthRecord: setter("busy"),
        setMedications: setter("medications"),
        setIllnesses: setter("illnesses"),
        setAppts: setter("appts"),
        setVaccines: setter("vaccines"),
        setDoses: setter("doses"),
        setAttachMap: setter("attachments"),
        setHealthDeleteCandidate: setter("candidate"),
        setDetailHealthRecord: setter("detail"),
        toast: { success() {}, error: (message) => errors.push(message) },
    };
    const run = new Function(...Object.keys(context), `return async (candidate = null) => {${match[1]}\n}`)(
        ...Object.values(context),
    );
    const deleted = await run(fromForm ? state.candidate : null);
    assert.equal(deleted, !fail && !busy, "Only successful deletion can close an update form");

    if (busy) {
        assert.equal(calls.length, 0);
        assert.equal(state.busy, true);
        return;
    }
    assert.deepEqual(calls, [["child", kind === "vaccination" ? "vaccinations" : kind === "checkup" ? "checkups" : "medical-history", "1"]]);
    assert.equal(state.busy, false);
    if (fail) {
        assert.equal(state.candidate.record.id, "1");
        assert.equal(state.detail, true);
        assert.equal(state.medications.length, 2);
        assert.equal(state.doses.length, 2);
        assert.equal(state.attachments[`${kind}:1`], "photo");
        assert.deepEqual(errors, ["offline"]);
        return;
    }
    for (const [recordKind, key] of [["medication", "medications"], ["illness", "illnesses"], ["checkup", "appts"], ["vaccination", "vaccines"]]) {
        assert.equal(state[key].length, recordKind === kind ? 1 : 2);
    }
    assert.equal(state.doses.length, kind === "medication" ? 1 : 2);
    assert.equal(state.attachments[`${kind}:1`], undefined);
    assert.equal(state.candidate, null);
    assert.equal(state.detail, null);
}

(async () => {
    for (const kind of ["medication", "illness", "checkup", "vaccination"]) {
        await check(kind);
        await check(kind, false, false, true);
        await check(kind, true, false, true);
    }
    await check("medication", true);
    await check("medication", false, true);
    console.log("Health deletion checks passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
