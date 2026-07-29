import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ACTIVITY_TYPES, EX_LIB, getDefaultGymTemplate } from './GymPlanScreens';

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

// The seeded "gym"-category ref_activities names that are actual split-day
// names (see forma_seed_data.json) must resolve to a non-empty default
// template — otherwise starting one of these from the Session tab or Weekly
// Overview with nothing selected lands on an empty queue instead of a real
// workout. Other gym-category activities (e.g. "HIIT class") have no
// matching split day and are expected to fall through to [] — covered
// separately below.
describe('getDefaultGymTemplate', () => {
  const seedData = JSON.parse(readFileSync(seedPath, 'utf-8'));
  const splitDayGymNames = seedData.activities
    .filter(a => a.category === 'gym')
    .map(a => a.name)
    .filter(name => /push|pull|legs|upper|full body/i.test(name));

  it('every seeded split-day gym activity name resolves to a non-empty template of real exercise ids', () => {
    expect(splitDayGymNames.length).toBeGreaterThan(0);
    splitDayGymNames.forEach(name => {
      const ids = getDefaultGymTemplate(name);
      expect(ids.length, `expected "${name}" to resolve to a default template`).toBeGreaterThan(0);
      ids.forEach(id => {
        expect(EX_LIB[id], `"${id}" (from template for "${name}") is not a real EX_LIB exercise`).toBeTruthy();
      });
    });
  });

  it('is case-insensitive and matches on a substring of the label', () => {
    expect(getDefaultGymTemplate('push day (gym)').length).toBeGreaterThan(0);
    expect(getDefaultGymTemplate('PUSH DAY (GYM)').length).toBeGreaterThan(0);
  });

  it('returns a compound + accessory mix, not core/mobility', () => {
    const ids = getDefaultGymTemplate('Push day (gym)');
    ids.forEach(id => {
      expect(['compound', 'accessory']).toContain(EX_LIB[id]?.type);
    });
    expect(ids.some(id => EX_LIB[id]?.type === 'compound')).toBe(true);
    expect(ids.some(id => EX_LIB[id]?.type === 'accessory')).toBe(true);
  });

  it('falls through cleanly for an unrecognised or missing label', () => {
    expect(getDefaultGymTemplate('Rugby (training session)')).toEqual([]);
    expect(getDefaultGymTemplate('HIIT class')).toEqual([]);
    expect(getDefaultGymTemplate('')).toEqual([]);
    expect(getDefaultGymTemplate(undefined)).toEqual([]);
  });
});
