// [DATA] Static glossary for deterministically-generated event plans
// (utils/planEngine.js). Term keys must match the `term` field used in
// data/sessionLibraries.js session archetypes exactly, plus a handful of
// cross-cutting terms (Brick, Conditioning circuit, Recovery week, Open
// water / sea swim) the engine attaches directly rather than through a
// library rotation. Screens filter this down to only the terms actually
// present in a given athlete's plan (features/specs/deterministic-endurance-plan-generator.md §C.3)
// rather than showing the whole dictionary.

const PLAN_GLOSSARY = [
  // ── Run ──
  { term: 'Easy run', discipline: 'Run', description: 'Comfortable, conversational-pace running. The bulk of your weekly running should feel easy — this is what builds your aerobic base without adding fatigue.' },
  { term: 'Recovery run', discipline: 'Run', description: 'A short, very easy run the day after a hard session, purely to keep blood flowing and legs loose — not a fitness-building session.' },
  { term: 'Strides', discipline: 'Run', description: '4–6 short (15–20 second) accelerations to near-sprint pace with full recovery between, tacked onto the end of an easy run. Builds leg speed and running form without real fatigue.' },
  { term: 'Tempo run', discipline: 'Run', description: 'A sustained effort at a "comfortably hard" pace — faster than easy, but controlled enough to hold for the set duration. Builds your ability to sustain race effort.' },
  { term: 'Fartlek', discipline: 'Run', description: 'Swedish for "speed play" — unstructured bursts of faster running mixed into an easy run, varying pace and duration by feel rather than a fixed interval structure.' },
  { term: 'Race pace run', discipline: 'Run', description: 'Running at (or close to) the pace you’re targeting for race day, in shorter intervals or continuous efforts, to rehearse exactly how that effort should feel.' },
  { term: 'Long run', discipline: 'Run', description: 'Your longest run of the week, run at an easy, sustainable pace. Builds endurance and race-day durability — pace matters far less than time on feet.' },

  // ── Swim ──
  { term: 'Technique drills', discipline: 'Swim', description: 'Short repeats focused on stroke mechanics (e.g. catch-up drill, single-arm swimming) rather than fitness — swum slowly and deliberately.' },
  { term: 'Kick set', discipline: 'Swim', description: 'Repeats using a kickboard or streamlined kick-only position, building leg strength and body position without arm fatigue.' },
  { term: 'Build set', discipline: 'Swim', description: 'A set where each repeat gets progressively faster within the same interval — teaches pacing control and race-effort tolerance.' },
  { term: 'Pyramid set', discipline: 'Swim', description: 'Repeats that increase then decrease in distance (e.g. 100-200-300-200-100m), mixing endurance and pacing work in one set.' },
  { term: 'Sighting practice', discipline: 'Swim', description: 'Practising lifting your head to spot a landmark every few strokes without breaking rhythm — essential for open-water swimming where there are no lane lines.' },
  { term: 'Open water swim', discipline: 'Swim', description: 'Swimming in open water (lake, sea) rather than a pool — closest simulation of race-day conditions, ideally including a practice run in your wetsuit.' },

  // ── Bike ──
  { term: 'Easy spin', discipline: 'Bike', description: 'Low-effort, easy-gear cycling — recovery-pace riding that keeps the legs moving without adding training stress.' },
  { term: 'Spin-ups', discipline: 'Bike', description: 'Short bursts of high-cadence, low-resistance pedalling within an easy ride — builds pedalling efficiency, not power.' },
  { term: 'Tempo ride', discipline: 'Bike', description: 'A sustained "comfortably hard" effort, similar in feel to a tempo run — builds your ability to hold a strong, steady effort.' },
  { term: 'Hard/easy interval', discipline: 'Bike', description: 'Repeated hard efforts (near threshold or above) with easy recovery riding between — the classic structure for building bike fitness.' },
  { term: 'Hill repeats', discipline: 'Bike', description: 'Repeated hard efforts up a climb, with an easy descent or spin as recovery between repeats — builds power and race-day climbing strength.' },
  { term: 'Race effort', discipline: 'Bike', description: 'Riding at the intensity you plan to hold on race day — a rehearsal of pacing and effort, usually done closer to the event.' },
  { term: 'Long ride', discipline: 'Bike', description: 'Your longest ride of the week, at a steady, sustainable effort. Builds the endurance and time-in-saddle needed for race day.' },

  // ── Combined / cross-cutting ──
  { term: 'Brick', discipline: 'Combined', description: 'A bike session immediately followed by a run, with no rest between — trains your legs to transition from cycling to running, which feels very different from running on fresh legs.' },
  { term: 'Open water / sea swim', discipline: 'Combined', description: 'A holiday-period substitute for a pool session — same purpose as a normal swim session, done in open water. Not a brick even if paired with a run the same day; that pairing is opportunistic, not a trained transition.' },
  { term: 'Recovery week', discipline: 'Combined', description: 'A planned lower-volume week (roughly 30% less than a normal week) every few weeks, at the same frequency but lighter load — lets your body absorb the training you’ve done rather than accumulating fatigue.' },

  // ── Conditioning ──
  { term: 'Conditioning circuit', discipline: 'Conditioning', description: 'A short bodyweight circuit run for 2–3 rounds, weighted toward strengthening and mobility work for any injury areas you declared (and never including exercises you asked to avoid) — the default is general hip/core work (glute bridge, bird dog, clamshell, dead bug, side plank) if none were declared. General injury-prevention support, not a personalised treatment plan.' },
];

export default PLAN_GLOSSARY;

export function glossaryForTerms(terms = []) {
  const wanted = new Set(terms.filter(Boolean));
  return PLAN_GLOSSARY.filter(g => wanted.has(g.term));
}
