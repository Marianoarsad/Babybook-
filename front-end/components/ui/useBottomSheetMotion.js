import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, PanResponder } from "react-native";

const OPEN_MS = 280;
const CLOSE_MS = 220;
const SETTLE_MS = 160;
const DRAG_CAPTURE = 12;
const DETENT_THRESHOLD = 64;

export default function useBottomSheetMotion({ visible, collapsedHeight, expandedHeight, onClose, gestureEnabled = true }) {
    const hiddenOffset = expandedHeight;
    const collapsedOffset = Math.max(0, expandedHeight - collapsedHeight);
    const [presented, setPresented] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(null);
    const offset = useRef(new Animated.Value(hiddenOffset)).current;
    const shade = useRef(new Animated.Value(0)).current;
    const phase = useRef("hidden");
    const expanded = useRef(false);
    const dragStart = useRef(collapsedOffset);
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
        const shadeTarget = target >= hiddenOffset ? 0 : 1;
        if (reduceMotion) {
            offset.setValue(target);
            shade.setValue(shadeTarget);
            complete();
            return;
        }
        animation.current = Animated.parallel([
            Animated.timing(offset, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(shade, { toValue: shadeTarget, duration, useNativeDriver: true }),
        ]);
        animation.current.start(({ finished }) => {
            if (finished && generation.current === token) complete();
        });
    }, [hiddenOffset, offset, reduceMotion, shade]);

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
        animate(collapsedOffset, OPEN_MS, () => { phase.current = "open"; });
    }, [animate, collapsedOffset]);
    const dismiss = useCallback((afterClose) => {
        if (phase.current === "hidden" || phase.current === "closing") return;
        pending.current = afterClose || (() => closeRef.current());
        phase.current = "closing";
        animate(hiddenOffset, CLOSE_MS, finishClose);
    }, [animate, finishClose, hiddenOffset]);

    useEffect(() => {
        if (reduceMotion === null) return;
        const opening = visible && !wasVisible.current;
        wasVisible.current = visible;
        if (visible) {
            if (phase.current === "closing") {
                if (!opening) { animate(hiddenOffset, CLOSE_MS, finishClose); return; }
                pending.current = null;
                phase.current = "opening";
                animate(collapsedOffset, OPEN_MS, () => { phase.current = "open"; });
                return;
            }
            pending.current = null;
            if (reduceMotion) {
                phase.current = "opening";
                setPresented(true);
                animate(collapsedOffset, 0, () => { phase.current = "open"; });
            } else if (phase.current === "hidden") {
                expanded.current = false;
                offset.setValue(hiddenOffset);
                shade.setValue(0);
                phase.current = "waiting";
                setPresented(true);
            } else if (phase.current === "waiting") offset.setValue(hiddenOffset);
        } else if (phase.current !== "hidden") {
            pending.current = null;
            phase.current = "closing";
            animate(hiddenOffset, CLOSE_MS, finishClose);
        }
    }, [animate, collapsedOffset, finishClose, hiddenOffset, offset, reduceMotion, shade, visible]);

    useEffect(() => {
        if (!presented || phase.current !== "open") return;
        offset.setValue(expanded.current ? 0 : collapsedOffset);
    }, [collapsedOffset, expandedHeight, offset, presented]);

    const settle = useCallback((nextExpanded = expanded.current) => {
        if (phase.current !== "dragging") return;
        expanded.current = nextExpanded;
        phase.current = "settling";
        animate(nextExpanded ? 0 : collapsedOffset, SETTLE_MS, () => { phase.current = "open"; });
    }, [animate, collapsedOffset]);
    const pan = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => phase.current === "open" && gestureEnabledRef.current
            && Math.abs(gesture.dy) > DRAG_CAPTURE && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.25,
        onPanResponderGrant: () => {
            if (phase.current !== "open" || !gestureEnabledRef.current) return;
            animation.current?.stop();
            dragStart.current = expanded.current ? 0 : collapsedOffset;
            phase.current = "dragging";
        },
        onPanResponderMove: (_event, gesture) => {
            if (phase.current !== "dragging") return;
            const next = Math.max(0, Math.min(hiddenOffset, dragStart.current + gesture.dy));
            offset.setValue(next);
            shade.setValue(1 - Math.max(0, next - collapsedOffset) / Math.max(1, hiddenOffset - collapsedOffset));
        },
        onPanResponderRelease: (_event, gesture) => {
            if (phase.current !== "dragging") return;
            if (gesture.dy >= DETENT_THRESHOLD) dismiss();
            else if (gesture.dy <= -DETENT_THRESHOLD) settle(true);
            else settle();
        },
        onPanResponderTerminate: () => settle(),
    }), [collapsedOffset, dismiss, hiddenOffset, offset, settle, shade]);

    return { presented, offset, shade, pan, dismiss, startOpening };
}
