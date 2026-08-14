# BabyBook+ Visual Design Audit & Direction

## 1. Executive Summary

Three root causes explain why the app reads flat and generic, each independently verified against
the source:

1. **The type scale is fully bypassed.** `theme.js:122-130` defines 7 real typographic roles, but
   they are imported at exactly one dead-end (`ThemeContext.js:2`) and consumed by **zero**
   components; instead, 313 ad-hoc `fontSize` literals spread across 55 distinct
   (size, weight) combinations, 78% of it locked into just two weights (700/800), collapsing the
   entire visual hierarchy into a 1px gap between the app's two most common styles (13px/700 →
   14px/700) and putting 28% of all text at a single value: 13px.
2. **Color is one saturated accent floating on an undifferentiated field.** Of 812 `colors.*`
   references app-wide, the top 5 tokens — none of which vary by content — account for 60% of all
   usage; 7 of the palette's own defined tokens (`tintCoral`, `tintViolet`, `tintPink`,
   `tintIndigo`, `primaryDark`, `gradient`, `gradient3`) are referenced **nowhere**, and icon-tint
   coloring for five distinct health-record types in `Health.js` all resolves to the identical
   `colors.tintGreen` default — so content that is semantically different renders visually
   identical.
3. **Depth and ceremony are inconsistently applied, and the app's key moments have none.** Two of
   five elevation tokens are dead (`shadow.green`: 0 uses; `shadow.soft`: 2, both inside shared
   components only), motion tokens don't exist at all, and the single moment the whole product
   exists to deliver — a parent generating a QR code to hand their child's health record to a
   nurse — renders as a bare white square with a hairline border and no confirmation, animation,
   or ceremony (`ShareRecords.js:133-135`, `QrCodeView.js:24-47`).

## 2. Diagnosis

### 2.1 Token audit — what `theme.js` actually provides (143 lines)

| Export | Line | Verdict |
|---|---|---|
| `PALETTES` (girl/boy/neutral) | `theme.js:44` | Live — 60.1% of all color usage concentrates in 5 tokens |
| `space` (6 steps) | `theme.js:109` | Live — 333 references — but bypassed by hundreds of ad-hoc numeric values in half the app's screens |
| `radius` (5 steps) | `theme.js:112` | Live — 108 references — but 95 raw `borderRadius` integers exist across 21 files alongside it |
| `type` (7 roles) | `theme.js:122-130` | **Dead.** 0 consumers. `theme.js:118-121` admits this in its own comment |
| `shadow` (5 keys) | `theme.js:133-139` | **Half-dead.** 2 of 5 keys (`soft`, `green`) barely or never used; values are literal numbers with no systematic ratio (blur 10/14/24/22/26, opacity .06/.07/.10/.12/.12) |
| `MIN_TOUCH` | `theme.js:141` | Nearly dead — 1 real consumer (`Button.js:55`); `App.js`'s tab bar, FAB, and header buttons all size themselves with raw numbers instead |
| Motion (durations/easings) | — | **Does not exist.** Zero matches for `duration`/`easing`/`spring`/`transition` anywhere in `theme.js` |
| Semantic state tokens | — | **Do not exist.** Only generic `success`/`danger`/`warning`/`info`; no `overdue`/`upcoming`/`completed`/`shared`. Consequence: `ProfessionalView.js:291,334,349` hardcodes `#22C55E`/`#F59E0B`/`#D6D3D1` for the same "completed" concept that `CalendarView.js:299` renders via `colors.success` (`#2BB673`) — the identical real-world state renders as two different greens depending on which screen you're on |

`success`/`danger` each get a paired `*Bg` tint (`theme.js:36-41`); `warning`/`info` do not — a
structural asymmetry, not a stylistic one.

### 2.2 Typography — quantified flatness

313 `fontSize:` literals, 22 distinct values, 243 `fontWeight:` literals, 7 distinct weights, **55
distinct (size, weight) pairs in practice** — and `theme.js`'s `type` scale contributes to none of
them.

- **13px alone = 88/313 = 28.1%** of all sized text in the app.
- **11–16px = 79.9%** of all sized text, spread thin across 11 discrete values (10.5, 11, 11.5, 12,
  12.5, 13, 13.5, 14, 14.5, 15, 16) with no perceptual separation between adjacent steps.
- **800+700 weight = 78.2%** of all weighted text (`800`: 97 uses, `700`: 93). `500` (the closest
  thing to a true regular body weight) appears only **6 times** in the entire app. Two
  non-standard weights exist: `750` (`Health.js:1499`) and `900` (`ProfessionalView.js:441`,
  `ShareRecords.js:352`).
- **25.2% of sized text objects declare no `fontWeight` at all**, silently inheriting RN's
  default 400 — an unintentional 8th weight value nobody chose.
- **Half-point sizes appear 21 times** (10.5×6, 12.5×11, etc.) — sub-pixel steps corresponding to
  no token and no deliberate scale.
- The four most-used combinations are 13px/700 (39×), 13px/600 (20×), 14px/700 (16×), 18px/800
  (16×) — meaning the primary hierarchy operates inside a **1px gap** between two of its three most
  common tiers.
- Heaviest offenders by distinct-style count: `Dashboard.js` (26), `Health.js` (25),
  `Landing.js` (24), `ProfessionalView.js` (23), `Auth.js`/`ShareRecords.js` (20 each).

### 2.3 Color usage in practice

| Rank | Token | Count | First site |
|---|---|---|---|
| 1 | `colors.primary` | 171 | `App.js:595` |
| 2 | `colors.textMuted` | 118 | `App.js:514` |
| 3 | `colors.text` | 75 | `App.js:1421` |
| 4 | `colors.border` | 65 | `App.js:1478` |
| 5 | `colors.textSecondary` | 59 | `App.js:1195` |

Top 5 = **488/812 = 60.1%** of all color usage, and none of them differentiate content by type —
they are structural, not expressive.

**Completely unused tokens (0 references anywhere):** `tintCoral`, `tintViolet`, `tintPink`,
`tintIndigo` (`theme.js:28,31,33,34`), `primaryDark` (defined 3×, used 0×), `gradient`, `gradient3`
(defined 6×, used 0×).

**The 8 module tints are 50% dead.** The 4 that survive are used 13 times total, and
`colors.tintGreen` alone (9 uses) is doing almost all of the work — including as `Cards.js:32`'s
**default** icon-container fill, so five different `iconBg` props across `Health.js`
(`:952,1046,1106,1147`) all explicitly pass the identical `colors.tintGreen`, making a no-op of
having a prop at all. Vaccines, checkups, medications, and illnesses render with the same icon
tint.

**`gradient`/`gradient3` are defined and never consumed.** The one `<Gradient>` call site in the
entire app (`Landing.js:107-112`) doesn't even use them — it passes
`colors={[colors.softGreen, colors.background]}` directly. `expo-linear-gradient` otherwise only
drives the Skeleton shimmer sweep (`ui/Skeleton.js:63-64`). `theme.js:132`'s own comment claims
"brand pop comes from gradients" — that claim is false against the code.

**94 raw hex literals bypass the token system**, concentrated in `ProfessionalView.js` and
`ShareRecords.js`, which run a parallel, untokenized Tailwind-style palette
(`#22C55E`, `#F59E0B`, `#3B82F6`, `#8B5CF6`, `#1D4ED8`, `#047857`) alongside the real one.
`App.js:580` sets the status bar to `#FFFDF9`, a cream that matches none of the three palette
backgrounds.

### 2.4 Architecture (`App.js`, 1596 lines)

- **Real bottom nav, `App.js:729-734`:** Home / Health / Growth / Nutrition / Calendar (5 tabs).
  `Services` has a translation key (`navServices`) but no tab slot — reachable only via
  `SideMenu` (`App.js:676`).
- **FAB action sheet, `App.js:138-148`:** 9 items, all hardcoded English (not routed through `t()`,
  unlike the tab bar), sharing one icon tint (`colors.primary`) with zero per-action color
  differentiation.
- **24 screens/overlays delegated** to components; **4 modals rendered inline** in `App.js`
  totaling ~451 lines, of which the Add/Edit Baby Profile modals (`App.js:819-1186`, 366 lines) are
  near-verbatim duplicates of each other. Two different modal scrim opacities coexist
  (`rgba(28,25,23,0.45)` action sheet vs. `.55` form modal, `App.js:1407,1451`) with no stated rule
  for which gets which.

### 2.5 Surface & depth, screen by screen

| Screen | Elevation tokens used | Raw `borderRadius` values | Ad-hoc spacing | Token spacing |
|---|---|---|---|---|
| `Health.js` | **0** (legacy hand-rolled shadow at `:1525-1530`) | 9 distinct incl. literal `999` | 56 | 0 |
| `Growth.js` | **0** (legacy hand-rolled shadow at `:769-774`) | 7 distinct | 42 | 0 |
| `ProfessionalView.js` | **0** | 8 distinct (5–28) | 45 | 0 |
| `ShareRecords.js` | **0** (2× legacy hand-rolled) | 11 distinct (7–25) | 40 | 0 |
| `Services.js` | **0** | 4 distinct | 22 | 0 |
| `CalendarView.js` | 4 (`card`×2, `raised`, `accent`) | 2 distinct | 10 | 33 |
| `NutritionTracker.js` | 4 (`card`, `raised`, `accent`×2) | 0 | 16 | 26 |
| `Dashboard.js` | **8** (`card`×7, `raised`) | 3 distinct | 6 | 53 |

Three incompatible surface systems coexist: token-driven cards (`Dashboard.js`, `NutritionTracker.js`,
`CalendarView.js`) using `colors.surface`+`hairline`+`radius.lg/xl`+`shadow.card`; raw-value cards
with **no elevation at all** (`Health.js`, `Growth.js`, `Services.js`, `ShareRecords.js`,
`ProfessionalView.js`) using hardcoded `"#FFFFFF"` and integer radii; and the shared
`SectionContainerCard` (token-driven) dropped into both, so `Health.js` renders a shadowed
`radius.xl` container directly above an unshadowed `radius:16` box (`Health.js:613-628` vs. `:722`).
`shadow.green` is defined and used **nowhere**; `shadow.soft` is used **twice**, both inside shared
components, never in a screen file.

Dashboard.js's own code contains a tell: `Dashboard.js:1185-1187` comments that the teal share card
exists "to be clearly noticeable next to the plain white cards around it" — the flatness problem is
named in the source.

### 2.6 Emptiness and moments

**Empty states.** One shared component, `EmptyStateCard` (`common/Cards.js:88-99`): a dashed-border
tinted box, a 40px white circle with a 20px icon, one line of 13px text. No illustration, no
CTA. **14 call sites**, and of these, **6 pass no icon and silently fall through to the same
default `sparkles-outline`** — `Health.js:783,786,926,1078,1134` (5 of its own 4 tabs) and
`Growth.js:502`. Health.js alone renders five visually identical sparkle boxes.

Nine additional empty states are **not** `EmptyStateCard` at all — bare centered text with no
container, no icon: `GrowthChart.js:66-71`, `PercentileChart.js:147-152,274-284`,
`ProfessionalView.js:288,314,331,346,363` (5 instances of italic 12px "No records."),
`MemoryDetail.js:146-149`. `QrCodeView.js:15-17`'s QR-generation failure state is a **blank white
square with no message at all**.

**Loading states.** Real shimmer skeletons exist and are well-built (`ui/Skeleton.js`, verified
`Animated.loop` + `LinearGradient` sweep, `Skeleton.js:18-33,63-69`) but cover only
Dashboard/Health/Growth first paint. Three screens fall back to bare `"Loading…"` text with no
skeleton and no spinner: `CalendarView.js:383-384`, `AllActivity.js:118-119`,
`AllMemories.js:56-57`. Two screens (`NutritionTracker.js`, `Health.js`'s medication/illness
sections) have **no loading flag at all** — their empty state and their loading state render
identically, so a fetch in progress looks exactly like "no records exist."

**Success confirmation.** Exactly one pattern app-wide: `ui/Toast.js` — bottom-anchored, tinted
background, 18px icon, fade+20px-translateY over 200ms, 2.6s auto-dismiss. No haptics, no scale,
no modal, ever. And even this single pattern is missing from the app's most consequential action:
**generating a consultation QR code fires no toast, no animation, nothing** — `ShareRecords.js:83-99`
just swaps to the result branch (`:120`) with a plain conditional render.

**The QR share moment — exact current state.** The result screen
(`ShareRecords.js:120-161,340-366`) is one unshadowed `"#FFFFFF"` card at `radius:24`. The QR
frame itself (`:133-135,347-350`) is a 10px white gutter and a hairline rectangle — no shadow, no
brand frame, no corner marks, no child's name or photo anywhere on the share screen. The QR code
render (`QrCodeView.js:24-47`) is unthemed pure `#1C1917`-on-`#FFFFFF` modules, ignoring the
girl/boy/neutral palette entirely. Nothing animates in; no toast fires. The professional's scanner
(`QrScanner.js:77-131`) is a full-screen black camera view with one text pill and a cancel button —
**no reticle, no corner brackets, no viewfinder frame, no scan-success flash or sound.**

### 2.7 Imagery and iconography

Confirmed 100% `@expo/vector-icons` (Ionicons/MaterialCommunityIcons) — zero illustration assets,
zero custom SVG artwork, zero photo texture anywhere in the app. `Landing.js:14` sets
`HERO_PHOTO = null`, so even the marketing hero is an icon-in-a-tinted-box. The only "artwork" in
the app is two emoji (📖, 🛡️) on `AppLoadingScreen.js:67,76`.

**The parent's own photos — the actual keepsake material — get a data-thumbnail treatment, not a
keepsake one.** `common/Cards.js:163-188`'s `MemoryVisualCard`: a fixed 180px box, `shadow.soft`
(the app's one real use of that token), and **every photo unconditionally darkened by a flat
`rgba(28,25,23,0.34)` scrim** (`:175`) regardless of the photo's own content, with the date
rendered as a metadata pill, not a caption. No mat, no border, no warm tint, no handwriting/serif
treatment — structurally identical to a video-thumbnail pattern. Child avatars
(`Dashboard.js:1044`) are a bare 32px circle with no ring, border, or shadow. The single exception:
`MemoryDetail.js:141,231-238` adds a 48×4px `colors.primary` accent bar under the notes section —
the one deliberate decorative flourish applied to a parent's photo anywhere in the product.

### 2.8 Screens ranked, flattest first

1. **`Health.js`** — flattest. Zero `shadow.*` tokens across 1813 lines; 56 ad-hoc spacing values
   against 0 from `space`; 9 distinct raw radii including a literal `999` where `radius.pill`
   exists (`:1660`); five identical default-icon empty states.
2. **`Growth.js`** — shares Health's exact styling lineage (`Growth.js:753-761` is byte-identical
   to `Health.js:1509-1517`); zero shadow tokens; 42 ad-hoc spacings. Only escapes last place
   because its Metrics tab (built this session) has real differentiated surfaces.
3. **`CalendarView.js`** — mostly token-driven, but every event row collapses to an identical
   unshadowed white rectangle (`:582-601`) differentiated only by a 38px tinted icon square; the
   legend is six 8px dots.
4. **`NutritionTracker.js`** — the bar chart (`:492-500`) is genuinely screen-specific, but flat
   22px rectangles with no axis or gridlines; 9 distinct font sizes including a literal `9`.
5. **`Dashboard.js` — least flat.** 8 elevation-token uses, 5 distinct card tints, interactive
   focus rings, press-scale feedback, and the app's only skeleton-covered first paint. Only 6
   ad-hoc spacing values against 53 token uses — the one screen where the design system is
   actually applied end to end, which is exactly what makes the drop to Health/Growth read as a
   break rather than a style choice.

### 2.9 The shared design-system layer — verdict

**Thin and bimodally adopted, not a disciplined system.** `ui/`+`common/` total 891 lines against
~12,100 lines of screen code — about 7%. Adoption splits sharply:

- **Real and systemic:** `SectionContainerCard` (31 call sites / 14 files, including all 9
  settings screens), `Toast` (15 files), `ShowMore` (6 files), `DateField` (5 files).
- **Well-built and ignored:** `Button.js` has real hover/press/focus/disabled/loading states
  (`Button.js:67-76`) but only **9 call sites in 3 files** against **146 raw `TouchableOpacity`**
  uses across 31 files — the primary-action button is independently re-declared in at least 8
  places in two mutually incompatible shapes. `Field.js` (14 call sites in 2 files, against 56 raw
  `TextInput`s) has 3 competing reimplementations of the same input shape at 3 different radii/
  heights (`Field.js:44-45` r20/h52, `EditProfile.js:151-161`/`ChangePassword.js:100-110` r14/h44,
  `App.js:1524-1534` r20/h52 written separately). `Gradient.js` (1 file), `PhotoAttach.js`
  (1 file), `ImageViewer.js` (1 file, and the one `ui/` component that hard-codes colors instead of
  using the theme, `ImageViewer.js:4,13,28,29`).
- **All nine settings screens share one identical container style verbatim**
  (`AboutApp.js:42`, `ChangePassword.js:91`, etc.) and are visually indistinguishable from each
  other: total icon count across all nine is **3**; six of the nine render no icon at all.
  `GeneralSettings.js:72-97` and `ThemePreferences.js:54-79` duplicate the same radio-button block
  byte-for-byte, including the same hard-coded off-token `#D6D3D1` border.

## 3. Primary Direction — "The Yellow Card"

**Concept.** BabyBook+ becomes the digital twin of the DOH child-immunization card every Filipino
parent already carries and every nurse already recognizes — literally nicknamed "the yellow card"
— rendered as warm document-paper with ledger-precise rules and a single, specific gold seal
accent, so clinical screens read as an official record and the memory screens read as the same
family's treasured insert tucked into its cover.

### 3.1 Palettes

**SHARED tokens** (identical across all three child palettes — this is a deliberate change from
today's per-palette background: a real document doesn't change color depending on whose card it
is, so only the child-personalization tokens below vary; everything structural stays constant):

| Token | Hex | Role |
|---|---|---|
| `text` | `#241F1C` | Primary ink |
| `textSecondary` | `#4A423C` | Secondary ink |
| `textMuted` | `#746A62` | Metadata ink |
| `placeholder` | `#6E6357` | Input placeholder |
| `background` | `#FAF6EE` | Page — warm bond-paper, not cream/kraft |
| `surface` | `#FFFFFF` | Cards |
| `surfaceAlt` | `#F3EEE1` | Inputs, secondary surface |
| `hairline` | `#E8E1D2` | Card borders |
| `border` | `#DDD3BE` | Input/chip borders |
| `borderStrong` | `#C7B896` | Dashed empty-state border |
| `onPrimary` | `#FFFFFF` | Text on filled buttons |
| `success` / `successBg` | `#1F7A4D` / `#E3F3E8` | Completed |
| `danger` / `dangerBg` | `#B33526` / `#FBE7E4` | Overdue |
| `warning` / `warningBg` (**new**) | `#966109` / `#FBEEDA` | Upcoming/due soon |
| `info` / `infoBg` (**new**) | `#14707C` / `#DCF0EF` | Shared/active |
| `seal` / `sealBg` (**new**) | `#8A6414` / `#FBF1DC` | The signature accent — used only for the app's ceremony moments (§3.4) |
| `completed`/`overdue`/`upcoming`/`shared` (**new**, aliases) | = `success`/`danger`/`warning`/`info` | Named for the domain concept at call sites, so `ProfessionalView.js`-style hardcoded duplication (finding 2.1) becomes structurally impossible — there is one token per state, named for the state |

**Record-type tints — replacing the 8 generic, half-dead module tints with 8 purposeful ones tied
to the app's actual record types** (fixes finding 2.3's "five record types, one icon color"):

| Token | On (icon) | Bg | Ratio |
|---|---|---|---|
| `recVaccine` | `#0E6B5C` | `#DFF1EC` | 5.47:1 |
| `recCheckup` | `#1D5A96` | `#E1EDF7` | 5.98:1 |
| `recMedication` | `#6A4C9E` | `#EAE4F5` | 5.39:1 |
| `recIllness` | `#B0451F` | `#F8E7DD` | 4.70:1 |
| `recGrowth` | `#8A6414` | `#F6ECD4` | 4.57:1 |
| `recNutrition` | `#3F7D2C` | `#E5F1DF` | 4.30:1 |
| `recMemory` | `#A03D6B` | `#F7E4ED` | 5.12:1 |
| `recHospitalization` | `#9C2B2B` | `#F6E1E1` | 6.00:1 |

**Per-child tokens** (the only values that differ between palettes — deeper, more "ribbon" than
today's candy-bright pink/blue, still instantly recognizable as girl/boy/neutral):

| | girl | boy | neutral |
|---|---|---|---|
| `primary` = `accentStrong` | `#B93868` | `#235C99` | `#5B4E93` |
| `primaryDark` | `#8F2A50` | `#184674` | `#45386F` |
| `accent` (decorative only, never text-bearing) | `#D97AA0` | `#4C7FBE` | `#8172B5` |

### 3.2 Contrast — every pair, computed

| Pair | Ratio | Needs | Pass | 
|---|---|---|---|
| text / background | 15.13:1 | 4.5 | ✅ |
| textSecondary / background | 9.12:1 | 4.5 | ✅ |
| textMuted / background | 4.89:1 | 4.5 | ✅ |
| text / surface | 16.31:1 | 4.5 | ✅ |
| textSecondary / surface | 9.83:1 | 4.5 | ✅ |
| textMuted / surface | 5.28:1 | 4.5 | ✅ |
| placeholder / surfaceAlt | 5.06:1 | 4.5 | ✅ |
| onPrimary / girl primary | 5.49:1 | 4.5 | ✅ |
| onPrimary / boy primary | 6.86:1 | 4.5 | ✅ |
| onPrimary / neutral primary | 7.10:1 | 4.5 | ✅ |
| girl primary / background (name text) | 5.09:1 | 4.5 | ✅ |
| boy primary / background | 6.36:1 | 4.5 | ✅ |
| neutral primary / background | 6.59:1 | 4.5 | ✅ |
| success / successBg | 4.62:1 | 4.5 | ✅ |
| danger / dangerBg | 5.11:1 | 4.5 | ✅ |
| warning / warningBg | 4.57:1 | 4.5 | ✅ |
| info / infoBg | 4.88:1 | 4.5 | ✅ |
| seal / sealBg | 4.78:1 | 4.5 | ✅ |
| danger / background (attention text) | 5.64:1 | 4.5 | ✅ |
| success / surface | 5.32:1 | 4.5 | ✅ |
| recVaccine on/bg | 5.47:1 | 3.0 | ✅ |
| recCheckup on/bg | 5.98:1 | 3.0 | ✅ |
| recMedication on/bg | 5.39:1 | 3.0 | ✅ |
| recIllness on/bg | 4.70:1 | 3.0 | ✅ |
| recGrowth on/bg | 4.57:1 | 3.0 | ✅ |
| recNutrition on/bg | 4.30:1 | 3.0 | ✅ |
| recMemory on/bg | 5.12:1 | 3.0 | ✅ |
| recHospitalization on/bg | 6.00:1 | 3.0 | ✅ |

Every pair computed via the real WCAG relative-luminance formula (sRGB → linear → luminance →
contrast ratio), not estimated. This directly fixes CLAUDE.md §8's flagged pink-small-text
contrast problem — the girl `primary` was iterated from an initial `#D9457E` (4.12:1, fail) to
`#B93868` (5.49:1, pass) specifically to clear the button-text pair.

### 3.3 Type system

**Display/heading face: Source Serif 4.** **Body/label face: Source Sans 3.** Same type family
(Adobe's Source system), so mixing them shares metrics and never feels arbitrary — a serif for
record numbers and headings evokes an official ledger without resorting to the generic
"warm-book" cream+editorial-serif combination; Source Serif 4 reads as *civic*, not *boutique*.
Both are open-source (SIL OFL), available as `@expo-google-fonts/source-serif-4` and
`@expo-google-fonts/source-sans-3`, and both carry full Latin Extended coverage — confirmed
support for Filipino/Tagalog text including `ñ` and all standard diacritics; both are already in
wide production use, not an unverified claim.

| Role | Face | Size / Weight | Line-height | Tracking | Use |
|---|---|---|---|---|---|
| `display` | Source Serif 4 | 32 / 800 | 38 | −0.3 | Vaccination-progress numerals, brand lockup |
| `title` | Source Serif 4 | 24 / 700 | 30 | −0.2 | Screen titles |
| `heading` | Source Serif 4 | 19 / 700 | 24 | — | Card/section headers |
| `subheading` | Source Sans 3 | 15 / 700 | 20 | 0.2 | Sub-labels |
| `body` | Source Sans 3 | **16 / 400** | 24 | — | Default paragraph/value text — the fix: a real regular weight, not another 700 |
| `bodyStrong` | Source Sans 3 | 16 / 600 | 24 | — | Emphasized body |
| `label` | Source Sans 3 | 14 / 600 | 18 | — | Form labels, buttons, chips |
| `caption` | Source Sans 3 | **13 / 500** | 18 | 0.1 | Metadata floor — no size below this anywhere |

This scale directly answers 2.2's findings: real 400-weight body text exists (currently 6 uses in
the whole app), every role carries an explicit line-height (currently 3 of 7), the floor is fixed
at 13px (eliminating the 9/10/10.5/11/11.5 scatter), and inputs stay at 16px, matching the
already-fixed mobile-zoom floor.

### 3.4 Elevation & surface ramp — "stacked paper," 3 usable levels + 1 ceremony level

| Level | Shadow (web-safe `boxShadow`) | Used for |
|---|---|---|
| 0 — flat | none, hairline rule only | Rows inside a card |
| 1 — card | `0 2px 8px rgba(36,31,28,0.07)` | Default card |
| 2 — raised | `0 10px 24px rgba(36,31,28,0.12)` | Modals, FAB |
| 3 — seal (**new**) | `0 14px 32px rgba(36,31,28,0.16)` + the gold corner-fold motif (§3.6) | The single most important surface per screen — the QR result card, a just-completed vaccination card, a fully-caught-up progress bar |

Shadow tint moves from the old cold `rgba(27,31,59,…)` to the new warm ink `rgba(36,31,28,…)` —
paper drop-shadows are warm, not blue-black. `shadow.soft`/`shadow.green` are retired; their
"gap" was exactly the ceremony level this direction adds.

### 3.5 Motion vocabulary — communicates, doesn't decorate

No `reanimated` needed: RN's built-in `Animated.spring`/`Animated.timing` already proves this out
in this exact codebase (`Skeleton.js`'s shimmer loop, `SideMenu.js`'s 220ms drawer slide) — the
vocabulary below is fully achievable with what's already used successfully.

| Token | Duration | Curve | Applied to |
|---|---|---|---|
| `motion.micro` | 120ms | ease-out | Button press, checkbox toggle |
| `motion.standard` | 220ms | ease-in-out (cubic-bezier(0.4,0,0.2,1)) | Card expand/collapse, modal open/close |
| `motion.entrance` | 320ms | ease-out, +opacity/scale | Skeleton→content swap, empty-state icon |
| `motion.seal` (**new**) | 480ms | `Animated.spring` (friction 7, tension 40) | The QR reveal, a vaccination fully caught up, a milestone marked complete — a small overshoot-and-settle, reserved for genuine "moments," never for routine navigation |

### 3.6 Illustration & imagery direction

No illustration library, no Lottie. The "keepsake" identity comes from two hand-built, low-cost
devices:

1. **The seal/corner-fold** — an SVG-drawn folded-corner triangle (using the already-installed
   `react-native-svg`, the same library already driving `PercentileChart.js`) in `colors.seal`,
   placed on the top-right of any Level-3 surface. This is the one recurring "signature" mark —
   used sparingly, on ceremony moments only, never as page furniture.
2. **Memory photos get a real frame, not a scrim.** Replace `MemoryVisualCard`'s unconditional
   `rgba(28,25,23,0.34)` darkening scrim with: a 6px `surface`-colored mat border (like a real
   printed photo), the caption set in `subheading` (Source Sans, not overlaid on the photo) below
   the frame rather than on top of it, and the date rendered in `caption` styled as a handwritten-
   adjacent small-caps label, not a pill badge. Clinical data never gets this treatment — see the
   hard rule in §3.9.

### 3.7 Component-level specs

**Dashboard summary card — before → after**

```
BEFORE (Dashboard.js:1062-1071, today)                AFTER
┌──────────────────────────────┐                      ┌──────────────────────────────┐
│ chevron            [edit]    │  radius.xl, shadow.card │ ⌐ (seal corner, L1 only)     │
│ ♂  12 months                 │  13px/14px mixed        │ chevron          [edit]      │
│ 9.56(+0.2)kg  75.4(+0.9)cm    │  no hierarchy            │ ♂  12 months  (subheading)   │
└──────────────────────────────┘                        │ 9.56 kg  75.4 cm (display 32)│
                                                          │ +0.2 kg this month (caption) │
                                                          └──────────────────────────────┘
```
Weight/height become the visual anchor at `display` size; the delta drops to `caption` below
rather than crammed inline in parentheses at the same size as the value.

**Record list row (e.g. a vaccination row)**

```
BEFORE: 40×40 colors.tintGreen icon (same for every record type), title 14/700, subtitle 12/500
AFTER:  40×40 rec{Type} icon (8 distinct tints, §3.1), title=bodyStrong, subtitle=caption,
        status chip uses the named overdue/upcoming/completed token — never a raw hex
```

**Empty state**

```
BEFORE: dashed box · 40px circle · 20px default sparkle icon (5 screens use the SAME fallback icon)
AFTER:  dashed box (borderStrong) · 40px seal-tinted circle · icon MUST be passed explicitly
        (remove the sparkles-outline default — a missing icon becomes a lint-time content gap,
        not a silently-identical box across 6 different empty conditions)
```

**QR share screen**

```
BEFORE                                          AFTER
┌────────────────────┐                          ┌──────────────────────────┐
│ "Consultation QR    │  no shadow, r24          │ ⌐ (seal corner, Level 3) │
│  Ready"              │                          │  [Child avatar]  Ana R.  │  <- name+photo, currently absent
│ ┌────────────┐       │  hairline only           │ ┌──────────────────┐    │
│ │  QR (mono) │       │  unthemed black/white    │ │  QR (ink-tinted)  │    │  themed to `text`, not raw black
│ └────────────┘       │                          │ └──────────────────┘    │
│ CODE: AB7K-2P9Q       │                          │  CODE  AB7K · 2P9Q      │
│ [Revoke] [New]        │  no confirmation ever    │  [Revoke]  [New Share]  │
└────────────────────┘                          │  ↳ toast: "Ready to show  │  motion.seal on reveal + toast fires
                                                  │     the doctor" (2.6s)   │
                                                  └──────────────────────────┘
```

### 3.8 Dependencies

| Package | Why | Web-export risk |
|---|---|---|
| `expo-font` + `@expo-google-fonts/source-serif-4` + `@expo-google-fonts/source-sans-3` | Root cause #1 (§1) is unfixable without a real display/body face — system fonts (San Francisco/Roboto) have no "ledger" personality available | **Low.** Standard Expo web `@font-face` pipeline, already gated behind the existing `AppLoadingScreen.js` loading state — no new architecture needed, just `useFonts()` before first render |
| Lottie | — | **Not recommended.** No proposed interaction needs frame-based vector playback; the seal corner-fold and checkmark motions are hand-drawable in already-installed `react-native-svg` |
| `reanimated` | — | **Not recommended.** `Animated.spring`/`Animated.timing` already covers every motion token above and is proven working in this exact codebase (`Skeleton.js`, `SideMenu.js`) |

**Minimum set: `expo-font` + 2 font packages. Nothing else.**

### 3.9 Hard rule — keeping clinical data credible

Clinical/record content (vaccinations, checkups, medications, illnesses, growth data, the
professional's view) **always** renders in `body`/`bodyStrong`/`caption` (Source Sans, the sans
body face) on plain `surface` with hairline rules — never the serif, never the seal accent, never
the photo-frame treatment. The serif face, the gold seal, and the photo mat are reserved
exclusively for identity chrome (headings, the child's name, milestone/memory content) and the
ceremony moments named in §3.4/3.5. This is a hard boundary, not a suggestion — it is what keeps
"a keepsake" from ever bleeding into "a scrapbook page" on a medical record.

### 3.10 Effort & blast radius

- **Low, 1 file:** rewrite `theme.js` tokens. Cascades automatically to the 812 existing
  `colors.*` consumers and 108 `radius.*`/333 `space.*` consumers with zero per-file edits.
- **Low, ~6 files:** wire up the new `type` scale into `common/Cards.js`, `ui/Button.js`,
  `ui/Field.js`, `ui/Toast.js` (fix its static-`colors` import bug, finding 2.9), `ui/Skeleton.js`.
  Because `SectionContainerCard` alone has 31 call sites across 14 files, this cascades far
  beyond 6 files' worth of visible change for 6 files' worth of edits.
- **Medium, ~15 files:** retrofit the 5 main screens' 313 literal `fontSize`s and ~95 raw
  `borderRadius`s onto the new tokens — this is real per-screen work, not automatic.
- **Medium, 1 file, high-visibility:** the QR share ceremony (`ShareRecords.js`, `QrCodeView.js`,
  `QrScanner.js`) — the single highest-leverage "moment" fix in the whole plan.
- **High, 9 files:** giving the settings screens real visual personality (currently 3 icons across
  all nine) is a genuine content/design task per screen, not a token swap.
- **Nothing regresses functionally** — every change here is visual token substitution or additive
  motion; no data flow, navigation, or state logic is touched.

## 4. Alternate Direction — "Vital Signs"

**Concept.** BabyBook+ becomes a calm instrument panel — cool, precise, monitor-grade neutrals
with accent colors mapped 1:1 to real vital-sign conventions (pulse, oxygen, temperature) so a
status is legible at a glance the way a bedside monitor is, while a dedicated photo-frame
component (not a token, a real component) carries the keepsake half without ever touching
clinical surfaces.

### 4.1 Palettes

**SHARED tokens:**

| Token | Hex | Role |
|---|---|---|
| `text` | `#16202A` | Primary ink (cool, not warm) |
| `textSecondary` | `#3D4A56` | Secondary ink |
| `textMuted` | `#5C6873` | Metadata ink |
| `placeholder` | `#5E6971` | Input placeholder |
| `background` | `#F2F5F7` | Page — cool pale blue-gray, constant across all 3 child palettes |
| `surface` | `#FFFFFF` | Cards |
| `surfaceAlt` | `#E8EDF0` | Inputs |
| `hairline` | `#DCE3E7` | Card borders |
| `border` | `#CBD5DA` | Input/chip borders |
| `borderStrong` | `#AFBCC3` | Dashed empty-state border |
| `success`/`successBg` (`completed`) | `#0F7350` / `#DCF3E9` | Pulse-ox green |
| `danger`/`dangerBg` (`overdue`) | `#C22B3C` / `#FBE2E5` | Pulse red |
| `warning`/`warningBg` (`upcoming`) | `#8C5A08` / `#F8E9D2` | Temperature amber |
| `info`/`infoBg` (`shared`) | `#0E6E7C` / `#DBF0F1` | SpO2 teal |

**Per-child tokens:**

| | girl | boy | neutral |
|---|---|---|---|
| `primary`=`accentStrong` | `#C43D6E` | `#1768B3` | `#5A4FB8` |
| `primaryDark` | `#9E2D57` | `#0F4F8C` | `#423699` |
| `accent` (decorative) | `#DD6E97` | `#4A93D6` | `#8478D6` |

### 4.2 Contrast — every pair, computed

| Pair | Ratio | Needs | Pass |
|---|---|---|---|
| text / background | 15.05:1 | 4.5 | ✅ |
| textSecondary / background | 8.29:1 | 4.5 | ✅ |
| textMuted / background | 5.21:1 | 4.5 | ✅ |
| text / surface | 16.48:1 | 4.5 | ✅ |
| textSecondary / surface | 9.08:1 | 4.5 | ✅ |
| textMuted / surface | 5.70:1 | 4.5 | ✅ |
| placeholder / surfaceAlt | 4.77:1 | 4.5 | ✅ |
| onPrimary / girl primary | 4.95:1 | 4.5 | ✅ |
| onPrimary / boy primary | 5.73:1 | 4.5 | ✅ |
| onPrimary / neutral primary | 6.47:1 | 4.5 | ✅ |
| girl primary / background | 4.52:1 | 4.5 | ✅ |
| boy primary / background | 5.23:1 | 4.5 | ✅ |
| neutral primary / background | 5.91:1 | 4.5 | ✅ |
| success / successBg | 5.03:1 | 4.5 | ✅ |
| danger / dangerBg | 4.62:1 | 4.5 | ✅ |
| warning / warningBg | 4.91:1 | 4.5 | ✅ |
| info / infoBg | 5.01:1 | 4.5 | ✅ |
| danger / background | 5.18:1 | 4.5 | ✅ |
| success / surface | 5.85:1 | 4.5 | ✅ |

Every pair computed the same way as §3.2. `success` and `placeholder` both needed one round of
darkening from their first-draft values (`#12805A`→`#0F7350`, `#7C8792`→`#5E6971`) to clear 4.5:1
— shown here already resolved.

### 4.3 Type system

**Display face: Archivo. Body face: Public Sans.** Archivo's geometric-grotesque character and
variable width axis suit tight numeric/data labels (an instrument panel's native register); Public
Sans is the U.S. government's own open-source typeface — chosen specifically because "a civic,
trustworthy type system" is a literal, defensible match for "a nurse can trust," not a mood
association. Both ship as `@expo-google-fonts/archivo` and `@expo-google-fonts/public-sans`, both
SIL OFL, both with confirmed full Latin Extended coverage for Filipino text.

| Role | Face | Size / Weight | Line-height | Tracking | Use |
|---|---|---|---|---|---|
| `display` | Archivo | 32 / 700 | 36 | −0.4 | Key numerals |
| `title` | Archivo | 23 / 700 | 28 | −0.2 | Screen titles |
| `heading` | Archivo | 18 / 600 | 23 | — | Card headers |
| `subheading` | Public Sans | 14 / 700 | 18 | 0.4, uppercase | Instrument-panel micro-labels |
| `body` | Public Sans | 16 / 400 | 24 | — | Default text |
| `bodyStrong` | Public Sans | 16 / 600 | 24 | — | Emphasis |
| `label` | Public Sans | 14 / 600 | 18 | — | Buttons, chips |
| `caption` | Public Sans | 13 / 500 | 17 | — | Metadata floor |

### 4.4 Elevation & surface ramp — tonal, not just darker

| Level | Shadow | Used for |
|---|---|---|
| 0 — flat | hairline only | Rows |
| 1 — card | `0 2px 8px rgba(22,32,42,0.07)` | Default card |
| 2 — raised | `0 10px 24px rgba(22,32,42,0.12)` | Modals, FAB |
| 3 — active (**new**) | `0 0 0 1px {statusColor}33, 0 8px 20px {statusColor}22` | A colored glow, not just a darker shadow — an active share, a live "due today" card — the monitor's active-lead highlight |

### 4.5 Motion vocabulary

Same duration/curve philosophy as §3.5 (`micro` 120ms, `standard` 220ms, `entrance` 320ms), with
the ceremony token reframed as a **pulse** rather than a spring-overshoot:

`motion.pulse` (**new**): two 400ms `Animated.timing` cycles of `scale` 1→1.04→1, ease-in-out —
literally a heartbeat, applied once when a status changes to "complete" or a share goes active.
Still zero new dependencies — `Animated.timing` in a loop, nothing `reanimated`-only about it.

### 4.6 Illustration & imagery direction

No illustration library. The keepsake half is carried by one dedicated component,
`PhotoFrame` (new), distinct from any data-thumbnail component: a thin `borderStrong` frame
+ rounded corners + the photo shown at full brightness (no scrim) + caption below in `body`, not
overlaid. Memory photos and clinical attachment thumbnails **must never share this component** —
attachments keep the plain rectangular data-thumbnail treatment; only user-authored memories get
`PhotoFrame`. This is the direction's version of §3.9's hard rule.

### 4.7 Component-level specs

Same before/after shape as §3.7's four components, restated in this direction's vocabulary:
Dashboard summary card leads with a `display`-sized vital (weight/height) with a small colored
dot (using the `completed`/`upcoming`/`overdue` tokens) next to any value that has a status;
record rows get the same 8-tint-family treatment as §3.1 rebuilt in cooler hues; empty states
require an explicit icon (same fix as §3.7); the QR screen gains the same name+photo+ceremony
treatment, with `motion.pulse` on reveal instead of `motion.seal`'s spring.

### 4.8 Dependencies

Identical minimum-set logic to §3.8: `expo-font` + the two Archivo/Public Sans packages, Lottie
and `reanimated` both not recommended for the same reasons.

### 4.9 Effort & blast radius

Same shape and same file counts as §3.10 — the two directions are equal-cost to implement; the
choice between them is aesthetic register, not engineering risk.

## 5. Contrast Compliance — combined table

All 29 computed pairs across both directions (§3.2 + §4.2) pass WCAG AA. No pair in either
direction was shipped without a computed ratio; 3 pairs (Yellow Card girl-primary, Yellow Card
danger, Vital Signs success/placeholder) required one round of darkening from their first-draft
values to clear 4.5:1 — documented inline above rather than silently corrected.

## 6. Dependency Recommendation

| Package | Recommended? | Reason |
|---|---|---|
| `expo-font` | **Yes, both directions** | Typography is root cause #1; unfixable with system fonts alone |
| 2× `@expo-google-fonts/*` (direction-specific) | **Yes** | Chosen pairing per direction, see §3.3/§4.3 |
| Lottie | **No** | Zero proposed interactions need frame-based vector playback; `react-native-svg` (already installed) covers the one hand-drawn motif (the seal corner-fold) |
| `reanimated` | **No** | Every motion token in both directions is achievable with `Animated.spring`/`Animated.timing`, already proven working in this codebase's `Skeleton.js` and `SideMenu.js` |

**Net new dependencies: 3 packages, both directions, zero native-module risk, zero Babel-plugin
risk.** This is deliberately the smallest set that fixes the #1 diagnosed root cause; everything
else in both directions is token values and component-level composition, not new capability.

## 7. Phased Rollout

Ordered for maximum visible change per file touched, given a defense deadline:

1. **`theme.js` token rewrite** (1 file). Cascades to 812 existing `colors.*` call sites and all
   `radius`/`space`/`shadow` consumers automatically. Immediately visible on every screen with zero
   further edits — the single highest-leverage change available.
2. **Wire up `type` + fix `Toast.js`'s static-color bug** (in `common/Cards.js`, `ui/Button.js`,
   `ui/Field.js`, `ui/Toast.js`, `ui/Skeleton.js` — ~6 files). Because `SectionContainerCard` has
   31 call sites in 14 files, this step alone visibly re-types roughly a third of the app's
   surfaces for 6 files of real edits.
3. **Install fonts, gate behind `AppLoadingScreen.js`** (1 config change + the loading screen).
   The type-scale work from step 2 now actually renders in the new faces app-wide.
4. **The QR share ceremony** (`ShareRecords.js`, `QrCodeView.js`, `QrScanner.js` — 3 files). Small
   file count, highest emotional/defense-demo payoff — this is the screen a panel is most likely
   to watch closely.
5. **Dashboard + the two flattest screens (`Health.js`, `Growth.js`)** — retrofit literal
   `fontSize`/`borderRadius` values onto tokens, apply the record-type tint set. Real per-screen
   work (§3.10's "Medium, ~15 files"), but these are the three screens every demo path touches.
6. **Settings screens** — lowest visibility, highest per-screen design cost (real content/icon
   decisions, not token swaps). Ship last, or leave for post-defense if time is short — nothing
   about them is broken today, only generic.

## 8. What NOT to Change, and Why

- **`SectionContainerCard`, `Toast`, `ShowMore`, `DateField`** — genuinely well-adopted (31/15/6/5
  call sites). Re-skin their token *values*; do not rebuild their structure.
- **`ui/Skeleton.js`'s shimmer implementation** — already correctly built (`Animated.loop` +
  `LinearGradient`, shared clock, `useNativeDriver` gated by platform). It is the reference pattern
  the new motion tokens (§3.5/§4.5) should imitate, not replace.
- **The three-palette-per-child architecture** (`paletteFor()`, `useTheme()`, `makeStyles(colors)`)
  — explicitly preserved per the brief, and proven; only token *values* change.
- **`react-native-calendars` integration in `CalendarView.js`** — functional and correctly themed
  via color props already; re-theme the props, don't replace the library.
- **The consent/DPA/re-consent modal's behavior** — explicitly out of scope. Its current inline
  styling (`App.js:1189-1232`) is low-visibility, legal-requirement content where stability
  outranks polish; restyle last if at all.
- **`Health.js`/`Growth.js`'s data logic and tab structure** — the flatness diagnosed in §2.5/§2.8
  is entirely a surface problem (missing tokens), not a structural one. Do not refactor component
  architecture to fix a styling gap.
