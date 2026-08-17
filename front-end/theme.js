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
    // Darkened from #5C6873 when pageGradient went to a 22% tint. textMuted is
    // the LIGHTEST text that ever sits directly on the page background, so it
    // is the token that decides how strong the gradient may be: on the 22%
    // band the old value measured 4.14:1, under AA's 4.5. This measures 5.12:1
    // there and 7.06:1 on white (was 5.70), so it is strictly an improvement
    // everywhere else. Paired with pageGradient — read the note there first.
    textMuted: "#4E5A65",
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

// Page background gradient — the one place a child's gender colors the PAGE
// rather than an accent on it, so "whose record is this" is readable without
// reading anything.
//
// THE RULE, and it is not cosmetic: the LAST stop of every ramp is that
// scheme's own `background` token. Every rec* tint and every status color in
// this file was contrast-verified against a flat `background`, and page-level
// text — section headings, muted captions, anything not inside a white card —
// sits directly on it. The ramp is allowed to be strongly tinted at the top
// and to stay faintly tinted through the middle, but it must arrive back at
// the plain token by the foot of the page.
//
// Stops are the primary mixed over the page ground at 22% (top) and 10%
// (middle). 22% is DELIBERATELY past the safe ceiling for the old textMuted:
// at that strength #5C6873 measured 4.14:1 against the band, below AA's 4.5.
// The cost was paid once, on purpose, by darkening textMuted to #4E5A65
// (5.12:1) and its dark-scheme partner to #9EA9B2 (5.40:1). So:
//
//   DO NOT restore the old textMuted values while these stops stand, and do
//   not raise the tint past 22% without recomputing both. The two numbers are
//   a pair; changing one alone silently breaks contrast on every screen.
//
// Below 15% no muted-text change is needed at all (15% measures 4.60:1), which
// is the fallback if these ever need to be toned down.
//
// The three primaries are near-equal in luminance, so a flat 22% already reads
// at equal strength across palettes (girl matches boy at 22.5%, neutral at
// 21.5%) — no per-palette equalisation needed. Don't re-derive this.
//
// Explicit constants rather than a computed mix of `primary`: six values are
// easier to contrast-check, and easier to nudge, than a blending helper.
export const PALETTES = {
    girl: {
        ...SHARED,
        primary: "#C43D6E",
        primaryDark: "#9E2D57",
        accent: "#DD6E97",
        accentStrong: "#C43D6E",
        pageGradient: ["#F2D4DF", "#F9ECF1", "#F2F5F7"],
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
        pageGradient: ["#CCDEEE", "#E8F0F7", "#F2F5F7"],
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
        pageGradient: ["#DBD8EF", "#EFEDF8", "#F2F5F7"],
        primarySoft: "#E9E7F7",
        softGreen: "#E9E7F7",
        softCoral: "#E9E7F7",
    },
};

// --- dark-mode tokens shared by every palette ---
// Mirrors SHARED key-for-key. Status/record-type colors are brightened for
// contrast against a dark background, with a dark-tinted *Bg instead of a
// pale wash (a pale success/danger tint would glow against a near-black
// page). Structural surfaces ramp from near-black (background) up through
// two lighter steps (surface, surfaceAlt) the same way the light ramp goes
// down from white.
const SHARED_DARK = {
    onPrimary: "#FFFFFF",
    onAccent: "#FFFFFF",
    text: "#EDF1F4",
    textSecondary: "#B7C0C7",
    // Brightened from #8A949C, the dark-scheme half of the same trade: a tint
    // over a dark ground raises its luminance, which squeezes light text
    // instead of dark. Old value measured 4.19:1 on the 22% band; this is
    // 5.40:1 there and 6.99:1 on `surface` (was 5.42).
    textMuted: "#9EA9B2",
    placeholder: "#77828A",
    textOnDark: "#FFFFFF",
    textOnDarkMuted: "rgba(255,255,255,0.85)",

    background: "#12151A",
    surface: "#1A1E24",
    surfaceAlt: "#232830",
    hairline: "#2E3540",
    border: "#3A414C",
    borderStrong: "#4B5561",

    success: "#3DDBA0",
    successBg: "#123527",
    danger: "#F2677B",
    dangerBg: "#3A1620",
    warning: "#E8B34D",
    warningBg: "#3A2A0C",
    info: "#4FD6E8",
    infoBg: "#0F2E33",

    completed: "#3DDBA0",
    completedBg: "#123527",
    overdue: "#F2677B",
    overdueBg: "#3A1620",
    upcoming: "#E8B34D",
    upcomingBg: "#3A2A0C",
    shared: "#4FD6E8",
    sharedBg: "#0F2E33",

    recVaccine: { on: "#4FD9B8", bg: "#123328" },
    recCheckup: { on: "#6FB3F0", bg: "#122A3D" },
    recMedication: { on: "#B0A8F0", bg: "#231F3D" },
    recIllness: { on: "#F0977D", bg: "#3A2015" },
    recGrowth: { on: "#E8C36E", bg: "#332711" },
    recNutrition: { on: "#9BD98A", bg: "#1E3016" },
    recMemory: { on: "#E895C0", bg: "#3A1F2C" },
    recHospitalization: { on: "#F0839A", bg: "#3A1620" },

    tintGreen: "#123328",
    tintBlue: "#0F2E33",
    tintAmber: "#3A2A0C",
    tintTeal: "#0F2E33",
};

// Dark-mode brand palettes, keyed identically to PALETTES. `primaryDark` is
// semantically inverted here on purpose: in light mode it's a darker shade
// of `primary` used as text on the very pale `primarySoft` chip background;
// in dark mode `primarySoft` is a dark-tinted overlay instead, so the
// accessible text color on it is a LIGHTER shade of primary. Consumers keep
// reading `colors.primaryDark` unchanged — the token stays "the accessible
// text color for a primarySoft chip," it just resolves to a different
// direction depending on scheme.
export const DARK_PALETTES = {
    girl: {
        ...SHARED_DARK,
        primary: "#E8598C",
        primaryDark: "#F5B8CE",
        accent: "#F080A8",
        accentStrong: "#E8598C",
        // Same rule as the light ramps: last stop IS `background` (#12151A).
        // Tinting a DARK ground makes it lighter, so the contrast risk here is
        // the mirror of light mode's — it squeezes light text, not dark text.
        pageGradient: ["#412433", "#271C25", "#12151A"],
        primarySoft: "#33202A",
        softGreen: "#33202A",
        softCoral: "#33202A",
    },
    boy: {
        ...SHARED_DARK,
        primary: "#4B9FE0",
        primaryDark: "#B8DCF5",
        accent: "#7CBBED",
        accentStrong: "#4B9FE0",
        pageGradient: ["#1F3346", "#18232E", "#12151A"],
        primarySoft: "#1A2833",
        softGreen: "#1A2833",
        softCoral: "#1A2833",
    },
    neutral: {
        ...SHARED_DARK,
        primary: "#8B7FE8",
        primaryDark: "#D2CCF5",
        accent: "#A89EF0",
        accentStrong: "#8B7FE8",
        pageGradient: ["#2D2C47", "#1E202F", "#12151A"],
        primarySoft: "#241F38",
        softGreen: "#241F38",
        softCoral: "#241F38",
    },
};

// Resolve a palette from a child's gender + optional manual override, plus
// an optional color scheme ("light" | "dark", default "light" — every
// existing call site that omits it keeps working unchanged).
export function paletteFor(gender, override, scheme) {
    const palettes = scheme === "dark" ? DARK_PALETTES : PALETTES;
    if (override === "boy" || override === "girl" || override === "neutral") {
        return palettes[override];
    }
    if (gender === "boy" || gender === "Male") return palettes.boy;
    if (gender === "girl" || gender === "Female") return palettes.girl;
    return palettes.neutral;
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

// The narrowest a text column may get before a side-by-side row must stack
// into a column instead. Below this, real content stops fitting: a section
// title breaks mid-word ("Immunizati / on Records"), a two-up form row clips
// its labels, and a fact value ellipsizes away the part that mattered.
// Layouts compare against this rather than against a screen-width breakpoint,
// because what overflows is the *content's* width — which grows when the OS
// font scale is raised, and which a static breakpoint cannot see.
export const TEXT_COL_MIN = 150;

// Bottom clearance for a scrolling screen behind the app chrome.
//
// The tab bar is ~70pt tall and the floating "+" sits 92pt up from the bottom
// at 56pt across, and BOTH float over the scroll view rather than shortening
// it. Every screen previously ended its content 16pt from the bottom, so the
// last card on all five tab screens was unreachable underneath them.
//
// Screens add the device's own bottom inset on top of this (the home
// indicator / gesture bar) via useSafeAreaInsets.
export const SCREEN_PAD_BOTTOM = 96 + space.xxl;

// Collapsing header. The child's name is large while the page is at the top and
// shrinks as it scrolls, and the bar fades from the page gradient to opaque
// white over the same distance.
//
// The name is laid out ONCE at HEADER_TITLE_MAX and scaled down to
// HEADER_TITLE_MIN / HEADER_TITLE_MAX, rather than having its fontSize
// animated — animating fontSize re-lays out the text on every scroll frame and
// forces the animation off the native driver. Scale does neither.
//
// The ratio (0.667) is taken from the reference: a large title of ~28pt
// collapsing to ~17.5pt. The absolute sizes are a little larger here because
// this title sits beside three 44pt buttons and has to stay legible at the
// small end.
//
// HEADER_COLLAPSE is the scroll distance over which both happen. Short enough
// that a small flick completes it, long enough not to flicker on a rubber-band
// overscroll.
export const HEADER_TITLE_MAX = 30;
export const HEADER_TITLE_MIN = 20;
export const HEADER_COLLAPSE = 56;

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

export default {
    colors,
    PALETTES,
    DARK_PALETTES,
    paletteFor,
    space,
    radius,
    type,
    shadow,
    MIN_TOUCH,
    TEXT_COL_MIN,
    SCREEN_PAD_BOTTOM,
    HEADER_TITLE_MAX,
    HEADER_TITLE_MIN,
    HEADER_COLLAPSE,
    motion,
};
