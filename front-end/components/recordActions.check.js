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
const health = read("Health.js");
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

for (const source of [calendar, growth, nutrition, health]) {
    assert(source.includes('import SwipeActionRow from "./ui/SwipeActionRow"'));
    assert(source.includes("<SwipeActionRow"));
}
for (const source of [growth, nutrition]) {
    assert(source.includes("<PlanDetail"));
    assert(source.includes("<DeleteConfirmation"));
}
assert(health.includes("<PlanDetail"));
assert(health.includes("<DeleteConfirmation"));
for (const source of [growth, nutrition, health]) {
    assert(!source.includes("showChevron"), "Record list rows do not use shared chevrons");
}
assert(!calendar.includes("eventChevron"), "Calendar record rows do not use trailing chevrons");
assert(health.includes("label={label}"));
assert(health.includes("labelInline"));
assert(health.includes("subtitle={meta.label}"));
assert(health.includes('onViewAttachment='));
assert(!health.includes("conditionDelete"));
assert(swipe.includes("shouldClaimHorizontalSwipe"));
assert(swipe.includes('pointerEvents={open ? "auto" : "none"}'));
assert(swipe.includes('accessibilityHint="Swipe left for actions"'));
assert(calendar.includes('accessibilityLabel="Show calendar legend"'));
assert(calendar.includes('name="information-circle-outline" size={24} color={colors.primary}'));
assert(calendar.includes("fontSize: type.label.fontSize * 1.1"));
assert(calendar.includes("paddingTop: 33"));
assert(calendar.includes('visible={showLegend} transparent animationType="fade"'));
assert(calendar.indexOf("style={styles.legendRow}") > calendar.indexOf("</Animated.ScrollView>"), "Calendar legend only renders in its popover");
assert(calendar.includes("const incompleteDayEvents = dayEvents.filter((event) => !event.completed)"));
assert(calendar.includes("{incompleteDayEvents.length}</Text>"));
assert(calendar.includes("event.completed && !event.courseOccurrence"));
assert(calendar.includes("visibleTodayCompleted.length ?"));
assert(calendar.includes('<Text style={styles.completedGroupTitle}>Today</Text>'));
assert(calendar.includes('noun="completed plans"'));
assert(calendar.indexOf('<Text style={styles.planTitle}>Completed</Text>') > calendar.indexOf('<Text style={styles.planTitle}>Overdue</Text>'));
assert(calendar.includes("style={styles.planTitleGroup}"), "Selected-day count stays beside its title");
assert(!calendar.includes("completedDayEvents"));
assert(!calendar.includes("styles.completedPlans"));
assert(!calendar.includes("style={styles.planCount}"));
assert(/neutral\s*\? \{ backgroundColor: colors\.surface, borderColor: colors\.border \}/.test(calendar), "Selected-day and completed rows use neutral surfaces");
assert(calendar.includes("renderEventContent(ev, showDate, checklist, tone, true)"), "Overdue rows use neutral content colors");
assert(nutrition.includes("subtitle={shortDate(e.date)}"), "Nutrition rows show only the entry title and date");
assert(!nutrition.includes("entrySubtitle") && !nutrition.includes("entryNotes"), "Nutrition row-only metadata helpers are removed");
assert(growth.includes("title={shortDate(m.date)}"), "Growth history rows use the date as their title");
assert(growth.includes("subtitle={m.day != null ? ageLabel(m.day) : null}"), "Growth history rows show only the baby's age below the date");

console.log("Record-action checks passed: profile cleanup, shared swipe actions, details, confirmations, and Calendar sections.");
