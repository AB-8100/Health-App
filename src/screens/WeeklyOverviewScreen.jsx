import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import themes from '../data/themes';
import { BottomNav } from '../components/SharedUI';
import {
  TRIATHLON_PLAN, DISCIPLINE_DISPLAY,
  getCurrentTriathlonWeek, getTriathlonWeekStart,
} from '../data/triathlonPlan';
import { SPLITS } from './GymPlanScreens';
import { FORMA_GOALS, TIER_META } from '../data/formaGoals';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_WEEKS = 18;
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PHASES = [
  { label: 'Foundation', weeks: [1, 6],  color: '#15803D' },
  { label: 'Build',      weeks: [7, 14], color: '#0369A1' },
  { label: 'Peak',       weeks: [15, 17], color: '#9333EA' },
  { label: 'Taper',      weeks: [18, 18], color: '#DC2626' },
];

const DISC_COLOR = {
  swim:         '#0369A1',
  bike:         '#D97706',
  run:          '#E8602C',
  brick:        '#9333EA',
  conditioning: '#0D9488',
  gym:          '#4F46E5',
  rest:         '#9CA3AF',
};

const DISC_EMOJI = {
  swim: '🏊', bike: '🚴', run: '🏃', brick: '🔥',
  conditioning: '💪', gym: '🏋️', rest: '😴',
};

const DISC_LABEL = {
  swim: 'Swim', bike: 'Bike', run: 'Run', brick: 'Brick',
  conditioning: 'Cond', gym: 'Gym', rest: 'Rest',
};

// Load scores: 0=none 1=low 2=med 3=high
const LOAD = {
  cardio: { swim: 2, bike: 3, run: 3, brick: 3, conditioning: 2, gym: 1, rest: 0 },
  leg:    { swim: 1, bike: 3, run: 3, brick: 3, conditioning: 2, gym: 3, rest: 0 },
  upper:  { swim: 2, bike: 0, run: 0, brick: 1, conditioning: 2, gym: 3, rest: 0 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPhase(wk) {
  return PHASES.find(p => wk >= p.weeks[0] && wk <= p.weeks[1]) || PHASES[0];
}

function actTypeToDisc(type) {
  return { swimming: 'swim', cycling: 'bike', running: 'run', gym: 'gym' }[type] || 'conditioning';
}

function checkOvertrain(sessions) {
  const warnings = [];
  let cardio = 0, leg = 0, upper = 0;
  sessions.forEach(s => {
    const d = s.discipline in LOAD.cardio ? s.discipline : 'conditioning';
    cardio += LOAD.cardio[d];
    leg    += LOAD.leg[d];
    upper  += LOAD.upper[d];
  });
  if (cardio >= 5) warnings.push('High cardio load');
  if (leg    >= 5) warnings.push('High leg load');
  if (upper  >= 5) warnings.push('High upper load');
  return warnings;
}

function buildWeekData(viewWeek, plan, activities, triathlonOverrides, hasGym, hasEventTraining) {
  const weekStart = getTriathlonWeekStart(viewWeek);
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
          discipline: 'gym',
          label: def.name,
          detail: def.muscles || '',
          source: 'gym',
          gymDayId: dayId,
          dayIdx: i,
        });
      }
    }

    // Triathlon sessions
    if (hasEventTraining) {
      const raw = Object.prototype.hasOwnProperty.call(triathlonOverrides, dk)
        ? triathlonOverrides[dk]
        : (TRIATHLON_PLAN[dk] || []).filter(s => s.discipline !== 'Rest');
      raw.forEach((s, si) => {
        const disc = (s.discipline || '').toLowerCase().replace(/\s+/g, '_');
        const mapped = disc in DISC_COLOR ? disc : 'conditioning';
        sessions.push({
          id: `tri-${dk}-${si}`,
          discipline: mapped,
          label: s.discipline || mapped,
          detail: [s.sessionType, s.duration].filter(Boolean).join(' · '),
          source: 'triathlon',
          raw: s,
          dayIdx: i,
        });
      });
    }

    // User-added activities
    (activities[i] || []).forEach(act => {
      sessions.push({
        id: act.id || `act-${dk}-${act.label}`,
        discipline: actTypeToDisc(act.type),
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

function PhaseBar({ phase, viewWeek, t }) {
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
        <span style={{ fontSize: 10.5, color: t.text3 }}>Wk {viewWeek} / {TOTAL_WEEKS}</span>
      </div>
      <div style={{ display: 'flex', gap: 2, height: 5, borderRadius: 99, overflow: 'hidden' }}>
        {PHASES.map(ph => {
          const w = ((ph.weeks[1] - ph.weeks[0] + 1) / TOTAL_WEEKS) * 100;
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
        {PHASES.map(ph => {
          const w = ((ph.weeks[1] - ph.weeks[0] + 1) / TOTAL_WEEKS) * 100;
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

function SessionChip({ session, isDragging }) {
  const color = DISC_COLOR[session.discipline] || DISC_COLOR.conditioning;
  const emoji = DISC_EMOJI[session.discipline] || '🏃';
  const label = DISC_LABEL[session.discipline] || session.discipline;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: isDragging ? color + '30' : color + '16',
      border: `1px solid ${color}${isDragging ? '60' : '35'}`,
      borderRadius: 8, padding: '4px 8px',
      boxShadow: isDragging ? `0 3px 10px ${color}40` : 'none',
      transform: isDragging ? 'scale(1.04)' : 'none',
      transition: 'box-shadow .1s, transform .1s',
      cursor: 'grab', userSelect: 'none',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11 }}>{emoji}</span>
      <span style={{ fontSize: 10.5, fontWeight: 600, color, whiteSpace: 'nowrap' }}>{label}</span>
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
        <Droppable droppableId={dk} direction="horizontal">
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
              {/* Chips row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
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
                        >
                          <SessionChip session={sess} isDragging={snap.isDragging} />
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

function DayDetailPanel({ day, t, theme, triathlonDone, onToggleDone, onClose, onEditDay }) {
  const isDark = theme === 'dark';
  const { d, dk, sessions, dayIdx } = day;

  const panelBg   = isDark ? '#1C1C24' : '#FFFFFF';
  const overlayBg = isDark ? 'rgba(0,0,0,.55)' : 'rgba(28,25,23,.35)';

  const dayName = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const warnings = checkOvertrain(sessions);

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: overlayBg,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: panelBg, borderRadius: '20px 20px 0 0', padding: '0 0 32px',
          maxHeight: '72%', display: 'flex', flexDirection: 'column',
          animation: 'slideUp .24s cubic-bezier(.2,.8,.3,1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: t.border2 }} />
        </div>

        {/* Header */}
        <div style={{ padding: '4px 20px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text, lineHeight: 1.1 }}>{dayName}</div>
            <div style={{ fontSize: 11, color: t.text3, marginTop: 3 }}>
              {sessions.length === 0 ? 'Rest day' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: t.surface2, border: `1px solid ${t.border}`, cursor: 'pointer', fontSize: 14, color: t.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }} className="phone-scroll">
          {sessions.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', opacity: 0.5 }}>
              <span style={{ fontSize: 22 }}>😴</span>
              <span style={{ fontSize: 13, color: t.text2 }}>Rest day — no sessions planned</span>
            </div>
          ) : (
            sessions.map((sess, si) => {
              const color   = DISC_COLOR[sess.discipline] || DISC_COLOR.conditioning;
              const emoji   = DISC_EMOJI[sess.discipline] || '🏃';
              const label   = DISC_LABEL[sess.discipline] || sess.discipline;
              const doneKey = `${dk}:${si}`;
              const isDone  = !!triathlonDone?.[doneKey];
              return (
                <div key={sess.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                  borderBottom: si < sessions.length - 1 ? `1px solid ${t.border}` : 'none',
                }}>
                  {/* Completion toggle */}
                  <button
                    onClick={() => sess.source === 'triathlon' && onToggleDone?.(dk, si)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: sess.source === 'triathlon' ? 'pointer' : 'default',
                      border: isDone ? 'none' : `2px solid ${color}60`,
                      background: isDone ? color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    {isDone && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, background: color + '16', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    opacity: isDone ? 0.45 : 1,
                  }}>{emoji}</div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0, opacity: isDone ? 0.45 : 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color, textDecoration: isDone ? 'line-through' : 'none' }}>{label}</div>
                    {sess.detail && <div style={{ fontSize: 11, color: t.text3, marginTop: 1 }}>{sess.detail}</div>}
                  </div>
                </div>
              );
            })
          )}

          {/* Overtrain warnings */}
          {warnings.length > 0 && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#DC262608', border: '1px solid #DC262625', borderRadius: 10 }}>
              {warnings.map(w => (
                <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ fontSize: 11 }}>⚠️</span>
                  <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>{w} — consider a rest day</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ padding: '14px 20px 0' }}>
          <button
            onClick={onEditDay}
            style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: t.accent, color: '#fff', border: 'none',
              fontFamily: t.sans, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            View Full Day →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function WeeklyOverviewScreen({
  width = 390, height = 820, theme = 'light',
  onNav, profile = {},
  plan = {}, activities = {},
  tracksCycle = false, hasGym = true, hasEventTraining = false,
  triathlonOverrides = {}, onUpdateOverrides,
  triathlonDone = {}, onToggleDone,
  onTapDay,
}) {
  const t = themes[theme];

  const initWeek = getCurrentTriathlonWeek();
  const [viewWeek, setViewWeek]       = React.useState(initWeek);
  const [weekData, setWeekData]       = React.useState(() =>
    buildWeekData(initWeek, plan, activities, triathlonOverrides, hasGym, hasEventTraining)
  );
  const [warnings,    setWarnings]    = React.useState({});
  const [selectedDay, setSelectedDay] = React.useState(null);
  const [goalsOpen,   setGoalsOpen]   = React.useState(false);

  const phase = getPhase(viewWeek);

  React.useEffect(() => {
    setWeekData(buildWeekData(viewWeek, plan, activities, triathlonOverrides, hasGym, hasEventTraining));
  }, [viewWeek, plan, activities, triathlonOverrides, hasGym, hasEventTraining]);

  // Week date range label
  const weekStart = getTriathlonWeekStart(viewWeek);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const fmt       = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const weekLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}`;

  // Draft state: no goal set yet
  const isDraft = !profile?.goal;

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

    // Overtrain check on destination day
    const newWarns = checkOvertrain(dstRow.sessions);
    setWarnings(prev => ({ ...prev, [destination.droppableId]: newWarns }));

    // Persist triathlon session moves
    if (moved.source === 'triathlon' && onUpdateOverrides) {
      const newOverrides = { ...triathlonOverrides };
      [srcRow, dstRow].forEach(row => {
        newOverrides[row.dk] = row.sessions
          .filter(s => s.source === 'triathlon')
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
        // Swap source and destination day slots
        const tmp = sched[srcRow.dayIdx];
        sched[srcRow.dayIdx] = sched[dstRow.dayIdx];
        sched[dstRow.dayIdx] = tmp;
        // Signal parent — WeeklyOverviewScreen receives setPlan via callback
        // We surface it through a synthetic call if onUpdateOverrides is present
        // (full gym schedule override needs parent integration — see App.jsx)
      }
    }
  }, [weekData, triathlonOverrides, plan]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const activeGoals = FORMA_GOALS.filter(g => !g.archived);

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
              {hasEventTraining ? `Sprint Triathlon · Wk ${viewWeek}` : `Training · Wk ${viewWeek}`}
            </div>
            <div style={{ fontFamily: t.serif, fontSize: 26, lineHeight: 1, color: t.text }}>
              Weekly Overview
            </div>
          </div>
          {isDraft && (
            <span style={{
              marginTop: 6,
              fontSize: 9.5, fontWeight: 700, color: '#D97706',
              background: '#D9770618', border: '1px solid #D9770630',
              borderRadius: 7, padding: '3px 8px', letterSpacing: '.06em',
            }}>DRAFT</span>
          )}
        </div>
        {isDraft && (
          <button
            onClick={() => onNav?.('about-me')}
            style={{
              marginTop: 7, width: '100%', textAlign: 'left',
              fontSize: 11.5, fontWeight: 600, color: t.accent,
              background: t.accent + '10', border: `1px solid ${t.accent}28`,
              borderRadius: 9, padding: '7px 12px', fontFamily: t.sans, cursor: 'pointer',
            }}
          >
            Complete your profile to unlock your full plan →
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }} className="phone-scroll">

        {/* Phase bar */}
        <PhaseBar phase={phase} viewWeek={viewWeek} t={t} />

        {/* Goals panel */}
        <GoalsPanel goals={activeGoals} isDraft={isDraft} t={t} expanded={goalsOpen} onToggle={() => setGoalsOpen(o => !o)} />

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
            onClick={() => setViewWeek(w => Math.min(TOTAL_WEEKS, w + 1))}
            disabled={viewWeek === TOTAL_WEEKS}
            style={{
              width: 34, height: 34, borderRadius: 9, background: 'transparent',
              border: `1px solid ${t.border}`, color: viewWeek === TOTAL_WEEKS ? t.text3 : t.text,
              fontSize: 16, cursor: viewWeek === TOTAL_WEEKS ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: viewWeek === TOTAL_WEEKS ? 0.3 : 1,
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
                onClick={() => setSelectedDay(day)}
              />
            ))}
          </div>
        </DragDropContext>

        {/* Drag hint */}
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: t.text3 }}>
          Drag session chips to reschedule · Tap a day for details
        </div>

      </div>

      {/* Slide-in day detail panel */}
      {selectedDay && (
        <DayDetailPanel
          day={selectedDay}
          t={t}
          theme={theme}
          triathlonDone={triathlonDone}
          onToggleDone={(dk, si) => {
            const key  = `${dk}:${si}`;
            const next = { ...triathlonDone };
            if (next[key]) delete next[key]; else next[key] = true;
            onToggleDone?.(next);
          }}
          onClose={() => setSelectedDay(null)}
          onEditDay={() => {
            setSelectedDay(null);
            onTapDay?.(selectedDay.dayIdx);
          }}
        />
      )}

      <BottomNav
        theme={theme} active="triathlon" onNav={onNav}
        tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining}
      />
    </div>
  );
}
