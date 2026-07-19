import React from 'react';
import themes from '../data/themes';
import { isTriathlonRaceType } from '../utils/raceTargets';

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCIPLINE_META = {
  swim:  { icon: '🏊', label: 'Swim' },
  bike:  { icon: '🚴', label: 'Bike' },
  run:   { icon: '🏃', label: 'Run' },
  other: { icon: '🏁', label: 'Training sessions' },
};

// Which discipline frequency inputs to show for a given race type — the
// race's own discipline(s), not the general "regular sports" list.
function disciplinesForRaceType(raceType) {
  if (isTriathlonRaceType(raceType)) return ['swim', 'bike', 'run'];
  if (raceType === 'Cycling Sportive') return ['bike'];
  if (raceType === 'Open Water Swim') return ['swim'];
  if (raceType === 'Other' || !raceType) return ['other'];
  return ['run']; // 5K / 10K / Half Marathon / Marathon
}

// Seeds a default of 2/week for any discipline the race type needs that
// isn't already set — used both when a race type is first picked and when
// pre-filling from an existing saved goal (which may predate this field).
function withDefaultDisciplineFrequency(raceType, existingFreq = {}) {
  const freq = { ...existingFreq };
  disciplinesForRaceType(raceType).forEach(d => { if (freq[d] === undefined) freq[d] = 2; });
  return freq;
}

const GOAL_TYPES = [
  { id: 'event_race',         label: 'Race / Event',       sub: 'Train for a specific race or event',    icon: '🏁' },
  { id: 'strength_programme', label: 'Strength Programme', sub: 'Progressive overload & strength gains', icon: '🏋️' },
  { id: 'sport_activity',     label: 'Sport Activity',     sub: 'Improve performance in a sport',        icon: '⚽' },
  { id: 'general_fitness',    label: 'General Fitness',    sub: 'Build overall health and wellbeing',    icon: '🌿' },
  { id: 'micro_target',       label: 'Micro Target',       sub: 'A specific, measurable goal',           icon: '🎯' },
];

const RACE_TYPES = [
  '5K', '10K', 'Half Marathon', 'Marathon',
  'Triathlon (Sprint)', 'Triathlon (Olympic)', 'Triathlon (70.3 / Half)', 'Triathlon (Full / Ironman)',
  'Cycling Sportive', 'Open Water Swim', 'Other',
];

const FITNESS_LEVELS = ['Beginner', 'Intermediate', 'Fit but new to this'];

const STRENGTH_FOCUSES = [
  'Powerlifting', 'Olympic Lifting', 'General Strength', 'Body Recomposition', 'Calisthenics',
];

const SPORT_TYPES = [
  'Football', 'Basketball', 'Tennis', 'Swimming', 'Cycling', 'Running',
  'Rugby', 'CrossFit', 'Martial Arts', 'Golf', 'Hockey', 'Volleyball', 'Other',
];

const INTENSITY_LEVELS = ['Low', 'Moderate', 'High'];

const GENERAL_ACTIVITIES = [
  { id: 'gym',       label: 'Gym',       icon: '🏋️' },
  { id: 'running',   label: 'Running',   icon: '🏃' },
  { id: 'cycling',   label: 'Cycling',   icon: '🚴' },
  { id: 'swimming',  label: 'Swimming',  icon: '🏊' },
  { id: 'rowing',    label: 'Rowing',    icon: '🚣' },
  { id: 'yoga',      label: 'Yoga',      icon: '🧘' },
  { id: 'hiit',      label: 'HIIT',      icon: '⚡' },
  { id: 'walking',   label: 'Walking',   icon: '🚶' },
  { id: 'pilates',   label: 'Pilates',   icon: '🤸' },
  { id: 'climbing',  label: 'Climbing',  icon: '🧗' },
  { id: 'dancing',   label: 'Dancing',   icon: '💃' },
];

const DAYS     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const RANK_LABELS  = ['Primary', 'Secondary', 'Supporting'];
const RANK_COLOURS = ['#BE5A38', '#6D4AAF', '#15803D'];

// ─── Default per-type config ──────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  event_race:         {
    raceType: '', raceDate: '', fitnessLevel: '',
    disciplineFrequency: {},     // { swim, bike, run } or { other } — times/week per discipline
    hasTargetTime: null,         // true | false — must be explicitly answered, never silently skipped
    targetTimeHours: '', targetTimeMinutes: '', targetTimeSeconds: null,
    hasCutoffTime: null,         // true | false
    cutoffTimeHours: '', cutoffTimeMinutes: '', cutoffTimeSeconds: null,
  },
  strength_programme: { focus: '' },
  sport_activity:     { sportType: '', daysPerWeek: 2, intensity: 'Moderate' },
  general_fitness:    { activities: [] },
  micro_target:       { description: '' },
};

// ─── GoalsSetupScreen ─────────────────────────────────────────────────────────

export function GoalsSetupScreen({
  width = 390, height = 820, theme = 'light', onComplete, userId,
  initialGoalsPayload, // re-entry (e.g. "redo my goals") — pre-fills every field below instead of starting blank
  onExit, // re-entry only — () => void, bails out without completing (shown at the first step only)
}) {
  const t = themes[theme];
  const initialGoals = initialGoalsPayload?.goals || [];

  // ── goal selection & config ──────────────────────────────────────────────
  const [selectedGoals, setSelectedGoals] = React.useState(() => initialGoals.map(g => g.type)); // order = rank
  const [goalConfigs,   setGoalConfigs]   = React.useState(() => {
    const configs = {};
    initialGoals.forEach(g => {
      const config = { ...DEFAULT_CONFIG[g.type], ...g.config };
      // Older saved goals (from before per-discipline frequency existed)
      // may have a raceType but an empty disciplineFrequency — seed the
      // same defaults the race-type button would, so redoing doesn't
      // silently reintroduce the empty-schedule bug for existing users.
      if (g.type === 'event_race' && config.raceType) {
        config.disciplineFrequency = withDefaultDisciplineFrequency(config.raceType, config.disciplineFrequency);
      }
      configs[g.type] = config;
    });
    return configs;
  });

  // ── schedule ─────────────────────────────────────────────────────────────
  const [trainingDays, setTrainingDays] = React.useState(() => initialGoalsPayload?.trainingDays || []);
  const trainingDaysPerWeek = trainingDays.length;
  const unavailableDays     = DAY_KEYS.filter(d => !trainingDays.includes(d));

  // ── facilities ────────────────────────────────────────────────────────────
  const [gymAccess,  setGymAccess]  = React.useState(() => initialGoalsPayload?.gymAccess ?? false);
  const [poolAccess, setPoolAccess] = React.useState(() => initialGoalsPayload?.poolAccess ?? false);
  const [poolDays,   setPoolDays]   = React.useState(() => initialGoalsPayload?.poolDays || []);

  // ── regular sports ────────────────────────────────────────────────────────
  const [regularSports, setRegularSports] = React.useState(() => initialGoalsPayload?.regularSports || []);
  const [sportDraft,    setSportDraft]    = React.useState({ sport: '', day: '', intensity: 'Moderate' });

  // ── step management ───────────────────────────────────────────────────────
  const buildSteps = (goals) => {
    const steps = ['select'];
    if (goals.length >= 2) steps.push('rank');
    goals.forEach(g => steps.push(`config_${g}`));
    steps.push('schedule', 'facilities', 'sports', 'done');
    return steps;
  };

  const [stepIdx, setStepIdx] = React.useState(0);
  const steps   = buildSteps(selectedGoals);
  const current = steps[stepIdx] || 'select';
  const progress = (stepIdx + 1) / steps.length;
  const isLast   = stepIdx === steps.length - 1;

  React.useEffect(() => {
    setStepIdx(s => Math.min(s, steps.length - 1));
  }, [steps.length]);

  const next = () => isLast ? handleComplete() : setStepIdx(s => s + 1);
  const back = () => setStepIdx(s => Math.max(0, s - 1));

  const canAdvance = (() => {
    if (current === 'select') return selectedGoals.length >= 1;
    if (current === 'config_event_race') {
      const cfg = goalConfigs['event_race'] || {};
      if (!(cfg.raceType && cfg.raceDate && cfg.fitnessLevel)) return false;
      // Target/cutoff time must be explicitly answered (yes or no) — never
      // silently skipped past — and a "yes" needs an actual time entered.
      if (cfg.hasTargetTime === null || cfg.hasTargetTime === undefined) return false;
      if (cfg.hasTargetTime && !(cfg.targetTimeSeconds > 0)) return false;
      if (cfg.hasCutoffTime === null || cfg.hasCutoffTime === undefined) return false;
      if (cfg.hasCutoffTime && !(cfg.cutoffTimeSeconds > 0)) return false;
      return true;
    }
    if (current === 'config_strength_programme') {
      return !!(goalConfigs['strength_programme']?.focus);
    }
    if (current === 'config_sport_activity') {
      return !!(goalConfigs['sport_activity']?.sportType);
    }
    if (current === 'config_general_fitness') {
      return (goalConfigs['general_fitness']?.activities || []).length >= 1;
    }
    if (current === 'schedule') return trainingDays.length >= 1;
    return true;
  })();

  // ── helpers ───────────────────────────────────────────────────────────────

  const toggleGoal = (id) => {
    setSelectedGoals(prev => {
      if (prev.includes(id)) return prev.filter(g => g !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    if (!goalConfigs[id]) {
      setGoalConfigs(c => ({ ...c, [id]: { ...DEFAULT_CONFIG[id] } }));
    }
  };

  const updateConfig = (goalType, patch) =>
    setGoalConfigs(c => ({ ...c, [goalType]: { ...(c[goalType] || {}), ...patch } }));

  const moveGoal = (idx, dir) => {
    setSelectedGoals(prev => {
      const next    = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  const isEventRaceGoal = selectedGoals.includes('event_race') &&
    (goalConfigs['event_race']?.raceType || '').toLowerCase().includes('triathlon');

  const addSport = () => {
    if (!sportDraft.sport || !sportDraft.day) return;
    setRegularSports(prev => [...prev, { ...sportDraft }]);
    setSportDraft({ sport: '', day: '', intensity: 'Moderate' });
  };

  const handleComplete = () => {
    const payload = {
      goals: selectedGoals.map((type, i) => ({
        type,
        rank: RANK_LABELS[i] || 'Supporting',
        config: goalConfigs[type] || {},
      })),
      trainingDays,
      trainingDaysPerWeek,
      unavailableDays,
      gymAccess,
      poolAccess: isEventRaceGoal ? poolAccess : false,
      poolDays:   (isEventRaceGoal && poolAccess) ? poolDays : [],
      regularSports,
      savedAt: new Date().toISOString(),
    };

    // Persist locally
    if (userId) {
      try { localStorage.setItem(`forma_goals_${userId}`, JSON.stringify(payload)); } catch {}
    }

    onComplete(payload);
  };

  const stepLabel = (s) => {
    const map = {
      select: 'Goals', rank: 'Priority',
      config_event_race: 'Race details', config_strength_programme: 'Strength focus',
      config_sport_activity: 'Sport details', config_micro_target: 'Your target',
      config_general_fitness: 'Activities',
      schedule: 'Schedule', facilities: 'Access', sports: 'Regular sports', done: '',
    };
    return map[s] || s;
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
        background: `radial-gradient(circle, ${t.accent}28, transparent 65%)`, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -100, left: -80, width: 300, height: 300, borderRadius: '50%',
        background: `radial-gradient(circle, #6D4AAF18, transparent 65%)`, pointerEvents: 'none',
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

      {/* Progress + back */}
      <div style={{ padding: '4px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {stepIdx > 0 && current !== 'done' ? (
          <button onClick={back} style={{
            width: 32, height: 32, borderRadius: 9, background: 'transparent',
            border: `1px solid ${t.border}`, color: t.text, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
          }}>←</button>
        ) : stepIdx === 0 && onExit ? (
          <button onClick={onExit} style={{
            width: 32, height: 32, borderRadius: 9, background: 'transparent',
            border: `1px solid ${t.border}`, color: t.text, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
          }}>×</button>
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
            <span>Step {stepIdx + 1} of {steps.length}</span>
            <span style={{ textTransform: 'uppercase' }}>{stepLabel(current)}</span>
          </div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 20px' }} className="phone-scroll">

        {/* ── select ── */}
        {current === 'select' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              What are your goals?
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Pick up to 3. You'll rank them by priority next.
            </div>
            {GOAL_TYPES.map(g => {
              const active   = selectedGoals.includes(g.id);
              const rank     = selectedGoals.indexOf(g.id);
              const disabled = !active && selectedGoals.length >= 3;
              return (
                <button key={g.id} onClick={() => !disabled && toggleGoal(g.id)} style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 13,
                  background: active ? t.accent + '10' : disabled ? t.surface2 : t.surface,
                  border: `1.5px solid ${active ? t.accent : t.border}`,
                  cursor: disabled ? 'default' : 'pointer', fontFamily: t.sans, marginBottom: 8,
                  display: 'flex', gap: 11, alignItems: 'center', opacity: disabled ? 0.45 : 1,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: active ? t.accent + '20' : t.surface2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                  }}>{g.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{g.label}</div>
                    <div style={{ fontSize: 10.5, color: t.text3, marginTop: 1 }}>{g.sub}</div>
                  </div>
                  {active && (
                    <div style={{
                      minWidth: 52, height: 22, borderRadius: 11, background: RANK_COLOURS[rank] || t.accent,
                      color: '#fff', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 9.5, fontWeight: 700,
                      letterSpacing: '.06em', padding: '0 8px', textTransform: 'uppercase',
                    }}>
                      {RANK_LABELS[rank] || 'Supporting'}
                    </div>
                  )}
                </button>
              );
            })}
            {selectedGoals.length >= 3 && (
              <div style={{
                padding: '9px 12px', borderRadius: 10, background: t.surface2,
                border: `1px dashed ${t.border}`, fontSize: 11.5, color: t.text3, marginTop: 4,
              }}>
                Maximum 3 goals selected. Tap one to remove it.
              </div>
            )}
          </div>
        )}

        {/* ── rank ── */}
        {current === 'rank' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Set your priority.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Use the arrows to rank your goals. Your Primary goal drives the plan most.
            </div>
            {selectedGoals.map((goalId, idx) => {
              const meta = GOAL_TYPES.find(g => g.id === goalId);
              return (
                <div key={goalId} style={{
                  padding: '12px 14px', borderRadius: 13, marginBottom: 8,
                  background: t.surface, border: `1.5px solid ${t.border}`,
                  display: 'flex', alignItems: 'center', gap: 11,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: RANK_COLOURS[idx] + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                  }}>{meta?.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{meta?.label}</div>
                    <div style={{
                      fontSize: 9.5, letterSpacing: '.08em', fontWeight: 700,
                      color: RANK_COLOURS[idx], textTransform: 'uppercase', marginTop: 2,
                    }}>{RANK_LABELS[idx]}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <button onClick={() => moveGoal(idx, -1)} disabled={idx === 0} style={{
                      width: 28, height: 26, borderRadius: 7, border: `1px solid ${t.border}`,
                      background: 'transparent', color: idx === 0 ? t.text3 : t.text,
                      cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>▲</button>
                    <button onClick={() => moveGoal(idx, 1)} disabled={idx === selectedGoals.length - 1} style={{
                      width: 28, height: 26, borderRadius: 7, border: `1px solid ${t.border}`,
                      background: 'transparent',
                      color: idx === selectedGoals.length - 1 ? t.text3 : t.text,
                      cursor: idx === selectedGoals.length - 1 ? 'default' : 'pointer', fontSize: 11,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>▼</button>
                  </div>
                </div>
              );
            })}
            <div style={{
              marginTop: 8, padding: '10px 12px', borderRadius: 10,
              background: t.surface2, border: `1px dashed ${t.border}`,
              fontSize: 11, color: t.text3, lineHeight: 1.5,
            }}>
              You can adjust priorities anytime from your profile.
            </div>
          </div>
        )}

        {/* ── config: event_race ── */}
        {current === 'config_event_race' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Race details.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Tell us about your event so we can tailor your training plan.
            </div>

            <GField label="Race type" t={t}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {RACE_TYPES.map(rt => {
                  const active = goalConfigs['event_race']?.raceType === rt;
                  return (
                    <button key={rt} onClick={() => {
                      // The frequency pickers below show a default of 2/week
                      // for display purposes — seed that same default into
                      // real state here so a user who never touches those
                      // buttons still gets a non-empty disciplineFrequency
                      // (otherwise the goal would save with none set at all).
                      const seededFreq = withDefaultDisciplineFrequency(rt, goalConfigs['event_race']?.disciplineFrequency);
                      updateConfig('event_race', { raceType: rt, disciplineFrequency: seededFreq });
                    }} style={{
                      padding: '7px 11px', borderRadius: 9,
                      background: active ? t.accent + '15' : t.surface,
                      border: `1.5px solid ${active ? t.accent : t.border}`,
                      color: active ? t.accent : t.text,
                      fontFamily: t.sans, fontSize: 11.5, cursor: 'pointer', fontWeight: 500,
                    }}>{rt}</button>
                  );
                })}
              </div>
            </GField>

            <GField label="Race date" t={t}>
              <input
                type="date"
                value={goalConfigs['event_race']?.raceDate || ''}
                onChange={e => updateConfig('event_race', { raceDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 11,
                  border: `1px solid ${t.border2}`, background: t.surface,
                  fontFamily: t.sans, fontSize: 14, color: t.text, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </GField>

            <GField label="Your current fitness level for this event" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FITNESS_LEVELS.map(fl => {
                  const active = goalConfigs['event_race']?.fitnessLevel === fl;
                  return (
                    <button key={fl} onClick={() => updateConfig('event_race', { fitnessLevel: fl })} style={{
                      padding: '11px 14px', borderRadius: 11, textAlign: 'left',
                      background: active ? t.accent + '10' : t.surface,
                      border: `1.5px solid ${active ? t.accent : t.border}`,
                      fontFamily: t.sans, fontSize: 13, cursor: 'pointer', color: t.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      {fl}
                      {active && <span style={{ color: t.accent, fontSize: 14 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </GField>

            {(() => {
              const eventCfg = goalConfigs['event_race'] || {};
              const raceDisciplines = disciplinesForRaceType(eventCfg.raceType);

              const setFrequency = (discipline, n) => updateConfig('event_race', {
                disciplineFrequency: { ...(eventCfg.disciplineFrequency || {}), [discipline]: n },
              });

              const setTargetTime = (hours, minutes) => {
                const h = hours !== undefined ? hours : eventCfg.targetTimeHours;
                const m = minutes !== undefined ? minutes : eventCfg.targetTimeMinutes;
                const seconds = (parseInt(h, 10) || 0) * 3600 + (parseInt(m, 10) || 0) * 60;
                updateConfig('event_race', {
                  targetTimeHours: h, targetTimeMinutes: m,
                  targetTimeSeconds: seconds > 0 ? seconds : null,
                });
              };
              const setCutoffTime = (hours, minutes) => {
                const h = hours !== undefined ? hours : eventCfg.cutoffTimeHours;
                const m = minutes !== undefined ? minutes : eventCfg.cutoffTimeMinutes;
                const seconds = (parseInt(h, 10) || 0) * 3600 + (parseInt(m, 10) || 0) * 60;
                updateConfig('event_race', {
                  cutoffTimeHours: h, cutoffTimeMinutes: m,
                  cutoffTimeSeconds: seconds > 0 ? seconds : null,
                });
              };

              return (
                <>
                  <GField label="How often do you want to train each discipline?" t={t}>
                    {raceDisciplines.map(disc => {
                      const meta = DISCIPLINE_META[disc];
                      const freq = eventCfg.disciplineFrequency?.[disc] ?? 2;
                      return (
                        <div key={disc} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 12, color: t.text2, marginBottom: 6 }}>
                            {meta.icon} {meta.label} — times/week
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {[1, 2, 3, 4, 5, 6, 7].map(n => {
                              const active = freq === n;
                              return (
                                <button key={n} onClick={() => setFrequency(disc, n)} style={{
                                  flex: 1, padding: '9px 0', borderRadius: 9,
                                  background: active ? t.text : t.surface,
                                  color: active ? (theme === 'dark' ? t.bg : '#fff') : t.text,
                                  border: `1px solid ${active ? t.text : t.border}`,
                                  fontFamily: t.serif, fontSize: 14, cursor: 'pointer',
                                }}>{n}</button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </GField>

                  <GField label="Do you have a target finish time in mind?" t={t}>
                    <YesNoRow value={eventCfg.hasTargetTime} onChange={v => updateConfig('event_race', { hasTargetTime: v })} t={t} />
                    {eventCfg.hasTargetTime && (
                      <HoursMinutesInput
                        hours={eventCfg.targetTimeHours} minutes={eventCfg.targetTimeMinutes}
                        onChange={setTargetTime} t={t}
                      />
                    )}
                  </GField>

                  <GField label="Does this race have a cutoff or qualifying time you need to meet?" t={t}>
                    <div style={{ fontSize: 11.5, color: t.text3, marginBottom: 8, lineHeight: 1.4 }}>
                      Some races require finishing within a set time limit.
                    </div>
                    <YesNoRow value={eventCfg.hasCutoffTime} onChange={v => updateConfig('event_race', { hasCutoffTime: v })} t={t} />
                    {eventCfg.hasCutoffTime && (
                      <HoursMinutesInput
                        hours={eventCfg.cutoffTimeHours} minutes={eventCfg.cutoffTimeMinutes}
                        onChange={setCutoffTime} t={t}
                      />
                    )}
                  </GField>
                </>
              );
            })()}
          </div>
        )}

        {/* ── config: strength_programme ── */}
        {current === 'config_strength_programme' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Strength focus.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              What kind of strength training are you aiming for?
            </div>

            <GField label="Focus area" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {STRENGTH_FOCUSES.map(sf => {
                  const active = goalConfigs['strength_programme']?.focus === sf;
                  return (
                    <button key={sf} onClick={() => updateConfig('strength_programme', { focus: sf })} style={{
                      padding: '11px 14px', borderRadius: 11, textAlign: 'left',
                      background: active ? t.accent + '10' : t.surface,
                      border: `1.5px solid ${active ? t.accent : t.border}`,
                      fontFamily: t.sans, fontSize: 13, cursor: 'pointer', color: t.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      {sf}
                      {active && <span style={{ color: t.accent, fontSize: 14 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </GField>

          </div>
        )}

        {/* ── config: sport_activity ── */}
        {current === 'config_sport_activity' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Sport details.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Which sport are you training around?
            </div>

            <GField label="Sport" t={t}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SPORT_TYPES.map(st => {
                  const active = goalConfigs['sport_activity']?.sportType === st;
                  return (
                    <button key={st} onClick={() => updateConfig('sport_activity', { sportType: st })} style={{
                      padding: '7px 11px', borderRadius: 9,
                      background: active ? t.accent + '15' : t.surface,
                      border: `1.5px solid ${active ? t.accent : t.border}`,
                      color: active ? t.accent : t.text,
                      fontFamily: t.sans, fontSize: 11.5, cursor: 'pointer', fontWeight: 500,
                    }}>{st}</button>
                  );
                })}
              </div>
            </GField>

            <GField label="Sessions per week" t={t}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(d => {
                  const active = goalConfigs['sport_activity']?.daysPerWeek === d;
                  return (
                    <button key={d} onClick={() => updateConfig('sport_activity', { daysPerWeek: d })} style={{
                      flex: 1, padding: '13px 0', borderRadius: 11,
                      background: active ? t.text : t.surface,
                      color: active ? (theme === 'dark' ? t.bg : '#fff') : t.text,
                      border: `1px solid ${active ? t.text : t.border}`,
                      fontFamily: t.serif, fontSize: 20, cursor: 'pointer',
                    }}>{d}</button>
                  );
                })}
              </div>
            </GField>

            <GField label="Typical training intensity" t={t}>
              <div style={{ display: 'flex', gap: 6 }}>
                {INTENSITY_LEVELS.map(il => {
                  const active = goalConfigs['sport_activity']?.intensity === il;
                  return (
                    <button key={il} onClick={() => updateConfig('sport_activity', { intensity: il })} style={{
                      flex: 1, padding: '10px 0', borderRadius: 11,
                      background: active ? t.accent + '15' : t.surface,
                      border: `1.5px solid ${active ? t.accent : t.border}`,
                      color: active ? t.accent : t.text,
                      fontFamily: t.sans, fontSize: 12, cursor: 'pointer', fontWeight: 500,
                    }}>{il}</button>
                  );
                })}
              </div>
            </GField>
          </div>
        )}

        {/* ── config: micro_target ── */}
        {current === 'config_micro_target' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Your target.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Describe your specific goal in a sentence or two.
            </div>
            <GField label="Target" t={t}>
              <textarea
                value={goalConfigs['micro_target']?.description || ''}
                onChange={e => updateConfig('micro_target', { description: e.target.value })}
                placeholder="e.g. Run a sub-25 min 5K by August · Add 20 kg to my squat · Lose 5 kg by summer"
                rows={4}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 11,
                  border: `1px solid ${t.border2}`, background: t.surface,
                  fontFamily: t.sans, fontSize: 13, color: t.text, outline: 'none',
                  resize: 'none', lineHeight: 1.6, boxSizing: 'border-box',
                }}
              />
            </GField>
          </div>
        )}

        {/* ── config: general_fitness ── */}
        {current === 'config_general_fitness' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              What do you enjoy?
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Pick the activities you like — we'll weave these into your weekly plan alongside any strength work.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {GENERAL_ACTIVITIES.map(act => {
                const selected = (goalConfigs['general_fitness']?.activities || []).includes(act.id);
                return (
                  <button key={act.id} onClick={() => {
                    const prev = goalConfigs['general_fitness']?.activities || [];
                    const next = selected ? prev.filter(a => a !== act.id) : [...prev, act.id];
                    updateConfig('general_fitness', { activities: next });
                  }} style={{
                    padding: '10px 14px', borderRadius: 11,
                    background: selected ? t.accent + '15' : t.surface,
                    border: `1.5px solid ${selected ? t.accent : t.border}`,
                    color: selected ? t.accent : t.text,
                    fontFamily: t.sans, fontSize: 13, cursor: 'pointer', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    <span>{act.icon}</span>
                    <span>{act.label}</span>
                    {selected && <span style={{ fontSize: 12 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            {(goalConfigs['general_fitness']?.activities || []).length === 0 && (
              <div style={{
                marginTop: 16, padding: '10px 12px', borderRadius: 10,
                background: t.surface2, border: `1px dashed ${t.border}`,
                fontSize: 11.5, color: t.text3,
              }}>
                Select at least one activity to continue.
              </div>
            )}
          </div>
        )}

        {/* ── schedule ── */}
        {current === 'schedule' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Your training week.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Tap the days you're available to train. We'll build your plan around these.
            </div>

            <GField label="Training days" t={t}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {DAYS.map((day, i) => {
                  const key = DAY_KEYS[i];
                  const on  = trainingDays.includes(key);
                  return (
                    <button key={key} onClick={() => setTrainingDays(prev =>
                      on ? prev.filter(d => d !== key) : [...prev, key]
                    )} style={{
                      padding: '11px 0', borderRadius: 11, fontSize: 11, fontWeight: 600,
                      background: on ? t.accent : t.surface,
                      color: on ? t.accentText : t.text3,
                      border: `1.5px solid ${on ? t.accent : t.border}`,
                      fontFamily: t.sans, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}>
                      <span>{day}</span>
                    </button>
                  );
                })}
              </div>
              {trainingDays.length > 0 && (
                <div style={{ fontSize: 11.5, color: t.text2, marginTop: 10 }}>
                  {trainingDays.length} day{trainingDays.length !== 1 ? 's' : ''} selected:{' '}
                  {trainingDays.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
                </div>
              )}
            </GField>
          </div>
        )}

        {/* ── facilities ── */}
        {current === 'facilities' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              What do you have access to?
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              This helps us recommend sessions that actually work for you.
            </div>

            <ToggleCard
              icon="🏋️" title="Gym access" sub="Weight room, machines, cables"
              active={gymAccess} onToggle={() => setGymAccess(v => !v)} t={t}
            />

            {isEventRaceGoal && (
              <>
                <ToggleCard
                  icon="🏊" title="Pool access" sub="Regular access to a swimming pool"
                  active={poolAccess} onToggle={() => setPoolAccess(v => !v)} t={t}
                />
                {poolAccess && (
                  <div style={{ marginLeft: 4, marginBottom: 8 }}>
                    <GField label="Which days can you swim?" t={t}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {DAYS.map((day, i) => {
                          const key = DAY_KEYS[i];
                          const on  = poolDays.includes(key);
                          return (
                            <button key={key} onClick={() => setPoolDays(prev =>
                              on ? prev.filter(d => d !== key) : [...prev, key]
                            )} style={{
                              flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 10.5,
                              background: on ? t.blue + '20' : t.surface,
                              color: on ? t.blue : t.text,
                              border: `1px solid ${on ? t.blue : t.border}`,
                              fontFamily: t.sans, cursor: 'pointer', fontWeight: 500,
                            }}>{day}</button>
                          );
                        })}
                      </div>
                    </GField>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── sports ── */}
        {current === 'sports' && (
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>
              Regular sports.
            </div>
            <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>
              Any sport you play regularly? We'll factor the load into your plan. Skip if none.
            </div>

            {regularSports.map((s, i) => (
              <div key={i} style={{
                padding: '10px 14px', borderRadius: 12, background: t.surface,
                border: `1px solid ${t.border}`, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.sport}</div>
                  <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>
                    {s.day.charAt(0).toUpperCase() + s.day.slice(1)} · {s.intensity}
                  </div>
                </div>
                <button onClick={() => setRegularSports(prev => prev.filter((_, j) => j !== i))} style={{
                  width: 26, height: 26, borderRadius: 8, border: `1px solid ${t.border}`,
                  background: 'transparent', color: t.text3, cursor: 'pointer', fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              </div>
            ))}

            {/* Add form */}
            <div style={{
              padding: '14px', borderRadius: 13, background: t.surface2,
              border: `1px dashed ${t.border}`, marginTop: regularSports.length > 0 ? 8 : 0,
            }}>
              <div style={{
                fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
                color: t.text3, marginBottom: 10, fontWeight: 500,
              }}>Add a sport</div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                {SPORT_TYPES.map(st => {
                  const active = sportDraft.sport === st;
                  return (
                    <button key={st} onClick={() => setSportDraft(d => ({ ...d, sport: st }))} style={{
                      padding: '5px 9px', borderRadius: 7,
                      background: active ? t.accent + '15' : t.surface,
                      border: `1.5px solid ${active ? t.accent : t.border2}`,
                      color: active ? t.accent : t.text2,
                      fontFamily: t.sans, fontSize: 11, cursor: 'pointer',
                    }}>{st}</button>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 9.5, color: t.text3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 5 }}>Day</div>
                  <select
                    value={sportDraft.day}
                    onChange={e => setSportDraft(d => ({ ...d, day: e.target.value }))}
                    style={{
                      width: '100%', padding: '9px 10px', borderRadius: 9,
                      border: `1px solid ${t.border2}`, background: t.surface,
                      fontFamily: t.sans, fontSize: 12, color: t.text, outline: 'none',
                    }}
                  >
                    <option value="">Pick day</option>
                    {DAYS.map((day, i) => <option key={i} value={DAY_KEYS[i]}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, color: t.text3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 5 }}>Intensity</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {INTENSITY_LEVELS.map(il => {
                      const active = sportDraft.intensity === il;
                      return (
                        <button key={il} onClick={() => setSportDraft(d => ({ ...d, intensity: il }))} style={{
                          flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9.5,
                          background: active ? t.accent + '15' : t.surface,
                          border: `1.5px solid ${active ? t.accent : t.border2}`,
                          color: active ? t.accent : t.text2,
                          fontFamily: t.sans, cursor: 'pointer',
                        }}>{il}</button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                onClick={addSport}
                disabled={!sportDraft.sport || !sportDraft.day}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  background: (sportDraft.sport && sportDraft.day) ? t.accent : t.border,
                  color: (sportDraft.sport && sportDraft.day) ? t.accentText : t.text3,
                  border: 'none', fontFamily: t.sans, fontSize: 12.5, fontWeight: 600,
                  cursor: (sportDraft.sport && sportDraft.day) ? 'pointer' : 'default',
                }}
              >+ Add sport</button>
            </div>
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
              Goals locked in.
            </div>
            <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.55, marginBottom: 24, padding: '0 12px' }}>
              Your Forma is built around what matters most to you.
            </div>

            <div style={{
              background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14,
              padding: '12px 14px', textAlign: 'left',
            }}>
              {selectedGoals.map((goalId, i) => {
                const meta = GOAL_TYPES.find(g => g.id === goalId);
                return (
                  <div key={goalId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 0', borderTop: i > 0 ? `1px solid ${t.border}` : 'none', fontSize: 12,
                  }}>
                    <span style={{ color: t.text2 }}>{meta?.icon} {meta?.label}</span>
                    <span style={{
                      fontSize: 9.5, letterSpacing: '.08em', fontWeight: 700,
                      color: RANK_COLOURS[i], textTransform: 'uppercase',
                    }}>{RANK_LABELS[i]}</span>
                  </div>
                );
              })}
              {[
                { label: 'Training days', value: trainingDays.length > 0 ? trainingDays.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ') : '—' },
                gymAccess ? { label: 'Gym access', value: '✓ Yes' } : null,
                (isEventRaceGoal && poolAccess) ? { label: 'Pool access', value: '✓ Yes' } : null,
                unavailableDays.length ? { label: 'Days blocked', value: unavailableDays.length + ' days' } : null,
                regularSports.length ? { label: 'Regular sports', value: regularSports.length + (regularSports.length === 1 ? ' sport' : ' sports') } : null,
              ].filter(Boolean).map((row, i) => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 0', borderTop: `1px solid ${t.border}`, fontSize: 12,
                }}>
                  <span style={{ color: t.text2, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase' }}>{row.label}</span>
                  <span style={{ color: t.text }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div style={{ padding: '12px 22px 18px', background: t.bg, borderTop: `1px solid ${t.border}` }}>
        <button onClick={next} disabled={!canAdvance} style={{
          width: '100%', padding: '14px', borderRadius: 13,
          background: canAdvance ? t.accent : t.surface2,
          color: canAdvance ? t.accentText : t.text3,
          border: 'none', fontFamily: t.sans, fontSize: 14, fontWeight: 600,
          cursor: canAdvance ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {current === 'done'   ? 'Enter Forma →' :
           current === 'sports' ? (regularSports.length > 0 ? 'Continue →' : 'Skip for now') :
           'Continue →'}
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GField({ label, t, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
        color: t.text3, fontWeight: 500, marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  );
}

function YesNoRow({ value, onChange, t }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[['Yes', true], ['No', false]].map(([label, v]) => {
        const active = value === v;
        return (
          <button key={label} onClick={() => onChange(v)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10,
            background: active ? t.accent + '15' : t.surface,
            border: `1.5px solid ${active ? t.accent : t.border}`,
            color: active ? t.accent : t.text,
            fontFamily: t.sans, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        );
      })}
    </div>
  );
}

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0–12
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i); // 0–59

function HoursMinutesInput({ hours, minutes, onChange, t }) {
  const selectSt = {
    width: '100%', padding: '10px 8px', borderRadius: 9,
    border: `1px solid ${t.border2}`, background: t.surface,
    fontFamily: t.sans, fontSize: 13, color: t.text, outline: 'none',
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
      <div>
        <div style={{ fontSize: 9.5, color: t.text3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 5 }}>Hours</div>
        <select value={hours || ''} onChange={e => onChange(e.target.value, undefined)} style={selectSt}>
          <option value="">–</option>
          {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 9.5, color: t.text3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 5 }}>Minutes</div>
        <select value={minutes || ''} onChange={e => onChange(undefined, e.target.value)} style={selectSt}>
          <option value="">–</option>
          {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}

function ToggleCard({ icon, title, sub, active, onToggle, t }) {
  return (
    <button onClick={onToggle} style={{
      width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 14,
      background: active ? t.accent + '10' : t.surface,
      border: `1.5px solid ${active ? t.accent : t.border}`,
      cursor: 'pointer', fontFamily: t.sans, marginBottom: 10,
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 11,
        background: active ? t.accent + '25' : t.surface2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: t.text, fontWeight: 500, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: t.text2, lineHeight: 1.5 }}>{sub}</div>
      </div>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: active ? t.accent : 'transparent',
        border: active ? 'none' : `1.5px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? t.accentText : t.text3, fontSize: 12,
      }}>{active ? '✓' : ''}</div>
    </button>
  );
}
