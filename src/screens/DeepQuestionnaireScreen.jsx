import React from 'react';
import themes from '../data/themes';
import { isSupportedAIRaceType } from '../utils/planPrompt';
import { canComputePace, deriveSplitFromBaseline, formatPaceForDiscipline, legDistanceKm } from '../utils/raceTargets';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const BODY_AREAS = [
  'Knee', 'Ankle', 'Hip', 'Lower back', 'Upper back', 'Shoulder',
  'Elbow', 'Wrist', 'Hamstring', 'Quad', 'Calf', 'Achilles', 'Other',
];

const FREQ_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];

const DISCIPLINE_META = {
  swim: { icon: '🏊', label: 'Swim' },
  bike: { icon: '🚴', label: 'Bike' },
  run:  { icon: '🏃', label: 'Run' },
};
const DEFAULT_DISCIPLINE_ORDER = ['bike', 'run', 'swim'];
const DISCIPLINE_RANK_LABELS  = ['Strongest', 'Middle', 'Weakest'];
const DISCIPLINE_RANK_COLOURS = ['#15803D', '#6D4AAF', '#BE5A38'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEventRaceGoal(goals = []) {
  return goals.some(g =>
    g.type === 'event_race' && (g.config?.raceType || '').toLowerCase().includes('triathlon')
  );
}

function isRaceGoal(goals = []) {
  return goals.some(g => g.type === 'event_race');
}

// A pace/split confirmation step is only meaningful when there's a target or
// cutoff time to convert AND the race type has a known distance to convert
// it against (see raceTargets.js — Cycling Sportive/Open Water Swim/Other
// have no fixed distance in this app's data model).
function needsPaceConfirm(goals) {
  const cfg = goals.find(g => g.type === 'event_race')?.config || {};
  const total = cfg.hasTargetTime ? cfg.targetTimeSeconds : (cfg.hasCutoffTime ? cfg.cutoffTimeSeconds : null);
  return isRaceGoal(goals) && canComputePace(cfg.raceType) && Number.isFinite(total) && total > 0;
}

function buildSteps(goals) {
  const steps = ['intro'];
  if (isRaceGoal(goals))       steps.push('run');
  if (isEventRaceGoal(goals))  steps.push('swim', 'bike', 'discipline_rank');
  steps.push('availability', 'preferences', 'mindset', 'injury');
  if (needsPaceConfirm(goals)) steps.push('pace_confirm');
  steps.push('done');
  return steps;
}

const EMPTY_INTAKE = {
  status: 'draft',
  completedAt: null,
  runBaseline: {
    time5k: '', time10k: '', timeHalfMarathon: '', timeMarathon: '',
    longestEffortKm: '', weeklyRunsCount: 3,
  },
  swimBaseline: {
    time400m: '', longestSessionM: '', weeklySessionsCount: 2,
  },
  bikeBaseline: {
    ftpWatts: '', longestRideKm: '', weeklySessionsCount: 2,
  },
  // Strongest → weakest, triathlon only (e.g. ['bike', 'run', 'swim'])
  disciplineRanking: [],
  // Confirmed (possibly user-edited) leg times in seconds, e.g. { swim, transition, bike, run }
  // or { run } for a single-discipline race — null until the pace_confirm step runs.
  targetPaces: null,
  availability: {
    holidays: [],            // [{ label, from, to }]
    oneOffEvents: [],        // [{ label, date }]
    standingCommitments: [], // [{ label, day, time }]
  },
  preferences: {
    longSessionDay:       '', // long/key session day, e.g. brick or long run — default Sunday
    secondDisciplineDay:  '', // second key session day — default Saturday
    conditioningDay:      '', // strength/conditioning day, only if gym access
  },
  mindset: {
    primaryGoal:          '', // race-day goal — finish / time / milestone
    disciplineToImprove:  '', // triathlon only
    nervousAbout:         '',
    targetTime:           '', // optional
    priorExperience:      '', // optional
    usesSpeedTraining:    '', // optional
    lifestyleNotes:       '', // optional
  },
  injury: {
    pastInjuries: [],   // [{ area, description, resolved }]
    currentNiggles: '',
    healthConditions: '',
    avoidExercises: '',
    aggravatingFactors: '',
  },
};

// ─── DeepQuestionnaireScreen ──────────────────────────────────────────────────

export function DeepQuestionnaireScreen({
  width = 390, height = 820, theme = 'light',
  goalsPayload,   // from Stage 2
  onComplete,     // (intakePayload, skipped: bool) => void
  onGeneratePlan, // (intakePayload) => Promise — generates + applies a plan via Claude
  onExit,         // () => void — save draft and go back without completing
  userId,
  initialIntake,  // for re-opening from settings
}) {
  const t     = themes[theme];
  const goals = goalsPayload?.goals ?? [];
  const steps = buildSteps(goals);

  const raceType   = goals.find(g => g.type === 'event_race')?.config?.raceType;
  const canGenerate = isRaceGoal(goals) && isSupportedAIRaceType(raceType) && typeof onGeneratePlan === 'function';
  const [aiGen, setAiGen] = React.useState('idle'); // idle | working | error
  const [aiGenErr, setAiGenErr] = React.useState('');

  const [stepIdx, setStepIdx] = React.useState(0);
  const current = steps[stepIdx] || 'intro';
  const isLast  = stepIdx === steps.length - 1;

  const [intake, setIntake] = React.useState(() => ({
    ...EMPTY_INTAKE,
    ...(initialIntake || {}),
    availability: { ...EMPTY_INTAKE.availability, ...(initialIntake?.availability || {}) },
    preferences:  { ...EMPTY_INTAKE.preferences,  ...(initialIntake?.preferences  || {}) },
    mindset:      { ...EMPTY_INTAKE.mindset,      ...(initialIntake?.mindset      || {}) },
    injury:       { ...EMPTY_INTAKE.injury,       ...(initialIntake?.injury || {}) },
  }));

  // Draft state for list-entry sub-forms
  const [holidayDraft,     setHolidayDraft]     = React.useState({ label: '', from: '', to: '' });
  const [oneOffDraft,      setOneOffDraft]       = React.useState({ label: '', date: '' });
  const [commitmentDraft,  setCommitmentDraft]   = React.useState({ label: '', day: '', time: '' });
  const [injuryDraft,      setInjuryDraft]       = React.useState({ area: '', description: '', resolved: true });

  const patchIntake  = (key, patch) =>
    setIntake(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  const patchAvail   = (key, patch) =>
    setIntake(prev => ({ ...prev, availability: { ...prev.availability, [key]: patch } }));
  const patchInjury  = (patch) =>
    setIntake(prev => ({ ...prev, injury: { ...prev.injury, ...patch } }));

  const progress = current === 'intro' ? 0 : (stepIdx / (steps.length - 1));

  const next = () => {
    if (isLast) handleComplete(false);
    else        setStepIdx(s => s + 1);
  };
  const back = () => setStepIdx(s => Math.max(1, s - 1)); // can't go back past intro once started

  const handleSkip = () => {
    const payload = { ...intake, status: 'draft', completedAt: null };
    persist(payload);
    onComplete(payload, true);
  };

  const handleExit = () => {
    const payload = { ...intake, status: 'draft', completedAt: null };
    persist(payload);
    onExit?.();
  };

  const handleComplete = (skipped = false) => {
    const payload = {
      ...intake,
      status:      skipped ? 'draft' : 'complete',
      completedAt: skipped ? null : new Date().toISOString(),
    };
    persist(payload);
    // Confirmed target paces belong on the event_race goal itself (read by
    // both the basic scheduler and the AI prompt), not just the intake
    // record — pass them back up so App.jsx can merge them into goals[].
    const goalConfigPatch = intake.targetPaces ? { targetPaces: intake.targetPaces } : null;
    onComplete(payload, skipped, goalConfigPatch);
  };

  const persist = (payload) => {
    if (userId) {
      try { localStorage.setItem(`forma_intake_${userId}`, JSON.stringify(payload)); } catch {}
    }
  };

  const handleGenerateClick = async () => {
    setAiGen('working');
    setAiGenErr('');
    try {
      await onGeneratePlan(intake);
      handleComplete(false);
    } catch (e) {
      setAiGenErr(e.message || 'Something went wrong generating your plan.');
      setAiGen('error');
    }
  };

  // ── section helpers ───────────────────────────────────────────────────────

  const addHoliday = () => {
    if (!holidayDraft.label || !holidayDraft.from) return;
    patchAvail('holidays', [...intake.availability.holidays, { ...holidayDraft }]);
    setHolidayDraft({ label: '', from: '', to: '' });
  };

  const addOneOff = () => {
    if (!oneOffDraft.label || !oneOffDraft.date) return;
    patchAvail('oneOffEvents', [...intake.availability.oneOffEvents, { ...oneOffDraft }]);
    setOneOffDraft({ label: '', date: '' });
  };

  const addCommitment = () => {
    if (!commitmentDraft.label || !commitmentDraft.day) return;
    patchAvail('standingCommitments', [...intake.availability.standingCommitments, { ...commitmentDraft }]);
    setCommitmentDraft({ label: '', day: '', time: '' });
  };

  const addInjury = () => {
    if (!injuryDraft.area) return;
    patchInjury({ pastInjuries: [...intake.injury.pastInjuries, { ...injuryDraft }] });
    setInjuryDraft({ area: '', description: '', resolved: true });
  };

  const disciplineRanking = intake.disciplineRanking.length ? intake.disciplineRanking : DEFAULT_DISCIPLINE_ORDER;
  const moveDiscipline = (idx, dir) => {
    const arr = [...disciplineRanking];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setIntake(prev => ({ ...prev, disciplineRanking: arr }));
  };

  const labelFor = (s) => ({
    run: 'Run baseline', swim: 'Swim baseline', bike: 'Bike baseline',
    discipline_rank: 'Discipline ranking',
    availability: 'Availability', preferences: 'Day preferences', mindset: 'Goals & mindset',
    injury: 'Health & injury', pace_confirm: 'Confirm pace targets', done: '',
  }[s] || '');

  // ── pace/split confirmation (target-time → pace) ──────────────────────────

  const eventRaceConfig = goals.find(g => g.type === 'event_race')?.config || {};
  const targetTotalSeconds = eventRaceConfig.hasTargetTime
    ? eventRaceConfig.targetTimeSeconds
    : (eventRaceConfig.hasCutoffTime ? eventRaceConfig.cutoffTimeSeconds : null);

  // Compute the default/baseline-derived split once, the first time this step
  // is reached — after that, the user's edits (in intake.targetPaces) win.
  React.useEffect(() => {
    if (current === 'pace_confirm' && !intake.targetPaces) {
      const computed = deriveSplitFromBaseline(eventRaceConfig.raceType, targetTotalSeconds, {
        run: intake.runBaseline, swim: intake.swimBaseline,
      });
      if (computed) setIntake(prev => ({ ...prev, targetPaces: computed }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const setPaceLeg = (discipline, hours, minutes) => {
    const existing = intake.targetPaces?.[discipline] || 0;
    const h = hours !== undefined ? hours : Math.floor(existing / 3600);
    const m = minutes !== undefined ? minutes : Math.floor((existing % 3600) / 60);
    const seconds = (parseInt(h, 10) || 0) * 3600 + (parseInt(m, 10) || 0) * 60;
    setIntake(prev => ({ ...prev, targetPaces: { ...prev.targetPaces, [discipline]: seconds } }));
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      width, height, background: t.bg, fontFamily: t.sans, color: t.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: -80, right: -60, width: 280, height: 280, borderRadius: '50%',
        background: `radial-gradient(circle, ${t.accent}22, transparent 65%)`, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -80, left: -60, width: 260, height: 260, borderRadius: '50%',
        background: `radial-gradient(circle, #6D4AAF14, transparent 65%)`, pointerEvents: 'none',
      }} />

      {/* Status bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 22px 8px', fontSize: 14, fontWeight: 600,
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Progress + back — hidden on intro */}
      {current !== 'intro' && (
        <div style={{ padding: '4px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {stepIdx > 1 && current !== 'done' ? (
            <button onClick={back} style={{
              width: 32, height: 32, borderRadius: 9, background: 'transparent',
              border: `1px solid ${t.border}`, color: t.text, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
            }}>←</button>
          ) : <div style={{ width: 32, flexShrink: 0 }} />}

          <div style={{ flex: 1 }}>
            <div style={{ height: 3, background: t.border, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: t.accent, borderRadius: 99,
                width: `${progress * 100}%`, transition: 'width .4s cubic-bezier(.2,.7,.2,1)',
              }} />
            </div>
            <div style={{
              fontSize: 9.5, color: t.text3, marginTop: 4, letterSpacing: '.06em',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Section {stepIdx} of {steps.length - 2}</span>
              <span style={{ textTransform: 'uppercase' }}>{labelFor(current)}</span>
            </div>
          </div>

          {onExit ? (
            <button onClick={handleExit} style={{
              width: 32, height: 32, borderRadius: 9, background: 'transparent',
              border: `1px solid ${t.border}`, color: t.text3, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
            }}>×</button>
          ) : <div style={{ width: 32 }} />}
        </div>
      )}

      {/* Exit button on intro step when opened from settings */}
      {current === 'intro' && onExit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 20px 4px' }}>
          <button onClick={handleExit} style={{
            width: 32, height: 32, borderRadius: 9, background: 'transparent',
            border: `1px solid ${t.border}`, color: t.text3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>×</button>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 20px' }} className="phone-scroll">

        {/* ── intro ── */}
        {current === 'intro' && (
          <div style={{ paddingTop: 8 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: `linear-gradient(135deg, ${t.accent}, #6D4AAF)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, marginBottom: 24,
              boxShadow: `0 12px 32px ${t.accent}28`,
            }}>📋</div>

            <div style={{ fontFamily: t.serif, fontSize: 32, lineHeight: 1.08, marginBottom: 10, letterSpacing: '-.01em' }}>
              Refine your plan.
            </div>
            <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.6, marginBottom: 28 }}>
              Five minutes to tell us your baseline fitness, any upcoming holidays,
              and injury history. We'll use this to build a more accurate, realistic plan — not just a template.
            </div>

            {/* Sections preview */}
            <div style={{
              background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14,
              padding: '12px 16px', marginBottom: 20,
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
                color: t.text3, fontWeight: 600, marginBottom: 10,
              }}>What we'll cover</div>
              {[
                isRaceGoal(goals)      && { icon: '🏃', label: 'Run baseline — times & weekly volume' },
                isEventRaceGoal(goals) && { icon: '🏊', label: 'Swim baseline — pace & pool sessions' },
                isEventRaceGoal(goals) && { icon: '🚴', label: 'Bike baseline — power & longest ride' },
                isEventRaceGoal(goals) && { icon: '🎯', label: 'Discipline ranking — strongest to weakest' },
                { icon: '📅', label: 'Availability — holidays, one-off events, commitments' },
                { icon: '🗓️', label: 'Day preferences — shape your weekly structure' },
                { icon: '✦',  label: 'Goals & mindset — what drives race day' },
                { icon: '🩺', label: 'Injury & health — past injuries, current niggles' },
                needsPaceConfirm(goals) && { icon: '⏱️', label: 'Confirm pace targets — from your target/cutoff time' },
              ].filter(Boolean).map((item, i, arr) => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                  borderTop: i > 0 ? `1px solid ${t.border}` : 'none',
                }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontSize: 12, color: t.text2 }}>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{
              padding: '10px 12px', borderRadius: 10, background: t.surface2,
              border: `1px dashed ${t.border}`, fontSize: 11.5, color: t.text3, lineHeight: 1.5,
            }}>
              You can complete or update this anytime from your profile settings.
            </div>
          </div>
        )}

        {/* ── run baseline ── */}
        {current === 'run' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Run baseline.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Best recent times — leave blank if you haven't raced that distance.
            </div>

            <DQField label="5K time" hint="e.g. 25:30" t={t}>
              <TimeInput
                value={intake.runBaseline.time5k}
                onChange={v => patchIntake('runBaseline', { time5k: v })}
                placeholder="mm:ss"
                t={t}
              />
            </DQField>
            <DQField label="10K time" hint="e.g. 53:00" t={t}>
              <TimeInput
                value={intake.runBaseline.time10k}
                onChange={v => patchIntake('runBaseline', { time10k: v })}
                placeholder="mm:ss"
                t={t}
              />
            </DQField>
            <DQField label="Half marathon time" hint="e.g. 1:58:00" t={t}>
              <TimeInput
                value={intake.runBaseline.timeHalfMarathon}
                onChange={v => patchIntake('runBaseline', { timeHalfMarathon: v })}
                placeholder="h:mm:ss"
                t={t}
              />
            </DQField>
            <DQField label="Marathon time" hint="e.g. 4:12:00" t={t}>
              <TimeInput
                value={intake.runBaseline.timeMarathon}
                onChange={v => patchIntake('runBaseline', { timeMarathon: v })}
                placeholder="h:mm:ss"
                t={t}
              />
            </DQField>
            <DQField label="Longest single run recently (km)" t={t}>
              <input
                type="number" inputMode="decimal" min="0" max="200" step="0.5"
                value={intake.runBaseline.longestEffortKm}
                onChange={e => patchIntake('runBaseline', { longestEffortKm: e.target.value })}
                placeholder="e.g. 18"
                style={inputSt(t)}
              />
            </DQField>
            <DQField label="How many times do you run per week?" t={t}>
              <FreqRow
                value={intake.runBaseline.weeklyRunsCount}
                onChange={v => patchIntake('runBaseline', { weeklyRunsCount: v })}
                t={t}
              />
            </DQField>
          </div>
        )}

        {/* ── swim baseline ── */}
        {current === 'swim' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Swim baseline.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Your current pool performance — approximate is fine.
            </div>

            <DQField label="400m swim time" hint="e.g. 7:45" t={t}>
              <TimeInput
                value={intake.swimBaseline.time400m}
                onChange={v => patchIntake('swimBaseline', { time400m: v })}
                placeholder="mm:ss"
                t={t}
              />
            </DQField>
            <DQField label="Longest continuous swim (metres)" t={t}>
              <input
                type="number" inputMode="numeric" min="0" max="50000" step="100"
                value={intake.swimBaseline.longestSessionM}
                onChange={e => patchIntake('swimBaseline', { longestSessionM: e.target.value })}
                placeholder="e.g. 1500"
                style={inputSt(t)}
              />
            </DQField>
            <DQField label="How many swim sessions per week?" t={t}>
              <FreqRow
                value={intake.swimBaseline.weeklySessionsCount}
                onChange={v => patchIntake('swimBaseline', { weeklySessionsCount: v })}
                t={t}
                max={7}
              />
            </DQField>
          </div>
        )}

        {/* ── bike baseline ── */}
        {current === 'bike' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Bike baseline.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Your current cycling fitness — FTP and longest recent ride.
            </div>

            <DQField label="FTP — Functional Threshold Power (watts)" hint="Leave blank if untested. Roughly: hard 20-min effort × 0.95." t={t}>
              <input
                type="number" inputMode="numeric" min="0" max="600" step="1"
                value={intake.bikeBaseline.ftpWatts}
                onChange={e => patchIntake('bikeBaseline', { ftpWatts: e.target.value })}
                placeholder="e.g. 210"
                style={inputSt(t)}
              />
            </DQField>
            <DQField label="Longest ride recently (km)" t={t}>
              <input
                type="number" inputMode="decimal" min="0" max="500" step="1"
                value={intake.bikeBaseline.longestRideKm}
                onChange={e => patchIntake('bikeBaseline', { longestRideKm: e.target.value })}
                placeholder="e.g. 60"
                style={inputSt(t)}
              />
            </DQField>
            <DQField label="How many bike sessions per week?" t={t}>
              <FreqRow
                value={intake.bikeBaseline.weeklySessionsCount}
                onChange={v => patchIntake('bikeBaseline', { weeklySessionsCount: v })}
                t={t}
                max={7}
              />
            </DQField>
          </div>
        )}

        {/* ── discipline ranking ── */}
        {current === 'discipline_rank' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Rank your disciplines.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Strongest to weakest. Your weakest discipline gets priority for extra weekly sessions early on.
            </div>
            {disciplineRanking.map((disc, idx) => {
              const meta = DISCIPLINE_META[disc];
              return (
                <div key={disc} style={{
                  padding: '12px 14px', borderRadius: 13, marginBottom: 8,
                  background: t.surface, border: `1.5px solid ${t.border}`,
                  display: 'flex', alignItems: 'center', gap: 11,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: DISCIPLINE_RANK_COLOURS[idx] + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                  }}>{meta.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{meta.label}</div>
                    <div style={{
                      fontSize: 9.5, letterSpacing: '.08em', fontWeight: 700,
                      color: DISCIPLINE_RANK_COLOURS[idx], textTransform: 'uppercase', marginTop: 2,
                    }}>{DISCIPLINE_RANK_LABELS[idx]}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <button onClick={() => moveDiscipline(idx, -1)} disabled={idx === 0} style={{
                      width: 28, height: 26, borderRadius: 7, border: `1px solid ${t.border}`,
                      background: 'transparent', color: idx === 0 ? t.text3 : t.text,
                      cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>▲</button>
                    <button onClick={() => moveDiscipline(idx, 1)} disabled={idx === disciplineRanking.length - 1} style={{
                      width: 28, height: 26, borderRadius: 7, border: `1px solid ${t.border}`,
                      background: 'transparent',
                      color: idx === disciplineRanking.length - 1 ? t.text3 : t.text,
                      cursor: idx === disciplineRanking.length - 1 ? 'default' : 'pointer', fontSize: 11,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>▼</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── availability ── */}
        {current === 'availability' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Availability.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Holidays, events, or standing commitments that affect your training. Skip any that don't apply.
            </div>

            {/* Holidays */}
            <DQField label="Holidays / time away" t={t}>
              {intake.availability.holidays.map((h, i) => (
                <EntryChip key={i} label={`${h.label} · ${h.from}${h.to ? ' → ' + h.to : ''}`}
                  onRemove={() => patchAvail('holidays', intake.availability.holidays.filter((_, j) => j !== i))} t={t} />
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <input
                  placeholder="Label (e.g. Tenerife)"
                  value={holidayDraft.label}
                  onChange={e => setHolidayDraft(d => ({ ...d, label: e.target.value }))}
                  style={{ ...inputSt(t), fontSize: 12 }}
                />
                <input
                  type="date" value={holidayDraft.from}
                  onChange={e => setHolidayDraft(d => ({ ...d, from: e.target.value }))}
                  style={{ ...inputSt(t), fontSize: 12 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                <input
                  type="date" placeholder="End date (optional)"
                  value={holidayDraft.to}
                  onChange={e => setHolidayDraft(d => ({ ...d, to: e.target.value }))}
                  style={{ ...inputSt(t), fontSize: 12 }}
                />
                <AddBtn onClick={addHoliday} disabled={!holidayDraft.label || !holidayDraft.from} t={t} />
              </div>
            </DQField>

            {/* One-off events */}
            <DQField label="One-off events (weddings, travel days, etc.)" t={t}>
              {intake.availability.oneOffEvents.map((e, i) => (
                <EntryChip key={i} label={`${e.label} · ${e.date}`}
                  onRemove={() => patchAvail('oneOffEvents', intake.availability.oneOffEvents.filter((_, j) => j !== i))} t={t} />
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
                <input
                  placeholder="Label"
                  value={oneOffDraft.label}
                  onChange={e => setOneOffDraft(d => ({ ...d, label: e.target.value }))}
                  style={{ ...inputSt(t), fontSize: 12 }}
                />
                <input
                  type="date" value={oneOffDraft.date}
                  onChange={e => setOneOffDraft(d => ({ ...d, date: e.target.value }))}
                  style={{ ...inputSt(t), fontSize: 12 }}
                />
                <AddBtn onClick={addOneOff} disabled={!oneOffDraft.label || !oneOffDraft.date} t={t} />
              </div>
            </DQField>

            {/* Standing commitments */}
            <DQField label="Standing weekly commitments (not yet captured)" hint="e.g. football Tuesday evenings, school run Friday AM" t={t}>
              {intake.availability.standingCommitments.map((c, i) => (
                <EntryChip key={i} label={`${c.label} · ${c.day}${c.time ? ' ' + c.time : ''}`}
                  onRemove={() => patchAvail('standingCommitments', intake.availability.standingCommitments.filter((_, j) => j !== i))} t={t} />
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6 }}>
                <input
                  placeholder="Label"
                  value={commitmentDraft.label}
                  onChange={e => setCommitmentDraft(d => ({ ...d, label: e.target.value }))}
                  style={{ ...inputSt(t), fontSize: 12 }}
                />
                <select
                  value={commitmentDraft.day}
                  onChange={e => setCommitmentDraft(d => ({ ...d, day: e.target.value }))}
                  style={{ ...inputSt(t), fontSize: 12 }}
                >
                  <option value="">Day</option>
                  {DAYS.map((day, i) => <option key={i} value={DAY_KEYS[i]}>{day}</option>)}
                </select>
                <input
                  type="time" value={commitmentDraft.time}
                  onChange={e => setCommitmentDraft(d => ({ ...d, time: e.target.value }))}
                  style={{ ...inputSt(t), fontSize: 12 }}
                />
                <AddBtn onClick={addCommitment} disabled={!commitmentDraft.label || !commitmentDraft.day} t={t} />
              </div>
            </DQField>
          </div>
        )}

        {/* ── day preferences ── */}
        {current === 'preferences' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Day preferences.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Shape your weekly structure. Leave blank to use sensible defaults.
            </div>

            <DQField label="Long / key session day" hint="Your longest or most demanding session of the week. Default: Sunday." t={t}>
              <DaySelect
                value={intake.preferences.longSessionDay}
                onChange={v => patchIntake('preferences', { longSessionDay: v })}
                t={t}
              />
            </DQField>
            <DQField label="Second session day" hint="Second key session of the week. Default: Saturday." t={t}>
              <DaySelect
                value={intake.preferences.secondDisciplineDay}
                onChange={v => patchIntake('preferences', { secondDisciplineDay: v })}
                t={t}
              />
            </DQField>
            {goalsPayload?.gymAccess && (
              <DQField label="Conditioning day" hint="Won't be placed on the same day as a long or high-intensity session unless chosen here." t={t}>
                <DaySelect
                  value={intake.preferences.conditioningDay}
                  onChange={v => patchIntake('preferences', { conditioningDay: v })}
                  t={t}
                />
              </DQField>
            )}
          </div>
        )}

        {/* ── goals & mindset ── */}
        {current === 'mindset' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Goals & mindset.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Helps us tailor tone and priorities — everything here is optional.
            </div>

            <DQField label="What's your primary goal for race day?" hint="e.g. just finish strong / beat a specific time / milestone event" t={t}>
              <input
                value={intake.mindset.primaryGoal}
                onChange={e => patchIntake('mindset', { primaryGoal: e.target.value })}
                placeholder="e.g. Finish my first triathlon"
                style={inputSt(t)}
              />
            </DQField>
            {isEventRaceGoal(goals) && (
              <DQField label="Which discipline do you most want to improve?" t={t}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['swim', 'bike', 'run'].map(d => (
                    <button key={d} onClick={() => patchIntake('mindset', { disciplineToImprove: d })} style={{
                      flex: 1, padding: '10px 0', borderRadius: 9,
                      background: intake.mindset.disciplineToImprove === d ? t.accent + '15' : t.surface,
                      border: `1.5px solid ${intake.mindset.disciplineToImprove === d ? t.accent : t.border2}`,
                      color: intake.mindset.disciplineToImprove === d ? t.accent : t.text2,
                      fontFamily: t.sans, fontSize: 12, cursor: 'pointer',
                    }}>{DISCIPLINE_META[d].icon} {DISCIPLINE_META[d].label}</button>
                  ))}
                </div>
              </DQField>
            )}
            <DQField label="What are you most nervous or uncertain about?" hint="e.g. swimming, long runs, speed work, hills" t={t}>
              <input
                value={intake.mindset.nervousAbout}
                onChange={e => patchIntake('mindset', { nervousAbout: e.target.value })}
                placeholder="e.g. Open water swimming"
                style={inputSt(t)}
              />
            </DQField>
            <DQField label="Target finish time" hint="Optional — even loosely" t={t}>
              <input
                value={intake.mindset.targetTime}
                onChange={e => patchIntake('mindset', { targetTime: e.target.value })}
                placeholder="e.g. sub 6:30"
                style={inputSt(t)}
              />
            </DQField>
            <DQField label="Have you done this type of race before?" hint="Optional — distance and roughly when" t={t}>
              <input
                value={intake.mindset.priorExperience}
                onChange={e => patchIntake('mindset', { priorExperience: e.target.value })}
                placeholder="e.g. Olympic distance, 2024"
                style={inputSt(t)}
              />
            </DQField>
            <DQField label="Do you currently do any speed or interval training?" hint="Optional — e.g. tempo runs, track sessions, parkrun efforts" t={t}>
              <input
                value={intake.mindset.usesSpeedTraining}
                onChange={e => patchIntake('mindset', { usesSpeedTraining: e.target.value })}
                placeholder="e.g. Weekly parkrun"
                style={inputSt(t)}
              />
            </DQField>
            <DQField label="Anything else about your lifestyle or schedule we should know?" hint="Optional" t={t}>
              <textarea
                value={intake.mindset.lifestyleNotes}
                onChange={e => patchIntake('mindset', { lifestyleNotes: e.target.value })}
                placeholder="e.g. Shift worker — schedule varies week to week"
                rows={3}
                style={{ ...inputSt(t), resize: 'none', lineHeight: 1.6 }}
              />
            </DQField>
          </div>
        )}

        {/* ── injury & health ── */}
        {current === 'injury' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Health & injury.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Helps us avoid loading areas at risk. Everything stays private — skip anything you're not comfortable sharing.
            </div>

            {/* Past injuries */}
            <DQField label="Past injuries" t={t}>
              {intake.injury.pastInjuries.map((inj, i) => (
                <EntryChip key={i}
                  label={`${inj.area}${inj.description ? ' — ' + inj.description : ''} · ${inj.resolved ? 'Resolved' : 'Ongoing'}`}
                  onRemove={() => patchInjury({ pastInjuries: intake.injury.pastInjuries.filter((_, j) => j !== i) })}
                  t={t}
                />
              ))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {BODY_AREAS.map(a => (
                  <button key={a} onClick={() => setInjuryDraft(d => ({ ...d, area: a }))} style={{
                    padding: '5px 9px', borderRadius: 7,
                    background: injuryDraft.area === a ? t.accent + '15' : t.surface,
                    border: `1.5px solid ${injuryDraft.area === a ? t.accent : t.border2}`,
                    color: injuryDraft.area === a ? t.accent : t.text2,
                    fontFamily: t.sans, fontSize: 11, cursor: 'pointer',
                  }}>{a}</button>
                ))}
              </div>
              <input
                placeholder="Brief description (optional)"
                value={injuryDraft.description}
                onChange={e => setInjuryDraft(d => ({ ...d, description: e.target.value }))}
                style={{ ...inputSt(t), marginBottom: 6, fontSize: 12 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: true, label: 'Resolved' }, { v: false, label: 'Ongoing' }].map(opt => (
                    <button key={opt.label}
                      onClick={() => setInjuryDraft(d => ({ ...d, resolved: opt.v }))}
                      style={{
                        flex: 1, padding: '9px', borderRadius: 9, fontSize: 11.5,
                        background: injuryDraft.resolved === opt.v ? t.accent + '10' : t.surface,
                        border: `1.5px solid ${injuryDraft.resolved === opt.v ? t.accent : t.border}`,
                        color: injuryDraft.resolved === opt.v ? t.accent : t.text,
                        fontFamily: t.sans, cursor: 'pointer',
                      }}>{opt.label}</button>
                  ))}
                </div>
                <AddBtn onClick={addInjury} disabled={!injuryDraft.area} t={t} />
              </div>
            </DQField>

            {/* Current niggles */}
            <DQField label="Any current niggles or soreness?" hint="We'll reduce load on these areas" t={t}>
              <textarea
                value={intake.injury.currentNiggles}
                onChange={e => patchInjury({ currentNiggles: e.target.value })}
                placeholder="e.g. Tight left calf, mild IT band soreness"
                rows={3}
                style={{ ...inputSt(t), resize: 'none', lineHeight: 1.6 }}
              />
            </DQField>

            {/* Health conditions */}
            <DQField label="Any health conditions we should know about?" hint="Heart conditions, asthma, diabetes, etc." t={t}>
              <textarea
                value={intake.injury.healthConditions}
                onChange={e => patchInjury({ healthConditions: e.target.value })}
                placeholder="e.g. Mild asthma — use inhaler before hard sessions"
                rows={3}
                style={{ ...inputSt(t), resize: 'none', lineHeight: 1.6 }}
              />
            </DQField>

            {/* Exercises to avoid */}
            <DQField label="Any exercises or movements you've been advised to avoid?" t={t}>
              <textarea
                value={intake.injury.avoidExercises}
                onChange={e => patchInjury({ avoidExercises: e.target.value })}
                placeholder="e.g. No deep squats, avoid high-impact plyometrics"
                rows={2}
                style={{ ...inputSt(t), resize: 'none', lineHeight: 1.6 }}
              />
            </DQField>

            {/* Aggravating factors */}
            <DQField label="Any movements or surfaces that consistently aggravate symptoms?" hint="e.g. certain run surfaces, hill running, cycling position" t={t}>
              <textarea
                value={intake.injury.aggravatingFactors}
                onChange={e => patchInjury({ aggravatingFactors: e.target.value })}
                placeholder="e.g. Downhill running flares up my knee"
                rows={2}
                style={{ ...inputSt(t), resize: 'none', lineHeight: 1.6 }}
              />
            </DQField>
          </div>
        )}

        {/* ── pace/split confirmation ── */}
        {current === 'pace_confirm' && intake.targetPaces && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Confirm your pace targets.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              {eventRaceConfig.hasTargetTime
                ? 'Based on your target finish time — edit anything that looks off.'
                : "Based on your race's cutoff time, since no personal target was given — edit anything that looks off."}
            </div>

            {['swim', 'bike', 'run'].filter(d => intake.targetPaces[d] !== undefined).map(discipline => {
              const meta = DISCIPLINE_META[discipline];
              const seconds = intake.targetPaces[discipline] || 0;
              const distanceKm = legDistanceKm(discipline, eventRaceConfig.raceType);
              const pace = formatPaceForDiscipline(discipline, seconds, distanceKm, false);
              return (
                <DQField key={discipline} label={`${meta.icon} ${meta.label}`} hint={pace ? `≈ ${pace}` : undefined} t={t}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select
                      value={Math.floor(seconds / 3600)}
                      onChange={e => setPaceLeg(discipline, e.target.value, undefined)}
                      style={inputSt(t)}
                    >
                      {Array.from({ length: 13 }, (_, h) => <option key={h} value={h}>{h}h</option>)}
                    </select>
                    <select
                      value={Math.floor((seconds % 3600) / 60)}
                      onChange={e => setPaceLeg(discipline, undefined, e.target.value)}
                      style={inputSt(t)}
                    >
                      {Array.from({ length: 60 }, (_, m) => <option key={m} value={m}>{m}m</option>)}
                    </select>
                  </div>
                </DQField>
              );
            })}

            {intake.targetPaces.transition !== undefined && (
              <div style={{ fontSize: 11.5, color: t.text3, marginTop: -8, marginBottom: 8 }}>
                Plus an allowance of ~{Math.round(intake.targetPaces.transition / 60)} min for transitions (T1+T2).
              </div>
            )}
          </div>
        )}

        {/* ── done ── */}
        {current === 'done' && (
          <div style={{ textAlign: 'center', paddingTop: 18 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: `linear-gradient(135deg, ${t.green}, ${t.accent})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 22px', fontSize: 32, color: '#fff',
              boxShadow: `0 14px 40px ${t.accent}30`,
            }}>✓</div>
            <div style={{ fontFamily: t.serif, fontSize: 32, lineHeight: 1.1, marginBottom: 12, letterSpacing: '-.01em' }}>
              Profile complete.
            </div>
            <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.6, marginBottom: 24, padding: '0 12px' }}>
              We have everything we need to build a personalised, realistic plan for you.
            </div>

            {/* Quick recap */}
            <div style={{
              background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14,
              padding: '12px 14px', textAlign: 'left',
            }}>
              {[
                isRaceGoal(goals) && intake.runBaseline.time5k &&
                  { label: '5K PB', value: intake.runBaseline.time5k },
                isRaceGoal(goals) && intake.runBaseline.weeklyRunsCount &&
                  { label: 'Runs / week', value: `${intake.runBaseline.weeklyRunsCount}×` },
                isEventRaceGoal(goals) && intake.swimBaseline.time400m &&
                  { label: '400m swim', value: intake.swimBaseline.time400m },
                isEventRaceGoal(goals) && intake.bikeBaseline.longestRideKm &&
                  { label: 'Longest ride', value: `${intake.bikeBaseline.longestRideKm} km` },
                intake.availability.holidays.length &&
                  { label: 'Holidays', value: `${intake.availability.holidays.length} added` },
                intake.injury.pastInjuries.length &&
                  { label: 'Past injuries', value: `${intake.injury.pastInjuries.length} logged` },
              ].filter(Boolean).map((row, i) => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 0', borderTop: i > 0 ? `1px solid ${t.border}` : 'none',
                }}>
                  <span style={{ fontSize: 10, color: t.text3, letterSpacing: '.1em', textTransform: 'uppercase' }}>{row.label}</span>
                  <span style={{ fontSize: 12, color: t.text }}>{row.value}</span>
                </div>
              ))}
              {![isRaceGoal(goals) && intake.runBaseline.time5k,
                 intake.availability.holidays.length,
                 intake.injury.pastInjuries.length].some(Boolean) && (
                <div style={{ fontSize: 12, color: t.text3, padding: '4px 0' }}>
                  Details saved — you can add more from settings any time.
                </div>
              )}
            </div>

            {canGenerate && aiGen === 'error' && (
              <div style={{
                marginTop: 14, padding: '10px 12px', borderRadius: 10, textAlign: 'left',
                background: '#DC262612', border: '1px solid #DC262635',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>Couldn't generate your plan</div>
                <div style={{ fontSize: 11.5, color: t.text2, lineHeight: 1.5 }}>{aiGenErr}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 22px 18px', background: t.bg, borderTop: `1px solid ${t.border}` }}>
        {current === 'intro' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={next} style={{
              width: '100%', padding: '14px', borderRadius: 13,
              background: t.accent, color: t.accentText,
              border: 'none', fontFamily: t.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Refine my plan — 5 mins ✦
            </button>
            <button onClick={handleSkip} style={{
              width: '100%', padding: '13px', borderRadius: 13,
              background: 'transparent', color: t.text2,
              border: `1px solid ${t.border}`, fontFamily: t.sans, fontSize: 13,
              fontWeight: 500, cursor: 'pointer',
            }}>
              Skip for now — I'll do this later
            </button>
          </div>
        ) : current === 'done' && canGenerate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={handleGenerateClick} disabled={aiGen === 'working'} style={{
              width: '100%', padding: '14px', borderRadius: 13,
              background: t.accent, color: t.accentText,
              border: 'none', fontFamily: t.sans, fontSize: 14, fontWeight: 600,
              cursor: aiGen === 'working' ? 'default' : 'pointer',
              opacity: aiGen === 'working' ? 0.7 : 1,
            }}>
              {aiGen === 'working' ? 'Building your plan… this can take a minute' : aiGen === 'error' ? 'Try again ✦' : 'Generate my plan with AI ✦'}
            </button>
            <button onClick={next} disabled={aiGen === 'working'} style={{
              width: '100%', padding: '13px', borderRadius: 13,
              background: 'transparent', color: t.text2,
              border: `1px solid ${t.border}`, fontFamily: t.sans, fontSize: 13,
              fontWeight: 500, cursor: aiGen === 'working' ? 'default' : 'pointer',
              opacity: aiGen === 'working' ? 0.5 : 1,
            }}>
              Enter Forma without a plan →
            </button>
          </div>
        ) : (
          <button onClick={next} style={{
            width: '100%', padding: '14px', borderRadius: 13,
            background: t.accent, color: t.accentText,
            border: 'none', fontFamily: t.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            {isLast ? 'Enter Forma →' : 'Continue →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Small reusable pieces ────────────────────────────────────────────────────

function DQField({ label, hint, t, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
        color: t.text3, fontWeight: 500, marginBottom: 8,
      }}>{label}</div>
      {children}
      {hint && (
        <div style={{ fontSize: 10.5, color: t.text3, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>
      )}
    </div>
  );
}

function inputSt(t) {
  return {
    width: '100%', padding: '11px 13px', borderRadius: 10,
    border: `1px solid ${t.border2}`, background: t.surface,
    fontFamily: t.sans, fontSize: 13, color: t.text, outline: 'none',
    boxSizing: 'border-box',
  };
}

function TimeInput({ value, onChange, placeholder, t }) {
  return (
    <input
      type="text" inputMode="numeric"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputSt(t)}
    />
  );
}

function DaySelect({ value, onChange, t }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputSt(t)}>
      <option value="">No preference — use default</option>
      {DAYS.map((day, i) => <option key={i} value={DAY_KEYS[i]}>{day}</option>)}
    </select>
  );
}

function FreqRow({ value, onChange, t, max = 7 }) {
  const opts = Array.from({ length: max + 1 }, (_, i) => i);
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {opts.map(n => (
        <button key={n} onClick={() => onChange(n)} style={{
          flex: 1, padding: '11px 0', borderRadius: 9,
          background: value === n ? t.text : t.surface,
          color: value === n ? (t.bg) : t.text,
          border: `1px solid ${value === n ? t.text : t.border}`,
          fontFamily: t.serif, fontSize: 16, cursor: 'pointer',
        }}>{n}</button>
      ))}
    </div>
  );
}

function EntryChip({ label, onRemove, t }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px', borderRadius: 9, background: t.surface,
      border: `1px solid ${t.border}`, marginBottom: 6,
    }}>
      <span style={{ flex: 1, fontSize: 11.5, color: t.text2, lineHeight: 1.4 }}>{label}</span>
      <button onClick={onRemove} style={{
        width: 22, height: 22, borderRadius: 6, border: `1px solid ${t.border}`,
        background: 'transparent', color: t.text3, cursor: 'pointer', fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>×</button>
    </div>
  );
}

function AddBtn({ onClick, disabled, t }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '9px 14px', borderRadius: 9, whiteSpace: 'nowrap',
      background: disabled ? t.border : t.accent,
      color: disabled ? t.text3 : t.accentText,
      border: 'none', fontFamily: t.sans, fontSize: 12, fontWeight: 600,
      cursor: disabled ? 'default' : 'pointer',
    }}>+ Add</button>
  );
}
