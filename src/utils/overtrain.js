/**
 * overtrain.js — training load analysis module
 *
 * Primary export: checkWeek(weekArray, priorWeekTotalLoad?)
 *   weekArray: [{day, date, activities: [{name, intensity, duration?}]}]
 *   returns:   [{day, conflict_type, severity, message}]
 *
 * Secondary export: checkDaySync(sessions, refActivities)
 *   Synchronous per-day check using pre-loaded ref data; used by the
 *   drag handler and detail panel.
 */

import { supabase } from './supabase';

// ── Ref-activities cache ──────────────────────────────────────────────────────
// Module-level so multiple callers share one fetch per session.

let _refCache = null;
let _refPending = null;

export async function getRefActivities() {
  if (_refCache)   return _refCache;
  if (_refPending) return _refPending;

  _refPending = supabase
    .from('ref_activities')
    .select('name, category, leg_load, upper_load, cardio_load, core_load, recovery_hours')
    .then(({ data, error }) => {
      if (error) console.warn('Forma: ref_activities fetch failed', error);
      _refCache   = data || [];
      _refPending = null;
      return _refCache;
    });

  return _refPending;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

const LOAD_VAL = { high: 3, medium: 2, low: 1, none: 0 };

// Hardcoded fallback used when the ref table is unavailable
const FALLBACK_LOAD = {
  cardio: { swim: 2, bike: 3, run: 3, brick: 3, conditioning: 2, gym: 1, rest: 0 },
  leg:    { swim: 1, bike: 3, run: 3, brick: 3, conditioning: 2, gym: 3, rest: 0 },
  upper:  { swim: 2, bike: 0, run: 0, brick: 1, conditioning: 2, gym: 3, rest: 0 },
};

function scoreLoad(str) {
  return LOAD_VAL[str] ?? 0;
}

/**
 * Find the best matching ref_activity for an activity or session name.
 * Strategy: exact → prefix → substring.
 */
export function findRef(name, refActivities) {
  if (!name || !refActivities?.length) return null;
  const lower = name.toLowerCase();

  // 1. Exact match
  let m = refActivities.find(r => r.name.toLowerCase() === lower);
  if (m) return m;

  // 2. Ref name appears as prefix of input (e.g. "running" matches "Running (tempo)")
  const keyword = lower.replace(/\(.*$/, '').trim();
  m = refActivities.find(r => r.name.toLowerCase().startsWith(keyword));
  if (m) return m;

  // 3. Key token of ref name appears in input
  m = refActivities.find(r => {
    const token = r.name.toLowerCase().replace(/\(.*$/, '').trim();
    return lower.includes(token) && token.length > 3;
  });
  return m || null;
}

/**
 * Compute the load profile for a single activity.
 * Returns { cardio, leg, upper, core, recoveryHours, matched }
 */
export function activityProfile(act, refActivities) {
  const ref             = findRef(act.name, refActivities);
  const intensityWeight = LOAD_VAL[act.intensity] ?? 1;
  const durationFactor  = (act.duration || 60) / 60; // normalise to 1-hour units

  if (ref) {
    return {
      cardio:        scoreLoad(ref.cardio_load) * intensityWeight * durationFactor,
      leg:           scoreLoad(ref.leg_load)    * intensityWeight * durationFactor,
      upper:         scoreLoad(ref.upper_load)  * intensityWeight * durationFactor,
      core:          scoreLoad(ref.core_load)   * intensityWeight * durationFactor,
      recoveryHours: ref.recovery_hours ?? 24,
      matched:       true,
    };
  }

  const flat = intensityWeight * durationFactor;
  return { cardio: flat, leg: flat, upper: flat, core: flat, recoveryHours: 24, matched: false };
}

// Sum all activities for a single day into one load object
function buildDayLoad(day, refActivities) {
  let cardio = 0, leg = 0, upper = 0, core = 0, maxRecovery = 0;
  const acts = day.activities || [];

  acts.forEach(act => {
    const p   = activityProfile(act, refActivities);
    cardio   += p.cardio;
    leg      += p.leg;
    upper    += p.upper;
    core     += p.core;
    maxRecovery = Math.max(maxRecovery, p.recoveryHours);
  });

  return {
    cardio, leg, upper, core,
    total:        cardio + leg + upper,
    recoveryHours: maxRecovery,
    isActive:     acts.length > 0,
  };
}

// ── checkWeek ─────────────────────────────────────────────────────────────────

/**
 * Analyse a full week of training and return a list of conflicts.
 *
 * @param {Array<{day: string, date: string, activities: Array<{name: string, intensity: string, duration?: number}>}>} weekArray
 * @param {number|null} priorWeekTotalLoad  Sum of (cardio+leg+upper) scores for the prior week.
 *   Pass null to skip the load-delta rule (e.g. when prior-week data is unavailable).
 * @returns {Promise<Array<{day: string, conflict_type: string, severity: string, message: string}>>}
 */
export async function checkWeek(weekArray, priorWeekTotalLoad = null) {
  const ref      = await getRefActivities();
  const profiles = weekArray.map(day => ({ ...day, load: buildDayLoad(day, ref) }));
  const conflicts = [];

  // ── Rule 1: 48-hour muscle-group overlap ───────────────────────────────────
  // If a muscle group is loaded at medium+ on day N, and again at medium+ on
  // day N+1 or N+2, flag the later day.
  for (let i = 0; i < profiles.length; i++) {
    const curr = profiles[i];
    if (!curr.load.isActive) continue;

    for (let j = i + 1; j <= Math.min(i + 2, profiles.length - 1); j++) {
      const next = profiles[j];
      if (!next.load.isActive) continue;

      if (curr.load.leg >= 2 && next.load.leg >= 2) {
        conflicts.push({
          day:           next.day,
          conflict_type: '48hr_overlap',
          severity:      curr.load.leg >= 3 || next.load.leg >= 3 ? 'high' : 'medium',
          message:       `High leg load within 48hrs of ${curr.day} — incomplete recovery`,
        });
      }

      if (curr.load.upper >= 2 && next.load.upper >= 2) {
        conflicts.push({
          day:           next.day,
          conflict_type: '48hr_overlap',
          severity:      'medium',
          message:       `Upper body loaded within 48hrs of ${curr.day}`,
        });
      }
    }
  }

  // ── Rule 2: Load spike >15% vs prior week ─────────────────────────────────
  const weekTotal = profiles.reduce((s, d) => s + d.load.total, 0);
  if (priorWeekTotalLoad != null && priorWeekTotalLoad > 0) {
    const delta = (weekTotal - priorWeekTotalLoad) / priorWeekTotalLoad;
    if (delta > 0.15) {
      conflicts.push({
        day:           'week',
        conflict_type: 'load_spike',
        severity:      delta > 0.3 ? 'high' : 'medium',
        message:       `Training load up ${Math.round(delta * 100)}% vs last week — increase more gradually`,
      });
    }
  }

  // ── Rule 3: Back-to-back high-intensity days ───────────────────────────────
  // Both consecutive days have a combined load score ≥6 (two "high" muscle groups)
  for (let i = 0; i < profiles.length - 1; i++) {
    const curr = profiles[i];
    const next = profiles[i + 1];
    if (curr.load.total >= 6 && next.load.total >= 6) {
      conflicts.push({
        day:           next.day,
        conflict_type: 'consecutive_high',
        severity:      'medium',
        message:       `Back-to-back high intensity: ${curr.day} and ${next.day}`,
      });
    }
  }

  // ── Rule 4: Insufficient rest ──────────────────────────────────────────────
  const activeDays = profiles.filter(d => d.load.isActive).length;
  if (activeDays >= 6) {
    conflicts.push({
      day:           'week',
      conflict_type: 'insufficient_rest',
      severity:      'high',
      message:       `${activeDays} active days — schedule at least one rest day`,
    });
  }

  return conflicts;
}

// ── checkDaySync ──────────────────────────────────────────────────────────────
/**
 * Synchronous single-day check using pre-loaded ref data.
 * Returns string[] warning messages for inline chips.
 *
 * sessions: the WeeklyOverviewScreen session objects
 *   [{discipline, label, source, ...}]
 * refActivities: array from getRefActivities() (may be [])
 */
export function checkDaySync(sessions, refActivities) {
  const warnings = [];
  let cardio = 0, leg = 0, upper = 0;

  sessions.forEach(s => {
    // Try to match by label (e.g. "Push", "Swimming (moderate)") then discipline
    const name = s.label || s.discipline || '';
    const ref  = findRef(name, refActivities);

    if (ref) {
      cardio += scoreLoad(ref.cardio_load);
      leg    += scoreLoad(ref.leg_load);
      upper  += scoreLoad(ref.upper_load);
    } else {
      const d = s.discipline in FALLBACK_LOAD.cardio ? s.discipline : 'conditioning';
      cardio += FALLBACK_LOAD.cardio[d];
      leg    += FALLBACK_LOAD.leg[d];
      upper  += FALLBACK_LOAD.upper[d];
    }
  });

  if (cardio >= 5) warnings.push('High cardio load');
  if (leg    >= 5) warnings.push('High leg load');
  if (upper  >= 5) warnings.push('High upper load');
  return warnings;
}
