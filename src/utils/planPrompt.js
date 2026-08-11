// Builds the prompt sent to Claude to generate a personalised triathlon/running
// training plan, adapting the "Triathlon Training Plan Generator" master
// prompt so that Claude returns a single structured JSON object (matching the
// shape the app already stores for an event training plan) instead of an
// executable Python script / downloadable spreadsheet.
import { formatSecondsAsHMS, legDistanceKm, formatPaceForDiscipline } from './raceTargets';
import { CONDITIONING_EXERCISES } from '../data/conditioningLibrary';

const RACE_TYPE_MAP = {
  '10K':                        '10K',
  'Half Marathon':              'Half Marathon',
  'Marathon':                   'Marathon',
  'Triathlon (Sprint)':         'Sprint Triathlon',
  'Triathlon (Olympic)':        'Olympic Triathlon',
  'Triathlon (70.3 / Half)':    'Half Ironman (70.3)',
  'Triathlon (Full / Ironman)': 'Full Ironman',
};

export function mapRaceType(raceType) {
  return RACE_TYPE_MAP[raceType] || null;
}

export function isSupportedAIRaceType(raceType) {
  return !!RACE_TYPE_MAP[raceType];
}

function isTriathlon(mappedRaceType) {
  return /triathlon|ironman/i.test(mappedRaceType || '');
}

function fmt(v, fallback = 'Not provided') {
  if (v === undefined || v === null || v === '') return fallback;
  if (Array.isArray(v) && v.length === 0) return fallback;
  return v;
}

function daysLabel(keys = []) {
  const LABELS = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
    friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
  };
  const list = (Array.isArray(keys) ? keys : []).map(k => LABELS[k] || k);
  return list.length ? list.join(', ') : 'None declared';
}

function dayLabel(key) {
  const LABELS = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
    friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  };
  return key ? (LABELS[key] || key) : 'No preference — use default';
}

// ── athlete intake answers, formatted to match the questionnaire structure ──

function buildAnswersBlock({ goalsPayload, intake }) {
  const gp = goalsPayload || {};
  const raceGoal = (gp.goals || []).find(g => g.type === 'event_race') || {};
  const cfg = raceGoal.config || {};
  const mappedRaceType = mapRaceType(cfg.raceType);
  const triathlon = isTriathlon(mappedRaceType);

  const run  = intake?.runBaseline  || {};
  const swim = intake?.swimBaseline || {};
  const bike = intake?.bikeBaseline || {};
  const avail = intake?.availability || {};
  const prefs = intake?.preferences  || {};
  const mind  = intake?.mindset      || {};
  const inj   = intake?.injury       || {};
  const ranking = (intake?.disciplineRanking || []).length
    ? intake.disciplineRanking
    : ['bike', 'run', 'swim'];

  const lines = [];

  lines.push('## 1. Race Details');
  lines.push(`Q1 Race date: ${fmt(cfg.raceDate)}`);
  lines.push(`Q2 Race type: ${fmt(mappedRaceType, 'Unknown')}`);
  lines.push(`Q3 Start date: ${fmt(cfg.startDate, new Date().toISOString().slice(0, 10))}`);
  lines.push(`Q4 Total weeks: calculate from start date to race date`);
  lines.push('');

  lines.push('## 2. Current Fitness Baseline');
  if (triathlon) {
    lines.push('**Swim**');
    lines.push(`Q5/Q6 Continuous swim distance / pace: ${fmt(swim.longestSessionM && `${swim.longestSessionM}m continuous`)}; 400m time ${fmt(swim.time400m)}`);
    lines.push(`Open-water experience: ${fmt(swim.openWaterExperience, 'None declared')}; wetsuit experience: ${fmt(swim.wetsuitExperience, 'None declared')}`);
    lines.push('**Bike**');
    lines.push(`Q9/Q11 Cycling fitness / longest recent ride: FTP ${fmt(bike.ftpWatts && `${bike.ftpWatts}W`)}, longest ride ${fmt(bike.longestRideKm && `${bike.longestRideKm}km`)}`);
    lines.push(`Bike type: ${fmt(bike.bikeType)}`);
    lines.push(`Q12 Discipline ranking (strongest → weakest): ${ranking.join(' > ')}`);
  }
  lines.push('**Run**');
  lines.push(`Q13 5K time/pace: ${fmt(run.time5k)}`);
  lines.push(`Q14 Longest recent run: ${fmt(run.longestEffortKm && `${run.longestEffortKm}km`)}`);
  lines.push(`Q16 Can run continuously for 60 min: ${run.canRunContinuously60min === true ? 'Yes' : run.canRunContinuously60min === false ? 'No' : 'Not specified'}`);
  lines.push(`Other run times on file — 10K: ${fmt(run.time10k)}, Half marathon: ${fmt(run.timeHalfMarathon)}, Marathon: ${fmt(run.timeMarathon)}`);
  lines.push('');

  lines.push('## 3. Training Availability');
  lines.push(`Q17 Training days per week: ${fmt(gp.trainingDaysPerWeek)}`);
  // §A.7 replaced the discipline-frequency count with a per-discipline day
  // picker on the goals payload itself — frequency is just how many days
  // were picked for each. Fall back to the legacy disciplineFrequency shape
  // for a goal saved before that merge.
  const disciplineDays = gp.disciplineDays || {};
  const freq = Object.keys(disciplineDays).length
    ? Object.fromEntries(Object.entries(disciplineDays).map(([d, days]) => [d, (days || []).length]))
    : (cfg.disciplineFrequency || {});
  if (Object.keys(freq).length) {
    lines.push(`Requested weekly frequency per discipline (set by the athlete — match these, don't invent your own): ${
      Object.entries(freq).map(([d, n]) => `${d} x${n}/week`).join(', ')
    }`);
  }
  lines.push(`Q18 Fixed unavailable days: ${daysLabel(gp.unavailableDays)}`);
  // §A.5/§A.6 merged standingCommitments (goalsPayload, with a load toggle)
  // and the old regularSports list into one — fall back to the pre-merge
  // availability.standingCommitments shape for an older saved intake.
  const commitments = gp.standingCommitments?.length ? gp.standingCommitments : (avail.standingCommitments || []);
  lines.push(`Q19 Standing commitments: ${commitments.length
    ? commitments.map(c => `${c.label} (${dayLabel(c.day)}${c.time ? ' ' + c.time : ''}) — ${c.countsTowardLoad ? 'counts toward training load' : 'outside training load'}`).join('; ')
    : 'None'}`);
  if (triathlon) lines.push(`Q20 Pool access days: ${daysLabel(disciplineDays.swim)}`);
  lines.push(`Q21 Long/key session day: ${dayLabel(prefs.longSessionDay)}`);
  lines.push(`Q21 Second session day: ${dayLabel(prefs.secondDisciplineDay)}`);
  lines.push(`Q22 Gym/conditioning access: ${gp.gymAccess ? `Yes — preferred day: ${dayLabel(prefs.conditioningDay)}` : 'No — replace conditioning with rest/active recovery'}`);
  lines.push('');

  lines.push('## 4. Holidays & Schedule Disruptions');
  lines.push(`Q23 Holidays/unavailable periods: ${(avail.holidays || []).length
    ? avail.holidays.map(h => `${h.label}: ${h.from}${h.to ? ' to ' + h.to : ''} (assume travel days = rest, no training)`).join('; ')
    : 'None declared'}`);
  lines.push(`Q24 One-off events: ${(avail.oneOffEvents || []).length
    ? avail.oneOffEvents.map(e => `${e.label} on ${e.date}`).join('; ')
    : 'None declared'}`);
  lines.push('');

  lines.push('## 5. Goals & Mindset');
  lines.push(`Q25 Primary goal: ${fmt(mind.primaryGoal)}`);
  if (triathlon) lines.push(`Q26 Discipline most want to improve: ${fmt(mind.disciplineToImprove)}`);
  lines.push(`Q27 Most nervous/uncertain about: ${fmt(mind.nervousAbout)}`);
  lines.push('');

  lines.push('## 6. Injury & Health History');
  lines.push(`Q28 Past injuries: ${(inj.pastInjuries || []).length
    ? inj.pastInjuries.map(p => `${p.area}${p.description ? ' — ' + p.description : ''} (${p.resolved ? 'resolved' : 'ongoing'})`).join('; ')
    : 'None declared'}`);
  lines.push(`Current niggles/soreness: ${fmt(inj.currentNiggles, 'None')}`);
  lines.push(`Health conditions: ${fmt(inj.healthConditions, 'None')}`);
  // avoidExercises (free text) was replaced by a structured avoidExerciseIds
  // multi-select — fall back to the old free-text field for an intake saved
  // before that change.
  const avoidNames = (inj.avoidExerciseIds || [])
    .map(id => CONDITIONING_EXERCISES.find(e => e.id === id)?.name)
    .filter(Boolean);
  lines.push(`Q29 Exercises/movements advised to avoid: ${avoidNames.length ? avoidNames.join(', ') : fmt(inj.avoidExercises, 'None')}`);
  lines.push(`Q30 Aggravating movements/surfaces: ${fmt(inj.aggravatingFactors, 'None')}`);
  lines.push('');

  lines.push('## 7. Optional');
  // Target/cutoff time and the confirmed pace split were captured earlier
  // (Stage 2 race details + Stage 3's pace-confirm step) — read the
  // structured values instead of asking the athlete to restate them here,
  // and instead of re-deriving your own pacing when they're present.
  const targetSeconds = cfg.hasTargetTime ? cfg.targetTimeSeconds : null;
  const cutoffSeconds = cfg.hasCutoffTime ? cfg.cutoffTimeSeconds : null;
  lines.push(`Q31 Target finish time: ${targetSeconds ? formatSecondsAsHMS(targetSeconds) : 'Not specified'}`);
  if (cutoffSeconds) {
    lines.push(`Race cutoff / qualifying time: ${formatSecondsAsHMS(cutoffSeconds)} — the plan must realistically get the athlete under this`);
  }
  if (triathlon && cfg.cutoffTimes && Object.keys(cfg.cutoffTimes).length) {
    const legLines = Object.entries(cfg.cutoffTimes)
      .filter(([, secs]) => secs > 0)
      .map(([disc, secs]) => `${disc} ${formatSecondsAsHMS(secs)}`);
    if (legLines.length) lines.push(`Per-discipline cutoffs (§A.10): ${legLines.join(', ')}`);
  }
  const targetPaces = intake?.targetPaces;
  if (targetPaces && Object.keys(targetPaces).length) {
    const paceLines = Object.entries(targetPaces).map(([disc, secs]) => {
      if (disc === 'transition') return `T1+T2 allowance ${formatSecondsAsHMS(secs)}`;
      const distanceKm = legDistanceKm(disc, cfg.raceType);
      const pace = formatPaceForDiscipline(disc, secs, distanceKm, false);
      return `${disc} ${formatSecondsAsHMS(secs)}${pace ? ` (${pace})` : ''}`;
    });
    lines.push(`Confirmed target split (already calculated and approved by the athlete — use these numbers directly rather than deriving your own pacing): ${paceLines.join(', ')}`);
  }
  lines.push(`Q32 Prior race experience: ${fmt(mind.priorExperience, 'Not specified')}`);
  lines.push(`Q33 Current speed/interval training: ${fmt(mind.usesSpeedTraining, 'Not specified')}`);
  lines.push(`Q34 Other lifestyle/schedule notes: ${fmt(mind.lifestyleNotes, 'None')}`);

  return { text: lines.join('\n'), mappedRaceType, triathlon, raceDate: cfg.raceDate };
}

// ── JSON output schema instructions (replaces the openpyxl/.xlsx section) ──

const JSON_SCHEMA_BLOCK = `
## OUTPUT FORMAT — read this instead of "SPREADSHEET FORMAT" in the rules above

You are generating a plan for an in-app display, not a downloadable spreadsheet.
Do NOT write or execute any code. Respond with ONE single JSON object and
nothing else — no markdown code fences, no prose before or after it. It must
be valid JSON that can be parsed with JSON.parse().

Shape:

{
  "meta": {
    "raceType": string,
    "raceDate": "YYYY-MM-DD",
    "startDate": "YYYY-MM-DD",
    "totalWeeks": number,
    "eventDistances": string,        // e.g. "1.5km / 40km / 10km" or "42.2km"
    "overview": string                // multi-paragraph plain text covering: phase breakdown
                                       // with calendar date ranges, weekly day structure,
                                       // discipline-frequency rationale (triathlon), warm-up
                                       // & cool-down reference, holiday/event adjustments
                                       // summary, health note if applicable, compression
                                       // warning if applicable
  },
  "phases": [
    { "label": "Foundation" | "Build" | "Peak" | "Taper", "weeks": [startWeek, endWeek], "color": "#RRGGBB" }
  ],
  "sessions": {
    "YYYY-MM-DD": [
      {
        "type": "swim" | "bike" | "run" | "brick" | "conditioning" | "rest" | "race",
        "label": string,             // discipline name, e.g. "Swim", "Bike", "Run", "Rest"
        "sessionType": string,       // concise session structure, no discipline name repeated
        "duration": string,          // e.g. "450m", "35min", or "-" for rest
        "flag": string,              // "Brick" / "Holiday" / "Big ride" / "Recovery" /
                                      // "Recovery week" / "Peak week" / "Race sim" / "Pre-taper"
                                      // or "" if none — combine with " / " where relevant
        "intensity": "Low" | "Medium" | "High",
        "done": false,
        "week": number,
        "phase": "Foundation" | "Build" | "Peak" | "Taper"
      }
    ]
  },
  "glossary": [
    { "term": string, "discipline": "Swim" | "Bike" | "Run" | "Combined" | "Conditioning", "description": string }
  ],
  "audit": {
    "tenPercentRule": string,   // the Step 7 10% RULE AUDIT report, as plain text
    "eightyTwentyRule": string, // the Step 7 80/20 AUDIT report, as plain text
    "summary": string           // the Step 7 PLAN AUDIT SUMMARY, as plain text
  }
}

Rules for this JSON:
- "sessions" must have one entry per calendar date from start date to race date
  inclusive (every day, not just training days) — rest days included with
  type "rest", duration "-".
- Every date key must be an ISO "YYYY-MM-DD" string.
- Brick days: include two entries in that date's array — one "bike" and one
  "run" — both flagged "Brick".
- Keep "sessionType" concise (fits a table cell) — detailed explanations belong
  in "glossary", not repeated per-session.
- Do not include any keys beyond the ones specified above.`.trim();

export function buildPlanPrompt({ goalsPayload, intake }) {
  const { text: answersBlock, mappedRaceType, triathlon, raceDate } = buildAnswersBlock({ goalsPayload, intake });

  return `
You are a specialist endurance sports coach with expertise in triathlon and running programming across all race distances. Generate a fully personalised, week-by-week training plan for this athlete, following the rules below exactly, based on their intake answers.

${triathlon ? 'This is a TRIATHLON plan — apply the triathlon-specific rules (swim/bike/run/brick sessions, discipline ranking, pool access).' : 'This is a RUNNING-ONLY plan — apply the running race-type rules only; ignore all swim/bike/brick/pool-access rules.'}

## STEP 1: DETERMINE RACE TYPE AND TAPER

Read the race type and start date / total weeks before doing anything else. This governs all downstream decisions.

### Taper lengths by race type

**Triathlon:**
| Race type | Taper | Volume cut | Notes |
|---|---|---|---|
| Sprint Triathlon | 7 days (1 week) | ~50% | Maintain frequency and race-pace intensity throughout |
| Olympic Triathlon | 10–14 days (~2 weeks) | ~40–50% | Week 1 of taper: moderate cut. Final 4–5 days: sharp cut |
| Half Ironman (70.3) | 14 days (2 weeks) | ~50–60% | Both weeks reduced; more significant cut in final week |
| Full Ironman | 21 days (3 weeks) | ~60–70% | Progressive reduction across all 3 weeks |

**Running:**
| Race type | Taper | Volume cut | Notes |
|---|---|---|---|
| 10K | 5–7 days | ~30–40% | Short and sharp; keep intensity, cut mileage |
| Half Marathon | 10–14 days | ~30–40% | Reduce long run 20% in taper wk 1, further in race week |
| Marathon | 2–3 weeks | ~40–50% | 3 weeks preferred; progressive reduction each week |

In all tapers:
- Maintain session frequency (same number of sessions per week)
- Include short race-pace efforts in each session to stay sharp
- Final day before race = 15min easy bike spin (triathlon) or 10min easy jog (running), no new stimulus
- No new conditioning work during taper

### Peak volume targets by race type (before taper begins)

**Triathlon:**
| Race type | Swim peak | Bike peak session | Run peak session |
|---|---|---|---|
| Sprint Triathlon | 850–900m | 75min | 40min |
| Olympic Triathlon | 1,800–2,000m | 90–120min | 60–70min |
| Half Ironman (70.3) | 2,500–3,000m | 3–4 hours | 90–120min |
| Full Ironman | 3,500–4,000m | 5–6 hours | 2–2.5 hours |

Brick sessions scale accordingly. Sprint Triathlon bricks peak at ~45min bike + 25min run. Full Ironman bricks can reach 4hr bike + 45min run in peak week.

**Running:**
| Race type | Peak long run | Peak weekly mileage |
|---|---|---|
| 10K | 8–10km | ~35–45km |
| Half Marathon | 18–21km | ~50–65km |
| Marathon | 29–32km | ~70–90km |

## STEP 2: ASSESS TOTAL AVAILABLE WEEKS AND SET PHASES

### Minimum recommended weeks by race type
| Race type | Minimum weeks | Recommended weeks |
|---|---|---|
| Sprint Triathlon | 8 | 12–18 |
| Olympic Triathlon | 12 | 16–20 |
| Half Ironman (70.3) | 16 | 20–24 |
| Full Ironman | 20 | 28–32 |
| 10K | 6 | 8–12 |
| Half Marathon | 10 | 12–16 |
| Marathon | 16 | 16–20 |

### Phase logic based on available weeks

**If total weeks ≥ recommended minimum:** Include all phases: Foundation/Base → Build → Peak → Taper. Phase splits (% of non-taper weeks): Foundation/Base ~30–35%, Build ~40–45%, Peak ~20–25%.

**If total weeks ≥ 60% of recommended minimum but < recommended minimum:** Skip Foundation/Base entirely. Begin in Build. Add this note to the overview: "Due to the time available, this plan begins in the Build phase. A Foundation phase has been omitted. Ensure you are already comfortable with the baseline distances for each discipline before starting — the early weeks will be more demanding than a full plan." Phase splits: Build ~55–60%, Peak ~40–45%.

**If total weeks < 60% of recommended minimum:** Flag high risk prominently in the overview: "Warning: The time available is significantly shorter than recommended for this race type. Consider a shorter-distance goal race, extending your start date, or accepting a finish-only goal. This plan will be compressed and demanding." Assume athlete confirms and proceed. Plan: Build + Peak + Taper only.

## STEP 3: BUILD THE WEEKLY STRUCTURE

**Read the athlete's day preferences before assigning any sessions to days — they override the default template.**

- Long/key session day: place the longest or most demanding session (long ride, brick, peak run) on the athlete's preferred day. Default: Sunday.
- Second discipline day: place the second session of the same or different discipline on the athlete's preferred day. Default: Saturday.
- Conditioning day: place on the day the athlete specifies — including weekend days. Do NOT place on the same day as a long or high-intensity session unless the athlete explicitly requested that. If placed on a weekend day it replaces what would otherwise be a rest or short easy session. Default: mid-week day.
- Rest days: honour any day the athlete has declared must stay free. At least one full rest day per week; two in taper.
- Standing personal commitments: show on plan, label as personal/external, not counted in training load.

### Default weekly template (when no preferences declared)
| Day | Default session |
|---|---|
| Monday | Standing personal session or rest |
| Tuesday | Swim (or first training discipline) |
| Wednesday | Bike (or second training discipline) |
| Thursday | Run (or third training discipline) |
| Friday | Rest or Conditioning |
| Saturday | Second swim or second run |
| Sunday | Bike or Brick — key session of the week |

### Discipline frequency in Foundation (Triathlon only)

**Mandatory. Read the discipline ranking before scheduling any Foundation sessions.** The weakest discipline gets the earliest claim on additional weekly sessions. The strongest discipline starts with one session per week and only earns a second slot once Build begins (or in the final 1–2 Foundation weeks if total weeks allow).

| Discipline rank | Early Foundation (wks 1–2) | Mid Foundation (wks 3–4) | Late Foundation (wks 5–6) |
|---|---|---|---|
| Weakest | 1 session | 2 sessions | 2 sessions |
| Middle | 1 session | 1 session | 2 sessions |
| Strongest | 1 session | 1 session | 1 session* |

*Strongest discipline only gets a second Foundation session if total plan weeks justify it (≥14 weeks) and it doesn't displace recovery time. Otherwise it stays at 1 session/week until Build.

### Brick session rules (Triathlon only)
- Begin in Week 1 of Build phase — never in Foundation
- In the final 1–2 Foundation weeks: add a short transition run (5–10min) onto the end of the Sunday long bike as a gentle introduction
- Both the bike entry and run entry on a brick day must be flagged "Brick"
- Brick duration progresses across Build and Peak phases
- Do not label holiday or opportunistic same-day sessions as bricks

### Recovery weeks
- One planned down/recovery week every 3–4 hard weeks
- Recovery week: ~30% volume reduction, keep frequency, keep a little intensity
- Flag the key session in a recovery week "Recovery week"

## STEP 4: HANDLE ONE-OFF EVENTS

For each declared event, apply in strict order:
1. **Replace**: planned session on event date → replaced by the event. Flag "Big ride", "Race sim", etc.
2. **Recover**: day immediately after → easy recovery session regardless of what was originally planned. Flag "Recovery".
3. **Reschedule**: the displaced session from step 1 → moved to another available day in the same week. Do not place it directly before or after another hard session. If no suitable slot exists, absorb the loss — do not carry forward.
4. **Document** every one-off event in the overview: date, what it replaced, and where the displaced session was rescheduled to (or "absorbed").

## STEP 5: HANDLE HOLIDAYS AND SCHEDULE DISRUPTIONS

For each declared holiday period:
- Map every date individually based on the athlete's declared availability for that period
- Travel days = Rest, no training
- Sea/open water swimming substitutes for pool swim sessions — label "Open water / sea swim"
- Same-day sea swim + run is NOT a brick — opportunistic only
- Flag every affected date "Holiday"
- Do not compensate for missed holiday volume in surrounding weeks — absorb the loss

## STEP 6: SESSION VOLUME PROGRESSION

**Swim (triathlon only):** start from the athlete's comfortable continuous distance, build progressively toward and past race distance, reach race distance no later than 65% through the block, peak ~10–20% above race distance, taper back sharply in the final week.

**Bike (triathlon only):** start conservatively based on current fitness, build toward peak session duration across Build phase, treat one-off big-ride events as peak training stimulus and reduce surrounding sessions that week.

**Run (all race types):** keep easy runs genuinely easy especially in Foundation/Base, introduce strides early, add tempo efforts from mid-Build, race-pace intervals in Peak and Taper, never increase weekly run volume by more than 10% week-on-week.

**Conditioning:** 20–25min every week from Week 1 through the penultimate week, on the declared conditioning day. Standard circuit: glute bridge, bird dog, clamshell, dead bug, side plank — 2–3 rounds (triathlon: general hip & core focus; running-only: running-specific strength — glutes, hips, single-leg stability, core). Drops entirely in taper and race week. If no gym access, replace with rest or an active-recovery note.

## WARM-UP & COOL-DOWN REFERENCE (include in the overview)

**Swim** — Warm-up: 100–150m easy mixed swimming + arm/shoulder circles poolside. Cool-down: 100m easy.
**Bike** — Warm-up: 5–10min easy spin building gradually + a few high-cadence spin-ups in the final 2min. Cool-down: 5min easy spin.
**Run** — Warm-up: 5min brisk walk/easy jog + leg swings x10 each leg + walking lunges x10 + high knees/butt kicks x20m. Cool-down: 5min walk + static stretches 20–30s each: calves, hamstrings, quads, hip flexors, glutes.

## HEALTH & INJURY RULES

If the athlete declared any injury or health concern:
- Add a clearly flagged health note in the overview
- State this conditioning circuit is general injury-prevention work, not a personalised treatment plan
- Recommend physio review before starting
- Advise stopping any exercise immediately if it increases pain, numbness, or tingling
- In the glossary, annotate potentially contraindicated exercises with a caution note
- Do not remove exercises — flag them and let the athlete/physio decide

## STEP 7: SELF-AUDIT (fill "audit" in the JSON, do not omit)

Before finalising the JSON, run these checks against your own plan data:

**10% Rule** — for each week, compute total training volume in minutes (swim: 2min/100m; bike/run: stated minutes midpoint; conditioning: 22min flat; personal/rest/race: 0), then week-on-week % change. Flag any week where volume increases >10%, except: a week introducing a new training day for the first time ("New day introduced"), any holiday/disruption week, any one-off event week, or the week immediately following one of those (returning to normal volume is expected). Write the report (one line per week) into "audit.tenPercentRule", ending with "Violations (excluding accepted exceptions): X".

**80/20 Rule** — classify every session's intensity as Low/Medium/High (Low = easy/aerobic/technique/conditioning/recovery; Medium = tempo/moderate intervals/pacing practice; High = hard intervals/hill repeats/race pace/race sim). Targets: Foundation 0 hard sessions & ≥90% low; Build 1–2 hard sessions & ≥60% low; Peak 1–2 hard sessions & ≥50% low; Taper 0–1 hard sessions & ≥80% low. Write the report (one line per representative week, hard-session counts, low%) into "audit.eightyTwentyRule", ending with "Weeks exceeding Hard session target: X".

Write a short combined summary into "audit.summary": total 10%-rule violations (with accepted-exception count), total weeks above the 80/20 hard-session target, and any notable flags with recommended fixes.

${JSON_SCHEMA_BLOCK}

## ATHLETE INTAKE ANSWERS

${answersBlock}

Race date: ${raceDate || 'not provided — infer a sensible date only if truly absent, otherwise use the date given above'}.

Respond with the JSON object now — nothing else.`.trim();
}
