import React, { createContext, useContext, useMemo, useRef, useCallback } from "react";
import { Animated } from "react-native";

// One shared scroll offset, published by whichever screen is on screen and
// consumed by the header in App.js.
//
// WHY THIS EXISTS. The header lives in App.js but every screen owns its own
// ScrollView, so the header had no way to know where the page was scrolled —
// which is everything the collapsing behaviour depends on. Rather than each
// screen keeping its own scroll state and passing it up, there is one
// Animated.Value here that the active screen writes to.
//
// A context rather than prop drilling, matching ThemeContext / LanguageContext.
//
// USAGE, in a screen's ROOT ScrollView only:
//
//   const { scrollProps } = useScroll();
//   <ScrollView {...scrollProps} contentContainerStyle={[styles.content,
//       { paddingTop: padTop, paddingBottom: padBottom }]}>
//
// Do NOT spread these onto a modal body or a horizontal chart strip. Those
// scroll independently of the page, and wiring one would let opening an
// Add-Vaccine form drive the header.
const defaultValue = {
    scrollY: new Animated.Value(0),
    headerHeight: 0,
    scrollProps: {},
    resetScroll: () => {},
};

export const ScrollContext = createContext(defaultValue);

// Builds the context value. Lives as a hook rather than a <Provider> component
// because App.js's own header has to read `scrollY` too, and a component that
// created the value internally would put it out of the header's reach.
export function useScrollController(headerHeight = 0) {
    const scrollY = useRef(new Animated.Value(0)).current;

    // useNativeDriver stays TRUE: everything downstream of this value is either
    // opacity or transform, both of which the native driver supports. Animating
    // fontSize instead would have forced it off and re-laid out the title text
    // on every scroll frame.
    const onScroll = useMemo(
        () =>
            Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                useNativeDriver: true,
            }),
        [scrollY],
    );

    // Screens UNMOUNT on navigation (App.js swaps them with conditional
    // rendering), so a freshly mounted screen sits at offset 0 while this value
    // still holds the last screen's offset — the header would open stuck in its
    // collapsed, white state. Same class of bug as the stale `navTab` recorded
    // in CLAUDE.md Section 8: state that outlives an unmount and is re-applied
    // on the next mount.
    const resetScroll = useCallback(() => {
        scrollY.setValue(0);
    }, [scrollY]);

    return useMemo(
        () => ({
            scrollY,
            headerHeight,
            resetScroll,
            scrollProps: { onScroll, scrollEventThrottle: 16 },
        }),
        [scrollY, headerHeight, resetScroll, onScroll],
    );
}

export function useScroll() {
    return useContext(ScrollContext);
}

export default ScrollContext;
