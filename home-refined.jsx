// Refined Home — single design, light + dark themes
// Iteration on user feedback:
//   - Editorial Warm (light) primary, Dark Premium as dark-mode swap
//   - Today's focus rotates (workout / nutrition / self-care)
//   - Rings: Steps, Protein, Sleep (water removed)
//   - "Sessions this week" — activity-agnostic (gym/run/swim/yoga)
//   - Hydration as a contextual nudge, not a tracked metric

// ────────────────────────────────────────────────────────────
const themes = {
  light: {
    bg: '#F4F2EE',
    surface: '#FFFFFF',
    surface2: '#FAF8F4',
    border: '#EAE6DE',
    border2: '#E0DCD2',
    text: '#1C1917',
    text2: '#6B6560',
    text3: '#A8A39C',
    accent: '#BE5A38',       // terracotta
    accentText: '#FFFFFF',
    accentSoft: '#FBEAE1',
    invSurface: '#1C1917',
    invText: '#F4F2EE',
    invText2: '#C9C0B5',
    steps: '#BE5A38',
    prot: '#B45309',
    sleep: '#6D4AAF',
    rose: '#BE185D',
    green: '#15803D',
    blue: '#1D4ED8',
    serif: "'DM Serif Display', serif",
    sans: "'DM Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  dark: {
    bg: '#0B0B0E',
    surface: '#15151A',
    surface2: '#1D1D24',
    border: '#23232B',
    border2: '#2C2C36',
    text: '#F2F0EB',
    text2: '#8A8893',
    text3: '#55555F',
    accent: '#D4A574',       // champagne gold
    accentText: '#1A1108',
    accentSoft: '#2A2117',
    invSurface: '#F2F0EB',
    invText: '#1C1917',
    invText2: '#6B6560',
    steps: '#D4A574',
    prot: '#E08FB1',
    sleep: '#B8A0E5',
    rose: '#E08FB1',
    green: '#7FC998',
    blue: '#7BB3E8',
    serif: "'DM Serif Display', serif",
    sans: "'DM Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  }
};

// ────────────────────────────────────────────────────────────
// Today's focus — rotates between workout / nutrition / self-care
const FOCUS_CARDS = [
  {
    id: 'workout',
    tag: 'Push day',
    icon: '🏋️',
    titleParts: ['Go for the ', { accent: '57.5kg' }, ' bench today.'],
    body: 'You hit 55×10 last week. Follicular peak — strength window is open.',
    cta: 'Start session',
    arrow: '→',
  },
  {
    id: 'nutrition',
    tag: 'Nutrition',
    icon: '🥬',
    titleParts: ['Iron up — ', { accent: '4× this week.' }],
    body: "Spinach, lentils, red meat. You're 6 days post-period — replenish stores.",
    cta: 'See foods',
    arrow: '→',
  },
  {
    id: 'sleep-alert',
    tag: 'Heads up',
    icon: '💤',
    titleParts: ['Sleep average has dropped to ', { accent: '6.8h.' }],
    body: '5 of the last 7 nights below your 7h target. Recovery dips Thu — try lights-out at 10:30 tonight.',
    cta: 'Set wind-down',
    arrow: '→',
    triggeredBy: 'sleep_avg_7d < 7h',
  },
];

// Bar sparkline for sessions-per-week
function BarSpark({ data, color, max, width=130, height=28, gap=3, dimColor }) {
  const barW = (width - gap * (data.length - 1)) / data.length;
  const m = max || Math.max(...data) || 1;
  return (
    <svg width={width} height={height} style={{ display:'block' }}>
      {data.map((v,i) => {
        const h = Math.max(2, (v/m) * height);
        const isLast = i === data.length - 1;
        return (
          <rect key={i}
            x={i*(barW+gap)} y={height-h} width={barW} height={h}
            fill={isLast ? color : (dimColor || color)}
            opacity={isLast ? 1 : 0.5}
            rx={1.5}/>
        );
      })}
    </svg>
  );
}

// Activity glyph (small inline icon)
function ActivityIcon({ kind, size=14, color='currentColor' }) {
  const paths = {
    gym:   'M4 9 L4 15 M8 7 L8 17 M16 7 L16 17 M20 9 L20 15 M8 12 L16 12',
    run:   'M13 4 a1.5 1.5 0 1 0 0 -3 a1.5 1.5 0 1 0 0 3 M8 21 L11 13 L9 11 L13 7 L17 11 L20 11 M5 17 L9 13',
    swim:  'M2 17 Q5 14 8 17 T14 17 T20 17 M2 13 Q5 10 8 13 T14 13 T20 13 M14 7 a2 2 0 1 0 0 -4 M14 7 L9 9',
    yoga:  'M12 4 a2 2 0 1 0 0 -2 a2 2 0 1 0 0 2 M12 7 V12 M12 12 L7 20 M12 12 L17 20 M6 11 L18 11',
    walk:  'M13 4 a1.5 1.5 0 1 0 0 -3 a1.5 1.5 0 1 0 0 3 M10 21 L13 13 L10 10 L13 6 L17 9 V14 M7 17 L10 13',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[kind] || paths.gym}/>
    </svg>
  );
}

const SESSIONS_WEEKS = [2, 3, 2, 4, 3, 3, 2, 3]; // last 8 weeks
const THIS_WEEK_SESSIONS = [
  { kind: 'gym',  name: 'Pull day',  day: 'Mon', dur: '52m' },
  { kind: 'run',  name: '5K easy',   day: 'Wed', dur: '28m' },
  { kind: 'gym',  name: 'Legs',      day: 'Fri', dur: '58m' },
];

// ────────────────────────────────────────────────────────────
function RefinedHome({ width = 390, height = 820, theme = 'light', onNav, onStartSession, activeSession, onResumeSession, profile }) {
  const t = themes[theme];
  const tracksCycle = profile ? profile.tracksCycle : true;
  const userName = profile?.name || 'Sam';

  // If user doesn't track cycle, drop the cycle-flavored content from focus rotation
  const visibleFocusCards = tracksCycle
    ? FOCUS_CARDS
    : FOCUS_CARDS.map(c => {
        if (c.id === 'workout') return {
          ...c,
          body: "You hit 55×10 last week — and you've had two full recovery days. Today's the day.",
        };
        if (c.id === 'nutrition') return {
          ...c,
          tag:'Nutrition',
          titleParts:['Hit your ', { accent:'140g protein' }, ' target.'],
          body:"You've averaged 122g over 7 days. Add a shake or extra portion at lunch.",
        };
        return c;
      });

  const [focusIdx, setFocusIdx] = React.useState(0);
  const focus = visibleFocusCards[focusIdx % visibleFocusCards.length];

  const ringsRefined = [
    { id: 'steps', label: 'Steps',   value: 7840, goal: 10000, unit: '',  color: t.steps },
    { id: 'prot',  label: 'Protein', value: 112,  goal: 140,   unit: 'g', color: t.prot  },
    { id: 'sleep', label: 'Sleep',   value: 7.2,  goal: 8,     unit: 'h', color: t.sleep },
  ];

  // Style helper to wire "em data-em='accent'" inside titles to the theme accent
  const titleStyle = { fontFamily:t.serif, fontSize:25, lineHeight:1.12, color:t.text, fontStyle:'normal', letterSpacing:'-.01em' };
  const accentEm = { color: t.accent, fontStyle:'normal' };

  return (
    <div style={{
      width, height, background:t.bg, fontFamily:t.sans, color:t.text,
      display:'flex', flexDirection:'column', overflow:'hidden', position:'relative'
    }}>
      {/* Subtle ambient glow for dark theme */}
      {theme === 'dark' && (
        <>
          <div style={{
            position:'absolute', top:-60, left:-40, width:240, height:240, borderRadius:'50%',
            background:`radial-gradient(circle, ${t.accent}22, transparent 65%)`, pointerEvents:'none'
          }}/>
          <div style={{
            position:'absolute', top:260, right:-100, width:300, height:300, borderRadius:'50%',
            background:`radial-gradient(circle, ${t.rose}15, transparent 65%)`, pointerEvents:'none'
          }}/>
        </>
      )}

      {/* Status bar */}
      <div style={{
        height:44, display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        padding:'0 22px 8px', fontSize:14, fontWeight:600, color:t.text, position:'relative'
      }}>
        <span>9:41</span>
        <div style={{ display:'flex', gap:5, alignItems:'center', fontSize:11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'4px 20px 14px', position:'relative' }}
           className="phone-scroll">

        {/* Active session banner */}
        {activeSession && (
          <div onClick={onResumeSession} style={{
            background: theme==='dark' ? t.surface : '#FFF',
            border: `1.5px solid ${t.accent}`,
            borderRadius:14, padding:'10px 14px',
            display:'flex', alignItems:'center', gap:11,
            marginTop:6, marginBottom:14, cursor:'pointer',
            boxShadow: theme==='dark' ? `0 0 16px ${t.accent}20` : `0 4px 14px ${t.accent}18`,
          }}>
            <div style={{
              width:34, height:34, borderRadius:10,
              background: t.accent + '18',
              color: t.accent, display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0
            }}>
              {activeSession.paused ? (
                <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="2.5" y="2" width="2.5" height="8" rx="1"/>
                  <rect x="7" y="2" width="2.5" height="8" rx="1"/>
                </svg>
              ) : (
                <PulseDot color={t.accent} size={9}/>
              )}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{
                fontSize:9, letterSpacing:'.16em', textTransform:'uppercase',
                color: activeSession.paused ? '#B45309' : t.accent,
                fontWeight:600, marginBottom:1
              }}>
                {activeSession.paused ? 'Paused' : 'In progress'}
              </div>
              <div style={{ fontSize:13, color:t.text, fontWeight:500, display:'flex', alignItems:'baseline', gap:8 }}>
                {activeSession.workout || 'Workout'}
                <span style={{ fontFamily:t.mono, fontSize:12, color:t.text2, fontVariantNumeric:'tabular-nums' }}>
                  {`${Math.floor(activeSession.elapsed/60)}:${String(activeSession.elapsed%60).padStart(2,'0')}`}
                </span>
              </div>
            </div>
            <div style={{
              padding:'7px 12px', borderRadius:9, background:t.accent, color:t.accentText,
              fontSize:11, fontWeight:600, fontFamily:t.sans,
              display:'flex', alignItems:'center', gap:5
            }}>
              Resume →
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:18 }}>
          <div>
            <div style={{
              fontSize:9.5, letterSpacing:'.18em', textTransform:'uppercase',
              color:t.text3, marginBottom:3
            }}>
              Tuesday · 26 May
            </div>
            <div style={{ fontFamily:t.serif, fontSize:28, lineHeight:1, color:t.text }}>
              Morning, {userName}.
            </div>
          </div>
          {tracksCycle ? (
            <div style={{
              padding:'4px 9px', borderRadius:999,
              border:`1px solid ${theme==='dark' ? t.border2 : t.border}`,
              background:theme==='dark' ? t.surface : '#FFF',
              fontSize:10, color:t.text2, display:'flex', alignItems:'center', gap:5
            }}>
              <span style={{
                width:6, height:6, borderRadius:'50%', background:t.rose,
                boxShadow: theme==='dark' ? `0 0 6px ${t.rose}` : 'none'
              }}/>
              Day 8 · Follicular
            </div>
          ) : (
            <div style={{
              padding:'4px 9px', borderRadius:999,
              border:`1px solid ${theme==='dark' ? t.border2 : t.border}`,
              background:theme==='dark' ? t.surface : '#FFF',
              fontSize:10, color:t.text2, display:'flex', alignItems:'center', gap:5
            }}>
              <span style={{
                width:6, height:6, borderRadius:'50%', background:t.green,
              }}/>
              {profile?.goal === 'strength' ? 'Strength block · Wk 4' :
               profile?.goal === 'muscle'   ? 'Hypertrophy · Wk 4' :
               profile?.goal === 'fat-loss' ? 'Cut · Wk 4' : 'Wk 4'}
            </div>
          )}
        </div>

        {/* TODAY'S FOCUS — rotating coach card */}
        <div style={{
          background: theme==='dark'
            ? `linear-gradient(135deg, ${t.surface} 0%, ${t.surface2} 100%)`
            : t.invSurface,
          border: theme==='dark' ? `1px solid ${t.border2}` : 'none',
          color: theme==='dark' ? t.text : t.invText,
          borderRadius:20, padding:'18px 20px 16px',
          marginBottom:14, position:'relative', overflow:'hidden'
        }}>
          {/* glow line top */}
          {theme==='dark' && (
            <div style={{
              position:'absolute', top:0, left:0, right:0, height:1,
              background:`linear-gradient(90deg, transparent, ${t.accent}80, transparent)`
            }}/>
          )}
          {theme==='light' && (
            <div style={{
              position:'absolute', top:-30, right:-30, width:140, height:140, borderRadius:'50%',
              background:`radial-gradient(circle, ${t.accent}35, transparent 70%)`,
              pointerEvents:'none'
            }}/>
          )}

          {/* Tag row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <PulseDot color={t.accent} size={6}/>
              <span style={{
                fontSize:9.5, letterSpacing:'.18em', color:t.accent,
                textTransform:'uppercase', fontWeight:500
              }}>
                Today's focus · {focus.tag}
              </span>
            </div>
            {/* dots */}
            <div style={{ display:'flex', gap:4 }}>
              {visibleFocusCards.map((_,i) => (
                <button key={i} onClick={()=>setFocusIdx(i)} style={{
                  width:14, height:3, borderRadius:2, border:'none', cursor:'pointer',
                  background: i===focusIdx
                    ? (theme==='dark' ? t.text : t.invText)
                    : (theme==='dark' ? t.text3 + '60' : t.invText2 + '40')
                }}/>
              ))}
            </div>
          </div>

          {/* Title with accent em */}
          <div style={{ ...titleStyle, color: theme==='dark' ? t.text : t.invText, marginBottom:8, position:'relative', maxWidth:'94%' }}>
            {focus.titleParts.map((part, i) => {
              if (typeof part === 'string') return <React.Fragment key={i}>{part}</React.Fragment>;
              return <span key={i} style={accentEm}>{part.accent}</span>;
            })}
          </div>

          <div style={{
            fontSize:12, lineHeight:1.55,
            color: theme==='dark' ? t.text2 : t.invText2,
            marginBottom:14, position:'relative'
          }}>
            {focus.body}
          </div>

          <div style={{ display:'flex', gap:8, position:'relative' }}>
            <button onClick={() => {
              if (focus.id === 'workout' && onStartSession) onStartSession();
            }} style={{
              flex:1, padding:'11px 14px', borderRadius:11,
              background:t.accent, color:t.accentText,
              border:'none', fontFamily:t.sans, fontSize:12.5, fontWeight:600,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6
            }}>
              {focus.cta} <span style={{ fontSize:14 }}>{focus.arrow}</span>
            </button>
            <button style={{
              padding:'11px 14px', borderRadius:11, background:'transparent',
              border:`1px solid ${theme==='dark' ? t.border2 : '#FFFFFF30'}`,
              color: theme==='dark' ? t.text2 : t.invText2,
              cursor:'pointer', fontSize:12, fontFamily:t.sans
            }}>Later</button>
          </div>
        </div>

        {/* Rings card — Steps / Protein / Sleep */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:20,
          padding:'16px 18px', marginBottom:12, display:'flex', gap:18, alignItems:'center'
        }}>
          <div style={{
            flexShrink:0,
            filter: theme==='dark' ? 'drop-shadow(0 0 12px rgba(212,165,116,.15))' : 'none'
          }}>
            <StackedRings size={120} stroke={11} gap={3} rings={ringsRefined}/>
          </div>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:11 }}>
            {ringsRefined.map((r,i) => {
              const pct = Math.round((r.value/r.goal)*100);
              return (
                <div key={r.id}>
                  <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:2 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <span style={{
                        width:7, height:7, borderRadius:'50%', background:r.color,
                        boxShadow: theme==='dark' ? `0 0 6px ${r.color}80` : 'none'
                      }}/>
                      <span style={{ fontSize:11, color:t.text2, letterSpacing:'.02em' }}>{r.label}</span>
                    </div>
                    <span style={{ fontSize:10.5, color:t.text3, fontVariantNumeric:'tabular-nums' }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{
                    fontFamily:t.serif, fontSize:17, color:t.text, lineHeight:1,
                    fontVariantNumeric:'tabular-nums'
                  }}>
                    <AnimatedNumber value={r.value}
                      decimals={Number.isInteger(r.value)?0:1}
                      duration={900+i*120}/>
                    <span style={{ fontSize:11, color:t.text3, fontFamily:t.sans, marginLeft:3 }}>
                      / {r.goal.toLocaleString()}{r.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SESSIONS — activity-agnostic */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:20,
          padding:'16px 18px 14px', marginBottom:12
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
            <div>
              <div style={{
                fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
                color:t.text3, marginBottom:3
              }}>
                Sessions this week
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontFamily:t.serif, fontSize:30, color:t.text, lineHeight:1 }}>
                  <AnimatedNumber value={3} duration={700}/>
                </span>
                <span style={{ fontSize:11, color:t.text3 }}>of 4 planned</span>
              </div>
              <div style={{ fontSize:10.5, color:t.green, marginTop:3, fontWeight:500 }}>
                ↑ +1 vs 8-week avg
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <BarSpark data={SESSIONS_WEEKS} color={t.accent}
                dimColor={theme==='dark' ? t.text3 : '#D6CFC2'}
                max={5} width={120} height={30}/>
              <div style={{
                fontSize:9, color:t.text3, marginTop:4,
                fontFamily:t.mono, letterSpacing:'.05em'
              }}>
                8 wk · per/wk
              </div>
            </div>
          </div>

          {/* This week's session pills */}
          <div style={{
            display:'flex', gap:6, flexWrap:'wrap',
            paddingTop:11, borderTop:`1px solid ${t.border}`
          }}>
            {THIS_WEEK_SESSIONS.map((s,i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'5px 9px 5px 8px', borderRadius:8,
                background:t.surface2, border:`1px solid ${t.border}`
              }}>
                <ActivityIcon kind={s.kind} size={12} color={t.text2}/>
                <span style={{ fontSize:11, color:t.text }}>{s.name}</span>
                <span style={{ fontSize:10, color:t.text3 }}>· {s.day} · {s.dur}</span>
              </div>
            ))}
            {/* Planned (Fri/Sun placeholder) */}
            <div style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'5px 9px', borderRadius:8,
              background:'transparent', border:`1px dashed ${t.border2}`
            }}>
              <span style={{ fontSize:10, color:t.text3 }}>+ Today · Push</span>
            </div>
          </div>
        </div>

        {/* Today's session preview */}
        <div
          onClick={() => onStartSession && onStartSession()}
          style={{
            background:t.surface, border:`1px solid ${t.border}`, borderRadius:20,
            padding:'16px 18px 14px', marginBottom:12, cursor:'pointer',
            transition:'border-color .15s, transform .15s'
          }}
          onMouseEnter={(e)=>{ e.currentTarget.style.borderColor = t.accent + '60'; }}
          onMouseLeave={(e)=>{ e.currentTarget.style.borderColor = t.border; }}
        >
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
            <div>
              <div style={{
                fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
                color:t.text3, marginBottom:3
              }}>
                Up next
              </div>
              <div style={{ fontFamily:t.serif, fontSize:22, lineHeight:1.1 }}>
                {TODAY_SESSION.name} day
              </div>
              <div style={{ fontSize:11, color:t.text2, marginTop:3 }}>
                {TODAY_SESSION.focus} · ~52 min
              </div>
            </div>
            <div style={{
              padding:'4px 9px', borderRadius:7,
              background:t.accent+'18', color:t.accent,
              border:`1px solid ${t.accent}30`,
              fontSize:9.5, fontWeight:600, letterSpacing:'.08em',
              textTransform:'uppercase'
            }}>
              PR window
            </div>
          </div>
          <div style={{ marginBottom:0 }}>
            {TODAY_SESSION.exercises.slice(0,3).map((e,i) => (
              <div key={i} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 0', borderTop: i>0 ? `1px solid ${t.border}` : 'none', fontSize:12
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <span style={{
                    fontSize:9, color:t.text3, fontFamily:t.mono, width:14
                  }}>{String(i+1).padStart(2,'0')}</span>
                  <span style={{ color:t.text }}>{e.name}</span>
                  {e.pr && <span style={{
                    fontSize:9, color:t.accent, fontWeight:600, letterSpacing:'.04em'
                  }}>★ PR</span>}
                </div>
                <span style={{ color:t.text2, fontVariantNumeric:'tabular-nums', fontSize:11 }}>{e.target}</span>
              </div>
            ))}
            <div style={{ padding:'8px 0 0', fontSize:10.5, color:t.text3 }}>
              + 3 more
            </div>
          </div>
        </div>

        {/* Quick log row */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:7,
          marginTop:4
        }}>
          {[
            { id:'sleep', icon:'💤', label:'Log sleep', sub:'7.2h last night' },
            { id:'mood',  icon:'🙂', label:'Log mood',  sub:'Yesterday: Good' },
            { id:'water', icon:'💧', label:'Log water', sub:'1.8L today' },
          ].map(q => (
            <button key={q.id} style={{
              background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
              padding:'10px 8px 9px', textAlign:'center', cursor:'pointer',
              fontFamily:t.sans
            }}>
              <div style={{ fontSize:16, marginBottom:3 }}>{q.icon}</div>
              <div style={{ fontSize:11, color:t.text, fontWeight:500 }}>{q.label}</div>
              <div style={{ fontSize:9.5, color:t.text3, marginTop:2 }}>{q.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <BottomNav theme={theme} active="home" onNav={onNav} tracksCycle={tracksCycle}/>
    </div>
  );
}

window.RefinedHome = RefinedHome;
window.themes = themes;
