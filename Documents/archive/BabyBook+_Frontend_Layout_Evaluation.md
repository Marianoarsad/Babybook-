# BabyBook+ Frontend Information Architecture — Evaluation (Phase 1 & 2)

> Scope note: this document is analysis only. No component, stylesheet, or navigation code was
> modified while producing it. Every claim below was checked against the actual code in
> `front-end/App.js`, `front-end/components/**`, `front-end/translations.js`, and
> `front-end/context/**` — not against `CLAUDE.md`'s description of what was built. Where the two
> disagree, that disagreement is called out explicitly (see §1, finding 3).

---

## 1. Executive summary

1. **Nutrition is genuinely under-exposed.** It has no bottom-nav or default-tab presence at all — its only direct shortcuts are two Dashboard quick-action tiles ("Log Milk", "Log Food"), and without them it takes a bottom-nav tap plus a sub-tab tap (Growth → Nutrition) to reach, one tap deeper than every other Growth sub-feature's fallback path.
2. **The "over-exposed" hypothesis is mostly an artifact of double-counting, not real duplication.** Health Records and the Growth Milestones checklist each have exactly one Dashboard quick-action shortcut that lands on the *same default tab* the bottom-nav button already opens — that's a redundant tile, not three independent paths to the same content. Separately, "Milestone Memories" on the Dashboard and "Milestones" under Growth are two different data types (`memories` vs `milestones` records) that only look like the same feature because they share a word.
3. **CLAUDE.md claims a Dashboard "Upcoming Appointments" widget with a "View Calendar" shortcut exists (§8, §9) — it does not.** A full read of `Dashboard.js` and a repo-wide grep for `Upcoming`/`View Calendar`/`onChangeView("calendar")` found no such widget anywhere in `front-end/`. Calendar's only entry point is the bottom-nav tab itself.

---

## 2. Current-state audit

### 2.1 Entry-point inventory

"Entry point" = a distinct tap path from somewhere in the app (bottom nav, side menu, quick action, in-screen card/button, or pre-login screen) that lands the user on a given feature. Landing on the *same* screen state via two different taps counts as two entry points even if the destination is identical — that redundancy is itself part of what the audit was asked to measure.

| # | Feature | Entry points (count) | Citations |
|---|---|---|---|
| 1 | Dashboard | 1 (bottom nav, also default `currentView`) | `App.js:114`, `App.js:705`, `App.js:605-622` |
| 2 | Health / Vaccines (default sub-tab) | 2 | bottom nav `App.js:706,623-638`; Dashboard "Medical" quick action `Dashboard.js:231` |
| 3 | Health / Rx Meds | 1 | in-screen sub-tab only `Health.js:520-536,703-752` |
| 4 | Health / Conditions (Illness, Hospitalization, Allergies) | 1 | in-screen sub-tab only `Health.js:537-553,754-878` |
| 5 | Growth / Milestones checklist (default sub-tab) | 2 | bottom nav `App.js:707,639-656`; Dashboard "Milestone" quick action `Dashboard.js:232` |
| 6 | Growth / Physical Metrics | 1 | in-screen sub-tab only `Growth.js:369-387,542-615` |
| 7 | Growth / Nutrition (`NutritionTracker`) | 2 (+1 indirect) | Dashboard "Log Milk" `Dashboard.js:229`; Dashboard "Log Food" `Dashboard.js:230`; indirect via Growth tab → Nutrition sub-tab `Growth.js:388-405,618` |
| 8 | Growth / Checkups | 1 | in-screen sub-tab only `Growth.js:406-424,620-678` |
| 9 | Services (hotlines, bulletin, clinics) | 1 | bottom nav only `App.js:708,657` |
| 10 | Calendar (aggregated view) | 1 | bottom nav only `App.js:709,658` |
| 11 | Calendar custom event (create) | 1 | in-screen "+" button `CalendarView.js:323-330` |
| 12 | Photo Memories gallery (Dashboard) | 1 | Dashboard "Add" pill `Dashboard.js:336-344` |
| 13 | QR Share / Consultation code | 1 (always-visible header icon) | `App.js:574-589` |
| 14 | Healthcare Professional portal | 2 (both pre-login) | Landing footer link `Landing.js:252-261`; Auth login-scene button `Auth.js:216-221` |
| 15 | Side menu (opens the drawer) | 1 (always-visible header avatar) | `App.js:590-599` |
| 16 | View Profile (guardian) | 1 | side menu `SideMenu.js:24`, `App.js:668-675` |
| 17 | Edit Profile (guardian) | 2 | side menu `SideMenu.js:25`; ViewProfile's own "Edit Profile" button `ViewProfile.js:55-58` |
| 18 | Edit Child Profile (modal, distinct from #17) | 1 | Dashboard summary-card pencil `Dashboard.js:291-298` → `App.js:438-459,926-1107` |
| 19 | Add Child Profile (modal) | 1 | Dashboard "Add" pill in baby switcher `Dashboard.js:276-279` → `App.js:462-469,740-923` |
| 20 | General Settings (reminder lead time) | 1 | side menu `SideMenu.js:31` |
| 21 | Theme Preferences | 1 | side menu `SideMenu.js:32` |
| 22 | Language Preferences | 1 | side menu `SideMenu.js:33` |
| 23 | Help & Support | 1 | side menu `SideMenu.js:39` |
| 24 | About BabyBook+ | 1 | side menu `SideMenu.js:40` |
| 25 | Change Password | 1 | side menu `SideMenu.js:46` |
| 26 | Privacy Settings (consent, export, withdraw) | 1 | side menu `SideMenu.js:47` |
| 27 | Export records as PDF | 2 (different scope each) | Health tab, all-categories one-tap `Health.js:488-499`; Privacy Settings, per-category picker `PrivacySettings.js:119-161` |
| 28 | Annual re-consent modal | 1 (system-triggered, not a nav path) | `App.js:1110-1153`, triggered by `consentDue` state |

No feature in the app has **3 or more genuinely distinct** entry points — see §2.3.

### 2.2 Tap-depth map

Measured from a warm app open (already logged in, landing on Dashboard) to the *primary action completing* (a Save/Add/Generate tap), not just opening the screen. Where a quick action and a bottom-nav path both exist, the shorter is listed first.

| Feature | Fastest path | Taps | Fallback path | Taps |
|---|---|---|---|---|
| Log Milk / Log Food | Dashboard quick action → Add → Save | 3 | Growth tab → Nutrition sub-tab → Add → Save | 4 |
| Toggle a Milestone done | Dashboard "Milestone" quick action → tap checkbox | 2 | Growth tab (default) → tap checkbox | 2 |
| Add Vaccination | Dashboard "Medical" quick action → Add → (photo) → Save | 3 | Health tab (default) → Add → Save | 3 |
| Add Photo Memory | Dashboard → Add pill → Save | 2 | — (single path) | — |
| Add Medication | Health tab → Rx Meds → Add Rx → (photo) → Save | 4 | — (single path) | — |
| Add Illness / Condition | Health tab → Conditions → Add Log → (photo) → Save | 4 | — (single path) | — |
| Add Hospitalization | Health tab → Conditions → Add → (photo) → Save | 4 | — (single path) | — |
| Add Allergy | Health tab → Conditions → type + Add (inline, no modal) | 2 | — (single path) | — |
| Add Growth Metrics | Growth tab → Growth sub-tab → Add → Save | 4 | — (single path) | — |
| Add Checkup/Appointment | Growth tab → Checkups → Add Appt → (photo) → Schedule | 4 | — (single path) | — |
| Add Calendar custom event | Calendar tab → "+" → Add | 3 | — (single path) | — |
| Generate QR share | Header QR icon → Generate (defaults preselect all records) | 2 | — (single path) | — |
| Change Password | Avatar → Change Password → Update Password | 3 | — (single path) | — |
| Edit Guardian Profile | Avatar → Edit Profile → Save Changes | 3 | Avatar → View Profile → Edit Profile → Save Changes | 4 |
| Withdraw consent / delete account | Avatar → Privacy Settings → Withdraw → confirm delete | 4 | — (deliberately gated) | — |
| Export PDF (all categories) | Health tab → Export records as PDF | 2 | Avatar → Privacy Settings → select categories → Export | 3 |
| Professional: view records | Landing/Auth "Healthcare Professional Access" → enter code → View Records | 2 | — | — |

Reading this table against §2.1: **every record type that requires a mandatory supporting photo (vaccination-completion, illness, medication, hospitalization, checkup) sits at 3-4 taps**, and three of those five (Medications, Illnesses, Checkups) have no shortcut at all — compare to Nutrition and Milestones, which both benefit from a Dashboard quick action even though Nutrition's underlying screen is nested one tab deeper than Milestones'.

### 2.3 Redundancy analysis

Three features have a second entry point (Health/Vaccines, Growth/Milestones, Edit Profile, PDF Export) — no feature has three or more.

- **Health/Vaccines** (Dashboard "Medical" quick action vs. bottom-nav Health tab): **wasteful, not distinct.** Both land on the exact same default state (`Health.js:54` initializes `activeTab` to `"immunizations"`, and the quick action's `initialTab` request (`Dashboard.js:231`) targets that same tab). The quick action adds a second way to do something the bottom nav already does in one tap, for zero incremental reach.
- **Growth/Milestones** (Dashboard "Milestone" quick action vs. bottom-nav Growth tab): **same pattern, same verdict — wasteful.** `Growth.js:111` defaults `growthTab` to `"milestones"`; the quick action (`Dashboard.js:232`) requests that identical tab.
- **Edit Profile** (side menu vs. via View Profile's edit button): **distinct context, not wasteful.** View Profile is a read-only summary that a user might land on first (e.g., checking their own email) and then decide to edit — the extra "Edit Profile" button there is a legitimate shortcut from a related screen, not a duplicate top-level path.
- **PDF Export** (Health tab vs. Privacy Settings): **distinct context, not wasteful.** The Health tab version is a fast "just get me everything" action; the Privacy Settings version lets the user pick categories (`PrivacySettings.js:23-48`). Different intents, deliberately placed near different mental contexts (clinical records vs. data-control).

Compare this to Nutrition and Log Milk/Log Food (§2.1 #7): those two quick actions are **not** redundant with each other or with a bottom-nav default, because neither lands on an otherwise-default tab — Nutrition is the 3rd of 4 Growth sub-tabs and is never the default. That is the one place in the app where a "3rd path" would genuinely add reach rather than just duplicate a one-tap action — and it doesn't exist; Nutrition tops out at 2 entry points, both already spent on the same underexposed feature.

### 2.4 Screen density (five bottom-nav tabs, 375px-wide viewport)

| Screen | Stacked sections (top to bottom) | Likely below the fold |
|---|---|---|
| **Dashboard** (`Dashboard.js:245-474`) | Greeting hero → horizontal baby-switcher → baby summary card (avatar + 2×2 meta grid) → Quick Actions 2×2 grid → Milestone Memories 2-col photo gallery (up to 6) → Recent Activity list (up to 5) → Parenting Tip card | Memories gallery, Recent Activity, and the Parenting Tip card — the first four sections alone (hero + switcher + summary + quick actions) typically fill a 375×812 first viewport. |
| **Health** (`Health.js:468-1126`) | Care Team banner → optional "Export as PDF" button → 3-way tab switcher → **Vaccines tab**: optional "Generate schedule" + Add → vaccines grouped by EPI visit (up to ~13 doses) → NCR vaccine-stock alert card | Most of the EPI dose list and the entire stock-alert card, on a child with a populated schedule. |
| **Growth** (`Growth.js:346-825`) | 4-way tab switcher → **Milestones tab**: age-group selector (3 buttons) → Development Checklist card → Memories list | Memories list, and on Nutrition/Checkups tabs the entire analytics chart + entry list is off-screen at first paint. |
| **Services** (`Services.js:31-160`) | Header → Emergency Hotlines (2-col grid) → Barangay Bulletin (3 static entries from `mockData.js`) → Nearby Clinics (3 static entries) | Nearby Clinics section, on most devices. Lightest of the five screens — entirely static/mock content, no user data. |
| **Calendar** (`CalendarView.js:304-493`) | Switcher row (Monthly/Weekly/Daily/Today/+) → calendar widget (Month grid ≈ 300-350px / Week strip / Day nav) → selected-day event list | Event list on days with several events; otherwise reasonably scoped per view. |

Health and Growth are the two heaviest screens — both combine a multi-way tab switcher with per-tab lists that can run long (EPI schedule; nutrition chart + paginated entries).

### 2.5 Orphans and dead ends

- **`reminders` has no dedicated UI at all.** It's a real record type in the data model (`CLAUDE.md` §5, `back-end/src/db/schema.sql`), created automatically alongside vaccinations/checkups (`Health.js:270-278`, `Growth.js:327-335`) and consumed only to schedule local notifications and to *not* duplicate calendar dots (`CalendarView.js:47-50`, explicit comment: "Reminders aren't fetched separately… showing both would just duplicate the same event twice"). A parent can never browse "my reminders" as a list — they only ever see the vaccination/checkup a reminder is attached to.
- **The CLAUDE.md-claimed Dashboard "Upcoming Appointments" widget and "View Calendar" shortcut do not exist in code** (confirmed by full read of `Dashboard.js` plus a repo-wide grep for `Upcoming`, `View Calendar`, `onChangeView("calendar")` — the only hits are unrelated translation strings and the vaccine-reminder scheduler). `CLAUDE.md` §8/§9 describe this as shipped; it is not. Calendar's sole entry point is the bottom-nav tab (`App.js:709`).
- **Two different "Edit Profile" concepts share a name.** `EditProfile.js` (side menu) edits the **guardian's** account; the Dashboard pencil icon (`Dashboard.js:291-298`) opens a **child**-profile edit modal (`App.js:926-1107`). The app's own `HelpSupport.js:22-24` FAQ already disambiguates this correctly in its copy, so it's a latent confusion risk rather than an active bug — worth keeping in mind for any relabeling.
- **"Milestone Memories" (Dashboard) and "Milestones" (Growth) are different data**, not a shared feature under two names. The Dashboard section reads the `memories` record type (`Dashboard.js:181`, photo diary); the Growth tab's "Milestones" reads the `milestones` record type (`Growth.js:131`, developmental checklist). Both happen to render through the same `MemoryDetail.js` component, which reinforces the visual impression that they're the same feature.
- **Medications, Illnesses/Conditions, Physical Metrics, and Checkups are all single-path, quick-action-free**, despite three of the four requiring a mandatory supporting photo — the highest-friction record types in the app currently get zero navigational shortcut.

---

## 3. Verdict on the two starting hypotheses

### Hypothesis 1 — Nutrition Tracking is under-exposed: **CONFIRMED**

Nutrition has no bottom-nav presence and is not any tab's default state — it's the 3rd of 4 sub-tabs under Growth, whose own default is Milestones. Its only direct shortcuts are the two Dashboard quick actions (`Dashboard.js:229-230`); without them, reaching it costs one more tap than every comparably-frequent feature that does get a default-tab or quick-action shortcut. Given that feeding is typically a multiple-times-daily activity across the entire 0-6 age range (more so than vaccination or checkup logging, which are episodic), the current placement under-serves its expected use frequency. This is the one place in the audit where the app is one entry point short of where a "3rd path" would actually add reach, rather than merely duplicate one.

### Hypothesis 2 — Health Records and Milestones are over-exposed: **REFUTED as stated; a real but different issue underneath**

Neither has three or more entry points, and neither has genuine duplication of *content* — both have exactly one quick action that mirrors the bottom-nav tab's already-default landing state (§2.3). That's a **redundant tile**, not overexposure: the Dashboard "Medical" and "Milestone" quick actions currently spend two of the four available Quick Action slots (`Dashboard.js:228-233`) on shortcuts that save the user zero net taps over just tapping the corresponding bottom-nav icon.

Separately, the "Milestones" naming appears twice in the app for two unrelated data types (§2.5), which likely produced the appearance of over-exposure without it being true duplication — worth fixing as a clarity issue, not a navigation-reach issue.

**Net effect for Phase 3 to design against:** two of the Dashboard's four Quick Action slots are currently low-value (Medical, Milestone — both redundant with a one-tap bottom-nav default), while the two slots that *do* need to exist (Log Milk, Log Food) are covering for a genuinely under-exposed destination. That's a strong, evidence-backed case for re-pointing the two redundant slots rather than adding new UI surface.

---

## 4. Feature inventory awaiting your ranking

Please rank the list below by how often you expect a parent to actually use each one — a rough tier ranking (e.g. "several times a day / weekly / monthly / rarely") is enough, and you're welcome to note anything I've mis-estimated. My own suggested starting ranking (by caregiving-frequency reasoning, **not** usage data — the app has none) is included as a default you should correct rather than accept:

| # | Feature | Entry points | Fastest tap-depth | My suggested frequency (correct me) |
|---|---|---|---|---|
| 1 | Log Milk / Log Food (Nutrition) | 2 | 3 | Multiple times/day (ages 0-2 esp.) |
| 2 | Photo Memories | 1 | 2 | Weekly-ish, bursty around milestones |
| 3 | Toggle a Milestone done | 2 | 2 | Occasional, clustered by age stage |
| 4 | Calendar (view) | 1 | 0-1 | Weekly, appointment-driven |
| 5 | Add Vaccination | 2 | 3 | Episodic, clustered around EPI schedule visits |
| 6 | Add Checkup/Appointment | 1 | 4 | Monthly-ish |
| 7 | Add Medication | 1 | 4 | Episodic, illness-driven |
| 8 | Add Illness / Condition | 1 | 4 | Episodic, illness-driven |
| 9 | Add Allergy | 1 | 2 | Rare, mostly set-once |
| 10 | Add Hospitalization | 1 | 4 | Rare |
| 11 | Add Growth Metrics | 1 | 4 | Monthly-ish (clinic-visit driven) |
| 12 | Add Calendar custom event | 1 | 3 | Occasional |
| 13 | Generate QR Share | 1 | 2 | Rare, consultation-driven |
| 14 | Services (hotlines/bulletin/clinics) | 1 | — (view-only) | Rare, reference-only |
| 15 | Guardian profile / settings / password / privacy (all side-menu) | 1 each | 2-4 | Rare, set-once or emergency-only |
| 16 | Healthcare Professional portal | 2 | 2 | Rare, different actor entirely |

Once you've corrected this ranking, I'll move to Phase 3: layout proposals (conservative + ambitious) designed to make exposure match what you tell me here, with file-level costs and explicit handling of the QR share flow, consent/DPA screens, and the professional portal.
