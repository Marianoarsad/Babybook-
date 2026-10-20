// Run: node components/ui/GrowthHistory.check.js — no server or database.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "../..");
const read = p => fs.readFileSync(path.join(root,p),"utf8");
const compile = source => transformSync(source,{babelrc:false,configFile:false,
    plugins:["@babel/plugin-transform-modules-commonjs","@babel/plugin-transform-react-jsx"]}).code;
let slots=[], cursor=0, effects=[], animations=[], reduced=false, motionListener, cleaned=0;
const React = {
    createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity).filter(x=>x!=null&&x!==false)}}),
    memo:fn=>fn, useMemo:fn=>fn(), useCallback:fn=>fn,
    useRef(value){const i=cursor++;return slots[i] ||= {current:value};},
    useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],next=>slots[i]=typeof next==="function"?next(slots[i]):next];},
    useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
};
class Value {
    constructor(value){this.value=value;}
    setValue(value){this.value=value;}
    stopAnimation(callback){callback?.(this.value);}
    interpolate(options){return {source:this,...options};}
}
const animation=(kind,value,options)=>({start(){animations.push({kind,...options});value.setValue(options.toValue);}});
const native={View:"View",Text:"Text",Image:"Image",Pressable:"Pressable",TouchableOpacity:"TouchableOpacity",
    StyleSheet:{create:x=>x,absoluteFillObject:{position:"absolute",inset:0}},Platform:{OS:"web"},
    Animated:{Value,View:"AnimatedView",timing:(v,o)=>animation("timing",v,o),spring:(v,o)=>animation("spring",v,o)},
    PanResponder:{create:handlers=>({panHandlers:handlers})},
    AccessibilityInfo:{isReduceMotionEnabled:()=>({then:fn=>{fn(false);return {catch(){}};}}),
        addEventListener:(_,fn)=>{motionListener=fn;return {remove:()=>cleaned++};}},
};
global.matchMedia=()=>({matches:reduced,addEventListener:(_,fn)=>motionListener=fn,removeEventListener:()=>cleaned++});
const themeModule={exports:{}};
new Function("module","exports",compile(read("theme.js")))(themeModule,themeModule.exports);
const theme=themeModule.exports;
let colors=theme.PALETTES.boy;
const cache=new Map();
function load(file){
    file=file.split(path.sep).join("/");
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    new Function("require","module","exports",compile(read(file)))(name=>{
        if(name==="react")return React;
        if(name==="react-native")return native;
        if(name==="@expo/vector-icons")return {Ionicons:"Icon"};
        if(name.endsWith("ThemeContext"))return {useTheme:()=>({colors})};
        if(name.endsWith("/theme"))return theme;
        if(name.endsWith("Gradient"))return {__esModule:true,default:"Gradient"};
        if(name.endsWith(".png"))return path.resolve(root,path.dirname(file),name);
        return load(path.relative(root,path.resolve(root,path.dirname(file),name+".js")));
    },module,module.exports);
    return module.exports;
}
const reset=()=>{slots=[];effects=[];animations=[];};
const draw=(fn,props={})=>{cursor=0;const tree=fn(props);while(effects.length)effects.shift()();return tree;};
const nodes=tree=>tree&&typeof tree==="object"?[tree,...(tree.props.children||[]).flatMap(nodes)]:[];
const text=tree=>tree&&typeof tree==="object"?(tree.props.children||[]).map(text).join(""):String(tree??"");
const icon=load("components/ui/GrowthIcon.js"), visuals=load("components/ui/GrowthHistoryVisuals.js");
const more=load("components/ui/ShowMore.js").default, Swipe=load("components/ui/SwipeActionRow.js").default;
function luminance(hex){return hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);}
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
for(const gender of ["boy","girl","neutral"])for(const scheme of ["light","dark"]){
    colors=theme.paletteFor(undefined,gender,scheme);
    for(const size of [24,32,40,44,52,56]){
        reset();const bubble=draw(icon.default,{size});
        assert.equal(bubble.props.style.width,size);assert.equal(bubble.props.style.height,size);
        assert.equal(nodes(bubble).find(n=>n.type==="Gradient").props.style.borderRadius,size/2);
        assert.equal(nodes(bubble).find(n=>n.type==="Image").props.source,icon.GROWTH_ICON_SOURCE);
        const image=nodes(bubble).find(n=>n.type==="Image");
        const rulerRatio=image.props.style.transform[0].scale*(112/128);
        assert(rulerRatio>=0.55&&rulerRatio<=0.65,"Approved artwork occupies 55–65% of its circle without stretching");
        assert.equal(nodes(draw(icon.default,{size,showBackground:false})).filter(n=>n.type==="Gradient").length,0);
    }
    const material=colors.growthHistory;
    for(const bg of [...material.panel,...material.item]){
        assert(contrast(material.title,bg)>=4.5);assert(contrast(material.secondary,bg)>=4.5);
    }
    for(const bg of material.more)assert(contrast(material.moreText,bg)>=4.5);
    const row=draw(visuals.MeasurementHistoryRow,{date:"31 Dec 2029",age:"4y 1m old"});
    assert(text(row).includes("31 Dec 2029"));assert(text(row).includes("4y 1m old"));
    assert.equal(row.props.style.alignItems,"center");
    assert.equal(nodes(row).filter(n=>n.type===icon.default).length,1);
    assert.equal(nodes(row).find(n=>n.type===icon.default).props.size,52);
    assert.equal(row.props.style.minHeight,80);
    assert.equal(nodes(row).find(n=>n.type==="Icon").props.name,"chevron-forward");
}
for(const total of [0,1,10,11,1929]){
    let visible=10;
    const onPress=()=>visible+=10;
    reset();let control=draw(more,{total,visible,onPress,noun:"measurements",appearance:"measurementHistory"});
    if(total<=visible){assert.equal(control,null);continue;}
    assert.equal(control.type,visuals.HistoryShowMore);assert.equal(control.props.remaining,total-visible);
    reset();let rendered=draw(control.type,control.props);rendered=draw(control.type,control.props);
    assert(text(rendered).includes((total-visible).toLocaleString()));
    const elevated=nodes(rendered).find(n=>n.type==="AnimatedView");
    assert.equal(elevated.props.style.boxShadow,colors.growthHistory.moreShadow);
    assert.notEqual(elevated.props.style.overflow,"hidden","Pagination shadow stays outside the clipped surface");
    assert.equal(nodes(rendered).find(n=>n.type==="Gradient").props.style.overflow,"hidden");
    rendered.props.onPressIn();assert.equal(animations.at(-1).toValue,1);
    rendered.props.onPressOut();assert.equal(animations.at(-1).kind,"spring");
    rendered.props.onPress();assert.equal(visible,20);
    reset();control=draw(more,{total,visible,onPress,appearance:"measurementHistory"});
    assert.equal(control===null,total<=20);
}
reset();assert.equal(draw(more,{total:20,visible:10}).type,"TouchableOpacity","Other lists retain their control");
let opened=0,closed=0,edited=0,deleted=0;
const props={open:false,label:"View measurement",onPress:()=>opened++,onOpen:()=>{},onClose:()=>closed++,
    style:{borderRadius:24,boxShadow:"soft"},foregroundStyle:{borderRadius:24},pressScale:.985,children:"entry",
    actions:[{key:"update",label:"Edit",onPress:()=>edited++},{key:"delete",label:"Delete",onPress:()=>deleted++}]};
reset();let row=draw(Swipe,props);row=draw(Swipe,props);
assert.equal(row.type,"AnimatedView");assert.equal(Object.assign({},...row.props.style).boxShadow,"soft");
const surface=nodes(row).find(n=>n.props.accessibilityHint);
assert.notEqual(surface.props.style.overflow,"visible","Swipe actions remain clipped under the outer shadow");
surface.props.onAccessibilityTap();assert.equal(opened,1);
const navigation=nodes(row).find(n=>n.type==="TouchableOpacity"&&n.props.activeOpacity===1);
assert.equal(surface.props.accessibilityRole,undefined,"Web wrapper is not a button containing action buttons");
assert.equal(navigation.props.accessibilityRole,"button");assert.equal(navigation.props.accessible,true);
navigation.props.onPress();assert.equal(opened,2);
surface.props.onAccessibilityAction({nativeEvent:{actionName:"update"}});
surface.props.onAccessibilityAction({nativeEvent:{actionName:"delete"}});
assert.equal(edited,1);assert.equal(deleted,1);
const target=nodes(row).find(n=>n.type==="TouchableOpacity"&&n.props.activeOpacity===1);
target.props.onPressIn();assert.equal(animations.at(-1).toValue,1);
surface.props.onPanResponderGrant();assert.equal(animations.at(-1).toValue,0,"Dragging releases press compression");
assert.equal(surface.props.onMoveShouldSetPanResponder({}, {dx:2,dy:30}),false,"Vertical scrolling is preserved");
assert.equal(surface.props.onMoveShouldSetPanResponder({}, {dx:40,dy:2}),true);
row=draw(Swipe,{...props,open:true});
nodes(row).find(n=>n.type==="TouchableOpacity"&&n.props.activeOpacity===1).props.onPress();assert.equal(closed,1);
reset();reduced=true;row=draw(Swipe,props);row=draw(Swipe,props);
const presses=animations.length;
nodes(row).find(n=>n.type==="TouchableOpacity"&&n.props.activeOpacity===1).props.onPressIn();
assert.equal(animations.length,presses,"Reduced motion skips press animation");
for(const slot of slots)slot?.cleanup?.();assert(cleaned>0);
reduced=false;
native.Platform.OS="ios"; reset();
row=draw(Swipe,props);row=draw(Swipe,props);
nodes(row).find(n=>n.type==="TouchableOpacity"&&n.props.activeOpacity===1).props.onPressIn();
assert.equal(animations.at(-1).useNativeDriver,true);
motionListener(true);row=draw(Swipe,props);const nativeCount=animations.length;
nodes(row).find(n=>n.type==="TouchableOpacity"&&n.props.activeOpacity===1).props.onPressIn();
assert.equal(animations.length,nativeCount);
native.Platform.OS="web";
const growth=read("components/Growth.js");
const {parse}=require("@babel/parser");
const ast=parse(growth,{sourceType:"module",plugins:["jsx"]});
const stylesDeclaration=ast.program.body.find(n=>n.type==="VariableDeclaration"&&n.declarations.some(d=>d.id.name==="makeStyles")).declarations.find(d=>d.id.name==="makeStyles");
const makeHistoryStyles=new Function("StyleSheet","radius","space","type","shadow","MIN_TOUCH","recordItemStyle","return "+growth.slice(stylesDeclaration.init.start,stylesDeclaration.init.end))(
    native.StyleSheet,theme.radius,theme.space,theme.type,theme.shadow,theme.MIN_TOUCH,theme.recordItemStyle);
const historyStyles=makeHistoryStyles(colors);
assert.equal(historyStyles.historyPanel.padding,0,"The reveal owns the inset so row shadows have room inside its clipping boundary");
assert.equal(historyStyles.historyHeader.paddingHorizontal,historyStyles.historyList.paddingHorizontal);
assert.equal(historyStyles.historyPlaceholder.paddingHorizontal,historyStyles.historyList.paddingHorizontal);
assert(historyStyles.historyList.paddingHorizontal>=20);
assert(historyStyles.historyList.paddingBottom>=24);
assert.equal(historyStyles.historyRow.marginBottom,12);
assert.notEqual(historyStyles.historyRow.overflow,"hidden");
assert(growth.includes('<AnimatedReveal contentStyle={styles.historyList}>'));
for(const width of [320,375,430]){
    const panelWidth=width-2*theme.space.lg;
    const rowWidth=panelWidth-2*historyStyles.historyList.paddingHorizontal;
    assert(rowWidth>0&&rowWidth<panelWidth);
    assert(rowWidth>=52+28+24+21+100,"Icon, two gaps, chevron and readable date retain space at phone widths");
}
const responsive=read("utils/responsive.js");
const responsiveAst=parse(responsive,{sourceType:"module"});
const bottomHook=responsiveAst.program.body.find(n=>n.type==="ExportNamedDeclaration"&&n.declaration?.id?.name==="useScreenPadBottom").declaration;
for(const tabBarHeight of [106,140,180])for(const bottom of [0,34]){
    const padding=new Function("useSafeAreaInsets","useScroll","SCREEN_PAD_BOTTOM","space","return ("+responsive.slice(bottomHook.start,bottomHook.end)+")()")(
        ()=>({bottom}),()=>({tabBarHeight}),theme.SCREEN_PAD_BOTTOM,theme.space);
    const fabTopFromBottom=tabBarHeight+theme.space.md+56;
    assert(padding>=fabTopFromBottom+theme.space.lg,"Final content can scroll above the fixed FAB with a 16-point gap");
}
assert(growth.includes("paddingBottom: padBottom"));
assert(growth.includes("measurements.slice(0, metricsVisible)"));
assert(growth.includes("setMetricsVisible((c) => c + 10)"));
assert(growth.includes("onPress={() => setDetailGrowth(m)}"));
assert(growth.includes("setDeleteGrowthCandidate(m)"));assert(growth.includes("setEditingGrowth(m.raw || null)"));
assert(growth.includes('appearance="measurementHistory"'));
for(const file of ["components/Growth.js","components/ui/ActionSheet.js","components/ProfessionalView.js"])
    assert(read(file).includes("<GrowthIcon"),file+" shares the ruler");
assert(!read("components/ui/TabBar.js").includes("<GrowthIcon"),"Navbar keeps its original Growth icon");
assert(read("components/Search.js").includes('recordCategory: "milestone"'),"Milestones use the shared category artwork");
assert(read("components/Search.js").includes('icon: "image-outline"'),"Gallery retains its meaning");
console.log("Growth history passed: shadow gutters/phone widths, six-theme contrast, shared ruler fit, independent pagination shadow, FAB clearance, real text, pagination, swipe actions and reduced motion.");
