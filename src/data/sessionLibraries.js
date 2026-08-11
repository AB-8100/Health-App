// [DATA] Static session-content libraries for the deterministic plan engine
// (utils/planEngine.js) — one per discipline, same pattern as
// GymPlanScreens.jsx's SPLITS/EX_LIB. Not generated per-user: the engine
// picks concrete pace/duration numbers from the athlete's own baselines and
// target splits, but the *shape* of each session (what kind of run/swim/
// ride it is) comes from these fixed tables, keyed by phase and rotated
// week-to-week for variety. Terms referenced here (`term`) must have a
// matching entry in data/planGlossary.js.

// Each library entry is a rotation: an ordered list of session archetypes
// used to fill a discipline's non-key weekly sessions for a given phase.
// The engine assigns the athlete's designated "long/key session day" (or
// discipline day) a distinct long-session archetype computed separately
// from volume-progression formulas, then fills any remaining weekly
// sessions for that discipline by cycling through the phase's rotation
// (session index modulo rotation length), so a 3x/week discipline sees
// real variety instead of the same session repeated three times.

export const RUN_LIBRARY = {
  Foundation: [
    { term: 'Easy run',      sessionType: 'Easy run',                intensity: 'Low' },
    { term: 'Recovery run',  sessionType: 'Recovery run',             intensity: 'Low' },
    { term: 'Strides',       sessionType: 'Easy run + strides',       intensity: 'Low' },
  ],
  Build: [
    { term: 'Easy run',      sessionType: 'Easy run',                 intensity: 'Low' },
    { term: 'Tempo run',     sessionType: 'Tempo run',                intensity: 'Medium' },
    { term: 'Fartlek',       sessionType: 'Fartlek session',          intensity: 'Medium' },
  ],
  Peak: [
    { term: 'Easy run',      sessionType: 'Easy run',                 intensity: 'Low' },
    { term: 'Race pace run', sessionType: 'Race-pace intervals',      intensity: 'High' },
    { term: 'Tempo run',     sessionType: 'Tempo run',                intensity: 'Medium' },
  ],
  Taper: [
    { term: 'Easy run',      sessionType: 'Easy run',                 intensity: 'Low' },
    { term: 'Race pace run', sessionType: 'Short race-pace efforts',  intensity: 'Medium' },
  ],
};

export const RUN_LONG_TERM = 'Long run';

export const SWIM_LIBRARY = {
  Foundation: [
    { term: 'Technique drills', sessionType: 'Technique drill set',     intensity: 'Low' },
    { term: 'Kick set',         sessionType: 'Kick set',                intensity: 'Low' },
  ],
  Build: [
    { term: 'Build set',        sessionType: 'Build set',               intensity: 'Medium' },
    { term: 'Kick set',         sessionType: 'Kick set',                intensity: 'Low' },
  ],
  Peak: [
    { term: 'Pyramid set',      sessionType: 'Pyramid set',             intensity: 'Medium' },
    { term: 'Open water swim',  sessionType: 'Open water / dress rehearsal', intensity: 'Medium' },
    { term: 'Sighting practice',sessionType: 'Sighting practice',       intensity: 'Low' },
  ],
  Taper: [
    { term: 'Technique drills', sessionType: 'Easy technique swim',     intensity: 'Low' },
  ],
};

export const BIKE_LIBRARY = {
  Foundation: [
    { term: 'Easy spin',   sessionType: 'Easy spin',                intensity: 'Low' },
    { term: 'Spin-ups',    sessionType: 'Easy spin + spin-ups',     intensity: 'Low' },
  ],
  Build: [
    { term: 'Tempo ride',      sessionType: 'Tempo ride',                intensity: 'Medium' },
    { term: 'Hard/easy interval', sessionType: 'Hard/easy interval set', intensity: 'High' },
  ],
  Peak: [
    { term: 'Hill repeats', sessionType: 'Hill repeats',              intensity: 'High' },
    { term: 'Race effort',  sessionType: 'Race-effort ride',          intensity: 'High' },
  ],
  Taper: [
    { term: 'Spin-ups', sessionType: 'Easy spin + spin-ups', intensity: 'Low' },
  ],
};

export const BIKE_LONG_TERM = 'Long ride';

export function nextFromRotation(library, phase, index) {
  const rotation = library[phase] || library.Foundation;
  return rotation[index % rotation.length];
}
