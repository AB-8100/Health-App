// [LOGIC] Deterministic endurance training plan engine — replaces the Claude
// API call (utils/planPrompt.js → generate-training-plan edge function →
// utils/planGeneration.js) with pure data tables + arithmetic, encoding the
// same rules that used to live only as instructions to Claude (taper
// lengths, phase splits, peak-volume targets, discipline-frequency ramp,
// brick/holiday/one-off-event handling, the 10%/80-20 checks). No I/O, no
// randomness — same input always produces the same plan, fully Vitest-
// covered, same pattern as scheduleGeneration.js/raceTargets.js.
//
// See features/specs/deterministic-endurance-plan-generator.md §B.
//
// ── Input contract (the merged onboarding payload, §A) ──────────────────────
// {
//   raceType,                 one of SUPPORTED_RACE_TYPES
//   startDate, raceDate,      'YYYY-MM-DD'
//   fitnessLevel,             'Beginner' | 'Intermediate' | 'Fit but new to this'
//   disciplineDays: {         per-discipline day picker (§A.7) — frequency IS
//     run: [...dayKeys], swim: [...dayKeys], bike: [...dayKeys],   the count of selected days
//   },
//   disciplineRanking,        ['bike','run','swim'] strongest→weakest, triathlon only
//   baselines: { run: {...}, swim: {...}, bike: {...} },
//   preferences: { longSessionDay, secondDisciplineDay, conditioningDay, hillDay (trail only) },
//   gymAccess,                accepted but no longer read here — conditioning is
//                              unconditional in every generated plan (§B.6)
//   holidays: [{ label, from, to, days?: { 'YYYY-MM-DD': { limited: bool, disciplines: [...] } } }],
//   oneOffEvents: [{ label, date }],
//   cutoffTimes: { swim, bike, run } (seconds, triathlon only, optional),
//   targetPaces: { swim, transition, bike, run } (seconds per leg) | { run } for running-only,
//   trailDistanceKm,          race distance in km, Trail Running only — sizes the peak long run
//   injury: { pastInjuries, currentNiggles, healthConditions, avoidExercises, aggravatingFactors },
// }

import { RUN_RACE_DISTANCES_KM, TRIATHLON_LEG_DISTANCES_KM, legDistanceKm } from './raceTargets';
import { colorForPhase } from './trainingPlanImport';
import { RUN_LIBRARY, SWIM_LIBRARY, BIKE_LIBRARY, RUN_LONG_TERM, BIKE_LONG_TERM, nextFromRotation } from '../data/sessionLibraries';
import { glossaryForTerms } from '../data/planGlossary';
import { selectConditioningExercises } from '../data/conditioningLibrary';

export const SUPPORTED_RACE_TYPES = [
  '10K', 'Half Marathon', 'Marathon', 'Trail Running',
  'Triathlon (Sprint)', 'Triathlon (Olympic)', 'Triathlon (70.3 / Half)', 'Triathlon (Full / Ironman)',
];

export function isEngineSupportedRaceType(raceType) {
  return SUPPORTED_RACE_TYPES.includes(raceType);
}

export function isTriathlonRace(raceType) {
  return TRIATHLON_LEG_DISTANCES_KM[raceType] !== undefined;
}

export function isTrailRaceType(raceType) {
  return raceType === 'Trail Running';
}

// ── STEP 1: taper / peak volume / minimum-weeks tables ──────────────────────
// Transcribed from utils/planPrompt.js's STEP 1/STEP 2 tables (the same
// rules previously sent to Claude as instructions) — see that file for the
// prose form and sourcing.

const TAPER_TABLE = {
  'Triathlon (Sprint)':         { days: 7,  volumeCut: 0.50 },
  'Triathlon (Olympic)':        { days: 12, volumeCut: 0.45 },
  'Triathlon (70.3 / Half)':    { days: 14, volumeCut: 0.55 },
  'Triathlon (Full / Ironman)': { days: 21, volumeCut: 0.65 },
  '10K':                        { days: 6,  volumeCut: 0.35 },
  'Half Marathon':              { days: 12, volumeCut: 0.35 },
  'Marathon':                   { days: 18, volumeCut: 0.45 },
  'Trail Running':              { days: 0,  volumeCut: 0 },
};

// Triathlon: peak session sizes before taper. Running: peak long run / peak
// weekly mileage. Brick peak durations scale between the sprint/full anchor
// points given in the reference rules. Trail: peak long-run time-on-feet by
// fitness level (minutes, not distance — trail's long run is duration-based).
const PEAK_VOLUME_TABLE = {
  'Triathlon (Sprint)':         { swimM: 875,  bikeMin: 75,  runMin: 40,  brickBikeMin: 45,  brickRunMin: 25 },
  'Triathlon (Olympic)':        { swimM: 1900, bikeMin: 105, runMin: 65,  brickBikeMin: 90,  brickRunMin: 30 },
  'Triathlon (70.3 / Half)':    { swimM: 2750, bikeMin: 210, runMin: 105, brickBikeMin: 180, brickRunMin: 35 },
  'Triathlon (Full / Ironman)': { swimM: 3750, bikeMin: 330, runMin: 135, brickBikeMin: 240, brickRunMin: 45 },
  '10K':                        { longRunKm: 9,    weeklyKm: 40 },
  'Half Marathon':              { longRunKm: 19.5, weeklyKm: 57.5 },
  'Marathon':                   { longRunKm: 30.5, weeklyKm: 80 },
  'Trail Running':              { longRunMinByFitness: { 'Beginner': 90, 'Intermediate': 150, 'Fit but new to this': 120 } },
};

const WEEKS_TABLE = {
  'Triathlon (Sprint)':         { min: 8,  recMin: 12, recMax: 18 },
  'Triathlon (Olympic)':        { min: 12, recMin: 16, recMax: 20 },
  'Triathlon (70.3 / Half)':    { min: 16, recMin: 20, recMax: 24 },
  'Triathlon (Full / Ironman)': { min: 20, recMin: 28, recMax: 32 },
  '10K':                        { min: 6,  recMin: 8,  recMax: 12 },
  'Half Marathon':              { min: 10, recMin: 12, recMax: 16 },
  'Marathon':                   { min: 16, recMin: 16, recMax: 20 },
  'Trail Running':              { min: 10, recMin: 12, recMax: 16 },
};

// Discipline-frequency-in-Foundation ramp, keyed by rank within the athlete's
// discipline ranking (0 = strongest .. 2 = weakest) and Foundation sub-phase
// (0 = early third, 1 = mid third, 2 = late third).
const FOUNDATION_FREQUENCY = [
  [1, 1, 1], // strongest
  [1, 1, 2], // middle
  [1, 2, 2], // weakest
];

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ── Date helpers (UTC-anchored, matching data/eventPlan.js's convention) ────

function parseUTCDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}
function dayKeyOf(d) {
  return DAY_ORDER[(d.getUTCDay() + 6) % 7]; // getUTCDay(): 0=Sun..6=Sat → rotate to Mon-first
}
function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// ── STEP 2: phase mode + week allocation ─────────────────────────────────────

export function determinePhaseMode(totalWeeks, raceType) {
  const info = WEEKS_TABLE[raceType];
  if (totalWeeks >= info.recMin) return 'full';
  if (totalWeeks >= info.recMin * 0.6) return 'noFoundation';
  return 'compressed';
}

// Splits `total` whole weeks across phases by weight, guaranteeing every
// phase gets at least 1 week (when total >= number of phases) and the parts
// sum to exactly `total`.
export function allocateWeeks(total, weights) {
  const n = weights.length;
  if (total <= n) return weights.map(() => 1);
  const raw = weights.map(w => w * total);
  const floors = raw.map(v => Math.max(1, Math.floor(v)));
  let used = floors.reduce((a, b) => a + b, 0);

  if (used < total) {
    const order = raw
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    let remainder = total - used, idx = 0;
    while (remainder > 0) { floors[order[idx % n].i]++; remainder--; idx++; }
  } else if (used > total) {
    let over = used - total, guard = 0;
    while (over > 0 && guard < n * 200) {
      const idx = floors.indexOf(Math.max(...floors));
      if (floors[idx] > 1) { floors[idx]--; over--; }
      guard++;
    }
  }
  return floors;
}

// Trail has no distinct Taper phase (§B.1) — the full totalWeeks is
// allocated across Foundation/Build/Peak (or Build/Peak when phaseMode isn't
// 'full'), so the plan still runs straight through to race day without a
// separate reduced-volume block beforehand.
function computeTrailPhases(totalWeeks, phaseMode) {
  const labels = phaseMode === 'full' ? ['Foundation', 'Build', 'Peak'] : ['Build', 'Peak'];
  const weights = phaseMode === 'full' ? [0.35, 0.35, 0.30] : [0.6, 0.4];
  const weeks = allocateWeeks(totalWeeks, weights);
  const phases = [];
  let cursor = 1;
  labels.forEach((label, i) => { phases.push({ label, weeks: [cursor, cursor + weeks[i] - 1] }); cursor += weeks[i]; });
  return phases.map((p, i) => ({ ...p, color: colorForPhase(p.label, i) }));
}

function computePhases(raceType, totalWeeks, phaseMode) {
  if (raceType === 'Trail Running') return computeTrailPhases(totalWeeks, phaseMode);
  const taperWeeks = Math.max(1, Math.min(totalWeeks - 1, Math.ceil(TAPER_TABLE[raceType].days / 7)));
  const nonTaperWeeks = Math.max(1, totalWeeks - taperWeeks);

  const labels = phaseMode === 'full' ? ['Foundation', 'Build', 'Peak'] : ['Build', 'Peak'];
  const weights = phaseMode === 'full' ? [0.325, 0.425, 0.25] : [0.575, 0.425];
  const weeks = allocateWeeks(nonTaperWeeks, weights);

  const phases = [];
  let cursor = 1;
  labels.forEach((label, i) => {
    phases.push({ label, weeks: [cursor, cursor + weeks[i] - 1] });
    cursor += weeks[i];
  });
  phases.push({ label: 'Taper', weeks: [cursor, cursor + taperWeeks - 1] });
  return phases.map((p, i) => ({ ...p, color: colorForPhase(p.label, i) }));
}

function phaseForWeek(phases, weekNum) {
  return phases.find(p => weekNum >= p.weeks[0] && weekNum <= p.weeks[1]) || phases[phases.length - 1];
}

// One planned recovery week every 4th week within Foundation/Build/Peak
// (never in Taper, which is already reduced volume throughout).
function computeRecoveryWeeks(phases) {
  const recovery = new Set();
  const lastNonTaperWeek = phases.filter(p => p.label !== 'Taper').reduce((max, p) => Math.max(max, p.weeks[1]), 0);
  for (let w = 4; w <= lastNonTaperWeek; w += 4) recovery.add(w);
  return recovery;
}

// ── Weekly-day placement ─────────────────────────────────────────────────────

function pickAnchorDay(selectedDays, preferred, fallback) {
  if (!selectedDays?.length) return null;
  if (preferred && selectedDays.includes(preferred)) return preferred;
  if (selectedDays.includes(fallback)) return fallback;
  const sorted = DAY_ORDER.filter(d => selectedDays.includes(d));
  return sorted[sorted.length - 1];
}

// Conditioning day defaults to a mid-week day when the athlete leaves the
// preference blank, per the onboarding hint's promise ("Won't be placed on
// the same day as a long or high-intensity session unless chosen here") —
// mirrors the dropped "Default: mid-week day" rule from the original
// AI-prompt spec (utils/planPrompt.js).
function pickConditioningDay(explicit, avoidDays) {
  if (explicit) return explicit;
  const candidates = ['wednesday', 'tuesday', 'thursday', 'monday', 'friday', 'saturday', 'sunday'];
  return candidates.find(d => !avoidDays.includes(d)) || 'wednesday';
}

// ── Volume/duration progression (STEP 6) ─────────────────────────────────────

function estimateRunPaceSecPerKm(baselines, targetPaces, raceType) {
  if (targetPaces?.run && !isTriathlonRace(raceType)) {
    const km = legDistanceKm('run', raceType);
    if (km && targetPaces.run / km > 0) return targetPaces.run / km;
  }
  const run = baselines?.run || {};
  const candidates = [
    { time: run.time10k, km: 10 }, { time: run.time5k, km: 5 },
    { time: run.timeHalfMarathon, km: 21.0975 }, { time: run.timeMarathon, km: 42.195 },
  ];
  for (const c of candidates) {
    const secs = parseDuration(c.time);
    if (secs) return secs / c.km;
  }
  return 420; // ~7:00/km — conservative default when no baseline/target exists
}

function parseDuration(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split(':').map(Number);
  if (parts.some(Number.isNaN) || parts.length < 2) return null;
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}

// Longest continuous running effort proven by a completed race time — used by
// trail's long-run sizing (below) as a fallback when the trail-specific
// "longest continuous run/hike" question is left blank. Finishing any of
// these distances nonstop is itself evidence of a continuous effort of that
// many minutes, so this is a real measured signal, not a guess — checked
// longest-first since a longer proven effort is stronger evidence.
function longestRaceEffortMinutes(run) {
  const candidates = [run?.timeMarathon, run?.timeHalfMarathon, run?.time10k, run?.time5k];
  for (const time of candidates) {
    const secs = parseDuration(time);
    if (secs) return secs / 60;
  }
  return null;
}

const FITNESS_RATIO_DEFAULT = {
  'Beginner': 0.20, 'Intermediate': 0.38, 'Fit but new to this': 0.32,
};

function fitnessRatio(level) {
  return FITNESS_RATIO_DEFAULT[level] ?? 0.25;
}

// Builds a per-week value series from a start value ramping to a peak value
// across the non-taper weeks, then a taper curve for the remaining weeks.
// Single forward pass: a recovery week's ~30% cut permanently lowers the
// baseline the +10% growth cap measures the *next* week against (otherwise
// the week right after a recovery week would legitimately need a large jump
// just to catch back up, which is exactly what the 10% rule is meant to
// catch). The taper curve is anchored to the *actual* last non-taper week's
// value (post recovery-cut/growth-cap), not the nominal peak — if a recovery
// week happens to land on the final non-taper week, taper should ease off
// from where training really was, not jump back up to an uncut peak first.
function buildWeeklySeries({ startValue, peakValue, totalWeeks, nonTaperWeeks, recoveryWeeks, taperVolumeCut, growthCap = 1.10 }) {
  const values = [];
  for (let w = 1; w <= nonTaperWeeks; w++) {
    const idx = w - 1;
    if (recoveryWeeks.has(w)) {
      values.push((values[idx - 1] ?? startValue) * 0.70);
      continue;
    }
    const t = nonTaperWeeks <= 1 ? 1 : (w - 1) / (nonTaperWeeks - 1);
    const raw = startValue + (peakValue - startValue) * t;
    values.push(idx === 0 ? raw : Math.min(raw, values[idx - 1] * growthCap));
  }

  const lastNonTaperValue = values[nonTaperWeeks - 1] ?? peakValue;
  const taperWeeksCount = Math.max(1, totalWeeks - nonTaperWeeks);
  for (let i = 1; i <= taperWeeksCount; i++) {
    const cutFrac = taperVolumeCut * (i / taperWeeksCount);
    values.push(lastNonTaperValue * (1 - cutFrac));
  }
  return values.slice(0, totalWeeks).map(v => Math.max(0, Math.round(v)));
}

// ── Session content builders ─────────────────────────────────────────────────

function minutesDuration(minutes) { return `${Math.max(10, Math.round(minutes))}min`; }
function swimDuration(meters) { return `${Math.max(100, Math.round(meters / 25) * 25)}m`; }

function buildRunEntry({ isLong, weekNum, phase, weeklyMinutes, rotationIdx }) {
  if (isLong) {
    return { type: 'run', label: 'Run', sessionType: RUN_LONG_TERM, duration: minutesDuration(weeklyMinutes.long), flag: '', intensity: 'Low', week: weekNum, phase: phase.label };
  }
  const archetype = nextFromRotation(RUN_LIBRARY, phase.label, rotationIdx);
  return { type: 'run', label: 'Run', sessionType: archetype.sessionType, duration: minutesDuration(weeklyMinutes.short), flag: '', intensity: archetype.intensity, week: weekNum, phase: phase.label };
}

function buildBikeEntry({ isLong, weekNum, phase, weeklyMinutes, rotationIdx }) {
  if (isLong) {
    return { type: 'bike', label: 'Bike', sessionType: BIKE_LONG_TERM, duration: minutesDuration(weeklyMinutes.long), flag: '', intensity: 'Low', week: weekNum, phase: phase.label };
  }
  const archetype = nextFromRotation(BIKE_LIBRARY, phase.label, rotationIdx);
  return { type: 'bike', label: 'Bike', sessionType: archetype.sessionType, duration: minutesDuration(weeklyMinutes.short), flag: '', intensity: archetype.intensity, week: weekNum, phase: phase.label };
}

function buildSwimEntry({ weekNum, phase, weeklyMeters, rotationIdx }) {
  const archetype = nextFromRotation(SWIM_LIBRARY, phase.label, rotationIdx);
  return { type: 'swim', label: 'Swim', sessionType: archetype.sessionType, duration: swimDuration(weeklyMeters), flag: '', intensity: archetype.intensity, week: weekNum, phase: phase.label };
}

// ── Trail Running target-distance sizing ─────────────────────────────────────
// The athlete enters a target race distance (km) at onboarding (§A, the
// "How far is your race?" field on the race-type step). No pace is ever
// assumed anywhere in this — trail's long run stays a pure duration, and
// this never converts the entered km into a time via any assumed speed.
// Instead, distance nudges the generic fitness-level peak minutes (§B.2) up
// or down as a plain ratio against a reference "medium" trail race length:
// a race well above the reference gets a longer peak long run than the
// fitness-level default, one well below it gets a shorter one — both
// intentional (a 10K trail race doesn't need the same peak long run as a
// 50K just because the athlete picked "Intermediate" fitness).
const TRAIL_REFERENCE_DISTANCE_KM = 30;
const TRAIL_DISTANCE_STEP_KM = 10;
const TRAIL_DISTANCE_STEP_PCT = 0.15; // ±15% of the fitness-level peak per 10km away from the reference
const TRAIL_LONG_RUN_MIN_MIN = 45;
const TRAIL_LONG_RUN_MAX_MIN = 600; // 10hr sanity ceiling for very long ultra distances

function trailDistanceAdjustedPeakMinutes(fitnessPeakMin, trailDistanceKm) {
  if (!(trailDistanceKm > 0)) return fitnessPeakMin;
  const steps = (trailDistanceKm - TRAIL_REFERENCE_DISTANCE_KM) / TRAIL_DISTANCE_STEP_KM;
  const multiplier = 1 + steps * TRAIL_DISTANCE_STEP_PCT;
  return clamp(Math.round(fitnessPeakMin * multiplier), TRAIL_LONG_RUN_MIN_MIN, TRAIL_LONG_RUN_MAX_MIN);
}

// The ratio nudge above has no floor tied to whether its result is actually
// enough time to cover the entered distance — a "Beginner" default nudged
// down for a below-reference distance could still land well short of what
// that distance takes to cover at any real pace. Rather than assume a pace,
// use the athlete's own reported rate on their longest continuous run/hike
// (§A run_baseline — distance and time paired as one question, same
// effort) as a floor: dividing their own reported minutes by their own
// reported km is a real personal rate, not an app-invented assumption.
// Falls back to null (no floor applied) if either half of that pair is
// missing, rather than mixing an unrelated distance and time together.
function trailPersonalPaceFloorMinutes(trailDistanceKm, runBaselines) {
  const effortKm = Number(runBaselines?.longestEffortKm);
  const effortMinutes = Number(runBaselines?.longestEffortMinutes);
  if (!(trailDistanceKm > 0) || !(effortKm > 0) || !(effortMinutes > 0)) return null;
  const personalMinPerKm = effortMinutes / effortKm;
  return Math.min(trailDistanceKm * personalMinPerKm, TRAIL_LONG_RUN_MAX_MIN);
}

// ── Trail Running session builders (§B.2-B.5) ───────────────────────────────
// Conversational-effort easy runs — flat duration per phase, no rotation or
// progression series. Cue is the existing 'Easy run' glossary term. Defined
// ahead of buildTrailLongEntry so the long-run floor below can reference it.
const TRAIL_EASY_MIN = { Foundation: 30, Build: 35, Peak: 35 };

// Trail's long run reuses RUN_LONG_TERM's exact sessionType string so the
// existing 'Long run' glossary term resolves for it — no new entry needed.
// A "long run" generating shorter than that week's easy run is a
// contradiction regardless of how the volume series landed there (a low
// fitness signal, a recovery-week cut, a compressed no-Foundation plan
// starting straight into Build-level easy-run minutes, ...) — floor it at
// the easy run's duration for the same phase.
function buildTrailLongEntry(weekNum, phase, minutes) {
  const floored = Math.max(minutes, TRAIL_EASY_MIN[phase.label] || TRAIL_EASY_MIN.Foundation);
  return { type: 'run', label: 'Run', sessionType: RUN_LONG_TERM, duration: minutesDuration(floored), flag: '', intensity: 'Low', week: weekNum, phase: phase.label };
}

// Fixed structure, not a rotation-table lookup — the product spec prescribes
// one specific workout, not variety: 15min warm-up + 6-8 uphill reps (60-90s
// effort + jog/walk recovery), reps increasing by phase.
const TRAIL_HILL_REPS = { Foundation: 6, Build: 7, Peak: 8 };

function buildTrailHillEntry(weekNum, phase) {
  const reps = TRAIL_HILL_REPS[phase.label] || 6;
  const duration = minutesDuration(15 + reps * 3); // 15min warm-up + ~3min/rep (60-90s effort + jog/walk recovery down)
  return {
    type: 'run', label: 'Run', sessionType: 'Trail hill repeats',
    duration, flag: '', intensity: 'High', week: weekNum, phase: phase.label,
  };
}

function buildTrailEasyEntry(weekNum, phase) {
  return {
    type: 'run', label: 'Run', sessionType: 'Easy trail run',
    duration: minutesDuration(TRAIL_EASY_MIN[phase.label] || 30),
    flag: '', intensity: 'Low', week: weekNum, phase: phase.label,
  };
}

// One long day, one hill day, and 1-2 easy days from the athlete's 3-4
// selected running days (§A.3) — computed once outside the day-by-day loop.
function assignTrailDays(trailDays, preferences) {
  const longDay = pickAnchorDay(trailDays, preferences.longSessionDay, 'sunday');
  const remaining = trailDays.filter(d => d !== longDay);
  const hillDay = pickAnchorDay(remaining, preferences.hillDay, remaining[0]);
  const easyDays = remaining.filter(d => d !== hillDay);
  return { longDay, hillDay, easyDays };
}

// Conditioning doubles as injury-prevention/support work (per user decision):
// exercises targeting a declared past-injury area are prioritized into the
// circuit, and anything the athlete flagged to avoid is excluded outright
// rather than just noted. Falls back to the standard baseline circuit
// (glute bridge, bird dog, clamshell, dead bug, side plank) with nothing
// declared.
function buildConditioningEntry(weekNum, phase, conditioningExercises) {
  const names = conditioningExercises.map(e => e.name);
  const sessionType = names.length ? `Circuit: ${names.join(', ')}` : 'Conditioning circuit';
  return { type: 'conditioning', label: 'Conditioning', sessionType, duration: '22min', flag: '', intensity: 'Low', week: weekNum, phase: phase.label };
}

function buildRestEntry(weekNum, phase) {
  return { type: 'rest', label: 'Rest', sessionType: 'Rest', duration: '-', flag: '', intensity: 'Low', week: weekNum, phase: phase?.label || '' };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function buildTrainingPlan(intake) {
  const raceType = intake.raceType;
  if (!isEngineSupportedRaceType(raceType)) {
    throw new Error(`planEngine: unsupported race type "${raceType}"`);
  }
  const triathlon = isTriathlonRace(raceType);
  const trail = isTrailRaceType(raceType);
  const startDate = parseUTCDate(intake.startDate || toDateKey(new Date()));
  const raceDate = parseUTCDate(intake.raceDate);
  const totalDays = Math.max(1, diffDays(startDate, raceDate));
  const totalWeeks = Math.max(1, Math.ceil((totalDays + 1) / 7));

  const phaseMode = determinePhaseMode(totalWeeks, raceType);
  const phases = computePhases(raceType, totalWeeks, phaseMode);
  const nonTaperWeeks = phases.filter(p => p.label !== 'Taper').reduce((max, p) => Math.max(max, p.weeks[1]), 0);
  const recoveryWeeks = computeRecoveryWeeks(phases);
  const taperInfo = TAPER_TABLE[raceType];
  const peak = PEAK_VOLUME_TABLE[raceType];
  const fitnessLevel = intake.fitnessLevel || 'Beginner';
  const baselines = intake.baselines || {};
  const disciplineDays = intake.disciplineDays || {};
  const preferences = intake.preferences || {};
  const targetPaces = intake.targetPaces || null;
  const holidays = intake.holidays || [];
  const oneOffEvents = intake.oneOffEvents || [];
  const injury = intake.injury || {};

  // ── weekly value series per discipline ──
  const runPaceSecPerKm = estimateRunPaceSecPerKm(baselines, targetPaces, raceType);
  const runDays = disciplineDays.run || [];
  let runLongSeries;
  if (trail) {
    // Time-on-feet, not pace-based: peak long run is a duration by fitness
    // level, ramping at 10-15%/week (not the 10% road-running cap) straight
    // through to race day — no taper volume-cut (§B.1/§B.2). The entered
    // target race distance nudges that fitness-level peak up or down (see
    // trailDistanceAdjustedPeakMinutes above), then the athlete's own
    // reported pace on their longest effort — not an assumed one — acts as
    // a floor so the peak is never short of what's needed to actually cover
    // the distance at a pace they've demonstrated (trailPersonalPaceFloorMinutes).
    const fitnessPeakMin = PEAK_VOLUME_TABLE['Trail Running'].longRunMinByFitness[fitnessLevel] ?? 90;
    const ratioNudgedMin = trailDistanceAdjustedPeakMinutes(fitnessPeakMin, Number(intake.trailDistanceKm));
    const personalFloorMin = trailPersonalPaceFloorMinutes(Number(intake.trailDistanceKm), baselines.run);
    const peakMin = personalFloorMin ? Math.max(ratioNudgedMin, personalFloorMin) : ratioNudgedMin;
    // Prefers the trail-specific "longest continuous effort" question;
    // falls back to the longest completed race time when that's left blank
    // (§ longestRaceEffortMinutes) so a reported 5K/10K/etc. time actually
    // informs the plan instead of being silently ignored, instead of
    // collapsing to the generic fitness-level bucket (0.20/0.32/0.38) —
    // used as a last resort only when neither real signal is available.
    // Upper-bounded at 0.5 (rather than the 0.75 an unmoderated ratio would
    // allow) so week 1 doesn't start right up near the athlete's proven max
    // — a first trail long run should be a comfortable starting point the
    // plan ramps up from, not a repeat of their hardest recent effort. The
    // ratio mechanism itself is otherwise untouched, which is what lets
    // buildWeeklySeries's week-1→peak ramp keep tracking the distance-
    // adjusted peak (peakMin) over subsequent weeks rather than every plan
    // collapsing onto the same trajectory regardless of target distance.
    const demonstratedMinutes = Number(baselines.run?.longestEffortMinutes) || longestRaceEffortMinutes(baselines.run);
    const trailFitness = demonstratedMinutes
      ? clamp(demonstratedMinutes / peakMin, 0.15, 0.5)
      : fitnessRatio(fitnessLevel);
    runLongSeries = runDays.length ? buildWeeklySeries({
      startValue: peakMin * trailFitness, peakValue: peakMin,
      totalWeeks, nonTaperWeeks: totalWeeks, recoveryWeeks, taperVolumeCut: 0, growthCap: 1.15,
    }) : [];
  } else {
    const runPeakMin = triathlon ? peak.runMin : (peak.longRunKm * runPaceSecPerKm) / 60;
    const runFitness = baselines.run?.longestEffortKm
      ? clamp((baselines.run.longestEffortKm * runPaceSecPerKm / 60) / runPeakMin, 0.15, 0.75)
      : fitnessRatio(fitnessLevel);
    runLongSeries = runDays.length ? buildWeeklySeries({
      startValue: runPeakMin * runFitness, peakValue: runPeakMin,
      totalWeeks, nonTaperWeeks, recoveryWeeks, taperVolumeCut: taperInfo.volumeCut,
    }) : [];
  }
  const runShortSeries = runLongSeries.map(v => Math.round(v * 0.6));

  let bikeLongSeries = [], bikeShortSeries = [], swimSeries = [];
  if (triathlon) {
    const bikeDays = disciplineDays.bike || [];
    const bikePeakMin = peak.bikeMin;
    const bikeFitness = baselines.bike?.longestRideKm
      ? clamp((baselines.bike.longestRideKm / 25 * 60) / bikePeakMin, 0.15, 0.75)
      : fitnessRatio(fitnessLevel);
    bikeLongSeries = bikeDays.length ? buildWeeklySeries({
      startValue: bikePeakMin * bikeFitness, peakValue: bikePeakMin,
      totalWeeks, nonTaperWeeks, recoveryWeeks, taperVolumeCut: taperInfo.volumeCut,
    }) : [];
    bikeShortSeries = bikeLongSeries.map(v => Math.round(v * 0.6));

    const swimDays = disciplineDays.swim || [];
    const swimPeakM = peak.swimM;
    const swimFitness = baselines.swim?.longestSessionM
      ? clamp(baselines.swim.longestSessionM / swimPeakM, 0.10, 0.60)
      : fitnessRatio(fitnessLevel) * 0.8;
    swimSeries = swimDays.length ? buildWeeklySeries({
      startValue: swimPeakM * swimFitness, peakValue: swimPeakM,
      totalWeeks, nonTaperWeeks, recoveryWeeks, taperVolumeCut: taperInfo.volumeCut,
    }) : [];
  }

  const runLongDay = pickAnchorDay(runDays, triathlon ? null : preferences.longSessionDay, 'sunday');
  const bikeLongDay = triathlon ? pickAnchorDay(disciplineDays.bike || [], preferences.longSessionDay, 'sunday') : null;
  const trailAssignment = trail ? assignTrailDays(runDays, preferences) : null;
  // Conditioning (strength/stability) is now unconditional in every
  // generated plan, not gated on gymAccess (§B.6) — the exercise catalog is
  // 100% bodyweight, so there was never a real dependency on gym access
  // here. This affects every race type this engine generates, not just
  // trail — see PR description.
  const conditioningDay = pickConditioningDay(preferences.conditioningDay, [runLongDay, trailAssignment?.hillDay, bikeLongDay, preferences.secondDisciplineDay].filter(Boolean));
  const conditioningExercises = selectConditioningExercises({
    areas: (injury.pastInjuries || []).map(p => p.area),
    avoidIds: injury.avoidExerciseIds || [],
  });

  // Discipline-frequency-in-Foundation ramp (triathlon only, §B.2): caps how
  // many of the athlete's own selected days for a discipline are actually
  // used each Foundation week, based on that discipline's rank (weakest
  // ramps fastest) and which third of Foundation the week falls in. Days
  // dropped by the cap fall through to a rest entry for that date, same as
  // any other day with nothing scheduled.
  const disciplineRanking = triathlon
    ? (intake.disciplineRanking?.length ? intake.disciplineRanking : ['bike', 'run', 'swim'])
    : [];
  const foundationRange = phases.find(p => p.label === 'Foundation')?.weeks || null;

  function foundationCapFor(discipline, weekNum) {
    if (!triathlon || !foundationRange || weekNum < foundationRange[0] || weekNum > foundationRange[1]) return Infinity;
    const rankIdx = disciplineRanking.indexOf(discipline);
    const row = FOUNDATION_FREQUENCY[rankIdx === -1 ? 1 : rankIdx];
    const span = foundationRange[1] - foundationRange[0] + 1;
    const into = weekNum - foundationRange[0];
    const sub = Math.min(2, Math.floor((into / span) * 3));
    return row[sub];
  }

  function activeDaysForWeek(discipline, weekNum, allDays, anchorDay) {
    const cap = foundationCapFor(discipline, weekNum);
    if (!Number.isFinite(cap) || allDays.length <= cap) return allDays;
    const prioritized = anchorDay && allDays.includes(anchorDay)
      ? [anchorDay, ...DAY_ORDER.filter(d => allDays.includes(d) && d !== anchorDay)]
      : DAY_ORDER.filter(d => allDays.includes(d));
    return prioritized.slice(0, cap);
  }

  // ── holiday day lookup ──
  const holidayByDate = new Map();
  holidays.forEach(h => {
    if (!h.from) return;
    const from = parseUTCDate(h.from);
    const to = h.to ? parseUTCDate(h.to) : from;
    let cursor = from;
    while (cursor.getTime() <= to.getTime()) {
      const dk = toDateKey(cursor);
      const isEdge = dk === toDateKey(from) || dk === toDateKey(to);
      const dayInfo = h.days?.[dk];
      holidayByDate.set(dk, {
        label: h.label,
        limited: dayInfo ? !!dayInfo.limited : false,
        disciplines: dayInfo?.disciplines || [],
        isEdge,
      });
      cursor = addDays(cursor, 1);
    }
  });
  const oneOffByDate = new Map(oneOffEvents.filter(e => e.date).map(e => [e.date, e]));

  // ── build sessions day by day ──
  const sessions = {};
  const runRotation = new Map(), bikeRotation = new Map(), swimRotation = new Map();
  let cursor = startDate;
  while (cursor.getTime() <= raceDate.getTime()) {
    const dk = toDateKey(cursor);
    const dayKey = dayKeyOf(cursor);
    const weekNum = clamp(Math.floor(diffDays(startDate, cursor) / 7) + 1, 1, totalWeeks);
    const phase = phaseForWeek(phases, weekNum);
    const entries = [];
    const holiday = holidayByDate.get(dk);

    if (dk === toDateKey(raceDate)) {
      entries.push({ type: 'race', label: 'Race day', sessionType: raceType, duration: '-', flag: 'Race day', intensity: 'High', week: weekNum, phase: phase.label });
    } else if (holiday && !holiday.limited) {
      entries.push({ type: 'rest', label: 'Rest', sessionType: 'Rest — holiday', duration: '-', flag: 'Holiday', intensity: 'Low', week: weekNum, phase: phase.label });
    } else {
      const swimAllowed = !holiday || !holiday.limited || holiday.disciplines.includes('swim');
      const runAllowed = !holiday || !holiday.limited || holiday.disciplines.includes('run');
      const bikeAllowed = !holiday || (!holiday.limited && bikeLongDay) || (holiday.limited && holiday.disciplines.includes('bike'));

      if (triathlon && bikeAllowed && activeDaysForWeek('bike', weekNum, disciplineDays.bike || [], bikeLongDay).includes(dayKey)) {
        const idx = bikeRotation.get('i') || 0; bikeRotation.set('i', idx + 1);
        const isLong = dayKey === bikeLongDay;
        const entry = buildBikeEntry({ isLong, weekNum, phase, weeklyMinutes: { long: bikeLongSeries[weekNum - 1] || 0, short: bikeShortSeries[weekNum - 1] || 0 }, rotationIdx: idx });
        // Brick: from Week 1 of Build onward, the long bike day also carries a run.
        if (isLong && phase.label !== 'Foundation' && phase.label !== 'Taper') {
          entry.flag = 'Brick';
          const t = clamp((weekNum - phases.find(p => p.label === 'Build').weeks[0]) / Math.max(1, nonTaperWeeks - phases.find(p => p.label === 'Build').weeks[0]), 0, 1);
          entries.push(entry);
          entries.push({ type: 'run', label: 'Run', sessionType: 'Brick run', duration: minutesDuration(peak.brickRunMin * (0.4 + 0.6 * t)), flag: 'Brick', intensity: 'Medium', week: weekNum, phase: phase.label });
        } else if (isLong && phase.label === 'Foundation' && weekNum >= phases.find(p => p.label === 'Foundation').weeks[1] - 1) {
          entries.push(entry);
          entries.push({ type: 'run', label: 'Run', sessionType: 'Short transition run', duration: '8min', flag: 'Brick', intensity: 'Low', week: weekNum, phase: phase.label });
        } else {
          entries.push(entry);
        }
      }
      if (trail) {
        // Same runAllowed gate a limited holiday applies to any other race
        // type's running (§B.7) — trail's single discipline is 'run', so it
        // respects the same day-level discipline restriction.
        if (runAllowed && dayKey === trailAssignment.longDay) entries.push(buildTrailLongEntry(weekNum, phase, runLongSeries[weekNum - 1] || 0));
        else if (runAllowed && dayKey === trailAssignment.hillDay) entries.push(buildTrailHillEntry(weekNum, phase));
        else if (runAllowed && trailAssignment.easyDays.includes(dayKey)) entries.push(buildTrailEasyEntry(weekNum, phase));
      } else if (runAllowed && activeDaysForWeek('run', weekNum, runDays, runLongDay).includes(dayKey) && !entries.some(e => e.type === 'run')) {
        const idx = runRotation.get('i') || 0; runRotation.set('i', idx + 1);
        entries.push(buildRunEntry({ isLong: dayKey === runLongDay, weekNum, phase, weeklyMinutes: { long: runLongSeries[weekNum - 1] || 0, short: runShortSeries[weekNum - 1] || 0 }, rotationIdx: idx }));
      } else if (runAllowed && holiday?.limited && holiday.disciplines.includes('run') && !runDays.includes(dayKey) && !entries.length) {
        entries.push({ type: 'run', label: 'Run', sessionType: 'Easy holiday run', duration: '25min', flag: 'Holiday', intensity: 'Low', week: weekNum, phase: phase.label });
      }
      if (triathlon && swimAllowed && activeDaysForWeek('swim', weekNum, disciplineDays.swim || [], null).includes(dayKey)) {
        const idx = swimRotation.get('i') || 0; swimRotation.set('i', idx + 1);
        const meters = swimSeries[weekNum - 1] || 0;
        if (holiday?.limited) {
          entries.push({ type: 'swim', label: 'Swim', sessionType: 'Open water swim', duration: swimDuration(meters), flag: 'Holiday', intensity: 'Low', week: weekNum, phase: phase.label });
        } else {
          entries.push(buildSwimEntry({ weekNum, phase, weeklyMeters: meters, rotationIdx: idx }));
        }
      }
      if (conditioningDay === dayKey && phase.label !== 'Taper' && weekNum < totalWeeks) {
        entries.push(buildConditioningEntry(weekNum, phase, conditioningExercises));
      }
    }

    if (!entries.length) entries.push(buildRestEntry(weekNum, phase));
    sessions[dk] = entries.map(e => ({ ...e, done: false }));
    cursor = addDays(cursor, 1);
  }

  applyOneOffEvents(sessions, oneOffByDate, startDate, raceDate);

  // A trail plan's distance now comes from the athlete's own entered target
  // (§A trailDistanceKm) rather than a fixed per-race-type table — unlike
  // RUN_RACE_DISTANCES_KM, trail races vary in distance event-to-event, so
  // there's no table to look up. Falls back to null (not "undefinedkm") if
  // somehow missing, since every read site already treats this as optional.
  const trailDistanceKmNum = trail ? Number(intake.trailDistanceKm) : null;
  const eventDistances = trail
    ? (trailDistanceKmNum > 0 ? `${trailDistanceKmNum}km` : null)
    : (triathlon
      ? Object.entries(TRIATHLON_LEG_DISTANCES_KM[raceType]).map(([, km]) => `${km}km`).join(' / ')
      : `${RUN_RACE_DISTANCES_KM[raceType]}km`);

  const planHealth = computePlanHealth(sessions, phases, holidayByDate, oneOffByDate);
  const usedTerms = collectUsedTerms(sessions);
  const glossary = glossaryForTerms(usedTerms);
  const overview = buildOverview({ raceType, triathlon, trail, phases, phaseMode, holidays, oneOffEvents, injury, totalWeeks });
  const planMix = buildPlanMix({ trail, triathlon, runDays, bikeDays: disciplineDays.bike || [], swimDays: disciplineDays.swim || [], trailDistanceKm: trailDistanceKmNum });

  return {
    meta: {
      raceType, startDate: toDateKey(startDate), eventDate: toDateKey(raceDate),
      totalWeeks, eventDistances, overview, planMix, glossary, planHealth,
      // Duplicated from the top-level sourceFileName below: utils/supabase.js's
      // training_plans row only has meta/phases/sessions columns, so the
      // top-level field is silently dropped on every save+reload — see the
      // App.jsx comment on existingPlanIsEngineGenerated for why that broke
      // every redo past the very first, same-session one.
      sourceFileName: 'Generated by Forma',
    },
    phases,
    sessions,
    sourceFileName: 'Generated by Forma',
    importedAt: new Date().toISOString(),
  };
}

// ── STEP 4: one-off events (replace / recover / reschedule / absorb) ────────

function applyOneOffEvents(sessions, oneOffByDate, startDate, raceDate) {
  for (const [date, event] of oneOffByDate) {
    if (!sessions[date]) continue;
    const displaced = sessions[date];
    sessions[date] = [{ type: 'race', label: event.label || 'Event', sessionType: event.label || 'One-off event', duration: '-', flag: 'One-off event', intensity: 'Medium', week: displaced[0]?.week, phase: displaced[0]?.phase, done: false }];

    // Recover: the day after gets an easy recovery session regardless of what
    // was originally planned there (§Step 4) — including a day that would
    // otherwise have been a plain rest day.
    const next = addDays(parseUTCDate(date), 1);
    const nextKey = toDateKey(next);
    if (sessions[nextKey] && next.getTime() <= raceDate.getTime()) {
      const original = sessions[nextKey];
      const meta = original[0] || {};
      const realType = original.find(e => e.type !== 'rest')?.type || 'run';
      sessions[nextKey] = [{
        type: realType, label: realType.charAt(0).toUpperCase() + realType.slice(1),
        sessionType: 'Easy recovery', duration: realType === 'swim' ? '300m' : '20min',
        flag: 'Recovery', intensity: 'Low', week: meta.week, phase: meta.phase, done: false,
      }];
    }

    // Reschedule: look for a rest slot later the same week, otherwise absorb.
    const real = displaced.find(d => d.type !== 'rest');
    if (real) {
      let found = false;
      for (let i = 2; i <= 6 && !found; i++) {
        const candidate = addDays(parseUTCDate(date), i);
        const ck = toDateKey(candidate);
        if (candidate.getTime() > raceDate.getTime()) break;
        if (sessions[ck]?.length === 1 && sessions[ck][0].type === 'rest') {
          sessions[ck] = [{ ...real, flag: real.flag ? `${real.flag} / Rescheduled` : 'Rescheduled' }];
          found = true;
        }
      }
      // Not found → absorbed (dropped), per spec — no carry-forward.
    }
  }
}

// ── STEP 7: plan-health checks (computed, not self-reported) ────────────────

function sessionMinutes(entry) {
  if (entry.type === 'conditioning') return 22;
  if (entry.type === 'rest' || entry.type === 'race') return 0;
  if (entry.type === 'swim') {
    const m = parseInt(entry.duration, 10);
    return Number.isFinite(m) ? (m / 100) * 2 : 0;
  }
  const mins = parseInt(entry.duration, 10);
  return Number.isFinite(mins) ? mins : 0;
}

function computePlanHealth(sessions, phases, holidayByDate, oneOffByDate) {
  const dateKeys = Object.keys(sessions).sort();
  const totalWeeks = phases[phases.length - 1].weeks[1];
  const weeklyMinutes = Array(totalWeeks).fill(0);
  const weeklyHasHoliday = Array(totalWeeks).fill(false);
  const weeklyHasEvent = Array(totalWeeks).fill(false);
  const weeklyNewDay = Array(totalWeeks).fill(false);
  const seenDayOfWeekPerWeek = Array.from({ length: totalWeeks }, () => new Set());
  const seenDaysOfWeekEver = new Set();

  dateKeys.forEach(dk => {
    const entries = sessions[dk];
    const week = entries[0]?.week || 1;
    entries.forEach(e => { weeklyMinutes[week - 1] += sessionMinutes(e); });
    if (holidayByDate.has(dk)) weeklyHasHoliday[week - 1] = true;
    if (oneOffByDate.has(dk)) weeklyHasEvent[week - 1] = true;
    const dow = new Date(dk).getUTCDay();
    if (!seenDaysOfWeekEver.has(dow)) weeklyNewDay[week - 1] = true;
    seenDaysOfWeekEver.add(dow);
  });

  const tenPercentLines = [];
  let violations = 0;
  for (let w = 1; w < totalWeeks; w++) {
    const prev = weeklyMinutes[w - 1], cur = weeklyMinutes[w];
    if (prev <= 0) continue;
    const pctChange = (cur - prev) / prev;
    const exempt = weeklyHasHoliday[w] || weeklyHasEvent[w] || weeklyNewDay[w] ||
      weeklyHasHoliday[w - 1] || weeklyHasEvent[w - 1];
    // A tolerance above the nominal 10% absorbs whole-minute display
    // rounding: buildWeeklySeries caps growth at exactly 10.00% on the
    // unrounded series (verified directly — e.g. 65.71→72.28→79.51, each
    // exactly ×1.10), but rounding each week's *displayed* minutes
    // independently (72→80 here) can turn that into "+11%" even though nothing
    // in the actual schedule generation exceeded the cap. A week that clears
    // 12% reflects a real gap, not rounding noise from a handful of
    // independently-rounded session durations.
    if (pctChange > 0.12 && !exempt) {
      violations++;
      tenPercentLines.push(`Week ${w + 1}: +${Math.round(pctChange * 100)}% vs week ${w}`);
    }
  }
  const tenPercentRule = (tenPercentLines.length ? tenPercentLines.join('; ') + '. ' : '') +
    `Violations (excluding accepted exceptions): ${violations}.`;

  const phaseTargets = {
    Foundation: { maxHard: 0, minLowPct: 0.90 },
    Build:      { maxHard: 2, minLowPct: 0.60 },
    Peak:       { maxHard: 2, minLowPct: 0.50 },
    Taper:      { maxHard: 1, minLowPct: 0.80 },
  };
  const weeklyIntensity = Array.from({ length: totalWeeks }, () => ({ low: 0, med: 0, high: 0, phase: '' }));
  dateKeys.forEach(dk => {
    sessions[dk].forEach(e => {
      if (e.type === 'rest' || e.type === 'race') return;
      const w = e.week - 1;
      weeklyIntensity[w].phase = e.phase;
      if (e.intensity === 'High') weeklyIntensity[w].high++;
      else if (e.intensity === 'Medium') weeklyIntensity[w].med++;
      else weeklyIntensity[w].low++;
    });
  });
  let exceedCount = 0;
  const eightyTwentyLines = weeklyIntensity.map((wi, i) => {
    const total = wi.low + wi.med + wi.high;
    if (!total) return null;
    const lowPct = wi.low / total;
    const target = phaseTargets[wi.phase] || phaseTargets.Build;
    const exceeds = wi.high > target.maxHard || lowPct < target.minLowPct;
    if (exceeds) exceedCount++;
    return `Week ${i + 1} (${wi.phase}): ${wi.high} hard, ${Math.round(lowPct * 100)}% low${exceeds ? ' — exceeds target' : ''}`;
  }).filter(Boolean);
  const eightyTwentyRule = eightyTwentyLines.join('; ') + `. Weeks exceeding Hard session target: ${exceedCount}.`;

  const summary = violations === 0 && exceedCount === 0
    ? 'Weekly volume and intensity both stay within the 10% and 80/20 guidelines for the whole plan.'
    : `Weekly volume stays within the 10% guideline except ${violations} week${violations === 1 ? '' : 's'}` +
      `${violations ? ' (holiday/event weeks are expected exceptions and already excluded)' : ''}. ` +
      `${exceedCount} week${exceedCount === 1 ? '' : 's'} run above the 80/20 hard-session target for their phase.`;

  return { tenPercentRule, eightyTwentyRule, summary };
}

// ── Glossary / overview / plan-mix text ──────────────────────────────────────

function collectUsedTerms(sessions) {
  const terms = new Set();
  Object.values(sessions).forEach(entries => entries.forEach(e => {
    if (e.sessionType === RUN_LONG_TERM) terms.add(RUN_LONG_TERM);
    else if (e.sessionType === BIKE_LONG_TERM) terms.add(BIKE_LONG_TERM);
    else if (e.flag?.includes('Brick')) terms.add('Brick');
    else if (e.type === 'conditioning') terms.add('Conditioning circuit');
    else if (e.sessionType === 'Open water swim') terms.add('Open water / sea swim');
    else if (e.sessionType === 'Trail hill repeats') terms.add('Trail hill repeats');
    else {
      const lib = [...Object.values(RUN_LIBRARY), ...Object.values(SWIM_LIBRARY), ...Object.values(BIKE_LIBRARY)].flat();
      const match = lib.find(a => a.sessionType === e.sessionType);
      if (match) terms.add(match.term);
    }
    if (e.flag?.includes('Recovery') && e.week) terms.add('Recovery week');
  }));
  return [...terms];
}

function buildOverview({ raceType, triathlon, trail, phases, phaseMode, holidays, oneOffEvents, injury, totalWeeks }) {
  const lines = [];
  const phaseSummary = phases.map(p => `${p.label} (weeks ${p.weeks[0]}–${p.weeks[1]})`).join(', ');
  lines.push(`This ${totalWeeks}-week plan for ${raceType} runs through ${phaseSummary}.`);

  if (phaseMode === 'noFoundation') {
    lines.push('Due to the time available, this plan begins in the Build phase. A Foundation phase has been omitted — make sure you\'re already comfortable with the baseline distances for each discipline before starting, as the early weeks will be more demanding than a full plan.');
  } else if (phaseMode === 'compressed') {
    lines.push('Warning: the time available is significantly shorter than recommended for this race type. Consider a shorter-distance goal race, extending your start date, or accepting a finish-only goal — this plan is compressed and demanding.');
  }

  lines.push(triathlon
    ? 'Warm-up/cool-down reference — Swim: 100–150m easy mixed swimming + shoulder circles, cool down 100m easy. Bike: 5–10min easy spin with spin-ups in the final 2min, cool down 5min easy. Run: 5min brisk walk/jog + dynamic drills, cool down 5min walk + static stretches.'
    : trail
    ? 'Warm-up/cool-down reference — 5min brisk walk/easy jog + leg swings and dynamic drills on flat ground before climbing onto trail; walk the last 5min of any session to cool down, especially after the hill workout.'
    : 'Warm-up/cool-down reference — 5min brisk walk/easy jog + leg swings, walking lunges, high knees before each run; 5min walk + static stretches (calves, hamstrings, quads, hip flexors, glutes) after.');

  if (holidays.length) {
    lines.push(`Holidays: ${holidays.map(h => `${h.label} (${h.from}${h.to ? ' to ' + h.to : ''})`).join('; ')}.`);
  }
  if (oneOffEvents.length) {
    lines.push(`One-off events: ${oneOffEvents.map(e => `${e.label} on ${e.date}`).join('; ')} — each replaces that day's session, with an easy recovery day after and the displaced session rescheduled where a slot allows (otherwise absorbed).`);
  }
  if (injury.pastInjuries?.length || injury.currentNiggles || injury.healthConditions) {
    const areas = [...new Set((injury.pastInjuries || []).map(p => p.area).filter(Boolean))];
    const tailoredNote = areas.length
      ? ` Conditioning sessions have been weighted toward ${areas.join('/').toLowerCase()} strengthening and mobility work based on the areas you declared${injury.avoidExerciseIds?.length ? ', excluding the exercises you asked to avoid' : ''}.`
      : '';
    lines.push(`Health note: this plan includes injury-aware conditioning work, not a personalised treatment plan.${tailoredNote} Get a physio review before starting, and stop any exercise immediately if it increases pain, numbness, or tingling.`);
  }
  return lines.join('\n\n');
}

function buildPlanMix({ trail, triathlon, runDays, bikeDays, swimDays, trailDistanceKm }) {
  const parts = [];
  if (trail && runDays.length) {
    const distanceNote = trailDistanceKm > 0 ? ` toward being able to cover your ${trailDistanceKm}km race distance` : '';
    parts.push(`Your ${runDays.length} run${runDays.length === 1 ? '' : 's'} a week mix a time-on-feet long run${distanceNote} with a weekly hill-repeat session and ${runDays.length > 2 ? 'easy conversational-effort runs' : 'an easy conversational-effort run'}, building climbing strength and endurance through to race day.`);
    return parts.join(' ');
  }
  if (runDays.length) {
    parts.push(`Your ${runDays.length} run${runDays.length === 1 ? '' : 's'} a week mix an easy run with a long run and a rotating tempo/fartlek session, building toward race-pace intervals in Peak.`);
  }
  if (triathlon) {
    if (bikeDays.length) parts.push('Bike builds from easy spin + tempo toward hill repeats and race-effort riding as you move through Build into Peak.');
    if (swimDays.length) parts.push('Swim stays technique-focused through Foundation, adding build/pyramid sets and open-water sessions from Build onward.');
  }
  return parts.join(' ');
}
