import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";
import { NUMBER_DURATION, smooth } from "./RollingNumber";

export { NUMBER_DURATION } from "./RollingNumber";
export const BAR_DURATION = 900;
const barFinish = BAR_DURATION / NUMBER_DURATION;
const linear = value => value;
const mix = (from, to, amount) => from + (to - from) * amount;

export function useNutritionMotion({ label, heights, dataKey, width, ready, reducedMotion }) {
    const idle = useRef(new Animated.Value(1)).current;
    const current = useRef({ value: 0, heights: {} });
    const previous = useRef(null);
    const stop = useRef(null);
    const [frame, setFrame] = useState({ fromValue: 0, toValue: 0, label: "0.0", fromHeights: {}, toHeights: {}, animated: false, progress: idle });
    const layoutWidth = Math.round(width);

    useLayoutEffect(() => {
        if (!ready || reducedMotion == null) return;
        const changed = previous.current?.dataKey !== dataKey;
        const resized = previous.current != null && previous.current.width !== layoutWidth;
        previous.current = { dataKey, width: layoutWidth };
        if (!changed && !resized && !(reducedMotion && stop.current)) return;
        stop.current?.();
        const value = Number(label);
        const from = current.current;
        const different = from.value !== value || Object.keys(heights).some(key => (from.heights[key] || 0) !== heights[key]);
        const animated = changed && !resized && !reducedMotion && different;
        const progress = new Animated.Value(animated ? 0 : 1);
        const next = { fromValue: animated ? from.value : value, toValue: value, label,
            fromHeights: animated ? from.heights : heights, toHeights: heights, animated, progress };
        setFrame(next);
        const update = ({ value: phase }) => {
            current.current = {
                value: mix(next.fromValue, value, smooth(phase)),
                heights: Object.fromEntries(Object.keys(heights).map(key => [key,
                    mix(next.fromHeights[key] || 0, heights[key], smooth(Math.min(1, phase / barFinish)))])),
            };
        };
        update({ value: animated ? 0 : 1 });
        if (!animated) return;
        const listener = progress.addListener(update);
        let active = true;
        const animation = Animated.timing(progress, { toValue: 1, duration: NUMBER_DURATION,
            easing: linear, useNativeDriver: false, isInteraction: false });
        stop.current = () => { active = false; animation.stop(); progress.removeListener(listener); stop.current = null; };
        animation.start(({ finished }) => {
            if (!active || !finished) return;
            update({ value: 1 });
            progress.removeListener(listener);
            stop.current = null;
            setFrame({ ...next, animated: false });
        });
    }, [dataKey, heights, label, ready, reducedMotion, layoutWidth]);
    useEffect(() => () => { stop.current?.(); previous.current = null; }, []);

    const numbers = useMemo(() => frame.progress.interpolate({ inputRange: [0, 1],
        outputRange: [frame.fromValue, frame.toValue], easing: smooth, extrapolate: "clamp" }), [frame]);
    const bars = useMemo(() => frame.progress.interpolate({ inputRange: [0, barFinish, 1],
        outputRange: [0, 1, 1], easing: smooth, extrapolate: "clamp" }), [frame.progress]);
    return { ...frame, numbers, bars, pending: !ready || reducedMotion == null };
}

