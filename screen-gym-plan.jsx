// Gym Planning screens: Hub (landing), Split Picker, Session Editor
// Lets the user see their plan, pick split frequency (1-5 days), and edit
// individual sessions grouped by Compound / Accessory / Core / Mobility.

// ────────────────────────────────────────────────────────────
// Exercise library
const EX_LIB = {
  // Compounds
  bench:       { name:'Bench press',          muscle:'Chest',         type:'compound' },
  squat:       { name:'Barbell squat',        muscle:'Quads/Glutes',  type:'compound' },
  deadlift:    { name:'Deadlift',             muscle:'Full back',     type:'compound' },
  ohp:         { name:'Overhead press',       muscle:'Shoulders',     type:'compound' },
  pullups:     { name:'Pull-ups',             muscle:'Lats/Biceps',   type:'compound' },
  barbellrow:  { name:'Barbell row',          muscle:'Upper back',    type:'compound' },
  rdl:         { name:'Romanian deadlift',    muscle:'Hamstrings',    type:'compound' },
  // Accessories
  incline:     { name:'Incline DB press',     muscle:'Upper chest',   type:'accessory' },
  decline:     { name:'Decline press',        muscle:'Lower chest',   type:'accessory' },
  cablefly:    { name:'Cable fly',            muscle:'Chest',         type:'accessory' },
  lateral:     { name:'Lateral raises',       muscle:'Shoulders',     type:'accessory' },
  frontraise:  { name:'Front raises',         muscle:'Front delts',   type:'accessory' },
  tricep:      { name:'Tricep pushdown',      muscle:'Triceps',       type:'accessory' },
  skulls:      { name:'Skull crushers',       muscle:'Triceps',       type:'accessory' },
  cgbench:     { name:'Close-grip bench',     muscle:'Triceps',       type:'accessory' },
  curls:       { name:'Bicep curls',          muscle:'Biceps',        type:'accessory' },
  hammer:      { name:'Hammer curls',         muscle:'Brachialis',    type:'accessory' },
  cablerow:    { name:'Cable row',            muscle:'Mid back',      type:'accessory' },
  tbar:        { name:'T-bar row',            muscle:'Mid back',      type:'accessory' },
  facepull:    { name:'Face pulls',           muscle:'Rear delts',    type:'accessory' },
  legpress:    { name:'Leg press',            muscle:'Quads',         type:'accessory' },
  legext:      { name:'Leg extension',        muscle:'Quads',         type:'accessory' },
  lunges:      { name:'Walking lunges',       muscle:'Quads/Glutes',  type:'accessory' },
  bss:         { name:'Bulgarian split squat',muscle:'Quads/Glutes',  type:'accessory' },
  legcurl:     { name:'Leg curl',             muscle:'Hamstrings',    type:'accessory' },
  hipthrust:   { name:'Hip thrust',           muscle:'Glutes',        type:'accessory' },
  calf:        { name:'Calf raises',          muscle:'Calves',        type:'accessory' },
  // Core
  plank:       { name:'Plank',                muscle:'Core',          type:'core' },
  crunches:    { name:'Crunches',             muscle:'Abs',           type:'core' },
  legraise:    { name:'Hanging leg raise',    muscle:'Lower abs',     type:'core' },
  cabletwist:  { name:'Cable woodchop',       muscle:'Obliques',      type:'core' },
  deadbug:     { name:'Dead bug',             muscle:'Deep core',     type:'core' },
  pallof:      { name:'Pallof press',         muscle:'Anti-rotation', type:'core' },
  // Mobility / Stretch
  catcow:      { name:'Cat-cow',              muscle:'Spine',         type:'mobility' },
  hipopen:     { name:'Hip openers',          muscle:'Hips',          type:'mobility' },
  thoracic:    { name:'Thoracic rotation',    muscle:'Upper back',    type:'mobility' },
  hamstring:   { name:'Hamstring stretch',    muscle:'Hamstrings',    type:'mobility' },
  pigeon:      { name:'Pigeon pose',          muscle:'Glutes/hips',   type:'mobility' },
  childpose:   { name:'Child\u2019s pose',    muscle:'Spine/hips',    type:'mobility' },
  ankleroll:   { name:'Ankle mobility',       muscle:'Ankles',        type:'mobility' },
};

// ────────────────────────────────────────────────────────────
// Split templates by #days/week
const SPLITS = {
  1: {
    name: 'Full Body',
    sub:  '1 day · Hit everything',
    description:'One hard session per week. Big compounds + accessories.',
    schedule: ['—','full','—','—','—','—','—'],
    days: [
      { id:'full', name:'Full Body', muscles:'Chest · Back · Legs · Core',
        compound:['squat','bench','barbellrow','ohp'],
        accessory:['rdl','curls'],
        core:['plank'],
        mobility:['catcow','hipopen'] },
    ]
  },
  2: {
    name: 'Upper / Lower',
    sub:  '2 days · Classic split',
    description:'Upper body day + lower body day. Compounds prioritised.',
    schedule: ['—','upper','—','lower','—','—','—'],
    days: [
      { id:'upper', name:'Upper', muscles:'Chest · Back · Shoulders · Arms',
        compound:['bench','pullups','ohp','barbellrow'],
        accessory:['lateral','curls','tricep'],
        core:['plank'],
        mobility:['thoracic'] },
      { id:'lower', name:'Lower', muscles:'Quads · Hamstrings · Glutes',
        compound:['squat','rdl'],
        accessory:['hipthrust','legpress','legcurl','calf'],
        core:['legraise'],
        mobility:['hipopen','hamstring'] },
    ]
  },
  3: {
    name: 'Push / Pull / Legs',
    sub:  '3 days · Most popular',
    description:'Separate push, pull and legs for full recovery between.',
    schedule: ['—','push','—','pull','—','legs','—'],
    days: [
      { id:'push', name:'Push', muscles:'Chest · Shoulders · Triceps',
        compound:['bench','ohp'],
        accessory:['incline','lateral','tricep','skulls'],
        core:['plank'],
        mobility:['thoracic'] },
      { id:'pull', name:'Pull', muscles:'Back · Biceps · Rear delts',
        compound:['pullups','barbellrow','deadlift'],
        accessory:['cablerow','facepull','curls','hammer'],
        core:['legraise'],
        mobility:['catcow'] },
      { id:'legs', name:'Legs', muscles:'Quads · Hamstrings · Glutes',
        compound:['squat','rdl'],
        accessory:['legpress','hipthrust','legcurl','calf'],
        core:['cabletwist'],
        mobility:['hipopen','hamstring'] },
    ]
  },
  4: {
    name: 'Upper / Lower × 2',
    sub:  '4 days · 2× frequency',
    description:'Hit each muscle group twice a week. More volume.',
    schedule: ['upperA','lowerA','—','upperB','lowerB','—','—'],
    days: [
      { id:'upperA', name:'Upper A', muscles:'Heavy compounds',
        compound:['bench','barbellrow','ohp'],
        accessory:['incline','curls'],
        core:['plank'], mobility:['thoracic'] },
      { id:'lowerA', name:'Lower A', muscles:'Quad-focused',
        compound:['squat'],
        accessory:['legpress','legext','calf'],
        core:['legraise'], mobility:['hipopen'] },
      { id:'upperB', name:'Upper B', muscles:'Volume + isolation',
        compound:['pullups','ohp'],
        accessory:['cablerow','lateral','tricep','hammer'],
        core:['cabletwist'], mobility:['catcow'] },
      { id:'lowerB', name:'Lower B', muscles:'Posterior chain',
        compound:['rdl','hipthrust'],
        accessory:['legcurl','calf','bss'],
        core:['plank'], mobility:['hamstring','pigeon'] },
    ]
  },
  5: {
    name: 'Bro Split',
    sub:  '5 days · Max volume',
    description:'One body part per day. High frequency for committed lifters.',
    schedule: ['chest','back','legs','shoulders','arms','—','—'],
    days: [
      { id:'chest', name:'Chest', muscles:'Chest',
        compound:['bench'],
        accessory:['incline','cablefly','decline'],
        core:['plank'], mobility:['thoracic'] },
      { id:'back', name:'Back', muscles:'Back',
        compound:['deadlift','pullups','barbellrow'],
        accessory:['cablerow','tbar','facepull'],
        core:['legraise'], mobility:['catcow'] },
      { id:'legs', name:'Legs', muscles:'Legs',
        compound:['squat','rdl'],
        accessory:['legpress','hipthrust','legcurl','calf','lunges'],
        core:['cabletwist'], mobility:['hipopen','hamstring'] },
      { id:'shoulders', name:'Shoulders', muscles:'Shoulders',
        compound:['ohp'],
        accessory:['lateral','frontraise','facepull'],
        core:['pallof'], mobility:['thoracic'] },
      { id:'arms', name:'Arms', muscles:'Biceps + Triceps',
        compound:['cgbench'],
        accessory:['curls','hammer','tricep','skulls'],
        core:['plank'], mobility:['catcow'] },
    ]
  }
};

const SECTION_META = {
  compound:  { label:'Compound',  hint:'Big lifts. Prioritise strength.',     color:'#BE5A38' },
  accessory: { label:'Accessory', hint:'Isolation + volume.',                  color:'#B45309' },
  core:      { label:'Core',      hint:'Anti-rotation, stability, abs.',       color:'#6D4AAF' },
  mobility:  { label:'Mobility',  hint:'Pre/post stretches & joint prep.',     color:'#15803D' },
};
const SECTION_ORDER = ['compound','accessory','core','mobility'];
const WEEK_DAYS = ['M','T','W','T','F','S','S'];

// ────────────────────────────────────────────────────────────
// Top app bar (shared)
function ScreenHeader({ theme, title, sub, onBack, right }) {
  const t = themes[theme];
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'2px 16px 12px', borderBottom:`1px solid ${t.border}`,
      background: t.bg, gap:8
    }}>
      {onBack ? (
        <button onClick={onBack} style={{
          width:32, height:32, borderRadius:9, background:'transparent',
          border:`1px solid ${t.border}`, color:t.text, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
          flexShrink:0
        }}>←</button>
      ) : <div style={{ width:32, flexShrink:0 }}/>}
      <div style={{ flex:1, textAlign:'center', minWidth:0 }}>
        {sub && <div style={{
          fontSize:9, letterSpacing:'.18em', color:t.text3,
          textTransform:'uppercase', marginBottom:1, fontWeight:500
        }}>{sub}</div>}
        <div style={{ fontFamily:t.serif, fontSize:18, color:t.text, lineHeight:1 }}>
          {title}
        </div>
      </div>
      <div style={{ display:'flex', gap:5, flexShrink:0, minWidth:32, justifyContent:'flex-end' }}>
        {right || null}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Gym Hub — the Gym tab landing page
function GymHubScreen({ width = 390, height = 820, theme = 'light',
                       plan, todayIdx = 0, dayOfWeek = 1, activeSession,
                       activities = {},
                       onNav, onStartSession, onResumeSession,
                       onChangeSplit, onEditDay, onSelectDay, onTapDay,
                       onBrowseLibrary,
                       tracksCycle = true }) {
  const t = themes[theme];
  const split = SPLITS[plan.splitDays];
  const totalDays = split.days.length;
  const today = split.days[todayIdx % totalDays];
  const todayExercises = SECTION_ORDER.flatMap(sec => (today[sec] || []).map(id => ({ id, sec })));

  return (
    <div style={{
      width, height, background:t.bg, fontFamily:t.sans, color:t.text,
      display:'flex', flexDirection:'column', overflow:'hidden', position:'relative'
    }}>
      {/* Status bar */}
      <div style={{
        height:44, display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        padding:'0 22px 8px', fontSize:14, fontWeight:600
      }}>
        <span>9:41</span>
        <div style={{ display:'flex', gap:5, alignItems:'center', fontSize:11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'8px 20px 16px' }} className="phone-scroll">

        {/* Top header */}
        <div style={{ marginBottom:14 }}>
          <div style={{
            fontSize:9.5, letterSpacing:'.18em', textTransform:'uppercase',
            color:t.text3, marginBottom:3
          }}>
            Your plan
          </div>
          <div style={{ fontFamily:t.serif, fontSize:28, lineHeight:1, color:t.text }}>
            {split.name}
          </div>
        </div>

        {/* Split summary card */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:18,
          padding:'14px 16px', marginBottom:14
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{
              fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
              color:t.text3
            }}>
              This week · {split.sub}
            </div>
            <button onClick={onChangeSplit} style={{
              padding:'3px 8px', borderRadius:7,
              background:'transparent', border:`1px solid ${t.border}`,
              color:t.accent, fontSize:11, fontWeight:500, cursor:'pointer',
              fontFamily:t.sans
            }}>Change ›</button>
          </div>

          {/* Weekly grid */}
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:5
          }}>
            {WEEK_DAYS.map((dayLetter, i) => {
              const slot = split.schedule[i];
              const isToday = i === dayOfWeek;
              const isRest = slot === '—';
              const dayInfo = !isRest ? split.days.find(d => d.id === slot) : null;
              const dayActs = activities[i] || [];
              return (
                <div key={i}
                  onClick={(e) => { e.stopPropagation(); onTapDay && onTapDay(i); }}
                  style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                    cursor:'pointer', padding:'2px 0'
                  }}>
                  <div style={{
                    fontSize:9.5, color: isToday ? t.accent : t.text3, fontWeight:500
                  }}>
                    {dayLetter}
                  </div>
                  <div style={{
                    position:'relative',
                    width:32, height:32, borderRadius:8,
                    background: isRest
                      ? t.surface2
                      : (isToday ? t.accent : (t.accent + '20')),
                    border: isToday ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
                    color: isToday ? t.accentText : (isRest ? t.text3 : t.accent),
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:600, fontFamily:t.mono
                  }}>
                    {isRest ? (dayActs.length ? '+' : '·') : dayInfo.name.charAt(0)}
                    {/* Activity dot indicator */}
                    {dayActs.length > 0 && (
                      <span style={{
                        position:'absolute', top:-3, right:-3,
                        width:10, height:10, borderRadius:'50%',
                        background: '#0090FF', border:`2px solid ${t.surface}`,
                        fontSize:7, color:'#fff', display:'flex',
                        alignItems:'center', justifyContent:'center', lineHeight:1
                      }}>{dayActs.length}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{
            marginTop:9, padding:'7px 10px', borderRadius:8,
            background: t.surface2, border:`1px dashed ${t.border2}`,
            fontSize:10, color:t.text3, textAlign:'center', letterSpacing:'.02em'
          }}>
            Tap any day to log a run, swim, yoga or other activity
          </div>
        </div>

        {/* Today's session — large card */}
        <div style={{
          background:t.surface, border:`1.5px solid ${t.accent}50`, borderRadius:20,
          padding:'16px 18px 14px', marginBottom:14,
          boxShadow: theme==='dark' ? `0 0 20px ${t.accent}15` : `0 4px 14px ${t.accent}10`,
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{
                fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
                color:t.accent, marginBottom:3, fontWeight:600
              }}>
                Today · {todayExercises.length} exercises
              </div>
              <div style={{ fontFamily:t.serif, fontSize:26, lineHeight:1.05, color:t.text }}>
                {today.name} day
              </div>
              <div style={{ fontSize:11.5, color:t.text2, marginTop:3 }}>
                {today.muscles}
              </div>
            </div>
            <button onClick={() => onEditDay(today.id)} style={{
              padding:'6px 10px', borderRadius:8,
              background:'transparent', border:`1px solid ${t.border2}`,
              color:t.text2, fontSize:10.5, cursor:'pointer', fontFamily:t.sans,
              display:'flex', alignItems:'center', gap:4
            }}>
              ✎ Edit
            </button>
          </div>

          {/* Sections preview */}
          <div style={{ marginBottom:12 }}>
            {SECTION_ORDER.map(sec => {
              const exs = today[sec] || [];
              if (!exs.length) return null;
              const meta = SECTION_META[sec];
              return (
                <div key={sec} style={{
                  display:'flex', alignItems:'baseline', gap:8, padding:'7px 0',
                  borderTop:`1px solid ${t.border}`
                }}>
                  <div style={{
                    fontSize:9, letterSpacing:'.16em', color:meta.color,
                    textTransform:'uppercase', fontWeight:600,
                    minWidth:64
                  }}>
                    {meta.label}
                  </div>
                  <div style={{ flex:1, fontSize:11.5, color:t.text2, lineHeight:1.45 }}>
                    {exs.map(id => EX_LIB[id]?.name || id).join(' · ')}
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={activeSession ? onResumeSession : onStartSession} style={{
            width:'100%', padding:'12px', borderRadius:11,
            background:t.accent, color:t.accentText,
            border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:6
          }}>
            {activeSession ? 'Resume session →' : 'Start session →'}
          </button>
        </div>

        {/* Other days in this split */}
        <div style={{
          fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
          color:t.text3, marginBottom:8, padding:'0 4px'
        }}>
          All sessions in {split.name}
        </div>
        {split.days.map((d, i) => {
          const isToday = i === todayIdx;
          const totalEx =
            (d.compound||[]).length + (d.accessory||[]).length +
            (d.core||[]).length + (d.mobility||[]).length;
          return (
            <div key={d.id} onClick={() => onSelectDay(i)} style={{
              display:'flex', alignItems:'center', gap:11, padding:'11px 14px',
              background:t.surface, border:`1px solid ${isToday ? t.accent+'70' : t.border}`,
              borderRadius:13, marginBottom:6, cursor:'pointer'
            }}>
              <div style={{
                width:34, height:34, borderRadius:9,
                background: isToday ? t.accent : t.surface2,
                color: isToday ? t.accentText : t.text2,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:t.serif, fontSize:14, flexShrink:0
              }}>
                {d.name.charAt(0)}
              </div>
              <div style={{ flex:1 }}>
                <div style={{
                  fontSize:13, color:t.text, fontWeight:500,
                  display:'flex', alignItems:'center', gap:6
                }}>
                  {d.name}
                  {isToday && <span style={{
                    fontSize:9, padding:'1px 6px', borderRadius:4,
                    background:t.accent+'18', color:t.accent,
                    fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase'
                  }}>Today</span>}
                </div>
                <div style={{ fontSize:10.5, color:t.text3 }}>
                  {d.muscles} · {totalEx} exercises
                </div>
              </div>
              <span style={{ fontSize:16, color:t.text3 }}>›</span>
            </div>
          );
        })}

        {/* Browse exercise library */}
        <button onClick={onBrowseLibrary} style={{
          width:'100%', display:'flex', alignItems:'center', gap:11, padding:'12px 14px',
          background:'transparent', border:`1.5px dashed ${t.border2}`,
          borderRadius:13, marginTop:10, cursor:'pointer', fontFamily:t.sans
        }}>
          <div style={{
            width:34, height:34, borderRadius:9,
            background:`linear-gradient(135deg, ${t.accent}, #6D4AAF)`,
            color:'#fff', fontFamily:t.serif, fontSize:18,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            position:'relative', overflow:'hidden'
          }}>
            <div style={{
              position:'absolute', inset:0,
              backgroundImage:'repeating-linear-gradient(45deg, rgba(255,255,255,.1) 0 1px, transparent 1px 8px)'
            }}/>
            <span style={{ position:'relative' }}>≡</span>
          </div>
          <div style={{ flex:1, textAlign:'left' }}>
            <div style={{ fontSize:12.5, color:t.text, fontWeight:500 }}>
              Browse exercise library
            </div>
            <div style={{ fontSize:10.5, color:t.text3, marginTop:1 }}>
              All {Object.keys(window.EX_LIB || {}).length} exercises · search by muscle or type
            </div>
          </div>
          <span style={{ fontSize:16, color:t.text3 }}>›</span>
        </button>
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle}/>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Split Picker — choose 1/2/3/4/5 days per week
function SplitPickerScreen({ width = 390, height = 820, theme = 'light',
                            plan, onBack, onSave, onNav, tracksCycle = true }) {
  const t = themes[theme];
  const [selected, setSelected] = React.useState(plan.splitDays);
  const split = SPLITS[selected];

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

      <ScreenHeader theme={theme} title="Choose split" sub="Gym week"
        onBack={onBack}
        right={
          <button onClick={() => onSave(selected)} style={{
            padding:'6px 12px', borderRadius:8, background:t.accent, color:t.accentText,
            border:'none', fontFamily:t.sans, fontSize:11, fontWeight:600, cursor:'pointer'
          }}>Save</button>
        }
      />

      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px 16px' }} className="phone-scroll">

        <div style={{ fontSize:12, color:t.text2, marginBottom:14, lineHeight:1.5 }}>
          How many gym days per week? The split structure adapts — more frequency means more focused sessions.
        </div>

        {/* Day count toggle */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6, marginBottom:16
        }}>
          {[1,2,3,4,5].map(d => (
            <button key={d} onClick={() => setSelected(d)} style={{
              padding:'14px 0 10px', borderRadius:13,
              background: d === selected ? t.text : t.surface,
              color: d === selected ? '#fff' : t.text,
              border: d === selected ? `1.5px solid ${t.text}` : `1px solid ${t.border}`,
              fontFamily:t.serif, fontSize:22, lineHeight:1, cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', gap:4
            }}>
              {d}
              <span style={{
                fontFamily:t.sans, fontSize:9, letterSpacing:'.1em',
                color: d === selected ? '#fff' : t.text3, fontWeight:500
              }}>
                DAY{d > 1 ? 'S' : ''}
              </span>
            </button>
          ))}
        </div>

        {/* Selected split preview */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:18,
          padding:'16px 18px', marginBottom:14
        }}>
          <div style={{ fontFamily:t.serif, fontSize:22, color:t.text, marginBottom:3 }}>
            {split.name}
          </div>
          <div style={{ fontSize:11.5, color:t.text2, marginBottom:14, lineHeight:1.5 }}>
            {split.description}
          </div>

          {/* Weekly schedule */}
          <div style={{
            fontSize:9.5, letterSpacing:'.16em', textTransform:'uppercase',
            color:t.text3, marginBottom:7, fontWeight:500
          }}>
            Weekly schedule
          </div>
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:5, marginBottom:14
          }}>
            {WEEK_DAYS.map((dayLetter, i) => {
              const slot = split.schedule[i];
              const isRest = slot === '—';
              const dayInfo = !isRest ? split.days.find(d => d.id === slot) : null;
              return (
                <div key={i} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:4
                }}>
                  <div style={{ fontSize:9.5, color:t.text3 }}>{dayLetter}</div>
                  <div style={{
                    width:'100%', aspectRatio:'1', borderRadius:7,
                    background: isRest ? t.surface2 : t.accent+'18',
                    border: `1px solid ${isRest ? t.border : t.accent+'40'}`,
                    color: isRest ? t.text3 : t.accent,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:600
                  }}>
                    {isRest ? '·' : dayInfo.name.charAt(0)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day breakdown */}
          <div style={{
            fontSize:9.5, letterSpacing:'.16em', textTransform:'uppercase',
            color:t.text3, marginBottom:8, fontWeight:500
          }}>
            Sessions
          </div>
          {split.days.map((d, i) => {
            const meta = SECTION_META;
            const totalEx =
              (d.compound||[]).length + (d.accessory||[]).length +
              (d.core||[]).length + (d.mobility||[]).length;
            return (
              <div key={d.id} style={{
                padding:'10px 0',
                borderTop: i>0 ? `1px solid ${t.border}` : 'none'
              }}>
                <div style={{
                  display:'flex', justifyContent:'space-between', alignItems:'baseline'
                }}>
                  <div style={{ fontSize:13, color:t.text, fontWeight:500 }}>
                    {d.name}
                  </div>
                  <div style={{ fontSize:10, color:t.text3 }}>{totalEx} ex.</div>
                </div>
                <div style={{ fontSize:11, color:t.text2, marginTop:2, lineHeight:1.45 }}>
                  {d.muscles}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={() => onSave(selected)} style={{
          width:'100%', padding:'14px', borderRadius:13,
          background:t.accent, color:t.accentText,
          border:'none', fontFamily:t.sans, fontSize:14, fontWeight:600, cursor:'pointer'
        }}>
          Use {split.name} →
        </button>
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle}/>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Session Editor — edit one day's exercises grouped by section
function SessionEditorScreen({ width = 390, height = 820, theme = 'light',
                              plan, dayId, onBack, onSave, onNav, tracksCycle = true }) {
  const t = themes[theme];
  const split = SPLITS[plan.splitDays];
  const originalDay = split.days.find(d => d.id === dayId) || split.days[0];

  // Local working copy
  const [day, setDay] = React.useState(originalDay);
  const [addingTo, setAddingTo] = React.useState(null);    // section being added to
  const [searchQ, setSearchQ] = React.useState('');

  const totalEx = SECTION_ORDER.reduce((n, sec) => n + (day[sec]||[]).length, 0);

  const moveItem = (sec, i, dir) => {
    const list = (day[sec] || []).slice();
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setDay({ ...day, [sec]: list });
  };
  const removeItem = (sec, i) => {
    const list = (day[sec] || []).slice();
    list.splice(i, 1);
    setDay({ ...day, [sec]: list });
  };
  const addItem = (sec, id) => {
    const list = (day[sec] || []).slice();
    if (!list.includes(id)) list.push(id);
    setDay({ ...day, [sec]: list });
    setAddingTo(null);
    setSearchQ('');
  };

  // Pool of exercises available for the section currently being added to
  const availableForAdd = React.useMemo(() => {
    if (!addingTo) return [];
    const used = new Set(SECTION_ORDER.flatMap(s => day[s] || []));
    const q = searchQ.toLowerCase();
    return Object.entries(EX_LIB)
      .filter(([id, ex]) => {
        if (used.has(id)) return false;
        // Show same-type first, but allow cross-type adding
        const matchesType = ex.type === addingTo;
        const matchesQ = !q || ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q);
        return matchesType && matchesQ;
      })
      .map(([id, ex]) => ({ id, ...ex }));
  }, [addingTo, searchQ, day]);

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

      <ScreenHeader theme={theme} title={`${day.name} day`} sub="Edit session"
        onBack={onBack}
        right={
          <button onClick={() => onSave({ ...day })} style={{
            padding:'6px 12px', borderRadius:8, background:t.accent, color:t.accentText,
            border:'none', fontFamily:t.sans, fontSize:11, fontWeight:600, cursor:'pointer'
          }}>Save</button>
        }
      />

      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px 16px' }} className="phone-scroll">

        <div style={{
          fontSize:11, color:t.text2, marginBottom:14, lineHeight:1.5
        }}>
          {totalEx} exercises across {SECTION_ORDER.filter(s => (day[s]||[]).length).length} sections.
          Reorder, swap, or add anything missing.
        </div>

        {SECTION_ORDER.map(sec => {
          const list = day[sec] || [];
          const meta = SECTION_META[sec];
          return (
            <div key={sec} style={{
              background:t.surface, border:`1px solid ${t.border}`, borderRadius:16,
              padding:'12px 14px 10px', marginBottom:11
            }}>
              <div style={{
                display:'flex', alignItems:'baseline', justifyContent:'space-between',
                marginBottom:8
              }}>
                <div>
                  <div style={{
                    fontSize:10, letterSpacing:'.16em', color:meta.color,
                    textTransform:'uppercase', fontWeight:600
                  }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize:10, color:t.text3, marginTop:2 }}>{meta.hint}</div>
                </div>
                <span style={{ fontSize:10.5, color:t.text3 }}>{list.length}</span>
              </div>

              {list.map((id, i) => {
                const ex = EX_LIB[id];
                if (!ex) return null;
                return (
                  <div key={id} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'8px 0',
                    borderTop: i>0 ? `1px solid ${t.border}` : 'none'
                  }}>
                    <ExerciseImage exerciseId={id} size={36} radius={8} theme={theme}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12.5, color:t.text }}>{ex.name}</div>
                      <div style={{ fontSize:10, color:t.text3 }}>{ex.muscle}</div>
                    </div>
                    {/* Reorder buttons */}
                    <button onClick={() => moveItem(sec, i, -1)} disabled={i===0} style={{
                      width:22, height:22, borderRadius:5,
                      border:`1px solid ${t.border}`, background:'transparent',
                      color: i===0 ? t.text3 : t.text2, cursor: i===0 ? 'default' : 'pointer',
                      fontSize:10, fontFamily:t.sans, opacity: i===0 ? .4 : 1
                    }}>↑</button>
                    <button onClick={() => moveItem(sec, i, 1)} disabled={i===list.length-1} style={{
                      width:22, height:22, borderRadius:5,
                      border:`1px solid ${t.border}`, background:'transparent',
                      color: i===list.length-1 ? t.text3 : t.text2,
                      cursor: i===list.length-1 ? 'default' : 'pointer',
                      fontSize:10, fontFamily:t.sans, opacity: i===list.length-1 ? .4 : 1
                    }}>↓</button>
                    <button onClick={() => removeItem(sec, i)} style={{
                      width:22, height:22, borderRadius:5,
                      border:`1px solid ${t.border}`, background:'transparent',
                      color: '#BE3B2E', cursor:'pointer', fontSize:13, fontFamily:t.sans
                    }}>×</button>
                  </div>
                );
              })}

              {/* Add button per section */}
              <button onClick={() => setAddingTo(sec)} style={{
                width:'100%', padding:'7px 8px',
                marginTop: list.length ? 8 : 0,
                borderRadius:9, background:'transparent',
                border:`1.5px dashed ${t.border2}`,
                color:t.text3, fontSize:11, cursor:'pointer', fontFamily:t.sans
              }}>
                + Add {meta.label.toLowerCase()}
              </button>
            </div>
          );
        })}
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle}/>

      {/* Add-exercise bottom sheet */}
      {addingTo && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.4)',
          display:'flex', alignItems:'flex-end', zIndex:50
        }} onClick={() => { setAddingTo(null); setSearchQ(''); }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width:'100%', background:t.surface,
            borderTopLeftRadius:22, borderTopRightRadius:22,
            padding:'18px 20px 18px', maxHeight:'72%',
            display:'flex', flexDirection:'column'
          }}>
            <div style={{
              width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 14px'
            }}/>
            <div style={{ fontFamily:t.serif, fontSize:20, color:t.text, marginBottom:4 }}>
              Add {SECTION_META[addingTo].label.toLowerCase()}
            </div>
            <div style={{ fontSize:11, color:t.text3, marginBottom:12 }}>
              {SECTION_META[addingTo].hint}
            </div>
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={`Search ${SECTION_META[addingTo].label.toLowerCase()}…`}
              style={{
                width:'100%', padding:'9px 12px', borderRadius:9,
                border:`1px solid ${t.border}`, background:t.surface2,
                fontFamily:t.sans, fontSize:12.5, color:t.text, outline:'none',
                marginBottom:10
              }}/>
            <div style={{
              overflowY:'auto', flex:1, paddingRight:2,
              maxHeight: 280
            }}>
              {availableForAdd.length ? availableForAdd.map(ex => (
                <button key={ex.id} onClick={() => addItem(addingTo, ex.id)} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  width:'100%', padding:'10px 12px', borderRadius:10,
                  background:t.surface2, border:`1px solid ${t.border}`,
                  marginBottom:5, cursor:'pointer', textAlign:'left',
                  fontFamily:t.sans
                }}>
                  <div>
                    <div style={{ fontSize:13, color:t.text }}>{ex.name}</div>
                    <div style={{ fontSize:10, color:t.text3 }}>{ex.muscle}</div>
                  </div>
                  <span style={{ fontSize:18, color:t.accent }}>+</span>
                </button>
              )) : (
                <div style={{
                  textAlign:'center', padding:'30px 0', color:t.text3, fontSize:11.5
                }}>
                  No matches.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  GymHubScreen, SplitPickerScreen, SessionEditorScreen,
  SPLITS, EX_LIB, SECTION_META, SECTION_ORDER
});
