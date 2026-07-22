import { describe, it, expect } from 'vitest';
import { computeSuggestedCalories, getActivityTier } from './calorieCalc';

describe('computeSuggestedCalories', () => {
  const base = { heightCm: 178, weightKg: 75, age: 30 };

  it('returns null when height, weight, or age is missing', () => {
    expect(computeSuggestedCalories({ ...base, heightCm: undefined, sex: 'male' })).toBeNull();
    expect(computeSuggestedCalories({ ...base, weightKg: 0, sex: 'male' })).toBeNull();
    expect(computeSuggestedCalories({ ...base, age: null, sex: 'male' })).toBeNull();
  });

  it('matches the Mifflin-St Jeor formula for a male reference case', () => {
    // BMR = 10*75 + 6.25*178 - 5*30 + 5 = 750 + 1112.5 - 150 + 5 = 1717.5
    const result = computeSuggestedCalories({ ...base, sex: 'male', weeklyTrainingSessions: 0 });
    expect(result.bmr).toBe(1718); // rounded
  });

  it('matches the Mifflin-St Jeor formula for a female reference case', () => {
    // BMR = 10*75 + 6.25*178 - 5*30 - 161 = 750 + 1112.5 - 150 - 161 = 1551.5
    const result = computeSuggestedCalories({ ...base, sex: 'female', weeklyTrainingSessions: 0 });
    expect(result.bmr).toBe(1552); // rounded
  });

  it('falls back to the male/female midpoint when sex is prefer_not_to_say or unset', () => {
    // BMR = 10*75 + 6.25*178 - 5*30 - 78 = 750 + 1112.5 - 150 - 78 = 1634.5
    const preferNotToSay = computeSuggestedCalories({ ...base, sex: 'prefer_not_to_say', weeklyTrainingSessions: 0 });
    const unset = computeSuggestedCalories({ ...base, sex: undefined, weeklyTrainingSessions: 0 });
    expect(preferNotToSay.bmr).toBe(1635); // rounded
    expect(unset.bmr).toBe(1635);
  });

  it('suggests the sedentary rest-day base and zero gym-day boost for 0-1 sessions/week', () => {
    const result = computeSuggestedCalories({ ...base, sex: 'male', weeklyTrainingSessions: 1 });
    const rawBmr = 10 * base.weightKg + 6.25 * base.heightCm - 5 * base.age + 5;
    expect(result.activityTier).toBe('sedentary');
    expect(result.suggestedDailyBase).toBe(Math.round(rawBmr * 1.2));
    expect(result.suggestedGymDayBoost).toBe(0);
  });

  it('increases the suggested gym-day boost as weekly session tiers rise', () => {
    const light    = computeSuggestedCalories({ ...base, sex: 'male', weeklyTrainingSessions: 3 });
    const moderate = computeSuggestedCalories({ ...base, sex: 'male', weeklyTrainingSessions: 5 });
    const high     = computeSuggestedCalories({ ...base, sex: 'male', weeklyTrainingSessions: 6 });

    expect(light.activityTier).toBe('light');
    expect(moderate.activityTier).toBe('moderate');
    expect(high.activityTier).toBe('high');

    expect(light.suggestedGymDayBoost).toBeGreaterThan(0);
    expect(moderate.suggestedGymDayBoost).toBeGreaterThan(light.suggestedGymDayBoost);
    expect(high.suggestedGymDayBoost).toBeGreaterThan(moderate.suggestedGymDayBoost);

    // Rest-day base should stay constant across tiers — only the boost changes.
    expect(light.suggestedDailyBase).toBe(moderate.suggestedDailyBase);
    expect(moderate.suggestedDailyBase).toBe(high.suggestedDailyBase);
  });

  it('maintenanceCalories reflects BMR times the tier multiplier', () => {
    const result = computeSuggestedCalories({ ...base, sex: 'male', weeklyTrainingSessions: 4 });
    const rawBmr = 10 * base.weightKg + 6.25 * base.heightCm - 5 * base.age + 5;
    expect(result.maintenanceCalories).toBe(Math.round(rawBmr * 1.55));
  });
});

describe('getActivityTier', () => {
  it('maps weekly session counts to the expected tier boundaries', () => {
    expect(getActivityTier(0).label).toBe('sedentary');
    expect(getActivityTier(1).label).toBe('sedentary');
    expect(getActivityTier(2).label).toBe('light');
    expect(getActivityTier(3).label).toBe('light');
    expect(getActivityTier(4).label).toBe('moderate');
    expect(getActivityTier(5).label).toBe('moderate');
    expect(getActivityTier(6).label).toBe('high');
    expect(getActivityTier(10).label).toBe('high');
  });

  it('treats a missing/non-numeric input as zero sessions', () => {
    expect(getActivityTier(undefined).label).toBe('sedentary');
    expect(getActivityTier(null).label).toBe('sedentary');
  });
});
