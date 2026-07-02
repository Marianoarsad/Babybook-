// BabyBook+ design system — a single source of truth for colors, typography,
// spacing, radii and elevation. Import this everywhere instead of hard-coding
// values, so the whole app stays consistent and accessible.
//
// Accessibility notes baked in:
//  - Body/label text colors meet WCAG AA on white/cream (>= 4.5:1).
//  - Minimum readable sizes: never below 12 for essential text.
//  - MIN_TOUCH is the minimum tap target (use hitSlop for smaller visuals).

export const colors = {
    // Brand
    primary: "#456155", // deep green — white text = ~7:1 contrast (AAA)
    primaryDark: "#33493F",
    onPrimary: "#FFFFFF",
    accent: "#FF8A7A", // coral — decorative use (icons, highlights, chips)
    accentStrong: "#E4614C", // use when text/contrast on coral is required
    onAccent: "#FFFFFF",

    // Text (all AA-compliant on light surfaces)
    text: "#1C1917", // near-black — titles & primary content
    textSecondary: "#57534E", // ~7:1 — body & subtitles
    textMuted: "#6B6560", // ~5.3:1 — captions/labels (replaces old #A8A29E which FAILED)
    textOnDark: "#FFFFFF",
    textOnDarkMuted: "#CFE0D6",

    // Surfaces
    background: "#FFFDF9", // warm cream app background
    surface: "#FFFFFF",
    surfaceAlt: "#F5F5F4",
    softGreen: "#EAF0EC",
    softCoral: "#FFEFEC",
    border: "#ECE9E4",
    borderStrong: "#D6D3D1",
    hairline: "#F1EEE9", // barely-there separators for a lighter, modern card look

    // Soft icon-tile tints (AA with the dark icon/text colors above).
    tintGreen: "#E4EFE7",
    tintCoral: "#FFE7E1",
    tintBlue: "#E3EEFB",
    tintAmber: "#FBEFD9",
    tintViolet: "#EDE7FA",

    // Status
    success: "#15803D",
    successBg: "#DCFCE7",
    danger: "#B91C1C",
    dangerBg: "#FEE2E2",
    warning: "#B45309",
    info: "#1D4ED8",
};

// 4-point spacing scale — use gap/padding from this only.
export const space = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
};

// Corner radii. Use with { borderCurve: "continuous" } for smooth corners.
export const radius = {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    pill: 999,
};

// Type scale. Minimum 12 for anything users must read; 15 for body.
export const type = {
    display: { fontSize: 27, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
    title: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
    heading: { fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.1 },
    body: { fontSize: 15, fontWeight: "500", color: colors.textSecondary, lineHeight: 21 },
    bodyStrong: { fontSize: 15, fontWeight: "700", color: colors.text, lineHeight: 21 },
    label: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    caption: { fontSize: 12, fontWeight: "500", color: colors.textMuted, lineHeight: 16 },
};

// Modern elevation via CSS boxShadow (never legacy shadow*/elevation props).
export const shadow = {
    // Soft, layered, diffuse elevation for a modern feel (never harsh borders).
    card: { boxShadow: "0 2px 10px rgba(45,55,72,0.06)" },
    soft: { boxShadow: "0 4px 14px rgba(45,55,72,0.07)" },
    raised: { boxShadow: "0 10px 24px rgba(45,55,72,0.10)" },
    accent: { boxShadow: "0 10px 22px rgba(228,97,76,0.22)" },
    green: { boxShadow: "0 12px 26px rgba(69,97,85,0.22)" },
};

// Minimum accessible tap target (px).
export const MIN_TOUCH = 44;

export default { colors, space, radius, type, shadow, MIN_TOUCH };
