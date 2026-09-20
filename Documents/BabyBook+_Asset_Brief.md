# BabyBook+ — Brand Asset Specification

**Status:** implemented. This document records the official logo construction,
platform exports, and constraints. `front-end/app.json` is the source of truth
for how the files are wired into Expo.

---

## Brand basis — use these exactly

**Palette** (from `front-end/theme.js`, the single source of truth — this
supersedes any older hex values in `DESIGN.md`):

| Palette | Primary | Primary Dark | Accent |
|---|---|---|---|
| Girl (pink) | `#C43D6E` | `#9E2D57` | `#DD6E97` |
| Boy (blue) | `#1768B3` | `#0F4F8C` | `#4A93D6` |
| Neutral (indigo — pre-child / professional portal) | `#5A4FB8` | `#423699` | `#8478D6` |
| Background (all palettes) | `#F2F5F7` | — | — |

**Design principle** (from `DESIGN.md`): *tender for the family, credible for
the clinician.* Warm and human, but never cutesy to the point of undermining
that this is a health record a doctor will also look at.

**Logo artwork:** the two supplied source images use indigo artwork on
`#F2F5F7`. Preserve their pixels, proportions, lettering, and spacing; platform
exports may change only resolution and required background transparency.

**What to avoid:**
- Stock-generic "happy baby" photography — every parenting app uses the same three photos.
- Anything implying a specific ethnicity as the default. The user base is Filipino families; a light-skinned Western default baby would misrepresent that.
- Clinical/cold imagery (stethoscopes, sterile white rooms) — the app is parent-first, not hospital-first.
- Full-name wordmarks in small launcher or favicon assets; use the compact `BB+` variant there.

---

## 1. App icon

**File:** `front-end/assets/icon.png`
**Size:** 1024×1024px, PNG, **no transparency** (flatten to a solid background), no rounded corners — iOS and Android apply their own mask.
**Content:** the compact `BB+` brush-script mark above the approved shallow open book. The raised plus and book share one rounded monoline treatment; both `B` forms, the plus, centre gutter, and right-page edge remain distinct at 40×40px.
**Background:** shared light background (`#F2F5F7`).
**Usage:** top-level Expo `icon`; this export is opaque and must not be replaced with the transparent splash file.

## 2. Android adaptive icon (foreground)

**File:** `front-end/assets/adaptive-icon.png`
**Size:** 1024×1024px, PNG, transparent background. Keep the mark inside the centre 66% — Android crops the outer edge into different shapes (circle, squircle, rounded square) depending on the launcher.
**Content:** the same compact `BB+` and open-book mark as the app icon, isolated on transparency and inset to survive adaptive-icon masks.
**Usage:** `android.adaptiveIcon.foregroundImage`; the background remains `#F2F5F7`.

**Themed companion:** `front-end/assets/monochrome-icon.png` uses the same compact one-colour construction and transparent negative space. It is wired to `android.adaptiveIcon.monochromeImage`.

## 3. Splash screen mark

**File:** `front-end/assets/splash-icon.png`
**Size:** 1024×1024px, transparent PNG. `expo-splash-screen` renders it at `imageWidth: 200`.
**Content:** the full stacked `Baby` / `Book+` wordmark above the open book, with no baked background. It is also used by the JavaScript splash, Auth, and About screens.
**Usage:** the splash plugin uses `#F2F5F7` in light mode and `#12151A` in dark mode so the native and JavaScript splash grounds match.

## 4. Web favicon

**File:** `front-end/assets/favicon.png`
**Size:** 48×48px, PNG.
**Content:** the compact `BB+` mark, exported specifically at browser size on the shared light background.
**Usage:** Expo web `favicon`.

## Canonical sources

**Files:** `front-end/assets/logo-mark-source.png` and `front-end/assets/logo-wordmark-source.png`
**Content:** exact 500×500 copies of the approved supplied artwork. The compact source carries `BB+` above the open book; the full source carries stacked `Baby` / `Book+` above the same book. These PNGs—not the derived platform exports—are the source of truth.

## Retired landing asset

The former marketing `Landing.js` screen was deleted. It no longer requires or consumes a hero image; do not add one solely to satisfy older versions of this brief.
