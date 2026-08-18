// Picker-facing helpers over the Supabase `activity_catalog` table (the
// single source of "activities the app knows about" — see
// features/specs/weekly-overview-add-session-activity-matrix.md). The
// actual fetch + module-level cache lives in overtrain.js (it already owned
// that cache for the Sequencing Advisor before this table gained a picker
// role too) — this file adds a resilience layer on top for the two
// consumers that can't tolerate an empty list the way the Sequencing
// Advisor's own FALLBACK_LOAD tier (sessionLoadEstimate.js) already does:
// onboarding's activity pickers and the Weekly Overview's "+ Add session"
// panel.
import { getActivityCatalog as fetchActivityCatalog, findRef } from './overtrain';

export { findRef };

// Hardcoded, literal copy of supabase/seeds/forma_seed_data.json's
// `activities` array — same established pattern as sessionLoadEstimate.js's
// FALLBACK_LOAD (docs/PROJECT_CONTEXT.md §7.6). Used whenever the real
// fetch errors or returns nothing, so onboarding's General Fitness/Sport
// Activity steps and the Weekly Overview picker never render empty while
// waiting on (or failing) a network round-trip. Keep in sync with the seed
// file by hand — activityCatalog.test.js guards that every row here
// resolves to a real SESSION_DISPLAY entry, catching the bug class this
// whole file exists to prevent.
export const FALLBACK_CATALOG = [
  { name: 'Football (match, 90 min)', category: 'team_sport', type: 'team_sport', leg_load: 'high', upper_load: 'low', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Football (5-a-side, casual)', category: 'team_sport', type: 'team_sport', leg_load: 'medium', upper_load: 'low', cardio_load: 'medium', core_load: 'low', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Football (5-a-side, competitive)', category: 'team_sport', type: 'team_sport', leg_load: 'high', upper_load: 'low', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Rugby (full match)', category: 'team_sport', type: 'team_sport', leg_load: 'high', upper_load: 'high', cardio_load: 'high', core_load: 'high', intensity_default: 'high', recovery_hours: 72 },
  { name: 'Rugby (training session)', category: 'team_sport', type: 'team_sport', leg_load: 'medium', upper_load: 'medium', cardio_load: 'medium', core_load: 'medium', intensity_default: 'medium', recovery_hours: 48 },
  { name: 'Basketball (game)', category: 'team_sport', type: 'team_sport', leg_load: 'high', upper_load: 'medium', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Basketball (casual/shooting around)', category: 'team_sport', type: 'team_sport', leg_load: 'low', upper_load: 'low', cardio_load: 'low', core_load: 'low', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Netball (match)', category: 'team_sport', type: 'team_sport', leg_load: 'high', upper_load: 'low', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Hockey (match)', category: 'team_sport', type: 'team_sport', leg_load: 'high', upper_load: 'medium', cardio_load: 'high', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Tennis (match)', category: 'racket_sport', type: 'racket_sport', leg_load: 'medium', upper_load: 'high', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Tennis (casual hit)', category: 'racket_sport', type: 'racket_sport', leg_load: 'low', upper_load: 'medium', cardio_load: 'medium', core_load: 'low', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Badminton (competitive)', category: 'racket_sport', type: 'racket_sport', leg_load: 'medium', upper_load: 'medium', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Squash', category: 'racket_sport', type: 'racket_sport', leg_load: 'high', upper_load: 'medium', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Volleyball (competitive)', category: 'team_sport', type: 'team_sport', leg_load: 'high', upper_load: 'high', cardio_load: 'medium', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Volleyball (casual beach)', category: 'team_sport', type: 'team_sport', leg_load: 'medium', upper_load: 'medium', cardio_load: 'medium', core_load: 'medium', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Cricket (batting/fielding)', category: 'team_sport', type: 'team_sport', leg_load: 'low', upper_load: 'medium', cardio_load: 'low', core_load: 'low', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Cricket (bowling)', category: 'team_sport', type: 'team_sport', leg_load: 'medium', upper_load: 'high', cardio_load: 'medium', core_load: 'high', intensity_default: 'medium', recovery_hours: 48 },
  { name: 'Running (easy / recovery)', category: 'endurance', type: 'run', leg_load: 'low', upper_load: 'none', cardio_load: 'medium', core_load: 'low', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Running (tempo)', category: 'endurance', type: 'run', leg_load: 'medium', upper_load: 'none', cardio_load: 'high', core_load: 'low', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Running (interval / track)', category: 'endurance', type: 'run', leg_load: 'high', upper_load: 'none', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Running (long run)', category: 'endurance', type: 'run', leg_load: 'high', upper_load: 'none', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Running (parkrun effort)', category: 'endurance', type: 'run', leg_load: 'high', upper_load: 'none', cardio_load: 'high', core_load: 'low', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Cycling (easy / commute)', category: 'endurance', type: 'bike', leg_load: 'low', upper_load: 'none', cardio_load: 'low', core_load: 'low', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Cycling (moderate ride)', category: 'endurance', type: 'bike', leg_load: 'medium', upper_load: 'none', cardio_load: 'medium', core_load: 'low', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Cycling (long ride)', category: 'endurance', type: 'bike', leg_load: 'high', upper_load: 'none', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Cycling (indoor / structured intervals)', category: 'endurance', type: 'bike', leg_load: 'high', upper_load: 'none', cardio_load: 'high', core_load: 'low', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Swimming (easy / technique)', category: 'endurance', type: 'swim', leg_load: 'low', upper_load: 'medium', cardio_load: 'medium', core_load: 'medium', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Swimming (moderate)', category: 'endurance', type: 'swim', leg_load: 'low', upper_load: 'high', cardio_load: 'medium', core_load: 'medium', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Swimming (hard / intervals)', category: 'endurance', type: 'swim', leg_load: 'medium', upper_load: 'high', cardio_load: 'high', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Open water swimming', category: 'endurance', type: 'swim', leg_load: 'medium', upper_load: 'high', cardio_load: 'medium', core_load: 'high', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Synchronised Swimming', category: 'endurance', type: 'swim', leg_load: 'medium', upper_load: 'high', cardio_load: 'medium', core_load: 'high', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Rowing (on water)', category: 'endurance', type: 'row', leg_load: 'high', upper_load: 'high', cardio_load: 'high', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Rowing (ergometer / erg)', category: 'endurance', type: 'row', leg_load: 'high', upper_load: 'high', cardio_load: 'high', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Triathlon brick (bike + run)', category: 'endurance', type: 'brick', leg_load: 'high', upper_load: 'none', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Legs day (gym)', category: 'gym', type: 'gym', leg_load: 'high', upper_load: 'none', cardio_load: 'none', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Push day (gym)', category: 'gym', type: 'gym', leg_load: 'none', upper_load: 'high', cardio_load: 'none', core_load: 'low', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Pull day (gym)', category: 'gym', type: 'gym', leg_load: 'none', upper_load: 'high', cardio_load: 'none', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Upper body day (gym)', category: 'gym', type: 'gym', leg_load: 'none', upper_load: 'high', cardio_load: 'none', core_load: 'low', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Full body (gym)', category: 'gym', type: 'gym', leg_load: 'high', upper_load: 'high', cardio_load: 'low', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Conditioning circuit', category: 'gym', type: 'conditioning', leg_load: 'medium', upper_load: 'medium', cardio_load: 'medium', core_load: 'high', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Core / abs session', category: 'gym', type: 'conditioning', leg_load: 'none', upper_load: 'none', cardio_load: 'none', core_load: 'high', intensity_default: 'low', recovery_hours: 24 },
  { name: 'HIIT class', category: 'gym', type: 'hiit', leg_load: 'high', upper_load: 'medium', cardio_load: 'high', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'CrossFit WOD', category: 'gym', type: 'hiit', leg_load: 'high', upper_load: 'high', cardio_load: 'high', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Powerlifting session', category: 'gym', type: 'gym', leg_load: 'high', upper_load: 'high', cardio_load: 'none', core_load: 'high', intensity_default: 'high', recovery_hours: 72 },
  { name: 'Olympic lifting session', category: 'gym', type: 'gym', leg_load: 'high', upper_load: 'high', cardio_load: 'none', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Yoga (gentle / restorative)', category: 'mobility', type: 'yoga', leg_load: 'none', upper_load: 'none', cardio_load: 'none', core_load: 'low', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Yoga (vinyasa / power)', category: 'mobility', type: 'yoga', leg_load: 'low', upper_load: 'medium', cardio_load: 'low', core_load: 'medium', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Pilates', category: 'mobility', type: 'pilates', leg_load: 'low', upper_load: 'low', cardio_load: 'none', core_load: 'high', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Stretching / foam rolling', category: 'mobility', type: 'mobility', leg_load: 'none', upper_load: 'none', cardio_load: 'none', core_load: 'none', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Mobility session', category: 'mobility', type: 'mobility', leg_load: 'none', upper_load: 'none', cardio_load: 'none', core_load: 'low', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Boxing (sparring)', category: 'combat', type: 'combat', leg_load: 'medium', upper_load: 'high', cardio_load: 'high', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Boxing (pad/bag work)', category: 'combat', type: 'combat', leg_load: 'low', upper_load: 'high', cardio_load: 'high', core_load: 'medium', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'MMA / BJJ training', category: 'combat', type: 'combat', leg_load: 'high', upper_load: 'high', cardio_load: 'high', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Muay Thai', category: 'combat', type: 'combat', leg_load: 'high', upper_load: 'high', cardio_load: 'high', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Surfing', category: 'water_sport', type: 'water_sport', leg_load: 'medium', upper_load: 'high', cardio_load: 'medium', core_load: 'high', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Paddleboarding (SUP)', category: 'water_sport', type: 'water_sport', leg_load: 'low', upper_load: 'medium', cardio_load: 'low', core_load: 'high', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Kayaking / canoeing', category: 'water_sport', type: 'water_sport', leg_load: 'none', upper_load: 'high', cardio_load: 'medium', core_load: 'high', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Climbing (bouldering)', category: 'adventure', type: 'climb', leg_load: 'medium', upper_load: 'high', cardio_load: 'low', core_load: 'high', intensity_default: 'medium', recovery_hours: 48 },
  { name: 'Climbing (sport / trad)', category: 'adventure', type: 'climb', leg_load: 'medium', upper_load: 'high', cardio_load: 'medium', core_load: 'high', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Hiking (moderate)', category: 'adventure', type: 'adventure', leg_load: 'medium', upper_load: 'none', cardio_load: 'medium', core_load: 'low', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Hiking (long / mountainous)', category: 'adventure', type: 'adventure', leg_load: 'high', upper_load: 'none', cardio_load: 'high', core_load: 'medium', intensity_default: 'high', recovery_hours: 48 },
  { name: 'Active recovery (walk / gentle swim)', category: 'recovery', type: 'recovery', leg_load: 'none', upper_load: 'none', cardio_load: 'none', core_load: 'none', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Rest day', category: 'recovery', type: 'rest', leg_load: 'none', upper_load: 'none', cardio_load: 'none', core_load: 'none', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Walking', category: 'recovery', type: 'walk', leg_load: 'none', upper_load: 'none', cardio_load: 'low', core_load: 'none', intensity_default: 'low', recovery_hours: 0 },
  { name: 'Dancing (social / fitness class)', category: 'mobility', type: 'dance', leg_load: 'low', upper_load: 'low', cardio_load: 'medium', core_load: 'low', intensity_default: 'medium', recovery_hours: 24 },
  { name: 'Golf', category: 'adventure', type: 'other', leg_load: 'low', upper_load: 'low', cardio_load: 'low', core_load: 'low', intensity_default: 'low', recovery_hours: 0 },
];

// Resolves the catalog for picker use: the real fetch's result if it
// returned anything, the hardcoded fallback otherwise. (overtrain.js's own
// getActivityCatalog() stays untouched — the Sequencing Advisor already
// tolerates an empty ref list fine via its own FALLBACK_LOAD tier, so it
// doesn't need this extra layer.)
export async function getActivityCatalog() {
  const rows = await fetchActivityCatalog();
  return rows.length ? rows : FALLBACK_CATALOG;
}

// Broad types excluded from the "+ Add session" / onboarding pickers — not
// real loggable choices (see features/specs/weekly-overview-add-session-
// activity-matrix.md §B/§D).
export const PICKER_EXCLUDED_TYPES = ['recovery', 'rest'];

// Distinct pickable types present in `rows`, in first-seen order — the
// step-1 broad-category button list.
export function pickerTypes(rows) {
  const seen = new Set();
  const types = [];
  rows.forEach(r => {
    if (!r.type || PICKER_EXCLUDED_TYPES.includes(r.type) || seen.has(r.type)) return;
    seen.add(r.type);
    types.push(r.type);
  });
  return types;
}

export function rowsForType(rows, type) {
  return rows.filter(r => r.type === type);
}

// One canonical "moderate" row per type, picked when a user selects a
// broad type (step 1) without drilling into a specific variant (step 2) —
// same convention screens/GymPlanScreens.jsx's DayActivitiesScreen already
// established for its own quick-add (`ACTIVITY_TYPES[...].refName`).
// Types with only one row (walk, pilates, dance, other, brick) don't need
// an entry here — defaultRowForType falls back to that single row.
export const DEFAULT_VARIANT_NAME = {
  run: 'Running (tempo)',
  bike: 'Cycling (moderate ride)',
  swim: 'Swimming (moderate)',
  row: 'Rowing (ergometer / erg)',
  gym: 'Full body (gym)',
  conditioning: 'Conditioning circuit',
  hiit: 'HIIT class',
  yoga: 'Yoga (vinyasa / power)',
  climb: 'Climbing (bouldering)',
  team_sport: 'Football (5-a-side, casual)',
  racket_sport: 'Tennis (casual hit)',
  combat: 'Boxing (pad/bag work)',
  water_sport: 'Paddleboarding (SUP)',
  adventure: 'Hiking (moderate)',
};

// Resolves which row a step-1-only pick (no specific variant chosen)
// should store. Falls back to the first row of that type if the named
// default isn't present in `rows` (e.g. a locally-edited catalog, or one
// of the single-row types with no DEFAULT_VARIANT_NAME entry at all).
export function defaultRowForType(rows, type) {
  const candidates = rowsForType(rows, type);
  if (!candidates.length) return null;
  const wanted = DEFAULT_VARIANT_NAME[type];
  return (wanted && candidates.find(r => r.name === wanted)) || candidates[0];
}
