import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

export default function useReducedMotion(enabled = true) {
    const [reduced, setReduced] = useState(null);
    useEffect(() => {
        if (!enabled) return;
        let active = true, changed = false;
        const media = Platform.OS === "web" && globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
        const update = value => { changed = true; if (active) setReduced(value); };
        const listener = event => update(event.matches);
        if (media) { update(media.matches); media.addEventListener?.("change", listener); }
        else AccessibilityInfo.isReduceMotionEnabled().then(value => {
            if (active && !changed) setReduced(value);
        }).catch(() => { if (active) setReduced(true); });
        const subscription = media ? null : AccessibilityInfo.addEventListener("reduceMotionChanged", update);
        return () => { active = false; media?.removeEventListener?.("change", listener); subscription?.remove(); };
    }, [enabled]);
    return enabled ? reduced : true;
}
