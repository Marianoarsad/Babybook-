# BabyBook+ — Research-to-Application Alignment Evaluation

**Evaluator role:** Senior Systems Analyst · Software QA Engineer · Research Evaluator
**Research document:** *BabyBook+: A Digital Child Health & Development Recordkeeping System with Parent-Controlled QR-Based Consultation Access* (`printable_1_column_capstone_project_1.docx`, Chapters 1–3, ~8,400 words)
**Application version:** Current repository (Expo/React Native front-end + Express/PostgreSQL back-end, deployed on Railway) as of 2026-07-03
**Method:** Requirements extracted from the paper's *Scope & Limitations* (8 modules), *In-Scope Features*, and *Functional Requirements*, then traced against source code and the database schema. Every status below cites observable evidence; where evidence is absent, that is stated rather than assumed.

---

## 1. Overall Alignment Score

### Overall Alignment: **90% — Good Alignment with Minor Revisions**

All eight modules defined in the research are present and functional in the application, and the system correctly respects every out-of-scope boundary (no diagnosis, prescriptions, telemedicine, EMR integration, or government analytics). The data model (16 tables) is a faithful, normalized expansion of the Chapter 3 ERD. The score is held below the mid-90s by a small number of concrete gaps: one specified functional requirement is genuinely missing (per-record supporting-document upload), a few child-profile fields specified in the IPO "Input" are not captured by the entry form, the *Information* portion of the Reminder module is served from static local data rather than a live source, and the app ships several trackers (sleep, temperature) that are not mentioned anywhere in the research and should either be documented or removed. None of these are architectural; all are closeable with minor revisions.

---

## 2. Feature Comparison Table

| # | Research Requirement | Current App Implementation | Status | Notes / Evidence |
|---|----------------------|----------------------------|--------|------------------|
| **Module 1 — User Management** ||||
| 1.1 | Registration | Email/password register endpoint + Auth screen | ✅ Fully | `auth.routes` register; `users` table |
| 1.2 | Secure authentication | JWT tokens + bcrypt hashing; login/logout | ✅ Fully | `jwt.js`, `middleware/auth.js`; `password_hash` |
| 1.3 | Profile management (parent) | UserProfile screen: name, gender, avatar; `updateMe` | ✅ Fully | `UserProfile.js`; `users.avatar_url/gender` |
| **Module 2 — Child Profile Management** ||||
| 2.1 | Create/manage child profiles | Add/Edit child modals; full CRUD | ✅ Fully | `children` table; `children.routes` |
| 2.2 | Capture birth information | Name, DOB, sex, blood type, birth weight/length, hospital captured | 🟡 Partial | Form omits **place of birth**, **time of birth**, **nickname** (schema has place/time cols; nickname exists in neither) — `App.js` Add/Edit modal |
| 2.3 | Hospital, OB-GYNE, pediatrician, health center, emergency contact | Hospital, OB-GYNE, pediatrician, emergency contact captured | 🟡 Partial | **Preferred health center** column exists (`children.preferred_health_center`) but is **not** in the entry form |
| **Module 3 — Health Records** ||||
| 3.1 | Immunization / vaccination history | Vaccination list (scheduled vs. completed), add-vaccine modal | ✅ Fully | `vaccinations` table; `Health.js` |
| 3.2 | Illnesses & medical history | Pediatric Conditions & Illnesses section | ✅ Fully | `medical_history` (category `Illness`); `Health.js` |
| 3.3 | Allergies & hereditary conditions | Allergies & Sensitivities section + child arrays | ✅ Fully | `medical_history` + `children.allergies/hereditary_conditions` |
| 3.4 | Hospitalizations | Hospitalizations section | ✅ Fully | `medical_history` (category `Hospitalization`) |
| 3.5 | Medications & treatments | Medications section + medication reminders | ✅ Fully | `medical_history` (category `Medication`) |
| 3.6 | Checkup / consultation records | Checkups/appointments in Growth screen | ✅ Fully | `checkups` table |
| 3.7 | **Upload supporting documents per record** (stickers, prescriptions) — *FR-c* | No attachment mechanism on any health record | ❌ Missing | No document column/table on `vaccinations`/`medical_history`/`checkups`; only `memories` & `milestones` hold photos, not linked to a specific record |
| **Module 4 — Growth & Development Monitoring** ||||
| 4.1 | Growth (height, weight, age, **head circumference**) | Growth metrics incl. head circumference | ✅ Fully | `growth_records.head_circumference`; `Growth.js` L215 |
| 4.2 | Developmental milestones | Milestones with completion + photo | ✅ Fully | `milestones` table |
| 4.3 | Nutrition (milk & solid food) | Feeding type, food introduced, reaction, notes | 🟡 Partial | Research "Input" also lists **food preferences** & **feeding schedule** — no dedicated fields; milk intake lives in `feed_logs` (daily tracker) |
| **Module 5 — Reminder & Information** ||||
| 5.1 | Reminders for vaccinations & checkups | Local notifications scheduled on record save | 🟡 Partial | `utils/notifications.js` (`scheduleReminder`); `reminders` table. Device-local only (no server push); depends on `expo-notifications` install — consistent with paper's stated internet/tech dependency |
| 5.2 | Vaccination info & educational materials | "Vaccine NCR Stock" + limited info blocks | 🟡 Partial | `Health.js` info sections; educational content is thin |
| 5.3 | Nearest health center information | Clinics directory with city selector | 🟡 Partial | `Services.js` uses static `mockData.initialClinics`, not a live source |
| 5.4 | Health center announcements (if available) | Updates/announcements feed | 🟡 Partial | `Services.js` static `mockData.initialUpdates`; paper qualifies this "if available" |
| **Module 6 — Memory & Documentation** ||||
| 6.1 | Photo storage & organization (photos, captions, milestones, notes) | Photo Memories + milestone photos | ✅ Fully | `memories` table + upload; `milestones.photo_url` |
| **Module 7 — QR-Based Consultation Access** ||||
| 7.1 | QR codes for parent-authorized access | Dependency-free QR generator; share records | ✅ Fully | `utils/qrcode.js`; `shared_records`; `share.routes` |
| 7.2 | View-only select records for professionals | Public resolve returns a read-only snapshot; Professional view screen | ✅ Fully | `consult.routes` `/resolve` (no write paths); `ProfessionalView.js` |
| 7.3 | Parent permission control | Selective record keys, expiration, revoke | ✅ Fully | `shared_records.shared_record_keys`; revoke + expire in `share.routes` |
| **Module 8 — Security & Audit** ||||
| 8.1 | Record view monitoring / access logs | Every professional view is logged; parent can view log | ✅ Fully | `access_logs`; `consult.routes` INSERT; `share.routes` access-log GET |
| 8.2 | Data privacy / child info protection | Owner-scoped queries; JWT; selective sharing | ✅ Fully | `requireChildOwnership`; per-user scoping |
| 8.3 | Encrypted QR consultation tokens (NFR) | Opaque random code + server-side validation, expiry, revoke | 🟡 Partial | Functionally secure (short-lived, revocable, view-only, logged) but implemented as an opaque code + stored snapshot rather than a cryptographically signed/encrypted token |

**Legend:** ✅ Fully Implemented · 🟡 Partially Implemented · ❌ Missing · 🔄 Implemented Differently

---

## 3. Missing Features

### 3.1 Supporting-document upload per health record ❌ *(only clearly missing functional requirement)*
- **Research specification:** *Functional Requirement (c):* "Users can also upload supporting documents (e.g. vaccination stickers, prescription, etc.) to act as reference for each health record."
- **Current state:** The app supports photo uploads only for **Memories** and **Milestones** and a **child avatar**. Vaccination, medication, illness, hospitalization, and checkup records have **no** attachment field. There is no `documents`/`attachments` table.
- **Why it matters:** This is an explicitly documented FR and a real parent workflow (photographing a vaccination card sticker or a prescription). Its absence is the single most defensible "missing requirement" a panel could cite.
- **Recommendation:** Add a lightweight `record_attachments` table (`id, child_id, record_type, record_id, file_url, caption, created_at`) and reuse the existing `multer` upload middleware (already used for memories/avatars). Surface an "Attach photo/document" control on each add/edit health-record modal. Estimated effort: small, because upload infrastructure already exists.

*No other in-scope feature is entirely absent — the remaining shortfalls are partial (Section 5), not missing.*

---

## 4. Excess Features (present in app, not in the research)

| Feature | Purpose | Improves system? | Recommendation |
|---------|---------|------------------|----------------|
| **Sleep tracking** (timer + `sleep_logs`) | Log baby sleep sessions | Marginal for a *recordkeeping* system; more of a daily-care tracker | **Document in Ch. 3 or remove.** Not referenced anywhere in the paper |
| **Temperature / fever tracking** (`temperature_logs`, Dashboard) | Record body temperature readings | Useful during illness, but outside stated scope | **Document as an enhancement.** Not a BabyBook+ requirement, though the paper's *Related Systems* section notes Pediary tracks "health temperatures" — a citable precedent if kept |
| **Daily feed quick-log** (`feed_logs`, ml/grams) | Fast logging of individual feeds | Partially supports "milk intake" (an Input item) but at finer granularity than specified | **Keep as enhancement**; add one line in Ch. 3 Nutrition to cover it |
| **Emergency hotlines / 911 dialer** (Services) | One-tap emergency call | Helpful, safety-positive | **Keep**; briefly note under Reminder & Information module |
| **Bilingual English/Filipino toggle** | Localization for Filipino families | Strong fit with the stated target users & usability NFR | **Keep & document** — a genuine strength worth claiming |
| **Password reset via email** | Account recovery | Supports the "manage their accounts" FR | **Keep & document** under User Management |
| **Parent avatar upload** | Personalization of the parent account | Minor UX polish | **Keep**; no doc change needed |

> The database schema itself flags the daily trackers as *"beyond the paper's ERD (note in Ch.3 if adopted)"* — so this excess is already known internally and simply needs to be reconciled in the documentation.

**No excess feature conflicts with the research objectives or the out-of-scope list.** The app does **not** implement any prohibited capability (telemedicine, diagnosis, prescription issuance, treatment recommendation, EMR/government integration, LGU dashboards, population reporting, or auto-authentication) — full compliance with *Out-of-Scope Features (a–j)*.

---

## 5. Partially Implemented Features

**5.1 Child-profile data capture (Module 2)**
- *Research:* Input lists full name, **nickname**, DOB, sex, blood type, birth weight/length, **place of birth**, birth hospital; healthcare info includes **preferred health center**.
- *App:* Captures name, DOB, sex, blood type, weight, height, hospital, OB-GYNE, pediatrician, emergency contact. **Place of birth, preferred health center, time of birth are in the schema but not in the form; nickname is nowhere.**
- *Gap:* A few specified fields can't actually be entered by a user.
- *Fix:* Add these inputs to the Add/Edit child modal (columns already exist for most); add a `nickname` column if the panel considers it required.

**5.2 Nutrition detail (Module 4)**
- *Research:* nutrition input includes milk intake, solid-food introduction, **food preferences**, **feeding schedule**, reactions, notes.
- *App:* `nutrition_records` captures feeding type, food introduced, reaction, notes; milk intake sits in `feed_logs`.
- *Gap:* "Food preferences" and "feeding schedule" have no dedicated representation.
- *Fix:* Add optional `preferences` / `schedule` fields, or explicitly fold them into the notes field and document that decision.

**5.3 Reminder delivery (Module 5)**
- *Research:* "the system generates reminders and notifications … for upcoming visits."
- *App:* Schedules **local device notifications** via `expo-notifications` when a dated record is saved; a `reminders` table exists.
- *Gap:* No server-side/push scheduling; reminders only fire on the device that created them and require the library to be installed in the build. (The paper acknowledges notification features are internet/technology-dependent, so this is a soft gap.)
- *Fix:* For production, add server-side scheduled push (e.g., Expo push tokens) — otherwise document the local-notification approach as the delivery mechanism.

**5.4 Information & announcements (Module 5)**
- *Research:* nearest-health-center info and announcements (vaccination drives, advisories, "if available").
- *App:* Clinics and updates render from **static `mockData`**, not a live/administered source.
- *Gap:* Content is hard-coded rather than data-driven.
- *Fix:* Acceptable for a prototype given the "if available" qualifier; for full alignment, back these with a table or an admin-editable source and note the data provenance.

**5.5 QR token security (NFR — Security)**
- *Research:* "encrypted QR consultation tokens."
- *App:* Opaque unique code + server-side validation with expiry, revoke, and view logging; the shared snapshot is stored server-side.
- *Gap:* Security intent (temporary, revocable, view-only, auditable) is fully met, but the token is not cryptographically signed/encrypted per the literal wording.
- *Fix:* Either sign the QR payload (e.g., HMAC/JWT) to match the wording, or revise the NFR to describe the implemented opaque-code + server-validation model.

---

## 6. UI/UX Consistency

- **Navigation vs. workflow:** The five-tab structure (Dashboard, Health, Growth, Services, Settings) plus the QR/Share flow maps cleanly onto the research's module grouping and the Use-Case Diagram's two actors. Navigation follows the documented parent workflow. ✅
- **Roles & permissions:** Correctly implemented. Parents/guardians are the only account holders; healthcare professionals have **no account** and reach records only through the public QR resolve, which is strictly view-only and logged — exactly matching *System Coverage* and the *Limitations* ("will not allow external users to create, edit, or delete records"). ✅
- **Screens/forms/modules:** Each research module has a corresponding UI surface (health records, growth/nutrition, memories, services/reminders, QR share, professional view). Forms include client-side validation (e.g., temperature range, required fields) consistent with the *Process → Data Collection and Validation* step. ✅
- **Layout vs. proposed design:** The paper describes conceptual diagrams (IPO, use-case, activity, ERD) rather than pixel mockups, so screen-level visual fidelity **cannot be verified against a documented UI design** — insufficient evidence to judge layout match. The delivered UI is internally consistent (shared design tokens/components) and modernized beyond what the paper depicts. ℹ️
- **Inconsistencies found:** (a) child-profile form omits a few specified fields (5.1); (b) Services content is static; (c) reminders are device-local. None break navigation or roles.

---

## 7. Functional Consistency

- **Business processes:** Match the IPO model — inputs (profile, health, growth, nutrition, memories, account, system) → processes (validation, record management, monitoring, reminder processing, QR access, security) → outputs (digital baby book, professional view-only access, QR codes, reminders, access logs). ✅
- **Inputs/outputs:** Consistent with the documented Input and Output lists, with the noted exceptions (missing document upload; a few uncaptured profile fields). Outputs "consultation QR codes, reminder notifications, summary of child records, access logs" are all produced. ✅ / 🟡
- **Validation rules:** Implemented — `express-validator` on the server, required-field and range checks on the client (e.g., pediatric temperature 34–43 °C), ownership checks on every child-scoped route. ✅
- **Reports/analytics:** The research deliberately excludes analytics/dashboards (Out-of-Scope f, g, h). The app provides record summaries and an access log but no analytics — **correctly aligned by omission.** ✅
- **Security & access control:** JWT auth, bcrypt password hashing, per-user data scoping (`requireChildOwnership`), selective + expiring + revocable QR shares, and full access logging. Matches the *Security and Audit Module* and Security/Privacy NFRs. The only nuance is the "encrypted token" wording (5.5). ✅ / 🟡

---

## 8. Final Assessment

**Major strengths**
- All eight research modules are present and working; the QR-based, parent-controlled, view-only, logged consultation flow — the study's headline contribution — is implemented end-to-end and matches the spec precisely.
- Strong data model: a normalized 16-table schema that faithfully expands the Chapter 3 ERD, with constraints, cascades, and audit logging.
- Exemplary out-of-scope discipline — none of the prohibited capabilities exist, so there is no scope creep that conflicts with the research.
- Real deployment (Railway backend + installable Android build + web demo) demonstrates the "Availability" NFR.

**Major weaknesses**
- One specified functional requirement (per-record supporting-document upload) is missing.
- The *Information* half of the Reminder module is static mock data; reminders are device-local.
- Undocumented excess trackers (sleep, temperature) create a paper-vs-app mismatch.

**Missing critical requirements:** Supporting-document upload per health record (FR-c). This is the one item that rises to "should fix before final defense."

**Unnecessary implementations:** Sleep and temperature trackers (and, arguably, the granular feed log) — benign but undocumented; reconcile in Chapter 3 or remove.

**Suitability for deployment:** The application is **functionally suitable for prototype deployment and defense**. It satisfies the general objective and the substantial majority of specific objectives and functional requirements. To reach full alignment, address the document-upload FR, add the few missing profile fields, and reconcile the excess trackers in the documentation.

### Verdict: **Good Alignment with Minor Revisions (≈90%)**

**Priority revision checklist**
1. Implement per-record document/photo attachments (FR-c) — reuses existing upload code. *(highest impact)*
2. Add the uncaptured child-profile fields (place of birth, preferred health center, time of birth, and — if required — nickname).
3. Reconcile excess trackers (sleep, temperature, feed log) in Chapter 3, or remove them.
4. Document (or upgrade) the reminder-delivery and QR-token mechanisms so the paper's wording matches the implementation.
5. Optionally back Services (clinics/announcements) with real/administered data.

*Traceability note:* Every ✅/🟡/❌ above is grounded in a named source file, database table, or route. Items that could not be verified against a documented artifact (e.g., pixel-level UI design) are flagged as insufficient evidence rather than scored.
