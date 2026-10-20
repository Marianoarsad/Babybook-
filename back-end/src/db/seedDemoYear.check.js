const {
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
} = require("./seedDemoYear");

const children = [
    [1, SOFIA_DOB, SOFIA_GROWTH_ANCHORS, SOFIA_FOODS, 3, "Mixed", 4, 3],
    [2, DOB, ELIAS_GROWTH_ANCHORS, ELIAS_FOODS, 11, "Breastmilk", 5, 1],
];
const REVIEW_DAY = "2026-09-14";
const REVIEW_DATE = new Date(`${REVIEW_DAY}T12:00:00.000Z`);
let passed = 0;

function check(label, condition) {
    if (!condition) throw new Error(`FAIL ${label}`);
    passed += 1;
}

const growthSets = [];
for (const [id, dob, anchors, foods, phase, currentMilkType, currentMilkCount, currentFoodCount] of children) {
    const expectedDays = dayCount(dob, TIMELINE_END);
    const growth = dailyGrowthRows(id, dob, anchors, phase);
    const nutrition = dailyNutritionRows(id, dob, foods, phase);
    const nutritionDays = new Map();
    for (const row of nutrition) {
        if (!nutritionDays.has(row[11])) nutritionDays.set(row[11], []);
        nutritionDays.get(row[11]).push(row);
    }
    const currentRows = nutritionDays.get(REVIEW_DAY) || [];

    check(`child ${id} is under one on the review date`, REVIEW_DATE - dob < 365 * 86400000);
    check(`child ${id} has one growth row per day`, growth.length === expectedDays);
    check(`child ${id} growth starts at birth`, growth[0][4] === dob.toISOString().slice(0, 10));
    check(`child ${id} growth ends in 2029`, growth[growth.length - 1][4] === "2029-12-31");
    check(`child ${id} has nutrition every day`, nutritionDays.size === expectedDays);
    check(`child ${id} has at least three nutrition entries daily`, Math.min(...[...nutritionDays.values()].map((rows) => rows.length)) >= 3);
    check(`child ${id} has milk recorded every day`, [...nutritionDays.values()].every((rows) => rows.some((row) => row[1] === "milk")));
    check(`child ${id} has solid food every day after six months`, [...nutritionDays.entries()].every(([day, rows]) =>
        new Date(`${day}T12:00:00.000Z`) < new Date(dob.getTime() + 183 * 86400000) ||
        rows.some((row) => row[1] === "solid")
    ));
    check(`child ${id} current milk count is realistic`, currentRows.filter((row) => row[1] === "milk").length === currentMilkCount);
    check(`child ${id} current solid count is realistic`, currentRows.filter((row) => row[1] === "solid").length === currentFoodCount);
    check(`child ${id} current milk type is distinct`, currentRows.filter((row) => row[1] === "milk").every((row) => row[2] === currentMilkType));
    check(`child ${id} formula bottles include scoops`, nutrition
        .filter((row) => row[1] === "milk" && row[3] === "bottle" && (row[2] === "Formula" || row[2] === "Mixed"))
        .every((row) => row[14] > 0));
    check(`child ${id} mixed bottles include breastmilk amounts`, nutrition
        .filter((row) => row[1] === "milk" && row[2] === "Mixed")
        .every((row) => row[3] === "bottle" && row[15] > 0));
    check(`child ${id} includes a realistic food reaction`, nutrition.some((row) => row[9] === "mild" && row[10]));
    check(`child ${id} growth values stay positive`, growth.every((row) => row[1] > 0 && row[2] > 0 && row[3] > 0));
    check(
        `child ${id} infant days contain all feeds`,
        [...nutritionDays.values()].slice(0, 365).every((rows) => rows.length >= 4)
    );
    check(
        `child ${id} growth has no abrupt daily jumps`,
        growth.slice(1).every((row, index) =>
            Math.abs(row[1] - growth[index][1]) < 0.5 &&
            Math.abs(row[2] - growth[index][2]) < 0.3 &&
            Math.abs(row[3] - growth[index][3]) < 0.3
        )
    );
    growthSets.push(growth);
}

check(
    "the two children have distinct overlapping growth values",
    growthSets[0].find((row) => row[4] === "2026-03-01").slice(1, 4).join("|") !==
        growthSets[1].find((row) => row[4] === "2026-03-01").slice(1, 4).join("|")
);

console.log(`${passed} passed, 0 failed`);
