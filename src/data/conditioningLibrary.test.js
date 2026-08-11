import { describe, it, expect } from 'vitest';
import { selectConditioningExercises, CONDITIONING_EXERCISES } from './conditioningLibrary';

describe('selectConditioningExercises', () => {
  it('falls back to the baseline circuit when no areas or avoid list are given', () => {
    const picked = selectConditioningExercises({});
    expect(picked.length).toBe(5);
    expect(picked.every(e => e.baseline)).toBe(true);
  });

  it('prioritizes exercises targeting a declared injury area', () => {
    const picked = selectConditioningExercises({ areas: ['Shoulder'] });
    expect(picked.some(e => e.id === 'band_pull_apart' || e.id === 'shoulder_ext_rot')).toBe(true);
  });

  it('excludes any exercise the athlete marked to avoid, even if area-relevant', () => {
    const picked = selectConditioningExercises({ areas: ['Knee'], avoidIds: ['squat', 'lunge'] });
    expect(picked.some(e => e.id === 'squat')).toBe(false);
    expect(picked.some(e => e.id === 'lunge')).toBe(false);
  });

  it('never returns duplicate exercises', () => {
    const picked = selectConditioningExercises({ areas: ['Hip', 'Knee', 'Lower back'], count: 10 });
    const ids = picked.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respects the requested count', () => {
    const picked = selectConditioningExercises({ areas: ['Hip'], count: 3 });
    expect(picked.length).toBe(3);
  });

  it('every catalog entry has a unique id', () => {
    const ids = CONDITIONING_EXERCISES.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
