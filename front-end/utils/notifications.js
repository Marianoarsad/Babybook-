// Local reminder notifications via expo-notifications.
// Guarded so the app still runs if the library isn't installed (e.g. on web).

let Notifications = null;
try {
    // eslint-disable-next-line global-require
    Notifications = require("expo-notifications");
} catch (e) {
    Notifications = null;
}

let handlerSet = false;

export function notificationsAvailable() {
    return !!Notifications;
}

async function ensureReady() {
    if (!Notifications) return false;
    try {
        if (!handlerSet) {
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: false,
                }),
            });
            handlerSet = true;
        }
        const { status } = await Notifications.requestPermissionsAsync();
        return status === "granted";
    } catch (e) {
        console.log("notifications setup:", e.message);
        return false;
    }
}

// Schedule a one-off local reminder. `date` may be a Date or ISO string.
// Returns the notification id, or null if it couldn't be scheduled.
export async function scheduleReminder(title, body, date) {
    if (!Notifications) return null;
    try {
        const when = new Date(date);
        if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return null;
        const ok = await ensureReady();
        if (!ok) return null;
        return await Notifications.scheduleNotificationAsync({
            content: { title, body },
            trigger: when,
        });
    } catch (e) {
        console.log("scheduleReminder:", e.message);
        return null;
    }
}

// Convenience: build a reminder date at 9:00 AM on the given YYYY-MM-DD.
export function morningOf(dateStr) {
    if (!dateStr) return null;
    const d = new Date(`${String(dateStr).slice(0, 10)}T09:00:00`);
    return isNaN(d.getTime()) ? null : d;
}
