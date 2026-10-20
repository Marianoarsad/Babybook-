import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { motion } from "../../theme";

// Measure natural content, never the animated viewport. Pagination keeps old rows opaque.
export default function AnimatedReveal({ expanded = true, contentStyle, children, duration = motion.standard.duration }) {
    const [height, setHeight] = useState(null);
    const [clipping, setClipping] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(true);
    const size = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(expanded ? 1 : 0)).current;
    const initialized = useRef(false);
    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); }).catch(() => {});
        const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
        return () => { active = false; subscription.remove(); };
    }, []);
    useLayoutEffect(() => {
        if (height == null) return;
        const target = expanded ? height : 0;
        if (!initialized.current || reduceMotion) {
            size.setValue(target); opacity.setValue(expanded ? 1 : 0); setClipping(false);
            initialized.current = true;
            return;
        }
        const config = { duration,
            easing: Easing.bezier(...motion.standard.bezier), useNativeDriver: false };
        const resize = Animated.timing(size, { ...config, toValue: target });
        const fade = Animated.timing(opacity, { ...config, toValue: expanded ? 1 : 0 });
        setClipping(true);
        resize.start(({ finished }) => { if (finished) setClipping(false); }); fade.start();
        return () => { resize.stop(); fade.stop(); };
    }, [expanded, height, reduceMotion, size, opacity, duration]);
    return <Animated.View style={{ overflow: !expanded || clipping ? "hidden" : "visible", opacity,
        height: height == null ? (expanded ? undefined : 0) : size }}
        pointerEvents={expanded ? "auto" : "none"} accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}>
        <View style={[height != null || !expanded ? { position: "absolute", top: 0, left: 0, right: 0 } : null, contentStyle]}
            onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>{children}</View>
    </Animated.View>;
}
