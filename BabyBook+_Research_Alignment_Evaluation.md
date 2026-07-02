# BabyBook+ — Capstone Research-to-Application Alignment Evaluation

**Reviewer role:** Capstone Project Reviewer / Systems Analyst
**Documents evaluated:** *Final_Capstone_1_Babybook.pdf* (Chapters 1–3) vs. the `front-end` application source (Expo / React Native, web build).
**Date:** June 2026

> **Scope note on the application as supplied.** The `front-end` folder is a **client-only Expo/React Native app**. It contains UI screens driven by **hard-coded mock data** (`mockData.js`) and a thin local-storage adapter (`utils/storageAdapter.js`). There is **no back-end, no Express server, and no PostgreSQL database** in the repository, even though Chapter 3 specifies them. Authentication, reminders, and record persistence are **simulated in the UI**. Where a feature could only be confirmed as "UI present but not actually wired to storage/logic," it is marked **Partially Implemented**. Where I could not see the running app (only source), data-dependent behavior is noted as such.

---

## Part 1 — Required System Features (extracted from Chapters 1–3)

| ID | Requirement Description | Source (Chapter / Section) | Type |
|----|------------------------|----------------------------|------|
| FR-01 | User registration, secure login/logout, account management | Ch1 Scope §(1); Ch3 D.1.a | Functional |
| FR-02 | Child profile management (create/edit; birth info: name, DOB, sex, blood type, birth weight/length, place/time of birth, hospital) | Ch1 Scope §(2); Ch3 IPO Input a; D.1.b; DB Table 3.20 | Functional |
| FR-03 | Capture healthcare info (pediatrician, clinic/hospital, OB-GYNE, preferred health center, emergency contacts) | Ch3 IPO Input b; DB Table 3.20 | Functional |
| FR-04 | Immunization / vaccination history (add, edit, review; date given, next dose) | Ch1 Scope §(3); Ch3 D.1.c; DB Table 3.21 | Functional |
| FR-05 | Checkup / pediatric consultation records | Ch1 Scope §(3); Ch3 C.1.d; DB Table 3.22 | Functional |
| FR-06 | Medical history: illnesses, allergies, medications, hospitalizations, hereditary conditions | Ch1 Scope §(3); Ch3 D.1.c; DB Table 3.23 | Functional |
| FR-07 | Growth monitoring (height, weight, head circumference, age indicators) | Ch1 Scope §(4); Ch3 IPO Input d; DB Table 3.24 | Functional |
| FR-08 | Developmental milestone tracking | Ch1 Scope §(4); Ch3 D.1.d; DB Table 3.25 | Functional |
| FR-09 | Nutrition records (feeding type, milk intake, solid-food introduction, preferences, reactions, schedule) | Ch1 Scope §(4); Ch3 IPO Input e; DB Table 3.26 | Functional |
| FR-10 | Memory & documentation (photos, captions, notes) | Ch1 Scope §(6); Ch3 D.1.f; DB Table 3.27 | Functional |
| FR-11 | Reminders for vaccinations and checkups (notifications) | Ch1 Scope §(5); Ch3 IPO Process d; D.1.g; DB Table 3.28 | Functional |
| FR-12 | Vaccination info / educational materials | Ch1 Scope §(5) | Functional |
| FR-13 | Nearest health-center info + health-center announcements | Ch1 Scope §(5) | Functional |
| **FR-14** | **QR-based consultation access: parent generates QR granting view-only access to selected records** | **Title; Ch1 Scope §(7); Ch3 IPO Process e; D.1.h; DB Table 3.29** | **Functional (core)** |
| **FR-15** | **Healthcare professional scans QR to view authorized records (2nd actor)** | **Ch3 Use Case 3.5/3.16; Use-Case Diagram** | **Functional (core)** |
| FR-16 | Parent permission control over which records are shared (selective sharing) | Ch1 Scope §(7); Ch3 NFR Privacy | Functional |
| FR-17 | Access-log / audit of QR view requests (date, time, professional, action) | Ch1 Scope §(8); Ch3 D.1.i; DB Table 3.30 | Functional |
| NFR-01 | Usability — user-friendly interface | Ch3 D.2.a | Non-functional |
| NFR-02 | Security — authentication, access control, encrypted password, secure storage, QR access protection | Ch3 D.2.b; DB Table 3.19 (`password` encrypted) | Non-functional |
| NFR-03 | Privacy — parent chooses which records are exposed via QR | Ch3 D.2.c | Non-functional |
| NFR-04 | Reliability — minimal record loss / correct retrieval (real persistence) | Ch3 D.2.d | Non-functional |
| NFR-05 | Availability — reachable with connectivity/device | Ch3 D.2.e | Non-functional |
| NFR-06 | Maintainability — designed for updates/fixes | Ch3 D.2.f | Non-functional |
| NFR-07 | Performance — record access / QR / reminders within reasonable time | Ch3 D.2.g | Non-functional |
| TR-01 | Tech stack: React Native (front), **Express JS (back), PostgreSQL (DB)** | Ch3 Table 3.1 | Technical constraint |
| TR-02 | Target platform: Android / iOS mobile (App Store / Play Store) | Ch3 Tables 3.2–3.4; System Scope | Technical constraint |

---

## Part 2 — Requirement-by-Requirement Comparison

| Requirement | Research Evidence | App Evidence | Status | Comments |
|---|---|---|---|---|
| FR-01 Auth | Ch3 D.1.a; Use Cases 3.5–3.6 | `Auth.js` has login, register (name/email/password/confirm/gender/terms), forgot-password screens | ⚠️ Partial | UI only. Login is **simulated** (`setTimeout`, accepts any input; no credential check). No real account creation/storage. Username derived from email prefix. |
| FR-02 Child profile | Ch3 IPO Input a; Table 3.20 | Add/Edit profile modal in `App.js`; multi-child in `mockData.js` | ⚠️ Partial | Form captures only name, DOB, gender, weight, height. **No blood type, place/time of birth, hospital field in the form.** No delete. Hospital/OB/pedia exist in mock data but are not user-editable. |
| FR-03 Healthcare info | Ch3 IPO Input b; Table 3.20 | "Care Team" card in `Health.js` shows hospital / OB / pediatrician | ⚠️ Partial | Display-only from mock data; no input form, no emergency contact, no preferred health center field. |
| FR-04 Vaccination | Ch1 §(3); Table 3.21 | `Health.js` vaccine list with completed/due toggle; `initialImmunizations` | ✅ / ⚠️ | Strong UI (dates, next dose, notes, toggle complete). Not persisted to a real DB; resets on reload. |
| FR-05 Checkups | Ch3 C.1.d; Table 3.22 | `Growth.js` "Clinical Consults & Appointments" (add appointment: title, provider, date, time, notes) | ✅ / ⚠️ | Implemented in UI (doubles as checkup log). State-only persistence. |
| FR-06 Medical history | Ch3 D.1.c; Table 3.23 | `Health.js`: Allergies & Sensitivities (add), Pediatric Conditions/Illnesses (add), Medications (add Rx) | ✅ / ⚠️ | Covers illnesses, allergies, medications, hereditary conditions. **Hospitalization** record type not clearly present. State-only. |
| FR-07 Growth monitoring | Ch1 §(4); Table 3.24 | `Growth.js` "Physical Metrics" add (height, weight) | ⚠️ Partial | Height/weight present; **head circumference** (explicitly in paper + DB) not captured. No growth chart vs. WHO standards. |
| FR-08 Milestones | Ch3 D.1.d; Table 3.25 | `Growth.js` "Development Checklist" + milestone cards | ✅ | Implemented (checklist + photo milestones). State-only persistence. |
| FR-09 Nutrition | Ch3 IPO Input e; Table 3.26 | `Dashboard.js` feeding log (milk ml / solids grams, notes) | ⚠️ Partial | Quick feed-logging exists, but **no structured nutrition record** (feeding type breast/formula/mixed, food introduced, preferences, reactions) as defined in DB Table 3.26. |
| FR-10 Memories | Ch1 §(6); Table 3.27 | Memory cards in `Dashboard.js`/`Growth.js`; `initialMilestones` photos | ⚠️ Partial | Memories **display** photos/captions, but no **upload/add-memory** flow (no image picker; `expo-image-picker` not installed). Read-only. |
| FR-11 Reminders | Ch1 §(5); Table 3.28 | `appointments` have `reminderActive`; `initialNotifications` mock list | ⚠️ Partial | Only **static flags + mock notifications**. No scheduling engine, no `expo-notifications` dependency, no real/push reminder is fired. |
| FR-12 Vaccine info / education | Ch1 §(5) | `Health.js` "Vaccine NCR Stock" info bullets | ⚠️ Partial | Some informational content present; not full educational materials. |
| FR-13 Health-center info + announcements | Ch1 §(5) | `Services.js`: nearby clinics (name, distance, rating, address), "Barangay Bulletin Board", hotlines | ✅ | Well covered (clinics + announcements). Static data. |
| **FR-14 QR generation** | **Title; Ch1 §(7); Table 3.29; Use Case 3.13** | **None found** — no QR library, no generate-QR screen, no `shared_records` selection | ❌ **Missing** | **The flagship, title-defining feature is entirely absent from the application.** |
| **FR-15 QR scan (HCP)** | **Use Cases 3.16; Use-Case Diagram (2nd actor)** | **None** — no scanner, no healthcare-professional view | ❌ **Missing** | Second actor and its entire workflow not implemented. |
| FR-16 Selective sharing / permission | Ch1 §(7); NFR Privacy | None | ❌ Missing | Depends on FR-14; not present. |
| FR-17 Access log / audit | Ch1 §(8); Table 3.30 | None | ❌ Missing | No logging of any kind. |
| NFR-01 Usability | Ch3 D.2.a | Clean, themed UI; bottom-tab nav; modals | ✅ | Genuine strength — polished, consistent design. |
| NFR-02 Security | Ch3 D.2.b; `password` encrypted | Simulated auth; localStorage flag `bb_auth=true` | ❌ Missing | No real authentication, no encryption, no access control, no secure storage. |
| NFR-03 Privacy (selective QR) | Ch3 D.2.c | None | ❌ Missing | Tied to absent QR module. |
| NFR-04 Reliability / persistence | Ch3 D.2.d | Mock data + React state; only auth flag persisted | ❌ Missing | Records are **not persisted** — all added records vanish on reload. No DB. |
| NFR-05 Availability | Ch3 D.2.e | Web build deployable (Vercel config present) | ⚠️ Partial | Runs as web/Expo; not published to App/Play Store as paper states. |
| NFR-06 Maintainability | Ch3 D.2.f | Componentized (`components/`, `context/`, `utils/`) | ✅ | Reasonable structure; i18n via context. |
| NFR-07 Performance | Ch3 D.2.g | Lightweight client | ⚠️ Insufficient Evidence | Plausible but untestable on mock data; no QR/reminder timing to measure. |
| TR-01 Stack (RN + Express + PostgreSQL) | Ch3 Table 3.1 | React Native present; **no Express, no PostgreSQL** | ❌ Missing | Back-end tier entirely absent. |
| TR-02 Mobile platform | Ch3 System Scope; Tables 3.2–3.4 | Expo app exported for **web** (Vercel); runnable on mobile via Expo | ⚠️ Partial | Mobile-capable but delivered/deployed as web; not store-published. |

---

## Part 3 — Missing Features (mentioned/implied in Ch1–3 but absent)

1. **QR-Based Consultation Access (FR-14, FR-16) — CRITICAL.**
   *Why required:* It is the defining differentiator named in the **project title** ("Parent-Controlled QR-Based Consultation Access"), an entire Scope module §(7), an IPO process, a functional requirement, a use case, and DB Table 3.29.
   *Where:* Title; Ch1 Scope §(7); Ch3 IPO Process e; D.1.h; Use Case 3.13; DB 3.29.
   *Impact:* Without it the application does not implement the central research contribution. A panel will read this as "the thesis is not demonstrated." **Highest-impact gap.**

2. **Healthcare Professional role + QR scan (FR-15).**
   *Why:* The Use-Case Diagram has two actors; the second actor's only workflow is scanning the QR to view records.
   *Where:* Ch3 Use Cases 3.16; Use-Case Diagram.
   *Impact:* One of two user roles is entirely missing; the consultation scenario cannot be shown end-to-end.

3. **Access Log / Audit (FR-17, Security & Audit module §8).**
   *Why:* Required to evidence "record view monitoring" and data-privacy accountability for minors.
   *Where:* Ch1 Scope §(8); Ch3 D.1.i; DB 3.30.
   *Impact:* Privacy/audit objective unverifiable; weakens the "privacy by design" claim made in Ch1.

4. **Real back-end + database (TR-01, NFR-04 Reliability).**
   *Why:* Ch3 Table 3.1 specifies Express JS + PostgreSQL; reliability requires actual persistence.
   *Where:* Ch3 Table 3.1; D.2.d; ERD + 12 DB tables.
   *Impact:* Added records do not survive a reload; the 3NF database design (Tables 3.19–3.30) is undemonstrated.

5. **Real authentication & security (NFR-02).**
   *Why:* System stores sensitive child health data; paper promises encrypted passwords, authentication, access control.
   *Where:* Ch3 D.2.b; DB 3.19.
   *Impact:* Security objective (Specific Objective 6) is unmet; major risk for a health-data system.

6. **Functional reminders/notifications (FR-11).**
   *Why:* Reminders for vaccines/checkups are a headline benefit in Ch1 and a Reminder table in Ch3.
   *Where:* Ch1 Scope §(5); Ch3 IPO Process d; DB 3.28.
   *Impact:* Currently cosmetic (static flags); the "reminder" value proposition is not actually delivered.

7. **Head circumference (FR-07) and structured Nutrition record (FR-09).**
   *Why:* Both are explicitly itemized in the IPO inputs and DB tables.
   *Where:* Tables 3.24, 3.26.
   *Impact:* Minor-to-moderate data-completeness gaps against the documented schema.

8. **Photo upload for Memories (FR-10).**
   *Why:* "Upload photos, captions and notes" is an explicit FR.
   *Where:* Ch3 D.1.f; DB 3.27.
   *Impact:* Memories are view-only; the "digital baby book / keepsake" function is not interactive.

---

## Part 4 — Extra Features (in app, not supported by Ch1–3)

| Feature | Classification | Reasoning |
|---|---|---|
| **Sleep tracking** (Dashboard) | **Feature to add to the research paper** | Useful for 0–6 infant care and consistent with the app's spirit, but no DB table or scope item exists for it. Either add to Scope + add a Sleep table, or remove. |
| **Temperature logging** (Dashboard) | **Feature to add to the research paper** | Reasonable health metric; currently unsupported by any requirement/entity. Document it or drop it. |
| **Multi-language EN / Filipino / Taglish** | **Beneficial Enhancement** | Strong fit for the Filipino/barangay context emphasized in Ch1–2; recommend adding a short Localization note to Scope so it is "in the record." |
| **Emergency hotlines (911 / Poison Control)** | **Beneficial Enhancement** | Safety value-add; align loosely with "health center info" but should be named in Scope. |
| **Premium / subscription upgrade plan** | **Unnecessary Feature (and inconsistent)** | Monetization contradicts the paper's framing as a parent-controlled, non-commercial recordkeeping tool, and gates "export" behind payment. **Remove before defense** or it invites questions about scope creep and equitable access. |
| **Workshops / parenting-event calendar** | **Beneficial Enhancement** | Community engagement; not in scope — add a one-line Scope mention if kept. |
| **Clinic ratings/distance finder** | **Beneficial Enhancement** | Extends "nearest health center info" (FR-13); acceptable, but ratings/geolocation go slightly beyond the documented feature. |
| **Vaccine "NCR stock" info** | **Unnecessary Feature** | Implies real-time supply data the system cannot source; risks misleading users. Reframe as generic vaccine education (FR-12) or remove. |

---

## Part 5 — Consistency Check

| Dimension | Consistent? | Finding |
|---|---|---|
| **Problem statement** | ⚠️ Partial | App addresses fragmented recordkeeping (✅) but **not** the "health-care worker access during consultation" problem (Specific Problem 3), since QR access is absent. |
| **Objectives** | ⚠️ Partial | Storage/organization objectives largely met in UI; **sharing (QR), security, and access-control objectives (Specific Obj. 5–6) unmet.** |
| **Scope & delimitations** | ❌ Inconsistent | QR module §(7) and Security/Audit §(8) not built; **Premium/monetization added** beyond scope; sleep/temperature beyond scope. |
| **Proposed system** | ⚠️ Partial | "Mobile application" delivered as Expo **web** build (Vercel); acceptable as prototype but not the store-published mobile app described. |
| **User roles** | ❌ Inconsistent | Paper: Parent/Guardian **and** Healthcare Professional. App: **Parent only.** |
| **Input / Output (IPO)** | ⚠️ Partial | Most inputs present; **QR access, access permissions, access logs, structured nutrition, head circumference** missing from inputs/outputs. |
| **Process flow** | ❌ Inconsistent | "Data validation," "QR-based access," and "security/privacy management" processes (Ch3 A.2) are not implemented; auth/validation are simulated. |
| **Methodology / tech stack** | ❌ Inconsistent | Table 3.1 mandates **Express JS + PostgreSQL**; app is **front-end only** with mock data. ERD/3NF design undemonstrated. |
| **Database entities** | ❌ Inconsistent | 12 tables defined (Users…Access Log). App has **no database**; mock data partially mirrors Child/Vaccination/Milestone/Memory but omits QR, Access Log, Nutrition, Checkup persistence; adds un-modeled Sleep/Temperature/Premium. |

---

## Part 6 — Research Compliance Score

| Dimension | Weight | Score | Notes |
|---|---:|---:|---|
| Functional Requirements Alignment | 30% | **55%** | Strong record-keeping UI; QR (FR-14–16) + Access Log (FR-17) missing; reminders/memory/nutrition partial; nothing truly persisted. |
| Objectives Alignment | 20% | **55%** | Organization/storage met; sharing, security, access-control objectives unmet. |
| Methodology Alignment | 20% | **40%** | IPO partially realized; mandated back-end/DB absent; QR & security processes missing. |
| Scope Alignment | 15% | **58%** | Many in-scope modules present; two scope modules missing; out-of-scope premium added. |
| Overall Consistency | 15% | **48%** | Title, user roles, tech stack, and DB design diverge from the build. |

**Weighted overall alignment ≈ 51 / 100.**

Interpretation: the application is a **well-designed front-end prototype of the recordkeeping half** of BabyBook+, but it is **not yet aligned** with the research paper because the **defining QR-consultation feature, the second user role, the back-end/database, and the security/audit layer are absent**, and the data is not persisted.

---

## Part 7 — Recommendations

### High Priority (required before defense)
1. **Implement the QR-Based Consultation Access module (FR-14–16).** At minimum: a parent screen to select records and generate a QR/code, and a healthcare-professional view that renders the selected, view-only records. This is the thesis's core claim — it must be demonstrable.
2. **Add the Healthcare Professional role** and its scan-to-view workflow so both actors in the Use-Case Diagram exist.
3. **Stand up real persistence (TR-01, NFR-04).** Implement the Express + PostgreSQL back-end (or, if time-constrained, a justified equivalent such as a documented Firebase/SQLite layer) so records survive reload and the ERD is demonstrated. **If you substitute the stack, update Table 3.1 to match.**
4. **Implement real authentication & basic security (NFR-02).** Real account creation, credential validation, hashed passwords, and gated access — the system holds minors' health data.
5. **Add the Access-Log/Audit capability (FR-17)** to evidence the privacy-by-design claim.
6. **Remove or relocate the Premium/subscription feature** (or add explicit scope justification); do not gate health-record exports behind payment.

### Medium Priority (should be improved)
7. **Make reminders functional (FR-11)** — schedule real local notifications for vaccines/checkups instead of static flags.
8. **Enable photo upload for Memories (FR-10)** via an image picker.
9. **Complete the documented data fields:** add **head circumference** (FR-07) and a **structured Nutrition record** (feeding type, food introduced, reactions — FR-09); add **hospitalization** as a medical-history category; expand the child-profile form to capture blood type, place/time of birth, hospital, OB-GYNE, pediatrician, emergency contact (FR-02/03).
10. **Reconcile platform claim:** either publish/demo as a mobile build (Expo Go) or soften Ch3 wording from "App Store / Play Store" to "deployable mobile prototype."

### Low Priority (optional, usability)
11. **Document the genuine enhancements** (multi-language, hotlines, workshops, clinic finder, sleep/temperature) by adding short Scope lines and, where data is stored, matching DB tables — this turns "extra features" into "supported features."
12. Reframe "Vaccine NCR Stock" as general vaccine education (FR-12) to avoid implying live supply data.
13. Add child-profile **delete** and confirmation dialogs for destructive actions.

---

## Final Summary

**Is the application sufficiently aligned with the research paper? — Not yet.** As supplied, BabyBook+ is a polished, well-structured **front-end prototype that realizes the recordkeeping and growth/health-tracking portions** of Chapters 1–3 (Usability and Maintainability are real strengths). However, it is built on **mock data with simulated authentication and no back-end**, and it **omits the features that define the thesis**: the parent-controlled **QR consultation access**, the **healthcare-professional role**, the **access log**, real **security/persistence**, and functional **reminders**. It also introduces **out-of-scope monetization** that conflicts with the paper.

**Must change before submission/defense:** (1) build a working QR consultation-access flow with the second user role, (2) provide real data persistence (back-end/DB matching — or update — Table 3.1), (3) implement genuine authentication/security and an access log, and (4) remove or justify the premium feature. With those four corrections the project would move from roughly **51%** alignment to defensible alignment with its own Chapters 1–3.

*Evaluation based solely on Chapters 1–3 of the provided PDF and the provided `front-end` source. Behaviors that depend on a running build (exact persistence at runtime, performance timings) are noted as Partial/Insufficient Evidence rather than assumed.*
