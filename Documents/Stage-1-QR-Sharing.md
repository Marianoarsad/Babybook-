# Stage 1 QR Sharing — Implementation and Phone Test Guide

Updated: **October 10, 2026, 12:02 AM Philippine time (UTC+8)**.

Status: **Deployed for fictional/mock data testing. Real-phone verification is still required. Stage 1 is not signed off.**

## What is now live

- Parent app and visitor website: https://babybook-plus.expo.app/
- API: https://babybook-xi2w.onrender.com
- Current Expo web deployment: `oudywk05te` (frontend refresh, October 9, 2026, 12:28 PM Philippine time). Previous deployment: `tj7f2hrlrm`, retained as the rollback target.
- Backend release: PR [#5](https://github.com/Marianoarsad/Babybook-/pull/5) and permission fix PR [#6](https://github.com/Marianoarsad/Babybook-/pull/6), live commit `ef1a5eedba72cee93e35246191886640251acb3b`.
- Database migrations: 009–019, additive only. No destructive production schema command was used.
- Production cleanup: one `babybook_share_snapshot_cleanup` job, every five minutes. Four successful runs observed from 1:10 AM through 1:25 AM Philippine time on October 9, 2026, with no failed runs.
- Existing Free service plans were retained. No new package was installed. The local development branch and index were not changed.

The separate release includes earlier parent-API changes needed by the current website: provider/contact fields, nutrition fields, social sign-in compatibility, mutation receipts and notifications. Unrelated demo-seed changes, private environment files and backups were excluded.

### Frontend refresh — October 9, 2026, 12:28 PM Philippine time

Published the current local frontend, including the updated glass header controls, six blue/pink header images and navbar styling. Thirteen focused checks passed, followed by a cleared-cache production web export. Both the preview and live website serve matching HTML, script bundles and header assets. The bundle uses the production API, and four checked local server-secret values are absent. The existing API health check returned 200 and the stable-origin CORS preflight returned 204.

No backend code, database, environment file, dependency or service plan was changed. This refresh does not sign off Stage 1: browser visual and physical-phone checks remain separate. The full QR/API evidence below belongs to the initial rollout recorded at 1:29 AM; those end-to-end scenarios were not repeated for this visual refresh.

### Automated API timing — October 10, 2026, 12:02 AM Philippine time

The approved timing-only test passed. It created one dedicated fictional account, one fictional baby without a birth date (no automatic vaccination schedule), one growth entry and one 30-minute share through the normal application APIs. Credentials stayed in process memory; no local environment files, database credentials or encryption keys were read or changed.

After exactly 1,200 seconds without API requests from the test, the first record-opening request at 12:02:16 AM took **277 ms (0.277 seconds)**. The immediate repeat took **215 ms (0.215 seconds)**. Both returned HTTP 200, the expected fictional profile and measurement, exactly the selected profile/growth categories, and no-store headers. The test then revoked its own share and confirmed HTTP 410 with revoked status. The fictional account, baby, measurement and share history remain; no existing records were edited or deleted.

**Evidence limit:** this is hosted API timing after inactivity, not a confirmed Render cold start or Safari/Android rendering measurement. Render logs were not accessed, and other traffic was not monitored. Two successful requests do not establish general performance or complete the mobile pilot. Physical Android verification and overall Stage 1 sign-off remain pending. The one-off runner is `front-end/.cache/qr-hosted-timing-20261009.cjs`; its offline assertions and mocked success/failure-cleanup flows passed without network requests.

## How the QR works

1. The parent selects record categories and an expiry duration, then generates a new QR.
2. Its content is a website link, not a baby name or medical record: `https://babybook-plus.expo.app/#consult=<code>&token=<temporary credential>`.
3. A phone camera recognizes the HTTPS link and offers to open it in its browser. No BabyBook+ installation or parent login is needed for the visitor.
4. The visitor enters their name and taps **View Records**. Scanning alone does not retrieve medical information.
5. The server checks the code/credential, expiry, revocation and selected categories. It returns the frozen records authorized when that QR was generated, and records one viewing entry.
6. The viewer clears records at expiry and checks continuing access every 15 seconds while visible. When returning from the background, it hides records until access is checked again. Failed revalidation closes sensitive viewing rather than continuing indefinitely.

The token is sensitive even though it is not a database password. Do not post valid QR images, links or codes publicly. Someone with the valid link or manual code can request the records until it expires or is revoked. Entering a name records the visitor's claim; it does not verify a medical license or identity.

**Old QR images do not change automatically.** A previous image containing `BABYBOOK+CONSULT:...` is not a normal-camera website link. Generate a fresh QR after this update. Existing manual consultation codes and the app's legacy scanner remain compatible.

## What was verified

- 56/56 backend integration tests passed on `babybook_stage0_test`, the explicitly disposable local database. The deployed release passed 55/55; the additional local test proves concurrent cleanup/revocation in both lock orders. It changes tests only, not the deployed runtime. Neither production nor either recovery database received that destructive test schema.
- Migration rehearsal used only the production schema and fictional local rows. Migrations 009–018 ran twice without changing original fixture values. The additional permission migration is also tested for safe reruns and owner access.
- Fingerprints of 19 original production tables matched before and after the schema and permission changes. A fingerprint compares values, not just row counts.
- Direct anonymous database access was reproduced without retrieving rows (`LIMIT 0`), then blocked. Effective checks confirm both `anon` and `authenticated` are denied all 26 application tables and 23 sequences. RLS is enabled, not forced; existing owner/API and Storage access are retained.
- Hosted tests created a new fictional parent/baby, with fictional feeding, growth and health entries. All eight selected categories were present; a growth-only share withheld the profile and used a generic display name. Editing that fictional baby after sharing did not change the frozen snapshot.
- Hosted checks passed for required visitor name, rejected incorrect token, no-store responses, manual-code compatibility, non-logging metadata checks, parent revocation and natural one-minute expiry.
- The stable hosted bundle contains the production API address and no localhost API. Four checked local server-secret values were absent from the exported browser bundle. Exact stable/preview browser origins passed.
- QR parsing, full-link matrix generation, timer/visibility/cancellation/error behavior, viewer/theme, header navigation, cache and loading checks passed.
- Development cleanup completed four successful real schedules and preserved its live share, dead-share metadata and original-record sentinel. That development-only test job is paused. Production cleanup completed four successful schedules after activation. Across a subsequent production schedule, all 24 original-record/Storage-metadata fingerprints matched; an extra cleanup invocation affected zero snapshots and found no remaining eligible snapshot. No snapshot contents were logged.
- Concurrent cleanup/revocation was tested with actual PostgreSQL lock contention in both orders. A revocation committed first remains revoked; cleanup committed first leaves an expired, empty share rather than restoring access. The production runtime already has these atomic updates; no runtime change was required.

These are software and hosted API checks, **not a claim that physical phone scanning or every live screen has been visually tested**. Browser automation was unavailable in this session. Stage 1's phone and pilot gates remain open.

## Your next task: test a new QR on phones

### A. Prepare a fictional record on your computer

1. Open Chrome on your computer and visit **https://babybook-plus.expo.app/**. Use this hosted address, not `localhost:8081`.
2. Refresh the page to load the new website. Sign in to your existing test account. Do not enter real parent/baby medical information during this rollout.
3. Add a fictional baby such as **QR Test Baby**, with a fictional birth date. Add one fictional growth measurement and one fictional feeding record using the normal forms.
4. Open **Share Records** using the QR/header button.
5. In **Choose Records to Share**, select **Child Profile & Birth Info** and **Growth Measurements**. Leave the other categories unchecked for this first test.
6. In **Choose How to Share**, select **Generate QR**. Set the hour/minute wheels to **0 hours, 5 minutes**.
7. Tap **Generate Consultation QR**. Keep the newly generated QR visible on the computer screen.

Expected: a QR image and consultation code appear. If generation reports unreadable records, stop and report that exact message. Some older production mock fields have an unresolved encryption issue; do not change the encryption key to fix it. Test with a new fictional baby instead.

### B. Scan with your iPhone

1. On your iPhone, turn off Wi-Fi temporarily so this test uses mobile data. Confirm another ordinary website opens.
2. Open the normal **Camera** app and point it at the new QR on your computer. Keep the whole QR and its white border visible, avoid glare, and hold steady.
3. Tap the website link offered by the Camera app. Open it in Safari if asked.
4. Wait for the BabyBook+ professional-access screen. It should not ask for a parent password or show parent onboarding.
5. Check that the consultation code is already filled in. Enter a fictional viewer name such as **Dr. QR Test** and tap **View Records**.
6. Confirm that the fictional child's profile and growth information appear, and unselected nutrition/medical record sections do not appear.
7. On your computer, check **Access Log** in Share Records. Confirm one entry for the viewer name. Leave the phone open for 30 seconds; continuing checks should not add extra viewing entries.

Expected: the camera offers an HTTPS website, the visitor explicitly opens records, and only selected data appears. Render Free may take roughly a minute to wake after inactivity; allow up to 90 seconds for the initial request. Do not repeatedly tap while waiting.

If Camera says **No usable data found**, confirm that this is a newly generated QR after the update. Do not test an old saved image. Report the phone/browser version and exact message, without posting the valid QR or link publicly.

### C. Check revoke-while-open

1. Keep the fictional records open on the iPhone.
2. On your computer, open that same active share and select **Revoke Share**. Confirm the action.
3. Keep the phone page visible and online. It should stop displaying records after the next continuing-access check, normally within about 15 seconds plus network time.
4. Refresh the phone page, enter the fictional name again and request records. The revoked share must not reopen.

Stop and tell me if the records remain visible after 30 seconds on a working connection, or a revoked share reopens.

### D. Check one-minute expiry and background behavior

1. Generate another QR for the fictional baby with **0 hours, 1 minute**. Scan/open it and request records as above.
2. Keep it visible until the timer expires. The records should disappear; requesting them again should report expiry.
3. For a separate five-minute QR, open the records, switch away from Safari, revoke that share on the computer, then return to Safari. Records must not remain available while access is rechecked or after revocation is confirmed.
4. Open a second valid share after closing the first. It must show the second share, not restore old records from a delayed request.
5. Test refresh and Back. Direct-link refresh should return to explicit visitor access, not silently fetch records. Closing the visitor should return to the normal app/auth flow without exposing old data.

### E. Repeat on Android and report results

1. Borrow an Android phone if necessary. Use its normal camera or built-in QR scanner, mobile data and **Chrome**.
2. Repeat B–D with fresh fictional QR images. Do not install BabyBook+ just to view the share.
3. Tell me: **phone model, OS/browser version, scan result, first-load time, selected-only result, expiry result, revoke result, background result and any exact error**. Do not send passwords, keys or valid secret links.
4. Record a cold-start test too: after the Render API has been idle for at least 15 minutes, open a fresh valid share and time the initial View Records request. Record the actual delay rather than calling it instant.

We can check the real-phone boxes and sign off Stage 1 only after these results pass. If you have only an iPhone, tell me; the Android gate stays pending rather than being marked complete.

## Safety and limits

- **Mock data only** until Stage 0 recovery and release review are complete.
- A browser cannot guarantee black screenshots. Existing native capture protection is preserved, but no screenshot-proof browser promise is made.
- Expiry/revocation prevents further authorized app access; it cannot erase photographs, screenshots or copies someone already took.
- Render Free can sleep and wake slowly; provider quotas/outages still apply. No paid upgrade is automatically authorized.
- The server still uses its existing owner database connection. A separate least-privilege backend-role change would require another reviewed plan.
- Supabase's advisor still reports the pre-existing mutable search path of `set_updated_at`; this release does not claim to be a complete security audit. RLS-with-no-policy informational notices are expected for these intentionally server-only tables. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- Future tables/migrations, especially those created under another database role, must explicitly review grants and RLS. Do not grant the browser direct database access to fix a visitor error. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)

## Cleanup: what it does and does not remove

The scheduled function updates only `shared_records.payload` and, when necessary, `shared_records.status`. It clears temporary snapshots of expired/revoked shares. It does **not** delete share-history rows or touch original child/health records, accounts, consent, notifications, access logs, photos, attachments, Storage, keys or backups. Expired access is rejected immediately by the API even between cleanup runs.

Use the guarded setup/monitoring instructions in **Stage-1-Cleanup.sql**. Pause only the named job if necessary; disabling the entire pg_cron extension would affect unrelated jobs. Backup retention is separate from temporary-share cleanup.

## Developer verification and local development

From `C:\Users\Arzad\Desktop\Capstone\BabyBook+`, the safe integration command is:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Documents\Stage-0-Environment.ps1 -Action Test
```

It deliberately rebuilds only the disposable test database. Do not run plain backend `npm test` without explicitly selecting a disposable database. Never run `npm run db:migrate` on important data.

For local development, migrations 018 and 019 must also exist in the local database before the updated share routes can work. Use only the additive `npm run db:migrate:up` after confirming the intended local database and its backup. The production deployment does not automatically migrate the user's local database. No original local database migration was performed during this release.

A production web export must supply the public API address explicitly and clear Metro's cache; do not rely on native EAS build-profile variables. Development `.env` files were not edited.

## Return to Stage 0 after the phone checks

**Reminder: resume Step 2, restoring the existing encrypted production backup into the empty isolated recovery database.** The original production archive is still preserved; do not create a replacement backup just to avoid the restore test, delete staging folders, or rotate keys.

Stage 0 still needs original-archive recovery verification, attachment recovery/off-device backup evidence, and the approved backup-first handling of the four unreadable old production mock fields. Seven local unreadable values are a separate issue. The fictional/schema-only rehearsal and successful Stage 1 tests do not substitute for that recovery test.

The next Stage 0 guide will start from your current terminal/database state and explain each action before it runs.
