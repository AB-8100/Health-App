/**
 * overtrain.js — Session Sequencing Advisor (overtraining redesign v2).
 *
 * Replaces the old four-rule aggregate weekly checker with a pairwise
 * sequencing decision engine (spec: "Session Sequencing Advisor
 * (Overtraining Redesign v2)"). The actual resolution/decision logic is pure
 * and lives in sessionLoadEstimate.js so it's testable without a Supabase
 * connection; this file is just the thin async layer that owns the
 * activity_catalog cache (renamed from ref_activities — see
 * features/specs/weekly-overview-add-session-activity-matrix.md §A) and
 * adapts the app's Weekly Overview session shape into that pure engine's
 * input.
 *
 * personalRpeHistory (the resolver's "have I seen this session name before"
 * input) is derived straight from the app's `completedSessions` state
 * (buildPersonalRpeHistory) rather than a dedicated Supabase table —
 * completedSessions is already loaded in full on every session (see
 * utils/supabase.js loadUserData), so a separate session_rpe_log table would
 * duplicate data already in memory for no query-shape benefit. (Spec §6/§9
 * flagged this as an open technical-spike question before writing the
 * resolver — this is that decision.)
 *
 * Primary export: checkWeek(weekData, completedSessions?)
 *   weekData: the array buildWeekData() (WeeklyOverviewScreen.jsx) produces
 *   returns:  Promise<Array<DecisionObject>> — spec §5 P0.5 shape
 */

import { supabase } from './supabase';
import {
  findRef, buildPersonalRpeHistory, resolveExpectedLoad, buildSequencingDecisions,
  parseDurationMinutes,
} from './sessionLoadEstimate';

// Re-exported for any external caller still expecting overtrain.js to be the
// home of ref-matching (only getActivityCatalog is actually imported
// elsewhere today, but keeping findRef here preserves the prior public API).
export { findRef };

// ── activity_catalog cache ──────────────────────────────────────────────────
// Module-level so multiple callers share one fetch per session.

let _catalogCache = null;
let _catalogPending = null;

export async function getActivityCatalog() {
  if (_catalogCache)   return _catalogCache;
  if (_catalogPending) return _catalogPending;

  _catalogPending = supabase
    .from('activity_catalog')
    .select('name, category, type, leg_load, upper_load, cardio_load, core_load, recovery_hours, intensity_default')
    .then(({ data, error }) => {
      if (error) console.warn('Forma: activity_catalog fetch failed', error);
      _catalogCache   = data || [];
      _catalogPending = null;
      return _catalogCache;
    });

  return _catalogPending;
}

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Flattens buildWeekData()'s per-day session shape into the flat, dated
// session list resolveExpectedLoad/buildSequencingDecisions expect.
function flattenWeekData(weekData) {
  const flat = [];
  weekData.forEach(day => {
    (day.sessions || []).forEach(s => {
      flat.push({
        id: s.id,
        dayLabel: DAY_SHORT[day.dayIdx] || day.dayIdx,
        date: day.dk,
        name: s.label || s.type || '',
        type: s.type,
        eventPlanTag: s.raw?.sessionType || s.detail || null,
        durationMinutes: parseDurationMinutes(s.raw?.duration ?? s.actData?.duration),
      });
    });
  });
  return flat;
}

/**
 * Runs the full sequencing check for a week. Must run on page load / week
 * render (not just after a drag) — spec P0.7, previously a known gap since
 * this was only ever invoked from the drag handler.
 *
 * @param {Array} weekData  buildWeekData() output (WeeklyOverviewScreen.jsx)
 * @param {Array} completedSessions  app's completedSessions state (for personal RPE history)
 * @returns {Promise<Array>} decision objects, spec §5 P0.5
 */
export async function checkWeek(weekData, completedSessions = []) {
  const ref = await getActivityCatalog();
  const personalRpeHistory = buildPersonalRpeHistory(completedSessions);

  const resolvedSessions = flattenWeekData(weekData).map(s => ({
    ...s,
    resolved: resolveExpectedLoad(s, personalRpeHistory, ref),
    // Name first — it's the specific activity ("Football"), type/discipline
    // is often just a broad category ("team_sport") that won't match
    // activity_catalog.name directly, though it can for the event-plan
    // disciplines (run/swim/bike/...) that overlap with activity_catalog rows.
    matchedRef: findRef(s.name, ref) || findRef(s.type, ref),
  }));

  return buildSequencingDecisions(resolvedSessions, weekData.map(day => day.dk));
}
