// [LOGIC] Road-running week structure + pace/distance targets for
// utils/planEngine.js (10K / Half Marathon / Marathon only — triathlon and
// trail keep their own scheduling). Pure functions, no I/O, same pattern as
// raceTargets.js/scheduleGeneration.js.
//
// Why this exists: the onboarding day picker collects the days an athlete
// *could* train, but the engine used to turn every one of those days into a
// run and rotate Easy → Tempo → Fartlek across them with no awareness of
// what came before or after. Picking all 7 days produced 7 runs a week, no
// rest day, and hard sessions on back-to-back days. This module:
//   1. picks how many of the available days to actually run on,
//   2. spreads those runs across the week around the long-run day,
//   3. assigns each run a role (long / quality / easy / recovery) so hard
//      days never sit next to each other or the day before the long run,
//   4. places strength sessions away from long/quality days,
//   5. turns the athlete's own race times into pace zones so every run
//      carries a target pace and an approximate distance.

import { RUN_RACE_DISTANCES_KM, TRIATHLON_LEG_DISTANCES_KM } from './raceTargets';

// Run distance of the goal race: the whole race for a road race, the run
// leg for a triathlon.
function runRaceKm(raceType) {
  return RUN_RACE_DISTANCES_KM[raceType] ?? TRIATHLON_LEG_DISTANCES_KM[raceType]?.run ?? null;
}
function isTriathlon(raceType) {
  return TRIATHLON_LEG_DISTANCES_KM[raceType] !== undefined;
}

// Running straight off the bike is slower than an open run of the same
// distance — used only when a triathlete gives no run-leg target.
const OFF_BIKE_SLOWDOWN = 1.05;

export const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Never schedule more than 6 runs — at least one full rest day every week.
export const MAX_RUNS_PER_WEEK = 6;
export const MIN_RUNS_PER_WEEK = 2;

function dayIdx(day) { return DAY_ORDER.indexOf(day); }
function prevDay(day) { return DAY_ORDER[(dayIdx(day) + 6) % 7]; }
function nextDay(day) { return DAY_ORDER[(dayIdx(day) + 1) % 7]; }
function circularGap(a, b) {
  const d = Math.abs(dayIdx(a) - dayIdx(b));
  return Math.min(d, 7 - d);
}
function sortDays(days) { return DAY_ORDER.filter(d => days.includes(d)); }
function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

// ── How many days to run ─────────────────────────────────────────────────────

const BASE_RUNS_BY_FITNESS = { 'Beginner': 3, 'Fit but new to this': 3, 'Intermediate': 4 };

// Default shown pre-selected in onboarding and used when the athlete never
// answers. Never more than one run above what they currently do, so the
// plan doesn't double their frequency in week 1.
export function recommendedRunsPerWeek({ fitnessLevel, currentRunsPerWeek } = {}) {
  const base = BASE_RUNS_BY_FITNESS[fitnessLevel] ?? 3;
  const current = Number(currentRunsPerWeek);
  if (!(current > 0)) return base;
  return clamp(Math.max(current, Math.min(base, current + 1)), MIN_RUNS_PER_WEEK, MAX_RUNS_PER_WEEK);
}

export function resolveRunsPerWeek(requested, availableCount) {
  const cap = Math.min(availableCount, MAX_RUNS_PER_WEEK);
  const n = Number(requested) || 0;
  return clamp(n || cap, Math.min(MIN_RUNS_PER_WEEK, cap), cap);
}

// ── Which days to run on ─────────────────────────────────────────────────────

// Starts from the long-run day, then repeatedly adds the available day that
// sits furthest (around the week) from every day already chosen, so runs
// spread out instead of clumping. Preferred rest days are only used when
// there's no other way to reach the requested count; a preferred "second
// session" day is taken first after the long day.
export function selectRunDays(availableDays, count, { longDay, restDays = [], preferredDays = [] } = {}) {
  const available = sortDays(availableDays || []);
  if (!available.length || count <= 0) return [];
  const chosen = [];
  if (longDay && available.includes(longDay)) chosen.push(longDay);
  preferredDays.filter(Boolean).forEach(d => {
    if (chosen.length < count && available.includes(d) && !chosen.includes(d) && !restDays.includes(d)) chosen.push(d);
  });

  const pickNext = (pool) => {
    let best = null, bestScore = -1;
    pool.forEach(d => {
      const score = chosen.length ? Math.min(...chosen.map(c => circularGap(c, d))) : 7;
      if (score > bestScore) { best = d; bestScore = score; }
    });
    return best;
  };
  while (chosen.length < Math.min(count, available.length)) {
    const nonRest = available.filter(d => !chosen.includes(d) && !restDays.includes(d));
    const pool = nonRest.length ? nonRest : available.filter(d => !chosen.includes(d));
    chosen.push(pickNext(pool));
  }
  return sortDays(chosen);
}

// ── Quality-session count per week ───────────────────────────────────────────

// raceGoal: 'finish' (finish comfortably) | 'time' (beat a time) | 'race'
// (race hard). Foundation is all easy running; Taper and planned recovery
// weeks keep at most one quality session. Two quality sessions only once
// there are enough easy runs around them to keep most running easy (5+
// runs, or 4 for an athlete racing hard).
export function qualityCountFor({ phase, runsPerWeek, raceGoal, isRecoveryWeek = false }) {
  if (phase === 'Foundation') return 0;
  let q;
  if (runsPerWeek <= 2) q = raceGoal === 'finish' ? 0 : 1;
  else if (runsPerWeek === 3) q = 1;
  else if (runsPerWeek === 4) q = raceGoal === 'race' ? 2 : 1;
  else q = raceGoal === 'finish' ? 1 : 2;
  if (phase === 'Taper' || isRecoveryWeek) q = Math.min(q, 1);
  return q;
}

// ── Role per run day ─────────────────────────────────────────────────────────

// Hard rules for a quality day: not the long-run day, not the day before the
// long run, not next to another quality day. If the week can't fit the
// requested number under those rules, it gets fewer quality sessions rather
// than breaking them. The day after the long run is a recovery run when it's
// a run day.
export function assignRunRoles(runDays, longDay, qualityCount, preferredQualityDay = null) {
  const roles = {};
  runDays.forEach(d => { roles[d] = 'easy'; });
  if (longDay && roles[longDay]) roles[longDay] = 'long';

  const dayBeforeLong = longDay ? prevDay(longDay) : null;
  const dayAfterLong = longDay ? nextDay(longDay) : null;
  const candidates = runDays
    .filter(d => d !== longDay && d !== dayBeforeLong)
    .map(d => ({
      d,
      penalty: (d === preferredQualityDay ? -5 : 0) + (d === dayAfterLong ? 3 : 0)
        // Prefer days furthest from the long run so quality sits mid-week.
        - (longDay ? circularGap(d, longDay) : 0),
    }))
    .sort((a, b) => a.penalty - b.penalty || dayIdx(a.d) - dayIdx(b.d));

  const quality = [];
  for (const { d } of candidates) {
    if (quality.length >= qualityCount) break;
    if (quality.some(q => circularGap(q, d) <= 1)) continue;
    quality.push(d);
  }
  quality.forEach(d => { roles[d] = 'quality'; });
  if (dayAfterLong && roles[dayAfterLong] === 'easy') roles[dayAfterLong] = 'recovery';
  return roles;
}

// ── Strength placement ───────────────────────────────────────────────────────

// Picks up to `count` days for strength. Never the long-run day or a
// preferred rest day; avoids quality days and the day before the long run
// unless the athlete explicitly chose that day. allowDoubleDays decides
// whether stacking onto an easy-run day is preferred (keeps more full rest
// days) or a last resort (separate day first). A separate day is only used
// while at least one full rest day is left in the week.
export function placeStrengthDays({ runDays, roles, availableDays = [], count, restDays = [], explicitDay = null, allowDoubleDays = null }) {
  if (!(count > 0)) return [];
  // More than one 'long' day is possible (a triathlete's long ride and long run).
  const longDays = Object.keys(roles).filter(d => roles[d] === 'long');
  const daysBeforeLong = longDays.map(prevDay);
  const stackPreferred = allowDoubleDays !== false;

  const scored = [];
  DAY_ORDER.forEach(d => {
    if (longDays.includes(d) || restDays.includes(d)) return;
    const isRun = runDays.includes(d);
    if (!isRun && !availableDays.includes(d)) return;
    if (isRun && roles[d] === 'quality') return;
    let penalty = 0;
    if (daysBeforeLong.includes(d)) penalty += 10;
    if (isRun) penalty += stackPreferred ? 0 : 3;
    else penalty += stackPreferred ? 2 : 0;
    if (roles[nextDay(d)] === 'quality') penalty += 1;
    if (roles[d] === 'recovery') penalty += 1;
    scored.push({ d, isRun, penalty });
  });
  scored.sort((a, b) => a.penalty - b.penalty || dayIdx(a.d) - dayIdx(b.d));

  const picked = [];
  let separateDaysUsed = 0;
  const canUse = (c, minGap) => {
    if (picked.includes(c.d)) return false;
    if (picked.some(p => circularGap(p, c.d) < minGap)) return false;
    if (!c.isRun && 7 - runDays.length - (separateDaysUsed + 1) < 1) return false;
    return true;
  };
  const take = (c) => { picked.push(c.d); if (!c.isRun) separateDaysUsed++; };

  if (explicitDay && !longDays.includes(explicitDay) && !restDays.includes(explicitDay)) {
    take({ d: explicitDay, isRun: runDays.includes(explicitDay) });
  }
  for (const minGap of [2, 1]) {
    for (const c of scored) {
      if (picked.length >= count) break;
      if (canUse(c, minGap)) take(c);
    }
  }
  return sortDays(picked.slice(0, count));
}

// ── Pace zones ───────────────────────────────────────────────────────────────

// Riegel's formula, expressed per km: pace scales with distance^0.06.
function riegelPace(paceSecPerKm, fromKm, toKm) {
  return paceSecPerKm * Math.pow(toKm / fromKm, 0.06);
}

function parseDuration(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split(':').map(Number);
  if (parts.some(Number.isNaN) || parts.length < 2) return null;
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}

// Conservative 10K-pace defaults by fitness level when the athlete gives no
// race time and no target — only used to size distances, and flagged as an
// estimate in the target text.
const DEFAULT_10K_PACE = { 'Beginner': 420, 'Fit but new to this': 375, 'Intermediate': 330 };

// Returns the athlete's equivalent 10K pace (sec/km) from, in order: their
// target finish time for this race, their most race-specific recent race
// time, or a fitness-level default. A triathlon run-leg target is run off
// the bike, so it isn't used to infer open-road 10K pace.
export function estimateTenKPace({ baselines = {}, targetPaces = null, raceType, fitnessLevel } = {}) {
  const raceKm = RUN_RACE_DISTANCES_KM[raceType];
  if (targetPaces?.run > 0 && raceKm && !isTriathlon(raceType)) {
    return { secPerKm: riegelPace(targetPaces.run / raceKm, raceKm, 10), source: 'target' };
  }
  const run = baselines.run || {};
  const candidates = [
    { time: run.time10k, km: 10 }, { time: run.time5k, km: 5 },
    { time: run.timeHalfMarathon, km: 21.0975 }, { time: run.timeMarathon, km: 42.195 },
  ];
  for (const c of candidates) {
    const secs = parseDuration(c.time);
    if (secs) return { secPerKm: riegelPace(secs / c.km, c.km, 10), source: 'race' };
  }
  return { secPerKm: DEFAULT_10K_PACE[fitnessLevel] ?? 420, source: 'default' };
}

// Zones as [fast, slow] sec/km, relative to 10K pace. `race` is the goal
// race's own pace (target pace if given, otherwise predicted from 10K pace).
export function paceZones(tenKPace, raceType, targetPaces = null) {
  const raceKm = runRaceKm(raceType) || 10;
  const racePace = targetPaces?.run > 0
    ? targetPaces.run / raceKm
    : riegelPace(tenKPace, 10, raceKm) * (isTriathlon(raceType) ? OFF_BIKE_SLOWDOWN : 1);
  return {
    recovery: [tenKPace * 1.30, tenKPace * 1.40],
    easy:     [tenKPace * 1.18, tenKPace * 1.30],
    tempo:    [tenKPace * 1.04, tenKPace * 1.08],
    fast:     [tenKPace * 0.97, tenKPace * 1.02],
    race:     [racePace * 0.99, racePace * 1.01],
  };
}

export function zoneMid(zone) { return (zone[0] + zone[1]) / 2; }

export function formatPace(secPerKm) {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatZone(zone) {
  return `${formatPace(zone[0])}–${formatPace(zone[1])}/km`;
}

function roundKm(km) { return Math.max(0.5, Math.round(km * 2) / 2); }

// ── Current long run ─────────────────────────────────────────────────────────

// Best available signal for how long the athlete's long run is *today*, in
// minutes. Week 1's long run starts here instead of at a fraction of the
// plan's peak, so someone already running 60 minutes isn't handed 47.
export function currentLongRunMinutes(run = {}, easyPaceSecPerKm) {
  const usual = Number(run.usualLongRunMinutes);
  if (usual > 0) return usual;
  const longestMin = Number(run.longestEffortMinutes);
  if (longestMin > 0) return longestMin;
  const longestKm = Number(run.longestEffortKm);
  if (longestKm > 0 && easyPaceSecPerKm > 0) return longestKm * easyPaceSecPerKm / 60;
  if (run.canRunContinuously60min === true) return 60;
  const weeklyKm = Number(run.weeklyKm);
  if (weeklyKm > 0 && easyPaceSecPerKm > 0) return weeklyKm * 0.3 * easyPaceSecPerKm / 60;
  for (const time of [run.timeMarathon, run.timeHalfMarathon, run.time10k, run.time5k]) {
    const secs = parseDuration(time);
    if (secs) return secs / 60;
  }
  return null;
}

// ── Session durations and targets ────────────────────────────────────────────

const WARMUP_MIN = 10;
const COOLDOWN_MIN = 10;

// Every non-long run is sized off that week's long run, so weekly volume
// tracks the long-run progression (and its 10% growth cap).
export function supportingRunMinutes(longMinutes) {
  const easy = clamp(Math.round(longMinutes * 0.55), 20, 60);
  return {
    easy,
    recovery: clamp(Math.round(longMinutes * 0.4), 20, 35),
    quality: Math.max(WARMUP_MIN + COOLDOWN_MIN + 15, easy),
  };
}

// Race-pace rep length by race distance.
const RACE_PACE_REP_KM = { '10K': 1, 'Half Marathon': 2, 'Marathon': 3 };

// Builds the target line shown under a run in the Weekly Overview: an
// approximate distance plus pace, and for quality sessions the structure
// (warm-up, main set, cool-down). Returns { target, distanceKm }.
export function describeRunTarget({ sessionType, minutes, zones, raceType, estimated = false }) {
  const easyMid = zoneMid(zones.easy);
  const approx = estimated ? ' (est.)' : '';
  const easyKm = (mins) => (mins * 60) / easyMid;
  // Full 10' warm-up/cool-down from 35min up; shorter sessions (e.g. a
  // triathlete's mid-week run) scale them down so the parts add up.
  const wu = minutes >= 35 ? WARMUP_MIN : Math.max(5, Math.floor(minutes * 0.25));
  const main = Math.max(8, minutes - 2 * wu);

  if (sessionType === 'Recovery run') {
    const km = roundKm((minutes * 60) / zoneMid(zones.recovery));
    return { distanceKm: km, target: `≈${km} km · ${formatZone(zones.recovery)}${approx}` };
  }
  if (sessionType === 'Easy run + strides') {
    const km = roundKm(easyKm(minutes));
    return { distanceKm: km, target: `≈${km} km · ${formatZone(zones.easy)} + 6×20s strides${approx}` };
  }
  if (sessionType === 'Tempo run') {
    const block = main >= 24 ? `2×${Math.round(main / 2)}' (2' jog)` : `${main}'`;
    const km = roundKm(easyKm(2 * wu) + (main * 60) / zoneMid(zones.tempo));
    return { distanceKm: km, target: `${wu}' easy · ${block} @ ${formatZone(zones.tempo)} · ${wu}' easy · ≈${km} km${approx}` };
  }
  if (sessionType === 'Fartlek session') {
    const reps = Math.max(4, Math.floor(main / 2));
    const km = roundKm(easyKm(2 * wu + reps) + (reps * 60) / zoneMid(zones.fast));
    return { distanceKm: km, target: `${wu}' easy · ${reps}×(1' @ ${formatZone(zones.fast)} / 1' easy) · ${wu}' easy · ≈${km} km${approx}` };
  }
  if (sessionType === 'Race-pace intervals') {
    const repKm = RACE_PACE_REP_KM[raceType] || 1;
    const repSec = repKm * zoneMid(zones.race);
    const reps = Math.max(3, Math.round((main * 60) / (repSec + 90)));
    const km = roundKm(easyKm(2 * wu) + reps * repKm);
    return { distanceKm: km, target: `${wu}' easy · ${reps}×${repKm} km @ ${formatZone(zones.race)} (90s jog) · ${wu}' easy · ≈${km} km${approx}` };
  }
  if (sessionType === 'Short race-pace efforts') {
    const km = roundKm(easyKm(minutes - 8) + (8 * 60) / zoneMid(zones.race));
    return { distanceKm: km, target: `Easy with 4×2' @ ${formatZone(zones.race)} · ≈${km} km${approx}` };
  }
  if (sessionType === 'Brick run') {
    const km = roundKm((minutes * 60) / zoneMid(zones.race));
    return { distanceKm: km, target: `Straight off the bike · ≈${km} km @ ${formatZone(zones.race)}${approx}` };
  }
  // Easy run, Long run and anything else run at easy pace.
  const km = roundKm(easyKm(minutes));
  return { distanceKm: km, target: `≈${km} km · ${formatZone(zones.easy)}${approx}` };
}
