# BabyBook+ — Responsive & Adaptive UI System

Implementation-ready guidelines to make BabyBook+ look and work well on **phones,
tablets, laptops/desktops, and large screens**, with consistent components, accessible
typography, and modern interaction feedback. Builds on the existing design system
(`theme.js`, `Button`, `Field`, `Toast`, `DateField`).

---

## 1. Target Users (design implications)

- **Filipino parents & guardians (children 0–6)** — mixed ages and digital literacy, often
  **one-handed, mid-range Android phones**, variable connectivity. → Phone-first,
  thumb-reachable controls, big tap targets, high contrast, plain language, multilingual.
- **Healthcare professionals** (scan QR to view) — quick, glanceable, zero learning curve;
  may use a **tablet** at a clinic desk. → The professional view should use tablet width well.
- **Web use** (Expo web / defense demo on a laptop) — must not look empty or stretched on
  wide screens. → Cap content width, center it, and use multi-column grids.

**Design stance:** phone-first, then progressively enhance for larger screens. Never let a
desktop layout be a stretched phone layout.

---

## 2. Responsive Foundation (delivered)

New primitives (compile-verified):

- **`utils/responsive.js` → `useResponsive()`** returns: `width`, `bp` (`sm/md/lg/xl`),
  `isPhone/isTablet/isDesktop`, `ms(size)` (moderate type scaling), `columns` (1/2/3),
  `contentMaxWidth`, and `gutter` (adaptive edge padding).
- **`components/ui/Screen.js`** — the adaptive page container: fills phones, **centers and
  caps content width** on tablet/desktop (no stretched lines, no empty feel), applies the
  adaptive gutter, and scrolls with keyboard handling.
- **`components/ui/Grid.js`** — responsive grid: **1 column phone · 2 tablet · 3 desktop**.
- **`Button` upgraded** — now a `Pressable` with **hover** (web), **pressed** (scale/opacity),
  and **keyboard focus ring** states, plus haptics.

### Breakpoints
| Name | Width (dp) | Device | Columns | Content max-width | Gutter |
|------|-----------|--------|---------|-------------------|--------|
| sm | < 600 | Phone | 1 | full | 16 |
| md | 600–899 | Tablet / large phone | 2 | 620 | 20 |
| lg | 900–1199 | Laptop / small desktop | 3 | 760 | 24 |
| xl | ≥ 1200 | Large / wide screen | 3 | 760 (centered) | 24 |

---

## 3. Component Redesign Specs

### A. Typography & text
- Use the **`type` scale** (Display 26 · Title 20 · Heading 17 · Body 15 · Label 13 · Caption 12).
- **Scale up gently on big screens** with `ms()` (e.g. `fontSize: ms(15)` → ~16–18 on desktop).
- Line height ≈ 1.35× for body; **left-align** paragraphs, **center only** short titles/tabs.
- Never below **12px**; all text meets **AA contrast** via `theme.js` tokens.

### B. Buttons & interactive elements
- One `Button` component, variants `primary/accent/secondary/ghost/danger`.
- **48px min height**, pill radius; **states:** default → hover (web, subtle dim) → pressed
  (scale 0.985) → focus (3px ring) → disabled (55% opacity). Loading shows a spinner.
- On desktop, buttons in forms can be `fullWidth={false}` and right-aligned; on phones keep
  them full-width for thumb reach.

### C. Forms & inputs
- One `Field` component: label + input + **inline error/helper** (no pop-ups).
- **48px input height**, 15px text, AA borders; error state turns the border red with a
  message below.
- **Group fields**; on tablet/desktop lay pairs side-by-side (`flexDirection: row` when
  `!isPhone`), single-column on phones. Use `DateField` for dates.

### D. Icons & imagery
- Standardize on **Ionicons** app-wide; consistent 18–22px sizes; every icon-only control
  gets an `accessibilityLabel`.
- Images use `cover` sizing inside fixed-ratio cards; provide graceful placeholders.

### E. Layout components (Screen · Header · Cards · Grid)
- **Every screen root = `<Screen>`** → consistent centered, width-capped, gutter-padded layout.
- **Cards** = `radius.lg` + `borderCurve: "continuous"` + `shadow.card`; internal padding 16.
- **Dashboard / card sections** → wrap groups in **`<Grid>`** so widgets/memories/clinics
  show 1/2/3 across by device instead of a single stretched column.
- **Header** stays compact on phones; on tablet+ it can show the child name + quick actions
  inline with more breathing room.

---

## 4. Responsive Behavior — per device

- **Phone (sm):** single column; full-width buttons; bottom tab bar; 16px gutter; compact type.
- **Tablet (md):** content capped ~620px and centered; **2-column** card grids; paired form
  fields; slightly larger type via `ms()`.
- **Laptop/Desktop (lg):** content capped ~760px centered; **3-column** grids; hover/focus
  states active; forms can right-align actions.
- **Large/wide (xl):** same as lg but centered in the viewport with generous side margins —
  never stretch text lines full-bleed.

**Rule of thumb:** columns and padding change with width; **reading width stays capped** so
lines are comfortable everywhere.

---

## 5. Interaction & Feedback
- **Toasts** for success/error (already app-wide) — non-blocking, auto-dismiss, animated.
- **Button** micro-interactions (press scale, hover dim, focus ring) + haptics on tap.
- **Modals/sheets** animate in (slide/fade); lists animate on change (`LayoutAnimation` or
  Reanimated) — keep subtle and fast (<220ms).
- **Loading:** spinners in buttons; **skeleton placeholders** while records fetch.

---

## 6. Accessibility & Inclusivity
- AA contrast (tokens), ≥12px text, **44×44** targets, screen-reader labels/roles, visible
  focus rings, `Text selectable` on data/errors, respect Dynamic Type (don't disable scaling).
- Plain, multilingual copy; large, unambiguous CTAs for low-literacy users.

---

## 7. Adoption Plan (how to roll it in)

**Phase A — foundation (done):** `responsive.js`, `Screen`, `Grid`, upgraded `Button`.

**Phase B — wrap screens in `<Screen>`** (one per screen): replace each screen's root
`ScrollView`/`View` with `<Screen>`. Immediate win: proper centering + width cap on
tablet/desktop, consistent gutters. Low risk, high visual payoff.

**Phase C — grid the card sections:** wrap Dashboard widgets, memories, and Services clinics
in `<Grid>` so they use 2–3 columns on larger screens.

**Phase D — component sweep:** migrate remaining bare `TextInput`/buttons to `Field`/`Button`;
apply `ms()` to key headings; add skeletons.

**Suggested order:** Dashboard → Health → Growth → Services → Settings → Share/Professional.
Do one screen per change so each can be run and verified.

---

### Example usage
```jsx
import Screen from "./ui/Screen";
import Grid from "./ui/Grid";
import Button from "./ui/Button";
import { useResponsive } from "../utils/responsive";

function DashboardScreen() {
  const { isPhone } = useResponsive();
  return (
    <Screen>
      <Grid>
        <FeedingWidget />
        <SleepWidget />
        <TempWidget />
      </Grid>
      <Button title="Add Feed" icon="add" fullWidth={isPhone} />
    </Screen>
  );
}
```

**Outcome:** one flexible system — phones stay simple and thumb-friendly, tablets/desktops
use the extra width with multi-column grids and capped reading lines, components share
consistent styling and states, and the whole app meets modern accessibility standards.
