const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Exercise the actual deletion closure without loading React Native or a DB.
const source = fs.readFileSync(path.join(__dirname, "Health.js"), "utf8").replace(/\r\n/g, "\n");
assert(!source.includes("Care Team Directory"), "Health no longer shows the Care Team Directory card");
assert(!source.includes("Allergies & Sensitivities"), "Health no longer shows the separate allergy card");
assert(!source.includes("healthVaccineNCRStock"), "Health no longer shows the NCR vaccine stock bulletin");
const conditionsCard = fs.readFileSync(path.join(__dirname, "ui/IllnessesConditionsCard.js"), "utf8");
assert(source.includes("<IllnessesConditionsCard"));
assert(conditionsCard.includes("<SwipeActionRow"), "Conditions retain shared swipe actions");
assert(conditionsCard.includes('key: "update"') && conditionsCard.includes('key: "delete"'));
assert(source.includes('label: "Saved status"'), "Allergy status remains qualified in details");
assert(!source.includes("setConditions"), "Conditions derive from the shared record store");
assert(source.includes("conditionRecords.conditionsSummary(conditions, legacyAllergies, legacyHereditary)"));
assert(conditionsCard.includes('"Allergy information"'), "Allergy rows stay neutral");
const hospitalSectionStart = source.indexOf('<HospitalStaysCard');
const hospitalSection = source.slice(hospitalSectionStart, source.indexOf('<PlanDetail', hospitalSectionStart));
assert(hospitalSectionStart >= 0, 'Hospital Stays card must be present');
assert(hospitalSection.includes('onOpen={stay => setDetailHealthRecord({ kind: "hospitalization", record: stay })}'), 'Hospital stays retain detail navigation');
assert(hospitalSection.includes('summary={hospitalSummary}'), 'Hospital card receives the centralized summary');
assert(hospitalSection.includes('onOpenAttachment={stay => openViewer("hospitalization", stay.id)}'), 'Hospital photos retain their original action');
assert(!/\bsetHospitalizations\b/.test(source), 'Hospital stays use the shared store');
assert(source.includes('const selectedIsHospitalization = detailHealthRecord?.kind === "hospitalization"'), "Hospital stays participate in the shared detail screen");
assert(source.includes('setMedEvent({ kind: "hospitalization", record: selectedHealthRecord })'), "Hospital details can open the existing update form");
assert(source.includes('deleteLabel: selectedIsVaccination') && source.includes('"Delete hospital stay"'), "Hospital details expose confirmed deletion");
assert(source.includes("showTime: selectedIsHospitalization || selectedIsVaccination ? false : undefined"), "Hospital details do not invent an all-day time");
const match = source.match(/const deleteHealthRecord = async \(candidate = null\) => \{([\s\S]*?)\n    \};\n\n    const selectedHealthRecord/);
assert.ok(match, "Health deletion handler must be found");

async function check(kind, fail = false, busy = false, fromForm = false) {
    const state = {
        medications: [{ id: "1" }, { id: "2" }],
        conditions: [{ id: "1", category: "Illness" }, { id: "2", category: "Illness" }],
        hospitalizations: [{ id: "1", category: "Hospitalization" }, { id: "2", category: "Hospitalization" }],
        appts: [{ id: "1" }, { id: "2" }],
        vaccines: [{ id: "1" }, { id: "2" }],
        doses: [{ medicationId: "1" }, { medicationId: "2" }],
        attachments: { "medication:1": "photo", "illness:1": "photo", "hospitalization:1": "photo", "checkup:1": "photo", "vaccination:1": "photo" },
        candidate: { kind, record: { id: "1", title: "Test record", category: kind === "hospitalization" ? "Hospitalization" : "Illness" } },
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
            if (kind === "illness") state.conditions = state.conditions.filter((record) => record.id !== "1");
            if (kind === "hospitalization") state.hospitalizations = state.hospitalizations.filter((stay) => stay.id !== "1");
            if (kind === "vaccination") state.vaccines = state.vaccines.filter(record => record.id !== "1");
            if (kind === "checkup") state.appts = state.appts.filter((appt) => appt.id !== "1");
        } },
        setDeletingHealthRecord: setter("busy"),
        setMedications: setter("medications"),
        setConditions: setter("conditions"),
        setHospitalizations: setter("hospitalizations"),
        setDoses: setter("doses"),
        setAttachMap: setter("attachments"),
        setHealthDeleteCandidate: setter("candidate"),
        setDetailHealthRecord: setter("detail"),
        removeLegacyFact: async () => true,
        conditionAttachmentType: () => kind === "hospitalization" ? "hospitalization" : "illness",
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
    for (const [recordKind, key] of [["medication", "medications"], ["illness", "conditions"], ["hospitalization", "hospitalizations"], ["checkup", "appts"], ["vaccination", "vaccines"]]) {
        assert.equal(state[key].length, recordKind === kind ? 1 : 2);
    }
    assert.equal(state.doses.length, kind === "medication" ? 1 : 2);
    assert.equal(state.attachments[`${kind}:1`], undefined);
    assert.equal(state.candidate, null);
    assert.equal(state.detail, null);
}

(async () => {
    for (const kind of ["medication", "illness", "hospitalization", "checkup", "vaccination"]) {
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

const legacyBlock=source.slice(source.indexOf("    const [legacyFacts, setLegacyFacts]"),source.indexOf("    const [legacyBusy"));
const readLegacy=new Function("useState","profile",legacyBlock+"return {legacyAllergies,legacyHereditary};");
const oldFacts={child:"a",allergies:["Saved allergy fact"],hereditary:["Saved family history"]};
assert.deepEqual(readLegacy(()=>[oldFacts,()=>{}],{id:"b",allergies:[],hereditaryConditions:[]}),{legacyAllergies:[],legacyHereditary:[]},"Switching babies cannot briefly expose the previous baby's legacy facts");
assert.deepEqual(readLegacy(()=>[oldFacts,()=>{}],{id:"a"}),{legacyAllergies:oldFacts.allergies,legacyHereditary:oldFacts.hereditary});
