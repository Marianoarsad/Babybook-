# BabyBook+ — Tier 1 Remediation Plan

**Scope:** Section 3 (Tier 1) problems from `BabyBook+_Critical_Evaluation_2026-08.docx`,
re-verified against the source tree on 12 August 2026.
**Status:** Plan only. No source code has been changed.

---

## What's actually open, and what isn't

Of the six Section 3 problems, **five are still open**. One — **3.6, no WHO growth
reference curves** — is **excluded from this plan**, not because it doesn't matter, but
because it's already built. `front-end/utils/whoGrowth.js` (LMS interpolation, z-scores,
percentile formatting), `front-end/assets/who/who-lms.json` (the real WHO 2006 standards
data, source PDFs kept alongside for provenance), and `front-end/components/
PercentileChart.js` (wired into both `Growth.js` and `GrowthChart.js`, confirmed
rendering percentile bands on the Dashboard's growth chart) exist and work.

**The only action item left for 3.6 is committing it.** `git status` currently shows
every one of those files as untracked or modified, on no commit, no branch. Two small
checks before that commit, not a rebuild:

1. Spot-check 2–3 values in `who-lms.json` by hand against a published WHO reference
   table — the file's header comment claims a verified max error of 0.0005 against
   WHO's own precomputed SD columns; confirm that claim before citing it in a defense.
2. `PercentileChart.js` was flagged earlier this month as the likely source of a
   recurring `"Unexpected text node: . A text node cannot be a child of a <View>"`
   console warning. Harmless on web, but worth a quick look before commit.

Effort to close: minutes for the commit, ~30 minutes for the two checks. Do this first —
it's the cheapest win available and it removes an entire finding from the table.

The remaining five group into **three jobs**, not five, because two pairs share the exact
same code:

| Job | Covers | Why grouped |
|---|---|---|
| **A** | 3.4 (public, unauthenticated uploads) + 3.5 (ephemeral filesystem) | Both live in `middleware/upload.js` / `app.js`'s static mount. Fixing storage location and fixing access control are the same migration to Supabase Storage — doing them separately means touching the same files twice. |
| **B** | 3.2 (QR share omits medical history) + 3.3 (verification photos never reach the doctor) | Both live in `back-end/src/utils/snapshot.js`'s `RECORD_LABELS` and `buildSnapshot()`. Adding medical history and attachment references to the shared snapshot is one coherent change to the same two objects. B depends on A: attachments need a signed-URL mechanism to reference safely, which is what A builds. |
| **C** | 3.1 (no offline mode) | Standalone, and by far the largest. Costed as two options — a full rebuild and the document's own named shortcut — so the choice is explicit rather than assumed. |

---

## Job A — Move uploads to Supabase Storage (closes 3.4 + 3.5)

**Problem, one sentence:** Uploaded photos of immunisation cards, prescriptions,
discharge papers, and children's faces are served from an unauthenticated
`express.static` mount (`back-end/src/app.js:35`) with guessable filenames
(`Date.now()`+`Math.random()`, `back-end/src/middleware/upload.js`), on a Render
filesystem that is wiped on every redeploy, restart, and 15-minute idle spin-down.

**Root cause:** `middleware/upload.js` writes to local disk via `multer.diskStorage`
because that was the fastest thing to wire up before any file-storage account existed —
and it was never revisited once Supabase (already the app's Postgres provider) became
available. The `/uploads` static mount predates the app's auth conventions: every
record-CRUD route inherited `requireAuth`/`requireChildOwnership` from the generic
resource factory (`utils/resource.js`) by construction, but this one file-serving route
was bolted onto `app.js` directly and never got the same treatment because it isn't a
"record route" in the pattern the rest of the app follows.

**Concrete fix:**
1. **New file** `back-end/src/utils/storage.js` — wraps `@supabase/supabase-js` Storage.
   `uploadFile(buffer, mimeType)` generates a `crypto.randomUUID()` key, uploads to a
   private bucket (e.g. `attachments`), returns the **key**, never a public URL.
   `getSignedUrl(key, expiresInSeconds = 300)` returns a short-lived signed URL.
2. **Modify** `back-end/src/middleware/upload.js` — replace `multer.diskStorage` with
   `multer.memoryStorage()` (buffer in memory, nothing written to local disk at all).
   Remove `publicUrlFor()`.
3. **Modify** `back-end/src/routes/attachments.routes.js` and
   `back-end/src/routes/memories.routes.js` — both currently call `publicUrlFor
   (req.file.filename)` and store the result in `record_attachments.file_url` /
   `memories.photo_url`. Replace with `storage.uploadFile(req.file.buffer, ...)` and
   store the returned key instead. Both routes also have local-disk delete logic tied to
   the old filename scheme (`unlinkFor`-style calls) — remove it; Supabase Storage
   objects are deleted through the same client instead.
4. **New route** `GET /api/attachments/:id/url` (and the `memories` equivalent) —
   `requireAuth` + `requireChildOwnership`, resolves the stored key to a fresh signed
   URL on demand. This is what the front-end calls instead of rendering a stored value
   directly.
5. **Modify** `back-end/src/app.js` — delete the `app.use("/uploads", express.static(...))`
   line entirely.
6. **Front-end:** `front-end/utils/api.js` gets a function to fetch the signed URL for a
   given attachment/memory ID. Every screen currently rendering `photo_url`/`file_url`
   directly as an `<Image>` source (`components/ui/PhotoAttach.js`,
   `components/ui/ImageViewer.js`, and wherever thumbnails render in `Health.js`,
   `Growth.js`, `Dashboard.js`, `AllMemories.js`) needs to call the new endpoint first
   and use the returned signed URL instead.
7. **`package.json`:** add `@supabase/supabase-js`. Per `CLAUDE.md` §10, this needs your
   explicit approval before installing — flagging it here rather than assuming it.

**Migration/data implications:** No column rename needed — `ADD COLUMN storage_key TEXT`
alongside the existing `file_url`/`photo_url` columns (additive, via
`back-end/src/db/migrations/`, applied with `db:migrate:up`, never `db:migrate`), then
stop writing to the old column going forward. Existing rows: the local files those old
URLs pointed to are very likely **already gone** — per 3.5's own finding, every Render
redeploy or 15-minute idle cycle wipes them, and this has certainly happened multiple
times since those rows were created. Before deploying this fix, check whatever currently
survives on the live Render instance's `uploads/` directory (this is the last chance to
manually pull any of it) — but plan for the realistic case that pre-existing attachment
and memory photos are unrecoverable, and their rows will show a broken-image state
post-fix exactly as they likely already do. This fix stops future loss; it cannot undo
past loss.

**Effort:** ~7 hours (2h storage util + signed-URL route, 2h upload middleware +
route changes, 2h front-end consumer updates across 4+ files, 1h migration + testing).
**Risk:** Medium. This touches every image-upload and image-display path in the app —
attachments and memories both. The regression to watch for is a screen that still reads
the old `file_url`/`photo_url` column directly and silently shows nothing once that
column stops being populated. Grep for every consumer before considering this done, not
just the ones listed above.

**Verification:**
- Upload a new vaccination attachment → inspect the DB row → confirm `storage_key` is a
  UUID, not a URL, and `file_url` is null/unchanged.
- `curl` the old `/uploads/<any-filename>` route → expect `404` (route is gone).
- Load that attachment in the app → confirms the signed-URL round trip renders.
- Fetch a signed URL, wait past its TTL, retry the same URL → expect failure (proves it
  actually expires, not just looks short-lived).
- Restart the Render service (or redeploy) → previously-uploaded-post-fix images still
  load (proves survival across the exact event that used to destroy them).

**What breaks if you skip it:** For the defense — the document's own predicted panel
question, "Where are the photos stored and who can see them?", has no good answer while
this stands, and the DPA-compliance claim is actively false in the meantime. For a real
parent — every photo of their child's face and medical documents stays visible to anyone
holding the URL indefinitely, and every photo is silently, permanently lost on the very
next redeploy, with no warning and no way to get it back.

---

## Job B — Extend the QR snapshot to medical history and attachments (closes 3.2 + 3.3)

**Problem, one sentence:** `back-end/src/utils/snapshot.js`'s `RECORD_LABELS` (lines
5–13) has exactly seven keys and no `medicalHistory`; `buildSnapshot()` never queries
`medical_history` or `record_attachments`, so a doctor scanning a BabyBook+ QR code sees
no current medications, no recent illnesses or hospitalisations, and no photographic
evidence behind any record it does show.

**Root cause:** `snapshot.js` was written against the original seven-category
share-selection UI before `medical_history` was consolidated into its own categorised
table and before `record_attachments` existed. Both were later additions to the data
model that never got back-ported into the snapshot builder — adding a new record type to
the app and remembering to also add it to a completely separate file that controls what
a stranger with a QR code can see is an easy thing to miss, because nothing forces the
two to stay in sync. They're in different files serving different mental models (data
entry vs. data sharing), so the omission is structural, not careless.

**A second, smaller instance of the same root cause:** `RECORD_LABELS` is actually
defined **twice** — once in `back-end/src/utils/snapshot.js` and, byte-for-byte
identically, again in `front-end/utils/shareStore.js` (which drives `ShareRecords.js`'s
toggle UI). Both copies need the same three new keys added, or the front-end will offer
a category the backend silently ignores.

**Concrete fix:**
1. **Modify** `back-end/src/utils/snapshot.js` — add `medications: "Current
   Medications"`, `illnessHistory: "Illness History"`, `hospitalizations:
   "Hospitalizations"` to `RECORD_LABELS` (splitting by category, per the original
   document's own recommendation, rather than one all-or-nothing toggle). Add matching
   blocks in `buildSnapshot()`: query `medical_history WHERE child_id = $1 AND category =
   $2`, decrypt the same fields `resource.js` already encrypts for that table. For every
   block whose record type carries mandatory attachments (vaccinations, medications,
   illnesses, hospitalisations, checkups), join `record_attachments WHERE record_type =
   $1 AND record_id = ANY($2)` and attach each record's `storage_key` (from Job A — not
   a baked-in URL, since freezing a permanent public URL into a share snapshot would
   reopen 3.4's exposure inside the "fixed" version). **Sequence Job A before or
   alongside this — B needs the storage-key column to exist.**
2. **Modify** `front-end/utils/shareStore.js` — add the same three keys, same labels.
3. **Modify** `front-end/components/ShareRecords.js` — the checklist already renders
   from `Object.keys(RECORD_LABELS)` (`:52`), so the three new categories appear
   automatically once step 2 lands. Add the "Share what a doctor usually needs" one-tap
   preset the original document also recommends: a button that selects `profile`,
   `allergies`, `medications`, `vaccinations`, and `illnessHistory` in one tap. Cheap to
   add alongside this change, and the document is explicit that most parents won't know
   which boxes to tick on their own.
4. **Modify** `front-end/components/ProfessionalView.js` — render the three new blocks
   the same way existing blocks render. Render attachment thumbnails (resolved through
   Job A's signed-URL endpoint) inline with any record row that has one.

**Migration/data implications:** None beyond what Job A already adds — this is
additive read logic against existing tables, no new columns of its own.

**Effort:** ~8 hours (2h medical-history blocks in `snapshot.js`, 3h attachment joins +
signed-URL wiring in the same file, 1h `shareStore.js` + `ShareRecords.js` including the
preset button, 2h `ProfessionalView.js` rendering for both new blocks and thumbnails).
**Risk:** Low. Purely additive backend logic and new UI elements — nothing existing gets
modified, so the regression surface is small. The one real risk is forgetting to encrypt
or decrypt the new `medical_history` fields the same way the resource factory already
does, or letting `snapshot.js` and `shareStore.js` drift apart again the same way they
already have once.

**Verification:**
- Generate a share selecting "Current Medications" for a child with an active
  medication → resolve the code as a professional → confirm it appears.
- Generate a share for vaccinations, for a vaccination row that has a photo attachment
  → resolve as professional → confirm a viewable image renders, not a broken link and
  not a raw public URL.
- Generate a share that does **not** select medications → confirm they're correctly
  absent (proves the toggle is real, not always-on).
- Tap the new one-tap preset → confirm the right boxes get checked.

**What breaks if you skip it:** For the defense — the document's own panel-question
table predicts both "Can the doctor see what medications the child is on?" (no good
verbal answer to "no") and "How do you know a parent didn't just make these records up?"
(no answer at all without attachments). For a real parent — a doctor prescribes
something that interacts with a medication the app knew about but never showed them,
which is a patient-safety failure, not a missing nice-to-have; and the photo-verification
requirement every parent was made to satisfy never reaches the one person it exists for.

---

## Job C — Offline mode (closes 3.1)

**Problem, one sentence:** `front-end/utils/api.js` is a thin fetch wrapper with no
cache, no local mirror, and no write queue — on any network failure it throws `new
ApiError(0, "Network error — is the backend running and reachable?")`
(`utils/api.js:67`) and the calling screen has nothing to fall back to.

**Root cause:** every screen was built and tested against a reachable dev backend
(localhost or LAN), so "the network is down" was never the common case while the app was
being written — each of the 15+ data-fetching screens follows the same bare `useEffect`
+ `await api.xxx()` + `setState` pattern, which works until the fetch itself fails, and
none of them were designed with an answer for that beyond a generic error state. Adding
offline support after the fact means touching the data-fetching pattern in every screen
individually, not one shared file — which is exactly why this is the most expensive item
in the whole document.

Two options, costed separately so the choice is explicit:

### Option C1 — Full: stale-while-revalidate + write queue

1. **New file** `front-end/utils/offlineCache.js` — wraps the existing `storage`
   adapter (`storageAdapter.js`, already abstracts AsyncStorage/localStorage) with a
   namespaced cache keyed by `childId:recordType`, storing `{data, cachedAt}`.
2. **Modify** `front-end/utils/api.js` — every list-style GET returns cached data
   immediately if present while the real request runs in the background; on success,
   updates the cache; on failure, serves the cached copy silently instead of throwing,
   unless there is no cache at all (first-ever load offline), in which case today's error
   path remains the last resort.
3. **New component** `front-end/components/ui/SyncBanner.js` — "Showing saved data ·
   last synced {relative time}," shown whenever rendered data came from cache rather
   than a fresh fetch. Needs wiring into every screen that fetches records (`Dashboard`,
   `Health`, `Growth`, `NutritionTracker`, `CalendarView`) — this is the part that
   touches the most files.
4. **New file** `front-end/utils/writeQueue.js` — queues `{method, url, body,
   timestamp}` for POST/PUT/DELETE made while offline; flushes in order on reconnect
   (needs a network-status signal — `@react-native-community/netinfo` isn't currently a
   dependency, or poll the health-check endpoint as a lighter-weight substitute), with a
   "syncing N pending changes…" indicator.
5. Every screen currently calling `api.createXxx`/`api.updateXxx` directly needs to
   route through the write queue when offline — again, most screens, not one file.

**Migration/data implications:** None — entirely client-side.

**Effort:** 3–4 days for something that actually holds up, plus a day of real-device
testing with airplane mode toggled mid-session (the actual failure mode — not just
"server unreachable at load time"). The document's own "~2–3 days" estimate is
optimistic for 15+ screens with independent fetch logic.
**Risk:** Medium–High. The regression to guard against isn't "nothing renders" — it's
showing **stale data as if it were fresh**, which is worse than showing nothing, since a
parent could act on an out-of-date allergy list without knowing it. The `SyncBanner` is
not cosmetic; shipping the caching half without it is a regression, not a partial win.

### Option C2 — Shortcut: offline consultation summary (the document's own named fallback)

1. **New file** `front-end/utils/offlineSummary.js` — on every successful full data
   load, cache one flattened per-child "consultation summary": profile, vaccination
   status list, allergies, current medications, recent checkups. Same shape
   `buildSnapshot()` produces, computed client-side instead.
2. **New screen** `front-end/components/OfflineSummaryView.js` — a read-only,
   screenshot/print-friendly card rendering that cached summary, reading straight from
   cache and bypassing every normal live-data screen.
3. Wire an **always-visible** "View offline summary" entry point on the Dashboard — not
   conditional on a failed fetch. A parent should be able to prepare this at home, before
   losing signal, not discover it only after the app has already failed them.

**Migration/data implications:** None.

**Effort:** ~1 day. **Risk:** Low — additive only, doesn't touch any existing
fetch/render path.

**Verification (C1):**
- Load the app live, enable airplane mode, revisit an already-loaded screen → data still
  renders with the "Showing saved data" banner.
- Visit a screen never loaded before going offline → an honest empty state, not a crash.
- Edit a record while offline → a pending-sync indicator appears; reconnect → the edit
  lands server-side and the indicator clears; repeat the same edit twice offline-then-
  reconnected → confirm no duplicate record is created (idempotency).

**Verification (C2):**
- With a live connection, open "View offline summary" → confirms it renders current
  data.
- Enable airplane mode, reopen the app fresh → the summary is still reachable, shows
  last-cached data with a visible "as of" timestamp.

**What breaks if you skip it:** For the defense — this is the document's own predicted
"most likely question in the room," and its own callout box states the stakes plainly:
"in the exact scenario the app was built for, paper wins." A demo that can't answer this
live concedes the app's own thesis. For a real parent — the core value proposition
(having records at the moment of consultation) fails exactly when it's needed, in a
barangay health centre with weak signal — which the original research this app is built
on describes as the median case, not an edge case.

---

## Roadmaps

### If I have one week

| Day | Ships |
|---|---|
| 1 | Commit 3.6 (minutes). Start Job A (Supabase Storage). |
| 2 | Finish Job A. |
| 2–3 | Job B (snapshot + `ShareRecords.js` + `ProfessionalView.js`). |
| 4–6 | Job C, **Option C2** (offline summary shortcut) — not the full rebuild. |
| 6–7 | Real-device testing: redeploy-survival test for A, offline-summary test for C2, cross-palette check for B's new UI. Rehearse the panel-questions table with the actual fixes in hand. |

**Explicitly deferred, with the reason to give a panel:** the **full** offline mode
(Option C1). A half-built caching layer without the sync-banner safeguard is worse than
no caching — it can show stale data as current — and doing it properly across 15+
screens is a multi-day job on its own that doesn't fit alongside A and B in a week.
Naming this as a scoped, deliberate deferral, with the shortcut already shipped as
evidence the problem was taken seriously, is a stronger answer than attempting it in the
time available and shipping something unreliable a live demo could expose. Also worth
naming explicitly: **Section 5's security defects are not in this plan's scope**, but a
one-week plan that closes zero of them — including the predictable-token-generator-
behind-an-unauthenticated-endpoint combination sitting behind the exact QR flow this
project is named after — is defensible only if you say so up front, not if a panelist
finds it.

### If I have three days

| Day | Ships |
|---|---|
| 1 | Commit 3.6 (minutes — do this first, it's free). Start Job A. |
| 2 | Finish Job A. Minimum slice of Job B: add a single, undivided `medicalHistory` key to `RECORD_LABELS`/`buildSnapshot()`/`shareStore.js`/`ShareRecords.js` — this alone closes 3.2 (the safety gap a panel is most likely to probe) even without the three-way category split or attachment thumbnails. |
| 3 | Ship Job C, **Option C2** (offline summary). Reserve the last few hours to test all three changes together and rehearse the two deferrals below. |

**Explicitly deferred, with the reason to give a panel:** **3.3** (attachment
thumbnails in the snapshot) — it depends on Job A landing cleanly first, and a rushed
integration risks showing a broken image link to a live doctor mid-demo, which is a
worse look than naming the gap plainly: "attachments are captured and stored securely;
surfacing them in the shared snapshot is scoped for the next iteration." **The full
offline mode** — same reasoning as the one-week plan, more acute with less time.
**The medical-history category split** (medications/illness/hospitalisations as three
separate toggles rather than one combined key) — the single undivided key still closes
the actual safety gap the document identifies; granular toggles are a refinement on top
of a fix that already exists, not a missing fix, and can honestly be named as "next"
rather than "incomplete."
