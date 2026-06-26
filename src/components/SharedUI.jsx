import React from 'react';
const COACH_NUDGES = [
  {
    tag: "Today's focus",
    title: "Push day — go for 57.5kg bench",
    body: "Your previous session data will appear here once connected. Great day to push hard.",
    cta: "Start session",
    icon: "↗"
  },
  {
    tag: "This week",
    title: "Iron-rich foods, 4× this week",
    body: "Spinach, lentils, red meat — great sources to help hit your iron target this week.",
    cta: "See foods",
    icon: "🥬"
  },
  {
    tag: "Hydration",
    title: "Drink 2.6 L today",
    body: "You averaged 1.9 L last week. Bump it up — your training volume is climbing.",
    cta: "Log water",
    icon: "💧"
  }
];

const RINGS_DATA = [
  { id: "move",  label: "Move",     value: 0,  goal: 600,  unit: "kcal", color: "#E5484D" },
  { id: "prot",  label: "Protein",  value: 0,  goal: 140,  unit: "g",    color: "#F76B15" },
  { id: "water", label: "Water",    value: 0,  goal: 2.6,  unit: "L",    color: "#0090FF" },
  { id: "sleep", label: "Sleep",    value: 0,  goal: 8,    unit: "h",    color: "#8E4EC6" },
];

const TODAY_SESSION = {
  name: "Push",
  focus: "Chest · Shoulders · Triceps",
  exercises: [
    { name: "Bench press",      target: "57.5kg × 8",  pr: true  },
    { name: "Overhead press",   target: "37.5kg × 9",  pr: false },
    { name: "Incline DB press", target: "26kg × 10",   pr: false },
    { name: "Lateral raises",   target: "12kg × 15",   pr: false },
    { name: "Tricep pushdown",  target: "45kg × 12",   pr: false },
    { name: "Skull crushers",   target: "22.5kg × 12", pr: false },
  ]
};

const WEEK_NUDGES = [
  { icon: "🥩", title: "Iron up", body: "Spinach + lentils 4× this week", color: "#BE185D" },
  { icon: "💧", title: "+700 ml water/day", body: "You're under target Mon–Wed", color: "#0090FF" },
  { icon: "💤", title: "Aim for 8h sleep", body: "Avg 7.1h — recovery dips on Thu", color: "#8E4EC6" },
];

const QUICK_LOG = [
  { id: "weight", icon: "⚖", label: "Weight",  value: "—",  unit: "kg",   trend: "" },
  { id: "sleep",  icon: "💤", label: "Sleep",   value: "—",  unit: "h",    trend: "" },
  { id: "mood",   icon: "🙂", label: "Mood",    value: "—",  unit: "",     trend: "" },
  { id: "water",  icon: "💧", label: "Water",   value: "—",  unit: "L",    trend: "" },
];

// ────────────────────────────────────────────────────────────
// AnimatedNumber: ticks from 0 to value over duration ms.
// Initial state is `value` so content is correct even if rAF is stalled
// (e.g. inside a transformed/offscreen design-canvas artboard). On mount we
// reset to 0 and tween; if the tween never ticks, the next render still
// shows the right number.
function AnimatedNumber({ value, duration = 900, decimals = 0, prefix = "", suffix = "", style }) {
  const [n, setN] = React.useState(value);
  React.useEffect(() => {
    let raf, start, cancelled = false;
    setN(0);
    const step = (t) => {
      if (cancelled) return;
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Safety net: if rAF never advances, snap to final after duration+200ms
    const safety = setTimeout(() => setN(value), duration + 250);
    return () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [value, duration]);
  const out = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();
  return <span style={style}>{prefix}{out}{suffix}</span>;
}

// ────────────────────────────────────────────────────────────
// Ring: animated stroke-dasharray ring (CSS-transition driven for robustness)
function Ring({ size = 64, stroke = 7, value, goal, color, track = "#00000010", delay = 0, children }) {
  const target = Math.min(1, value / goal);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [drawn, setDrawn] = React.useState(false);
  React.useEffect(() => {
    const id = setTimeout(() => setDrawn(true), 60 + delay);
    return () => clearTimeout(id);
  }, [delay]);
  const offset = c * (1 - (drawn ? target : 0));

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke}
          fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)' }}/>
      </svg>
      {children && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Concentric rings (Apple Watch style)
function StackedRings({ size = 160, stroke = 14, rings, gap = 4 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {rings.map((r, i) => {
        const ringSize = size - i * (stroke * 2 + gap);
        return (
          <div key={r.id} style={{ position:'absolute', top:i*(stroke+gap/2), left:i*(stroke+gap/2) }}>
            <Ring size={ringSize} stroke={stroke} value={r.value} goal={r.goal}
                  color={r.color} track={r.color + "20"} delay={i*120} />
          </div>
        );
      })}
    </div>
  );
}

// Animated horizontal bar fill
function Bar({ value, goal, color, height = 6, track = "#00000010", delay = 0, radius = 999 }) {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    const target = Math.min(100, (value / goal) * 100);
    const t = setTimeout(() => setW(target), 50 + delay);
    return () => clearTimeout(t);
  }, [value, goal, delay]);
  return (
    <div style={{ height, background: track, borderRadius: radius, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: w + '%', background: color, borderRadius: radius,
        transition: 'width 1.1s cubic-bezier(.2,.7,.2,1)'
      }}/>
    </div>
  );
}

// Tiny live "now" pulse dot
function PulseDot({ color = "#16A34A", size = 7 }) {
  return (
    <span style={{ position:'relative', display:'inline-flex', width:size, height:size }}>
      <span style={{
        position:'absolute', inset:0, borderRadius:'50%', background:color, opacity:.35,
        animation: 'om-pulse 1.6s ease-out infinite'
      }}/>
      <span style={{ position:'absolute', inset:1, borderRadius:'50%', background:color }}/>
    </span>
  );
}

// Bottom nav (shared visual chrome)
function BottomNav({ theme = 'light', active = 'home', onNav, tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false }) {
  const isDark = theme === 'dark';
  const dim = isDark ? '#6B6560' : '#A8A39C';
  const activeColor = isDark ? '#fff' : '#1C1917';
  const bg = isDark ? '#0E0E10' : '#FFFFFF';
  const border = isDark ? '#1F1F22' : '#EAE7E0';
  const allItems = [
    { id:'weekly',  label:'Weekly',   d:'M3 9 h18 M3 15 h18 M8 3 v18 M16 3 v18' },
    { id:'gym',        label:'Session',  d:'M4 9 L4 15 M8 7 L8 17 M16 7 L16 17 M20 9 L20 15 M8 12 L16 12' },
    { id:'food',       label:'Food',     d:'M5 4 V20 M19 4 V12 H17 V4 M5 12 H9 V20' },
    { id:'about-me',   label:'Profile',  d:'M12 4 a4 4 0 1 0 0 8 a4 4 0 1 0 0-8 M4 20 v-1 a8 8 0 0 1 16 0 v1' },
    { id:'cycle',      label:'Cycle',    d:'M12 2 a10 10 0 1 0 0 20 a10 10 0 1 0 0 -20 M12 8 V12 L15 15' },
  ];
  const items = allItems.filter(it => {
    if (it.id === 'cycle') return tracksCycle;
    return true;
  });
  return (
    <div style={{
      display:'flex', borderTop:`1px solid ${border}`, background:bg,
      padding:'8px 0 10px', flexShrink:0
    }}>
      {items.map(it => {
        const isActive = it.id === active;
        return (
          <button key={it.id}
            onClick={() => onNav && onNav(it.id)}
            style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              color: isActive ? activeColor : dim, fontSize:9.5, letterSpacing:'.05em',
              background:'transparent', border:'none', cursor:'pointer',
              fontFamily:'inherit', padding:'4px 0'
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={isActive ? "2" : "1.7"}
                 strokeLinecap="round" strokeLinejoin="round">
              <path d={it.d}/>
            </svg>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// Sparkline (mini line chart in SVG)
function Sparkline({ data, color = "#16A34A", width = 60, height = 22, strokeWidth = 1.5 }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display:'block', overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={width} cy={height - ((data[data.length-1] - min) / range) * (height - 4) - 2}
              r="2" fill={color}/>
    </svg>
  );
}

// Inject keyframes once
(function injectKeyframes() {
  if (document.getElementById('om-keyframes')) return;
  const s = document.createElement('style');
  s.id = 'om-keyframes';
  s.textContent = `
    @keyframes om-pulse { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2.6);opacity:0} }
    @keyframes om-fade-up { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
    @keyframes om-shimmer {
      0% { background-position: -200% 0 }
      100% { background-position: 200% 0 }
    }
  `;
  document.head.appendChild(s);
})();

// Banner shown when the deep questionnaire hasn't been completed.
// `hasDraft` = user has started but not finished (shows "Continue" vs "Fill in").
function DraftPlanBanner({ theme = 'light', onAction, hasDraft = false }) {
  const isDark = theme === 'dark';
  const bg       = isDark ? '#2A1F0E' : '#FFF7ED';
  const border   = isDark ? '#7C4A1E55' : '#F59E0B44';
  const iconBg   = isDark ? '#7C4A1E44' : '#FEF3C7';
  const text     = isDark ? '#FCD34D' : '#92400E';
  const text2    = isDark ? '#FCA25A' : '#B45309';
  const btnBg    = isDark ? '#F59E0B22' : '#F59E0B18';
  const btnBorder= isDark ? '#F59E0B55' : '#F59E0B44';

  return (
    <div style={{
      margin: '0 16px 8px',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, flexShrink: 0,
      }}>📋</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: text, lineHeight: 1.35, marginBottom: 5 }}>
          Your plan is based on limited info — fill in the full questionnaire for a more accurate training plan.
        </div>
        <button
          onClick={onAction}
          style={{
            padding: '5px 10px', borderRadius: 7,
            background: btnBg, border: `1px solid ${btnBorder}`,
            color: text2, fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {hasDraft ? 'Continue questionnaire →' : 'Fill in questionnaire →'}
        </button>
      </div>
    </div>
  );
}

export { AnimatedNumber, StackedRings, PulseDot, BottomNav, DraftPlanBanner };
