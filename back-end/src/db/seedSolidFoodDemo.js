// Only this seeder's marked entries under the named development account may change.
require("dotenv").config();
const { pool, withTransaction } = require("./pool");
const { encrypt, decrypt, isEncrypted } = require("../utils/crypto");
const { manilaToday, shiftDay } = require("./seedMilkTypeDemo");

const DEMO_EMAIL = "demo.parent@babybookplus.app";
const EXPECTED_PROFILES = ["Elias Rivera", "Sofia Rivera"];
const MARKER = "[solid-chart-demo:v1:";
const CATEGORIES = ["fruits", "vegetables", "grains", "proteins", "dairy", "other"];
const FOODS = ["Banana", "Carrot", "Rice", "Chicken", "Plain yogurt", "Mixed dish"];
const WEEK = [
    [1, 1, 0, 1, 1, 0], [1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 0],
    [1, 1, 1, 0, 0, 0], [2, 1, 1, 1, 1, 1], [1, 1, 0, 1, 0, 1], [1, 1, 1, 1, 1, 0],
];

function buildSolidFoodEntries(today) {
    shiftDay(today, 0);
    const samples = [];
    const day = (offset, counts) => {
        let slot = 0;
        counts.forEach((count, category) => {
            for (let i = 0; i < count; i++) samples.push({
                food_introduced: FOODS[category], food_category: CATEGORIES[category],
                reaction_severity: "none", reaction: null, entry_date: shiftDay(today, offset),
                entry_time: `08:${String(slot++ * 5).padStart(2, "0")}:00`,
                notes: `${MARKER}${String(samples.length + 1).padStart(3, "0")}] Fictional Solid Foods dashboard sample. Not an actual feeding or medical observation.`,
            });
        });
    };
    WEEK.forEach((counts, i) => day(i - 6, counts));
    for (const offset of [-14, -35, -56]) day(offset, [1, 1, 1, 1, 1, 1]);
    return samples;
}

async function seedSolidFoodDemo(today = manilaToday()) {
    const samples = buildSolidFoodEntries(today);
    return withTransaction(async client => {
        const { rows: users } = await client.query("SELECT id FROM users WHERE email=$1 FOR UPDATE", [DEMO_EMAIL]);
        if (users.length !== 1) throw new Error("Expected exactly one development demo account; no records changed");
        const { rows: children } = await client.query("SELECT id, first_name, last_name, date_of_birth FROM children WHERE user_id=$1 ORDER BY id FOR UPDATE", [users[0].id]);
        const names = children.map(child => [decrypt(child.first_name), decrypt(child.last_name)].filter(Boolean).join(" "));
        if (children.length !== 2 || new Set(names).size !== 2 || names.some(name => !EXPECTED_PROFILES.includes(name))) {
            throw new Error("Expected only Elias Rivera and Sofia Rivera in the demo account; no records changed");
        }
        const schema = await client.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nutrition_records' AND column_name='food_category') AS present");
        if (!schema.rows[0].present) throw new Error("Apply migration 021 before seeding Solid Food samples");
        const profiles = [];
        for (const [index, child] of children.entries()) {
            shiftDay(child.date_of_birth, 0);
            const { rows } = await client.query("SELECT id, food_introduced, food_category, reaction_severity, reaction, entry_date, entry_time, notes FROM nutrition_records WHERE child_id=$1 AND entry_type='solid' FOR UPDATE", [child.id]);
            const owned = new Map(), firstDates = [];
            for (const row of rows) {
                const notes = decrypt(row.notes);
                if (isEncrypted(notes)) throw new Error("Food notes could not be decrypted; no records changed");
                if (typeof notes !== "string" || !notes.startsWith(MARKER)) {
                    if (row.food_introduced && row.entry_date) firstDates.push(row.entry_date);
                    continue;
                }
                const marker = /^\[solid-chart-demo:v1:(\d{3})\] /.exec(notes)?.[1];
                if (!marker || Number(marker) < 1 || Number(marker) > samples.length || owned.has(marker)) {
                    throw new Error("Unexpected or duplicate Solid Food sample markers; no records changed");
                }
                const food = decrypt(row.food_introduced), reaction = decrypt(row.reaction);
                if (isEncrypted(food) || isEncrypted(reaction)) throw new Error("Sample fields could not be decrypted; no records changed");
                owned.set(marker, { ...row, food_introduced: food, reaction, notes });
            }
            const earliest = shiftDay(today, -56), first = firstDates.sort()[0];
            if (earliest < child.date_of_birth || first && earliest < first) {
                throw new Error("Samples would precede birth or the existing first-food milestone; no records changed");
            }
            const count = { childId: child.id, name: names[index], inserted: 0, updated: 0, unchanged: 0 };
            for (const [sampleIndex, sample] of samples.entries()) {
                const existing = owned.get(String(sampleIndex + 1).padStart(3, "0"));
                if (existing && Object.keys(sample).every(key => existing[key] === sample[key])) { count.unchanged++; continue; }
                const fields = [encrypt(sample.food_introduced), sample.food_category, sample.reaction_severity,
                    sample.reaction, sample.entry_date, sample.entry_time, encrypt(sample.notes)];
                const saved = existing ? await client.query(
                    "UPDATE nutrition_records SET food_introduced=$1, food_category=$2, reaction_severity=$3, reaction=$4, entry_date=$5, entry_time=$6, notes=$7 WHERE id=$8 AND child_id=$9 AND entry_type='solid' RETURNING id",
                    [...fields, existing.id, child.id]) : await client.query(
                    "INSERT INTO nutrition_records (child_id, entry_type, food_introduced, food_category, reaction_severity, reaction, entry_date, entry_time, notes) VALUES ($1,'solid',$2,$3,$4,$5,$6,$7,$8) RETURNING id",
                    [child.id, ...fields]);
                if (saved.rows.length !== 1) throw new Error("Could not confirm a Solid Food sample; no records changed");
                count[existing ? "updated" : "inserted"]++;
            }
            profiles.push(count);
        }
        return { today, profiles };
    });
}

module.exports = { DEMO_EMAIL, MARKER, CATEGORIES, buildSolidFoodEntries, seedSolidFoodDemo };
if (require.main === module) {
    seedSolidFoodDemo().then(result => console.log("[seed:solid-food-demo]", JSON.stringify(result)))
        .catch(error => { console.error("[seed:solid-food-demo] failed:", error.code || error.message); process.exitCode = 1; })
        .finally(() => pool.end());
}
