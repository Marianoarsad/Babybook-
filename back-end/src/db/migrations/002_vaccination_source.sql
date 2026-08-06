-- Additive: distinguish auto-generated DOH EPI schedule doses from
-- parent-added vaccinations, so the frontend can show an "EPI" chip.
-- Not writable via the generic vaccinations CRUD resource (not in its
-- writable columns list) — only epiGenerator.js sets it.
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'epi'));
