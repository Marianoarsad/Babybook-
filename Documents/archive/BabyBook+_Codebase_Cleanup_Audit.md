# BabyBook+ Codebase Cleanup Audit

**Date:** 2026-08-07
**Scope:** Full repo (`front-end/`, `back-end/`, root docs, `graphify-out/`).
**Status:** Proposal only. Nothing in this repo was deleted, moved, renamed, or edited to
produce this report — every command run was read-only (`grep`, `git ls-files`, `git status`,
`wc`, `du`, `git verify-pack`, `git log`). Each item below needs your individual sign-off
before any removal happens.

**Hard-constrained (never proposed here):** the QR share/consult flow (`ShareRecords.js`,
`QrCodeView.js`, `QrScanner.js`, `ProfessionalView.js`, `share.routes.js`, `consult.routes.js`,
`utils/snapshot.js`, `utils/shareCode.js`), `utils/crypto.js` / `enc:v1:` / `DATA_ENCRYPTION_KEY`,
consent/DPA code (`retention_until`, `DELETE /auth/me`, re-consent modal), `theme.js` tokens,
`back-end/src/db/migrations/*.sql`, `.env` files, and `back-end/tests/`.

---

## 1. Summary

| Category | Items | Reclaimed |
|---|---|---|
| Tier 1 — Safe to remove | 9 | ~1.4 MB + ~390 LOC |
| Tier 2 — Judgment call | 7 | ~8.3 MB + ~400 LOC |
| Tier 3 — Uncertain | 4 | informational, no size claim |
| Consolidation opportunities | 2 | behavioral, not size-reducing |

Interior code hygiene otherwise checked out clean: a repo-wide sweep for `TODO|FIXME|XXX|HACK`
returned **zero hits**, and `App.js`'s 19 comment lines are all explanatory prose, not dead
code left in place.

---

## 2. Tier 1 — Safe to remove

| Path / Item | Type | Size / LOC | Reference count | Evidence | Why it's dead |
|---|---|---|---|---|---|
| `front-end/.expo/dev/logs/start.log` | tracked log file | **1,272,761 B** | 0 | Largest tracked file in the whole repo (`git ls-files` sorted by size). Shows as ` M` in `git status` almost every session. | Expo's own dev-server log. `.expo/` **is already listed** in `front-end/.gitignore` — this file was committed before that rule existed, so the ignore never took effect on it. |
| `front-end/.expo/dev/logs/export.log` | tracked log file | 66,265 B | 0 | Same listing as above. | Same reasoning. |
| `front-end/_bigtest.txt` | scratch fixture | 45,000 B | **0** | `grep -rn "_bigtest"` across all `.js`/`.json`/`.md` in the repo → no hits anywhere. | File content is 45 KB of the literal character `A` with no newlines — a synthetic large-file test payload from earlier sandbox work, never wired into any script or test. |
| `front-end/_tmprun/` (`shareStore.js`, `storageAdapter.js`, `test.js`) | scratch dir, 3 files | 16 KB | Only self-referencing | `git ls-files front-end/_tmprun` → 3 tracked files. The only inbound reference is `_tmprun/test.js` requiring `_tmprun/shareStore.js` — nothing outside the folder imports it. | Babel-compiled snapshot copies of `utils/shareStore.js` + `utils/storageAdapter.js`, plus an ad-hoc `assert()`-based test harness, left over from the sandbox-file-mirror workaround documented in `CLAUDE.md` §7. Superseded by the real files under `utils/`. |
| `front-end/mockData.js` — 8 of its 10 exports | dead data | ~290 of 347 LOC | 0 each | Checked every export individually: `initialProfiles:0 initialImmunizations:0 initialFeedLogs:0 initialSleepLogs:0 initialMilestones:0 initialWorkshops:0 initialNotifications:0 initialAppointments:0`. | **Superseded-feature orphans.** `initialFeedLogs` and `initialSleepLogs` are the last surviving remnants of the `feed_logs`/`sleep_logs` tables `CLAUDE.md` §5 says were removed — a repo-wide `grep -rni "sleep_log\|temperature_log\|feed_log"` finds them *only* here; `schema.sql`, `adapters.js`, and the seed scripts are already clean. The other 6 exports are simply never imported. Only `initialUpdates` and `initialClinics` are live, both pulled into `Services.js:16`. |
| `front-end/components/ui/Screen.js` | component, whole file | 46 LOC | **0** | `grep -rn "ui/Screen"` → no import anywhere in the tree; the symbol `Screen` only appears at its own declaration (`Screen.js:9`). | Built but never wired into any screen. |
| `front-end/components/ui/Grid.js` | component, whole file | 30 LOC | **0** | `grep -rn "ui/Grid"` → no import anywhere; `Grid` only appears at its own declaration (`Grid.js:9`). | Same — built, never used. |
| `MetricWidgetCard` export in `front-end/components/common/Cards.js` | unused export | ~20 LOC | **0** | `grep -rn "MetricWidgetCard"` → exactly 1 hit, its own declaration at `Cards.js:26`. | Its sibling exports in the same file are all in active use (`SectionContainerCard` 74 refs, `EmptyStateCard` 15, `ListEntryCard` 12, `MemoryVisualCard` 4) — this one alone was never adopted by a screen. |
| `front-end/.expo/devices.json` (20 B) + `front-end/.expo/README.md` (751 B) | machine-local state | 771 B | 0 | Tracked despite `.expo/` being in `.gitignore`. | The README is literally Expo's own "this directory is automatically generated, do not commit it" notice — committing it is self-contradictory. |

**Note on `UserProfile.js`:** `CLAUDE.md` §5 says the old `UserProfile.js` was split into
`settings/ViewProfile.js` + `settings/EditProfile.js`. `grep -rn "UserProfile"` across the whole
repo returns **zero hits** — no orphan file, no dangling import. Nothing to remove here; listed
to confirm the check was done.

---

## 3. Tier 2 — Probably removable, needs a judgment call

| Path / Item | Type | Size / LOC | Reference count | Evidence | Trade-off |
|---|---|---|---|---|---|
| `screenshots/` (25 PNGs) | asset dir | **4.6 MB** | **0** | `git ls-files screenshots` → 0 tracked (it's untracked, so `git` cost is already zero). `grep -rn "screenshots"` across every `.md`/`.js`/`.json` in the repo → 0 hits; the README's own "Documentation Index" table doesn't link them. | Costs the repo nothing today since it's untracked — but it's 4.6 MB sitting with no consumer in the app or docs. Likely raw material for a defense deck that's already been given. Recommend moving out of the repo tree rather than deleting, unless you're sure you won't need them again. |
| `graphify-out/` | generated knowledge graph | **3.7 MB** (40 files ≈1.75 MB tracked + 35 untracked) | Load-bearing per `CLAUDE.md` §11 | `graph.json` 836 KB, `graph.html` 772 KB, `cache/` 521 KB, plus two dated snapshot dirs `2026-07-20/` (585 KB) and `2026-08-06/` (949 KB). 9 of the 14 lines in your current `git status` are graphify churn. | Fully regenerable via `graphify update .`, and it's the single biggest source of noisy diffs in `git status`. But `CLAUDE.md` §11 requires querying it for codebase questions — deleting it outright breaks that workflow. **Recommend**: keep `graph.json` + `GRAPH_REPORT.md` tracked, add `graphify-out/cache/` and the dated snapshot directories to `.gitignore` (they're the parts that regenerate every run and never need to be diffed). |
| `front-end/utils/shareStore.js` — dead half of the file | superseded logic | ~150 of 191 LOC | 0 each | Checked every export: `createShare:0 loadShares:0 revokeShare:0 resolveByCode:0 logAccess:0 loadLog:0 logForChild:0 codeFromQrPayload:0` from actual app code. (The `createShare`/`revokeShare` names *do* appear elsewhere, but those are `api.createShare` / `api.revokeShare` in `utils/api.js:185,187` — a different module entirely, the real backend-backed implementation.) | This is the pre-backend, AsyncStorage-only share implementation — fully superseded once `share.routes.js` shipped. Only `RECORD_LABELS` (12 refs) and `qrPayloadForCode` (2 refs) are still live and imported by `ShareRecords.js` / `ProfessionalView.js`. Because this file sits immediately next to the protected QR flow, **recommend trimming the 8 dead functions out, never deleting the file** — `RECORD_LABELS` needs to keep living somewhere. |
| 98 of 135 i18n keys in `translations.js` | dead strings, ×3 languages | ~350 of 501 LOC | 0 each | Extracted all 135 unique key names from the `en` dictionary, grepped each one across `components/`, `App.js`, `context/`, `utils/`. Only ~32 keys are ever reached through a `t("...")` call; only 7 files call `useLanguage` at all. | Dead set includes clear **removed-feature orphans** — `dashSleepTitle`, `dashSleepSub`, `dashTempTitle`, `dashTempSub`, `dashTempStatusHot/Cold/Normal`, `dashFeedingTitle`, `dashFeedingSub` (sleep/temp/feed logs were removed per `CLAUDE.md` §5) — and one **removed-nav orphan**, `navSettings: "Profile"` (the Profile bottom-tab was replaced by the side menu + Calendar tab). The rest of the 98 look like keys written ahead of i18n coverage that was never finished, not stale features. **Recommend**: remove only the ~10 confirmed removed-feature/removed-nav keys now; leave the rest as pre-written translation debt, since deleting them destroys work if i18n coverage resumes. |
| `front-end/vercel.json` + the `vercel-build` npm script | config | 11 lines + 1 script | Doc-only | Referenced only in prose: `CLAUDE.md:44,106` and `DEPLOYMENT.md:196-197` (as a fallback "fastest cross-platform prototype" path). No build pipeline actually invokes it — the live web demo path is EAS Hosting (`expo export -p web` + `eas deploy --prod`). | Dead weight if Vercel is never revisited as a hosting option; harmless as a documented fallback if it might be. Your call on whether that optionality is worth keeping. |
| `android.permission.RECORD_AUDIO` in `front-end/app.json` | config, 1 line | 1 line | 0 | Nothing in the codebase touches audio recording. `expo-camera`'s own declared permission string in the same file is scoped to "scan consultation QR codes" only. | Removing it shrinks the Play Store install-time permission prompt (a real trust signal for a parent-facing health app). Before removing, verify a real-device build of the QR scanner doesn't implicitly require it (some camera libraries bundle audio for video capture even when unused) — that's a device-test check, not a grep. |
| `expo-status-bar` dependency | npm package | 1 dependency | **0** | `grep -rn "expo-status-bar"` → 0 hits anywhere. `App.js:8` imports `StatusBar` from **`react-native`** itself (used at `App.js:557`), not from this package. | Genuinely unused today. Low-value removal — `npx expo install --check` may flag it back in as an SDK-recommended package, so the win is marginal. |

---

## 4. Tier 3 — Uncertain

| Item | Evidence | What would resolve it |
|---|---|---|
| `.git` directory bloat: **100.74 MB pack / 218 MB total `.git`**, against ~4 MB of files actually in the tree today | `git verify-pack` on the pack file's largest blobs are all historical `front-end/node_modules/*` binaries that were once committed and later removed: `hermes-compiler/hermesc/win64-bin/icudt64.dll` (26.9 MB), `@expo/expo-modules-macros-plugin/.../ExpoModulesMacros-tool` (14.5 MB), two `ExpoModulesCore.tar.gz` xcframeworks (~26 MB combined), `lightningcss.win32-x64-msvc.node` (9.3 MB), two `hermesc` binaries (~12.9 MB combined). `git ls-files \| grep node_modules` confirms **zero** are tracked in the current HEAD — they're pure history debris. | This can only be reclaimed by rewriting git history (`git filter-repo` / BFG), which you explicitly ruled out this session. Flagging as informational only — worth a deliberate decision later about whether a fresh clone + squashed history is ever worth the disruption (it would invalidate every existing clone and PR). No action proposed now. |
| `@expo/metro-runtime`, `react-dom`, `react-native-web` dependencies | 0, 0, and 1 direct source import respectively (`react-native-web` only shows up in `package.json`, not imported by app code) | These are Expo's own web-toolchain requirements, consumed by the Metro bundler itself rather than by any `import` statement in your code — a grep can't prove them dead. Only way to know for sure is removing one at a time and running `expo export -p web`, which risks breaking your working web demo. Not worth the risk for a dependency that costs nothing sitting in `package.json`. |
| `Documents/*.docx` / `*.pdf` (3.4 MB): `BabyBook+_Critical_Evaluation_2026-08.docx`, `BabyBook+_Proposal_Form.docx`/`.pdf`, `Capstone_Project_1_Babybook+.docx`, `Notes.txt` | These are your own academic submission artifacts, not code — no grep-based "unused" claim applies to them. | Whether they still need to live inside the git repo now that the defense is over, versus your own separate document storage — a call about the codebase's audience going forward (public GitHub repo for a native MVP, vs. this being submitted as-is for grading), not a code-hygiene question. |
| `CLAUDE.md` §2's repo-layout list names **8 docs that no longer exist**: `BabyBook+_Alignment_Evaluation_2026-07.md`, `_Application_Evaluation.md`, `_Research_Alignment_Evaluation.md`, `_Responsive_UI_System.md`, `_UIUX_Evaluation.md`, `_UIUX_Redesign_Direction.md`, `_DPA_RA10173_Compliance.md` (now lives at `Documents/BabyBook+_DPA_RA10173_Compliance.md` instead), and `DEVELOPMENT_ROADMAP.md` | Checked each path directly — all 8 are missing from the root; `git log` on `_DPA_RA10173_Compliance.md` shows it as `D` (deleted from root) in the current `git status`, consistent with the move to `Documents/`. | This isn't dead weight to *remove* — it's `CLAUDE.md` §2 itself being out of date and pointing at files that no longer exist. Resolve by editing that section to match the current root listing (`BabyBook+_App_Overview.md`, `PROJECT_HISTORY_SUMMARY.md`, `Documents/`), not by deleting anything. |

---

## 5. Consolidation opportunities

| Duplicated logic | Where it's duplicated | Proposed target |
|---|---|---|
| Age-from-date-of-birth calculation — 3 independent implementations | `Dashboard.js:24` (`ageText()`), `MemoryDetail.js:18` (`ageAt()`), `pdfTemplate.js:34` (`calcAge()`) — each computes the same "years/months old" string with slightly different formatting logic | New `front-end/utils/dates.js`, exporting one canonical `ageText(dob, asOfDate?)` that the other two call sites adopt |
| Ad-hoc date formatting — 6 separate call sites, only 1 named helper | `pdfTemplate.js:28` has the only named helper (`fmtDate()`); everywhere else calls raw `toLocaleDateString(...)` inline with slightly different option objects: `CalendarView.js:358`, `MemoryDetail.js:38`, `ProfessionalView.js:195`, `PrivacySettings.js:86` and `:88` | Same `utils/dates.js`, exporting a shared `fmtDate(date, style?)` |

Both are behavioral refactors (touching render output), not deletions — recommend doing them
**after** all Tier 1/2 removals are approved and applied, as their own separate pass with a
visual smoke-test of Dashboard, MemoryDetail, PrivacySettings, CalendarView, ProfessionalView,
and the PDF export.

---

## 6. Explicitly keeping

Listed here so this ground doesn't get re-audited later.

- **Everything under the hard constraints** at the top of this document (QR/consult flow,
  `crypto.js`, consent/DPA, `theme.js`, migrations, `.env`, tests) — untouched, not even
  investigated for "unused exports" beyond confirming they're referenced.
- `shareCode.js` → `codeFromQrPayload` (0 app-level refs) and `crypto.js` → `ENC_PREFIX` (0 refs
  outside its own file) — genuinely unused today, but both live inside hard-constrained modules,
  so they're left alone by the rule, not by an oversight.
- `mockData.js` → `initialUpdates`, `initialClinics` — the 2 of 10 exports that **are** live,
  pulled into `Services.js:16`. Keep these when trimming the file per Tier 1.
- `back-end/src/db/migrate.js` — destructive (drops/recreates every table), but it's the script
  behind both `npm run db:migrate` **and** `npm run db:reset` in `package.json`; it's meant to be
  dangerous for first-time setup, not dead code.
- `password_resets` table + `nodemailer` + `utils/mailer.js` — all live via
  `auth.routes.js:11,142,173,181`. Render Free currently blocks outbound SMTP (per `DEPLOYMENT.md`),
  but that's an infra limitation, not a reason the code itself is dead — it works everywhere else.
- **All 10 backend npm dependencies** (`bcryptjs`, `cors`, `dotenv`, `express`,
  `express-validator`, `jsonwebtoken`, `morgan`, `multer`, `nodemailer`, `pg`) — each individually
  confirmed with a live `require()` call. No backend dependency bloat found.
- `front-end/dist/` (5.8 MB on disk) — already in `.gitignore`, **0 files tracked by git**,
  regenerated by `npm run build`. Not a repo problem even though it's large on disk.
- The custom `currentView`-switch navigation in `App.js` — locked architectural decision per
  `CLAUDE.md` §3; not in scope for a dead-code audit regardless of size.

---

## 7. Recommended execution order

1. **Independent, zero-risk — do first, any order:** delete `front-end/_bigtest.txt`,
   `front-end/_tmprun/`, `components/ui/Screen.js`, `components/ui/Grid.js`, and the
   `MetricWidgetCard` export from `Cards.js`. None of these share a dependency with anything else
   on this list.
2. **Must happen together:** `git rm --cached` the 4 tracked `.expo/` files (`start.log`,
   `export.log`, `devices.json`, `README.md`) — confirm first that `front-end/.gitignore` already
   has `.expo/` listed (it does), so they don't reappear on the next commit once untracked.
3. **Must happen together:** trim `mockData.js` down to its 2 live exports (`initialUpdates`,
   `initialClinics`) **and** leave `Services.js:16`'s import line untouched, since it only ever
   pulled those two names.
4. **Must happen together:** remove `vercel.json`, the `vercel-build` script in
   `front-end/package.json`, **and** the prose references at `CLAUDE.md:44,106` and
   `DEPLOYMENT.md:196-197` — leaving the doc references after deleting the file would create a
   new stale-doc problem identical to the one flagged in Tier 3.
5. **Must happen together:** drop `expo-status-bar` from `front-end/package.json` **and**
   immediately re-run `expo export -p web` to prove the web build still succeeds before trusting
   the removal.
6. **Judgment calls — decide before touching anything:** `screenshots/` (move vs. delete vs.
   keep), `graphify-out/` gitignore scope (which subdirs to stop tracking), and which of the 98
   dead i18n keys are "confirmed removed-feature" vs. "unfinished i18n work."
7. **Last, and separately from all removals:** the two `utils/dates.js` consolidations — these
   change rendered output, not just delete files, so they need their own review pass and a
   visual smoke test afterward, not a bundled cleanup commit.
