# BabyBook+ Backend API

Express + PostgreSQL backend for BabyBook+ — a parent-controlled child health and
development recordkeeping system with QR-based consultation access. Built with raw
SQL via `node-postgres` (`pg`), JWT auth, and local-disk photo storage.

The database is a refined implementation of the Chapter 3 ERD: the paper's 12 tables
built with structured columns, constraints, cascades and indexes, plus three daily-
tracker tables (`feed_logs`, `sleep_logs`, `temperature_logs`) and a `password_resets`
table. See `src/db/schema.sql`.

## Prerequisites

- Node.js 18+
- PostgreSQL 13+ running locally (or a connection string to a hosted instance)

## Setup

```bash
cd back-end
npm install                      # install dependencies
cp .env.example .env             # then edit .env (DB url + JWT secret)

# create the database (once)
createdb babybook                # or: psql -c "CREATE DATABASE babybook;"

npm run db:migrate               # apply schema.sql
npm run db:seed                  # optional demo data
npm run dev                      # start with auto-reload (or: npm start)
```

The API serves on `http://localhost:4000` by default. Health check: `GET /api/health`.

Demo login after seeding: **sarah@example.com** / **password123**.

## Running on Supabase (hosted PostgreSQL — recommended)

Supabase *is* PostgreSQL, so the backend runs against it unchanged — this just
moves the database to the cloud so real phones can reach it during your defense
(which makes the cross-device QR consultation flow work).

1. Create a project at supabase.com and set a database password.
2. **Project → Connect → Connection string → URI.** Copy the **Session pooler**
   or **Direct connection** string (port `5432`), not the transaction pooler.
3. In `.env` set:
   ```
   DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   DB_SSL=true
   ```
4. Apply the schema — either run `npm run db:migrate`, **or** paste the contents of
   `src/db/schema.sql` into the Supabase **SQL Editor** and run it.
5. `npm run db:seed` (optional) then `npm start`.

Nothing else changes; your stack stays "Express JS + PostgreSQL" exactly as the
paper specifies.

## Environment (`.env`)

| Var | Purpose |
|-----|---------|
| `PORT` | API port (default 4000) |
| `DATABASE_URL` | Postgres connection string (or use discrete `PG*` vars) |
| `JWT_SECRET` | **Required** — long random string for signing tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CORS_ORIGIN` | Comma-separated allowed origins (your Expo URLs) |
| `UPLOAD_DIR` | Where memory photos are stored (default `uploads`) |
| `PUBLIC_URL` | Base URL used to build photo URLs (e.g. `http://localhost:4000`) |

## API overview

All `/api/children/**` routes require `Authorization: Bearer <token>`.

**Auth**
- `POST /api/auth/register` `{ fullName, email, password, phoneNumber?, gender? }`
- `POST /api/auth/login` `{ email, password }` → `{ token, user }`
- `GET  /api/auth/me` · `PUT /api/auth/me`
- `POST /api/auth/forgot-password` `{ email }` → reset token (returned in dev)
- `POST /api/auth/reset-password` `{ token, password }`

**Children**
- `GET/POST /api/children`
- `GET/PUT/DELETE /api/children/:childId` (delete cascades to all records)

**Child records** (each supports `GET` list, `POST`, `GET/:id`, `PUT/:id`, `DELETE/:id`)
- `/api/children/:childId/vaccinations`
- `/api/children/:childId/checkups`
- `/api/children/:childId/medical-history`
- `/api/children/:childId/growth`
- `/api/children/:childId/milestones`
- `/api/children/:childId/nutrition`
- `/api/children/:childId/reminders`
- `/api/children/:childId/feeds` · `/sleeps` · `/temperatures` (daily trackers)

**Memories** (photo upload)
- `GET  /api/children/:childId/memories`
- `POST /api/children/:childId/memories` — `multipart/form-data` with `photo` file + `caption`, `notes`, `date_recorded`
- `DELETE /api/children/:childId/memories/:id`

**QR consultation (parent side)**
- `POST /api/children/:childId/shares` `{ recordKeys: [...], ttlMinutes }` → creates an expiring, view-only snapshot + code
- `GET  /api/children/:childId/shares` · `POST /api/children/:childId/shares/:id/revoke`
- `GET  /api/children/:childId/access-log`

**QR consultation (healthcare professional — public, no auth)**
- `POST /api/consult/resolve` `{ code, professionalName }` → returns the view-only snapshot and writes an access-log entry

## Connecting the React Native app

The app currently uses mock data + local `AsyncStorage`. To switch it to this API:
point a small API client at `PUBLIC_URL`, store the JWT from login, and replace the
mock reads/writes with `fetch` calls to the routes above. The QR feature already
matches this backend's code format (`utils/shareCode.js` mirrors the app's
`shareStore.js`), so `POST /api/consult/resolve` is a drop-in for the professional view.
(Ask and this wiring can be generated next.)

## Tests

```bash
# requires a test database; set DATABASE_URL to a throwaway DB first
npm test
```

`tests/api.test.js` covers health, register/login, child CRUD, a record round-trip,
and the full QR share → resolve → access-log flow.

## Notes / not included by design

- **Camera QR scanning & push reminders** live in the app and need `expo-camera` /
  `expo-notifications` — the backend is ready for both.
- Photos are stored on local disk (per project decision). Swapping to S3/Cloudinary
  is isolated to `src/middleware/upload.js`.
