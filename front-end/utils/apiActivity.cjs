let count = 0;
let visible = false;
let hideTimer = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());
const getApiActivitySnapshot = () => visible;
const getActiveRequestCount = () => count;
function subscribeApiActivity(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
function beginApiActivity(background = false) {
    if (background) return () => {};
    clearTimeout(hideTimer);
    count++;
    visible = true;
    notify();
    let finished = false;
    return () => {
        if (finished) return;
        finished = true;
        count--;
        notify();
        if (!count) hideTimer = setTimeout(() => {
            visible = false;
            notify();
        }, 150);
    };
}
async function trackApiActivity(work, background = false) {
    const finish = beginApiActivity(background);
    try { return await work(); } finally { finish(); }
}
module.exports = { getApiActivitySnapshot, getActiveRequestCount, subscribeApiActivity, beginApiActivity, trackApiActivity };
