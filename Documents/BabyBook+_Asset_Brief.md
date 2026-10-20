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
| Boy / official BabyBook+ blue (light) | `#1768B3` | `#0F4F8C` | `#4A93D6` |
| Neutral / default branding (same as Boy, light) | `#1768B3` | `#0F4F8C` | `#4A93D6` |
| Boy / neutral (dark) | `#4B9FE0` | `#B8DCF5` | `#7CBBED` |
| Record page background (all palettes) | `#F2F5F7` | — | — |
| Splash and Android icon background (all themes) | `#287BFA` | — | — |

Boy blue is the official brand palette. Girl pink and automatic gender switching remain available. Neutral/default branding shares all Boy tokens, including soft tints and page/chart gradients, in each color scheme. Purple medical-category colors remain semantic accents.

**Design principle** (from `DESIGN.md`): *tender for the family, credible for
the clinician.* Warm and human, but never cutesy to the point of undermining
that this is a health record a doctor will also look at.

**Logo artwork:** the supplied glossy glass open book has a rounded plus at
the upper right and three pale bars on its right page. Preserve its geometry,
proportions, glass highlights, and blue reflections. Launcher and favicon
exports retain the original blue gradient; the in-app and Android foreground
exports use the background-extracted transparent mark. Do not redraw it or add
lettering.

**What to avoid:**
- Stock-generic "happy baby" photography — every parenting app uses the same three photos.
- Anything implying a specific ethnicity as the default. The user base is Filipino families; a light-skinned Western default baby would misrepresent that.
- Clinical/cold imagery (stethoscopes, sterile white rooms) — the app is parent-first, not hospital-first.
- Lettering or a redesigned silhouette in the logo; use the supplied book-and-plus mark.

---

## 1. App icon

**File:** `front-end/assets/icon.png`
**Size:** 1024×1024px, PNG, **no transparency**, no rounded corners — iOS and Android apply their own mask.
**Content:** the supplied glass book-and-plus artwork, resized without changing its composition.
**Background:** the original supplied blue gradient.
**Usage:** top-level Expo `icon`; this export is opaque and must not be replaced with the transparent splash file.

## 2. Android adaptive icon (foreground)

**File:** `front-end/assets/adaptive-icon.png`
**Size:** 1024×1024px, PNG, transparent background. Center the full silhouette inside the 66/108 safe-area circle, with a small margin, so the plus and page corners survive launcher masks.
**Content:** the same glass book-and-plus mark, isolated on transparency and inset to survive adaptive-icon masks.
**Usage:** `android.adaptiveIcon.foregroundImage`; the background is `#287BFA`.

**Themed companion:** `front-end/assets/monochrome-icon.png` uses white pixels with exactly the adaptive foreground's alpha channel. It is wired to `android.adaptiveIcon.monochromeImage` for system tinting.

## 3. Splash screen mark

**File:** `front-end/assets/splash-icon.png`
**Size:** 1024×1024px, transparent PNG. `expo-splash-screen` renders it at `imageWidth: 200`.
**Content:** the transparent glass book-and-plus mark, centered with padding. It is also used by the JavaScript splash and About screen. Auth retains its illustrations without a logo.
**Usage:** native and JavaScript splash grounds use solid `#287BFA` in both light and dark mode. The JavaScript screen reads the shared `splashBackground` theme token. The splash shows only the centered logo, without text or a loading indicator, and retains its startup readiness gate and reduced-motion-aware exit. Its 1100ms visible interval begins at the first successful image `onLoad`; slow startup adds no second delay if that interval has already elapsed. Image errors allow ready startup to finish, and web/native JavaScript fallback callers wait for the completion callback.

## 4. Web favicon

**File:** `front-end/assets/favicon.png`
**Size:** 48×48px, PNG.
**Content:** the supplied book-and-plus artwork with its original blue gradient, exported specifically at browser size.
**Usage:** Expo web `favicon`.

## Canonical sources

**File:** `front-end/assets/logo-mark-source.png`
**Content:** the exact 1254×1254 supplied blue-gradient PNG. This source must remain unchanged; platform exports change only resolution, transparency, and required padding. The previous script wordmark source is retired.

**Verification:** run `node utils/branding.check.js`, `node utils/theme.check.js`, and `npm run build` from `front-end/`. Inspect transparency on blue, light, and dark grounds and the favicon at browser sizes. Native branding changes require a new release binary and cold-launch device verification; Expo Go is not sufficient.

## Transparent export provenance

The transparent export was created with the built-in Imagegen tool, then
resized and padded with the already-installed image tooling. The opaque
launcher, favicon, and canonical source are derived directly from the supplied
PNG. The final background-extraction prompt was:

> Use case: background-extraction. Edit target: the supplied official BabyBook+ glass open-book-plus logo. Remove ONLY the blue gradient background surrounding the book and plus sign, and make that background genuinely transparent with clean antialiased edges. Preserve the existing logo faithfully: exact open-book geometry and perspective, the detached rounded plus in the upper right, left-page milky white glass, right-page translucent blue glass, its three diagonal pale bars, glossy highlights, blue reflections, and proportions. Do not redesign, redraw, recolor, rotate, or add anything. Keep the blue glass tint and soft translucent glass areas INSIDE the book rather than deleting the right page. No typography, no extra shadows outside the silhouette, no blue rectangular backdrop, no checkerboard baked into pixels. Output one square transparent PNG of only the same book-and-plus mark, centered with generous padding for use in app icons, splash, and About. Preserve all original visual details.

## Retired landing asset

The former marketing `Landing.js` screen was deleted. It no longer requires or consumes a hero image; do not add one solely to satisfy older versions of this brief.


## Glossy navbar icon set — October 2026

The primary style reference is the supplied `navbar glass.png`: frosted translucent material, inflated rounded silhouettes, gentle blue shading and luminous top-left highlights. The existing five navigation destinations remain Home, Health, Growth, Nutrition and Calendar. Final icons live in `front-end/assets/navbar/` as `{dashboard,health,growth,nutrition,calendar}-{blue,pink,inactive}.png`. All 15 exports are 128×128 RGBA PNGs, optically centered with approximately 112px maximum visible extent, displayed at 32dp. The same artwork works on light/dark glass; label and panel colors adapt by scheme.

**Generation:** built-in imagegen tool, one asset per call. Blue icons were generated first using the navbar reference, with the first house icon additionally establishing material/lighting consistency. Pink and inactive variants edit each corresponding blue image; colors alone change, preserving subject geometry and lighting. Production exports crop transparent margins and resample with the existing `jimp-compact` tooling, preserving alpha. No palette tint is applied at runtime.

**Prompt set:**

- Home: one rounded house with a rounded roof, doorway and chimney. Health: rounded medical carry case, small top handle and a white plus. Growth: three separated ascending rounded bars, no arrow or axis. Nutrition: rounded apple, one rounded leaf and short stem. Calendar: rounded calendar tile, two binder tabs, subtle header seam and six rounded day marks, no numerals.
- Shared blue generation prompt: “Transform the reference imagery into ONE isolated [SUBJECT] navbar icon for BabyBook+. The navbar is the primary glossy-glass style reference; the generated house establishes consistency of material, lighting, size, blue colors, rounded bevels and visual weight. Soft inflated 3D polished frosted-glass/plastic; simple geometric silhouette; front-facing orthographic view with slight depth. Midtone #2F7BF6, gentle shaded edges #1F66DB, lighter surfaces #5B9DFF, restrained luminous white top-left highlights. Clean premium minimal mobile icon; no harsh outline or realistic texture. Center on a square truly transparent canvas, fill about 86% of its bounds with consistent optical size and padding. Entire object inside frame. Remove all navbar containers, text, labels, unrelated shapes and backgrounds. No floor, ground shadow, words, border frame or icon sheet. Readable at 32dp.”
- Variant edit prompt: “Edit ONLY the material color of this single BabyBook+ [SUBJECT] icon. Preserve the exact object geometry, silhouette, symbols, framing, canvas, position, proportions, perspective, rounded bevels and top-left lighting. Keep the premium glossy inflated frosted-glass/plastic finish. Keep any medical plus white. Add or remove nothing. Same size and padding as input. Genuinely transparent background, clean alpha edges; no opaque background, border, text, ground or cast shadow. One isolated icon, no sheet.” Pink treatment: #C43D6E / #9E2D57 / #DD6E97, white specular highlights. Inactive treatment: #7A92BA / #617B9F / #C7D8F0, restrained white highlights matching the reference’s inactive icons.

### Header foreground icons (October 2026)

- Eight generated transparent 128×128 RGBA assets live in `front-end/assets/header/`: Notifications, Search, QR and Profile, each in azure blue and rose pink. Visible silhouettes fit within 112px; Search and QR holes remain transparent. Lighting comes from the upper left, with rounded inflated geometry and soft white specular highlights.
- Blue serves Boy/neutral; pink serves Girl. The same assets serve light/dark themes and are preloaded through `HEADER_ICON_SOURCES`. Centered image frames are 28dp for the bell, 26dp for Search/Profile and 24dp for QR to account for transparent padding. The 40dp glass dome and 44dp interactive target remain unchanged.
- Only foreground icons are raster assets. Blur, clear material, masked refracted rim, curved reflections, press feedback and live notification/QR badges remain interactive component layers. Original generated images are retained under the local Codex generated-images directory.

- Profile uses a circular head above broad rounded shoulders with a transparent curved separation, matching the supplied user silhouette. White upper-left gloss and gentle lower-right shading match the other header assets. The header uses this silhouette for all accounts; it does not replace stored profile photos.

## Growth measurement icons (October 2026)

Three generated 128×128 RGBA PNGs in front-end/assets/growth/ provide a glossy azure hanging weight scale, mint vertical ruler and peach baby head with a lavender curl. All use upper-left white reflections, soft lower-right shading, transparent backgrounds and a maximum 112px visible extent. They are reused in the Growth-only latest-measurement tiles and chart headings. Their blue/mint/lavender semantic colors remain fixed across Boy/Girl themes and both light/dark schemes; backgrounds adapt through colors.growthSurface. Icons remain decorative; actual labels, values and dates render as text.
