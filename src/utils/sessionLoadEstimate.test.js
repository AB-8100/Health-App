import { describe, it, expect } from 'vitest';
import {
  resolveExpectedLoad, isHighIntensity, buildPersonalRpeHistory, normalizeSessionName,
  buildSequencingDecisions, dominantCategory, sharesDominantCategory, describeLoadCopy,
  HIGH_INTENSITY_RPE_THRESHOLD, MEDIUM_INTENSITY_RPE_THRESHOLD, MIN_PERSONAL_SAMPLES,
  MAX_SESSIONS_PER_DAY,
} from './sessionLoadEstimate';

const FOOTBALL_REF = { name: 'Football', category: 'team_sport', leg_load: 'high', upper_load: 'low', cardio_load: 'high', core_load: 'low', recovery_hours: 48, intensity_default: 'high' };
const RUN_REF = { name: 'Running', category: 'endurance', leg_load: 'high', upper_load: 'none', cardio_load: 'high', core_load: 'low', recovery_hours: 24, intensity_default: 'medium' };
const YOGA_REF = { name: 'Yoga', category: 'mobility', leg_load: 'low', upper_load: 'low', cardio_load: 'none', core_load: 'medium', recovery_hours: 12, intensity_default: 'low' };
const GYM_FULL_BODY_REF = { name: 'Full body (gym)', category: 'gym', leg_load: 'high', upper_load: 'high', cardio_load: 'low', core_load: 'high', recovery_hours: 48, intensity_default: 'high' };
const REF_ACTIVITIES = [FOOTBALL_REF, RUN_REF, YOGA_REF, GYM_FULL_BODY_REF];

function rpeEntry(name, rpe, daysAgo = 1) {
  return {
    session_name_normalized: normalizeSessionName(name),
    rpe,
    duration_minutes: 60,
    completed_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  };
}

describe('resolveExpectedLoad — resolution chain (P0.1)', () => {
  it('uses the personalized average with >=2 logged RPE instances (confidence high)', () => {
    const history = [rpeEntry('football', 8, 1), rpeEntry('football', 9, 8), rpeEntry('football', 7, 15)];
    const result = resolveExpectedLoad({ name: 'Football', durationMinutes: 60 }, history, REF_ACTIVITIES);
    expect(result.confidence).toBe('high');
    expect(result.rpe).toBeCloseTo(8);
    expect(result.sampleCount).toBe(3);
    expect(result.tier).toBe('high'); // 8 >= HIGH_INTENSITY_RPE_THRESHOLD
  });

  it('does NOT use the personalized-only path with exactly 1 RPE entry — falls through', () => {
    const history = [rpeEntry('football', 9, 1)];
    const result = resolveExpectedLoad({ name: 'Football', durationMinutes: 60 }, history, REF_ACTIVITIES);
    expect(result.confidence).not.toBe('high');
  });

  it('fuzzy-matches an unseen name to a personalized name at medium confidence', () => {
    const history = [rpeEntry('football', 8, 1), rpeEntry('football', 8, 8), rpeEntry('football', 9, 15)];
    const result = resolveExpectedLoad({ name: '5-a-side football', durationMinutes: 60 }, history, REF_ACTIVITIES);
    expect(result.confidence).toBe('medium');
    expect(result.rpe).toBeCloseTo((8 + 8 + 9) / 3);
  });

  it('maps a personal RPE average onto low/medium/high consistently with the tag/ref tiers', () => {
    const lowHist = [rpeEntry('yoga', 2, 1), rpeEntry('yoga', 3, 8)];
    const medHist = [rpeEntry('yoga', 4, 1), rpeEntry('yoga', 5, 8)];
    const highHist = [rpeEntry('yoga', 8, 1), rpeEntry('yoga', 9, 8)];
    expect(resolveExpectedLoad({ name: 'Yoga', durationMinutes: 60 }, lowHist, []).tier).toBe('low');
    expect(resolveExpectedLoad({ name: 'Yoga', durationMinutes: 60 }, medHist, []).tier).toBe('medium');
    expect(resolveExpectedLoad({ name: 'Yoga', durationMinutes: 60 }, highHist, []).tier).toBe('high');
  });

  it('exact match is case/whitespace insensitive', () => {
    const history = [rpeEntry('Football', 8, 1), rpeEntry('  FOOTBALL  ', 8, 8)];
    const result = resolveExpectedLoad({ name: 'football', durationMinutes: 60 }, history, REF_ACTIVITIES);
    expect(result.confidence).toBe('high');
  });

  it('uses the event-plan tag tier when no personal data exists (confidence low)', () => {
    const result = resolveExpectedLoad({ name: 'Tuesday Session', eventPlanTag: 'Interval 6x800m', durationMinutes: 45 }, [], REF_ACTIVITIES);
    expect(result.confidence).toBe('low');
    expect(result.tier).toBe('high');
  });

  it('falls back to generic ref_activities/FALLBACK_LOAD lookup with no personal data and no tag (confidence none)', () => {
    const result = resolveExpectedLoad({ name: 'Football', durationMinutes: 60 }, [], REF_ACTIVITIES);
    expect(result.confidence).toBe('none');
    expect(result.source).toContain('generic');
  });

  it('a matched ref_activities row still populates tier even at confidence "none" (the fixed bug)', () => {
    // A brand-new user with no personal RPE logged for "Full body" gym
    // sessions should still resolve to tier 'high', since ref_activities
    // explicitly flags "Full body (gym)" as intensity_default: 'high'.
    // Previously this branch discarded that and always returned tier: null.
    const result = resolveExpectedLoad({ name: 'Full body', type: 'gym', durationMinutes: 60 }, [], REF_ACTIVITIES);
    expect(result.confidence).toBe('none');
    expect(result.tier).toBe('high');
    expect(isHighIntensity(result)).toBe(true);
  });

  it('with no ref match and no tag, tier is genuinely null (nothing to go on)', () => {
    const result = resolveExpectedLoad({ name: 'Some made-up activity xyz', durationMinutes: 60 }, [], []);
    expect(result.confidence).toBe('none');
    expect(result.tier).toBeNull();
    expect(isHighIntensity(result)).toBe(false);
  });

  it('does not throw on missing/malformed session data and returns a safe none-confidence default', () => {
    expect(resolveExpectedLoad(null, [], [])).toMatchObject({ confidence: 'none' });
    expect(resolveExpectedLoad({}, [], [])).toMatchObject({ confidence: 'none' });
    expect(resolveExpectedLoad({ name: '' }, [], [])).toMatchObject({ confidence: 'none' });
  });

  it('every resolved estimate has a confidence field', () => {
    [{ name: 'Football' }, { eventPlanTag: 'Easy jog' }, {}].forEach(s => {
      expect(['high', 'medium', 'low', 'none']).toContain(resolveExpectedLoad(s, [], REF_ACTIVITIES).confidence);
    });
  });
});

describe('isHighIntensity', () => {
  it('is true only when tier resolves to "high", regardless of source', () => {
    expect(isHighIntensity({ confidence: 'high', tier: 'high' })).toBe(true);
    expect(isHighIntensity({ confidence: 'high', tier: 'medium' })).toBe(false);
    expect(isHighIntensity({ confidence: 'low', tier: 'high' })).toBe(true);
    expect(isHighIntensity({ confidence: 'low', tier: 'medium' })).toBe(false);
    expect(isHighIntensity({ confidence: 'none', tier: 'high' })).toBe(true); // matched-ref case
    expect(isHighIntensity({ confidence: 'none', tier: null })).toBe(false); // truly unknown
  });
});

describe('dominantCategory / sharesDominantCategory', () => {
  it('football and running share a leg-dominant category', () => {
    expect(dominantCategory(FOOTBALL_REF)).toBe('leg_load');
    expect(sharesDominantCategory(FOOTBALL_REF, RUN_REF)).toBe(true);
  });

  it('football and an upper-body-only session do not share a category', () => {
    const upperOnly = { leg_load: 'none', upper_load: 'high', cardio_load: 'none', core_load: 'none' };
    expect(sharesDominantCategory(FOOTBALL_REF, upperOnly)).toBe(false);
  });

  it('handles missing refs without throwing', () => {
    expect(sharesDominantCategory(null, RUN_REF)).toBe(false);
    expect(dominantCategory(null)).toBeNull();
  });
});

describe('describeLoadCopy (P0.6)', () => {
  it('never asserts load as fact below high confidence', () => {
    const low = describeLoadCopy({ confidence: 'low', tier: 'high', matchedKeyword: 'interval' }, 'Run');
    const none = describeLoadCopy({ confidence: 'none', tier: null }, 'Run');
    const medium = describeLoadCopy({ confidence: 'medium', tier: 'high', sampleCount: 3 }, 'Run');
    expect(low).toMatch(/likely/);
    expect(none).toMatch(/possibly/);
    expect(medium).toMatch(/likely/);
  });

  it('surfaces the confidence source in the copy itself', () => {
    expect(describeLoadCopy({ confidence: 'high', tier: 'high', sampleCount: 4 }, 'Football')).toContain('4');
    expect(describeLoadCopy({ confidence: 'low', tier: 'high', matchedKeyword: 'interval' }, 'Run')).toContain('interval');
    expect(describeLoadCopy({ confidence: 'none', tier: null }, 'Run')).toMatch(/no logged data/);
  });

  it('reflects the actual resolved tier rather than always saying "high load"', () => {
    const medium = describeLoadCopy({ confidence: 'high', tier: 'medium', sampleCount: 2 }, 'Run');
    expect(medium).toContain('medium load');
    expect(medium).not.toContain('high load');
  });
});

// ── Same-day (P0.3, revised — volume cap + tier-pairing, no weekly ratio) ────

function session(id, dayLabel, date, name, resolved, matchedRef = null) {
  return { id, dayLabel, date, name, resolved, matchedRef };
}

const HIGH = { confidence: 'high', rpe: 8, tier: 'high', sampleCount: 3, source: 'personal:x' };
const TAG_HIGH = { confidence: 'low', tier: 'high', matchedKeyword: 'interval' };
const MEDIUM = { confidence: 'high', rpe: 5, tier: 'medium', sampleCount: 3 };
const LOW = { confidence: 'high', rpe: 2, tier: 'low', sampleCount: 3 };
const UNKNOWN = { confidence: 'none', tier: null };

describe('same-day check (P0.3) — volume cap + tier-pairing', () => {
  it('flags two high-intensity sessions same day', () => {
    const sessions = [
      session('a', 'Mon', '2026-08-03', 'Full body', HIGH, GYM_FULL_BODY_REF),
      session('b', 'Mon', '2026-08-03', 'Football', TAG_HIGH, FOOTBALL_REF),
    ];
    expect(buildSequencingDecisions(sessions).some(d => d.check_type === 'same_day')).toBe(true);
  });

  it('does not flag two low-intensity sessions same day (e.g. a walk + an easy run)', () => {
    const sessions = [
      session('a', 'Mon', '2026-08-03', 'Walk', LOW, YOGA_REF),
      session('b', 'Mon', '2026-08-03', 'Easy run', LOW, RUN_REF),
    ];
    expect(buildSequencingDecisions(sessions)).toEqual([]);
  });

  it('does not flag a high session paired with a low session (a hard day still allows one easy session)', () => {
    const sessions = [
      session('a', 'Mon', '2026-08-03', 'Football', HIGH, FOOTBALL_REF),
      session('b', 'Mon', '2026-08-03', 'Easy walk', LOW, YOGA_REF),
    ];
    expect(buildSequencingDecisions(sessions).filter(d => d.check_type === 'same_day')).toEqual([]);
  });

  it('flags a high + medium pairing (cannot have medium and hard in one day)', () => {
    const sessions = [
      session('a', 'Mon', '2026-08-03', 'Football', HIGH, FOOTBALL_REF),
      session('b', 'Mon', '2026-08-03', 'Steady run', MEDIUM, RUN_REF),
    ];
    expect(buildSequencingDecisions(sessions).filter(d => d.check_type === 'same_day').length).toBe(1);
  });

  it('flags a medium + medium pairing (two non-easy sessions still stacks fatigue)', () => {
    const sessions = [
      session('a', 'Mon', '2026-08-03', 'Steady run', MEDIUM, RUN_REF),
      session('b', 'Mon', '2026-08-03', 'Tempo swim', MEDIUM, YOGA_REF),
    ];
    expect(buildSequencingDecisions(sessions).filter(d => d.check_type === 'same_day').length).toBe(1);
  });

  it('flags more than 2 sessions in a day regardless of intensity (volume cap)', () => {
    const sessions = [
      session('a', 'Mon', '2026-08-03', 'Swim', LOW, YOGA_REF),
      session('b', 'Mon', '2026-08-03', 'Swimming', LOW, YOGA_REF),
      session('c', 'Mon', '2026-08-03', 'Full body', HIGH, GYM_FULL_BODY_REF),
    ];
    expect(MAX_SESSIONS_PER_DAY).toBe(2);
    const decisions = buildSequencingDecisions(sessions).filter(d => d.check_type === 'same_day');
    expect(decisions.length).toBe(1);
  });

  it('flags 3 low-intensity sessions in a day too — volume cap is unconditional', () => {
    const sessions = [
      session('a', 'Mon', '2026-08-03', 'Walk', LOW, YOGA_REF),
      session('b', 'Mon', '2026-08-03', 'Yoga', LOW, YOGA_REF),
      session('c', 'Mon', '2026-08-03', 'Easy swim', LOW, YOGA_REF),
    ];
    expect(buildSequencingDecisions(sessions).filter(d => d.check_type === 'same_day').length).toBe(1);
  });

  it('does not apply the tier-pairing rule when a session in a 2-session day has no resolvable tier', () => {
    // Conservative: don't guess. Only the volume cap (3+) catches unresolvable sessions.
    const sessions = [
      session('a', 'Mon', '2026-08-03', 'Football', HIGH, FOOTBALL_REF),
      session('b', 'Mon', '2026-08-03', 'Mystery activity', UNKNOWN, null),
    ];
    expect(buildSequencingDecisions(sessions).filter(d => d.check_type === 'same_day')).toEqual([]);
  });
});

// ── Next-day (P0.4) ──────────────────────────────────────────────────────────

describe('next-day recovery-window check (P0.4)', () => {
  it('flags a low-intensity run the day after high-intensity football sharing a leg-load category', () => {
    const sessions = [
      session('a', 'Wed', '2026-08-05', 'Football', HIGH, FOOTBALL_REF),
      session('b', 'Thu', '2026-08-06', 'Easy run', LOW, RUN_REF),
    ];
    const decisions = buildSequencingDecisions(sessions);
    expect(decisions.some(d => d.check_type === 'next_day')).toBe(true);
  });

  it('does not flag when the later session is outside the recovery window', () => {
    // Football's recovery_hours is 48h -> covers +1 and +2 days; +3 days should be clear
    const sessions = [
      session('a', 'Wed', '2026-08-05', 'Football', HIGH, FOOTBALL_REF),
      session('b', 'Sun', '2026-08-09', 'Easy run', LOW, RUN_REF),
    ];
    expect(buildSequencingDecisions(sessions).filter(d => d.check_type === 'next_day')).toEqual([]);
  });

  it('does not flag when the two sessions do not share a dominant load category', () => {
    const upperOnly = { leg_load: 'none', upper_load: 'high', cardio_load: 'none', core_load: 'none', recovery_hours: 24 };
    const sessions = [
      session('a', 'Wed', '2026-08-05', 'Football', HIGH, FOOTBALL_REF),
      session('b', 'Thu', '2026-08-06', 'Upper body gym', LOW, upperOnly),
    ];
    expect(buildSequencingDecisions(sessions).filter(d => d.check_type === 'next_day')).toEqual([]);
  });

  it('does not flag when the earlier session is only moderate/low intensity', () => {
    const sessions = [
      session('a', 'Wed', '2026-08-05', 'Easy run', LOW, RUN_REF),
      session('b', 'Thu', '2026-08-06', 'Football', HIGH, FOOTBALL_REF),
    ];
    expect(buildSequencingDecisions(sessions).filter(d => d.check_type === 'next_day')).toEqual([]);
  });

  it('recovery window boundary — inclusive at the day-rounded hour boundary', () => {
    // recovery_hours 24 -> exactly 1 day later is inside the window
    const ref24 = { ...RUN_REF, recovery_hours: 24 };
    const sessions = [
      session('a', 'Wed', '2026-08-05', 'Football', HIGH, { ...FOOTBALL_REF, recovery_hours: 24 }),
      session('b', 'Thu', '2026-08-06', 'Easy run', LOW, ref24),
    ];
    expect(buildSequencingDecisions(sessions).some(d => d.check_type === 'next_day')).toBe(true);
  });

  it('an unlogged high-load ref match (e.g. Full body gym) is still detected as the earlier trigger', () => {
    // This is the fixed bug's next-day counterpart: previously tier-4/'none'
    // sessions could never be the earlier high-intensity trigger either.
    const sessions = [
      session('a', 'Wed', '2026-08-05', 'Full body', { confidence: 'none', tier: 'high' }, GYM_FULL_BODY_REF),
      session('b', 'Thu', '2026-08-06', 'Yoga', LOW, YOGA_REF),
    ];
    expect(buildSequencingDecisions(sessions).some(d => d.check_type === 'next_day')).toBe(true);
  });
});

// ── Decision output (P0.5) ────────────────────────────────────────────────────

describe('decision output (P0.5)', () => {
  it('every conflict includes all three option types', () => {
    const sessions = [
      session('a', 'Wed', '2026-08-05', 'Football', HIGH, FOOTBALL_REF),
      session('b', 'Thu', '2026-08-06', 'Easy run', LOW, RUN_REF),
    ];
    const decisions = buildSequencingDecisions(sessions);
    expect(decisions.length).toBeGreaterThan(0);
    decisions.forEach(d => {
      const types = d.options.map(o => o.type);
      expect(types).toEqual(expect.arrayContaining(['reduce', 'move', 'keep']));
    });
  });

  it('move never suggests a day that would itself create a new conflict', () => {
    // Football Mon + Football Wed (both high, sharing category, close together)
    // and easy run Tue: moving the run onto Mon or Wed should never be offered.
    const sessions = [
      session('a', 'Mon', '2026-08-03', 'Football', HIGH, FOOTBALL_REF),
      session('b', 'Tue', '2026-08-04', 'Easy run', LOW, RUN_REF),
      session('c', 'Wed', '2026-08-05', 'Football', HIGH, FOOTBALL_REF),
    ];
    const decisions = buildSequencingDecisions(sessions);
    const moveOption = decisions.flatMap(d => d.options).find(o => o.type === 'move');
    expect(moveOption).toBeTruthy();
    expect(moveOption.suggested_days).not.toContain('2026-08-03');
    expect(moveOption.suggested_days).not.toContain('2026-08-05');
  });

  it('move can suggest a genuinely empty rest day, not just days that already have another session', () => {
    // Only Monday has sessions in resolvedSessions — Tue-Sun are empty and
    // would never appear at all without allWeekDates being passed explicitly.
    // Uses YOGA_REF (low leg/upper load) for the paired session specifically
    // so this test isolates "are empty days considered" from recovery-window
    // category-sharing, which is covered separately above.
    const sessions = [
      session('a', 'Mon', '2026-08-03', 'Football', HIGH, FOOTBALL_REF),
      session('b', 'Mon', '2026-08-03', 'Gym', HIGH, YOGA_REF),
    ];
    const allWeekDates = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'];
    const decisions = buildSequencingDecisions(sessions, allWeekDates);
    const moveOption = decisions.flatMap(d => d.options).find(o => o.type === 'move');
    expect(moveOption.suggested_days).toContain('2026-08-04');
  });

  it('gracefully returns no suggested days rather than a broken option when every day conflicts', () => {
    const days = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'];
    const sessions = days.map((d, i) => session(`f${i}`, `D${i}`, d, 'Football', HIGH, FOOTBALL_REF));
    const decisions = buildSequencingDecisions(sessions);
    const moveOption = decisions.flatMap(d => d.options).find(o => o.type === 'move');
    expect(Array.isArray(moveOption.suggested_days)).toBe(true);
  });
});

describe('buildPersonalRpeHistory', () => {
  it('derives normalized, sorted-recent-first history from completedSessions', () => {
    const completedSessions = [
      { workout: 'Football', rpe: 7, date: '2026-08-01T00:00:00Z', elapsed: 3600 },
      { workout: 'Football', rpe: 8, date: '2026-08-08T00:00:00Z', elapsed: 3600 },
      { workout: 'Yoga', rpe: null, date: '2026-08-05T00:00:00Z' },
    ];
    const history = buildPersonalRpeHistory(completedSessions);
    expect(history).toHaveLength(2);
    expect(history[0].rpe).toBe(8); // most recent first
    expect(history[0].session_name_normalized).toBe('football');
  });
});
