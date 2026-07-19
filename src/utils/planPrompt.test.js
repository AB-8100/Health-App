import { describe, it, expect } from 'vitest';
import { buildPlanPrompt, mapRaceType, isSupportedAIRaceType } from './planPrompt';

function baseGoalsPayload(eventRaceConfigOverrides = {}) {
  return {
    trainingDaysPerWeek: 5,
    unavailableDays: [],
    gymAccess: true,
    poolDays: [],
    goals: [{
      type: 'event_race',
      config: {
        raceType: 'Triathlon (Sprint)',
        raceDate: '2026-10-04',
        ...eventRaceConfigOverrides,
      },
    }],
  };
}

describe('mapRaceType / isSupportedAIRaceType', () => {
  it('maps a supported race type to its AI-prompt label', () => {
    expect(mapRaceType('Triathlon (Sprint)')).toBe('Sprint Triathlon');
  });
  it('reports unsupported race types as not AI-supported', () => {
    expect(isSupportedAIRaceType('Cycling Sportive')).toBe(false);
    expect(isSupportedAIRaceType('10K')).toBe(true);
  });
});

describe('buildPlanPrompt — target time / cutoff / pace carried forward from Stage 2', () => {
  it('sends the structured target time from goalsPayload, not a free-text field', () => {
    const gp = baseGoalsPayload({ hasTargetTime: true, targetTimeSeconds: 8100 }); // 2:15:00
    const prompt = buildPlanPrompt({ goalsPayload: gp, intake: {} });
    expect(prompt).toContain('Q31 Target finish time: 2:15:00');
  });

  it('reports "Not specified" when no target time was given, without erroring', () => {
    const gp = baseGoalsPayload({ hasTargetTime: false });
    const prompt = buildPlanPrompt({ goalsPayload: gp, intake: {} });
    expect(prompt).toContain('Q31 Target finish time: Not specified');
  });

  it('includes the race cutoff time when set, framed as a hard constraint', () => {
    const gp = baseGoalsPayload({ hasCutoffTime: true, cutoffTimeSeconds: 9000 }); // 2:30:00
    const prompt = buildPlanPrompt({ goalsPayload: gp, intake: {} });
    expect(prompt).toContain('Race cutoff / qualifying time: 2:30:00');
  });

  it('includes the confirmed target split from the pace_confirm step, with pace/speed shown', () => {
    const gp = baseGoalsPayload({ hasTargetTime: true, targetTimeSeconds: 8100 });
    const intake = { targetPaces: { swim: 1350, transition: 240, bike: 4200, run: 2310 } };
    const prompt = buildPlanPrompt({ goalsPayload: gp, intake });
    expect(prompt).toContain('Confirmed target split');
    expect(prompt).toContain('swim');
    expect(prompt).toContain('T1+T2 allowance');
  });

  it('omits the confirmed-split line entirely when no target paces were confirmed', () => {
    const gp = baseGoalsPayload({ hasTargetTime: false });
    const prompt = buildPlanPrompt({ goalsPayload: gp, intake: {} });
    expect(prompt).not.toContain('Confirmed target split');
  });

  it('sends the per-discipline weekly frequency the athlete chose in Stage 2', () => {
    const gp = baseGoalsPayload({ disciplineFrequency: { swim: 2, bike: 3, run: 2 } });
    const prompt = buildPlanPrompt({ goalsPayload: gp, intake: {} });
    expect(prompt).toContain('swim x2/week');
    expect(prompt).toContain('bike x3/week');
    expect(prompt).toContain('run x2/week');
  });

  it('is available regardless of whether Stage 3 (intake) was completed, skipped, or omitted', () => {
    const gp = baseGoalsPayload({ hasTargetTime: true, targetTimeSeconds: 3000 });
    // No intake object at all — matches "user only did Stage 2" per the product ask.
    expect(() => buildPlanPrompt({ goalsPayload: gp, intake: null })).not.toThrow();
    const prompt = buildPlanPrompt({ goalsPayload: gp, intake: null });
    expect(prompt).toContain('Q31 Target finish time:');
  });
});
