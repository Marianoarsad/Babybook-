// Run: node components/ui/NeumorphicTabs.check.js — no server or database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "../..");
const compile = source => transformSync(source, { babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"] }).code;
const themeModule = { exports: {} };
new Function("module", "exports", compile(fs.readFileSync(path.join(root, "theme.js"), "utf8")))(themeModule, themeModule.exports);
const theme = themeModule.exports;
const code = compile(fs.readFileSync(path.join(__dirname, "NeumorphicTabs.js"), "utf8") + "\nmodule.exports.Tab = Tab;");
function harness(platform = "web") {
    const slots = [], effects = [], animations = [];
    let cursor = 0, colors = theme.PALETTES.boy, listener, resolveMotion, removed = false;
    const React = {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity).filter(Boolean) } }),
        useMemo: fn => fn(),
        useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
            return [slots[i], value => slots[i] = typeof value === "function" ? value(slots[i]) : value]; },
        useLayoutEffect(fn, deps) { React.useEffect(fn, deps); },
        useEffect(fn, deps) { const i = cursor++, previous = slots[i];
            if (!previous || deps.some((value, n) => value !== previous.deps[n])) effects.push(() => {
                previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
            }); },
    };
    class Value {
        constructor(value) { this.value = value; }
        setValue(value) { this.value = value; }
        stopAnimation() { this.stopped = true; }
        interpolate(options) { return { source: this, ...options }; }
    }
    const animate = (kind, value, options) => {
        const animation = { kind, ...options, stopped: false,
            start() { animations.push(animation); value.setValue(options.toValue); }, stop() { this.stopped = true; } };
        return animation;
    };
    const native = { View: "View", Pressable: "Pressable",
        StyleSheet: { create: value => value, absoluteFillObject: { position: "absolute", inset: 0 } },
        Platform: { OS: platform }, Easing: { out: value => value, quad: "quad" },
        Animated: { Value, View: "AnimatedView", Text: "AnimatedText",
            timing: (v,o) => animate("timing",v,o), spring: (v,o) => animate("spring",v,o) },
        AccessibilityInfo: { isReduceMotionEnabled: () => new Promise(resolve => resolveMotion = resolve),
            addEventListener: (_, fn) => { listener = fn; return { remove() { removed = true; } }; } },
    };
    const loaded = { exports: {} };
    new Function("require", "module", "exports", code)(name => {
        if (name === "react") return React;
        if (name === "react-native") return native;
        if (name.includes("ThemeContext")) return { useTheme: () => ({ colors }) };
        if (name === "../../theme") return theme;
        if (name === "./Gradient") return { __esModule: true, default: "Gradient" };
        assert.fail("Unexpected dependency " + name);
    }, loaded, loaded.exports);
    return { api: loaded.exports, animations,
        draw(component, props) { cursor = 0; const tree = component(props);
            while (effects.length) effects.shift()(); return tree; },
        theme(gender, scheme) { colors = theme.paletteFor(undefined, gender, scheme); },
        async motion(value) { resolveMotion(value); await Promise.resolve(); },
        event(value) { listener(value); },
        cleanup() { for (const slot of slots) slot?.cleanup?.(); },
        get removed() { return removed; },
    };
}
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(nodes)] : [];
const merge = styles => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));
const find = (tree, predicate) => nodes(tree).find(predicate);
const indicator = tree => find(tree,n => n.props.testID === "neumorphic-tab-indicator");
const row = tree => find(tree,n => n.props.onLayout);
const measure = (tree,width,height=52) => row(tree).props.onLayout({nativeEvent:{layout:{width,height}}});
const tabs = [
    { key:"medications",label:"Medicine" }, { key:"immunizations",label:"Vaccines" },
    { key:"appointments",label:"Checkups" }, { key:"illnesses",label:"Conditions" },
];
const luminance = hex => hex.slice(1,7).match(/../g).map(x => parseInt(x,16)/255)
    .map(x => x <= 0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4)
    .reduce((sum,x,i) => sum+x*[0.2126,0.7152,0.0722][i],0);
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+0.05)/(Math.min(luminance(a),luminance(b))+0.05);
(async () => {
    const previousMedia = globalThis.matchMedia;
    let mediaListener, mediaRemoved=false;
    globalThis.matchMedia = () => ({matches:false,
        addEventListener(_,listener){mediaListener=listener;},
        removeEventListener(_,listener){assert.equal(listener,mediaListener);mediaRemoved=true;}});
    try {
        const h=harness(), selected=[], focused=[];
        let props={tabs,value:"appointments",onChange:key=>selected.push(key)};
        const draw=(changes={})=>h.draw(h.api.default,props={...props,...changes});
        let tree=draw();
        assert.equal(merge(indicator(tree).props.style).opacity,0);
        measure(tree,288); tree=draw();
        const persistent=merge(indicator(tree).props.style).transform[0].translateX;
        assert.equal(persistent.value,144,"Initial Checkups selection is placed without a slide");
        assert(!h.animations.length);
        for(const gender of ["boy","girl","neutral"]) for(const scheme of ["light","dark"]) {
            h.theme(gender,scheme); tree=draw();
            const material=theme.paletteFor(undefined,gender,scheme).healthTabs;
            assert(material.selectedGradient.every(bg=>contrast(material.activeLabel,bg)>=4.5));
            assert(material.gradient.every(bg=>contrast(material.inactiveLabel,bg)>=4.5));
            const parentStyle=merge(tree.props.style);
            assert.equal(parentStyle.borderWidth,undefined);
            assert.equal(parentStyle.overflow,undefined,"Shadows are not clipped");
            assert.equal(parentStyle.boxShadow,material.shadow);
            const tile=indicator(tree), tileStyle=merge(tile.props.style);
            assert.equal(tileStyle.borderWidth,undefined);
            assert.equal(tile.props.pointerEvents,"none");
            assert.equal(tileStyle.transform[0].translateX,persistent);
            assert.equal(nodes(tree).filter(n=>n.props.testID==="neumorphic-tab-indicator").length,1);
            const items=row(tree).props.children.filter(n=>n.type===h.api.Tab);
            assert.deepEqual(items.map(n=>n.props.tab),tabs);
            for(const item of items) {
                const child=harness(), redraw=changes=>child.draw(child.api.Tab,{...item.props,...changes});
                let button=redraw({reduceMotion:true});
                const itemStyle=merge(button.props.style);
                assert.equal(itemStyle.flex,1); assert(itemStyle.minHeight>=44);
                assert.equal(itemStyle.backgroundColor,undefined);
                assert.equal(button.props.accessibilityRole,"tab");
                assert.equal(button.props.accessibilityState.selected,item.props.active);
                const label=find(button,n=>n.type==="AnimatedText");
                assert.equal(label.props.style[0].fontSize,13);
                assert.equal(label.props.style[0].fontFamily,theme.type.caption.fontFamily);
                assert.equal(label.props.numberOfLines,undefined,"Large labels may wrap");
                assert.equal(label.props.allowFontScaling,undefined);
                assert.deepEqual(label.props.style[1].color.outputRange,[material.inactiveLabel,material.activeLabel]);
                assert.equal(label.props.style[1].color.source.value,item.props.active?1:0);
                button.props.onPress(); assert.equal(selected.at(-1),item.props.tab.key);
                button.props.onFocus({currentTarget:{matches:()=>true}});
                button=redraw({reduceMotion:true});
                assert.equal(merge(button.props.style).outlineWidth,2);
                button.props.onPressIn({nativeEvent:{type:"mousedown"}});
                button=redraw({reduceMotion:true});
                assert.equal(merge(button.props.style).outlineStyle,"none","Touch/pointer selection has no outline");
                const before=child.animations.length;
                redraw({reduceMotion:false,active:!item.props.active});
                assert.equal(child.animations.length,before+1);
                assert.equal(child.animations.at(-1).duration,200);
                item.props.tabRef({focus:()=>focused.push(item.props.tab.key)});
                child.cleanup();
            }
        }
        for(const viewport of [320,375,430,768]) {
            measure(tree,viewport-32); tree=draw();
            assert.equal(merge(indicator(tree).props.style).width,(viewport-40)/4);
            assert.equal(persistent.value,4+2*((viewport-40)/4));
            assert.equal(merge(indicator(tree).props.style).height,44);
        }
        measure(tree,288,90);tree=draw();
        assert.equal(merge(indicator(tree).props.style).height,82,"Indicator follows enlarged text height");
        tree=draw({value:"illnesses"});
        const firstSlide=h.animations.at(-1);
        assert.equal(firstSlide.kind,"spring");
        assert.equal(firstSlide.stiffness,450);assert.equal(firstSlide.damping,38);
        assert.equal(firstSlide.overshootClamping,true);assert.equal(firstSlide.isInteraction,false);
        tree=draw({value:"medications"});
        assert(firstSlide.stopped,"Rapid taps stop the previous spring");
        assert.equal(persistent.value,4);
        assert.equal(merge(indicator(tree).props.style).transform[0].translateX,persistent);
        const beforeResize=h.animations.length;
        measure(tree,398);tree=draw();
        assert.equal(h.animations.length,beforeResize,"Resize snaps without a stray slide");
        const itemNodes=row(tree).props.children.filter(n=>n.type===h.api.Tab);
        for(const [index,key,expected] of [[0,"ArrowLeft","illnesses"],[3,"ArrowRight","medications"],[1,"Home","medications"],[0,"End","illnesses"]]) {
            let prevented=false;
            itemNodes[index].props.onKeyDown({key,preventDefault(){prevented=true;}});
            assert(prevented);assert.equal(selected.at(-1),expected);assert.equal(focused.at(-1),expected);
        }
        mediaListener({matches:true}); tree=draw();
        const beforeReduced=h.animations.length; tree=draw({value:"appointments"});
        assert.equal(h.animations.length,beforeReduced);
        assert.equal(persistent.value,4+2*((398-8)/4));
        tree=draw({value:"missing"});assert.equal(merge(indicator(tree).props.style).opacity,0);
        h.cleanup();assert(mediaRemoved);assert(persistent.stopped);
    } finally { globalThis.matchMedia=previousMedia; }
    for(const platform of ["ios","android"]) {
        const h=harness(platform), props={tabs,value:"medications",onChange(){}};
        let tree=h.draw(h.api.default,props);measure(tree,288);
        await h.motion(false); tree=h.draw(h.api.default,props);
        tree=h.draw(h.api.default,{...props,value:"illnesses"});
        assert.equal(h.animations.at(-1).useNativeDriver,true);
        h.event(true);tree=h.draw(h.api.default,{...props,value:"medications"});
        const count=h.animations.length;h.draw(h.api.default,{...props,value:"appointments"});
        assert.equal(h.animations.length,count);
        h.cleanup();assert(h.removed);
    }
    const health=fs.readFileSync(path.join(root,"components/Health.js"),"utf8");
    assert(health.includes("tabs={HEALTH_TABS} value={activeTab} onChange={setActiveTab}"));
    assert(!health.includes("tabButtonActive"));
    for(const tab of tabs) assert(health.includes('key: "'+tab.key+'", label: "'+tab.label+'"'));
    for(const alias of ["vaccine","medication","illness","checkup","hospitalization"]) assert(health.includes(alias+":"));
    const growth=fs.readFileSync(path.join(root,"components/Growth.js"),"utf8");
    const growthTabs=[{key:"metrics",label:"Growth"},{key:"milestones",label:"Milestones"},{key:"gallery",label:"Gallery"}];
    assert(growth.includes("tabs={GROWTH_TABS} value={growthTab} onChange={setGrowthTab}"));
    assert(!growth.includes("tabButtonActive"));
    for(const tab of growthTabs) assert(growth.includes('key: "'+tab.key+'", label: "'+tab.label+'"'));
    for(const gender of ["boy","girl","neutral"]) for(const scheme of ["light","dark"]) {
        const h=harness("ios");h.theme(gender,scheme);
        let selected, props={tabs:growthTabs,value:"metrics",onChange:key=>selected=key};
        let tree=h.draw(h.api.default,props);measure(tree,288);
        await h.motion(false);tree=h.draw(h.api.default,props);
        const persistent=merge(indicator(tree).props.style).transform[0].translateX;
        for(const viewport of [320,375,430,768]) {
            measure(tree,viewport-32);tree=h.draw(h.api.default,props);
            assert.equal(merge(indicator(tree).props.style).width,(viewport-40)/3);
            for(const [index,tab] of growthTabs.entries()) {
                const item=row(tree).props.children.find(n=>n.type===h.api.Tab && n.props.tab.key===tab.key);
                item.props.onChange(tab.key);assert.equal(selected,tab.key);
                props={...props,value:selected};tree=h.draw(h.api.default,props);
                assert.equal(persistent.value,4+index*((viewport-40)/3));
                assert.equal(merge(indicator(tree).props.style).transform[0].translateX,persistent);
            }
        }
        h.cleanup();
    }
    console.log("Neumorphic Health/Growth tabs passed: six themes/contrast, four widths, controlled callbacks, label transitions, persistent/interrupted spring, resized/large text geometry, keyboard focus/arrows, native/web reduced motion and cleanup.");
})().catch(error=>{console.error(error);process.exitCode=1;});
