// Run: node components/ui/Medicine.check.js. No server or database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "../..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"] }).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile(read("theme.js")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
let colors = theme.PALETTES.boy, serial = 0, cursor = 0, slots = [], effects = [], animations = [], reduced = false;
const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity).filter(x => x != null && x !== false) } }),
    memo: fn => fn, useId: () => "test-" + (++serial), useMemo: fn => fn(), useCallback: fn => fn,
    useSyncExternalStore: (_, snapshot) => snapshot(),
    useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value;
        return [slots[i], next => slots[i] = typeof next === "function" ? next(slots[i]) : next]; },
    useEffect(fn, deps) { const i = cursor++, old = slots[i];
        if (!old || deps.some((value, n) => value !== old.deps[n])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
};
class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    stopAnimation() { this.stopped = true; }
    interpolate(options) { return { source: this, ...options }; }
}
const animate = (kind, value, options) => ({ start() { animations.push({ kind, ...options }); value.setValue(options.toValue); } });
const native = { View: "View", Text: "Text", Pressable: "Pressable", TouchableOpacity: "TouchableOpacity",
    StyleSheet: { create: value => value, absoluteFillObject: { position: "absolute", inset: 0 } },
    Platform: { OS: "web" }, Easing: { out: value => value, cubic: "cubic" },
    Animated: { Value, View: "AnimatedView", timing: (v,o) => animate("timing",v,o), spring: (v,o) => animate("spring",v,o) },
};
global.window = { matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }) };
const store = require("../../utils/recordStore.cjs");
const mocks = { react: React, "react-native": native, "@expo/vector-icons": { Ionicons: "Icon" },
    "react-native-svg": { __esModule: true, default: "Svg", ...Object.fromEntries(["Circle", "Defs", "LinearGradient", "RadialGradient", "G", "Rect", "ClipPath", "Path", "Stop"].map(key => [key,key])) } };
const cache = new Map();
function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file,module);
    new Function("require", "module", "exports", compile(read(file)))(name => {
        if (mocks[name]) return mocks[name];
        if (name.endsWith("ThemeContext")) return { useTheme: () => ({ colors }) };
        if (name.endsWith("recordStore.cjs")) return { __esModule: true, default: store };
        if (name.endsWith("/api")) return { api: {} };
        if (name.endsWith("Gradient")) return { __esModule: true, default: "Gradient" };
        return load(path.relative(root, path.resolve(root,path.dirname(file),name + (path.extname(name) ? "" : ".js"))));
    },module,module.exports);
    return module.exports;
}
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(nodes)] : [];
const find = (tree, predicate) => nodes(tree).find(predicate);
const text = tree => tree && typeof tree === "object" ? (tree.props.children || []).map(text).join(" ") : String(tree ?? "");
const reset = () => { slots = []; effects = []; animations = []; };
const draw = (component, props) => { cursor = 0; const tree = component(props); while (effects.length) effects.shift()(); return tree; };
const icon = load("components/ui/MedicationIcon.js");
for (const record of [undefined, {}, { resolved: false }, { resolved: "true" }, { status: "finished" }, { resolved_date: "2026-10-01" }])
    assert.equal(icon.medicationIconVariant(record), "purple");
assert.equal(icon.medicationIconVariant({ resolved: true }), "green");
for (const gender of ["boy","girl","neutral"]) for (const scheme of ["light","dark"]) {
    colors = theme.paletteFor(undefined, gender, scheme);
    const purple = draw(icon.default, { record: { resolved: false } });
    const green = draw(icon.default, { record: { resolved: true } });
    assert.deepEqual(nodes(purple).filter(n => n.type === "Path").map(n => n.props.d), nodes(green).filter(n => n.type === "Path").map(n => n.props.d));
    assert.equal(nodes(purple).filter(n => n.type === "Circle").length, 1);
    assert.equal(nodes(draw(icon.default, { showBackground: false })).filter(n => n.type === "Circle").length, 0);
    const ids = [...nodes(purple),...nodes(green)].filter(n => n.props.id).map(n => n.props.id);
    assert.equal(new Set(ids).size, ids.length);
}
const hooks = load("utils/useRecords.js"), medication = load("utils/medication.js");
store.reset();
const confirmed = () => hooks.useConfirmedRecords("child", "medication-doses");
const stamp = store.startFetch("child", "medication-doses"); store.acceptFetch("child", "medication-doses", [], stamp);
const op = store.begin({ child:"child", resource:"medication-doses", type:"create", body:{medication_id:1,given_date:"2026-10-09"}, entity:"med:1" });
assert.equal(store.getRows("child","medication-doses").length,1);
assert.equal(confirmed().length,0,"Pending doses never advance the confirmed progress");
store.update(op,{status:"uncertain"}); assert.equal(confirmed().length,0);
store.update(op,{status:"failed"}); assert.equal(confirmed().length,0);
store.finish(op,{id:7,medication_id:1,given_date:"2026-10-09"}); assert.equal(confirmed().length,1);
const undo = store.begin({child:"child",resource:"medication-doses",type:"delete",id:7,body:{},entity:"med:1"});
assert.equal(confirmed().length,1,"Pending Undo keeps confirmed progress"); store.finish(undo); assert.equal(confirmed().length,0);
assert.equal(hooks.useConfirmedRecords("other","medication-doses").length,0);
const visuals = load("components/ui/MedicineVisuals.js");
for (const [given,scheduled,expected] of [[0,3,0],[1,3,1/3],[3,3,1],[5,3,1]]) {
    reset(); let tree=draw(visuals.DoseProgress,{given,scheduled}); tree=draw(visuals.DoseProgress,{given,scheduled});
    const progress=find(tree,n=>n.props.accessibilityRole==="progressbar");
    assert.equal(progress.props.accessibilityValue.now,Math.min(given,scheduled));
    assert.equal(progress.props.style.flexDirection,"row");
    assert.equal(progress.props.style.alignItems,"center");
    assert.equal(find(tree,n=>n.props.style?.height===12).props.style.minWidth,30);
    assert(text(tree).replace(/\s+/g," ").includes(given+" / "+scheduled+" doses"));
    assert.equal(animations.at(-1).toValue,expected); assert.equal(animations.at(-1).duration,300);
}
reset(); assert(text(draw(visuals.DoseProgress,{given:2,scheduled:0})).includes("Schedule not recorded"));
reset(); reduced=true; draw(visuals.DoseProgress,{given:0,scheduled:3}); draw(visuals.DoseProgress,{given:2,scheduled:3}); assert.equal(animations.length,0);
reset(); reduced=false; let gave=0;
let button=draw(visuals.MedicineDoseButton,{onPress:()=>gave++,label:"Record a dose",disabled:false});
button=draw(visuals.MedicineDoseButton,{onPress:()=>gave++,label:"Record a dose",disabled:false});
button.props.onPressIn(); assert.equal(animations.at(-1).toValue,1); button.props.onPressOut(); assert.equal(animations.at(-1).kind,"spring");
button.props.onPress(); assert.equal(gave,1,"Action is not delayed by animation");
const health=read("components/Health.js");
const grouping=health.slice(health.indexOf("    const activeMeds"),health.indexOf("    // Names already"));
const group=new Function("medications","useMemo","isActiveOn","todayLocal",grouping+"return {activeMeds,finishedMeds,otherMeds};");
const records=[{id:1,date:"2026-10-01",courseDays:20,resolved:false},{id:2,date:"2026-10-01",resolved:true},
    {id:3,date:"2026-09-01",courseDays:3,resolved:false},{id:4,date:"2026-11-01",resolved:false},{id:5,resolved:false}];
const groups=group(records,fn=>fn(),medication.isActiveOn,()=>"2026-10-09");
assert.deepEqual(groups.activeMeds.map(m=>m.id),[1]); assert.deepEqual(groups.finishedMeds.map(m=>m.id),[2]); assert.deepEqual(groups.otherMeds.map(m=>m.id),[3,4,5]);
assert(health.includes('onPress={() => handleUndoDose(dose)}')); assert(health.includes('label: "Scheduled times"')); assert(health.includes('selectedIsMedication ? "medication" : conditionAttachmentType'));
for (const file of ["components/Search.js","components/Notifications.js","components/CalendarView.js","components/ProfessionalView.js","components/ui/ActionSheet.js"]) {
    assert(read(file).includes("<MedicationIcon"),file+" uses the shared pill"); assert(!read(file).includes("flask-outline"),file+" has no legacy flask");
}

function luminance(hex) {
    const channels=hex.match(/[a-f\d]{2}/gi).map(value=>parseInt(value,16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
    return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}
function contrast(a,b) { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
for (const gender of ["boy","girl","neutral"]) for(const scheme of ["light","dark"]) {
    const palette=theme.paletteFor(undefined,gender,scheme);
    for(const stop of palette.medicineAction.gradient) assert(contrast(stop,palette.medicineAction.foreground)>=4.5);
    assert(contrast(palette.medicineSurface.badge,palette.medicineSurface.badgeText)>=4.5);
}
let fontScale=1, opened=0, recorded=0;
const scope={ React,...React,...native,...theme, useWindowDimensions:()=>({fontScale}), useTheme:()=>({colors}),
    MedicationIcon:icon.default, ...visuals, ...medication, todayLocal:()=>"2026-10-09", medicationStatus:load("utils/viewerRecords.js").medicationStatus,
    fitsColumns:(width,count,gap)=>(width-gap*(count-1))/count>=theme.TEXT_COL_MIN };
delete scope.default;
const cardModule={exports:{}};
new Function(...Object.keys(scope),"module","exports",compile(health.slice(health.indexOf("function medicationLabel"),health.indexOf("export default function Health"))
    +health.slice(health.lastIndexOf("const makeStyles"))+"\nmodule.exports={MedicineCourseCard,makeStyles};"))(...Object.values(scope),cardModule,cardModule.exports);
const historyStyles=cardModule.exports.makeStyles(colors);
assert.equal(historyStyles.medicineHistorySection.padding,0,"The reveal owns the medicine history inset");
assert.equal(historyStyles.medicineHistoryHeader.paddingHorizontal,historyStyles.medicineHistoryList.paddingHorizontal);
assert.equal(historyStyles.medicineHistoryList.paddingHorizontal,20);
assert(historyStyles.medicineHistoryList.paddingTop>=12);
assert(historyStyles.medicineHistoryList.paddingBottom>=24);
assert.equal(historyStyles.finishedMedicine.marginBottom,12);
assert.equal(historyStyles.finishedMedicine.overflow,"visible","Finished item shadows are not clipped by the interactive wrapper");
assert(health.includes("<AnimatedReveal contentStyle={styles.medicineHistoryList}>"));
assert(health.includes("group.rows.slice(0, medsVisible)"));
assert(health.includes("setMedsVisible(c => c + 10)"));
const props={med:{id:1,title:"Recorded medication",date:"2026-10-01",frequencyPerDay:3},doses:[],onOpen:()=>opened++,onGive:()=>recorded++};
for(const [width,scale,stacked] of [[240,1,true],[320,1,false],[320,2,true],[520,1,false]]) {
    reset(); fontScale=scale; let tree=draw(cardModule.exports.MedicineCourseCard,props);
    find(tree,n=>n.props.onLayout).props.onLayout({nativeEvent:{layout:{width}}});
    find(tree,n=>n.type===visuals.MedicineDoseButton).props.onLayout({nativeEvent:{layout:{width:150*scale}}});
    find(tree,n=>n.type===visuals.DoseProgress).props.onCountLayout({nativeEvent:{layout:{width:75*scale}}});
    tree=draw(cardModule.exports.MedicineCourseCard,props);
    const foot=find(tree,n=>n.props.onLayout); assert.equal(Boolean(foot.props.style[1]),stacked);
    assert.equal(nodes(tree).filter(n=>n.type===visuals.DoseProgress).length,1);
    assert.equal(nodes(tree).filter(n=>n.props.accessibilityLabel?.startsWith("Edit ")).length,0);
    find(tree,n=>n.type==="TouchableOpacity").props.onPress();
    find(tree,n=>n.type===visuals.MedicineDoseButton).props.onPress();
}
assert.equal(opened,4); assert.equal(recorded,4);
reset();
let resized = draw(cardModule.exports.MedicineCourseCard,props);
const measure = (tree, width, buttonWidth, countWidth) => {
    find(tree,n=>n.type==="View" && n.props.onLayout).props.onLayout({nativeEvent:{layout:{width}}});
    find(tree,n=>n.type===visuals.MedicineDoseButton).props.onLayout({nativeEvent:{layout:{width:buttonWidth}}});
    find(tree,n=>n.type===visuals.DoseProgress).props.onCountLayout({nativeEvent:{layout:{width:countWidth}}});
    return draw(cardModule.exports.MedicineCourseCard,props);
};
resized = measure(resized,320,150,75);
assert.equal(Boolean(find(resized,n=>n.type==="View" && n.props.onLayout).props.style[1]),false);
resized = measure(resized,320,150,150);
assert.equal(Boolean(find(resized,n=>n.type==="View" && n.props.onLayout).props.style[1]),true,"Long counts reflow without overlap");
resized = measure(resized,520,150,150);
assert.equal(Boolean(find(resized,n=>n.type==="View" && n.props.onLayout).props.style[1]),false,"Resize restores the horizontal row");
reset();
const banner = draw(visuals.MedicineReminderBanner,{});
assert.equal(banner.props.style.padding,16);
assert.equal(banner.props.style.borderRadius,18);
assert(text(banner).includes("This preview can't send them, but everything you record here is saved."));

reset(); const unscheduled=draw(cardModule.exports.MedicineCourseCard,{...props,med:{id:1,title:"No schedule",date:"2026-10-01"}});
assert(!find(unscheduled,n=>n.type===visuals.MedicineDoseButton));
assert.equal(find(unscheduled,n=>n.type===visuals.DoseProgress).props.scheduled,0);

console.log("Medicine checks passed: six-theme capsule geometry/status/IDs, confirmed writes and Undo, dose progress, reduced motion, press behavior, course grouping and global icon callers.");
