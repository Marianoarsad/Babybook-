# QR Sharing Rollout Strategy

Updated: **October 9, 2026, 1:29 AM Philippine time (UTC+8)**.

This local reference complements the dated [Notion rollout notebook](https://app.notion.com/p/QR-Sharing-Rollout-Strategy-3f11820982ef8113a38ffbab9df5815f). Historical notes remain in Notion. Checked boxes below mean the stated evidence exists; unchecked gates must not be assumed complete.

## Stage 0 — Protect and Verify Existing Data

Objective: identify the environments, protect keys and prove important records and attachments can be recovered.

Why it matters: a backup file is not enough until it can be restored. Encryption keys must remain stable or existing records become unreadable.

- [x] Identify the existing Expo, Render and Supabase services; preserve original databases and keys.
- [x] Create isolated recovery/test environments and guarded helpers.
- [x] Audit ciphertext readability; document the unresolved original mock-field failures.
- [ ] Restore the existing encrypted production archive into the empty isolated recovery database and verify original data.
- [ ] Finish attachment recovery, off-device backup evidence and the approved backup-first mock-field handling.
- [ ] Complete the remaining environment/security evidence in Notion.
- [ ] **Stage 0 exit gate: recovery and data-safety evidence signed off.**

Operator decision: defer the remaining Stage 0 work while implementing Stage 1 with **mock data only**. This does not authorize real parent/baby data or claim recovery is complete.

## Stage 1 — Complete QR Sharing on the Existing Stack

Objective: make newly generated QR images open the branded, controlled browser viewer on EAS Hosting, Render and Supabase.

Why it matters: solve QR content, navigation, access controls and expiry before considering another hosting provider.

- [x] Add secure HTTPS link credentials, manual-code compatibility and persistent attempt limits.
- [x] Implement direct visitor entry, required name and explicit View Records.
- [x] Return only selected frozen categories; preserve access-log semantics.
- [x] Implement expiry, revocation, hidden-background revalidation and stale-response guards.
- [x] Publish reviewed compatible backend and web preview/production releases; verify the production API address and named browser origins.
- [x] Close direct anonymous database access with the separately approved server-only migration; preserve original data.
- [x] Pass isolated integration and hosted fictional sharing tests, including natural one-minute expiry.
- [x] Activate the narrowly scoped five-minute cleanup after four successful development schedules; observe four successful production schedules.
- [ ] Complete iPhone Safari and Android Chrome mobile-data scan/view tests and live visual checks.
- [ ] Complete short-expiry, revoke-while-open, refresh/Back and second-share checks on real phones.
- [ ] Record pilot results and actual Render cold-start latency.
- [ ] **Stage 1 exit gate: real-phone and pilot evidence signed off.**

Use **Stage-1-QR-Sharing.md** for the exact phone-test steps, release evidence, limits and Stage 0 reminder. Old non-URL QR images must be regenerated; their printed contents cannot be changed remotely.

## Scheduled Cleanup — Important Data Excluded

Objective: clear unnecessary temporary medical snapshots, not the parent's records or proof of sharing.

Why it matters: expired access should not leave extra copies indefinitely, and cleanup must never erase important history.

- [x] Allow changes only to dead-share payload/status; keep future active shares intact.
- [x] Preserve share rows, category choices, codes, timestamps and metadata.
- [x] Verify dead/live/repeated-run behavior and original-record preservation on test fixtures.
- [x] Deny anonymous/authenticated cleanup execution; expiry checks work independently of the scheduler.
- [x] Use exactly one named five-minute production job; keep the development rehearsal job paused.
- [x] Record successful scheduled runs without logging snapshot contents or credentials.
- [x] Verify all 24 original-record/Storage-metadata fingerprints across a production schedule and test actual concurrent cleanup/revocation in both lock orders locally.
- [x] **Cleanup technical gate: preservation evidence, restricted execution and scheduler activation are recorded.**

Cleanup verification does not sign off Stage 0 backup/attachment recovery. Ongoing job monitoring remains an operating responsibility in Stage 4.

Never include original profiles, medical/growth/feeding records, accounts, consent, notifications, access logs, memories, photos, attachments, Storage objects, keys or backups in this cleanup. Do not add a generic “delete old data” routine. Pause the named job only, not the entire pg_cron extension.

## Stage 2 — Optional Free-Tier Hosting Improvement

Objective: evaluate the same viewer on Cloudflare Pages with visitor resolution/status checks in Supabase Edge Functions.

Why it matters: this may reduce Render idle wake-up delay, but introduces a second runtime and additional maintenance. It is optional, not an automatic migration.

- [ ] Sign off Stage 1 or explicitly document why hosting migration is deferred.
- [ ] Export the same branded viewer without medical data or server secrets in static files.
- [ ] Build a preview with equivalent access/category/logging/error behavior.
- [ ] Verify existing sealed snapshots decrypt with the unchanged key.
- [ ] Verify parent revocation, rate protection, connection handling and single cleanup ownership.
- [ ] Test real phones, quotas and measured latency.
- [ ] **Stage 2 exit gate: preview parity/performance justify migration, or explicitly defer it.**

## Stage 3 — Switch Gradually and Preserve Old Links

Objective: move visitors only after a successful pilot, with compatibility and rollback.

Why it matters: saved QR images contain fixed addresses. Changing providers cannot rewrite those images.

- [ ] Complete Stage 2 or mark this stage unnecessary if migration is deferred.
- [ ] Pilot the new stable target and confirm its browser/API configuration.
- [ ] Keep the old viewer/API available until all dependent valid shares actually expire.
- [ ] Verify any redirects preserve complete credentials and pass real-phone tests.
- [ ] Test rollback without losing originals, new records, access logs or compatible migrations.
- [ ] **Stage 3 exit gate: pilot, old-link overlap and rollback evidence pass.**

## Stage 4 — Maintain and Upgrade Only When Needed

Objective: keep the feature useful, affordable and recoverable over time.

Why it matters: free subscriptions still require monitoring, backups and outage planning.

- [ ] Assign an owner and review routine for latency, failures and cleanup runs.
- [ ] Review database/Storage/bandwidth/function allowances against actual use.
- [ ] Repeat isolated database and attachment recovery tests.
- [ ] Document outage response and how to disable new QR generation safely.
- [ ] Keep medical data and secret links out of diagnostic logs.
- [ ] Set budget/upgrade triggers before buying anything; treat operational-log retention separately from share cleanup.
- [ ] **Operating gate: monitoring, recovery and incident responsibilities are agreed.**

No paid upgrade, full backend rewrite, database relocation or app-store submission is automatically authorized by finishing a stage.

## Immediate Next Step

Follow the real-phone test guide. **After Stage 1 phone verification, return to Stage 0 Step 2: restore the existing encrypted production archive into the empty isolated recovery database.**
