import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";
import useReducedMotion from "./useReducedMotion";
import { smooth } from "./RollingNumber";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export default function GrowthChartSeries({ path, animate, dataKey, width, height, gradientId,
    areaFill, compact, lineColor, latestColor, pointFill, seriesTheme }) {
    const canAnimate = animate && path.length > 0;
    const reducedMotion = useReducedMotion(canAnimate);
    const progress = useRef(new Animated.Value(1)).current;
    const previous = useRef(null);
    const stop = useRef(null);
    const [running, setRunning] = useState(false);
    const layoutWidth = Math.round(width);
    useLayoutEffect(() => {
        if (reducedMotion == null) return;
        const changed = previous.current?.dataKey !== dataKey;
        const resized = previous.current != null && previous.current.width !== layoutWidth;
        previous.current = { dataKey, width: layoutWidth };
        if (!changed && !resized && !(stop.current && (reducedMotion || !canAnimate))) return;
        stop.current?.();
        const animated = canAnimate && changed && !resized && !reducedMotion;
        progress.setValue(animated ? 0 : 1);
        setRunning(animated);
        if (!animated) return;
        let active = true;
        const animation = Animated.timing(progress, { toValue: 1, duration: 900, easing: smooth,
            useNativeDriver: false, isInteraction: false });
        stop.current = () => { active = false; animation.stop(); stop.current = null; };
        animation.start(({ finished }) => {
            if (!active || !finished) return;
            stop.current = null;
            setRunning(false);
        });
    }, [canAnimate, dataKey, progress, reducedMotion, layoutWidth]);
    useEffect(() => () => { stop.current?.(); previous.current = null; }, []);

    // Layout effects reset new paths before paint; only unresolved preferences should hide the series.
    const pending = canAnimate && reducedMotion == null;
    const LinePath = running ? AnimatedPath : Path;
    const Dot = running ? AnimatedCircle : Circle;
    const EndpointDot = canAnimate ? AnimatedCircle : Circle;
    const first = path.vertices[0];
    const stops = path.vertices.filter((c, index, all) => index === 0 || c.distance > all[index - 1].distance);
    const endpoint = running ? {
        cx: progress.interpolate({ inputRange: stops.map(c => c.distance / path.length),
            outputRange: stops.map(c => c.x), extrapolate: "clamp" }),
        cy: progress.interpolate({ inputRange: stops.map(c => c.distance / path.length),
            outputRange: stops.map(c => c.y), extrapolate: "clamp" }),
    } : { cx: path.latest.x, cy: path.latest.y };
    const clipId = `${gradientId}-reveal`;
    const markerOpacity = c => c.distance === 0 ? 1 : progress.interpolate({
        inputRange: [Math.max(0, c.distance / path.length - 0.02), c.distance / path.length],
        outputRange: [0, 1], extrapolate: "clamp",
    });
    return <G opacity={pending ? 0 : 1}>
        {running && areaFill ? <Defs><ClipPath id={clipId}>
            <AnimatedRect x={first.x} y={0} height={height} width={progress.interpolate({
                inputRange: stops.map(c => c.distance / path.length),
                outputRange: stops.map(c => c.x - first.x), extrapolate: "clamp",
            })} />
        </ClipPath></Defs> : null}
        {areaFill && path.vertices.length > 1 ? <Path d={path.area} fill={`url(#${gradientId})`}
            clipPath={running ? `url(#${clipId})` : undefined} /> : null}
        {path.vertices.length > 1 ? <LinePath d={path.line} stroke={lineColor} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin={areaFill ? "miter" : "round"} fill="none"
            strokeDasharray={running ? [path.length, path.length] : undefined}
            strokeDashoffset={running ? progress.interpolate({ inputRange: [0, 1],
                outputRange: [path.length, 0] }) : undefined} /> : null}
        {path.coords.filter(c => !areaFill || c !== path.latest).map((c, i) =>
            <Dot key={c.point?.id || `${c.point?.date}-${i}`} cx={c.x} cy={c.y} r={areaFill ? 2.5 : compact ? 2.75 : 3.5}
                fill={pointFill} fillOpacity={1} stroke={lineColor}
                strokeWidth={areaFill ? 1.25 : 2} strokeOpacity={seriesTheme || !areaFill ? 1 : 0.62}
                opacity={running ? markerOpacity(c) : 1} />
        )}
        {areaFill ? <>
            <EndpointDot {...endpoint} r={7} fill={pointFill} stroke={latestColor} strokeWidth={2} opacity={1} />
            <EndpointDot {...endpoint} r={3.5} fill={pointFill} stroke={latestColor} strokeWidth={1.25}
                fillOpacity={1} strokeOpacity={1} opacity={1} />
        </> : null}
    </G>;
}
