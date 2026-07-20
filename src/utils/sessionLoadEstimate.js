/**
 * sessionLoadEstimate.js — pure, dependency-free logic for the Session
 * Sequencing Advisor (overtraining redesign v2, see spec §5 P0.1–P0.6).
 *
 * No Supabase import here on purpose — resolveExpectedLoad and
 * buildSequencingDecisions are meant to be testable in isolation (spec §6).
 * `overtrain.js` (which does own the Supabase ref_activities cache) is the
 * thin async orchestrator that feeds this module real data.
 */

import { SESSION_TYPE_INTENSITY, classifySessionTier } from '../data/sessionDisplay';

// ── Configurable thresholds (spec §5 P0.3, kept as named constants rather
// than inlined magic numbers so they're easy to tune post-launch — see §9) ──
export const HIGH_INTENSITY_RPE_THRESHOLD = 7;
export const WEEKLY_HARD_SESSION_RATIO_THRESHOLD = 0.2;
// How many logged instances of a session name count as "personalized" before
// trusting the average over the generic/tag-based tiers (spec §8: with only
// 1 entry, fall through to tier 3/4 rather than treat it as personalized).
export const MIN_PERSONAL_SAMPLES = 2;
// RPE-equivalent used for event-plan-tagged sessions with no personal RPE
// yet (P0.1 tier 3), so same-day/next-day checks can compare tag-based and
// RPE-based sessions on one scale.
export const TIER_RPE_EQUIVALENT = { high: 8, medium: 5, low: 2 };

// ── Ref-activities load scoring (moved here from overtrain.js so this module
// stays free of the Supabase-backed ref cache; overtrain.js re-exports these
// for any external caller that still wants them) ───────────────────────────
export const LOAD_VAL = { high: 3, medium: 2, low: 1, none: 0 };

export const FALLBACK_LOAD = {
  cardio: { swim: 2, bike: 3, run: 3, brick: 3, conditioning: 2, gym: 1, rest: 0 },
  leg:    { swim: 1, bike: 3, run: 3, brick: 3, conditioning: 2, gym: 3, rest: 0 },
  upper:  { swim: 2, bike: 0, run: 0, brick: 1, conditioning: 2, gym: 3, rest: 0 },
};

export function scoreLoad(str) {
  return LOAD_VAL[str] ?? 0;
}

/**
 * Find the best matching ref_activity for an activity or session name.
 * Strategy: exact → prefix → substring (unchanged from the original
 * overtrain.js implementation).
 */
export function findRef(name, refActivities) {
  if (!name || !refActivities?.length) return null;
  const lower = name.toLowerCase();

  let m = refActivities.find(r => r.name.toLowerCase() === lower);
  if (m) return m;

  const keyword = lower.replace(/\(.*$/, '').trim();
  m = refActivities.find(r => r.name.toLowerCase().startsWith(keyword));
  if (m) return m;

  m = refActivities.find(r => {
    const token = r.name.toLowerCase().replace(/\(.*$/, '').trim();
    return lower.includes(token) && token.length > 3;
  });
  return m || null;
}

const CATEGORY_FIELDS = ['leg_load', 'upper_load', 'cardio_load', 'core_load'];

// The single load bucket (leg/upper/cardio/core) a ref_activities row loads
// hardest on. Returns null if every bucket is 'none' (no ref, or a genuinely
// neutral activity) so callers can't accidentally match two unrelated
// "none" sessions as sharing a category.
export function dominantCategory(ref) {
  if (!ref) return null;
  let best = null, bestScore = -1;
  for (const field of CATEGORY_FIELDS) {
    const score = scoreLoad(ref[field]);
    if (score > bestScore) { bestScore = score; best = field; }
  }
  return bestScore > 0 ? best : null;
}

// Next-day check (P0.4) requires the two sessions to share a dominant
// muscle-group/load category — same-day (P0.3) does not. Matches the
// original overtrain.js Rule 1 semantics (`curr.load.leg >= 2 && next.load.leg
// >= 2`), generalised across all four buckets rather than a single "highest
// bucket must match exactly" comparison — e.g. football's dominant bucket is
// leg, but an easy run's is cardio; both still load the cardio bucket at
// medium+, which is the actual recovery-relevant overlap.
export function sharesDominantCategory(refA, refB) {
  if (!refA || !refB) return false;
  return CATEGORY_FIELDS.some(f => scoreLoad(refA[f]) >= LOAD_VAL.medium && scoreLoad(refB[f]) >= LOAD_VAL.medium);
}

// ── Name normalization + personal RPE history ───────────────────────────────

export function normalizeSessionName(name) {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Parses a duration value that may already be a number (minutes) or a
// loosely-formatted string from an uploaded plan / manual entry (e.g.
// "45min", "6x800m"). Returns null when nothing numeric can be found so
// callers fall back to a sane default rather than NaN.
export function parseDurationMinutes(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const match = String(raw).match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

// Builds the `personalRpeHistory` input resolveExpectedLoad expects, directly
// from the app's already-fully-loaded `completedSessions` state — see the
// module doc in overtrain.js for why this replaces a dedicated
// session_rpe_log table (spec §6/§9 technical spike).
export function buildPersonalRpeHistory(completedSessions = []) {
  return completedSessions
    .filter(s => s && s.rpe != null && (s.workout || s.type))
    .map(s => ({
      session_name_normalized: normalizeSessionName(s.workout || s.type),
      rpe: Number(s.rpe),
      duration_minutes: s.elapsed ? Math.round(s.elapsed / 60) : null,
      completed_at: s.date || (s.endedAt ? new Date(s.endedAt).toISOString() : null),
    }))
    .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));
}

function average(nums) {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

// Fuzzy tier (P0.1 tier 2) — only meaningfully exercised by the one free-text
// entry point in the app (WeeklyOverviewScreen's "Add session" panel, when
// the activity-name field falls back to typed text or the always-free-text
// "session type" description); everywhere else session names come from
// fixed picklists so exact match (tier 1) already covers it.
function fuzzyMatchHistory(normalizedName, historyByName) {
  if (!normalizedName) return null;
  const names = Object.keys(historyByName);
  let match = names.find(n => n.length > 3 && normalizedName.includes(n));
  if (!match) match = names.find(n => normalizedName.length > 3 && n.includes(normalizedName));
  return match || null;
}

function matchedKeywordForTier(text, tier) {
  const lower = String(text || '').toLowerCase();
  const keywords = SESSION_TYPE_INTENSITY[tier] || [];
  return keywords.find(kw => lower.includes(kw)) || tier;
}

/**
 * The tiered resolver from spec §5 P0.1 / §7.
 *
 * @param {{name?: string, type?: string, eventPlanTag?: string, durationMinutes?: number|null}} session
 * @param {Array<{session_name_normalized: string, rpe: number, duration_minutes: number|null, completed_at: string|null}>} personalRpeHistory
 * @param {Array} refActivities
 * @returns {{expectedLoad: number, confidence: 'high'|'medium'|'low'|'none', source: string, rpe: number|null, tier: string|null, sampleCount: number, matchedKeyword: string|null}}
 */
export function resolveExpectedLoad(session, personalRpeHistory = [], refActivities = []) {
  const durationFactor = (session?.durationMinutes || 60) / 60;

  if (!session || (!session.name && !session.type)) {
    return { expectedLoad: 0, confidence: 'none', source: 'invalid-session', rpe: null, tier: null, sampleCount: 0, matchedKeyword: null };
  }

  const normalized = normalizeSessionName(session.name);

  // Tier 1 — exact match, >=2 personal RPE entries.
  if (normalized) {
    const exact = personalRpeHistory.filter(h => h.session_name_normalized === normalized);
    if (exact.length >= MIN_PERSONAL_SAMPLES) {
      const rpe = average(exact.map(h => h.rpe));
      return {
        expectedLoad: rpe * durationFactor,
        confidence: 'high',
        source: `personal:${normalized}`,
        rpe, tier: null, sampleCount: exact.length, matchedKeyword: null,
      };
    }

    // Tier 2 — fuzzy match against distinct personal history names.
    const historyByName = {};
    personalRpeHistory.forEach(h => {
      if (!historyByName[h.session_name_normalized]) historyByName[h.session_name_normalized] = [];
      historyByName[h.session_name_normalized].push(h);
    });
    const fuzzyName = fuzzyMatchHistory(normalized, historyByName);
    if (fuzzyName) {
      const fuzzyEntries = historyByName[fuzzyName];
      if (fuzzyEntries.length >= MIN_PERSONAL_SAMPLES) {
        const rpe = average(fuzzyEntries.map(h => h.rpe));
        return {
          expectedLoad: rpe * durationFactor,
          confidence: 'medium',
          source: `personal-fuzzy:${fuzzyName}`,
          rpe, tier: null, sampleCount: fuzzyEntries.length, matchedKeyword: null,
        };
      }
    }
  }

  // Tier 3 — no personal match, but an event-plan type tag classifies.
  const tagSource = session.eventPlanTag || session.name;
  const tier = classifySessionTier(tagSource);
  if (tier) {
    return {
      expectedLoad: TIER_RPE_EQUIVALENT[tier] * durationFactor,
      confidence: 'low',
      source: `event-tag:${tier}`,
      rpe: null, tier, sampleCount: 0,
      matchedKeyword: matchedKeywordForTier(tagSource, tier),
    };
  }

  // Tier 4 — generic ref_activities / FALLBACK_LOAD lookup (no regression
  // vs. the pre-existing behaviour).
  const ref = findRef(session.name || session.type, refActivities);
  if (ref) {
    return {
      expectedLoad: scoreLoad(ref.intensity_default) * durationFactor,
      confidence: 'none',
      source: `generic-ref:${ref.name}`,
      rpe: null, tier: null, sampleCount: 0, matchedKeyword: null,
    };
  }
  const key = session.type in FALLBACK_LOAD.cardio ? session.type : 'conditioning';
  return {
    expectedLoad: LOAD_VAL.medium * durationFactor,
    confidence: 'none',
    source: FALLBACK_LOAD.cardio[key] != null ? `generic-fallback:${key}` : 'generic-fallback',
    rpe: null, tier: null, sampleCount: 0, matchedKeyword: null,
  };
}

// High-intensity per spec P0.3: personal/fuzzy RPE >=7, OR a tag-classified
// 'high' tier. Generic fallback (confidence 'none') is never high-intensity
// on its own — there's no real signal behind it, and asserting otherwise
// would reintroduce the "everything defaults to medium" noise this feature
// is replacing.
export function isHighIntensity(resolved) {
  if (!resolved) return false;
  if (resolved.confidence === 'high' || resolved.confidence === 'medium') {
    return resolved.rpe != null && resolved.rpe >= HIGH_INTENSITY_RPE_THRESHOLD;
  }
  if (resolved.confidence === 'low') {
    return resolved.tier === 'high';
  }
  return false;
}

// ── P0.6 — confidence surfaced in UI copy ───────────────────────────────────
// Every phrase carries a qualifier ("likely"/"possibly") plus the basis for
// the estimate, per spec: no prompt should assert load as fact when
// confidence is below 'high'.
export function describeLoadCopy(resolved, sessionName) {
  const name = sessionName || 'this session';
  switch (resolved?.confidence) {
    case 'high':
    case 'medium':
      return `likely high load (based on your last ${resolved.sampleCount} ${name} session${resolved.sampleCount === 1 ? '' : 's'})`;
    case 'low':
      return `likely high load (based on session type — ${resolved.matchedKeyword})`;
    default:
      return `possibly high load (estimated — no logged data yet for ${name})`;
  }
}

// ── P0.3 / P0.4 / P0.5 — same-day + next-day checks, decision-object output ─

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1, none: 0 };
const DAY_MS = 86400000;

function dateToUTCms(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

function higherConfidence(a, b) {
  return (CONFIDENCE_RANK[a] ?? -1) >= (CONFIDENCE_RANK[b] ?? -1) ? a : b;
}

// `reasonSession` is whichever session's load is actually driving the
// conflict (itself, for same-day; the earlier session, for next-day) —
// that's whose confidence-qualified copy belongs in the explanation, not
// necessarily the session being acted on (P0.4: the later session can be a
// perfectly ordinary easy run, it's the *earlier* session's load and the
// recovery window that's the risk).
function buildKeepOption(actionSession, reasonSession) {
  const causeClause = reasonSession !== actionSession
    ? ` ${reasonSession.dayLabel} ${reasonSession.name} was ${describeLoadCopy(reasonSession.resolved, reasonSession.name)}.`
    : ` ${describeLoadCopy(reasonSession.resolved, reasonSession.name)}.`;
  return {
    type: 'keep',
    detail: `Keep ${actionSession.name} as scheduled —${causeClause} You know your training best.`,
  };
}

function buildReduceOption(actionSession, reasonSession) {
  const causeClause = reasonSession !== actionSession
    ? `${reasonSession.dayLabel} ${reasonSession.name} was ${describeLoadCopy(reasonSession.resolved, reasonSession.name)}, and it falls inside the recovery window`
    : describeLoadCopy(reasonSession.resolved, reasonSession.name);
  return {
    type: 'reduce',
    detail: `Lower the intensity or duration of ${actionSession.name} — ${causeClause}.`,
  };
}

// A day is "safe" to move `session` onto if it wouldn't itself immediately
// create a new same-day (2+ high-intensity) or next-day (recovery-window +
// shared category) conflict against the rest of that week's sessions.
function isSafeMoveTarget(candidateDate, session, allSessions) {
  const others = allSessions.filter(s => s !== session);
  const sameDayOthers = others.filter(s => s.date === candidateDate);
  // Two high-intensity sessions stacked same-day (P0.3's own trigger).
  if (isHighIntensity(session.resolved) && sameDayOthers.some(s => isHighIntensity(s.resolved))) {
    return false;
  }
  // Landing directly on the same day as a high-intensity session that shares
  // a dominant load category is exactly what "more recovery room" is meant
  // to avoid, regardless of the moved session's own intensity.
  if (sameDayOthers.some(s => isHighIntensity(s.resolved) && sharesDominantCategory(s.matchedRef, session.matchedRef))) {
    return false;
  }

  for (const other of others) {
    const otherRef = other.matchedRef;
    const movedRef = session.matchedRef;
    const diffDaysFromOther = Math.round((dateToUTCms(candidateDate) - dateToUTCms(other.date)) / DAY_MS);
    const recoveryDaysFromOther = Math.max(1, Math.ceil((otherRef?.recovery_hours ?? 24) / 24));
    if (diffDaysFromOther >= 1 && diffDaysFromOther <= recoveryDaysFromOther &&
        isHighIntensity(other.resolved) && sharesDominantCategory(otherRef, movedRef)) {
      return false;
    }

    const diffDaysToOther = Math.round((dateToUTCms(other.date) - dateToUTCms(candidateDate)) / DAY_MS);
    const recoveryDaysFromMoved = Math.max(1, Math.ceil((movedRef?.recovery_hours ?? 24) / 24));
    if (diffDaysToOther >= 1 && diffDaysToOther <= recoveryDaysFromMoved &&
        isHighIntensity(session.resolved) && sharesDominantCategory(movedRef, otherRef)) {
      return false;
    }
  }
  return true;
}

function buildMoveOption(session, allSessions, weekDates) {
  const candidates = weekDates.filter(dk => dk !== session.date && isSafeMoveTarget(dk, session, allSessions));
  return {
    type: 'move',
    detail: candidates.length
      ? `Move ${session.name} to a day with more recovery room.`
      : `No day this week avoids a conflict for ${session.name} — consider reducing instead.`,
    suggested_days: candidates,
  };
}

function buildDecisionOptions(actionSession, reasonSession, allSessions, weekDates) {
  return [
    buildReduceOption(actionSession, reasonSession),
    buildMoveOption(actionSession, allSessions, weekDates),
    buildKeepOption(actionSession, reasonSession),
  ];
}

/**
 * Pure decision engine — spec §5 P0.3/P0.4, output shape §5 P0.5.
 * @param {Array} resolvedSessions each `{ id, dayLabel, date, name, resolved, matchedRef }`
 * @param {string[]|null} allWeekDates every date in the week being viewed —
 *   including days with zero sessions — so "move" can actually suggest a
 *   genuinely empty rest day (P0.5: "any day in the current week ... with no
 *   existing conflict"). Falls back to the dates that appear in
 *   resolvedSessions when omitted (fine for tests that don't exercise empty
 *   days), but the real caller (overtrain.js's checkWeek) always passes the
 *   full 7-day list — resolvedSessions alone can't reconstruct rest days
 *   since they contribute no entries at all.
 * @returns {Array} decision objects, zero or more per week
 */
export function buildSequencingDecisions(resolvedSessions, allWeekDates = null) {
  const decisions = [];
  const weekDates = [...new Set(resolvedSessions.map(s => s.date))].sort();
  const moveCandidateDates = allWeekDates?.length ? [...new Set(allWeekDates)].sort() : weekDates;
  const byDate = {};
  resolvedSessions.forEach(s => { (byDate[s.date] ||= []).push(s); });

  const weekHighCount = resolvedSessions.filter(s => isHighIntensity(s.resolved)).length;
  const weekTotal = resolvedSessions.length;
  const weekHardRatio = weekTotal ? weekHighCount / weekTotal : 0;

  // ── P0.3 same-day ──────────────────────────────────────────────────────
  weekDates.forEach(date => {
    const sessions = byDate[date];
    if (sessions.length < 2) return;
    const highSessions = sessions.filter(s => isHighIntensity(s.resolved));

    const triggered = highSessions.length >= 2 ||
      (highSessions.length === 1 && weekHardRatio > WEEKLY_HARD_SESSION_RATIO_THRESHOLD);
    if (!triggered) return;

    const primary = highSessions[0];
    const confidence = highSessions.reduce((c, s) => higherConfidence(c, s.resolved.confidence), 'none');
    const names = sessions.map(s => s.name).join(' + ');
    const trigger = `${primary.dayLabel}: ${names} — both same-day, ${highSessions.length >= 2 ? 'both high-intensity' : "week's hard-session ratio leaves no slack"}`;

    decisions.push({
      trigger,
      check_type: 'same_day',
      confidence,
      options: buildDecisionOptions(primary, primary, resolvedSessions, moveCandidateDates),
      // Not part of the spec's literal output shape, but the UI needs to
      // know which day's card to render this under (P0.8 keeps the same
      // "below that day's session list" anchor the old warnings used).
      anchorDate: date,
    });
  });

  // ── P0.4 next-day (within the earlier session's recovery window) ───────
  for (let i = 0; i < weekDates.length; i++) {
    const earlierDate = weekDates[i];
    const earlierSessions = byDate[earlierDate].filter(s => isHighIntensity(s.resolved));
    if (!earlierSessions.length) continue;

    for (let j = i + 1; j < weekDates.length; j++) {
      const laterDate = weekDates[j];
      const diffDays = Math.round((dateToUTCms(laterDate) - dateToUTCms(earlierDate)) / DAY_MS);

      let pairTriggered = null;
      for (const earlier of earlierSessions) {
        const recoveryDays = Math.max(1, Math.ceil((earlier.matchedRef?.recovery_hours ?? 24) / 24));
        if (diffDays < 1 || diffDays > recoveryDays) continue;
        const later = byDate[laterDate].find(s => sharesDominantCategory(earlier.matchedRef, s.matchedRef));
        if (later) { pairTriggered = { earlier, later }; break; }
      }
      if (!pairTriggered) continue;

      const { earlier, later } = pairTriggered;
      const trigger = `${earlier.dayLabel} ${earlier.name} (high load) + ${later.dayLabel} ${later.name} — inside recovery window`;
      decisions.push({
        trigger,
        check_type: 'next_day',
        confidence: earlier.resolved.confidence,
        options: buildDecisionOptions(later, earlier, resolvedSessions, moveCandidateDates),
        anchorDate: laterDate,
      });
    }
  }

  return decisions;
}
