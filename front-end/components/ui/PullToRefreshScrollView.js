import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, PanResponder, Platform, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { useScroll } from "../../context/ScrollContext";
import store from "../../utils/recordStore.cjs";
import { useSessionEpoch } from "../../utils/useRecords";
import { MIN_TOUCH, space, type } from "../../theme";

const PULL_THRESHOLD = 80;

// The same top-only gesture serves tabs and the Notifications menu layout.
export function usePullToRefresh({ scope, refreshing, onRefresh, blocked = false, error = "", label = "records", scrollRef: consumerRef }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const localRef = useRef(null), scrollRef = consumerRef || localRef;
    const { scrollProps, scrollViewRef } = useScroll(scrollRef);
    const epoch = useSessionEpoch(), key = `${epoch}:${scope}`;
    const keyRef = useRef(key); keyRef.current = key;
    const alive = useRef(true);
    const current = () => alive.current && keyRef.current === key && store.getEpoch() === epoch;
    const offset = useRef(0), eligible = useRef(false), webTouch = useRef(null);
    const latest = useRef(null); latest.current = { refreshing, blocked, onRefresh };
    const [pullPhase, setPullPhase] = useState("idle"), [reduceMotion, setReduceMotion] = useState(true), [pullError, setPullError] = useState("");
    const phase = useRef("idle"), distance = useRef(0), pendingRefresh = useRef(false), generation = useRef(0);
    const height = useRef(new Animated.Value(0)).current, opacity = useRef(new Animated.Value(0)).current;
    const rotation = useRef(new Animated.Value(0)).current, settling = useRef(null);
    const motion = useRef({});
    const changePhase = (next) => { phase.current = next; setPullPhase(next); };
    const settlePull = () => {
        if (!current()) return;
        const token = ++generation.current;
        settling.current?.stop(); eligible.current = false; distance.current = 0; changePhase("settling");
        const done = () => { if (current() && token === generation.current) { rotation.setValue(0); changePhase("idle"); } };
        if (reduceMotion) { height.setValue(0); opacity.setValue(0); done(); return; }
        settling.current = Animated.parallel([
            Animated.timing(height, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: false }),
        ]);
        settling.current.start(({ finished }) => { if (finished) done(); });
    };
    const refresh = async () => {
        if (!current() || phase.current === "refreshing" || latest.current.refreshing || latest.current.blocked) {
            if (["pulling", "armed"].includes(phase.current)) settlePull();
            return;
        }
        const token = ++generation.current;
        settling.current?.stop(); eligible.current = false; pendingRefresh.current = true; setPullError(""); changePhase("refreshing");
        height.setValue(48); opacity.setValue(1); rotation.setValue(0);
        AccessibilityInfo.announceForAccessibility?.(`Refreshing ${label}`);
        try { await latest.current.onRefresh(); }
        catch (_) { if (current() && token === generation.current) setPullError("Records could not be refreshed. Please retry."); }
        finally {
            if (current() && token === generation.current) {
                pendingRefresh.current = false;
                if (!latest.current.refreshing) settlePull();
            }
        }
    };
    const canStart = (event) => {
        const node = Platform.OS === "web" ? scrollRef.current?.getScrollableNode?.() : null;
        // Portalled modals and nested scroll controls own their own gestures.
        if (node && event?.target) {
            if (node.contains && !node.contains(event.target)) return false;
            for (let target = event.target; target && target !== node; target = target.parentElement) {
                if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return false;
                if (target.scrollHeight > target.clientHeight && typeof window !== "undefined"
                    && /^(auto|scroll)$/.test(window.getComputedStyle(target).overflowY)) return false;
            }
        }
        return current() && phase.current === "idle" && (node?.scrollTop ?? offset.current) <= 1
            && !latest.current.refreshing && !latest.current.blocked;
    };
    const qualifies = (dx, dy, touches) => {
        if (touches !== 1 || dy < -8 || (Math.abs(dx) > 8 && Math.abs(dx) >= Math.abs(dy))) eligible.current = false;
        return eligible.current && dy > 8 && dy > Math.abs(dx) * 1.25;
    };
    const movePull = (dy) => {
        if (!current() || !["idle", "pulling", "armed"].includes(phase.current)) return;
        if (phase.current === "idle" && !eligible.current) return;
        if (latest.current.refreshing || latest.current.blocked) { settlePull(); return; }
        distance.current = Math.max(0, Math.min(120, dy));
        const next = distance.current >= PULL_THRESHOLD ? "armed" : "pulling";
        if (phase.current !== next) {
            changePhase(next);
            if (next === "armed") AccessibilityInfo.announceForAccessibility?.("Release to refresh");
        }
        height.setValue(distance.current * 0.6); opacity.setValue(Math.min(1, distance.current / 24));
        rotation.setValue(reduceMotion ? 0 : distance.current / PULL_THRESHOLD);
    };
    const releasePull = () => {
        eligible.current = false;
        if (["pulling", "armed"].includes(phase.current)) {
            if (distance.current >= PULL_THRESHOLD) refresh(); else settlePull();
        }
    };
    motion.current = { canStart, qualifies, movePull, releasePull, settlePull };
    const pan = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponderCapture: (event) => { eligible.current = motion.current.canStart(event); return false; },
        onMoveShouldSetPanResponderCapture: (_event, gesture) => !webTouch.current && motion.current.qualifies(gesture.dx, gesture.dy, gesture.numberActiveTouches),
        onPanResponderGrant: (_event, gesture) => motion.current.movePull(gesture.dy),
        onPanResponderStart: (_event, gesture) => {
            if (gesture.numberActiveTouches !== 1 && ["pulling", "armed"].includes(phase.current)) motion.current.settlePull();
        },
        onPanResponderMove: (_event, gesture) => {
            if (gesture.numberActiveTouches !== 1) motion.current.settlePull(); else motion.current.movePull(gesture.dy);
        },
        onPanResponderRelease: () => motion.current.releasePull(),
        onPanResponderTerminate: () => { if (["pulling", "armed"].includes(phase.current)) motion.current.settlePull(); },
    }), []);
    const trackScroll = useMemo(() => (event) => {
        offset.current = Math.max(0, event.nativeEvent.contentOffset.y);
    }, []);
    const onScroll = useMemo(() => Animated.forkEvent(scrollProps.onScroll, trackScroll), [scrollProps.onScroll, trackScroll]);
    useEffect(() => () => Animated.unforkEvent(scrollProps.onScroll, trackScroll), [scrollProps.onScroll, trackScroll]);
    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled?.().then((value) => active && setReduceMotion(!!value)).catch(() => {});
        const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion);
        return () => { active = false; subscription?.remove?.(); };
    }, []);
    useEffect(() => {
        if (pullPhase !== "refreshing" || reduceMotion) return;
        const loop = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 900, easing: Easing.linear,
            useNativeDriver: Platform.OS !== "web", isInteraction: false }));
        loop.start(); return () => loop.stop();
    }, [pullPhase, reduceMotion, rotation]);
    useEffect(() => {
        if (phase.current === "refreshing" && !pendingRefresh.current && !refreshing) settlePull();
    }, [refreshing, pullPhase]);
    useEffect(() => {
        if (Platform.OS !== "web") return;
        const node = scrollRef.current?.getScrollableNode?.();
        if (!node?.addEventListener) return;
        // Browser touch scrolling must be cancelled with a non-passive listener;
        // React's delegated touch events cannot reliably prevent page refresh.
        const start = (event) => {
            const touch = event.touches[0];
            webTouch.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
            eligible.current = event.touches.length === 1 && motion.current.canStart(event);
            if (event.touches.length !== 1 && ["pulling", "armed"].includes(phase.current)) motion.current.settlePull();
        };
        const move = (event) => {
            if (!webTouch.current) return;
            if (event.touches.length !== 1) {
                eligible.current = false;
                if (["pulling", "armed"].includes(phase.current)) motion.current.settlePull();
                return;
            }
            const dx = event.touches[0].clientX - webTouch.current.x, dy = event.touches[0].clientY - webTouch.current.y;
            const pulling = ["pulling", "armed"].includes(phase.current);
            if (!pulling && !motion.current.qualifies(dx, dy, 1)) return;
            if (event.cancelable) event.preventDefault();
            motion.current.movePull(dy);
        };
        const end = () => { webTouch.current = null; motion.current.releasePull(); };
        const cancel = () => {
            webTouch.current = null; eligible.current = false;
            if (["pulling", "armed"].includes(phase.current)) motion.current.settlePull();
        };
        node.addEventListener("touchstart", start, { passive: true });
        node.addEventListener("touchmove", move, { passive: false });
        node.addEventListener("touchend", end); node.addEventListener("touchcancel", cancel);
        return () => { for (const [name, handler] of [["touchstart", start], ["touchmove", move], ["touchend", end], ["touchcancel", cancel]]) node.removeEventListener(name, handler); };
    }, []);
    const refreshError = error || pullError;

    useEffect(() => {
        alive.current = true;
        pendingRefresh.current = false; eligible.current = false; webTouch.current = null;
        height.setValue(0); opacity.setValue(0); rotation.setValue(0); changePhase("idle"); setPullError("");
        return () => { alive.current = false; generation.current++; settling.current?.stop(); };
    }, [key]);
    const indicator = (<Animated.View style={[styles.pullIndicator, { height, opacity }]} pointerEvents="none"
                accessible={pullPhase === "armed" || pullPhase === "refreshing"} accessibilityRole="progressbar"
                accessibilityLabel={pullPhase === "armed" ? "Release to refresh" : `Refreshing ${label}`}
                accessibilityState={{ busy: pullPhase === "refreshing" }}>
                <Animated.View style={{ transform: [{ rotate: reduceMotion ? "0deg" : rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
                    <Svg width={28} height={28} viewBox="0 0 24 24"
                        {...(Platform.OS === "web" ? { "aria-hidden": true, focusable: "false" } : { accessible: false })}>
                        <Path d="M20 12a8 8 0 1 1-2.3-5.7M16 3.5l2.5 3.5-4 .5" fill="none"
                            stroke={colors.primary} strokeWidth={pullPhase === "armed" || pullPhase === "refreshing" ? 3.6 : 2.2}
                            strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                </Animated.View>
            </Animated.View>);
    return { panHandlers: pan.panHandlers, scrollViewRef, refresh, refreshError, pullPhase, indicator,
        scrollProps: { ...scrollProps, onScroll, scrollEnabled: !["pulling", "armed"].includes(pullPhase), bounces: false, overScrollMode: "never",
            accessibilityActions: [{ name: "refresh", label: `Refresh ${label}` }],
            onAccessibilityAction: (event) => { if (event.nativeEvent.actionName === "refresh") refresh(); } },
        webStyle: Platform.OS === "web" ? styles.webScroll : null,
        feedback: refreshError ? <View style={styles.refreshRow}>
            <Text accessibilityRole="alert" style={styles.error}>{refreshError}</Text>
            <TouchableOpacity onPress={refresh} disabled={refreshing || pullPhase === "refreshing"}
                accessibilityRole="button" accessibilityLabel={`Retry refreshing ${label}`} style={styles.refresh}>
                <Text style={styles.refreshText}>Retry</Text>
            </TouchableOpacity>
        </View> : null };
}

export default function PullToRefreshScrollView({ scope, refreshing, onRefresh, blocked, error, label, children, style, scrollRef, ...props }) {
    const pull = usePullToRefresh({ scope, refreshing, onRefresh, blocked, error, label, scrollRef });
    return <View style={{ flex: 1 }} {...pull.panHandlers}>
        <Animated.ScrollView {...props} {...pull.scrollProps} ref={pull.scrollViewRef} style={[style, pull.webStyle]}>
            {pull.indicator}{pull.feedback}{children}
        </Animated.ScrollView>
    </View>;
}

const makeStyles = (colors) => StyleSheet.create({
    webScroll: { overscrollBehaviorY: "contain", overflowAnchor: "none" },
    pullIndicator: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
    refreshRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
    refresh: { minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm },
    refreshText: { ...type.caption, color: colors.primaryDark }, error: { ...type.caption, color: colors.danger, flex: 1 },
});
