// Manual entry only. Scanner payloads still go unchanged to the API resolver.
function formatConsultationInput(next, previous = "", selection = { start: previous.length, end: previous.length }) {
    let text = String(next || "");
    let caret = selection.start + text.length - (previous.length - (selection.end - selection.start));
    // Backspace/delete across our inserted separator must remove a character,
    // not reinsert the dash forever and trap the cursor.
    if (selection.start === selection.end && previous[4] === "-"
        && text === previous.slice(0, 4) + previous.slice(5)) {
        const index = selection.start === 5 ? 3 : selection.start === 4 ? 4 : -1;
        if (index >= 0) {
            text = text.slice(0, index) + text.slice(index + 1);
            caret = index;
        }
    }
    const clean = (value) => value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);
    const chars = clean(text);
    const before = clean(text.slice(0, Math.max(0, caret))).length;
    const position = before + (before > 4 ? 1 : 0);
    return {
        value: chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars,
        selection: { start: position, end: position },
    };
}

// Protection is acquired before records mount. Disposal also waits for an
// in-flight acquisition, so leaving quickly cannot strand a capture lock.
function protectConsultation(capture, platform, key) {
    let disposed = false;
    let blocked = false;
    let preview = false;
    const release = async () => {
        const tasks = [];
        if (preview) {
            preview = false;
            tasks.push(Promise.resolve().then(() => capture.disableAppSwitcherProtectionAsync()));
        }
        if (blocked) {
            blocked = false;
            tasks.push(Promise.resolve().then(() => capture.allowScreenCaptureAsync(key)));
        }
        await Promise.all(tasks);
    };
    const ready = (async () => {
        try {
            if (!await capture.isAvailableAsync()) throw new Error("Capture protection unavailable");
            if (disposed) return false;
            blocked = true;
            await capture.preventScreenCaptureAsync(key);
            if (!disposed && platform === "ios") {
                preview = true;
                await capture.enableAppSwitcherProtectionAsync(1);
            }
            if (disposed) { await release(); return false; }
            return true;
        } catch (error) {
            await release();
            throw error;
        }
    })();
    return { ready, dispose: () => { disposed = true; return ready.then(release, release); } };
}

module.exports = { formatConsultationInput, protectConsultation };
