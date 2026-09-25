const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
const profile = read("settings/ViewProfile.js");
const privacy = read("settings/PrivacySettings.js");
const sharing = read("ShareRecords.js");
const growth = read("Growth.js");
const nutrition = read("NutritionTracker.js");
const calendar = read("CalendarView.js");
const swipe = read("ui/SwipeActionRow.js");

assert(!profile.includes("Baby profiles"));
assert(!profile.includes("Member since"));
assert(!profile.includes('label: "BabyBook+ & Support"'));
assert(!profile.includes('label: "Share Records"'));
assert(profile.includes('label: "Support"'));
assert(profile.includes('share: "Share Records"'), "Share screen keeps its header title");
assert(profile.includes('label: "Local Services", disabled: true'));
assert(profile.includes('accessibilityState={{ disabled: !!item.disabled }}'));
assert(!privacy.includes("Export My Child's Records"));
assert(!sharing.includes("You control exactly what is shared"));

for (const source of [calendar, growth, nutrition]) {
    assert(source.includes('import SwipeActionRow from "./ui/SwipeActionRow"'));
    assert(source.includes("<SwipeActionRow"));
}
for (const source of [growth, nutrition]) {
    assert(source.includes("<PlanDetail"));
    assert(source.includes("<DeleteConfirmation"));
    assert(source.includes("showChevron"));
}
assert(swipe.includes("shouldClaimHorizontalSwipe"));
assert(swipe.includes('pointerEvents={open ? "auto" : "none"}'));
assert(swipe.includes('accessibilityHint="Swipe left for actions"'));

console.log("Record-action checks passed: profile cleanup, disabled services, shared swipe actions, details, and confirmations.");
