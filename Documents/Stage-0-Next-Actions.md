# Stage 0 — Operator Actions

Updated: 8 October 2026 (Asia/Manila). **Stage 0 is not signed off.**

## Resolved — 8 October 2026: visible 7-Zip password prompts

The helper previously captured 7-Zip's output until the command finished, hiding the actual password prompt. Its inherited console input worked in the fictional reproduction, but the blank display made it appear unresponsive. All archive actions now display the password prompt live and announce each completed step. Raw archive listings/errors remain private, and passwords still go directly to 7-Zip's inherited terminal, never into arguments, environment variables, files or the vault.

To test typing/pasting safely in your own PowerShell, run from the repository:

```powershell
node .\Documents\Stage-0-Verification.check.cjs --archive-interactive
```

Use only the fictional password `fictional-test-password` for this check, not your Bitwarden password. Wait for **7-Zip password:**, type or paste with **Shift+Insert**, then press **Enter**. No letters or asterisks appear: 7-Zip deliberately disables echo. Enter the same fictional password at each of the four prompts. The final result should say **Fictional encrypted archive, password input and recovered bytes verified.** The check never reads the real vault, opens existing archives or connects to a database; its temporary fictional archive is removed afterward.

Verified here: character/incremental input and whole-string paste-style input in a Windows pseudo-terminal; AES/header-encrypted creation, encrypted listing, integrity test and byte-matching extraction; split prompt detection, private-output suppression, non-terminal rejection and failure/overflow handling. The actual Bitwarden-to-terminal clipboard shortcut still needs your confirmation in your own terminal. Native no-echo behavior is intentional. [7-Zip password input implementation](https://github.com/ip7z/7zip/blob/main/CPP/7zip/UI/Console/UserInputUtils.cpp)

**An existing production archive, `production-application-1791452958221.7z`, was found during this check. It was not opened, overwritten or verified. Do not rerun BackupProduction or delete a recovery database yet.** Keep the archive and send only the aggregate JSON from the previous backup attempt (or its sanitized failure line) so its completion state can be reviewed. Existing archives, source records and keys were untouched; Stage 0's backup/readability/exit gates remain incomplete.

## What is already verified

- The medication-dose validator bug is fixed locally. Both integration suites pass: **47/47 tests**, only in the disposable Stage 0 database.
- Production Supabase remains `icssxprtxspcgmkompdj`; production migrations remain 000–008. Nothing was migrated or deployed.
- The new **BabyBook+ Development** project is `yrkvntaqkikuofbpfmkh`, Singapore, AM Org, Free. Its `attachments` and `stage0-recovery` buckets are private and initially empty. BantayMoto was left untouched.
- Local attachment operations now reject the production Storage project. Local `.env` and existing encryption/auth keys were not rewritten.
- Read-only audits found **211 local encrypted values: 204 readable under the current key and 7 recoverable with the repository test key**. Local/imported production keys match. Production has **4 encrypted values, all unreadable under the current key and the supplied existing Render JWT key**. Keep both configured keys unchanged.

Only helpers, the validator fix, its regression test, the Storage guard and documentation are in this task's release scope. Other existing changes are not certified for deployment.

## 1. Supply existing secrets privately

Use your own PowerShell terminal, signed in as **Arzad**, in:

```powershell
Set-Location -LiteralPath 'C:\Users\Arzad\Desktop\Capstone\BabyBook+'
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Documents\Stage-0-Environment.ps1 -Action ImportProduction
```

The hidden prompts require:

1. The **current**, not newly reset, production PostgreSQL **Session pooler** connection URI. Use the confirmed BabyBook+ project, Singapore, port **5432**, database `postgres`, username `postgres.icssxprtxspcgmkompdj`. URL-encode password characters in the URI. Do not use the Transaction pooler on port 6543. Do not change Render yet.
2. The **existing** `DATA_ENCRYPTION_KEY` from Render's Babybook+ service Environment settings. Copy it privately into the hidden prompt. If that variable is absent, stop and report only that it is absent; do not generate a key or substitute a guessed value.

Then:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Documents\Stage-0-Environment.ps1 -Action ImportDevelopment
```

Use the **server-only service_role key** from **BabyBook+ Development**, not the production key, anon key, or publishable key. This action checks authenticated access to the development project's private buckets. A failed check blocks the development launcher. Secrets are Windows-account/DPAPI encrypted under AppData, never saved in Git, Notion, command arguments or chat.

- [ ] Production inputs imported without modifying the existing key/password.
- [ ] Development service key verified against the correct project.

If a previous import failed at `File.Replace` with "The path is not of a legal form", the helper had a Windows PowerShell null-string compatibility bug (fixed 7 October 2026). The failed replacement does not save the new inputs; rerun the same import command and enter them again in the hidden prompts. Do not reset the database password or encryption key. `Stage-0-Environment.check.ps1` reproduces the old failure and verifies the corrected encrypted save/reimport with fictional credentials only.

## 2. Save the archive password independently

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Documents\Stage-0-Environment.ps1 -Action ArchivePassword
```

Type `COPY` only with screen recording and clipboard sync disabled. Paste the password **only into your password manager**. Press Enter after saving; the helper clears the clipboard if it still contains that password.

Retrieve the password **from the password manager**, not DPAPI, and verify it opens the existing encrypted archives using 7-Zip. Do not extract patient information into OneDrive or another synced folder. Opening an archive's encrypted listing is enough for this independent-password check; byte recovery is verified separately.

- [ ] Password manager copy saved and independently retrieved.
- [ ] Saved copy opens both existing archives: `local-development-1791277613167.7z` and `private-attachments-1791277398855.7z`.

Existing archives are in `C:\Users\Arzad\BabyBook+ Backups`. Keep them. The local archive is **not a production backup**. Its successful row-count restore did not establish ciphertext readability.

## 3. Verify ciphertext without changing it

After importing the Render key:

```powershell
node .\Documents\Stage-0-Backup.cjs audit-local
node .\Documents\Stage-0-Backup.cjs audit-production
```

Only aggregate counts and key equality are printed. These modes use read-only transactions and never update records. If any value remains unreadable, stop recovery signoff and report the counts. Finding a matching historical key or an explicitly approved recovery decision is required; deleting ciphertext, replacing it with blanks or silently switching keys is not a fix.

- [ ] Existing key equality and readability checked across local and production data.
- [ ] Every unreadable value has an approved recovery outcome; no silent alteration.

### Added — 8 October 2026: test the existing production JWT key privately

Read-only investigation found **211 local encrypted values: 204 readable with the current key, and all 7 remaining values readable with the repository's test fallback key**. Their contents are recoverable; this alone does not establish that they are fictional records. No values were repaired or rewritten.

Production has **4 encrypted values, all unreadable with the current key and the repository test key**, in `children.first_name`, `milestones.title`, `users.full_name` and `users.phone_number`. The downloaded Supabase CA enabled the production audit with certificate verification intact. Local and imported production encryption keys match. The operator confirmed that production contains only dummy/mock data and that Render has an existing `JWT_SECRET`; neither confirmation authorizes a reset, deletion or replacement.

The backend historically falls back to `JWT_SECRET` if `DATA_ENCRYPTION_KEY` is absent. Test the existing Render value as an **additional candidate**, not a replacement encryption key:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Documents\Stage-0-Environment.ps1 -Action AuditProductionJwt -CertificatePath 'C:\Users\Arzad\Downloads\prod-ca-2021.crt'
```

Run from the repository in your own terminal as Arzad. Disable screen recording and clipboard history/sync before copying. Copy the existing `JWT_SECRET` from the Babybook+ service's Environment tab and paste it **only at the hidden prompt**. Do not save changes in Render, generate a key, put it in a command, substitute it in `ImportProduction`, or send it in chat. Clear your clipboard afterward.

The action passes the candidate through private stdin, prints aggregate counts only, and does not save the candidate in the vault, environment, or a file. Certificate trust and UTF-8 output encoding are scoped to the run and restored. The production source is guarded; the transaction is repeatable-read/read-only with query timeouts and rollback. `Stage-0-Jwt-Audit.check.ps1` and `Stage-0-Verification.check.cjs` check this flow using fictional data and doubles, not production tests.

In the report, inspect `encryption.candidates.productionJwt`. A fully matching candidate has `readable` equal to `encryption.encryptedValues` and `unreadable: 0` (last production count: 4). This confirms recoverability under that candidate, **not** that records are repaired or Stage 0 is complete. Share only the JSON counts, never the pasted key.

If the candidate fails, investigate older environment copies or obtain an explicitly approved dummy-data recovery decision. Before any repair, preserve/verify source backups, rehearse in an isolated copy, then approve narrowly scoped field updates with the current encryption key unchanged. A local archive is not a production backup. Do not run the destructive schema, blank fields, or silently mark unreadable data as recovered.

- [x] Affected production fields identified without exposing contents.
- [x] All seven local failures shown recoverable using the repository test key.
- [x] Operator confirmed production mock-only data and existing Render JWT variable.
- [x] Production JWT candidate tested: operator report shows readable 0, unreadable 4. This is not a passed readability gate.
- [ ] Verified backups and isolated repair rehearsal completed.
- [ ] Approved field repair/recovery outcome completed and audits repeated.

### Updated — 8 October 2026: approved production mock-data replacement

The operator has no older backend `.env` and approved the backup-first recommendation. Approval is limited to replacing the four unreadable **production mock fields**: `children.first_name`, `milestones.title`, `users.full_name` and `users.phone_number`. Preserve all other fields, rows, account credentials, IDs, relationships, attachments and configured keys. This is replacement of unknown mock values, **not recovery of their original plaintext**. The seven original local values are outside this production replacement scope.

At preparation, only the local-development and private-attachment archives existed. The read-only live preflight confirmed the same four unreadable values, one per approved field, and verified `pg_dump` TLS using the supplied CA. The isolated PostgreSQL **17.11** cluster was then started and checked on **127.0.0.1:55432**; its test role cannot access recovery data, and no production recovery database existed. A production archive and isolated rehearsal still need to be verified before any production update.

`BackupProduction` uses the existing guarded backup/restore path in explicit ciphertext-preservation mode. It applies the supplied CA to both Node and `pg_dump` for this process only, retaining strict certificate/hostname verification. It verifies encrypted archive recovery, all original row hashes and schema/sequence settings, and reports plaintext readability separately. Standard `production-db` still rejects unreadable ciphertext, and the migration-rehearsal readability gate remains unchanged.

- [x] Operator confirmed mock-only production and approved the four-field backup-first replacement.
- [x] Fictional Node and PowerShell checks passed for ciphertext preservation, unchanged readability gates, restore-mismatch rejection and CA restoration.
- [x] Live read-only source/verified-TLS preflight and isolated-cluster checks passed; no production writes or archive creation occurred.
- [ ] Saved password independently opens both existing archives.
- [ ] Production preservation archive and isolated restore verified from the actual operator report.
- [ ] Replacement rehearsed on the isolated copy with only the four approved fields changed.
- [ ] Production replacement applied under the existing approval and verified; all unrelated data remains unchanged.

## 4. Production application backup and isolated restore

Run **in an interactive terminal**, after the password-manager copy is verified:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Documents\Stage-0-Environment.ps1 -Action Start
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Documents\Stage-0-Environment.ps1 -Action BackupProduction -CertificatePath 'C:\Users\Arzad\Downloads\prod-ca-2021.crt'
```

If the isolated cluster is already running, skip `Start`. Never run `Prepare` or `ResumePreparation` again.

The isolated cluster was already started and verified during the 8 October preparation. Run only `BackupProduction` unless it has since been stopped.

The helper takes a read-only, consistent snapshot and dumps **all public application tables**, including `feed_logs`, `sleep_logs`, and `temperature_logs`. It encrypts both contents and filenames with 7-Zip, tests extraction, restores into the separate local `babybook_stage0_production_recovery` database, compares counts/row hashes/schema/sequence settings and checks every encrypted value. It refuses to overwrite a nonempty recovery database. Use the saved archive password only when the live **7-Zip password:** prompt appears; typed/pasted characters remain hidden and are never included in process arguments. The helper requires your interactive terminal; do not pipe a real password from a command or send it to the agent.

For this approved preservation step, a successful report must contain an `archive` beginning with `production-application-`, `rowsAndSchemaMatch: true`, `encryptedArchiveRecovery: true`, `ciphertextPreserved: true`, `preservationOnly: true` and `productionWrites: false`. `ciphertextReadable: false` and intended readable 0/unreadable 4 are currently expected. `stage0Signoff` must remain false. These facts verify byte preservation, not plaintext recovery or completed replacement. Send only the aggregate JSON report; never send passwords, keys, archive contents or extracted dumps.

TLS certificate checks remain enabled for both the Node connection and `pg_dump` (`verify-full` with the supplied CA). The wrapper restores prior process settings afterward; it changes neither system trust nor Render. If a certificate/connection check fails, stop and ask for help; do not use `rejectUnauthorized: false` or disable verification. [PostgreSQL TLS guidance](https://www.postgresql.org/docs/17/libpq-ssl.html)

Scope limitation: this is an **application backup**, not a full Supabase platform image. The manifest preserves public grants, RLS/policy definitions, extensions and Storage bucket/policy configuration as recovery evidence. Local restore deliberately omits provider owners/grants. Supabase-managed Auth/Vault were empty when inspected; the helper refuses a production backup if those start containing data or an unexpected schema appears. Platform role/grant recreation needs review before any restoration to a new production project. Storage object bytes require the separate backup below.

- [ ] Production application archive created and AES/header encryption verified.
- [ ] Isolated restore matches original rows and schema, including legacy tables.
- [ ] Production ciphertext is readable with the unchanged existing key.
- [ ] Provider-specific role/grant restoration requirements reviewed separately.

If the command fails after restoring, the restored data and archive are preserved. Do not clear the database to rerun it; ask for a narrowly scoped recovery plan.

## 5. Private attachment recovery

After the development key and saved password are verified:

```powershell
node .\Documents\Stage-0-Backup.cjs recover-attachments private-attachments-1791277398855.7z
```

This uploads recovered originals only into the **private `stage0-recovery` bucket in the Development project**. It checks byte hashes, denies unsigned public access, and verifies a short-lived signed download without printing its URL. It refuses a nonempty bucket and never overwrites, uploads to, or deletes from production. Recovered private objects remain available as evidence. A failure may leave partial recovery objects; do not empty the bucket automatically.

If a fresh production attachment archive is needed, use `node .\Documents\Stage-0-Backup.cjs attachments` interactively. It performs production **downloads only**.

- [ ] All recovered object bytes match the encrypted archive.
- [ ] Private/unsigned access denied; short-lived signed access succeeds.
- [ ] Recovered objects remain isolated from app-development attachments.

## 6. Off-device copies and migration rehearsal

Upload **only the encrypted `.7z` archives** to your chosen cloud folder. Never upload `.dump`, manifests, DPAPI vault files, temporary extraction folders, `.env`, or encryption keys. Keep the archive password in your password manager, not beside the archives. Download one cloud copy and compare its SHA-256 with the local archive using `Get-FileHash -Algorithm SHA256 -LiteralPath <archive path>`; filenames and hashes are safe to report, but never secret values or patient contents.

- [ ] Encrypted production database and private-attachment archives copied off-device.
- [ ] A downloaded copy has the same SHA-256 and opens with the saved password.

Only after recovery checks pass, replace `production-application-TIMESTAMP.7z` below with the actual archive basename:

```powershell
node .\Documents\Stage-0-Backup.cjs rehearse-migrations production-application-TIMESTAMP.7z
```

This restores a **separate** `babybook_stage0_migration_rehearsal` database and rehearses 009–017 atomically. Original clinical/legacy columns must retain their row hashes; expected migration-ledger updates are excluded from that comparison. A failure rolls back the migration batch and preserves the restored database. It never applies SQL to production. A successful rehearsal still does not authorize releasing all outstanding app changes.

- [ ] Rehearsal succeeds without changing original clinical or legacy data.
- [ ] Only migrations required by the eventual release are approved.

## 7. Provider checks and credential rotation — do not perform yet

Render read access, the Free runtime instance, correct workspace/service, and current live commit have been verified. The live commit is `5a24c389bf36e2c587081dfa168ddb5e461c24ce`. These read checks do not prove secret values or permission to deploy. In Expo, confirm your account can administer the BabyBook+ project, its current plan/billing/usage, and the stable production alias `https://babybook-plus.expo.app/`. Share only redacted evidence of roles, plan and alias; no tokens or secret environment values.

The exposed database credential remains unresolved until backup and key gates pass. Then coordinate a short maintenance window to reset **only the database password**, privately update Render `DATABASE_URL` and all authorized consumers, and remove the exposed plaintext from the parent notes. Leave `DATA_ENCRYPTION_KEY` and `JWT_SECRET` unchanged.

Apply the new environment with a **deploy pinned to the already-live commit**, not an unreviewed latest branch. A normal Render restart reuses the previous environment and does not load changes saved with Save Only. Recheck the actual live commit before rotation; do not assume the recorded commit is still current. Deploying a specific commit can disable automatic deployment; review that setting afterward rather than blindly enabling it. Verify an authorized database-backed read, not just `/api/health`, before declaring recovery. [Render deploy behavior](https://render.com/docs/deploys)

- [ ] Expo permissions, billing and production alias verified.
- [ ] All backup/key gates passed before database-password rotation.
- [ ] Password rotated, affected consumers updated, and exposed note sanitized.
- [ ] Database-backed access verified with the same encryption/auth keys.

## 8. Finish safely

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Documents\Stage-0-Environment.ps1 -Action Stop
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Documents\Stage-0-Environment.ps1 -Action Harden
```

Stop only the isolated Stage 0 cluster, never the original PostgreSQL service. Harden only the named Stage 0/backup directories; tooling can add sandbox permissions again on subsequent access. Archives, original records and recovery databases are preserved. Temporary decrypted working files created by a successful/handled helper run are removed; a forcibly interrupted process requires a separately reviewed temporary-file cleanup.

Update Notion with dated **Added / Updated / Resolved / Pending** evidence and check only genuinely verified gates. Stage 0 remains blocked on user inputs and recovery checks; no QR release, production migration, cleanup scheduler or deployment is authorized by this helper.
