import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { useSessionEpoch } from "./useRecords";
import store from "./recordStore.cjs";
import useReducedMotion from "../components/ui/useReducedMotion";

export function vaccinationFocusId(request, childId) {
    return request?.intent === "focus" && request.sourceType === "vaccination"
        && String(request.childId) === String(childId) && request.recordId != null
        && String(request.recordId).length > 0 && !String(request.recordId).startsWith("tmp-")
        ? String(request.recordId) : null;
}

// Wait for the exact row AND the scroll content to lay out before consuming a link.
export default function useVaccinationFocus({ request, navKey, childId, records, ready, active, scrollRef, topInset, onMissing }) {
    const epoch = useSessionEpoch(), reduced = useReducedMotion();
    const id = vaccinationFocusId(request, childId), key = `${epoch}:${childId}:${navKey}`;
    const row = useRef(null), section = useRef(null), contentHeight = useRef(0), consumed = useRef(null);
    const frame = useRef(null), timer = useRef(null), animation = useRef(null), attempt = useRef(null);
    const opacity = useRef(new Animated.Value(0)).current;
    const [highlight, setHighlight] = useState(null);
    const alive = useRef(true), latest = useRef(null); latest.current = { key, active, ready };
    const current = () => alive.current && latest.current?.key === key && latest.current.active && store.getEpoch() === epoch;
    const pending = !!id && active && consumed.current !== key;
    const found = records.some(record => String(record.id) === id);
    const schedule = useCallback(() => {
        if (frame.current != null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => { frame.current = null; attempt.current?.(); });
    }, []);
    attempt.current = () => {
        if (!pending || !ready || !current()) return;
        const node = found ? row.current : section.current;
        const inner = scrollRef.current?.getInnerViewRef?.();
        if (!node || !inner || !contentHeight.current) return;
        node.measureLayout(inner, (_x, y, _width, height) => {
            if (!current() || !latest.current.ready || consumed.current === key || y + height > contentHeight.current + 1) return;
            scrollRef.current?.scrollTo({ y: Math.max(0, y - topInset - 12), animated: false });
            consumed.current = key;
            if (!found) { onMissing(); return; }
            opacity.setValue(1); setHighlight({ key, id });
            timer.current = setTimeout(() => {
                if (!current()) return;
                if (reduced !== false) { opacity.setValue(0); setHighlight(null); return; }
                animation.current = Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true });
                animation.current.start(({ finished }) => { if (finished && current()) setHighlight(null); });
            }, reduced !== false ? 1800 : 1500);
        }, () => {});
    };
    useEffect(() => {
        alive.current = true; opacity.setValue(0); setHighlight(null);
        return () => {
            alive.current = false;
            if (frame.current != null) cancelAnimationFrame(frame.current);
            clearTimeout(timer.current); animation.current?.stop();
        };
    }, [key, active]);
    useEffect(() => { schedule(); }, [key, ready, active, found, records, topInset, schedule]);
    const rowRef = useCallback(node => { row.current = node; if (node) schedule(); }, [schedule, id]);
    const sectionRef = useCallback(node => { section.current = node; if (node) schedule(); }, [schedule]);
    return { pending: pending && ready, id, rowRef, sectionRef, onLayout: schedule,
        onContentSizeChange: (_width, height) => { contentHeight.current = height; schedule(); },
        highlightId: highlight?.key === key ? highlight.id : null, opacity };
}
