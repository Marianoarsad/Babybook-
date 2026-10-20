// Run: node components/ui/GrowthVisuals.check.js — no server or database.
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
function harness(gender, scheme, platform = "web") {
    const slots = [], effects = [], animations = [];
    let cursor = 0, listener, resolveMotion, removed = false;
    const React = {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
        useMemo: fn => fn(),
        useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
            return [slots[i], value => slots[i] = typeof value === "function" ? value(slots[i]) : value]; },
        useEffect(fn, deps) { const i = cursor++, previous = slots[i];
            if (!previous || deps.some((value, n) => value !== previous.deps[n])) effects.push(() => {
                previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
            }); },
    };
    class Value {
        constructor(value) { this.value = value; }
        stopAnimation() {}
        setValue(value) { this.value = value; }
        interpolate(options) { return { ...options, source: this }; }
    }
    const animate = (kind, value, options) => ({ start() { animations.push({ kind, ...options }); value.setValue(options.toValue); } });
    const native = { View: "View", Text: "Text", Image: "Image", Pressable: "Pressable",
        StyleSheet: { create: value => value, absoluteFillObject: { position: "absolute", inset: 0 } },
        Platform: { OS: platform }, Easing: { out: value => value, quad: "quad" },
        Animated: { Value, View: "AnimatedView", timing: (v,o) => animate("timing",v,o), spring: (v,o) => animate("spring",v,o) },
        AccessibilityInfo: { isReduceMotionEnabled: () => new Promise(resolve => resolveMotion = resolve),
            addEventListener: (_, fn) => { listener = fn; return { remove() { removed = true; } }; } },
    };
    const colors = theme.paletteFor(undefined, gender, scheme), loaded = { exports: {} };
    new Function("require", "module", "exports", compile(fs.readFileSync(path.join(__dirname, "GrowthVisuals.js"), "utf8")))(name => {
        if (name === "react") return React;
        if (name === "react-native") return native;
        if (name.includes("ThemeContext")) return { useTheme: () => ({ colors }) };
        if (name.includes("LanguageContext")) return { useLanguage: () => ({ t: key => key }) };
        if (name === "../../theme") return theme;
        if (name === "../../utils/dates") return { shortDate: date => date };
        if (name === "./Gradient") return { __esModule: true, default: "Gradient" };
        if (name === "./RollingNumber") return { CountUpNumber: "CountUpNumber" };
        if (name === "./useReducedMotion") return { __esModule: true, default: () => true };
        if (name.endsWith(".png")) return path.resolve(__dirname, name);
        assert.fail("Unexpected dependency " + name);
    }, loaded, loaded.exports);
    return { colors, api: loaded.exports, animations,
        draw(name, props) { cursor = 0; const tree = loaded.exports[name](props);
            while (effects.length) effects.shift()(); return tree; },
        async motion(value) { resolveMotion(value); await Promise.resolve(); },
        event(value) { listener(value); },
        cleanup() { for (const slot of slots) slot?.cleanup?.(); },
        get removed() { return removed; },
    };
}
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.props.children || []).flatMap(nodes)] : [];
const text = tree => tree && typeof tree === "object" ? tree.type === "CountUpNumber" ? tree.props.label
    : (tree.props.children || []).map(text).join("") : String(tree ?? "");
const merge = styles => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));
const luminance = hex => hex.slice(1,7).match(/../g).map(c => parseInt(c,16)/255)
    .map(c => c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4)
    .reduce((sum,c,i) => sum+c*[0.2126,0.7152,0.0722][i],0);
const blend = (foreground,background,alpha) => "#" + foreground.slice(1).match(/../g).map((hex,i) =>
    Math.round(parseInt(hex,16)*alpha + parseInt(background.slice(1+i*2,3+i*2),16)*(1-alpha)).toString(16).padStart(2,"0")).join("");
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+0.05)/(Math.min(luminance(a),luminance(b))+0.05);
(async () => {
    const Jimp = require("jimp-compact");
    for (const gender of ["boy","girl","neutral"]) for (const scheme of ["light","dark"]) {
        const h = harness(gender,scheme), material = h.colors.growthSurface;
        assert.deepEqual(material, theme.paletteFor(undefined,"boy",scheme).growthSurface, "Growth reference colors are child-theme independent");
        const measurement = { date:"2026-10-09",weight:16.81,height:103.49,head_circumference:49.61 };
        let tree = h.draw("NeumorphicMeasurements",{measurement});
        for (const value of [16.81,103.49,49.61,"2026-10-09"]) assert(text(tree).includes(String(value)), "Real values and date are preserved");
        const row = nodes(tree).find(n => n.props.onLayout);
        assert.equal(row.props.style.flexDirection,"row");
        assert.equal(row.props.children.length,3);
        row.props.onLayout({nativeEvent:{layout:{width:430}}});
        tree = h.draw("NeumorphicMeasurements",{measurement});
        assert.equal(merge(nodes(tree).find(n => n.props.onLayout).props.children[0].props.style).flexDirection,"row");
        row.props.onLayout({nativeEvent:{layout:{width:240}}});
        tree = h.draw("NeumorphicMeasurements",{measurement});
        assert.equal(merge(nodes(tree).find(n => n.props.onLayout).props.children[0].props.style).flexDirection,undefined);
        assert(text(h.draw("NeumorphicMeasurements",{measurement:null})).includes("growthNoRecordYet"));
        assert(text(h.draw("NeumorphicMeasurements",{measurement:{...measurement,height:null}})).includes("—"));
        for (const metric of ["weight","height","head"]) {
            for (const background of material.metric[metric].surface) {
                assert(contrast(h.colors.text,background)>=4.5,metric+" body contrast");
                assert(contrast(h.colors.textMuted,background)>=4.5,metric+" secondary contrast");
                assert(contrast(material.metric[metric].accent,background)>=4.5,metric+" value contrast");
                assert(contrast(material.metric[metric].line,background)>=3,metric+" line contrast");
                assert(contrast(material.metric[metric].line,blend(material.metric[metric].line,background,0.18))>=3,metric+" filled-area contrast");
                assert.equal(material.metric[metric].pointFill,"#FFFFFF");
            }
            const icon = h.draw("GrowthMetricIcon",{metric});
            assert.equal(icon.props.pointerEvents,"none");
            const image = await Jimp.read(nodes(icon).find(n=>n.type==="Image").props.source);
            assert.equal(image.bitmap.width,128); assert.equal(image.bitmap.height,128);
            assert.equal(image.getPixelColor(0,0)&255,0);
        }
    }
    const h = harness("boy","light","ios"), ref = { current:null }; let calls=0;
    const props = { ref,onPress:()=>calls++,accessibilityRole:"button",accessibilityLabel:"Filter charts",children:"content" };
    let control = h.draw("GrowthControl",props); await h.motion(false); control=h.draw("GrowthControl",props);
    assert.equal(control.props.ref,ref); assert.equal(control.props.accessibilityLabel,"Filter charts");
    control.props.onPressIn({nativeEvent:{}}); control.props.onPress(); control.props.onPressOut();
    assert.equal(calls,1); assert.equal(h.animations.at(-1).kind,"spring");
    assert.equal(h.animations.at(-1).overshootClamping,true); assert.equal(h.animations.at(-1).useNativeDriver,true);
    for(let i=0;i<8;i++){control.props.onPressIn({nativeEvent:{}});control.props.onPressOut();}
    h.event(true); control=h.draw("GrowthControl",props); const count=h.animations.length;
    control.props.onPressIn({nativeEvent:{}});control.props.onPressOut();
    assert.equal(h.animations.length,count,"Reduced motion skips transforms");
    h.cleanup();assert.equal(h.removed,true);
    const source=fs.readFileSync(path.join(root,"components/Growth.js"),"utf8");
    assert(source.includes('name="tune"'));assert(!source.includes('name="funnel"'));
    assert(source.includes("seriesTheme={colors.growthSurface.metric[metric.key]}"));
    assert(source.includes('appearance="neumorphic"'));
    const metricsHeader = source.slice(source.indexOf('style={styles.trackingPanel}'), source.indexOf('{growthLoading ?'));
    assert(metricsHeader.includes('background={<MedicineSurface />}'));
    assert(metricsHeader.includes('<GlassFab'));
    assert(metricsHeader.includes('style={{ width: MIN_TOUCH, height: MIN_TOUCH }}'));
    assert(metricsHeader.includes('accessibilityLabel={t("growthAddMetrics")}'));
    assert(!metricsHeader.includes('<TouchableOpacity'), "Measurements uses the shared glossy Add control");
    let editing = "existing", visible = false;
    const press = metricsHeader.match(/onPress=\{\(\) => \{([\s\S]*?)\}\}/);
    assert(press, "Add callback remains present");
    new Function("setEditingGrowth", "setShowMetricsModal", press[1])(value => editing = value, value => visible = value);
    assert.equal(editing, null); assert.equal(visible, true);
    const panelStyle = source.slice(source.indexOf('trackingPanel: {'), source.indexOf('chartControls: {'));
    assert(panelStyle.includes('boxShadow: colors.medicineSurface.shadow'));
    assert(panelStyle.includes('backgroundColor: colors.medicineSurface.section[0]'));
    assert(panelStyle.includes('borderRadius: 28'));
    assert(!panelStyle.includes('padding'), "Existing section padding is preserved");
    console.log("Growth visuals passed: six themes, contrast, responsive tiles, real/empty/partial values, alpha assets, control refs/actions, interrupted springs and reduced motion.");
})().catch(error=>{console.error(error);process.exitCode=1;});
