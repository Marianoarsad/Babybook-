export function shouldClaimHorizontalSwipe(dx, dy) {
    return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
}

export function shouldOpenSwipe({ dx, wasOpen, revealWidth }) {
    const threshold = revealWidth * 0.4;
    return wasOpen ? dx < threshold : dx < -threshold;
}

// Small dependency-free check for the gesture thresholds used by CalendarView.
if (typeof process !== "undefined" && process.argv?.[1]?.replaceAll("\\", "/").endsWith("/swipeMath.js")) {
    console.assert(shouldClaimHorizontalSwipe(-24, 3), "horizontal drag should claim the row");
    console.assert(!shouldClaimHorizontalSwipe(-8, 20), "vertical scroll should stay with the calendar");
    console.assert(!shouldOpenSwipe({ dx: -24, wasOpen: false, revealWidth: 144 }), "short drag should settle closed");
    console.assert(shouldOpenSwipe({ dx: -60, wasOpen: false, revealWidth: 144 }), "deliberate left drag should open");
    console.assert(!shouldOpenSwipe({ dx: 60, wasOpen: true, revealWidth: 144 }), "deliberate right drag should close");
    console.log("swipeMath checks passed");
}
