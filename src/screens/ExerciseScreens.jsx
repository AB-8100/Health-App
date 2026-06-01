import React from 'react';
import themes from '../data/themes';
const EX_TYPE_COLORS = {
  compound:  ['#C2410C', '#7C2D12'],   // warm rust
  accessory: ['#B45309', '#78350F'],   // amber-brown
  core:      ['#6D28D9', '#3B1B7A'],   // violet
  mobility:  ['#15803D', '#064E2C'],   // moss
  cardio:    ['#1D4ED8', '#1E2A78'],   // deep blue
};

// Reusable exercise placeholder image.
// Real product: stock photo / looping demo GIF.
// Here: striped colored card with serif initial + DEMO tag,
// which makes the placeholder honest (per design-system guidance).
function ExerciseImage({ exerciseId, size = 56, radius, label = false, theme = 'light' }) {
  const ex = (window.EX_LIB || {})[exerciseId];
  if (!ex) {
    return (
      <div style={{
        width:size, height:size, borderRadius: radius ?? size * 0.18,
        background:'#E5E5E5', display:'flex', alignItems:'center', justifyContent:'center',
        color:'#999', fontSize:10
      }}>?</div>
    );
  }

  // Type sets base palette family; hash of exercise id picks the specific variant.
  // This gives each exercise a distinct card while keeping muscle/type families coherent.
  const palettesByType = {
    compound:  [['#C2410C','#7C2D12'], ['#9A3412','#451A03'], ['#B91C1C','#7F1D1D'], ['#9A2B0C','#5C1A0B'], ['#A82C0E','#481E07']],
    accessory: [['#B45309','#78350F'], ['#92400E','#451A03'], ['#A16207','#713F12'], ['#854D0E','#3F2106'], ['#9F580A','#5A2E03']],
    core:      [['#6D28D9','#3B1B7A'], ['#4F46E5','#1E1B6B'], ['#7C3AED','#3B0E73'], ['#5B21B6','#1F0C5D'], ['#6E2BB0','#371356']],
    mobility:  [['#15803D','#064E2C'], ['#047857','#053929'], ['#0E7C66','#053F33'], ['#1F7A2E','#0A3E18'], ['#0F766E','#053C39']],
    cardio:    [['#1D4ED8','#1E2A78'], ['#1E40AF','#16224E'], ['#0369A1','#06324A'], ['#075985','#04263C'], ['#0E7490','#08394A']],
  };
  const palette = palettesByType[ex.type] || [['#6B6560','#3F3934']];
  // Tiny deterministic hash so the same exercise always picks the same swatch
  const h = String(exerciseId).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  const [c1, c2] = palette[Math.abs(h) % palette.length];
  // Gradient angle also varies for visual rhythm
  const angle = 90 + (Math.abs(h) % 4) * 30;
  const initial = ex.name.charAt(0);

  return (
    <div style={{
      width:size, height:size, borderRadius: radius ?? size * 0.18,
      background:`linear-gradient(${angle}deg, ${c1}, ${c2})`,
      position:'relative', overflow:'hidden',
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'#fff', flexShrink:0
    }}>
      {/* Subtle stripe overlay signals placeholder */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'repeating-linear-gradient(45deg, rgba(255,255,255,.07) 0 1px, transparent 1px 12px)'
      }}/>
      {/* Decorative blob */}
      <div style={{
        position:'absolute', top:'-20%', right:'-15%', width:'70%', height:'70%',
        borderRadius:'50%', background:'rgba(255,255,255,.07)'
      }}/>
      <span style={{
        fontFamily:"'DM Serif Display', serif",
        fontSize: typeof size === 'number' ? size * 0.46 : 36, lineHeight:1, opacity:0.95, position:'relative'
      }}>{initial}</span>
      {/* Demo tag in corner — only on larger cards */}
      {typeof size === 'number' && size >= 48 && (
        <span style={{
          position:'absolute', bottom: size*0.06, right: size*0.08,
          fontSize: size * 0.11,
          color:'rgba(255,255,255,.75)', letterSpacing:'.1em',
          fontFamily:"'JetBrains Mono', monospace"
        }}>DEMO</span>
      )}
      {label && (
        <div style={{
          position:'absolute', left:0, right:0, bottom:0,
          padding:'5px 7px 5px',
          background:'linear-gradient(to top, rgba(0,0,0,.55), transparent)',
          fontSize: typeof size === 'number' ? size * 0.13 : 11, color:'#fff', lineHeight:1.2
        }}>
          {ex.name}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Exercise Library — searchable grid with filters
const MUSCLE_GROUPS = [
  { id:'all',    label:'All' },
  { id:'chest',  label:'Chest',     matches:['Chest','Upper chest','Lower chest'] },
  { id:'back',   label:'Back',      matches:['Lats/Biceps','Upper back','Mid back','Full back'] },
  { id:'shoulders', label:'Shoulders', matches:['Shoulders','Front delts','Rear delts'] },
  { id:'arms',   label:'Arms',      matches:['Triceps','Biceps','Brachialis'] },
  { id:'legs',   label:'Legs',      matches:['Quads','Quads/Glutes','Hamstrings','Glutes','Calves'] },
  { id:'core',   label:'Core',      matches:['Core','Abs','Lower abs','Obliques','Deep core','Anti-rotation'] },
  { id:'mobility', label:'Mobility', matches:['Spine','Hips','Spine/hips','Glutes/hips','Ankles','Hamstrings'] },
];

const TYPE_FILTERS = [
  { id:'all',       label:'All' },
  { id:'compound',  label:'Compound' },
  { id:'accessory', label:'Accessory' },
  { id:'core',      label:'Core' },
  { id:'mobility',  label:'Mobility' },
];

function ExerciseLibraryScreen({ width = 390, height = 820, theme = 'light',
                                onBack, onNav, tracksCycle = true }) {
  const t = themes[theme];
  const [search, setSearch] = React.useState('');
  const [muscleFilter, setMuscleFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [selected, setSelected] = React.useState(null);  // exercise id for detail modal

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    const muscleSpec = MUSCLE_GROUPS.find(g => g.id === muscleFilter);
    return Object.entries(window.EX_LIB || {})
      .map(([id, ex]) => ({ id, ...ex }))
      .filter(ex => {
        if (typeFilter !== 'all' && ex.type !== typeFilter) return false;
        if (muscleFilter !== 'all') {
          const m = (muscleSpec?.matches) || [];
          if (!m.some(s => ex.muscle === s)) return false;
        }
        if (q && !ex.name.toLowerCase().includes(q) && !ex.muscle.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [search, muscleFilter, typeFilter]);

  // Grouped count per muscle group (for filter chip badges)
  const muscleCounts = React.useMemo(() => {
    const counts = {};
    Object.values(window.EX_LIB || {}).forEach(ex => {
      MUSCLE_GROUPS.forEach(g => {
        if (g.id === 'all') return;
        if (g.matches.some(s => ex.muscle === s)) counts[g.id] = (counts[g.id] || 0) + 1;
      });
    });
    return counts;
  }, []);

  const totalCount = Object.keys(window.EX_LIB || {}).length;
  const selectedEx = selected ? { id: selected, ...(window.EX_LIB || {})[selected] } : null;

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

      <ScreenHeader theme={theme} title="Exercise library" sub={`${totalCount} exercises`}
        onBack={onBack}/>

      <div style={{ flex:1, overflowY:'auto', padding:'12px 18px 16px' }} className="phone-scroll">

        {/* Search */}
        <div style={{ position:'relative', marginBottom:12 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises or muscle…"
            style={{
              width:'100%', padding:'10px 12px 10px 36px', borderRadius:11,
              border:`1px solid ${t.border}`, background:t.surface,
              fontFamily:t.sans, fontSize:13, color:t.text, outline:'none'
            }}/>
          <span style={{
            position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
            color:t.text3, fontSize:14
          }}>⌕</span>
        </div>

        {/* Type filter chips */}
        <div style={{ display:'flex', gap:5, overflowX:'auto', marginBottom:9, paddingBottom:2 }}
             className="phone-scroll">
          {TYPE_FILTERS.map(f => (
            <button key={f.id} onClick={() => setTypeFilter(f.id)} style={{
              padding:'5px 11px', borderRadius:99, whiteSpace:'nowrap',
              background: typeFilter === f.id ? t.text : t.surface,
              color: typeFilter === f.id ? '#fff' : t.text2,
              border: `1px solid ${typeFilter === f.id ? t.text : t.border}`,
              fontFamily:t.sans, fontSize:11, fontWeight:500, cursor:'pointer'
            }}>{f.label}</button>
          ))}
        </div>

        {/* Muscle filter chips */}
        <div style={{ display:'flex', gap:5, overflowX:'auto', marginBottom:12, paddingBottom:2 }}
             className="phone-scroll">
          {MUSCLE_GROUPS.map(g => {
            const count = g.id === 'all' ? totalCount : (muscleCounts[g.id] || 0);
            return (
              <button key={g.id} onClick={() => setMuscleFilter(g.id)} style={{
                padding:'5px 11px', borderRadius:99, whiteSpace:'nowrap',
                background: muscleFilter === g.id ? t.accent+'18' : 'transparent',
                color: muscleFilter === g.id ? t.accent : t.text3,
                border: `1px solid ${muscleFilter === g.id ? t.accent : t.border}`,
                fontFamily:t.sans, fontSize:11, fontWeight:500, cursor:'pointer'
              }}>
                {g.label}
                {count > 0 && (
                  <span style={{
                    marginLeft:5, fontSize:9, color:muscleFilter === g.id ? t.accent : t.text3,
                    opacity:0.7
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{
          fontSize:10.5, color:t.text3, marginBottom:9, padding:'0 2px',
          display:'flex', justifyContent:'space-between'
        }}>
          <span>{filtered.length} matching</span>
          {(typeFilter !== 'all' || muscleFilter !== 'all' || search) && (
            <button onClick={() => { setTypeFilter('all'); setMuscleFilter('all'); setSearch(''); }} style={{
              background:'transparent', border:'none', color:t.accent, cursor:'pointer',
              fontSize:10.5, fontFamily:t.sans
            }}>Clear filters</button>
          )}
        </div>

        {/* Grid of exercises */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:9
        }}>
          {filtered.map(ex => (
            <button key={ex.id}
              onClick={() => setSelected(ex.id)}
              style={{
                background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
                padding:0, cursor:'pointer', textAlign:'left',
                display:'flex', flexDirection:'column', overflow:'hidden',
                fontFamily:t.sans
              }}>
              <div style={{ width:'100%', aspectRatio:'4/3', padding:8 }}>
                <ExerciseImage exerciseId={ex.id} size={'100%'} radius={10} theme={theme}/>
              </div>
              <div style={{ padding:'8px 11px 11px' }}>
                <div style={{ fontSize:12.5, color:t.text, lineHeight:1.2 }}>
                  {ex.name}
                </div>
                <div style={{
                  fontSize:9.5, color:t.text3, marginTop:3,
                  display:'flex', alignItems:'center', gap:5
                }}>
                  <span style={{
                    width:5, height:5, borderRadius:'50%',
                    background: EX_TYPE_COLORS[ex.type]?.[0] || t.text3
                  }}/>
                  {ex.muscle}
                </div>
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'30px 0', color:t.text3, fontSize:12 }}>
            No matches.
          </div>
        )}
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle}/>

      {/* Detail modal */}
      {selectedEx && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.45)',
          display:'flex', alignItems:'flex-end', zIndex:50
        }} onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width:'100%', background:t.surface,
            borderTopLeftRadius:22, borderTopRightRadius:22,
            padding:'18px 20px 22px', maxHeight:'80%',
            display:'flex', flexDirection:'column'
          }}>
            <div style={{
              width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 14px'
            }}/>

            {/* Big hero image */}
            <div style={{ marginBottom:14, position:'relative' }}>
              <div style={{ width:'100%', aspectRatio:'2/1' }}>
                <ExerciseImage exerciseId={selectedEx.id} size={'100%'} radius={14} theme={theme}/>
              </div>
              <div style={{
                position:'absolute', bottom:10, left:10, right:10,
                display:'flex', alignItems:'flex-end', justifyContent:'space-between',
                color:'#fff'
              }}>
                <div>
                  <div style={{
                    fontSize:9.5, letterSpacing:'.18em', opacity:0.85,
                    textTransform:'uppercase', marginBottom:1
                  }}>
                    {selectedEx.type}
                  </div>
                  <div style={{ fontFamily:t.serif, fontSize:22, lineHeight:1 }}>
                    {selectedEx.name}
                  </div>
                </div>
                <button style={{
                  width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,.2)',
                  border:'1px solid rgba(255,255,255,.4)', color:'#fff', cursor:'pointer',
                  fontSize:14, display:'flex', alignItems:'center', justifyContent:'center'
                }}>▶</button>
              </div>
            </div>

            <div style={{ overflowY:'auto', flex:1, paddingRight:2 }}>
              <div style={{
                display:'flex', gap:6, flexWrap:'wrap', marginBottom:14
              }}>
                <span style={{
                  fontSize:11, padding:'4px 10px', borderRadius:99,
                  background:t.surface2, border:`1px solid ${t.border}`, color:t.text2
                }}>
                  Target · {selectedEx.muscle}
                </span>
                <span style={{
                  fontSize:11, padding:'4px 10px', borderRadius:99,
                  background:EX_TYPE_COLORS[selectedEx.type][0] + '20',
                  border:`1px solid ${EX_TYPE_COLORS[selectedEx.type][0]}40`,
                  color:EX_TYPE_COLORS[selectedEx.type][0]
                }}>
                  {selectedEx.type}
                </span>
              </div>

              <div style={{
                fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
                color:t.text3, marginBottom:8, fontWeight:500
              }}>
                Similar exercises
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
                {Object.entries(window.EX_LIB || {})
                  .filter(([id, ex]) =>
                    id !== selectedEx.id && ex.type === selectedEx.type && ex.muscle === selectedEx.muscle
                  )
                  .slice(0, 4)
                  .map(([id, ex]) => (
                    <button key={id}
                      onClick={() => setSelected(id)}
                      style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'8px 10px', borderRadius:11,
                        background:t.surface2, border:`1px solid ${t.border}`,
                        cursor:'pointer', textAlign:'left', fontFamily:t.sans
                      }}>
                      <ExerciseImage exerciseId={id} size={36} radius={8} theme={theme}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12.5, color:t.text }}>{ex.name}</div>
                        <div style={{ fontSize:10, color:t.text3 }}>{ex.muscle}</div>
                      </div>
                      <span style={{ fontSize:14, color:t.text3 }}>›</span>
                    </button>
                  ))}
                {Object.entries(window.EX_LIB || {})
                  .filter(([id, ex]) =>
                    id !== selectedEx.id && ex.type === selectedEx.type && ex.muscle === selectedEx.muscle
                  ).length === 0 && (
                  <div style={{ fontSize:11.5, color:t.text3, padding:'8px 0' }}>
                    No close alternatives in the library yet.
                  </div>
                )}
              </div>
            </div>

            <button onClick={() => setSelected(null)} style={{
              width:'100%', padding:'12px', borderRadius:11,
              background:t.accent, color:t.accentText,
              border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer'
            }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Day Activities — schedule gym + non-gym sessions for a specific day
const ACTIVITY_TYPES = [
  { id:'run',    label:'Run',         emoji:'🏃', source:'Strava' },
  { id:'cycle',  label:'Cycle',       emoji:'🚴', source:'Strava' },
  { id:'swim',   label:'Swim',        emoji:'🏊', source:'Strava' },
  { id:'walk',   label:'Walk',        emoji:'🚶', source:'Manual' },
  { id:'hike',   label:'Hike',        emoji:'⛰️', source:'Strava' },
  { id:'yoga',   label:'Yoga',        emoji:'🧘', source:'Manual' },
  { id:'pilates',label:'Pilates',     emoji:'🤸', source:'Manual' },
  { id:'class',  label:'Class',       emoji:'💃', source:'Manual' },
  { id:'climb',  label:'Climbing',    emoji:'🧗', source:'Manual' },
];

const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function DayActivitiesScreen({ width = 390, height = 820, theme = 'light',
                              plan, dayIdx, activities = {},
                              onBack, onSave, onNav, tracksCycle = true,
                              onEditGym }) {
  const t = themes[theme];
  const split = SPLITS[plan.splitDays];
  const slot = split.schedule[dayIdx];
  const isRestDay = slot === '—';
  const gymDay = !isRestDay ? split.days.find(d => d.id === slot) : null;
  const [dayActs, setDayActs] = React.useState(activities[dayIdx] || []);
  const [addingType, setAddingType] = React.useState(null);
  const [draft, setDraft] = React.useState({ duration: 30, time: '07:00', notes: '' });

  const totalDuration = dayActs.reduce((n, a) => n + (a.duration || 0), 0);

  const addActivity = () => {
    const type = ACTIVITY_TYPES.find(t => t.id === addingType);
    if (!type) return;
    const id = `${addingType}-${Date.now()}`;
    setDayActs([...dayActs, {
      id, type:addingType, label:type.label, emoji:type.emoji,
      duration: draft.duration, time: draft.time, notes: draft.notes, source: type.source
    }]);
    setAddingType(null);
    setDraft({ duration: 30, time: '07:00', notes: '' });
  };
  const removeActivity = (id) => setDayActs(dayActs.filter(a => a.id !== id));

  const save = () => {
    if (onSave) onSave(dayIdx, dayActs);
    onBack();
  };

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

      <ScreenHeader theme={theme} title={DAY_NAMES[dayIdx]} sub="Schedule"
        onBack={onBack}
        right={
          <button onClick={save} style={{
            padding:'6px 12px', borderRadius:8, background:t.accent, color:t.accentText,
            border:'none', fontFamily:t.sans, fontSize:11, fontWeight:600, cursor:'pointer'
          }}>Save</button>
        }
      />

      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px 16px' }} className="phone-scroll">

        {/* Gym session for this day */}
        <div style={{
          fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
          color:t.text3, marginBottom:8, padding:'0 4px'
        }}>
          Gym session
        </div>
        {gymDay ? (
          <div onClick={() => onEditGym && onEditGym(gymDay.id)} style={{
            background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
            padding:'12px 14px', marginBottom:18, cursor:'pointer',
            display:'flex', alignItems:'center', gap:11
          }}>
            <div style={{
              width:38, height:38, borderRadius:10, background:t.accent,
              color:t.accentText, fontFamily:t.serif, fontSize:18,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
            }}>{gymDay.name.charAt(0)}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:t.text, fontWeight:500 }}>{gymDay.name} day</div>
              <div style={{ fontSize:10.5, color:t.text3 }}>
                {gymDay.muscles}
              </div>
            </div>
            <span style={{ fontSize:10, color:t.accent, fontWeight:500 }}>Edit ›</span>
          </div>
        ) : (
          <div style={{
            background:t.surface2, border:`1px dashed ${t.border2}`, borderRadius:14,
            padding:'12px 14px', marginBottom:18, fontSize:12, color:t.text3,
            textAlign:'center'
          }}>
            Rest day — no gym scheduled
          </div>
        )}

        {/* Other activities */}
        <div style={{
          fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
          color:t.text3, marginBottom:8, padding:'0 4px',
          display:'flex', justifyContent:'space-between', alignItems:'baseline'
        }}>
          <span>Other activities</span>
          {dayActs.length > 0 && <span style={{ letterSpacing:'.04em' }}>
            {dayActs.length} · {totalDuration}m total
          </span>}
        </div>

        {dayActs.map(a => (
          <div key={a.id} style={{
            background:t.surface, border:`1px solid ${t.border}`, borderRadius:13,
            padding:'10px 14px', marginBottom:6,
            display:'flex', alignItems:'center', gap:11
          }}>
            <div style={{
              width:34, height:34, borderRadius:9, background:'#0090FF18',
              fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
            }}>{a.emoji}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, color:t.text, fontWeight:500 }}>{a.label}</div>
              <div style={{ fontSize:10.5, color:t.text3, marginTop:1 }}>
                {a.duration}m · {a.time} · from {a.source}
              </div>
            </div>
            <button onClick={() => removeActivity(a.id)} style={{
              width:24, height:24, borderRadius:6, border:`1px solid ${t.border}`,
              background:'transparent', color:'#BE3B2E', cursor:'pointer',
              fontSize:12, fontFamily:t.sans
            }}>×</button>
          </div>
        ))}

        {dayActs.length === 0 && (
          <div style={{
            background:t.surface2, border:`1px dashed ${t.border2}`, borderRadius:13,
            padding:'14px 14px', marginBottom:8, textAlign:'center'
          }}>
            <div style={{ fontSize:12, color:t.text2, marginBottom:4 }}>
              Nothing logged yet.
            </div>
            <div style={{ fontSize:10.5, color:t.text3, lineHeight:1.5 }}>
              Add a run, swim, yoga class or other activity — auto-synced from connected apps when available.
            </div>
          </div>
        )}

        <button onClick={() => setAddingType('run')} style={{
          width:'100%', padding:'12px', borderRadius:13,
          background:t.accent, color:t.accentText,
          border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer',
          marginTop: dayActs.length ? 6 : 0,
          display:'flex', alignItems:'center', justifyContent:'center', gap:5
        }}>
          + Add activity
        </button>
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle}/>

      {/* Add activity sheet */}
      {addingType && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.45)',
          display:'flex', alignItems:'flex-end', zIndex:50
        }} onClick={() => setAddingType(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width:'100%', background:t.surface,
            borderTopLeftRadius:22, borderTopRightRadius:22,
            padding:'18px 20px 20px'
          }}>
            <div style={{
              width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 14px'
            }}/>
            <div style={{ fontFamily:t.serif, fontSize:22, color:t.text, marginBottom:14 }}>
              Add activity
            </div>

            {/* Activity type grid */}
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6, marginBottom:14
            }}>
              {ACTIVITY_TYPES.map(at => (
                <button key={at.id} onClick={() => setAddingType(at.id)} style={{
                  padding:'10px 6px', borderRadius:11,
                  background: addingType === at.id ? t.accent+'15' : t.surface2,
                  border: `1.5px solid ${addingType === at.id ? t.accent : t.border}`,
                  cursor:'pointer', fontFamily:t.sans,
                  display:'flex', flexDirection:'column', alignItems:'center', gap:3
                }}>
                  <span style={{ fontSize:20 }}>{at.emoji}</span>
                  <span style={{ fontSize:10.5, color:t.text, fontWeight:500 }}>{at.label}</span>
                  <span style={{ fontSize:9, color:t.text3 }}>{at.source}</span>
                </button>
              ))}
            </div>

            {/* Duration + Time */}
            <div style={{
              display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14
            }}>
              <div>
                <div style={{
                  fontSize:9, letterSpacing:'.16em', textTransform:'uppercase',
                  color:t.text3, marginBottom:5
                }}>Duration</div>
                <NumberRow value={draft.duration} min={5} max={300} step={5} unit="min"
                  onChange={(v) => setDraft({...draft, duration: v})} theme={theme}/>
              </div>
              <div>
                <div style={{
                  fontSize:9, letterSpacing:'.16em', textTransform:'uppercase',
                  color:t.text3, marginBottom:5
                }}>Time</div>
                <input type="time" value={draft.time}
                  onChange={(e) => setDraft({...draft, time: e.target.value})}
                  style={{
                    width:'100%', padding:'9px 12px', borderRadius:11,
                    border:`1px solid ${t.border2}`, background:t.surface,
                    fontFamily:t.mono, fontSize:14, color:t.text, outline:'none'
                  }}/>
              </div>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setAddingType(null)} style={{
                flex:1, padding:'12px', borderRadius:11,
                background:'transparent', border:`1px solid ${t.border2}`,
                color:t.text, fontFamily:t.sans, fontSize:13, fontWeight:500, cursor:'pointer'
              }}>Cancel</button>
              <button onClick={addActivity} style={{
                flex:1, padding:'12px', borderRadius:11,
                background:t.accent, color:t.accentText,
                border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer'
              }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export {
  EX_TYPE_COLORS, MUSCLE_GROUPS, TYPE_FILTERS, ACTIVITY_TYPES, DAY_NAMES,
  ExerciseImage, ExerciseLibraryScreen, DayActivitiesScreen,
};
