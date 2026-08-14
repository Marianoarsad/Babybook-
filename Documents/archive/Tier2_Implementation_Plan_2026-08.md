# BabyBook+ — Tier 2 Implementation Plan

**Scope:** Section 4 problems from `BabyBook+_Critical_Evaluation_2026-08.docx`
**Date:** 06 August 2026
**Status:** Plan only — no code has been changed.

---

## Scope Decisions (as directed)

| Problem | Decision | In this plan? |
|---|---|---|
| 4.1 Services module is fake data | Keep mock data for now; app still in development | ❌ Deferred |
| 4.2 No DOH EPI schedule preloaded | Auto-generate full 0–60 month schedule on child creation, pre-dated, each dose tied to a reminder | ✅ **Full build** |
| 4.3 Access log is unverifiable | Capture IP address, user agent, precise timestamp + in-app notification on code resolution | ✅ **Partial build** |
| 4.3 PRC licence field + PRC registry verification | Intentionally excluded — adds friction to the professional flow | ⏭️ **Logged for future** |
| 4.4 Snapshots go stale silently | Prominently display capture time to the professional | ✅ **Full build** |
| 4.5 Reminders local-only / unreliable | Deferred to future development | ❌ Deferred |
| 4.6 No data export | Add "Export as PDF" | ✅ **Full build** |

### Parked for future development (do not lose these)

These were deliberately declined for now and should be revisited post-capstone:

1. **PRC licence number capture** on the consultation screen — raises the cost of casual misuse and reads as materially more serious to an evaluation panel. Declined because it adds a field and a mental step to a flow whose main strength is having almost no friction.
2. **PRC registry verification** — the only thing that converts the access log from self-declared to genuinely attributable. Out of scope for a capstone, but naming it as a known limitation in the defence is stronger than staying silent on it.
3. **Server-side push reminders** (4.5) — required before the reminder system can be called reliable.
4. **Real health-centre data** (4.1) — needed before the Services module can be demoed as real.

---

## ⚠️ Read This First: The Migration Constraint

This is the single most important operational detail in this plan.

`back-end/src/db/schema.sql` begins with `DROP TABLE ... CASCADE` for **every** table. `npm run db:migrate` runs that file wholesale. **Running it against Supabase destroys all existing data.**

Two changes in this plan need new columns (4.3). Do **not** get them by re-running `db:migrate`.

**Required approach — additive migrations:**

Create a new folder `back-end/src/db/migrations/` and add numbered, additive SQL files that use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Add a runner script (`npm run db:migrate:up`) that executes any file not yet recorded in a `schema_migrations` bookkeeping table.

Keep `schema.sql` updated in parallel so that a fresh database still builds correctly — but from now on `schema.sql` is for **new** environments and the test suite, while `migrations/` is what touches **live** data.

> **Also outstanding:** per `CLAUDE.md` §8, the `calendar_events` table still exists only in `schema.sql` and has never been applied to live Supabase. Fold that into the first additive migration rather than leaving it pending.

---

# 4.2 — Auto-Generate the DOH EPI Immunization Schedule

**Goal:** The moment a parent creates a child profile, the complete 0–60 month vaccination schedule appears — pre-populated, correctly dated from the child's date of birth, with each dose already tied to a reminder.

## Step 1 — Create the schedule data file

**New file:** `back-end/src/data/epiSchedule.js`

A plain data module. No database table — the schedule is a constant, so keeping it in code makes it reviewable in version control and trivially updatable.

Each entry needs:

| Field | Purpose |
|---|---|
| `vaccineName` | e.g. `"BCG"`, `"Pentavalent (DTwP-HepB-Hib)"` |
| `visitName` | e.g. `"At Birth"`, `"6 Weeks"`, `"9 Months"` |
| `offsetDays` or `offsetWeeks` / `offsetMonths` | Interval from date of birth used to compute `due_date` |
| `doseNumber` | 1, 2, 3 — so "Pentavalent 2 of 3" can be displayed |
| `notes` | Optional free text (e.g. "Given at the same visit as OPV") |

### Working schedule table (0–60 months)

Based on the DOH Expanded Program on Immunization routine schedule:

| Age | Vaccines due |
|---|---|
| At birth | BCG; Hepatitis B (birth dose, within 24 hours) |
| 6 weeks | Pentavalent (DTwP-HepB-Hib) 1; OPV 1; PCV 1 |
| 10 weeks | Pentavalent 2; OPV 2; PCV 2 |
| 14 weeks | Pentavalent 3; OPV 3; PCV 3; IPV 1 |
| 9 months | MMR 1 (measles-containing vaccine, dose 1); Japanese Encephalitis |
| 12 months | MMR 2 |

> ### 🔴 Verify before shipping
>
> **Do not treat the table above as authoritative.** This is a health application, and an incorrect immunization date is a genuine safety issue, not a cosmetic bug.
>
> Before writing the data file, confirm every row against the **current** official source and cite it in a comment at the top of `epiSchedule.js`:
>
> - DOH Expanded Program on Immunization page (see Sources below)
> - The current-year PIDSP Childhood Immunization Calendar
>
> Specific points that have shifted between schedule revisions and must be re-checked: whether **IPV** is one dose or two (a second dose at 9 months appears in some revisions), the exact **MMR 2** window (12 months vs 12–15 months), and whether **Japanese Encephalitis** is 9 months or 9–12 months in the current revision.
>
> Deliberately excluded as out of scope for 0–60 months: **HPV** (Grade 4, school-based) and **Td** (Grades 1 and 7, school-based). Also excluded: the **Ligtas Tigdas MR** supplementary campaign, which is a periodic outbreak-response activity rather than part of the routine schedule, and private-sector vaccines from the PIDSP calendar (Rotavirus, Varicella, Hepatitis A, Influenza) which are not part of free DOH EPI.

Also export a `SCHEDULE_VERSION` string (e.g. `"DOH-EPI-2026-01"`). This lets you tell later which revision a given child's schedule was generated from, and is what makes a future re-generation feature safe to build.

## Step 2 — Write the generator

**New file:** `back-end/src/utils/epiGenerator.js`

Export one function:

```
generateEpiSchedule(childId, dateOfBirth) -> { vaccinations: [...], reminders: [...] }
```

Behaviour:

- For each schedule entry, compute `due_date = dateOfBirth + offset`.
- Build a `vaccinations` row: `vaccine_name`, `visit_name`, `due_date`, `status: "scheduled"`, `date_given: null`.
- Build a matching `reminders` row: `reminder_type: "Vaccination"`, `title`, `reminder_date` (same as `due_date`), `status: "Pending"`, `vaccination_id` (filled after the vaccination insert returns its ID).

**Edge cases that must be handled:**

- **No date of birth provided.** `first_name` is the only required field on child creation. If `date_of_birth` is missing, **skip generation entirely** and return empty arrays — never guess a birth date.
- **Child registered late.** A parent adding a 3-year-old will generate doses with due dates in the past. Do not suppress them; a parent needs to see what was missed. Mark anything already past as `status: "scheduled"` with a due date in the past — the existing Health screen already renders overdue items, and this is exactly the catch-up information a parent needs.
- **Only schedule reminders for future dates.** Reuse the existing guard in `utils/notifications.js` — `scheduleReminder` already returns `null` for past dates. Creating past-dated `reminders` rows is harmless but pointless; filter them out server-side.
- **Invalid date of birth.** Validate parseability before generating; skip on failure rather than inserting rows with `NULL` due dates.

## Step 3 — Hook into child creation

**File to modify:** `back-end/src/routes/children.routes.js` — the `POST /` handler (currently lines 56–73).

After the child `INSERT` returns, and **before** the response is sent:

1. Call `generateEpiSchedule(child.id, child.date_of_birth)`.
2. Bulk-insert the vaccination rows, encrypting `vaccine_name` and `visit_name` with `encryptFields` — the `vaccinations` table encrypts those columns (see `records.routes.js` line 43) and skipping this would write inconsistent plaintext into an otherwise encrypted column.
3. Bulk-insert the reminder rows, encrypting `title`, with the returned vaccination IDs attached.

**Critical implementation requirements:**

- **Wrap the whole thing in a transaction.** Child insert + vaccination inserts + reminder inserts must be atomic. A partial failure that leaves a child with 7 of 13 doses is worse than a clean failure. ✅ **`back-end/src/db/pool.js` already exports a `withTransaction` helper** (line 56) — use it rather than hand-rolling `BEGIN` / `COMMIT` / `ROLLBACK`.
- **Use multi-row `INSERT`, not a loop.** One statement with multiple `VALUES` tuples for the vaccinations, one for the reminders. A per-row loop is ~26 round trips to Supabase and will make profile creation feel slow.
- **Do not let generation failure block child creation.** If the child row committed but schedule generation failed, the parent should still get their child profile. Consider committing the child first, then generating in a second transaction, and returning a flag in the response so the app can surface "Schedule could not be generated — tap to retry."

## Step 4 — Add a manual regeneration endpoint

**New route:** `POST /api/children/:childId/vaccinations/generate-schedule`

Needed for four real cases: the child was created before this feature existed; date of birth was added or corrected later; generation failed on the first attempt; the DOH schedule is revised.

Behaviour: accept an optional `{ mode: "fill-gaps" | "replace" }`.

- `fill-gaps` (default and strongly recommended): insert only doses that have no existing vaccination row with a matching `vaccine_name` + `visit_name`. **Never touch a row where `status = "completed"`** — that is parent-entered history and overwriting it is unacceptable data loss.
- `replace`: delete only `status = "scheduled"` rows with no attachment, then regenerate. Requires explicit confirmation in the UI.

## Step 5 — Front-end changes

**File to modify:** `front-end/App.js` — `handleCreateFirstChild` (line ~258) and `handleAddProfile` (line ~264).

- After `api.createChild(...)` returns, the vaccination list for that child is already populated server-side. The Health screen loads vaccinations on mount, so this may need no change at all — **verify by testing** rather than assuming.
- Schedule the local notifications client-side. The backend creates `reminders` rows, but `scheduleReminder` from `utils/notifications.js` only runs on the device. After child creation, fetch the new reminders and call `scheduleReminder` + `morningOf` for each future dose — mirroring what `components/Health.js` already does at lines 252–256.
- ⚠️ **iOS 64-notification cap.** A full EPI schedule is ~13 doses per child. Two or three children plus checkups will approach or exceed the iOS limit of 64 pending local notifications, and the excess is dropped **silently**. Mitigation for now: only schedule notifications for the **next 6 months** of doses, and re-arm on app launch. Note this in the code — it is a symptom of 4.5 and goes away once server-side push exists.

**File to modify:** `front-end/components/Health.js`

- Add a visual distinction between auto-generated schedule entries and parent-added ones (a small "EPI" chip). Helps the parent understand where the entries came from and reads well in a demo.
- Consider grouping the vaccination list by visit age ("At Birth", "6 Weeks", …) rather than a flat list. Thirteen pre-populated entries in a flat list is a wall; grouped by visit it mirrors the physical immunization card the parent already knows.
- Add the "Generate schedule" action for children who have no schedule yet.

## Step 6 — Attachment requirement interaction

Vaccinations are one of the five record types with a **mandatory** supporting photo. Auto-generated rows have no attachment, because nothing has happened yet.

✅ **Verified — this is not a blocker.** The requirement is enforced only in the UI: `front-end/components/ui/PhotoAttach.js` has a `required` prop defaulting to `true` (line 14). The backend never requires a vaccination to have an attachment — `attachments.routes.js` only validates that an image is present when *creating an attachment* (lines 47–50). Auto-generated rows will therefore save cleanly.

The rule to apply in the UI: **an attachment is required when a dose is marked completed**, not when it is scheduled. When the parent taps a scheduled EPI dose to mark it given, that is the point at which `PhotoAttach` should demand the photo of the immunization card. Check `handleToggleVaccine` in `components/Health.js` (line ~269) and make sure the completion path routes through the attachment prompt.

---

# 4.3 — Access Log Hardening + In-App View Notification

## Part A: Capture IP, user agent, and precise timestamp

### Step 1 — Additive migration

**New file:** `back-end/src/db/migrations/001_access_log_context.sql`

```sql
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS ip_address    VARCHAR(45);
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS user_agent    TEXT;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS seen_by_parent BOOLEAN NOT NULL DEFAULT FALSE;
```

Notes:

- `VARCHAR(45)` fits a full IPv6 address — do not use `VARCHAR(15)`.
- `access_date` already exists as `TIMESTAMPTZ NOT NULL DEFAULT now()`, so "precise timestamp" is **already captured**. The work is displaying it precisely (with time, not just date), not storing it.
- `seen_by_parent` supports Part B and is cheaper to add now than in a second migration.

Mirror all three columns into `schema.sql` so fresh databases match.

### Step 2 — Capture the values

**File to modify:** `back-end/src/routes/consult.routes.js` — the `INSERT INTO access_logs` at lines 47–51.

- **IP address:** `req.ip`. ⚠️ **This will record Railway's internal proxy IP unless you set `app.set("trust proxy", 1)` in `back-end/src/app.js`.** Without that line the feature silently logs the same useless address every time. Prefer `req.ip` over parsing `X-Forwarded-For` by hand once trust proxy is set.
- **User agent:** `req.get("user-agent")`. Truncate to a sane length (512 chars) before insert — user-agent strings are attacker-controlled on a public endpoint.
- **Timestamp:** already handled by the column default.

### Step 3 — Privacy consideration

An IP address is personal data under RA 10173. Two required follow-ups:

1. Update the consent text and `components/settings/PrivacySettings.js` to disclose that access context is recorded when a consultation code is used.
2. Add a note on the professional entry screen — "Your name, device, and network address will be recorded in the parent's access log." This is both legally cleaner and a mild deterrent against casual misuse, which recovers part of the value of the declined PRC field.

Do **not** encrypt these two columns. They are operational metadata the parent needs to read at a glance, and encrypting them would prevent grouping by IP to spot the "same code resolved from many locations" pattern that motivated the change.

### Step 4 — Surface it in the parent's access log UI

`api.accessLog(childId)` already exists (`utils/api.js` line 186). Find the screen that consumes it and extend each entry to show: professional name, **full date and time**, IP address, and a readable device summary parsed from the user agent (e.g. "Chrome on Android") rather than the raw string.

## Part B: In-app notification when a code is resolved

**Chosen approach: polling with an unseen-count badge.** The alternative — a real push notification — depends on server-side push infrastructure, which is 4.5 and explicitly deferred. Polling requires no new infrastructure and is honest about what it is.

### Step 5 — Backend

Add two endpoints in `back-end/src/routes/share.routes.js`:

- `GET /api/children/:childId/access-log/unseen` → count and rows where `seen_by_parent = FALSE`.
- `POST /api/children/:childId/access-log/mark-seen` → set `seen_by_parent = TRUE` for that child.

Both go behind `requireAuth` + `requireChildOwnership`, matching every other route in that file.

### Step 6 — Front-end

**File to modify:** `front-end/App.js`

- Poll `unseen` on app foreground, on child switch, and on a modest interval (60–120 seconds) while the app is open. Do not poll aggressively — every request is a live network call and there is no caching layer yet.
- On a non-zero count, fire the existing toast: `toast.info("Your records were viewed by Dr. Santos at 2:14 PM")`. `ToastProvider` is already mounted at `App.js` line 1117 and `useToast()` gives `success` / `error` / `info` — no new UI primitive needed.
- Add a badge to the header or the side-menu entry point so a notification that appears while the parent is away is not lost.
- Mark seen when the parent opens the access-log screen.

**Honest limitation to record:** this only notifies while the app is open. A parent who never opens the app is never told. That is inherent to polling and is resolved by 4.5, not here. State it plainly in the defence rather than implying real-time alerting.

---

# 4.4 — Display Snapshot Capture Time

The smallest change in this plan and the highest clarity-per-line.

### Step 1 — Backend

**File to modify:** `back-end/src/routes/consult.routes.js` — the response at lines 53–59.

`expiresAt: share.expiration_date` is already returned. Add:

```
capturedAt: share.generate_date
```

`generate_date` already exists on `shared_records` (`TIMESTAMPTZ NOT NULL DEFAULT now()`) — **no migration needed.**

### Step 2 — Front-end

**File to modify:** `front-end/components/ProfessionalView.js`

- Store `capturedAt` in the session object built at lines 47–52 (alongside `childName`, `recordKeys`, `payload`, `code`).
- Render it prominently in `RecordsView`, directly beneath the existing `viewOnlyBanner` (line 217) and above `childName` — not buried in the footer note.

**Wording:** `Records as of 12 July 2026, 3:40 PM` — absolute date and time, not "3 weeks ago". A clinician needs the actual timestamp.

**Staleness emphasis:** compute the age of the snapshot and escalate the styling. Under 1 hour: neutral, `colors.textMuted`. Over 24 hours: `colors.warning` with a warning icon and an explicit line — `⚠️ This snapshot is 3 days old. Records may have changed since. Ask the parent for a new code.`

### Step 3 — Default TTL: already correct, no change needed

✅ **Verified.** `front-end/components/ShareRecords.js` line 30 already defaults `ttl` to **60 minutes**, and the backend default matches (`share.routes.js` line 37). This is already inside the recommended 30–60 minute window, so **no change is required here.**

This is worth knowing rather than acting on: because the default share lifetime is one hour, a genuinely stale snapshot only occurs when a parent deliberately picks a longer TTL from the selector at lines 171–178. The staleness banner in Step 2 is therefore a safety net for the uncommon case, not a fix for everyday behaviour — which is the right shape for this problem.

Keep the longer options available; a parent sending a code ahead of an appointment is a legitimate case. Optionally, add a subtle inline hint next to the longer options ("longer codes may show older data") to close the loop.

---

# 4.6 — Export as PDF

### ⚠️ Dependency approval required

`CLAUDE.md` §10 says to ask before adding dependencies. This feature needs new ones. **Do not install anything until you have approved the approach.**

| Approach | Packages | Trade-off |
|---|---|---|
| **A. Client-side (recommended)** | `expo-print`, `expo-sharing` | Expo-native, works on device and web. No server load, no new endpoint. Data never leaves the device to be rendered. Weaker layout control. |
| **B. Server-side** | `pdfkit` or `puppeteer` on the backend | Full layout control, identical output everywhere. But: `puppeteer` is heavy for Railway, adds an endpoint that returns a child's entire medical history, and the generated file would land on the same **ephemeral disk** flagged in Section 3.5 unless streamed directly. |

**Recommendation: Approach A.** It avoids adding a new sensitive endpoint, avoids the ephemeral-disk problem entirely, and `expo-print` renders from an HTML string — which means the existing record shapes can be templated directly.

### Step 1 — Build the HTML template

**New file:** `front-end/utils/pdfTemplate.js`

Export `buildRecordHtml(child, records, options)` returning a styled HTML string. Include: child profile and birth information; vaccinations grouped by visit with given/due status; growth measurements; milestones; checkups; allergies and hereditary conditions; medical history; nutrition summary.

**Design requirements:**

- Header with the child's name, date of birth, and **generation timestamp** — same discipline as 4.4.
- A footer stating the records are parent-maintained. A printed document looks authoritative; do not let it overstate what it is.
- Inline CSS only. `expo-print` will not fetch external stylesheets.
- Use the theme tokens from `theme.js` so the export matches the app's identity, but **check contrast** — the pink theme's lighter tones may not survive black-and-white printing at a health centre.

### Step 2 — Wire up the export

**New file:** `front-end/utils/exportPdf.js`

Guard the imports the same way `utils/notifications.js` guards `expo-notifications` (lines 4–10) — `try/require`, degrade gracefully. This pattern is already established in the codebase and keeps the web build from breaking.

- Native: `Print.printToFileAsync({ html })` → `Sharing.shareAsync(uri)`.
- Web: `expo-print`'s `printAsync` opens the browser print dialog; "Save as PDF" is available from there. Verify behaviour on the EAS web build, since **the defence demo runs on web.**

### Step 3 — Add the entry points

**File to modify:** `front-end/components/settings/PrivacySettings.js`

Add an "Export my child's records" action beside the existing consent and deletion controls. This is the RA 10173 data-portability answer, so it belongs on the privacy screen.

Also add a secondary entry point on the child profile or Health screen — most parents will look for it there, not under privacy.

### Step 4 — Scope selection

Let the parent choose what goes in: all records, or a subset by category. Reuse the record-key selection UI from `ShareRecords.js` for consistency — the parent has already learned that interaction.

### Step 5 — This doubles as the offline fallback

Say this explicitly in the defence. A saved PDF on the parent's phone is readable with **no connectivity at all**. It does not fix 3.1, but it is a genuine partial mitigation of the offline gap and it costs nothing extra once this feature exists.

---

# Suggested Build Order

Ordered by dependency and risk, not by section number.

| # | Task | Why this position | Rough effort |
|---|---|---|---|
| 1 | **4.4 capture time** | Two files, no migration, no dependency, and the TTL default already checks out. Immediate visible win. | ~1–2 hours |
| 2 | **Additive migration infrastructure** | Blocks 4.3. Also clears the pending `calendar_events` migration. | ~2–3 hours |
| 3 | **4.3 Part A — log context** | Small once migrations exist. Don't forget `trust proxy`. | ~2–3 hours |
| 4 | **4.3 Part B — notification** | Depends on the `seen_by_parent` column from step 2. | ~4–6 hours |
| 5 | **4.2 EPI schedule** | Largest and highest-value. Verify the schedule data first. | ~2 days |
| 6 | **4.6 PDF export** | Independent; needs dependency approval before starting. | ~1 day |

**Estimated total: 4–5 working days.**

---

# Verification Checklist

Do not consider any item done until its row passes.

| Area | Test |
|---|---|
| 4.2 | Create a child with a date of birth → full schedule appears, dates correct against DOB |
| 4.2 | Create a child **without** a date of birth → no rows created, no crash |
| 4.2 | Create a 3-year-old → past doses appear as overdue, not hidden |
| 4.2 | Vaccination names are stored **encrypted** (inspect the raw DB row for the `enc:v1:` prefix) |
| 4.2 | Simulated failure mid-generation → transaction rolls back, no partial schedule |
| 4.2 | A scheduled dose with no attachment does not break the Health screen |
| 4.3 | Resolve a code → log row has a **real** client IP, not Railway's proxy address |
| 4.3 | Parent sees the toast and badge; opening the log clears the unseen count |
| 4.3 | Consent text and privacy screen mention IP/device capture |
| 4.4 | Professional view shows an absolute capture timestamp above the fold |
| 4.4 | A share older than 24 hours shows the escalated staleness warning |
| 4.6 | Export works on **web** (defence build) and on a device |
| 4.6 | Exported PDF is legible when printed in black and white |
| All | `cd back-end && npm test` passes — ⚠️ point `DATABASE_URL` at a throwaway database, never Supabase |
| All | Run `graphify update .` after code changes, per `CLAUDE.md` §11 |

---

# Deployment Notes

Per `CLAUDE.md` §10, after schema changes: **migrate → reseed → `git push`** so Railway redeploys. With the additive-migration approach the sequence becomes:

1. Run the additive migration against Supabase (`db:migrate:up`) — **not** `db:migrate`.
2. Verify the new columns exist and existing data is intact.
3. `git push` so Railway redeploys with code that expects those columns.

**Order matters.** Deploying code that reads `ip_address` before the column exists produces `column ... does not exist` errors — the exact failure mode `CLAUDE.md` §6 warns about.

Set `app.set("trust proxy", 1)` in the **same** deploy as the IP capture, or the first batch of logged addresses will be worthless.

---

## Sources

Immunization schedule references — re-verify before writing `epiSchedule.js`:

- [DOH Expanded Program on Immunization](https://doh.gov.ph/uhc/health-programs/expanded-program-on-immunization/)
- [Expanded Program on Immunization (EPI) — DOH CAR](https://caro.doh.gov.ph/expanded-program-on-immunization/)
- [PIDSP Childhood Immunization Schedule 2026](https://www.pidsphil.org/home/wp-content/uploads/2025/11/2026-PIDSP-Immunization-Calendar.pdf)
- [PIDSP Immunization Calendar 2025](https://www.pidsphil.org/home/wp-content/uploads/2024/11/2025-PIDSP-Immunization-Calendar.pdf)
- [Routine immunization for children in the Philippines — UNICEF Philippines](https://www.unicef.org/philippines/stories/routine-immunization-children-philippines)
