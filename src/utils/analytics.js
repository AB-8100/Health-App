// [DATA] Pure transforms turning the flat `completedSessions` array into the
// per-activity pace/reps time series the Analytics screen charts. No React,
// no Supabase — safe to unit test in isolation.
import { getSessionDisplay } from '../data/sessionDisplay';
import { legDistanceKm } from './raceTargets';

// Activity types whose pace reads more naturally as a speed (km/h) than a
// mm:ss/km pace.
const SPEED_TYPES = ['cycle', 'bike'];

function toKm(distance, distanceUnit) {
  if (distance == null) return null;
  return distanceUnit === 'm' ? distance / 1000 : distance;
}

function toMetres(distance, distanceUnit) {
  if (distance == null) return null;
  return distanceUnit === 'km' ? distance * 1000 : distance;
}

// A session counts toward "reps" if it logged a gym-style exercise queue;
// toward "pace" if it logged distance + elapsed time. Sessions matching
// neither (e.g. rest days, manual logs missing distance) are ignored.
function isRepsSession(s) {
  return Array.isArray(s.queue) && s.queue.length > 0;
}

function isPaceSession(s) {
  return !isRepsSession(s) && typeof s.distance === 'number' && s.distance > 0
    && typeof s.elapsed === 'number' && s.elapsed > 0;
}

// Grouping key/label for a reps-eligible session: plain gym sessions
// (`type` unset) bucket under a single "Gym" activity; conditioning
// sessions are grouped by their own `workout` label (e.g. "Football"),
// since that's the actual user-facing activity name, not a generic bucket.
function repsActivityIdFor(s) {
  return s.type === 'conditioning' ? `conditioning:${s.workout || 'Conditioning'}` : 'gym';
}

// [LOGIC] Builds the list of activities the user can pick from, derived only
// from what they've actually logged (never a hardcoded list).
export function getActivityOptions(completedSessions = []) {
  const byId = new Map();

  for (const s of completedSessions) {
    if (isRepsSession(s)) {
      const isConditioning = s.type === 'conditioning';
      const id = repsActivityIdFor(s);
      const label = isConditioning ? (s.workout || 'Conditioning') : 'Gym';
      if (!byId.has(id)) {
        const display = getSessionDisplay(null, isConditioning ? 'conditioning' : 'gym');
        byId.set(id, { id, label, emoji: display.emoji, color: display.color, metric: 'reps' });
      }
    } else if (isPaceSession(s)) {
      const type = s.type || 'other';
      const id = `pace:${type}`;
      if (!byId.has(id)) {
        const display = getSessionDisplay(null, type);
        byId.set(id, { id, label: display.label, emoji: display.emoji, color: display.color, metric: 'pace', type });
      }
    }
  }

  return Array.from(byId.values());
}

// [LOGIC] Which unit family a pace-type activity's chart should use.
export function paceUnitForType(type) {
  if (type === 'swim') return 'per100m';
  if (SPEED_TYPES.includes(type)) return 'kmh';
  return 'perKm';
}

// [LOGIC] Per-session pace/speed value (raw number, unit depends on
// `paceUnitForType`) for a given pace-eligible activity type, sorted by date
// ascending. `value` is seconds-per-unit for perKm/per100m, km/h for kmh.
export function getPaceSeries(completedSessions = [], activityType) {
  const unit = paceUnitForType(activityType);
  const points = [];

  for (const s of completedSessions) {
    if (!isPaceSession(s)) continue;
    if ((s.type || 'other') !== activityType) continue;

    let value;
    if (unit === 'kmh') {
      const km = toKm(s.distance, s.distanceUnit);
      value = km / (s.elapsed / 3600);
    } else if (unit === 'per100m') {
      const metres = toMetres(s.distance, s.distanceUnit);
      value = s.elapsed / (metres / 100);
    } else {
      const km = toKm(s.distance, s.distanceUnit);
      value = s.elapsed / km;
    }
    points.push({ id: s.id, date: s.date, value });
  }

  return points.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// [LOGIC] "mm:ss" formatting for a seconds-per-unit pace value, or a
// one-decimal km/h speed string, depending on unit family.
export function formatPaceValue(value, unit) {
  if (value == null || !isFinite(value)) return '—';
  if (unit === 'kmh') return `${value.toFixed(1)} km/h`;
  const totalSeconds = Math.round(value);
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  const suffix = unit === 'per100m' ? '/100m' : '/km';
  return `${m}:${String(sec).padStart(2, '0')}${suffix}`;
}

// [LOGIC] Mean of a pace/reps series' values, or null when there's nothing
// to average (matches getPaceSeries/getRepsSeries's raw-number `value`).
export function getAverageValue(series = []) {
  if (!series.length) return null;
  return series.reduce((sum, p) => sum + p.value, 0) / series.length;
}

// [LOGIC] Whether an average pace/speed is meeting a goal. For time-based
// units (seconds-per-km / seconds-per-100m) lower is better; for km/h speed,
// higher is better. Returns null when there's no average or no goal
// confirmed yet (see getGoalPaceValue).
export function getPaceTrackStatus(averageValue, goalValue, unit) {
  if (averageValue == null || goalValue == null || !isFinite(averageValue) || !isFinite(goalValue)) return null;
  return unit === 'kmh' ? averageValue >= goalValue : averageValue <= goalValue;
}

// Maps an analytics pace-activity `type` to the discipline keys
// utils/raceTargets.js works in ('swim'/'bike'/'run') — the only disciplines
// a goal pace can be derived for, since those are the only ones with a
// distance table and a Stage-3 "confirm pace targets" step behind them.
const DISCIPLINE_FOR_TYPE = { run: 'run', swim: 'swim', cycle: 'bike', bike: 'bike' };

// [LOGIC] Goal pace for a pace-eligible activity. Two sources, checked in
// order:
//  1. `eventRaceConfig` — the target time → pace/split the user confirmed on
//     their event_race goal during Stage 3 onboarding (utils/raceTargets.js's
//     pace_confirm step, spec-stage3-time-goals.md). `{ raceType,
//     targetPaces: { swim, bike, run, transition } (seconds) }`.
//  2. `manualGoalPaces` — a per-discipline fallback entered on the About Me
//     screen, for users who only upload their own training plan and never
//     go through the questionnaire. Already in the same raw unit this
//     function returns (seconds-per-km/100m, or km/h), keyed by discipline
//     just like `targetPaces`, so no distance conversion is needed.
// Returns null when the activity has no discipline mapping or neither
// source has a value for it yet.
export function getGoalPaceValue(activityType, { eventRaceConfig, manualGoalPaces } = {}) {
  const discipline = DISCIPLINE_FOR_TYPE[activityType];
  if (!discipline) return null;

  const legSeconds = eventRaceConfig?.targetPaces?.[discipline];
  const distanceKm = legDistanceKm(discipline, eventRaceConfig?.raceType);
  if (Number.isFinite(legSeconds) && legSeconds > 0 && Number.isFinite(distanceKm) && distanceKm > 0) {
    const unit = paceUnitForType(activityType);
    if (unit === 'kmh') return distanceKm / (legSeconds / 3600);
    if (unit === 'per100m') return legSeconds / (distanceKm * 1000 / 100);
    return legSeconds / distanceKm;
  }

  const manual = manualGoalPaces?.[discipline];
  return (Number.isFinite(manual) && manual > 0) ? manual : null;
}

// [LOGIC] Parses a manually-entered goal pace/speed (About Me's Goal paces
// section) into the same raw numeric form getGoalPaceValue/getPaceSeries
// use: "mm:ss" → seconds for perKm/per100m, a plain decimal → km/h for kmh.
// Returns null for anything unparseable or non-positive so callers can
// reject bad input instead of saving garbage.
export function parseGoalPaceInput(input, unit) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const trimmed = input.trim();
  if (unit === 'kmh') {
    const n = Number(trimmed);
    return isFinite(n) && n > 0 ? n : null;
  }
  const match = trimmed.match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  const total = Number(match[1]) * 60 + Number(match[2]);
  return total > 0 ? total : null;
}

// [LOGIC] Distinct exercises logged under a "reps" activity id (as produced
// by getActivityOptions), most-frequently-logged first.
export function getExerciseOptionsForActivity(completedSessions = [], activityId) {
  const counts = new Map();

  for (const s of completedSessions) {
    if (!isRepsSession(s)) continue;
    if (repsActivityIdFor(s) !== activityId) continue;

    for (const ex of s.queue) {
      const key = ex.id || ex.name;
      if (!key) continue;
      const entry = counts.get(key) || { id: key, name: ex.name || key, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

function setReps(set) {
  if (!set || !set.done) return 0;
  if (typeof set.r === 'number') return set.r;
  return (typeof set.rR === 'number' ? set.rR : 0) + (typeof set.rL === 'number' ? set.rL : 0);
}

// [LOGIC] Total logged reps per session (summed across sets, unilateral
// sides combined) for one exercise within a reps-eligible activity, sorted
// by date ascending.
export function getRepsSeries(completedSessions = [], activityId, exerciseId) {
  const points = [];

  for (const s of completedSessions) {
    if (!isRepsSession(s)) continue;
    if (repsActivityIdFor(s) !== activityId) continue;

    const ex = s.queue.find(e => (e.id || e.name) === exerciseId);
    if (!ex || !Array.isArray(ex.sets)) continue;

    const totalReps = ex.sets.reduce((sum, set) => sum + setReps(set), 0);
    if (totalReps <= 0) continue;
    points.push({ id: s.id, date: s.date, value: totalReps });
  }

  return points.sort((a, b) => new Date(a.date) - new Date(b.date));
}
