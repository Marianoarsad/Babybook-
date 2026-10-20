import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { api } from "./api";
import store from "./recordStore.cjs";
import { useSessionEpoch } from "./useRecords";
import { useToast } from "../components/ui/Toast";

const empty = (key) => ({ key, rows: [], filter: "all", unreadCount: 0, total: 0, cursor: null, loaded: false, refreshing: false, loadingMore: false, error: "" });
export default function useNotificationInbox(childId, onUnseenChange) {
    const epoch = useSessionEpoch(), key = `${epoch}:${childId}`;
    const scope = useRef(key); scope.current = key;
    const mounted = useRef(false), sequence = useRef(0), pendingReads = useRef(new Set());
    const seenAccess = useRef(new Set()), firstCheck = useRef(true);
    const toast = useToast(), toastRef = useRef(toast); toastRef.current = toast;
    const [state, setState] = useState(() => empty(key));
    const latest = useRef(state); latest.current = state;
    const current = useCallback(() => mounted.current && scope.current === key && store.getEpoch() === epoch, [key, epoch]);
    const refresh = useCallback(async (options = {}) => {
        if (!childId || !current()) return;
        const request = ++sequence.current, before = latest.current.key === key ? latest.current : empty(key);
        const filter = options.filter || before.filter, target = options.filter ? 10 : Math.max(10, before.rows.length);
        setState((prev) => ({ ...(prev.key === key ? prev : empty(key)),
            ...(filter !== before.filter ? { rows: [], cursor: null, loaded: false } : {}),
            filter, refreshing: true, loadingMore: false, error: "" }));
        const opts = { background: true, sessionEpoch: epoch };
        const results = await Promise.allSettled([
            (async () => {
                let timeZone = "Asia/Manila";
                try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone; } catch (_) {}
                await api.syncNotifications(childId, timeZone, opts);
                if (!current() || request !== sequence.current) return null;
                let cursor = null, rows = [], page;
                do {
                    page = await api.listNotifications(childId, { filter, cursor, limit: Math.min(100, target - rows.length) }, opts);
                    if (!current() || request !== sequence.current) return null;
                    rows.push(...page.rows); cursor = page.nextCursor;
                } while (cursor && rows.length < target);
                return { ...page, rows, nextCursor: cursor };
            })(),
            api.unseenAccessLog(childId, opts),
        ]);
        if (!current() || request !== sequence.current) return;
        if (results[1].status === "fulfilled") {
            const { rows = [], count = rows.length } = results[1].value;
            const fresh = rows.filter((row) => !seenAccess.current.has(row.id));
            if (!firstCheck.current && fresh.length) {
                const when = new Date(fresh[0].access_date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                toastRef.current.info(`Your records were viewed by ${fresh[0].professional_name || "a viewer"} at ${when}`);
            }
            rows.forEach((row) => seenAccess.current.add(row.id)); firstCheck.current = false;
            onUnseenChange(count);
        }
        if (results[0].status === "fulfilled" && results[0].value) {
            const page = results[0].value;
            setState((prev) => ({ ...prev, rows: page.rows, unreadCount: page.unreadCount, total: page.total, cursor: page.nextCursor,
                loaded: true, refreshing: false, error: results[1].status === "rejected" ? "Access alerts could not be refreshed. Please retry." : "" }));
        } else setState((prev) => ({ ...prev, refreshing: false, error: "Notifications could not be refreshed. Please retry." }));
    }, [childId, key, epoch, current, onUnseenChange]);
    useEffect(() => {
        mounted.current = true; sequence.current++; pendingReads.current = new Set();
        seenAccess.current = new Set(); firstCheck.current = true; setState(empty(key));
        refresh();
        const interval = setInterval(() => refresh(), 90000);
        const subscription = AppState.addEventListener("change", (next) => { if (next === "active") refresh(); });
        return () => { mounted.current = false; sequence.current++; clearInterval(interval); subscription?.remove(); };
    }, [key, refresh]);
    const loadMore = async () => {
        const before = latest.current;
        if (!current() || before.key !== key || !before.cursor || before.refreshing || before.loadingMore) return;
        const request = ++sequence.current;
        setState((prev) => ({ ...prev, loadingMore: true, error: "" }));
        try {
            const page = await api.listNotifications(childId, { filter: before.filter, cursor: before.cursor }, { background: true, sessionEpoch: epoch });
            if (!current() || request !== sequence.current) return;
            setState((prev) => ({ ...prev, rows: [...prev.rows, ...page.rows.filter((row) => !prev.rows.some((old) => old.id === row.id))],
                cursor: page.nextCursor, total: page.total, unreadCount: page.unreadCount, loadingMore: false }));
        } catch (_) { if (current() && request === sequence.current) setState((prev) => ({ ...prev, loadingMore: false, error: "More notifications could not be loaded. Please retry." })); }
    };
    const markRead = async (row) => {
        if (!current() || pendingReads.current.has(row.id)) return false;
        if (row.readAt) return true;
        pendingReads.current.add(row.id);
        sequence.current++;
        try {
            const result = await api.markNotificationRead(childId, row.id, { background: true, sessionEpoch: epoch });
            if (!current()) return false;
            const interruptedRefresh = latest.current.refreshing || latest.current.loadingMore;
            sequence.current++;
            setState((prev) => ({ ...prev, refreshing: false, loadingMore: false, error: "",
                unreadCount: Math.max(0, prev.unreadCount - (prev.rows.find((item) => item.id === row.id)?.readAt ? 0 : 1)),
                rows: prev.filter === "unread" ? prev.rows.filter((item) => item.id !== row.id)
                    : prev.rows.map((item) => item.id === row.id ? { ...item, readAt: result.readAt } : item) }));
            if (interruptedRefresh) refresh();
            return true;
        } catch (_) {
            if (current()) setState((prev) => ({ ...prev, refreshing: false, loadingMore: false, error: "Could not mark this notification read. Tap the notification again to retry." }));
            return false;
        } finally { if (current()) pendingReads.current.delete(row.id); }
    };
    return { ...(state.key === key ? state : empty(key)), refresh, loadMore, markRead,
        selectFilter: (filter) => { if (["all", "unread"].includes(filter)) refresh({ filter }); } };
}
