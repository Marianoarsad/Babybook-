# BabyBook+ — Full Project History Summary

> This file is a "catch-up" document. It exists so that anyone (including a future version of
> the assistant helping with this project) can quickly remember everything that has been built
> so far, without having to re-read every old conversation. It is written so that a college
> freshman with no background in software engineering can follow it. Every abbreviation is
> explained in parentheses the first time it shows up in each section.

**Last updated:** August 1, 2026
**Covers work done between:** June 29, 2026 and July 27, 2026

---

## 1. What is BabyBook+?

BabyBook+ is a school capstone project (a big final project that students build to demonstrate
everything they learned in their degree). It is a mobile app (a program that runs on a phone)
built for parents in the Philippines to track their child's health and growth from **birth up
to age 6**. Think of it as a digital baby book that also acts like a mini medical record.

The app has two types of users:

1. **Parents** — the main users. They create an account, add their child's profile, and log
   things like vaccinations (shots that protect against disease), growth measurements, doctor
   visits, milestones (like "first steps" or "first word"), and memories (photos and notes).
2. **Healthcare professionals** (doctors, nurses, midwives) — a secondary user. A parent can
   generate a QR (Quick Response) code — a square barcode that a phone camera can scan — so a
   doctor can temporarily view a child's health records without needing a full account. This
   access is view-only and time-limited, similar to sharing a document link that expires.

The app is built in two main pieces:

- **Front-end** (the part users see and tap on): built with Expo, which is a toolkit for
  building apps with React Native (RN) — a way to write one set of code that works on both
  iPhone/Android and in a web browser.
- **Back-end** (the part running on a server that stores data and enforces rules): built with
  Express (a web server framework for a programming language called Node.js) and PostgreSQL
  (a type of database — a system for storing and organizing data), hosted on a service called
  Supabase.

---

## 2. Timeline at a Glance

| Date (2026) | What happened |
|---|---|
| June 29 | Got the app's hosting and deployment pipeline working (Vercel, later Railway) |
| July 3 | Finished the QR code consultation feature (doctors viewing records) |
| July 4 | Rebuilt data tracking to match the official research document (nutrition, photos, child info) |
| July 6 | Rebuilt the navigation menu and added a full Calendar feature; refreshed the visual theme |
| July 9 | Fixed a data-storage bug; connected a design tool (Google Stitch) for UI (User Interface) inspiration; began UI/UX (User Interface / User Experience) polish using it |
| July 11 | Added a branded loading screen and "skeleton" loading animations; polished the Dashboard |
| July 11–17 | Seeded (pre-filled) a full year of realistic demo appointment and calendar data |
| July 13–17 | Built a detailed "Memory Detail" screen for viewing a single photo/memory |
| July 27 | Cleaned up old planning documents that were no longer needed |
| Ongoing | Separated the local practice/testing environment from the live demo so testing never damages real demo data |

---

## 3. Detailed Breakdown by Phase

### Phase 1 — Getting the app online (June 29, 2026)

Before any features could be demoed, the app needed to actually be reachable on the internet.
This phase was mostly configuration work — telling hosting services like Vercel (a company that
hosts web apps) how to build and serve the app, fixing broken builds, and making sure files that
shouldn't be tracked by Git (the version-control system that saves a history of every code
change) — like `node_modules` (a folder of downloaded code libraries) and `dist` (a folder of
built/compiled output) — were excluded. This is normal "plumbing" work that has to happen before
any feature work is visible to real users.

### Phase 2 — QR (Quick Response) Code Consultation Feature (July 3, 2026)

This was described in the commit history as "the main feature of the app." It lets a parent
generate a QR (Quick Response) code that represents a temporary, secure link to their child's
records. A doctor or nurse scans that QR (Quick Response) code with their phone camera and is
taken to a **view-only** portal — meaning they can look at the records but cannot edit, delete,
or add anything. This solves a real-world problem: in the Philippines, parents often carry a
physical paper "baby book," and if it's lost or forgotten, the doctor has no history to work
from. A QR (Quick Response) code on a phone can't be forgotten as easily as a booklet.

### Phase 3 — Aligning the App with the Research Document (July 4, 2026)

Every capstone project is guided by a written research paper that justifies why each feature
exists. This phase made sure the actual app matched what the paper promised. Specific changes:

- Added a **unified nutrition tracker** — one single screen/table for tracking both milk
  feeding (breastmilk or formula) and solid foods, replacing what would otherwise have been
  several separate, disconnected logs.
- Added **mandatory photo attachments** for five important record types: vaccinations,
  illnesses, medications, hospitalizations, and checkups. This means when a parent logs one of
  these events, the app requires a supporting photo (like a photo of the vaccine card), which
  adds credibility for a doctor reviewing the record later.
- **Removed** features that the research paper did not call for: separate sleep-tracking,
  temperature-tracking, and an old, separate feeding log. These were folded into or replaced by
  the new nutrition tracker to avoid duplicate, disconnected data.
- Expanded the child's profile to include more relevant fields, such as nickname, place and time
  of birth, and preferred health center.

### Phase 4 — Navigation Overhaul and Calendar Module (July 6, 2026)

This was one of the largest single pieces of work. Before this phase, the app's bottom
navigation bar (the row of tappable icons at the bottom of the screen) included a "Profile" tab.
The team (the user and the assistant) agreed on a full redesign:

1. **Side menu (drawer).** Tapping the user's avatar (profile picture) now opens a slide-in
   panel from the right side of the screen, instead of jumping to a settings tab. This panel is
   organized into labeled groups: Account (View/Edit Profile), Application (Settings, Theme,
   Language), Support (Help, About), Security (Change Password, Privacy Settings), and Session
   (Logout).
2. **New bottom navigation.** The Profile tab was removed and replaced with a **Calendar** tab.
   The final five tabs are: Dashboard, Health, Growth, Services, Calendar.
3. **Full calendar feature**, built using a code library (a pre-written, reusable package of
   code) called `react-native-calendars`. It supports Month, Week, and Day views, and it
   automatically pulls in vaccination due dates, checkup dates, and medical history so a parent
   never has to manually re-enter an appointment that's already logged elsewhere in the app. It
   also lets parents create fully custom calendar events (like a baptism or a haircut
   appointment) with configurable reminder notifications.
4. **Nine new settings screens** were built from scratch: View Profile, Edit Profile, General
   Settings, Theme Preferences, Language Preferences, Help & Support, About the App, Change
   Password, and Privacy Settings. A brand-new back-end (server-side) feature — the ability to
   securely change your account password — was built to support this.
5. **New visual theme system.** The app now automatically switches its color scheme between pink
   (for a girl child) and blue (for a boy child) based on the selected child's profile, with a
   manual override available in Settings. This is powered by a central file (`theme.js`) that
   defines all colors as reusable "tokens" (named values like `colors.primary`) instead of
   hard-coded color codes scattered across the app — making future re-theming much easier.

**Note left for the future:** the new `calendar_events` database table (the structure that
stores custom calendar entries) was added to the code but has **not yet been applied to the
live production database** (Supabase). This is intentional — applying it requires a command that
resets every table, so it was left as a manual, deliberate step for the human project owner
rather than something done automatically.

### Phase 5 — Fixing a Data Storage Bug (July 9, 2026)

A bug was discovered where creating a new child profile through the app would fail with a
database error. The root cause: the app encrypts sensitive fields (like a child's name) using
AES-256-GCM (Advanced Encryption Standard, a very strong industry-standard method of scrambling
data so it can't be read without a secret key), and the *encrypted* version of a short name is
actually much longer text than the plain version. Several database columns were too narrow
(sized like `VARCHAR(50)`, meaning "at most 50 characters") to hold that longer encrypted text,
so saving would fail. The fix was to widen all affected columns to `TEXT` (a column type with no
strict length limit). This was applied and verified on the local practice database, but **still
needs to be applied to the live production database** on Supabase — this is a known, tracked
to-do item.

### Phase 6 — Connecting a Design Tool for Inspiration (July 9, 2026)

The team connected a Google product called **Stitch**, which is an AI (Artificial Intelligence)
UI (User Interface) design tool, through a protocol called MCP (Model Context Protocol) — a
standard way for the assistant to talk to outside tools and services. The agreement was that
Stitch's mockups would be used strictly as **visual inspiration**, not as a wholesale
replacement — meaning the app would borrow layout ideas, spacing, and component styles from
Stitch's more polished mockups, while keeping the app's own already-decided gender-based
pink/blue theme (rejecting Stitch's single all-blue theme) and while **not** re-adding sleep or
feeding logs that had been deliberately removed in Phase 3.

### Phase 7 — Dashboard and Loading-State Polish (July 9–11, 2026)

Using the Stitch mockups as a guide, several visual upgrades were made:

- **Dashboard redesign**: a friendlier greeting header, a "Baby Summary" card showing the
  child's photo plus quick facts (weight, height, sex, age), four colorful "Quick Action" tiles
  (Log Milk, Growth, Medical, Milestone) that jump straight to the right screen and tab, an
  upcoming-appointment highlight, and a "Recent Activity" feed built from real logged data
  (not fake placeholder data) showing things like "Vaccination Logged 2 days ago."
- **App Loading Screen**: a new branded splash/loading screen shown while the app is first
  starting up — with a spinner, the BabyBook+ logo, and a rotating status message. Special care
  was taken to make sure this screen doesn't rely on icon fonts that might not have finished
  loading yet (which previously caused a brief "blank icon" flash when the app opened).
- **Skeleton loading states**: instead of a blank screen or a spinning wheel while data is being
  fetched from the server, the app now shows gray "shimmering" placeholder shapes that match the
  actual shape of the content about to appear (for Memories, Immunizations, and Appointments
  lists). This is a common UI (User Interface) pattern used by apps like Facebook and LinkedIn to
  make loading feel faster and less jarring.

### Phase 8 — Demo Data Seeding (July 11–17, 2026)

To make the app look realistic and fully populated for a school demo/defense, the seed script
(a script is a small automated program; "seeding" means pre-filling a database with sample data)
was expanded to generate roughly a full year of realistic past and future appointments, plus
several example custom calendar events (like a baptism, a playdate, and a haircut), all attached
to one official demo account: `demo.parent@babybookplus.app`.

### Phase 9 — Memory Detail Screen (July 13–17, 2026)

A new full-screen view was built so that tapping on a saved memory (a photo plus a caption/note)
opens a nicely formatted detail page: a large photo, a small grid of "chips" (rounded info tags)
showing the Date, the child's computed Age at that date, and the Type of memory, followed by the
title and notes. This is now reachable both from the Dashboard's photo gallery and from the
Growth screen's milestone cards.

*(A tricky bug was found and fixed here: on the web version of the app, a certain kind of popup
window was rendering completely off-screen, one full screen-height below where it should have
appeared, because of how the underlying RN (React Native) library handles a specific animation
setting on web browsers. The fix was to switch to the same settings already used successfully
elsewhere in the app.)*

### Phase 10 — Environment Separation (July 8, 2026, ongoing practice)

To make sure that day-to-day development and testing could never accidentally damage or reset
the live demo that will be shown to evaluators, two independent safety layers were set up:

1. **Code separation**: all day-to-day work happens on a Git branch called `development`, while
   the hosting service (Railway) only automatically re-publishes changes from the `main` branch.
   So pushing practice code to `development` cannot accidentally break the live demo.
2. **Data separation**: a completely separate copy of PostgreSQL (the database software) was
   installed locally on the developer's own computer, so that running database
   commands—including ones that **wipe and rebuild every table**—during testing can never touch
   the real, live database that the production app uses (which lives on Supabase, a
   cloud-hosted database service).

### Phase 11 — Documentation Cleanup (July 27, 2026)

Several old planning and evaluation documents that were specific to earlier project-planning
stages (and no longer reflected the current state of the app) were removed to keep the
repository (the project's folder of tracked files) tidy and avoid confusing future readers with
outdated information.

---

## 4. Security and Privacy Work (ongoing throughout)

Because this app stores children's health information, security was treated as a first-class
feature, not an afterthought:

- **Field-level encryption**: sensitive database fields (names, medical details, contact info)
  are scrambled using AES-256-GCM (Advanced Encryption Standard with Galois/Counter Mode, a
  strong, industry-standard encryption method) before being saved, so that even someone who
  gained direct access to the database couldn't read this data without the secret encryption
  key.
- **Consent tracking**: when a parent registers, they must explicitly accept a consent
  agreement. The app tracks when they consented and requires them to re-confirm consent once a
  year (an "annual re-consent" reminder pop-up). Parents can also request full account deletion
  at any time, but the app **never** auto-deletes an account on its own — deletion is always a
  choice the parent makes.
- **Data Privacy Act compliance**: a written compliance document was produced referencing RA
  (Republic Act) 10173, which is the Philippines' Data Privacy Act — the national law governing
  how personal information must be collected, stored, and protected.

---

## 5. Where Things Stand Today (as of August 1, 2026)

**Fully built and working:**
- Parent accounts, child profiles, and all core health record types (vaccinations, checkups,
  milestones, medical history, unified nutrition tracking)
- QR (Quick Response) code sharing and the doctor/healthcare-professional view-only portal
- The full side-menu navigation redesign and all nine settings screens
- The Calendar tab with Month/Week/Day views and custom event creation
- The gender-adaptive pink/blue visual theme across every screen
- Dashboard redesign, branded loading screen, and skeleton loading states
- Field encryption, consent tracking, and Data Privacy Act documentation
- A safe local development setup that can't accidentally damage the live demo

**Known to-do items left for the human project owner (deliberately not done automatically,
since they involve risky, one-way actions on the live production system):**
1. Run the database migration on the live Supabase database so the `calendar_events` table
   (custom calendar entries) exists there — currently custom events only work in local testing.
2. Apply the same "widen encrypted columns to TEXT" fix (Phase 5) to the live production
   database — currently, creating a new child or record on the *live* deployed app could still
   fail with a storage error, even though this is already fixed locally.

**Planned next phase (not yet started):** a general UI/UX (User Interface / User Experience)
polish pass focused on accessibility — things like making sure text has enough color contrast
(especially light pink text, which can be hard to read), making sure every tappable button is at
least 44 pixels (a unit of screen measurement) so it's easy to tap, making sure text input boxes
use a large enough font to avoid an auto-zoom bug on mobile browsers, and making loading/empty/
error states look and feel consistent across the whole app.

---

## 6. Quick Glossary

| Abbreviation | Meaning |
|---|---|
| API | Application Programming Interface — a defined way for two pieces of software to talk to each other |
| CRUD | Create, Read, Update, Delete — the four basic operations any data-driven app needs |
| DB | Database — an organized system for storing data |
| DPA | Data Privacy Act — the Philippine law (RA 10173) governing personal data protection |
| EAS | Expo Application Services — Expo's cloud service for building and hosting apps |
| JWT | JSON Web Token — a secure, compact way to prove who a logged-in user is |
| QR | Quick Response (code) — a square barcode a phone camera can scan |
| RA | Republic Act — a type of law passed by the Philippine legislature |
| RN | React Native — a framework for building mobile apps using web-style code |
| SQL | Structured Query Language — the language used to talk to relational databases like PostgreSQL |
| UI | User Interface — the visual, tappable parts of an app that a person interacts with |
| UX | User Experience — how easy, pleasant, and intuitive an app is to actually use |
