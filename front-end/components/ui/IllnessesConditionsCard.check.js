// Run: node components/ui/HospitalStaysCard.check.js — no backend or record writes.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { transformSync } = require("@babel/core");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] }).code;
const read = file => fs.readFileSync(path.join(__dirname, file), "utf8");
const themeModule = { exports: {} }; new Function("module", "exports", compile(read("../../theme.js")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(nodes)] : [];
const find = (tree, fn) => nodes(tree).find(fn);
const text = tree => tree && typeof tree === "object" ? (tree.props.children || []).map(text).join("") : String(tree ?? "");
const merge = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
function harness(file = "IllnessesConditionsCard.js") {
    const slots = []; let cursor = 0, serial = 0, colors = theme.PALETTES.boy, fontScale = 1, platform = "web";
    const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }), memo: fn => fn,
        useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => fn(), useRef: value => ({current:value}), useId: () => "condition-test-" + serial++, useState(initial) {
            const i = cursor++; if (!(i in slots)) slots[i] = initial;
            return [slots[i], next => slots[i] = typeof next === "function" ? next(slots[i]) : next];
        } };
    const imports = { "./AllRecordsIcon": { __esModule: true, default: "AllRecordsIcon" }, "./ImmunizationStatusIcon": { __esModule: true, default: "ImmunizationStatusIcon" }, react: { __esModule: true, default: react, ...react }, "react-native": {
        View: "View", Pressable: "Pressable", Text: "Text", Image: "Image", Platform: { get OS() {return platform;} }, TouchableOpacity:"TouchableOpacity", PanResponder:{create:()=>({panHandlers:{}})}, Animated: { View: "AnimatedView", Value:class {constructor(v){this.value=v;} interpolate(){return 0;} stopAnimation(cb){cb?.(this.value);} setValue(v){this.value=v;}}, spring:()=>({start(){}}) },
        StyleSheet: { create: value => value, absoluteFillObject: { position: "absolute", inset: 0 } }, useWindowDimensions: () => ({ fontScale }) },
        "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Defs: "Defs", Ellipse: "Ellipse", LinearGradient: "LinearGradient", RadialGradient: "RadialGradient", Path: "Path", Rect: "Rect", Stop: "Stop" },
        "@expo/vector-icons": { Ionicons: "Icon" }, "../../context/ThemeContext": { useTheme: () => ({ colors }) }, "../../theme": theme,
        "./ConsultationsAppointmentsCard": { DashboardSurface: "Surface", DashboardControl: "Control", DashboardListTransition: "ListTransition", AppointmentStatusIcon: "StatusIcon" },
        "./AnimatedReveal": { __esModule: true, default: "AnimatedReveal" }, "./Skeleton": { AppointmentsSkeleton: "Skeleton", SkeletonBlock: "SkeletonBlock" },
        "./HospitalBuildingIcon": { __esModule: true, default: "Building" }, "./HospitalStayIcon": { __esModule: true, default: "HospitalStayIcon" },
        "./useReducedMotion": {__esModule:true,default:()=>true}, "../../utils/swipeMath": {shouldClaimHorizontalSwipe:()=>false,shouldOpenSwipe:()=>false},
        "./useSoftPress": { __esModule: true, default: () => ({ respond() {}, transform: [] }) } };
    Object.assign(imports, {
        "./RecordIcon": { __esModule: true, default: "RecordIcon", IllnessIcon: "IllnessIcon" },
        "./ConditionsArtwork": { __esModule: true, default: "ConditionsArtwork" },
        "./SwipeActionRow": { __esModule: true, default: "SwipeActionRow" },
        "./Gradient": { __esModule: true, default: "Gradient" },
        "./VaccineIcon": { __esModule: true, default: "VaccineIcon" },
        "./MilkIcon": { __esModule: true, default: "MilkIcon" },
        "./SolidFoodIcon": { __esModule: true, default: "SolidFoodIcon" },
        "./MilestoneIcon": { __esModule: true, default: "MilestoneIcon" },
        "../../assets/profile/allergies.png": "approved-allergy-asset",
        "../../utils/conditions.cjs": { __esModule: true, default: require("../../utils/conditions.cjs") },
        "../../utils/dates": { shortDate: value => value },
        "../../utils/viewerRecords": { conditionDuration: () => "Recorded duration" },
    });
    const module = { exports: {} };
    new Function("require", "module", "exports", compile(read(file)))(name => { assert(name in imports, name); return imports[name]; }, module, module.exports);
    return { api: module.exports, platform(value){platform=value;}, palette(value) { colors = value; }, scale(value) { fontScale = value; }, draw(fn, props) { cursor = 0; return fn(props); } };
}

const { conditionsSummary } = require("../../utils/conditions.cjs");
const h = harness(), calls = [];
const records = ["Illness", "Allergy", "Hereditary Condition"].flatMap((category, group) => Array.from({length:[24,23,1][group]},(_,i)=>({id:`${group}-${i}`,category,title:"Saved medical title",resolved:true,date:"2026-10-10",resolvedDate:"2026-10-12"})));
let props = { summary: conditionsSummary(records), today:"2026-10-15", onAdd:()=>calls.push("add"), onOpen:record=>calls.push(record), onEdit:record=>calls.push(record), onDelete:record=>calls.push(record) };
const draw = changes => h.draw(h.api.default, props={...props,...changes});
const metrics = tree => find(tree,n=>n.type===h.api.ConditionsSummaryMetrics);
const items = tree => nodes(tree).filter(n=>n.type===h.api.ConditionRecordItem);
const more = tree => find(tree,n=>n.props.accessibilityLabel?.startsWith("Show more"));
let tree=draw(); assert.equal(metrics(tree).props.filter,"all"); assert.equal(items(tree).length,10); assert(more(tree).props.accessibilityLabel.includes("38 remaining"));
for(const category of ["Illness","Allergy","Hereditary Condition","all"]){
 metrics(tree).props.onSelect(category);tree=draw();assert(items(tree).every(n=>category==="all"||n.props.record.category===category));
 assert.equal(items(tree).length,Math.min(10,props.summary.counts[category]));
 while(more(tree)){const before=items(tree).length;more(tree).props.onPress();tree=draw();assert(items(tree).length>before);}
 assert.equal(items(tree).length,props.summary.counts[category]);assert.equal(new Set(items(tree).map(n=>n.props.record.id)).size,items(tree).length);
}
metrics(tree).props.onSelect("Allergy");tree=draw();assert.equal(items(tree).length,10,"Filter switching resets the batch");
tree=draw({summary:conditionsSummary([])});assert.equal(items(tree).length,0);assert(text(tree).includes("No allergy information recorded yet."));assert(!more(tree));
for(const [category,message] of [["all","No illnesses or conditions recorded yet"],["Illness","No illness records yet."],["Hereditary Condition","No hereditary history recorded yet."]]){
 metrics(tree).props.onSelect(category);tree=draw();assert(text(tree).includes(message));assert(find(tree,n=>n.props.testID==="condition-empty"));
}
tree=draw({loading:true});assert(!metrics(tree));assert(find(tree,n=>n.props.accessibilityRole==="progressbar"));
tree=draw({loading:false,loadFailed:true,onRetry:()=>calls.push("retry")});find(tree,n=>n.props.accessibilityLabel==="Retry loading conditions").props.onPress();assert.equal(calls.at(-1),"retry");
find(tree,n=>n.props.accessibilityLabel==="Log a condition").props.onPress();assert.equal(calls.at(-1),"add");
tree=draw({loadFailed:false,summary:conditionsSummary(records.slice(0,4))});metrics(tree).props.onSelect("all");tree=draw();assert.equal(items(tree).length,4);assert(!more(tree));assert(!find(tree,n=>n.props.testID==="condition-empty"));
for(const colors of [...Object.values(theme.PALETTES),...Object.values(theme.DARK_PALETTES)]){
 const m=harness();m.palette(colors);const mp={counts:conditionsSummary(records).counts,filter:"Allergy",onSelect:key=>calls.push(key)};
 for(const [width,scale,rowCount] of [[240,1,2],[311,1,2],[700,1,1],[311,1.6,4]]){
  m.scale(scale);let mt=m.draw(m.api.ConditionsSummaryMetrics,mp);mt.props.onLayout({nativeEvent:{layout:{width}}});mt=m.draw(m.api.ConditionsSummaryMetrics,mp);
  assert.equal(mt.props.children.length,rowCount);const buttons=nodes(mt).filter(n=>n.type==="Control");assert.equal(buttons.length,4);
  for(const b of buttons){assert(merge(b.props.style).minHeight>=44);assert.equal(b.props.accessibilityState.selected,b.props.testID==="condition-filter-Allergy");b.props.onPress();assert.equal(calls.at(-1),b.props.testID.replace("condition-filter-",""));}
 }
 for(const category of ["Illness","Allergy","Hereditary Condition"]){
  const record={...records[0],category,title:"No known drug allergies",desc:"Saved note"};let r=m.draw(m.api.ConditionRecordItem,{record,today:"2026-10-15",onOpen:v=>calls.push(v),onEdit:v=>calls.push(v),onDelete:v=>calls.push(v),onSwipeClose:()=>calls.push("close")});
  assert.equal(r.type,"SwipeActionRow");assert.equal(r.props.pressScale,0.985);assert.equal(find(r,n=>n.type==="RecordIcon").props.category,category);
  assert(!nodes(r).some(n=>n.type==="Pressable"||n.type==="Control"),"Chevron has no competing action");
  r.props.onPress();assert.equal(calls.at(-1),record);r.props.actions[0].onPress();assert.equal(calls.at(-1),record);r.props.actions[1].onPress();assert.equal(calls.at(-1),record);
  assert.equal(text(r).includes("Better"),category==="Illness");if(category==="Allergy"){assert(text(r).includes("Allergy information"));assert(!text(r).includes("Active"));}
  assert.equal(merge(r.props.style).overflow,"visible");assert(text(r).includes("Saved note"));
 }
 const icons=harness("RecordIcon.js");icons.palette(colors);
 for(const category of ["Illness","Allergy","Hereditary Condition"])assert.equal(icons.draw(icons.api.default,{category}).type,icons.api.recordIconRegistry[category]);
 assert.equal(icons.draw(icons.api.default,{category:"Medication"}),null,"Other categories retain their existing icon systems");
 const allergy=icons.draw(icons.api.AllergyIcon,{size:48});const image=find(allergy,n=>n.type==="Image");assert.equal(image.props.source,"approved-allergy-asset");assert.equal(image.props.resizeMode,"contain");assert.equal(image.props.style.width,48*0.84);
 const dna=icons.draw(icons.api.HereditaryIcon,{});assert.equal(dna.props.dna,true); const purple=icons.draw(dna.type,dna.props); assert.equal(find(purple,n=>n.type==="Svg").props.style.position,"relative"); assert.deepEqual(nodes(purple).filter(n=>n.type==="Stop").map(n=>n.props.stopColor),["#C4B5FD","#8B5CF6","#6D28D9"]);
}
for(const file of ["../Health.js","../Search.js","../ProfessionalView.js"])assert(read(file).includes("<RecordIcon"),file);
assert(read("ProfileVisuals.js").includes("<AllergyIcon")&&read("ProfileVisuals.js").includes("<HereditaryIcon"));
assert.equal((read("ActionSheet.js").match(/<IllnessIcon/g)||[]).length,2);
assert(!read("../Health.js").includes("setConditions"));assert(read("../Health.js").includes('label: "Saved status"'));
console.log("Conditions card checks passed: filters, pagination, empty/loading/error states, responsive metrics, saved statuses, actions and canonical icons.");

const swipe=harness("SwipeActionRow.js");
for(const platform of ["web","ios"]){
 swipe.platform(platform);const tree=swipe.draw(swipe.api.default,{open:false,label:"View saved record",onPress:()=>calls.push("open"),onOpen:()=>calls.push("actions"),onClose:()=>calls.push("close"),actions:[{key:"update",label:"Update",onPress:()=>calls.push("edit")}],children:"content"});
 const outer=find(tree,n=>n.type==="View"&&n.props.onAccessibilityTap);assert.equal(outer.props.accessibilityRole,platform==="web"?undefined:"button");
 const navigation=nodes(tree).find(n=>n.type==="TouchableOpacity"&&!n.props.accessibilityLabel?.startsWith("Update"));assert.equal(navigation.props.accessible,platform==="web");
 if(platform==="web"){assert.equal(navigation.props.accessibilityRole,"button");navigation.props.onPress();assert.equal(calls.at(-1),"open");}
 const action=find(tree,n=>n.props.accessibilityLabel?.startsWith("Update"));assert.equal(action.props.tabIndex,-1);
 assert(find(tree,n=>n.props["aria-hidden"]===true));
}
console.log("Swipe accessibility checks passed: sibling web buttons, retained native actions, hidden action focus and keyboard opening.");

const openSwipe=swipe.draw(swipe.api.default,{open:true,label:"View saved record",actions:[{key:"update",label:"Update"}],children:"content"});
const foreground=nodes(openSwipe).find(n=>merge(n.props.style).transform?.[0]?.translateX);
assert.equal(merge(foreground.props.style).transform[0].translateX.value,-60,"Reduced motion settles immediately, including action geometry");
