// BabyBook+ design system.
//
// Colors are now DYNAMIC: the app has a girl (pink) and boy (blue) palette that
// switch based on the selected child's gender, plus a neutral palette for
// pre-selection screens (login/registration). Palettes are consumed at runtime
// through the ThemeProvider / useTheme() hook (see context/ThemeContext.js).
//
// The `colors` export below is the DEFAULT (girl) palette, kept so any screen
// not yet migrated to useTheme() still renders with a valid, consistent theme.
//
// Spacing, radii, type and elevation are theme-independent and stay static.

// --- tokens shared by every palette ---
const SHARED = {
    onPrimary: "#FFFFFF",
    onAccent: "#FFFFFF",
    text: "#1B1F3B", // ink
    textSecondary: "#3A4066",
    textMuted: "#5B618A",
    // Neutral placeholder gray: readable contrast on light inputs, clearly
    // subtler than entered text (colors.text) and muted labels (textMuted).
    placeholder: "#9AA0B4",
    textOnDark: "#FFFFFF",
    textOnDarkMuted: "rgba(255,255,255,0.85)",
    surface: "#FFFFFF",
    // Fixed, colourful module/icon tints (kept consistent across themes).
    tintGreen: "#E4EFE7",
    tintCoral: "#FFE7E1",
    tintBlue: "#E3EEFB",
    tintAmber: "#FFF1DE",
    tintViolet: "#EDE7FA",
    tintTeal: "#E2FBF3",
    tintPink: "#FFE3EE",
    tintIndigo: "#E7ECFF",
    // Status colours (shared, from the reference palette).
    success: "#2BB673",
    successBg: "#E3F6EC",
    danger: "#EF5D6A",
    dangerBg: "#FDE8EA",
    warning: "#FFB347",
    info: "#16B8A6",
};

export const PALETTES = {
    girl: {
        ...SHARED,
        primary: "#EC4F96",
        primaryDark: "#D43D82",
        accent: "#FF7EB3",
        accentStrong: "#EC4F96",
        gradient: ["#EC4F96", "#FF7EB3"],
        gradient3: ["#EC4F96", "#FF7EB3", "#FFA6CD"],
        background: "#FFF2F8",
        surfaceAlt: "#FFF7FB",
        softGreen: "#FFE3EE", // "soft brand" tint (name kept for back-compat)
        softCoral: "#FFEAF3",
        border: "#F7DBE9",
        borderStrong: "#F0C4DB",
        hairline: "#FBE9F1",
    },
    boy: {
        ...SHARED,
        primary: "#2F7BF6",
        primaryDark: "#1F66DB",
        accent: "#5B9DFF",
        accentStrong: "#2F7BF6",
        gradient: ["#2F7BF6", "#5B9DFF"],
        gradient3: ["#2F7BF6", "#5B9DFF", "#7CC0FF"],
        background: "#EEF4FF",
        surfaceAlt: "#F5F9FF",
        softGreen: "#E2ECFF",
        softCoral: "#EAF2FF",
        border: "#D9E4F6",
        borderStrong: "#C2D5F0",
        hairline: "#EAF1FB",
    },
    neutral: {
        ...SHARED,
        primary: "#5B6CFF",
        primaryDark: "#4A5AE8",
        accent: "#8A6BFF",
        accentStrong: "#5B6CFF",
        gradient: ["#5B6CFF", "#8A6BFF"],
        gradient3: ["#5B6CFF", "#8A6BFF", "#A06BFF"],
        background: "#F4F6FF",
        surfaceAlt: "#FAFBFF",
        softGreen: "#E7ECFF",
        softCoral: "#EEF0FF",
        border: "#E7E9F5",
        borderStrong: "#D5D8EE",
        hairline: "#F0F2FB",
    },
};

// Resolve a palette from a child's gender + optional manual override.
export function paletteFor(gender, override) {
    if (override === "boy" || override === "girl" || override === "neutral") {
        return PALETTES[override];
    }
    if (gender === "boy" || gender === "Male") return PALETTES.boy;
    if (gender === "girl" || gender === "Female") return PALETTES.girl;
    return PALETTES.neutral;
}

// Default (girl) palette — used by screens not yet migrated to useTheme().
export const colors = PALETTES.girl;

// 4-point spacing scale.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Corner radii (rounded, child-friendly). Use with borderCurve: "continuous".
export const radius = { sm: 10, md: 14, lg: 20, xl: 24, pill: 999 };

// Type scale.
export const type = {
    display: { fontSize: 27, fontWeight: "800", letterSpacing: -0.4 },
    title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.2 },
    heading: { fontSize: 17, fontWeight: "800", letterSpacing: -0.1 },
    body: { fontSize: 15, fontWeight: "500", lineHeight: 21 },
    bodyStrong: { fontSize: 15, fontWeight: "700", lineHeight: 21 },
    label: { fontSize: 13, fontWeight: "700" },
    caption: { fontSize: 12, fontWeight: "500", lineHeight: 16 },
};

// Neutral, theme-independent elevation (brand pop comes from gradients/color).
export const shadow = {
    card: { boxShadow: "0 2px 10px rgba(27,31,59,0.06)" },
    soft: { boxShadow: "0 4px 14px rgba(27,31,59,0.07)" },
    raised: { boxShadow: "0 10px 24px rgba(27,31,59,0.10)" },
    accent: { boxShadow: "0 10px 22px rgba(27,31,59,0.12)" },
    green: { boxShadow: "0 12px 26px rgba(27,31,59,0.12)" },
};

export const MIN_TOUCH = 44;

export default { colors, PALETTES, paletteFor, space, radius, type, shadow, MIN_TOUCH };
