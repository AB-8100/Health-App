import React from 'react';
import themes from '../data/themes';
import { BottomNav } from '../components/SharedUI';
import { TRIATHLON_PLAN, DISCIPLINE_DISPLAY, TRIATHLON_META, getCurrentTriathlonWeek, getTriathlonWeekStart } from '../data/triathlonPlan';

const RACE_DATE   = new Date('2026-10-25T00:00:00');
const TOTAL_WEEKS = 18;

const PHASES = [
  { label: 'Foundation', weeks: [1,  6],  color: '#15803D' },
  { label: 'Build',      weeks: [7,  14], color: '#0369A1' },
  { label: 'Peak',       weeks: [15, 17], color: '#9333EA' },
  { label: 'Taper',      weeks: [18, 18], color: '#DC2626' },
];

const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// Re-export helpers from data file for use in this module
const getWeekStartDate = getTriathlonWeekStart;
const getCurrentWeek  = getCurrentTriathlonWeek;

function getPhase(weekNum) {
  return PHASES.find(p => weekNum >= p.weeks[0] && weekNum <= p.weeks[1]) || PHASES[0];
}

// Returns the effective sessions for a date, respecting any user swaps
function getSessionsForDate(dk, overrides) {
  if (Object.prototype.hasOwnProperty.call(overrides, dk)) return overrides[dk];
  return (TRIATHLON_PLAN[dk] || []).filter(s => s.discipline !== 'Rest');
}

export function TriathlonScreen({
  width=390, height=820, theme='light',
  onNav, tracksCycle=false, hasGym=true, hasEventTraining=false,
  triathlonOverrides={}, onUpdateOverrides,
  triathlonDone={}, onToggleDone,
}) {
  const t = themes[theme];
  const todayKey = toDateKey(new Date());
  const initWeek = getCurrentWeek();
  const [viewWeek, setViewWeek] = React.useState(initWeek);

  const phase = getPhase(viewWeek);
  const weekStart = getWeekStartDate(viewWeek);

  // Build Mon–Sun for this view week
  const weekDays = React.useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dk = toDateKey(d);
    const sessions = getSessionsForDate(dk, triathlonOverrides);
    return { d, dk, sessions, isToday: dk === todayKey };
  }), [viewWeek, triathlonOverrides, todayKey]);

  // Swap sessions between two days in the week
  const swapDays = (iA, iB) => {
    const dkA = weekDays[iA].dk;
    const dkB = weekDays[iB].dk;
    const sessA = weekDays[iA].sessions;
    const sessB = weekDays[iB].sessions;
    if (onUpdateOverrides) {
      onUpdateOverrides({ ...triathlonOverrides, [dkA]: sessB, [dkB]: sessA });
    }
  };

  // Toggle completion for a specific session
  const toggleDone = (dk, sessionIdx) => {
    const key = `${dk}:${sessionIdx}`;
    const next = { ...triathlonDone };
    if (next[key]) delete next[key]; else next[key] = true;
    if (onToggleDone) onToggleDone(next);
  };

  // Race countdown
  const today = new Date(); today.setHours(0,0,0,0);
  const daysToRace = Math.ceil((RACE_DATE - today) / 86400000);

  // Week date range label
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const fmtDate = (d) => d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`;

  return (
    <div style={{
      width, height, background:t.bg, fontFamily:t.sans, color:t.text,
      display:'flex', flexDirection:'column', overflow:'hidden', position:'relative'
    }}>
      {/* Status bar */}
      <div style={{
        height:44, display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        padding:'0 22px 8px', fontSize:14, fontWeight:600, flexShrink:0
      }}>
        <span>9:41</span>
        <div style={{ display:'flex', gap:5, alignItems:'center', fontSize:11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding:'4px 20px 14px', flexShrink:0 }}>
        <div style={{ fontSize:9.5, letterSpacing:'.18em', textTransform:'uppercase', color:t.text3, marginBottom:2 }}>
          Sprint Triathlon
        </div>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
          <div style={{ fontFamily:t.serif, fontSize:28, lineHeight:1, color:t.text }}>
            Training Plan
          </div>
          <div style={{
            fontSize:11, color: daysToRace > 0 ? '#DC2626' : '#15803D',
            fontWeight:600, background: daysToRace > 0 ? '#DC262612' : '#15803D12',
            border:`1px solid ${daysToRace > 0 ? '#DC262630' : '#15803D30'}`,
            borderRadius:8, padding:'4px 9px'
          }}>
            {daysToRace > 0 ? `🏁 ${daysToRace}d to race` : '🏁 Race day!'}
          </div>
        </div>
        <div style={{ fontSize:11, color:t.text3, marginTop:3 }}>
          {TRIATHLON_META.raceDistances} · 25 Oct 2026
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'0 20px 16px' }} className="phone-scroll">

        {/* Phase progress card */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:18,
          padding:'13px 15px', marginBottom:14
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:9 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{
                fontSize:10, fontWeight:700, color:phase.color, letterSpacing:'.1em',
                textTransform:'uppercase', background:phase.color+'18',
                border:`1px solid ${phase.color}30`, borderRadius:6, padding:'2px 8px'
              }}>{phase.label}</span>
              <span style={{ fontSize:11, color:t.text2 }}>Wks {phase.weeks[0]}–{phase.weeks[1]}</span>
            </div>
            <span style={{ fontSize:11, color:t.text3 }}>Wk {viewWeek} of {TOTAL_WEEKS}</span>
          </div>
          <div style={{ display:'flex', gap:3, height:6, borderRadius:99, overflow:'hidden', marginBottom:7 }}>
            {PHASES.map((ph, pi) => {
              const phWidth = ((ph.weeks[1] - ph.weeks[0] + 1) / TOTAL_WEEKS) * 100;
              return (
                <div key={pi} style={{
                  width:`${phWidth}%`, height:'100%', borderRadius:99,
                  background: phase.label === ph.label ? ph.color : ph.color+'40',
                  transition:'background .3s'
                }}/>
              );
            })}
          </div>
          <div style={{ display:'flex', gap:3 }}>
            {PHASES.map((ph, pi) => {
              const phWidth = ((ph.weeks[1] - ph.weeks[0] + 1) / TOTAL_WEEKS) * 100;
              const isActive = phase.label === ph.label;
              return (
                <div key={pi} style={{
                  width:`${phWidth}%`, fontSize:8.5, color: isActive ? ph.color : t.text3,
                  fontWeight: isActive ? 700 : 400, letterSpacing:'.02em',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'clip'
                }}>{ph.label}</div>
              );
            })}
          </div>
        </div>

        {/* Week navigator */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <button onClick={() => setViewWeek(w => Math.max(1, w - 1))} disabled={viewWeek === 1} style={{
            width:34, height:34, borderRadius:9, background:'transparent', border:`1px solid ${t.border}`,
            color: viewWeek === 1 ? t.text3 : t.text, fontSize:16, cursor: viewWeek === 1 ? 'default' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', opacity: viewWeek === 1 ? 0.35 : 1
          }}>‹</button>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:13.5, fontWeight:600, color:t.text }}>Week {viewWeek}</div>
            <div style={{ fontSize:10.5, color:t.text3 }}>{weekLabel}</div>
            {viewWeek !== initWeek && (
              <button onClick={() => setViewWeek(initWeek)} style={{
                marginTop:4, padding:'2px 10px', borderRadius:6,
                background: t.accent+'18', border:`1px solid ${t.accent}40`,
                color:t.accent, fontFamily:t.sans, fontSize:10.5, fontWeight:600, cursor:'pointer'
              }}>↩ Wk {initWeek} (current)</button>
            )}
          </div>
          <button onClick={() => setViewWeek(w => Math.min(TOTAL_WEEKS, w + 1))} disabled={viewWeek === TOTAL_WEEKS} style={{
            width:34, height:34, borderRadius:9, background:'transparent', border:`1px solid ${t.border}`,
            color: viewWeek === TOTAL_WEEKS ? t.text3 : t.text, fontSize:16, cursor: viewWeek === TOTAL_WEEKS ? 'default' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', opacity: viewWeek === TOTAL_WEEKS ? 0.35 : 1
          }}>›</button>
        </div>

        {/* Day rows */}
        <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:18, padding:'4px 15px', marginBottom:14 }}>
          {weekDays.map(({ d, dk, sessions, isToday }, i) => {
            const isBrick = sessions.length > 1 || sessions.some(s => s.flag?.toLowerCase().includes('brick'));
            const isRest = sessions.length === 0;
            const allDone = !isRest && sessions.every((_, si) => triathlonDone[`${dk}:${si}`]);

            return (
              <div key={i} style={{
                display:'flex', alignItems:'stretch', gap:0,
                borderTop: i > 0 ? `1px solid ${t.border}` : 'none',
                background: isToday ? t.accent+'08' : 'transparent',
                margin: isToday ? '0 -15px' : '0',
                padding: isToday ? '0 15px' : '0',
                borderRadius: isToday ? 10 : 0,
              }}>
                {/* Day label */}
                <div style={{
                  width:34, flexShrink:0, paddingTop:10, paddingBottom:8,
                  display:'flex', flexDirection:'column', alignItems:'center'
                }}>
                  <div style={{
                    fontSize:10, fontWeight:600, letterSpacing:'.05em',
                    color: isToday ? t.accent : t.text3, textTransform:'uppercase'
                  }}>{DAY_SHORT[i]}</div>
                  <div style={{
                    fontSize:13, fontWeight: isToday ? 700 : 400,
                    color: isToday ? t.accent : t.text2, lineHeight:1.2
                  }}>{d.getDate()}</div>
                  <div style={{ fontSize:9, color:t.text3 }}>
                    {d.toLocaleDateString('en-GB', { month:'short' })}
                  </div>
                </div>

                {/* Sessions area */}
                <div style={{ flex:1, borderLeft:`1px solid ${t.border}`, paddingLeft:10, paddingTop:8, paddingBottom:8 }}>
                  {isRest ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8, height:'100%', opacity:0.5 }}>
                      <div style={{
                        width:28, height:28, borderRadius:8, background:t.surface2,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0
                      }}>😴</div>
                      <span style={{ fontSize:12, color:t.text3 }}>Rest</span>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {sessions.map((sess, si) => {
                        const disp = DISCIPLINE_DISPLAY[sess.discipline] || DISCIPLINE_DISPLAY['Swim'];
                        const doneKey = `${dk}:${si}`;
                        const isDone = !!triathlonDone[doneKey];
                        return (
                          <div key={si} style={{ display:'flex', alignItems:'center', gap:8 }}>
                            {/* Completion circle */}
                            <button
                              onClick={() => toggleDone(dk, si)}
                              style={{
                                width:22, height:22, borderRadius:'50%', flexShrink:0, cursor:'pointer',
                                border: isDone ? 'none' : `2px solid ${disp.color}60`,
                                background: isDone ? disp.color : 'transparent',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                transition:'all .15s', padding:0,
                              }}>
                              {isDone && (
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>

                            {/* Discipline icon */}
                            <div style={{
                              width:28, height:28, borderRadius:8, flexShrink:0,
                              background: disp.color+'18', color: disp.color,
                              display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                              opacity: isDone ? 0.45 : 1, transition:'opacity .15s',
                            }}>{disp.emoji}</div>

                            {/* Text */}
                            <div style={{ flex:1, minWidth:0, opacity: isDone ? 0.45 : 1, transition:'opacity .15s' }}>
                              <div style={{ display:'flex', alignItems:'baseline', gap:5, flexWrap:'wrap' }}>
                                <span style={{ fontSize:12.5, fontWeight:600, color:disp.color,
                                  textDecoration: isDone ? 'line-through' : 'none' }}>
                                  {disp.label}
                                </span>
                                {sess.duration !== '—' && (
                                  <span style={{ fontSize:10, color:t.text3, fontFamily:'monospace' }}>{sess.duration}</span>
                                )}
                                {isBrick && si === 0 && (
                                  <span style={{
                                    fontSize:8, fontWeight:700, color:'#DC2626',
                                    background:'#DC262618', border:'1px solid #DC262625',
                                    borderRadius:4, padding:'1px 4px', letterSpacing:'.05em'
                                  }}>BRICK</span>
                                )}
                              </div>
                              <div style={{
                                fontSize:10, color:t.text3, lineHeight:1.35, marginTop:1,
                                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:140
                              }}>{sess.sessionType}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ↑ ↓ swap buttons */}
                <div style={{
                  display:'flex', flexDirection:'column', justifyContent:'center',
                  gap:3, paddingLeft:8, flexShrink:0
                }}>
                  <button
                    onClick={() => swapDays(i, i - 1)}
                    disabled={i === 0}
                    title="Move up"
                    style={{
                      width:24, height:24, borderRadius:6, border:`1px solid ${t.border}`,
                      background:'transparent', cursor: i === 0 ? 'default' : 'pointer',
                      color: i === 0 ? t.border : t.text3, fontSize:11,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      opacity: i === 0 ? 0.2 : 0.7, padding:0,
                      transition:'opacity .1s',
                    }}>↑</button>
                  <button
                    onClick={() => swapDays(i, i + 1)}
                    disabled={i === 6}
                    title="Move down"
                    style={{
                      width:24, height:24, borderRadius:6, border:`1px solid ${t.border}`,
                      background:'transparent', cursor: i === 6 ? 'default' : 'pointer',
                      color: i === 6 ? t.border : t.text3, fontSize:11,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      opacity: i === 6 ? 0.2 : 0.7, padding:0,
                      transition:'opacity .1s',
                    }}>↓</button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      <BottomNav theme={theme} active="triathlon" onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining}/>
    </div>
  );
}
