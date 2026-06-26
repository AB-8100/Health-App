import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { checkWeek } from '../utils/overtrain';
import themes from '../data/themes';
import { BottomNav } from '../components/SharedUI';
import { EVENT_PLAN, getCurrentPlanWeek, getPlanWeekStart } from '../data/eventPlan';
import { SPLITS } from './GymPlanScreens';

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Display properties keyed by activity type.
// Covers all types selectable during onboarding + event disciplines.
// emoji/color are display-only (not stored in Supabase); extend from ref_activities
// at runtime once the table is seeded.
const SESSION_DISPLAY = {
  swim:         { label: 'Swim',    emoji: '🏊', color: '#0369A1' },
  run:          { label: 'Run',     emoji: '🏃', color: '#0090FF' },
  cycle:        { label: 'Cycle',   emoji: '🚴', color: '#9333EA' },
  bike:         { label: 'Bike',    emoji: '🚴', color: '#D97706' },
  gym:          { label: 'Gym',     emoji: '🏋️', color: '#4F46E5' },
  yoga:         { label: 'Yoga',    emoji: '🧘', color: '#6D4AAF' },
  walk:         { label: 'Walk',    emoji: '🚶', color: '#15803D' },
  row:          { label: 'Row',     emoji: '🚣', color: '#4B5563' },
  hiit:         { label: 'HIIT',    emoji: '⚡', color: '#DC2626' },
  pilates:      { label: 'Pilates', emoji: '🤸', color: '#7C3AED' },
  climb:        { label: 'Climb',   emoji: '🧗', color: '#854D0E' },
  dance:        { label: 'Dancing', emoji: '💃', color: '#EC4899' },
  brick:        { label: 'Brick',   emoji: '🔥', color: '#9333EA' },
  conditioning: { label: 'Cond',    emoji: '💪', color: '#0D9488' },
  rest:         { label: 'Rest',    emoji: '😴', color: '#9CA3AF' },
  other:        { label: 'Other',   emoji: '⚡', color: '#4B5563' },
};

// Resolve display for a session. Prefers the activity's own data (spread from
// ACTIVITY_DEFS in App.jsx), then falls back to SESSION_DISPLAY keyed by type.
function getSessionDisplay(actData, type) {
  if (actData?.label && actData?.emoji && actData?.color) {
    return { label: actData.label, emoji: actData.emoji, color: actData.color };
  }
  return SESSION_DISPLAY[type] || SESSION_DISPLAY.other;
}

function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

function buildWeekData(viewWeek, plan, activities, eventOverrides, hasGym, hasEventTraining) {
  const weekStart = getPlanWeekStart(viewWeek);
  const todayKey  = toDateKey(new Date());

  const split    = hasGym && plan.splitDays ? SPLITS[plan.splitDays] : null;
  const splitIds = new Set((split?.days || []).map(d => d.id));
  const overrideValid = plan.scheduleOverride?.every(s => s === '—' || splitIds.has(s));
  const gymSched = (overrideValid ? plan.scheduleOverride : null) || split?.schedule || [];

  return Array.from({ length: 7 }, (_, i) => {
    const d  = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dk = toDateKey(d);
    const sessions = [];

    // Gym session for this day
    if (split && gymSched[i] && gymSched[i] !== '—') {
      const dayId = gymSched[i];
      const def   = plan.overrides?.[dayId] || split.days.find(dd => dd.id === dayId);
      if (def) {
        sessions.push({
          id: `gym-${dk}`,
          type: 'gym',
          label: def.name,
          detail: def.muscles || '',
          source: 'gym',
          gymDayId: dayId,
          dayIdx: i,
        });
      }
    }

    // Event plan sessions
    if (hasEventTraining) {
      const raw = Object.prototype.hasOwnProperty.call(eventOverrides, dk)
        ? eventOverrides[dk]
        : (EVENT_PLAN[dk] || []).filter(s => s.type !== 'rest');
      raw.forEach((s, si) => {
        const type = (s.type || 'conditioning').toLowerCase();
        sessions.push({
          id: `event-${dk}-${si}`,
          type: SESSION_DISPLAY[type] ? type : 'conditioning',
          label: s.label || type,
          detail: [s.sessionType, s.duration].filter(Boolean).join(' · '),
          source: 'event_plan',
          raw: s,
          dayIdx: i,
        });
      });
    }

    // User-added activities
    (activities[i] || []).forEach(act => {
      sessions.push({
        id: act.id || `act-${dk}-${act.label}`,
        type: act.type || 'other',
        label: act.label || act.type || '',
        detail: act.duration ? `${act.duration}min` : '',
        source: 'activity',
        actData: act,
        dayIdx: i,
      });
    });

    return { d, dk, sessions, isToday: dk === todayKey, dayIdx: i };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseBar({ phases, totalWeeks, viewWeek, t }) {
  const phase = phases.find(ph => viewWeek >= ph.weeks[0] && viewWeek <= ph.weeks[1]) || phases[0];
  if (!phase) return null;
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14,
      padding: '11px 14px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 9.5, fontWeight: 700, color: phase.color, letterSpacing: '.1em',
            textTransform: 'uppercase', background: phase.color + '18',
            border: `1px solid ${phase.color}30`, borderRadius: 5, padding: '2px 7px',
          }}>{phase.label}</span>
          <span style={{ fontSize: 10.5, color: t.text2 }}>Wks {phase.weeks[0]}–{phase.weeks[1]}</span>
        </div>
        <span style={{ fontSize: 10.5, color: t.text3 }}>Wk {viewWeek} / {totalWeeks}</span>
      </div>
      <div style={{ display: 'flex', gap: 2, height: 5, borderRadius: 99, overflow: 'hidden' }}>
        {phases.map(ph => {
          const w = ((ph.weeks[1] - ph.weeks[0] + 1) / totalWeeks) * 100;
          const isActive = ph.label === phase.label;
          const filled = isActive
            ? ((viewWeek - ph.weeks[0]) / (ph.weeks[1] - ph.weeks[0] + 1)) * w
            : viewWeek > ph.weeks[1] ? w : 0;
          return (
            <div key={ph.label} style={{ width: `${w}%`, height: '100%', borderRadius: 99, background: ph.color + '25', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(filled / w) * 100}%`, background: ph.color, borderRadius: 99, transition: 'width .5s ease' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
        {phases.map(ph => {
          const w = ((ph.weeks[1] - ph.weeks[0] + 1) / totalWeeks) * 100;
          const isActive = ph.label === phase.label;
          return (
            <div key={ph.label} style={{ width: `${w}%`, fontSize: 8, color: isActive ? ph.color : t.text3, fontWeight: isActive ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {ph.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalsPanel({ goals, isDraft, t, expanded, onToggle }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 2 }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Goals</span>
          <span style={{
            fontSize: 9.5, fontWeight: 700, color: t.text3, background: t.surface2,
            border: `1px solid ${t.border}`, borderRadius: 4, padding: '1px 6px',
          }}>{goals.length}</span>
          {isDraft && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: '#D97706', background: '#D9770618',
              border: '1px solid #D9770630', borderRadius: 4, padding: '1px 6px', letterSpacing: '.05em',
            }}>DRAFT</span>
          )}
        </div>
        <span style={{ fontSize: 14, color: t.text3, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>⌄</span>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: '8px 14px 12px' }}>
          {goals.map((goal, i) => {
            const tier = TIER_META[goal.demandTier] || TIER_META.Plan;
            return (
              <div key={goal.id} style={{ marginTop: i === 0 ? 0 : 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: tier.color, background: tier.color + '18',
                        border: `1px solid ${tier.color}30`, borderRadius: 4, padding: '1px 5px',
                        letterSpacing: '.05em', flexShrink: 0,
                      }}>{tier.label.toUpperCase()}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: t.text, lineHeight: 1.2 }}>{goal.title}</span>
                    </div>
                    {goal.subtitle && (
                      <div style={{ fontSize: 10.5, color: t.text3, marginTop: 2 }}>{goal.subtitle}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: tier.color, flexShrink: 0 }}>{goal.completion}%</span>
                </div>
                <div style={{ height: 4, background: t.border, borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${goal.completion}%`,
                    background: tier.color, borderRadius: 99, transition: 'width .6s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SessionBar({ session, isDragging }) {
  const { color, emoji, label: displayLabel } = getSessionDisplay(session.actData, session.type);
  const label  = session.label || displayLabel;
  const detail = session.detail;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      background: isDragging ? color + '28' : color + '14',
      border: `1px solid ${color}${isDragging ? '55' : '28'}`,
      borderRadius: 9, padding: '6px 10px',
      width: '100%', boxSizing: 'border-box',
      boxShadow: isDragging ? `0 3px 10px ${color}35` : 'none',
      transform: isDragging ? 'scale(1.02)' : 'none',
      transition: 'box-shadow .1s, transform .1s',
      cursor: 'grab', userSelect: 'none',
    }}>
      <span style={{ fontSize: 13, flexShrink: 0 }}>{emoji}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color, flex: 1, minWidth: 0 }}>{label}</span>
      {detail && <span style={{ fontSize: 10, color: color + 'BB', flexShrink: 0 }}>{detail}</span>}
    </div>
  );
}

function WarningChip({ text }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: '#DC262612', border: '1px solid #DC262630',
      borderRadius: 6, padding: '2px 6px', flexShrink: 0,
    }}>
      <span style={{ fontSize: 9 }}>⚠️</span>
      <span style={{ fontSize: 9.5, fontWeight: 600, color: '#DC2626' }}>{text}</span>
    </div>
  );
}

function DayRow({ d, dk, sessions, isToday, dayIdx, warnings, i, t, onClick }) {
  return (
    <div
      style={{
        borderTop: i > 0 ? `1px solid ${t.border}` : 'none',
        background: isToday ? t.accent + '07' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {/* Day label */}
        <button
          onClick={onClick}
          style={{
            width: 48, flexShrink: 0, paddingTop: 9, paddingBottom: 8,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.06em', color: isToday ? t.accent : t.text3, textTransform: 'uppercase' }}>
            {DAY_SHORT[i]}
          </div>
          <div style={{ fontSize: 14, fontWeight: isToday ? 700 : 400, color: isToday ? t.accent : t.text, lineHeight: 1.2 }}>
            {d.getDate()}
          </div>
          <div style={{ fontSize: 8.5, color: t.text3 }}>
            {d.toLocaleDateString('en-GB', { month: 'short' })}
          </div>
        </button>

        {/* Sessions droppable area */}
        <Droppable droppableId={dk} direction="vertical">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              onClick={onClick}
              style={{
                flex: 1, borderLeft: `1px solid ${t.border}`,
                paddingLeft: 10, paddingTop: 8, paddingBottom: warnings.length ? 4 : 8, paddingRight: 8,
                display: 'flex', flexDirection: 'column', gap: 5, cursor: 'pointer',
                minHeight: 44,
                background: snapshot.isDraggingOver ? t.accent + '08' : 'transparent',
                transition: 'background .15s',
              }}
            >
              {/* Sessions — full-width bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                {sessions.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.4 }}>
                    <span style={{ fontSize: 11 }}>😴</span>
                    <span style={{ fontSize: 10.5, color: t.text3 }}>Rest</span>
                  </div>
                ) : (
                  sessions.map((sess, idx) => (
                    <Draggable key={sess.id} draggableId={sess.id} index={idx}>
                      {(prov, snap) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          {...prov.dragHandleProps}
                          onClick={e => e.stopPropagation()}
                          style={{ ...prov.draggableProps.style, width: '100%' }}
                        >
                          <SessionBar session={sess} isDragging={snap.isDragging} />
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>

              {/* Overtrain warnings */}
              {warnings.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {warnings.map(w => <WarningChip key={w} text={w} />)}
                </div>
              )}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function WeeklyOverviewScreen({
  width = 390, height = 820, theme = 'light',
  onNav, profile = {},
  plan = {}, activities = {},
  tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false,
  eventOverrides = {}, onUpdateOverrides,
  planSessionsDone = {}, onToggleDone,
  eventPhasePlan = { phases: [], totalWeeks: 18 },
  onTapDay,
  onUpdatePlan,
}) {
  const t = themes[theme];

  const initWeek = getCurrentPlanWeek();
  const [viewWeek,      setViewWeek]      = React.useState(initWeek);
  const [weekData,      setWeekData]      = React.useState(() =>
    buildWeekData(initWeek, plan, activities, eventOverrides, hasGym, hasEventTraining)
  );
  const [warnings,      setWarnings]      = React.useState({});

  const { phases, totalWeeks } = eventPhasePlan;

  React.useEffect(() => {
    setWeekData(buildWeekData(viewWeek, plan, activities, eventOverrides, hasGym, hasEventTraining));
  }, [viewWeek, plan, activities, eventOverrides, hasGym, hasEventTraining]);

  // Week date range label
  const weekStart = getPlanWeekStart(viewWeek);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const fmt       = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const weekLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}`;

  // ── DnD ────────────────────────────────────────────────────────────────────
  const handleDragEnd = React.useCallback((result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newWeekData = weekData.map(row => ({ ...row, sessions: [...row.sessions] }));
    const srcRow = newWeekData.find(r => r.dk === source.droppableId);
    const dstRow = newWeekData.find(r => r.dk === destination.droppableId);
    if (!srcRow || !dstRow) return;

    const [moved] = srcRow.sessions.splice(source.index, 1);
    dstRow.sessions.splice(destination.index, 0, { ...moved, dayIdx: dstRow.dayIdx });

    setWeekData(newWeekData);

    // Async overtrain check across the full updated week
    const weekArray = newWeekData.map(row => ({
      day:        DAY_SHORT[row.dayIdx],
      date:       row.dk,
      activities: row.sessions.map(s => ({
        name:      s.label || s.type || '',
        intensity: s.intensity || 'medium',
        duration:  s.actData?.duration,
      })),
    }));
    checkWeek(weekArray).then(conflicts => {
      const built = {};
      conflicts.forEach(c => {
        if (c.day === 'week') return;
        const row = newWeekData.find(r => DAY_SHORT[r.dayIdx] === c.day);
        if (row) {
          if (!built[row.dk]) built[row.dk] = [];
          built[row.dk].push(c.message);
        }
      });
      setWarnings(built);
    });

    // Persist event plan session moves
    if (moved.source === 'event_plan' && onUpdateOverrides) {
      const newOverrides = { ...eventOverrides };
      [srcRow, dstRow].forEach(row => {
        newOverrides[row.dk] = row.sessions
          .filter(s => s.source === 'event_plan')
          .map(s => s.raw);
      });
      onUpdateOverrides(newOverrides);
    }

    // Persist gym session moves (swap schedule slots)
    if (moved.source === 'gym' && plan.splitDays) {
      const split = SPLITS[plan.splitDays];
      if (split) {
        const splitIds = new Set(split.days.map(d => d.id));
        const overrideValid = plan.scheduleOverride?.every(s => s === '—' || splitIds.has(s));
        const sched = [...((overrideValid ? plan.scheduleOverride : null) || split.schedule)];
        const tmp = sched[srcRow.dayIdx];
        sched[srcRow.dayIdx] = sched[dstRow.dayIdx];
        sched[dstRow.dayIdx] = tmp;
        onUpdatePlan?.(sched);
      }
    }
  }, [weekData, eventOverrides, plan, onUpdatePlan]);

  const isDraft = !profile?.goal;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width, height, background: t.bg, fontFamily: t.sans, color: t.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      {/* Status bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 22px 8px', fontSize: 14, fontWeight: 600, flexShrink: 0,
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: '0 20px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: t.text3, marginBottom: 2 }}>
              {hasEventTraining ? `Event Training · Wk ${viewWeek}` : 'Your week at a glance'}
            </div>
            <div style={{ fontFamily: t.serif, fontSize: 26, lineHeight: 1, color: t.text }}>
              Weekly Overview
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }} className="phone-scroll">

        {/* Phase bar — event training only */}
        {hasEventTraining && phases.length > 0 && (
          <PhaseBar phases={phases} totalWeeks={totalWeeks} viewWeek={viewWeek} t={t} />
        )}

        {/* Week navigator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 10 }}>
          <button
            onClick={() => setViewWeek(w => Math.max(1, w - 1))}
            disabled={viewWeek === 1}
            style={{
              width: 34, height: 34, borderRadius: 9, background: 'transparent',
              border: `1px solid ${t.border}`, color: viewWeek === 1 ? t.text3 : t.text,
              fontSize: 16, cursor: viewWeek === 1 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: viewWeek === 1 ? 0.3 : 1,
            }}
          >‹</button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Week {viewWeek}</div>
            <div style={{ fontSize: 10, color: t.text3 }}>{weekLabel}</div>
            {viewWeek !== initWeek && (
              <button
                onClick={() => setViewWeek(initWeek)}
                style={{
                  marginTop: 4, padding: '2px 9px', borderRadius: 6,
                  background: t.accent + '16', border: `1px solid ${t.accent}35`,
                  color: t.accent, fontFamily: t.sans, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                }}
              >↩ Wk {initWeek} (now)</button>
            )}
          </div>

          <button
            onClick={() => setViewWeek(w => Math.min(totalWeeks || 52, w + 1))}
            disabled={viewWeek === (totalWeeks || 52)}
            style={{
              width: 34, height: 34, borderRadius: 9, background: 'transparent',
              border: `1px solid ${t.border}`, color: viewWeek === (totalWeeks || 52) ? t.text3 : t.text,
              fontSize: 16, cursor: viewWeek === (totalWeeks || 52) ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: viewWeek === (totalWeeks || 52) ? 0.3 : 1,
            }}
          >›</button>
        </div>

        {/* 7-day strip */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: 16, overflow: 'hidden',
          }}>
            {weekData.map((day, i) => (
              <DayRow
                key={day.dk}
                {...day}
                i={i}
                warnings={warnings[day.dk] || []}
                t={t}
                onClick={() => onTapDay?.(day.dayIdx)}
              />
            ))}
          </div>
        </DragDropContext>

        {/* Drag hint */}
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: t.text3 }}>
          Drag session chips to reschedule · Tap a day for details
        </div>

      </div>

      <BottomNav
        theme={theme} active="weekly" onNav={onNav}
        tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
      />
    </div>
  );
}
