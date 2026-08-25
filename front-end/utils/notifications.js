// Local reminder notifications via expo-notifications.
// Guarded so the app still runs if the library isn't installed.

import { Platform } from "react-native";

let Notifications = null;
try {
    // eslint-disable-next-line global-require
    Notifications = require("expo-notifications");
} catch (e) {
    Notifications = null;
}

let handlerSet = false;

// Can this build actually deliver a reminder at a future time?
//
// The Platform check is not belt-and-braces — it is the whole answer on web.
// expo-notifications RESOLVES in the web bundle, so a bare `!!Notifications`
// returned true there and every screen that asks this question concluded
// reminders were working. They were not: scheduling a notification with a
// future trigger is a native-only capability, so on the web demo the calls
// simply went nowhere.
//
// That silence mattered. GeneralSettings shows "notifications aren't available
// on this platform" off the back of this function, and the Medicine tab now
// tells a parent whether their dose reminders will actually arrive. Both were
// quietly claiming a capability the web build does not have — the same defect
// as a section titled "Medication Reminders" that sent none.
export function notificationsAvailable() {
    return !!Notifications && Platform.OS !== "web";
}

async function ensureReady() {
    // notificationsAvailable(), not just the module: on web this would
    // otherwise pop a browser permission prompt to arm a reminder that can
    // never fire.
    if (!notificationsAvailable()) return false;
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
//
// `kind` tags the notification so cancelRemindersOfKind() can find it again.
// Without a tag there is no way to withdraw anything, which is how vaccination
// reminders came to be re-scheduled from scratch on every single app launch —
// see the note on that function.
export async function scheduleReminder(title, body, date, kind) {
    if (!notificationsAvailable()) return null;
    try {
        const when = new Date(date);
        if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return null;
        const ok = await ensureReady();
        if (!ok) return null;
        return await Notifications.scheduleNotificationAsync({
            content: { title, body, data: kind ? { kind } : {} },
            trigger: when,
        });
    } catch (e) {
        console.log("scheduleReminder:", e.message);
        return null;
    }
}

// Withdraw every pending notification carrying this `kind` tag.
//
// Two things depend on this existing:
//
//   1. Anything rescheduled on a timer has to withdraw its previous set first.
//      App.js used to re-schedule every pending vaccination reminder on every
//      launch with no way to cancel, so ten launches meant ten identical
//      notifications for the same dose.
//   2. iOS allows only 64 pending local notifications in total. Medicine dose
//      reminders are scheduled in a rolling 48-hour window precisely so they
//      do not eat that budget, and a rolling window is meaningless without a
//      way to clear the previous one.
//
// Untagged notifications (anything scheduled before this existed) are left
// alone rather than swept up, since there is no way to tell what they were for.
export async function cancelRemindersOfKind(kind) {
    if (!notificationsAvailable() || !kind) return 0;
    try {
        const pending = await Notifications.getAllScheduledNotificationsAsync();
        let cancelled = 0;
        for (const n of pending || []) {
            if (n?.content?.data?.kind !== kind) continue;
            await Notifications.cancelScheduledNotificationAsync(n.identifier);
            cancelled++;
        }
        return cancelled;
    } catch (e) {
        console.log("cancelRemindersOfKind:", e.message);
        return 0;
    }
}

// Convenience: build a reminder date at 9:00 AM on the given YYYY-MM-DD.
export function morningOf(dateStr) {
    if (!dateStr) return null;
    const d = new Date(`${String(dateStr).slice(0, 10)}T09:00:00`);
    return isNaN(d.getTime()) ? null : d;
}
