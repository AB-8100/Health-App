import React from 'react';
import themes from '../data/themes';
import { BottomNav } from '../components/SharedUI';
import { ExerciseImage } from './ExerciseScreens';
const EX_LIB = {
  // Compounds
  bench:          { name:'Bench press',          muscle:'Chest',         type:'compound' },
  squat:          { name:'Barbell squat',        muscle:'Quads/Glutes',  type:'compound' },
  deadlift:       { name:'Deadlift',             muscle:'Full back',     type:'compound' },
  ohp:            { name:'Overhead press',       muscle:'Shoulders',     type:'compound' },
  pullups:        { name:'Pull-ups',             muscle:'Lats/Biceps',   type:'compound' },
  reversepullup:  { name:'Reverse pull-up',      muscle:'Back/Biceps',   type:'compound' },
  barbellrow:     { name:'Barbell row',          muscle:'Upper back',    type:'compound' },
  rdl:            { name:'Romanian deadlift',    muscle:'Hamstrings',    type:'compound' },
  // Accessories
  incline:     { name:'Incline DB press',     muscle:'Upper chest',   type:'accessory' },
  decline:     { name:'Decline press',        muscle:'Lower chest',   type:'accessory' },
  cablefly:    { name:'Cable fly',            muscle:'Chest',         type:'accessory' },
  latpulldown: { name:'Lat pulldown',         muscle:'Lats/Biceps',   type:'accessory' },
  lateral:     { name:'Lateral raises',       muscle:'Shoulders',     type:'accessory', unilateral:true },
  frontraise:  { name:'Front raises',         muscle:'Front delts',   type:'accessory', unilateral:true },
  tricep:      { name:'Tricep pushdown',      muscle:'Triceps',       type:'accessory' },
  skulls:      { name:'Skull crushers',       muscle:'Triceps',       type:'accessory' },
  cgbench:     { name:'Close-grip bench',     muscle:'Triceps',       type:'accessory' },
  curls:       { name:'Bicep curls',          muscle:'Biceps',        type:'accessory', unilateral:true },
  hammer:      { name:'Hammer curls',         muscle:'Brachialis',    type:'accessory', unilateral:true },
  cablerow:    { name:'Cable row',            muscle:'Mid back',      type:'accessory' },
  tbar:        { name:'T-bar row',            muscle:'Mid back',      type:'accessory' },
  facepull:    { name:'Face pulls',           muscle:'Rear delts',    type:'accessory' },
  legpress:    { name:'Leg press',            muscle:'Quads',         type:'accessory' },
  legext:      { name:'Leg extension',        muscle:'Quads',         type:'accessory' },
  lunges:      { name:'Walking lunges',       muscle:'Quads/Glutes',  type:'accessory', unilateral:true },
  bss:         { name:'Bulgarian split squat',muscle:'Quads/Glutes',  type:'accessory', unilateral:true },
  legcurl:     { name:'Leg curl',             muscle:'Hamstrings',    type:'accessory' },
  hipthrust:   { name:'Hip thrust',           muscle:'Glutes',        type:'accessory' },
  calf:        { name:'Calf raises',          muscle:'Calves',        type:'accessory', unilateral:true },
  // Core
  plank:       { name:'Plank',                muscle:'Core',          type:'core' },
  crunches:    { name:'Crunches',             muscle:'Abs',           type:'core' },
  legraise:    { name:'Hanging leg raise',    muscle:'Lower abs',     type:'core' },
  cabletwist:  { name:'Cable woodchop',       muscle:'Obliques',      type:'core' },
  deadbug:     { name:'Dead bug',             muscle:'Deep core',     type:'core' },
  pallof:      { name:'Pallof press',         muscle:'Anti-rotation', type:'core' },
  abroller:    { name:'Ab roller',            muscle:'Core',          type:'core' },
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
// Edit a completed session's sets inline
function EditSessionSheet({ theme, session, onClose, onSave }) {
  const t = themes[theme];
  const [queue, setQueue] = React.useState(
    (session.queue || []).map(ex => ({
      ...ex,
      sets: (ex.sets || []).map(s => ({ ...s })),
    }))
  );

  const updateSet = (ei, si, field, val) => setQueue(prev =>
    prev.map((ex, e) => e !== ei ? ex : {
      ...ex,
      sets: ex.sets.map((s, ss) => ss !== si ? s : { ...s, [field]: val === '' ? '' : Number(val) })
    })
  );

  const addSet = (ei) => setQueue(prev =>
    prev.map((ex, e) => e !== ei ? ex : {
      ...ex,
      sets: [...ex.sets, { ...(ex.sets[ex.sets.length - 1] || { w:0, r:0 }), done: true }]
    })
  );

  const removeSet = (ei, si) => setQueue(prev =>
    prev.map((ex, e) => e !== ei ? ex : {
      ...ex,
      sets: ex.sets.filter((_, ss) => ss !== si)
    })
  );

  return (
    <div style={{
      position:'absolute', inset:0, background:'rgba(0,0,0,.45)',
      display:'flex', alignItems:'flex-end', zIndex:60
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', background:t.surface,
        borderTopLeftRadius:22, borderTopRightRadius:22,
        padding:'16px 20px 28px', maxHeight:'90%',
        display:'flex', flexDirection:'column', overflow:'hidden'
      }}>
        <div style={{ width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 14px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4, flexShrink:0 }}>
          <div style={{ fontFamily:t.serif, fontSize:20, color:t.text }}>Edit session</div>
          <button onClick={onClose} style={{
            padding:'4px 10px', borderRadius:7, background:'transparent',
            border:`1px solid ${t.border}`, color:t.text2,
            fontSize:10.5, cursor:'pointer', fontFamily:t.sans
          }}>Cancel</button>
        </div>
        <div style={{ fontSize:11, color:t.text3, marginBottom:12, flexShrink:0 }}>
          {session.workout} · {new Date(session.date).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
        </div>

        <div style={{ overflowY:'auto', flex:1 }}>
          {queue.map((ex, ei) => (
            <div key={ex.id || ei} style={{
              background:t.surface2, border:`1px solid ${t.border}`, borderRadius:14,
              padding:'12px 14px', marginBottom:10
            }}>
              <div style={{ fontSize:13, color:t.text, fontWeight:500, marginBottom:10 }}>{ex.name}</div>
              {/* Set rows */}
              <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 1fr 28px', gap:6, alignItems:'center', marginBottom:6 }}>
                <div style={{ fontSize:9.5, color:t.text3, textTransform:'uppercase' }}>#</div>
                <div style={{ fontSize:9.5, color:t.text3, textTransform:'uppercase' }}>Weight (kg)</div>
                <div style={{ fontSize:9.5, color:t.text3, textTransform:'uppercase' }}>Reps</div>
                <div/>
              </div>
              {ex.sets.map((s, si) => (
                <div key={si} style={{ display:'grid', gridTemplateColumns:'28px 1fr 1fr 28px', gap:6, alignItems:'center', marginBottom:5 }}>
                  <div style={{ fontSize:11, color:t.text3, textAlign:'center' }}>{si + 1}</div>
                  <input type="number" value={s.w ?? ''} onChange={e => updateSet(ei, si, 'w', e.target.value)}
                    style={{ padding:'7px 10px', borderRadius:8, border:`1px solid ${t.border}`,
                      background:t.surface, fontFamily:t.mono, fontSize:13, color:t.text,
                      outline:'none', width:'100%', boxSizing:'border-box' }}
                  />
                  <input type="number" value={s.r ?? ''} onChange={e => updateSet(ei, si, 'r', e.target.value)}
                    style={{ padding:'7px 10px', borderRadius:8, border:`1px solid ${t.border}`,
                      background:t.surface, fontFamily:t.mono, fontSize:13, color:t.text,
                      outline:'none', width:'100%', boxSizing:'border-box' }}
                  />
                  <button onClick={() => removeSet(ei, si)} style={{
                    width:28, height:28, borderRadius:7, background:'transparent',
                    border:`1px solid ${t.border}`, color:'#BE3B2E',
                    cursor:'pointer', fontSize:14, fontFamily:t.sans,
                    display:'flex', alignItems:'center', justifyContent:'center'
                  }}>×</button>
                </div>
              ))}
              <button onClick={() => addSet(ei)} style={{
                width:'100%', marginTop:4, padding:'6px', borderRadius:8,
                background:'transparent', border:`1.5px dashed ${t.border2}`,
                color:t.text3, fontSize:11, cursor:'pointer', fontFamily:t.sans
              }}>+ Add set</button>
            </div>
          ))}
        </div>

        <button onClick={() => { onSave({ ...session, queue }); onClose(); }} style={{
          marginTop:12, width:'100%', padding:'13px', borderRadius:12, border:'none',
          fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer',
          background:t.accent, color:t.accentText, flexShrink:0
        }}>
          Save changes
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Quick "mark as complete" sheet — optionally capture time + distance
function MarkCompleteSheet({ theme, onClose, onSave }) {
  const t = themes[theme];
  const [hours, setHours] = React.useState('');
  const [minutes, setMinutes] = React.useState('');
  const [distance, setDistance] = React.useState('');

  const handleSave = () => {
    const totalSecs = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
    onSave({
      elapsed: totalSecs,
      distance: distance !== '' ? Number(distance) : null,
    });
  };

  const inputStyle = {
    padding:'9px 12px', borderRadius:10, border:`1px solid ${t.border}`,
    background:t.surface, fontFamily:t.mono, fontSize:15, color:t.text,
    outline:'none', width:'100%', boxSizing:'border-box'
  };
  const labelStyle = { fontSize:11, color:t.text3, marginBottom:5, textTransform:'uppercase', letterSpacing:.4 };

  return (
    <div style={{
      position:'absolute', inset:0, background:'rgba(0,0,0,.45)',
      display:'flex', alignItems:'flex-end', zIndex:60
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', background:t.surface,
        borderTopLeftRadius:22, borderTopRightRadius:22,
        padding:'16px 20px 32px',
        display:'flex', flexDirection:'column', gap:0
      }}>
        <div style={{ width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 16px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div style={{ fontFamily:t.serif, fontSize:20, color:t.text }}>Mark as complete</div>
          <button onClick={onClose} style={{
            padding:'4px 10px', borderRadius:7, background:'transparent',
            border:`1px solid ${t.border}`, color:t.text2,
            fontSize:10.5, cursor:'pointer', fontFamily:t.sans
          }}>Cancel</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div>
            <div style={labelStyle}>Hours</div>
            <input type="number" min="0" placeholder="0" value={hours}
              onChange={e => setHours(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Minutes</div>
            <input type="number" min="0" max="59" placeholder="0" value={minutes}
              onChange={e => setMinutes(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={labelStyle}>Distance (km) <span style={{ color:t.text3, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— optional</span></div>
          <input type="number" min="0" step="0.1" placeholder="e.g. 5.0" value={distance}
            onChange={e => setDistance(e.target.value)} style={inputStyle} />
        </div>

        <button onClick={handleSave} style={{
          width:'100%', padding:'13px', borderRadius:12, border:'none',
          fontFamily:t.sans, fontSize:13, fontWeight:600,
          background:t.green, color:'#fff', cursor:'pointer'
        }}>✓ Mark complete</button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Add a gym session manually for a past day
function AddSessionSheet({ theme, day, date, onClose, onSave }) {
  const t = themes[theme];
  const [queue, setQueue] = React.useState(() =>
    SECTION_ORDER.flatMap(sec => (day[sec] || []).map(id => {
      const ex = EX_LIB[id] || {};
      return {
        id, name: ex.name || id, muscle: ex.muscle || '',
        unilateral: ex.unilateral || false,
        sets: [
          { w: '', r: '', done: true },
          { w: '', r: '', done: true },
          { w: '', r: '', done: true },
        ],
      };
    }))
  );

  const updateSet = (ei, si, field, val) => setQueue(prev =>
    prev.map((ex, e) => e !== ei ? ex : {
      ...ex,
      sets: ex.sets.map((s, ss) => ss !== si ? s : { ...s, [field]: val }),
    })
  );

  const addSet = (ei) => setQueue(prev =>
    prev.map((ex, e) => e !== ei ? ex : {
      ...ex,
      sets: [...ex.sets, { w: '', r: '', done: true }],
    })
  );

  const removeSet = (ei, si) => setQueue(prev =>
    prev.map((ex, e) => e !== ei ? ex : {
      ...ex,
      sets: ex.sets.filter((_, ss) => ss !== si),
    })
  );

  const filledSets = queue.reduce((acc, ex) =>
    acc + ex.sets.filter(s => s.w !== '' || s.r !== '').length, 0
  );

  const handleSave = () => {
    const filteredQueue = queue.map(ex => ({
      ...ex,
      sets: ex.sets
        .filter(s => s.w !== '' || s.r !== '')
        .map(s => ({ ...s, w: Number(s.w) || 0, r: Number(s.r) || 0, done: true })),
    })).filter(ex => ex.sets.length > 0);

    onSave({
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      date: date.toISOString(),
      workout: day.name + ' day',
      elapsed: 0,
      isManual: true,
      queue: filteredQueue,
    });
    onClose();
  };

  return (
    <div style={{
      position:'absolute', inset:0, background:'rgba(0,0,0,.45)',
      display:'flex', alignItems:'flex-end', zIndex:60
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', background:t.surface,
        borderTopLeftRadius:22, borderTopRightRadius:22,
        padding:'16px 20px 28px', maxHeight:'90%',
        display:'flex', flexDirection:'column', overflow:'hidden'
      }}>
        <div style={{ width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 14px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4, flexShrink:0 }}>
          <div style={{ fontFamily:t.serif, fontSize:20, color:t.text }}>Log session</div>
          <button onClick={onClose} style={{
            padding:'4px 10px', borderRadius:7, background:'transparent',
            border:`1px solid ${t.border}`, color:t.text2,
            fontSize:10.5, cursor:'pointer', fontFamily:t.sans
          }}>Cancel</button>
        </div>
        <div style={{ fontSize:11, color:t.text3, marginBottom:12, flexShrink:0 }}>
          {day.name} day · {date.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
        </div>

        <div style={{ overflowY:'auto', flex:1 }}>
          {queue.map((ex, ei) => (
            <div key={ex.id || ei} style={{
              background:t.surface2, border:`1px solid ${t.border}`, borderRadius:14,
              padding:'12px 14px', marginBottom:10
            }}>
              <div style={{ fontSize:13, color:t.text, fontWeight:500, marginBottom:2 }}>{ex.name}</div>
              <div style={{ fontSize:10, color:t.text3, marginBottom:10 }}>{ex.muscle}</div>
              <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 1fr 28px', gap:6, alignItems:'center', marginBottom:6 }}>
                <div style={{ fontSize:9.5, color:t.text3, textTransform:'uppercase' }}>#</div>
                <div style={{ fontSize:9.5, color:t.text3, textTransform:'uppercase' }}>Weight (kg)</div>
                <div style={{ fontSize:9.5, color:t.text3, textTransform:'uppercase' }}>Reps</div>
                <div/>
              </div>
              {ex.sets.map((s, si) => (
                <div key={si} style={{ display:'grid', gridTemplateColumns:'28px 1fr 1fr 28px', gap:6, alignItems:'center', marginBottom:5 }}>
                  <div style={{ fontSize:11, color:t.text3, textAlign:'center' }}>{si + 1}</div>
                  <input type="number" value={s.w} onChange={e => updateSet(ei, si, 'w', e.target.value)}
                    placeholder="0"
                    style={{ padding:'7px 10px', borderRadius:8, border:`1px solid ${t.border}`,
                      background:t.surface, fontFamily:t.mono, fontSize:13, color:t.text,
                      outline:'none', width:'100%', boxSizing:'border-box' }}
                  />
                  <input type="number" value={s.r} onChange={e => updateSet(ei, si, 'r', e.target.value)}
                    placeholder="0"
                    style={{ padding:'7px 10px', borderRadius:8, border:`1px solid ${t.border}`,
                      background:t.surface, fontFamily:t.mono, fontSize:13, color:t.text,
                      outline:'none', width:'100%', boxSizing:'border-box' }}
                  />
                  <button onClick={() => removeSet(ei, si)} style={{
                    width:28, height:28, borderRadius:7, background:'transparent',
                    border:`1px solid ${t.border}`, color:'#BE3B2E',
                    cursor:'pointer', fontSize:14, fontFamily:t.sans,
                    display:'flex', alignItems:'center', justifyContent:'center'
                  }}>×</button>
                </div>
              ))}
              <button onClick={() => addSet(ei)} style={{
                width:'100%', marginTop:4, padding:'6px', borderRadius:8,
                background:'transparent', border:`1.5px dashed ${t.border2}`,
                color:t.text3, fontSize:11, cursor:'pointer', fontFamily:t.sans
              }}>+ Add set</button>
            </div>
          ))}
        </div>

        <button onClick={handleSave} disabled={filledSets === 0} style={{
          marginTop:12, width:'100%', padding:'13px', borderRadius:12, border:'none',
          fontFamily:t.sans, fontSize:13, fontWeight:600, flexShrink:0,
          background: filledSets > 0 ? t.accent : t.surface2,
          color: filledSets > 0 ? t.accentText : t.text3,
          cursor: filledSets > 0 ? 'pointer' : 'default',
        }}>
          {filledSets > 0 ? `Save session (${filledSets} sets logged)` : 'Enter at least one set to save'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Import exercise history from pasted Excel rows
function ImportHistorySheet({ theme, onClose, onImport, completedSessions = [], plan }) {
  const t = themes[theme];
  const [step, setStep]         = React.useState('pick'); // 'pick' | 'paste' | 'assign'
  const [exercise, setExercise] = React.useState(null);
  const [searchQ, setSearchQ]   = React.useState('');
  const [rawText, setRawText]   = React.useState('');
  const [parsedRows, setParsedRows] = React.useState([]);
  const [colMap, setColMap]     = React.useState({ date:0, weight:1, reps:2 });
  const [hasHeader, setHasHeader] = React.useState(false);
  // format: 'rows' = one row per date (original), 'cols' = dates across top, one row per exercise
  const [format, setFormat]     = React.useState('cols');
  const [defaultReps, setDefaultReps] = React.useState('5');
  // assignMap: { [dateKey]: { type:'new', name:string } | { type:'existing', sessionId:string } }
  const [assignMap, setAssignMap] = React.useState({});

  const split = SPLITS[plan?.splitDays] || SPLITS[3];
  const splitDayNames = split.days.map(d => d.name);

  const exOptions = React.useMemo(() => {
    const q = searchQ.toLowerCase();
    return Object.entries(EX_LIB)
      .filter(([, ex]) => !q || ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q))
      .slice(0, 24)
      .map(([id, ex]) => ({ id, ...ex }));
  }, [searchQ]);

  const parseDate = (str) => {
    if (!str) return null;
    const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      const dt = new Date(year, Number(m) - 1, Number(d));
      return isNaN(dt.getTime()) ? null : dt;
    }
    const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) {
      const [, y, m, d] = ymd;
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      return isNaN(dt.getTime()) ? null : dt;
    }
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
  };

  const handleTextChange = (text) => {
    setRawText(text);
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (!lines.length) { setParsedRows([]); return; }
    const rows = lines.map(l => {
      if (l.includes('\t')) return l.split('\t').map(c => c.trim());
      return l.trim().split(/\s+/);
    });
    setParsedRows(rows);

    // Auto-detect header row and column roles
    const firstRow = rows[0] || [];
    const looksLikeHeader = firstRow.some(c => /date|weight|reps|sets|kg/i.test(c));
    setHasHeader(looksLikeHeader);

    let dateCol = -1, weightCol = -1, repsCol = -1;
    if (looksLikeHeader) {
      firstRow.forEach((c, i) => {
        if (/date|day/i.test(c))     dateCol   = i;
        if (/weight|kg/i.test(c))    weightCol = i;
        if (/reps?/i.test(c))        repsCol   = i;
      });
    }
    // Value-based detection on first data row
    const sampleRow = (looksLikeHeader ? rows[1] : rows[0]) || [];
    if (dateCol === -1) {
      sampleRow.forEach((c, i) => {
        if (dateCol === -1 && parseDate(c)) dateCol = i;
      });
    }
    const numericCols = sampleRow
      .map((c, i) => ({ i, v: parseFloat(c.replace(/[^0-9.]/g, '')) }))
      .filter(x => !isNaN(x.v) && x.i !== dateCol);
    if (numericCols.length >= 2 && weightCol === -1 && repsCol === -1) {
      const sorted = [...numericCols].sort((a, b) => b.v - a.v);
      weightCol = sorted[0].i;
      repsCol   = sorted[1].i;
    } else if (numericCols.length === 1 && weightCol === -1) {
      weightCol = numericCols[0].i;
    }
    setColMap({
      date:   dateCol   >= 0 ? dateCol   : 0,
      weight: weightCol >= 0 ? weightCol : 1,
      reps:   repsCol   >= 0 ? repsCol   : 2,
    });
  };

  const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;
  const numCols  = parsedRows[0]?.length || 0;

  const previewRows = React.useMemo(() => {
    if (format === 'cols') {
      // Row 0 = dates across columns; Row 1 = weights (optionally "80x5" for weight×reps)
      if (parsedRows.length < 2) return [];
      const dateRow = parsedRows[0];
      // Find the first data row (skip rows that look like exercise name labels)
      const valueRow = parsedRows.find((r, i) => i > 0 && r.some(c => /\d/.test(c))) || [];
      // Skip leading label cell (first cell often contains exercise name)
      const startIdx = parseDate(dateRow[0]) ? 0 : 1;
      const results = [];
      for (let i = startIdx; i < dateRow.length; i++) {
        const date = parseDate(dateRow[i]);
        if (!date) continue;
        const cell = (valueRow[i] || '').trim();
        // Support "80x5" / "80X5" / "80*5" weight×reps format
        const wxr = cell.match(/^(\d+\.?\d*)\s*[xX\*×]\s*(\d+)$/);
        const weight = wxr ? parseFloat(wxr[1]) : parseFloat(cell.replace(/[^0-9.]/g, '')) || 0;
        const reps   = wxr ? parseInt(wxr[2], 10) : (parseInt(defaultReps, 10) || 5);
        if (weight > 0) results.push({ date, weight, reps });
      }
      return results;
    }
    // Rows mode: each row = one date's data
    return dataRows.map(row => {
      const dateStr = row[colMap.date] || '';
      const weight  = parseFloat((row[colMap.weight] || '').replace(/[^0-9.]/g, '')) || 0;
      const reps    = parseInt((row[colMap.reps] || '').replace(/[^0-9]/g, ''), 10) || 0;
      const date    = parseDate(dateStr);
      return { dateStr, weight, reps, date };
    }).filter(r => r.date && r.weight > 0);
  }, [parsedRows, dataRows, colMap, format, defaultReps]);

  // Unique date keys derived from parsed preview
  const uniqueDates = React.useMemo(() => (
    [...new Set(previewRows.map(r => r.date.toISOString().slice(0,10)))].sort()
  ), [previewRows]);

  const enterAssignStep = () => {
    const map = {};
    uniqueDates.forEach(dateKey => {
      const existing = completedSessions.find(s => s.date.slice(0,10) === dateKey);
      map[dateKey] = existing
        ? { type: 'existing', sessionId: existing.id }
        : { type: 'new', name: splitDayNames[0] || 'Session' };
    });
    setAssignMap(map);
    setStep('assign');
  };

  const handleImport = () => {
    if (!exercise || !previewRows.length) return;
    const byDate = {};
    previewRows.forEach(r => {
      const key = r.date.toISOString().slice(0, 10);
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push({ w: r.weight, r: r.reps, done: true });
    });

    const newSessions = [];
    const updatedSessions = [];

    Object.entries(byDate).forEach(([dateKey, sets]) => {
      const assignment = assignMap[dateKey] || { type: 'new', name: 'Session' };
      const newExEntry = {
        id: exercise.id, name: exercise.name, muscle: exercise.muscle,
        unilateral: false, sets,
      };

      if (assignment.type === 'existing') {
        const existing = completedSessions.find(s => s.id === assignment.sessionId);
        if (existing) {
          const updatedQueue = [...(existing.queue || [])];
          const exIdx = updatedQueue.findIndex(e => e.id === exercise.id);
          if (exIdx >= 0) {
            updatedQueue[exIdx] = { ...updatedQueue[exIdx], sets: [...updatedQueue[exIdx].sets, ...sets] };
          } else {
            updatedQueue.push(newExEntry);
          }
          updatedSessions.push({ ...existing, queue: updatedQueue });
        }
      } else {
        newSessions.push({
          id: `import_${exercise.id}_${dateKey}_${Math.random().toString(36).slice(2)}`,
          date: new Date(dateKey + 'T12:00:00').toISOString(),
          workout: (assignment.name || 'Session') + ' day',
          elapsed: 0,
          isImported: true,
          queue: [newExEntry],
        });
      }
    });

    onImport({ newSessions, updatedSessions });
    onClose();
  };

  const roleColors = { date:'#0369A1', weight:t.accent, reps:'#15803D', ignore:t.text3 };

  const stepTitles = { pick: 'Import history', paste: `Import · ${exercise?.name}`, assign: `Assign sessions` };

  return (
    <div style={{
      position:'absolute', inset:0, background:'rgba(0,0,0,.45)',
      display:'flex', alignItems:'flex-end', zIndex:60
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', background:t.surface,
        borderTopLeftRadius:22, borderTopRightRadius:22,
        padding:'16px 20px 28px', maxHeight:'90%',
        display:'flex', flexDirection:'column', overflow:'hidden'
      }}>
        <div style={{ width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 14px' }}/>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexShrink:0 }}>
          <div style={{ fontFamily:t.serif, fontSize:20, color:t.text }}>
            {stepTitles[step]}
          </div>
          {step !== 'pick' && (
            <button onClick={() => setStep(step === 'assign' ? 'paste' : 'pick')} style={{
              padding:'4px 10px', borderRadius:7, background:'transparent',
              border:`1px solid ${t.border}`, color:t.text2,
              fontSize:10.5, cursor:'pointer', fontFamily:t.sans
            }}>← Back</button>
          )}
        </div>

        {/* Step indicator */}
        <div style={{ display:'flex', gap:4, marginBottom:14, flexShrink:0 }}>
          {['pick','paste','assign'].map((s, i) => (
            <div key={s} style={{
              flex:1, height:3, borderRadius:99,
              background: ['pick','paste','assign'].indexOf(step) >= i ? t.accent : t.border
            }}/>
          ))}
        </div>

        {/* ── Step 1: Pick exercise ── */}
        {step === 'pick' && (
          <>
            <div style={{ fontSize:11.5, color:t.text2, marginBottom:10, lineHeight:1.5, flexShrink:0 }}>
              Which exercise are you importing history for?
            </div>
            <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Search exercises…"
              style={{ padding:'10px 12px', borderRadius:10, border:`1px solid ${t.border}`,
                background:t.surface2, fontFamily:t.sans, fontSize:13, color:t.text,
                outline:'none', marginBottom:10, flexShrink:0 }}
            />
            <div style={{ overflowY:'auto', flex:1 }}>
              {exOptions.map(ex => (
                <button key={ex.id} onClick={() => { setExercise(ex); setStep('paste'); }} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  width:'100%', padding:'10px 12px', borderRadius:10,
                  background:t.surface2, border:`1px solid ${t.border}`,
                  marginBottom:5, cursor:'pointer', textAlign:'left', fontFamily:t.sans
                }}>
                  <div>
                    <div style={{ fontSize:13, color:t.text }}>{ex.name}</div>
                    <div style={{ fontSize:10, color:t.text3 }}>{ex.muscle}</div>
                  </div>
                  <span style={{ fontSize:18, color:t.accent }}>›</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 2: Paste data ── */}
        {step === 'paste' && (
          <>
            {/* Format toggle */}
            <div style={{ display:'flex', gap:5, marginBottom:10, flexShrink:0 }}>
              {[
                { id:'cols', label:'Dates across top' },
                { id:'rows', label:'Date per row' },
              ].map(f => (
                <button key={f.id} onClick={() => setFormat(f.id)} style={{
                  flex:1, padding:'7px 0', borderRadius:8, cursor:'pointer',
                  fontFamily:t.sans, fontSize:11, fontWeight:500,
                  background: format === f.id ? t.accent : t.surface2,
                  color: format === f.id ? t.accentText : t.text2,
                  border: `1px solid ${format === f.id ? t.accent : t.border}`
                }}>{f.label}</button>
              ))}
            </div>

            {/* Format hint */}
            <div style={{
              fontSize:10, color:t.text3, marginBottom:8, fontFamily:t.mono,
              padding:'6px 10px', borderRadius:7, background:t.surface2, flexShrink:0,
              lineHeight:1.5
            }}>
              {format === 'cols'
                ? 'Copy the dates row + your exercise row from Excel and paste below'
                : 'Each row = one session: Date · Weight · Reps (tab or space separated)'}
            </div>

            <textarea autoFocus value={rawText} onChange={e => handleTextChange(e.target.value)}
              placeholder={format === 'cols'
                ? '01 Jan\t08 Jan\t15 Jan\t22 Jan\nBench\t80\t82.5\t85\t87.5'
                : '01/01/2025\t80\t5\n08/01/2025 82.5 5\n15/01/2025 85 4'}
              style={{
                width:'100%', minHeight:90, padding:'10px 12px', borderRadius:10,
                border:`1px solid ${t.border}`, background:t.surface2,
                fontFamily:t.mono, fontSize:11.5, color:t.text, outline:'none',
                resize:'vertical', boxSizing:'border-box', marginBottom:10, flexShrink:0
              }}
            />

            {/* Cols mode: default reps input */}
            {format === 'cols' && parsedRows.length > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexShrink:0 }}>
                <div style={{ fontSize:11, color:t.text2 }}>Default reps per set:</div>
                <input type="number" value={defaultReps} onChange={e => setDefaultReps(e.target.value)}
                  style={{
                    width:60, padding:'6px 10px', borderRadius:8, border:`1px solid ${t.border}`,
                    background:t.surface2, fontFamily:t.mono, fontSize:13, color:t.text, outline:'none'
                  }}
                />
                <div style={{ fontSize:10, color:t.text3 }}>(overridden if cell is "80×5" format)</div>
              </div>
            )}

            {/* Rows mode: column role pickers */}
            {format === 'rows' && parsedRows.length > 0 && numCols > 0 && (
              <div style={{ flexShrink:0 }}>
                <div style={{ fontSize:10, color:t.text3, marginBottom:6 }}>
                  Assign column roles — {numCols} column{numCols > 1 ? 's' : ''} detected:
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
                  {Array.from({ length: numCols }).map((_, i) => {
                    const role = Object.entries(colMap).find(([, c]) => c === i)?.[0] || 'ignore';
                    return (
                      <div key={i}>
                        <div style={{ fontSize:9, color:t.text3, marginBottom:3, textAlign:'center' }}>
                          Col {i + 1}
                        </div>
                        <select value={role}
                          onChange={e => {
                            const nr = e.target.value;
                            setColMap(prev => {
                              const next = { ...prev };
                              Object.keys(next).forEach(k => { if (next[k] === i) next[k] = -1; });
                              if (nr !== 'ignore') next[nr] = i;
                              return next;
                            });
                          }}
                          style={{
                            padding:'5px 6px', borderRadius:7, border:`1px solid ${t.border}`,
                            background:t.surface2, color:roleColors[role],
                            fontFamily:t.sans, fontSize:11, cursor:'pointer', outline:'none'
                          }}>
                          <option value="date">Date</option>
                          <option value="weight">Weight</option>
                          <option value="reps">Reps</option>
                          <option value="ignore">Ignore</option>
                        </select>
                      </div>
                    );
                  })}
                  <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, color:t.text2, marginLeft:4 }}>
                    <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)}/>
                    Header row
                  </label>
                </div>
              </div>
            )}

            {/* Preview table */}
            {previewRows.length > 0 && (
              <div style={{ overflowY:'auto', flex:1, marginBottom:10, borderRadius:8, border:`1px solid ${t.border}` }}>
                <div style={{
                  display:'grid', gridTemplateColumns:'1fr 80px 60px',
                  padding:'5px 10px', borderBottom:`1px solid ${t.border}`,
                  fontSize:9.5, color:t.text3, letterSpacing:'.08em', textTransform:'uppercase'
                }}>
                  <span>Date</span><span>Weight</span><span>Reps</span>
                </div>
                {previewRows.slice(0, 12).map((r, i) => (
                  <div key={i} style={{
                    display:'grid', gridTemplateColumns:'1fr 80px 60px',
                    padding:'6px 10px',
                    borderBottom: i < Math.min(previewRows.length, 12) - 1 ? `1px solid ${t.border}` : 'none',
                    background: i % 2 === 0 ? t.surface2 : 'transparent', fontSize:11
                  }}>
                    <span style={{ color:t.text2 }}>
                      {r.date.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' })}
                    </span>
                    <span style={{ color:t.accent, fontFamily:t.mono }}>{r.weight} kg</span>
                    <span style={{ color:'#15803D', fontFamily:t.mono }}>{r.reps}</span>
                  </div>
                ))}
                {previewRows.length > 12 && (
                  <div style={{ padding:'6px 10px', fontSize:10, color:t.text3, textAlign:'center' }}>
                    +{previewRows.length - 12} more rows
                  </div>
                )}
              </div>
            )}

            {parsedRows.length > 0 && previewRows.length === 0 && (
              <div style={{ fontSize:11.5, color:'#BE3B2E', marginBottom:10, flexShrink:0 }}>
                No valid rows found — check column assignments above.
              </div>
            )}

            <button onClick={enterAssignStep} disabled={!previewRows.length} style={{
              width:'100%', padding:'13px', borderRadius:12, border:'none',
              fontFamily:t.sans, fontSize:13, fontWeight:600, flexShrink:0,
              background: previewRows.length ? t.accent : t.surface2,
              color: previewRows.length ? t.accentText : t.text3,
              cursor: previewRows.length ? 'pointer' : 'default'
            }}>
              {previewRows.length
                ? `Next: assign ${uniqueDates.length} date${uniqueDates.length > 1 ? 's' : ''} to sessions →`
                : 'Paste data above to continue'}
            </button>
          </>
        )}

        {/* ── Step 3: Assign each date to a session ── */}
        {step === 'assign' && (
          <>
            <div style={{ fontSize:11.5, color:t.text2, marginBottom:10, lineHeight:1.5, flexShrink:0 }}>
              Choose which session each date's {exercise?.name} data belongs to.
            </div>

            <div style={{ overflowY:'auto', flex:1 }}>
              {uniqueDates.map(dateKey => {
                const dateObj = new Date(dateKey + 'T12:00:00');
                const assignment = assignMap[dateKey] || { type: 'new', name: splitDayNames[0] || 'Session' };
                const existingForDate = completedSessions.filter(s => s.date.slice(0,10) === dateKey);

                return (
                  <div key={dateKey} style={{
                    background:t.surface2, border:`1px solid ${t.border}`,
                    borderRadius:14, padding:'12px 14px', marginBottom:10
                  }}>
                    <div style={{ fontSize:12.5, color:t.text, fontWeight:600, marginBottom:10 }}>
                      {dateObj.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                    </div>

                    {/* Existing sessions for this date */}
                    {existingForDate.length > 0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:9.5, color:t.text3, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>
                          Add to existing session
                        </div>
                        {existingForDate.map(s => {
                          const isSelected = assignment.type === 'existing' && assignment.sessionId === s.id;
                          return (
                            <button key={s.id}
                              onClick={() => setAssignMap(m => ({ ...m, [dateKey]: { type:'existing', sessionId:s.id } }))}
                              style={{
                                width:'100%', padding:'8px 12px', borderRadius:9,
                                marginBottom:5, textAlign:'left', cursor:'pointer',
                                fontFamily:t.sans, fontSize:12,
                                background: isSelected ? t.accent+'18' : t.surface,
                                border: `1.5px solid ${isSelected ? t.accent : t.border}`,
                                color: isSelected ? t.accent : t.text,
                                display:'flex', alignItems:'center', justifyContent:'space-between'
                              }}>
                              <span>{s.workout}</span>
                              {isSelected && <span style={{ fontSize:14 }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* New session — pick split day name */}
                    <div>
                      <div style={{ fontSize:9.5, color:t.text3, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>
                        {existingForDate.length > 0 ? 'Or create new session' : 'Session name'}
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom: assignment.type === 'new' ? 8 : 0 }}>
                        {splitDayNames.map(name => {
                          const isSelected = assignment.type === 'new' && assignment.name === name;
                          return (
                            <button key={name}
                              onClick={() => setAssignMap(m => ({ ...m, [dateKey]: { type:'new', name } }))}
                              style={{
                                padding:'5px 11px', borderRadius:8, cursor:'pointer',
                                fontFamily:t.sans, fontSize:11, fontWeight:500,
                                background: isSelected ? t.accent : t.surface,
                                color: isSelected ? t.accentText : t.text2,
                                border: `1.5px solid ${isSelected ? t.accent : t.border}`
                              }}>
                              {name}
                            </button>
                          );
                        })}
                      </div>
                      {/* Custom name input — shown when 'new' is selected */}
                      {assignment.type === 'new' && (
                        <input
                          value={assignment.name}
                          onChange={e => setAssignMap(m => ({ ...m, [dateKey]: { type:'new', name: e.target.value } }))}
                          placeholder="Session name…"
                          style={{
                            width:'100%', padding:'7px 10px', borderRadius:8,
                            border:`1px solid ${t.border}`, background:t.surface,
                            fontFamily:t.sans, fontSize:12, color:t.text,
                            outline:'none', boxSizing:'border-box'
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={handleImport} style={{
              marginTop:4, width:'100%', padding:'13px', borderRadius:12, border:'none',
              fontFamily:t.sans, fontSize:13, fontWeight:600, flexShrink:0,
              background:t.accent, color:t.accentText, cursor:'pointer'
            }}>
              Import {previewRows.length} set{previewRows.length > 1 ? 's' : ''} →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Mobility suggestions per muscle group (for rest day cards)
const MOBILITY_BY_MUSCLE = {
  'Chest':          ['catcow','thoracic','childpose'],
  'Upper chest':    ['catcow','thoracic'],
  'Lower chest':    ['catcow','thoracic'],
  'Shoulders':      ['thoracic','catcow'],
  'Front delts':    ['thoracic'],
  'Rear delts':     ['thoracic','catcow'],
  'Triceps':        ['thoracic'],
  'Biceps':         ['thoracic'],
  'Lats/Biceps':    ['thoracic','catcow','childpose'],
  'Upper back':     ['catcow','thoracic','childpose'],
  'Mid back':       ['catcow','childpose'],
  'Full back':      ['catcow','thoracic','childpose'],
  'Back/Biceps':    ['catcow','thoracic'],
  'Brachialis':     ['thoracic'],
  'Quads':          ['hipopen','pigeon'],
  'Quads/Glutes':   ['hipopen','pigeon','hamstring'],
  'Hamstrings':     ['hamstring','pigeon'],
  'Glutes':         ['pigeon','hipopen'],
  'Glutes/hips':    ['pigeon','hipopen'],
  'Calves':         ['ankleroll','hamstring'],
  'Core':           ['catcow','deadbug'],
  'Abs':            ['catcow'],
  'Lower abs':      ['catcow','hipopen'],
  'Anti-rotation':  ['catcow'],
  'Obliques':       ['catcow','thoracic'],
  'Deep core':      ['catcow'],
};

function getMobilityForMuscles(muscleStr) {
  if (!muscleStr) return [];
  const muscles = muscleStr.split(' · ');
  const ids = new Set();
  muscles.forEach(m => {
    (MOBILITY_BY_MUSCLE[m] || []).forEach(id => ids.add(id));
  });
  return [...ids].slice(0, 4);
}

// ────────────────────────────────────────────────────────────
// Weekly sessions tracker — grouped by ISO week from completedSessions
function getISOWeekKey(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
}

function getWeekLabel(isoKey) {
  const [year, w] = isoKey.split('-W');
  const jan4 = new Date(Number(year), 0, 4);
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (Number(w) - 1) * 7);
  return weekStart.toLocaleDateString('en', { day:'numeric', month:'short' });
}

// ────────────────────────────────────────────────────────────
// Session view for non-gym users — shows today's scheduled activity
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ActivitySessionView({ t, dayOfWeek, activities, onTapDay }) {
  const todayActs = activities[dayOfWeek] || [];
  const isRest = todayActs.length === 0;

  // Find next scheduled day
  let nextDayIdx = null;
  if (isRest) {
    for (let i = 1; i <= 7; i++) {
      const idx = (dayOfWeek + i) % 7;
      if ((activities[idx] || []).length > 0) { nextDayIdx = idx; break; }
    }
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'8px 20px 24px' }} className="phone-scroll">
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:9.5, letterSpacing:'.18em', textTransform:'uppercase', color:t.text3, marginBottom:3 }}>
          Today · {DAY_NAMES[dayOfWeek]}
        </div>
        <div style={{ fontFamily:t.serif, fontSize:28, lineHeight:1, color:t.text }}>
          {isRest ? 'Rest day' : 'Your session'}
        </div>
      </div>

      {isRest ? (
        <div>
          <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:18, padding:'20px 18px', marginBottom:14, textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>😴</div>
            <div style={{ fontFamily:t.serif, fontSize:18, color:t.text, marginBottom:6 }}>Recovery day</div>
            <div style={{ fontSize:13, color:t.text3, lineHeight:1.6 }}>
              Rest is part of your plan. Stay hydrated and enjoy the break.
            </div>
            {nextDayIdx !== null && (
              <div style={{ marginTop:14, fontSize:12, color:t.text2 }}>
                Next session: <strong>{DAY_NAMES[nextDayIdx]}</strong>
                {' · '}{(activities[nextDayIdx] || []).map(a => `${a.emoji || ''} ${a.label}`).join(', ')}
              </div>
            )}
          </div>
          <button
            onClick={() => onTapDay && onTapDay(dayOfWeek)}
            style={{ width:'100%', padding:'13px 0', borderRadius:14, background:t.surface,
              border:`1px solid ${t.border}`, color:t.text2, fontSize:14, fontWeight:500,
              cursor:'pointer', fontFamily:t.sans }}
          >
            Log an activity anyway
          </button>
        </div>
      ) : (
        <div>
          {todayActs.map((act, i) => (
            <div key={i} style={{
              background:t.surface, border:`1px solid ${t.border}`, borderRadius:18,
              padding:'18px 18px', marginBottom:12
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                <div style={{
                  width:52, height:52, borderRadius:14, fontSize:26,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:(act.color || t.accent) + '18'
                }}>{act.emoji || '🏃'}</div>
                <div>
                  <div style={{ fontFamily:t.serif, fontSize:22, color:t.text, lineHeight:1.1 }}>{act.label}</div>
                  {act.duration && (
                    <div style={{ fontSize:12, color:t.text3, marginTop:3 }}>{act.duration} min</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => onTapDay && onTapDay(dayOfWeek)}
                style={{
                  width:'100%', padding:'13px 0', borderRadius:14,
                  background:act.color || t.accent, border:'none',
                  color:'#fff', fontSize:15, fontWeight:600,
                  cursor:'pointer', fontFamily:t.sans
                }}
              >
                Start session
              </button>
            </div>
          ))}
          <button
            onClick={() => onTapDay && onTapDay(dayOfWeek)}
            style={{ width:'100%', padding:'13px 0', borderRadius:14, background:t.surface,
              border:`1px solid ${t.border}`, color:t.text2, fontSize:14, fontWeight:500,
              cursor:'pointer', fontFamily:t.sans, marginTop:4 }}
          >
            Log a different activity
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Gym Hub — the Session tab landing page
function GymHubScreen({ width = 390, height = 820, theme = 'light',
                       plan, todayIdx = 0, dayOfWeek = 1, activeSession,
                       activities = {}, completedSessions = [],
                       onNav, onStartSession, onMarkComplete, onResumeSession,
                       onChangeSplit, onEditDay, onSelectDay, onTapDay,
                       onBrowseLibrary, onViewSummary, onDeleteSession,
                       onReorderSchedule, onImportSessions, onEditSession,
                       tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const t = themes[theme];
  const split = plan?.splitDays ? SPLITS[plan.splitDays] : null;

  // Use plan.scheduleOverride only if all its day IDs still exist in the current split.
  const splitDayIds = split ? new Set(split.days.map(d => d.id)) : new Set();
  const scheduleOverrideIsValid = split && plan.scheduleOverride &&
    plan.scheduleOverride.every(slot => slot === '—' || splitDayIds.has(slot));
  const schedule = split
    ? (scheduleOverrideIsValid ? plan.scheduleOverride : split.schedule)
    : ['—','—','—','—','—','—','—'];

  // viewDayIdx: which day the exercise focus card shows (defaults to today's day of week)
  const [viewDayIdx, setViewDayIdx] = React.useState(dayOfWeek);
  const [draggingSlot, setDraggingSlot] = React.useState(null);
  const [drillExercise, setDrillExercise] = React.useState(null);
  const [showImport, setShowImport] = React.useState(false);
  const [editingSession, setEditingSession] = React.useState(null);
  const [showAddSession, setShowAddSession] = React.useState(false);
  const [showMarkComplete, setShowMarkComplete] = React.useState(false);

  // Compute the actual calendar date for the currently viewed day slot
  const now = new Date();
  const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const viewDayDate = new Date(now);
  viewDayDate.setDate(now.getDate() + mondayOffset + viewDayIdx);
  viewDayDate.setHours(0, 0, 0, 0);
  const viewDayDateEnd = new Date(viewDayDate);
  viewDayDateEnd.setHours(23, 59, 59, 999);
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const isViewDayPast = viewDayDate < todayMidnight;

  const viewDayCompleted = completedSessions.find(s => {
    const sd = new Date(s.date);
    return sd >= viewDayDate && sd <= viewDayDateEnd;
  });

  // Resolve the viewed day's scheduled session
  const viewSlot = schedule[viewDayIdx];
  const viewBaseDay = viewSlot && viewSlot !== '—' ? split.days.find(d => d.id === viewSlot) : null;
  const viewDay = viewBaseDay ? (plan.overrides?.[viewBaseDay.id] || viewBaseDay) : null;
  const isViewRest = !viewDay;

  // For rest day: show mobility based on previous day's muscles
  const prevSlot = schedule[(viewDayIdx + 6) % 7];
  const prevBaseDay = prevSlot && prevSlot !== '—' ? split.days.find(d => d.id === prevSlot) : null;
  const prevDay = prevBaseDay ? (plan.overrides?.[prevBaseDay.id] || prevBaseDay) : null;
  const restMobilityIds = isViewRest ? getMobilityForMuscles(prevDay?.muscles || '') : [];

  const viewExercises = viewDay ? SECTION_ORDER.flatMap(sec => (viewDay[sec] || []).map(id => ({ id, sec }))) : [];
  const viewDayActs = activities[viewDayIdx] || [];

  // Weekly tracker data: group completedSessions by ISO week
  const weekMap = React.useMemo(() => {
    const map = {};
    completedSessions.forEach(s => {
      const key = getISOWeekKey(s.date);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [completedSessions]);

  const currentWeekKey = getISOWeekKey(new Date());
  const allWeekKeys = [...new Set([...Object.keys(weekMap), currentWeekKey])].sort();

  // Per-exercise progress across all sessions
  const exerciseHistory = React.useMemo(() => {
    const hist = {};
    completedSessions.forEach(s => {
      (s.queue || []).forEach(ex => {
        if (!hist[ex.id]) hist[ex.id] = { name: ex.name, sessions: [] };
        const doneSets = (ex.sets || []).filter(st => st.done);
        if (doneSets.length) {
          const maxW = Math.max(...doneSets.map(st => {
            if (ex.unilateral) return Math.max(st.wR || 0, st.wL || 0);
            return st.w || 0;
          }));
          hist[ex.id].sessions.push({ date: s.date, maxW, sets: doneSets.length });
        }
      });
    });
    return hist;
  }, [completedSessions]);

  // Build set of exercise IDs in drill week
  const drillWeekSessions = drillExercise && drillExercise.startsWith('week:')
    ? weekMap[drillExercise.replace('week:', '')] || []
    : null;

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

      {!split ? (
        <ActivitySessionView
          t={t} dayOfWeek={dayOfWeek} activities={activities} onTapDay={onTapDay}
        />
      ) : (
      <div style={{ flex:1, overflowY:'auto', padding:'8px 20px 16px' }} className="phone-scroll">

        {/* Top header */}
        <div style={{ marginBottom:14 }}>
          <div style={{
            fontSize:9.5, letterSpacing:'.18em', textTransform:'uppercase',
            color:t.text3, marginBottom:3
          }}>
            Gym
          </div>
          <div style={{ fontFamily:t.serif, fontSize:28, lineHeight:1, color:t.text }}>
            Your session plan
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
              This week · {split.name}
            </div>
            <button onClick={onChangeSplit} style={{
              padding:'3px 8px', borderRadius:7,
              background:'transparent', border:`1px solid ${t.border}`,
              color:t.accent, fontSize:11, fontWeight:500, cursor:'pointer',
              fontFamily:t.sans
            }}>Change ›</button>
          </div>

          {/* Weekly grid — clicking selects day for focus card */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:5 }}>
            {WEEK_DAYS.map((dayLetter, i) => {
              const slot = schedule[i];
              const isToday = i === dayOfWeek;
              const isSelected = i === viewDayIdx;
              const dayInfo = slot !== '—' ? split.days.find(d => d.id === slot) : null;
              const isRest = slot === '—' || !dayInfo;
              const dayActs = activities[i] || [];
              const now = new Date();
              const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
              const dayDate = new Date(now);
              dayDate.setDate(now.getDate() + mondayOffset + i);
              dayDate.setHours(0,0,0,0);
              const dayDateEnd = new Date(dayDate); dayDateEnd.setHours(23,59,59,999);
              const hasCompleted = completedSessions.some(s => {
                const sd = new Date(s.date);
                return sd >= dayDate && sd <= dayDateEnd;
              });
              const isDragging = draggingSlot === i;
              return (
                <div key={i}
                  onClick={(e) => { e.stopPropagation(); setViewDayIdx(i); }}
                  draggable={!isRest}
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggingSlot(i); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingSlot === null || draggingSlot === i) { setDraggingSlot(null); return; }
                    if (onReorderSchedule) {
                      const newSched = [...schedule];
                      [newSched[draggingSlot], newSched[i]] = [newSched[i], newSched[draggingSlot]];
                      onReorderSchedule(newSched);
                    }
                    setDraggingSlot(null);
                  }}
                  onDragEnd={() => setDraggingSlot(null)}
                  style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                    cursor:'pointer', padding:'2px 0',
                    opacity: isDragging ? 0.4 : 1
                  }}>
                  <div style={{
                    fontSize:9.5, color: isToday ? t.accent : t.text3, fontWeight: isToday ? 600 : 500
                  }}>
                    {dayLetter}
                  </div>
                  {(() => {
                    const actColor = dayActs[0]?.color;
                    const actEmoji = dayActs[0]?.emoji;
                    const hasActivity = isRest && dayActs.length > 0;
                    return (
                      <div style={{
                        position:'relative',
                        width:32, height:32, borderRadius:8,
                        background: hasCompleted
                          ? '#0090FF'
                          : hasActivity
                            ? (actColor ? actColor + '20' : t.surface2)
                            : isRest
                              ? t.surface2
                              : (isToday ? t.accent : (t.accent + '20')),
                        border: isSelected
                          ? `2px solid ${t.accent}`
                          : hasCompleted
                            ? '1.5px solid #0070CC'
                            : hasActivity
                              ? `1px solid ${actColor ? actColor + '50' : t.border}`
                              : isToday ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
                        color: hasCompleted
                          ? '#fff'
                          : isToday ? t.accentText : (isRest ? (actColor || t.text3) : t.accent),
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize: (isRest && !dayActs.length) || hasCompleted ? 11 : 14,
                        fontWeight:600, fontFamily:t.mono,
                        transition:'background .2s',
                        boxShadow: isSelected ? `0 0 0 3px ${t.accent}25` : 'none',
                      }}>
                        {hasCompleted ? '✓' : hasActivity ? (actEmoji || '+') : isRest ? '·' : '🏋️'}
                        {dayActs.length > 1 && !hasCompleted && (
                          <span style={{
                            position:'absolute', top:-3, right:-3,
                            width:10, height:10, borderRadius:'50%',
                            background: actColor || '#0090FF', border:`2px solid ${t.surface}`,
                            fontSize:7, color:'#fff', display:'flex',
                            alignItems:'center', justifyContent:'center', lineHeight:1
                          }}>{dayActs.length}</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
          <div style={{
            marginTop:9, padding:'7px 10px', borderRadius:8,
            background: t.surface2, border:`1px dashed ${t.border2}`,
            fontSize:10, color:t.text3, textAlign:'center', letterSpacing:'.02em'
          }}>
            Tap a day to see its session · drag to reorder
          </div>
        </div>

        {/* Day focus card — shows selected day's exercises, activities, or rest day advice */}
        {isViewRest && viewDayActs.length > 0 ? (
          /* Activity session card — for non-gym sessions scheduled on this day */
          <div style={{
            background:t.surface,
            border:`1.5px solid ${viewDayActs[0]?.color ? viewDayActs[0].color + '50' : t.border}`,
            borderRadius:20, padding:'16px 18px 14px', marginBottom:14,
            boxShadow: viewDayActs[0]?.color
              ? `0 4px 14px ${viewDayActs[0].color}10`
              : `0 4px 14px ${t.accent}08`,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
                  color: viewDayActs[0]?.color || t.accent, marginBottom:3, fontWeight:600
                }}>
                  {WEEK_DAYS[viewDayIdx]} · {viewDayActs.length} session{viewDayActs.length !== 1 ? 's' : ''}
                </div>
                <div style={{ fontFamily:t.serif, fontSize:26, lineHeight:1.05, color:t.text }}>
                  {viewDayActs.length === 1 ? viewDayActs[0].label : 'Training day'}
                </div>
              </div>
              <button onClick={() => onTapDay && onTapDay(viewDayIdx)} style={{
                padding:'6px 10px', borderRadius:8,
                background:'transparent', border:`1px solid ${t.border2}`,
                color:t.text2, fontSize:10.5, cursor:'pointer', fontFamily:t.sans,
              }}>✎ Edit</button>
            </div>

            {/* Session rows */}
            {viewDayActs.map((act, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:12, padding:'10px 0',
                borderTop: i > 0 ? `1px solid ${t.border}` : 'none',
              }}>
                <div style={{
                  width:44, height:44, borderRadius:12, flexShrink:0,
                  background:(act.color || t.accent) + '18',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
                }}>{act.emoji || '⚡'}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:500, color:t.text }}>{act.label}</div>
                  {act.duration && (
                    <div style={{ fontSize:11, color:t.text3, marginTop:2 }}>{act.duration} min</div>
                  )}
                </div>
              </div>
            ))}

            <button onClick={() => onTapDay && onTapDay(viewDayIdx)} style={{
              marginTop:14, width:'100%', padding:'13px', borderRadius:12, border:'none',
              fontFamily:t.sans, fontSize:14, fontWeight:600, cursor:'pointer',
              background: viewDayActs[0]?.color || t.accent, color:'#fff',
            }}>
              Start session
            </button>
          </div>
        ) : isViewRest ? (
          <div style={{
            background:t.surface, border:`1px solid ${t.border}`, borderRadius:20,
            padding:'16px 18px 14px', marginBottom:14
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{
                  fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
                  color:t.text3, marginBottom:3, fontWeight:600
                }}>
                  {WEEK_DAYS[viewDayIdx]} · Rest day
                </div>
                <div style={{ fontFamily:t.serif, fontSize:22, lineHeight:1.05, color:t.text }}>
                  Recovery day
                </div>
              </div>
              <button onClick={() => onTapDay && onTapDay(viewDayIdx)} style={{
                padding:'6px 10px', borderRadius:8,
                background:'transparent', border:`1px solid ${t.border2}`,
                color:t.text2, fontSize:10.5, cursor:'pointer', fontFamily:t.sans,
              }}>+ Log activity</button>
            </div>
            <div style={{
              padding:'10px 12px', borderRadius:10,
              background: '#15803D18', border:'1px solid #15803D30',
              marginBottom: restMobilityIds.length ? 12 : 0
            }}>
              <div style={{ fontSize:11.5, color:'#15803D', fontWeight:600, marginBottom:4 }}>
                Rest day tip
              </div>
              <div style={{ fontSize:11.5, color:t.text2, lineHeight:1.55 }}>
                {prevDay
                  ? `You trained ${prevDay.name.toLowerCase()} yesterday. Light mobility work helps flush out soreness and keeps joints healthy.`
                  : 'Mobility and stretching on rest days improves recovery and reduces injury risk.'}
              </div>
            </div>
            {restMobilityIds.length > 0 && (
              <div>
                <div style={{
                  fontSize:9.5, letterSpacing:'.14em', textTransform:'uppercase',
                  color:t.text3, marginBottom:7, fontWeight:500
                }}>
                  Suggested movements
                </div>
                {restMobilityIds.map(id => {
                  const ex = EX_LIB[id];
                  if (!ex) return null;
                  return (
                    <div key={id} style={{
                      display:'flex', alignItems:'center', gap:9, padding:'7px 0',
                      borderTop:`1px solid ${t.border}`
                    }}>
                      <div style={{
                        width:28, height:28, borderRadius:7, flexShrink:0,
                        background:'#15803D18', color:'#15803D',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12
                      }}>◈</div>
                      <div>
                        <div style={{ fontSize:12.5, color:t.text }}>{ex.name}</div>
                        <div style={{ fontSize:10, color:t.text3 }}>{ex.muscle}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
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
                  {WEEK_DAYS[viewDayIdx]} · {viewExercises.length} exercises
                </div>
                <div style={{ fontFamily:t.serif, fontSize:26, lineHeight:1.05, color:t.text }}>
                  {viewDay.name} day
                </div>
                <div style={{ fontSize:11.5, color:t.text2, marginTop:3 }}>
                  {viewDay.muscles}
                </div>
              </div>
              <button onClick={() => onEditDay(viewDay.id)} style={{
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
                const exs = viewDay[sec] || [];
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

            {/* Action buttons — context-aware based on day and session state */}
            {viewDayIdx === dayOfWeek ? (() => {
              const todayCompleted = completedSessions.find(s => {
                const sd = new Date(s.date);
                const now = new Date();
                return sd.toDateString() === now.toDateString();
              });
              if (todayCompleted) {
                return (
                  <div style={{ display:'flex', gap:7 }}>
                    <button onClick={() => onViewSummary && onViewSummary(todayCompleted)} style={{
                      flex:1, padding:'12px', borderRadius:11,
                      background:t.green+'18', color:t.green,
                      border:`1.5px solid ${t.green}40`,
                      fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer'
                    }}>
                      ✓ Session complete — view summary
                    </button>
                    <button onClick={() => onDeleteSession && onDeleteSession(todayCompleted.id)} style={{
                      width:44, height:44, borderRadius:11, background:'transparent',
                      border:`1px solid ${t.border}`, color:'#BE3B2E',
                      cursor:'pointer', fontSize:13, fontFamily:t.sans,
                      display:'flex', alignItems:'center', justifyContent:'center'
                    }}>×</button>
                  </div>
                );
              }
              if (activeSession) {
                return (
                  <button onClick={onResumeSession} style={{
                    width:'100%', padding:'12px', borderRadius:11,
                    background:t.accent, color:t.accentText,
                    border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6
                  }}>Resume session →</button>
                );
              }
              return (
                <div style={{ display:'flex', gap:7 }}>
                  <button onClick={onStartSession} style={{
                    flex:1, padding:'12px', borderRadius:11,
                    background:t.accent, color:t.accentText,
                    border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6
                  }}>Start session →</button>
                  <button onClick={() => setShowMarkComplete(true)} style={{
                    padding:'12px 14px', borderRadius:11, background:'transparent',
                    border:`1.5px solid ${t.green}60`, color:t.green,
                    fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    whiteSpace:'nowrap'
                  }}>✓ Mark complete</button>
                </div>
              );
            })() : isViewDayPast ? (() => {
              if (viewDayCompleted) {
                return (
                  <div style={{ display:'flex', gap:7 }}>
                    <button onClick={() => onViewSummary && onViewSummary(viewDayCompleted)} style={{
                      flex:1, padding:'11px', borderRadius:11,
                      background:t.green+'18', color:t.green,
                      border:`1.5px solid ${t.green}40`,
                      fontFamily:t.sans, fontSize:12.5, fontWeight:600, cursor:'pointer'
                    }}>
                      ✓ Session logged — view
                    </button>
                    <button onClick={() => setEditingSession(viewDayCompleted)} style={{
                      padding:'11px 14px', borderRadius:11, background:'transparent',
                      border:`1px solid ${t.border}`, color:t.accent,
                      fontSize:12.5, cursor:'pointer', fontFamily:t.sans, fontWeight:500
                    }}>✎ Edit</button>
                  </div>
                );
              }
              return (
                <div style={{ display:'flex', gap:7 }}>
                  <button onClick={() => setShowAddSession(true)} style={{
                    flex:1, padding:'11px', borderRadius:11,
                    background:t.accent, color:t.accentText,
                    border:'none', fontFamily:t.sans, fontSize:12.5, fontWeight:600, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5
                  }}>+ Add session data</button>
                  <button onClick={() => onTapDay && onTapDay(viewDayIdx)} style={{
                    padding:'11px 14px', borderRadius:11, background:'transparent',
                    border:`1px solid ${t.border2}`, color:t.text2,
                    fontSize:12, cursor:'pointer', fontFamily:t.sans
                  }}>Activities ›</button>
                </div>
              );
            })() : (
              <button onClick={() => onTapDay && onTapDay(viewDayIdx)} style={{
                width:'100%', padding:'11px', borderRadius:11,
                background:'transparent', border:`1px solid ${t.border2}`,
                color:t.text2, fontFamily:t.sans, fontSize:12.5, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6
              }}>View day activities ›</button>
            )}
          </div>
        )}

        {/* Sunday planning nudge */}
        {dayOfWeek === 6 && (
          <div style={{
            background: t.accent+'12', border:`1px solid ${t.accent}30`,
            borderRadius:13, padding:'11px 14px', marginBottom:12,
            display:'flex', alignItems:'center', gap:10
          }}>
            <span style={{ fontSize:18 }}>📅</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:500, color:t.text }}>Plan next week</div>
              <div style={{ fontSize:10.5, color:t.text2 }}>Review your split and adjust for the week ahead.</div>
            </div>
            <button onClick={onChangeSplit} style={{
              padding:'5px 10px', borderRadius:7, background:t.accent, color:t.accentText,
              border:'none', fontSize:10.5, fontWeight:600, cursor:'pointer', fontFamily:t.sans
            }}>Review</button>
          </div>
        )}

        {/* Browse exercise library */}
        <button onClick={onBrowseLibrary} style={{
          width:'100%', display:'flex', alignItems:'center', gap:11, padding:'12px 14px',
          background:'transparent', border:`1.5px dashed ${t.border2}`,
          borderRadius:13, marginBottom:16, cursor:'pointer', fontFamily:t.sans
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
              Search by muscle or type
            </div>
          </div>
          <span style={{ fontSize:16, color:t.text3 }}>›</span>
        </button>

        {/* ── Weekly progress tracker ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:10, padding:'0 2px'
        }}>
          <div style={{
            fontSize:10, letterSpacing:'.16em', textTransform:'uppercase', color:t.text3
          }}>
            Week-by-week progress
          </div>
          <button onClick={() => setShowImport(true)} style={{
            padding:'4px 10px', borderRadius:7, background:'transparent',
            border:`1px solid ${t.border}`, color:t.accent,
            fontSize:10.5, fontWeight:500, cursor:'pointer', fontFamily:t.sans
          }}>
            ↑ Import history
          </button>
        </div>

        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:18,
          padding:'14px 16px', marginBottom:14
        }}>
          {allWeekKeys.length === 0 || (allWeekKeys.length === 1 && !weekMap[allWeekKeys[0]]?.length) ? (
            <div style={{ textAlign:'center', padding:'20px 0', color:t.text3, fontSize:12 }}>
              No sessions logged yet.{'\n'}Complete a session to see your progress.
            </div>
          ) : (
            <>
              {/* Bar chart — one bar per week */}
              <div style={{ display:'flex', alignItems:'flex-end', gap:6, marginBottom:12, minHeight:52 }}>
                {allWeekKeys.map(wk => {
                  const sessions = weekMap[wk] || [];
                  const count = sessions.length;
                  const isCurrent = wk === currentWeekKey;
                  const maxCount = Math.max(...allWeekKeys.map(k => (weekMap[k]||[]).length), 1);
                  const barH = count === 0 ? 4 : Math.max(14, Math.round((count / maxCount) * 44));
                  return (
                    <div key={wk} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                      <div style={{
                        fontSize:9, color:t.text3, fontFamily:'monospace',
                        fontVariantNumeric:'tabular-nums'
                      }}>{count || ''}</div>
                      <div
                        onClick={() => setDrillExercise(d => d === 'week:'+wk ? null : 'week:'+wk)}
                        style={{
                          width:'100%', height:barH, borderRadius:4,
                          background: isCurrent ? t.accent : (count === 0 ? t.border : t.accent+'55'),
                          cursor: count > 0 ? 'pointer' : 'default',
                          transition:'height .3s',
                          border: drillExercise === 'week:'+wk ? `1.5px solid ${t.accent}` : 'none',
                        }}
                      />
                      <div style={{
                        fontSize:8.5, color: isCurrent ? t.accent : t.text3,
                        fontWeight: isCurrent ? 600 : 400, textAlign:'center', lineHeight:1.2
                      }}>
                        {getWeekLabel(wk)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Drill-down: sessions in selected week */}
              {drillExercise && drillExercise.startsWith('week:') && (() => {
                const wk = drillExercise.replace('week:','');
                const sessions = weekMap[wk] || [];
                if (!sessions.length) return null;
                // Collect unique exercises in this week
                const exMap = {};
                sessions.forEach(s => {
                  (s.queue || []).forEach(ex => {
                    if (!exMap[ex.id]) exMap[ex.id] = { name: ex.name, sessions: [] };
                    const doneSets = (ex.sets||[]).filter(st => st.done);
                    if (doneSets.length) exMap[ex.id].sessions.push({ date: s.date, doneSets });
                  });
                });
                return (
                  <div style={{
                    borderTop:`1px solid ${t.border}`, paddingTop:10, marginTop:2
                  }}>
                    <div style={{
                      fontSize:10, letterSpacing:'.12em', textTransform:'uppercase',
                      color:t.text3, marginBottom:8
                    }}>
                      {getWeekLabel(wk)} · {sessions.length} session{sessions.length>1?'s':''}
                    </div>
                    {sessions.map(s => (
                      <div key={s.id} style={{
                        padding:'8px 10px', borderRadius:10, marginBottom:6,
                        background:t.surface2, border:`1px solid ${t.border}`
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                          <div style={{ fontSize:12.5, color:t.text, fontWeight:500 }}>
                            {s.workout || 'Session'}
                          </div>
                          <div style={{ fontSize:10, color:t.text3 }}>
                            {new Date(s.date).toLocaleDateString('en', { weekday:'short', day:'numeric', month:'short' })}
                            {s.elapsed ? ` · ${Math.floor(s.elapsed/60)}m` : ''}
                          </div>
                        </div>
                        {(s.queue||[]).filter(ex => (ex.sets||[]).some(st=>st.done)).map(ex => {
                          const doneSets = ex.sets.filter(st=>st.done);
                          const topW = Math.max(...doneSets.map(st =>
                            ex.unilateral ? Math.max(st.wR||0, st.wL||0) : st.w||0
                          ));
                          return (
                            <div key={ex.id} style={{
                              display:'flex', justifyContent:'space-between',
                              padding:'3px 0', fontSize:11, color:t.text2
                            }}>
                              <span
                                onClick={() => setDrillExercise(d => d === 'ex:'+ex.id ? 'week:'+wk : 'ex:'+ex.id)}
                                style={{ cursor:'pointer', color: drillExercise === 'ex:'+ex.id ? t.accent : t.text2,
                                  textDecoration: 'underline', textDecorationColor: t.border2 }}
                              >
                                {ex.name}
                              </span>
                              <span style={{ color:t.text3 }}>
                                {doneSets.length}×{topW > 0 ? topW+'kg' : (doneSets[0]?.r||0)+' reps'}
                              </span>
                            </div>
                          );
                        })}
                        <div style={{ display:'flex', gap:6, marginTop:6 }}>
                          <button onClick={() => onViewSummary && onViewSummary(s)} style={{
                            flex:1, padding:'5px 10px', borderRadius:7,
                            background:'transparent', border:`1px solid ${t.border}`,
                            color:t.text3, fontSize:10.5, cursor:'pointer', fontFamily:t.sans
                          }}>View summary ›</button>
                          <button onClick={() => setEditingSession(s)} style={{
                            flex:1, padding:'5px 10px', borderRadius:7,
                            background:'transparent', border:`1px solid ${t.border}`,
                            color:t.accent, fontSize:10.5, cursor:'pointer', fontFamily:t.sans
                          }}>✎ Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Drill-down: individual exercise progress over time */}
              {drillExercise && drillExercise.startsWith('ex:') && (() => {
                const exId = drillExercise.replace('ex:','');
                const hist = exerciseHistory[exId];
                if (!hist || hist.sessions.length < 1) return null;
                const sorted = [...hist.sessions].sort((a,b) => new Date(a.date) - new Date(b.date));
                const maxW = Math.max(...sorted.map(s => s.maxW), 1);
                return (
                  <div style={{
                    borderTop:`1px solid ${t.border}`, paddingTop:10, marginTop:4
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <div style={{
                        fontSize:12, color:t.text, fontWeight:500
                      }}>
                        {hist.name} — all time
                      </div>
                      <button onClick={() => setDrillExercise(null)} style={{
                        padding:'3px 8px', borderRadius:6, background:'transparent',
                        border:`1px solid ${t.border}`, color:t.text3,
                        fontSize:10, cursor:'pointer', fontFamily:t.sans
                      }}>Close ×</button>
                    </div>
                    {/* Mini bar chart of top weight per session */}
                    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:40, marginBottom:8 }}>
                      {sorted.map((s, idx) => {
                        const barH = s.maxW > 0 ? Math.max(4, Math.round((s.maxW/maxW)*36)) : 4;
                        const isLast = idx === sorted.length - 1;
                        return (
                          <div key={idx} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                            <div style={{ fontSize:8, color:t.text3 }}>{s.maxW > 0 ? s.maxW+'kg' : ''}</div>
                            <div style={{
                              width:'100%', height:barH, borderRadius:3,
                              background: isLast ? t.accent : t.accent+'55'
                            }}/>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:t.text3, marginBottom:8 }}>
                      <span>{new Date(sorted[0].date).toLocaleDateString('en',{day:'numeric',month:'short'})}</span>
                      <span>{new Date(sorted[sorted.length-1].date).toLocaleDateString('en',{day:'numeric',month:'short'})}</span>
                    </div>
                    {sorted.length > 1 && (() => {
                      const first = sorted[0].maxW, last = sorted[sorted.length-1].maxW;
                      const diff = last - first;
                      return diff !== 0 ? (
                        <div style={{
                          fontSize:11, color: diff > 0 ? t.green : '#BE3B2E',
                          fontWeight:500
                        }}>
                          {diff > 0 ? '↑' : '↓'} {Math.abs(diff)}kg over {sorted.length} sessions
                        </div>
                      ) : null;
                    })()}
                  </div>
                );
              })()}
            </>
          )}
        </div>

      </div>
      )}

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}/>

      {showImport && (
        <ImportHistorySheet
          theme={theme}
          plan={plan}
          completedSessions={completedSessions}
          onClose={() => setShowImport(false)}
          onImport={({ newSessions, updatedSessions }) => {
            if (newSessions.length) onImportSessions && onImportSessions(newSessions);
            updatedSessions.forEach(s => onEditSession && onEditSession(s));
          }}
        />
      )}

      {editingSession && (
        <EditSessionSheet
          theme={theme}
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSave={(updated) => { onEditSession && onEditSession(updated); setEditingSession(null); }}
        />
      )}

      {showAddSession && viewDay && (
        <AddSessionSheet
          theme={theme}
          day={viewDay}
          date={viewDayDate}
          onClose={() => setShowAddSession(false)}
          onSave={(session) => { onImportSessions && onImportSessions([session]); setShowAddSession(false); }}
        />
      )}

      {showMarkComplete && (
        <MarkCompleteSheet
          theme={theme}
          onClose={() => setShowMarkComplete(false)}
          onSave={(extras) => { onMarkComplete && onMarkComplete(extras); setShowMarkComplete(false); }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Split Picker — choose 1/2/3/4/5 days per week
function SplitPickerScreen({ width = 390, height = 820, theme = 'light',
                            plan, onBack, onSave, onNav, tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const t = themes[theme];
  const [selected, setSelected] = React.useState(plan.splitDays || 3);
  const split = SPLITS[selected];

  // Editable schedule — initialise from plan override if valid, else default
  const initSchedule = () => {
    const s = SPLITS[plan.splitDays];
    if (!s) return SPLITS[3].schedule.slice();
    const ids = new Set(s.days.map(d => d.id));
    const valid = plan.scheduleOverride && plan.scheduleOverride.every(slot => slot === '—' || ids.has(slot));
    return valid ? [...plan.scheduleOverride] : [...s.schedule];
  };
  const [customSchedule, setCustomSchedule] = React.useState(initSchedule);
  const [movingIdx, setMovingIdx] = React.useState(null); // slot index currently selected for move

  // Reset schedule when user picks a different day count
  React.useEffect(() => {
    setCustomSchedule([...SPLITS[selected].schedule]);
    setMovingIdx(null);
  }, [selected]);

  const handleSlotTap = (i) => {
    const slot = customSchedule[i];
    if (movingIdx === null) {
      // Nothing selected yet — only allow selecting a session slot
      if (slot !== '—') setMovingIdx(i);
    } else if (movingIdx === i) {
      // Tap same slot to deselect
      setMovingIdx(null);
    } else {
      // Move/swap
      const next = [...customSchedule];
      const moving = next[movingIdx];
      next[movingIdx] = next[i]; // could be '—' or another session
      next[i] = moving;
      setCustomSchedule(next);
      setMovingIdx(null);
    }
  };

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
          <button onClick={() => onSave(selected, customSchedule)} style={{
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

          {/* Weekly schedule — interactive */}
          <div style={{
            display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:7
          }}>
            <div style={{
              fontSize:9.5, letterSpacing:'.16em', textTransform:'uppercase',
              color:t.text3, fontWeight:500
            }}>
              Weekly schedule
            </div>
            {movingIdx === null
              ? <div style={{ fontSize:9, color:t.text3 }}>Tap a session to move it</div>
              : <div style={{ fontSize:9, color:t.accent }}>Tap a slot to place it</div>
            }
          </div>
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:5, marginBottom:14
          }}>
            {WEEK_DAYS.map((dayLetter, i) => {
              const slot = customSchedule[i];
              const isRest = slot === '—';
              const dayInfo = !isRest ? split.days.find(d => d.id === slot) : null;
              const isMoving = movingIdx === i;
              const isTarget = movingIdx !== null && movingIdx !== i;
              return (
                <button key={i} onClick={() => handleSlotTap(i)} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                  background:'transparent', border:'none', cursor: isRest && movingIdx === null ? 'default' : 'pointer',
                  padding:0
                }}>
                  <div style={{ fontSize:9.5, color: isMoving ? t.accent : t.text3 }}>{dayLetter}</div>
                  <div style={{
                    width:'100%', aspectRatio:'1', borderRadius:7,
                    background: isMoving ? t.accent : isRest ? (isTarget ? t.accent+'22' : t.surface2) : t.accent+'18',
                    border: isMoving ? `2px solid ${t.accent}` : isTarget && isRest ? `1.5px dashed ${t.accent}60` : `1px solid ${isRest ? t.border : t.accent+'40'}`,
                    color: isMoving ? t.accentText : isRest ? t.text3 : t.accent,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:600,
                    transform: isMoving ? 'scale(1.1)' : 'scale(1)',
                    transition:'transform 0.15s, background 0.15s',
                  }}>
                    {isRest ? (isTarget ? '+' : '·') : dayInfo ? dayInfo.name.charAt(0) : '?'}
                  </div>
                </button>
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

        <button onClick={() => onSave(selected, customSchedule)} style={{
          width:'100%', padding:'14px', borderRadius:13,
          background:t.accent, color:t.accentText,
          border:'none', fontFamily:t.sans, fontSize:14, fontWeight:600, cursor:'pointer'
        }}>
          Use {split.name} →
        </button>
      </div>

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}/>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Session Editor — edit one day's exercises grouped by section
function SessionEditorScreen({ width = 390, height = 820, theme = 'light',
                              plan, dayId, onBack, onSave, onNav, tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const t = themes[theme];
  const split = SPLITS[plan.splitDays] || SPLITS[3];
  const originalDay = dayId && split
    ? ((plan.overrides && plan.overrides[dayId]) || split.days.find(d => d.id === dayId) || split.days[0])
    : (split ? split.days[0] : null);

  // Compute the effective schedule
  const splitDayIds = split ? new Set(split.days.map(d => d.id)) : new Set();
  const scheduleOverrideIsValid = plan.scheduleOverride &&
    plan.scheduleOverride.every(slot => slot === '—' || splitDayIds.has(slot));
  const baseSchedule = split
    ? (scheduleOverrideIsValid ? plan.scheduleOverride : split.schedule)
    : Array(7).fill('—');
  const initialSlotIdx = baseSchedule.findIndex(slot => slot === dayId);

  // Hooks must always be called unconditionally — early return comes after them.
  const [day, setDay] = React.useState(originalDay);
  const [addingTo, setAddingTo] = React.useState(null);
  const [searchQ, setSearchQ] = React.useState('');
  const [assignedSlotIdx, setAssignedSlotIdx] = React.useState(initialSlotIdx);

  if (!dayId || !split || !day) return null;

  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

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
          <button onClick={() => {
            let newSchedule = null;
            if (assignedSlotIdx !== initialSlotIdx) {
              newSchedule = [...baseSchedule];
              const displaced = assignedSlotIdx >= 0 ? newSchedule[assignedSlotIdx] : '—';
              if (initialSlotIdx >= 0) newSchedule[initialSlotIdx] = (displaced !== '—' && displaced !== dayId) ? displaced : '—';
              if (assignedSlotIdx >= 0) newSchedule[assignedSlotIdx] = dayId;
            }
            onSave({ ...day }, newSchedule);
          }} style={{
            padding:'6px 12px', borderRadius:8, background:t.accent, color:t.accentText,
            border:'none', fontFamily:t.sans, fontSize:11, fontWeight:600, cursor:'pointer'
          }}>Save</button>
        }
      />

      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px 16px' }} className="phone-scroll">

        {/* Day assignment picker */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:14,
          padding:'12px 14px', marginBottom:12
        }}>
          <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:t.text3, fontWeight:600, marginBottom:8 }}>
            Scheduled day
          </div>
          <div style={{ display:'flex', gap:5 }}>
            {DAY_LABELS.map((label, i) => {
              const isSelected = assignedSlotIdx === i;
              const isOccupied = baseSchedule[i] !== '—' && baseSchedule[i] !== dayId;
              return (
                <button key={i} onClick={() => setAssignedSlotIdx(i)} style={{
                  flex:1, padding:'7px 0', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:600,
                  fontFamily:t.sans, border: isSelected ? 'none' : `1px solid ${t.border}`,
                  background: isSelected ? t.accent : isOccupied ? t.surface2 : t.bg,
                  color: isSelected ? t.accentText : isOccupied ? t.text3 : t.text,
                }}>
                  {label}
                  {isOccupied && !isSelected && (
                    <div style={{ fontSize:7, color:t.text3, marginTop:1 }}>swap</div>
                  )}
                </button>
              );
            })}
          </div>
          {assignedSlotIdx !== initialSlotIdx && assignedSlotIdx >= 0 && (
            <div style={{ fontSize:10, color:t.accent, marginTop:7 }}>
              {initialSlotIdx >= 0
                ? `Moving from ${DAY_LABELS[initialSlotIdx]} → ${DAY_LABELS[assignedSlotIdx]}${baseSchedule[assignedSlotIdx] !== '—' ? ` (swaps with ${baseSchedule[assignedSlotIdx]})` : ''}`
                : `Assigned to ${DAY_LABELS[assignedSlotIdx]}`}
            </div>
          )}
        </div>

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

      <BottomNav theme={theme} active="gym" onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}/>

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


// ────────────────────────────────────────────────────────────
// Day Activities Screen
// Shows all activities (gym + non-gym) logged for a given day of the week.
// New: allows adding a gym session, not just non-gym activities.
// If a gym session is added, recommends the best session type based on
// what else is already in the weekly plan.

const ACTIVITY_TYPES = [
  { id:'gym',   label:'Gym session', emoji:'🏋️', color:'#BE5A38', isGym: true  },
  { id:'run',   label:'Run',         emoji:'🏃', color:'#0090FF', isGym: false },
  { id:'walk',  label:'Walk',        emoji:'🚶', color:'#15803D', isGym: false },
  { id:'swim',  label:'Swim',        emoji:'🏊', color:'#0369A1', isGym: false },
  { id:'yoga',  label:'Yoga',        emoji:'🧘', color:'#6D4AAF', isGym: false },
  { id:'hike',  label:'Hike',        emoji:'⛰️', color:'#854D0E', isGym: false },
  { id:'cycle', label:'Cycle',       emoji:'🚴', color:'#9333EA', isGym: false },
  { id:'other', label:'Other',       emoji:'⚡', color:'#4B5563', isGym: false },
];

// Recommend what gym session to do based on what's already in the plan this week
function getGymRecommendation(plan, dayIdx) {
  const split = SPLITS[plan.splitDays];
  if (!split) return { name: 'Full body', muscles: 'Full body strength' };
  const scheduled = split.days;
  const muscles = scheduled.flatMap(d => (d.muscles || '').split(' · '));
  const hasChest    = muscles.some(m => m.includes('Chest'));
  const hasBack     = muscles.some(m => m.includes('Back') || m.includes('Lats'));
  const hasLegs     = muscles.some(m => m.includes('Leg') || m.includes('Quad') || m.includes('Glute'));
  const hasShoulders= muscles.some(m => m.includes('Shoulder'));
  if (hasChest && hasBack && hasLegs)
    return { name: 'Full body', muscles: 'Full body · Active recovery + mobility' };
  if (!hasLegs)
    return { name: 'Legs', muscles: 'Quads · Hamstrings · Glutes' };
  if (!hasBack)
    return { name: 'Pull', muscles: 'Back · Biceps · Rear delts' };
  if (!hasChest)
    return { name: 'Push', muscles: 'Chest · Shoulders · Triceps' };
  return { name: 'Full body', muscles: 'Full body strength' };
}

function DayActivitiesScreen({ width = 390, height = 820, theme = 'light',
                              plan, dayIdx = 1, activities = {},
                              onBack, onSave, onEditGym, onNav,
                              tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const t = themes[theme];
  const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const todayWeekday = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  const [currentDayIdx, setCurrentDayIdx] = React.useState(dayIdx);
  const [items, setItems] = React.useState([...(activities[dayIdx] || [])]);
  const [showAdd, setShowAdd] = React.useState(false);
  const [addType, setAddType] = React.useState(null);
  const [duration, setDuration] = React.useState('45');
  const [time, setTime] = React.useState('07:00');
  const [deleteModal, setDeleteModal] = React.useState(null); // item id being deleted

  // Reload items when switching days
  React.useEffect(() => {
    setItems([...(activities[currentDayIdx] || [])]);
  }, [currentDayIdx]);

  const dayName = DAY_NAMES[currentDayIdx] || 'Day';

  // Resolve the active schedule — respects plan.scheduleOverride when valid
  const split = SPLITS[plan.splitDays];
  const splitDayIds = new Set((split?.days || []).map(d => d.id));
  const scheduleOverrideIsValid = plan.scheduleOverride &&
    plan.scheduleOverride.every(slot => slot === '—' || splitDayIds.has(slot));
  const activeSchedule = (scheduleOverrideIsValid ? plan.scheduleOverride : split?.schedule) || [];
  const scheduledSlot = activeSchedule[currentDayIdx];
  const baseDay = scheduledSlot && scheduledSlot !== '—'
    ? split.days.find(d => d.id === scheduledSlot) : null;
  // Also apply per-day exercise overrides the user may have saved
  const scheduledDay = baseDay ? (plan.overrides?.[baseDay.id] || baseDay) : null;

  const recommendation = getGymRecommendation(plan, currentDayIdx);

  const addActivity = () => {
    if (!addType) return;
    const typeInfo = ACTIVITY_TYPES.find(a => a.id === addType);
    const newItem = {
      id: Date.now().toString(),
      type: addType,
      label: typeInfo.label,
      emoji: typeInfo.emoji,
      duration: Number(duration) || 45,
      time,
      source: 'Manual',
      isGym: typeInfo.isGym,
    };
    const updated = [...items, newItem];
    setItems(updated);
    if (onSave) onSave(currentDayIdx, updated);
    setShowAdd(false);
    setAddType(null);
    setDuration('45');
  };

  const removeItem = (id) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    if (onSave) onSave(currentDayIdx, updated);
    setDeleteModal(null);
  };

  const totalTime = items.reduce((s, i) => s + (i.duration || 0), 0);

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

      <ScreenHeader theme={theme} title={dayName} sub="Activities"
        onBack={onBack}
        right={
          <button onClick={() => setShowAdd(true)} style={{
            padding:'6px 12px', borderRadius:8, background:t.accent, color:t.accentText,
            border:'none', fontFamily:t.sans, fontSize:11, fontWeight:600, cursor:'pointer'
          }}>+ Add</button>
        }
      />

      {/* Day selector strip */}
      <div style={{
        display:'flex', gap:2, padding:'8px 14px 8px',
        borderBottom:`1px solid ${t.border}`, flexShrink:0
      }}>
        {DAY_SHORT.map((label, i) => {
          const isToday = i === todayWeekday;
          const isSelected = i === currentDayIdx;
          const slotId = activeSchedule[i];
          const hasSession = slotId && slotId !== '—';
          return (
            <button key={i} onClick={() => setCurrentDayIdx(i)} style={{
              flex:1, padding:'5px 0', borderRadius:8, border:'none',
              background: isSelected ? t.accent : 'transparent',
              color: isSelected ? '#fff' : isToday ? t.accent : t.text3,
              fontFamily:t.sans, fontSize:9.5,
              fontWeight: isSelected ? 700 : isToday ? 600 : 400,
              cursor:'pointer', position:'relative',
            }}>
              {label}
              {hasSession && !isSelected && (
                <div style={{
                  width:4, height:4, borderRadius:'50%',
                  background: isToday ? t.accent : t.text3,
                  margin:'2px auto 0',
                }} />
              )}
              {(!hasSession || isSelected) && <div style={{ height:6 }} />}
            </button>
          );
        })}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px 16px' }} className="phone-scroll">

        {/* Scheduled gym session (from split plan) */}
        {scheduledDay && (
          <div style={{
            background:t.surface, border:`1.5px solid ${t.accent}40`, borderRadius:16,
            padding:'12px 14px', marginBottom:12
          }}>
            <div style={{ fontSize:9.5, letterSpacing:'.14em', textTransform:'uppercase', color:t.accent, marginBottom:4, fontWeight:600 }}>
              Planned from your split
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontFamily:t.serif, fontSize:18, color:t.text }}>{scheduledDay.name} day</div>
                <div style={{ fontSize:11, color:t.text2, marginTop:2 }}>{scheduledDay.muscles}</div>
              </div>
              <button onClick={() => onEditGym && onEditGym(scheduledDay.id)} style={{
                padding:'5px 10px', borderRadius:8, background:'transparent',
                border:`1px solid ${t.border}`, color:t.text2,
                fontSize:10.5, cursor:'pointer', fontFamily:t.sans
              }}>✎ Edit</button>
            </div>
          </div>
        )}


        {/* Activities list */}
        {items.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:t.text3, fontSize:12 }}>
            Nothing logged for {dayName} yet.{`\n`}
            Tap + Add to log a session or activity.
          </div>
        ) : (
          items.map((item, i) => {
            const typeInfo = ACTIVITY_TYPES.find(a => a.id === item.type);
            const color = typeInfo?.color || t.accent;
            return (
              <div key={item.id} style={{
                display:'flex', alignItems:'center', gap:11, padding:'11px 14px',
                background:t.surface, border:`1px solid ${t.border}`,
                borderRadius:13, marginBottom:7
              }}>
                <div style={{
                  width:36, height:36, borderRadius:9, flexShrink:0,
                  background:color+'18', color,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:16
                }}>
                  {item.emoji}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:t.text, fontWeight:500 }}>{item.label}</div>
                  <div style={{ fontSize:10.5, color:t.text3 }}>
                    {item.time} · {item.duration} min
                    {item.source !== 'Manual' && (
                      <span style={{ marginLeft:5, color:t.text3 }}>· {item.source}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setDeleteModal(item.id)} style={{
                  width:26, height:26, borderRadius:6, background:'transparent',
                  border:`1px solid ${t.border}`, color:'#BE3B2E',
                  cursor:'pointer', fontSize:14, fontFamily:t.sans, display:'flex',
                  alignItems:'center', justifyContent:'center'
                }}>×</button>
              </div>
            );
          })
        )}

        {items.length > 0 && (
          <div style={{
            padding:'8px 14px', borderRadius:10,
            background:t.surface2, border:`1px solid ${t.border}`,
            fontSize:11, color:t.text2, marginTop:4
          }}>
            Total active time: <span style={{ fontWeight:500, color:t.text }}>{totalTime} min</span>
          </div>
        )}
      </div>

      <BottomNav theme={theme} active="weekly" onNav={onNav} tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}/>

      {/* Add activity sheet */}
      {showAdd && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.4)',
          display:'flex', alignItems:'flex-end', zIndex:50
        }} onClick={() => { setShowAdd(false); setAddType(null); }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width:'100%', background:t.surface, borderTopLeftRadius:22, borderTopRightRadius:22,
            padding:'18px 20px 24px',
          }}>
            <div style={{ width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 14px' }}/>
            <div style={{ fontFamily:t.serif, fontSize:20, color:t.text, marginBottom:4 }}>Log activity</div>

            {/* Type picker */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:7, marginBottom:14 }}>
              {ACTIVITY_TYPES.map(a => {
                const isActive = addType === a.id;
                return (
                  <button key={a.id} onClick={() => setAddType(a.id)} style={{
                    padding:'10px 4px 8px', borderRadius:11,
                    background: isActive ? a.color+'18' : t.surface2,
                    border:`1.5px solid ${isActive ? a.color : t.border}`,
                    cursor:'pointer', fontFamily:t.sans,
                    display:'flex', flexDirection:'column', alignItems:'center', gap:4
                  }}>
                    <span style={{ fontSize:20 }}>{a.emoji}</span>
                    <span style={{ fontSize:10, color: isActive ? a.color : t.text2, fontWeight: isActive ? 600 : 400 }}>
                      {a.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Gym recommendation callout */}
            {addType === 'gym' && (
              <div style={{
                padding:'10px 12px', borderRadius:10, marginBottom:12,
                background:t.accent+'12', border:`1px solid ${t.accent}30`
              }}>
                <div style={{ fontSize:10.5, color:t.accent, fontWeight:600, marginBottom:2 }}>
                  Suggested session
                </div>
                <div style={{ fontSize:13, color:t.text }}>{recommendation.name}</div>
                <div style={{ fontSize:10.5, color:t.text2 }}>{recommendation.muscles}</div>
              </div>
            )}

            {/* Duration + time */}
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:t.text3, marginBottom:4 }}>Duration (min)</div>
                <input
                  value={duration}
                  type="number"
                  onChange={(e) => setDuration(e.target.value)}
                  style={{
                    width:'100%', padding:'9px 12px', borderRadius:9,
                    border:`1px solid ${t.border}`, background:t.surface2,
                    fontFamily:t.mono, fontSize:13, color:t.text, outline:'none'
                  }}
                />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:t.text3, marginBottom:4 }}>Time</div>
                <input
                  value={time}
                  type="time"
                  onChange={(e) => setTime(e.target.value)}
                  style={{
                    width:'100%', padding:'9px 12px', borderRadius:9,
                    border:`1px solid ${t.border}`, background:t.surface2,
                    fontFamily:t.sans, fontSize:13, color:t.text, outline:'none'
                  }}
                />
              </div>
            </div>

            <button
              onClick={addActivity}
              disabled={!addType}
              style={{
                width:'100%', padding:'13px', borderRadius:12,
                background: addType ? t.accent : t.surface2,
                color: addType ? t.accentText : t.text3,
                border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor: addType ? 'pointer' : 'default'
              }}>
              Log activity
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteModal && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.4)',
          display:'flex', alignItems:'flex-end', zIndex:60
        }} onClick={() => setDeleteModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width:'100%', background:t.surface, borderTopLeftRadius:22, borderTopRightRadius:22,
            padding:'18px 20px 24px'
          }}>
            <div style={{ width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 14px' }}/>
            <div style={{ fontFamily:t.serif, fontSize:20, color:t.text, marginBottom:6 }}>Remove activity?</div>
            <div style={{ fontSize:12, color:t.text2, marginBottom:16, lineHeight:1.5 }}>
              This activity will be removed from {dayName}.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setDeleteModal(null)} style={{
                flex:1, padding:'12px', borderRadius:11, background:'transparent',
                border:`1px solid ${t.border2}`, color:t.text,
                fontFamily:t.sans, fontSize:13, cursor:'pointer'
              }}>Cancel</button>
              <button onClick={() => removeItem(deleteModal)} style={{
                flex:1, padding:'12px', borderRadius:11, background:'#BE3B2E', color:'#fff',
                border:'none', fontFamily:t.sans, fontSize:13, fontWeight:600, cursor:'pointer'
              }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



export {
  EX_LIB, SPLITS, SECTION_META, SECTION_ORDER, WEEK_DAYS, ACTIVITY_TYPES,
  ScreenHeader, GymHubScreen, SplitPickerScreen, SessionEditorScreen,
  DayActivitiesScreen, getGymRecommendation,
};
