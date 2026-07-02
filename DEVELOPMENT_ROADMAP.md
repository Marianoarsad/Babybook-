# BabyBook+ — Development Roadmap to Capstone Defense

A step-by-step plan to take BabyBook+ from its current state to a functional,
presentable system you can confidently demo and defend. Work top-to-bottom; each
phase ends with a checkpoint you can verify before moving on.

---

## Where the project stands today

**Done**
- Front-end prototype (Expo / React Native): auth screens, child profiles,
  health, growth, services, settings, and the **parent-controlled QR consultation
  feature** (record selection → expiring QR → healthcare-professional view-only
  screen → access log), all building cleanly for web.
- Backend API (Express + PostgreSQL, raw `pg`): refined ERD schema, JWT auth,
  full CRUD for every record type + daily trackers, photo upload, and the QR
  share / public resolve / access-log endpoints. Supabase-ready.
- A 15-minute defense slide deck.

**Not yet done (the work in this roadmap)**
- Database is not yet hosted; backend hasn't run against a live DB.
- The app still reads/writes mock data — it isn't talking to the backend.
- A few paper-specified features are still UI-only (reminders, camera scan,
  structured nutrition, head circumference, memory upload).
- No deployment; no collected evaluation data; paper not yet reconciled.

---

## Phase 0 — Tools & accounts (½ day)

- [ ] Install **Node.js 18+**, **Git**, and **VS Code**.
- [ ] Install **Expo** tooling: `npm install -g expo` (and the **Expo Go** app on a real phone).
- [ ] Create a **Supabase** account (free tier).
- [ ] Create a free account on a backend host (**Render** or **Railway**) for later.
- [ ] Confirm the repo is in Git and pushed somewhere (GitHub) for backup + version history.

**Checkpoint:** `node -v`, `git --version`, and `expo --version` all work; Supabase project created.

---

## Phase 1 — Stand up the database on Supabase (½ day)

1. [ ] In Supabase: create a project, set a strong DB password, pick the nearest region.
2. [ ] **Project → Connect → Connection string → URI**; copy the **Session pooler / Direct** string (port `5432`).
3. [ ] In `back-end/`, `cp .env.example .env` and fill in:
   - `DATABASE_URL=` the Supabase URI, `DB_SSL=true`
   - `JWT_SECRET=` a long random string
   - `PUBLIC_URL=http://localhost:4000` (for now)
4. [ ] Apply the schema: paste `back-end/src/db/schema.sql` into the Supabase **SQL Editor** and run it (or `npm run db:migrate`).
5. [ ] Confirm the 16 tables exist in the Supabase **Table Editor**.

**Checkpoint:** tables visible in Supabase.

---

## Phase 2 — Run & verify the backend (1 day)

1. [ ] `cd back-end && npm install`
2. [ ] `npm run db:seed` (creates demo parent `sarah@example.com` / `password123`).
3. [ ] `npm run dev` → open `http://localhost:4000/api/health` (should be `{ ok: true }`).
4. [ ] Smoke-test with curl/Postman:
   - `POST /api/auth/login` → get a token
   - `GET /api/children` with `Authorization: Bearer <token>`
   - create a share, then `POST /api/consult/resolve` with the code
5. [ ] Run the automated tests against a throwaway DB: `npm test` (point `DATABASE_URL` at a test schema/DB first).
6. [ ] Fix anything the live database surfaces (this is the first time the SQL runs for real — most likely a small column/type tweak).

**Checkpoint:** all endpoints respond; tests green.

---

## Phase 3 — Connect the app to the backend (3–5 days) ← biggest piece

Replace the mock data + local storage with real API calls. Suggested order:

1. [ ] **API client** (`front-end/utils/api.js`): a thin `fetch` wrapper that adds
       the base URL and the JWT `Authorization` header, and parses errors.
2. [ ] **Auth wiring**: on login/register, call `/api/auth/*`, store the returned
       JWT (AsyncStorage), and load the user. Replace the simulated login.
3. [ ] **Children + records**: fetch `children`, then per-screen fetch/create/update
       against `/api/children/:id/...`. Swap each mock list for live data
       (vaccinations, growth, milestones, checkups, medical history, nutrition,
       reminders, trackers).
4. [ ] **Memories**: upload photos via `multipart/form-data` to the memories route.
5. [ ] **QR feature**: point the existing screens at the server —
       `POST /api/children/:id/shares` for generation and
       `POST /api/consult/resolve` for the professional view. This makes QR
       **work across devices** (the whole point).
6. [ ] Add loading/error states and a friendly "offline" message.

> Tip: do this screen-by-screen and keep the app runnable after each one. Ask and
> I can generate the API client + the first wired screen as a template.

**Checkpoint:** create a record on one device → it persists in Supabase → appears on another device.

---

## Phase 4 — Close the paper-alignment gaps (3–4 days)

Prioritized so the highest-impact items come first.

**High (defense-critical)**
- [ ] **Functional reminders**: schedule local notifications for vaccines/checkups (`expo-notifications`).
- [ ] **Camera QR scanning** on the professional screen (`expo-camera`) — currently code-entry only.
- [ ] **Remove or justify** the Premium/subscription screen (it conflicts with the paper's scope).

**Medium**
- [ ] **Structured Nutrition** entry (feeding type, food introduced, reactions) wired to the nutrition table.
- [ ] **Head circumference** in growth entry; expand child-profile form (blood type, place/time of birth, hospital, OB-GYNE, pediatrician, emergency contact).
- [ ] **Memory upload UI** (image picker) + delete.

**Low (polish)**
- [ ] Document the genuine extras (multi-language, hotlines, sleep/temperature) in Ch.3 so they're "supported," not "unexplained."
- [ ] Child-profile delete with confirmation.

**Checkpoint:** every feature claimed in Chapters 1–3 is demonstrable in the running app.

---

## Phase 5 — Security, privacy & reliability (1–2 days)

- [ ] Serve everything over **HTTPS** (automatic on Render/Railway/Supabase).
- [ ] Keep secrets in environment variables only (never commit `.env`).
- [ ] Confirm **ownership checks** (a user can only see their own children) — already enforced server-side; test it.
- [ ] Add basic **rate limiting** on `/api/auth/*` and `/api/consult/resolve`.
- [ ] Verify QR shares are **selective, expiring, revocable, and logged** end-to-end.
- [ ] Take a **database backup** before defense (Supabase dashboard).

**Checkpoint:** a short written note on how each privacy/security objective from the paper is met (great for the panel).

---

## Phase 6 — Testing & user evaluation (2–3 days, overlaps the paper)

- [ ] Backend integration tests passing (`npm test`).
- [ ] Manual test pass of every screen on a real device.
- [ ] Run the paper's **evaluation instruments**: usability survey + 4-point Likert
      questionnaire with a handful of parents/health workers; compute the weighted
      means. This produces the results your Chapter 4/5 and the panel will expect.
- [ ] Log bugs found and fix the blockers.

**Checkpoint:** you have real evaluation data and a stable build.

---

## Phase 7 — Deployment (1 day)

- [ ] Deploy the **backend** to Render/Railway; set the same env vars; point `DATABASE_URL` at Supabase.
- [ ] Set `PUBLIC_URL` and `CORS_ORIGIN` to the deployed URLs.
- [ ] Point the **app**'s API base URL at the deployed backend.
- [ ] For the demo, run the app via **Expo Go** on your phone (no app-store submission needed), or build with **EAS** if you want an installable APK.
- [ ] Smoke-test the deployed stack from two phones (parent + professional).

**Checkpoint:** the full system works over the internet, not just localhost.

---

## Phase 8 — Reconcile the research paper (1 day)

- [ ] Note in **Table 3.1** that PostgreSQL is hosted on Supabase (stack unchanged).
- [ ] Add one paragraph to the ERD section listing the refinements (structured Child
      fields, vaccination status, the feed/sleep/temperature tracker tables).
- [ ] Update screenshots/diagrams to match the real app.
- [ ] Make sure Problem → Objectives → Scope → Features all still line up (use the
      earlier alignment report as your checklist).

**Checkpoint:** the document and the app describe the same system.

---

## Phase 9 — Defense preparation (2–3 days)

- [ ] Finalize the slide deck (you have a 15-min version).
- [ ] Write a **demo script** (below) and rehearse it 3+ times, timing it.
- [ ] Prepare a **backup plan**: a screen recording of the full flow + screenshots,
      in case live wifi/devices fail on the day.
- [ ] Seed clean, realistic demo data the night before.
- [ ] Prepare answers to likely questions (scope, privacy, why QR, why these tables,
      what's out of scope, future work).

### Suggested live demo script (~4 min)
1. Log in as a parent (real account, real data from Supabase).
2. Add or edit a record (show it persists — refresh).
3. Open **Share for Consultation** → pick records → set expiry → generate QR.
4. On a second device, open **Healthcare Professional Access** → scan/enter the code → show the **view-only** records.
5. Back on the parent device, open the **access log** — show the view was recorded.
6. Revoke the share → try the code again → show it's now blocked.

---

## Realistic schedule

Roughly **3–4 focused weeks** end-to-end (less if you already know the stack). Mapped
to your project timeline:

| Term | Window | Roadmap phases |
|------|--------|----------------|
| Term 1 wrap-up | through Jul 2026 | Phases 0–2 (DB + backend running) and start Phase 3 |
| Term 2 | Aug–Nov 2026 | Phases 3–6 (wiring, features, security, evaluation) |
| Pre-defense | ~2 weeks before | Phases 7–9 (deploy, paper, rehearse) |

---

## The single most important next step

**Phase 1 → 2: get the backend running against Supabase and confirm the endpoints
respond.** Everything else depends on a live database. Once that's green, the
app-wiring in Phase 3 is the longest stretch — start it early.

*Want me to kick off Phase 3 now by generating the front-end API client and wiring
the login + one data screen as a working template? That's the fastest way to
de-risk the biggest phase.*
