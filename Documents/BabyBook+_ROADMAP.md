# BabyBook+ — Roadmap to a Live SaaS Product

**Last updated:** 14 August 2026
**Purpose:** One place that answers "where are we, and what is left?" Every other document in this repo is either history or a deep dive on one topic. This one is the map.

---

## 1. Where you are right now, in one paragraph

The capstone is finished and defended. The app works end to end: parents record a child's health data, a QR code gives a doctor temporary read-only access, and everything is deployed and running (web demo on EAS Hosting, API on Render, database on Supabase). The three most dangerous technical problems found in the August evaluation are fixed and verified against the live deployment. What separates you from a sellable product is not features — it is the boring layer underneath: security hardening, paid hosting, backups, billing, and legal documents. None of that exists yet.

**Plain version:** the product is real, the business around it is not.

---

## 2. Which document is which

You have generated a lot of files. Here is what each one is for, so you never have to open the wrong one again.

| Document | What it is | Still live? |
|---|---|---|
| **This file** | The roadmap. Start here. | ✅ Live |
| `CLAUDE.md` (repo root) | Technical guide to the codebase — architecture, conventions, gotchas. Read before writing code. | ✅ Live |
| `README.md` | Public front page of the repo. | ✅ Live |
| `Documents/BabyBook+_Critical_Evaluation_2026-08.docx` | The honest audit of the app. Sections 1–8 are the original defense-era review; Section 9 is the launch-readiness view added after the defense. Findings and reasoning live here. | ✅ Live (reference) |
| `Documents/BabyBook+_DPA_RA10173_Compliance.md` | How the app satisfies the Philippine Data Privacy Act. Becomes the raw material for your Privacy Policy. | ✅ Live (reference) |
| `Documents/archive/BabyBook+_Tier1_Remediation_Plan.md` | Plan for the six worst findings. **Fully executed.** | ⚪ Historical |
| `Documents/archive/Tier2_Implementation_Plan_2026-08.md` | Plan for the credibility findings. **Mostly executed** — see the ledger below. | ⚪ Historical |
| `Documents/BabyBook+_Visual_Design_Direction.md` | The design system the app now uses. | ✅ Live (reference) |
| `Documents/archive/BabyBook+_Dashboard_Redesign_Evaluation.md` | Why the home screen looks the way it does. | ⚪ Historical |
| `Documents/archive/BabyBook+_Frontend_Layout_Evaluation.md` | Older layout critique, superseded by the design direction. | ⚪ Historical |
| `Documents/archive/BabyBook+_Codebase_Cleanup_Audit.md` | One-off cleanup pass. | ⚪ Historical |
| `Documents/archive/BabyBook+_Web_Demo_Hosting_Migration_Plan.md` | The Railway → Render move. Useful if hosting changes again. | ⚪ Historical |
| `PROJECT_HISTORY_SUMMARY.md` | Chronological build history. | ⚪ Historical |
| `BabyBook+_App_Overview.md` | Plain-language explanation of the app, for non-developers. | ✅ Live (reference) |

"Historical" does not mean wrong — it means the work described in it is already done, so you do not need to act on it.

---

## 3. Progress ledger — what is actually finished

Grouped by what it means for the product, not by when it was built.

### The product itself — done

- Full parent app: profile, vaccinations, medical history (illness, medication, hospitalization), checkups, growth, nutrition, milestones, photo memories, calendar with month/week/day views, custom events, local reminders.
- QR consultation flow: parent generates a code, doctor opens a view-only frozen snapshot with no account needed, code expires, parent sees the access log.
- Dynamic girl/boy/neutral theming across every screen, plus a manual override.
- Side-menu navigation with nine settings destinations, back-button behavior, and a floating quick-add button.
- English/Filipino language support.
- Deployed and running: EAS-hosted web build, Render-hosted API, Supabase database, all in sync.

### Data protection and privacy — done

- Field-level encryption at rest (AES-256-GCM) on sensitive columns.
- Real consent architecture: consent required at registration, annual re-consent notice, six-year retention window, self-service account deletion.
- Ownership enforcement centralized — no parent can reach another parent's child.
- DPA compliance write-up completed.

### The August evaluation findings — mostly closed

| Finding | What it was | Status |
|---|---|---|
| 3.1 No offline mode | App useless without signal, exactly where it is needed | ◑ **Shortcut shipped.** An offline summary screen caches key records on the device. The full offline rebuild is still open. |
| 3.2 Medical history missing from QR share | Doctor could not see medications or illnesses | ✅ **Fixed.** |
| 3.3 Verification photos never reach the doctor | Attachments exist but are not in the snapshot | ❌ **Still open.** |
| 3.4 Photos publicly accessible | Anyone with a URL could view a child's medical photos | ✅ **Fixed** — private Supabase Storage bucket, short-lived signed URLs. Verified live. |
| 3.5 Files stored on disposable disk | Uploads would vanish on every redeploy | ✅ **Fixed** — same change. Verified live. |
| 3.6 No growth reference curves | Numbers with no meaning to a parent | ✅ **Fixed** — WHO percentile curves. |
| 4.2 No immunization schedule preloaded | Parents had to type in every vaccine | ✅ **Fixed** — full DOH EPI schedule auto-generated from date of birth. |
| 4.3 Access log unverifiable | Log recorded only a name the visitor typed | ◑ **Partial.** IP address and device now captured; professional identity is still self-declared. |
| 4.4 Stale snapshots | Doctor could read old data as current | ✅ **Fixed** — capture time shown prominently. |
| 4.6 No data export | DPA portability claim unbacked | ✅ **Fixed** — PDF export. |
| 4.1 Fake clinic data | Services module shows invented health centers | ❌ **Still open.** |
| 4.5 Reminders local-only | Break on reinstall or device change | ❌ **Still open.** |

**Score: 8 of 12 fully closed, 2 partially, 2 untouched.**

---

## 4. What is left — the actual roadmap

Four stages. They are in this order because each one is a prerequisite for the next being worth doing. There is no point marketing a product that has no billing, and no point adding billing to a product that leaks data.

---

### Stage 1 — Make it safe to put in front of strangers
**Why first:** right now the app is safe enough for a demo with a friendly audience. It is not safe for the open internet with real children's medical records in it. Everything here is small, well understood, and mostly measured in hours.

| # | Task | Why it matters | Effort |
|---|---|---|---|
| 1.1 | Replace `Math.random()` with `crypto.randomInt()` in share-code generation (`back-end/src/utils/shareCode.js`) | Share codes are currently guessable. This guards the flagship feature. | 15 min |
| 1.2 | Add `helmet` for security headers | One line, closes a whole category of browser-level attacks. | 15 min |
| 1.3 | Add `express-rate-limit`, tightest on the public consult endpoint, then on login and registration | Without it, someone can machine-gun guesses at consultation codes and passwords. | 1–2 hrs |
| 1.4 | Login attempt lockout | Unlimited password guessing against parent accounts today. | 1–2 hrs |
| 1.5 | Make `decrypt()` fail closed instead of returning raw ciphertext | Prevents silent, permanent data corruption if a key ever mismatches. | 30 min |
| 1.6 | Refuse to start in production if `CORS_ORIGIN` is unset | Stops one missing environment variable from opening the API to the whole web. | 30 min |
| 1.7 | Strip EXIF data from uploaded photos | Uploaded photos currently carry the GPS coordinates of the child's home. | 2 hrs |
| 1.8 | Raise password minimum to 10–12 characters with a strength check | Eight characters with no rules is below current standard. | 1 hr |

**Stage 1 total: roughly one focused working day.** This is the single highest-value day of work left in the entire project.

---

### Stage 2 — Make it good enough that people keep paying
**Why second:** a subscriber who hits these problems cancels. A defense panel would forgive them; a paying parent will not.

| # | Task | Why it matters | Effort |
|---|---|---|---|
| 2.1 | Full offline mode — cache records locally, show a sync banner, queue writes made while offline | The app's whole promise is being useful at the health center. Rural health centers have poor signal. The current shortcut is read-only and only covers a summary. | 2–3 days |
| 2.2 | Include attachment photos in the QR snapshot (finding 3.3) | You already force parents to attach proof photos. The doctor never sees them, which wastes the entire feature. | 3 hrs |
| 2.3 | Server-side push reminders using Expo push tokens | Local-only reminders silently die on reinstall or a new phone. A missed vaccine reminder is a real-world harm, not a bug. | 1–2 days |
| 2.4 | Fix or remove the Services module (finding 4.1) | It currently shows invented clinics with invented ratings. Shipping that to paying users is not a credibility risk anymore — it is a consumer-protection problem. Either integrate real DOH/LGU health-center data, or cut the module. | 1 day (real data) or 1 hr (remove) |
| 2.5 | "Share what a doctor usually needs" one-tap preset | Most parents will not know which record types to tick, and a bad default produces a bad consultation. | 2 hrs |
| 2.6 | Short-lived access token plus refresh token | Reduces the damage of a stolen token from seven days to minutes. | 1 day |
| 2.7 | Front-end tests on the share and consult flows | There are currently none. These two flows are the ones you cannot afford to break silently. | 1–2 days |

---

### Stage 3 — Turn it into a business
**Why third:** this is the stage that does not exist at all in the codebase today. There is no concept of a plan, a subscription, a payment, or a customer as distinct from a user.

| # | Task | What it involves | Effort |
|---|---|---|---|
| 3.1 | Decide the business model | Free vs paid tiers, what is gated (extra children? PDF export? unlimited photos? professional features?), monthly price point for the Philippine market. **This is a decision, not code — and everything else in Stage 3 depends on it.** | Thinking time |
| 3.2 | Payment provider integration | For the Philippines, PayMongo or Xendit handle GCash, Maya, and cards. Stripe if you target overseas Filipino parents. | 3–5 days |
| 3.3 | Subscription data model | Plans, subscription state, billing history, trial period, grace period on failed payment. New tables plus additive migrations. | 2–3 days |
| 3.4 | Feature gating in the app | Enforce limits server-side, never only in the UI. Upgrade prompts where a limit is hit. | 2 days |
| 3.5 | Terms of Service and a real Privacy Policy | Your DPA document proves you understand the law; it is not a customer-facing legal document. **Needs a lawyer, not an engineer.** | External |
| 3.6 | Register as a Personal Information Controller with the NPC | Handling children's health data commercially in the Philippines makes this a legal obligation, not an optional badge. | External / admin |
| 3.7 | Account management screens | Current plan, change plan, cancel, receipts, payment method. | 2 days |

---

### Stage 4 — Be able to run it as a service
**Why last:** none of this is needed until real customers exist, but all of it is needed the day the first one does.

| # | Task | Why | Effort |
|---|---|---|---|
| 4.1 | Move off Render's free tier | It sleeps after 15 minutes idle and has no uptime guarantee. A parent opening the app in a clinic waiting room will hit a one-minute cold start. | 1 hr + monthly cost |
| 4.2 | Supabase paid tier plus a written, *tested* restore procedure | Backups you have never restored from are not backups. Write the procedure down and run it once. | 1 day |
| 4.3 | Error tracking (Sentry or equivalent) | Today the only way you learn the app is broken is a customer telling you. | 3 hrs |
| 4.4 | Uptime monitoring and alerting | You should know before your users do. | 2 hrs |
| 4.5 | Support channel | An email address that is monitored, and an in-app way to reach it. The Help & Support screen already exists — wire it to something real. | 2 hrs |
| 4.6 | Google Play / App Store release | The web build is fine for a demo. A consumer product needs to be in a store. Requires developer accounts, store listings, privacy declarations, and a data-safety form. | 1–2 weeks including review |
| 4.7 | Key rotation procedure, written down | `enc:v1:` implies versioning but nothing implements a v2 migration. Write the procedure even before you need it. | 4 hrs |

---

## 5. What to do next

**Do Stage 1 in one sitting.** Eight small tasks, roughly a day, and it closes every high-severity security defect in the evaluation. It is the only stage where a single day of work changes the risk profile of the whole product.

**Then make one decision before writing any more code: Stage 3.1, the business model.** What is free, what is paid, and how much. That single decision determines what Stage 2 work is even worth doing — for example, if PDF export becomes a paid feature, it needs gating built before launch; if it stays free, it does not.

**A realistic sequence from here to a first paying customer:**

1. Stage 1 — 1 day
2. Business model decision — 1 evening
3. Stage 2 items 2.1 and 2.2, offline plus attachments — about 1 week
4. Stage 3 billing — about 2 weeks
5. Stage 4 hosting, backups, monitoring — about 3 days
6. Legal documents and NPC registration — runs in parallel, gated by external parties
7. App store submission and review — 1–2 weeks

**That is roughly six to eight weeks of part-time work to a soft launch**, assuming the legal step does not stall.

---

## 6. Honest risks

- **Legal is the long pole, not code.** Handling children's health data commercially in the Philippines is regulated. Start the ToS, Privacy Policy, and NPC registration early, because they depend on other people's calendars, not yours.
- **The Services module is a liability, not a feature.** Fabricated clinic listings shown to real users is the one thing on this list that could cause active harm rather than just disappointment. If real data is hard to get, delete the module.
- **Offline is the make-or-break feature for your actual market.** If BabyBook+ works in a rural health center with no signal and the competition does not, that is the reason to pay for it. If it does not work there, the app is a nicer-looking version of a paper vaccination card.
- **No revenue validation yet.** Nothing in this repo tells you a Filipino parent will pay for this. Before Stage 3's two weeks of billing work, consider talking to twenty parents and one barangay health worker.
