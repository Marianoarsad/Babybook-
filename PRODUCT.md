# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

BabyBook+ ships to Android and iOS as a real product with a design language that respects each OS's
conventions. A web export exists (EAS Hosting) and is used for the capstone demo, but it is a mirror
of the native app, not the primary surface.

## Users

**Primary — parents and guardians of a child aged 0–6, in the Philippines.** Not narrowed to
first-time mothers: the app serves experienced and first-time parents alike, and the same screens
must work for someone logging their third child's weekly feed and someone opening the app for the
first time. They use it in two distinct situations — at home, entering records between visits, and
in a clinic or barangay health center, pulling records up for a doctor. They hold a full account and
control everything: child profiles, every record, and all sharing.

**Secondary — healthcare professionals.** They never create an account and never log in. They scan a
parent-generated QR code (or type the consultation code) to get temporary, strictly view-only access
to the specific records that parent approved. They are on their own device, often on clinic
connectivity, with a patient in front of them and very little time.

Multiple children per parent account is a first-class case, not an edge case.

## Product Purpose

BabyBook+ is a digital baby book: a parent-held record of a child's health and development from
birth to age six. It does not replace the physical baby book that Filipino families keep as a
sentimental keepsake — it works alongside it as the organized, searchable, shareable backup.

The problem is that child health information in the Philippines lives on paper scattered across
places: baby books, vaccination cards, prescription slips, lab results, handwritten notes. Paper
gets lost between a barangay health center and a pediatrician's clinic. Records from different
providers never reconcile into one story. When a parent finally reaches a doctor, the right papers
often aren't in the bag, so the doctor decides with incomplete information.

There is a second problem the project treats as equally real: sharing a child's health history
normally means handing over everything, with no way to share only the relevant part.

Success means Filipino families actually adopt and keep using this — not that it demos well. The
capstone defense is a milestone, not the goal. Design decisions should be defensible as a real
product used on a real phone with a real connection.

Aligned with **UN Sustainable Development Goal 3: Good Health and Well-Being**.

## Positioning

The mechanism that neighboring products cannot truthfully copy is **parent-scoped, expiring,
revocable sharing to a provider who never onboards.**

- Digital immunization registries (e.g. DigiVacc) are provider-owned; the parent is a subject of the
  record, not its holder.
- Milestone trackers (CDC Milestone Tracker) are parent-held but have no provider-facing path at all.
- Parent-held paper handbooks (Japan's Maternal and Child Health Handbook, the UK "Red Book", the DOH
  Child Immunization Record) get the ownership right and the shareability wrong — sharing means
  handing over the whole book.

BabyBook+ is parent-held *and* provider-readable, at a granularity the parent chooses, for a duration
the parent chooses, revocable at any moment. The share is a frozen snapshot taken at generation time,
so a code issued last month can never expose a record added last week.

## Operating Context

- **Two usage scenes with different demands.** Home logging is unhurried and repetitive — a parent
  adding a feed, a measurement, a photo. Clinic use is time-pressured and read-oriented — finding a
  record, or generating a QR while a doctor waits.
- **Barangay health centers and private clinics** are the settings where the app's value is claimed.
  Connectivity there is unreliable, which is a design constraint rather than an excuse.
- **Records are parent-maintained and self-reported.** Nothing is provider-verified. The app requires
  a supporting photo on five clinical record types (vaccination, illness, medication,
  hospitalization, checkup) as the only verification mechanism it has.
- **The physical baby book still exists** and the family still values it. The app is not competing
  with it.
- **Bilingual reality:** English and Filipino, switchable in-app.
- **Immunization follows the Philippine DOH EPI schedule** as the reference model parents are working
  against.

## Capabilities and Constraints

### Confirmed functionality

- Multiple child profiles per parent, each with birth details, hospital, pediatrician, OB-GYNE, blood
  type, allergies, and hereditary conditions.
- Record categories: vaccinations, medical history (`Illness` | `Medication` | `Hospitalization`),
  checkups, growth measurements (height, weight, head circumference), developmental milestones,
  unified nutrition (milk and solid food in one log), photo memories, reminders, and user-created
  calendar events.
- Calendar with month, week, and day views that **aggregates** existing records (vaccinations,
  checkups, medical history) rather than duplicating them; only custom events get their own storage.
- QR / consultation-code sharing, with per-record-type scoping, a server-capped time limit (default
  1 hour, hard cap 24 hours), immediate revocation, and an access log the parent can review.
- Local notification reminders with a configurable lead time.
- The interface theme follows the selected child (with a manual parent override). This is a product
  behavior, not a styling preference — it changes as the parent switches between children.
- English / Filipino language switching.

### Technical constraints future work must respect

- **Navigation is a custom `currentView` state switch in `App.js`.** There is no React Navigation and
  no expo-router, deliberately. Introducing one is a discussion, not a refactor.
- **Backend is raw SQL over `pg` with no ORM.** Generic CRUD is factored through `utils/resource.js`.
- **`DATA_ENCRYPTION_KEY` can never change.** Sensitive fields are encrypted at rest with AES-256-GCM;
  changing the key makes every existing encrypted value permanently unreadable.
- Deployment today: Express API on **Render**, PostgreSQL on **Supabase**, web demo on **EAS Hosting**,
  Android builds via **EAS Build**. (Migrated off Railway in August 2026 — `README.md` still says
  Railway in places and is stale on this point.)

### Known gaps — real, and not to be papered over

Because the success bar is real adoption, these are product deficiencies rather than roadmap trivia:

- **No offline mode.** Every screen is a live network request, so the app is unusable without
  connectivity — including in clinics, which is exactly where it is claimed to help. This is the most
  serious gap against the stated goal.
- Medical history (illnesses, medications, hospitalizations) is **not included in the QR snapshot**,
  and neither are attachment photos — so the professional sees a partial picture.
- Uploaded files are served **without authentication** and sit on an ephemeral filesystem, so photos
  disappear on redeploy.
- No WHO growth reference curves — measurements are recorded but never interpreted.
- The Services module (health centers, ratings, distances) is **mock data**.
- No DOH EPI schedule auto-generation; parents type every vaccine manually.
- Reminders are local-only: unreliable across reinstalls and devices, capped at 64 pending on iOS,
  and non-functional on the web build.
- No data export, despite RA 10173 portability expectations.
- Unremediated security findings: no rate limiting, no `helmet` headers, share codes generated with
  `Math.random()` rather than a CSPRNG.

### Explicitly undecided

- Whether iOS ships to the App Store, and on what timeline, versus Android leading.
- Whether real health-center data replaces the mock Services module before launch.
- Whether PRC licence verification for professionals is ever introduced.

## Brand Commitments

- **Name:** BabyBook+ (the `+` is part of the name).
- **Positioning language the project consistently uses:** "digital baby book", parent-controlled,
  view-only professional access, birth to age six.
- **Tone commitment:** the app is a recordkeeping tool, not a medical authority. It must never read as
  though it is giving medical advice, diagnosis, or a clinical judgment.
- Bilingual (English / Filipino) is a product commitment, not a feature toggle.

## Evidence on Hand

**Real, in-repo:**

- `Documents/Capstone_Project_1_Babybook+.docx` — the research paper.
- `Documents/BabyBook+_DPA_RA10173_Compliance.md` — Philippine Data Privacy Act compliance write-up.
- `Documents/BabyBook+_Critical_Evaluation_2026-08.docx` — security and quality findings.
- `Documents/BabyBook+_Proposal_Form.docx` / `.pdf` — approved project proposal.
- `Documents/BabyBook+_ROADMAP.md` — current progress and the plan to launch.
- `Documents/BabyBook+_Feature_Gap_Analysis.md` — what is missing versus comparable 2026 apps.
- `Documents/archive/` — completed implementation and evaluation plans, kept for the reasoning behind past decisions.
- `PROJECT_HISTORY_SUMMARY.md`, `BabyBook+_App_Overview.md`, `DEPLOYMENT.md`.
- A seeded demo account with a year of realistic records (`npm run db:seed:demo`).
- Prior-art research (`Documents/Notes.txt`): DigiVacc, Rourke Baby Record, CDC Milestone Tracker,
  Japan's Maternal and Child Health Handbook, Suhaimi and Ghazali's Web-Based Baby Health Record
  System (2023).

**Absences that must never be fabricated:**

- **No real users.** No adoption numbers, no testimonials, no case studies, no user-research quotes.
- **No clinic, DOH, barangay, or health-center partnership** of any kind.
- **No pilot deployment or field trial.** The app has never been used with a real child's records.
- **No pricing, licensing, or commercial terms.** The project is academic-use, all rights reserved.
- **No provider endorsement.** No doctor has validated the professional-facing portal.

## Product Principles

1. **The parent owns the record, and the interface must make that legible.** Consent, scope,
   duration, revocation, and deletion are all parent decisions. A non-technical parent should be able
   to tell who can see what without reading documentation. This is the product's core claim, so it
   cannot live in a settings screen nobody opens.

2. **Complement the paper baby book; never position against it.** The physical book keeps its
   sentimental role. BabyBook+ earns its place by being organized, searchable, and shareable —
   not by asking a family to give something up.

3. **Assume the worst device and the worst connection.** The target is a mid-to-low-end Android phone
   on unreliable data in a clinic. Performance, payload size, and graceful degradation are product
   requirements, not optimizations.

4. **Serve the repeat user without abandoning the new one.** Parents log records weekly for years, so
   entry must be fast and lists must be scannable — and the same screens must still be decipherable
   to a parent opening the app for the first time. Density and comprehensibility are not a trade-off
   to split; both are required.

5. **Never imply clinical authority.** Records are parent-entered and self-reported. The app
   organizes and presents; it does not interpret, diagnose, or advise. Any feature that reads as
   medical judgment is a correctness bug, not a design flourish.

## Accessibility & Inclusion

- **Bilingual English / Filipino** throughout, switchable in-app.
- **Non-technical primary audience.** Parents are not assumed to understand medical terminology,
  encryption, tokens, or expiry semantics. Interface language carries the burden.
- **Known, unmet targets** (a planned accessibility pass, not yet done): text contrast — particularly
  small text on the lighter theme — 44px minimum touch targets, and ≥16px input font size to prevent
  mobile focus auto-zoom. Empty, loading, and error states are inconsistent across screens.
- **Low-end device support** is an inclusion requirement, not a performance nicety: excluding parents
  on cheaper phones excludes exactly the families the project is meant to serve.
