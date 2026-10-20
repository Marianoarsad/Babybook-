// Run: node components/CalendarView.check.js — no browser, server or record writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const root = path.resolve(__dirname, "..");
function load(file, imports = {}) {
    const module = { exports: {} };
    new Function("require", "module", "exports", compile(fs.readFileSync(path.join(root, file), "utf8")))(name => {
        assert(name in imports, "Unexpected dependency: " + name);
        return imports[name];
    }, module, module.exports);
    return module.exports;
}
const theme = load("theme.js");
const dates = load("utils/dates.js");
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(nodes)] : [];
const merge = styles => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));
let colors, reduced = false, cursor = 0, slots = [], effects = [], animations = [], dirty = false, refreshing = false;
let fixtures = { "2026-01-30": [
    { category: "medication", date: "2026-01-30", courseOccurrence: true, rangeStart: "2026-01-29", rangeEnd: "2026-02-02" },
    { category: "custom", date: "2026-01-30", courseOccurrence: true },
] };
const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
    useId: () => "calendar-test",
    useMemo: fn => fn(), useCallback: fn => fn,
    useRef: value => { const i = cursor++; return slots[i] ||= { current: value }; },
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
        return [slots[i], value => { const next = typeof value === "function" ? value(slots[i]) : value;
            if (!Object.is(slots[i], next)) { slots[i] = next; dirty = true; } }]; },
    useEffect: () => {},
    useLayoutEffect: (fn, deps) => { const i = cursor++, previous = slots[i];
        if (!previous || deps.some((value, n) => value !== previous.deps[n])) effects.push(() => {
            previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
        }); },
};
class Value {
    constructor(value) { this.value = value; }
    stopAnimation() {}
    setValue(value) { this.value = value; }
    interpolate(options) { return { source: this, ...options }; }
}
const native = { View: "View", Text: "Text", Pressable: "Pressable", Image: "Image", TouchableOpacity: "TouchableOpacity",
    ScrollView: "ScrollView", TextInput: "TextInput", useWindowDimensions: () => ({ width: 375, height: 900 }),
    StyleSheet: { create: value => value, absoluteFillObject: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } },
    Platform: { OS: "web" }, Easing: { out: value => value, quad: "quad", cubic: "cubic" },
    Animated: { Value, View: "AnimatedView", timing: (value, options) => ({ start() {
        animations.push(options); value.setValue(options.toValue);
    } }) },
};
const base = { react: { ...react, default: react, __esModule: true }, "react-native": native,
    "../theme": theme, "../../theme": theme, "../context/ThemeContext": { useTheme: () => ({ colors }) },
    "../../context/ThemeContext": { useTheme: () => ({ colors }) },
    "@expo/vector-icons": { Ionicons: "Icon" } };
const visuals = load("components/ui/CalendarVisuals.js", { ...base,
    "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Defs: "Defs", LinearGradient: "LinearGradient", Path: "Path", Stop: "Stop" },
    "./Gradient": { __esModule: true, default: "Gradient" },
    "./useReducedMotion": { __esModule: true, default: () => reduced },
    "./useSoftPress": { __esModule: true, default: () => ({ respond() {}, transform: [] }) },
    "../../assets/navbar/calendar-blue.png": "calendar-blue.png",
});
const imports = { ...base, "react-native-calendars": { Calendar: "Calendar" },
    "../utils/dates": { ...dates, todayLocal: () => "2026-01-31" },
    "../utils/responsive": { useScreenPadBottom: () => 100, useScreenPadTop: () => 80 },
    "../utils/useRecords": { useRecords: () => [], useRecordSave: () => ({}),
        useScreenRefresh: () => ({ refreshing, failures: [], refresh() {} }) },
    "../utils/calendarEvents": { buildCalendarEvents: () => fixtures },
    "../utils/api": { api: {} }, "../utils/storageAdapter": { storage: {} },
    "../utils/notifications": { scheduleReminder() { assert.fail("No reminder changes during presentation checks"); } },
    "../utils/medication": { plannedEnd: () => null },
    "./settings/GeneralSettings": { LEAD_TIME_KEY: "lead", LEAD_TIME_OPTIONS: [] },
    "./ui/Toast": { useToast: () => ({}) }, "./ui/CalendarVisuals": visuals,
    "./ui/Gradient": { __esModule: true, default: "Gradient" },
    "./ui/PlansDashboardCard": { __esModule: true, default: "PlansDashboardCard", PlanAddButton: "PlanAddButton", PlansEmptyState: "PlansEmptyState" },
};
for (const name of ["AppModal", "ShowMore", "AnimatedReveal", "PullToRefreshScrollView", "PlanDetail", "SwipeActionRow", "MedicationIcon", "VaccineIcon", "HospitalStayIcon"])
    imports["./ui/" + name] = { __esModule: true, default: name };
imports["./ui/Skeleton"] = { AppointmentsSkeleton: "Skeleton" };
imports["./ui/DateField"] = { DateField: "DateField", TimeField: "TimeField" };
imports["./ui/RecordFormSheet"] = { __esModule: true, default: "RecordFormSheet", DeleteConfirmation: "DeleteConfirmation",
    RecordFormGroup: "RecordFormGroup", RecordFormRow: "RecordFormRow" };
const CalendarView = load("components/CalendarView.js", imports).default;
function draw(component, props = {}) {
    let tree, passes = 0;
    do {
        dirty = false; cursor = 0; tree = component(props);
        while (effects.length) effects.shift()();
        assert(++passes < 20, "Layout effects settle without a render loop");
    } while (dirty);
    return tree;
}
function reset() { slots = []; effects = []; animations = []; cursor = 0; }
for (const palette of [...Object.values(theme.PALETTES), ...Object.values(theme.DARK_PALETTES)]) {
    colors = palette;
    reset();
    const render = () => draw(CalendarView, { profile: { id: "read-only-test" } });
    let tree = render();
    const calendar = () => nodes(tree).find(node => node.type === "Calendar");
    const pickerButton = () => nodes(tree).find(node => node.props.accessibilityLabel === "Choose month and year");
    const press = label => { const button = nodes(tree).find(node => node.props.accessibilityLabel === label);
        assert(button, label); button.props.onPress(); tree = render(); };
    assert.equal(calendar().props.initialDate, "2026-01-01");
    assert.equal(calendar().props.customHeader, undefined, "Built-in swipe header stays mounted");
    assert.equal(calendar().props.dayComponent, visuals.CalendarDateCell);
    assert.equal(calendar().props.theme.calendarBackground, "transparent");
    assert.equal(pickerButton().type, visuals.CalendarControl);
    assert.equal(pickerButton().props.circular, true);
    assert.equal(merge(pickerButton().props.style).width, theme.MIN_TOUCH);
    assert.equal(merge(pickerButton().props.style).height, theme.MIN_TOUCH);
    assert.equal(pickerButton().props.accessibilityState.expanded, false);
    const activeMonth = nodes(tree).find(node => node.props.testID === "calendar-active-month");
    assert.equal(activeMonth.type, "View", "The active month is a static label");
    assert.equal(activeMonth.props.accessibilityLabel, "January 2026");
    assert.equal(activeMonth.props.onPress, undefined);
    assert.equal(activeMonth.props.accessibilityRole, undefined);
    assert.equal(activeMonth.props.accessibilityState, undefined);
    assert(nodes(activeMonth).some(node => node.type === visuals.CalendarSurface && node.props.kind === "active"));
    assert(!nodes(activeMonth).some(node => node.type === "Icon"), "The static month has no dropdown chevron");
    const periods = calendar().props.markedDates["2026-01-30"].periods;
    assert.deepEqual(periods.map(period => period.color), [colors.eventCategory.medication, colors.eventCategory.custom]);
    assert.equal(periods[0].startingDay, false);
    assert.equal(periods[0].endingDay, false);
    press("February 2026");
    assert.equal(calendar().props.initialDate, "2026-02-01");
    assert(calendar().props.markedDates["2026-02-28"].selected, "Jan 31 clamps to February's final day");
    press("Choose month and year"); // Open picker without selecting anything.
    assert.equal(pickerButton().props.accessibilityState.expanded, true);
    press("Previous year"); press("Previous year");
    assert(calendar().props.markedDates["2026-02-28"].selected, "Draft year navigation does not commit");
    const modal = nodes(tree).find(node => node.type === "AppModal" && node.props.visible);
    modal.props.onRequestClose(); tree = render();
    assert.equal(pickerButton().props.accessibilityState.expanded, false);
    press("Choose month and year");
    assert(nodes(tree).some(node => node.props.accessibilityLabel === "Feb 2026"), "Reopening discards the canceled draft year");
    press("Previous year"); press("Previous year"); press("Feb 2024");
    assert(calendar().props.markedDates["2024-02-28"].selected);
    calendar().props.onDayPress({ dateString: "2024-01-31" }); tree = render();
    press("Choose month and year"); press("Feb 2024");
    assert(calendar().props.markedDates["2024-02-29"].selected, "Leap-year selection clamps correctly");
    calendar().props.onMonthChange({ dateString: "2024-03-01" }); tree = render();
    assert(calendar().props.markedDates["2024-03-29"].selected, "Swipe callback preserves selected day");
    calendar().props.onDayPress({ dateString: "2024-12-31" }); tree = render(); press("January 2025");
    assert(calendar().props.markedDates["2025-01-31"].selected);
    reset();
    const date = { dateString: "2026-01-30", day: 30 };
    let selectedDate;
    const cell = draw(visuals.CalendarDateCell, { date, state: "disabled", marking: { periods }, onPress: value => selectedDate = value });
    cell.props.onPress(); assert.equal(selectedDate, date, "Adjacent-month cells retain their date callback");
    assert.equal(cell.props.disabled, false);
    assert.equal(merge(cell.props.style).width, "100%");
    assert.equal(merge(cell.props.style).marginHorizontal, undefined, "Hit targets cannot exceed their column width");
    const bands = nodes(cell).filter(node => merge(node.props.style).height === 2.5);
    assert.deepEqual(bands.map(node => merge(node.props.style).backgroundColor), periods.map(period => period.color));
    assert.equal(merge(bands[0].props.style).borderTopLeftRadius, 0);
    assert.equal(draw(visuals.CalendarDateCell, { date, marking: { disabled: true } }).props.disabled, true);
}
colors = theme.PALETTES.boy;
reset();
fixtures = {};
const add = (date, category, id, completed = false, extra = {}) => {
    (fixtures[date] ||= []).push({ id, category, title: id, date, completed, sourceRecord: {}, ...extra });
};
add("2026-01-31", "custom", "selected-plan");
add("2026-01-31", "medication", "selected-course", false, { courseOccurrence: true });
add("2026-01-31", "checkup", "completed-today", true);
for (let i = 1; i <= 14; i++) {
    add(`2026-02-${String(i).padStart(2, "0")}`, "custom", `future-${i}`);
    add(`2026-01-${String(i).padStart(2, "0")}`, i % 2 ? "vaccination" : "checkup", `overdue-${i}`);
    add(`2026-01-${String(i + 14).padStart(2, "0")}`, "custom", `done-${i}`, true);
}
add("2026-02-10", "illness", "excluded-upcoming-illness");
add("2026-02-10", "medication", "excluded-upcoming-course", false, { courseOccurrence: true });
add("2026-01-01", "medication", "excluded-overdue-medication");
add("2026-01-01", "custom", "excluded-overdue-custom");
add("2026-01-15", "medication", "excluded-completed-course", true, { courseOccurrence: true });
let profileId = "dashboard-fixture";
const renderPlans = () => draw(CalendarView, { profile: { id: profileId } });
let planTree = renderPlans();
const dashboard = () => nodes(planTree).find(node => node.type === "PlansDashboardCard");
const changeTab = value => { dashboard().props.onChange(value); planTree = renderPlans(); };
const more = () => nodes(dashboard()).find(node => node.type === "ShowMore");
const rows = () => nodes(dashboard()).filter(node => node.type === "SwipeActionRow" || node.props.accessibilityRole === "button");
assert.equal(nodes(planTree).filter(node => node.type === "PlansDashboardCard").length, 1);
assert.deepEqual(dashboard().props.counts, { today: 2, upcoming: 14, overdue: 14, completed: 15 });
assert.equal(dashboard().props.value, "today");
assert.equal(rows().length, 2, "Only selected-day rows are mounted");
assert.equal(more(), undefined);
changeTab("upcoming");
assert.equal(rows().length, 3);
assert.equal(rows()[0].props.label, "Custom Event: future-1");
assert.equal(dashboard().props.action, null);
rows()[0].props.onOpen(); planTree = renderPlans();
assert(rows()[0].props.open);
more().props.onPress(); planTree = renderPlans();
assert.equal(rows().length, 13);
changeTab("overdue");
assert.equal(rows().length, 3, "Each list keeps its own pagination");
assert.equal(rows()[0].props.accessibilityLabel, "Vaccination: overdue-1");
more().props.onPress(); planTree = renderPlans();
assert.equal(rows().length, 13);
changeTab("upcoming");
assert.equal(rows().length, 13);
assert.equal(rows()[0].props.open, false, "Switching categories closes an exposed swipe row");
assert.deepEqual(rows()[0].props.actions.map(action => action.key), ["update", "delete"]);
more().props.onPress(); planTree = renderPlans();
assert.equal(rows().length, 14, "Pagination clamps at the actual count");
changeTab("completed");
assert.equal(rows().length, 3);
assert.equal(rows()[0].props.label, "Checkup: completed-today", "Today's completed records remain first");
more().props.onPress(); planTree = renderPlans();
assert.equal(rows().length, 13);
nodes(planTree).find(node => node.type === "Calendar").props.onDayPress({ dateString: "2026-02-03" });
planTree = renderPlans();
assert.equal(dashboard().props.value, "today", "Choosing a date opens that day's plans before paint");
assert.equal(dashboard().props.title, "Plan for 03 Feb 2026");
assert.equal(rows().length, 1);
changeTab("upcoming");
assert.equal(dashboard().props.counts.upcoming, 11, "The existing future-date cutoff is retained");
assert.equal(rows().length, 3, "Date changes reset upcoming pagination");
changeTab("completed");
assert.equal(rows().length, 13, "Date changes do not reset completed pagination");
profileId = "another-child"; planTree = renderPlans();
assert.equal(dashboard().props.value, "today");
changeTab("completed"); assert.equal(rows().length, 3, "Child changes reset completed pagination");
nodes(planTree).find(node => node.type === "Calendar").props.onDayPress({ dateString: "2026-01-28" }); planTree = renderPlans();
assert.equal(nodes(dashboard()).find(node => node.type === "PlansEmptyState").props.message, "No unfinished plans for this day.");
nodes(planTree).find(node => node.type === "Calendar").props.onDayPress({ dateString: "2026-01-30" }); planTree = renderPlans();
const emptyDay = nodes(dashboard()).find(node => node.type === "PlansEmptyState");
assert.equal(emptyDay.props.message, "No plans recorded for this day.");
emptyDay.props.onAddPlan(); planTree = renderPlans();
assert(nodes(planTree).some(node => node.type === "RecordFormSheet" && node.props.visible));
assert(nodes(planTree).some(node => node.type === "DateField" && node.props.value === "2026-01-30"), "Add Plan keeps the selected day");
reset(); fixtures = {}; planTree = renderPlans();
for (const value of ["today", "upcoming", "overdue", "completed"]) {
    changeTab(value);
    assert.equal(dashboard().props.counts[value], 0);
    assert.equal(nodes(dashboard()).filter(node => node.type === "PlansEmptyState").length, 1);
    assert.equal(rows().length, 0);
}
reset(); refreshing = true; planTree = renderPlans();
assert(nodes(dashboard()).some(node => node.type === "Skeleton"), "Loading is not reported as an empty day");
refreshing = false;
reset(); reduced = false;
draw(visuals.CalendarControl, { active: false });
assert.equal(animations.length, 0, "Date surfaces do not animate on initial render");
const activeControl = draw(visuals.CalendarControl, { active: true, accessibilityState: { selected: true, expanded: true } });
assert.equal(activeControl.props["aria-pressed"], true, "Web selected state is announced on button controls");
assert.equal(activeControl.props["aria-expanded"], true);
assert.equal(animations.at(-1).duration, 180);
reduced = true;
draw(visuals.CalendarControl, { active: false });
assert.equal(animations.length, 1, "Reduced motion settles date selection immediately");
reset(); reduced = false;
draw(visuals.CalendarMonthTransition, { month: "2026-01", width: 375 });
assert.equal(animations.length, 0, "No initial entrance animation");
draw(visuals.CalendarMonthTransition, { month: "2026-02", width: 375 });
assert.equal(animations.at(-1).duration, 240);
draw(visuals.CalendarMonthTransition, { month: "2026-03", width: 375 });
assert.equal(animations.length, 2, "Rapid navigation replaces the transition");
draw(visuals.CalendarMonthTransition, { month: "2026-04", width: 320 });
assert.equal(animations.length, 2, "Resize settles immediately");
reduced = true;
draw(visuals.CalendarMonthTransition, { month: "2026-05", width: 320 });
assert.equal(animations.length, 2, "Reduced motion skips translation and fading");
console.log("Calendar checks passed: six themes, picker draft/cancel/commit, leap years, clamping, year rollover, markers, adjacent dates and reduced motion.");
