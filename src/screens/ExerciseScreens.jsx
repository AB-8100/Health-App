import React from 'react';
import themes from '../data/themes';
import { BottomNav } from '../components/SharedUI';
import { EX_LIB, ScreenHeader } from './GymPlanScreens';
import { NumberRow } from './OnboardingScreen';
import { getImageUrlForExLibId, getDbImageUrl, fetchExerciseDb } from '../data/exerciseDbMap';

const EX_TYPE_COLORS = {
  compound:  ['#C2410C', '#7C2D12'],
  accessory: ['#B45309', '#78350F'],
  core:      ['#6D28D9', '#3B1B7A'],
  mobility:  ['#15803D', '#064E2C'],
  cardio:    ['#1D4ED8', '#1E2A78'],
};

// ExerciseImage: shows a real photo from free-exercise-db when available,
// with a deterministic gradient card as instant placeholder and fallback.
// Accepts either an EX_LIB id (exerciseId) or a direct free-exercise-db image URL (imageUrl).
function ExerciseImage({ exerciseId, imageUrl: imageUrlProp, size = 56, radius, label = false, theme = 'light' }) {
  const ex = EX_LIB[exerciseId];
  const [imgLoaded, setImgLoaded]  = React.useState(false);
  const [imgFailed, setImgFailed]  = React.useState(false);

  const imageUrl = imageUrlProp || (exerciseId ? getImageUrlForExLibId(exerciseId) : null);

  // Reset image state when the URL changes (e.g. navigating between exercises)
  React.useEffect(() => {
    setImgLoaded(false);
    setImgFailed(false);
  }, [imageUrl]);

  // ── gradient placeholder ────────────────────────────────
  const palettesByType = {
    compound:  [['#C2410C','#7C2D12'],['#9A3412','#451A03'],['#B91C1C','#7F1D1D'],['#9A2B0C','#5C1A0B']],
    accessory: [['#B45309','#78350F'],['#92400E','#451A03'],['#A16207','#713F12'],['#854D0E','#3F2106']],
    core:      [['#6D28D9','#3B1B7A'],['#4F46E5','#1E1B6B'],['#7C3AED','#3B0E73'],['#5B21B6','#1F0C5D']],
    mobility:  [['#15803D','#064E2C'],['#047857','#053929'],['#0E7C66','#053F33'],['#1F7A2E','#0A3E18']],
    cardio:    [['#1D4ED8','#1E2A78'],['#1E40AF','#16224E'],['#0369A1','#06324A'],['#075985','#04263C']],
  };
  const fallbackPalette = [['#6B6560','#3F3934']];
  const palette = (ex ? palettesByType[ex.type] : null) || fallbackPalette;
  const h = String(exerciseId || imageUrlProp || '?').split('').reduce((a,c)=>(a*31+c.charCodeAt(0))|0,0);
  const [c1, c2] = palette[Math.abs(h) % palette.length];
  const angle = 90 + (Math.abs(h) % 4) * 30;
  const initial = ex ? ex.name.charAt(0) : '?';

  return (
    <div style={{
      width:size, height:size, borderRadius: radius ?? (typeof size==='number' ? size*0.18 : 10),
      position:'relative', overflow:'hidden', flexShrink:0,
      background:`linear-gradient(${angle}deg, ${c1}, ${c2})`,
      display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
    }}>
      {/* gradient placeholder layer (always rendered) */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0 1px,transparent 1px 12px)'
      }}/>
      <div style={{
        position:'absolute', top:'-20%', right:'-15%', width:'70%', height:'70%',
        borderRadius:'50%', background:'rgba(255,255,255,.07)'
      }}/>
      <span style={{
        fontFamily:"'DM Serif Display', serif",
        fontSize: typeof size==='number' ? size*0.46 : 36,
        lineHeight:1, opacity:0.95, position:'relative'
      }}>{initial}</span>

      {/* real photo layer — fades in over the gradient once loaded */}
      {imageUrl && !imgFailed && (
        <img
          src={imageUrl}
          alt=""
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
          style={{
            position:'absolute', inset:0, width:'100%', height:'100%',
            objectFit:'cover', objectPosition:'center top',
            opacity: imgLoaded ? 1 : 0,
            transition:'opacity 0.35s ease',
          }}
        />
      )}

      {label && ex && (
        <div style={{
          position:'absolute', left:0, right:0, bottom:0,
          padding:'5px 7px 5px',
          background:'linear-gradient(to top, rgba(0,0,0,.55), transparent)',
          fontSize: typeof size==='number' ? size*0.13 : 11, color:'#fff', lineHeight:1.2
        }}>
          {ex.name}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Exercise Library — powered by free-exercise-db (800+ exercises)
// github.com/yuhonas/free-exercise-db

const MUSCLE_GROUPS = [
  { id:'all',       label:'All',       muscles:[] },
  { id:'chest',     label:'Chest',     muscles:['chest'] },
  { id:'back',      label:'Back',      muscles:['lats','upper back','middle back','lower back','traps'] },
  { id:'shoulders', label:'Shoulders', muscles:['shoulders','traps'] },
  { id:'arms',      label:'Arms',      muscles:['biceps','triceps','forearms'] },
  { id:'legs',      label:'Legs',      muscles:['quadriceps','hamstrings','glutes','calves','adductors','abductors'] },
  { id:'core',      label:'Core',      muscles:['abdominals'] },
];

const CATEGORY_FILTERS = [
  { id:'all',      label:'All' },
  { id:'strength', label:'Strength', values:['strength','powerlifting','strongman','olympic weightlifting'] },
  { id:'cardio',   label:'Cardio',   values:['cardio','plyometrics'] },
  { id:'stretch',  label:'Stretch',  values:['stretching'] },
];

const LEVEL_COLORS = {
  beginner:     '#15803D',
  intermediate: '#B45309',
  expert:       '#BE3B2E',
};

const PAGE_SIZE = 48;

function ExerciseLibraryScreen({ width = 390, height = 820, theme = 'light',
                                 onBack, onNav, tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const t = themes[theme];
  const [search,   setSearch]   = React.useState('');
  const [muscle,   setMuscle]   = React.useState('all');
  const [category, setCategory] = React.useState('all');
  const [page,     setPage]     = React.useState(1);
  const [dbAll,    setDbAll]    = React.useState(null);   // full free-exercise-db array
  const [loading,  setLoading]  = React.useState(false);
  const [dbError,  setDbError]  = React.useState(false);
  const [selected, setSelected] = React.useState(null);  // full db exercise object

  // Fetch free-exercise-db on mount
  React.useEffect(() => {
    setLoading(true);
    fetchExerciseDb()
      .then(data => { setDbAll(data); setLoading(false); })
      .catch(() => { setDbError(true); setLoading(false); });
  }, []);

  // Reset pagination when filters change
  React.useEffect(() => { setPage(1); }, [search, muscle, category]);

  const filtered = React.useMemo(() => {
    if (!dbAll) return [];
    const q = search.toLowerCase();
    const muscleSpec = MUSCLE_GROUPS.find(g => g.id === muscle);
    const catSpec    = CATEGORY_FILTERS.find(g => g.id === category);
    return dbAll.filter(ex => {
      if (category !== 'all') {
        if (!catSpec?.values.includes(ex.category)) return false;
      }
      if (muscle !== 'all') {
        const all = [...(ex.primaryMuscles||[]), ...(ex.secondaryMuscles||[])].map(m=>m.toLowerCase());
        if (!muscleSpec?.muscles.some(m => all.includes(m))) return false;
      }
      if (q) {
        const hay = (ex.name + ' ' + (ex.primaryMuscles||[]).join(' ')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dbAll, search, muscle, category]);

  const shown = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = shown.length < filtered.length;

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

      <ScreenHeader
        theme={theme}
        title="Exercise library"
        sub={dbAll ? `${filtered.length.toLocaleString()} exercises` : 'Loading…'}
        onBack={onBack}
      />

      <div style={{ flex:1, overflowY:'auto', padding:'12px 18px 16px' }} className="phone-scroll">

        {/* Search */}
        <div style={{ position:'relative', marginBottom:10 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or muscle…"
            style={{
              width:'100%', padding:'10px 12px 10px 36px', borderRadius:11,
              border:`1px solid ${t.border}`, background:t.surface,
              fontFamily:t.sans, fontSize:13, color:t.text, outline:'none',
              boxSizing:'border-box'
            }}/>
          <span style={{
            position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
            color:t.text3, fontSize:14
          }}>⌕</span>
        </div>

        {/* Category chips */}
        <div style={{ display:'flex', gap:5, overflowX:'auto', marginBottom:7, paddingBottom:2 }}
             className="phone-scroll">
          {CATEGORY_FILTERS.map(f => (
            <button key={f.id} onClick={() => setCategory(f.id)} style={{
              padding:'5px 11px', borderRadius:99, whiteSpace:'nowrap',
              background: category === f.id ? t.text : t.surface,
              color: category === f.id ? (theme==='dark'?'#111':'#fff') : t.text2,
              border: `1px solid ${category === f.id ? t.text : t.border}`,
              fontFamily:t.sans, fontSize:11, fontWeight:500, cursor:'pointer'
            }}>{f.label}</button>
          ))}
        </div>

        {/* Muscle chips */}
        <div style={{ display:'flex', gap:5, overflowX:'auto', marginBottom:10, paddingBottom:2 }}
             className="phone-scroll">
          {MUSCLE_GROUPS.map(g => (
            <button key={g.id} onClick={() => setMuscle(g.id)} style={{
              padding:'5px 11px', borderRadius:99, whiteSpace:'nowrap',
              background: muscle === g.id ? t.accent+'18' : 'transparent',
              color: muscle === g.id ? t.accent : t.text3,
              border: `1px solid ${muscle === g.id ? t.accent : t.border}`,
              fontFamily:t.sans, fontSize:11, fontWeight:500, cursor:'pointer'
            }}>{g.label}</button>
          ))}
        </div>

        {/* Results count + clear */}
        {!loading && dbAll && (
          <div style={{
            fontSize:10.5, color:t.text3, marginBottom:9, padding:'0 2px',
            display:'flex', justifyContent:'space-between', alignItems:'center'
          }}>
            <span>Showing {shown.length} of {filtered.length}</span>
            {(search || muscle !== 'all' || category !== 'all') && (
              <button onClick={() => { setSearch(''); setMuscle('all'); setCategory('all'); }} style={{
                background:'transparent', border:'none', color:t.accent,
                cursor:'pointer', fontSize:10.5, fontFamily:t.sans
              }}>Clear</button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign:'center', padding:'40px 0', color:t.text3 }}>
            <div style={{
              width:24, height:24, border:`2px solid ${t.accent}`,
              borderTopColor:'transparent', borderRadius:'50%',
              animation:'spin 0.8s linear infinite', margin:'0 auto 10px'
            }}/>
            <div style={{ fontSize:12 }}>Loading 800+ exercises…</div>
          </div>
        )}

        {/* Error */}
        {dbError && (
          <div style={{
            background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
            padding:'16px', textAlign:'center', marginBottom:12
          }}>
            <div style={{ fontSize:12, color:t.text, marginBottom:4 }}>Couldn't load database</div>
            <div style={{ fontSize:11, color:t.text3 }}>Check your connection and try again.</div>
          </div>
        )}

        {/* Exercise grid */}
        {!loading && !dbError && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:9 }}>
            {shown.map(ex => {
              const imgUrl = ex.images?.[0] ? getDbImageUrl(ex.id, 0) : null;
              const lvlColor = LEVEL_COLORS[ex.level] || t.text3;
              return (
                <button
                  key={ex.id}
                  onClick={() => setSelected(ex)}
                  style={{
                    background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
                    padding:0, cursor:'pointer', textAlign:'left',
                    display:'flex', flexDirection:'column', overflow:'hidden',
                    fontFamily:t.sans
                  }}>
                  {/* Image */}
                  <div style={{ width:'100%', aspectRatio:'4/3', overflow:'hidden', position:'relative' }}>
                    <ExerciseImage
                      imageUrl={imgUrl}
                      exerciseId={null}
                      size={'100%'} radius={0} theme={theme}
                    />
                  </div>
                  {/* Info */}
                  <div style={{ padding:'8px 11px 11px' }}>
                    <div style={{ fontSize:12, color:t.text, lineHeight:1.25, fontWeight:500 }}>
                      {ex.name}
                    </div>
                    <div style={{
                      fontSize:9.5, color:t.text3, marginTop:4,
                      display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'
                    }}>
                      <span style={{ color:t.text2 }}>
                        {(ex.primaryMuscles||[]).join(', ') || '—'}
                      </span>
                      {ex.level && (
                        <span style={{
                          fontSize:8.5, padding:'1px 5px', borderRadius:99,
                          background:lvlColor+'18', color:lvlColor, border:`1px solid ${lvlColor}30`,
                          fontWeight:600, letterSpacing:'.04em', textTransform:'capitalize'
                        }}>{ex.level}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <button
            onClick={() => setPage(p => p + 1)}
            style={{
              width:'100%', marginTop:12, padding:'12px', borderRadius:13,
              background:'transparent', border:`1px solid ${t.border2}`,
              color:t.text2, fontFamily:t.sans, fontSize:13, cursor:'pointer'
            }}>
            Load more ({filtered.length - shown.length} remaining)
          </button>
        )}

        {!loading && !dbError && filtered.length === 0 && dbAll && (
          <div style={{ textAlign:'center', padding:'30px 0', color:t.text3, fontSize:12 }}>
            No matches. Try a different filter.
          </div>
        )}
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}/>

      {/* Detail sheet */}
      {selected && (
        <ExerciseDetailSheet
          ex={selected}
          theme={theme}
          t={t}
          onClose={() => setSelected(null)}
          onSelectRelated={setSelected}
          allExercises={dbAll || []}
        />
      )}
    </div>
  );
}

// ── Detail sheet ─────────────────────────────────────────────
function ExerciseDetailSheet({ ex, theme, t, onClose, onSelectRelated, allExercises }) {
  const [imgIdx, setImgIdx] = React.useState(0);
  const imgUrl = ex.images?.[imgIdx] ? getDbImageUrl(ex.id, imgIdx) : null;
  const hasTwo = (ex.images?.length || 0) >= 2;
  const lvlColor = LEVEL_COLORS[ex.level] || t.text3;

  const related = React.useMemo(() =>
    allExercises
      .filter(e => e.id !== ex.id && (e.primaryMuscles||[]).some(m => (ex.primaryMuscles||[]).includes(m)))
      .slice(0, 4),
    [ex, allExercises]
  );

  return (
    <div style={{
      position:'absolute', inset:0, background:'rgba(0,0,0,.5)',
      display:'flex', alignItems:'flex-end', zIndex:50
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:'100%', background:t.surface,
          borderTopLeftRadius:22, borderTopRightRadius:22,
          maxHeight:'90%', display:'flex', flexDirection:'column',
          boxShadow:'0 -12px 48px rgba(0,0,0,.25)'
        }}>
        {/* drag handle */}
        <div style={{ padding:'12px 0 4px', display:'flex', justifyContent:'center' }}>
          <div style={{ width:38, height:4, background:t.border, borderRadius:99 }}/>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'0 20px 20px' }}>

          {/* Hero image with pose toggle */}
          <div style={{ position:'relative', marginBottom:14, borderRadius:16, overflow:'hidden' }}>
            <div style={{ width:'100%', aspectRatio:'16/9' }}>
              <ExerciseImage imageUrl={imgUrl} exerciseId={null} size={'100%'} radius={0} theme={theme}/>
            </div>
            {hasTwo && (
              <button
                onClick={() => setImgIdx(i => (i + 1) % 2)}
                style={{
                  position:'absolute', bottom:10, right:10,
                  padding:'5px 10px', borderRadius:8,
                  background:'rgba(0,0,0,.55)', border:'1px solid rgba(255,255,255,.2)',
                  color:'#fff', fontSize:10.5, fontFamily:t.sans, cursor:'pointer'
                }}>
                {imgIdx === 0 ? 'End pos →' : '← Start pos'}
              </button>
            )}
          </div>

          {/* Name + badges */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:t.serif, fontSize:24, color:t.text, lineHeight:1.1, marginBottom:8 }}>
              {ex.name}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {ex.level && (
                <span style={{
                  fontSize:11, padding:'3px 9px', borderRadius:99,
                  background:lvlColor+'18', color:lvlColor, border:`1px solid ${lvlColor}30`, fontWeight:600
                }}>{ex.level}</span>
              )}
              {ex.category && (
                <span style={{
                  fontSize:11, padding:'3px 9px', borderRadius:99,
                  background:t.surface2, color:t.text2, border:`1px solid ${t.border}`
                }}>{ex.category}</span>
              )}
              {ex.equipment && ex.equipment !== 'other' && (
                <span style={{
                  fontSize:11, padding:'3px 9px', borderRadius:99,
                  background:t.surface2, color:t.text2, border:`1px solid ${t.border}`
                }}>{ex.equipment}</span>
              )}
            </div>
          </div>

          {/* Muscles */}
          <div style={{ marginBottom:14 }}>
            <div style={{
              fontSize:9.5, letterSpacing:'.14em', textTransform:'uppercase',
              color:t.text3, marginBottom:6, fontWeight:500
            }}>Muscles</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {(ex.primaryMuscles||[]).map(m => (
                <span key={m} style={{
                  fontSize:11, padding:'3px 9px', borderRadius:99,
                  background:t.accent+'18', color:t.accent, border:`1px solid ${t.accent}30`,
                  textTransform:'capitalize', fontWeight:500
                }}>{m}</span>
              ))}
              {(ex.secondaryMuscles||[]).map(m => (
                <span key={m} style={{
                  fontSize:11, padding:'3px 9px', borderRadius:99,
                  background:t.surface2, color:t.text3, border:`1px solid ${t.border}`,
                  textTransform:'capitalize'
                }}>{m}</span>
              ))}
            </div>
          </div>

          {/* Instructions */}
          {(ex.instructions||[]).length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{
                fontSize:9.5, letterSpacing:'.14em', textTransform:'uppercase',
                color:t.text3, marginBottom:8, fontWeight:500
              }}>How to do it</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {ex.instructions.map((step, i) => (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{
                      width:20, height:20, borderRadius:'50%', flexShrink:0,
                      background:t.accent+'18', color:t.accent,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, fontWeight:700, marginTop:1
                    }}>{i+1}</div>
                    <div style={{ fontSize:12.5, color:t.text, lineHeight:1.5, flex:1 }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related exercises */}
          {related.length > 0 && (
            <div style={{ marginBottom:6 }}>
              <div style={{
                fontSize:9.5, letterSpacing:'.14em', textTransform:'uppercase',
                color:t.text3, marginBottom:8, fontWeight:500
              }}>Related exercises</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {related.map(re => (
                  <button key={re.id} onClick={() => onSelectRelated(re)} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'8px 10px', borderRadius:11,
                    background:t.surface2, border:`1px solid ${t.border}`,
                    cursor:'pointer', textAlign:'left', fontFamily:t.sans
                  }}>
                    <ExerciseImage
                      imageUrl={re.images?.[0] ? getDbImageUrl(re.id, 0) : null}
                      exerciseId={null}
                      size={36} radius={8} theme={theme}
                    />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12.5, color:t.text }}>{re.name}</div>
                      <div style={{ fontSize:10, color:t.text3, textTransform:'capitalize' }}>
                        {(re.primaryMuscles||[]).join(', ')}
                      </div>
                    </div>
                    <span style={{ fontSize:14, color:t.text3 }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:'12px 20px 20px', borderTop:`1px solid ${t.border}` }}>
          <button onClick={onClose} style={{
            width:'100%', padding:'13px', borderRadius:11,
            background:t.accent, color:t.accentText,
            border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer'
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// Keep the old MUSCLE_GROUPS / TYPE_FILTERS constants for any external callers
const TYPE_FILTERS = [
  { id:'all',       label:'All' },
  { id:'compound',  label:'Compound' },
  { id:'accessory', label:'Accessory' },
  { id:'core',      label:'Core' },
  { id:'mobility',  label:'Mobility' },
];

export {
  EX_TYPE_COLORS, MUSCLE_GROUPS, TYPE_FILTERS,
  ExerciseImage, ExerciseLibraryScreen,
};
