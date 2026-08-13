// BabyBook+ design system — "Vital Signs".
//
// A calm instrument-panel palette: cool, precise neutrals with accent colors
// mapped 1:1 to real vital-sign conventions (pulse red, SpO2 teal, temperature
// amber), so status is legible at a glance the way a bedside monitor is. Full
// direction: Documents/plans/BabyBook+_Visual_Design_Direction.md §4.
//
// Colors are DYNAMIC: the app has a girl (magenta-pink) and boy (marine blue)
// palette that switch based on the selected child's gender, plus a neutral
// palette (muted violet) for pre-selection screens. Palettes are consumed at
// runtime through the ThemeProvider / useTheme() hook (see
// context/ThemeContext.js). Structural tokens — ink, status, record-type
// tints, elevation, spacing, radius, type, motion — are IDENTICAL across all
// three palettes; only `primary`/`primaryDark`/`accent`/`primarySoft` vary.
// This is deliberate: a document doesn't change color depending on whose
// record it is, only its accent ribbon does.
//
// The `colors` export below is the DEFAULT (girl) palette, kept so any screen
// not yet migrated to useTheme() still renders with a valid, consistent theme.

// --- tokens shared by every palette ---
const SHARED = {
    onPrimary: "#FFFFFF",
    onAccent: "#FFFFFF",
    text: "#16202A", // ink
    textSecondary: "#3D4A56",
    textMuted: "#5C6873",
    // Neutral placeholder gray: readable contrast on light inputs, clearly
    // subtler than entered text (colors.text) and muted labels (textMuted).
    placeholder: "#5E6971",
    // ponytail: deprecated aliases, remove once Cards.js's MemoryVisualCard
    // rewrite lands (Phase 2g) — they were text-on-photo-scrim colors for a
    // treatment the new MemoryVisualCard no longer uses.
    textOnDark: "#FFFFFF",
    textOnDarkMuted: "rgba(255,255,255,0.85)",

    // Page/surface ramp — promoted here from per-palette (was per-child
    // pastel before Vital Signs; a record's paper doesn't change color
    // depending on whose child it is, only the primary accent does).
    background: "#F2F5F7",
    surface: "#FFFFFF",
    surfaceAlt: "#E8EDF0",
    hairline: "#DCE3E7",
    border: "#CBD5DA",
    borderStrong: "#AFBCC3",

    // Status — "vitals". Every state has a matching *Bg tint now (the old
    // system left warning/info without one).
    success: "#0F7350",
    successBg: "#DCF3E9",
    danger: "#C22B3C",
    dangerBg: "#FBE2E5",
    warning: "#8C5A08",
    warningBg: "#F8E9D2",
    info: "#0E6E7C",
    infoBg: "#DBF0F1",

    // Domain aliases — named for the real-world concept at the call site
    // (an "overdue" vaccination and a "danger" toast are the same color for
    // a reason, but writing overdue at the vaccination row and danger at the
    // toast is how two screens drift into two different greens for the same
    // state, which is exactly what happened before this rewrite).
    completed: "#0F7350",
    completedBg: "#DCF3E9",
    overdue: "#C22B3C",
    overdueBg: "#FBE2E5",
    upcoming: "#8C5A08",
    upcomingBg: "#F8E9D2",
    shared: "#0E6E7C",
    sharedBg: "#DBF0F1",

    // Record-type tints — one per real record type, so five different kinds
    // of health record stop rendering with the same icon color. Each `on`
    // value is verified >=4.5:1 against its own `bg`, against `surface`, and
    // against `background` (see the design direction doc §5 for the
    // computed ratios), so these are safe as icon fills AND as chip text.
    recVaccine: { on: "#0B6B58", bg: "#DAEFE9" },
    recCheckup: { on: "#15588F", bg: "#DDEAF5" },
    recMedication: { on: "#544BA8", bg: "#E3E2F4" },
    recIllness: { on: "#A8412A", bg: "#F7E4DE" },
    recGrowth: { on: "#7C5A0E", bg: "#F4EBD8" },
    recNutrition: { on: "#38702F", bg: "#E2EEDD" },
    recMemory: { on: "#963A66", bg: "#F4E2EA" },
    recHospitalization: { on: "#94293A", bg: "#F4E0E3" },

    // ponytail: deprecated aliases for the old 8-tint module system (4 of
    // its names — tintCoral/tintViolet/tintPink/tintIndigo — had zero
    // consumers and were deleted outright; these 4 still had real call
    // sites at rewrite time and were remapped rather than broken). New code
    // should reach for a rec* tint or a status *Bg directly.
    tintGreen: "#DAEFE9", // = recVaccine.bg
    tintBlue: "#DBF0F1", // = infoBg
    tintAmber: "#F8E9D2", // = warningBg
    tintTeal: "#DBF0F1", // = infoBg
};

export const PALETTES = {
    girl: {
        ...SHARED,
        primary: "#C43D6E",
        primaryDark: "#9E2D57",
        accent: "#DD6E97",
        accentStrong: "#C43D6E",
        // ponytail: deprecated aliases (softGreen/softCoral collapsed into
        // one primarySoft — they were two near-identical tints doing the
        // same "selected/active" job everywhere but 2 alert-context sites,
        // which now use dangerBg instead). Remove once Phase 2's call-site
        // remap is complete.
        primarySoft: "#F9E9EF",
        softGreen: "#F9E9EF",
        softCoral: "#F9E9EF",
    },
    boy: {
        ...SHARED,
        primary: "#1768B3",
        primaryDark: "#0F4F8C",
        accent: "#4A93D6",
        accentStrong: "#1768B3",
        primarySoft: "#E4EEF8",
        softGreen: "#E4EEF8",
        softCoral: "#E4EEF8",
    },
    neutral: {
        ...SHARED,
        primary: "#5A4FB8",
        primaryDark: "#423699",
        accent: "#8478D6",
        accentStrong: "#5A4FB8",
        primarySoft: "#E9E7F7",
        softGreen: "#E9E7F7",
        softCoral: "#E9E7F7",
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

// Type scale — Archivo for display/title/heading (instrument-panel numeral
// character), Public Sans for everything else (the U.S. government's own
// open-source civic typeface — chosen because "trustworthy and legible" is a
// literal requirement here, not a mood). `fontFamily` names are the exact
// @expo-google-fonts export keys loaded in App.js. Body sits at 16 so mobile
// browsers don't auto-zoom on input focus; caption is the 13px floor — no
// text anywhere goes smaller. fontWeight travels alongside fontFamily
// because web needs the numeric weight and native needs the family name for
// the right glyphs; keeping them in agreement means neither platform
// synthesizes a weight it wasn't given.
export const type = {
    display: { fontFamily: "Archivo_700Bold", fontSize: 32, fontWeight: "700", lineHeight: 36, letterSpacing: -0.4 },
    title: { fontFamily: "Archivo_700Bold", fontSize: 23, fontWeight: "700", lineHeight: 28, letterSpacing: -0.2 },
    heading: { fontFamily: "Archivo_600SemiBold", fontSize: 18, fontWeight: "600", lineHeight: 23 },
    subheading: {
        fontFamily: "PublicSans_700Bold",
        fontSize: 14,
        fontWeight: "700",
        lineHeight: 18,
        letterSpacing: 0.4,
        textTransform: "uppercase",
    },
    body: { fontFamily: "PublicSans_400Regular", fontSize: 16, fontWeight: "400", lineHeight: 24 },
    bodyStrong: { fontFamily: "PublicSans_600SemiBold", fontSize: 16, fontWeight: "600", lineHeight: 24 },
    label: { fontFamily: "PublicSans_600SemiBold", fontSize: 14, fontWeight: "600", lineHeight: 18 },
    caption: { fontFamily: "PublicSans_500Medium", fontSize: 13, fontWeight: "500", lineHeight: 17 },
};

// Elevation. Cool ink tint (rgba(22,32,42,…)) rather than the old cold
// blue-black — theme-independent, brand pop comes from `primary`/`accent`,
// not from shadow color. Level 3 ("active") is a function, not a static
// object: a colored glow parameterized by whichever status color applies
// (e.g. shadow.active(colors.shared) on a card showing an active QR share) —
// the monitor's active-lead highlight, reserved for genuine live states.
export const shadow = {
    card: { boxShadow: "0 2px 8px rgba(22,32,42,0.07)" },
    // ponytail: deprecated alias (soft collapsed into card; its 2 remaining
    // consumers are re-themed in Phase 2). Remove after Phase 2.
    soft: { boxShadow: "0 2px 8px rgba(22,32,42,0.07)" },
    raised: { boxShadow: "0 10px 24px rgba(22,32,42,0.12)" },
    // ponytail: deprecated alias (accent collapsed into raised).
    accent: { boxShadow: "0 10px 24px rgba(22,32,42,0.12)" },
    active: (c) => ({ boxShadow: `0 0 0 1px ${c}33, 0 8px 20px ${c}22` }),
};

export const MIN_TOUCH = 44;

// Motion vocabulary. Durations + bezier tuples rather than RN `Easing`
// objects, so this file stays import-free — consumers call
// Easing.bezier(...motion.standard.bezier); the files that need it already
// import Easing. `pulse` is the one "ceremony" token: a live status change
// (a share going active, a record marked complete) gets two scale cycles,
// literally a heartbeat — never used for routine navigation.
export const motion = {
    micro: { duration: 120, bezier: [0, 0, 0.2, 1] },
    standard: { duration: 220, bezier: [0.4, 0, 0.2, 1] },
    entrance: { duration: 320, bezier: [0, 0, 0.2, 1] },
    pulse: { duration: 400, cycles: 2, scale: 1.04, bezier: [0.4, 0, 0.6, 1] },
};

export default { colors, PALETTES, paletteFor, space, radius, type, shadow, MIN_TOUCH, motion };
