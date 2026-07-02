import { useWindowDimensions } from "react-native";

// Breakpoints (dp width). Phone < md <= tablet < lg <= laptop < xl <= large.
export const breakpoints = { md: 600, lg: 900, xl: 1200 };

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
