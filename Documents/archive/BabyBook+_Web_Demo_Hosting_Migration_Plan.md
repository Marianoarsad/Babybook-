# BabyBook+ — Web Demo Hosting Migration Plan

**Problem:** The Railway trial hosting the BabyBook+ Express API has expired; the service is paused and the web demo's backend is offline.
**Goal:** Restore a working web demo at **$0 recurring cost** in time for capstone defense.
**Date prepared:** 2026-08-06
**Scope:** Web demo only. The production MVP ships to Android/iOS and is out of scope. Supabase Postgres stays where it is.

---

## 1. Current architecture (what has to move)

| Layer | Stack | Current host | Status |
|---|---|---|---|
| Frontend | Expo / React Native → `expo export -p web` (static) | EAS Hosting | ✅ Working — no migration required |
| Backend | Node 18+ / Express 4, raw SQL via `pg`, JWT, bcryptjs, multer (disk), nodemailer | Railway | ❌ **Paused — trial expired** |
| Database | PostgreSQL (Supabase free tier, Session pooler, SSL) | Supabase | ✅ Working — stays |

**Backend facts confirmed from the codebase** (these drive the platform choice):

- `src/server.js` binds `process.env.PORT || 4000` → any platform that injects `PORT` works unmodified.
- `src/app.js` exposes `GET /api/health` → usable as the platform health check.
- `src/app.js` reads `CORS_ORIGIN` (comma-separated allowlist) → **must be updated** to the EAS web domain.
- `src/middleware/upload.js` uses `multer.diskStorage` writing to `process.cwd()/uploads`, served statically at `/uploads`, with public URLs built from `PUBLIC_URL`. → **This is the one part that breaks on an ephemeral filesystem.**
- `src/utils/mailer.js` uses nodemailer over SMTP port 587/465, and **already degrades gracefully** when SMTP is unset (logs the reset link, returns `{sent:false, link}`).
- `src/db/pool.js` forces SSL when `DB_SSL=true` → Supabase over the public internet is fine.

---

## 2. Backend hosting comparison

All figures verified against current sources (August 2026). Anything I could not confirm from a first-party source is marked `[unverified]`.

| Platform | Free tier limits | Sleeps on idle? | Card required? | Express support | Setup effort | Source |
|---|---|---|---|---|---|---|
| **Render (Free instance)** | 512 MB RAM, 0.1 CPU, **750 instance-hours/mo** per workspace, ephemeral disk, 1 free web service practical | **Yes — 15 min idle**, ~1 min spin-up | **No** — card only needed if you exceed included bandwidth/build minutes | ✅ Native Node runtime, Git-push deploy | **Low** | [render.com/docs/free](https://render.com/docs/free) |
| **Northflank (Free)** | 2 services, limited resources; **no forced sleep** | No `[unverified]` | No card to start `[unverified]` | ✅ Docker/Node | Medium | [northflank.com/blog/render-alternatives](https://northflank.com/blog/render-alternatives) |
| **Koyeb (Free instance)** | 1 free web service, 512 MB RAM, 0.1 vCPU, 2 GB SSD (Frankfurt or Washington DC only) | No (free instance runs continuously) | **Yes** — card required for anti-fraud, with a **$29 pre-auth hold**, and signup **charges a pro-rated Pro plan** unless you immediately downgrade to Starter | ✅ First-class Express guide | Low–Medium | [koyeb.com/docs/faqs/pricing](https://www.koyeb.com/docs/faqs/pricing) |
| **Google Cloud Run** | 2M requests/mo always-free | Yes (scale-to-zero, fast cold start) | **Yes** — billing account with card now required (change effective 3 Feb 2026) | ✅ via container | Medium–High | [cloud.google.com/run/pricing](https://cloud.google.com/run/pricing) · [docs.cloud.google.com/free](https://docs.cloud.google.com/free/docs/free-cloud-features) |
| **Oracle Cloud (Always Free)** | ARM Ampere A1 VM — **2 OCPU / 12 GB RAM** (halved from 4/24 on 15 Jun 2026) | No, but **idle instances can be reclaimed** (<20% CPU at p95 over 7 days); accounts idle 30+ days may be suspended | **Yes** — card required for identity verification (no charge on Always Free) | ✅ Full VM — you manage Node, nginx, TLS, systemd yourself | **High** | [oracle.com/cloud/free/faq](https://www.oracle.com/cloud/free/faq/) · [OCI Always Free docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) |
| **Cloudflare Workers (Free)** | 100,000 requests/day, **10 ms CPU per request**, 128 MB memory, 3 MB bundle, no filesystem | No (edge, near-zero cold start) | No | ⚠️ Not native — needs rewrite/adapter; `pg` + multer disk uploads do not port cleanly | High | [developers.cloudflare.com/workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **Vercel (Hobby)** | 1M function invocations, 4 CPU-hours, 100 GB transfer, **60 s function timeout**, ephemeral FS | Yes (serverless) | No | ⚠️ Express only as a serverless function | Medium | [vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations) |
| ~~Fly.io~~ | **No free tier as of 2026** — trial only, then card required (~$2–5/mo minimum) | — | Yes | ✅ | — | [saaspricepulse.com/blog/flyio-free-tier-2026](https://www.saaspricepulse.com/blog/flyio-free-tier-2026) — **excluded, violates the $0 constraint** |

### Why the card-required options are disqualified

The $0 constraint is hard. Koyeb, Google Cloud Run, and Oracle all require a card on file. Koyeb is the worst fit of the three: its own pricing FAQ states signup **charges a pro-rated Pro-plan amount immediately** and places a $29 pre-authorization hold. Oracle and Cloud Run won't charge you inside free limits, but they put a live card behind a service that can silently exceed a quota. For a student with no funding buffer, that is an unacceptable tail risk.

---

## 3. Frontend hosting comparison (static Expo web export)

The frontend is **not broken** — EAS Hosting is still serving it. This table exists only as a contingency.

| Platform | Free tier limits | Card required? | Notes | Source |
|---|---|---|---|---|
| **EAS Hosting (current)** | 100,000 requests, 1M CPU-ms, 1 GB storage `[unverified — third-party summary]` | No | Already deployed and working. Native `expo export -p web` → `eas deploy` flow. | [expo.dev/pricing](https://expo.dev/pricing) |
| **Cloudflare Pages** | **Unlimited bandwidth**, 20,000 files per site, 25 MiB per file | No | Strongest free static tier. Needs an SPA fallback rule so deep links resolve to `index.html`. | [cloudflare.com/plans/developer-platform](https://www.cloudflare.com/plans/developer-platform/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **Netlify (Free)** | Accounts created after Sep 2025 use **credits**: 300 credits/mo hard cap; ~20 credits/GB bandwidth, ~15 credits per deploy. Legacy accounts keep 100 GB + 300 build min. `[unverified — third-party summary of the credits change]` | No | The credit cap means roughly **20 deploys per month**. Fine for a frozen demo, painful while iterating. | [netlify.com/pricing](https://www.netlify.com/pricing/) |
| **GitHub Pages** | 1 GB site size, 100 GB/mo soft bandwidth, 10 builds/hr `[unverified]` | No | Free only on public repos for free accounts — **the BabyBook+ repo would have to be public**. Needs a 404.html SPA shim. | [docs.github.com — GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages) |

---

## 4. Recommendation

### Primary: **Render Free** (backend) + **EAS Hosting** (frontend, unchanged)

Render is the right call for a one-time defense demo for four reasons. **No credit card** is required to run a Free web service, which is the only constraint that is genuinely non-negotiable here. Your Express app runs **completely unmodified** — Render injects `PORT`, which `server.js` already reads, and connects over the public internet to Supabase with SSL, which `pool.js` already handles. Render publishes an explicit [Railway migration guide](https://render.com/docs/migrate-from-railway), so the mental model transfers directly. And 750 instance-hours per month is far more than a demo consumes, especially since spun-down time doesn't burn hours at all.

Keep the frontend on EAS Hosting. It isn't broken, it's already integrated with your Expo build pipeline, and changing two things at once before a defense is how demos die.

### Backup: **Northflank Free**

If Render's 15-minute spin-down proves unworkable during rehearsal, Northflank's free tier reportedly has **no forced sleep** and allows 2 services without a card. Treat this as the fallback, not the default — its terms are less well-documented than Render's, so verify them yourself before committing. **Set this up as a second deployment in the week before defense, not on the day.**

---

## 5. Migration steps (Railway → Render)

> ⚠️ Do not put any secret values in this file, in git, or in any screenshot. Set every one of them in the Render dashboard's Environment tab.

### Phase 0 — Prerequisites (do first)

1. **Run the pending `calendar_events` migration.** Per `CLAUDE.md` §8 this table exists only in `schema.sql` and has never been applied to Supabase. Do this *before* pointing anything new at the DB, so you migrate once, not twice.
   ```bash
   cd back-end
   # DATABASE_URL must point at Supabase Session pooler
   npm run db:migrate      # WARNING: drops and recreates every table
   npm run db:seed
   npm run db:seed:demo
   ```
2. **Confirm Supabase is not paused.** Free projects pause after ~7 days of low activity ([Supabase docs](https://supabase.com/docs/guides/platform/free-project-pausing)). Open the dashboard and click **Resume project** if needed.
3. **Verify the demo account still works**: `demo.parent@babybookplus.app` / `Demo1234!`.

### Phase 1 — Deploy the API on Render

4. Sign up at [dashboard.render.com](https://dashboard.render.com/register) with GitHub. **Do not add a payment method.**
5. **New → Web Service** → connect the BabyBook+ repository.
6. Configure:
   - **Root Directory:** `back-end`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
   - **Health Check Path:** `/api/health`
7. Add environment variables (Environment tab):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Supabase **Session pooler** connection string (IPv4) |
   | `DB_SSL` | `true` |
   | `JWT_SECRET` | **Exact same value as Railway** |
   | `DATA_ENCRYPTION_KEY` | **Exact same value as Railway — if this changes, every `enc:v1:` field becomes unreadable** |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | Your EAS web demo URL (e.g. `https://<project>.expo.app`) — comma-separated if more than one |
   | `PUBLIC_URL` | Your new Render URL (e.g. `https://babybook-api.onrender.com`) — set this *after* step 8 |
   | `APP_RESET_URL` | EAS web demo URL + `/reset` |
   | `UPLOAD_DIR` | `uploads` (default; leave unset if you prefer) |
   | SMTP vars | **Omit for now** — see §6, Render Free blocks SMTP ports |

8. Deploy. Note the assigned URL, then go back and set `PUBLIC_URL` to it and redeploy.
9. Verify: `curl https://<your-service>.onrender.com/api/health` → `{"ok":true,"service":"babybook-api"}`
   (The first request after idle takes ~60 s — that is expected, not a failure.)

### Phase 2 — Point the frontend at the new API

10. Update `front-end/.env` for local runs:
    ```
    EXPO_PUBLIC_API_BASE_URL=https://<your-service>.onrender.com
    ```
11. Update the production profile's `env` block in `front-end/eas.json` to the same value. `EXPO_PUBLIC_*` variables are **inlined at build time**, so the web bundle must be rebuilt — editing `.env` alone will not change the deployed demo.
12. Rebuild and redeploy the web demo:
    ```bash
    cd front-end
    npx expo export -p web
    eas deploy --prod
    ```
13. Open the demo, log in as the demo parent, and confirm: child list loads, a vaccination record saves, the QR share code generates, and the professional portal opens the shared snapshot.

### Phase 3 — Decommission and document

14. Leave the Railway service paused (do **not** upgrade). Remove the Railway URL from any docs or the defense deck.
15. Update `CLAUDE.md` §6 and `DEPLOYMENT.md` to name Render instead of Railway.
16. Commit everything except `.env`.

---

## 6. Demo-day risk notes

### 🔴 Risk 1 — Photo uploads vanish (highest impact)

Render Free web services have an **ephemeral filesystem with no persistent-disk option**; local files are lost on every redeploy, restart, **and spin-down** ([Render docs](https://render.com/docs/free)). Because `upload.js` writes to local disk, every photo attached during the demo disappears after 15 idle minutes — and attachments are *mandatory* for 5 record types in BabyBook+.

**Mitigations, cheapest first:**
- **(a) Demo within one warm session.** Upload and display a photo in the same continuous run. Adequate for a live demo, fragile if the panel takes a break.
- **(b) Commit seed images.** Add demo photos to `back-end/uploads/` in git and reference them from `db:seed:demo`. They are restored on every deploy because they're part of the build artifact. **Recommended — lowest effort, highest reliability.**
- **(c) Move uploads to Supabase Storage** (1 GB free). Correct long-term fix and the right answer for the Android/iOS MVP anyway, but it's a real code change to `upload.js` and `attachments.routes.js`. Do not attempt this in defense week.

### 🟠 Risk 2 — 60-second cold start mid-presentation

Free services spin down after **15 minutes** of no inbound traffic and take **about a minute** to wake. If you present slides for 20 minutes and then open the app, the panel watches a loading screen.

**Mitigation:** Hit `https://<service>.onrender.com/api/health` from your phone **2–3 minutes before** you open the demo. Also load the demo once during setup. Avoid external cron-ping services — Render's docs note that free services generating unusually high self-initiated traffic can be suspended.

### 🟠 Risk 3 — Supabase pauses the database

Free Supabase projects pause after ~7 days of insufficient activity, and restoring takes minutes you won't have ([Supabase docs](https://supabase.com/docs/guides/platform/free-project-pausing)). Supabase emails a warning roughly a week ahead.

**Mitigation:** Open the app or the Supabase dashboard every few days in the run-up to defense. Check that the project is **Active** the morning of.

### 🟡 Risk 4 — Password-reset email silently fails

Render Free web services **cannot send outbound traffic on ports 25, 465, or 587** ([Render docs](https://render.com/docs/free)) — exactly the ports nodemailer uses. Your SMTP-based password reset will not work.

**Mitigation:** `mailer.js` already degrades gracefully, logging the reset link and returning `{sent:false, link}` instead of throwing — so nothing crashes. Simply **don't demo email password reset**, or swap to an HTTP-API email provider (Resend, Brevo — both have free tiers and use HTTPS, not SMTP) if the flow is required by your rubric.

### 🟡 Risk 5 — CORS blocks every request from the web demo

If `CORS_ORIGIN` doesn't exactly match the EAS domain (scheme included, no trailing slash), every API call fails in the browser while working fine in `curl` — a confusing failure mode under pressure.

**Mitigation:** Test from the deployed web URL, not localhost, at least a day before. If you see CORS errors, confirm the exact origin string in DevTools' network tab and fix the env var.

### 🟡 Risk 6 — Encryption key mismatch

If `DATA_ENCRYPTION_KEY` on Render differs by even one character from the Railway value, every `enc:v1:`-prefixed field decrypts to garbage. Records will appear corrupted rather than erroring loudly.

**Mitigation:** Copy the value from Railway's variables before the project is fully deprovisioned. Verify by loading a seeded child's medical history right after the first deploy.

---

## 7. Pre-defense checklist

- [ ] `calendar_events` migration applied to Supabase; reseeded
- [ ] Supabase project shows **Active**
- [ ] Render service deployed on the **Free** instance; no payment method on the account
- [ ] `/api/health` returns `{"ok":true}`
- [ ] `DATA_ENCRYPTION_KEY` and `JWT_SECRET` match the old Railway values
- [ ] `CORS_ORIGIN` matches the EAS web domain exactly
- [ ] `PUBLIC_URL` set to the Render URL; a seeded photo renders in the app
- [ ] `eas.json` production env updated **and** the web bundle rebuilt and redeployed
- [ ] Demo login works end-to-end from the deployed web URL
- [ ] QR share → professional portal verified on the deployed URL
- [ ] Warm-up ping rehearsed; backup device/hotspot ready
- [ ] `CLAUDE.md` §6 and `DEPLOYMENT.md` updated to say Render, not Railway

---

## Sources

- [Render — Deploy for Free (official docs)](https://render.com/docs/free)
- [Render — Migrate from Railway](https://render.com/docs/migrate-from-railway)
- [Koyeb — Pricing FAQ (official docs)](https://www.koyeb.com/docs/faqs/pricing)
- [Supabase — Project Pausing (official docs)](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Cloudflare Workers — Limits (official docs)](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare — Workers & Pages Pricing](https://www.cloudflare.com/plans/developer-platform/)
- [Vercel — Functions Limits (official docs)](https://vercel.com/docs/functions/limitations)
- [Oracle — Cloud Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)
- [Oracle — Always Free Resources (OCI docs)](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Google Cloud — Free features and trial offer](https://docs.cloud.google.com/free/docs/free-cloud-features)
- [Google Cloud Run — Pricing](https://cloud.google.com/run/pricing)
- [Netlify — Pricing](https://www.netlify.com/pricing/)
- [Expo — EAS Pricing](https://expo.dev/pricing)
- [Northflank — Render alternatives (vendor blog)](https://northflank.com/blog/render-alternatives)
- [Fly.io free tier status, 2026 (third-party analysis)](https://www.saaspricepulse.com/blog/flyio-free-tier-2026)
