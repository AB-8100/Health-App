// Pure target-time → pace/split calculation for `event_race` goals
// (spec-stage3-time-goals.md). Shared, rules-based layer — no LLM/API call —
// read by both the basic rule-based scheduler (App.jsx's
// generateActivitySchedule) and the AI plan-generation prompt
// (utils/planPrompt.js), so a user's stated target/cutoff time shapes
// whichever path generates their plan.
//
// Distances/proportions are only defined for the race types the spec's own
// table covers (4 triathlon distances + 5K/10K/Half/Marathon running races).
// Cycling Sportive / Open Water Swim / Other have no fixed distance in this
// app's data model — for those, a target/cutoff time can still be captured,
// but no pace/split is derived (nothing to convert it against).

// ── Distances ──────────────────────────────────────────────────────────────

// Single-discipline running races — whole target time converts directly to a run pace.
export const RUN_RACE_DISTANCES_KM = {
  '5K': 5,
  '10K': 10,
  'Half Marathon': 21.0975,
  'Marathon': 42.195,
};

// Triathlon leg distances (km). T1+T2 (transitions) has a time share but no distance.
export const TRIATHLON_LEG_DISTANCES_KM = {
  'Triathlon (Sprint)':         { swim: 0.75, bike: 20,  run: 5 },
  'Triathlon (Olympic)':        { swim: 1.5,  bike: 40,  run: 10 },
  'Triathlon (70.3 / Half)':    { swim: 1.9,  bike: 90,  run: 21.0975 },
  'Triathlon (Full / Ironman)': { swim: 3.8,  bike: 180, run: 42.195 },
};

// Default swim / T1+T2 / bike / run proportions of total race time — directional
// estimates from published age-group finisher data (see spec-stage3-time-goals.md),
// not Forma-specific, always user-overridable.
export const DEFAULT_SPLIT_PROPORTIONS = {
  'Triathlon (Sprint)':         { swim: 0.18, transition: 0.03,  bike: 0.50, run: 0.29 },
  'Triathlon (Olympic)':        { swim: 0.16, transition: 0.02,  bike: 0.52, run: 0.30 },
  'Triathlon (70.3 / Half)':    { swim: 0.13, transition: 0.015, bike: 0.55, run: 0.305 },
  'Triathlon (Full / Ironman)': { swim: 0.11, transition: 0.01,  bike: 0.53, run: 0.35 },
};

// Illustrative average-finisher pace per discipline, used only to gauge a
// user's *relative* strength between swim and run when reweighting the
// default split from their own baseline answers — not a performance
// prediction, and not authoritative (same caveat as the proportion table).
const REFERENCE_PACE = {
  'Triathlon (Sprint)':         { runSecPerKm: 390, swimSecPer100m: 130 },
  'Triathlon (Olympic)':        { runSecPerKm: 405, swimSecPer100m: 135 },
  'Triathlon (70.3 / Half)':    { runSecPerKm: 435, swimSecPer100m: 140 },
  'Triathlon (Full / Ironman)': { runSecPerKm: 510, swimSecPer100m: 150 },
};

// Caps how much of the total race time a baseline-driven reweight can move
// between swim and run, so a single baseline answer can't swing the split
// to an extreme.
const MAX_REWEIGHT_SHARE = 0.05;

export function isTriathlonRaceType(raceType) {
  return !!TRIATHLON_LEG_DISTANCES_KM[raceType];
}

export function isRunRaceType(raceType) {
  return !!RUN_RACE_DISTANCES_KM[raceType];
}

// Whether a pace/split can be derived at all for this race type.
export function canComputePace(raceType) {
  return isTriathlonRaceType(raceType) || isRunRaceType(raceType);
}

// ── Time parsing/formatting ────────────────────────────────────────────────

// A 2-part "A:B" string is genuinely ambiguous on its own — Stage 3's
// existing baseline fields use "mm:ss" (sub-hour times like a 5K or 400m
// swim), while the target/cutoff field uses "H:MM" (race finish times are
// normally over an hour). Both agree a 3-part string is "H:MM:SS". These two
// explicit parsers exist instead of one overloaded function so a caller
// can't accidentally apply the wrong interpretation.

function parseParts(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split(':').map(p => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some(p => !/^\d+$/.test(p))) return null;
  return parts.map(Number);
}

// Stage 3 baseline times: "MM:SS" or "H:MM:SS".
export function parseBaselineDurationToSeconds(str) {
  const nums = parseParts(str);
  if (!nums) return null;
  const seconds = nums.length === 3
    ? nums[0] * 3600 + nums[1] * 60 + nums[2]
    : nums[0] * 60 + nums[1];
  return (Number.isFinite(seconds) && seconds > 0) ? seconds : null;
}

// Target/cutoff race time: "H:MM" or "H:MM:SS".
export function parseTargetTimeToSeconds(str) {
  const nums = parseParts(str);
  if (!nums) return null;
  const seconds = nums.length === 3
    ? nums[0] * 3600 + nums[1] * 60 + nums[2]
    : nums[0] * 3600 + nums[1] * 60;
  return (Number.isFinite(seconds) && seconds > 0) ? seconds : null;
}

export function formatSecondsAsHMS(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '';
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// ── Split computation ──────────────────────────────────────────────────────

// Default split from the race-type proportion/distance table alone.
export function computeDefaultSplit(raceType, totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  const proportions = DEFAULT_SPLIT_PROPORTIONS[raceType];
  if (proportions) {
    return {
      swim:       Math.round(totalSeconds * proportions.swim),
      transition: Math.round(totalSeconds * proportions.transition),
      bike:       Math.round(totalSeconds * proportions.bike),
      run:        Math.round(totalSeconds * proportions.run),
    };
  }
  if (isRunRaceType(raceType)) {
    return { run: totalSeconds };
  }
  return null;
}

function runPacePerKmFromBaseline(runBaseline) {
  const candidates = [
    { time: runBaseline?.time10k, km: 10 },
    { time: runBaseline?.time5k, km: 5 },
    { time: runBaseline?.timeHalfMarathon, km: 21.0975 },
    { time: runBaseline?.timeMarathon, km: 42.195 },
  ];
  for (const c of candidates) {
    const seconds = parseBaselineDurationToSeconds(c.time);
    if (seconds) return seconds / c.km;
  }
  return null;
}

function swimPacePer100mFromBaseline(swimBaseline) {
  const seconds = parseBaselineDurationToSeconds(swimBaseline?.time400m);
  return seconds ? seconds / 4 : null;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// Reweights the default split using the user's own Stage 3 run/swim baseline
// times when available (bike is left at the default share — FTP watts alone
// isn't a reliable time estimate without a fuller physiological model, which
// is explicitly out of scope). Falls back to computeDefaultSplit when no
// usable baseline data exists, or for non-triathlon race types (nothing to
// reweight against — the whole time is already one discipline).
export function deriveSplitFromBaseline(raceType, totalSeconds, baselines = {}) {
  const base = computeDefaultSplit(raceType, totalSeconds);
  if (!base || !isTriathlonRaceType(raceType)) return base;

  const ref = REFERENCE_PACE[raceType];
  const runPace  = runPacePerKmFromBaseline(baselines.run);
  const swimPace = swimPacePer100mFromBaseline(baselines.swim);
  if (!ref || (runPace == null && swimPace == null)) return base;

  const runRatio  = runPace  != null ? ref.runSecPerKm    / runPace  : 1;
  const swimRatio = swimPace != null ? ref.swimSecPer100m / swimPace : 1;
  // Positive => swim is relatively stronger than run (vs the reference finisher),
  // so shift time FROM swim TO run; negative does the opposite.
  const shiftFraction = clamp((swimRatio - runRatio) * 0.05, -MAX_REWEIGHT_SHARE, MAX_REWEIGHT_SHARE);
  const shiftSeconds = Math.round(totalSeconds * shiftFraction);

  return {
    ...base,
    swim: Math.max(0, base.swim - shiftSeconds),
    run:  Math.max(0, base.run + shiftSeconds),
  };
}

// ── Display ─────────────────────────────────────────────────────────────────

// Formats a discipline's leg time as a pace/speed string appropriate to that
// discipline: run/swim as a pace per distance unit, bike as an average speed
// (the natural convention for cycling, unlike pace-per-km).
export function formatPaceForDiscipline(discipline, legSeconds, legDistanceKm, useMiles = false) {
  if (!Number.isFinite(legSeconds) || legSeconds <= 0) return '';
  if (discipline === 'transition') return formatSecondsAsHMS(legSeconds);
  if (!Number.isFinite(legDistanceKm) || legDistanceKm <= 0) return formatSecondsAsHMS(legSeconds);

  if (discipline === 'swim') {
    const per100m = legSeconds / (legDistanceKm * 1000 / 100);
    return `${formatSecondsAsHMS(per100m)}/100m`;
  }
  if (discipline === 'bike') {
    const hours = legSeconds / 3600;
    const distance = useMiles ? legDistanceKm * 0.621371 : legDistanceKm;
    const speed = distance / hours;
    return `${speed.toFixed(1)} ${useMiles ? 'mph' : 'km/h'}`;
  }
  // run (or any other per-distance discipline)
  const distance = useMiles ? legDistanceKm * 0.621371 : legDistanceKm;
  const perUnit = legSeconds / distance;
  return `${formatSecondsAsHMS(perUnit)}/${useMiles ? 'mi' : 'km'}`;
}

// Leg distance (km) for a given discipline + race type, used to convert a
// computed/edited leg time into a displayable pace via formatPaceForDiscipline.
export function legDistanceKm(discipline, raceType) {
  if (discipline === 'run' && isRunRaceType(raceType)) return RUN_RACE_DISTANCES_KM[raceType];
  const legs = TRIATHLON_LEG_DISTANCES_KM[raceType];
  return legs?.[discipline] ?? null;
}
