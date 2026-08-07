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
- Two live targets today: an **EAS-hosted web build** (defense demo) and the **Render**-hosted API pointed at Supabase. (Migrated from Railway in August 2026 after its free trial expired — see `DEPLOYMENT.md` and `Documents/plans/BabyBook+_Web_Demo_Hosting_Migration_Plan.md`.)

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
│   │   ├── Dashboard.js Health.js Growth.js Services.js CalendarView.js  # primary tab screens (bottom nav)
│   │   ├── NutritionTracker.js                            # unified milk+solids tracker w/ dependency-free charts
│   │   ├── ShareRecords.js QrCodeView.js QrScanner.js     # parent QR share + scan
│   │   ├── ProfessionalView.js                            # healthcare-pro view-only portal
│   │   ├── SideMenu.js                                    # slide-in drawer (avatar tap) — replaces the old Profile tab
│   │   ├── settings/                                      # side-menu destination screens: ViewProfile, EditProfile, GeneralSettings, ThemePreferences, LanguagePreferences, HelpSupport, AboutApp, ChangePassword, PrivacySettings
│   │   ├── Auth.js Landing.js EmptyChild.js AppLoadingScreen.js MemoryDetail.js
│   │   ├── common/Cards.js                                # shared card components (SectionContainerCard, ListEntryCard, MemoryVisualCard, EmptyStateCard, MetricWidgetCard)
│   │   └── ui/                                            # Button, Field, DateField, PhotoAttach, ImageViewer, Gradient, Toast, Screen, Grid, Skeleton
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
├── BabyBook+_Alignment_Evaluation_2026-07.md, _Application_Evaluation.md, _Research_Alignment_Evaluation.md,
│   _Responsive_UI_System.md, _UIUX_Evaluation.md, _UIUX_Redesign_Direction.md, _DPA_RA10173_Compliance.md
│                                               # research-doc alignment / UX evaluation / DPA compliance write-ups
├── DEPLOYMENT.md  DEVELOPMENT_ROADMAP.md
└── graphify-out/                                # code knowledge graph (see §11)
```

## 3. Architecture & conventions (follow these)

- **Navigation is custom, not expo-router.** `App.js` holds `currentView` state and swaps screens with conditional rendering (`front-end/App.js:520-612`). Bottom-nav values: `"dashboard" | "health" | "growth" | "services" | "calendar"`. Side-menu/modal values: `"share" | "viewProfile" | "editProfile" | "generalSettings" | "themePreferences" | "languagePreferences" | "helpSupport" | "aboutApp" | "changePassword" | "privacySettings"`. The bottom tab bar and header/menu buttons call `setCurrentView(...)`. There is **no React Navigation / expo-router**; do not introduce it without discussion.
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

## 8. Current status

**Done:** full research-doc alignment (attachments, unified nutrition, removed sleep/temp/feed, child fields); QR share + professional portal; backend with field encryption + consent + DPA doc; **dynamic girl/boy theme across every screen** + Settings override; deployment (Render API + Supabase + EAS web demo, all in sync — migrated off Railway in August 2026 after its trial expired, see `DEPLOYMENT.md`).

**Also done — Navigation Overhaul + Calendar module (§9 below), increments A–F:** side menu (slide-in drawer) replacing the old Profile tab; bottom nav is now **Dashboard, Health, Growth, Services, Calendar**; all 9 menu destinations built (`front-end/components/settings/`: ViewProfile, EditProfile, GeneralSettings, ThemePreferences, LanguagePreferences, HelpSupport, AboutApp, ChangePassword, PrivacySettings) + `POST /api/auth/change-password`; full Month/Week/Day calendar (`front-end/components/CalendarView.js`, `react-native-calendars`) aggregating vaccinations/checkups/medical-history with tap-to-detail; `calendar_events` table + generic CRUD (reuses `utils/resource.js`, resource path `calendar-events`) for user-created events with reminder lead-time + local notifications; Dashboard "Upcoming Appointments" widget. All verified live against the `back-end-api`/`front-end-web` preview servers (`.claude/launch.json`) using the demo account below.

**⚠️ Pending user action:** three additive migrations under `back-end/src/db/migrations/` (`000_calendar_events.sql`, `001_access_log_context.sql`, `002_vaccination_source.sql`) exist in the repo but as of this writing are **not confirmed applied to the live Supabase DB** — only to the local dev database. Run `npm run db:migrate:up` (back-end/, `DATABASE_URL` pointed at Supabase's Session pooler, `DB_SSL=true`) — **not** `db:migrate`, which drops and recreates every table and is intentionally left for you to run, not something Claude should do unattended. Until this runs against Supabase: custom calendar events 404/500 gracefully (calendar still works for vaccinations/checkups/medical-history) but won't persist; auto-generated EPI vaccination doses silently fail to generate (child creation itself still succeeds, `scheduleGenerated: false` in the response). **The QR consultation `POST /api/consult/resolve` flow will hard-fail with a 500** — it unconditionally writes to the new `ip_address`/`user_agent` columns on `access_logs`, so this is not a "degrades gracefully" case for the app's headline feature. Do not consider the deployed backend demo-ready until this migration has run against Supabase.

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
