Nutrition bar theme verification

Boy/neutral: existing accent-primary blue for ordinary bars; primary-primaryDark latest bar in light mode, primaryDark-primary in dark. Girl: existing pink gradients unchanged. Only nutritionSurface.bar/latestBar differ.

Passed: NutritionVisuals rendering/motion checks including actual Milk/Food SVG stops across all six palettes, NutritionTrendChart (28 checks), theme (39 checks), and web export.
Chrome fixtures: 390x844 Boy/Girl light; 320x800 Boy/Girl dark; 430x932 final Boy light capture. Both Milk and Food visibly use the correct ramps. Read-only SVG comparison found identical geometry when switching Boy to Girl. Long-range dark line strokes remain the existing pink #F29AC4. No saved feeding data or theme preferences were changed.

Proof: nutrition-boy-blue-bars.png and nutrition-girl-pink-bars.png. Temporary fixture entry/server removed; only the owned server was stopped. Viewport override reset and review tab closed. Native verification unavailable because native computer APIs are disabled; no native rendering or quantitative animation timing is claimed.
