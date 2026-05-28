// ─────────────────────────────────────────────────────────────────────────────
// shared.jsx
//
// PURPOSE: Two things in one file:
//   1. Demo data — hardcoded stand-ins for what would come from Google Drive
//      or a real API in production. Change these to change what the app shows.
//   2. Reusable UI primitives — small components used across every screen.
//      Exported to window.* so other .jsx files can reference them without
//      ES module imports (the global scope acts as the module system here).
//
// EXPORTS (via Object.assign(window, {...}) at the bottom):
//   Data:       COACH_NUDGES, RINGS_DATA, TODAY_SESSION, WEEK_NUDGES, QUICK_LOG
//   Components: AnimatedNumber, Ring, StackedRings, Bar, PulseDot, BottomNav, Sparkline
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DEMO DATA
// These constants are the fake "server responses" for the prototype.
// In production these would be fetched from Google Drive (forma-data.json)
// or derived from connected services (Strava, Oura, Apple Health, etc.)
// ─────────────────────────────────────────────────────────────────────────────

// [DATA] Three rotating coaching cards shown on the Home screen's "Today's focus" card.
// Each card has a tag (category label), title, body copy, CTA button text, and icon.
// The home screen cycles through these via focusIdx state.
const COACH_NUDGES = [
  {
    tag: "Today's focus",
    title: "Push day — go for 57.5kg bench",
    body: "You hit 55×10 last week. You're in your follicular peak; today's the day to break through.",
    cta: "Start session",
    icon: "↗"
  },
  {
    tag: "This week",
    title: "Iron-rich foods, 4× this week",
    body: "Spinach, lentils, red meat. You're 6 days post-period — replenish stores while oestrogen is rising.",
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

// [DATA] Today's ring values and goals.
// Each entry drives one ring in the StackedRings component on the Home screen.
// value = today's logged amount, goal = daily target.
const RINGS_DATA = [
  { id: "move",  label: "Move",     value: 412,  goal: 600,  unit: "kcal", color: "#E5484D" },
  { id: "prot",  label: "Protein",  value: 112,  goal: 140,  unit: "g",    color: "#F76B15" },
  { id: "water", label: "Water",    value: 1.8,  goal: 2.6,  unit: "L",    color: "#0090FF" },
  { id: "sleep", label: "Sleep",    value: 7.2,  goal: 8,    unit: "h",    color: "#8E4EC6" },
];

// [DATA] Today's planned workout — shown in the "Up next" card on the Home screen
// and seeded into the Gym session screen.
// exercises: each has name, target (weight × reps), and a pr flag for PR windows.
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

// [DATA] Weekly health nudges shown in a row on the Home screen.
const WEEK_NUDGES = [
  { icon: "🥩", title: "Iron up", body: "Spinach + lentils 4× this week", color: "#BE185D" },
  { icon: "💧", title: "+700 ml water/day", body: "You're under target Mon–Wed", color: "#0090FF" },
  { icon: "💤", title: "Aim for 8h sleep", body: "Avg 7.1h — recovery dips on Thu", color: "#8E4EC6" },
];

// [DATA] Quick-log row data — the four metric tiles at the bottom of the Home screen.
// In production, value and trend would come from stored user data.
const QUICK_LOG = [
  { id: "weight", icon: "⚖", label: "Weight",  value: "64.2",  unit: "kg",   trend: "−0.3" },
  { id: "sleep",  icon: "💤", label: "Sleep",   value: "7.2",   unit: "h",    trend: "+0.4" },
  { id: "mood",   icon: "🙂", label: "Mood",    value: "Good",  unit: "",     trend: "" },
  { id: "water",  icon: "💧", label: "Water",   value: "1.8",   unit: "L",    trend: "" },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: REUSABLE UI PRIMITIVES
// Small stateless-ish components that every screen file imports from window.*.
// Each is documented inline below.
// ─────────────────────────────────────────────────────────────────────────────

// [COMPONENT] AnimatedNumber
// Counts from 0 to `value` over `duration` ms using requestAnimationFrame.
// Uses an ease-out cubic curve so the count decelerates into the final number.
// Safety net: if rAF never fires (e.g. inside a design canvas transform), snaps
// to the final value after duration+250ms so the number is never stuck at 0.
// Props: value, duration (ms), decimals, prefix, suffix, style
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
    const safety = setTimeout(() => setN(value), duration + 250);
    return () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [value, duration]);
  const out = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();
  return <span style={style}>{prefix}{out}{suffix}</span>;
}

// [COMPONENT] Ring
// A single animated SVG progress ring.
// Animates stroke-dashoffset via CSS transition: the ring "fills in" from 0
// to (value / goal) of the circle circumference.
// Used standalone and via StackedRings.
// Props: size, stroke (width), value, goal, color, track (background ring color),
//        delay (ms, staggers animation in stacked sets), children (rendered in centre)
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
        {/* Background (track) ring — always full circle */}
        <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none"/>
        {/* Foreground ring — animates from empty to target fill via stroke-dashoffset */}
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke}
          fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)' }}/>
      </svg>
      {/* Centre content (optional — used for icon or text inside the ring) */}
      {children && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// [COMPONENT] StackedRings
// Renders multiple Ring components concentrically — Apple Watch activity rings style.
// Each ring is positioned slightly inward from the last using absolute positioning.
// The `gap` prop controls spacing between ring tracks.
// Props: size (outer ring diameter), stroke, rings (array of ring data objects), gap
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

// [COMPONENT] Bar
// Animated horizontal progress bar using CSS width transition.
// Transitions from 0% to (value / goal * 100)% after a short delay.
// Props: value, goal, color, height (px), track (background color), delay (ms), radius
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

// [COMPONENT] PulseDot
// A small pulsing dot used to indicate live or active states (e.g. in-session badge).
// Uses a CSS @keyframes animation (injected once via injectKeyframes below).
// The outer span pulses/fades outward; the inner span is the solid dot.
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

// [COMPONENT] BottomNav
// The shared four-tab navigation bar at the bottom of every screen.
// Active tab is highlighted; inactive tabs are dimmed.
// The Cycle tab is conditionally hidden when tracksCycle is false
// (set during onboarding based on the user's preference).
// Props: theme, active (tab id string), onNav (callback), tracksCycle (bool)
function BottomNav({ theme = 'light', active = 'home', onNav, tracksCycle = true }) {
  const isDark = theme === 'dark';
  const dim = isDark ? '#6B6560' : '#A8A39C';
  const activeColor = isDark ? '#fff' : '#1C1917';
  const bg = isDark ? '#0E0E10' : '#FFFFFF';
  const border = isDark ? '#1F1F22' : '#EAE7E0';
  const allItems = [
    { id:'home',  label:'Home',  d:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22 V12 H15 V22' },
    { id:'gym',   label:'Gym',   d:'M4 9 L4 15 M8 7 L8 17 M16 7 L16 17 M20 9 L20 15 M8 12 L16 12' },
    { id:'food',  label:'Food',  d:'M5 4 V20 M19 4 V12 H17 V4 M5 12 H9 V20' },
    { id:'cycle', label:'Cycle', d:'M12 2 a10 10 0 1 0 0 20 a10 10 0 1 0 0 -20 M12 8 V12 L15 15' },
  ];
  // [LOGIC] Hide the Cycle tab entirely if the user opted out during onboarding.
  // This affects navigation but not the underlying data model.
  const items = allItems.filter(it => it.id !== 'cycle' || tracksCycle);
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

// [COMPONENT] Sparkline
// A minimal inline line chart rendered as an SVG polyline.
// Scales data points to fit the given width/height, with a dot on the last point.
// Used in the Home screen's sessions card to show the 8-week training trend.
// Props: data (number[]), color, width, height, strokeWidth
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

// ─────────────────────────────────────────────────────────────────────────────
// CSS KEYFRAMES INJECTION
// Injects animation keyframes into the document <head> once.
// Done here (rather than in a .css file) so this file is self-contained.
// om-pulse: the PulseDot expand-and-fade animation
// om-fade-up: used for card entrance animations
// om-shimmer: loading skeleton shimmer (not currently used but available)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// All constants and components are attached to window.* so that other script
// files loaded after this one can reference them directly.
// This replaces ES module imports/exports — the global scope is the module system.
// In a production build (e.g. Vite), these would be standard export statements.
// ─────────────────────────────────────────────────────────────────────────────
Object.assign(window, {
  COACH_NUDGES, RINGS_DATA, TODAY_SESSION, WEEK_NUDGES, QUICK_LOG,
  AnimatedNumber, Ring, StackedRings, Bar, PulseDot, BottomNav, Sparkline
});
