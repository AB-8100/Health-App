// In-session gym screen — what you see mid-workout
// Shows current exercise, set tracker with inline weight/reps logging, rest timer,
// and a queue of remaining exercises.

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
    sets: [],  // seeded fresh on session start
  },
  { id: 'ohp',      name: 'Overhead press',   muscle: 'Shoulders',  targetSets: 4, targetWeight: 37.5, targetReps: 9,  lastWeek: '37.5 × 8',  sets: [] },
  { id: 'incline',  name: 'Incline DB press', muscle: 'Upper chest',targetSets: 3, targetWeight: 26,   targetReps: 10, lastWeek: '24 × 12',   sets: [] },
  { id: 'lateral',  name: 'Lateral raises',   muscle: 'Shoulders',  targetSets: 3, targetWeight: 12,   targetReps: 15, lastWeek: '12 × 15',   sets: [] },
  { id: 'tricep',   name: 'Tricep pushdown',  muscle: 'Triceps',    targetSets: 3, targetWeight: 45,   targetReps: 12, lastWeek: '45 × 12',   sets: [] },
  { id: 'skulls',   name: 'Skull crushers',   muscle: 'Triceps',    targetSets: 3, targetWeight: 22.5, targetReps: 12, lastWeek: '22.5 × 12', sets: [] },
];

function GymSessionScreen({ width = 390, height = 820, theme = 'light', session, setSession, onNav, onExit, onComplete, tracksCycle = true }) {
  const t = themes[theme];

  // Seed all exercises with blank sets on session start.
  // This ensures the user enters their own reps — nothing is pre-filled.
  React.useEffect(() => {
    if (!session.queue) {
      const seeded = GYM_QUEUE.map(ex => ({
        ...ex,
        sets: Array.from({ length: ex.targetSets }, () => ({ w: null, r: null, done: false }))
      }));
      setSession(s => ({ ...s, queue: seeded, exIdx: 0 }));
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const queue   = session.queue   || GYM_QUEUE;
  const exIdx   = session.exIdx   || 0;
  const elapsed = session.elapsed || 0;
  const paused  = session.paused  || false;

  // Local UI state only
  const [restSec, setRestSec] = React.useState(0);
  const [showEndConfirm, setShowEndConfirm] = React.useState(false);

  // rest countdown (local — resets on nav, that's OK)
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

  const updateSet = (i, field, value) => {
    const next = queue.slice();
    const sets = next[exIdx].sets.slice();
    sets[i] = { ...sets[i], [field]: value };
    next[exIdx] = { ...next[exIdx], sets };
    setSession(s => ({ ...s, queue: next }));
  };
  const logSet = () => {
    if (curSetIdx < 0) return;
    const next = queue.slice();
    const sets = next[exIdx].sets.slice();
    const s = sets[curSetIdx];
    sets[curSetIdx] = {
      w: s.w ?? cur.targetWeight,
      r: s.r ?? cur.targetReps,
      done: true,
    };
    next[exIdx] = { ...next[exIdx], sets };
    setSession(sn => ({ ...sn, queue: next }));
    setRestSec(90);

    // Auto-advance to next exercise if this was the last set
    if (curSetIdx === sets.length - 1) {
      for (let i = exIdx + 1; i < next.length; i++) {
        // Auto-seed missing sets
        if (!next[i].sets || next[i].sets.length === 0) {
          const seeded = Array.from({ length: next[i].targetSets }, () => ({ w: null, r: null, done: false }));
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
  const togglePause = () => setSession(s => ({ ...s, paused: !s.paused }));
  const finishSession = () => {
    setShowEndConfirm(false);
    if (onComplete) onComplete({ queue, elapsed, workout: session.workout });
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
        <button onClick={() => {
          // If mid-session, show confirm sheet rather than silently leaving.
          if (session.active) { setShowEndConfirm(true); }
          else { onExit && onExit(); }
        }} style={{
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
              Push day
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
                {cur.muscle} · Last week: {cur.lastWeek}
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
            display:'grid', gridTemplateColumns:'40px 1fr 1fr 40px', gap:0,
            padding:'10px 16px 8px',
            fontSize:9.5, letterSpacing:'.12em', color:t.text3, textTransform:'uppercase',
            borderBottom:`1px solid ${t.border}`
          }}>
            <span>Set</span>
            <span style={{ textAlign:'center' }}>Weight</span>
            <span style={{ textAlign:'center' }}>Reps</span>
            <span></span>
          </div>
          {(cur.sets||[]).map((s,i) => {
            const isCurrent = i === curSetIdx;
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

                {/* Weight cell */}
                <div style={{ display:'flex', justifyContent:'center' }}>
                  {s.done ? (
                    <span style={{ fontFamily:t.mono, fontSize:14, color:t.text2 }}>
                      {s.w}<span style={{ fontSize:10, color:t.text3 }}>kg</span>
                    </span>
                  ) : isCurrent ? (
                    <NumberInput
                      value={s.w ?? cur.targetWeight}
                      onChange={(v) => updateSet(i, 'w', v)}
                      step={2.5} suffix="kg" theme={theme}
                    />
                  ) : (
                    <span style={{ fontSize:13, color:t.text3 }}>
                      {cur.targetWeight}<span style={{ fontSize:10 }}>kg</span>
                    </span>
                  )}
                </div>

                {/* Reps cell */}
                <div style={{ display:'flex', justifyContent:'center' }}>
                  {s.done ? (
                    <span style={{ fontFamily:t.mono, fontSize:14, color:t.text2 }}>
                      ×{s.r}
                    </span>
                  ) : isCurrent ? (
                    <NumberInput
                      value={s.r ?? cur.targetReps}
                      onChange={(v) => updateSet(i, 'r', v)}
                      step={1} prefix="×" theme={theme}
                    />
                  ) : (
                    <span style={{ fontSize:13, color:t.text3 }}>
                      ×{cur.targetReps}
                    </span>
                  )}
                </div>

                <div style={{ textAlign:'center' }}>
                  {s.done ? (
                    <span style={{
                      width:22, height:22, display:'inline-flex', alignItems:'center',
                      justifyContent:'center', borderRadius:'50%',
                      background:t.green+'20', color:t.green, fontSize:13
                    }}>✓</span>
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

        {/* Rest timer (visible when active) */}
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
              <div style={{ fontSize:12.5, color:t.text }}>{e.name}</div>
              <div style={{ fontSize:10, color:t.text3 }}>{e.muscle} · {e.targetSets} sets</div>
            </div>
            <div style={{ fontFamily:t.mono, fontSize:11, color:t.text2 }}>
              {e.targetWeight}kg × {e.targetReps}
            </div>
          </div>
        ))}
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle}/>

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
              You've logged <strong style={{ color:t.text }}>{totalDone} of {totalSets} sets</strong> ({fmt(elapsed)} elapsed). Your progress will be saved.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setShowEndConfirm(false)} style={{
                flex:1, padding:'12px', borderRadius:11, background:'transparent',
                border:`1px solid ${t.border2}`, color:t.text,
                fontFamily:t.sans, fontSize:13, fontWeight:500, cursor:'pointer'
              }}>Keep going</button>
              <button onClick={finishSession} style={{
                flex:1, padding:'12px', borderRadius:11,
                background:'#BE3B2E', color:'#fff',
                border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer'
              }}>End & save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline numeric stepper for set logging
function NumberInput({ value, onChange, step = 1, prefix = '', suffix = '', theme = 'light' }) {
  const t = themes[theme];
  return (
    <div style={{
      display:'inline-flex', alignItems:'center',
      background:t.bg, border:`1px solid ${t.border2}`, borderRadius:8,
      overflow:'hidden'
    }}>
      <button onClick={() => onChange(Number((value - step).toFixed(2)))} style={{
        width:24, height:28, background:'transparent', border:'none',
        color:t.text2, fontSize:14, cursor:'pointer', fontFamily:t.sans
      }}>−</button>
      <span style={{
        minWidth:42, textAlign:'center', fontFamily:t.mono, fontSize:13,
        color:t.text, fontVariantNumeric:'tabular-nums'
      }}>
        {prefix}{value}<span style={{ fontSize:9, color:t.text3 }}>{suffix}</span>
      </span>
      <button onClick={() => onChange(Number((value + step).toFixed(2)))} style={{
        width:24, height:28, background:'transparent', border:'none',
        color:t.text2, fontSize:14, cursor:'pointer', fontFamily:t.sans
      }}>+</button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Simple stubs for Food + Cycle so the bottom nav doesn't dead-end
function PlaceholderScreen({ width, height, theme, screen, onNav, tracksCycle = true }) {
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
      <BottomNav theme={theme} active={screen} onNav={onNav} tracksCycle={tracksCycle}/>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Post-session summary screen
function GymSummaryScreen({ width = 390, height = 820, theme = 'light', session, onDone, onNav, tracksCycle = true }) {
  const t = themes[theme];
  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const queue = session?.queue || [];
  const elapsed = session?.elapsed || 0;
  const workout = session?.workout || 'Push day';

  // compute stats
  const exercisesDone = queue.filter(e => (e.sets||[]).some(s => s.done));
  const setsDone = queue.reduce((n,e) => n + (e.sets||[]).filter(s=>s.done).length, 0);
  const totalSets = queue.reduce((n,e) => n + e.targetSets, 0);
  const totalVolume = queue.reduce((sum, e) => {
    return sum + (e.sets||[])
      .filter(s => s.done)
      .reduce((v, s) => v + ((s.w || 0) * (s.r || 0)), 0);
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
              if (!b) return s;
              if ((s.w || 0) > (b.w || 0)) return s;
              if ((s.w || 0) === (b.w || 0) && (s.r || 0) > (b.r || 0)) return s;
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
                    {e.isPR && isDone && (
                      <span style={{
                        fontSize:9, color:t.accent, fontWeight:600, letterSpacing:'.04em'
                      }}>★ PR</span>
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

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle}/>
    </div>
  );
}

window.GymSummaryScreen = GymSummaryScreen;

window.GymSessionScreen = GymSessionScreen;
window.PlaceholderScreen = PlaceholderScreen;
