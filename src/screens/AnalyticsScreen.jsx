import React from 'react';
import themes from '../data/themes';
import { BottomNav } from '../components/SharedUI';
import {
  getActivityOptions, getPaceSeries, paceUnitForType, formatPaceValue,
  getExerciseOptionsForActivity, getRepsSeries,
  getAverageValue, getPaceTrackStatus, getGoalPaceValue,
} from '../utils/analytics';

// [COMPONENT] Hand-rolled inline-SVG line chart — matches the existing
// Sparkline (components/SharedUI.jsx) / BarSpark (screens/HomeScreen.jsx)
// pattern rather than pulling in a charting dependency (see
// features/specs/analytics-home-pace-reps.md).
function LineChart({ points, color, theme, formatValue, width, height = 180 }) {
  const t = themes[theme];
  const padX = 8, padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padX + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = padY + innerH - ((p.value - min) / range) * innerH;
    return { x, y, p };
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {[0, 0.5, 1].map(frac => (
        <line key={frac} x1={padX} x2={width - padX} y1={padY + innerH * frac} y2={padY + innerH * frac}
              stroke={t.border} strokeWidth={1} />
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={points[i].id || i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4 : 3} fill={color} />
      ))}
      <text x={padX} y={12} fontSize={10} fill={t.text3} fontFamily={t.mono}>{formatValue(max)}</text>
      <text x={padX} y={height - 4} fontSize={10} fill={t.text3} fontFamily={t.mono}>{formatValue(min)}</text>
    </svg>
  );
}

function EmptyState({ theme, title, body }) {
  const t = themes[theme];
  return (
    <div style={{
      padding: '32px 20px', textAlign: 'center', color: t.text2,
      border: `1px solid ${t.border}`, borderRadius: 14, background: t.surface,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

// [COMPONENT] A single stat pill in the average/goal/on-track row above the
// pace chart. `accent` overrides the value colour (used for the on-track
// flag); `onClick` makes the whole bubble tappable (goal pace editing).
function StatBubble({ theme, label, value, sub, accent, onClick }) {
  const t = themes[theme];
  return (
    <div onClick={onClick} style={{
      flex: 1, minWidth: 0, padding: '12px 12px', borderRadius: 14,
      border: `1px solid ${t.border}`, background: t.surface,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 10, color: t.text3, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: t.sans, color: accent || t.text, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: t.text3, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// [COMPONENT] Goal pace bubble — shows the pace/split the user confirmed for
// this discipline on their race goal in Stage 3 onboarding (getGoalPaceValue,
// backed by utils/raceTargets.js). Goal pace is never entered here: if the
// discipline has no confirmed target yet, this links out to the
// questionnaire's "confirm pace targets" step instead of taking free text.
function GoalPaceBubble({ theme, goalValue, paceUnit, hasDiscipline, onStartQuestionnaire }) {
  const t = themes[theme];

  if (goalValue != null) {
    return <StatBubble theme={theme} label="Goal pace" value={formatPaceValue(goalValue, paceUnit)} />;
  }

  if (!hasDiscipline) {
    return <StatBubble theme={theme} label="Goal pace" value="—" sub="not tracked for this activity" />;
  }

  return (
    <div style={{
      flex: 1, minWidth: 0, padding: '12px 12px', borderRadius: 14,
      border: `1px solid ${t.border}`, background: t.surface,
    }}>
      <div style={{ fontSize: 10, color: t.text3, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>
        Goal pace
      </div>
      <div style={{ fontSize: 13, color: t.text2, marginBottom: 6, lineHeight: 1.3 }}>Not set</div>
      <button data-testid="goal-pace-questionnaire-cta" onClick={onStartQuestionnaire} style={{
        border: 'none', background: 'none', padding: 0, cursor: 'pointer',
        color: t.accent, fontFamily: t.sans, fontSize: 11, fontWeight: 600,
      }}>
        Set in questionnaire →
      </button>
    </div>
  );
}

function AnalyticsScreen({
  width = 390, height = 820, theme = 'light',
  completedSessions = [], onNav,
  tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false,
  goalsPayload = null, onStartQuestionnaire = () => {},
}) {
  const t = themes[theme];

  // [STATE] Which logged activity (and, for reps activities, which exercise
  // within it) the chart is currently showing.
  const [activityId, setActivityId] = React.useState(null);
  const [exerciseId, setExerciseId] = React.useState(null);

  // [DATA] Everything below is derived straight from completedSessions —
  // nothing here is fetched or persisted independently.
  const activityOptions = React.useMemo(() => getActivityOptions(completedSessions), [completedSessions]);

  const selectedActivity = React.useMemo(
    () => activityOptions.find(a => a.id === activityId) || activityOptions[0] || null,
    [activityOptions, activityId]
  );

  const exerciseOptions = React.useMemo(() => {
    if (!selectedActivity || selectedActivity.metric !== 'reps') return [];
    return getExerciseOptionsForActivity(completedSessions, selectedActivity.id);
  }, [completedSessions, selectedActivity]);

  const selectedExercise = React.useMemo(
    () => exerciseOptions.find(e => e.id === exerciseId) || exerciseOptions[0] || null,
    [exerciseOptions, exerciseId]
  );

  const paceUnit = selectedActivity?.metric === 'pace' ? paceUnitForType(selectedActivity.type) : null;

  const series = React.useMemo(() => {
    if (!selectedActivity) return [];
    if (selectedActivity.metric === 'pace') return getPaceSeries(completedSessions, selectedActivity.type);
    if (selectedActivity.metric === 'reps' && selectedExercise) {
      return getRepsSeries(completedSessions, selectedActivity.id, selectedExercise.id);
    }
    return [];
  }, [completedSessions, selectedActivity, selectedExercise]);

  const chartWidth = width - 36;
  const formatValue = selectedActivity?.metric === 'pace'
    ? (v) => formatPaceValue(v, paceUnit)
    : (v) => `${Math.round(v)} reps`;

  // [DATA] Average/goal/on-track bubbles are pace-only (the request scopes
  // them to "the paces" graph, not the reps chart). Goal pace is sourced
  // from the target time/split the user confirmed on their event_race goal
  // in Stage 3 onboarding — never re-entered here (see GoalPaceBubble).
  const eventRaceConfig = React.useMemo(
    () => goalsPayload?.goals?.find(g => g.type === 'event_race')?.config || null,
    [goalsPayload]
  );
  const hasDiscipline = selectedActivity?.metric === 'pace'
    && ['run', 'swim', 'cycle', 'bike'].includes(selectedActivity.type);
  const averagePace = selectedActivity?.metric === 'pace' ? getAverageValue(series) : null;
  const goalPace = hasDiscipline ? getGoalPaceValue(selectedActivity.type, eventRaceConfig) : null;
  const onTrack = getPaceTrackStatus(averagePace, goalPace, paceUnit);

  const chipStyle = (active) => ({
    padding: '8px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
    fontFamily: t.sans, cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${active ? t.accent : t.border}`,
    background: active ? t.accentSoft : t.surface,
    color: active ? t.accent : t.text2,
  });

  return (
    <div data-testid="analytics-screen" style={{
      width, height, background: t.bg, fontFamily: t.sans, color: t.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      {/* Status bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 22px 8px', fontSize: 14, fontWeight: 600, color: t.text, flexShrink: 0,
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: '2px 18px 12px', flexShrink: 0 }}>
        <div style={{ fontFamily: t.serif, fontSize: 24, color: t.text }}>Analytics</div>
        <div style={{ fontSize: 12.5, color: t.text2, marginTop: 2 }}>
          Pace and reps over time, from your logged sessions.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 16px' }} className="phone-scroll">
        {activityOptions.length === 0 ? (
          <EmptyState theme={theme}
            title="No sessions logged yet"
            body="Log a run, swim, ride or gym session and it'll show up here as a trend over time." />
        ) : (
          <>
            {/* Activity picker */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
              {activityOptions.map(opt => (
                <button key={opt.id} data-testid={`activity-option-${opt.id}`}
                  onClick={() => { setActivityId(opt.id); setExerciseId(null); }}
                  style={chipStyle(opt.id === selectedActivity?.id)}>
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>

            {selectedActivity?.metric === 'reps' && exerciseOptions.length > 0 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
                {exerciseOptions.map(ex => (
                  <button key={ex.id} data-testid={`exercise-option-${ex.id}`}
                    onClick={() => setExerciseId(ex.id)}
                    style={chipStyle(ex.id === selectedExercise?.id)}>
                    {ex.name}
                  </button>
                ))}
              </div>
            )}

            {series.length === 0 ? (
              <EmptyState theme={theme}
                title={`Not enough data for ${selectedActivity.label}`}
                body="Log another session with a completed distance or exercise sets to build a trend." />
            ) : (
              <>
                {selectedActivity.metric === 'pace' && (
                  <div data-testid="pace-stat-bubbles" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <StatBubble theme={theme} label="Average pace" value={formatPaceValue(averagePace, paceUnit)} />
                    <GoalPaceBubble theme={theme} goalValue={goalPace} paceUnit={paceUnit}
                      hasDiscipline={hasDiscipline} onStartQuestionnaire={onStartQuestionnaire} />
                    <StatBubble theme={theme} label="On track"
                      value={onTrack == null ? '—' : (onTrack ? 'On track' : 'Off pace')}
                      accent={onTrack == null ? t.text3 : (onTrack ? t.green : t.rose)}
                      sub={goalPace == null ? (hasDiscipline ? 'no goal pace confirmed yet' : 'no goal tracked') : undefined} />
                  </div>
                )}
                <div data-testid="analytics-chart" style={{
                  border: `1px solid ${t.border}`, borderRadius: 14, background: t.surface,
                  padding: '16px 14px',
                }}>
                  <div style={{ fontSize: 11, color: t.text3, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 10 }}>
                    {selectedActivity.metric === 'pace'
                      ? `${selectedActivity.label} pace`
                      : `${selectedExercise?.name || ''} reps`}
                  </div>
                  <LineChart points={series} color={selectedActivity.color} theme={theme}
                    formatValue={formatValue} width={chartWidth} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: t.text3 }}>
                    <span>{new Date(series[0].date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</span>
                    <span>{new Date(series[series.length - 1].date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div style={{ marginTop: 14, fontSize: 22, fontFamily: t.serif, color: t.text }}>
                    {formatValue(series[series.length - 1].value)}
                    <span style={{ fontSize: 12, color: t.text3, fontFamily: t.sans, marginLeft: 8 }}>most recent</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <BottomNav theme={theme} active="analytics" onNav={onNav} tracksCycle={tracksCycle}
        hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities} />
    </div>
  );
}

export { AnalyticsScreen };
