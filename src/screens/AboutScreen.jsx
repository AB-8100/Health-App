import React from 'react';
import themes from '../data/themes';
import { getCurrentPlanWeek, computeEventPhases, getPlanWeekStart } from '../data/eventPlan';
import { getEventSessionsForDate } from '../utils/eventDaySessions';
import { DraftPlanBanner } from '../components/SharedUI';
import { parseTrainingPlanWorkbook } from '../utils/trainingPlanImport';
import { submitFeedback } from '../utils/supabase';
import { GOAL_TYPES, RANK_LABELS } from './GoalsSetupScreen';
import { SPLITS } from './GymPlanScreens';
import { computeSuggestedCalories } from '../utils/calorieCalc';
import { getGoalPaceValue, parseGoalPaceInput, formatPaceValue, paceUnitForType } from '../utils/analytics';
import {
  getTrainingDayIndices, toggleTrainingDay,
  isScheduleValidForSplit, reconcileScheduleWithSplitIds, REST,
  getActivityDayIndices, getAllTrainingDayIndices,
} from '../utils/scheduleReconciliation';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Height/weight are always stored canonically in cm/kg (profile.height,
// profile.weight — see docs/PROJECT_CONTEXT.md §9), regardless of which
// unit is selected for display. These convert for display/edit only.
const cmToDecimalFt = (cm) => Math.round((Number(cm) / 30.48) * 100) / 100;
const decimalFtToCm = (ft) => Math.round(Number(ft) * 30.48);
const kgToLbs = (kg) => Math.round(Number(kg) * 2.20462 * 10) / 10;
const lbsToKg = (lbs) => Math.round(Number(lbs) * 0.453592 * 10) / 10;

const SEX_OPTIONS = [
  ['male', 'Male'], ['female', 'Female'], ['prefer_not_to_say', 'Prefer not to say'],
];

// Simple editable field row
function FieldRow({ label, value, unit, type = 'number', step, onChange, theme }) {
  const t = themes[theme];
  const [editing, setEditing] = React.useState(false);
  const [local, setLocal] = React.useState(String(value));

  const commit = () => {
    const v = type === 'number' ? Number(local) : local;
    if (type === 'number' && !isNaN(v) && v > 0) onChange(v);
    else if (type === 'text' && local.trim()) onChange(local.trim());
    setEditing(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 0', borderBottom: `1px solid ${t.border}`,
    }}>
      <span style={{ fontSize: 13, color: t.text }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {editing ? (
          <>
            <input
              autoFocus
              value={local}
              type={type}
              step={step}
              onChange={(e) => setLocal(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              style={{
                width: 80, padding: '4px 8px', borderRadius: 7,
                border: `1px solid ${t.accent}`, background: t.surface2,
                fontFamily: t.mono, fontSize: 13, color: t.text, outline: 'none',
                textAlign: 'right',
              }}
            />
            {unit && <span style={{ fontSize: 11, color: t.text3 }}>{unit}</span>}
          </>
        ) : (
          <>
            <span style={{ fontFamily: t.mono, fontSize: 13, color: t.text2 }}>
              {value}{unit ? ` ${unit}` : ''}
            </span>
            <button onClick={() => { setLocal(String(value)); setEditing(true); }} style={{
              padding: '3px 8px', borderRadius: 6, background: 'transparent',
              border: `1px solid ${t.border}`, color: t.accent,
              fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
            }}>Edit</button>
          </>
        )}
      </div>
    </div>
  );
}

// Section card wrapper
function Section({ title, children, theme }) {
  const t = themes[theme];
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18,
      padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
        color: t.text3, marginBottom: 10, fontWeight: 500,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// Rows for the "Goal paces" section below — one per discipline
// getGoalPaceValue can derive a pace for (see utils/analytics.js). `type` is
// the analytics activity type passed to getGoalPaceValue/paceUnitForType;
// `discipline` is the key targetPaces/manualGoalPaces are stored under.
const GOAL_PACE_ROWS = [
  { type: 'run', discipline: 'run', label: 'Run' },
  { type: 'swim', discipline: 'swim', label: 'Swim' },
  { type: 'cycle', discipline: 'bike', label: 'Bike' },
];

// A single discipline's goal pace: a read-only value once one exists (from
// either source — see the confirmedValue/manualValue split below), or an
// inline mm:ss / km-h entry field when neither has one yet.
function GoalPaceRow({ theme, label, unit, confirmedValue, manualValue, onSave }) {
  const t = themes[theme];
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState(false);

  const placeholder = unit === 'kmh' ? 'km/h' : 'mm:ss';

  const commit = () => {
    const parsed = parseGoalPaceInput(draft, unit);
    if (parsed == null) { setError(true); return; }
    onSave(parsed);
    setEditing(false);
    setDraft('');
    setError(false);
  };

  const rowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 0', borderBottom: `1px solid ${t.border}`,
  };

  if (confirmedValue != null) {
    return (
      <div style={rowStyle}>
        <span style={{ fontSize: 13, color: t.text }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: t.mono, fontSize: 13, color: t.text2 }}>{formatPaceValue(confirmedValue, unit)}</span>
          <span style={{ fontSize: 9, color: t.text3 }}>from questionnaire</span>
        </div>
      </div>
    );
  }

  if (manualValue != null && !editing) {
    return (
      <div style={rowStyle}>
        <span style={{ fontSize: 13, color: t.text }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: t.mono, fontSize: 13, color: t.text2 }}>{formatPaceValue(manualValue, unit)}</span>
          <button onClick={() => { setDraft(''); setError(false); setEditing(true); }} style={{
            padding: '3px 8px', borderRadius: 6, background: 'transparent',
            border: `1px solid ${t.border}`, color: t.accent,
            fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
          }}>Edit</button>
        </div>
      </div>
    );
  }

  return (
    <div style={rowStyle}>
      <span style={{ fontSize: 13, color: t.text }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          autoFocus={editing}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => { setDraft(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          style={{
            width: 70, padding: '4px 8px', borderRadius: 7,
            border: `1px solid ${error ? t.rose : t.accent}`, background: t.surface2,
            fontFamily: t.mono, fontSize: 13, color: t.text, outline: 'none',
            textAlign: 'right',
          }}
        />
        <button onClick={commit} style={{
          padding: '3px 8px', borderRadius: 6, background: 'transparent',
          border: `1px solid ${t.border}`, color: t.accent,
          fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
        }}>Save</button>
      </div>
    </div>
  );
}

// Feedback entry point (features/specs/feedback-entry-point.md) — one
// free-text textarea + submit, writing a single row to `user_feedback`.
// Errors keep the draft text in place rather than clearing it (spec's
// "Edge cases handled" — don't lose what the user typed on a failed write).
function FeedbackSection({ theme, userId }) {
  const t = themes[theme];
  const [message, setMessage] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle | submitting | sent | error

  const submit = async () => {
    if (!message.trim() || state === 'submitting') return;
    setState('submitting');
    try {
      await submitFeedback(userId, message.trim());
      setMessage('');
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <Section title="Feedback" theme={theme}>
      <div style={{ fontSize: 11.5, color: t.text2, marginBottom: 10, lineHeight: 1.5 }}>
        Missing a race type, found a bug, or have an idea? Tell us — this goes straight to the team.
      </div>
      <textarea
        value={message}
        onChange={(e) => { setMessage(e.target.value); if (state !== 'idle') setState('idle'); }}
        placeholder="What's on your mind?"
        rows={4}
        style={{
          width: '100%', padding: '11px 13px', borderRadius: 10,
          border: `1px solid ${t.border2}`, background: t.surface2,
          fontFamily: t.sans, fontSize: 13, color: t.text, outline: 'none',
          resize: 'none', lineHeight: 1.6, boxSizing: 'border-box', marginBottom: 10,
        }}
      />
      <button
        onClick={submit}
        disabled={!message.trim() || state === 'submitting'}
        style={{
          width: '100%', padding: '10px', borderRadius: 10,
          background: (message.trim() && state !== 'submitting') ? t.accent : t.border,
          color: (message.trim() && state !== 'submitting') ? t.accentText : t.text3,
          border: 'none', fontFamily: t.sans, fontSize: 12.5, fontWeight: 600,
          cursor: (message.trim() && state !== 'submitting') ? 'pointer' : 'default',
        }}
      >
        {state === 'submitting' ? 'Sending…' : 'Send feedback'}
      </button>
      {state === 'sent' && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: t.green }}>Thanks — your feedback was sent.</div>
      )}
      {state === 'error' && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: '#DC2626' }}>
          Couldn't send that — check your connection and try again.
        </div>
      )}
    </Section>
  );
}

function AboutScreen({
  width = 390, height = 820, theme = 'light',
  userId,
  profile = {}, userSettings = {}, plan = {}, activities = {},
  onSaveProfile, onSaveSettings,
  onBack, onNav, onSignOut, onSetupTrainingPlan,
  sheetsStatus = 'disconnected', sheetsError = null, sheetUrl = null,
  onConnectSheets, onDisconnectSheets, onReconnectSheets,
  intakeCompleted = false,
  intakeDraft = false,
  onStartQuestionnaire,
  eventPlan = { meta: {}, phases: [], sessions: {} },
  eventOverrides = {},
  onUploadTrainingPlan,
  goalsPayload,
  onRedoGoals,
  onResetOnboardingSchedule,
  onUpdateSchedule,
  onUpdateActivities,
}) {
  const t = themes[theme];

  const [localProfile, setLP] = React.useState({ ...profile });
  const [localSettings, setLS] = React.useState({
    dailyCaloriesBase: userSettings.dailyCaloriesBase || 1500,
    gymDayBoost: userSettings.gymDayBoost || 250,
    weightUnit: userSettings.weightUnit || 'kg',
    heightUnit: userSettings.heightUnit || 'cm',
    ...userSettings,
  });

  const updateProfile = (key, val) => {
    const updated = { ...localProfile, [key]: val };
    setLP(updated);
    if (onSaveProfile) onSaveProfile(updated);
  };

  const updateSettings = (key, val) => {
    const updated = { ...localSettings, [key]: val };
    setLS(updated);
    if (onSaveSettings) onSaveSettings(updated);
  };

  const hasGym          = localProfile.hasGym !== false;
  const hasEventTraining = !!localProfile.hasEventTraining;

  // Gym training days come from the actual schedule (which weekdays are
  // non-'—'), not from plan.splitDays — splitDays is just "how many
  // distinct sessions rotate through those days" (see Customize split /
  // SplitPickerScreen). A stored scheduleOverride is reconciled onto the
  // current split's ids if the split changed since it was last saved.
  const activeSplit    = hasGym && plan.splitDays ? SPLITS[plan.splitDays] : null;
  const activeSplitIds = activeSplit ? activeSplit.days.map(d => d.id) : [];
  const effectiveSchedule = plan.scheduleOverride
    ? (isScheduleValidForSplit(plan.scheduleOverride, activeSplitIds)
        ? plan.scheduleOverride
        : reconcileScheduleWithSplitIds(plan.scheduleOverride, activeSplitIds))
    : (activeSplit?.schedule || Array(7).fill('—'));
  const scheduleDayIndices = hasGym ? getTrainingDayIndices(effectiveSchedule) : [];
  const gymDays = scheduleDayIndices.length;

  // Non-gym training days — any weekday with a manually-added activity
  // (run, swim, sport, etc. — see DayActivitiesScreen), independent of
  // gym access. "Training days" below is the union of these two sources,
  // so the picker reflects everything a user trains, not just the gym.
  const activityDayIndices = getActivityDayIndices(activities);
  const otherActivityDays = activityDayIndices.length;
  const trainingDayIndices = getAllTrainingDayIndices(scheduleDayIndices, activityDayIndices);

  const handleToggleTrainingDay = (dayIdx) => {
    const hasGymSlot = hasGym && effectiveSchedule[dayIdx] !== undefined && effectiveSchedule[dayIdx] !== REST;
    const hasActivity = (activities[dayIdx] || []).length > 0;

    if (hasGymSlot || hasActivity) {
      // Turning this day off — a "training day" toggle should mean a full
      // rest day, so clear every activity type on it, not just the gym slot.
      if (hasGymSlot) {
        const next = [...effectiveSchedule];
        next[dayIdx] = REST;
        onUpdateSchedule?.(next);
      }
      if (hasActivity) {
        onUpdateActivities?.({ ...activities, [dayIdx]: [] });
      }
      return;
    }

    // Turning this day on — only the gym has a sensible default assignment
    // (next split-day-id in rotation). Non-gym activities are day-specific
    // (run/swim/sport/etc.) and get added per-day via Weekly Overview /
    // DayActivitiesScreen, not from this generic toggle.
    if (!hasGym) return;
    const effectiveSplitDays = plan.splitDays || 3; // sensible default so a first toggle has content to assign
    const ids = SPLITS[effectiveSplitDays].days.map(d => d.id);
    const nextSchedule = toggleTrainingDay(effectiveSchedule, ids, dayIdx);
    onUpdateSchedule?.(nextSchedule, plan.splitDays ? undefined : effectiveSplitDays);
  };

  const totalPlanWeeks   = eventPlan.meta?.totalWeeks || localProfile.eventTotalWeeks || 18;
  const currentWeek      = getCurrentPlanWeek(eventPlan.meta?.startDate, totalPlanWeeks);
  const phaseMeta        = eventPlan.phases?.length ? eventPlan.phases : computeEventPhases(totalPlanWeeks);
  const currentPhase     = phaseMeta.find(p => currentWeek >= p.weeks[0] && currentWeek <= p.weeks[1]) || phaseMeta[0];
  const planDone         = !!localProfile.goal;

  // Real weekly event-plan session count (days in the current plan week with
  // at least one non-rest session), rather than a flat guess — a plan can be
  // any cadence, not always 5/week.
  const eventDays = React.useMemo(() => {
    if (!hasEventTraining) return 0;
    const weekStart = getPlanWeekStart(currentWeek, eventPlan.meta?.startDate);
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setUTCDate(d.getUTCDate() + i);
      const dk = d.toISOString().slice(0, 10);
      const sessions = getEventSessionsForDate(dk, eventOverrides, eventPlan.sessions, hasEventTraining);
      if (sessions.length > 0) count++;
    }
    return count;
  }, [hasEventTraining, currentWeek, eventPlan.meta?.startDate, eventPlan.sessions, eventOverrides]);

  const totalWeeklySessions = gymDays + otherActivityDays + eventDays;

  // Real goals from Stage 2 onboarding (see GoalsSetupScreen.jsx) — the
  // source of truth for what a user is training for. Read-only here; use
  // "Redo my goals & questionnaire" below to change them.
  const realGoals = goalsPayload?.goals || [];
  const primaryGoalLabel = realGoals.length
    ? (GOAL_TYPES.find(g => g.id === realGoals[0].type)?.label || realGoals[0].type)
    : null;

  // Goal paces — feeds the Analytics screen's "Goal pace" bubble via the
  // same getGoalPaceValue used there (utils/analytics.js). Primary source is
  // the event_race goal's confirmed target split (Stage 3 questionnaire);
  // manualGoalPaces is the fallback set here for users who only upload their
  // own training plan and never go through the questionnaire.
  const eventRaceConfig = realGoals.find(g => g.type === 'event_race')?.config || null;
  const manualGoalPaces = localProfile.manualGoalPaces || {};
  const setManualGoalPace = (discipline, value) =>
    updateProfile('manualGoalPaces', { ...manualGoalPaces, [discipline]: value });

  // Suggested calorie targets — computed from body stats + weekly session
  // count, never auto-applied over the editable fields below (see
  // "Use suggestion" button in the Calorie targets section).
  const calorieSuggestion = React.useMemo(() => computeSuggestedCalories({
    heightCm: localProfile.height,
    weightKg: localProfile.weight,
    age: localProfile.age,
    sex: localProfile.sex,
    weeklyTrainingSessions: totalWeeklySessions,
  }), [localProfile.height, localProfile.weight, localProfile.age, localProfile.sex, totalWeeklySessions]);

  const useCalorieSuggestion = () => {
    if (!calorieSuggestion) return;
    // Both fields together in one update — two sequential updateSettings()
    // calls would each spread the same stale localSettings snapshot and the
    // second call would silently drop the first field's change.
    const updated = {
      ...localSettings,
      dailyCaloriesBase: calorieSuggestion.suggestedDailyBase,
      gymDayBoost: calorieSuggestion.suggestedGymDayBoost,
    };
    setLS(updated);
    if (onSaveSettings) onSaveSettings(updated);
  };

  // ── Training plan upload ──────────────────────────────────────────────────
  const fileInputRef = React.useRef(null);
  const [importState, setImportState] = React.useState('idle'); // idle | parsing | confirm | error
  const [importError, setImportError] = React.useState(null);
  const [pendingPlan, setPendingPlan] = React.useState(null);

  const handlePickFile = () => fileInputRef.current?.click();

  // onUploadTrainingPlan already persists profile.hasEventTraining upstream —
  // this just mirrors it into localProfile, which (unlike the other fields on
  // this screen) is only ever seeded from the `profile` prop at mount, so
  // without this it'd keep showing "no plan" here until the screen remounts.
  //
  // onUploadTrainingPlan returns a promise that resolves once the plan has
  // actually been confirmed saved to Supabase (not just applied locally) —
  // await it so a save failure (e.g. offline, or a backend error) surfaces
  // as a real error here instead of silently looking like it worked and
  // then reverting on the next reload.
  const applyUploadedPlan = async (parsed) => {
    setLP(prev => ({ ...prev, hasEventTraining: true, eventTotalWeeks: parsed.meta?.totalWeeks || prev.eventTotalWeeks }));
    try {
      await onUploadTrainingPlan?.(parsed);
      setImportState('idle');
    } catch (err) {
      setImportError(
        `Your plan is showing, but saving it to your account failed (${err.message || 'unknown error'}). ` +
        `It may not survive a reload — try uploading again once you're back online.`
      );
      setImportState('error');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportState('parsing');
    try {
      const parsed = await parseTrainingPlanWorkbook(file);
      if (hasEventTraining) {
        setPendingPlan(parsed);
        setImportState('confirm');
      } else {
        await applyUploadedPlan(parsed);
      }
    } catch (err) {
      setImportError(err.message || "Couldn't read that file — check it matches the expected format.");
      setImportState('error');
    }
  };

  const confirmImport = () => {
    const parsed = pendingPlan;
    setPendingPlan(null);
    applyUploadedPlan(parsed);
  };
  const cancelImport = () => {
    setPendingPlan(null);
    setImportState('idle');
  };

  // ── redo goals & questionnaire — regenerates the plan instantly via the
  // deterministic engine on completion, same as first-time onboarding ──────
  const [redoConfirming, setRedoConfirming] = React.useState(false);

  // ── reset the onboarding-generated gym split / activity schedule ────────
  // Only offered when there's actually something onboarding produced to
  // undo — never touches the uploaded/generated event plan.
  const hasGeneratedSchedule = !!plan.splitDays ||
    Object.values(activities || {}).some(day => (day || []).length > 0) ||
    !!localProfile.intakeCompleted;
  const [resetConfirming, setResetConfirming] = React.useState(false);
  const [resetDone, setResetDone] = React.useState(false);
  const handleResetSchedule = () => {
    onResetOnboardingSchedule?.();
    setResetConfirming(false);
    setResetDone(true);
  };

  return (
    <div style={{
      width, height, background: t.bg, fontFamily: t.sans, color: t.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      {/* Status bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 22px 8px', fontSize: 14, fontWeight: 600, color: t.text,
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '2px 16px 12px', borderBottom: `1px solid ${t.border}`,
      }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, borderRadius: 9, background: 'transparent',
          border: `1px solid ${t.border}`, color: t.text, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>←</button>
        <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text }}>About me</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 16px' }} className="phone-scroll">

        {/* Profile avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `linear-gradient(135deg, ${t.accent}, #6D4AAF)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: t.serif, fontSize: 24, color: '#fff', flexShrink: 0,
          }}>
            {(localProfile.name || 'U').charAt(0)}
          </div>
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 22, color: t.text, lineHeight: 1 }}>
              {localProfile.name || 'Your name'}
            </div>
            <div style={{ fontSize: 11, color: t.text3, marginTop: 3 }}>
              {primaryGoalLabel || 'No goal set'}
              {' · '}
              {totalWeeklySessions > 0
                ? `${totalWeeklySessions} sessions/wk`
                : 'No plan set up'}
            </div>
          </div>
        </div>

        {/* Draft plan banner — only nag when there's neither a completed
            questionnaire nor an uploaded training plan to fall back on */}
        {!intakeCompleted && !hasEventTraining && (
          <div style={{ marginBottom: 12 }}>
            <DraftPlanBanner
              theme={theme}
              hasDraft={intakeDraft}
              onAction={onStartQuestionnaire}
            />
          </div>
        )}

        {/* Body stats */}
        <Section title="Body stats" theme={theme}>
          <FieldRow label="Name" value={localProfile.name || ''} type="text"
            onChange={(v) => updateProfile('name', v)} theme={theme} />
          <FieldRow label="Age" value={localProfile.age || 30} unit="years"
            onChange={(v) => updateProfile('age', v)} theme={theme} />
          {/* Sex — feeds the calorie suggestion below (Mifflin-St Jeor
              differs by sex); also collected at onboarding. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 0', borderBottom: `1px solid ${t.border}`,
          }}>
            <span style={{ fontSize: 13, color: t.text }}>Sex</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {SEX_OPTIONS.map(([val, label]) => {
                const active = localProfile.sex === val;
                return (
                  <button key={val} onClick={() => updateProfile('sex', val)} style={{
                    padding: '4px 9px', borderRadius: 7,
                    background: active ? t.text : 'transparent',
                    color: active ? '#fff' : t.text2,
                    border: `1px solid ${active ? t.text : t.border}`,
                    fontSize: 10.5, cursor: 'pointer', fontFamily: t.sans, fontWeight: 500,
                  }}>{label}</button>
                );
              })}
            </div>
          </div>
          {/* Height/weight are stored canonically in cm/kg — convert for
              display and on save so an imperial-unit edit doesn't write a
              raw ft/lbs number into a field everything else treats as cm/kg. */}
          <FieldRow
            label="Height"
            value={localSettings.heightUnit === 'ft' ? cmToDecimalFt(localProfile.height || 168) : (localProfile.height || 168)}
            unit={localSettings.heightUnit} step={localSettings.heightUnit === 'ft' ? 0.1 : 1}
            onChange={(v) => updateProfile('height', localSettings.heightUnit === 'ft' ? decimalFtToCm(v) : v)}
            theme={theme}
          />
          <FieldRow
            label="Weight"
            value={localSettings.weightUnit === 'lbs' ? kgToLbs(localProfile.weight || 65) : (localProfile.weight || 65)}
            unit={localSettings.weightUnit} step={localSettings.weightUnit === 'lbs' ? 1 : 0.1}
            onChange={(v) => updateProfile('weight', localSettings.weightUnit === 'lbs' ? lbsToKg(v) : v)}
            theme={theme}
          />
          {/* Unit toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 0',
          }}>
            <span style={{ fontSize: 13, color: t.text }}>Units</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {['kg / cm', 'lbs / ft'].map((u, i) => {
                const isMetric = i === 0;
                const active = isMetric ? localSettings.weightUnit === 'kg' : localSettings.weightUnit === 'lbs';
                return (
                  <button key={u} onClick={() => {
                    updateSettings('weightUnit', isMetric ? 'kg' : 'lbs');
                    updateSettings('heightUnit', isMetric ? 'cm' : 'ft');
                  }} style={{
                    padding: '4px 9px', borderRadius: 7,
                    background: active ? t.text : 'transparent',
                    color: active ? '#fff' : t.text2,
                    border: `1px solid ${active ? t.text : t.border}`,
                    fontSize: 10.5, cursor: 'pointer', fontFamily: t.sans, fontWeight: 500,
                  }}>{u}</button>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Calorie settings */}
        <Section title="Calorie targets" theme={theme}>
          <div style={{ fontSize: 11, color: t.text2, marginBottom: 10, lineHeight: 1.5 }}>
            Base calories apply on rest days. Gym days and active sessions add their boost automatically.
          </div>
          <FieldRow label="Daily base" value={localSettings.dailyCaloriesBase}
            unit="kcal" step={50}
            onChange={(v) => updateSettings('dailyCaloriesBase', v)} theme={theme} />
          <FieldRow label="Gym day boost" value={localSettings.gymDayBoost}
            unit="kcal" step={25}
            onChange={(v) => updateSettings('gymDayBoost', v)} theme={theme} />
          <div style={{ padding: '10px 0', fontSize: 11, color: t.text3 }}>
            Weekly base target: <span style={{ color: t.text, fontWeight: 500 }}>
              {(localSettings.dailyCaloriesBase * 7).toLocaleString()} kcal
            </span>
            {' '}(adjusts with active days)
          </div>

          {/* Suggested target — computed from body stats + weekly session
              count (Mifflin-St Jeor + activity multiplier), never applied
              automatically over the editable fields above. */}
          {calorieSuggestion ? (
            <div style={{
              marginTop: 4, padding: '10px 12px', borderRadius: 10,
              background: t.surface2, border: `1px solid ${t.border}`,
            }}>
              <div style={{ fontSize: 11.5, color: t.text, lineHeight: 1.5 }}>
                Suggested: <strong>{calorieSuggestion.suggestedDailyBase.toLocaleString()} kcal</strong> base
                {' · +'}<strong>{calorieSuggestion.suggestedGymDayBoost.toLocaleString()} kcal</strong> gym day
              </div>
              <div style={{ fontSize: 10, color: t.text3, marginTop: 2 }}>
                Based on your height, weight, age, sex, and {totalWeeklySessions} session{totalWeeklySessions === 1 ? '' : 's'}/week ({calorieSuggestion.activityTier} activity).
              </div>
              <button onClick={useCalorieSuggestion} style={{
                marginTop: 8, padding: '6px 12px', borderRadius: 8,
                background: t.accent + '15', color: t.accent,
                border: `1px solid ${t.accent + '30'}`,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
              }}>Use suggestion</button>
            </div>
          ) : (
            <div style={{ fontSize: 10.5, color: t.text3, lineHeight: 1.5 }}>
              Fill in your age, height, and weight in Body stats above for a suggested target.
            </div>
          )}
        </Section>

        {/* Training plan */}
        <Section title="Training plan" theme={theme}>
          {hasEventTraining ? (
            <>
              {/* Active event plan card */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: `1px solid ${t.border}`,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: currentPhase.color + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>🏁</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Event Training Plan</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: currentPhase.color,
                      background: currentPhase.color + '18', border: `1px solid ${currentPhase.color}30`,
                      borderRadius: 4, padding: '1px 5px', letterSpacing: '.06em',
                    }}>{currentPhase.label.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: t.text3, marginTop: 1 }}>
                    {totalPlanWeeks}-week programme · Week {currentWeek}
                    {eventPlan.meta?.eventDistances ? ` · ${eventPlan.meta.eventDistances}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, color: '#16A34A',
                  background: '#16A34A18', border: '1px solid #16A34A30',
                  borderRadius: 5, padding: '2px 7px',
                }}>ACTIVE</span>
              </div>

              {/* Phase progress bar */}
              <div style={{ margin: '10px 0 8px' }}>
                <div style={{ display: 'flex', gap: 2, height: 4, borderRadius: 99, overflow: 'hidden' }}>
                  {phaseMeta.map(ph => {
                    const w = ((ph.weeks[1] - ph.weeks[0] + 1) / totalPlanWeeks) * 100;
                    const isActive = ph.label === currentPhase.label;
                    const filled = isActive
                      ? ((currentWeek - ph.weeks[0]) / (ph.weeks[1] - ph.weeks[0] + 1)) * w
                      : currentWeek > ph.weeks[1] ? w : 0;
                    return (
                      <div key={ph.label} style={{
                        width: `${w}%`, height: '100%', borderRadius: 99,
                        background: ph.color + '25', position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${(filled / w) * 100}%`, background: ph.color, borderRadius: 99,
                        }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                  {phaseMeta.map(ph => {
                    const w = ((ph.weeks[1] - ph.weeks[0] + 1) / totalPlanWeeks) * 100;
                    return (
                      <div key={ph.label} style={{
                        width: `${w}%`, fontSize: 8,
                        color: ph.label === currentPhase.label ? ph.color : t.text3,
                        fontWeight: ph.label === currentPhase.label ? 700 : 400,
                        whiteSpace: 'nowrap', overflow: 'hidden',
                      }}>{ph.label}</div>
                    );
                  })}
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[
                  { label: 'Event sessions', value: `${eventDays}/wk` },
                  { label: 'Disciplines', value: 'Swim · Bike · Run' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    flex: 1, background: t.surface2, border: `1px solid ${t.border}`,
                    borderRadius: 9, padding: '7px 10px',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{stat.value}</div>
                    <div style={{ fontSize: 9.5, color: t.text3 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <button onClick={() => onNav?.('weekly')} style={{
                width: '100%', padding: '9px', borderRadius: 10,
                background: 'transparent', border: `1px solid ${t.border}`,
                color: t.accent, fontFamily: t.sans, fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}>View weekly overview →</button>
            </>
          ) : (
            <>
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '8px 12px', borderRadius: 10,
                background: t.surface2, border: `1px solid ${t.border}`,
                marginBottom: 10,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>📋</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                    {!planDone ? 'Complete your profile' : 'No event training plan'}
                  </div>
                  <div style={{ fontSize: 11, color: t.text2, lineHeight: 1.5 }}>
                    {!planDone
                      ? 'Finish setting up your goals and training intake to unlock a personalised plan.'
                      : 'Add a race or event goal to unlock the 18-week Weekly Overview plan with conflict detection.'}
                  </div>
                </div>
              </div>
              <button
                onClick={onSetupTrainingPlan}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  background: t.accent, color: '#fff', border: 'none',
                  fontFamily: t.sans, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {!planDone ? 'Complete your profile →' : 'Set up training plan →'}
              </button>
            </>
          )}

          {/* Upload / overwrite from spreadsheet */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {importState === 'confirm' && pendingPlan ? (
              <div style={{
                padding: '10px 12px', borderRadius: 10,
                background: '#F59E0B12', border: '1px solid #F59E0B35',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>
                  Replace your current plan?
                </div>
                <div style={{ fontSize: 11, color: t.text2, lineHeight: 1.5, marginBottom: 10 }}>
                  {pendingPlan.meta.totalWeeks}-week plan
                  {pendingPlan.meta.eventDistances ? ` · ${pendingPlan.meta.eventDistances}` : ''}
                  {' '}from {pendingPlan.sourceFileName}. This overwrites your existing event plan and clears any manual schedule changes.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={cancelImport} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    background: 'transparent', border: `1px solid ${t.border}`,
                    color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>Cancel</button>
                  <button onClick={confirmImport} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    background: '#DC2626', border: 'none',
                    color: '#fff', fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>Overwrite plan</button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={handlePickFile}
                  disabled={importState === 'parsing'}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 10,
                    background: 'transparent', border: `1px solid ${t.border}`,
                    color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600,
                    cursor: importState === 'parsing' ? 'default' : 'pointer',
                    opacity: importState === 'parsing' ? 0.6 : 1,
                  }}
                >
                  {importState === 'parsing'
                    ? 'Reading file…'
                    : hasEventTraining ? 'Upload new plan (.xlsx) →' : 'Upload training plan (.xlsx) →'}
                </button>
                {importState === 'error' && importError && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#DC2626', lineHeight: 1.5 }}>
                    {importError}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Redo goals & questionnaire — re-runs the merged onboarding flow
              from scratch (pre-filled with current answers); a plan
              regenerates automatically on completion, no separate choice to
              make. Always available whenever the handler is provided —
              handleRedoGoals (App.jsx) has no actual dependency on intake
              having been completed, so this isn't gated on that. */}
          {typeof onRedoGoals === 'function' && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
              {redoConfirming ? (
                <div style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: t.surface2, border: `1px solid ${t.border}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>
                    Redo your goals & questionnaire?
                  </div>
                  <div style={{ fontSize: 11, color: t.text2, lineHeight: 1.5, marginBottom: 10 }}>
                    You'll go through goal setup and the questionnaire again, starting from your current answers. Nothing changes until you finish — your plan regenerates automatically at the end.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setRedoConfirming(false)} style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      background: 'transparent', border: `1px solid ${t.border}`,
                      color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={() => onRedoGoals()} style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      background: t.accent, border: 'none',
                      color: '#fff', fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>Continue</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setRedoConfirming(true)}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 10,
                    background: 'transparent', border: `1px solid ${t.border}`,
                    color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Redo my goals & questionnaire
                </button>
              )}
            </div>
          )}
        </Section>

        {/* Training days — which weekdays you train, decoupled from any
            specific split template. Disabled while an uploaded event plan
            is driving the Weekly Overview, since a configured schedule
            would inject gym sessions alongside the plan's own sessions. */}
        <Section title="Training days" theme={theme}>
          <div style={{ fontSize: 11, color: t.text2, marginBottom: 10, lineHeight: 1.5 }}>
            {hasEventTraining
              ? "Disabled while your uploaded training plan is active. Add one-off sessions from the Weekly Overview's + Add session button instead."
              : 'Tap the days you train — this feeds straight into your Weekly Overview.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, opacity: hasEventTraining ? 0.45 : 1 }}>
            {WEEKDAY_LABELS.map((label, i) => {
              const isActive = trainingDayIndices.includes(i);
              return (
                <button
                  key={label}
                  disabled={hasEventTraining}
                  onClick={() => handleToggleTrainingDay(i)}
                  style={{
                    padding: '10px 0 7px', borderRadius: 10,
                    background: isActive ? t.text : t.surface2,
                    color: isActive ? '#fff' : t.text,
                    border: `1px solid ${isActive ? t.text : t.border}`,
                    fontFamily: t.sans, fontSize: 11, fontWeight: 600, lineHeight: 1,
                    cursor: hasEventTraining ? 'not-allowed' : 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}
                >
                  {label}
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: isActive ? 'rgba(255,255,255,.8)' : t.border2,
                  }} />
                </button>
              );
            })}
          </div>

          {/* Combined weekly session count */}
          {totalWeeklySessions > 0 && (
            <div style={{
              marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
            }}>
              {gymDays > 0 && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: '#4F46E5',
                  background: '#4F46E508', border: '1px solid #4F46E520',
                  borderRadius: 5, padding: '2px 7px',
                }}>🏋️ {gymDays} gym</span>
              )}
              {otherActivityDays > 0 && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: '#15803D',
                  background: '#15803D08', border: '1px solid #15803D20',
                  borderRadius: 5, padding: '2px 7px',
                }}>🏃 {otherActivityDays} other</span>
              )}
              {eventDays > 0 && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: '#0369A1',
                  background: '#0369A108', border: '1px solid #0369A120',
                  borderRadius: 5, padding: '2px 7px',
                }}>🏊 {eventDays} event</span>
              )}
              <span style={{ fontSize: 10.5, color: t.text3 }}>
                = <strong style={{ color: t.text }}>{totalWeeklySessions} sessions/week</strong> total
              </span>
            </div>
          )}

          <button
            disabled={hasEventTraining}
            onClick={() => onNav?.('gym-split')}
            style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 9,
              background: 'transparent', border: `1px solid ${t.border}`,
              color: hasEventTraining ? t.text3 : t.accent, fontFamily: t.sans, fontSize: 11, fontWeight: 600,
              cursor: hasEventTraining ? 'not-allowed' : 'pointer',
              opacity: hasEventTraining ? 0.45 : 1,
            }}
          >Customize split content →</button>

          {hasEventTraining && (
            <button
              onClick={() => updateProfile('hasEventTraining', false)}
              style={{
                width: '100%', marginTop: 10, padding: '9px', borderRadius: 10,
                background: 'transparent', border: `1px solid ${t.border}`,
                color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Switch to training days instead →</button>
          )}
        </Section>

        {/* Onboarding-generated schedule reset — undoes the gym split /
            activity schedule that onboarding (or a redo) generated, without
            touching an uploaded or AI-generated event training plan, or any
            logged history. */}
        {typeof onResetOnboardingSchedule === 'function' && (hasGeneratedSchedule || resetDone) && (
          <Section title="Onboarding data" theme={theme}>
            <div style={{ fontSize: 11, color: t.text2, marginBottom: 10, lineHeight: 1.5 }}>
              Remove the gym split and weekly activity schedule Forma generated for you from onboarding.
              This does <strong>not</strong> touch an uploaded or AI-generated race training plan, and does
              not delete any other account data (logged sessions, food log, custom foods).
            </div>
            {resetDone ? (
              <div style={{
                padding: '9px 12px', borderRadius: 10,
                background: '#16A34A12', border: '1px solid #16A34A30',
                fontSize: 11.5, color: '#15803D',
              }}>
                Generated schedule removed. Your uploaded/generated race plan and other data are untouched.
              </div>
            ) : resetConfirming ? (
              <div style={{
                padding: '10px 12px', borderRadius: 10,
                background: '#DC262612', border: '1px solid #DC262635',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>
                  Remove your generated schedule?
                </div>
                <div style={{ fontSize: 11, color: t.text2, lineHeight: 1.5, marginBottom: 10 }}>
                  This clears the gym split and any weekday activities onboarding added, and resets your
                  saved goal. Your uploaded/generated event training plan, logged sessions, food log, and
                  custom foods are not affected.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setResetConfirming(false)} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    background: 'transparent', border: `1px solid ${t.border}`,
                    color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>Cancel</button>
                  <button onClick={handleResetSchedule} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    background: '#DC2626', border: 'none',
                    color: '#fff', fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>Remove schedule</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setResetConfirming(true)}
                style={{
                  width: '100%', padding: '9px', borderRadius: 10,
                  background: 'transparent', border: `1px solid ${t.border}`,
                  color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Remove app-generated schedule
              </button>
            )}
          </Section>
        )}

        {/* Google Sheets sync */}
        <Section title="Data sync" theme={theme}>
          <div style={{ fontSize: 11, color: t.text2, marginBottom: 12, lineHeight: 1.5 }}>
            Connect Google Sheets to back up your data to your Google Drive and keep it safe across devices.
          </div>

          {/* Status row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0', borderBottom: `1px solid ${t.border}`,
          }}>
            {/* Google Sheets icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: sheetsStatus === 'connected' ? '#1A73E8' : (theme === 'dark' ? t.surface2 : '#F5F3EF'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="2" width="16" height="20" rx="2" fill={sheetsStatus === 'connected' ? '#fff' : '#34A853'} fillOpacity={sheetsStatus === 'connected' ? 1 : 0.9} />
                <rect x="7" y="8"  width="10" height="1.5" rx="0.75" fill={sheetsStatus === 'connected' ? '#1A73E8' : '#fff'} />
                <rect x="7" y="11" width="10" height="1.5" rx="0.75" fill={sheetsStatus === 'connected' ? '#1A73E8' : '#fff'} />
                <rect x="7" y="14" width="7"  height="1.5" rx="0.75" fill={sheetsStatus === 'connected' ? '#1A73E8' : '#fff'} />
              </svg>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>Google Sheets</div>
              <div style={{ fontSize: 10.5, color: t.text3 }}>
                {sheetsStatus === 'connected'       && 'Syncing to Google Drive'}
                {sheetsStatus === 'disconnected'    && 'Not connected'}
                {sheetsStatus === 'needs-reconnect' && 'Session expired — reconnect to resume'}
                {sheetsStatus === 'connecting'      && 'Connecting…'}
              </div>
            </div>

            {sheetsStatus === 'disconnected' && onConnectSheets && (
              <button onClick={onConnectSheets} style={{
                padding: '5px 12px', borderRadius: 8,
                background: t.accent + '15', color: t.accent,
                border: `1px solid ${t.accent + '30'}`,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
              }}>Connect</button>
            )}
            {sheetsStatus === 'needs-reconnect' && onReconnectSheets && (
              <button onClick={onReconnectSheets} style={{
                padding: '5px 12px', borderRadius: 8,
                background: '#F59E0B15', color: '#D97706',
                border: '1px solid #F59E0B30',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
              }}>Reconnect</button>
            )}
            {sheetsStatus === 'connected' && onDisconnectSheets && (
              <button onClick={onDisconnectSheets} style={{
                padding: '5px 12px', borderRadius: 8,
                background: '#BE3B2E15', color: '#BE3B2E',
                border: '1px solid #BE3B2E30',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
              }}>Disconnect</button>
            )}
            {sheetsStatus === 'connecting' && (
              <div style={{
                width: 18, height: 18, border: `2px solid ${t.accent}`,
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
            )}
          </div>

          {sheetsError && sheetsStatus !== 'connected' && (
            <div style={{
              marginTop: 8, padding: '8px 10px', borderRadius: 8,
              background: '#BE3B2E15', border: '1px solid #BE3B2E30',
              fontSize: 11, color: '#BE3B2E', lineHeight: 1.5,
            }}>
              {sheetsError}
            </div>
          )}

          {sheetsStatus === 'connected' && sheetUrl && (
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: `1px solid ${t.border}`,
              textDecoration: 'none',
            }}>
              <div>
                <div style={{ fontSize: 12, color: t.accent, fontWeight: 500 }}>Open in Google Sheets</div>
                <div style={{
                  fontSize: 10, color: t.text3, marginTop: 1,
                  maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {sheetUrl}
                </div>
              </div>
              <span style={{ fontSize: 14, color: t.accent }}>↗</span>
            </a>
          )}

          <div style={{ padding: '10px 0 2px', fontSize: 11, color: t.text3, lineHeight: 1.6 }}>
            {sheetsStatus === 'connected'
              ? 'Saved to 6 tabs: Profile · Sessions · Food Log · Custom Foods · Settings · Backup.'
              : 'Without sync, data is stored only in this browser and will be lost if you clear your cache.'}
          </div>
        </Section>

        {/* Training goal — read-only summary of the real Stage 2 goals
            (see GoalsSetupScreen.jsx). Edited via "Redo my goals &
            questionnaire" in Training plan above, not here — this used to be
            a second, disconnected picker writing to the legacy profile.goal
            field, which drifted out of sync with the real goals array. */}
        <Section title="Training goal" theme={theme}>
          {realGoals.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {realGoals.map((g, i) => {
                const meta = GOAL_TYPES.find(gt => gt.id === g.type);
                return (
                  <div key={`${g.type}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 10, background: t.surface2, border: `1px solid ${t.border}`,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, background: t.surface,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0,
                    }}>{meta?.icon || '🎯'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
                        {meta?.label || g.type}
                      </div>
                      {meta?.sub && (
                        <div style={{ fontSize: 10.5, color: t.text3 }}>{meta.sub}</div>
                      )}
                    </div>
                    {realGoals.length > 1 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: t.text3,
                        background: t.surface, border: `1px solid ${t.border}`,
                        borderRadius: 5, padding: '2px 7px', flexShrink: 0,
                      }}>{g.rank || RANK_LABELS[i] || 'Supporting'}</span>
                    )}
                  </div>
                );
              })}
              <div style={{ fontSize: 10.5, color: t.text3, marginTop: 2 }}>
                To change your goals, use "Redo my goals & questionnaire" above.
              </div>
            </div>
          ) : hasEventTraining ? (
            // Uploading a training plan sets hasEventTraining directly and
            // never touches goalsPayload.goals (that's Stage 2's own,
            // separate flow) — so a plan-only user genuinely has no
            // `realGoals` entry. Say so explicitly instead of showing the
            // generic "no goals" copy, and point at Goal paces below, which
            // works the same way for these users as it does for anyone who
            // completed the questionnaire.
            <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.5 }}>
              No goal type set — you're training from an uploaded plan instead. Add your goal paces below, or use "Redo my goals & questionnaire" above to set one.
            </div>
          ) : (
            <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.5 }}>
              No goals set yet — complete your profile to unlock a personalised plan.
            </div>
          )}
        </Section>

        {/* Goal paces — feeds the Analytics screen's "Goal pace" bubble.
            Read-only once a discipline's target pace is confirmed via the
            questionnaire; otherwise editable here so users who only upload
            their own training plan (and never do Stage 3) can still set one. */}
        <Section title="Goal paces" theme={theme}>
          <div>
            {GOAL_PACE_ROWS.map(({ type, discipline, label }) => (
              <GoalPaceRow key={type} theme={theme} label={label} unit={paceUnitForType(type)}
                confirmedValue={getGoalPaceValue(type, { eventRaceConfig })}
                manualValue={getGoalPaceValue(type, { manualGoalPaces })}
                onSave={(value) => setManualGoalPace(discipline, value)} />
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: t.text3, marginTop: 8, lineHeight: 1.5 }}>
            Set automatically once you confirm pace targets in the questionnaire — add your own here if you're only uploading a training plan.
          </div>
        </Section>

        <FeedbackSection theme={theme} userId={userId} />

        {/* App info + sign out */}
        <div style={{
          textAlign: 'center', padding: '8px 0 16px',
          fontSize: 10.5, color: t.text3, lineHeight: 1.6,
        }}>
          Forma · v2.0 · {sheetsStatus === 'connected' ? 'Syncing to Google Drive' : 'Data stored locally on this device'}
        </div>

        {onSignOut && (
          <button onClick={onSignOut} style={{
            width: '100%', padding: '13px 0', borderRadius: 14,
            background: 'transparent',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}`,
            color: '#BE3B2E', fontFamily: t.sans, fontSize: 14, fontWeight: 500,
            cursor: 'pointer', marginBottom: 8,
          }}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}


export { FieldRow, Section, AboutScreen };
