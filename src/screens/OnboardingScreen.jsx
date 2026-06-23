import React from 'react';
import themes from '../data/themes';
import { SPLITS } from './GymPlanScreens';
import { ACTIVITY_LEVELS } from '../utils/calories';
const IMPORT_SOURCES = [
  { id:'strava',   name:'Strava',         scope:'Runs · Rides · Workouts', color:'#FC5200', glyph:'S', cycleOnly:false },
  { id:'mfp',      name:'MyFitnessPal',   scope:'Meals · Macros · Calories', color:'#0072CE', glyph:'M', cycleOnly:false },
  { id:'apple',    name:'Apple Health',   scope:'Steps · Sleep · Weight',  color:'#000000', glyph:'A', cycleOnly:false },
  { id:'oura',     name:'Oura',           scope:'Sleep · HRV · Recovery',  color:'#1C1917', glyph:'O', cycleOnly:false },
  { id:'garmin',   name:'Garmin',         scope:'Workouts · HR · GPS',     color:'#007CC3', glyph:'G', cycleOnly:false },
  { id:'flo',      name:'Flo',            scope:'Period & cycle history',  color:'#E85DA1', glyph:'F', cycleOnly:true },
  { id:'clue',     name:'Clue',           scope:'Period & cycle history',  color:'#1C1917', glyph:'C', cycleOnly:true },
];

const GOAL_OPTIONS = [
  { id:'strength',    label:'Build strength',  sub:'Heavy compounds, progressive overload', icon:'💪' },
  { id:'muscle',      label:'Build muscle',    sub:'Hypertrophy focus, higher volume',      icon:'🏋️' },
  { id:'fat-loss',    label:'Lose fat',        sub:'Calorie deficit + maintain muscle',     icon:'🔥' },
  { id:'active',      label:'Stay active',     sub:'Habit-building, general health',        icon:'🌿' },
  { id:'flexibility', label:'Mobility & flow', sub:'Stretch, yoga, recover',                icon:'🧘' },
];

// ────────────────────────────────────────────────────────────
function OnboardingScreen({ width = 390, height = 820, theme = 'light', onComplete, initial }) {
  const t = themes[theme];
  const [step, setStep] = React.useState(0);

  // The profile builds up across steps
  const [profile, setProfile] = React.useState(initial || {
    name: '',
    age: 30,
    sex: '',
    tracksCycle: false,
    height: 168,
    weight: 65,
    activityLevel: 'moderate',
    goal: '',
    connected: [],
    splitDays: null,
    hasGym: true,
    hasEventTraining: false,
  });

  // Step config — split only appears when gym is selected
  const allSteps = ['welcome', 'basics', 'features', 'goal', 'imports', 'split', 'done'];
  const steps = allSteps.filter(s => {
    if (s === 'split') return profile.hasGym;
    return true;
  });
  const current = steps[step] || 'welcome';
  const progress = (step + 1) / steps.length;
  const isLast = step === steps.length - 1;

  // Clamp step if steps array shrinks (e.g. user unchecks gym after reaching split)
  React.useEffect(() => {
    setStep(s => Math.min(s, steps.length - 1));
  }, [steps.length]);

  const next = () => {
    if (isLast) {
      onComplete(profile);
    } else {
      setStep(s => Math.min(s + 1, steps.length - 1));
    }
  };
  const back = () => setStep(s => Math.max(0, s - 1));

  // Whether Next is enabled
  const canAdvance = (() => {
    if (current === 'basics') return profile.name && profile.sex;
    if (current === 'features') return profile.hasGym || profile.hasEventTraining;
    if (current === 'goal') return !!profile.goal;
    return true;
  })();

  const update = (patch) => setProfile(p => ({ ...p, ...patch }));

  return (
    <div style={{
      width, height, background:t.bg, fontFamily:t.sans, color:t.text,
      display:'flex', flexDirection:'column', overflow:'hidden', position:'relative'
    }}>
      {/* Ambient glow */}
      <div style={{
        position:'absolute', top:-80, right:-60, width:280, height:280, borderRadius:'50%',
        background:`radial-gradient(circle, ${t.accent}28, transparent 65%)`, pointerEvents:'none'
      }}/>
      <div style={{
        position:'absolute', bottom:-100, left:-80, width:300, height:300, borderRadius:'50%',
        background:`radial-gradient(circle, ${theme==='dark'?t.purple:'#6D4AAF'}18, transparent 65%)`, pointerEvents:'none'
      }}/>

      {/* Status bar */}
      <div style={{
        height:44, display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        padding:'0 22px 8px', fontSize:14, fontWeight:600, position:'relative'
      }}>
        <span>9:41</span>
        <div style={{ display:'flex', gap:5, alignItems:'center', fontSize:11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Top progress + back */}
      <div style={{
        padding:'4px 20px 14px', display:'flex', alignItems:'center', gap:12,
        position:'relative'
      }}>
        {step > 0 && current !== 'done' ? (
          <button onClick={back} style={{
            width:32, height:32, borderRadius:9, background:'transparent',
            border:`1px solid ${t.border}`, color:t.text, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
            flexShrink:0
          }}>←</button>
        ) : <div style={{ width:32, flexShrink:0 }}/>}

        {/* Progress bar */}
        <div style={{ flex:1 }}>
          <div style={{
            height:3, background:t.border, borderRadius:99, overflow:'hidden'
          }}>
            <div style={{
              height:'100%', background:t.accent, borderRadius:99,
              width: `${progress*100}%`, transition:'width .4s cubic-bezier(.2,.7,.2,1)'
            }}/>
          </div>
          <div style={{
            fontSize:9.5, color:t.text3, marginTop:4, letterSpacing:'.06em',
            display:'flex', justifyContent:'space-between'
          }}>
            <span>Step {step + 1} of {steps.length}</span>
            <span style={{ textTransform:'uppercase' }}>{current === 'done' ? '' : current.replace(/-/g,' ')}</span>
          </div>
        </div>
        <div style={{ width:32 }}/>
      </div>

      {/* Step body */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 22px 16px', position:'relative' }}
           className="phone-scroll">

        {current === 'welcome' && (
          <div style={{ padding:'12px 0' }}>
            <div style={{
              width:64, height:64, borderRadius:18,
              background:`linear-gradient(135deg, ${t.accent}, #6D4AAF)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:t.serif, fontSize:34, color:'#fff', marginBottom:24,
              boxShadow: `0 14px 40px ${t.accent}30`
            }}>F</div>
            <div style={{
              fontFamily:t.serif, fontSize:38, lineHeight:1.05, color:t.text,
              marginBottom:12, letterSpacing:'-.01em'
            }}>
              Welcome to <span style={{ color:t.accent }}>Forma.</span>
            </div>
            <div style={{ fontSize:13.5, color:t.text2, lineHeight:1.55, marginBottom:24 }}>
              Training, nutrition, and recovery — all in one place, tuned to you.
              Let's get you set up. Takes about a minute.
            </div>
            <div style={{
              padding:'14px 16px', borderRadius:14,
              background:t.surface, border:`1px solid ${t.border}`,
              display:'flex', gap:11, marginBottom:10
            }}>
              <div style={{
                width:30, height:30, borderRadius:9, background:t.accent+'18', color:t.accent,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0
              }}>🔒</div>
              <div style={{ fontSize:12, color:t.text2, lineHeight:1.5 }}>
                Everything stays on your device. You decide what we sync.
              </div>
            </div>
          </div>
        )}

        {current === 'basics' && (
          <div>
            <div style={{
              fontFamily:t.serif, fontSize:30, lineHeight:1.1, color:t.text,
              marginBottom:8, letterSpacing:'-.01em'
            }}>
              About you.
            </div>
            <div style={{ fontSize:12.5, color:t.text2, marginBottom:22, lineHeight:1.5 }}>
              We use this to personalise your plan and recommendations.
            </div>

            <Field label="What should we call you?" theme={theme}>
              <input value={profile.name} onChange={(e) => update({ name: e.target.value })}
                autoFocus placeholder="Your name"
                style={inputStyle(t)}/>
            </Field>

            <Field label="Sex assigned at birth" theme={theme}
              hint="Used to tailor recommendations. You'll control cycle tracking next.">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                {[
                  { value:'female', label:'Female' },
                  { value:'male',   label:'Male'   },
                  { value:'other',  label:'Other'  },
                ].map(o => (
                  <button key={o.value}
                    onClick={() => update({
                      sex: o.value,
                      tracksCycle: o.value === 'female' ? true : false,
                    })}
                    style={selectStyle(t, profile.sex === o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="Age" theme={theme}>
                <NumberRow value={profile.age} min={14} max={90} unit="yrs"
                  onChange={(v) => update({ age: v })} theme={theme}/>
              </Field>
              <Field label="Weight" theme={theme}>
                <NumberRow value={profile.weight} min={30} max={200} step={0.5} unit="kg"
                  onChange={(v) => update({ weight: v })} theme={theme}/>
              </Field>
            </div>

            <Field label="Height" theme={theme}>
              <NumberRow value={profile.height} min={130} max={220} unit="cm"
                onChange={(v) => update({ height: v })} theme={theme}/>
            </Field>

            <Field label="Activity level" theme={theme}
              hint="Used to calculate your daily calorie target.">
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {ACTIVITY_LEVELS.map(lvl => (
                  <button key={lvl.id} onClick={() => update({ activityLevel: lvl.id })}
                    style={{
                      textAlign:'left', padding:'10px 12px', borderRadius:11, cursor:'pointer',
                      fontFamily:t.sans, display:'flex', alignItems:'center', gap:10,
                      background: profile.activityLevel === lvl.id ? t.accent+'10' : t.surface,
                      border:`1.5px solid ${profile.activityLevel === lvl.id ? t.accent : t.border}`,
                    }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12.5, color:t.text, fontWeight:500 }}>{lvl.label}</div>
                      <div style={{ fontSize:10.5, color:t.text3, marginTop:1 }}>{lvl.sub}</div>
                    </div>
                    {profile.activityLevel === lvl.id && (
                      <span style={{
                        width:18, height:18, borderRadius:'50%', background:t.accent, color:t.accentText,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0
                      }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {current === 'features' && (
          <div>
            <div style={{
              fontFamily:t.serif, fontSize:30, lineHeight:1.1, color:t.text,
              marginBottom:8, letterSpacing:'-.01em'
            }}>
              What do you want to track?
            </div>
            <div style={{ fontSize:12.5, color:t.text2, marginBottom:22, lineHeight:1.5 }}>
              Choose what you'd like to use Forma for. You can change these any time in your profile.
            </div>

            {/* Gym / cardio */}
            <FeatureCard
              icon="🏋️"
              title="Gym & cardio"
              sub="Log workouts, track sets and reps, plan your training split."
              active={profile.hasGym}
              theme={theme}
              onToggle={() => update({ hasGym: !profile.hasGym })}
            />

            {/* Event training */}
            <FeatureCard
              icon="🏅"
              title="Training for an event"
              sub="Follow a structured plan for a triathlon, race, or other event."
              active={profile.hasEventTraining}
              theme={theme}
              onToggle={() => update({ hasEventTraining: !profile.hasEventTraining })}
            />

            {/* Cycle tracking — only if female or other */}
            {(profile.sex === 'female' || profile.sex === 'other') && (
              <FeatureCard
                icon="🌸"
                title="Cycle tracking"
                sub="Get phase-aware training and nutrition recommendations."
                active={profile.tracksCycle}
                theme={theme}
                onToggle={() => update({ tracksCycle: !profile.tracksCycle })}
              />
            )}

            {!profile.hasGym && !profile.hasEventTraining && (
              <div style={{
                marginTop:10, padding:'10px 12px', borderRadius:10,
                background:t.surface2, border:`1px dashed ${t.border}`,
                fontSize:11.5, color:t.text3, lineHeight:1.5,
              }}>
                Select at least one feature to continue.
              </div>
            )}
          </div>
        )}

        {current === 'goal' && (
          <div>
            <div style={{
              fontFamily:t.serif, fontSize:30, lineHeight:1.1, color:t.text,
              marginBottom:8, letterSpacing:'-.01em'
            }}>
              What are you here for?
            </div>
            <div style={{ fontSize:12.5, color:t.text2, marginBottom:22, lineHeight:1.5 }}>
              Pick your main goal — we'll shape your plan around it.
            </div>

            {GOAL_OPTIONS.map(g => (
              <button key={g.id} onClick={() => update({ goal: g.id })} style={{
                width:'100%', textAlign:'left', padding:'12px 14px', borderRadius:13,
                background: profile.goal === g.id ? t.accent+'10' : t.surface,
                border:`1.5px solid ${profile.goal === g.id ? t.accent : t.border}`,
                cursor:'pointer', fontFamily:t.sans, marginBottom:8,
                display:'flex', gap:11, alignItems:'center'
              }}>
                <div style={{
                  width:36, height:36, borderRadius:10,
                  background: profile.goal === g.id ? t.accent+'20' : t.surface2,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                  flexShrink:0
                }}>{g.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:t.text, fontWeight:500 }}>{g.label}</div>
                  <div style={{ fontSize:10.5, color:t.text3, marginTop:1 }}>{g.sub}</div>
                </div>
                {profile.goal === g.id && (
                  <span style={{
                    width:20, height:20, borderRadius:'50%', background:t.accent, color:t.accentText,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:11
                  }}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        {current === 'imports' && (
          <div>
            <div style={{
              fontFamily:t.serif, fontSize:30, lineHeight:1.1, color:t.text,
              marginBottom:8, letterSpacing:'-.01em'
            }}>
              Bring your data.
            </div>
            <div style={{ fontSize:12.5, color:t.text2, marginBottom:22, lineHeight:1.5 }}>
              Connect apps you already use. We'll sync workouts, meals, sleep — nothing else.
              Skip any and add them later.
            </div>

            {IMPORT_SOURCES.filter(s => !s.cycleOnly || profile.tracksCycle).map(src => {
              const connected = profile.connected.includes(src.id);
              return (
                <button key={src.id} onClick={() => {
                  update({
                    connected: connected
                      ? profile.connected.filter(c => c !== src.id)
                      : [...profile.connected, src.id]
                  });
                }} style={{
                  width:'100%', textAlign:'left', padding:'11px 14px', borderRadius:12,
                  background: connected ? t.accent+'08' : t.surface,
                  border:`1.5px solid ${connected ? t.accent : t.border}`,
                  cursor:'pointer', fontFamily:t.sans, marginBottom:6,
                  display:'flex', gap:11, alignItems:'center'
                }}>
                  <div style={{
                    width:34, height:34, borderRadius:9, background:src.color, color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:t.serif, fontSize:14, fontWeight:600, flexShrink:0
                  }}>{src.glyph}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:t.text, fontWeight:500 }}>{src.name}</div>
                    <div style={{ fontSize:10.5, color:t.text3, marginTop:1 }}>{src.scope}</div>
                  </div>
                  <div style={{
                    padding:'5px 10px', borderRadius:8,
                    background: connected ? t.green+'20' : 'transparent',
                    border: connected ? `1px solid ${t.green}40` : `1px solid ${t.border2}`,
                    color: connected ? t.green : t.text2,
                    fontSize:10.5, fontWeight:600
                  }}>
                    {connected ? '✓ Linked' : 'Connect'}
                  </div>
                </button>
              );
            })}

            <div style={{
              marginTop:14, padding:'10px 12px', borderRadius:10,
              background:t.surface2, border:`1px dashed ${t.border2}`,
              fontSize:11, color:t.text3, lineHeight:1.5
            }}>
              You can connect or disconnect anything anytime in Settings.
            </div>
          </div>
        )}

        {current === 'split' && (
          <div>
            <div style={{
              fontFamily:t.serif, fontSize:30, lineHeight:1.1, color:t.text,
              marginBottom:8, letterSpacing:'-.01em'
            }}>
              Gym week.
            </div>
            <div style={{ fontSize:12.5, color:t.text2, marginBottom:22, lineHeight:1.5 }}>
              How many days do you want to train? We'll suggest a split — you can edit later.
            </div>

            <div style={{
              display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6, marginBottom:18
            }}>
              {[1,2,3,4,5].map(d => (
                <button key={d} onClick={() => update({ splitDays: d })} style={{
                  padding:'14px 0 10px', borderRadius:13,
                  background: d === profile.splitDays ? t.text : t.surface,
                  color: d === profile.splitDays ? '#fff' : t.text,
                  border: d === profile.splitDays ? `1.5px solid ${t.text}` : `1px solid ${t.border}`,
                  fontFamily:t.serif, fontSize:22, lineHeight:1, cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:4
                }}>
                  {d}
                  <span style={{
                    fontFamily:t.sans, fontSize:9, letterSpacing:'.1em',
                    color: d === profile.splitDays ? '#fff' : t.text3, fontWeight:500
                  }}>
                    DAY{d > 1 ? 'S' : ''}
                  </span>
                </button>
              ))}
            </div>

            {profile.splitDays && SPLITS[profile.splitDays] && (
              <div style={{
                background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
                padding:'14px 16px'
              }}>
                <div style={{ fontFamily:t.serif, fontSize:18, color:t.text, marginBottom:4 }}>
                  {SPLITS[profile.splitDays].name}
                </div>
                <div style={{ fontSize:11.5, color:t.text2, lineHeight:1.5 }}>
                  {SPLITS[profile.splitDays].description}
                </div>
              </div>
            )}
          </div>
        )}

        {current === 'done' && (
          <div style={{ textAlign:'center', paddingTop:18 }}>
            <div style={{
              width:72, height:72, borderRadius:'50%',
              background:`linear-gradient(135deg, ${t.green}, ${t.accent})`,
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 22px', fontSize:32, color:'#fff',
              boxShadow: `0 14px 40px ${t.accent}30`
            }}>✓</div>
            <div style={{
              fontFamily:t.serif, fontSize:32, lineHeight:1.1, color:t.text,
              marginBottom:12, letterSpacing:'-.01em'
            }}>
              You're all set, {profile.name || 'friend'}.
            </div>
            <div style={{ fontSize:13, color:t.text2, lineHeight:1.55, marginBottom:24, padding:'0 12px' }}>
              {'Your Forma is ready. Everything is personalised to you.'}
              {profile.connected.length > 0 &&
                ` We'll start syncing ${profile.connected.length} ${profile.connected.length === 1 ? 'app' : 'apps'} now.`}
            </div>

            {/* Tiny recap */}
            <div style={{
              background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
              padding:'12px 14px', textAlign:'left', marginBottom:8
            }}>
              {[
                { label:'Profile',  value: `${profile.name || '—'} · ${profile.age}yrs` },
                { label:'Goal',     value: GOAL_OPTIONS.find(g => g.id === profile.goal)?.label || '—' },
                profile.hasGym && profile.splitDays ? { label:'Gym split', value: SPLITS[profile.splitDays].name } : null,
                profile.hasEventTraining ? { label:'Event training', value:'Enabled' } : null,
                profile.tracksCycle ? { label:'Cycle', value:'Tracking on' } : null,
                profile.connected.length ? { label:'Connected', value:`${profile.connected.length} apps` } : null,
              ].filter(Boolean).map((r,i,arr) => (
                <div key={r.label} style={{
                  display:'flex', justifyContent:'space-between', padding:'7px 0',
                  borderTop: i>0 ? `1px solid ${t.border}` : 'none',
                  fontSize:12
                }}>
                  <span style={{
                    fontSize:10, color:t.text3, letterSpacing:'.1em',
                    textTransform:'uppercase', alignSelf:'center'
                  }}>{r.label}</span>
                  <span style={{ color:t.text, textAlign:'right' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div style={{
        padding:'12px 22px 18px',
        background:t.bg, borderTop: current === 'welcome' ? 'none' : `1px solid ${t.border}`,
        position:'relative'
      }}>
        <button onClick={next} disabled={!canAdvance} style={{
          width:'100%', padding:'14px', borderRadius:13,
          background: canAdvance ? t.accent : t.surface2,
          color: canAdvance ? t.accentText : t.text3,
          border:'none', fontFamily:t.sans, fontSize:14, fontWeight:600,
          cursor: canAdvance ? 'pointer' : 'default',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6
        }}>
          {current === 'welcome' ? 'Get started →' :
           current === 'imports' ? (profile.connected.length ? 'Continue →' : 'Skip for now') :
           current === 'done' ? 'Enter Forma →' :
           'Continue →'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Small reusable subcomponents

function Field({ label, hint, theme, children }) {
  const t = themes[theme];
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{
        fontSize:10, letterSpacing:'.12em', textTransform:'uppercase',
        color:t.text3, fontWeight:500, marginBottom:7
      }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize:10.5, color:t.text3, marginTop:6, lineHeight:1.5 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function inputStyle(t) {
  return {
    width:'100%', padding:'12px 14px', borderRadius:11,
    border:`1px solid ${t.border2}`, background:t.surface,
    fontFamily:t.sans, fontSize:14, color:t.text, outline:'none'
  };
}

function selectStyle(t, active) {
  return {
    padding:'10px', borderRadius:11,
    background: active ? t.text : t.surface,
    color: active ? '#fff' : t.text,
    border: active ? `1.5px solid ${t.text}` : `1px solid ${t.border}`,
    fontFamily:t.sans, fontSize:12.5, cursor:'pointer', fontWeight:500
  };
}

function NumberRow({ value, min, max, step = 1, unit, onChange, theme }) {
  const t = themes[theme];
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const [draft, setDraft] = React.useState(String(value));
  // Keep draft in sync when value changes via +/− buttons
  React.useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = (raw) => {
    const n = parseFloat(raw);
    if (Number.isNaN(n)) { setDraft(String(value)); return; }
    onChange(clamp(n));
  };

  return (
    <div style={{
      display:'flex', alignItems:'stretch',
      background:t.surface, border:`1px solid ${t.border2}`, borderRadius:11,
      overflow:'hidden'
    }}>
      <button onClick={() => onChange(clamp(Number((value - step).toFixed(1))))} style={{
        width:38, background:'transparent', border:'none', color:t.text2,
        fontSize:16, cursor:'pointer', fontFamily:t.sans,
        borderRight:`1px solid ${t.border}`, flexShrink:0
      }}>−</button>
      <div style={{
        flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4,
        minWidth:0
      }}>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{
            width: Math.max(28, String(draft).length * 11 + 6),
            maxWidth:'70%',
            border:'none', outline:'none', background:'transparent',
            fontFamily:t.serif, fontSize:18, color:t.text,
            fontVariantNumeric:'tabular-nums', textAlign:'center', padding:0
          }}
        />
        <span style={{ fontSize:11, color:t.text3, fontFamily:t.sans, flexShrink:0 }}>{unit}</span>
      </div>
      <button onClick={() => onChange(clamp(Number((value + step).toFixed(1))))} style={{
        width:38, background:'transparent', border:'none', color:t.text2,
        fontSize:16, cursor:'pointer', fontFamily:t.sans,
        borderLeft:`1px solid ${t.border}`, flexShrink:0
      }}>+</button>
    </div>
  );
}


function FeatureCard({ icon, title, sub, active, theme, onToggle }) {
  const t = themes[theme];
  return (
    <button onClick={onToggle} style={{
      width:'100%', textAlign:'left', padding:'14px 16px', borderRadius:14,
      background: active ? t.accent+'10' : t.surface,
      border:`1.5px solid ${active ? t.accent : t.border}`,
      cursor:'pointer', fontFamily:t.sans, marginBottom:10,
      display:'flex', gap:12, alignItems:'flex-start',
    }}>
      <div style={{
        width:38, height:38, borderRadius:11,
        background: active ? t.accent+'25' : t.surface2,
        color: active ? t.accent : t.text2,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0,
      }}>{icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, color:t.text, fontWeight:500, marginBottom:3 }}>{title}</div>
        <div style={{ fontSize:11.5, color:t.text2, lineHeight:1.5 }}>{sub}</div>
      </div>
      <div style={{
        width:22, height:22, borderRadius:'50%', flexShrink:0,
        background: active ? t.accent : 'transparent',
        border: active ? `none` : `1.5px solid ${t.border}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        color: active ? t.accentText : t.text3, fontSize:12,
      }}>{active ? '✓' : ''}</div>
    </button>
  );
}

export { IMPORT_SOURCES, GOAL_OPTIONS, OnboardingScreen, Field, inputStyle, selectStyle, NumberRow };
