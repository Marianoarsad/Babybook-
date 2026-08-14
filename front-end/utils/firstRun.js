// "Has this been seen before?" flags for one-time onboarding UI (the welcome
// carousel, the Dashboard setup checklist, and each screen's first-use tip
// strip). Backed by the same storage abstraction as bb_token/bb_theme_override
// (utils/storageAdapter.js) — bb_seen_* keys, one per flag.
import { storage } from "./storageAdapter";

const KEY = (flag) => `bb_seen_${flag}`;

// Failing to false is deliberate: if storage is unavailable, showing a tip
// twice is a far better outcome than crashing the screen.
export async function seen(flag) {
    try {
        return (await storage.getItem(KEY(flag))) === "1";
    } catch (e) {
        return false;
    }
}

export async function markSeen(flag) {
    try {
        await storage.setItem(KEY(flag), "1");
    } catch (e) {
        // ignore — worst case the flag is asked again next time
    }
}
