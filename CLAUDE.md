# BabyBook+ — Project Guide for Claude Code

> Handoff note: this file was written when the project moved from Cowork to Claude Code.
> It captures scope, architecture, current status, and the immediate next feature so you
> can continue without re-deriving context. Keep it up to date as the app evolves.

## 1. What this is

BabyBook+ is a **capstone project**: a parent-controlled mobile app for recording a child's
health and development from **ages 0–6**, tailored to a **Filipino context**. A secondary
actor — a **healthcare professional** — gets temporary, **view-only** access to a child's
records through a **QR / consultation code** the parent generates.

- **Front-end**: Expo / React Native (`front-end/`), also exported to web for the demo.
- **Back-end**: Express + PostgreSQL (`back-end/`), DB hosted on Supabase.
- Two live targets today: an **EAS-hosted web build** (defense demo) and the **Render**-hosted API pointed at Supabase. (Migrated from Railway in August 2026 after its free trial expired — see `DEPLOYMENT.md` and `Documents/archive/BabyBook+_Web_Demo_Hosting_Migration_Plan.md`.)

## 2. Repository layout

```
BabyBook+/
├── front-end/                 # Expo / React Native app (custom navigation, NOT expo-router)
│   ├── App.js                 # Root: auth gate, ThemeProvider wiring, header, bottom nav, currentView switch, add/edit-child modals, annual re-consent modal
│   ├── theme.js               # Design tokens + girl/boy/neutral PALETTES + paletteFor()
│   ├── context/
│   │   ├── ThemeContext.js     # ThemeProvider / useTheme() — dynamic gender palette
│   │   └── LanguageContext.js  # useLanguage() / t() — i18n (see translations.js)
│   ├── components/
│   │   ├── Dashboard.js Health.js Growth.js NutritionTracker.js CalendarView.js  # primary tab screens (bottom nav)
│   │   ├── Services.js                                    # reached from the side menu ("Local Services"), not the bottom nav
│   │   ├── AllActivity.js                                 # Dashboard "See all" destination for Recent Activity
│   │   ├── AllMemories.js                                 # full-photo-history screen; currently UNLINKED — the Dashboard's
│   │   │                                                   #   Milestone Memories "See all" now opens Growth's Gallery tab
│   │   │                                                   #   instead (nav("growth", "gallery")). Still valid code, just
│   │   │                                                   #   not reachable from anywhere today.
│   │   ├── ShareRecords.js QrCodeView.js QrScanner.js     # parent QR share + scan
│   │   ├── ProfessionalView.js                            # healthcare-pro view-only portal
│   │   ├── SideMenu.js                                    # slide-in drawer (hamburger icon) — replaces the old Profile tab
│   │   ├── settings/                                      # side-menu destination screens: ViewProfile, EditProfile, GeneralSettings, ThemePreferences, LanguagePreferences, HelpSupport, AboutApp, ChangePassword, PrivacySettings
│   │   ├── Auth.js Landing.js EmptyChild.js AppLoadingScreen.js MemoryDetail.js
│   │   ├── common/Cards.js                                # shared card components (SectionContainerCard, ListEntryCard, MemoryVisualCard, EmptyStateCard)
│   │   └── ui/                                            # Button, Field, DateField, PhotoAttach, ImageViewer, Gradient, Toast, Skeleton, ShowMore
│   ├── utils/
│   │   ├── api.js              # fetch client to the backend (all endpoints)
│   │   ├── adapters.js         # DB row <-> app-shape mappers (vaccinationToApp, checkupToApp, milestoneToApp, medHistoryTo*, childToProfile, ...)
│   │   ├── notifications.js    # scheduleReminder(), morningOf() (local notifications, guarded for web)
│   │   ├── imagePicker.js qrcode.js shareStore.js responsive.js storageAdapter.js
│   ├── translations.js  mockData.js
│   ├── app.json  eas.json  .env (git-ignored)
│
├── back-end/                  # Express API
│   ├── src/
│   │   ├── app.js server.js
│   │   ├── db/ pool.js schema.sql migrate.js seed.js seedDemoYear.js
│   │   ├── middleware/ auth.js validate.js upload.js error.js
│   │   ├── routes/ auth.routes.js children.routes.js records.routes.js
│   │   │           memories.routes.js attachments.routes.js share.routes.js consult.routes.js
│   │   │           (no separate calendar.routes.js — custom calendar events are just another
│   │   │            generic resource registered inside records.routes.js, path "calendar-events")
│   │   └── utils/ jwt.js crypto.js resource.js snapshot.js shareCode.js mailer.js
│   ├── tests/api.test.js       # `npm test` — see §6 for the DATABASE_URL caveat
│   └── .env (git-ignored)
│
├── README.md  CLAUDE.md  DEPLOYMENT.md          # repo front page, this file, deployment guide
├── BabyBook+_App_Overview.md                    # plain-language explanation of the app
├── PROJECT_HISTORY_SUMMARY.md                   # chronological build history
├── Documents/                                   # research paper, evaluations, DPA compliance,
│   └── plans/                                   #   implementation plans (this cleanup's audit lives here)
└── graphify-out/                                # code knowledge graph (see §11)
```

## 3. Architecture & conventions (follow these)

- **Navigation is custom, not expo-router.** `App.js` holds `currentView` state and swaps screens with conditional rendering. Bottom-nav values: `"dashboard" | "health" | "growth" | "nutrition" | "calendar"`. A floating button above the tab bar (reachable from every screen, not just Dashboard) opens a **scrollable** action sheet — `App.js`'s `ACTION_SHEET_ITEMS`, now 9 entries — that deep-links into `"nutrition" | "growth" | "health"` with a sub-tab, auto-opening the matching add-record form: Log Milk, Log Food, Log Growth, Schedule Appointment (Health → Checkups), Add Medication, Add Illness, Add Vaccine, Add Hospitalization, Add Memory. The three newest Health-screen shortcuts deliberately use their own key strings (`"vaccine"`/`"illness"`/`"hospitalization"`) rather than Health's real tab names — see the `§7` gotcha on why. Side-menu/modal/other values: `"share" | "services" | "allActivity" | "allMemories" | "viewProfile" | "editProfile" | "generalSettings" | "themePreferences" | "languagePreferences" | "helpSupport" | "aboutApp" | "changePassword" | "privacySettings"` (`"allMemories"` is defined but currently unreachable — see `§2`). The bottom tab bar, the floating button, and header/menu buttons all call `setCurrentView(...)` (deep-links go through the shared `changeView(view, tab)` helper in `App.js`). There is **no React Navigation / expo-router**; do not introduce it without discussion.
- **Icons**: `@expo/vector-icons` (`Ionicons`, `MaterialCommunityIcons`). Verify icon names exist (past bug: invalid Ionicons names).
- **Styling pattern (IMPORTANT — every screen now uses this):**
  ```js
  import { useTheme } from "../context/ThemeContext";
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // ...
  const makeStyles = (colors) => StyleSheet.create({ /* uses colors.* tokens */ });
  ```
  **No hard-coded brand hex in components.** Use theme tokens (`colors.primary`, `colors.accentStrong`, `colors.text`, `colors.textSecondary`, `colors.textMuted`, `colors.background`, `colors.surface`, `colors.surfaceAlt`, `colors.border`, `colors.softGreen`, `colors.softCoral`, `colors.tintGreen`, etc.) and semantic status colors (`colors.success/warning/danger/info` + `*Bg`). White (`#FFFFFF`) is allowed only for text/icons on colored buttons; semantic non-brand colors (emergency-hotline green/blue, gold rating star, status dots) are intentionally literal.
- **Static tokens** (theme-independent) live in `theme.js`: `space {xs,sm,md,lg,xl,xxl}`, `radius {sm,md,lg,xl,pill}`, `type`, `shadow {card,soft,raised,accent,green}`, `MIN_TOUCH=44`.
- **Backend style**: raw SQL via `pg` (no ORM). Generic CRUD is factored through `utils/resource.js` (supports an `encrypted` field list). JWT auth (`middleware/auth.js`), `bcryptjs` for passwords, `multer` local-disk uploads (`middleware/upload.js`), `nodemailer` (`utils/mailer.js`).

## 4. Theming system (recently completed)

- `theme.js` exports `PALETTES = { girl, boy, neutral }` and `paletteFor(gender, override)`.
  - **girl** = pink (`primary #EC4F96`), **boy** = blue (`primary #2F7BF6`), **neutral** = indigo (used pre-child / on the professional portal & auth).
- `ThemeProvider` in `App.js` is fed the **selected child's gender**; it auto-switches pink↔blue. A **manual override** ("Automatic / Girl / Boy") lives in the Settings screen and is persisted via `storage` under key `bb_theme_override`.
- Gradients come from `components/ui/Gradient.js` (guarded `expo-linear-gradient`, solid-color fallback). Requires `npx expo install expo-linear-gradient`.
- **Status: DONE.** All screens + shared components are converted; a full-tree sweep confirms zero stray brand hex.

## 5. Data model & record types

Children belong to a parent (`users`). Per-child records are reached through `api.listRecords(childId, type)` where `type ∈ { vaccinations, medical-history, milestones, checkups, growth, nutrition, reminders }`.

- `medical-history` rows carry a `category` of `Illness | Medication | Hospitalization`.
- `nutrition_records` is a **unified** milk+solids table (`entry_type`, `milk_type`, `formula_brand`, `quantity`, `unit`, `food_introduced`, `reaction`, `entry_date`, `entry_time`). The old `sleep_logs`, `temperature_logs`, and `feed_logs` were **removed**.
- `record_attachments` stores mandatory supporting photos for 5 record types (vaccination, illness, medication, hospitalization, checkup). See `attachments.routes.js`, `ui/PhotoAttach.js`, `ui/ImageViewer.js`.
- `children` include `nickname`, place/time of birth, preferred health center.
- Reminders (`reminders`) are created alongside future-dated vaccinations/checkups and drive local notifications.

### Security features already shipped
- **Field encryption** (`utils/crypto.js`): AES-256-GCM, values prefixed `enc:v1:`, decrypt is pass-through/back-compatible. Wired into resource/records/children/memories/auth/snapshot/consult. Key from `DATA_ENCRYPTION_KEY` (falls back to `JWT_SECRET`). **This key must be identical on local + the deployed backend (Render) and must never change**, or existing ciphertext becomes unreadable.
- **Consent** (`auth.routes.js`): registration requires `consentAccepted`; columns `consent_accepted/consent_date/consent_reviewed_at/retention_until` (6-year retention). Annual re-consent modal in `App.js`. Endpoints `POST /auth/consent/renew` and `DELETE /auth/me`. **Accounts are NEVER auto-deleted** — the annual notice is the only decision point; deletion is user-initiated only.

## 6. Environments, commands, deploy

**Front-end** (`front-end/`): `npm run web` (`expo start --web`) · `npm run build` (`expo export -p web`). `.env` holds the API base URL. Web demo is deployed via **EAS Hosting** (`expo export -p web` then `eas deploy --prod`); Android via **EAS Build**.

**Back-end** (`back-end/`): `npm run dev` (nodemon) · `npm start`. DB scripts: `npm run db:migrate` (⚠️ destructive — drops and recreates every table, first-time setup only), `npm run db:migrate:up` (additive — applies any new `back-end/src/db/migrations/*.sql` not yet recorded, safe against live data), `npm run db:seed`, `npm run db:seed:demo`. Deployed on **Render** (Free instance) with **Root Directory = `back-end`**, `PORT` (injected), `DATABASE_URL` = Supabase **Session pooler** URL (IPv4), plus `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `DB_SSL=true` (SMTP vars currently omitted — Render Free blocks outbound SMTP ports, see `DEPLOYMENT.md`). Health check: `GET /api/health` → `{"ok":true}`. Render's free instance spins down after 15 min idle (~1 min cold start on the next request) — expected, not a bug.

**Env vars** (never commit; `.env` is git-ignored): `DATABASE_URL`, `DB_SSL`, `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, SMTP creds (backend); `EXPO_PUBLIC_*` API base URL (frontend). After schema changes, **run `db:migrate:up` against Supabase (never `db:migrate` once real data exists), reseed if needed, and `git push` to `main` so Render redeploys** — a stale backend build against the new schema causes `column ... does not exist` errors.

**Tests** (`back-end/`): `npm test` (`jest --runInBand`, integration tests in `tests/api.test.js` via `supertest`). Single test: `npx jest -t "test name"`. **The suite runs `schema.sql` — which starts with `DROP TABLE ... CASCADE` for every table — against whatever `DATABASE_URL` is currently set**, so always point it at a throwaway/local DB first (`DATABASE_URL=postgres://...test npm test`), never at the Supabase URL used for local dev or prod. There is no front-end test suite.

## 7. Gotchas (real, hit during development)

- **Sandbox file-mirror truncation**: when verifying files through a shell, the mirror can lag/truncate the tail of a just-edited file, producing bogus parser errors at the file's end. The file-editing tools hold the true content. To compile-check JSX, copy the file **out of `front-end/`** (its `package.json` mirror also truncates → `Invalid package config`) and parse with `@babel/parser` (`plugins:['jsx']`); if the tail looks cut, reconstruct head + true tail before trusting an error. In Claude Code on a real disk this should not occur — prefer a normal `npx expo export` / lint to verify.
- **Chrome DevTools "zoomed in on mobile"** was a **stray in-page pinch-zoom** (`visualViewport.scale ≈ 2`), NOT a layout bug. The generated viewport meta is correct and the layout has no horizontal overflow (`scrollWidth === innerWidth`). Don't "fix" it in code.
- Keep the modified `back-end/package.json` (nodemailer) — don't revert.
- **`Health.js`'s deep-link tab names are not all interchangeable with modal-open triggers.**
  `"immunizations"` and `"illnesses"` are used elsewhere (e.g. the Dashboard's Needs Attention card,
  tapping an overdue vaccine or an ongoing illness/hospitalization) purely to switch Health to that
  tab — no form should pop open. The FAB's "Add Vaccine"/"Add Illness"/"Add Hospitalization"
  shortcuts need to both switch tabs *and* open a form, so they deep-link with distinct keys
  (`"vaccine"`, `"illness"`, `"hospitalization"`) that `Health.js`'s effect maps to the right tab
  separately from whether a modal opens. If a future change adds a new deep link into Health, reuse
  the real tab name only for a plain tab-switch; give it its own key if it should also open a form.

## 8. Current status

**Done:** full research-doc alignment (attachments, unified nutrition, removed sleep/temp/feed, child fields); QR share + professional portal; backend with field encryption + consent + DPA doc; **dynamic girl/boy theme across every screen** + Settings override; deployment (Render API + Supabase + EAS web demo, all in sync — migrated off Railway in August 2026 after its trial expired, see `DEPLOYMENT.md`).

**Also done — Navigation Overhaul + Calendar module (§9 below), increments A–F:** side menu (slide-in drawer) replacing the old Profile tab; bottom nav is now **Dashboard, Health, Growth, Nutrition, Calendar** (Services was later moved into the side menu, as "Local Services"); all 9 menu destinations built (`front-end/components/settings/`: ViewProfile, EditProfile, GeneralSettings, ThemePreferences, LanguagePreferences, HelpSupport, AboutApp, ChangePassword, PrivacySettings) + `POST /api/auth/change-password`; full Month/Week/Day calendar (`front-end/components/CalendarView.js`, `react-native-calendars`) aggregating vaccinations/checkups/medical-history with tap-to-detail; `calendar_events` table + generic CRUD (reuses `utils/resource.js`, resource path `calendar-events`) for user-created events with reminder lead-time + local notifications. All verified live against the `back-end-api`/`front-end-web` preview servers (`.claude/launch.json`) using the demo account below.

**Also done — Dashboard redesign:** Dashboard now shows an upcoming-appointment box (next vaccination or checkup, tap to open Calendar — this is the "Upcoming Appointments" feature; an earlier version of this note wrongly claimed it already existed before it was actually built), a vaccination-progress bar, and (at the time) a growth trend next to the weight/height numbers. **That growth trend no longer exists — see the Child Health ID note below.** A floating "log" button above the tab bar, reachable from every screen, opens a menu that has since grown to 9 items (see `§3`). The old Quick Actions section, the "Hello, {name}" greeting, and the generic Parenting Tip box were removed as low-information repeats; see `Documents/archive/BabyBook+_Dashboard_Redesign_Evaluation.md` for the full reasoning.

**Also done — a further round of dashboard/navigation cleanup, all on `feat/dashboard-redesign`, not yet merged to `development`:**
- **Dashboard**: the baby's photo/name no longer shows three times (header keeps just the name, baby switcher and summary card dropped their own copies); several buttons went icon-only (baby-switcher "+", "See all" links lost their arrow icon); Needs Attention now caps at 1 item + a "+N more" count and also catches hospitalizations, not just overdue vaccines and illnesses; an active-share-code notice (teal, `colors.info`) sits directly under Needs Attention as its own card; "Photo Memories" is now called "Milestone Memories" and its "See all" opens Growth's new Gallery tab (see below) instead of `AllMemories.js`.
- **Health screen**: "Rx Meds" tab renamed "Medicine"; every add button across all tabs is icon-only now; **Checkups moved here from Growth** (own tab, to the right of Conditions) and **Hospitalizations moved here from Conditions** (now sits under the Checkups tab, below the appointments list); the Vaccines tab gained a status filter (All/Due/Done/Overdue pills) plus a name/visit search box.
- **Every record list app-wide is capped at 10 items with a "Show more" button**: Health's five lists, Growth's photo gallery, `AllActivity.js`, `AllMemories.js`, `ShareRecords.js`'s share history and access log, and `NutritionTracker.js` (which already had its own version — pulled out into the shared `components/ui/ShowMore.js` all of these now use).
- **Growth screen**: gained a third tab, "Gallery", holding just the Milestone Memories photo gallery (previously stacked under Milestones alongside the Development Checklist); Milestones now shows only the checklist.
- **Calendar screen**: gained a color legend (dot + label per category) at the top of the scroll area — the category colors themselves (`categoryColor()` in `CalendarView.js`) already existed, this just makes them decodable.

**Also done — the Dashboard's Summary card became the Child Health ID card** (`Dashboard.js`, styles prefixed `id*` / `fact*` / `stat*`). The old card had no title, no name and no photo — just a chevron and a pencil above a 2-column grid of gender glyph / age / `7.8 (+0.4) kg` / `68 (+1.2) cm`, with allergies and blood type hidden behind a whole-card tap-to-expand. It now reads top to bottom as: identity (56px avatar, name, nickname, `Girl · 15 months`, `Born 12 Mar 2025`), then three always-visible fact rows (Allergies / Blood type / Hereditary, each falling back to `"None recorded"` — the same wording `OfflineSummaryView.js` and `ProfessionalView.js` use, because "nobody entered this" and "this child has none" must not look identical), then the latest weight/height/head with a `Measured <date>` anchor, then a `More details` disclosure holding pediatrician, health center, emergency contact, and place of birth.

Three things about it are deliberate and should not be "fixed" back:

- **The faster/slower growth verdict is gone for good.** PRODUCT.md Principle 5 forbids the app from reading as clinical judgment, and `GrowthChart` sits directly below plotting the same measurements against the WHO reference bands — a real comparison, unlike a pace guess from three home weigh-ins. `growthTrend()` was reduced to `latestGrowth()` (latest measurement + its date); `dayDiff()` and the `(+0.4)` delta formatter were deleted with it.
- **A recorded allergy or hereditary condition tints amber, not coral.** DESIGN.md reserves coral for overdue / error / destructive and defines amber as "needs attention, caution", which is the honest register for a flag whose severity this app never records.
- **Birth weight/length are not used as a fallback** for the measurement strip. They are a different fact from "how big is the baby now", and pairing them with a `Measured …` date would misreport them. With no growth rows at all the strip is replaced by a `Record the first one` prompt into Growth → Metrics.

`ageText()` (exported from `Dashboard.js`, also consumed by `OfflineSummaryView.js`) now returns `"2 years 3 months"` instead of `"2y 3m"`.

**Also done — Baby Switcher and Growth Chart.**

The **Baby Switcher** (`Dashboard.js`, styles `childPill*` / `childName*` / `childDot` / `addChildPill`) was a row of 32px photos with no names. A child without an avatar rendered as a generic grey person icon, so a two-child account offered "this one, or… someone" — and the selected state was a 1px border-colour change nobody could see. Each child is now a named pill (nickname or first name), selected reads as a filled pill, targets are a real 44px, and the bare `+` is a labelled "Add" again. Each pill carries a **coral dot** when that child has an overdue vaccine or an unresolved illness/hospitalization — the same test the Needs Attention card runs — so a parent can see the other child needs something without switching to find out.

That dot costs **2 requests per sibling** (`vaccinations` + `medical-history`), which the user accepted knowing it runs against PRODUCT.md Principle 3. Keep it contained: the selected child's verdict is written into `childAlerts` by the main bundle and never refetched; siblings are gated by `requestedAlertsRef` (a Set), **not** by the `childAlerts` map — keying off the map alone re-ran the effect while a request was still in flight and double-fetched every sibling. `retryAll()` clears both so pull-to-refresh re-checks. Failures are silent: a dot that can't load just doesn't appear.

The **Growth Chart** card (`GrowthChart.js`) was decorative. `PercentileChart`'s `compact` mode gated away the x-axis ticks, the legend, and the z-line labels, so the Dashboard showed a curve with **no time reference** (three months and three years looked identical), an **unexplained grey band** (the entire point of the chart), and **no units** anywhere. `compact` now keeps the x-axis and the legend; only the z-line labels stay off, since the legend explains the band and `rightPad` is 6px. `chartHeight` went 150 → 168 and `padBottom` 16 → 22 to make room. The legend's band label reads "Where most children this age are" rather than "WHO typical range" — plainer for a non-technical parent.

The card also gained the **percentile read-out** (`46th percentile`, the value with its unit, and the positional sentence), reusing `zScore`/`percentileFromZ`/`formatPercentile`. `describeZ()` **moved from `Growth.js` into `utils/whoGrowth.js`** so both the Dashboard's compact chart and Growth → Metrics describe the same z identically — two screens wording the same reference differently would be worse than either wording alone. The Dashboard deliberately does **not** repeat Growth's "talk to a health worker" prompt box; one positional sentence is enough on a home screen. Title and metric switcher are now on separate rows — side by side, "Growth Chart" wrapped to two lines at phone width.

Both cards moved off hard-coded `fontSize` literals onto the `type` scale.

**Also done — Needs Attention.** The card had a real prioritization bug: `attentionItems` was `overdueVax.concat(ongoingConcern)` rendered `slice(0, 1)`, and `overdueVax` arrives sorted oldest-first — so while a child had **any** overdue vaccine, a current hospital stay could never be the visible row. The single slot was allocated by array order, not urgency. Items are now built in rank order (hospitalization → unresolved illness → overdue doses, most overdue first) and **three** show instead of one, because a seeded or long-neglected account holds a dozen and "one item plus a number" can't be triaged.

Other fixes in the same card: raw ISO dates (`was due 2025-09-27`) became `overdueText()` output (`11 months overdue`) — the lateness is the only part that drives a decision; the total is stated in a count badge instead of inferred from "1 + 8 more"; "+N more" became "See all N" and lands on whichever tab holds the most items rather than Health's default; and each row gained an icon tile in the shared `colors.rec*` type tint. **Hospitalizations now deep-link to `"appointments"`, not `"illnesses"`** — they live under Health's Checkups tab (`Health.js:71` maps `hospitalization → appointments`), so the old link dropped the parent on a tab where they aren't listed.

The card is now a white surface with a coral border and coral header rather than a wholly coral-tinted card. The alarm is carried by the frame, which leaves each row free to state its own urgency: coral for overdue doses and a current hospital stay, **amber for an illness still being got over** (DESIGN.md reserves coral for overdue/error/destructive; amber is "needs attention, caution"). A flat red ground made a lingering cold shout exactly as loudly as a hospitalization.

Two notes for whoever touches this next. **Ionicons `medical` is an asterisk-like mark** that reads as a footnote marker — it is a valid glyph, so the usual "invalid icon name" check won't catch it; the rows use `medkit`/`bed`/`thermometer`, verified against `@expo/vector-icons`' Ionicons glyphmap. And **`medical_history.category` has more values than Section 5 of this file lists**: the demo seed also contains `Allergy` and `Hereditary Condition` rows alongside `Illness`/`Medication`/`Hospitalization`. `ongoingConcern` filters to Illness + Hospitalization only, which is correct, but any new code that switches on `category` needs to handle all five.

**Also done — the Health screen, and a timezone bug found underneath it.**

**`utils/dates.js` is new and is now the only place date formatting should live.** It exports `todayLocal()`, `toLocalISO(date)`, `shortDate()`, `shortTime()`, and `overdueBy()`, with a runnable self-check at `utils/dates.check.js` (`node utils/dates.check.js`, 18 assertions, mirrors `whoGrowth.check.js`). Use these instead of hand-rolling; near-identical formatters had already been copied into four components.

**The timezone bug — read this before writing any date code.** `new Date().toISOString().slice(0, 10)` is **UTC**, and this app's users are in the Philippines (UTC+8). Between 00:00 and 08:00 local, that expression returns *yesterday*. It was used at 12 sites and was actively wrong when found: "today's feedings" counted the wrong day, overdue maths was off by one, the Calendar's day-stepper jumped to the previous date, and — worst — `date_recorded` on newly saved records was **written to the database a day in the past**. All 12 sites now call `todayLocal()` / `toLocalISO()`. The self-check pins this (`todayLocal is local, not UTC`). Never reintroduce `toISOString().slice(0, 10)` to mean "today"; every date this app stores is a plain calendar date with no timezone, so the device's own date is the correct one. This fix reaches beyond the Health screen (Dashboard, Growth, AllActivity, CalendarView, NutritionTracker) because it corrupts stored data and a per-screen fix would have left the rest broken.

Health screen changes proper:

- **The tab bar clipped "Checkups" and overlapped "Conditions".** Cause: `tabButtonText` was `type.caption` (13px) but `tabButtonTextActive` spread `type.label` (14px) *after* it, so selecting a tab grew its text past its `flex: 1` box. Both states are now 13px, differing only in weight and colour (DESIGN.md's Weight Ladder Rule), with `paddingHorizontal: 0` on the button so the longest label gets its full share. Verified with `scrollWidth > clientWidth` on all four labels at a 326px viewport — zero truncation.
- **Dates.** Vaccines showed `Due: 2025-07-19` even on doses already given; checkups showed `2027-02-06 @ 09:00:00`, seconds and all. A given dose now reads `Given 19 Jul 2025`, a pending one `Due 27 Sept 2025`, and an overdue one adds a coral `11 months overdue` line — the same wording the Dashboard uses, so an overdue dose reads identically wherever the parent meets it.
- **Filter pills** (All/Due/Done/Overdue) fit one row instead of wrapping with "Overdue" stranded.
- **Broken attachment thumbnails** no longer render as empty grey squares on every vaccine row; the same `onError` fallback the Dashboard uses for avatars, for the same reason (ephemeral uploads).

**Two fabrication problems, handled differently — the user decided each.**

The care team defaulted to **"Dr. Sarah Chen"** and **"St. Jude Medical Center"** whenever the real fields were blank, presenting invented names as this child's actual providers. Removed; blank fields now read "Not recorded" with a hint to fill them in.

The **"NCR Vaccine Stocks Bulletin"** is entirely hardcoded and has no data source. PRODUCT.md lists "no clinic, DOH, barangay, or health-centre partnership" under absences that must never be fabricated, and the recommendation was to delete it. **The user chose to keep it as a labelled placeholder.** It now carries a teal "Sample data — not a live feed. BabyBook+ is not connected to any DOH or barangay system" banner, its stale hardcoded date ("replenishment by July 5th", over a year old) is gone, and the subtitle in all three locales no longer claims "Real-time updates". **Do not remove the banner and do not reintroduce a specific date** — without them the card reads as a live government feed.

**Also done — the Healthcare Professional record view** (`ProfessionalView.js`).

**Doc correction first: medical history IS in the QR snapshot.** Section 8 of this file and PRODUCT.md's "known gaps" both say it isn't. `back-end/src/utils/snapshot.js:88–96` includes it (filtered to `Illness | Medication | Hospitalization`) and the view renders it. Verified end to end against a live consultation code. PRODUCT.md still carries the stale claim and is an Impeccable-managed artifact, so it was left for the user to correct.

The screen serves someone PRODUCT.md describes as having "a patient in front of them and very little time", and it was a flat dump of eight sections in a fixed order with **no list caps at all**. Against the demo child that meant 316 nutrition rows rendering in full, pushing Medical History — 4 rows, the most clinically important section — to the bottom of a ~380-row scroll.

- **A `ClinicalSummary` band now sits above every section**: age, sex, blood type, allergies, unresolved conditions, and an overdue-vaccine count. All derived from the snapshot already on screen — no extra request, no interpretation. Verified to agree with the Dashboard (both report 9 overdue for the demo child).
- **Sections are reordered clinically** via `SECTION_ORDER`: allergies → medical history → vaccinations → growth → checkups → profile → milestones → nutrition. The old order buried the two things a clinician needs first behind the things they need last.
- **Every list caps at 10** with a Show more control (`PAGE`, `Capped`), matching DESIGN.md's app-wide rule that this screen alone ignored.
- **Growth rows now carry WHO percentiles** (`Wt 46th · Ht 60th (WHO percentile)`), reusing `zScore`/`percentileFromZ`/`formatPercentile`. A percentile is a published reference position, not a verdict — and the clinician is the person qualified to read it. The app still never labels it.
- **The child's age is shown.** It previously gave only `Date of Birth: 2025-07-19`, leaving the one fact every paediatric judgment hangs on as mental arithmetic.
- **Overdue vaccines say so** (`4 weeks overdue`), same wording as the Dashboard and Health screen.
- **`age_achieved` is rendered on milestones.** It was queried, decrypted and shipped in the snapshot, then thrown away.
- Dates go through `shortDate`/`shortTime`.

Two things that were quietly wrong and are worth not reintroducing. **The status colours were hardcoded and did not match the theme** — `#22C55E`/`#EF4444`/`#F59E0B` against the real `#0F7350`/`#C22B3C`/`#8C5A08`, so the professional portal used a different status vocabulary from the rest of the app, in the one place DESIGN.md says it must never vary. And **colour was the only signal** on every row; the new `Item` component pairs each tone with a status icon, so a colourblind clinician is not reading identical grey circles. Eight `#FFFFFF` literals (which broke dark mode) and every sub-13px font size are gone too.

**Also done — the Growth screen's Gallery tab, which was showing the wrong records entirely.**

The tab rendered `completedMilestones` under the heading `t("dashMemoriesTitle")` ("Milestone Memories"), reached from a Dashboard button whose accessibility label is literally "See all photo memories" — while `Growth.js` **never fetched memories at all**. Its loader requested only `milestones` and `growth`. So a parent tapping "see all photo memories" landed on a list of milestones, and their actual photos existed nowhere but four tiles on the Dashboard.

The Gallery is now **one chronological timeline carrying both** photo memories and achieved milestones, newest first, grouped into month buckets, with All / Photos / Milestones filter chips that carry live counts. Two-up grid (`width: "48%"`) — the same `MemoryVisualCard` was previously rendered full width here while the Dashboard showed it at 48%, so the tab fitted about one and a half items per screen.

**Milestones stay in the Gallery on purpose. Do not "clean this up" by making it memories-only.** The Milestones tab does not show the child's own records: it renders six hardcoded `ageChecklists` entries with stock Unsplash photos and matches real records **by title string** only to draw a tick. A milestone like "First Steps" or "First Word (Mama)" is not among those six and appears nowhere else in the app. Removing them from the Gallery would delete them from the UI entirely. (The checklist's inability to represent an arbitrary milestone is a real problem, but it is its own piece of work.)

Supporting changes:

- **`utils/dates.js` gained `monthLabel()`** ("August 2026") for the bucket headers, covered by `dates.check.js`.
- **New `components/ui/AddMemoryModal.js`** — the add-memory form was inline in `Dashboard.js`, which is why the gallery had no way to add to itself. Extracted once, used by both. `onSaved` hands back the adapted memory so callers prepend without refetching.
- **`MemoryVisualCard` gained `badge` and `placeholderIcon`.** The trophy badge marks a milestone tile, and the caption spells out "MILESTONE" beside the date — the distinction never rests on the small glyph alone. Titles now wrap to two lines; at 48% width one line clipped most real captions.
- Tile dates drop the year (`20 JUL`) since the month header states it, via `shortDate`.
- **`components/AllMemories.js` was deleted**, along with its `App.js` import and `allMemories` view branch. It was a complete, correct, 114-line full-photo-history screen that nothing ever navigated to — its entire purpose is now the Gallery tab, and keeping two implementations of one screen is how the labelling drifted apart to begin with. Section 2 above still describes it and is now stale on that point.

**Also done — the floating "+" button and its action sheet, plus three fabricated form defaults found underneath it.**

**THE DEEP-LINK RULE, now absolute — read this before adding any deep link.** A **plain tab name only switches tabs. Only an alias opens a form.** `Health.js` plain: `immunizations`, `medications`, `illnesses`, `appointments`. `Health.js` aliases: `vaccine`, `medication`, `illness`, `checkup`, `hospitalization`. `Growth.js` plain: `milestones`, `gallery`; aliases: `memory`, and `metrics` (a legacy exception the FAB has always used). The effect in each screen is now a `tabFor` map plus a `modalFor` map rather than a chain of ifs, so breaking the rule requires deliberately adding an entry to the wrong map.

`appointments` and `medications` used to break it by opening forms themselves. That is how the previous pass's Needs Attention card — which deep-links hospitalizations to `appointments`, because hospitalizations live under Health's Checkups tab — ended up **popping a blank Add Appointment form** every time a parent tapped a hospital-stay alert. Verified fixed live by temporarily marking a seeded hospitalization unresolved: the row now lands on Checkups with the Hospitalizations list showing and no modal. (That test also finally proved the Needs Attention **ranking** works — the hospitalization sorts above the overdue vaccines — which no seeded data had previously exercised.)

**Three forms opened with invented data pre-filled.** These are prototype leftovers that wrote fabricated records if a parent tapped save without editing:

- `Growth.js` Log Growth defaulted to **height "68.2" and weight "7.4"** — reachable in two taps from the FAB's Most-used row, and it writes a clinical measurement. Now empty; `handleSaveMetrics` already rejects blanks with "Please enter valid parameters".
- `Health.js` New Appointment defaulted to title **"Developmental Assessment"**, doctor **"Dr. Sarah Chen"** (the same fake doctor removed from Care Team earlier) and date **"2026-06-30"**, a date now in the past. Title and doctor are blank; the date starts at `todayLocal()`.

**The sheet itself is now `components/ui/ActionSheet.js`** (lifted out of `App.js`, which did not need its storage-backed state). A **Most used** row of three shortcuts sits above the full nine, which stay in three fixed groups — Everyday / Health / Keepsake. The shortcut row deliberately duplicates three entries rather than removing them from their group: **the full list must never reorder**, or the muscle memory the shortcut exists to build is destroyed every time counts shift. Counts live in `storage` under `bb_action_usage`, seeded with the default order so the row works on day one, ties broken on that same order. Every row now carries its `colors.rec*` tinted icon tile instead of nine identical `colors.primary` glyphs, the title is "Add a record" with noun labels so the verb is stated once, and sizes come from the `type` scale.

**The "+" now renders only on the five bottom-tab views** (`FAB_VIEWS` in `App.js`). It used to appear everywhere, which put a "log something" affordance over Privacy Settings, Search, Share Records and — worst — Offline Summary, the read-only screen whose whole promise is that it works with no signal. The memory action now targets the Gallery (`growth` / `memory`) rather than the Dashboard.

**Fixed in the same pass:** the Health ID fact rows put the label above the value instead of beside it. A fixed 108px label column left ~130px for the value at phone width, which truncated real data (`"Mild egg sensitivit…"` for a four-item allergy list). Allergy and hereditary text is arbitrary-length and is exactly the content that must not be cut off. The child's name also wraps to two lines now rather than truncating.

**Migrations — resolved 2026-08-10:** the three additive migrations under `back-end/src/db/migrations/` (`000_calendar_events.sql`, `001_access_log_context.sql`, `002_vaccination_source.sql`) were previously applied only to the local dev database. `npm run db:migrate:up` has since been run against Supabase's Session pooler (`DB_SSL=true`) and verified via the `schema_migrations` table — all three are now confirmed applied to the live database. Custom calendar events, auto-generated EPI vaccination doses, and the QR consultation `POST /api/consult/resolve` flow (which writes to `access_logs.ip_address`/`user_agent`) all now have the columns/tables they need on the deployed backend. If a *new* migration is added later, remember: use `npm run db:migrate:up` (additive) — never `db:migrate`, which drops and recreates every table and is intentionally left for the user to run, not something Claude should do unattended.

**Demo account** (officially adopted, replaces the old `sarah@example.com` seed creds for live testing): `demo.parent@babybookplus.app` / `Demo1234!`.

Phase 4 (UI/UX polish) is next: accessibility/contrast (esp. pink theme small text), 44px touch targets, ≥16px inputs, consistent empty/loading/error states, motion.

## 9. Navigation Overhaul + Calendar module (DONE — see §8)

This was fully scoped with the user; decisions are **locked**. Build it in increments and compile-verify each.

**Locked decisions**
1. **User menu = slide-in side menu (drawer from the right).** Tapping the header avatar opens it (today it opens the `settings` view — change that). Header shows avatar + parent name at top, then grouped items with icons:
   - **Account**: View Profile, Edit Profile
   - **Application**: Settings, Theme Preferences, Language Preferences
   - **Support**: Help & Support, About BabyBook+
   - **Security**: Change Password, Privacy Settings
   - **Session**: Logout
2. **Bottom nav**: remove the Profile/`settings` tab (the `person` icon) and add a **Calendar** tab. New order: **Dashboard, Health, Growth, Services, Calendar**. All profile/settings functions move into the side menu.
3. **Calendar uses the `react-native-calendars` library** (install: `npx expo install react-native-calendars`; pure-JS, Expo-compatible, works on web). Provide **Monthly / Weekly / Daily** views with a switcher. Library API: `Calendar`, `CalendarList`, `Agenda`, and (for week/day/agenda) `CalendarProvider` + `ExpandableCalendar` + `WeekCalendar` + `AgendaList` from the same package; theme via the `theme` prop; multi-dot `markedDates` for category colors; `LocaleConfig` for locale. **Must be theme-aware** (feed it `colors.*`, honor girl/boy switching). Jump-to-today, tap event → detail, edit/delete/create.
4. **Build ALL menu destinations fully now** (user chose the complete option):
   - View Profile / Edit Profile (parent account; the old `UserProfile.js` was split into `components/settings/ViewProfile.js` + `EditProfile.js`), Settings, Theme Preferences (reuse the App-Appearance override selector), Language Preferences (reuse language selector).
   - Help & Support, About BabyBook+ (info screens).
   - **Change Password** — needs a **new backend endpoint** `POST /auth/change-password` (verify current password with bcrypt, set new). Build the feature; the user enters their own credentials.
   - **Privacy Settings** — surface consent status/retention, and reuse existing consent + `DELETE /auth/me` (withdraw/delete) APIs; add data-export if feasible.

**Calendar data design (recommended to avoid duplication)**
- **Aggregate existing records** for display: vaccinations (`due_date`), checkups (`checkup_date`), medical-history/medication, hospitalizations, and `reminders` (`reminder_date`) — read them and render as calendar events, color-coded by type. Do **not** duplicate these into a new table.
- **New `calendar_events` table** only for **user-created custom events**: `id, child_id, title, description, event_type, event_date, event_time, reminder_settings(jsonb), created_at, updated_at`. FK to `children`. Implemented as CRUD (not a separate `calendar.routes.js` — it's a generic resource registered inside `records.routes.js`, path `calendar-events`, via `utils/resource.js`) + a **migration** the user runs on Supabase (then reseed + push so Render picks it up).
- **Color coding** by category (vaccination / checkup / medication / hospitalization / custom) using theme-derived colors.
- **Notifications**: reuse `utils/notifications.js` `scheduleReminder`; support configurable lead time (same day / 1 day / 3 days / 1 week).

**Dashboard integration**: add an **"Upcoming Appointments" widget** (next appointment: title, date, type) with a **"View Calendar"** shortcut that does `onChangeView("calendar")`.

**Acceptance criteria** (from the user): avatar opens the menu (not a tab); no Profile tab in bottom nav; Calendar tab is fully functional with month/week/day; appointments + reminders auto-appear; custom events sync; Dashboard shows upcoming appointments; navigation is intuitive, responsive, theme-consistent.

**Suggested increment order**: (A) nav refactor — side menu + swap tab to Calendar shell; (B) menu destination screens + `POST /auth/change-password`; (C) Calendar UI with the three views over aggregated records; (D) `calendar_events` table + routes + migration + custom-event CRUD + notification lead-time; (E) Dashboard "Upcoming Appointments" widget; (F) compile-verify + theme pass.

After this feature: return to **Phase 4 (UI/UX polish)** — accessibility/contrast (esp. pink theme small text), 44px touch targets, ≥16px inputs (prevents mobile focus auto-zoom), consistent empty/loading/error states, motion. (User will handle the defense deck/demo script themselves.)

**Correction, added later:** two details in the locked decisions above no longer match the app. The
bottom-nav order "Dashboard, Health, Growth, Services, Calendar" was later changed to **Dashboard,
Health, Growth, Nutrition, Calendar** — Nutrition was promoted from a Growth sub-tab to its own tab,
and Services moved into the side menu ("Local Services") instead. The "Upcoming Appointments" widget
described under Dashboard integration was *not* built at the time this file first claimed it was —
it was actually built later, alongside a vaccination-progress bar, a growth trend, and a floating log
button; see §8 above.

## 10. Working agreements
- Ask before adding new dependencies or changing the navigation paradigm.
- Preserve existing functionality when refactoring (esp. QR share, encryption, consent).
- After schema changes: run `db:migrate:up` against Supabase (additive; never `db:migrate` once real data exists) → reseed if needed → `git push` (Render redeploy).

## 11. graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- **Hooks are installed** (as of 2026-08-07): a git `post-commit` hook auto-rebuilds the graph (AST-only, code files only) after every commit, and a `post-checkout` hook keeps it in sync when switching branches. Manual `graphify update .` is now only needed for doc/image changes, which the hooks don't cover. Check status with `graphify hook status`; reinstall with `graphify hook install` if a fresh clone or a wiped `.git/hooks/` ever loses them.
