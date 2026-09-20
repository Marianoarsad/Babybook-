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
│   │   ├── Services.js                                    # reached from the Profile hub ("Local Services"), not the bottom nav
│   │   ├── AllActivity.js                                 # Dashboard "See all" destination for Recent Activity
│   │   │                                                   #   (AllMemories.js was DELETED — Growth's Gallery tab replaced it)
│   │   ├── ShareRecords.js QrCodeView.js QrScanner.js     # parent QR share + scan
│   │   ├── ProfessionalView.js                            # healthcare-pro view-only portal
│   │   ├── settings/                                      # Profile hub and destination screens: ViewProfile, EditProfile, GeneralSettings, ThemePreferences, LanguagePreferences, HelpSupport, AboutApp, ChangePassword, PrivacySettings
│   │   ├── Auth.js Splash.js EmptyChild.js MemoryDetail.js
│   │   ├── common/Cards.js                                # shared card components (SectionContainerCard, ListEntryCard, MemoryVisualCard, EmptyStateCard)
│   │   └── ui/                                            # Button, PulseLoader, Field, DateField, PhotoAttach, ImageViewer, Gradient, Toast, Skeleton, ShowMore
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

- **Nutrition trends and forms**: the Nutrition tab renders separate stacked Milk Over Time and Food Over Time histograms from the same loaded nutrition records. One shared 7 Days / 30 Days / 6 Months / All Time selector updates both. Milk retains Feeds, Volume and Breast Time measures; Food counts solid-food entries. Each chart scales independently, uses its own theme token and empty state, and reports a per-day average without another API request. Milk and Solid Food open as separate fixed-type forms. Formula and Mixed are bottle-only in the UI and order Formula Brand → Scoops → Amount; for Mixed, Amount becomes Formula Amount and a required Breastmilk Amount follows it using the same unit. Breastmilk alone exposes Fed By. Nutrition rows suppress the shared form divider without changing other forms. After a confirmed add/update, device-local child-scoped preferences retain each entry type's latest fields while new forms always use the current date/time; canceled or invalid drafts do not replace them. The legacy global milk preference is a fallback only. Formula and Mixed require a positive Scoops value in the app form: a themed minus/editable-value/plus stepper defaults missing values to 1, steps by whole scoops while preserving a manually entered decimal part, accepts up to two decimal places, and respects the existing 999.99 storage limit. The database field remains nullable for compatibility; Breastmilk and Solid Food saves clear it. Run `node utils/nutritionFormPrefs.check.js` for the focused behavior check.

- **Reference-style tab bar (September 2026)**: `ui/TabBar.js` retains five equal-width Home/Health/Growth/Nutrition/Calendar destinations, with transparent 28 dp SVG silhouettes (house, medical calendar, rising bars/arrow, heart-apple, calendar grid). Selected icons/labels use theme text, inactive ones secondary text; a 4 dp boy/girl-primary indicator spans 60% of its column. There are no active pills or decorative notification dots. The indicator slides in 220 ms and newly selected icons lift 2 dp/scale 1.06 then settle within 220 ms, using existing Animated APIs; interruption, resize, unmount and reduced motion are handled. Labels remain translated, allow two lines and scale with accessibility settings. Secondary views leave all tabs unselected. Existing haptics, repeated taps, deep-link clearing, Back and nonblocking reads are unchanged. The measured bar height is shared via ScrollContext so content clearance and the FAB adapt to font scaling/safe areas. Run `node components/ui/TabBar.check.js` for the focused check.

- **Home cards / retired Offline Summary (September 2026)**: the card order is Monthly Growth → Vaccination Progress → Next plan → Fed (conditional cards still hide when unavailable). Next plan reuses Fed's surface/hairline shell, tinted icon container and foreground styles; its Calendar navigation is unchanged. Offline Summary's card, route, screen, snapshot utility and automatic cache writes have been removed. Nonblocking startup cleanup removes only device-local `bb_offline_summary:*` snapshots and `bb_seen_offlineSummary`; storage failures retry on later launches. Shared session caching, optimistic updates, records, auth, preferences, QR sharing and exports remain intact. Earlier Offline Summary descriptions below are historical, not current features. Run `node utils/homeCards.check.js` and `node components/cardPalette.check.js` in `front-end` for focused checks.

- **Tab-loading feedback**: Home (`Dashboard`), Health, Growth, Nutrition and Calendar explicitly pass `{ loading: "nonblocking" }` for their display-data reads (including attachments, the vaccine catalogue and Dashboard share summaries). Switching/reloading tabs keeps their existing skeleton, loading and error states without the centered database overlay or navigation blocker. API defaults remain blocking for other callers; saves, uploads and confirmation-critical actions are unchanged. `apiActivity.check.js` checks all five tabs' read call sites and concurrent nonblocking reads versus a blocking save.

- **Navigation is custom, not expo-router.** `App.js` holds `currentView` state and swaps screens with conditional rendering. Bottom-nav values: `"dashboard" | "health" | "growth" | "nutrition" | "calendar"`. A floating button above the tab bar opens the scrollable record action sheet. Profile-hub/modal/other values include `"share" | "services" | "allActivity" | "viewProfile" | "editProfile" | "generalSettings" | "themePreferences" | "languagePreferences" | "helpSupport" | "aboutApp" | "changePassword" | "privacySettings"`. The caregiver avatar opens `"viewProfile"`, whose grouped rows link to the settings and support destinations. Deep links use the shared `changeView(view, tab)` helper. There is **no React Navigation / expo-router**; do not introduce it without discussion.
- **First-launch onboarding** is a three-slide carousel with a unified modern, rounded product-illustration style: a modern open-book dashboard organizing health, growth, and memory cards; a hand-held consultation QR with read-only and temporary-access cues; then a guardian holding the recurring baby and an open BabyBook behind a lock shield. Its copy progresses from organization ("Every record, in one BabyBook"), to parent-controlled sharing ("You choose what your doctor sees"), to readiness and registration. All three slides use a shared Archivo 700 hero at 28/34 and Public Sans body copy at 16/24; text regions grow with accessibility font scaling, and the page can scroll vertically when needed. The final primary CTA, “Start My BabyBook,” opens registration, while the secondary CTA opens login; both mark onboarding as seen. The Skip control is hidden on the final slide to leave those two account paths as the only actions.
- **Brand mark**: BabyBook+ has two official supplied-artwork variants on `#F2F5F7`: a compact brush-script `BB+` above the shallow open book, and a full stacked `Baby` / `Book+` lockup above that same book. `front-end/assets/logo-mark-source.png` and `logo-wordmark-source.png` are the canonical 500px sources and must not be redrawn. Small surfaces use the compact mark; splash, Auth, and About use the full lockup. Keep their platform exports separate: `icon.png` is the opaque 1024px launcher icon, `splash-icon.png` is the transparent full-lockup export, `adaptive-icon.png` is the transparent Android-safe compact foreground, `monochrome-icon.png` is its themed companion, and `favicon.png` is the 48px compact web export. `app.json` remains the source of truth for those mappings.
- **Startup and loading UI**: native keeps `expo-splash-screen` visible until fonts, packaged startup artwork, saved theme/language preferences, onboarding state, and the restored auth session are ready; web uses `components/Splash.js` as the equivalent fallback. That branded startup flow is preserved. After startup, foreground backend activity uses the centered blocking database overlay described below; screen skeletons remain. The book-shaped `ui/PulseLoader.js` remains for startup and non-database work (provider authorization, printing/device tasks), and is suppressed while the global overlay is active. Database-action buttons retain their normal icons/text, disabled/busy states and submit/delete guards; `Button` supports `loadingIndicator={false}` for database-only actions.
- **Global database loading (September 2026)**: `utils/apiActivity.cjs` tracks foreground work with balanced request counts and a 150 ms idle hide delay. `api.js` tracks preparation/token lookup/response reading and parsing in `finally`, plus full multipart preparation/upload lifetimes. `getApiActivitySnapshot`/`subscribeApiActivity` expose a stable boolean external-store snapshot. `DatabaseLoadingProvider` gates presentation until branded startup finishes and blocks pointer, web keyboard/inert, scrolling and Back interactions. `ui/DatabaseLoadingOverlay.js` displays only concentric rounded pink/blue arcs (dedicated `databaseLoaderColors` tokens: outer pink `#FF7EB3`, inner blue `#5B9DFF`, fixed across profile genders and light/dark schemes), 112 dp (proportionally scaled from the original 96 dp SVG), with 7.8-unit SVG strokes (30% thicker than the previous 6 units), round end caps, a theme-text backdrop at approximately 18.4% opacity (`2F` alpha; 35% lighter than the previous `48`), and opposite 1.2 s/1 s rotations; reduced motion is static. It dismisses the keyboard, exposes non-visible localized progress semantics, and restores connected web focus after loading. `ui/AppModal.js` preserves Modal props and adds a host inside each native/web modal; parent-aware registration selects one topmost host, avoiding competing native modal presentations. Toasts wait until loading ends. QR-access polling, other-child attention checks, reminder synchronization and access-log mark-seen use `{ background: true }` on the relevant API methods and do not trigger/extend the overlay. API payloads/errors are unchanged; no request timeout was added by user choice, so stalled requests can block until they settle. Local storage, assets and chart filters are not tracked. Run `node utils/apiActivity.check.js` for concurrency, failure cleanup, background/upload and modal-host checks.
- **Selective optimistic actions (September 2026)**: `utils/recordStore.cjs` owns session-only confirmed records plus per-record pending overlays, used through `useRecords`. Account token changes/logout reset its epoch; child/resource keys isolate records; stale reads and old-session responses cannot replace newer state. Only Calendar planner checkboxes (independent of clinical status), milestone checklist ticks, dose logging/undo, growth/nutrition deletions and custom-plan deletions use `api.optimisticRecord` and `{ loading: "nonblocking" }`. Definite failures roll back only that operation. Network/interrupted-response/5xx outcomes remain uncertain, with root `MutationFeedback` Check/Retry and recording-specific dose language; no automatic retry loop, offline write queue or timeout. Form saves, allergy/clinical changes, health deletions, uploads, sharing and auth remain blocking/server-confirmed. `useRecordSave` retains the confirmed record ID for partial attachment/reminder failures and replays an interrupted JSON create with its original key/payload before applying changed drafts. Vaccine completion uploads required evidence before marking given; failed allergy saves retain their input. Dashboard/Calendar/Growth/Nutrition/dose views consume shared records; latest measurement sorting survives backdated saves, and failed display reads retain confirmed session records.
- **Required rollout**: apply additive migrations `011_mutation_receipts.sql`, `012_nutrition_formula_scoops.sql`, and `013_nutrition_mixed_amounts.sql` with `npm run db:migrate:up` in `back-end` on the intended database, then deploy/restart the backend before using the frontend. These migrations have NOT been applied by Codex. Receipts store ownership IDs, resource, operation key, canonical SHA-256 digest, record ID and timestamp only; RLS/revokes deny public Supabase roles. Transactional unique claims deduplicate keyed creates, changed payloads conflict and deleted-record receipts prevent resurrection. Owner-scoped `/operations/:key` lookups and internal create-key metadata on checklist/dose lists resolve lost responses. Unkeyed callers still work. Run `node utils/recordStore.check.js`, `node utils/partialSaves.check.js`, `node utils/apiActivity.check.js`, existing form/Health checks and the web build in `front-end`; `node tests/mutationReceipts.check.js` in `back-end` uses a SQL double. Live SQL concurrency assertions are in the destructive integration suite: run ONLY with an explicitly disposable `DATABASE_URL`. No live DB or native-device verification was performed for this rollout.
- **Record forms (September 2026)**: `ui/RecordFormSheet.js` provides a compact, safe-area-aware bottom-up sheet, pinned header actions, scrollable white rounded groups and inset rows. Its height matches the global Add a record menu using `recordSheetHeight` in `utils/responsive.js`: the original 55%-of-window list allowance plus menu header/footer spacing, adjusted for font scale and safe areas and capped to available height. Baby add/edit/first setup, growth, gallery creation, nutrition, medicines, illnesses/hospital stays, vaccinations/completion, appointments and custom plans reuse it without changing their field copy or payloads. Cancel and Save (including localized Save Record) use circular X/check icons with retained accessibility labels; database loading feedback is global, while Add/Update/Schedule/Confirm remain text. First-child setup retains Log out/Create Profile and cannot be dismissed back to an empty dashboard. Fields and the bottom Delete action scroll beneath the pinned header. `Field` and date/time triggers use opt-in record context styling; account/consent/search/filter screens and picker selection layouts are unchanged. Reduced-motion disables the slide. Eligible existing-record updates have a bottom Delete action and an inline rounded destructive confirmation over the preserved draft; no baby-profile deletion, hospital-stay deletion or create-only gallery deletion was added. Critical deletions close only after server confirmation. Approved optimistic growth/nutrition/custom-plan deletions close immediately after confirmation; version guards prevent late responses from closing a different form. Calendar keeps the original edited event identity separate from its editable fields. Run `node components/ui/RecordFormSheet.check.js` and `node components/Health.check.js` from `front-end/` for focused checks.
- **Authentication UI and social sign-in:** Auth is mobile-first even in the browser: one full-height portrait column capped at 430px for wide web previews, with the scene illustration above the title and form. It must not switch to a desktop split panel or show a BabyBook+ logo. Registration is two guided steps (account, then caregiver role + consent); optional phone/city details moved to Profile. Google and Facebook use compact icon-only controls backed by native Android SDKs and their browser SDKs on web. The backend verifies provider credentials, stores only `(provider, provider_subject)` in `user_auth_identities`, requires a backup password for new social accounts, and requires the existing password before linking an email collision. Native session JWTs live in SecureStore; preferences remain in AsyncStorage. Provider setup and migration `009_user_auth_identities.sql` are documented in `DEPLOYMENT.md`.
- **Auxiliary-screen loading**: Profile, Search and Share Records open cached-first with nonblocking display reads. The session record store tracks confirmed empty results, freshness and newest-read sequencing; account data uses a reserved account scope, while shares/access logs remain child-scoped. Unknown sections use skeletons; failed refreshes retain cached data and offer localized Retry. Search indexes six shared record resources reactively. Session/child changes guard late responses and reset screen-local state; cached share history never restores an active QR, and expiration is derived from the clock. Profile saves, auth, QR creation/revocation and PDF exports remain blocking/server-confirmed. PDF reads use confirmed-only records and abort on failed reads instead of silently exporting partial data. Run `node utils/cacheNavigation.check.js`, `node utils/recordStore.check.js` and `node utils/apiActivity.check.js` for focused verification.
- **Loading startup regression check**: `utils/apiActivity.check.js` also executes `ToastProvider` with database activity on and off, catching missing hook imports that bundling alone does not detect.
- **Record form width**: the shared form sheet spans 100% of the screen on phones, tablets and web; do not apply the screen-content max-width cap to it. Interior field padding and the compact destructive confirmation are retained.
- **Global Add a record motion**: `ui/ActionSheet.js` uses the existing React Native Animated/PanResponder APIs, with a 280 ms bottom-up entrance and 220 ms downward exit over a separately animated backdrop. Only the grabber/title header is draggable; downward movement beyond 12 dp claims the gesture, a pull of at least 64 dp dismisses, and shorter/interrupted pulls return in 160 ms without velocity-only dismissal. Outside taps, Cancel, system Back, accessibility escape and record selection share the guarded exit; selection/navigation and usage updates occur once after the exit completes. The modal remains mounted while exiting, stale animation completions are ignored, resizing is handled and reduced-motion skips transitions. Other sheets retain their existing motion. Run `node components/ui/ActionSheet.check.js` for the focused motion lifecycle check.
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
- **Backend style**: raw SQL via `pg` (no ORM). Generic CRUD is factored through `utils/resource.js` (supports an `encrypted` field list, and a `photoColumn` that adds multipart upload, signed-URL resolution and file cleanup — currently `milestones` only). JWT auth (`middleware/auth.js`), `bcryptjs` for passwords, `multer` local-disk uploads (`middleware/upload.js`), `nodemailer` (`utils/mailer.js`).

## 4. Theming system (recently completed)

- `theme.js` exports `PALETTES = { girl, boy, neutral }` and `paletteFor(gender, override)`.
  - **girl** = pink (`primary #EC4F96`), **boy** = blue (`primary #2F7BF6`), **neutral** = indigo (used pre-child / on the professional portal & auth).
- `ThemeProvider` in `App.js` is fed the **selected child's gender**; it auto-switches pink↔blue. A **manual override** ("Automatic / Girl / Boy") lives in the Settings screen and is persisted via `storage` under key `bb_theme_override`.
- Gradients come from `components/ui/Gradient.js` (guarded `expo-linear-gradient`, solid-color fallback). Requires `npx expo install expo-linear-gradient`.
- Automatic mode normalizes `Female/Male` and `girl/boy` values and synchronizes the palette during profile selection, so a child switch cannot paint the previous child's color first. Forced Girl/Boy modes still intentionally override the child.
- **Status: DONE.** All screens + shared components are converted; a full-tree sweep confirms zero stray brand hex.

## 5. Data model & record types

Children belong to a parent (`users`). Per-child records are reached through `api.listRecords(childId, type)` where `type ∈ { vaccinations, medical-history, milestones, checkups, growth, nutrition, reminders }`.

- `medical-history` rows carry a `category` of `Illness | Medication | Hospitalization`.
- `nutrition_records` is a **unified** milk+solids table. Mixed bottles store the formula portion in `quantity` and the breastmilk portion in `breastmilk_quantity`, sharing one `unit`. The old `sleep_logs`, `temperature_logs`, and `feed_logs` were **removed**.
- `record_attachments` stores supporting photos for vaccination, illness, medication, hospitalization, and checkup records. A photo is optional when scheduling a vaccination and required when marking its dose as given. See `attachments.routes.js`, `ui/PhotoAttach.js`, `ui/ImageViewer.js`.
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

**Card palettes (September 2026):** Growth's Latest measurements and Home's Vaccination progress reuse the Profile Plan card's diagonal `primaryDark` → `primary` gradient via `ui/Gradient`. Their foreground is `onPrimary` in light mode and `background` in dark mode; secondary text uses 95% opacity, and dividers/borders/progress track use 20% foreground opacity. Dimensions, record values and next-vaccine navigation are unchanged; the Profile Plan card itself is unchanged. Run `node components/cardPalette.check.js` for six-theme contrast, empty/partial measurements, progress states and navigation checks.

**Done:** full research-doc alignment (attachments, unified nutrition, removed sleep/temp/feed, child fields); QR share + professional portal; backend with field encryption + consent + DPA doc; **dynamic girl/boy theme across every screen** + Settings override; deployment (Render API + Supabase + EAS web demo, all in sync — migrated off Railway in August 2026 after its trial expired, see `DEPLOYMENT.md`).

**Also done — Profile hub + Calendar navigation:** the caregiver's header avatar opens a mobile Profile & Settings hub with account details, baby-profile count, member-since date, current Free plan, grouped settings, support links, and Sign Out. Bottom nav is **Dashboard, Health, Growth, Nutrition, Calendar**; Local Services lives in the Profile hub. Existing custom navigation and all settings destinations remain intact. The backend's public user response includes the existing account creation timestamp for the member-since detail.

**Also done — Dashboard redesign:** Dashboard now shows an upcoming-appointment box (next vaccination or checkup, tap to open Calendar — this is the "Upcoming Appointments" feature; an earlier version of this note wrongly claimed it already existed before it was actually built), a vaccination-progress bar, and (at the time) a growth trend next to the weight/height numbers. **That growth trend no longer exists — see the Child Health ID note below.** A floating "log" button above the tab bar, reachable from every screen, opens a menu that has since grown to 9 items (see `§3`). The old Quick Actions section, the "Hello, {name}" greeting, and the generic Parenting Tip box were removed as low-information repeats; see `Documents/archive/BabyBook+_Dashboard_Redesign_Evaluation.md` for the full reasoning.

**Also done — a further round of dashboard/navigation cleanup, all on `feat/dashboard-redesign`, not yet merged to `development`:**
- **Dashboard**: the baby's photo/name no longer shows three times (header keeps just the name, baby switcher and summary card dropped their own copies); several buttons went icon-only (baby-switcher "+", "See all" links lost their arrow icon); Needs Attention now caps at 1 item + a "+N more" count and also catches hospitalizations, not just overdue vaccines and illnesses; an active-share-code notice (teal, `colors.info`) sits directly under Needs Attention as its own card; "Photo Memories" is now called "Milestone Memories" and its "See all" opens Growth's new Gallery tab (see below) instead of `AllMemories.js`.
- **Health screen**: "Rx Meds" tab renamed "Medicine"; every add button across all tabs is icon-only now; **Checkups moved here from Growth** (own tab, to the right of Conditions) and **Hospitalizations moved here from Conditions** (now sits under the Checkups tab, below the appointments list); the Vaccines tab gained a status filter (All/Due/Done/Overdue pills) plus a name/visit search box.
- **Every record list app-wide is capped at 10 items with a "Show more" button**: Health's five lists, Growth's photo gallery, `AllActivity.js`, `AllMemories.js`, `ShareRecords.js`'s share history and access log, and `NutritionTracker.js` (which already had its own version — pulled out into the shared `components/ui/ShowMore.js` all of these now use).
- **Growth screen**: gained a third tab, "Gallery", holding just the Milestone Memories photo gallery (previously stacked under Milestones alongside the Development Checklist); Milestones now shows only the checklist.
- **Calendar screen**: Calendar is now a monthly-only mobile planner with a centered selected date, tappable previous/current/next month strip, Monday-first swipeable grid, and rounded category bands (including connected medication-course spans). Tapping the active month opens a 3×4 month picker without redundant year arrows; in the current year only the current and remaining months are enabled. The same selected date drives compact Today's plan / Plan for date, Upcoming plans, and Overdue sections. Selected-day rows are persistent checkboxes backed by `calendar_plan_statuses`; this planner-only override never mutates vaccination/checkup/medical completion. Selected-day and Upcoming rows use a deliberate right-to-left swipe: custom and green health-sourced plans reveal the same Update/Delete action palette, with confirmation before deletion; health updates open the matching Health section. At the fully open position the plan foreground still overlaps the padded leading edge of Update, keeping the tray visually attached. Actions remain fully hidden at rest, and short swipes settle closed instead of triggering from velocity alone. Upcoming excludes repeated medication-course days; Overdue is limited to unfinished past vaccines and checkups. A small `Add plan` text action opens the existing custom-event form for the selected date. Selected-day detail taps, Overdue detail behavior, reminders, and the global `+` action sheet remain intact; the view switcher, duplicate Calendar-only `+`, and old tip strip are gone. The category legend is a centered 3×2 grid so markers remain decodable.
- **Calendar plan action labels**: Update/Delete swipe buttons are icon-only, retaining accessible action labels, colors, hit areas, overlap and confirmation behavior. Today's and Upcoming share this renderer; Overdue keeps its existing detail-only rows (no inline action buttons).
- **Plan and health-record details**: every Today's plan, Upcoming, and Overdue row has a trailing chevron and opens the shared full-screen `PlanDetail` view with Edit and confirmed Delete. Custom edits stay in Calendar; health edits carry the source record through `changeView(view, tab, payload)` and open the exact Health editor. Deleting a source record transactionally removes linked planner statuses, reminders, and polymorphic attachment rows before best-effort storage cleanup. Health's Consultations & Appointments, Illnesses & Conditions, and Finished medicine rows use the same icon-free detail-row pattern with centered chevrons, exact edit, and confirmed deletion; attachment thumbnails remain independently tappable.
- **Search screen**: Search keeps the authenticated fetch-once index over vaccines, checkups, medical history, milestones, memories, and custom events, then filters decrypted text locally. Its blank state is now a mobile discovery screen with per-child device-persisted history (six deduplicated terms plus Clear), a two-row horizontal category rail that opens the matching feature tab, and up to eight record-derived suggested searches. Typing swaps discovery for a counted result list. Searches are remembered only on submit, suggestion/history selection, or result opening. Results navigate once through `changeView` so Back correctly returns to Search; the old navigate-then-`goBack` sequence is gone. Nutrition and numeric growth rows remain excluded because they add noise without searchable text.

- **Shared date/time fields**: `components/ui/DateField.js` is the app-wide mobile picker surface on native and web. Date fields open the Growth-style calendar with a tappable month header, constrained month grid, and explicit Done/Cancel actions. Time fields open a three-column AM/PM, hour, and minute wheel-style selector and preserve the API's `HH:MM` storage shape. No form uses browser-native or platform-specific picker UI now.

**Also done — the Dashboard's Summary card became the Child Health ID card** (`Dashboard.js`, styles prefixed `id*` / `fact*` / `stat*`). The old card had no title, no name and no photo — just a chevron and a pencil above a 2-column grid of gender glyph / age / `7.8 (+0.4) kg` / `68 (+1.2) cm`, with allergies and blood type hidden behind a whole-card tap-to-expand. It now reads top to bottom as: identity (56px avatar, name, nickname, `Girl · 15 months`, `Born 12 Mar 2025`), then three always-visible fact rows (Allergies / Blood type / Hereditary, each falling back to `"None recorded"` — the same wording `OfflineSummaryView.js` and `ProfessionalView.js` use, because "nobody entered this" and "this child has none" must not look identical), then the latest weight/height/head with a `Measured <date>` anchor, then a `More details` disclosure holding pediatrician, health center, emergency contact, and place of birth.

Three things about it are deliberate and should not be "fixed" back:

- **The faster/slower growth verdict is gone for good.** PRODUCT.md Principle 5 forbids the app from reading as clinical judgment, and `GrowthChart` sits directly below plotting the same measurements against the WHO reference bands — a real comparison, unlike a pace guess from three home weigh-ins. `growthTrend()` was reduced to `latestGrowth()` (latest measurement + its date); `dayDiff()` and the `(+0.4)` delta formatter were deleted with it.
- **A recorded allergy or hereditary condition tints amber, not coral.** DESIGN.md reserves coral for overdue / error / destructive and defines amber as "needs attention, caution", which is the honest register for a flag whose severity this app never records.
- **Birth weight/length are not used as a fallback** for the measurement strip. They are a different fact from "how big is the baby now", and pairing them with a `Measured …` date would misreport them. With no growth rows at all the strip is replaced by a `Record the first one` prompt into Growth → Metrics.

`ageText()` (exported from `Dashboard.js`, also consumed by `OfflineSummaryView.js`) now returns `"2 years 3 months"` instead of `"2y 3m"`.

**Also done — Baby Switcher and Growth Chart.**

The **Baby Switcher** (`Dashboard.js`, styles `childPill*` / `childName*` / `childDot` / `addChildPill`) was a row of 32px photos with no names. A child without an avatar rendered as a generic grey person icon, so a two-child account offered "this one, or… someone" — and the selected state was a 1px border-colour change nobody could see. Each child is now a named pill (nickname or first name), selected reads as a filled pill, targets are a real 44px, and the bare `+` is a labelled "Add" again. Each pill carries a **coral dot** when that child has an overdue vaccine or an unresolved illness/hospitalization — the same test the Needs Attention card runs — so a parent can see the other child needs something without switching to find out.

That dot costs **2 requests per sibling** (`vaccinations` + `medical-history`), which the user accepted knowing it runs against PRODUCT.md Principle 3. Keep it contained: the selected child's verdict is written into `childAlerts` by the main bundle and never refetched; siblings are gated by `requestedAlertsRef` (a Set), **not** by the `childAlerts` map — keying off the map alone re-ran the effect while a request was still in flight and double-fetched every sibling. `retryAll()` clears both so pull-to-refresh re-checks. Failures are silent: a dot that can't load just doesn't appear.

The **Monthly Growth** card (`GrowthChart.js`) is now a clean current-month trend rather than a miniature clinical chart. Its title/current-month label and anchored metric menu share one compact header; the old three-pill selector, WHO band, WHO legend, and percentile interpretation are absent. Growth and ProfessionalView also show recorded measurements without WHO context.

The latest strip in **Growth → Growth Measurements** is one truthful snapshot: it shows only values from the newest growth log, with each unit below its value and one subtle shared date at the heading's right side. The selector is an anchored All / Weight / Height / Head dropdown that opens on **All**; beside it, a calendar opens an inclusive date filter defaulted to the current month with Month selected. Its quick row is Week / Month / Year: tapping a mode changes the two fields to that unit, while tapping the selected mode again keeps its resolved dates and returns to freely editable Starting date / Ending date fields. Week uses four fixed bands (1–7, 8–14, 15–21, 22–month end) in one month; the picker has month arrows, always renders all four choices, and disables weeks without a valid growth measurement. Month uses constrained Starting month / Ending month grids, and Year reuses the measured-history Starting year / Ending year grid formerly owned by All dates. Endpoint pickers prevent inverted ranges; Week and Month are bounded by birth/today, while Year preserves the recorded-history window. Changes remain draft-only until Done. Each baby's last applied view is retained in memory while signed in, legacy All state is normalized to Year, and a new session starts on Month again. Every parent chart fits its real first and latest visible measurements to the plot width without fabricated edge points. Filters affect only Growth charts, not the all-time latest snapshot or history. Every history card opens a measurement-detail sheet; Update reuses `GrowthModal`, while Delete requires inline confirmation. The Growth Measurements add action is a labelled 44px circular `+` in the card header's upper-right corner.

  Parent-facing charts use Public Sans labels, subtle dashed horizontal value guides, and a 2.5px straight-segment line over the existing metric-coloured area treatment. Earlier saved measurements use small, translucent metric-coloured dots while the newest visible measurement receives an opaque ringed dot. Axis labels have no tinted backgrounds, bold emphasis, or special colours. The y-axis shows seven regular whole-number scale labels at fixed, equally spaced heights aligned with the horizontal guides; no separate dot-aligned latest-value caption is inserted. Exactly seven x captions are centered at fixed, equally spaced positions along the plotted x-axis, not across the full card width. Their centers are `gutter + (index / 6) * plotW`: the first and seventh captions sit at the plot endpoints with six identical intervals, independently of dot positions. Their unit and y-axis values align with the left edge of each chart heading while the plotting gutter keeps the line clear of those labels. Their plot heights are 220px for compact Home/All charts and 288px for the full single-metric chart; the clinician chart keeps its original dimensions and denser clinical presentation. The Home card's localized **View detail** footer opens Growth on its default Measurements tab without triggering the Log Growth form.

Parent charts retain exact measurements in the line while showing all seven equally spaced whole-number y-axis scale labels without suppressing ticks near the latest dot. Dots remain on one proportional recorded-date scale from the first visible measurement to the latest, while x-axis captions use equal-width display slots so readable labels never bunch around rounded dates or years. Short filters still keep only the highest-ID measurement per calendar day. Home, Week, Month, and manual ranges show seven chronological day captions; Year ranges show seven year captions while keeping both recorded endpoints. Dates or years intentionally repeat when fewer than seven distinct values are available. No x caption is suppressed or shifted to follow the latest dot. Growth's metric-All view shares one recorded-date window across Weight, Height, and Head so the charts remain comparable. Earlier saved measurements are outlined and secondary while the latest ring remains prominent. Every Growth chart heading also shows that metric's latest filtered value and unit, rounded to a whole number; empty metrics show no header value. Growth's quick actions remain one compact Week / Month / Year row, Month is selected on each baby's first session visit, the latest-measurement date sits at its heading's right side, and the All-metrics Weight / Height / Head headings carry a small gap before their charts. Run `node utils/dates.check.js` and `node components/PercentileChart.check.js` for the filter and axis-layout regression checks.

Measurements after age five remain visible in every chart. Dense daily series keep every value in the line while showing an adaptive subset of real-data markers; missing days never create placeholder dots.

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

`MemoryDetail` is a full-screen opaque modal with its own themed page gradient. A modal renders outside `App.js`'s gradient tree, so a transparent root exposes the Home or Gallery cards underneath it.

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

**Also done — Memories and Milestones share one form, and a milestone can finally be recorded.**

The question that started this was whether to merge the two features, because they read as duplicates. They are not. A milestone travels to a healthcare professional in the QR snapshot (`snapshot.js`, "Developmental Milestones"); a photo memory is absent from `RECORD_LABELS` and is therefore **structurally unshareable**. That is the only difference that matters, and the app never stated it.

They *felt* redundant because one was doing the other's job: **the Milestones feature could not record a milestone.** The only way to create one was ticking a box on a fixed six-item checklist, every item under nine months, in an app built for 0–6 years. First steps, first word, first solid food were all unenterable, so they went in as photo memories the doctor would never see. Meanwhile `seedDemoYear.js` was writing free-text titles with ages, descriptions and photos into the same table — **the demo account held records the app itself could not create.** No migration was needed; `records.routes.js` already exposed all six columns.

What changed:

- **`components/ui/AddMemoryModal.js` is now one form for both kinds**, with a Photo / Milestone switch, a date field, and a line stating that milestones are shared with a healthcare professional and photos are not. Milestone titles are free text with suggestion chips.
- **`utils/milestoneChecklist.js` is new** — the six reference items (moved out of `Growth.js`) plus `normalizeTitle()`, `findRecorded()` and `suggestedTitles()`, covered by `milestoneChecklist.check.js` (23 assertions). **Titles are compared through `normalizeTitle()`, never `===`.**
- **The chips offer only checklist items this child has *not* recorded** — deliberately unlike `foodSuggestions()`, which offers what you logged before. Foods repeat; milestones happen once, so suggesting a recorded one invites a duplicate.
- **`utils/dates.js` gained `ageAtDate(dob, date)`** (lifted from `MemoryDetail.js`, which had the only copy). Saving a milestone now derives and stores `age_achieved` — the field the QR snapshot ships and `ProfessionalView` renders, which was NULL for every record the app itself created.
- **`utils/resource.js` gained `photoColumn`/`photoField`**, doing for the generic router the three things `memories.routes.js` does by hand: multipart create, signed-URL resolution on every response, file cleanup on delete. Without resolution a stored `sb://` ref reaches the app raw and renders as a broken tile. Enabled for `milestones` only. The registration loop now spreads the whole config (`createResourceRouter(r)`) — the old hand-copied key list would have silently dropped it.
- **`Dashboard.js`'s "Milestone Memories" is now "Photos & Milestones"** — that label borrowed the milestone name for records that are not milestones, and is the single biggest reason the two looked like one feature. Its dead `AddMemoryModal` branch was removed (nothing has routed `memory` to the Dashboard since the FAB started targeting the Gallery), so the form now has exactly one call site — the only one holding the milestone list its chips need.

**A demo-visible defect fixed with it.** The checklist matched titles with `===` while the seed wrote near-misses — "Rolled Over (Tummy to Back)" against the checklist's "Rolls Over (Tummy to Back)", "Social Smile" against "Responsive Social Smile". **No seeded milestone matched any checklist item**, so the demo account showed six empty checkboxes beside eleven achieved milestones. The four corresponding seed titles now use the checklist's exact wording. Note that **normalization alone does not fix this and must not be made to** — "Rolled" and "Rolls" are different words, and `milestoneChecklist.check.js` pins that a fuzzy match is *not* wanted. The remaining seed milestones deliberately stay off-checklist so the demo exercises both halves.

Two things to leave alone. **The QR snapshot still selects only `title, age_achieved, date_recorded, is_completed`** — no photo, no description. The clinician gets the milestone, not the family album; that boundary is deliberate. And **the checklist still stops at nine months.** Extending it is a content and sourcing problem, not a code one — a 0–6y developmental checklist needs a citable source, and PRODUCT.md forbids implying a DOH or barangay relationship. Free-text titles mean no parent is blocked meanwhile.

**Also done — the Development Checklist now covers 0–5 years, and the Milestones tab was rebuilt around it.**

The checklist held **six** items, all under nine months, in an app for ages 0–6 — dead space from ten months on. It now carries **146 items across CDC's 12 age checkpoints** (2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60 months) in four domains.

**Source, and why not a Philippine one.** Items come from the **CDC "Learn the Signs. Act Early." 2022 revision**, which lists what ~75% of children can do by an age (the previous edition used 50%) and removed hedges like "may" and "begins". It is US federal work, so public domain and reproducible exactly. The Philippine instrument — the **ECCD Checklist** (ECCD Council / DSWD, seven domains, validated in 2001 on 10,915 Filipino children) — was examined first and rejected on purpose: **~300 items across two forms, designed for administration by a trained worker, tallied into domain raw scores.** A scored assessment instrument inside a parent-held baby book is what Principle 5 forbids, and a hand-picked subset would borrow the ECCD name without being it. The screen states that Philippine health centres and day care centres use the ECCD Checklist — **a fact about the world, not a partnership claim**. All of this reasoning is in the header comment of `utils/milestoneChecklist.js`; read it before touching any item text.

**The corpus is a shortened list and says so.** Some bands carry fewer items than CDC publishes. The attribution names the source, admits the abridgement, and points at cdc.gov for the full version. **Never reword an item to sound more certain, and never invent one to fill a thin band** — a fabricated milestone in a health app is a correctness bug. The list ends at 5 years because published checklists do; inventing 5–6 content would be exactly the fabrication PRODUCT.md forbids.

**The tab itself:**
- **It opens on the child's own age band.** It used to open on the youngest band for every child, so a parent of a three-year-old was shown two-month milestones every time. `monthsBetween()` (extracted from `ageAtDate` in `utils/dates.js`, so the band and the displayed age cannot disagree) feeds `checkpointFor()`.
- **The band is chosen from a bottom sheet**, not a row of pills. A trigger row shows the age being viewed (`12 months`, `2 years` — `bandLabel()` deliberately has no "By" prefix) and opens `components/ui/OptionSheet.js`, a small sheet that follows `ActionSheet.js`'s idiom exactly so the app has one bottom-sheet pattern rather than two that nearly match. The child's own band carries a muted "Your baby" note and the sheet scrolls to the current choice on open. This **replaced a horizontal scroller of twelve pills**: most bands sat off-screen, the selected one could scroll out of view, and keeping it visible needed a hard-coded `BAND_PILL_STRIDE` pixel constant that would silently go wrong the moment the pill padding changed. Do not reintroduce that. **`bandLabel()` no longer takes a `short` argument** — the compact `"2 yr"` form existed only for the pills.
- **"Your baby" is suppressed when `dateOfBirth` is missing.** `monthsBetween` returns null there and `checkpointFor` falls back to the first checkpoint, so labelling it would tell a parent their child is two months old on the strength of an empty field.
- **Grouped by domain**, four labelled groups per band in a fixed order, each with its `colors.rec*` tinted icon tile.
- **The stock Unsplash photos are gone.** Six pictures of strangers' babies was already odd; 146 would be network for nothing. The parent's **own** photo shows on a row they have recorded — the one image there that means anything.
- **Progress is a count, never a score:** "4 of 12 recorded". The word is *recorded* because it counts entries, not development. No percentage, no bar, and **no coral or amber on an unticked item** — DESIGN.md reserves those for overdue/error/caution, and a milestone not yet reached is none of the three.
- A `promptBox` states that children develop at their own pace and that nothing here is a test, matching the register of the growth-percentile note already on this screen.

**Two consequences handled:**
- **The Gallery would have flooded.** It included every completed milestone, so ticking forty boxes would bury a family's photos under forty bare rows. `completedMilestones` now requires a **photo or a description** — something the parent authored. A bare tick still shows on the checklist with its date.
- **`suggestedTitles()` is age-aware** and takes the child's age in months; against 146 items an age-blind list offered newborn milestones to a four-year-old.

**Seed:** the demo milestone titles deliberately exercise both exact checklist matches and free-text family entries. Completed rows are capped at each infant's current age; future achievements remain part of the simulated 2027–2029 history. `front-end/utils/seedMatch.check.js` cross-checks the matching corpus after seed edits. Note CDC 2022 **dropped crawling entirely**, which is precisely why free-text milestones matter.

**Known debt, decided deliberately:** the ~146 item strings are **English only**. PRODUCT.md calls bilingual "a product commitment, not a feature toggle", so this is a recorded gap, not an oversight — the Filipino pass is its own piece of work. For context, `tag` is already only ~63% translated app-wide (46 of its 123 keys are still English), so this screen is not the outlier it looks like. Item text lives in `utils/milestoneChecklist.js`, not `translations.js`; when it is translated, the natural shape is `{ en, fil }` pairs in the data module rather than ~300 new keys.

**Also fixed — a form opened by itself whenever a bottom-nav tab was tapped.**

`changeView(view, tab = null)` in `App.js` only wrote the deep-link target when a tab was passed (`if (tab) { setNavTab(tab); … }`), so a plain bottom-nav tap left **`navTab` holding its previous value forever**. Screens are rendered conditionally, so Health / Growth / Nutrition **unmount** on navigation away and their `useEffect(…, [navKey])` runs again **on the next mount** regardless of whether `navKey` changed. Use the "+" to add a vaccine, close it, go to the Dashboard, tap Health — Health mounted fresh, read the stale `"vaccine"`, and popped the Add Vaccine form on its own. The same sequence popped Log Growth, Add Memory, Log Milk and Log Food on their own tabs.

`changeView` now always writes `navTab`, **including `null`**. `goBack()` and `handleLogOut()` clear it too, because both set `currentView` directly and bypass `changeView`. **Do not "optimise" this back to `if (tab)`** — and do not patch it inside the three screens; their `tabFor` / `modalFor` maps were always correct, and the guard belongs in the one place all navigation routes through. The class of bug to watch for generally: **state that outlives an unmount and is re-applied on the next mount.**

**Also done — Vaccination Tracking rebuilt, and the DOH schedule verified against a primary source.**

**The schedule had a real error.** `data/epiSchedule.js` flagged three rows as MEDIUM confidence and said they "MUST be checked against a primary DOH/PIDSP document before this is used in the actual capstone defense". They have now been checked, on 2026-08-16, against the **2026 PIDSP Childhood Immunization Schedule** (`https://www.pidsphil.org/home/wp-content/uploads/2025/11/2026-PIDSP-Immunization-Calendar.pdf`), whose colour coding marks which rows belong to the free National Immunization Program:

- **IPV was wrong** — modelled as a single dose at 14 weeks; there is a **2nd dose at 9 months**. A parent following the app would have missed it. Added.
- **Japanese Encephalitis confirmed national**, and has a **2nd dose at 19–24 months** that was absent. Added.
- **MMR dose 2 at 12 months confirmed** for the NIP row; the 12–15 month window belongs to the separate private-sector row.

**How to read that PDF again, because the dead ends cost real time:** the DOH EPI page returns 403 to automated fetches; the PIDSP PDF defeats WebFetch, raw zlib stream inflation *and* ToUnicode CMap decoding (its tables use subset fonts whose CMaps cover only 85 codes). It was read by **rendering it in Chrome and reading the page**. Private-sector vaccines on that calendar (Rotavirus, Varicella, Hepatitis A, Influenza, DTwP/PCV boosters) are **deliberately excluded** — listing them inside a schedule the app presents as the DOH programme would tell a parent they are owed something free that they are not.

`SCHEDULE_VERSION` is now `DOH-NIP-2026-PIDSP-verified-2026-08-16`, and `src/data/epiSchedule.check.js` (30 assertions, no database needed) pins the schedule and the dedupe.

**Migration `004_vaccination_detail.sql` — the user must run `npm run db:migrate:up`.** Adds `dose_number`, `reaction_severity` (`none`/`mild`/`severe`) and `reaction` (encrypted) to `vaccinations`. No backfill for `dose_number`: the digit that would populate it lives inside the **encrypted** `vaccine_name`, which SQL cannot read — the same wall the nutrition reaction backfill hit.

**A dedupe trap worth understanding.** Giving IPV a dose number renames a stored `"IPV"` to `"IPV 1"`, and the EPI generator's `fill-gaps` key was `vaccine_name|visit_name` — which would have inserted a **duplicate of every affected dose into every existing child**. `epiDedupeKey()` (now exported and tested) strips a trailing dose digit before comparing, so `"IPV"` and `"IPV 1"` are one dose while `"IPV 2 | 9 Months"` stays new. Doses are told apart by `visit_name`.

**The form and tab:**
- **The vaccine name is picked, not typed.** A blank box asking a non-medical parent to name a vaccine is close to unanswerable. The picker reuses `ui/OptionSheet.js` and is fed by a new `GET /api/children/vaccine-catalogue`, served from `epiSchedule.js` itself so the picker and the due dates cannot drift. "Something else" keeps free text available for a private or overseas dose. Offline it falls back to names already in the child's own records — **never** to a hard-coded copy of the schedule.
- **Dose number** is a chip row, pre-selected to the lowest dose this child has no record of.
- **`date_given` is no longer forced to today.** `applyVaccineToggle` hard-coded `todayLocal()`, so a dose given last week was filed as today's — and `date_given` is exactly what the professional portal shows a clinician. Marking a dose given now asks when.
- **Post-dose reaction** (None / Mild / Severe + description) is captured in the same step, mirroring the nutrition solid-food reaction so the app asks this question one way. **Principle 5 guard: it must never write to `children.allergies`, warn, or say anything about a later dose.** A quiet line naming where a known allergy belongs is the limit.
- **A "what's next" band sits above the list** — missed doses (coral, tappable into the Overdue filter) and the next visit with everything due that day (teal, informational). Rows show a mild/severe reaction marker; `none` shows nothing, because a "no reaction" line on every dose hides the one that matters.
- `snapshot.js` and `ProfessionalView.js` carry `dose_number` and the reaction through to the QR consultation view, where a reaction outranks lateness in the flag slot.

**Also done — illnesses and hospital stays can finally END, and both forms were rebuilt.**

The Add Illness form was two free-text boxes ("Condition / Illness Title", "Doctor Remarks & Advice")
and a mandatory photo, under a title reading "Add Clinical Record". Underneath it were three real bugs.

**The big one: nothing in the app could ever mark a record resolved.** `resolved: false` was written
at creation and no front-end file ever wrote `true` — there was no edit path for `medical-history` at
all. But four places read that boolean and assume it changes: the Dashboard's Needs Attention card
(which ranks an unresolved hospitalization as the single loudest alert in the app), the baby
switcher's coral sibling dot, the professional portal's "Unresolved:" line, and `CalendarView`. So a
cold logged in March still said "not yet resolved" in August, a discharged hospital stay still read
as *in hospital right now* at the top of a clinician's QR view, and the parent had no way to clear
either. Same class as the vaccination `date_given` bug: a field the professional portal presents as
fact that the app cannot maintain.

The other two: **the date was forced to `todayLocal()`**, so Tuesday's fever logged on Friday was
filed as Friday; and **the mandatory photo hard-blocked the commonest case** — a fever managed at
home has no document to photograph. The photo is optional for illnesses, hospital stays, and
scheduled vaccination appointments. A vaccination-card photo is required only when marking a dose
as given; prescriptions and checkup slips remain required.

**Migration `005_medical_event_detail.sql` — the user must run `npm run db:migrate:up`.** Adds
`resolved_date` (got better / discharged on), `care_level` (`home`/`doctor`/`hospital`), and
`facility` (encrypted). `resolved_date`/`care_level` stay OUT of `encrypted` for the same reason
`dose_number` did in 004. `medical_history.notes` stays unused rather than being repurposed as a
hospital name — stuffing a distinct fact into a general-purpose column is what made "which dose is
this?" a string match on ciphertext before 004.

**`care_level` is a record of what the family DID, never a severity grade.** "At home" is not "mild"
and "hospital" is not "severe"; PRODUCT.md Principle 5 makes any reading as clinical judgment a
correctness bug. Do not add a severity field, a symptom checklist, or any "this looks serious"
verdict. Duration is arithmetic and is fine.

**`components/ui/MedicalEventModal.js` is new** — one form for both kinds, keyed by `kind`
(`"illness" | "hospitalization"`) with an optional `record` prop (absent = create, present = edit).
They are the same row underneath and had the same bugs; one implementation keeps them fixed
together. **Edit is the whole point** — it is what makes "this is over now" sayable, and it is the
app's first edit path for medical history. Rows carry an action that opens it (`checkmark-done` when
open, `create-outline` when closed).

**`utils/commonConditions.js` is new** — tap-to-fill chips under "What was it?", offering this
child's own previously recorded conditions first, then common ones. Deliberately the opposite of
`suggestedTitles()` for milestones, which offers only what has NOT been recorded: a milestone happens
once, an illness comes back. **Its header states these are typing shortcuts, not a diagnosis list and
not sourced from DOH/WHO/PIDSP or any clinical instrument. Never add a sourcing claim to that file,
and never make the list the only way in** — free text stays primary. Covered by
`commonConditions.check.js` (22 assertions).

**`utils/dates.js` gained `spanText(start, end)`** — "3 days", "2 weeks", "Ongoing since 12 Aug 2026".
Both lists, the Dashboard and the clinician's view need to say "how long" the same way; four copies
is how `toISOString().slice(0,10)` reached twelve sites. Covered in `dates.check.js` (now 71).

**A separate bug fixed in `ProfessionalView.js`:** the medical-history rows coloured every unresolved
row coral with an alert icon — including **every Medication**, which has no ongoing/resolved meaning
and whose `resolved` column is simply always FALSE. Only Illness and Hospitalization carry a status
now; a medication is neutral. Tones follow the Dashboard's ladder (coral = in hospital now, amber =
illness still being got over, green = over).

**Validation feedback stays beside the pinned actions, now in the shared form header.** This
was tested live and matters: the form is long enough that a parent filling in the notes box is
nowhere near the first field, and an error rendered at the top of a scrolled ScrollView is a Save
button that appears to do nothing. Scrolling the ScrollView back was tried first and is a trap —
**on react-native-web the ScrollView ref is the DOM node, whose `scrollTo` reads `top`/`behavior` and
silently ignores React Native's `y`/`animated`.** The coral field border says *which*, the pinned
line says *what*.

**A stale-dev-server trap worth knowing.** After editing `records.routes.js`, the running
`npm run dev` backend did not restart, and `pickBody` filtered the new columns out — so
`resolved: true` saved while `resolved_date` and `care_level` came back null, looking exactly like a
front-end bug. A fresh process passed every assertion. **If new columns silently return null, restart
the API before debugging the client.**

`seedDemoYear.js` now gives every seeded illness and the hospital stay a real `resolved_date`
(Common Cold 6 days at home, Ear Infection 10 days with a doctor, Jaundice 2 days at Metro General),
so the demo shows real durations instead of bare dates.

**Deliberately not done:** delete (a destructive confirm needs a pattern this app lacks — RN `Alert`
is unreliable on the web build); a symptom checklist; temperature (removed deliberately, see §5);
linking a medication to the illness it treated.

**Also done — Medication became a tracker instead of a list.**

The form collected a name and a free-text "Dosage guidelines", under a section
titled **"Medication Reminders"** — and the app had never scheduled a medication
notification in its life. The `reminders` table's CHECK constraint only permitted
`'Vaccination'` and `'Checkup'`, so the data model excluded them outright. Same
class of defect as the vaccine bulletin's "Real-time updates" claim.

Every row also read **"Duration: As prescribed"**. `medHistoryToMed` fell back to
that string when `notes` was empty, and the form never wrote `notes` — so a
duration nobody had entered was displayed on every medicine a parent had ever
recorded. The start date was hard-coded to today, nothing could be edited, and
there was nowhere at all to record that a dose had been *given*.

**Migration `006_medication_detail.sql` — the user must run `npm run db:migrate:up`.**
Adds `dose_amount` (encrypted), `frequency_per_day`, `dose_times` (jsonb),
`course_days`, `prescribed_by` (encrypted) and `treats_id` (a self-referencing FK
to the illness, `ON DELETE SET NULL` so removing the illness never takes the
medicine with it) to `medical_history`, plus a new **`medication_doses`** table —
one row per dose actually given. `date_recorded` / `resolved` / `resolved_date`
are reused from 005 as started / finished / finished-on, and `description` keeps
its meaning as the instructions.

**THE LINE THIS FEATURE MUST NOT CROSS.** PRODUCT.md Principle 5 is unusually
load-bearing here. There is **no drug database, no suggested dose, no frequency
recommendation, no mg-per-kg, no unit conversion, no interaction or allergy
cross-check, and no "you missed a dose" nag** — and none may be added.
Specifically:

- **Name suggestions come only from medicines already on this child's record.**
  A built-in list of paediatric drug names would read as the app proposing a
  medicine. That is a different act from `commonConditions.js`, which names
  things that happen *to* a child. The guard is written into the header of
  `ui/MedicineModal.js` and `utils/medication.js`; read it before editing either.
- **An untaken dose slot is drawn as simply not filled** — never coral, never
  amber, never "late". The app records doses; it does not grade the parent.
- **`defaultDoseTimes()` spreads N slots across a 07:00–22:00 waking day** and is
  labelled "when will you give it?". That is arithmetic and a convenience. Do not
  reword it into a recommendation.

**The tab** now has "Taking now" — each running course showing `5 mL · 3 times a
day`, `Day 3 of 7`, what it treats, and a row of today's dose slots that fill as
they are recorded ("2 of 3 today · next at 8:00 PM"). Tapping a filled slot
undoes it, because a double-tap must be correctable. Finished courses drop to
their own section with a real span. `utils/medication.js` holds all the
arithmetic (68 assertions in `medication.check.js`); note `isActiveOn()`
treats a course whose planned end has passed as over even if nobody ticked it,
which is what stops March's antibiotics reading as current in August.

**Reminders, and a live bug they collided with.** `notifications.js` had **no
cancel function at all**, and `App.js` re-scheduled every pending vaccination
reminder on **every app launch** — ten launches, ten copies of the same
notification, burning the iOS cap of 64 pending that the function's own comment
said it existed to respect. `scheduleReminder` now takes a `kind` tag and
`cancelRemindersOfKind()` withdraws by it; vaccinations cancel before
rescheduling. Medicine doses are armed in a **rolling 48-hour window capped at
24**, topped up when the tab opens — one 3×daily week-long course is 21
notifications, so scheduling whole courses would exhaust the budget immediately.
No `reminders` rows are written for medications; the schedule is derivable from
`dose_times`, so restating it in 21 rows per course would be duplication.

**`notificationsAvailable()` now returns false on web, and that is the point.**
`expo-notifications` *resolves* in the web bundle, so the old `!!Notifications`
returned true there and every caller concluded reminders were working — they
were not, since a future-triggered notification is native-only. `GeneralSettings`
and the Medicine tab both tell the parent the truth off the back of this
function. `ensureReady()` also guards on it now, so the web build no longer pops
a browser permission prompt to arm a reminder that can never fire.

**`utils/resource.js` gained a `json` column list.** node-postgres serializes a
plain object to JSON but turns a JS **array** into a Postgres array literal,
which a `jsonb` column rejects — `dose_times` failed with "invalid input syntax
for type json" until `pickBody` stringified it. `calendar_events.reminder_settings`
never hit this because the client sends an object.

**A pre-existing bug fixed in `ProfessionalView.js`:** medications got their
status back. Last pass made them neutral *because* `resolved` was a column
nothing could set for them; 006 made "still taking / finished" real. A running
course is **teal**, not coral — a medicine taken as prescribed is context, not an
alarm. The ClinicalSummary band gained a "Currently taking" line, which is the
single fact a clinician most needs before prescribing anything else.

**Also:** the Calendar spans a course across its days instead of dotting only day
one; `Dashboard.js`'s comment explaining why medications are excluded from Needs
Attention was rewritten (they are now answerable — they stay out because taking
medicine as prescribed is not a problem); and the demo seed gives Amoxicillin a
real dose, frequency, length and link to the Ear Infection, plus a **currently
running** Paracetamol course with a part-finished day of doses.

**Layout note worth keeping:** "Record a dose" sits on the LEFT of its row. The
floating "+" is anchored bottom-right and floats over the list, so a
right-aligned primary action ends up underneath it at the wrong scroll position.

**Migrations — resolved 2026-08-10:** the three additive migrations under `back-end/src/db/migrations/` (`000_calendar_events.sql`, `001_access_log_context.sql`, `002_vaccination_source.sql`) were previously applied only to the local dev database. `npm run db:migrate:up` has since been run against Supabase's Session pooler (`DB_SSL=true`) and verified via the `schema_migrations` table — all three are now confirmed applied to the live database. Custom calendar events, auto-generated EPI vaccination doses, and the QR consultation `POST /api/consult/resolve` flow (which writes to `access_logs.ip_address`/`user_agent`) all now have the columns/tables they need on the deployed backend. If a *new* migration is added later, remember: use `npm run db:migrate:up` (additive) — never `db:migrate`, which drops and recreates every table and is intentionally left for the user to run, not something Claude should do unattended.

**Demo account**: `demo.parent@babybookplus.app` / `Demo1234!`. `seedDemoYear.js` keeps the caregiver's 2020 member-since date while modelling two current infants: Sofia (female, born 14 November 2025; 10 months on 14 September 2026) and Elias (male, born 14 February 2026; 7 months). It creates distinct daily growth and nutrition histories from each birth through 31 December 2029, plus age-aligned health, milestone, memory, and calendar records. Milk is logged daily with age-decreasing frequency; complementary foods begin at six months and progress to regular meals. The current seven-day Nutrition view therefore shows Mixed feeds plus three meals for Sofia and Breastmilk plus one meal for Elias. Future rows are explicitly labelled simulated, and large daily sets are inserted in batches. The command deletes and recreates only this demo user, verifies both profiles and daily coverage, and refuses non-local databases unless `ALLOW_DEMO_RESEED=demo.parent@babybookplus.app` is supplied for that command.

Phase 4 (UI/UX polish) is next: accessibility/contrast (esp. pink theme small text), 44px touch targets, ≥16px inputs, consistent empty/loading/error states, motion.

## 9. Navigation Overhaul + Calendar module (DONE — see §8)

This section records the original implementation. Its former side-menu decision was superseded on 2026-09-08 by the Profile & Settings hub described in §8, and its three-view Calendar requirement was superseded on 2026-09-15 by the monthly-only planner documented there.

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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- **Nutrition chart update (September 2026)**: supersedes the legacy histogram/card description above. One **Nutrition Over Time** card owns the Growth-style Week / Month / Year / custom date filter and an All / Milk / Food dropdown. All displays stacked Milk and Food histograms with independent zero-based integer axes, rounded-top bars, at most seven evenly distributed date labels, a dashed bucket-average line and a prominent per-day/week/month average. Every selected interval remains present, including zero-value gaps; long ranges keep every bar and compress them into the fixed plot. Earlier bars use a subtle theme tint while the newest non-empty bar is emphasized. Milk uses the current palette primary and Food its accent, including light/dark variants; both can also be viewed alone. A second anchored dropdown controls Feeds, Volume, or Breast Time for the Milk histogram and is hidden in Food-only mode; unavailable measures remain omitted. The applied date range also updates Feeding Pattern, defaults to Month, and persists per child for the signed-in session. Week choices without milk or food records are disabled. Run `node components/ui/NutritionTrendChart.check.js` and `node utils/feedingStats.check.js` for focused checks.
- **Nutrition filter modal update (September 2026)**: mirrors the Growth filter's padded layout. Opening a Starting or Ending field replaces the main form and quick actions with a focused date, week, month, or year picker; selecting an option or using Back returns to the filter form. Run `node components/ui/NutritionDateFilter.check.js` for its focused check.
- **Nutrition histogram axis update (September 2026)**: Milk and Food use seven equally spaced whole-number y-axis labels from the computed maximum down to zero. The average-period caption keeps a medium bottom gap before the plot, and the unit label has a subtle top gutter above the highest tick.
- **Growth month-axis update (September 2026)**: the Year-filter view uses locale-aware three-letter month captions in its seven fixed x-axis slots. Day-number and multi-year labels remain unchanged, and the axis font stays at 13px.
- **Growth Month date-axis update (September 2026)**: the Month quick-action view uses zero-padded `DD/MM` captions. It keeps seven equal slots when the plot is at least 240px wide and uses five equal slots below that threshold to prevent collisions at the 13px text floor; this is the sole narrow-screen exception to the older exact-seven-caption rule.
- **Growth/Nutrition filter trigger update (September 2026)**: applied Week, Month, and Year quick actions collapse to localized Weekly, Monthly, and Yearly labels. With no quick action, both filters show the full `DD/MM/YYYY - DD/MM/YYYY` range via the shared date formatter.
- **Growth/Nutrition Year-axis update (September 2026)**: multi-year Growth views plot only each metric's latest real measurement per calendar year, position annual points from the selected starting year to ending year, skip missing years without inference, and show at most seven unique equally spaced year captions including both endpoints. A single selected year keeps every Growth measurement and uses smaller, equally spaced three-letter month captions. Nutrition keeps its existing histogram buckets and values but follows the same unique multi-year captions and single-year month-caption treatment.
- **Growth/Nutrition custom-range axis update (September 2026)**: when no quick action is applied, Growth and both Nutrition histograms show zero-padded `DD/MM` captions from the selected date range. Captions use seven equal full-axis slots, fall back to five below 240px of plot width, and deduplicate short ranges before redistributing the remaining dates. Preset axis formats and chart data are unchanged.
