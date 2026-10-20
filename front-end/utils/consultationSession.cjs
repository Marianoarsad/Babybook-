const now = () => performance.now();
const remainingLifetime = (result, elapsed = 0) =>
    Math.max(0, Date.parse(result?.expiresAt) - Date.parse(result?.serverNow) - elapsed) || 0;

function watchConsultation({ session, credentials, api, appState, onHidden, onReady, onEnd }) {
    let deadline = now() + session.remainingMs, lastCheck = now(), pending = null, disposed = false;
    let visible = typeof document !== "undefined" ? document.visibilityState === "visible"
        : !appState?.currentState || appState.currentState === "active";
    let sequence = 0, timeout;
    const stopRequest = () => { sequence++; pending?.abort(); pending = null; clearTimeout(timeout); };
    const end = (message) => {
        if (disposed) return;
        disposed = true; stopRequest(); onHidden(); onEnd(message);
    };
    const validate = async () => {
        if (disposed || !visible || pending) return;
        const request = pending = new AbortController(), stamp = ++sequence, started = now();
        timeout = setTimeout(() => end("Access could not be checked. Reopen the records when connected."), 30000);
        try {
            const result = await api.consultStatus(credentials, { signal: request.signal });
            if (disposed || stamp !== sequence || !visible) return;
            const remaining = remainingLifetime(result, now() - started);
            deadline = Math.min(deadline, now() + remaining);
            if (result.status !== "ok" || deadline <= now()) return end("This code has expired. Ask the parent for a new one.");
            lastCheck = now(); onReady();
        } catch (error) {
            if (disposed || stamp !== sequence) return;
            end(error.data?.status === "revoked" ? "This code was revoked by the parent."
                : error.data?.status === "expired" ? "This code has expired. Ask the parent for a new one."
                    : "Access could not be checked. Reopen the records when connected.");
        } finally {
            if (stamp === sequence) { pending = null; clearTimeout(timeout); }
        }
    };
    const visibility = (active) => {
        if (disposed) return;
        visible = active; onHidden(); stopRequest();
        if (visible) validate();
    };
    const changed = () => visibility(document.visibilityState === "visible");
    const pageHidden = () => visibility(false);
    const pageShown = () => visibility(document.visibilityState === "visible");
    const offline = () => end("Connection lost. Reopen the records when connected.");
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", changed);
    if (typeof window !== "undefined") {
        window.addEventListener("pagehide", pageHidden); window.addEventListener("pageshow", pageShown);
        window.addEventListener("offline", offline);
    }
    const subscription = appState?.addEventListener("change", (state) => visibility(state === "active"));
    if (visible) onReady(); else onHidden();
    const timer = setInterval(() => {
        if (disposed) return;
        if (now() >= deadline) end("This code has expired. Ask the parent for a new one.");
        else if (visible && now() - lastCheck >= 15000) validate();
    }, 1000);
    return () => {
        disposed = true; stopRequest(); clearInterval(timer); subscription?.remove();
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", changed);
        if (typeof window !== "undefined") {
            window.removeEventListener("pagehide", pageHidden); window.removeEventListener("pageshow", pageShown);
            window.removeEventListener("offline", offline);
        }
    };
}

module.exports = { remainingLifetime, watchConsultation };
