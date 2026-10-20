// node components/ui/BabyProfileCard.check.js -- fictional fixtures only.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { transformSync } = require("@babel/core");
const compile = s => transformSync(s,{babelrc:false,configFile:false,plugins:["@babel/plugin-transform-modules-commonjs","@babel/plugin-transform-react-jsx"]}).code;
let colors, width=390, fontScale=1, slots=[], cursor=0;
const React = { Fragment:"Fragment", forwardRef:fn=>fn, useMemo:fn=>fn(),
 useState:initial=>{const i=cursor++; if(!(i in slots)) slots[i]=initial;return [slots[i],v=>slots[i]=v];},
 createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(c=>c!=null&&c!==false)}) };
const native={View:"View",Text:"Text",Image:"Image",Pressable:"Pressable",Animated:{View:"AnimatedView"},Platform:{OS:"web"},
 StyleSheet:{create:s=>s,absoluteFillObject:{position:"absolute",inset:0}},useWindowDimensions:()=>({width,fontScale})};
const load=(file,mocks={})=>{const mod={exports:{}};new Function("require","module","exports",compile(fs.readFileSync(path.resolve(__dirname,file),"utf8")))(name=>{
 if(name in mocks)return mocks[name];if(name==="react")return React;if(name==="react-native")return native;
 if(name==="@expo/vector-icons")return {Ionicons:"Icon"};if(name.endsWith("ThemeContext"))return {useTheme:()=>({colors})};
 if(name.endsWith("theme"))return theme;if(name.endsWith("dates"))return {shortDate:d=>d,shortTime:t=>t};
 if(name.endsWith(".png"))return name;return {__esModule:true,default:name};},mod,mod.exports);return mod.exports;};
const theme=load("../../theme.js");
const visuals=load("ProfileVisuals.js",{"./RecordIcon":{AllergyIcon:"AllergyIcon",HereditaryIcon:"HereditaryIcon"},"./GrowthVisuals":{GrowthMetricIcon:"GrowthMetricIcon"},"./useSoftPress":{__esModule:true,default:()=>({respond(){},transform:[]})}});
const Card=load("BabyProfileCard.js",{"./ProfileVisuals":visuals}).default;
const data=load("../../utils/babyProfile.js");
const Detail=load("../BabyProfileScreen.js",{"./ui/ProfileVisuals":visuals,"../utils/babyProfile":data,"../utils/conditions.cjs":require("../../utils/conditions.cjs")}).BabyProfileContent;
const nodes=tree=>typeof tree==="object"&&tree?[tree,...tree.children.flatMap(nodes)]:[];
const text=tree=>typeof tree==="object"&&tree?tree.children.map(text).join(" "):String(tree??"");
const find=(tree,id)=>nodes(tree).find(n=>n.props.testID===id);
const draw=(fn,props,reset=true)=>{cursor=0;if(reset)slots=[];return fn(props);};
const profile={id:"fixture-a",name:"Alex Test",nickname:"Al",sex:"Female",gender:"girl",dateOfBirth:"2025-01-01",avatarUrl:"/fictional.jpg",hasRecordedAvatar:true,
 bloodType:"A+",allergies:["Recorded allergy"],hereditaryConditions:["Recorded condition (Grandparent)"],birthWeight:3.21,birthHeight:50,birthHeadCircumference:34,
 placeOfBirth:"Recorded birthplace",hospital:"Recorded hospital",obgynName:"Dr. Fiction",obgynContactNumber:"1234",pediatricianName:"Dr. Example",
 pediatricianContactNumber:"5678",pediatricianClinicHospital:"Recorded clinic",emergencyContactDetails:{firstName:"Sam",lastName:"Test",relationship:"Parent",contactNumber:"00123456789"}};
const growth=[{id:1,date_recorded:"2026-01-01",weight:"7.80",height:68,head_circumference:49.7}];
for(colors of [...Object.values(theme.PALETTES),...Object.values(theme.DARK_PALETTES)])for(width of [320,390,768])for(fontScale of [1,2]){
 let opened=0,photo=0;
 const tree=draw(Card,{profile,age:"12 months",measurements:data.latestProfileMeasurements(growth),onViewProfile:()=>opened++,onChangePhoto:()=>photo++});
 assert(text(tree).includes("Alex Test"));assert(text(tree).includes("12 months"));
 for(const hidden of ["Blood Type","Allergies","Hereditary","Hide details","Nickname","Born "])assert(!text(tree).includes(hidden));
 find(tree,"view-baby-profile").props.onPress();assert.equal(opened,1);
 nodes(tree).find(n=>n.type===visuals.ProfilePhoto).props.onChangePhoto();assert.equal(photo,1);
 const metrics=draw(visuals.ProfileMetrics,{measurements:data.latestProfileMeasurements(growth),showDates:true});
 assert.equal(metrics.props.style.flexDirection,fontScale===2&&width<600?"column":"row");
 assert.equal(nodes(metrics).filter(n=>n.type==="GrowthMetricIcon").length,3);
 assert(nodes(metrics).filter(n=>n.props.accessibilityLabel).every(n=>n.props.accessibilityLabel.includes("2026-01-01")));
 const detail=draw(Detail,{profile,growth,medical:[]});
 assert.deepEqual(nodes(detail).filter(n=>n.props.testID?.startsWith("profile-")).map(n=>n.props.testID),["profile-identity","profile-growth","profile-mint","profile-lavender","profile-blood","profile-birth","profile-contacts"]);
 for(const value of ["3.21 kg","34 cm","Recorded birthplace","Recorded hospital","OB-GYNE Contact","1234","5678","Recorded clinic","00123456789"])assert(text(detail).includes(value),value);
 for(const kind of ["mint","lavender"]){const section=find(detail,"profile-"+kind);assert(!nodes(section).some(n=>n.type===visuals.ProfileIcon&&n.props.kind==="edit"));}
 assert(!text(detail).includes("Address"));assert(!text(detail).includes("Additional Notes"));
 assert(!nodes(detail).some(n=>n.props.name==="chevron-forward"));
}
colors=theme.PALETTES.neutral;
let photoTree=draw(visuals.ProfilePhoto,{profile,onChangePhoto(){}});
let image=nodes(photoTree).find(n=>n.type==="Image");assert(image);image.props.onError();
photoTree=draw(visuals.ProfilePhoto,{profile,onChangePhoto(){}},false);assert(!nodes(photoTree).some(n=>n.type==="Image"));
photoTree=draw(visuals.ProfilePhoto,{profile:{...profile,avatarUrl:"/new.jpg"},onChangePhoto(){}},false);assert(nodes(photoTree).some(n=>n.type==="Image"));
const missing={...profile,hasRecordedAvatar:false,hasRecordedSex:false,hasRecordedBirthWeight:false,hasRecordedBirthHeight:false,allergies:[],hereditaryConditions:[]};
assert(!nodes(draw(visuals.ProfilePhoto,{profile:missing})).some(n=>n.type==="Image"));
let empty=draw(Detail,{profile:missing,growth:[],medical:[]});assert(text(empty).includes("No allergies recorded."));assert(!text(find(empty,"profile-birth")).includes("3.21 kg"));
assert(!text(find(empty,"profile-identity")).includes("Female"));
empty=draw(Detail,{profile:missing,growth:[],medical:[],conditionsLoading:true});assert(text(empty).includes("Loading records"));assert(!text(empty).includes("No allergies recorded."));
empty=draw(Detail,{profile:missing,growth:[],medical:[],conditionsUnavailable:true});assert(text(empty).includes("Records unavailable"));
const updated=draw(Detail,{profile:{...profile,name:"Saved name"},growth:[{...growth[0],weight:8.5}],medical:[]});assert(text(updated).includes("Saved name"));
assert.equal(nodes(updated).find(n=>n.type===visuals.ProfileMetrics).props.measurements[0].value,8.5);
console.log("Baby Profile render checks passed: six palettes, compact actions, section order, extra records, loading/empty states, photo failures, independent metrics, large text.");
