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
const plansDashboard = read("ui/PlansDashboardCard.js");
const health = read("Health.js");
const swipe = read("ui/SwipeActionRow.js");
const cards = read("common/Cards.js");
const planDetail = read("ui/PlanDetail.js");
const dashboard = read("Dashboard.js");
const growthChart = read("GrowthChart.js");
const search = read("Search.js");
const auth = read("Auth.js");
const professional = read("ProfessionalView.js");
assert(professional.includes("<SectionContainerCard title="), "Professional headers reuse the shared, capitalized card design");
const nutritionTrend = read("ui/NutritionTrendChart.js");

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
assert(sharing.includes('import { EmptyStateCard, ListEntryCard, SectionContainerCard } from "./common/Cards"'));
assert.equal((sharing.match(/<SectionContainerCard/g) || []).length, 4, "Share history and detail sections retain the shared card shell");
for (const legacyStyle of ["styles.card", "styles.cardTitle", "styles.resultCard"]) {
    assert(!sharing.includes(legacyStyle), `Share Records removed legacy ${legacyStyle}`);
}
assert(!sharing.includes("Share for Consultation"));
assert(sharing.includes("QR access is read-only and expires after the selected duration"));
assert(sharing.includes('<DurationWheel value={ttl}') && sharing.includes('disabled={busy}')); 
assert(sharing.includes('accessibilityLabel="What is this visit about?"') && !sharing.includes('label="What is this visit about?"'));
assert(sharing.includes("Save as PDF") && !sharing.includes("Save or print as PDF"));
assert((sharing.match(/<ListEntryCard/g) || []).length >= 2, "Share history and access logs use standard list cards");
assert(sharing.includes('step={3} title="Choose How To Share"'));
assert(!sharing.includes("TTL_OPTIONS"));
assert(sharing.includes('accessibilityLabel={`${option.label} sharing`}'));
assert(sharing.includes("Animated.timing(shareFold") && sharing.includes("duration: reduceMotion ? 0 : motion.standard.duration"));
assert(sharing.includes('importantForAccessibility={shareExpanded ? "auto" : "no-hide-descendants"}'));
const accessRows = sharing.slice(sharing.indexOf("const renderAccessLogEntry"), sharing.indexOf("// ---- builder view ----"));
assert(accessRows.includes("setDetailAccessEntry(entry)"), "Access-log rows open their details");
assert(!accessRows.includes("icon="), "Access-log rows have no leading icon");
assert(accessRows.includes("labelTrailing") && accessRows.includes("entry.code"), "Access-log rows show the matching QR code badge");
assert(sharing.includes("<PlanDetail") && sharing.includes("showNotes: false"), "Access details reuse the read-only record detail display");
assert(planDetail.includes("plan.showNotes === false"), "Record details can omit an irrelevant Notes card");
assert(sharing.includes('import SwipeActionRow from "./ui/SwipeActionRow"'));
assert(sharing.includes('import { DeleteConfirmation } from "./ui/RecordFormSheet"'));
assert(sharing.includes('label: "Revoke"') && !sharing.includes("styles.histRevoke"), "Active shares revoke through a swipe action instead of an X button");
assert(sharing.includes("setRevokeCandidate(s)") && sharing.includes("setRevokeCandidate(currentShare)"), "Every share revoke entry point requires confirmation");
assert(sharing.includes('title="Revoke share?"') && sharing.includes('deleteLabel="Revoke Share"'));
assert(sharing.includes('initialSection !== "activeRecentShares"') && sharing.includes("handleRecentSharesLayout") && sharing.includes("scrollRef.current?.scrollTo"), "Share Records can deep-link to Active & recent shares");
assert(sharing.includes("timerPill: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 11 }") && sharing.includes("fontSize: 15, lineHeight: 23"), "Only the active countdown badge is 35 percent larger");
assert(sharing.includes("plan={shareDetailPlan}") && sharing.includes("deleteAccessibilityLabel="), "Share history reuses the shared detail display with accessible Revoke");
assert(planDetail.includes("{heroContent}") && planDetail.indexOf("{heroContent}") < planDetail.indexOf("<View style={styles.rows}>"), "Detail heroes render above detail rows");
assert(planDetail.includes("{children}") && planDetail.includes("deleteAccessibilityLabel ||"));
assert(sharing.includes('title: currentShare.code || "Unavailable"') && !sharing.includes('title: `Share ${currentShare.code}`'), "Share detail headers contain only the QR code");
const shareDetails = sharing.slice(sharing.indexOf("const shareDetailPlan"), sharing.indexOf("useEffect(() =>", sharing.indexOf("const shareDetailPlan")));
for (const label of ['label: "Status"', 'label: "Access Expiry"']) assert(shareDetails.includes(label));
assert(shareDetails.indexOf('label: "Status"') < shareDetails.indexOf('label: "Access Expiry"'));
assert(!shareDetails.includes('label: "QR Code"') && shareDetails.includes('showTitle: currentShare.status !== "active"') && shareDetails.includes("showDate: false") && shareDetails.includes("showTime: false"));
assert(!shareDetails.includes("categoryLabel") && !shareDetails.includes('label: "Records shared"'), "Share details omit Type and render records as rows");
assert(sharing.includes("currentShare.shared_record_keys.map") && !sharing.includes("OR ENTER CODE"), "Shared records reuse selection labels without a duplicate code block");
assert(sharing.includes("useWindowDimensions") && sharing.includes("Math.floor(screenWidth - space.xl * 2)") && sharing.includes("size={qrWidth}"), "Active QR matches the responsive detail-card width");
assert(sharing.indexOf("<QrCodeView", sharing.indexOf("heroContent=")) < sharing.indexOf("style={styles.qrCodeText}", sharing.indexOf("heroContent=")), "The share code is inside the QR card below the image");
assert(sharing.includes("fontSize: type.title.fontSize * 1.625") && sharing.includes("lineHeight: type.title.lineHeight * 1.625"), "The QR-card code is 30 percent larger than its previous 125-percent size");
assert(/qrWrap:\s*\{[^}]*borderRadius: radius\.xl[^}]*overflow: "hidden"[^}]*paddingBottom: space\.xl/.test(sharing), "QR card uses global rounding and bottom padding");
assert(planDetail.includes('plan.showDate === false ? "Back"') && planDetail.includes("plan.showDate === false ? null"), "Share details can hide their timestamp without changing other detail screens");
assert(planDetail.includes("plan.showTitle === false") && planDetail.includes("plan.showTitle === false && plan.showDate === false && plan.showTime === false"), "Share details can remove the title block without leaving an empty gap");
assert(cards.includes('sectionTitle: { ...type.heading, color: colors.text, textTransform: "capitalize" }'), "Shared card headers capitalize every word");
for (const [source, style] of [
    [dashboard, "setupTitle"],
    [plansDashboard, "title"], [growthChart, "title"], [fs.readFileSync(path.join(__dirname, "common/RecordSummaries.js"), "utf8"), "metricsHeaderTitle"],
    [search, "sectionTitle"], [auth, "consentTitle"],
    [profile, "planTitle"], [nutritionTrend, "title"],
]) {
    assert(new RegExp(`${style}: \\{[^\\n]*textTransform: "capitalize"`).test(source), `${style} capitalizes custom card headers`);
}
assert(fs.readFileSync(path.join(__dirname, "ui/NeedsAttentionCard.js"), "utf8").includes('>Needs Attention</Text>'), "Attention header retains title case");

for (const source of [calendar, growth, nutrition, health]) {
    assert(source === health || source.includes('import SwipeActionRow from "./ui/SwipeActionRow"'));
    assert(source.includes("<SwipeActionRow") || source === health && fs.readFileSync(path.join(__dirname,"ui/IllnessesConditionsCard.js"),"utf8").includes("<SwipeActionRow"));
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


assert.equal((health.match(/labelTrailing/g) || []).length + (health.match(/style=\{\[styles\.medicineBadge,/g) || []).length, 1, "Medicine retains its trailing badge; dashboard rows have integrated statuses");
assert(!cards.includes("labelInline"));
assert(cards.includes("label && labelTrailing") && cards.includes("styles.listTrailingLabel"));

assert(health.includes('onViewAttachment='));
assert(!health.includes("conditionDelete"));
assert(swipe.includes("shouldClaimHorizontalSwipe"));
assert(swipe.includes('pointerEvents={open ? "auto" : "none"}'));
assert(swipe.includes('accessibilityHint="Swipe left for actions"'));
assert(calendar.includes('accessibilityLabel="Show calendar legend"'));
assert(calendar.includes("<CalendarArtwork information />"));
assert(calendar.includes("accessibilityState={{ expanded: showLegend }}"));
assert(!calendar.includes("styles.selectedDate"), "Selected date is disclosed in plan/accessibility labels instead of a standalone heading");
assert(calendar.includes('visible={showLegend} transparent animationType="fade"'));
assert(calendar.indexOf("style={styles.legendRow}") > calendar.indexOf("</Animated.ScrollView>"), "Calendar legend only renders in its popover");
assert(calendar.includes("const incompleteDayEvents = dayEvents.filter((event) => !event.completed)"));
assert(calendar.includes("counts={{ today: incompleteDayEvents.length"));
assert(calendar.includes("event.completed && !event.courseOccurrence"));
assert(calendar.includes("visibleTodayCompleted.length ?"));
assert(calendar.includes('<Text style={styles.completedGroupTitle}>Today</Text>'));
assert(calendar.includes('noun="completed plans"'));
assert(plansDashboard.indexOf('key: "completed"') > plansDashboard.indexOf('key: "overdue"'));
assert(plansDashboard.includes("style={styles.titleGroup}"), "Selected-day count stays beside its title");
assert(!calendar.includes("completedDayEvents"));
assert(!calendar.includes("styles.completedPlans"));
assert(!calendar.includes("style={styles.planCount}"));
assert.equal((calendar.match(/colors=\{colors\.recordItem\.surface\}/g) || []).length, 2, "Plain and swipeable plan rows share neutral raised gradients");
assert(calendar.includes("renderEventContent(ev, showDate, checklist, tone, true)"), "Overdue rows use neutral content colors");
assert(nutrition.includes("dateText={shortDate(e.date)}"), "Nutrition rows show only the entry title and bottom date");
assert(!nutrition.includes("entrySubtitle") && !nutrition.includes("entryNotes"), "Nutrition row-only metadata helpers are removed");
assert(growth.includes("<MeasurementHistoryRow date={shortDate(m.date)}"), "Growth history rows use the date as their title");
assert(growth.includes("age={m.day != null ? ageLabel(m.day) : null}"), "Growth history rows show only the baby's age below the date");

console.log("Record-action checks passed: profile cleanup, shared swipe actions, details, confirmations, and Calendar sections.");
