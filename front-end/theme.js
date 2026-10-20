// BabyBook+ design system — "Vital Signs".
//
// A calm instrument-panel palette: cool, precise neutrals with accent colors
// mapped 1:1 to real vital-sign conventions (pulse red, SpO2 teal, temperature
// amber), so status is legible at a glance the way a bedside monitor is. Full
// direction: Documents/plans/BabyBook+_Visual_Design_Direction.md §4.
//
// Colors are DYNAMIC: the app has a girl (magenta-pink) and boy (marine blue)
// palette that switch based on the selected child's gender, plus a neutral
// palette using official Boy blue for pre-selection screens. Palettes are consumed at
// runtime through the ThemeProvider / useTheme() hook (see
// context/ThemeContext.js). Structural tokens — ink, status, record-type
// tints, elevation, spacing, radius, type, motion — are IDENTICAL across all
// theme modes; only the brand ramp and values derived from it vary.
// This is deliberate: a document doesn't change color depending on whose
// record it is, only its accent ribbon does.
//
// The `colors` export below is the DEFAULT (official blue) palette, kept so any screen
// not yet migrated to useTheme() still renders with a valid, consistent theme.

// --- tokens shared by every palette ---
// The database spinner keeps these exact Boy/Girl shades in every scheme.
export const databaseLoaderColors = Object.freeze({ boy: "#5B9DFF", girl: "#FF7EB3" });

const NUTRITION_ARTWORK = {
    blue: ["#8ED4FF", "#3694FF", "#1F66DB"],
    blueShade: "#345DC8",
    milkBackground: ["#FFFFFF", "#E6F1FF", "#D1E3FF"],
    "white": [
        "#FFFFFF",
        "#F2F5FC",
        "#CDD8E8"
    ],
    "pink": [
        "#FFA6D0",
        "#EB78AF",
        "#C72F7C"
    ],
    "green": [
        "#6EE7B7",
        "#10B981",
        "#047857"
    ],
    "cream": [
        "#FFFBE7",
        "#F5E6B8"
    ],
    "reflection": "#FFFFFF",
    "shade": "#175F53",
    "mint": [
        "#E7FFF3",
        "#BFEFE2"
    ],
    "rose": [
        "#FFF2FA",
        "#F8D3E9"
    ]
};

const SHARED = {
    activeShareSurface: {
        surface: ["#EDF4FA", "#F7FBFF"],
        topShade: ["rgba(91,113,137,0.16)", "rgba(91,113,137,0)"],
        leftShade: ["rgba(91,113,137,0.10)", "rgba(91,113,137,0)"],
        highlight: ["rgba(255,255,255,0.85)", "rgba(255,255,255,0)"],
    },
    developmentChecklist: {
        checked: ["#5B9DFF", "#2375ED", "#1F66DB"], onChecked: "#FFFFFF", recorded: "#087D63",
        track: "#DCE9FA", trackShade: "rgba(74,108,180,0.16)",
        guidance: ["#F1FCFF", "#E8F7FC", "#DDF0F8"],
        categoryArt: {
            social: { surface: ["#FFF8FC", "#FFE1EE"], art: ["#FFA7CC", "#EC4C89", "#B91B57"] },
            language: { surface: ["#F1FAFF", "#CCE8FF"], art: ["#8AD5FF", "#2F7BF6", "#1F66DB"] },
            cognitive: { surface: ["#FFFDF0", "#FFF3BE"], art: ["#FFE98A", "#FACC15", "#D49B00"] },
            motor: { surface: ["#F0FFF9", "#C9F7E9"], art: ["#7AE7C8", "#16B992", "#087D63"] },
        },
    },
    globalFabGlass: {
        surface: ["#0665E8", "#1678ED", "#258EFF"], opacity: [0.97, 0.9, 0.86], depth: "#0754C7",
        light: "#5B9DFF", cyan: "#7ED5FF", reflection: "#E6F9FF", tint: "rgba(220,237,255,0.08)",
        focus: "#1F66DB", shadow: "0 6px 16px rgba(36,108,205,0.20)",
    },
    shareSurface: {
        background: ["#DDEEFF", "#EAF5FF", "#F5FAFF"], panel: ["#FFFFFF", "#F5FAFF", "#EAF3FF"],
        control: ["#FFFFFF", "#EDF6FF", "#DEEEFF"], methodActive: ["#E0F5FF", "#CDE8FF", "#B9DAFF"],
        info: ["#EAF7FF", "#DDEFFF", "#D2EDFF"], cta: ["#2371E7", "#1261DA", "#064FC3"], onCta: "#FFFFFF",
        text: "#101B56", secondary: "#526888", azure: "#1F66DB", highlight: "rgba(255,255,255,0.95)",
        panelShadow: "0 8px 26px rgba(76,110,185,0.16), -1px -2px 5px rgba(255,255,255,0.85)",
        iconShadow: "0 4px 12px rgba(76,110,185,0.14)", ctaShadow: "0 7px 18px rgba(31,102,219,0.22)",
        tiles: {
            profile: ["#FFFFFF", "#EFF9FF", "#DFF2FF"], vaccinations: ["#FFFFFF", "#EFFFFA", "#DDF8F0"],
            allergies: ["#FFFFFF", "#FFF2FC", "#F7E4F7"], growth: ["#FFFFFF", "#FFFAEF", "#FFF2D9"],
            milestones: ["#FFFFFF", "#F6F2FF", "#EBE4FF"], checkups: ["#FFFFFF", "#EFF8FF", "#DEEEFF"],
            nutrition: ["#FFFFFF", "#F0FFF9", "#DDF8EE"], medicalHistory: ["#FFFFFF", "#FFF2FB", "#F8E4F5"],
        },
    },
    searchSurface: {
        background: ["#DDEEFF", "#EAF5FF", "#F5FAFF"], surface: ["#FFFFFF", "#F3F9FF", "#EAF4FF"],
        text: "#101B56", secondary: "#526888", azure: "#1F66DB", mutedIcon: "#6578B2", highlight: "rgba(255,255,255,0.95)",
        shadow: "0 7px 22px rgba(79,119,194,0.16), -1px -2px 4px rgba(255,255,255,0.85)",
        rowShadow: "0 6px 18px rgba(78,112,186,0.14), -1px -2px 4px rgba(255,255,255,0.85)",
        categories: {
            vaccines: { surface: ["#FFFFFF", "#F1F9FF", "#DFF3FF"], ink: "#1F66DB" },
            conditions: { surface: ["#FFFFFF", "#FFF3F5", "#FCE5EE"], ink: "#D53250" },
            milestones: { surface: ["#FFFFFF", "#FFF9EF", "#FFF0DC"], ink: "#A96809" },
            calendar: { surface: ["#FFFFFF", "#F0FFFF", "#DDF7F8"], ink: "#00828A" },
            checkups: { surface: ["#FFFFFF", "#F1F8FF", "#DEEDFF"], ink: "#1F66DB" },
            medication: { surface: ["#FFFFFF", "#F6F1FF", "#EDE3FF"], ink: "#7541C8" },
            memories: { surface: ["#FFFFFF", "#FFF3FA", "#FBE3F2"], ink: "#C52184" },
        },
    },
    conditionArtwork: { purple: ["#C4B5FD", "#8B5CF6", "#6D28D9"], hereditaryActive: ["#F5EEFF", "#E8D9FF", "#DAC4FF"], reflection: "#FFFFFF" },
    hospitalStayIcon: {
        background: ["#FFFFFF", "#FFF0F6", "#FFE4EC"], body: ["#FB7185", "#F43F5E", "#E11D48"],
        emptyBuilding: ["#D9E9FF", "#A9C7FF", "#8495EC"],
        shade: "#BE123C", highlight: "#FFFFFF", shadow: "rgba(225,29,72,0.18)",
    },
    appointmentDashboard: {
        panel: ["#FFFFFF", "#F5FAFF", "#EAF3FF"], row: ["#FFFFFF", "#F4F9FF", "#EBF4FF"],
        control: ["#FFFFFF", "#ECF6FF", "#D9ECFF"], highlight: "rgba(255,255,255,0.95)", reflection: "#FFFFFF",
        text: "#101B56", secondary: "#526888", azure: "#1F66DB", chevron: "#5973C7", divider: "#DCE8F8",
        panelShadow: "0 9px 26px rgba(76,109,180,0.17), 0 2px 6px rgba(76,109,180,0.07)",
        rowShadow: "0 6px 16px rgba(80,115,190,0.16), 0 2px 5px rgba(80,115,190,0.06)",
        activeShadow: "0 7px 17px rgba(70,111,182,0.22), -1px -2px 4px rgba(255,255,255,0.9)",
        pressedShadow: "0 2px 5px rgba(80,115,190,0.12)",
        headerIcon: { surface: ["#FAF5FF", "#E5D8FF"], art: ["#D3B0FF", "#9855F4", "#6A2BCB"] },
        all: { surface: ["#FFFFFF", "#F2F8FF", "#E0F0FF"], active: ["#F5FAFF", "#E4F1FF", "#CDE5FF"],
            art: ["#90D2FF", "#2F7BF6", "#1F66DB"], ink: "#1D59BE" },
        completed: { surface: ["#FFFFFF", "#F0FFFA", "#D9FAF0"], active: ["#F1FFF9", "#DFF9EE", "#C1F3E1"],
            art: ["#72EFD1", "#10B99E", "#047B70"], ink: "#066B5A" },
        upcoming: { surface: ["#FFFFFF", "#FFF9F0", "#FFEBD8"], active: ["#FFFBF4", "#FFF0DD", "#FFDCB5"],
            art: ["#FFD58B", "#FF9B23", "#D76A06"], ink: "#9C4A06" },
        overdue: { surface: ["#FFFFFF", "#FFF4F8", "#FCE4F0"], active: ["#FFF6FA", "#FDE6F1", "#F8CFE3"],
            art: ["#FF9FCB", "#EF3989", "#C91460"], ink: "#B61A53" },
    },
    feedingBreakdown: {
        panel: ["#FFFFFF", "#F4FAFF", "#EAF3FF"], row: ["#FFFFFF", "#F7FBFF", "#EAF3FF"],
        control: ["#FFFFFF", "#EAF5FF", "#D7EBFF"], center: ["#FFFFFF", "#F1F9FF", "#DDEEFF"],
        entries: ["#FFFFFF", "#F5F1FF", "#EDE8FF"], milk: ["#FFFFFF", "#F0F7FF", "#E0EEFF"],
        solid: ["#FFFFFF", "#F0FFF8", "#DDF8ED"], time: ["#FFFFFF", "#FFF2F8", "#FCE5F0"],
        ringMilk: ["#5B9DFF", "#2F7BF6", "#1F66DB"], ringSolid: ["#6EE7B7", "#10B981", "#059669"],
        track: "#DEEBFA", text: "#101449", secondary: "#52638F", azure: "#1F66DB", mint: "#047857", lavender: "#7541C8",
        highlight: "rgba(255,255,255,0.95)", reflection: "#FFFFFF", clearReflection: "rgba(255,255,255,0)", labelBacking: "#101B56",
        panelShadow: "0 10px 28px rgba(66,105,176,0.16), 0 3px 8px rgba(66,105,176,0.06)",
        itemShadow: "0 6px 15px rgba(66,105,176,0.15), 0 2px 5px rgba(66,105,176,0.05)",
        pressedShadow: "0 2px 5px rgba(66,105,176,0.10)", ringShade: "#8EAFDF",
    },
    milkTypeDashboard: {
        panel: ["#FFFFFF", "#F5FAFF", "#EAF3FF"], row: ["#FFFFFF", "#F5FAFF", "#EAF4FF"],
        panelShadow: "0 10px 28px rgba(75,110,185,0.18), 0 3px 8px rgba(75,110,185,0.07)",
        chartShadow: "0 8px 24px rgba(75,110,185,0.16), 0 2px 6px rgba(75,110,185,0.06)",
        rowShadow: "0 7px 18px rgba(75,110,185,0.18), 0 2px 5px rgba(75,110,185,0.07)",
        iconShadow: "0 4px 12px rgba(75,110,185,0.16)",
        scrim: "rgba(22,32,66,0.28)",
    },
    solidFoodDashboard: {
        panelShadow: "0 10px 28px rgba(74,109,184,0.19), -2px -3px 8px rgba(255,255,255,0.85)",
        chartShadow: "0 8px 24px rgba(74,109,184,0.17), -1px -2px 5px rgba(255,255,255,0.9)",
        rowShadow: "0 7px 18px rgba(74,109,184,0.18), -1px -2px 4px rgba(255,255,255,0.85)",
    },
    milkType: {
        Breastmilk: { surface: ["#FFFFFF", "#EFF8FF", "#DDEFFF"], segment: ["#90CAF9", "#42A5F5", "#1E88E5"], ink: "#1D59BE", shadow: "0 6px 16px rgba(66,165,245,0.17)" },
        Formula: { surface: ["#FFFFFF", "#FFF2F8", "#FCE0EE"], segment: ["#F9A8D4", "#F472B6", "#DB2777"], ink: "#A32767", shadow: "0 6px 16px rgba(244,114,182,0.17)" },
        Mixed: { surface: ["#FFFFFF", "#F6F0FF", "#EBDDFF"], segment: ["#C4B5FD", "#A78BFA", "#8B5CF6"], ink: "#6940AE", shadow: "0 6px 16px rgba(167,139,250,0.18)" },
    },
    solidFoodCategories: {
        fruits: { surface: ["#FFFFFF", "#F0FFF5", "#DCF8E5"], segment: ["#BBF7D0", "#4ADE80", "#22C55E"], ink: "#166534", shadow: "0 8px 20px rgba(34,197,94,0.18)" },
        vegetables: { surface: ["#FFFFFF", "#FFF6ED", "#FDE9D5"], segment: ["#FED7AA", "#FB923C", "#EA580C"], ink: "#9A3412", shadow: "0 8px 20px rgba(251,146,60,0.18)" },
        grains: { surface: ["#FFFFFF", "#EFF7FF", "#DCEEFF"], segment: ["#BFDBFE", "#3B82F6", "#2563EB"], ink: "#1E40AF", shadow: "0 8px 20px rgba(59,130,246,0.18)", art: ["#FDE68A", "#FBBF24", "#D97706"] },
        proteins: { surface: ["#FFFFFF", "#F7F0FF", "#EBDDFF"], segment: ["#DDD6FE", "#A78BFA", "#8B5CF6"], ink: "#6B21A8", shadow: "0 8px 20px rgba(167,139,250,0.19)", art: ["#FDA4AF", "#FB7185", "#E11D48"] },
        dairy: { surface: ["#FFFFFF", "#FFF2F8", "#FCE0EE"], segment: ["#FBCFE8", "#F472B6", "#DB2777"], ink: "#9D174D", shadow: "0 8px 20px rgba(244,114,182,0.18)", art: ["#DBEAFE", "#93C5FD", "#3B82F6"] },
        other: { surface: ["#FFFFFF", "#F2F6FC", "#E3EBF5"], segment: ["#CBD5E1", "#94A3B8", "#7D90AC"], ink: "#475569", shadow: "0 8px 20px rgba(100,116,139,0.18)" },
    },
    immunizationMetrics: {
        dueSoon: { surface: ["#FFFFFF", "#FFFBEF", "#FFF0C2"], active: ["#FFFBEF", "#FFF2CD", "#FFE6A1"],
            art: ["#FFD977", "#F59E0B", "#D97706"], ink: "#925206" },
        overdue: { surface: ["#FFFFFF", "#FFF4F6", "#FFDDE5"], active: ["#FFF4F6", "#FFE2E9", "#FFCBD7"],
            art: ["#FB7185", "#F43F5E", "#E11D48"], ink: "#B6163D" },
    },
    vaccineIcon: { background: ["#EFFEF8", "#D2FAED", "#A9F5DF"], highlight: "rgba(255,255,255,0.95)", shadow: "0 3px 8px rgba(55,161,133,0.16)" },
    attentionSurface: {
        panel: ["#FFFFFF", "#F5FAFF", "#EAF3FF"], topTint: ["rgba(251,113,133,0.10)", "rgba(251,113,133,0.04)", "rgba(251,113,133,0)"],
        row: ["#FFFFFF", "#F4F9FF", "#EAF4FF"], control: ["#FFFFFF", "#FFF0F6", "#FCE1EF"], navigation: ["#FFFFFF", "#E9F4FF", "#D9ECFF"],
        count: ["#DC2D54", "#C91643", "#A90E36"], symbol: ["#FB7185", "#E11D48", "#BE123C"], onCount: "#FFFFFF", reflection: "#FFFFFF",
        text: "#101B56", title: "#BE123C", overdue: "#C51242", chevron: "#5973C7", focus: "#1F66DB", divider: "#D7E5F8",
        highlight: "rgba(255,255,255,0.95)", panelShadow: "0 10px 26px rgba(72,112,184,0.18), 0 3px 8px rgba(72,112,184,0.07)",
        rowShadow: "0 8px 18px rgba(75,116,190,0.18), 0 2px 5px rgba(75,116,190,0.06)",
        controlShadow: "0 5px 11px rgba(216,75,128,0.18)", countShadow: "0 4px 9px rgba(190,18,60,0.22)",
        navigationShadow: "0 4px 10px rgba(75,116,190,0.18)", pressedShadow: "0 2px 5px rgba(91,117,185,0.10)",
    },
    profileSurface: {
        panel: ["#FFFFFF", "#F5F9FF", "#EAF3FF"], surface: ["#FFFFFF", "#F7FAFF", "#EDF5FF"],
        lavender: ["#FCFAFF", "#F3EDFF", "#EBE2FC"],
        lavenderItem: ["#FFFFFF", "#F4EEFF", "#ECE3FC"], mintItem: ["#FFFFFF", "#F0FCF5", "#E4F8EC"],
        mint: ["#F4FFF8", "#E8FBF0", "#DAF8E7"], warm: ["#FFF9EC", "#FFF2D9", "#FCEACB"], edit: ["#FFFFFF", "#E7F2FF", "#CFE5FF"],
        icon: { blue: ["#EDF7FF", "#CFE7FF"], mint: ["#F0FFF5", "#CFF6DF"], gold: ["#FFF9E7", "#FCE7B7"], lavender: ["#F7EEFF", "#E5D4FF"], pink: ["#FFF1F9", "#FAD6EC"] },
        glyph: { blue: "#1F66DB", mint: "#047857", gold: "#9B6412", lavender: "#7541C8", pink: "#C52184" },
        text: "#101449", secondary: "#52638F", muted: "#596780", accent: "#1F66DB", divider: "#DCE5F7", avatarRing: "#FFFFFF",
        highlight: "rgba(255,255,255,0.95)",
        panelShadow: "0 12px 28px rgba(85,104,177,0.18), 0 4px 10px rgba(85,104,177,0.07)",
        itemShadow: "0 8px 18px rgba(85,104,177,0.15), 0 2px 6px rgba(85,104,177,0.06)",
        mintShadow: "0 7px 16px rgba(61,153,108,0.12), 0 2px 5px rgba(85,104,177,0.04)",
        warmShadow: "0 7px 16px rgba(174,137,71,0.13)", iconShadow: "0 3px 8px rgba(85,104,177,0.15)",
        pressedShadow: "0 2px 5px rgba(85,104,177,0.10)",
    },
    feedingToday: {
        panel: ["#FFFFFF", "#F7FAFF", "#F1F3FF"],
        milk: ["#FAFBFF", "#E5EEFF"], solid: ["#F2FFFA", "#DDF9F1"],
        volume: ["#F1FBFF", "#E0F3FF"], breast: ["#F6F4FF", "#E9E7FF"],
        icon: ["#FFFFFF", "#E8EFFF"], mintIcon: ["#F4FFF9", "#D2F5E9"],
        time: ["#F3F5FF", "#E4EAFF"], divider: "#DCE3FA", text: "#101449", secondary: "#52638F", accent: "#1F66DB",
        highlight: "rgba(255,255,255,0.95)",
        panelShadow: "0 10px 26px rgba(85,104,177,0.14), 0 3px 8px rgba(85,104,177,0.05)",
        tileShadow: "0 7px 16px rgba(85,104,177,0.14), 0 2px 5px rgba(85,104,177,0.05)",
        iconShadow: "0 4px 9px rgba(85,104,177,0.14)",
    },
    plansDashboard: {
        content: ["#FFFFFF", "#FBFCFF", "#F3F5FF"], active: ["#2674E7", "#1264DB", "#1851BC"],
        panelShadow: "0 8px 24px rgba(92,109,180,0.14)", contentShadow: "0 7px 18px rgba(92,109,180,0.12)",
        activeBadge: "rgba(255,255,255,0.18)",
        upcoming: { surface: ["#FCFAFF", "#E9E4FF"], ink: "#6265A8", art: ["#A4A5FF", "#6669C7", "#444B9E"] },
        overdue: { surface: ["#FFF5FA", "#FADCEB"], ink: "#B81758", art: ["#FA81B2", "#DE347D", "#B81758"] },
        completed: { surface: ["#F8F9FF", "#E6E9FA"], ink: "#52618D", art: ["#B5C1F0", "#7385C3", "#4C5E99"] },
        artwork: { board: ["#C1E5FF", "#809BFF", "#7371E8"], clip: ["#C7BFFF", "#9985FF", "#7564E8"],
            heart: ["#EED4FF", "#CA9BFA", "#B47AE8"], paper: ["#FFFFFF", "#EDF3FF"],
            line: "#D1DEF8", reflection: "#FFFFFF", shadow: "rgba(109,103,200,0.14)" },
    },
    calendarSurface: {
        panel: ["#FFFFFF", "#F5F6FF"], day: ["#FFFFFF", "#F2F5FF"],
        control: ["#FFFFFF", "#EEEEFF"], icon: ["#FFFFFF", "#EAF2FF"],
        active: ["#5B9DFF", "#1F66DB", "#1851BC"], onActive: "#FFFFFF",
        text: "#101449", secondary: "#616D9D", muted: "#A7B1D1", focus: "#1F66DB",
        highlight: "rgba(255,255,255,0.95)", shade: "rgba(93,112,181,0.04)", markerBacking: "rgba(255,255,255,0.85)",
        panelShadow: "0 8px 24px rgba(94,112,181,0.15), 0 2px 6px rgba(94,112,181,0.05)",
        dayShadow: "0 4px 9px rgba(94,112,181,0.12), -1px -1px 3px rgba(255,255,255,0.8)",
        controlShadow: "0 5px 12px rgba(94,112,181,0.16), -1px -2px 4px rgba(255,255,255,0.8)",
        activeShadow: "0 5px 10px rgba(31,102,219,0.24)", pressedShadow: "0 2px 4px rgba(94,112,181,0.12)",
    },
    nutritionArtwork: NUTRITION_ARTWORK,
    nutritionSurface: {
    "panel": [
        "#FFFFFF",
        "#F6F7FF"
    ],
    "card": [
        "#FFFFFF",
        "#F3F7FF"
    ],
    "control": [
        "#FFFFFF",
        "#F5F4FF"
    ],
    "filter": [
        "#FFF5FB",
        "#FCE0F0"
    ],
    "highlight": "rgba(255,255,255,0.95)",
    "panelShadow": "0 6px 22px rgba(90,105,175,0.10)",
    "cardShadow": "0 8px 20px rgba(90,105,175,0.13)",
    "controlShadow": "0 4px 12px rgba(119,91,166,0.14)",
    "bar": [
        "#F7A6D0",
        "#EB78AF"
    ],
    "latestBar": [
        "#EB78AF",
        "#C72F7C"
    ],
    "series": "#D93E8D",
    "histogramAccent": "#D93E8D",
    "grid": "#DFE5F3",
    "axis": "#596D9E"
},
    recordItem: { surface: ["#FFFFFF", "#F1F5FF"], highlight: "rgba(255,255,255,0.95)", shadow: "0 7px 14px rgba(89,111,180,0.16), 0 2px 5px rgba(89,111,180,0.07)" },
    growthIcon: { background: ["#ECFFF4", "#DDFBEA"], shadow: "inset 0 1px 2px rgba(255,255,255,0.9), 0 2px 6px rgba(5,150,105,0.07)" },
    growthHistory: {
        panel: ["#FFFFFF", "#F7F5FF"], item: ["#FFFFFF", "#FBFCFF", "#F1F5FF"],
        highlight: "rgba(255,255,255,0.95)", title: "#101C42", secondary: "#5B6C89", chevron: "#8194BC",
        panelShadow: "0 6px 18px rgba(89,111,180,0.09)", itemShadow: "0 7px 14px rgba(89,111,180,0.16), 0 2px 5px rgba(89,111,180,0.07), -1px -2px 6px rgba(255,255,255,0.7)",
        more: ["#FFF4FA", "#FCE4F1"], moreText: "#B5106A", moreShadow: "0 7px 14px rgba(219,22,134,0.14), 0 2px 5px rgba(219,22,134,0.05)",
    },
    medicationIcon: {
        purple: { body: ["#C4B5FD", "#8B5CF6", "#6D28D9"], background: ["#F8F2FF", "#E4D4FF"], shade: "#6D28D9" },
        green: { body: ["#6EE7B7", "#10B981", "#059669"], background: ["#EEFFF7", "#CBF5E5"], shade: "#059669" },
        white: ["#FFFFFF", "#F3F5FF", "#DADFF3"], reflection: "#FFFFFF",
    },
    medicineSurface: {
        section: ["#FFFFFF", "#F8FBFF", "#EDF6FF"], item: ["#FFFFFF", "#F6FAFF", "#EEF6FF"],
        highlight: "rgba(255,255,255,0.85)", shadow: "0 12px 28px rgba(53,105,173,0.15), 0 4px 10px rgba(53,105,173,0.06)", itemShadow: "0 8px 20px rgba(65,112,179,0.12), 0 3px 8px rgba(65,112,179,0.05)", banner: ["#E2F5FC", "#DDF1FF"], info: ["#65DEEF", "#00A4CC"],
        track: "#DCE6F6", progress: ["#A78BFA", "#8B5CF6", "#7C3AED"], badge: "#DDFBF0", badgeGradient: ["#E9FFF5", "#DDFBF0"], badgeText: "#047857",
    },

    // Growth-only metric lines keep 3:1 contrast on their pastel surfaces and area fills.
    growthSurface: {
        panel: ["#FFFFFF","#F2F8FF"],
        section: ["#FFFFFF","#F0F8FF"],
        control: ["#FFFFFF","#EAF3FF"],
        series: "#2F7BF6",
        highlight: "rgba(255,255,255,0.9)",
        panelShadow: "0 4px 20px rgba(31,102,219,0.08)",
        sectionShadow: "0 3px 12px rgba(31,102,219,0.10)",
        controlShadow: "0 3px 10px rgba(31,102,219,0.12)",
        metric: {
            weight: { surface: ["#F7FBFF","#EDF7FF","#E4F2FF"], iconSurface: ["#E8F7FF","#CAE9FF"], accent: "#1766C9", line: "#487CCA", pointFill: "#FFFFFF", shadow: "0 4px 14px rgba(31,102,219,0.10)" },
            height: { surface: ["#F8FFF9","#EDFBF2","#E7F8EE"], iconSurface: ["#E6FFED","#CBF4DA"], accent: "#087F46", line: "#1B8F52", pointFill: "#FFFFFF", shadow: "0 4px 14px rgba(34,145,91,0.09)" },
            head: { surface: ["#FCF9FF","#F5EEFF","#F0E8FF"], iconSurface: ["#EEE4FF","#DFCEFF"], accent: "#7434C9", line: "#9653EA", pointFill: "#FFFFFF", shadow: "0 4px 14px rgba(116,52,201,0.10)" },
        },
        grid: "#D2E4F3",
    },
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
    splashBackground: "#287BFA",
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
    conditionCategory: {
        illness: { on: "#5B3FA3", bg: "#EEE9FA" },
        allergy: { on: "#047857", bg: "#E0F8EC" },
        hereditary: { on: "#6D28D9", bg: "#F3E8FF" },
    },

    // Calendar event categories — the colour of a dot on a day cell.
    //
    // SEPARATE FROM rec* ABOVE, and not a duplicate of it. A rec* tint sits
    // behind an icon with its label right beside it, so those colours never
    // had to be told apart from one another. A calendar dot is 6px of pure
    // colour with no label at all, which is a much harder ask — measured,
    // rec* fails it (illness vs hospitalization come out at dE 21, well under
    // the dE 30 needed to read as different at a glance).
    //
    // These six are chosen against three constraints and verified numerically,
    // not by eye: >=4.5:1 against surface, >=dE 30 (CIE76) between every pair,
    // and FIXED per category. They must never be taken from the girl/boy
    // palette — checkup used to be colors.primary and custom colors.accent,
    // which made the two nearly identical to each other AND changed the
    // legend's meaning with the child's gender. A legend has to be stable.
    //
    // Illness stays amber and hospitalization stays red: DESIGN.md fixes those
    // meanings and the Dashboard's Needs Attention card already uses them.
    // Custom events are slate on purpose — parent-created, not clinical.
    eventCategory: {
        vaccination: "#1D4ED8",
        checkup: "#A21CAF",
        illness: "#8C5A08",
        medication: "#15803D",
        hospitalization: "#C22B3C",
        custom: "#475569",
    },

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
// The Girl and Boy primaries are near-equal in luminance, so a flat 22%
// reads at equal strength across palettes (girl matches boy at 22.5%).
//
// Explicit constants rather than a computed mix of `primary`: four values are
// easier to contrast-check, and easier to nudge, than a blending helper.
export const PALETTES = {
    girl: {
        ...SHARED,
        medicineAction: { gradient: ["#C43D6E", "#9E2D57"], foreground: "#FFFFFF" },
        healthTabs: {
            "gradient": [
                "#FFFFFF",
                "#FFF3F7",
                "#F9E9EF"
            ],
            "selectedGradient": [
                "#FFFFFF",
                "#FFF3F7"
            ],
            "activeLabel": "#9E2D57",
            "inactiveLabel": "#4E5A65",
            "reflection": [
                "#FFFFFFD9",
                "#FFFFFF00"
            ],
            "shadow": "0 4px 14px rgba(158,45,87,0.10)",
            "selectedShadow": "0 3px 10px rgba(158,45,87,0.10)"
        },
        headerButton: {
            "centerTint": "#FFFFFF0A",
            "rimTint": "#DD6E97",
            "refraction": "#9E2D57",
            "reflection": "#FFFFFF",
            "shadow": "0 3px 10px rgba(158,45,87,0.10)",
            "badge": [
                "#E11D48",
                "#BE123C"
            ],
            "badgeText": "#FFFFFF",
            "badgeShadow": "0 2px 5px rgba(190,18,60,0.18)"
        },
        fab: {
            surface: ["#DD6E97","#C43D6E","#9E2D57"],
            plus: ["#FFFFFF","#FFF5F9","#F2D5E0"],
            reflection: "#FFFFFF",
            plusShadow: "#9E2D57",
            focus: "#9E2D57",
            shadow: "0 5px 16px rgba(158,45,87,0.22)"
        },
        navbar: {
            gradient: ["#FFFFFF26", "#FFF0F630"],
            selectedGradient: ["#FFFFFF70", "#F5D8E499", "#FFFFFF52"],
            selectedReflection: ["#FFFFFFB8", "#FFFFFF00"],
            activeLabel: "#8D244C",
            inactiveLabel: "#263A52",
            rim: "#FFFFFFE6",
            highlight: "#FFFFFFBF",
            shadow: "0 8px 24px rgba(158,45,87,0.12)",
            selectedShadow: "0 3px 10px rgba(158,45,87,0.12)"
        },
        primary: "#C43D6E",
        primaryDark: "#9E2D57",
        accent: "#DD6E97",
        accentStrong: "#C43D6E",
        growthMetric: { weight: "#C43D6E", height: "#DD6E97", head: "#9E2D57" },
        nutritionMix: { solid: SHARED.success, breastmilk: "#C43D6E", formula: SHARED.warning, mixed: SHARED.info },
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
        medicineAction: { gradient: ["#1F66DB", "#185ECF"], foreground: "#FFFFFF" },
        healthTabs: {
            "gradient": [
                "#FFFFFF",
                "#F0F7FF",
                "#E6F2FF"
            ],
            "selectedGradient": [
                "#FFFFFF",
                "#F2F8FF"
            ],
            "activeLabel": "#1F66DB",
            "inactiveLabel": "#4E5A65",
            "reflection": [
                "#FFFFFFD9",
                "#FFFFFF00"
            ],
            "shadow": "0 4px 14px rgba(31,102,219,0.10)",
            "selectedShadow": "0 3px 10px rgba(31,102,219,0.10)"
        },
        headerButton: {
            "centerTint": "#FFFFFF0A",
            "rimTint": "#5B9DFF",
            "refraction": "#1F66DB",
            "reflection": "#FFFFFF",
            "shadow": "0 3px 10px rgba(31,102,219,0.10)",
            "badge": [
                "#E11D48",
                "#BE123C"
            ],
            "badgeText": "#FFFFFF",
            "badgeShadow": "0 2px 5px rgba(190,18,60,0.18)"
        },
        fab: {
            surface: ["#5B9DFF","#2F7BF6","#1F66DB"],
            plus: ["#FFFFFF","#F1F7FF","#C5DDFF"],
            reflection: "#FFFFFF",
            plusShadow: "#1F66DB",
            focus: "#1F66DB",
            shadow: "0 5px 16px rgba(31,102,219,0.22)"
        },
        navbar: {
            gradient: ["#FFFFFF26", "#EAF3FF30"],
            selectedGradient: ["#FFFFFF70", "#E8F1FFB3", "#FFFFFF52"],
            selectedReflection: ["#FFFFFFB8", "#FFFFFF00"],
            activeLabel: "#164BA7",
            inactiveLabel: "#263A52",
            rim: "#FFFFFFE6",
            highlight: "#FFFFFFBF",
            shadow: "0 8px 24px rgba(31,102,219,0.12)",
            selectedShadow: "0 3px 10px rgba(31,102,219,0.12)"
        },
        primary: "#1768B3",
        primaryDark: "#0F4F8C",
        accent: "#4A93D6",
        accentStrong: "#1768B3",
        growthMetric: { weight: "#1768B3", height: "#4A93D6", head: "#0F4F8C" },
        nutritionMix: { solid: SHARED.success, breastmilk: "#1768B3", formula: SHARED.warning, mixed: SHARED.info },
        pageGradient: ["#CCDEEE", "#E8F0F7", "#F2F5F7"],
        primarySoft: "#E4EEF8",
        softGreen: "#E4EEF8",
        softCoral: "#E4EEF8",
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
    activeShareSurface: {
        surface: ["#223247", "#2D4056"],
        topShade: ["rgba(0,0,0,0.25)", "rgba(0,0,0,0)"],
        leftShade: ["rgba(0,0,0,0.16)", "rgba(0,0,0,0)"],
        highlight: ["rgba(220,236,255,0.12)", "rgba(220,236,255,0)"],
    },
    developmentChecklist: {
        ...SHARED.developmentChecklist, recorded: "#7EE2C1", track: "#1B293F", trackShade: "rgba(0,0,0,0.25)",
        guidance: ["#344E65", "#2C445A", "#263B51"],
        categoryArt: Object.fromEntries(Object.entries(SHARED.developmentChecklist.categoryArt).map(([key, value]) => [key, {
            ...value, surface: { social: ["#67435A", "#4D3348"], language: ["#395A7B", "#2B425D"],
                cognitive: ["#635736", "#49412D"], motor: ["#365F54", "#28483F"] }[key],
        }])),
    },
    globalFabGlass: { ...SHARED.globalFabGlass, focus: "#A8CCFF" },
    shareSurface: {
        ...SHARED.shareSurface, background: ["#1D2C43", "#202E43", "#243147"], panel: ["#34435A", "#2B3B52", "#23334A"],
        control: ["#435A77", "#354B67", "#2A405D"], methodActive: ["#476C98", "#3C5E86", "#304F75"],
        info: ["#304E6C", "#294563", "#223C57"], text: "#F1F5FF", secondary: "#C0CDE6", azure: "#8FC2FF", highlight: "rgba(255,255,255,0.12)",
        panelShadow: "0 8px 26px rgba(0,0,0,0.28)", iconShadow: "0 4px 12px rgba(0,0,0,0.24)",
        tiles: Object.fromEntries(Object.keys(SHARED.shareSurface.tiles).map(key => [key, ["#38475F", "#2E3D55", "#27364C"]])),
    },
    searchSurface: {
        ...SHARED.searchSurface, background: ["#1D2C43", "#202E43", "#243147"], surface: ["#35465E", "#2D3D54", "#26364C"],
        text: "#F1F5FF", secondary: "#C0CDE6", azure: "#8FC2FF", mutedIcon: "#B9C9F1", highlight: "rgba(255,255,255,0.12)",
        shadow: "0 7px 22px rgba(0,0,0,0.28)", rowShadow: "0 6px 18px rgba(0,0,0,0.24)",
        categories: Object.fromEntries(Object.entries(SHARED.searchSurface.categories).map(([key, value]) => [key, {
            ...value, surface: ["#35465E", "#2D3D54", "#26364C"],
            ink: { vaccines: "#8FC2FF", conditions: "#FFB6C7", milestones: "#FFD99F", calendar: "#8DE6E9", checkups: "#8FC2FF", medication: "#D7B9FF", memories: "#FFB8E3" }[key],
        }])),
    },
    conditionArtwork: { ...SHARED.conditionArtwork, hereditaryActive: ["#634C7D", "#4D3A68"] },
    hospitalStayIcon: { ...SHARED.hospitalStayIcon, background: ["#633C50", "#4C3042", "#3C2636"], shadow: "rgba(0,0,0,0.25)" },
    appointmentDashboard: {
        ...SHARED.appointmentDashboard,
        panel: ["#29374D", "#233146", "#1E2A40"], row: ["#34435B", "#2D3B52", "#26364E"],
        control: ["#425573", "#344966", "#2A3C58"], highlight: "rgba(255,255,255,0.15)",
        text: "#F0F5FF", secondary: "#C0CDE3", azure: "#91C5FF", chevron: "#A3BDFF", divider: "#475773",
        panelShadow: "0 9px 26px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.15)",
        rowShadow: "0 6px 16px rgba(0,0,0,0.26), 0 2px 5px rgba(0,0,0,0.12)",
        activeShadow: "0 7px 17px rgba(0,0,0,0.34)", pressedShadow: "0 2px 5px rgba(0,0,0,0.18)",
        headerIcon: { ...SHARED.appointmentDashboard.headerIcon, surface: ["#53426C", "#3D3057"] },
        all: { ...SHARED.appointmentDashboard.all, surface: ["#344A65", "#2D405A"], active: ["#425D7C", "#344F70"], ink: "#C6E3FF" },
        completed: { ...SHARED.appointmentDashboard.completed, surface: ["#2F514B", "#24423E"], active: ["#3C665A", "#2D5149"], ink: "#B6F2DF" },
        upcoming: { ...SHARED.appointmentDashboard.upcoming, surface: ["#554938", "#443B31"], active: ["#6B583D", "#554831"], ink: "#FFD399" },
        overdue: { ...SHARED.appointmentDashboard.overdue, surface: ["#563C50", "#432F41"], active: ["#6B465D", "#53354B"], ink: "#FFB8D7" },
    },
    milkTypeDashboard: {
        ...SHARED.milkTypeDashboard,
        panel: ["#29374D", "#233146", "#1E2A40"], row: ["#34435B", "#2D3B52", "#26364E"],
        panelShadow: "0 10px 28px rgba(0,0,0,0.32), 0 3px 8px rgba(0,0,0,0.16)",
        chartShadow: "0 8px 24px rgba(0,0,0,0.28)", rowShadow: "0 7px 18px rgba(0,0,0,0.30)",
        iconShadow: "0 4px 12px rgba(0,0,0,0.26)", scrim: "rgba(0,0,0,0.5)",
    },
    milkType: {
        Breastmilk: { ...SHARED.milkType.Breastmilk, surface: ["#344A65", "#2D405A"], ink: "#C6E3FF", shadow: "0 6px 16px rgba(0,0,0,0.28)" },
        Formula: { ...SHARED.milkType.Formula, surface: ["#563C50", "#432F41"], ink: "#FFB8D7", shadow: "0 6px 16px rgba(0,0,0,0.28)" },
        Mixed: { ...SHARED.milkType.Mixed, surface: ["#53426C", "#3D3057"], ink: "#DDCCFF", shadow: "0 6px 16px rgba(0,0,0,0.28)" },
    },
    solidFoodDashboard: {
        panelShadow: "0 10px 28px rgba(0,0,0,0.32), 0 3px 8px rgba(0,0,0,0.16)",
        chartShadow: "0 8px 24px rgba(0,0,0,0.28)", rowShadow: "0 7px 18px rgba(0,0,0,0.30)",
    },
    solidFoodCategories: Object.fromEntries(Object.entries(SHARED.solidFoodCategories).map(([key, value]) => [key, {
        ...value, surface: ["#354259", "#2D394F", "#26334A"], ink: value.segment[0], shadow: "0 6px 16px rgba(0,0,0,0.28)",
    }])),
    feedingBreakdown: {
        ...SHARED.feedingBreakdown,
        panel: ["#2A344A", "#232E42", "#202A3E"], row: ["#354259", "#2D394F", "#26334A"],
        control: ["#455F7E", "#344A68", "#2D3F5B"], center: ["#455F7E", "#344A68", "#2D3F5B"],
        entries: ["#433B58", "#383149", "#302B40"], milk: ["#354960", "#2D3D53", "#27364A"],
        solid: ["#304C41", "#294238", "#233C32"], time: ["#51394C", "#432F40", "#392839"],
        track: "#435269", text: "#F1F5FF", secondary: "#C0CDE6", azure: "#8FC2FF", mint: "#8DE8B2", lavender: "#D7B9FF",
        highlight: "rgba(255,255,255,0.16)", panelShadow: "0 10px 28px rgba(0,0,0,0.28)",
        itemShadow: "0 6px 15px rgba(0,0,0,0.26)", pressedShadow: "0 2px 5px rgba(0,0,0,0.18)",
    },
    immunizationMetrics: {
        dueSoon: { ...SHARED.immunizationMetrics.dueSoon, surface: ["#554C34", "#443B28"], active: ["#6B5B37", "#55472C"], ink: "#FFE09A" },
        overdue: { ...SHARED.immunizationMetrics.overdue, surface: ["#593B49", "#462D39"], active: ["#704252", "#57333F"], ink: "#FFB8C9" },
    },
    vaccineIcon: { background: ["#264C42", "#1D3C33", "#17362D"], highlight: "rgba(255,255,255,0.18)", shadow: "0 3px 8px rgba(0,0,0,0.24)" },
    attentionSurface: {
        ...SHARED.attentionSurface,
        panel: ["#2A344A", "#232E42", "#202A3E"], topTint: ["rgba(251,113,133,0.12)", "rgba(251,113,133,0.05)", "rgba(251,113,133,0)"], row: ["#354259", "#2D394F", "#26334A"],
        control: ["#68445D", "#57364E", "#452A40"], navigation: ["#455F7E", "#344A68", "#2D3F5B"],
        text: "#F1F5FF", title: "#FFAFCA", overdue: "#FFAFCA", chevron: "#B5CDFF", focus: "#8FC2FF", divider: "#4B5A75", highlight: "rgba(255,255,255,0.15)",
        panelShadow: "0 10px 26px rgba(0,0,0,0.30)", rowShadow: "0 8px 18px rgba(0,0,0,0.31)",
        controlShadow: "0 4px 9px rgba(0,0,0,0.24)", navigationShadow: "0 3px 8px rgba(0,0,0,0.24)", pressedShadow: "0 2px 5px rgba(0,0,0,0.18)",
    },
    profileSurface: {
        ...SHARED.profileSurface,
        panel: ["#2A344A", "#232E42", "#202A3E"], surface: ["#354259", "#2D394F", "#26334A"],
        lavender: ["#403750", "#302B40"], lavenderItem: ["#514361", "#3F354D"], mintItem: ["#3D594D", "#30483D"],
        mint: ["#304C41", "#294238", "#233C32"], warm: ["#463F33", "#3B342C"], edit: ["#455F7E", "#344A68", "#2D3F5B"],
        icon: { blue: ["#3D6085", "#2B496A"], mint: ["#3C6A52", "#2C4C3C"], gold: ["#665536", "#4D402B"], lavender: ["#554371", "#403355"], pink: ["#713E5F", "#522D47"] },
        glyph: { blue: "#8FC2FF", mint: "#8DE8B2", gold: "#FFD18C", lavender: "#D7B9FF", pink: "#FFAFDA" },
        text: "#F1F5FF", secondary: "#C0CDE6", muted: "#B1BED6", accent: "#8FC2FF", divider: "#4B5A75", avatarRing: "#D9E8FF",
        highlight: "rgba(255,255,255,0.14)", panelShadow: "0 10px 26px rgba(0,0,0,0.25)",
        itemShadow: "0 8px 18px rgba(0,0,0,0.28)", mintShadow: "0 7px 16px rgba(0,0,0,0.22)", warmShadow: "0 7px 16px rgba(0,0,0,0.22)",
        iconShadow: "0 3px 8px rgba(0,0,0,0.22)", pressedShadow: "0 2px 5px rgba(0,0,0,0.18)",
    },
    feedingToday: {
        ...SHARED.feedingToday,
        panel: ["#2B344C", "#232E43", "#202A40"],
        milk: ["#344663", "#2B3955"], solid: ["#284D43", "#233E37"],
        volume: ["#2D495B", "#263C50"], breast: ["#413D5B", "#33334C"],
        icon: ["#52617E", "#3D4966"], mintIcon: ["#427366", "#31584D"],
        time: ["#3A4765", "#303C58"], divider: "#4A5878", text: "#F2F5FF", secondary: "#C0CDEB", accent: "#8FC2FF",
        highlight: "rgba(255,255,255,0.14)",
        panelShadow: "0 10px 26px rgba(0,0,0,0.24)", tileShadow: "0 7px 16px rgba(0,0,0,0.28)",
        iconShadow: "0 4px 9px rgba(0,0,0,0.20)",
    },
    plansDashboard: {
        ...SHARED.plansDashboard,
        content: ["#323C55", "#2B354E", "#263047"],
        panelShadow: "0 8px 24px rgba(0,0,0,0.26)", contentShadow: "0 7px 18px rgba(0,0,0,0.28)",
        upcoming: { ...SHARED.plansDashboard.upcoming, surface: ["#423E66", "#343253"], ink: "#D0CDFF" },
        overdue: { ...SHARED.plansDashboard.overdue, surface: ["#59344C", "#442B3E"], ink: "#FFACCC" },
        completed: { ...SHARED.plansDashboard.completed, surface: ["#3E4968", "#303B56"], ink: "#CFDAFF" },
    },
    calendarSurface: {
        panel: ["#2B3249", "#20283C"], day: ["#39445F", "#2F3952"],
        control: ["#3C4663", "#303A55"], icon: ["#3D4B66", "#2D3A54"],
        active: ["#5B9DFF", "#1F66DB", "#1851BC"], onActive: "#FFFFFF",
        text: "#F0F3FF", secondary: "#C2CBE5", muted: "#8895B6", focus: "#8FC2FF",
        highlight: "rgba(255,255,255,0.16)", shade: "rgba(0,0,0,0.12)", markerBacking: "rgba(255,255,255,0.85)",
        panelShadow: "0 8px 24px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.12)",
        dayShadow: "0 4px 9px rgba(0,0,0,0.25), -1px -1px 3px rgba(255,255,255,0.04)",
        controlShadow: "0 5px 12px rgba(0,0,0,0.28)",
        activeShadow: "0 5px 10px rgba(0,20,70,0.30)", pressedShadow: "0 2px 4px rgba(0,0,0,0.2)",
    },
    nutritionArtwork: NUTRITION_ARTWORK,
    nutritionSurface: {
    "panel": [
        "#293246",
        "#202A3D"
    ],
    "card": [
        "#34405A",
        "#29354C"
    ],
    "control": [
        "#3B465E",
        "#303B52"
    ],
    "filter": [
        "#57364E",
        "#442D42"
    ],
    "highlight": "rgba(255,255,255,0.12)",
    "panelShadow": "0 6px 22px rgba(0,0,0,0.22)",
    "cardShadow": "0 8px 20px rgba(0,0,0,0.28)",
    "controlShadow": "0 4px 12px rgba(0,0,0,0.25)",
    "bar": [
        "#F7A6D0",
        "#EB78AF"
    ],
    "latestBar": [
        "#EB78AF",
        "#C72F7C"
    ],
    "series": "#F29AC4",
    "histogramAccent": "#F29AC4",
    "grid": "#4D5D77",
    "axis": "#BBC9E8"
},
    recordItem: { surface: ["#2B3B50", "#243347"], highlight: "rgba(255,255,255,0.12)", shadow: "0 7px 14px rgba(0,0,0,0.28), 0 2px 5px rgba(0,0,0,0.12)" },
    growthIcon: { background: ["#254B3B", "#19382D"], shadow: "inset 0 1px 2px rgba(220,255,235,0.12), 0 2px 6px rgba(0,0,0,0.15)" },
    growthHistory: {
        panel: ["#253344", "#1C2939"], item: ["#2B3B50", "#243347"],
        highlight: "rgba(255,255,255,0.12)", title: "#F1F6FF", secondary: "#B7C8DF", chevron: "#A8BCE0",
        panelShadow: "0 6px 18px rgba(0,0,0,0.18)", itemShadow: "0 7px 14px rgba(0,0,0,0.28), 0 2px 5px rgba(0,0,0,0.12)",
        more: ["#4F2940", "#3C2236"], moreText: "#FFB5DE", moreShadow: "0 7px 14px rgba(0,0,0,0.24), 0 2px 5px rgba(0,0,0,0.10)",
    },
    medicationIcon: {
        ...SHARED.medicationIcon,
        purple: { ...SHARED.medicationIcon.purple, background: ["#39304F", "#292137"] },
        green: { ...SHARED.medicationIcon.green, background: ["#213D36", "#19312B"] },
    },
    medicineSurface: {
        section: ["#20313F", "#182735"], item: ["#293C4D", "#21323F"],
        highlight: "rgba(255,255,255,0.10)", shadow: "0 12px 28px rgba(0,0,0,0.22)", itemShadow: "0 8px 20px rgba(0,0,0,0.18)", banner: ["#203D4B", "#1B3345"], info: ["#65DEEF", "#00A4CC"],
        track: "#3A435B", progress: ["#C4A0FF", "#A77BFA"], badge: "#183E31", badgeGradient: ["#234D3D", "#183E31"], badgeText: "#8AE9BC",
    },

    growthSurface: {
        panel: ["#232C38","#1A222D"],
        section: ["#293544","#202B39"],
        control: ["#2D3B4D","#223044"],
        series: "#5B9DFF",
        highlight: "rgba(218,235,255,0.12)",
        panelShadow: "0 4px 20px rgba(0,12,30,0.20)",
        sectionShadow: "0 3px 12px rgba(0,12,30,0.24)",
        controlShadow: "0 3px 10px rgba(0,12,30,0.24)",
        metric: {
            weight: { surface: ["#26384B","#223347","#1D2D40"], iconSurface: ["#294B6C","#203A56"], accent: "#8FC2FF", line: "#5B9DFF", pointFill: "#FFFFFF", shadow: "0 4px 14px rgba(0,15,38,0.22)" },
            height: { surface: ["#263D33","#23372F","#1E3029"], iconSurface: ["#2B563F","#234632"], accent: "#83DEAC", line: "#28D67A", pointFill: "#FFFFFF", shadow: "0 4px 14px rgba(0,25,15,0.20)" },
            head: { surface: ["#362D46","#30283F","#292237"], iconSurface: ["#493964","#3A2C51"], accent: "#CEACFF", line: "#AE6BFF", pointFill: "#FFFFFF", shadow: "0 4px 14px rgba(20,6,38,0.22)" },
        },
        grid: "#4C6077",
    },
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
    splashBackground: SHARED.splashBackground,
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
    conditionCategory: {
        illness: { on: "#B7A0FF", bg: "#2A2047" },
        allergy: { on: "#A4EBD0", bg: "#23463B" },
        hereditary: { on: "#D7BCFF", bg: "#392A50" },
    },

    // Dark-mode variants of the calendar category colours. Same constraints,
    // measured against the dark surface (#1A1E24).
    eventCategory: {
        vaccination: "#7CA5FF",
        checkup: "#E879F9",
        illness: "#E8B34D",
        medication: "#4ADE80",
        hospitalization: "#F2677B",
        custom: "#A3B2C4",
    },

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
        medicineAction: { gradient: ["#C43D6E", "#9E2D57"], foreground: "#FFFFFF" },
        healthTabs: {
            "gradient": [
                "#352D38",
                "#29212E"
            ],
            "selectedGradient": [
                "#49384B",
                "#3B2D3F"
            ],
            "activeLabel": "#F5B8CE",
            "inactiveLabel": "#B7C0C7",
            "reflection": [
                "#FFFFFF1F",
                "#FFFFFF00"
            ],
            "shadow": "0 4px 14px rgba(15,5,20,0.22)",
            "selectedShadow": "0 3px 10px rgba(15,5,20,0.24)"
        },
        headerButton: {
            "centerTint": "#FFFFFF08",
            "rimTint": "#C98DA7",
            "refraction": "#9E2D57",
            "reflection": "#FFF0F6",
            "shadow": "0 3px 10px rgba(158,45,87,0.14)",
            "badge": [
                "#E11D48",
                "#BE123C"
            ],
            "badgeText": "#FFFFFF",
            "badgeShadow": "0 2px 5px rgba(190,18,60,0.18)"
        },
        fab: {
            surface: ["#F080A8","#E8598C","#C43D6E"],
            plus: ["#FFFFFF","#FFF5F9","#F2D5E0"],
            reflection: "#E7F0FF",
            plusShadow: "#9E2D57",
            focus: "#F5B8CE",
            shadow: "0 5px 16px rgba(158,45,87,0.22)"
        },
        navbar: {
            gradient: ["#422338CC", "#2C1E29B8"],
            selectedGradient: ["#542C41C7", "#3B2437C7"],
            selectedReflection: ["#FFFFFF36", "#FFFFFF00"],
            activeLabel: "#F5B8CE",
            inactiveLabel: "#D4DFEE",
            rim: "#EABBCB5C",
            highlight: "#FFFFFF52",
            shadow: "0 8px 24px rgba(232,89,140,0.14)",
            selectedShadow: "0 3px 12px rgba(232,89,140,0.16)"
        },
        primary: "#E8598C",
        primaryDark: "#F5B8CE",
        accent: "#F080A8",
        accentStrong: "#E8598C",
        growthMetric: { weight: "#E8598C", height: "#F080A8", head: "#F5B8CE" },
        nutritionMix: { solid: SHARED_DARK.success, breastmilk: "#E8598C", formula: SHARED_DARK.warning, mixed: SHARED_DARK.info },
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
        medicineAction: { gradient: ["#1F66DB", "#185ECF"], foreground: "#FFFFFF" },
        healthTabs: {
            "gradient": [
                "#283747",
                "#1D2936"
            ],
            "selectedGradient": [
                "#354B63",
                "#293C52"
            ],
            "activeLabel": "#B8DCF5",
            "inactiveLabel": "#B7C0C7",
            "reflection": [
                "#FFFFFF1F",
                "#FFFFFF00"
            ],
            "shadow": "0 4px 14px rgba(0,12,30,0.22)",
            "selectedShadow": "0 3px 10px rgba(0,12,30,0.24)"
        },
        headerButton: {
            "centerTint": "#FFFFFF08",
            "rimTint": "#7FA4D4",
            "refraction": "#1F66DB",
            "reflection": "#E7F0FF",
            "shadow": "0 3px 10px rgba(31,102,219,0.14)",
            "badge": [
                "#E11D48",
                "#BE123C"
            ],
            "badgeText": "#FFFFFF",
            "badgeShadow": "0 2px 5px rgba(190,18,60,0.18)"
        },
        fab: {
            surface: ["#5B9DFF","#2F7BF6","#1F66DB"],
            plus: ["#FFFFFF","#F1F7FF","#C5DDFF"],
            reflection: "#E7F0FF",
            plusShadow: "#1F66DB",
            focus: "#A8CCFF",
            shadow: "0 5px 16px rgba(31,102,219,0.22)"
        },
        navbar: {
            gradient: ["#203956CC", "#182A41B8"],
            selectedGradient: ["#26476AC7", "#203956C7"],
            selectedReflection: ["#FFFFFF36", "#FFFFFF00"],
            activeLabel: "#A8CCFF",
            inactiveLabel: "#D4DFEE",
            rim: "#A7C1E95C",
            highlight: "#FFFFFF52",
            shadow: "0 8px 24px rgba(47,123,246,0.16)",
            selectedShadow: "0 3px 12px rgba(91,157,255,0.18)"
        },
        primary: "#4B9FE0",
        primaryDark: "#B8DCF5",
        accent: "#7CBBED",
        accentStrong: "#4B9FE0",
        growthMetric: { weight: "#4B9FE0", height: "#7CBBED", head: "#B8DCF5" },
        nutritionMix: { solid: SHARED_DARK.success, breastmilk: "#4B9FE0", formula: SHARED_DARK.warning, mixed: SHARED_DARK.info },
        pageGradient: ["#1F3346", "#18232E", "#12151A"],
        primarySoft: "#1A2833",
        softGreen: "#1A2833",
        softCoral: "#1A2833",
    },
};

// Opaque category ramps preserve each existing hue and percentage contrast.
for (const [palettes, target] of [[PALETTES, 0], [DARK_PALETTES, 255]]) {
    for (const palette of Object.values(palettes)) {
        palette.nutritionMixGradient = Object.fromEntries(
            Object.entries(palette.nutritionMix).map(([key, color]) => {
                const shade = "#" + color.slice(1).match(/.{2}/g).map((channel) =>
                    Math.round(parseInt(channel, 16) * 0.65 + target * 0.35).toString(16).padStart(2, "0")
                ).join("");
                return [key, [shade, color]];
            })
        );
    }
}

// Profile materials follow the selected baby's brand, with fixed semantic icon hues.
for (const [palettes, dark] of [[PALETTES, false], [DARK_PALETTES, true]]) {
    for (const [key, palette] of Object.entries(palettes)) {
        if (key === "boy") {
            palette.nutritionSurface = {
                ...palette.nutritionSurface,
                bar: [palette.accent, palette.primary],
                latestBar: dark ? [palette.primaryDark, palette.primary] : [palette.primary, palette.primaryDark],
                histogramAccent: palette.primary,
                filter: [palette.surface, palette.primarySoft],
            };
        }
        const pink = key === "girl", categories = palette.searchSurface.categories;
        const accent = dark ? pink ? "#FFD1E7" : "#B3D9FF" : pink ? "#B52F65" : "#1B5FCF";
        const control = dark ? pink ? ["#59445A", "#49354D", "#3C2B41"] : ["#435A77", "#354B67", "#2A405D"]
            : pink ? ["#FFFFFF", "#FFF0F7", "#FADCEB"] : ["#FFFFFF", "#EDF6FF", "#DCEEFF"];
        palette.profileSettings = {
            background: dark ? palette.pageGradient : pink ? ["#FCE6F0", "#FFF2F7", "#FFFAFC"] : ["#DCEEFF", "#EAF5FF", "#F5FAFF"],
            panel: dark ? pink ? ["#3E3040", "#342838", "#2B2330"] : ["#34435A", "#2B3B52", "#23334A"]
                : pink ? ["#FFFFFF", "#FFF8FB", "#FDEBF3"] : ["#FFFFFF", "#F5FAFF", "#EAF3FF"],
            control, accent, text: dark ? "#F1F5FF" : "#101B56", muted: dark ? "#C4CEDF" : pink ? "#80566E" : "#526888",
            avatarRing: pink ? ["#FFD5EA", "#EE78B2", "#B52F65"] : ["#ABEBFF", "#45BAFF", "#2F6FF6"],
            highlight: dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.95)",
            divider: dark ? "rgba(185,206,235,0.16)" : pink ? "rgba(196,110,151,0.18)" : "rgba(119,159,212,0.22)",
            panelShadow: dark ? "0 8px 24px rgba(0,0,0,0.24)" : "0 7px 22px rgba(74,110,185,0.14), -1px -2px 4px rgba(255,255,255,0.8)",
            iconShadow: dark ? "0 3px 10px rgba(0,0,0,0.22)" : "0 4px 10px rgba(74,110,185,0.16)",
            pressedShadow: dark ? "0 1px 3px rgba(0,0,0,0.2)" : "0 1px 4px rgba(74,110,185,0.12)",
            avatarShadow: dark ? "0 6px 18px rgba(0,0,0,0.28)" : "0 6px 18px rgba(74,110,185,0.23)",
            pressTint: dark ? "rgba(255,255,255,0.04)" : "rgba(121,169,230,0.08)",
            plan: pink ? ["#C43D6E", "#B03164", "#8D2251"] : ["#2371E7", "#1261DA", "#064FC3"], onPlan: "#FFFFFF",
            planShadow: dark ? "0 8px 22px rgba(0,0,0,0.25)" : "0 8px 22px rgba(54,104,190,0.23)",
            logout: dark ? ["#4B3040", "#442738", "#3A2332"] : ["#FFF5F8", "#FFE6F0", "#FBD4E7"],
            logoutInk: dark ? "#FF9ABA" : "#BE1645", logoutShadow: dark ? "0 5px 16px rgba(0,0,0,0.2)" : "0 6px 18px rgba(190,69,120,0.15)",
            icons: {
                brand: { surface: control, ink: accent }, language: categories.calendar,
                mint: { surface: dark ? ["#2B554F", "#24463F", "#203C37"] : ["#F4FFFC", "#D7FAEF", "#BFF0E2"], ink: dark ? "#6EE7C6" : "#00866C" },
                purple: categories.medication, rose: categories.memories,
                disabled: { surface: dark ? ["#39404B", "#303742", "#29313A"] : ["#FAFCFF", "#F0F4F8", "#E7EDF4"], ink: dark ? "#9AA7BB" : "#78879B" },
            },
        };
    }
}

// Preserve the neutral key for saved preferences and default branding.
// Scoped glass material for chart date filters; account and medical surfaces stay unchanged.
for (const [palettes, dark] of [[PALETTES, false], [DARK_PALETTES, true]]) {
    for (const [name, palette] of Object.entries(palettes)) {
        const pink = name === "girl";
        palette.dateFilterGlass = {
            panel: dark ? ["rgba(34,48,74,0.64)", "rgba(24,39,65,0.54)"]
                : ["rgba(255,255,255,0.55)", "rgba(237,247,255,0.35)", "rgba(220,237,255,0.40)"],
            popoverPanel: dark ? ["rgba(34,48,74,0.82)", "rgba(24,39,65,0.74)"]
                : ["rgba(255,255,255,0.80)", "rgba(231,243,255,0.70)"],
            control: dark ? ["rgba(82,101,134,0.64)", "rgba(42,61,91,0.54)"]
                : ["rgba(255,255,255,0.68)", "rgba(230,242,255,0.40)"],
            field: dark ? ["rgba(83,102,138,0.64)", "rgba(43,62,91,0.55)"]
                : ["rgba(255,255,255,0.76)", "rgba(231,243,255,0.50)"],
            icon: dark ? ["rgba(112,143,188,0.54)", "rgba(52,79,119,0.56)"]
                : ["rgba(255,255,255,0.8)", "rgba(181,222,255,0.55)"],
            fallback: dark ? "rgba(29,44,68,0.94)" : "rgba(230,242,255,0.94)",
            overlay: dark ? "rgba(7,15,30,0.48)" : "rgba(32,56,104,0.18)",
            border: dark ? "rgba(194,216,255,0.32)" : "rgba(255,255,255,0.65)",
            highlight: dark ? "rgba(213,230,255,0.22)" : "rgba(255,255,255,0.96)",
            reflection: "#FFFFFF", cyan: dark ? "#79CAED" : "#B5EEFF", lavender: dark ? "#8881C5" : "#DED7FF",
            rimShade: dark ? "#839FC9" : "#A8D4FF", rimLight: dark ? "rgba(211,231,255,0.54)" : "rgba(255,255,255,0.96)",
            divider: dark ? "rgba(168,194,237,0.28)" : "rgba(101,143,204,0.24)",
            text: dark ? "#F0F5FF" : "#101B56", secondary: dark ? "#BDCEEB" : "#50648E",
            accent: pink ? (dark ? "#FFACD2" : "#A52D63") : (dark ? "#9AC4FF" : "#1F66DB"),
            active: pink ? ["#EC86B5", "#B52E71", "#94205A"] : ["#5B9DFF", "#236BDF", "#1558C8"],
            knob: ["#FFFFFF", "#E3F0FF"],
            onActive: "#FFFFFF", error: dark ? "#FFB4C5" : "#AA2548",
            panelShadow: dark ? "0 16px 42px rgba(0,0,0,0.40), 4px 10px 22px rgba(0,0,0,0.20)" : "0 16px 42px rgba(39,75,135,0.20), 4px 10px 24px rgba(47,123,246,0.12), -2px -2px 12px rgba(255,255,255,0.45)",
            controlShadow: dark ? "2px 6px 14px rgba(0,0,0,0.28)" : "2px 7px 16px rgba(63,110,186,0.18), -1px -2px 6px rgba(255,255,255,0.45)",
            fieldShadow: dark ? "2px 8px 18px rgba(0,0,0,0.30)" : "2px 9px 20px rgba(67,105,174,0.20), -1px -2px 7px rgba(255,255,255,0.50)",
            activeShadow: dark ? "0 7px 18px rgba(0,0,0,0.35)" : pink ? "1px 8px 19px rgba(175,42,106,0.26)" : "1px 8px 19px rgba(35,107,223,0.30)",
            pressedShadow: dark ? "0 2px 5px rgba(0,0,0,0.24)" : "0 2px 6px rgba(63,110,186,0.16)",
        };
        // Action menus share this reference material without retheming selectors or chart filters.
        palette.actionMenuGlass = {
            ...palette.dateFilterGlass,
            accent: palette.appointmentDashboard.azure,
            divider: dark ? "rgba(213,230,255,0.24)" : "rgba(255,255,255,0.9)",
            popoverPanel: dark ? ["rgba(34,48,74,0.84)", "rgba(24,39,65,0.76)"]
                : ["rgba(255,255,255,0.72)", "rgba(226,239,255,0.62)"],
            pressed: dark ? "rgba(174,210,255,0.10)" : "rgba(255,255,255,0.35)",
        };
        palette.growthDropdownGlass = {
            ...palette.actionMenuGlass,
            popoverPanel: dark ? palette.dateFilterGlass.panel
                : ["rgba(255,255,255,0.65)", "rgba(220,238,255,0.35)"],
            selected: dark ? ["rgba(119,167,229,0.35)", "rgba(65,112,173,0.25)"]
                : ["rgba(235,247,255,0.72)", "rgba(195,225,255,0.45)"],
            panelShadow: dark ? palette.dateFilterGlass.controlShadow
                : "0 6px 22px rgba(49,96,178,0.17), -1px -1px 5px rgba(255,255,255,0.45)",
            selectedShadow: dark ? "0 3px 8px rgba(0,0,0,0.22)" : "0 3px 9px rgba(65,105,180,0.15)",
        };
        palette.vaccinationProgress = {
            panel: dark ? ["#293C57", "#1D304B"] : ["#FFFFFF", "#F5FAFF", "#EAF3FF"],
            row: dark ? ["#344B6A", "#263C5A"] : ["#FFFFFF", "#F4F9FF", "#EAF3FF"],
            fill: ["#5B9DFF", "#2F7BF6"], track: dark ? "#405879" : "#D5E7FA",
            trackShade: dark ? "rgba(0,0,0,0.24)" : "rgba(74,108,180,0.12)",
            focus: dark ? "rgba(91,157,255,0.18)" : "rgba(47,123,246,0.10)",
        };
    }
}
PALETTES.neutral = PALETTES.boy;
DARK_PALETTES.neutral = DARK_PALETTES.boy;

// Keepsake galleries use opaque Soft 3D surfaces; milestone artwork stays gold in every theme.
for (const [palettes, dark] of [[PALETTES, false], [DARK_PALETTES, true]]) {
    for (const palette of new Set(Object.values(palettes))) {
        palette.memoriesSurface = {
            panel: dark ? ["#29384E", "#1F2E44", "#19273B"] : ["#FFFFFF", "#F5FAFF", "#EAF3FF"],
            item: dark ? ["#34445D", "#293B55", "#23344B"] : ["#FFFFFF", "#F4F9FF", "#EAF3FF"],
            control: dark ? ["#415675", "#2B4261"] : ["#FFFFFF", "#EAF4FF", "#DBECFF"],
            text: dark ? "#F0F5FF" : "#071B61",
            secondary: dark ? "#B6C9E8" : "#526C9C",
            accent: dark ? "#9AC4FF" : "#1F66DB",
            active: ["#5B9DFF", "#236BDF", "#1558C8"],
            onActive: "#FFFFFF",
            activeShadow: "1px 6px 16px rgba(35,107,223,0.28)",
            highlight: dark ? "rgba(203,225,255,0.16)" : "rgba(255,255,255,0.96)",
            shade: dark ? "rgba(6,14,27,0.32)" : "rgba(147,184,230,0.18)",
            panelShadow: dark ? "3px 9px 26px rgba(0,0,0,0.30)" : "4px 9px 26px rgba(74,110,185,0.16), -2px -2px 9px rgba(255,255,255,0.65)",
            itemShadow: dark ? "3px 7px 20px rgba(0,0,0,0.30)" : "3px 7px 20px rgba(74,108,180,0.17), -2px -2px 6px rgba(255,255,255,0.8)",
            controlShadow: dark ? "2px 5px 12px rgba(0,0,0,0.26)" : "2px 5px 12px rgba(74,110,185,0.22), -1px -2px 5px rgba(255,255,255,0.8)",
            pressedShadow: dark ? "1px 2px 5px rgba(0,0,0,0.24)" : "1px 2px 5px rgba(74,110,185,0.16)",
        };
        palette.milestoneIcon = {
            background: ["#FFFDF0", "#FFF8D6", "#FFF1B8"],
            fabric: ["#FDE68A", "#FACC15", "#EAB308"],
            pole: ["#64748B", "#CBD5E1", "#94A3B8", "#64748B"],
            highlight: "#FFFFFF", edge: "rgba(234,179,8,0.18)", shade: "#B77908",
            shadow: "2px 5px 12px rgba(173,134,36,0.18), -1px -1px 4px rgba(255,255,255,0.7)",
        };
        palette.clinicalSummary = {
            ...palette.memoriesSurface,
            icon: dark ? ["#3C5475", "#2D405E"] : ["#FFFFFF", "#DDEFFF"],
            divider: dark ? "rgba(172,202,245,0.20)" : "rgba(132,182,237,0.40)",
            reflection: "#FFFFFF",
            badgeShadow: dark ? "0 3px 8px rgba(0,0,0,0.20)" : "0 3px 8px rgba(74,108,180,0.12)",
            mild: { surface: dark ? ["#4E402C", "#3D3428"] : ["#FFFDF7", "#FFF1DB", "#FCE7C8"],
                art: ["#FFDC80", "#FFB528", "#CE7B06"], badge: dark ? "#59482E" : "#FFF8E8", ink: dark ? "#FFD78B" : "#8B5600" },
            severe: { surface: dark ? ["#50323F", "#402A37"] : ["#FFF9FA", "#FFE8EB", "#FAD8DE"],
                art: ["#FF9AA8", "#F24565", "#C42045"], badge: dark ? "#5D3444" : "#FFF1F4", ink: dark ? "#FFB6C8" : "#AA2346" },
            unknown: { surface: dark ? ["#34445D", "#293B55"] : ["#FFFFFF", "#EDF3FA"],
                art: ["#AFC1D8", "#7891B1", "#526C8C"], badge: dark ? "#3B4E6A" : "#F2F6FB", ink: dark ? "#D5E2F5" : "#52647C" },
        };
    }
}

// Resolve a palette from a child's gender + optional manual override, plus
// an optional color scheme ("light" | "dark", default "light" — every
// existing call site that omits it keeps working unchanged).
export function themeKeyFor(gender, override) {
    const forced = String(override || "").trim().toLowerCase();
    if (forced === "boy" || forced === "girl" || forced === "neutral") return forced;
    const value = String(gender || "").trim().toLowerCase();
    if (value === "boy" || value === "male") return "boy";
    if (value === "girl" || value === "female") return "girl";
    return "neutral";
}

export function paletteFor(gender, override, scheme) {
    const palettes = scheme === "dark" ? DARK_PALETTES : PALETTES;
    return palettes[themeKeyFor(gender, override)];
}

// Official blue default — used by screens not yet migrated to useTheme().
export const colors = PALETTES.boy;

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

export const cardHeaderIconStyle = { alignItems: "center", justifyContent: "center", flexShrink: 0, backgroundColor: "transparent" };

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
export const recordListLayout = {
    section: { padding: 0 },
    header: { paddingHorizontal: 20, paddingTop: 20, marginBottom: 8 },
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
    inset: { paddingHorizontal: 20 },
    row: { borderRadius: 24, marginBottom: 12, overflow: "visible" },
};

export const recordItemStyle = colors => ({
    ...recordListLayout.row, backgroundColor: colors.recordItem.surface[0], borderWidth: 0,
    boxShadow: colors.recordItem.shadow + ", inset 0 1px 2px " + colors.recordItem.highlight,
});

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
    // The onboarding carousel's settle. Slightly overshooting, so a card
    // arrives with a little weight instead of stopping dead — it is the only
    // full-screen transition in the app, and the one place that reads as
    // ceremony without being one. components/Onboarding.js is the only consumer.
    carousel: { duration: 520, bezier: [0.34, 1.28, 0.5, 1] },
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
    recordListLayout,
    recordItemStyle,
    HEADER_TITLE_MAX,
    HEADER_TITLE_MIN,
    HEADER_COLLAPSE,
    motion,
};
