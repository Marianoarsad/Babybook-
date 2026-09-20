# BabyBook+ Release Guide

**What this document is for.** You have finished a piece of work on the `development` branch and
you want it live — running on the deployed backend, visible in the web demo, and installable on a
phone. This guide takes you through that from start to finish.

**How this is different from `DEPLOYMENT.md`.** That file is for setting things up the *first*
time: creating the Render service, choosing a database, running EAS for the first time. You should
not need it again. This file is the one you follow *every* time you ship a change.

**Who this is written for.** Someone who has not memorised how git, Expo or Render work. Every
command is explained before it is given. If a step already makes sense to you, skip the
explanation and run the command.

---

## Section 0 — One-time cleanup, do this before your next release

Do this once. It removes an entire class of error that will otherwise interrupt you on every
release.

### The problem

This project keeps a "knowledge graph" of the code in `graphify-out/`. It is generated
automatically by two small scripts that git runs on your behalf, called **hooks**:

- `.git/hooks/post-commit` rebuilds the graph after every commit
- `.git/hooks/post-checkout` rebuilds the graph after every branch switch

That second one is the troublesome one. The moment you switch branches, the hook rewrites those
files, so your working folder has unsaved changes *before you have typed anything*. Git then
refuses the next command to protect those changes, and you get one of these:

```
error: Your local changes to the following files would be overwritten by checkout:
        graphify-out/GRAPH_REPORT.md
        ...
```

```
error: The following untracked working tree files would be overwritten by checkout:
        graphify-out/2026-08-25/GRAPH_REPORT.md
        ...
```

Git is not broken and you have not done anything wrong. Git is simply not the right tool for
tracking a 35,000-line file that a script rewrites every few minutes.

### The fix

Tell git to stop tracking the folder, while leaving the files on your disk:

```bash
git rm -r --cached graphify-out
echo "graphify-out/" >> .gitignore
git commit -m "Stop tracking the auto-generated knowledge graph"
git push origin development
```

Line by line:

- `git rm -r --cached graphify-out` — `--cached` is the important word. It means "stop tracking",
  **not** "delete". Your files stay exactly where they are.
- `echo "graphify-out/" >> .gitignore` — adds one line to the ignore list so git does not offer to
  track it again. The `>>` appends; a single `>` would erase the file, so keep both arrows.
- The commit and push record the change.

**What you lose:** the graph is no longer visible on GitHub.
**What you keep:** everything else. `graphify query`, `graphify update .` and the hooks all read
the files from your disk and carry on working exactly as before.

### If the files ever block a command again

```bash
git restore graphify-out && git clean -fd graphify-out
```

`git restore` undoes changes to tracked files. `git clean -fd` deletes untracked files and folders
under the path you name.

⚠️ **`git clean -fd` deletes permanently — there is no undo.** Only ever run it with
`graphify-out` on the end, never on its own, or it will delete every untracked file in your
project.

---

## Section 1 — The release order, and why it cannot be changed

Read this before anything else. It is the one page that matters most.

**Always in this order:**

```
1. Database migrations  →  Supabase
2. Merge                →  development into main
3. Client builds        →  web demo, then phone
```

### Why the database has to come first

Render watches your `main` branch. The moment `main` changes, Render automatically rebuilds and
restarts the backend — you do not press anything. Within a couple of minutes your live server is
running the new code.

If that new code expects a database column that does not exist yet, it breaks. On this project's
last release, the new sign-up code tried to save a `relationship` field into a table that had never
received the migration adding it, and every registration on the live app failed with:

```
column "relationship" does not exist
```

Migrating first costs nothing. Migrating second breaks the live app for however long it takes you
to notice.

### Why the client builds come last

**The merge ships the backend only.** The web demo and the phone app are separate artifacts, built
separately, and they keep serving their old version until you rebuild them. Merging to `main` does
not touch either one. Sections 7 and 8 are how you update them, and they are not optional if you
want people to see your changes.

---

## Section 2 — Before you start

**1. Make sure everything is committed and pushed.**

```bash
git status
git push origin development
```

If `git push` says "Everything up-to-date", you are ready.

**2. See what you are actually shipping.**

```bash
git log --oneline main..development
```

The `main..development` form means "commits that are on `development` but not yet on `main`". This
is your release, listed. If something appears here that you did not expect, stop and look at it now
rather than after it is live.

**3. A rule for this project.**

**You perform the merge to `main`, always.** Not an assistant, not a script. `main` is what your
live backend serves, so the person who decides when it changes should be the person who knows what
else is going on that day.

---

## Section 3 — Apply database migrations to Supabase

Skip this section only if your release contains no new file in `back-end/src/db/migrations/`.

### 3.1 Find out what is already applied

Every migration that has run is recorded in a table called `schema_migrations`. In Supabase, open
**SQL Editor** and run:

```sql
SELECT filename FROM schema_migrations ORDER BY filename;
```

Compare that list against the files in your repository:

```bash
ls back-end/src/db/migrations/
```

Anything in the folder but missing from the query result still needs to run.

### 3.2 Take a backup if a migration drops anything

Open any new migration file and look for `DROP COLUMN` or `DROP TABLE`. If either appears, go to
**Supabase → Database → Backups** and take one first. A dropped column cannot be recovered.

### 3.3 Run the migration

The trick here is to hand the connection string to a single command rather than editing your `.env`
file. Nothing is left pointing at production afterwards, so there is no cleanup step to forget —
and forgetting it is what causes a local test run to hit your live database.

**Git Bash:**

```bash
cd back-end
DATABASE_URL="<your supabase session pooler url>" DB_SSL=true npm run db:migrate:up
```

Putting `VAR=value` in front of a command applies it to that one command only.

**PowerShell** uses different syntax, and its variables last for the whole window:

```powershell
cd back-end
$env:DATABASE_URL = Read-Host "connection string"
$env:DB_SSL = "true"
npm run db:migrate:up
```

`Read-Host` pauses and lets you paste. Use it rather than typing the password into the command
directly — PowerShell writes your typed commands to a plain-text history file on disk, and a
database password does not belong there. Close the window when you are done; that is the cleanup.

**Which connection string.** Supabase gives several. You want the **Session pooler** one, which
looks like `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.
Port `5432` is the session pooler. Port `6543` is the *transaction* pooler and does not support the
prepared statements migrations use.

**Why the shell value wins over `.env`.** `migrateUp.js` begins with
`require("dotenv").config()`, and dotenv only fills in variables that are not already set. It never
overwrites one. So whatever you set in the shell takes priority.

⚠️ **Use `db:migrate:up`, never `db:migrate`.** The `:up` version is additive: it applies only the
migrations that have not run yet, each inside a transaction. The version without `:up` runs
`schema.sql`, which begins by dropping **every table in the database**. It exists for first-time
setup only.

### 3.4 Confirm it worked

The migration ledger tells you a file ran. It does not tell you the columns came out right. Check
the database itself:

```sql
SELECT 'column' AS kind,
       table_name || '.' || column_name AS item,
       data_type || COALESCE('(' || character_maximum_length || ')', '') AS detail
FROM information_schema.columns
WHERE table_name = 'users'
UNION ALL
SELECT 'check',
       conrelid::regclass::text || '.' || conname,
       pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'users'::regclass AND contype = 'c'
ORDER BY 1, 2;
```

`information_schema.columns` is a built-in catalogue of every column in the database — you are
asking Postgres to describe itself. Swap `users` for whichever table your migration touched.

Two things to look at every time:

- **Encrypted columns must be `text`, with no length number.** This app encrypts values like
  `phone_number`, `city` and `facility` before storing them, and encrypted text is longer than what
  the person typed. A `character varying(50)` on one of those would quietly cut the value short and
  make it impossible to decrypt afterwards.
- **CHECK constraints must be present.** They are what turn a bad value into a clean `422` field
  error instead of a `500` crash.

Note that Supabase's SQL Editor only shows the result of the **last** statement when you run
several at once. That is why the query above is written as one statement joined with `UNION ALL`.

---

## Section 4 — Merge `development` into `main`

Use a pull request on GitHub's website. It shows you exactly what will change before it changes,
and it leaves a record you can point at later. It also matches what this project already does —
`main` carries a run of "Merge pull request #N" commits.

**Step 1.** Open the comparison page:

```
https://github.com/Marianoarsad/Babybook-/compare/main...development
```

That URL means "show me what `development` has that `main` does not". The commit count should match
what `git log --oneline main..development` printed in Section 2.

**Step 2.** Click **Create pull request**.

**Step 3.** Write a title and description a non-developer could understand. This project's
convention is to describe the change in terms of what a parent using the app would notice, then
note any database change at the end. For example:

> **Title:** Release: account rebuild, light mode by default, clearer growth charts
>
> Parents now say who they are to the child — mother, father, grandparent, guardian — instead of
> only picking a gender, and sign-up collects a phone number and city. The email address on the
> profile screen can now actually be changed; before, it said it saved and did not. The app opens
> in light mode rather than following the phone's night setting.
>
> Database: migration 008 adds `relationship` and `city` to the users table and removes the unused
> `gender` column. Already applied to Supabase.

**Step 4.** Look for **"Able to merge"** with a green tick. If GitHub reports conflicts instead,
stop — do not force it. Conflicts mean two branches changed the same lines and a person has to
decide which version is right.

**Step 5.** Click **Merge pull request**, then **Confirm merge**. Leave the merge type at the
default ("Create a merge commit") so every individual commit stays visible in the history.

**Step 6.** **Do not delete the branch.** GitHub will offer. Ignore it — you keep working in
`development`, and deleting it means recreating it for every future change.

---

## Section 5 — Bring your own machine back in sync

GitHub now knows about the merge. Your laptop does not.

```bash
git checkout main
git pull origin main
git checkout development
git merge main
git push origin development
```

Read top to bottom: switch to `main`, download the merge GitHub just made, switch back to
`development`, copy that merge across so both branches sit at the same point, then push.

Without the last three lines, your local `development` slowly drifts behind `main` and every future
merge gets messier.

If any of these commands is refused because of `graphify-out`, you have not done Section 0 yet. Go
and do it; it is a five-minute fix that removes the problem permanently.

---

## Section 6 — The backend deploys itself; confirm that it did

Nothing to run here. Render is watching `main` and started rebuilding the moment you merged.

**Watch it.** Open your Render dashboard. A new deploy should appear within a minute or two. Wait
for the status to read **Live**.

**Then check the server answers:**

```bash
curl https://babybook-xi2w.onrender.com/api/health
```

You want:

```json
{"ok":true,"service":"babybook-api"}
```

If the first call takes around a minute, that is the free tier waking up after being idle for 15
minutes. It is expected behaviour, not a fault. Try once more before worrying.

---

## Section 7 — Reflect the changes in the live web demo

**This is not automatic.** The web demo is a separate build living on EAS Hosting. Merging to
`main` updated your backend and did nothing at all to the page your reviewers open. Until you run
the commands below, they are looking at the old version.

### The thing that breaks this, explained once

The app needs to know where its backend is. That comes from a variable called
`EXPO_PUBLIC_API_BASE_URL`, and `front-end/utils/api.js` uses it like this:

```js
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4000";
```

Any variable starting with `EXPO_PUBLIC_` is **inlined at build time**. Expo substitutes the text
straight into the JavaScript file, then throws the variable away. It is not read when someone opens
the page. So whatever that variable held *at the moment you built* is frozen into the file forever.

**And here is the trap.** `front-end/eas.json` does contain the correct URL:

```json
"production": { "env": { "EXPO_PUBLIC_API_BASE_URL": "https://babybook-xi2w.onrender.com" } }
```

But those `env` blocks belong to **`eas build`**, the command that produces the Android and iOS
apps. The web demo is made by **`expo export -p web`**, a completely different command that never
reads `eas.json`. With no variable set, the `|| "http://localhost:4000"` fallback wins and
`localhost` gets baked into the file you upload.

The symptom is a login screen that says **"Network error — is the backend running and
reachable?"**, with this in the browser console:

```
Failed to load resource: localhost:4000/api/auth/login  net::ERR_CONNECTION_REFUSED
```

`localhost` means "the computer running this browser". The deployed page was asking the
*reviewer's own laptop* for the backend.

### The commands

Run these in **Git Bash**, in one window, in this order:

```bash
cd front-end
export EXPO_PUBLIC_API_BASE_URL="https://babybook-xi2w.onrender.com"
echo "$EXPO_PUBLIC_API_BASE_URL"
node ./node_modules/expo/bin/cli export -p web --clear
grep -c "babybook-xi2w.onrender.com" dist/_expo/static/js/web/AppEntry-*.js
```

What each line does:

- **`export VAR="value"`** — `export` is what makes a variable visible to programs you launch
  afterwards. Without it, the variable stays inside your shell and the build never sees it.
- **`echo "$VAR"`** — prints it straight back. If this does not show the Render URL, stop. Nothing
  after it can work.
- **`--clear`** — wipes the bundler's cache. Expo caches each transformed file to make rebuilds
  fast, and that cache can hold a copy of `api.js` with the *old* URL already baked in. Without
  `--clear` you can run a full rebuild and get a byte-for-byte identical file back. It happened on
  the last release. The flag makes the build slower on purpose.
- **`grep -c`** — counts how many times the Render URL appears in the finished bundle. **It must
  print a number above `0` before you deploy.** If it prints `0`, deploying is a waste of time.

If you are in PowerShell instead, the variable line is `$env:EXPO_PUBLIC_API_BASE_URL = "https://babybook-xi2w.onrender.com"`.
Setting it in PowerShell and then building in Git Bash will **not** work — the two shells do not
share variables.

### Deploy

Once the grep returns a number above zero:

```bash
eas deploy --prod
```

Then open the demo and press **Ctrl+Shift+R** to hard refresh. Browsers cache these bundles
aggressively and a normal reload can hand you the old one.

### Finding the demo URL

It is not written down in this repository. Get it from:

```bash
npx eas deploy:list
```

or from [expo.dev](https://expo.dev) → the **babybook-plus** project → **Hosting**.

---

## Section 8 — Reflect the changes in the phone build

The other half of "the live app". Two things about it differ from the web demo.

### Difference 1: the API URL is already handled

Phone builds are made with `eas build`, which **does** read the profile `env` blocks in
`eas.json` — and both already carry the right URL:

```json
"preview":    { "env": { "EXPO_PUBLIC_API_BASE_URL": "https://babybook-xi2w.onrender.com" } },
"production": { "env": { "EXPO_PUBLIC_API_BASE_URL": "https://babybook-xi2w.onrender.com" } }
```

So no shell variable is needed here. This is the exact opposite of Section 7, and the difference is
why the web demo broke while the phone build would have been fine. Keep the two apart in your head:

| | Command | Where the URL comes from |
|---|---|---|
| **Web demo** | `expo export -p web` | your shell, or `.env` — **not** `eas.json` |
| **Phone app** | `eas build` | the profile `env` in `eas.json` |

### Difference 2: there are no over-the-air updates

This project has no `updates` block in `app.json` and does not use `expo-updates`. A phone that
already has the app installed will **not** pick anything up from your merge, ever. Every change —
including a one-line change to a JavaScript file — needs a new build and a fresh install.

That is the honest answer to "how do I get my changes onto the phone": you rebuild.

### Building the APK for testers

Do this after Sections 3 and 6, so the backend it talks to is already live and migrated.

```bash
cd front-end
eas login                                        # once per machine
eas build --platform android --profile preview
```

- **`preview`** is the profile set to `distribution: internal` with `buildType: apk`. That means a
  file you can install directly — no Play Store account involved.
- The build runs on Expo's servers, not your laptop. It takes roughly **10 to 20 minutes**. You can
  close the terminal; the build carries on.
- When it finishes, EAS prints a link and a QR code. The same build is listed at
  [expo.dev/builds](https://expo.dev/builds).
- Open that link on the phone and tap **Install**. Android will ask for permission to install from
  an unknown source the first time — that is normal for a file installed outside the Play Store.

**Two warnings.**

⚠️ **Never give a tester a `development`-profile build.** That profile points at
`http://localhost:4000` deliberately, because it is meant for running against your own machine. On
someone else's phone it fails exactly the way the web demo failed — a network error on login.

⚠️ **Do not run `eas build:configure` again.** The project is already linked to EAS through
`extra.eas.projectId` in `app.json`. Running it a second time can rewrite that link.

### iOS

Apple gates iOS distribution, so a build on a real iPhone needs an **Apple Developer account
($99/year)**. The three routes — Simulator build, ad-hoc devices, and TestFlight — are laid out in
`DEPLOYMENT.md` Part 3, step 5. Use the `production` profile for TestFlight and store submissions;
it has `autoIncrement` set so build numbers rise on their own.

---

## Section 9 — Verify the release end to end

The database and the code agreeing on paper is not proof. One real round trip is.

- [ ] `curl https://babybook-xi2w.onrender.com/api/health` returns `{"ok":true,...}`
- [ ] Open the web demo and **hard refresh** (Ctrl+Shift+R)
- [ ] Create a new account through the real sign-up form, filling in every field your release
      touched
- [ ] Open **View Profile** and confirm those values read back
- [ ] Delete the test account through **Privacy Settings** when you are finished
- [ ] If you built an APK, install it and repeat the same sign-up on the phone

If sign-up fails with `column ... does not exist`, the migration in Section 3 did not reach
Supabase. Go back and run it; no redeploy is needed afterwards, because the code is already
correct.

---

## Section 10 — Troubleshooting

Search this table for the message you are seeing.

| What you see | What is actually wrong | Where to go |
|---|---|---|
| `Your local changes to the following files would be overwritten by checkout` | a hook rewrote the knowledge graph | Section 0 |
| `The following untracked working tree files would be overwritten` | a dated graph folder is tracked on one branch only | Section 0 |
| `column "relationship" does not exist` on the live app | you merged before migrating | Section 3 (no redeploy needed) |
| `Network error — is the backend running and reachable?` and `localhost:4000` in the browser console | the web bundle was built without the API URL | Section 7 |
| `grep` still returns `0` after a full rebuild | Metro's cache, or PowerShell syntax used in Git Bash | add `--clear`; use `export VAR=` in Bash |
| Login hangs on the very first attempt | Render's free tier waking from idle | wait a minute and retry |
| The installed app still shows the old screens | this project has no over-the-air updates | Section 8 — rebuild and reinstall |
| The installed APK cannot reach the backend | a `development`-profile build was handed out | rebuild with `--profile preview` |
| GitHub says the pull request has conflicts | two branches changed the same lines | resolve them deliberately; do not force the merge |

---

## Section 11 — Optional: make Section 7 harder to get wrong

Right now the correct web URL lives only in your shell history, so the next person to run
`npm run build` ships `localhost` again. A dedicated script in `front-end/package.json` would fix
that:

```json
"build:web": "cross-env EXPO_PUBLIC_API_BASE_URL=https://babybook-xi2w.onrender.com expo export -p web --clear"
```

This needs `cross-env` added as a dev dependency to work on Windows, so it is a decision rather
than a default — this project's working agreement is to ask before adding dependencies.

A GitHub Actions workflow could remove Section 7 entirely by rebuilding and deploying the web demo
whenever `main` changes. It needs an `EXPO_TOKEN` secret and is a small project in its own right.

---

## Quick reference

Once you know the reasoning, the whole release is this:

```bash
# 1. Database first
cd back-end
DATABASE_URL="<supabase session pooler>" DB_SSL=true npm run db:migrate:up

# 2. Merge on GitHub (pull request), then sync locally
git checkout main && git pull origin main
git checkout development && git merge main && git push origin development

# 3. Backend redeploys itself — just confirm
curl https://babybook-xi2w.onrender.com/api/health

# 4. Web demo
cd front-end
export EXPO_PUBLIC_API_BASE_URL="https://babybook-xi2w.onrender.com"
node ./node_modules/expo/bin/cli export -p web --clear
grep -c "babybook-xi2w.onrender.com" dist/_expo/static/js/web/AppEntry-*.js   # must be > 0
eas deploy --prod

# 5. Phone build (URL comes from eas.json — no variable needed)
eas build --platform android --profile preview
```
