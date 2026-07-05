import React from 'react';
import themes from '../data/themes';
import { PulseDot, BottomNav } from '../components/SharedUI';
import { ExerciseImage } from './ExerciseScreens';
const GYM_QUEUE = [
  {
    id: 'bench',
    name: 'Bench press',
    muscle: 'Chest',
    targetSets: 4,
    targetReps: 8,
    targetWeight: 57.5,
    isPR: true,
    lastWeek: '55kg × 10',
    unilateral: false,
    sets: [],  // seeded fresh on session start
  },
  { id: 'ohp',      name: 'Overhead press',   muscle: 'Shoulders',  targetSets: 4, targetWeight: 37.5, targetReps: 9,  lastWeek: '37.5 × 8',  unilateral: false, sets: [] },
  { id: 'incline',  name: 'Incline DB press', muscle: 'Upper chest',targetSets: 3, targetWeight: 26,   targetReps: 10, lastWeek: '24 × 12',   unilateral: false, sets: [] },
  { id: 'lateral',  name: 'Lateral raises',   muscle: 'Shoulders',  targetSets: 3, targetWeight: 12,   targetReps: 15, lastWeek: '12 × 15',   unilateral: true,  sets: [] },
  { id: 'tricep',   name: 'Tricep pushdown',  muscle: 'Triceps',    targetSets: 3, targetWeight: 45,   targetReps: 12, lastWeek: '45 × 12',   unilateral: false, sets: [] },
  { id: 'skulls',   name: 'Skull crushers',   muscle: 'Triceps',    targetSets: 3, targetWeight: 22.5, targetReps: 12, lastWeek: '22.5 × 12', unilateral: false, sets: [] },
];

function blankSet(unilateral) {
  return unilateral
    ? { wR: null, rR: null, wL: null, rL: null, done: false }
    : { w: null, r: null, done: false };
}

function GymSessionScreen({ width = 390, height = 820, theme = 'light', session, setSession, onNav, onExit, onComplete, tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const t = themes[theme];

  React.useEffect(() => {
    if (!session.queue) {
      const seeded = GYM_QUEUE.map(ex => ({
        ...ex,
        sets: Array.from({ length: ex.targetSets }, () => blankSet(ex.unilateral))
      }));
      setSession(s => ({ ...s, queue: seeded, exIdx: 0 }));
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const queue   = session.queue   || GYM_QUEUE;
  const exIdx   = session.exIdx   || 0;
  const elapsed = session.elapsed || 0;
  const paused  = session.paused  || false;

  const [restSec, setRestSec]         = React.useState(0);
  const [showEndConfirm, setShowEndConfirm] = React.useState(false);
  const [editingSetIdx, setEditingSetIdx]   = React.useState(null);

  // Clear edit mode when exercise changes
  React.useEffect(() => { setEditingSetIdx(null); }, [exIdx]);

  React.useEffect(() => {
    if (restSec <= 0 || paused) return;
    const id = setInterval(() => setRestSec(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [restSec, paused]);

  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const cur = queue[exIdx];
  const curSetIdx = (cur?.sets || []).findIndex(s => !s.done);
  const totalDone = queue.reduce((n,e) => n + (e.sets||[]).filter(s=>s.done).length, 0);
  const totalSets = queue.reduce((n,e) => n + e.targetSets, 0);
  const allDone = totalDone >= totalSets;

  const updateSet = (exI, i, field, value) => {
    const next = queue.slice();
    const sets = next[exI].sets.slice();
    sets[i] = { ...sets[i], [field]: value };
    next[exI] = { ...next[exI], sets };
    setSession(s => ({ ...s, queue: next }));
  };

  const logSet = () => {
    if (curSetIdx < 0) return;
    const next = queue.slice();
    const sets = next[exIdx].sets.slice();
    const s = sets[curSetIdx];
    if (cur.unilateral) {
      sets[curSetIdx] = {
        wR: s.wR ?? cur.targetWeight,
        rR: s.rR ?? cur.targetReps,
        wL: s.wL ?? cur.targetWeight,
        rL: s.rL ?? cur.targetReps,
        done: true,
      };
    } else {
      sets[curSetIdx] = {
        w: s.w ?? cur.targetWeight,
        r: s.r ?? cur.targetReps,
        done: true,
      };
    }
    next[exIdx] = { ...next[exIdx], sets };
    setSession(sn => ({ ...sn, queue: next }));
    setRestSec(90);
    setEditingSetIdx(null);

    if (curSetIdx === sets.length - 1) {
      for (let i = exIdx + 1; i < next.length; i++) {
        if (!next[i].sets || next[i].sets.length === 0) {
          const seeded = Array.from({ length: next[i].targetSets }, () => blankSet(next[i].unilateral));
          next[i] = { ...next[i], sets: seeded };
        }
        if ((next[i].sets || []).some(s => !s.done)) {
          setSession(sn => ({ ...sn, queue: next.slice() }));
          setTimeout(() => setSession(sn => ({ ...sn, exIdx: i })), 800);
          break;
        }
      }
    }
  };

  const saveEditedSet = (i) => {
    setEditingSetIdx(null);
  };

  const togglePause = () => setSession(s => ({ ...s, paused: !s.paused }));
  const finishSession = () => {
    setShowEndConfirm(false);
    if (onComplete) onComplete({ queue, elapsed, workout: session.workout });
  };
  const discardSession = () => {
    setShowEndConfirm(false);
    if (onExit) onExit();
  };
  const jumpToExercise = (i) => setSession(s => ({ ...s, exIdx: i }));

  return (
    <div style={{
      width, height, background:t.bg, fontFamily:t.sans, color:t.text,
      display:'flex', flexDirection:'column', overflow:'hidden', position:'relative'
    }}>
      {/* Status bar */}
      <div style={{
        height:44, display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        padding:'0 22px 8px', fontSize:14, fontWeight:600, color:t.text
      }}>
        <span>9:41</span>
        <div style={{ display:'flex', gap:5, alignItems:'center', fontSize:11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Top app bar */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'2px 14px 12px', borderBottom:`1px solid ${t.border}`,
        background: t.bg, gap:8
      }}>
        {/* Back = minimise: keeps session running, just navigates away */}
        <button onClick={() => onNav && onNav('gym-hub')} title="Minimise session" style={{
          width:32, height:32, borderRadius:9, background:'transparent',
          border:`1px solid ${t.border}`, color:t.text, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
          flexShrink:0
        }}>←</button>

        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, justifyContent:'center' }}>
          <div style={{ textAlign:'center', lineHeight:1.1 }}>
            <div style={{
              fontSize:9, letterSpacing:'.18em', color: paused ? '#B45309' : t.text3,
              textTransform:'uppercase', marginBottom:4, fontWeight:500, lineHeight:1
            }}>
              {paused ? 'Paused' : 'In session'}
            </div>
            <div style={{
              fontFamily:t.mono, fontSize:15, color:t.text, lineHeight:1,
              fontVariantNumeric:'tabular-nums', display:'flex', alignItems:'center', gap:6,
              justifyContent:'center'
            }}>
              <span>{fmt(elapsed)}</span>
              {!paused && <PulseDot color={t.green} size={5}/>}
              {paused && <span style={{
                width:5, height:5, borderRadius:'50%', background:'#B45309', display:'inline-block'
              }}/>}
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:5, flexShrink:0 }}>
          <button onClick={togglePause} title={paused ? 'Resume' : 'Pause'} style={{
            width:32, height:32, borderRadius:9,
            background: paused ? '#FEF3C7' : 'transparent',
            border:`1px solid ${paused ? '#FBBF24' : t.border}`,
            color: paused ? '#B45309' : t.text2,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            {paused ? (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 2 L10 6 L3 10 Z"/>
              </svg>
            ) : (
              <svg width="10" height="11" viewBox="0 0 10 12" fill="currentColor">
                <rect x="1" y="1" width="2.5" height="10" rx="1"/>
                <rect x="6.5" y="1" width="2.5" height="10" rx="1"/>
              </svg>
            )}
          </button>
          <button onClick={() => setShowEndConfirm(true)} title="End session" style={{
            width:32, height:32, borderRadius:9,
            background:'transparent', border:`1px solid ${t.border}`,
            color: '#BE3B2E', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <rect x="0" y="0" width="10" height="10" rx="1"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px 16px', position:'relative' }} className="phone-scroll">

        {/* Session header */}
        <div style={{
          display:'flex', alignItems:'flex-end', justifyContent:'space-between',
          marginBottom:14
        }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:'.16em', color:t.text3, textTransform:'uppercase', marginBottom:3 }}>
              Workout
            </div>
            <div style={{ fontFamily:t.serif, fontSize:24, lineHeight:1, color:t.text }}>
              {session.workout || 'Push day'}
            </div>
          </div>
          <div style={{ fontSize:10.5, color:t.text3, letterSpacing:'.06em' }}>
            EX <span style={{ color:t.text }}>{exIdx+1}</span>/{queue.length} ·
            &nbsp;SETS <span style={{ color:t.text }}>{totalDone}</span>/{totalSets}
          </div>
        </div>

        <div style={{
          height:4, background:t.border, borderRadius:999, overflow:'hidden', marginBottom:18
        }}>
          <div style={{
            height:'100%', background:t.accent, borderRadius:999,
            width: `${(totalDone/totalSets)*100}%`,
            transition:'width .4s ease'
          }}/>
        </div>

        {/* Current exercise hero */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6, gap:12 }}>
            <ExerciseImage exerciseId={cur.id} size={56} radius={12} theme={theme}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, letterSpacing:'.16em', color:t.text3, textTransform:'uppercase', marginBottom:3 }}>
                Now
              </div>
              <div style={{ fontFamily:t.serif, fontSize:28, lineHeight:1, color:t.text }}>
                {cur.name}
              </div>
              <div style={{ fontSize:11.5, color:t.text2, marginTop:3 }}>
                {cur.muscle}
                {cur.unilateral && (
                  <span style={{
                    marginLeft:6, fontSize:9.5, fontWeight:600, letterSpacing:'.06em',
                    color:t.accent, background:t.accent+'18', border:`1px solid ${t.accent}30`,
                    borderRadius:5, padding:'2px 5px'
                  }}>Unilateral</span>
                )}
                {' · Last week: '}{cur.lastWeek}
              </div>
            </div>
            {cur.isPR && (
              <div style={{
                padding:'4px 9px', borderRadius:7,
                background:t.accent+'18', color:t.accent,
                border:`1px solid ${t.accent}30`,
                fontSize:9.5, fontWeight:600, letterSpacing:'.08em',
                textTransform:'uppercase', flexShrink:0
              }}>
                ★ PR
              </div>
            )}
          </div>
        </div>

        {/* Set tracker */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:18,
          padding:'4px 0', marginBottom:14, overflow:'hidden'
        }}>
          {/* header row */}
          <div style={{
            display:'grid',
            gridTemplateColumns: cur.unilateral ? '40px 1fr 1fr 40px' : '40px 1fr 1fr 40px',
            gap:0,
            padding:'10px 16px 8px',
            fontSize:9.5, letterSpacing:'.12em', color:t.text3, textTransform:'uppercase',
            borderBottom:`1px solid ${t.border}`
          }}>
            <span>Set</span>
            <span style={{ textAlign:'center' }}>{cur.unilateral ? 'Right' : 'Weight'}</span>
            <span style={{ textAlign:'center' }}>{cur.unilateral ? 'Left' : 'Reps'}</span>
            <span></span>
          </div>

          {(cur.sets||[]).map((s,i) => {
            const isCurrent = i === curSetIdx;
            const isEditing = s.done && i === editingSetIdx;

            return (
              <div key={i} style={{
                display:'grid', gridTemplateColumns:'40px 1fr 1fr 40px', gap:0,
                alignItems:'center', padding:'10px 16px',
                borderBottom: i < cur.sets.length - 1 ? `1px solid ${t.border}` : 'none',
                background: isCurrent ? (theme==='dark' ? t.accent+'10' : t.accent+'08') : 'transparent',
              }}>
                <div style={{
                  fontFamily:t.mono, fontSize:12,
                  color: s.done ? t.text3 : (isCurrent ? t.accent : t.text2),
                  fontWeight: isCurrent ? 600 : 400
                }}>
                  {i+1}
                </div>

                {/* Weight / Right side */}
                <div style={{ display:'flex', justifyContent:'center' }}>
                  {cur.unilateral ? (
                    s.done && !isEditing ? (
                      <span style={{ fontFamily:t.mono, fontSize:13, color:t.text2, textAlign:'center' }}>
                        {s.wR}<span style={{ fontSize:10, color:t.text3 }}>kg</span>
                        <span style={{ fontSize:10, color:t.text3 }}> ×{s.rR}</span>
                      </span>
                    ) : (isCurrent || isEditing) ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <NumberInput
                          value={s.wR ?? cur.targetWeight}
                          onChange={(v) => updateSet(exIdx, i, 'wR', v)}
                          step={2.5} suffix="kg" theme={theme}
                        />
                        <NumberInput
                          value={s.rR ?? cur.targetReps}
                          onChange={(v) => updateSet(exIdx, i, 'rR', v)}
                          step={1} prefix="×" theme={theme}
                        />
                      </div>
                    ) : (
                      <span style={{ fontSize:12, color:t.text3, textAlign:'center' }}>
                        {cur.targetWeight}<span style={{ fontSize:10 }}>kg</span>
                        <span style={{ fontSize:10 }}> ×{cur.targetReps}</span>
                      </span>
                    )
                  ) : (
                    s.done && !isEditing ? (
                      <span style={{ fontFamily:t.mono, fontSize:14, color:t.text2 }}>
                        {s.w}<span style={{ fontSize:10, color:t.text3 }}>kg</span>
                      </span>
                    ) : (isCurrent || isEditing) ? (
                      <NumberInput
                        value={s.w ?? cur.targetWeight}
                        onChange={(v) => updateSet(exIdx, i, 'w', v)}
                        step={2.5} suffix="kg" theme={theme}
                      />
                    ) : (
                      <span style={{ fontSize:13, color:t.text3 }}>
                        {cur.targetWeight}<span style={{ fontSize:10 }}>kg</span>
                      </span>
                    )
                  )}
                </div>

                {/* Reps / Left side */}
                <div style={{ display:'flex', justifyContent:'center' }}>
                  {cur.unilateral ? (
                    s.done && !isEditing ? (
                      <span style={{ fontFamily:t.mono, fontSize:13, color:t.text2, textAlign:'center' }}>
                        {s.wL}<span style={{ fontSize:10, color:t.text3 }}>kg</span>
                        <span style={{ fontSize:10, color:t.text3 }}> ×{s.rL}</span>
                      </span>
                    ) : (isCurrent || isEditing) ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <NumberInput
                          value={s.wL ?? cur.targetWeight}
                          onChange={(v) => updateSet(exIdx, i, 'wL', v)}
                          step={2.5} suffix="kg" theme={theme}
                        />
                        <NumberInput
                          value={s.rL ?? cur.targetReps}
                          onChange={(v) => updateSet(exIdx, i, 'rL', v)}
                          step={1} prefix="×" theme={theme}
                        />
                      </div>
                    ) : (
                      <span style={{ fontSize:12, color:t.text3, textAlign:'center' }}>
                        {cur.targetWeight}<span style={{ fontSize:10 }}>kg</span>
                        <span style={{ fontSize:10 }}> ×{cur.targetReps}</span>
                      </span>
                    )
                  ) : (
                    s.done && !isEditing ? (
                      <span style={{ fontFamily:t.mono, fontSize:14, color:t.text2 }}>
                        ×{s.r}
                      </span>
                    ) : (isCurrent || isEditing) ? (
                      <NumberInput
                        value={s.r ?? cur.targetReps}
                        onChange={(v) => updateSet(exIdx, i, 'r', v)}
                        step={1} prefix="×" theme={theme}
                      />
                    ) : (
                      <span style={{ fontSize:13, color:t.text3 }}>
                        ×{cur.targetReps}
                      </span>
                    )
                  )}
                </div>

                {/* Status / action */}
                <div style={{ display:'flex', justifyContent:'center', alignItems:'center' }}>
                  {isEditing ? (
                    <button
                      onClick={() => saveEditedSet(i)}
                      title="Save edit"
                      style={{
                        width:26, height:26, borderRadius:'50%',
                        background:t.green+'20', color:t.green,
                        border:`1px solid ${t.green}40`,
                        cursor:'pointer', fontSize:13, display:'flex',
                        alignItems:'center', justifyContent:'center'
                      }}>✓</button>
                  ) : s.done ? (
                    <button
                      onClick={() => setEditingSetIdx(i)}
                      title="Edit this set"
                      style={{
                        width:26, height:26, borderRadius:'50%',
                        background:t.green+'20', color:t.green,
                        border:`1px solid ${t.green}40`,
                        cursor:'pointer', fontSize:11, display:'flex',
                        alignItems:'center', justifyContent:'center',
                        padding:0
                      }}>
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8.5 1.5 L10.5 3.5 L4 10 L1.5 10.5 L2 8 Z"/>
                      </svg>
                    </button>
                  ) : isCurrent ? (
                    <span style={{
                      width:8, height:8, borderRadius:'50%', background:t.accent,
                      display:'inline-block',
                      boxShadow: theme==='dark' ? `0 0 8px ${t.accent}` : 'none'
                    }}/>
                  ) : (
                    <span style={{
                      width:8, height:8, borderRadius:'50%',
                      background:'transparent', border:`1px solid ${t.border2}`,
                      display:'inline-block'
                    }}/>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rest timer */}
        {restSec > 0 && (
          <div style={{
            background:theme==='dark' ? t.surface : '#FFF6F0',
            border:`1px solid ${theme==='dark' ? t.accent+'30' : t.accent+'40'}`,
            borderRadius:14, padding:'12px 14px', marginBottom:12,
            display:'flex', alignItems:'center', gap:12
          }}>
            <div style={{
              fontFamily:t.serif, fontSize:28, color:t.accent, lineHeight:1,
              fontVariantNumeric:'tabular-nums', minWidth:60
            }}>
              {fmt(restSec)}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:t.text, fontWeight:500 }}>Rest</div>
              <div style={{ fontSize:10, color:t.text3 }}>Breathe. Hydrate. Next set up.</div>
            </div>
            <button
              onClick={() => setRestSec(0)}
              style={{
                padding:'5px 10px', borderRadius:7,
                background:'transparent', border:`1px solid ${t.border2}`,
                color:t.text2, fontSize:11, cursor:'pointer', fontFamily:t.sans
              }}>Skip</button>
          </div>
        )}

        {/* Primary action */}
        <button onClick={allDone ? finishSession : logSet} style={{
          width:'100%', padding:'14px', borderRadius:13,
          background: allDone ? t.green : (curSetIdx < 0 ? t.surface2 : t.accent),
          color: allDone ? '#fff' : (curSetIdx < 0 ? t.text3 : t.accentText),
          border:'none', fontFamily:t.sans, fontSize:14, fontWeight:600,
          cursor: 'pointer',
          marginBottom:18,
          display:'flex', alignItems:'center', justifyContent:'center', gap:7
        }}>
          {allDone
            ? 'Finish workout ✓'
            : (curSetIdx < 0 ? `Next exercise: ${queue[exIdx+1]?.name || ''} →` : `Log set ${curSetIdx+1} of ${cur.targetSets}`)}
        </button>

        {/* Up next queue */}
        <div style={{
          fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
          color:t.text3, marginBottom:8, padding:'0 4px'
        }}>
          Up next
        </div>
        {queue.slice(exIdx + 1, exIdx + 4).map((e, i) => (
          <div key={e.id} onClick={() => jumpToExercise(exIdx + 1 + i)} style={{
            display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
            background:t.surface, border:`1px solid ${t.border}`, borderRadius:13,
            marginBottom:6, cursor:'pointer'
          }}>
            <ExerciseImage exerciseId={e.id} size={34} radius={8} theme={theme}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12.5, color:t.text }}>
                {e.name}
                {e.unilateral && (
                  <span style={{ marginLeft:5, fontSize:9, color:t.accent, fontWeight:600 }}>R/L</span>
                )}
              </div>
              <div style={{ fontSize:10, color:t.text3 }}>{e.muscle} · {e.targetSets} sets</div>
            </div>
            <div style={{ fontFamily:t.mono, fontSize:11, color:t.text2 }}>
              {e.targetWeight}kg × {e.targetReps}
            </div>
          </div>
        ))}
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}/>

      {/* End-session confirm sheet */}
      {showEndConfirm && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.45)',
          display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:50,
          animation: 'om-fade 200ms ease-out'
        }} onClick={() => setShowEndConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width:'100%', background:t.surface, borderTopLeftRadius:22, borderTopRightRadius:22,
            padding:'18px 20px 22px',
            boxShadow:'0 -10px 40px rgba(0,0,0,.18)'
          }}>
            <div style={{
              width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 14px'
            }}/>
            <div style={{ fontFamily:t.serif, fontSize:22, color:t.text, marginBottom:6 }}>
              End workout early?
            </div>
            <div style={{ fontSize:12, color:t.text2, marginBottom:16, lineHeight:1.5 }}>
              You've logged <strong style={{ color:t.text }}>{totalDone} of {totalSets} sets</strong> ({fmt(elapsed)} elapsed).
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button onClick={finishSession} style={{
                width:'100%', padding:'13px', borderRadius:11,
                background:t.accent, color:t.accentText,
                border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer'
              }}>Save session</button>
              <button onClick={discardSession} style={{
                width:'100%', padding:'13px', borderRadius:11,
                background:'transparent', color:'#BE3B2E',
                border:`1px solid #BE3B2E`, fontFamily:t.sans, fontSize:13, fontWeight:500, cursor:'pointer'
              }}>Don't save</button>
              <button onClick={() => setShowEndConfirm(false)} style={{
                width:'100%', padding:'12px', borderRadius:11, background:'transparent',
                border:`1px solid ${t.border2}`, color:t.text2,
                fontFamily:t.sans, fontSize:13, fontWeight:500, cursor:'pointer'
              }}>Keep going</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Numeric stepper — tap the value to type directly, or use +/- buttons
function NumberInput({ value, onChange, step = 1, prefix = '', suffix = '', theme = 'light' }) {
  const t = themes[theme];
  const [isTyping, setIsTyping] = React.useState(false);
  const [draft, setDraft]       = React.useState('');

  const startTyping = () => {
    setDraft(String(value));
    setIsTyping(true);
  };

  const commitTyping = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0) onChange(parsed);
    setIsTyping(false);
  };

  return (
    <div style={{
      display:'inline-flex', alignItems:'center',
      background:t.bg, border:`1px solid ${t.border2}`, borderRadius:8,
      overflow:'hidden'
    }}>
      <button
        onClick={() => onChange(Number((value - step).toFixed(2)))}
        style={{ width:24, height:28, background:'transparent', border:'none', color:t.text2, fontSize:14, cursor:'pointer', fontFamily:t.sans }}
      >−</button>

      {isTyping ? (
        <input
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitTyping}
          onKeyDown={e => { if (e.key === 'Enter') { commitTyping(); } }}
          autoFocus
          style={{
            width:46, textAlign:'center', fontFamily:t.mono, fontSize:13, color:t.text,
            background:'transparent', border:'none', outline:'none',
            fontVariantNumeric:'tabular-nums', MozAppearance:'textfield'
          }}
        />
      ) : (
        <span
          onClick={startTyping}
          title="Tap to type"
          style={{
            minWidth:42, textAlign:'center', fontFamily:t.mono, fontSize:13,
            color:t.text, fontVariantNumeric:'tabular-nums',
            cursor:'text', userSelect:'none', padding:'0 2px'
          }}
        >
          {prefix}{value}<span style={{ fontSize:9, color:t.text3 }}>{suffix}</span>
        </span>
      )}

      <button
        onClick={() => onChange(Number((value + step).toFixed(2)))}
        style={{ width:24, height:28, background:'transparent', border:'none', color:t.text2, fontSize:14, cursor:'pointer', fontFamily:t.sans }}
      >+</button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Swim-specific distance input — lets the swimmer log either a pool length
// plus a number of lengths (which auto-calculates total distance) or a plain
// distance, with a metre/km toggle so short pool swims and long open-water
// swims both read naturally.
function SwimDistanceFields({ theme, initial = {}, onChange }) {
  const t = themes[theme];
  const [unit, setUnit]               = React.useState(initial.distanceUnit || 'm');
  const [poolLength, setPoolLength]   = React.useState(initial.poolLengthM != null ? String(initial.poolLengthM) : '');
  const [lengths, setLengths]         = React.useState(initial.lengths != null ? String(initial.lengths) : '');
  const [manualDistance, setManualDistance] = React.useState(initial.distance != null ? String(initial.distance) : '');

  const usingPool = poolLength !== '' && lengths !== '';
  const computedMetres = usingPool ? (parseFloat(poolLength) || 0) * (parseFloat(lengths) || 0) : null;
  const computedDistance = computedMetres != null
    ? Number((unit === 'km' ? computedMetres / 1000 : computedMetres).toFixed(3))
    : null;

  React.useEffect(() => {
    onChange({
      distance: usingPool ? computedDistance : (manualDistance !== '' ? Number(manualDistance) : null),
      distanceUnit: unit,
      poolLengthM: poolLength !== '' ? Number(poolLength) : null,
      lengths: lengths !== '' ? Number(lengths) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, poolLength, lengths, manualDistance]);

  // Convert a manually-typed distance when the unit is flipped, so "5" (km)
  // becomes "5000" (m) instead of silently changing meaning.
  const switchUnit = (next) => {
    if (next === unit) return;
    if (!usingPool && manualDistance !== '') {
      const val = parseFloat(manualDistance);
      if (!isNaN(val)) {
        const converted = next === 'km' ? val / 1000 : val * 1000;
        setManualDistance(String(Number(converted.toFixed(3))));
      }
    }
    setUnit(next);
  };

  const inputStyle = {
    padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`,
    background: t.surface2, fontFamily: t.mono, fontSize: 15, color: t.text,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 11, color: t.text3, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>Distance unit</div>
        <div style={{ display: 'flex', background: t.surface2, borderRadius: 10, padding: 3, border: `1px solid ${t.border}` }}>
          {[['m', 'Metres'], ['km', 'Kilometres']].map(([val, label]) => (
            <button key={val} type="button" onClick={() => switchUnit(val)} style={{
              flex: 1, padding: '7px 8px', borderRadius: 8,
              background: unit === val ? t.bg : 'transparent',
              border: unit === val ? `1px solid ${t.border}` : '1px solid transparent',
              color: unit === val ? t.text : t.text2,
              fontFamily: t.sans, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={labelStyle}>Pool length (m)</div>
          <input type="number" min="0" step="1" placeholder="e.g. 25" value={poolLength}
            onChange={e => setPoolLength(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>Lengths</div>
          <input type="number" min="0" step="1" placeholder="e.g. 16" value={lengths}
            onChange={e => setLengths(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div>
        <div style={labelStyle}>
          Distance ({unit}) {usingPool && <span style={{ color: t.text3, fontWeight: 400, textTransform: 'none' }}>— auto-calculated</span>}
        </div>
        {usingPool ? (
          <div style={{ ...inputStyle, color: t.text2, background: t.surface }}>
            {computedDistance ?? 0}{unit}
          </div>
        ) : (
          <input type="number" min="0" step="0.01" placeholder={unit === 'km' ? 'e.g. 3.8' : 'e.g. 800'}
            value={manualDistance} onChange={e => setManualDistance(e.target.value)} style={inputStyle} />
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Generic elapsed-time timer for non-gym sessions (run, swim, rugby, ...) —
// no exercise queue, just start/pause/stop with an optional distance on finish.
function ActivityTimerScreen({ width = 390, height = 820, theme = 'light', session, setSession, onFinish, onDiscard, onNav,
                               tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const t = themes[theme];
  const elapsed = session.elapsed || 0;
  const paused  = session.paused  || false;
  const isSwim  = session.type === 'swim';
  const [showFinish, setShowFinish]   = React.useState(false);
  const [showDiscard, setShowDiscard] = React.useState(false);
  const [distance, setDistance]       = React.useState('');
  const [swimExtras, setSwimExtras]   = React.useState({ distance: null, distanceUnit: 'm', poolLengthM: null, lengths: null });

  const fmt = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  const inputStyle = {
    padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`,
    background: t.surface2, fontFamily: t.mono, fontSize: 15, color: t.text,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{
      width, height, background: t.bg, fontFamily: t.sans, color: t.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 22px 8px', fontSize: 14, fontWeight: 600,
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 20px 0' }}>
        <button onClick={() => setShowDiscard(true)} style={{
          background: 'transparent', border: 'none', color: t.text3,
          fontFamily: t.sans, fontSize: 13, cursor: 'pointer', padding: '6px 0',
        }}>Discard</button>
        {!paused && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PulseDot color={t.green} />
            <span style={{ fontSize: 11, color: t.text2, fontWeight: 600 }}>Recording</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ fontSize: 13, letterSpacing: '.16em', textTransform: 'uppercase', color: t.text3 }}>
          {session.workout || 'Session'}
        </div>
        <div style={{ fontFamily: t.mono, fontSize: 56, fontWeight: 600, color: t.text, letterSpacing: '.02em' }}>
          {fmt(elapsed)}
        </div>
        {paused && <div style={{ fontSize: 12, color: t.text3 }}>Paused</div>}
      </div>

      <div style={{ padding: '0 24px 28px', display: 'flex', gap: 12 }}>
        <button
          onClick={() => setSession(s => ({ ...s, paused: !s.paused }))}
          style={{
            flex: 1, padding: '16px', borderRadius: 16, border: `1.5px solid ${t.border}`,
            background: t.surface, color: t.text, fontFamily: t.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >{paused ? '▶ Resume' : '⏸ Pause'}</button>
        <button
          onClick={() => setShowFinish(true)}
          style={{
            flex: 1, padding: '16px', borderRadius: 16, border: 'none',
            background: '#DC2626', color: '#fff', fontFamily: t.sans, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >■ Stop</button>
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}/>

      {showFinish && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}
          onClick={() => setShowFinish(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '16px 20px 32px',
          }}>
            <div style={{ width: 38, height: 4, background: t.border, borderRadius: 99, margin: '0 auto 16px' }} />
            <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text, marginBottom: 14 }}>
              Finish {session.workout || 'session'}?
            </div>
            <div style={{ marginBottom: 16 }}>
              {isSwim ? (
                <SwimDistanceFields theme={theme} onChange={setSwimExtras} />
              ) : (
                <>
                  <div style={{ fontSize: 11, color: t.text3, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
                    Distance (km) <span style={{ color: t.text3, fontWeight: 400, textTransform: 'none' }}>— optional</span>
                  </div>
                  <input type="number" min="0" step="0.1" placeholder="e.g. 5.0" value={distance}
                    onChange={e => setDistance(e.target.value)} style={inputStyle} />
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowFinish(false)} style={{
                flex: 1, padding: '12px', borderRadius: 12, background: 'transparent',
                border: `1px solid ${t.border}`, color: t.text2, fontFamily: t.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Keep going</button>
              <button
                onClick={() => onFinish(isSwim ? swimExtras : { distance: distance !== '' ? Number(distance) : null, distanceUnit: 'km' })}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                  background: t.green, color: '#fff', fontFamily: t.sans, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >✓ Finish</button>
            </div>
          </div>
        </div>
      )}

      {showDiscard && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}
          onClick={() => setShowDiscard(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '16px 20px 32px',
          }}>
            <div style={{ width: 38, height: 4, background: t.border, borderRadius: 99, margin: '0 auto 16px' }} />
            <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text, marginBottom: 6 }}>Discard this session?</div>
            <div style={{ fontSize: 12.5, color: t.text3, marginBottom: 16 }}>
              {fmt(elapsed)} of recorded time will be lost.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowDiscard(false)} style={{
                flex: 1, padding: '12px', borderRadius: 12, background: 'transparent',
                border: `1px solid ${t.border}`, color: t.text2, fontFamily: t.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Keep going</button>
              <button onClick={onDiscard} style={{
                flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                background: '#DC2626', color: '#fff', fontFamily: t.sans, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Simple stubs for Food + Cycle so the bottom nav doesn't dead-end
function PlaceholderScreen({ width, height, theme, screen, onNav, tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const t = themes[theme];
  const screenInfo = {
    food:  { title: 'Food',  icon: '🍽', sub: 'Today\'s plate · Macros · Phase nutrition' },
    cycle: { title: 'Cycle', icon: '🌸', sub: 'Phase · Symptoms · Calendar' },
  }[screen];

  return (
    <div style={{
      width, height, background:t.bg, fontFamily:t.sans, color:t.text,
      display:'flex', flexDirection:'column', overflow:'hidden'
    }}>
      <div style={{
        height:44, display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        padding:'0 22px 8px', fontSize:14, fontWeight:600
      }}>
        <span>9:41</span>
        <div style={{ display:'flex', gap:5, alignItems:'center', fontSize:11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>
      <div style={{
        flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'0 40px', textAlign:'center'
      }}>
        <div style={{ fontSize:48, marginBottom:14, opacity:.6 }}>{screenInfo.icon}</div>
        <div style={{ fontFamily:t.serif, fontSize:28, color:t.text, marginBottom:6 }}>
          {screenInfo.title}
        </div>
        <div style={{ fontSize:12, color:t.text2, lineHeight:1.5, marginBottom:18 }}>
          {screenInfo.sub}
        </div>
        <div style={{
          padding:'9px 14px', borderRadius:9, border:`1px dashed ${t.border2}`,
          fontSize:10.5, color:t.text3, letterSpacing:'.06em'
        }}>
          Designed next — tap Home to return
        </div>
      </div>
      <BottomNav theme={theme} active={screen} onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}/>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Post-session summary screen
function GymSummaryScreen(props) {
  const { session } = props;
  const isGym = Array.isArray(session?.queue) && session.queue.length > 0;
  if (!isGym) return <ActivitySummaryScreen {...props} />;
  return <GymWorkoutSummaryScreen {...props} />;
}

// Post-session summary for a completed gym workout — sets/reps/weight/PRs.
function GymWorkoutSummaryScreen({ width = 390, height = 820, theme = 'light', session, onDone, onNav, tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const t = themes[theme];
  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const queue = session?.queue || [];
  const elapsed = session?.elapsed || 0;
  const workout = session?.workout || 'Push day';

  const exercisesDone = queue.filter(e => (e.sets||[]).some(s => s.done));
  const setsDone = queue.reduce((n,e) => n + (e.sets||[]).filter(s=>s.done).length, 0);
  const totalSets = queue.reduce((n,e) => n + e.targetSets, 0);
  const totalVolume = queue.reduce((sum, e) => {
    return sum + (e.sets||[]).filter(s => s.done).reduce((v, s) => {
      if (e.unilateral) return v + ((s.wR||0)*(s.rR||0)) + ((s.wL||0)*(s.rL||0));
      return v + ((s.w||0)*(s.r||0));
    }, 0);
  }, 0);
  const prHits = queue.filter(e => e.isPR && (e.sets||[]).some(s => s.done)).length;
  const completionPct = totalSets ? Math.round((setsDone/totalSets) * 100) : 0;

  return (
    <div style={{
      width, height, background:t.bg, fontFamily:t.sans, color:t.text,
      display:'flex', flexDirection:'column', overflow:'hidden', position:'relative'
    }}>
      <div style={{
        height:44, display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        padding:'0 22px 8px', fontSize:14, fontWeight:600
      }}>
        <span>9:41</span>
        <div style={{ display:'flex', gap:5, alignItems:'center', fontSize:11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px 16px' }} className="phone-scroll">

        {/* Celebrate header */}
        <div style={{ textAlign:'center', padding:'14px 0 22px' }}>
          <div style={{
            width:56, height:56, borderRadius:'50%',
            background:`linear-gradient(135deg, ${t.green}, ${t.accent})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 12px', fontSize:26, color:'#fff',
            boxShadow: `0 8px 24px ${t.accent}30`
          }}>✓</div>
          <div style={{
            fontSize:10.5, letterSpacing:'.18em', textTransform:'uppercase',
            color:t.text3, marginBottom:4, fontWeight:500
          }}>
            {completionPct >= 100 ? 'Workout complete' : 'Workout saved'}
          </div>
          <div style={{ fontFamily:t.serif, fontSize:30, color:t.text, lineHeight:1.1, marginBottom:5 }}>
            {workout}
          </div>
          <div style={{ fontSize:12, color:t.text2 }}>
            {completionPct >= 100
              ? `All ${totalSets} sets logged. Strong work.`
              : `${setsDone} of ${totalSets} sets logged`}
          </div>
        </div>

        {/* Big stats */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8, marginBottom:14
        }}>
          {[
            { label: 'Duration',    value: fmt(elapsed),                   sub: 'time on bar',     color: t.text  },
            { label: 'Volume',      value: totalVolume.toLocaleString(),    sub: 'kg lifted',       color: t.accent },
            { label: 'Sets logged', value: `${setsDone}/${totalSets}`,      sub: `${completionPct}% complete`, color: t.green },
            { label: 'PRs hit',     value: prHits.toString(),               sub: prHits ? '★ new best' : 'next session', color: prHits ? '#B45309' : t.text3 },
          ].map((s,i) => (
            <div key={i} style={{
              background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
              padding:'12px 14px'
            }}>
              <div style={{
                fontSize:9.5, letterSpacing:'.12em', color:t.text3,
                textTransform:'uppercase', marginBottom:4
              }}>{s.label}</div>
              <div style={{
                fontFamily:t.serif, fontSize:24, color:s.color, lineHeight:1,
                fontVariantNumeric:'tabular-nums'
              }}>{s.value}</div>
              <div style={{ fontSize:10, color:t.text3, marginTop:3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Exercise breakdown */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:18,
          marginBottom:14, overflow:'hidden'
        }}>
          <div style={{
            padding:'12px 16px 8px',
            fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
            color:t.text3, borderBottom:`1px solid ${t.border}`
          }}>
            Exercises
          </div>
          {queue.map((e, i) => {
            const doneSets = (e.sets||[]).filter(s => s.done);
            const best = doneSets.reduce((b, s) => {
              const w = e.unilateral ? Math.max(s.wR||0, s.wL||0) : (s.w||0);
              const r = e.unilateral ? (s.rR||0) : (s.r||0);
              if (!b) return { w, r };
              if (w > b.w || (w === b.w && r > b.r)) return { w, r };
              return b;
            }, null);
            const isDone = doneSets.length > 0;
            return (
              <div key={e.id} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 16px',
                borderBottom: i < queue.length - 1 ? `1px solid ${t.border}` : 'none',
                opacity: isDone ? 1 : 0.45
              }}>
                <div style={{
                  width:20, height:20, borderRadius:'50%',
                  background: isDone ? t.green+'25' : t.surface2,
                  color: isDone ? t.green : t.text3,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, flexShrink:0
                }}>
                  {isDone ? '✓' : i+1}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{
                    fontSize:13, color:t.text, display:'flex', alignItems:'center', gap:6
                  }}>
                    {e.name}
                    {e.unilateral && isDone && (
                      <span style={{ fontSize:9, color:t.accent, fontWeight:600, letterSpacing:'.04em' }}>R/L</span>
                    )}
                    {e.isPR && isDone && (
                      <span style={{ fontSize:9, color:t.accent, fontWeight:600, letterSpacing:'.04em' }}>★ PR</span>
                    )}
                  </div>
                  <div style={{ fontSize:10.5, color:t.text3 }}>
                    {isDone
                      ? `${doneSets.length} sets · best ${best?.w}kg × ${best?.r}`
                      : `${e.targetSets} sets planned — skipped`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Notes */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
          padding:'12px 14px', marginBottom:14
        }}>
          <div style={{
            fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
            color:t.text3, marginBottom:6
          }}>
            Session notes
          </div>
          <textarea placeholder="How did it feel? Any tweaks for next time?"
            style={{
              width:'100%', minHeight:64, border:'none', resize:'vertical',
              fontFamily:t.sans, fontSize:12.5, color:t.text,
              background:'transparent', outline:'none',
              lineHeight:1.5
            }}/>
        </div>

        <button onClick={onDone} style={{
          width:'100%', padding:'14px', borderRadius:13,
          background: t.accent, color: t.accentText,
          border:'none', fontFamily:t.sans, fontSize:14, fontWeight:600,
          cursor:'pointer'
        }}>
          Save & back to home
        </button>
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}/>
    </div>
  );
}

function fmtElapsedLong(s = 0) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${m}:${String(sec).padStart(2,'0')}`;
}

// Post-session summary for a completed non-gym activity (run, swim, yoga,
// ...) — shows only what was actually logged (duration/distance/pool
// lengths), never gym sets/reps/weight/PR fields.
function ActivitySummaryScreen({ width = 390, height = 820, theme = 'light', session, onDone, onNav, tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const t = themes[theme];
  const elapsed = session?.elapsed || 0;
  const workout = session?.workout || 'Session';
  const unit = session?.distanceUnit || 'km';
  const hasDistance = session?.distance != null;
  const hasPool = session?.lengths != null && session?.poolLengthM != null;

  const stats = [
    { label: 'Duration', value: fmtElapsedLong(elapsed), sub: 'time recorded', color: t.text },
  ];
  if (hasDistance) {
    stats.push({ label: 'Distance', value: `${session.distance}${unit}`, sub: hasPool ? 'total logged' : 'logged', color: t.accent });
  }
  if (hasPool) {
    stats.push({ label: 'Pool', value: `${session.lengths} × ${session.poolLengthM}m`, sub: 'lengths swum', color: t.green });
  }

  const subline = [
    fmtElapsedLong(elapsed) + ' elapsed',
    hasDistance ? `${session.distance}${unit} logged` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{
      width, height, background:t.bg, fontFamily:t.sans, color:t.text,
      display:'flex', flexDirection:'column', overflow:'hidden', position:'relative'
    }}>
      <div style={{
        height:44, display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        padding:'0 22px 8px', fontSize:14, fontWeight:600
      }}>
        <span>9:41</span>
        <div style={{ display:'flex', gap:5, alignItems:'center', fontSize:11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px 16px' }} className="phone-scroll">

        {/* Celebrate header */}
        <div style={{ textAlign:'center', padding:'14px 0 22px' }}>
          <div style={{
            width:56, height:56, borderRadius:'50%',
            background:`linear-gradient(135deg, ${t.green}, ${t.accent})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 12px', fontSize:26, color:'#fff',
            boxShadow: `0 8px 24px ${t.accent}30`
          }}>✓</div>
          <div style={{
            fontSize:10.5, letterSpacing:'.18em', textTransform:'uppercase',
            color:t.text3, marginBottom:4, fontWeight:500
          }}>
            Session complete
          </div>
          <div style={{ fontFamily:t.serif, fontSize:30, color:t.text, lineHeight:1.1, marginBottom:5 }}>
            {workout}
          </div>
          <div style={{ fontSize:12, color:t.text2 }}>{subline}</div>
        </div>

        {/* Big stats */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8, marginBottom:14
        }}>
          {stats.map((s,i) => (
            <div key={i} style={{
              background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
              padding:'12px 14px'
            }}>
              <div style={{
                fontSize:9.5, letterSpacing:'.12em', color:t.text3,
                textTransform:'uppercase', marginBottom:4
              }}>{s.label}</div>
              <div style={{
                fontFamily:t.serif, fontSize:24, color:s.color, lineHeight:1,
                fontVariantNumeric:'tabular-nums'
              }}>{s.value}</div>
              <div style={{ fontSize:10, color:t.text3, marginTop:3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
          padding:'12px 14px', marginBottom:14
        }}>
          <div style={{
            fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
            color:t.text3, marginBottom:6
          }}>
            Session notes
          </div>
          <textarea placeholder="How did it feel? Any tweaks for next time?"
            style={{
              width:'100%', minHeight:64, border:'none', resize:'vertical',
              fontFamily:t.sans, fontSize:12.5, color:t.text,
              background:'transparent', outline:'none',
              lineHeight:1.5
            }}/>
        </div>

        <button onClick={onDone} style={{
          width:'100%', padding:'14px', borderRadius:13,
          background: t.accent, color: t.accentText,
          border:'none', fontFamily:t.sans, fontSize:14, fontWeight:600,
          cursor:'pointer'
        }}>
          Save & back to home
        </button>
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}/>
    </div>
  );
}

export { GYM_QUEUE, GymSessionScreen, GymSummaryScreen, ActivityTimerScreen, PlaceholderScreen, NumberInput, SwimDistanceFields };
