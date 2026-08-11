// [DATA] Conditioning exercise catalog for utils/planEngine.js's conditioning
// sessions. Each entry's `targetsAreas` matches the fixed body-area list an
// athlete picks from when logging a past injury in onboarding
// (screens/GoalsSetupScreen.jsx's BODY_AREAS) — used to bias a conditioning
// circuit toward strengthening/mobility work for areas the athlete actually
// declared, and `avoidExerciseIds` (also set in onboarding) lets an athlete
// exclude a specific exercise entirely rather than just having it flagged.
//
// `baseline: true` marks the original default circuit (general hip/core
// work, no area targeting) — used to fill out a circuit when there's no
// declared injury area, or to top up remaining slots after area-relevant
// picks.

export const CONDITIONING_EXERCISES = [
  { id: 'glute_bridge',      name: 'Glute bridge',        targetsAreas: ['Hip', 'Lower back', 'Knee'],            baseline: true },
  { id: 'bird_dog',          name: 'Bird dog',             targetsAreas: ['Lower back', 'Upper back', 'Hip'],      baseline: true },
  { id: 'clamshell',         name: 'Clamshell',            targetsAreas: ['Hip', 'Knee'],                          baseline: true },
  { id: 'dead_bug',          name: 'Dead bug',             targetsAreas: ['Lower back'],                          baseline: true },
  { id: 'side_plank',        name: 'Side plank',           targetsAreas: ['Lower back', 'Hip'],                    baseline: true },

  { id: 'single_leg_balance', name: 'Single-leg balance',        targetsAreas: ['Ankle', 'Knee'] },
  { id: 'calf_raise',         name: 'Calf raise',                targetsAreas: ['Calf', 'Achilles', 'Ankle'] },
  { id: 'band_pull_apart',    name: 'Band pull-apart',           targetsAreas: ['Shoulder', 'Upper back'] },
  { id: 'shoulder_ext_rot',   name: 'Shoulder external rotation', targetsAreas: ['Shoulder'] },
  { id: 'wrist_mobility',     name: 'Wrist mobility circles',    targetsAreas: ['Wrist', 'Elbow'] },
  { id: 'hamstring_stretch',  name: 'Hamstring stretch',         targetsAreas: ['Hamstring'] },
  { id: 'quad_stretch',       name: 'Quad stretch',              targetsAreas: ['Quad'] },
  { id: 'hip_flexor_stretch', name: 'Hip flexor stretch',        targetsAreas: ['Hip', 'Quad'] },
  { id: 'cat_cow',            name: 'Cat-cow stretch',           targetsAreas: ['Lower back', 'Upper back'] },

  { id: 'squat',           name: 'Bodyweight squat',      targetsAreas: ['Quad', 'Knee', 'Hip'] },
  { id: 'lunge',           name: 'Reverse lunge',          targetsAreas: ['Quad', 'Knee', 'Hip'] },
  { id: 'plank',           name: 'Plank',                  targetsAreas: ['Lower back'] },
  { id: 'hip_hinge',       name: 'Bodyweight hip hinge',   targetsAreas: ['Hamstring', 'Lower back'] },
  { id: 'jumping_jacks',   name: 'Jumping jacks',          targetsAreas: [] },
  { id: 'burpees',         name: 'Burpees',                targetsAreas: [] },
];

// Picks up to `count` exercises for one conditioning circuit: exercises
// targeting a declared injury area first (in catalog order), then the
// default baseline circuit, then anything else — always excluding
// `avoidIds`, never repeating an exercise within the same circuit.
export function selectConditioningExercises({ areas = [], avoidIds = [], count = 5 } = {}) {
  const avoid = new Set(avoidIds);
  const areaSet = new Set((areas || []).filter(Boolean));
  const available = CONDITIONING_EXERCISES.filter(e => !avoid.has(e.id));

  const relevant = available.filter(e => e.targetsAreas.some(a => areaSet.has(a)));
  const baseline = available.filter(e => e.baseline);
  const rest = available.filter(e => !e.baseline && !e.targetsAreas.some(a => areaSet.has(a)));

  const picked = [];
  const pushUnique = (list) => {
    for (const e of list) {
      if (picked.length >= count) return;
      if (!picked.some(p => p.id === e.id)) picked.push(e);
    }
  };
  pushUnique(relevant);
  pushUnique(baseline);
  pushUnique(rest);
  return picked;
}
