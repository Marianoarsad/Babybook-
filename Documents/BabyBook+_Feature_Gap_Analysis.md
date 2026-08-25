# BabyBook+ — Feature Gap Analysis for a 2026 Market Launch

**Date:** 14 August 2026
**Question this answers:** "What is BabyBook+ missing before it can sit next to apps people already pay for?"
**Method:** I read the actual code — dependencies, every component, the database schema, the API routes, and the theme system — rather than listing generic app features. Every claim below names the file it came from.

Read `BabyBook+_ROADMAP.md` first if you want the _sequence_. This document is the _content_: what to build. The roadmap says "Stage 2 — make it worth paying for." This document says what actually goes in Stage 2.

---

## Part 1 — What I checked

| Area            | How I checked it                                                                        |
| --------------- | --------------------------------------------------------------------------------------- |
| Dependencies    | `front-end/package.json` — 18 runtime packages                                          |
| Screens         | All 22 top-level components plus 9 settings screens, 10 UI primitives                   |
| Motion and feel | Searched every file for `Animated`, `Haptics`, `RefreshControl`, `KeyboardAvoidingView` |
| Accessibility   | Counted `accessibilityLabel` and `accessibilityRole` across the codebase                |
| Performance     | Searched for `FlatList`, `React.memo`, `useCallback`                                    |
| Data model      | `back-end/src/db/schema.sql` — 15 tables                                                |
| API surface     | All 29 routes across 7 route files                                                      |
| Theme           | `front-end/theme.js`, `context/ThemeContext.js`                                         |
| App config      | `front-end/app.json`                                                                    |

**Size for context:** the front-end is about 16,000 lines of JavaScript. This is not a toy. The gaps below are the gaps of a real app that hasn't been through a commercial hardening pass — not the gaps of an unfinished prototype.

---

## Part 2 — Using BabyBook+ as a parent in 2026

I walked the app the way a new user meets it. Each moment below is a place where a real person forms an opinion.

### Moment 1 — Finding the app

There is nothing to find. The app exists as a web build and an Android build you can side-load. There is no Google Play listing, no App Store listing, no landing page with screenshots, no reviews. In 2026 a parent looking for a baby health app searches the Play Store, reads three reviews, and installs. BabyBook+ is not in that flow at all.

### Moment 2 — First launch

`app.json` has `"splash": null`. There is no configured splash screen and no onboarding sequence anywhere in the codebase — I searched every file for "onboard" and found zero matches. A brand-new user lands on `Landing.js` and then a login form.

The problem: nobody has explained what the app is for. Every serious app in this category opens with three to five swipeable cards — "Track vaccines automatically," "Share with your doctor in one scan," "Your data stays yours" — because the first ninety seconds decide whether someone finishes signing up. You have genuinely good differentiators (the QR consultation flow, the DOH schedule that fills itself in, real encryption) and the app currently mentions none of them before asking for an email address.

### Moment 3 — Signing up

`auth.routes.js` has register, login, forgot-password, reset-password, and change-password. Solid basics. What's missing that a 2026 user expects:

- **No email verification.** The `users` table has no `email_verified` column. Anyone can register with an address they don't own — which matters because password reset goes to that address.
- **No "Sign in with Google."** For a consumer app this typically lifts sign-up completion by a large margin, and parents holding a baby in one hand strongly prefer it to typing a password.
- **No password strength meter.** The minimum is eight characters with no other rules.
- **No biometric unlock.** `expo-local-authentication` is not installed. An app holding a child's medical history should offer Face ID / fingerprint lock on open. Parents expect this from banking apps and now expect it everywhere sensitive.
- **The login token is stored in plain AsyncStorage** (`utils/storageAdapter.js`), not `expo-secure-store`. On a rooted or compromised device it's readable. This is both a security gap and a trust-story gap.

### Moment 4 — Adding the first baby

`EmptyChild.js` exists, and the DOH schedule auto-generating on child creation is genuinely excellent — that's the single best feature in the app and it's already done. But the moment after that is empty. There is no "here are the three things to do first" checklist, no sample data, no gentle nudge toward the first growth measurement. New users need a path, not a blank dashboard.

### Moment 5 — Everyday use

This is where the app feels dated, and it's mostly small things:

- **No pull-to-refresh anywhere.** Zero uses of `RefreshControl` in the entire codebase. Pulling down to refresh is muscle memory in 2026; when nothing happens the app feels broken.
- **No `KeyboardAvoidingView` anywhere.** On a real phone, tapping a text field near the bottom of a form means the keyboard covers the field you're typing into. This is the most likely single cause of someone abandoning a form.
- **Almost no haptics.** One file references them and `expo-haptics` isn't even installed. Every tap that saves something should have a light tap-back.
- **No screen transitions.** Screens swap instantly because navigation is a `currentView` state switch in `App.js`. There is no slide-in, no fade, no shared-element motion. Animation exists in only six files, mostly for the toast and the side menu.
- **No dark mode.** `theme.js` has girl, boy, and neutral palettes — all light. Meanwhile `app.json` declares `"userInterfaceStyle": "automatic"`, so the app tells the operating system it adapts and then doesn't. Parents use this app at 3am during night feeds. A white screen at 3am is genuinely unpleasant, and dark mode is a default expectation now, not a preference.
- **Alert boxes are invisible on web.** `Alert.alert` is used 27 times across `Health.js`, `Growth.js`, `EditProfile.js`, and `App.js` — but in `react-native-web` the `Alert` class is literally an empty function (I checked `node_modules/react-native-web/dist/exports/Alert/index.js`). On your live web demo, saving growth metrics gives no confirmation, and a failed save gives **no error message at all** — it fails silently. You already built `ui/Toast.js` to fix exactly this and it's used in 10 files; the remaining 27 calls just never got migrated.
- **Search exists in one place only.** `Health.js` has a search box. There is no global search across records, memories, or notes.

### Moment 6 — "Can my husband see this too?"

**He can't. This is the biggest product hole in the app.**

I checked the schema: `children` links to exactly one `user_id`, and there is no table anywhere for sharing a child between accounts. The QR share is deliberately temporary and read-only, designed for a doctor — it isn't a co-parent feature.

Every competitor in this category supports multiple caregivers per child, because childcare is not a single-person activity. In a Filipino context this is even more pronounced — grandparents, aunts, and yayas are routinely primary caregivers, and it's often the _lola_ who takes the baby to the health center. An app where only one person can log data will lose records constantly, and "my wife has all of it on her phone and she's at work" is a genuine reason to stop using it.

This is also, not coincidentally, a natural paid feature.

### Moment 7 — At the health center

The offline summary shortcut is there and works. The full offline mode is not. Already covered in the roadmap as Stage 2.

### Moment 8 — Paying

Nothing exists. No plan concept, no payment provider, no subscription table, no billing screens. Covered in the roadmap as Stage 3.

---

## Part 3 — The gaps, by category

Status key: ❌ missing entirely · ◑ partially there · ✅ done

### A. Onboarding and first-run

| Feature                                    | Status | Why it matters                                                | Effort |
| ------------------------------------------ | ------ | ------------------------------------------------------------- | ------ |
| Splash screen configured                   | ❌     | `app.json` splash is null. First impression is a blank frame. | 1 hr   |
| Welcome / value-proposition carousel       | ❌     | Nobody knows what the app does before signing up.             | 1 day  |
| Post-signup setup checklist                | ❌     | New users hit an empty dashboard with no next step.           | 1 day  |
| Feature spotlight on first use of a screen | ❌     | The QR share is your best feature and is undiscovered.        | 1 day  |
| App store listing with screenshots         | ❌     | There is no way to discover the app.                          | 3 days |

### B. Motion, feel, and polish

**Status update, 15 August 2026: this entire section is now done.** Two work
sessions closed every item below — the loading/skeleton/empty-state/refresh
sweep and the KeyboardAvoider/transitions/haptics pass first, then dark mode
and global search (the two items that needed real design decisions rather
than a mechanical fix, deferred to a second pass on purpose). Verified by
re-checking the codebase on 2026-08-15: zero real `Alert.alert` call sites
remain (the only match is the definition inside `ui/Toast.js` itself),
`RefreshControl` is wired through a shared `ui/useRefreshControl.js` hook
across 9 data-driven screens, `KeyboardAvoider` wraps every form-bearing
screen and modal (10 files), and `expo-haptics` is installed and used on
tab-bar navigation.

| Feature                                    | Status | Why it matters                                                  | Effort   |
| ------------------------------------------ | ------ | --------------------------------------------------------------- | -------- |
| Pull-to-refresh                            | ✅     | Universal gesture; its absence reads as broken.                 | Done     |
| Keyboard avoidance on forms                | ✅     | Keyboard covers inputs on real phones. Causes abandoned forms.  | Done     |
| Screen transitions                         | ✅     | Instant swaps feel like a website from 2015.                    | Done     |
| Haptic feedback on save/delete/tab         | ✅     | Free perceived quality. `expo-haptics`, one line per call site. | Done     |
| Dark mode                                  | ✅     | Night-feed use case. System/Light/Dark control in Theme Preferences, combines with the existing girl/boy/neutral palette axis. | Done |
| Replace remaining `Alert.alert` with Toast | ✅     | 27 calls fail silently on web, including error messages.        | Done     |
| Skeleton loaders                           | ✅     | Already built and used in 6 files. Good.                        | —        |
| Empty states                               | ✅     | `EmptyStateCard` now covers every list that can be empty, gated behind loading state. | Done |
| Global search                              | ✅     | Header icon opens a full-screen search across vaccinations, checkups, conditions, medications, hospitalizations, milestones, memories, and calendar events. Nutrition and Growth metrics deliberately excluded (nothing text-searchable to match). | Done |

### C. Product features a 2026 parent expects

| Feature                                      | Status | Why it matters                                                                                                                             | Effort   |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **Multiple caregivers per child**            | ❌     | **The single biggest gap.** Both parents, grandparents, yaya. Natural paid tier.                                                           | 4–5 days |
| Home screen widget (next vaccine, last feed) | ❌     | Widgets drive daily re-engagement more than notifications now.                                                                             | 3 days   |
| Photo backup and full gallery                | ◑      | Memories exist but there's no bulk backup or year-in-review.                                                                               | 2 days   |
| Sleep tracking                               | ❌     | Removed earlier by design. It's the #1 anxiety topic for 0–1yr parents and the most-used feature in competing apps.                        | 2 days   |
| Growth percentile sharing card               | ❌     | Parents screenshot and share milestones. Make it beautiful and it markets itself.                                                          | 1 day    |
| Multi-child comparison                       | ❌     | Parents of two want "was ate this big at this age?"                                                                                        | 1 day    |
| Apple Health / Google Fit sync               | ❌     | Expected by users with wearables and smart scales.                                                                                         | 3 days   |
| Medication dose reminders with tracking      | ◑      | Medications are recorded, but there's no "did you give the 2pm dose?" loop.                                                                | 2 days   |
| Symptom checker / when-to-worry guidance     | ❌     | High-value, high-liability. Needs medical review before shipping.                                                                          | Deferred |
| Content: age-appropriate tips                | ❌     | The old parenting tip box was removed as low-information. Real curated content per age keeps people opening the app between doctor visits. | Ongoing  |
| Notification inbox                           | ❌     | Notifications are fire-and-forget; a missed one is gone forever.                                                                           | 1 day    |

### D. Accessibility

| Feature                                    | Status | Notes                                                                                                                                               | Effort |
| ------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Screen-reader labels                       | ◑      | Genuinely decent — labels or roles in 26 files. Better than most capstones. Needs a real VoiceOver/TalkBack pass to confirm.                        | 2 days |
| Dynamic type / respecting system font size | ❌     | `responsive.js` scales by screen width, not by the user's chosen font size. A parent with low vision who set large text system-wide sees no change. | 2 days |
| Contrast audit                             | ❌     | The pink palette on small muted text is the known risk. Needs measuring against WCAG AA.                                                            | 1 day  |
| Reduced-motion support                     | ❌     | Needed once animations are added.                                                                                                                   | 2 hrs  |
| Minimum 44px touch targets                 | ◑      | `MIN_TOUCH` exists in the theme; adoption is not verified everywhere.                                                                               | 1 day  |
| Filipino language coverage                 | ◑      | `translations.js` has `en` and `fil`. Verify the Filipino side is complete and natural, not machine-translated.                                     | 1 day  |

### E. Performance

| Feature                        | Status | Why it matters                                                                                                                                                 | Effort |
| ------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Virtualized lists (`FlatList`) | ❌     | Zero uses. Every list is a `ScrollView` with `.map()`. The 10-item `ShowMore` cap hides this today, but a two-year-old's record set will make screens stutter. | 2 days |
| `React.memo` on list rows      | ❌     | Zero uses. Every state change re-renders whole screens.                                                                                                        | 1 day  |
| Image caching and optimization | ❌     | Plain `Image`, no `expo-image`. Photos re-download on every view — costly on mobile data.                                                                      | 1 day  |
| API response pagination        | ❌     | Routes return full record sets. Fine at 50 records, not at 5,000.                                                                                              | 2 days |
| Bundle size audit              | ❌     | Never measured.                                                                                                                                                | 4 hrs  |
| Over-the-air updates           | ❌     | `expo-updates` not configured. Every bug fix requires a full store review cycle — days instead of minutes. **For a live SaaS this is close to essential.**     | 4 hrs  |

### F. Security and trust

Section 5 of the critical evaluation covers the server-side defects. These are the _user-facing_ trust gaps.

| Feature                                  | Status | Why it matters                                                                                     | Effort |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- | ------ |
| Biometric app lock                       | ❌     | Medical data on a phone that gets handed to a toddler.                                             | 1 day  |
| Token in secure storage                  | ❌     | Currently plain AsyncStorage / localStorage.                                                       | 4 hrs  |
| Email verification                       | ❌     | Unverified addresses undermine password reset.                                                     | 1 day  |
| Two-factor authentication                | ❌     | Increasingly expected for health data.                                                             | 2 days |
| Active sessions list with remote logout  | ❌     | "Which devices are signed in?" is a standard trust screen.                                         | 1 day  |
| Auto-lock after inactivity               | ❌     | Standard for health apps.                                                                          | 4 hrs  |
| Screenshot blocking on sensitive screens | ❌     | Optional; some health apps do it. Debatable value.                                                 | 2 hrs  |
| Privacy dashboard                        | ◑      | `PrivacySettings.js` exists. Extend it: what's stored, who accessed it, one-tap export and delete. | 1 day  |

### G. Payments and monetization

Nothing exists yet. In build order:

| Feature                                                                                                                                             | Effort        |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Choose the tier structure and price (decision, not code)                                                                                            | Thinking time |
| PayMongo or Xendit integration — GCash, Maya, cards                                                                                                 | 3–5 days      |
| Subscription tables, trial period, grace period on failed payment                                                                                   | 2–3 days      |
| Server-side feature gating (never client-side only)                                                                                                 | 2 days        |
| Paywall screens and upgrade prompts at the moment a limit is hit                                                                                    | 2 days        |
| Receipts, billing history, cancel flow                                                                                                              | 2 days        |
| Play Store / App Store in-app purchase compliance — **note: both stores require you to use their billing for digital subscriptions and take a cut** | 3 days        |

That last point matters and is easy to miss: if BabyBook+ ships on Google Play as a subscription app, Google generally requires Google Play Billing rather than GCash-direct. Check this before you build the payment integration, or you may build it twice.

### H. Back-end and platform maturity

| Feature                                   | Status | Why it matters                                                                                                               | Effort |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| API versioning (`/api/v1/`)               | ❌     | Once real users are on old app versions, you cannot change a response shape without breaking them. Cheap now, painful later. | 2 hrs  |
| Pagination on list endpoints              | ❌     | See performance.                                                                                                             | 2 days |
| Structured logging                        | ◑      | `morgan` only. No request IDs, no correlation.                                                                               | 4 hrs  |
| Error tracking (Sentry)                   | ❌     | No way to know the app is broken.                                                                                            | 3 hrs  |
| Product analytics                         | ❌     | No idea which features are used. You will be guessing about your own roadmap.                                                | 1 day  |
| Feature flags                             | ❌     | No way to dark-launch or kill a broken feature without a deploy.                                                             | 1 day  |
| Background job runner                     | ❌     | Needed for push reminders, retention emails, subscription renewals.                                                          | 2 days |
| Transactional email beyond password reset | ◑      | `nodemailer` exists but SMTP is currently disabled on Render Free. No welcome email, no receipts.                            | 1 day  |
| Soft deletes / undo                       | ❌     | Deletes are permanent and immediate. Someone will delete a year of records by accident.                                      | 1 day  |
| Database indexes review                   | ❌     | Never audited.                                                                                                               | 4 hrs  |
| Health checks beyond `/api/health`        | ◑      | Doesn't check the database.                                                                                                  | 1 hr   |

### I. Growth and retention

| Feature                                | Status | Why it matters                                              | Effort |
| -------------------------------------- | ------ | ----------------------------------------------------------- | ------ |
| Referral mechanism                     | ❌     | Parent-to-parent is your cheapest channel by a wide margin. | 2 days |
| In-app review prompt at a happy moment | ❌     | Store ratings decide install rates.                         | 2 hrs  |
| Re-engagement notifications            | ❌     | "Time for the 6-week vaccines" brings people back.          | 1 day  |
| Year-in-review / milestone recap       | ❌     | Highly shareable, and shares are free marketing.            | 2 days |
| Onboarding email sequence              | ❌     | Standard for reducing early churn.                          | 1 day  |

---

## Part 4 — What actually blocks launch

Everything above is real, but it is not all equally urgent. If I had to draw the line, these twelve items are what separate "a good capstone" from "a product a stranger will pay for."

**Tier 1 — the app feels broken or unsafe without these**

1. ~~Migrate the 27 remaining `Alert.alert` calls to Toast~~ — **done, 2026-08-15.**
2. ~~`KeyboardAvoidingView` on every form~~ — **done, 2026-08-15.**
3. ~~Pull-to-refresh on the main screens~~ — **done, 2026-08-15.**
4. Token in secure storage, plus biometric app lock
5. Email verification
6. Over-the-air updates configured — you cannot run a live service where every fix waits on store review

**Tier 2 — the product is incomplete without these**

7. Multiple caregivers per child
8. ~~Dark mode~~ — **done, 2026-08-15.**
9. Full offline mode (already Stage 2 in the roadmap)
10. Onboarding carousel and post-signup checklist

**Tier 3 — you cannot make money or learn anything without these**

11. Payments, subscriptions, and server-side gating
12. Error tracking and product analytics

**Rough total remaining: four to six weeks of focused work**, on top of the roadmap's Stage 1 security day. All of Section B (the "two days of feel work" — Toast migration, keyboard handling, pull-to-refresh, haptics, screen transitions, dark mode, global search) is complete as of 2026-08-15. What's left of Tier 1 — secure token storage plus biometric lock, email verification, and OTA updates — is the next highest-leverage push, since items 4–6 are the remaining pieces that make the app feel safe rather than just polished.

---

## Part 5 — What to deliberately skip

Laziness is a strategy. These are things that look important and are not, yet:

- **Symptom checker / medical advice.** High liability, needs clinical review, and it is not why anyone will install your app. Never ship this without a doctor's sign-off and a lawyer's disclaimer.
- **Social feed / community.** Every consumer app is tempted. It needs moderation, it invites child-safety problems, and it is a whole second product.
- **AI features for their own sake.** An "AI baby assistant" is a distraction until the vaccine schedule, offline mode, and co-parent sharing work. The one AI feature with a real case — auto-reading a paper vaccination card with the camera — is worth revisiting _after_ launch, because it attacks your genuine adoption barrier.
- **Wearable integrations, smart-scale sync.** Small addressable audience in your market.
- **Web app parity.** The web build is a great demo and a great desktop viewer. Do not spend weeks making it a full-featured second client. Mobile is the product.
- **Tablet-optimized layouts.** `responsive.js` already handles it adequately. Leave it.

---

## Part 6 — The honest summary

BabyBook+ is not missing features in the sense of being unfinished. The record-keeping, the QR consultation flow, the encryption, the consent architecture, and the auto-generated immunization schedule are all real, working, and in several cases better than what's in comparable commercial apps.

What it's missing is the layer that makes software feel like a _product_ rather than a _system_: the first ninety seconds, the small physical feedback of using it, the second person who also needs access, and the ability to charge for any of it.

Three things I'd fix first, in order — **the first is now done:**

1. ~~**Two days of feel work.** Toast migration, keyboard handling, pull-to-refresh, haptics, dark mode, global search.~~ **Done, 2026-08-15** (OTA updates was not part of this batch and is still open — see Part 4, Tier 1, item 6). The app no longer feels like a prototype on this axis.
2. **Co-parent access.** It's the one missing feature that will cause people to actively stop using the app, and it's a natural reason to pay.
3. **Onboarding.** You have genuinely strong differentiators and currently zero seconds are spent telling anyone about them.
