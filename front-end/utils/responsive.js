import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space, TEXT_COL_MIN, SCREEN_PAD_BOTTOM } from "../theme";
import { useScroll } from "../context/ScrollContext";

// Breakpoints (dp width). Phone < md <= tablet < lg <= laptop < xl <= large.
export const breakpoints = { md: 600, lg: 900, xl: 1200 };

// Can `available` px hold `columns` side-by-side without squeezing any of them
// below a readable width? Answer no and the caller stacks to a column instead.
//
// Deliberately takes the CONTAINER's width rather than the screen's: the same
// two-up row has very different room inside a modal (screen − sheet padding −
// card padding) than at the top level, and a screen-width breakpoint gets that
// wrong in both directions.
export function fitsColumns(available, columns = 2, gap = space.md) {
    if (!available) return true; // pre-measurement: assume the roomy case, don't flash a stacked layout
    return (available - gap * (columns - 1)) / columns >= TEXT_COL_MIN;
}

// Bottom padding for a screen's scroll content: enough to clear the tab bar and
// the floating button, plus whatever the device reserves for its home indicator
// or gesture bar. Every screen used to end 16px from the bottom, which put the
// last card underneath both.
export function useScreenPadBottom() {
    const insets = useSafeAreaInsets();
    return SCREEN_PAD_BOTTOM + insets.bottom;
}

// Top padding for a screen's scroll content: the mirror of useScreenPadBottom.
//
// The header floats OVER the page rather than sitting above it, which is what
// lets content pass beneath the bar and makes its white background mean
// something. That also means the header no longer reserves any layout space, so
// every scrolling screen has to reserve it here or its first card renders under
// the bar.
//
// The height is MEASURED in App.js and published through ScrollContext, never
// hardcoded: it moves with the safe-area inset and grows with the OS font
// scale. `space.md` of breathing room is added so content clears the bar
// instead of touching it.
export function useScreenPadTop() {
    const { headerHeight } = useScroll();
    return (headerHeight || 0) + space.md;
}

// One hook that every screen/component can use to adapt to the current size.
// Uses useWindowDimensions (re-renders on rotate/resize) — never Dimensions.get().
export function useResponsive() {
    const { width, height } = useWindowDimensions();

    const bp =
        width >= breakpoints.xl ? "xl" : width >= breakpoints.lg ? "lg" : width >= breakpoints.md ? "md" : "sm";
    const isPhone = width < breakpoints.md;
    const isTablet = width >= breakpoints.md && width < breakpoints.lg;
    const isDesktop = width >= breakpoints.lg;

    // Moderate typographic scale from a 375dp baseline, clamped so text never
    // gets tiny on small phones or huge on desktops.
    const ratio = Math.min(Math.max(width / 375, 0.95), 1.3);
    const ms = (size, factor = 0.4) => Math.round(size + (ratio - 1) * size * factor);

    // Grid columns for card sections.
    const columns = width >= breakpoints.lg ? 3 : width >= breakpoints.md ? 2 : 1;

    // Cap the readable content width so lines don't stretch on wide screens.
    const contentMaxWidth = width >= breakpoints.lg ? 760 : width >= breakpoints.md ? 620 : width;

    // Adaptive screen-edge padding.
    const gutter = width >= breakpoints.lg ? 24 : width >= breakpoints.md ? 20 : 16;

    return { width, height, bp, isPhone, isTablet, isDesktop, ratio, ms, columns, contentMaxWidth, gutter };
}

export default useResponsive;
