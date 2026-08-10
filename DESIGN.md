---
name: BabyBook+
description: A parent-held child health record that stays tender for the family and credible for the clinician.
colors:
  rose-pink: "#EC4F96"
  rose-pink-deep: "#D43D82"
  rose-pink-light: "#FF7EB3"
  rose-bg: "#FFF2F8"
  rose-surface-alt: "#FFF7FB"
  rose-border: "#F7DBE9"
  rose-border-strong: "#F0C4DB"
  rose-hairline: "#FBE9F1"
  azure-blue: "#2F7BF6"
  azure-blue-deep: "#1F66DB"
  azure-blue-light: "#5B9DFF"
  azure-bg: "#EEF4FF"
  azure-surface-alt: "#F5F9FF"
  azure-border: "#D9E4F6"
  azure-border-strong: "#C2D5F0"
  azure-hairline: "#EAF1FB"
  periwinkle-indigo: "#5B6CFF"
  periwinkle-indigo-deep: "#4A5AE8"
  periwinkle-violet: "#8A6BFF"
  periwinkle-bg: "#F4F6FF"
  periwinkle-surface-alt: "#FAFBFF"
  periwinkle-border: "#E7E9F5"
  periwinkle-border-strong: "#D5D8EE"
  periwinkle-hairline: "#F0F2FB"
  navy-ink: "#1B1F3B"
  navy-ink-secondary: "#3A4066"
  navy-ink-muted: "#5B618A"
  placeholder-gray: "#9AA0B4"
  surface-white: "#FFFFFF"
  balanced-green: "#2BB673"
  balanced-green-bg: "#E3F6EC"
  soft-red-coral: "#EF5D6A"
  soft-red-coral-bg: "#FDE8EA"
  warm-amber: "#FFB347"
  saturated-teal: "#16B8A6"
  tint-green: "#E4EFE7"
  tint-coral: "#FFE7E1"
  tint-blue: "#E3EEFB"
  tint-amber: "#FFF1DE"
  tint-violet: "#EDE7FA"
  tint-teal: "#E2FBF3"
  tint-pink: "#FFE3EE"
  tint-indigo: "#E7ECFF"
typography:
  display:
    fontFamily: "System"
    fontSize: "28px"
    fontWeight: 800
    letterSpacing: "-0.4px"
  title:
    fontFamily: "System"
    fontSize: "22px"
    fontWeight: 800
    letterSpacing: "-0.2px"
  heading:
    fontFamily: "System"
    fontSize: "18px"
    fontWeight: 800
    letterSpacing: "-0.1px"
  body:
    fontFamily: "System"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "22px"
  bodyStrong:
    fontFamily: "System"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "22px"
  label:
    fontFamily: "System"
    fontSize: "14px"
    fontWeight: 700
  caption:
    fontFamily: "System"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
rounded:
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.rose-pink}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.rose-pink}"
    textColor: "{colors.surface-white}"
  button-secondary:
    backgroundColor: "{colors.tint-pink}"
    textColor: "{colors.rose-pink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.rose-pink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.soft-red-coral-bg}"
    textColor: "{colors.soft-red-coral}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "48px"
  card-section:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.xl}"
    padding: "18px"
  card-list-entry:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.lg}"
    padding: "12px"
  input-field:
    backgroundColor: "{colors.rose-surface-alt}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "52px"
  chip-filter:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.navy-ink-muted}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip-filter-active:
    backgroundColor: "{colors.tint-pink}"
    textColor: "{colors.rose-pink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  nav-tab-active:
    backgroundColor: "{colors.rose-surface-alt}"
    textColor: "{colors.rose-pink}"
    rounded: "{rounded.pill}"
    width: "56px"
    height: "32px"
  fab:
    backgroundColor: "{colors.rose-pink}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.pill}"
    width: "56px"
    height: "56px"
---

# Design System: BabyBook+

## Overview

**Creative North Star: "A keepsake a nurse can trust"**

Two people look at these screens and need opposite things from them. A parent, at home on a Tuesday night, is adding a feed or a photo to something that will outlive the app — they need warmth, ease, and the sense that they are tending to something precious. A clinician, handed a phone across a consultation table with ninety seconds to spare, needs to believe what they are reading. The system refuses to choose between them. Every surface is soft enough to be a keepsake and exact enough to be a record.

That tension resolves through a strict division of labor. Color is expressive and changes constantly — the entire interface re-tints to the selected child, rose for a girl, azure for a boy, periwinkle before a child is chosen. Everything structural refuses to move: the ink stays the same deep navy in all three palettes, the shadows are always colorless, the status vocabulary (green, coral, amber, teal) is identical everywhere, and the eight module tints never shift a degree of hue. A parent switching between two children sees the app change clothes, not change shape. That constancy is what makes the record legible to a stranger who has never opened it before.

The register is **warm but precise**. Generous corner radii and pastel grounds do the warming; a heavy weight ladder, a disciplined four-point spacing grid, and unambiguous semantic color do the work. The explicit anti-reference is the cutesy baby app that trades legibility for decoration — pastel mush, script faces, sticker clutter, illustration where data belongs. Softness here is a surface treatment, never a substitute for structure. Nothing in this system should ever make a clinician squint, and nothing should ever make a parent feel they are reading a hospital chart about their own child.

**Key Characteristics:**
- Three runtime palettes over one unchanging chassis; the child selects the hue
- Deep navy ink and colorless shadows anchor every palette identically
- Squircle geometry throughout (`borderCurve: "continuous"`), never plain circular rounding
- Hierarchy carried by font weight (800/700/500) more than by size
- Semantic status color is shared, fixed, and never decorative
- White cards floating on a tinted ground, each with both a hairline border and a shadow

## Colors

A tri-palette system: one of three brand hues rides on top of a fixed neutral, tint, and status foundation that is byte-identical across all three.

### Primary

The primary is whichever of these three is active. They are peers, not a primary plus variants — no screen is ever designed against just one.

- **Vivid Rose Pink** (`#EC4F96`): The girl palette's primary. Drives buttons, active navigation, links, section accents, and the FAB whenever the selected child is female.
- **Clear Azure Blue** (`#2F7BF6`): The boy palette's primary, occupying every role Vivid Rose Pink does. Deliberately equal in saturation and weight so no layout shifts perceptually when the palette swaps.
- **Soft Periwinkle Indigo** (`#5B6CFF`): The neutral palette's primary. Used before a child is selected — authentication, landing, registration — and throughout the healthcare professional's portal, where a child's gender should not color a clinical reading.

Each carries a deepened variant for pressed and hover states (`#D43D82`, `#1F66DB`, `#4A5AE8`) and a lightened partner used as the second gradient stop (`#FF7EB3`, `#5B9DFF`, `#8A6BFF`).

### Neutral

The ink ramp is shared by all three palettes and never re-tints.

- **Deep Navy Ink** (`#1B1F3B`): All primary text, headings, and titles. A desaturated blue-black rather than true black, which keeps long lists from feeling harsh.
- **Navy Ink Secondary** (`#3A4066`): Field labels, note text, and supporting copy inside list rows.
- **Navy Ink Muted** (`#5B618A`): Metadata, timestamps, inactive tab labels, section subtitles, and group headers.
- **Placeholder Gray** (`#9AA0B4`): Input placeholders only. Deliberately lighter than muted ink so an empty field is never mistaken for a filled one.
- **Surface White** (`#FFFFFF`): Every card and elevated surface, plus text and icons sitting on a filled brand button.

Each palette contributes its own tinted grounds and borders — a page background, a subtler alternate surface, and three border weights (`hairline` for cards, `border` for inputs and chips, `borderStrong` for dashed empty states). These are the only structural values that re-tint.

### Secondary

Eight fixed module tints, identical in all three palettes. They exist to color-code categories — the 40×40 icon container on a list row, a module badge — so a record type is recognizable before its label is read.

- **Tint Green** (`#E4EFE7`) · **Tint Coral** (`#FFE7E1`) · **Tint Blue** (`#E3EEFB`) · **Tint Amber** (`#FFF1DE`) · **Tint Violet** (`#EDE7FA`) · **Tint Teal** (`#E2FBF3`) · **Tint Pink** (`#FFE3EE`) · **Tint Indigo** (`#E7ECFF`)

### Tertiary

Status color, shared and fixed. This is the vocabulary a clinician reads fastest, so it is the one thing in the system that is never restyled for expression.

- **Balanced Green** (`#2BB673`) on **Balanced Green Bg** (`#E3F6EC`): Completed, done, on schedule, healthy.
- **Soft Red-Coral** (`#EF5D6A`) on **Soft Red-Coral Bg** (`#FDE8EA`): Overdue, error, destructive action, header notification badge.
- **Warm Amber** (`#FFB347`): Due soon, needs attention, caution. Never used for a hard failure.
- **Saturated Teal** (`#16B8A6`): Informational and, specifically, the active-share notice — the state where a professional currently holds access to this child's records.

### Named Rules

**The Quiet Chassis Rule.** Only `primary`, `background`, `surfaceAlt`, and the three border weights change between palettes. Ink, tints, statuses, and shadows are frozen. If a new token needs to differ per palette, it belongs in the palette blocks; if it doesn't, it belongs in `SHARED` — and the default is `SHARED`.

**The Three Books Rule.** Every screen must be checked in rose, azure, *and* periwinkle before it ships. A composition that only reads well against one hue is not finished. Never hard-code a brand hex in a component; read it from `useTheme()`.

**The Status Is Not Decoration Rule.** Green, coral, amber, and teal carry meaning. Never reach for one because a card needed a color — a green chip that doesn't mean "complete" corrupts the only palette a clinician can scan without reading.

## Typography

**Display / Body / Label Font:** System (San Francisco on iOS, Roboto on Android)

**Character:** No custom typeface is loaded, and that is the correct decision rather than an omission. On an adaptive product, the system face is what makes the app feel native on each OS, and it inherits Dynamic Type and the Android font-size setting for free. Personality comes from weight and rhythm, not from a display face. The result is heavy, tight, and confident — closer to a well-set chart label than to a nursery poster.

### Hierarchy

- **Display** (800, 28px, -0.4px tracking): Screen-defining numbers and the largest headline moments. One per screen at most.
- **Title** (800, 22px, -0.2px tracking): Screen titles and major section openers.
- **Heading** (800, 18px, -0.1px tracking): Card and section headers — the `SectionContainerCard` title.
- **Body** (500, 16px, 22px leading): Default reading size and the minimum for any text input.
- **Body Strong** (700, 16px, 22px leading): List row titles, record names, emphasized values inside body copy.
- **Label** (700, 14px): Field labels, button text, chip text, and tab labels.
- **Caption** (500, 13px, 18px leading): Timestamps, metadata, section subtitles, helper text.

Negative tracking tightens only at 18px and above, where default spacing reads loose; body and below stay at normal tracking for legibility.

### Named Rules

**The 16px Floor Rule.** No body text and no text input goes below 16px. Below that, mobile browsers auto-zoom on focus — which yanks the layout sideways mid-task — and small text fails the parents and grandparents this product is for. 13px is the absolute floor for any text on screen, reserved for captions and metadata.

**The Weight Ladder Rule.** Adjacent steps in this scale are close in size (16 → 18 → 22), so **weight** separates them, not size. Hierarchy runs 800 → 700 → 500. Never introduce a new level by inventing a size between two existing steps; change the weight instead.

### Known debt

Components hard-code their own `fontSize` literals — 311 of them across 36 files — rather than importing the `type` scale from `theme.js`. The scale above is corrected and normative for all new work, but the shipped app still renders 15px body text and 12px captions in most places. New screens must use the values above. Migrating existing screens is real, tracked work, not a formality.

## Layout

Single-column and mobile-first throughout. A screen is a vertical `ScrollView` of stacked cards over the palette's tinted background, framed by a fixed header above and a bottom tab bar below.

Spacing comes from a **four-point scale** — 4 / 8 / 12 / 16 / 24 / 32. Screen gutters and card-internal padding sit at 16px (section cards use 18px, the one deliberate half-step). Cards separate from one another by 16px; rows inside a card separate by 8px. Vertical rhythm inside a card runs 16px below the header, then 8px between entries.

The header is a 42px-tall row of icon buttons flanking the child's name, on the page background rather than a distinct bar — it reads as part of the page, not a chrome band. The bottom tab bar sits on white with a hairline top border, five equal-flex destinations, each a 56×32 pill above an 11px label. The FAB floats 92px from the bottom and 16px from the right, clearing the tab bar.

Content is dense by design. List rows are compact (12px padding, 40px icon, two-to-three text lines) because a parent scrolling a year of vaccinations should see many at once. Long lists cap at 10 entries with a "Show more" control rather than paginating.

### Named Rules

**The Four-Point Rule.** Every margin, padding, and gap resolves to a step on the 4-point scale. An arbitrary `marginTop: 7` is a bug, not a nudge.

## Elevation & Depth

The system is **layered and lifted**. Surfaces genuinely float, and the height of that float encodes importance. A card at rest sits barely off the page; a button that wants to be pressed sits clearly above it; the FAB sits above everything. Depth is reinforced — never replaced — by a 1px hairline border on cards and by the tonal step from the tinted page background up to a white surface. The border and the shadow do different jobs: the border defines the edge crisply at any zoom, the shadow states the rank.

### Shadow Vocabulary

- **Card** (`0 2px 10px rgba(27,31,59,0.06)`): The resting state of every content card. Barely there.
- **Soft** (`0 4px 14px rgba(27,31,59,0.07)`): Photo and memory cards — slightly more lift so imagery reads as a physical print.
- **Raised** (`0 10px 24px rgba(27,31,59,0.10)`): Filled buttons at rest, and modal sheets.
- **Accent** (`0 10px 22px rgba(27,31,59,0.12)`): The floating action button.
- **Green** (`0 12px 26px rgba(27,31,59,0.12)`): The highest step, reserved for the single most prominent surface on a screen.

### Named Rules

**The Lift Ladder Rule.** The five shadow steps map to five levels of importance, in order: card → soft → raised → accent → green. A surface's shadow states its rank. Two surfaces at the same rank take the same step; never pick a shadow because it "looked better."

**The Colorless Shadow Rule.** Every shadow is Deep Navy Ink at low alpha (`rgba(27,31,59,…)`), never brand-tinted, in every palette. Depth is structural and color is expressive, and they never trade jobs. A pink shadow under a pink button is the single fastest way to make this system look cheap.

## Shapes

Soft, generous, and unmistakably continuous. The radius scale runs 10 / 14 / 20 / 24 with a 999px pill, and it maps by surface size: small inline elements at 10px, icon containers and sheet rows at 14px, list cards and inputs at 20px, section cards and bottom sheets at 24px, and anything interactive-and-compact at full pill.

Every rounded surface sets `borderCurve: "continuous"` — squircle geometry rather than a circular arc. It is a small difference per corner and a large one in aggregate; it is the single detail that most separates this app from a default-styled one.

Borders are hairline-thin (1px) and tinted with the active palette, in three weights: `hairline` for card edges, `border` for inputs and unselected chips, `borderStrong` for the dashed empty-state outline. The dashed border is reserved exclusively for emptiness — a dashed edge anywhere else reads as a broken image.

Icon containers are a recurring silhouette: a 40×40 rounded square at 14px radius, filled with one of the eight module tints, holding a 20px outline icon. It appears on every list row across every screen and is the closest thing the system has to a mascot.

### Named Rules

**The Continuous Corner Rule.** Any element with a `borderRadius` also sets `borderCurve: "continuous"`. No exceptions, including circles-by-radius like the FAB.

## Components

Buttons, cards, inputs, and chips are **tactile and confident**. Controls answer back — they dim on hover, compress on press, tick haptically, and show an unmissable focus ring. A control that does nothing visible when touched is a defect in this system, not a stylistic choice.

### Buttons

- **Shape:** Full pill (999px), continuous curve, 48px minimum height (44pt touch floor plus 4), 16px horizontal padding, 8px gap between icon and label.
- **Primary:** Active palette primary, white label at 800 weight / 15px, no border, `raised` shadow at rest.
- **Accent:** Identical to primary but keyed to `accentStrong` — used where a primary already occupies the screen.
- **Secondary:** The palette's soft brand tint with a primary-colored label and a 1px border; flat, no shadow.
- **Ghost:** Transparent with a primary label and a 1px border; flat.
- **Danger:** Coral tint background with coral label; flat, reserved for destructive confirmation.
- **Hover:** Opacity drops to 0.94.
- **Pressed:** Scales to 0.985 and drops its shadow, plus a haptic selection tick where `expo-haptics` is available.
- **Focus:** A 3px ring in the variant's own color at ~35% alpha. Never removed.
- **Disabled:** Opacity 0.55; loading swaps the label for a spinner in the label's color and blocks input.

### Chips

- **Style:** Pill, 12px × 6px padding, white background, 1px palette border, 14px/700 muted-ink label.
- **Selected:** Background flips to the soft brand tint, border and label to the palette primary. Fill plus color, never color alone.

### Cards / Containers

- **Section Container** — the primary content unit. 24px radius, white, 18px padding, 1px hairline border, `card` shadow, 16px bottom margin. Header row holds an 18px/800 title, an optional 13px muted subtitle, and a right-aligned action slot.
- **List Entry** — 20px radius, white, 12px padding, 1px hairline border, 8px bottom margin. A tinted 40×40 icon square, then a text column (16px/700 title, optional inline label chip, 13px muted subtitle, italic quoted note), then an optional 46px thumbnail and action slot.
- **Memory Visual** — 22px radius, 180px tall, full-bleed photo under a `rgba(28,25,23,0.34)` scrim, `soft` shadow. Content bottom-aligned: a translucent white date pill with accent-colored 10px/800 text, then a white 16px/800 title and a 12px description at 88% white.
- **Empty State** — the only dashed surface in the system. 20px radius, soft brand tint fill, 1px dashed `borderStrong` outline, a 40px white circular icon badge in the palette primary, and centered 13px/600 secondary-ink copy.

### Inputs / Fields

- **Style:** 52px minimum height, `surfaceAlt` fill, 1px palette border, 20px radius, 16px horizontal padding, 16px text in primary ink. Label sits above at 14px/700 in secondary ink.
- **Placeholder:** Placeholder Gray — never the muted ink used for real content.
- **Error:** Border switches to Soft Red-Coral and a 13px coral message replaces the helper text below. Errors are inline and selectable; never an `alert()`.
- **Helper:** 13px muted ink below the field, displaced by the error when one exists.

### Navigation

- **Bottom tab bar:** White, 1px hairline top border, five equal destinations. Active state is a 56×32 pill in `softCoral` behind the icon, with the label switching to accent color at 800 weight; inactive labels are 11px/600 muted ink.
- **Header:** 42px rounded-square icon buttons (20px radius, soft brand tint fill) at either end — QR share on the left group, hamburger menu on the right. The child's name sits at 16px/800 in the palette primary. Notification counts ride as a coral badge, 18px minimum, ringed 2px in white.
- **Side menu:** Slide-in drawer from the right, grouped into Account / Application / Support / Security / Session.

### Signature Component: The Log Sheet

The floating action button and its action sheet are the system's most-used path. A 56px circular FAB in `accentStrong` with the `accent` shadow floats above the tab bar on every screen. Tapping it fades in a bottom sheet: 24px top corners, page-background fill, a centered 16px/800 title, then a scrollable list (capped at 420px) of nine white rows — each 48px tall, 14px radius, hairline-bordered, with a 20px primary-colored icon and a 14px/700 label — over a `rgba(28,25,23,0.45)` scrim. A full-width cancel row closes it.

It is the one component that must never grow slower or more decorated. Every millisecond and every tap between the FAB and a saved record is friction on the app's most repeated action.

## Do's and Don'ts

### Do:
- **Do** read every color from `useTheme()`'s `colors` object, and check new work in all three palettes before calling it done.
- **Do** set `borderCurve: "continuous"` on every element that has a `borderRadius`.
- **Do** keep shadows colorless — `rgba(27,31,59,…)` — and pick the step by importance using the Lift Ladder.
- **Do** use 16px as the floor for body text and every text input, and 13px as the absolute floor for any text at all.
- **Do** separate hierarchy levels by weight (800 / 700 / 500) before reaching for a larger size.
- **Do** resolve every spacing value to the 4-point scale (4 / 8 / 12 / 16 / 24 / 32).
- **Do** give every interactive control a visible hover, a press response, and a 3px focus ring.
- **Do** pair color with a second signal — fill, icon, or text — so a state never depends on hue alone.
- **Do** cap long lists at 10 entries with a "Show more" control.
- **Do** reserve the dashed border for empty states exclusively.

### Don't:
- **Don't** hard-code a brand hex in a component. White is permitted only for text and icons sitting on a filled colored surface.
- **Don't** tint a shadow with the brand color, in any palette, ever.
- **Don't** use a status color decoratively. Green means complete, coral means overdue or destructive, amber means due soon, teal means informational or actively shared.
- **Don't** design a layout that only reads correctly in one of the three palettes.
- **Don't** introduce a custom typeface. The system face is what makes this feel native on both iOS and Android.
- **Don't** invent a font size between two scale steps, or ship body text below 16px in new work.
- **Don't** add a control that gives no visual feedback on press.
- **Don't** replace inline field errors with `alert()`.
- **Don't** let the FAB action sheet accumulate decoration or delay — it is the highest-traffic path in the app.
- **Don't** soften legibility for charm. The anti-reference is the cutesy baby app: pastel mush, script faces, sticker clutter, illustration standing in for data.
