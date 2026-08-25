<div align="center">

# BabyBook+

**A digital child health & development recordkeeping system with parent-controlled, QR-based consultation access.**

Built for Filipino families to track a child's health from **birth to age 6** — and to share exactly the right records with a doctor, for exactly as long as needed.

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-blue)
![Frontend](https://img.shields.io/badge/frontend-Expo%20%2F%20React%20Native-61DAFB)
![Backend](https://img.shields.io/badge/backend-Express%20%2B%20PostgreSQL-336791)
![License](https://img.shields.io/badge/license-Academic%20Use-lightgrey)

</div>

---

## Table of Contents

- [What is BabyBook+?](#what-is-babybook)
- [The Problem It Solves](#the-problem-it-solves)
- [Features](#features)
- [Screens & Modules](#screens--modules)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone](#1-clone-the-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
  - [4. Verify](#4-verify-it-works)
- [Environment Variables](#environment-variables)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Architecture & Conventions](#architecture--conventions)
- [Security & Privacy](#security--privacy)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [Roadmap & Known Limitations](#roadmap--known-limitations)
- [Documentation Index](#documentation-index)
- [License & Credits](#license--credits)

---

## What is BabyBook+?

BabyBook+ is a **capstone project**: a mobile application that acts as a digital baby book. It does not try to replace the physical baby book that Filipino families keep as a keepsake — it works *alongside* it, providing an organized, searchable, and shareable backup.

There are **two kinds of users**:

| User | Role | Access |
|---|---|---|
| **Parent / Guardian** | Primary user | Full account. Creates child profiles, logs all records, controls sharing. |
| **Healthcare Professional** | Secondary user | **No account required.** Scans a parent-generated QR code for temporary, view-only access to selected records. |

---

## The Problem It Solves

When a child is born, parents become record keepers. Vaccination dates, doctor visits, illnesses, allergies, growth measurements, milestones — all for a child who cannot speak for themselves. In the Philippines this information usually lives on paper: baby books, vaccination cards, prescription slips, lab results.

Paper is fragile and scattered. A vaccination card gets lost between a barangay health center and a clinic. Records from different providers never talk to each other. And when a parent finally reaches a doctor, the right papers often aren't in the bag — so the doctor decides with incomplete information.

There's a second, quieter problem: **privacy**. Sharing a child's health history usually means handing over *everything*, with no way to share just the relevant parts.

| The Problem | How BabyBook+ Addresses It |
|---|---|
| Records scattered across paper documents | One app, organized by category, always in the parent's pocket |
| Paper gets lost, damaged, or left at home | Digital records can't be physically misplaced |
| Doctors get an incomplete picture | A complete, organized history available at the visit |
| Parents forget vaccination/checkup dates | Automatic reminders tied to each record |
| Sharing means handing over everything | QR code shares **only** approved records, **only** for a set time |
| Sensitive child data needs protection | Field-level encryption, explicit consent, and an access log |

This work aligns with **UN Sustainable Development Goal 3: Good Health and Well-Being**.

---

## Features

### For Parents

- 👶 **Child Profiles** — multiple children, each with birth details, hospital, pediatrician, OB-GYNE, blood type, allergies, and hereditary conditions
- 💉 **Health Records** — vaccinations, illnesses, medications, hospitalizations, allergies, checkups
- 📈 **Growth Tracking** — height, weight, and head circumference over time
- 🍼 **Nutrition Tracking** — unified milk and solid-food log with dependency-free charts
- 🏆 **Milestones** — developmental milestone documentation
- 📅 **Calendar** — month / week / day views aggregating vaccinations, checkups, and medical history, plus custom events
- 🔔 **Reminders** — local notifications for upcoming vaccinations and checkups
- 📸 **Memories** — photo documentation of the child growing up
- 📎 **Verification Photos** — mandatory supporting photo on 5 clinical record types
- 🎨 **Dynamic Theming** — the palette follows the selected child (girl / boy / neutral), with a manual override
- 🌏 **Bilingual** — English and Filipino

### For Healthcare Professionals

- 📷 **QR / code-based access** — scan or type a consultation code, no signup
- 👁️ **Strictly view-only** — cannot create, edit, or delete anything
- ⏱️ **Time-limited** — every share expires (default 1 hour, hard cap 24 hours)
- 🚫 **Revocable** — the parent can kill access at any moment

---

## Screens & Modules

Bottom navigation has five tabs; everything account-related lives in a slide-in side menu opened from the header avatar.

| Tab | File | Purpose |
|---|---|---|
| Dashboard | `components/Dashboard.js` | At-a-glance summary + upcoming appointments widget |
| Health | `components/Health.js` | Vaccinations, medical history, checkups |
| Growth | `components/Growth.js` | Measurements, milestones, nutrition |
| Services | `components/Services.js` | Health centers, hotlines, advisories *(currently mock data)* |
| Calendar | `components/CalendarView.js` | Month / week / day agenda |

**Side menu destinations** (`components/settings/`): View Profile · Edit Profile · General Settings · Theme Preferences · Language Preferences · Help & Support · About · Change Password · Privacy Settings

**Sharing flow**: `ShareRecords.js` → `QrCodeView.js` → *(professional)* → `QrScanner.js` → `ProfessionalView.js`

---

## Tech Stack

### Frontend

| Technology | Version | Why |
|---|---|---|
| **Expo** | ~56.0 | Cross-platform build + deploy toolchain |
| **React Native** | 0.85.3 | iOS, Android, and web from one codebase |
| **React** | 19.2.3 | UI library |
| `react-native-calendars` | ^1.1314 | Month/week/day calendar (pure JS, web-safe) |
| `expo-camera` | ~56.0 | QR scanning |
| `expo-notifications` | ~56.0 | Local reminders |
| `expo-image-picker` | ~56.0 | Photo capture and selection |
| `expo-linear-gradient` | ~56.0 | Gradients (guarded, with solid fallback) |
| `@react-native-async-storage/async-storage` | 2.2.0 | Native key-value storage |
| `@expo/vector-icons` | ^15.1 | Ionicons + MaterialCommunityIcons |

> **No React Navigation and no expo-router.** Navigation is a custom `currentView` state switch in `App.js`. See [Architecture & Conventions](#architecture--conventions).

### Backend

| Technology | Version | Why |
|---|---|---|
| **Node.js** | ≥18 | Runtime |
| **Express** | ^4.19 | HTTP framework |
| **PostgreSQL** | ≥13 | Relational database (hosted on Supabase) |
| `pg` | ^8.12 | Raw SQL driver — **no ORM by design** |
| `jsonwebtoken` | ^9.0 | JWT authentication |
| `bcryptjs` | ^2.4 | Password hashing |
| `multer` | ^1.4 | Multipart photo uploads |
| `express-validator` | ^7.1 | Request validation |
| `nodemailer` | ^9.0 | Password-reset email |
| `jest` + `supertest` | ^29 / ^7 | Integration tests |

### Infrastructure

| Service | Role |
|---|---|
| **Railway** | Hosts the Express API (root directory `back-end`) |
| **Supabase** | Managed PostgreSQL |
| **EAS Hosting** | Web build for the demo |
| **EAS Build** | Android APK / production builds |

---

## Repository Structure

```
BabyBook+/
├── front-end/                    # Expo / React Native app
│   ├── App.js                    # Root: auth gate, navigation switch, modals
│   ├── theme.js                  # Design tokens + girl/boy/neutral palettes
│   ├── translations.js           # i18n strings
│   ├── mockData.js               # Placeholder data (Services module)
│   ├── context/
│   │   ├── ThemeContext.js       # useTheme() — dynamic gender palette
│   │   └── LanguageContext.js    # useLanguage() / t()
│   ├── components/
│   │   ├── Dashboard.js Health.js Growth.js Services.js CalendarView.js
│   │   ├── ShareRecords.js QrCodeView.js QrScanner.js ProfessionalView.js
│   │   ├── SideMenu.js NutritionTracker.js MemoryDetail.js
│   │   ├── settings/             # 9 side-menu destination screens
│   │   ├── common/Cards.js       # Shared card components
│   │   └── ui/                   # Button, Field, Toast, Screen, Grid, …
│   └── utils/
│       ├── api.js                # fetch client — every endpoint
│       ├── adapters.js           # DB row ⇄ app shape mappers
│       ├── notifications.js      # scheduleReminder(), morningOf()
│       └── qrcode.js shareStore.js responsive.js storageAdapter.js
│
├── back-end/                     # Express API
│   ├── src/
│   │   ├── app.js server.js
│   │   ├── db/                   # pool.js schema.sql migrate.js seed.js
│   │   ├── middleware/           # auth.js validate.js upload.js error.js
│   │   ├── routes/               # auth children records memories
│   │   │                         # attachments share consult
│   │   └── utils/                # jwt crypto resource snapshot shareCode mailer
│   └── tests/api.test.js
│
├── Documents/                    # Research, evaluations, compliance, plans
├── graphify-out/                 # Code knowledge graph
├── DEPLOYMENT.md                 # Full deployment guide
├── PROJECT_HISTORY_SUMMARY.md    # Chronological build history
└── CLAUDE.md                     # AI-assistant project guide
```

---

## Getting Started

### Prerequisites

| Requirement | Version | Check with |
|---|---|---|
| Node.js | ≥ 20.19.4 | `node --version` |
| npm | ≥ 9 | `npm --version` |
| PostgreSQL | ≥ 13 | `psql --version` |
| Git | any | `git --version` |

> PostgreSQL is optional if you point `DATABASE_URL` at a hosted Supabase instance instead.

For device testing, install **Expo Go** on your phone.

---

### 1. Clone the repository

```bash
git clone https://github.com/Marianoarsad/Babybook-.git
cd Babybook-
```

> The active development branch is `development`.

---

### 2. Backend Setup

```bash
cd back-end
npm install

cp .env.example .env        # then edit .env — see Environment Variables below
```

**Generate your two secrets** and paste them into `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # DATA_ENCRYPTION_KEY
```

**Create and populate the database:**

```bash
createdb babybook           # or: psql -c "CREATE DATABASE babybook;"

npm run db:migrate          # apply schema.sql
npm run db:seed             # optional demo data
npm run db:seed:demo        # optional — a full year of realistic demo records

npm run dev                 # start with auto-reload (or: npm start)
```

The API serves on `http://localhost:4000`.

> ### 🔴 `db:migrate` is destructive
>
> `schema.sql` begins with `DROP TABLE ... CASCADE` for **every** table. `npm run db:migrate` wipes the target database. It's fine for first-time setup and local development — **never run it against a database holding real data.** For schema changes on a live database, write an additive `ALTER TABLE` migration instead.

#### Using Supabase instead of local PostgreSQL

Supabase *is* PostgreSQL, so the backend runs against it unchanged.

1. Create a project at [supabase.com](https://supabase.com) and set a database password.
2. Go to **Project → Connect → Connection string → URI**. Copy the **Session pooler** or **Direct connection** string (port `5432`) — **not** the transaction pooler.
3. In `.env`:
   ```env
   DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   DB_SSL=true
   ```
4. Apply the schema with `npm run db:migrate`, **or** paste `src/db/schema.sql` into the Supabase **SQL Editor**.

---

### 3. Frontend Setup

```bash
cd front-end
npm install
```

Create `front-end/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

> **Testing on a real phone?** `localhost` means *the phone itself*, not your computer. Use your machine's LAN IP — e.g. `http://192.168.1.20:4000`. Find it with `ipconfig` (Windows) or `ifconfig` (macOS/Linux).

Start the app:

```bash
npm run web        # browser
npm start          # Expo dev server — scan the QR with Expo Go
npm run android    # Android emulator
npm run ios        # iOS simulator (macOS only)
```

---

### 4. Verify it works

```bash
curl http://localhost:4000/api/health
# → {"ok":true,"service":"babybook-api"}
```

Then open the app and sign in with the demo account:

| Field | Value |
|---|---|
| Email | `demo.parent@babybookplus.app` |
| Password | `Demo1234!` |

> Available after running `npm run db:seed:demo`. These credentials are for the **development and demo environment only** — never reuse them for anything real.

---

## Environment Variables

### Backend (`back-end/.env`)

| Variable | Required | Default | Purpose |
|---|:---:|---|---|
| `PORT` | – | `4000` | API port |
| `NODE_ENV` | – | `development` | Environment mode |
| `DATABASE_URL` | ✅ | – | Postgres connection string |
| `DB_SSL` | – | auto | `true` for hosted DBs. Auto-detects if unset. |
| `JWT_SECRET` | ✅ | – | Long random string for signing tokens |
| `JWT_EXPIRES_IN` | – | `7d` | Token lifetime |
| `DATA_ENCRYPTION_KEY` | ✅ | – | AES-256-GCM key for field encryption |
| `RESET_TOKEN_TTL_HOURS` | – | `2` | Password-reset token validity |
| `CORS_ORIGIN` | – | *(all)* | Comma-separated allowed origins |
| `UPLOAD_DIR` | – | `uploads` | Where photos are written |
| `PUBLIC_URL` | – | – | Base URL used to build photo URLs |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | – | – | Password-reset email. Blank ⇒ dev token in response. |
| `MAIL_FROM` | – | – | Sender address |
| `APP_RESET_URL` | – | – | Where reset links point |

> ### 🔑 `DATA_ENCRYPTION_KEY` must never change
>
> It is used to encrypt sensitive fields at rest. Every backend sharing a database **must** use the identical key, and it must stay stable forever — **changing it makes all existing encrypted data permanently unreadable.** If it is unset, the app falls back to `JWT_SECRET` and logs a warning; always set a dedicated key in production.

### Frontend (`front-end/.env`)

| Variable | Required | Purpose |
|---|:---:|---|
| `EXPO_PUBLIC_API_BASE_URL` | ✅ | Backend base URL |

> Any `EXPO_PUBLIC_`-prefixed variable is **inlined into the JS bundle at build time**. Never put a secret in one. For EAS builds the value comes from the per-profile `env` block in `eas.json`, not from `.env`.

**Both `.env` files are git-ignored. Never commit real secrets.**

---

## Usage Examples

### Register and log in

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Maria Santos",
    "email": "maria@example.com",
    "password": "SecurePass123!",
    "consentAccepted": true
  }'
```

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@example.com","password":"SecurePass123!"}'
# → { "token": "eyJhbGci...", "user": { ... } }
```

Every `/api/children/**` request needs that token:

```bash
export TOKEN="eyJhbGci..."
```

### Create a child profile

```bash
curl -X POST http://localhost:4000/api/children \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Ana",
    "last_name": "Santos",
    "date_of_birth": "2024-03-15",
    "sex": "Female",
    "blood_type": "O+",
    "birth_weight": 3.2,
    "allergies": ["Peanuts"]
  }'
```

### Add a vaccination record

```bash
curl -X POST http://localhost:4000/api/children/1/vaccinations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vaccine_name": "BCG",
    "visit_name": "At Birth",
    "date_given": "2024-03-15",
    "status": "completed"
  }'
```

### The QR consultation flow — end to end

**1. Parent generates a scoped, expiring share:**

```bash
curl -X POST http://localhost:4000/api/children/1/shares \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recordKeys": ["profile", "vaccinations", "allergies"],
    "ttlMinutes": 60
  }'
# → { "code": "AB7K-2P9Q", "qr_payload": "BABYBOOK+CONSULT:AB7K-2P9Q", ... }
```

**2. Professional resolves it — no authentication required:**

```bash
curl -X POST http://localhost:4000/api/consult/resolve \
  -H "Content-Type: application/json" \
  -d '{"code":"AB7K-2P9Q","professionalName":"Dr. Reyes"}'
# → { "status":"ok", "childName":"Ana Santos", "payload": { ... } }
```

**3. Parent reviews who accessed the records:**

```bash
curl http://localhost:4000/api/children/1/access-log \
  -H "Authorization: Bearer $TOKEN"
```

**4. Parent revokes early if needed:**

```bash
curl -X POST http://localhost:4000/api/children/1/shares/5/revoke \
  -H "Authorization: Bearer $TOKEN"
```

### Calling the API from the app

Never call `fetch` directly in a component — always go through the client in `utils/api.js`:

```javascript
import { api } from "../utils/api";
import { vaccinationToApp } from "../utils/adapters";

const rows = await api.listRecords(childId, "vaccinations");
const vaccines = rows.map(vaccinationToApp);

const saved = await api.createRecord(childId, "vaccinations", {
  vaccine_name: "Pentavalent",
  visit_name: "6 Weeks",
  due_date: "2024-04-26",
  status: "scheduled",
});
```

---

## API Reference

Base URL: `http://localhost:4000` · All `/api/children/**` routes require `Authorization: Bearer <token>`.

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |

### Auth — `/api/auth`

| Method | Endpoint | Body |
|---|---|---|
| `POST` | `/register` | `{ fullName, email, password, consentAccepted, phoneNumber?, gender? }` |
| `POST` | `/login` | `{ email, password }` → `{ token, user }` |
| `GET` | `/me` | – |
| `PUT` | `/me` | Profile fields |
| `POST` | `/change-password` | `{ currentPassword, newPassword }` |
| `POST` | `/forgot-password` | `{ email }` |
| `POST` | `/reset-password` | `{ token, password }` |
| `POST` | `/consent/renew` | – |
| `DELETE` | `/me` | Deletes the account and all data |

### Children — `/api/children`

| Method | Endpoint | Description |
|---|---|---|
| `GET` `POST` | `/` | List / create |
| `GET` `PUT` `DELETE` | `/:childId` | Read / update / delete *(cascades to all records)* |
| `POST` | `/:childId/avatar` | `multipart/form-data` with `photo`, or `{ avatar_url }` |

### Child Records

Each collection supports the full set: `GET /` · `POST /` · `GET /:id` · `PUT /:id` · `DELETE /:id`

| Path | Contents |
|---|---|
| `/api/children/:childId/vaccinations` | Vaccine name, visit, due date, date given, status |
| `/api/children/:childId/checkups` | Title, date, doctor, clinic, status |
| `/api/children/:childId/medical-history` | `category` ∈ `Illness` \| `Medication` \| `Hospitalization` |
| `/api/children/:childId/growth` | Height, weight, head circumference |
| `/api/children/:childId/milestones` | Title, age achieved, completion |
| `/api/children/:childId/nutrition` | Unified milk + solid food entries |
| `/api/children/:childId/reminders` | Vaccination / checkup reminders |
| `/api/children/:childId/calendar-events` | User-created custom events |

### Memories & Attachments

| Method | Endpoint | Description |
|---|---|---|
| `GET` `POST` `DELETE` | `/:childId/memories[/:id]` | Photo memories (`multipart/form-data`) |
| `GET` `POST` `DELETE` | `/:childId/attachments[/:id]` | Supporting photos for clinical records |

### QR Consultation — parent side

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/:childId/shares` | `{ recordKeys: [...], ttlMinutes }` → expiring snapshot + code |
| `GET` | `/:childId/shares` | List active and past shares |
| `POST` | `/:childId/shares/:id/revoke` | Revoke immediately |
| `GET` | `/:childId/access-log` | Who viewed this child's records |

**Shareable record keys:** `profile` · `vaccinations` · `allergies` · `growth` · `milestones` · `checkups` · `nutrition`

### QR Consultation — professional side (public, no auth)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/consult/resolve` | `{ code, professionalName }` → snapshot + writes an access-log entry |

Response `status` values: `ok` · `expired` · `revoked` · `notfound` · `invalid`

---

## Data Model

15 tables. Children belong to a `users` row; every record belongs to a child and cascades on delete.

```
users ──┬── children ──┬── vaccinations ──── reminders
        │              ├── checkups ──────────┘
        │              ├── medical_history
        │              ├── growth_records
        │              ├── milestones
        │              ├── nutrition_records
        │              ├── memories
        │              ├── calendar_events
        │              ├── record_attachments
        │              └── shared_records ──── access_logs
        └── password_resets
```

Notes on intentional design choices:

- **`nutrition_records` is unified.** It replaced the older `sleep_logs`, `temperature_logs`, and `feed_logs` tables, which were removed.
- **`shared_records.payload` is a frozen JSONB snapshot.** Built at generation time, so a past share can never retroactively expose newly added records.
- **`record_attachments` is polymorphic.** `record_id` + `record_type` point at vaccinations, checkups, or medical history.
- **`calendar_events` holds only user-created events.** Vaccinations, checkups, and medical history are aggregated for display, never duplicated.

Full definitions: [`back-end/src/db/schema.sql`](back-end/src/db/schema.sql)

---

## Architecture & Conventions

> **Please read this section before contributing.** These are deliberate decisions, not accidents.

### Navigation is custom — no router library

`App.js` holds a `currentView` state and swaps screens with conditional rendering. Bottom-nav values: `"dashboard" | "health" | "growth" | "services" | "calendar"`. Side-menu values: `"share" | "viewProfile" | "editProfile" | "generalSettings" | ...`

**There is no React Navigation and no expo-router. Do not introduce one without discussion.**

### Theming — never hard-code a brand color

Every screen follows this pattern:

```javascript
import { useTheme } from "../context/ThemeContext";

export default function MyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // ...
}

const makeStyles = (colors) => StyleSheet.create({
  container: { backgroundColor: colors.background },
  title: { color: colors.text },
});
```

Use tokens: `colors.primary`, `colors.accentStrong`, `colors.text`, `colors.textSecondary`, `colors.textMuted`, `colors.background`, `colors.surface`, `colors.surfaceAlt`, `colors.border`, plus semantic `colors.success` / `warning` / `danger` / `info` (each with a matching `*Bg`).

**`#FFFFFF` is allowed only for text and icons sitting on colored buttons.** Static tokens (`space`, `radius`, `type`, `shadow`, `MIN_TOUCH`) live in `theme.js`.

### Backend — raw SQL, no ORM

Generic CRUD is factored through `utils/resource.js`. Registering a new record type is usually a single entry in the `RESOURCES` array in `records.routes.js`:

```javascript
{
  path: "vaccinations",
  table: "vaccinations",
  columns: ["vaccine_name", "visit_name", "due_date", "date_given", "status", "notes"],
  orderBy: "COALESCE(date_given, due_date) DESC NULLS LAST, id DESC",
  encrypted: ["vaccine_name", "visit_name", "notes"],
}
```

The `encrypted` array is what wires field encryption in — **listing a sensitive column there is how you avoid forgetting encryption.**

### Other conventions

- **Icons:** `@expo/vector-icons` only. Verify names exist — invalid Ionicons names have caused real bugs.
- **Ownership:** never query by `child_id` alone in a route. Use the `requireChildOwnership` middleware, which resolves `:childId` against the authenticated user and attaches `req.child`.
- **Transactions:** `db/pool.js` exports a `withTransaction` helper. Use it for multi-statement writes.
- **Adapters:** DB rows are snake_case; app objects are camelCase. Convert in `utils/adapters.js`, not inline in components.

---

## Security & Privacy

Implemented today:

| Feature | Implementation |
|---|---|
| **Password hashing** | `bcryptjs` |
| **Authentication** | JWT bearer tokens, 7-day expiry |
| **Field encryption at rest** | AES-256-GCM, values prefixed `enc:v1:`, per-value random IV |
| **Ownership enforcement** | `requireChildOwnership` middleware on every child-scoped route |
| **Scoped sharing** | Parent selects record types; server validates against a whitelist |
| **Time-limited sharing** | `ttlMinutes` capped at 1440 server-side |
| **Revocable sharing** | Dedicated revoke endpoint; overdue shares swept to `expired` |
| **Frozen snapshots** | A past share can't expose later-added records |
| **Consent lifecycle** | Required at registration, annual re-consent, 6-year retention |
| **User-initiated deletion** | `DELETE /api/auth/me`. **Accounts are never auto-deleted.** |

Compliance write-up: [`Documents/BabyBook+_DPA_RA10173_Compliance.md`](Documents/BabyBook+_DPA_RA10173_Compliance.md)

> ### ⚠️ Known security gaps — do not deploy publicly yet
>
> This is a project in active development. A security review identified issues that are **not yet fixed**, including: no rate limiting, no `helmet` security headers, share codes generated with `Math.random()` instead of a CSPRNG, and publicly-served upload URLs.
>
> See [`Documents/BabyBook+_Critical_Evaluation_2026-08.docx`](Documents/) for the full list and remediation plan. **Treat this repository as a development artifact, not a production-ready health system.**

---

## Testing

```bash
cd back-end
npm test                          # full suite
npx jest -t "test name"           # a single test
```

`tests/api.test.js` covers health, register/login, child CRUD, a record round-trip, and the complete QR share → resolve → access-log flow.

> ### 🔴 The test suite destroys its database
>
> `npm test` runs `schema.sql`, which drops **every** table in whatever `DATABASE_URL` points at. Always aim it at a throwaway database:
>
> ```bash
> DATABASE_URL=postgres://localhost:5432/babybook_test npm test
> ```
>
> **Never run it against your Supabase URL or any database with real data.**

There is currently no frontend test suite. Contributions welcome — see [Roadmap](#roadmap--known-limitations).

---

## Deployment

Full walkthrough: **[`DEPLOYMENT.md`](DEPLOYMENT.md)**

### Backend → Railway

| Setting | Value |
|---|---|
| Root Directory | `back-end` |
| `PORT` | `8080` *(injected by Railway)* |
| `DATABASE_URL` | Supabase **Session pooler** URL (IPv4) |
| `DB_SSL` | `true` |
| Also set | `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, SMTP vars |
| Health check | `GET /api/health` |

### Frontend

```bash
cd front-end
npx expo export -p web      # build
eas deploy --prod           # deploy web demo
eas build -p android        # Android APK
```

`eas.json` holds `EXPO_PUBLIC_API_BASE_URL` per profile (`development` / `preview` / `production`). Update it when the backend URL changes.

### After any schema change

```
1. Apply the migration to Supabase
2. Reseed if necessary
3. git push          # Railway redeploys
```

**Order matters.** Deploying code that expects a new column before the column exists produces `column ... does not exist` errors.

---

## Contributing

### Workflow

1. **Branch from `development`** — `git checkout -b feature/your-feature-name`
2. **Make focused commits** — one logical change each
3. **Test before pushing** — `cd back-end && npm test` (throwaway DB!)
4. **Open a pull request into `development`** with a clear description

### Branch naming

| Prefix | Use |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Restructuring without behavior change |

### Commit messages

```
<type>: <short summary in the imperative>

feat: add WHO growth percentile curves to Growth screen
fix: correct vaccination due-date offset for 14-week visit
docs: expand QR consultation flow in README
```

Types: `feat` · `fix` · `docs` · `refactor` · `test` · `chore`

### Ground rules

**Please ask before you:**

- Add a new dependency
- Change the navigation paradigm
- Modify the database schema
- Touch the encryption, consent, or QR sharing logic

**Always:**

- Use theme tokens — never hard-code a brand hex value
- Add sensitive columns to the `encrypted` list when creating a record type
- Preserve existing functionality when refactoring, especially QR sharing, encryption, and consent
- Run `graphify update .` after code changes to keep the knowledge graph current

### Pull request checklist

- [ ] Branched from `development`
- [ ] Backend tests pass against a throwaway database
- [ ] No hard-coded colors — theme tokens only
- [ ] No secrets, tokens, or `.env` files committed
- [ ] New sensitive DB columns added to the `encrypted` list
- [ ] Verified on web **and** at least one mobile target
- [ ] Docs updated if behavior changed

### Good first issues

- Add frontend tests (none exist yet)
- Accessibility pass — contrast, 44px touch targets, ≥16px inputs
- Consistent empty / loading / error states across screens
- Replace the mock `Services` data with real health-center data

---

## Troubleshooting

<details>
<summary><b>"Network error — is the backend running and reachable?"</b></summary>

The app can't reach the API.

- Confirm the backend is running: `curl http://localhost:4000/api/health`
- **On a physical phone**, `localhost` refers to the phone. Set `EXPO_PUBLIC_API_BASE_URL` to your computer's LAN IP.
- Restart the Expo dev server after changing `.env` — `EXPO_PUBLIC_*` values are inlined at build time.
</details>

<details>
<summary><b><code>column ... does not exist</code></b></summary>

The database schema is behind the code. Apply the migration to your database, then redeploy the backend — in that order.
</details>

<details>
<summary><b>Encrypted values showing as <code>enc:v1:...</code> in the UI</b></summary>

`DATA_ENCRYPTION_KEY` doesn't match the key the data was written with. `decrypt()` currently fails open and returns the raw ciphertext.

Restore the original key. If it's lost, that data is unrecoverable — which is why the key must never change.
</details>

<details>
<summary><b>CORS errors in the browser</b></summary>

Add your Expo web origin to `CORS_ORIGIN` in `back-end/.env`, comma-separated:

```env
CORS_ORIGIN=http://localhost:8081,http://localhost:19006
```
</details>

<details>
<summary><b>Photos return 404 after a redeploy</b></summary>

Expected — and a known defect. Uploads are written to Railway's **ephemeral** filesystem and are wiped on every redeploy. Database rows survive; the files don't. Migrating to object storage is a P0 item on the roadmap.
</details>

<details>
<summary><b>QR scanning doesn't work</b></summary>

`expo-camera` requires a real device or a permission-granted browser context. On unsupported platforms the app falls back to manual code entry — that path always works.
</details>

<details>
<summary><b>Reminders never fire</b></summary>

Local notifications don't work on the web build at all, don't survive reinstall, and iOS caps pending local notifications at 64. Server-side push is on the roadmap.
</details>

---

## Roadmap & Known Limitations

### Current status

✅ Research-doc alignment · QR sharing + professional portal · field encryption · consent lifecycle · dynamic theming · calendar module · side-menu navigation · Railway + Supabase + EAS deployment

### Known limitations — stated plainly

| Limitation | Impact |
|---|---|
| **No offline mode** | Every screen is a live network request. The app is unusable without connectivity — including in clinics, where it's needed most. |
| **Medical history isn't shareable** | The QR snapshot omits illnesses, medications, and hospitalizations. |
| **Attachments aren't in the snapshot** | The professional sees records without their verification photos. |
| **Uploads are public and ephemeral** | Files are served without auth and are wiped on redeploy. |
| **No growth reference curves** | Measurements are recorded but not interpreted — no WHO percentiles or z-scores. |
| **Services module is mock data** | Clinics, ratings, and distances are placeholders. |
| **No DOH immunization schedule** | Parents type every vaccine manually. |
| **Reminders are local-only** | Unreliable across reinstalls and devices; capped at 64 on iOS. |
| **No data export** | No PDF export yet, despite RA 10173 portability requirements. |

### Planned

**Near term** — DOH EPI schedule auto-generation · access-log hardening (IP, user agent, timestamp) · snapshot capture-time display · PDF export
**Medium term** — offline caching · WHO growth percentiles · medical history in QR shares · attachment images in snapshots · object storage
**Longer term** — server-side push notifications · real health-center data · PRC licence verification

The current plan lives in [`Documents/BabyBook+_ROADMAP.md`](Documents/BabyBook+_ROADMAP.md); completed plans are kept in [`Documents/archive/`](Documents/archive/).

---

## Documentation Index

| Document | Contents |
|---|---|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Full Railway / Supabase / EAS deployment walkthrough |
| [`PROJECT_HISTORY_SUMMARY.md`](PROJECT_HISTORY_SUMMARY.md) | Chronological build history in plain language |
| [`CLAUDE.md`](CLAUDE.md) | Project guide for AI coding assistants |
| [`BabyBook+_App_Overview.md`](BabyBook+_App_Overview.md) | Plain-language explanation of the app |
| [`Documents/`](Documents/) | Research paper, evaluations, DPA compliance |
| [`Documents/BabyBook+_ROADMAP.md`](Documents/BabyBook+_ROADMAP.md) | Where the project stands and what is left before launch |
| [`Documents/BabyBook+_Feature_Gap_Analysis.md`](Documents/BabyBook+_Feature_Gap_Analysis.md) | Missing features measured against comparable 2026 apps |
| [`Documents/archive/`](Documents/archive/) | Completed plans, kept for the reasoning behind past decisions |
| [`graphify-out/`](graphify-out/) | Code knowledge graph |

---

## License & Credits

### License

**Academic Use — All Rights Reserved.**

BabyBook+ is an academic capstone project developed for educational purposes. The source code is published for academic review, evaluation, and learning. It is **not** licensed for commercial use, redistribution, or deployment as a production health system.

For permission to use this work beyond academic review, please contact the maintainer.

### Acknowledgments

This project draws on established parent-held child health record systems:

- **DOH Child Immunization Record** (Philippines) — the local baseline this app complements
- **Personal Child Health Record / "Red Book"** (United Kingdom)
- **Child Health Booklet** (Singapore)
- **Maternal and Child Health Handbook** (Japan)
- **Rourke Baby Record** (Canada)
- **CDC Milestone Tracker** (United States)

### Disclaimer

> BabyBook+ is a **recordkeeping tool**, not a medical device. It does not provide medical advice, diagnosis, or treatment. All records are parent-maintained and self-reported. Always consult a qualified healthcare professional for medical decisions.

---

<div align="center">

**BabyBook+** · A capstone project · Built for Filipino families

*Aligned with UN Sustainable Development Goal 3: Good Health and Well-Being*

</div>
