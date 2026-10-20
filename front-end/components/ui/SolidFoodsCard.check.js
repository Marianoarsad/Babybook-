// Actual JSX and state transitions with fictional data; no UI/runtime or API access.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
function pure(file) {
    const filename = path.resolve(__dirname, file), module = { exports: {} };
    if (filename.endsWith(".cjs") || filename.endsWith(".json")) return require(filename);
    new Function("require", "module", "exports", compile(fs.readFileSync(filename, "utf8")))(name => pure(path.resolve(path.dirname(filename), name + (path.extname(name) ? "" : ".js"))), module, module.exports);
    return module.exports;
}
const theme = pure("../../theme.js"), selectors = pure("../../utils/milkTypeHistory.js");
const all = tree => tree && typeof tree === "object" ? [tree, ...(tree.type?.name === "FeedingStackedPlot" ? all(tree.type(tree.props)) : (tree.props.children || []).flatMap(all))] : [];
const find = (tree, predicate) => all(tree).find(predicate);
const text = tree => tree && typeof tree === "object" ? (tree.props.children || []).map(text).join(" ") : String(tree ?? "");
const slots = []; let cursor = 0, fontScale = 1, palette = theme.PALETTES.boy;
const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }), useMemo: fn => fn(), useId: () => "test",
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => slots[i] = typeof value === "function" ? value(slots[i]) : value]; } };
const defaults = name => ({ __esModule: true, default: name });
const imports = { react: { __esModule: true, default: react, ...react }, "react-native": { Platform: { OS: "web" }, View: "View", Text: "Text", ScrollView: "ScrollView", Switch: "Switch", TextInput: "Input", Pressable: "Pressable", Animated: { View: "AnimatedView" }, StyleSheet: { create: s => s }, useWindowDimensions: () => ({ fontScale, height: 844 }) },
    "react-native-svg": { __esModule: true, default: "Svg", Defs: "Defs", Line: "Line", LinearGradient: "LinearGradient", Rect: "Rect", Stop: "Stop", Path: "Path", Text: "SvgText" },
    "@expo/vector-icons": { Ionicons: "Icon" }, "../../context/ThemeContext": { useTheme: () => ({ colors: palette }) }, "../../theme": theme,
    "../../utils/api": { api: { deleteRecord: async () => {} } }, "../../utils/useRecords": { useRecordSave: () => async () => {} }, "../../utils/dates": pure("../../utils/dates.js"),
    "../../utils/milkFeedingChart": pure("../../utils/milkFeedingChart.js"), "../../utils/feedingStats": pure("../../utils/feedingStats.js"),
    "../../utils/milkTypeHistory": selectors, "./ConsultationsAppointmentsCard": { DashboardSurface: "Surface", DashboardControl: "Control", DashboardListTransition: "Transition" },
    "./MilkIcon": defaults("MilkIcon"), "./AnimatedReveal": defaults("Reveal"), "./RecordFormSheet": { ...defaults("Form"), DeleteConfirmation: "Delete", RecordFormGroup: "Group" },
    "./DateField": { DateField: "Date" }, "./Field": defaults("Field"), "./PlanDetail": defaults("Detail"), "./Skeleton": { SkeletonBlock: "Skeleton" },
    "./AppModal": defaults("Modal"), "./KeyboardAvoider": defaults("KeyboardAvoider"), "./useBottomSheetMotion": { ...defaults(() => ({ presented: true, dismiss() {}, pan: { panHandlers: {} } })) },
    "./useSoftPress": defaults(() => ({ respond() {}, transform: [] })), "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) } };
const modulePlot = { exports: {} };
new Function("require", "module", "exports", compile(fs.readFileSync(path.join(__dirname, "FeedingStackedPlot.js"), "utf8")))(name => { assert(name in imports, name); return imports[name]; }, modulePlot, modulePlot.exports);
imports["./FeedingStackedPlot"] = modulePlot.exports;
imports["../../utils/solidFoods"] = pure("../../utils/solidFoods.js");
imports["../../utils/whoGrowth"] = pure("../../utils/whoGrowth.js");
imports["./SolidFoodIcon"] = defaults("SolidFoodIcon");
imports["./FoodCategoryIcon"] = defaults("FoodCategoryIcon");
const moduleUI = { exports: {} };
new Function("require", "module", "exports", compile(fs.readFileSync(path.join(__dirname, "SolidFoodsCard.js"), "utf8")))(name => { assert(name in imports, name); return imports[name]; }, moduleUI, moduleUI.exports);
const UI = moduleUI.exports, S = imports["../../utils/solidFoods"], today = "2026-10-16";
const entries = Array.from({length:24}, (_,i) => ({ id:i+1, entryType:"solid", foodIntroduced:`Food ${i+1}`, date:today, foodCategory:S.FOOD_CATEGORIES[i%6] }));
entries[0] = {...entries[0], foodIntroduced:"Shrimp", reactionSeverity:"severe", reaction:"Rash around the arm appeared.", date:"2026-09-27"};
entries[1] = {...entries[1], foodIntroduced:"Scrambled eggs", reactionSeverity:"mild", reaction:"Mild rash around the mouth, resolved within hours.", date:"2026-07-12"};
entries[2] = {...entries[2], foodIntroduced:"Beef nilaga and rice", date:"2026-05-16"};
let opened = null, added = 0, props = { entries, today, dob:"2025-11-14", onOpenEntry: entry=>opened=entry, onAdd:()=>added++, onRetry(){} };
const render = changes => { cursor=0; props={...props,...changes}; return UI.default(props); };
const detail = tree => find(tree,n=>n.type==="Detail");
const active = tree => detail(tree)?.props.visible ? detail(tree) : {props:{children:tree.props.children.filter(n=>n?.type!=="Detail")}};
const rows = tree => all(active(tree)).filter(n=>n.type===UI.SolidFoodRow);
const button = (tree,label) => find(active(tree),n=>n.props.accessibilityLabel?.startsWith(label));
let tree=render();
find(tree,n=>n.props.testID==="solid-food-card").props.onLayout({nativeEvent:{layout:{width:390}}});
find(tree,n=>n.props.onLayout && !n.props.testID).props.onLayout({nativeEvent:{layout:{width:294}}}); tree=render();
assert.equal(rows(tree).filter(n=>!n.props.reaction).length,3); assert.equal(rows(tree).filter(n=>n.props.reaction).length,2);
assert.equal(find(tree,n=>n.props.testID==="solid-category-metrics").props.children.length,6);
assert.equal(find(tree,n=>n.props.testID==="solid-category-metrics").props.children[0].props.style[1].width,"48%");
assert(find(tree,n=>n.props.testID==="solid-y-axis"));
assert.equal(all(tree).filter(n=>n.props.testID?.startsWith("solid-date-")).length,7);
assert.equal(all(tree).filter(n=>n.props.testID?.startsWith("solid-segment-")).length,6);
assert.equal(all(tree).filter(n=>n.props.testID?.startsWith("solid-segment-") && n.type==="Path").length,1);
assert.equal(button(tree,"View all food reactions").props.appearance, "text");
assert.equal(button(tree,"View all solid food records").props.appearance, "text");
assert.equal(button(tree,"View solid food chart data and help").props.faceSize, 32);
assert.equal(find(tree,n=>n.props.testID==="solid-legend").props.children[0].props.style[1].width,"32%");
const metricCards = find(tree,n=>n.props.testID==="solid-category-metrics").props.children;
assert.equal(metricCards.reduce((sum, card)=>sum+Number(card.props.accessibilityLabel.match(/, (\d+)%/)[1]),0),100);
find(tree,n=>n.props.testID==="solid-food-card").props.onLayout({nativeEvent:{layout:{width:900}}});
find(tree,n=>n.props.onLayout && !n.props.testID).props.onLayout({nativeEvent:{layout:{width:804}}}); tree=render();
assert.equal(find(tree,n=>n.props.testID==="solid-category-metrics").props.children[0].props.style[2].flexDirection,"row");
assert.equal(find(tree,n=>n.props.testID==="solid-legend").props.style[1].width,300);
find(tree,n=>n.props.testID==="solid-food-card").props.onLayout({nativeEvent:{layout:{width:320}}});
find(tree,n=>n.props.onLayout && !n.props.testID).props.onLayout({nativeEvent:{layout:{width:224}}}); tree=render();
assert.equal(find(tree,n=>n.props.testID==="solid-legend").props.children[0].props.style[1].width,"49%");
assert.equal(text(find(tree,n=>n.props.testID===`solid-total-${today}`)),"21");
assert(all(tree).filter(n=>n.type==="Line").every(n=>n.props.y1===n.props.y2));
button(tree,"Add solid food").props.onPress(); assert.equal(added,1);
button(tree,"View all solid food records").props.onPress(); tree=render(); assert(detail(tree).props.visible); assert.equal(rows(tree).length,10);
assert.equal(detail(tree).props.plan.details.find(d=>d.label==="First solid food").value,"Beef nilaga and rice \u00b7 16 May 2026 \u00b7 6 months old");
button(tree,"Show more food records").props.onPress(); tree=render(); assert.equal(rows(tree).length,20);
button(tree,"Show more food records").props.onPress(); tree=render(); assert.equal(rows(tree).length,24); assert(!button(tree,"Show more food records"));
find(active(tree),n=>n.props.testID==="solid-food-search").props.onChangeText("arm"); tree=render(); assert.equal(rows(tree).length,1); assert.equal(rows(tree)[0].props.entry.foodIntroduced,"Shrimp");
rows(tree)[0].props.onOpen(rows(tree)[0].props.entry); assert.equal(opened.id,1); tree=render(); assert.equal(detail(tree).props.visible,false);
button(tree,"Clear food search").props.onPress(); tree=render();
button(tree,"View all food reactions").props.onPress(); tree=render(); assert.equal(rows(tree).length,2); assert.equal(rows(tree)[0].props.entry.foodIntroduced,"Shrimp"); detail(tree).props.onClose(); tree=render();
find(tree,n=>n.props.testID==="solid-range-30").props.onPress(); tree=render(); assert(find(tree,n=>n.props.testID==="solid-range-30").props.accessibilityState.selected);
assert.equal(all(tree).filter(n=>n.props.testID?.startsWith("solid-date-")).length,30);
find(tree,n=>n.props.testID==="solid-range-7").props.onPress(); tree=render();
find(tree,n=>n.props.testID===`solid-segment-${today}-fruits`).props.onPress(); tree=render(); assert(detail(tree).props.visible); assert(detail(tree).props.plan.title.startsWith("Fruits"));
button(tree,"View food entry").props.onPress(); tree=render(); assert.equal(detail(tree).props.visible,false);
button(tree,"View solid food chart data and help").props.onPress(); tree=render(); assert(detail(tree).props.plan.notes.includes("Other includes entries without a recorded category"));
assert.equal(all(active(tree)).filter(n=>n.props.accessibilityLabel?.includes("entries. Fruits")).length,7); detail(tree).props.onClose();
slots.length=0; tree=render({entries:[]}); assert(text(tree).includes("No food reactions recorded.")); assert(text(tree).includes("No recorded solid food entries in this period.")); assert(find(tree,n=>n.props.testID==="solid-y-axis"));
tree=render({unavailable:true,failed:true}); assert(text(tree).includes("Unavailable")); assert(button(tree,"Retry loading solid foods")); assert(!text(tree).includes("No food reactions recorded."));
button(tree,"View all solid food records").props.onPress(); tree=render(); assert.equal(detail(tree).props.plan.details[0].value,"Unavailable"); detail(tree).props.onClose();
for (const paletteSet of [theme.PALETTES,theme.DARK_PALETTES]) for (const name of ["boy","girl","neutral"]) {
    palette=paletteSet[name]; tree=render({entries,unavailable:false,failed:false});
    for (const category of S.FOOD_CATEGORIES) assert(palette.solidFoodCategories[category].shadow);
}
palette=theme.PALETTES.boy; slots.length=0; cursor=0;
let row=UI.SolidFoodRow({entry:entries[0],reaction:true,onOpen:entry=>opened=entry});
assert(text(row).includes(entries[0].reaction)); assert(text(row).includes("Severe")); assert.equal(row.props.material.surface[1],palette.dangerBg);
row.props.onPress(); assert.equal(opened.id,1);
cursor=0; row=UI.SolidFoodRow({entry:entries[1],reaction:true,onOpen(){}}); assert.equal(row.props.material.surface[1],palette.warningBg);
const tracker=fs.readFileSync(path.join(__dirname,"../NutritionTracker.js"),"utf8"), registry=fs.readFileSync(path.join(__dirname,"RecordIcon.js"),"utf8");
assert(tracker.includes('onAdd={() => openAdd("solid")}')); assert(tracker.includes('reactionSeverity: e.reactionSeverity || ""')); assert(tracker.includes('foodCategory: e.foodCategory || ""'));
assert(registry.includes('solid: SolidFoodIcon'));
console.log("Solid Foods JSX checks passed: complete dashboard, six responsive metrics, stacked axes/dates/gridlines/totals/rounding, original reaction cards, history milestone/search/pagination, record/chart navigation, add, errors and shared icon.");
