# BabyBook+ Deployment Guide

Covers: deploying the Express/Postgres backend to **Render** and **Railway** (pick one), then building the Expo app for **internal mobile testing** via EAS.

> **Status (August 2026): the live web demo backend runs on Render.** The original Railway free
> trial expired and its service was left paused (not deleted). Render is the current, active
> choice — see §1.2 below, and `Documents/archive/BabyBook+_Web_Demo_Hosting_Migration_Plan.md` for
> the exact free-tier settings, cost comparison, and demo-day risk notes (cold starts, ephemeral
> disk, SMTP port blocking) that guide that setup. §1.3 (Railway) is kept only as historical
> reference in case you set up a fresh Railway account later.

## 0. Prep already done to the repo

Before this could be deployed, three things needed fixing — done for you:

1. **`front-end/utils/api.js`** — `API_BASE_URL` was hardcoded to `http://localhost:4000`. It now reads `process.env.EXPO_PUBLIC_API_BASE_URL` (falls back to localhost for local dev). A production mobile build baked to `localhost` would never reach your server.
2. **`front-end/app.json`** — was missing `name`, `slug`, `ios.bundleIdentifier`, `android.package`, and permission strings for `expo-image-picker`/`expo-camera`. EAS Build requires these. Filled in with placeholder identifiers (`com.babybookplus.app`) — change them if you want something else.
3. **`front-end/eas.json`** — didn't exist. Added `development`/`preview`/`production` build profiles. **You must edit the `EXPO_PUBLIC_API_BASE_URL` placeholder in this file once you have a live backend URL (Part 3).**

One thing intentionally *not* changed, flagged for your decision: **`back-end/src/db/migrate.js` drops and recreates every table on each run.** Fine for first-time setup; never run it again once real data exists (see warning in Part 1).

---

## Part 1 — Backend

### 1.1 Generate secrets you'll need

Run locally and save the output:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
This is your `JWT_SECRET`. Generate a fresh one — don't reuse the dev placeholder in `.env.example`.

### 1.1b Choose your database (read before Render)

You have two options for `DATABASE_URL`. Pick one:

- **Supabase (recommended for a capstone) — persists.** You already have this. It stays alive
  as long as the project exists (free tier only *pauses* after ~1 week idle; you click Restore).
  You **must** use the **Session pooler** connection string (IPv4), not the direct
  `db.<ref>.supabase.co` host — the direct host is IPv6-only and fails from most networks/hosts.
  Get it from Supabase → **Connect → Session pooler**:
  `postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres`
- **Render's own Postgres — simplest, but temporary.** One-click, same-region internal URL, no
  IPv6 issue. **⚠️ Free Render Postgres is deleted 30 days after creation** (14-day grace to
  upgrade). Fine for a short-lived demo; risky if your defense is more than a month out.

Everything below works with either — just use the matching `DATABASE_URL`.

### 1.2 Option A — Render

> **This is the option currently in use for the live web demo.** The steps below are the general
> case (including a paid persistent disk for uploads, useful for the eventual Android/iOS MVP). If
> you're re-doing the **free-tier web-demo setup specifically**, use
> `Documents/archive/BabyBook+_Web_Demo_Hosting_Migration_Plan.md` §5 instead — it has the exact
> env-var list for the free instance and the accepted risk list (ephemeral disk mitigated via
> committed seed photos, cold starts, SMTP blocked) rather than the paid-disk path below.

1. Push this repo to GitHub if it isn't already.
2. **Database:** either paste your **Supabase Session pooler** URL (recommended, see 1.1b) into
   `DATABASE_URL` in step 4 and skip creating a Render DB — **or** Render Dashboard →
   **New → PostgreSQL** and note its **Internal Database URL** (remember the 30-day expiry).
3. **Web service:** **New → Web Service** → connect the repo.
   - **Root Directory:** `back-end` (this is a monorepo — Render needs to know where the Node app lives)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free is fine to start. Note: **free web services spin down after 15 min of
     inactivity** and take ~1 minute to wake on the next request, so the first app action after idle
     will feel slow (750 free instance-hours/month). Upgrade to a paid instance for your defense day
     if you want it always-warm.
4. **Environment variables** (Render dashboard → Environment):
   ```
   NODE_ENV=production
   DATABASE_URL=<the Internal Database URL from step 2>
   JWT_SECRET=<from 1.1>
   JWT_EXPIRES_IN=7d
   CORS_ORIGIN=<your Expo web URL if any, comma-separated — can leave blank for now>
   PUBLIC_URL=https://<your-service-name>.onrender.com
   UPLOAD_DIR=/var/data/uploads
   ```
   `DB_SSL` can stay unset — `pool.js` auto-enables SSL for any non-localhost host.
5. **Persistent disk for uploaded photos (recommended):** Render's filesystem is wiped on every redeploy/restart. Avatar and memory photos saved to local disk will vanish unless you attach a disk.
   - Service → **Disks** → **Add Disk** → Mount Path `/var/data`, size 1 GB is plenty to start.
   - This matches the `UPLOAD_DIR=/var/data/uploads` set above. (Disks require a paid instance type, not the free tier — if you're fine losing uploaded photos on redeploy for now, skip this and leave `UPLOAD_DIR=uploads`.)
6. Deploy. Once live, confirm with `https://<your-service>.onrender.com/api/health` → `{"ok":true,...}`.
7. **Run the migration once** (see 1.4 below) against this database, then move to Part 2.

### 1.3 Option B — Railway ⚠️ Inactive

> The Railway free trial used for this project expired in August 2026 and its service was left
> paused, not deleted — Render (§1.2) is the current live backend host. This section is kept as
> reference only, in case a fresh Railway account/trial is set up later.

1. Push this repo to GitHub if it isn't already.
2. Railway Dashboard → **New Project** → **Deploy from GitHub repo** → select this repo.
3. On the new service: **Settings → Root Directory** → set to `back-end`.
4. Add the database: on the project canvas, **Create → Database → Add PostgreSQL**.
5. **Variables** tab on your app service:
   ```
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=<from 1.1>
   JWT_EXPIRES_IN=7d
   CORS_ORIGIN=
   PUBLIC_URL=https://<will fill in after step 7>
   UPLOAD_DIR=/data/uploads
   ```
   `${{Postgres.DATABASE_URL}}` references the Postgres service Railway just created for you.
6. **Volume for uploaded photos (recommended):** same reasoning as Render — Railway's filesystem is ephemeral without one.
   - Service → **Settings → Volumes** → **New Volume** → Mount path `/data`.
7. Service → **Settings → Networking** → **Generate Domain** to get a public URL. Copy it into `PUBLIC_URL` above and redeploy.
8. Confirm `https://<your-domain>.up.railway.app/api/health` → `{"ok":true,...}`.
9. **Run the migration once** (below), then move to Part 2.

### 1.4 Run the migration (once, either platform)

Do this from your own machine — simplest and works the same for both hosts. Use the **external/public** connection string from Render (Database page → "External Database URL") or Railway (Postgres service → Connect tab → public URL, or run via `railway run`).

```bash
cd back-end
DATABASE_URL="<external connection string>" DB_SSL=true npm run db:migrate
```

⚠️ **Do not run `db:migrate` again after this** once the app has real data — `schema.sql` starts with `DROP TABLE ... CASCADE` on every table and will wipe everything. It's meant for first-time setup only. (If you ever need a real migration workflow, that's a follow-up project, not part of this guide.)

Optional: `npm run db:seed` if you want Render/Railway's DB pre-populated with the same seed data you use locally.

---

## Part 2 — Point the mobile app at your deployed backend

Open `front-end/eas.json` and replace the placeholder in **both** the `preview` and `production` profiles:

```json
"env": {
  "EXPO_PUBLIC_API_BASE_URL": "https://<your-render-or-railway-url>"
}
```

If you deployed to both and want to compare, just swap this value and rebuild — no other code changes needed.

Also revisit `CORS_ORIGIN` on the backend once you know your app's origins (for the EAS internal-distribution build this mostly doesn't matter since it isn't a browser context, but do add it if you also serve the Expo web build somewhere).

---

## Part 3 — Build the mobile app (EAS internal distribution)

This produces an installable Android `.apk` (and an iOS build you can install via ad-hoc provisioning) that you and testers can install directly — no app store account needed.

1. **Install EAS CLI** (if not already):
   ```bash
   npm install -g eas-cli
   ```
2. **Log in** (create a free account at expo.dev if you don't have one):
   ```bash
   eas login
   ```
3. From **`front-end/`**, link the project to your Expo account:
   ```bash
   cd front-end
   eas build:configure
   ```
   This writes an `extra.eas.projectId` into `app.json` — accept the defaults.
4. **Build for Android** (fastest path, no developer account required):
   ```bash
   eas build --platform android --profile preview
   ```
   This uses the `preview` profile from `eas.json`, which is set to `distribution: internal` and `buildType: apk`, and bakes in the `EXPO_PUBLIC_API_BASE_URL` you set in Part 2.
5. **Build for iOS — pick the path that matches your budget.** Apple gates iOS distribution, so a
   real-device iOS prototype needs an **Apple Developer account ($99/yr)**. Three options:

   - **a) No cost — iOS Simulator build (Mac only).** Runs in Xcode's Simulator, not on a real phone,
     no Apple account:
     ```bash
     eas build --platform ios --profile preview --local   # or a simulator profile
     ```
     (Add `"ios": { "simulator": true }` to the `preview` profile in `eas.json` for this.)
   - **b) Ad-hoc — real devices, Apple account required.** Register each tester's device once, then build:
     ```bash
     eas device:create
     eas build --platform ios --profile preview
     ```
   - **c) TestFlight — best "live prototype for iOS users", Apple account required.** Up to 100
     internal / 10,000 external testers install from the TestFlight app via a link:
     ```bash
     eas build --platform ios --profile production
     eas submit --platform ios --latest
     ```
6. When a build finishes, EAS prints a link to the build page (also at `expo.dev/builds`). For
   Android, open the link on the phone (or scan the QR) and tap **Install**. For iOS TestFlight,
   testers accept the invite in the TestFlight app.

### 3.1 Fastest cross-platform prototype (no build, no Apple account)

If you just want a shareable link that works on **any** Android or iOS phone today, publish the
**Expo web** build (this app already runs on web) via **EAS Hosting** — the same workflow already
in use for the live web demo (`expo export -p web` then `eas deploy --prod`). Testers open the URL
in their phone browser. Caveat: web can't use native camera/notification features the same way a
real build can — use this for UI/flow demos, and the EAS builds above for the true native
prototype.

---

## Part 4 — Verify end to end

- [ ] `GET /api/health` on the deployed backend returns `{"ok": true}`
- [ ] Register a new account and log in from the installed mobile build
- [ ] Create a child profile and upload an avatar photo — confirm it still shows after force-closing and reopening the app (tests that uploads persist / `PUBLIC_URL` is correct)
- [ ] If you attached a disk/volume: redeploy the backend once and confirm the avatar photo is still there (tests the disk actually mounted where `UPLOAD_DIR` points)

If the avatar upload fails, check the backend logs first — CORS, `PUBLIC_URL`, or `UPLOAD_DIR` misconfiguration are the most likely causes at this stage, not the app code (that bug was already fixed).
