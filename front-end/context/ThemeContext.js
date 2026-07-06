import React, { createContext, useContext, useMemo } from "react";
import { paletteFor, PALETTES, space, radius, type, shadow, MIN_TOUCH } from "../theme";

// Centralized runtime theme. The active color palette is derived from the
// selected child's gender, with an optional manual override from Settings:
//   override "auto"  -> palette follows the child's gender (girl/boy)
//   override "girl" | "boy" | "neutral" -> forced palette
//
// Consume anywhere with: const { colors } = useTheme();
const defaultValue = {
    colors: PALETTES.neutral,
    mode: "neutral",
    space,
    radius,
    type,
    shadow,
    MIN_TOUCH,
};

const ThemeContext = createContext(defaultValue);

export function ThemeProvider({ gender, override = "auto", children }) {
    const value = useMemo(() => {
        const colors = paletteFor(gender, override === "auto" ? undefined : override);
        const mode =
            override && override !== "auto"
                ? override
                : gender === "boy" || gender === "Male"
                  ? "boy"
                  : gender === "girl" || gender === "Female"
                    ? "girl"
                    : "neutral";
        return { colors, mode, space, radius, type, shadow, MIN_TOUCH };
    }, [gender, override]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}

export default ThemeProvider;
