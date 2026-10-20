// Storage adapter to support both web (localStorage) and native (AsyncStorage)
let storageImpl;

// Detect environment and use appropriate storage
if (typeof window !== "undefined" && window.localStorage) {
    // Web environment
    storageImpl = {
        getAllKeys: async () => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean),
        getItem: async (key) => {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                console.log("Storage error:", e);
                return null;
            }
        },
        setItem: async (key, value) => {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                console.log("Storage error:", e);
            }
        },
        removeItem: async (key) => {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.log("Storage error:", e);
            }
        },
    };
} else {
    // Native environment - use AsyncStorage
    try {
        const AsyncStorage = require("@react-native-async-storage/async-storage").default;
        storageImpl = AsyncStorage;
    } catch (e) {
        // Fallback if AsyncStorage not available
        console.log("AsyncStorage not available:", e);
        storageImpl = {
            getAllKeys: async () => [],
            getItem: async () => null,
            setItem: async () => {},
            removeItem: async () => {},
        };
    }
}

export const storage = storageImpl;

// Retired feature data only; never clear login, preferences or other caches.
export async function removeLegacyOfflineSummaries() {
    try {
        const keys = await storage.getAllKeys();
        await Promise.all(keys.filter((key) => key.startsWith("bb_offline_summary:") || key === "bb_seen_offlineSummary")
            .map((key) => storage.removeItem(key)));
    } catch (_) {
        // Best-effort; retry on the next launch without blocking startup.
    }
}
