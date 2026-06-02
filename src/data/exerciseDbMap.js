// Maps our internal EX_LIB IDs → free-exercise-db IDs
// Source: https://github.com/yuhonas/free-exercise-db (Unlicense)
export const EX_DB_MAP = {
  bench:         'Barbell_Bench_Press_-_Medium_Grip',
  squat:         'Barbell_Full_Squat',
  deadlift:      'Deadlift',
  ohp:           'Barbell_Shoulder_Press',
  pullups:       'Pullups',
  reversepullup: 'Inverted_Row_with_Straps',
  barbellrow:    'Bent_Over_Barbell_Row',
  rdl:           'Romanian_Deadlift',
  incline:       'Incline_Dumbbell_Press',
  decline:       'Decline_Barbell_Bench_Press',
  cablefly:      'Cable_Crossover',
  latpulldown:   'Wide-Grip_Lat_Pulldown',
  lateral:       'Side_Lateral_Raise',
  frontraise:    'Front_Dumbbell_Raise',
  tricep:        'Triceps_Pushdown',
  skulls:        'Lying_Triceps_Press',
  cgbench:       'Close-Grip_Barbell_Bench_Press',
  curls:         'Barbell_Curl',
  hammer:        'Hammer_Curls',
  cablerow:      'Seated_Cable_Rows',
  tbar:          'T-Bar_Row_with_Handle',
  facepull:      'Face_Pull',
  legpress:      'Leg_Press',
  legext:        'Leg_Extensions',
  lunges:        'Dumbbell_Lunges',
  bss:           'Barbell_Bulgarian_Split_Squat',
  legcurl:       'Lying_Leg_Curls',
  hipthrust:     'Barbell_Hip_Thrust',
  calf:          'Standing_Calf_Raises',
  plank:         'Plank',
  crunches:      'Crunches',
  legraise:      'Hanging_Leg_Raise',
  abroller:      'Ab_Roller',
  cabletwist:    'Cable_Crunch',
  deadbug:       'Dead_Bug',
  pallof:        'Pallof_Press_with_Rotation',
};

const DB_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const DB_JSON  = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

export function getDbImageUrl(dbId, pose = 0) {
  return `${DB_BASE}/${dbId}/${pose}.jpg`;
}

export function getImageUrlForExLibId(exLibId, pose = 0) {
  const dbId = EX_DB_MAP[exLibId];
  return dbId ? getDbImageUrl(dbId, pose) : null;
}

// Module-level cache so the fetch happens only once per page load
let _cache = null;
let _promise = null;

export async function fetchExerciseDb() {
  if (_cache) return _cache;
  if (_promise) return _promise;
  _promise = fetch(DB_JSON)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => { _cache = data; _promise = null; return data; })
    .catch(err => { _promise = null; throw err; });
  return _promise;
}
