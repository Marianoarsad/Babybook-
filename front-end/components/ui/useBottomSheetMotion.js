import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, PanResponder } from "react-native";

const OPEN_MS = 280;
const CLOSE_MS = 220;
const SETTLE_MS = 160;
const DRAG_CAPTURE = 12;
const DETENT_THRESHOLD = 64;

export default function useBottomSheetMotion({ visible, collapsedHeight, expandedHeight, onClose, gestureEnabled = true }) {
    const [presented, setPresented] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(null);
    const height = useRef(new Animated.Value(0)).current;
    const shade = useRef(new Animated.Value(0)).current;
    const phase = useRef("hidden");
    const expanded = useRef(false);
    const dragStart = useRef(collapsedHeight);
    const generation = useRef(0);
    const animation = useRef(null);
    const pending = useRef(null);
    const wasVisible = useRef(false);
    const closeRef = useRef(onClose);
    const gestureEnabledRef = useRef(gestureEnabled);
    closeRef.current = onClose;
    gestureEnabledRef.current = gestureEnabled;

    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled?.().then((value) => active && setReduceMotion(!!value))
            .catch(() => active && setReduceMotion(false));
        const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion);
        return () => { active = false; subscription?.remove?.(); };
    }, []);
    useEffect(() => () => {
        generation.current++;
        animation.current?.stop();
        pending.current = null;
    }, []);

    const animate = useCallback((target, duration, complete = () => {}) => {
        const token = ++generation.current;
        animation.current?.stop();
        const shadeTarget = target <= 0 ? 0 : 1;
        if (reduceMotion) {
            height.setValue(target);
            shade.setValue(shadeTarget);
            complete();
            return;
        }
        animation.current = Animated.parallel([
            Animated.timing(height, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
            Animated.timing(shade, { toValue: shadeTarget, duration, useNativeDriver: true }),
        ]);
        animation.current.start(({ finished }) => {
            if (finished && generation.current === token) complete();
        });
    }, [height, reduceMotion, shade]);

    const finishClose = useCallback(() => {
        const callback = pending.current;
        pending.current = null;
        phase.current = "hidden";
        expanded.current = false;
        setPresented(false);
        callback?.();
    }, []);
    const startOpening = useCallback(() => {
        if (phase.current !== "waiting") return;
        phase.current = "opening";
        animate(collapsedHeight, OPEN_MS, () => { phase.current = "open"; });
    }, [animate, collapsedHeight]);
    const dismiss = useCallback((afterClose) => {
        if (phase.current === "hidden" || phase.current === "closing") return;
        pending.current = afterClose || (() => closeRef.current());
        phase.current = "closing";
        animate(0, CLOSE_MS, finishClose);
    }, [animate, finishClose]);

    useEffect(() => {
        if (reduceMotion === null) return;
        const opening = visible && !wasVisible.current;
        wasVisible.current = visible;
        if (visible) {
            if (phase.current === "closing") {
                if (!opening) { animate(0, CLOSE_MS, finishClose); return; }
                pending.current = null;
                phase.current = "opening";
                animate(collapsedHeight, OPEN_MS, () => { phase.current = "open"; });
                return;
            }
            pending.current = null;
            if (reduceMotion) {
                phase.current = "opening";
                setPresented(true);
                animate(collapsedHeight, 0, () => { phase.current = "open"; });
            } else if (phase.current === "hidden") {
                expanded.current = false;
                height.setValue(0);
                shade.setValue(0);
                phase.current = "waiting";
                setPresented(true);
            } else if (phase.current === "waiting") height.setValue(0);
        } else if (phase.current !== "hidden") {
            pending.current = null;
            phase.current = "closing";
            animate(0, CLOSE_MS, finishClose);
        }
    }, [animate, collapsedHeight, finishClose, height, reduceMotion, shade, visible]);

    useEffect(() => {
        if (!presented || phase.current !== "open") return;
        height.setValue(expanded.current ? expandedHeight : collapsedHeight);
    }, [collapsedHeight, expandedHeight, height, presented]);

    const settle = useCallback((nextExpanded = expanded.current) => {
        if (phase.current !== "dragging") return;
        expanded.current = nextExpanded;
        phase.current = "settling";
        animate(nextExpanded ? expandedHeight : collapsedHeight, SETTLE_MS, () => { phase.current = "open"; });
    }, [animate, collapsedHeight, expandedHeight]);
    const pan = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => phase.current === "open" && gestureEnabledRef.current
            && Math.abs(gesture.dy) > DRAG_CAPTURE && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.25,
        onPanResponderGrant: () => {
            if (phase.current !== "open" || !gestureEnabledRef.current) return;
            animation.current?.stop();
            dragStart.current = expanded.current ? expandedHeight : collapsedHeight;
            phase.current = "dragging";
        },
        onPanResponderMove: (_event, gesture) => {
            if (phase.current !== "dragging") return;
            const next = Math.max(0, Math.min(expandedHeight, dragStart.current - gesture.dy));
            height.setValue(next);
            shade.setValue(Math.min(1, next / Math.max(1, collapsedHeight)));
        },
        onPanResponderRelease: (_event, gesture) => {
            if (phase.current !== "dragging") return;
            if (gesture.dy >= DETENT_THRESHOLD) dismiss();
            else if (gesture.dy <= -DETENT_THRESHOLD) settle(true);
            else settle();
        },
        onPanResponderTerminate: () => settle(),
    }), [collapsedHeight, dismiss, expandedHeight, height, settle, shade]);

    return { presented, height, shade, pan, dismiss, startOpening };
}
