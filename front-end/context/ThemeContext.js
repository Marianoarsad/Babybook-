import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { paletteFor, PALETTES, space, radius, type, shadow, MIN_TOUCH, motion } from "../theme";

// Centralized runtime theme. The active color palette is derived from the
// selected child's gender, with an optional manual override from Settings:
//   override "auto"  -> palette follows the child's gender (girl/boy)
//   override "girl" | "boy" | "neutral" -> forced palette
// A second, independent axis controls light/dark:
//   schemeOverride "light" (DEFAULT) | "dark" -> forced scheme
//   schemeOverride "system" -> follows the OS setting (useColorScheme())
// The two axes combine (e.g. "girl" + "dark" = dark pink theme).
//
// The default is "light", NOT "system", and that is deliberate. With "system"
// the app had no look of its own: a parent whose phone was on a night schedule
// met a fully dark BabyBook+ the first time they opened it, having chosen
// nothing. "system" is still offered in Theme Preferences for anyone who wants
// it -- it is now opt-in rather than what you get by saying nothing.
//
// Consume anywhere with: const { colors } = useTheme();
const defaultValue = {
    colors: PALETTES.neutral,
    mode: "neutral",
    scheme: "light",
    space,
    radius,
    type,
    shadow,
    MIN_TOUCH,
    motion,
};

const ThemeContext = createContext(defaultValue);

export function ThemeProvider({ gender, override = "auto", schemeOverride = "light", children }) {
    const systemScheme = useColorScheme();
    const value = useMemo(() => {
        const scheme = schemeOverride === "system" ? (systemScheme === "dark" ? "dark" : "light") : schemeOverride;
        const colors = paletteFor(gender, override === "auto" ? undefined : override, scheme);
        const mode =
            override && override !== "auto"
                ? override
                : gender === "boy" || gender === "Male"
                  ? "boy"
                  : gender === "girl" || gender === "Female"
                    ? "girl"
                    : "neutral";
        return { colors, mode, scheme, space, radius, type, shadow, MIN_TOUCH, motion };
    }, [gender, override, schemeOverride, systemScheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}

export default ThemeProvider;
