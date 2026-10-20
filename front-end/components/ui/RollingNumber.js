import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

export const NUMBER_DURATION = 1200;
export const smooth = value => value * value * (3 - 2 * value);

const modulo = value => (value % 10 + 10) % 10;
const reelEase = value => 1 - (1 - value) ** 3;

export function digitReel(from, digit, direction) {
    from = modulo(from);
    const to = Math.round(from + direction * (10 + modulo(direction * (digit - from))));
    return { from, to, first: Math.floor(Math.min(from, to)), last: Math.ceil(Math.max(from, to)) + 1 };
}

export function DigitReel({ progress, fromDigit, toDigit, direction, cell, style }) {
    const position = useRef(Number(fromDigit));
    const segment = useMemo(() => digitReel(position.current, Number(toDigit), direction), [progress, toDigit, direction]);
    useLayoutEffect(() => {
        position.current = segment.from;
        const listener = progress.addListener(({ value }) => {
            position.current = segment.from + (segment.to - segment.from) * reelEase(value);
        });
        return () => progress.removeListener(listener);
    }, [progress, segment]);
    return <View style={{ width: cell.width, height: cell.height, overflow: "hidden" }}>
        <Animated.View style={{ transform: [{ translateY: progress.interpolate({ inputRange: [0, 1],
            outputRange: [-(segment.from - segment.first) * cell.height, -(segment.to - segment.first) * cell.height],
            easing: reelEase, extrapolate: "clamp" }) }] }}>
            {Array.from({ length: segment.last - segment.first + 1 }, (_, index) => {
                const row = segment.first + index;
                const blank = (row === segment.from && fromDigit === " ") || (row === segment.to && toDigit === " ");
                return <Text key={row} style={[style, { height: cell.height, includeFontPadding: false }]}>{blank ? " " : modulo(row)}</Text>;
            })}
        </Animated.View>
    </View>;
}

export function RollingNumber({ motion, unit, style, precision }) {
    const [cell, setCell] = useState({ width: style.fontSize * 0.64, height: style.lineHeight });
    if (!motion.animated || motion.fromValue === motion.toValue)
        return <Text selectable style={style}>{motion.label}{unit ? " " : null}{unit}</Text>;

    const decimals = precision ?? (motion.label.split(".")[1]?.length || 0);
    const from = motion.fromValue.toFixed(decimals).replace(".", "");
    const to = motion.toValue.toFixed(decimals).replace(".", "");
    const count = Math.max(from.length, to.length);
    const start = from.padStart(count, " "), end = to.padStart(count, " ");
    const direction = motion.toValue > motion.fromValue ? 1 : -1;
    const digitStyle = { ...style, marginTop: 0, maxWidth: undefined };
    return <View accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden
        style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 7, marginTop: style.marginTop }}>
        <Text pointerEvents="none" style={[digitStyle, { position: "absolute", opacity: 0, includeFontPadding: false }]}
            onLayout={({ nativeEvent: { layout } }) => {
                if (layout.width > 0 && layout.height > 0 && (layout.width !== cell.width || layout.height !== cell.height))
                    setCell({ width: layout.width, height: layout.height });
            }}>0</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
            {Array.from({ length: count }, (_, index) => {
                const power = count - index - decimals - 1;
                return <React.Fragment key={power}>
                    {decimals > 0 && power === -1 ? <Text style={digitStyle}>.</Text> : null}
                    <DigitReel progress={motion.progress} fromDigit={start[index]} toDigit={end[index]}
                        direction={direction} cell={cell} style={digitStyle} />
                </React.Fragment>;
            })}
        </View>
        {unit ? <Text style={digitStyle}>{unit}</Text> : null}
    </View>;
}

export function CountUpNumber({ label, style, width, reducedMotion }) {
    const idle = useRef(new Animated.Value(1)).current;
    const current = useRef(0);
    const previous = useRef(null);
    const stop = useRef(null);
    const [frame, setFrame] = useState({ fromValue: 0, toValue: 0, label: "0", animated: false, progress: idle });
    const layoutWidth = Math.round(width);
    useLayoutEffect(() => {
        if (reducedMotion == null || (layoutWidth <= 0 && !reducedMotion)) return;
        const changed = previous.current?.label !== label;
        const resized = previous.current != null && previous.current.width !== layoutWidth;
        previous.current = { label, width: layoutWidth };
        if (!changed && !resized && !(reducedMotion && stop.current)) return;
        stop.current?.();
        const target = Number(label);
        const animated = changed && !resized && !reducedMotion && Number.isFinite(target)
            && target >= 0 && current.current !== target;
        const value = Number.isFinite(target) ? target : 0;
        // A replacement clock leaves interrupted reels at their last visible positions.
        const progress = new Animated.Value(animated ? 0 : 1);
        const next = { fromValue: animated ? current.current : value, toValue: value, label, animated, progress };
        setFrame(next);
        if (!animated) { current.current = Number.isFinite(target) ? target : 0; return; }
        const listener = progress.addListener(({ value }) => {
            current.current = next.fromValue + (target - next.fromValue) * smooth(value);
        });
        let active = true;
        const animation = Animated.timing(progress, { toValue: 1, duration: NUMBER_DURATION,
            easing: value => value, useNativeDriver: false, isInteraction: false });
        stop.current = () => { active = false; animation.stop(); progress.removeListener(listener); stop.current = null; };
        animation.start(({ finished }) => {
            if (!active || !finished) return;
            current.current = target;
            progress.removeListener(listener);
            stop.current = null;
            setFrame({ ...next, animated: false });
        });
    }, [label, reducedMotion, layoutWidth]);
    useEffect(() => () => { stop.current?.(); previous.current = null; }, []);
    const numbers = useMemo(() => frame.progress.interpolate({ inputRange: [0, 1],
        outputRange: [frame.fromValue, frame.toValue], easing: smooth, extrapolate: "clamp" }), [frame]);
    return <View accessible accessibilityLabel={label}>
        <RollingNumber motion={{ ...frame, numbers }} style={style} />
    </View>;
}
