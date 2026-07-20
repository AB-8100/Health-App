import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ACTIVITY_TYPES } from './GymPlanScreens';

// ACTIVITY_TYPES.refName and supabase/seeds/forma_seed_data.json are two
// independently-maintained sources of the same activity names — a typo or a
// seed-data rename in one without the other silently degrades the quick-add
// picker's session back to the generic tier-4 fallback (no crash, just a
// quiet loss of the "moderate by default" behaviour). This guards against
// that drift.
const seedPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../supabase/seeds/forma_seed_data.json'
);
const seedActivityNames = new Set(
  JSON.parse(readFileSync(seedPath, 'utf-8')).activities.map(a => a.name)
);

describe('ACTIVITY_TYPES.refName consistency with seeded ref_activities', () => {
  it('every configured refName matches a real seeded ref_activities row', () => {
    const withRefName = ACTIVITY_TYPES.filter(a => a.refName);
    expect(withRefName.length).toBeGreaterThan(0);
    withRefName.forEach(a => {
      expect(seedActivityNames.has(a.refName), `"${a.refName}" (for ACTIVITY_TYPES id "${a.id}") not found in seed data`).toBe(true);
    });
  });

  it('quick-add defaults resolve to the moderate/medium variant, not easy or hard', () => {
    const seedData = JSON.parse(readFileSync(seedPath, 'utf-8'));
    const byName = Object.fromEntries(seedData.activities.map(a => [a.name, a]));
    ACTIVITY_TYPES.filter(a => a.refName).forEach(a => {
      expect(byName[a.refName].intensity_default).toBe('medium');
    });
  });
});
