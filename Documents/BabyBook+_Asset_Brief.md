# BabyBook+ — Asset Brief

**Purpose:** the exact images the app is wired up to use but doesn't have yet.
`front-end/assets/` currently contains only a `who/` folder (WHO growth-curve
data, unrelated to this brief) — there is no app icon, no splash image, no
favicon, and no hero photo. `front-end/app.json` and `front-end/components/Landing.js`
already have placeholders pointing at where these files go; once the PNGs exist,
wiring them in is a one-line change per asset (marked below).

Take this document to whichever image-generation tool you're using. Each item
below is a self-contained request.

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

**What to avoid:**
- Stock-generic "happy baby" photography — every parenting app uses the same three photos.
- Anything implying a specific ethnicity as the default. The user base is Filipino families; a light-skinned Western default baby would misrepresent that.
- Clinical/cold imagery (stethoscopes, sterile white rooms) — the app is parent-first, not hospital-first.
- Text or wordmarks baked into any of the icon assets. All type is set in-app.

---

## 1. App icon

**File:** `front-end/assets/icon.png`
**Size:** 1024×1024px, PNG, **no transparency** (flatten to a solid background), no rounded corners — iOS and Android apply their own mask.
**Content:** a simple, single-subject mark that reads at 40×40px on a phone home screen. Suggested subject: an open book with a small heart, star, or growth-curve motif — echoes the app's own `book-outline` icon (already used in `AppLoadingScreen.js`'s "📖" and the brand's `baby-face-outline` mark) without literally being a baby's face.
**Background:** neutral palette primary (`#5A4FB8`) or the shared background (`#F2F5F7`) — pick whichever keeps the mark legible.
**Wire-in:** uncomment `"icon": "./assets/icon.png"` in `app.json` (currently a `_icon_todo` note at the top of the `expo` object).

## 2. Android adaptive icon (foreground)

**File:** `front-end/assets/adaptive-icon.png`
**Size:** 432×432px, PNG, transparent background. Keep the mark inside the centre 66% (≈285px circle) — Android crops the outer edge into different shapes (circle, squircle, rounded square) depending on the launcher.
**Content:** the same mark as the app icon, isolated on transparency, sized to survive the crop.
**Wire-in:** uncomment `"foregroundImage": "./assets/adaptive-icon.png"` inside `app.json`'s `android.adaptiveIcon` object. `backgroundColor` is already set to `#F2F5F7`.

## 3. Splash screen mark

**File:** `front-end/assets/splash-icon.png`
**Size:** any square PNG, transparent background — `app.json`'s `expo-splash-screen` config renders it at `imageWidth: 200`, so anything from ~400px up scales down cleanly.
**Content:** the same mark again (icon, adaptive icon, and splash should all be visibly the same brand mark, not three different treatments). It sits centred on a flat `#F2F5F7` background — already configured, don't bake a background into this file.
**Wire-in:** uncomment `"image": "./assets/splash-icon.png"` inside `app.json`'s `expo-splash-screen` plugin config.

## 4. Web favicon

**File:** `front-end/assets/favicon.png`
**Size:** 48×48px, PNG.
**Content:** the same mark, simplified further if needed — at 48px, fine detail disappears. A bold silhouette works better than the full icon.
**Wire-in:** uncomment `"favicon": "./assets/favicon.png"` inside `app.json`'s `web` object.

## 5. Landing page hero photo

**File:** `front-end/assets/hero.jpg` (or `.png`)
**Size:** 4:3 aspect ratio, at least 1200×900px.
**Content:** a Filipino parent with an infant or toddler, warm and candid rather than posed-stock — reading a book together, or a quiet everyday moment, not a clinical setting. This is the single most visible photo in the app; it's the first thing anyone sees on the marketing Landing page.
**Wire-in:** `front-end/components/Landing.js` line 14 currently reads:
```js
const HERO_PHOTO = null;
```
Change to:
```js
const HERO_PHOTO = require("../assets/hero.jpg");
```
The surrounding frame already matches this exact aspect ratio — no layout change needed either way, so this can be dropped in at any time independent of the other four assets.

---

## Order of priority

If generating these one at a time: **app icon and splash mark first** (they're the same mark reused, so one successful design covers two files), then the adaptive icon (same mark, re-cropped), then the favicon (simplified), then the hero photo last — it's the only one with no dependency on the icon design.
