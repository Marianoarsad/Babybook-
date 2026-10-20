Baby Profile verification - 20 October 2026

Implemented compact Home overview and custom-state babyProfile screen using the existing root profiles/editor and child-scoped growth/medical caches.

Live Chrome checks:
- 390x844: actual selected profile, compact Home contents, View Profile, detail section order, global bar-chart/growth artwork, green and lavender raised items.
- More opens the existing action-glass Edit Profile menu without visible dimming. Edit opens the existing prefilled child editor. Back cancels and returns to the same profile. No saved records or photos were changed.
- Home direct-tap roundtrip restored exact card top: 175.8000030517578 before and after Back. Layout readiness prevents early clamping during nested-card measurement.
- Fictional fixtures at 320x800: long name, long hospital/provider values, complete phone numbers, independently dated partial measurements. Checked no horizontal overflow in all profile sections/metrics after refinements.
- Fictional empty and dark states: truthful missing-value dashes, no allergy/hereditary records wording, no fallback birth measurements/photo.
- Fictional 768x1024: large left photograph with name/age, right View Profile button and three metric columns; no overflow.

Checks passed: BabyProfileCard, BabyProfileNavigation, HeaderNavigation, babyProfile selectors, adapters, cacheNavigation, cardPalette, homeCards, recordActions, theme (39 assertions); final web export and diff whitespace check passed.
Navigation tests execute actual App handlers with in-memory profiles: exact IDs, successful saves, cancel/failure, partial photo-upload failure, two-baby/session changes, late results and layout-gated single-use scroll restoration. Rendering checks cover six palettes and large font scales.

Limits: no native emulator/app surface was available (computer inventory apps=[]). Native rendering/photo-picker and OS text scaling were not verified live. Real profile/photo writes were intentionally not performed; saves and failures used disposable memory fixtures. No quantitative animation/performance measurements.
Temporary fictional entry/server were removed and the owned server stopped. Existing development server was left running.
