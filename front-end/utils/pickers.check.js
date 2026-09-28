const fs = require("fs");
const path = require("path");
const assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "pickers.js"), "utf8").replace(/export function/g, "function");
const { availablePickerDates, closestAvailableDate, pickerDateParts, pickerDateValue, pickerYears, selectableMonths, timeParts, timeValue } = new Function(
    `${src}\nreturn { availablePickerDates, closestAvailableDate, pickerDateParts, pickerDateValue, pickerYears, selectableMonths, timeParts, timeValue };`,
)();

assert.deepStrictEqual(timeParts("00:05"), { period: "AM", hour: 12, minute: 5 });
assert.deepStrictEqual(timeParts("13:47"), { period: "PM", hour: 1, minute: 47 });
assert.strictEqual(timeValue({ period: "PM", hour: 12, minute: 3 }), "12:03");
assert.strictEqual(timeValue({ period: "AM", hour: 12, minute: 3 }), "00:03");
assert.deepStrictEqual(pickerDateParts("2026-09-25", "2020-01-01"), { year: 2026, month: 9, day: 25 });
assert.deepStrictEqual(pickerDateParts("", "2020-01-01"), { year: 2020, month: 1, day: 1 });
assert.strictEqual(pickerDateValue({ year: 2024, month: 2, day: 31 }), "2024-02-29");
assert.strictEqual(pickerDateValue({ year: 2026, month: 1, day: 1 }, "2026-03-10"), "2026-03-10");
assert.strictEqual(pickerDateValue({ year: 2026, month: 12, day: 1 }, null, "2026-09-25"), "2026-09-25");
assert.deepStrictEqual(pickerYears("1975-04-04", null, null, 2026), Array.from({ length: 141 }, (_, i) => 1906 + i));
assert.deepStrictEqual(pickerYears("2026-09-25", "2024-01-01", "2026-12-31"), [2024, 2025, 2026]);
assert.deepStrictEqual(
    availablePickerDates(["2026-09-20", "2026-08-04", "2026-09-20", "invalid"], "2026-08-10", "2026-09-30"),
    ["2026-09-20"],
);
assert.strictEqual(closestAvailableDate(["2026-08-10", "2026-08-20"], "2026-08-15"), "2026-08-10");
assert.strictEqual(closestAvailableDate(["2026-08-10", "2026-09-03"], "2026-09-01"), "2026-09-03");
assert.strictEqual(closestAvailableDate([], "2026-09-01"), "");
assert.deepStrictEqual(selectableMonths(2026, new Date(2026, 8, 15)), [8, 9, 10, 11]);
assert.deepStrictEqual(selectableMonths(2025, new Date(2026, 8, 15)), []);
const dateField = fs.readFileSync(path.join(__dirname, "../components/ui/DateField.js"), "utf8");
const growth = fs.readFileSync(path.join(__dirname, "../components/Growth.js"), "utf8");
const nutrition = fs.readFileSync(path.join(__dirname, "../components/ui/NutritionDateFilter.js"), "utf8");
const anchoredMenu = fs.readFileSync(path.join(__dirname, "../components/ui/AnchoredMenu.js"), "utf8");
const optionSheet = fs.readFileSync(path.join(__dirname, "../components/ui/OptionSheet.js"), "utf8");
const health = fs.readFileSync(path.join(__dirname, "../components/Health.js"), "utf8");
const medicine = fs.readFileSync(path.join(__dirname, "../components/ui/MedicineModal.js"), "utf8");
assert(dateField.includes("export function DateWheelPicker"));
assert.equal((dateField.match(/styles\.selectionBand/g) || []).length, 3, "Date, time and measurement wheels share the selected-value band");
assert(dateField.includes("backgroundColor: colors.surfaceAlt"));
assert(dateField.includes('label="Day"') && dateField.includes('label="Month"') && dateField.includes('label="Year"'));
const dateWheel = dateField.slice(dateField.indexOf("export function DateWheelPicker"), dateField.indexOf("function formatTime"));
assert(dateWheel.includes("style={styles.card}"), "Date and time pickers must share their card dimensions");
assert(dateWheel.includes("<Text style={styles.title}>{accessibilityLabel}</Text>"));
assert(dateWheel.includes('<TextButton label="Cancel"') && dateWheel.includes('<PrimaryButton label="Done"'));
assert(dateWheel.includes("onChange(draft); onClose();"), "Date changes commit only when Done is pressed");
assert(!dateWheel.includes("onChange(next)"), "Scrolling must remain a cancellable local draft");
assert(dateField.includes('dateWheels: {\n        height: 240'));
assert(dateField.includes('fontSize: 24, lineHeight: 30'));
assert(!dateField.includes("datePickerCard"));
assert(dateField.includes("ref={scrollRef}") && dateField.includes("scrollRef.current?.scrollTo"));
assert(dateField.includes("onLayout={scrollToValue}"));
assert(dateField.includes("active={visible}") && dateField.includes('active={open && mode === "time"}'));
assert(dateField.includes("onScrollEndDrag") && dateField.includes("onMomentumScrollEnd"));
assert(dateField.includes("setTimeout(selectAtOffset, 100)"));
assert(dateField.includes("if (values[nextIndex] !== value) onChange(values[nextIndex])"));
assert(!dateField.includes('key={`${label}-${value}`}'), "Changing a wheel value must not remount its ScrollView");
assert(!dateField.includes("contentOffset={{"), "Visible wheels explicitly synchronize after layout instead");
assert(!dateField.includes("borderRightWidth"), "Time wheel columns must not render vertical dividers");
assert(!dateField.includes("wheelItemSelected"), "All wheel modals use the grey band instead of selected-row borders");
const timeWheel = dateField.slice(dateField.indexOf('<Modal visible={open && mode === "time"}'), dateField.indexOf("<DateWheelPicker", dateField.indexOf('<Modal visible={open && mode === "time"}')));
const measurementWheel = dateField.slice(dateField.indexOf("export function MeasurementField"), dateField.indexOf("const makeStyles"));
assert(timeWheel.includes("styles.regularSelectionBand"));
assert(measurementWheel.includes("styles.regularSelectionBand"));
assert(measurementWheel.includes("styles.measurementNumberGroup"));
assert(!measurementWheel.includes("compact"), "Measurement wheels use the time wheel's 64px rows and 36px text");
assert(dateField.includes('measurementNumberGroup: { width: "66.6667%"'), "Two equal measurement wheels occupy the centered width of two time columns");
assert(growth.includes("<DateWheelPicker") && nutrition.includes("<DateWheelPicker"));
assert(growth.includes("availableDates={availableMeasurementDates}"), "Growth date wheels use measurement-bearing dates");
assert(nutrition.includes("availableDates={availableDates}"), "Nutrition date wheels use nutrition-record dates");
assert(growth.includes('name="funnel"'), "Growth uses the funnel chart-filter button");
assert(/visible=\{metricMenuOpen\}[\s\S]*?dimBackdrop=\{false\}/.test(growth), "Growth chart checklist is anchored without a dim backdrop");
assert(/visible=\{metricMenuOpen\}[\s\S]*?animation="warp"/.test(growth), "Growth chart checklist warps from its icon");
assert(growth.includes('accessibilityRole="switch"'), "Growth chart choices use accessible switches");
assert(growth.includes("thumbColor={colors.onPrimary}") && growth.includes("activeThumbColor: colors.onPrimary"), "Growth chart switches use a white thumb in both states");
assert(growth.includes('maxWidth: "100%"') && !/dateSelect:\s*\{[\s\S]*?flex:\s*1,/.test(growth.match(/dateSelect:\s*\{[\s\S]*?\n\s*\},/)[0]), "Growth date filter sizes to its label");
assert(growth.includes("visibleMetrics.map"), "Growth renders only selected charts");
assert(!growth.includes("const METRIC_FILTERS"), "Growth chart filtering no longer exposes an All option");
assert(anchoredMenu.includes('animationMode = animation || (select ? "fold" : "scale")'), "Input dropdowns share the fold animation");
assert(anchoredMenu.includes('transformOrigin: warping ? "top right" : "top left"'), "Chart menus warp from their icon edge");
assert(optionSheet.includes('variant="select"') && optionSheet.includes("initialScrollOffset"), "Long option lists are scrolling anchored selects");
for (const source of [growth, health, medicine]) {
    assert(source.includes("measureInWindow") && source.includes("anchor="), "Long selectors measure and follow their inputs");
}
console.log("picker helpers: ok");
