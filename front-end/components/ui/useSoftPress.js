import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform } from "react-native";

// No listener or animation is needed for callers that keep the default scale.
export default function useSoftPress(scale = 0.985) {
    const value = useRef(new Animated.Value(0)).current;
    const [reduced, setReduced] = useState(true);
    useEffect(() => {
        if (scale === 1) return;
        let alive = true, changed = false;
        const update = next => { changed = true; if (alive) setReduced(next); };
        const media = Platform.OS === "web" && globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
        const listener = event => update(event.matches);
        if (media) { update(media.matches); media.addEventListener?.("change", listener); }
        else AccessibilityInfo.isReduceMotionEnabled().then(next => { if (alive && !changed) setReduced(next); }).catch(() => {});
        const subscription = media ? null : AccessibilityInfo.addEventListener("reduceMotionChanged", update);
        return () => { alive = false; media?.removeEventListener?.("change", listener); subscription?.remove(); value.stopAnimation(); };
    }, [scale, value]);
    useEffect(() => { if (reduced) { value.stopAnimation(); value.setValue(0); } }, [reduced, value]);
    useEffect(() => () => value.stopAnimation(), [value]);
    const respond = useCallback(down => {
        if (scale === 1 || reduced) return;
        value.stopAnimation();
        const options = { toValue: down ? 1 : 0, useNativeDriver: Platform.OS !== "web", isInteraction: false };
        if (down) Animated.timing(value, { ...options, duration: 100 }).start();
        else Animated.spring(value, { ...options, stiffness: 1400, damping: 64, mass: 0.75, overshootClamping: true }).start();
    }, [scale, reduced, value]);
    return { respond, transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : scale] }) }] };
}
