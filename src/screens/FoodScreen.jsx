import React from 'react';
import themes from '../data/themes';
import { BottomNav } from '../components/SharedUI';
import { SPLITS } from './GymPlanScreens';
function foodGetWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function foodDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function foodAddDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function foodDow(date) { const d = date.getDay(); return d === 0 ? 6 : d - 1; } // 0=Mon

const FOOD_DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ─── Meal definitions ─────────────────────────────────────────────────────────
const MEALS = [
  { id: 'breakfast', label: 'Breakfast', emoji: '🌅', color: '#B45309' },
  { id: 'lunch',     label: 'Lunch',     emoji: '☀️',  color: '#0369A1' },
  { id: 'dinner',    label: 'Dinner',    emoji: '🌙',  color: '#6D4AAF' },
  { id: 'snacks',    label: 'Snacks',    emoji: '🍎',  color: '#15803D' },
];

// ─── Food database (per-100g macros) ─────────────────────────────────────────
// Each entry: { id, name, category, cal, p (protein), c (carbs), f (fat) }
// Values are per 100g. defaultGrams is the suggested starting portion.
const FOOD_DB = [
  // ── Protein sources ──────────────────────────────────────────────────────────
  { id:'chicken_breast', name:'Chicken breast',      cat:'Protein', cal:165, p:31,  c:0,   f:3.6, defaultG:150 },
  { id:'salmon',         name:'Salmon fillet',        cat:'Protein', cal:208, p:20,  c:0,   f:13,  defaultG:150 },
  { id:'tuna_tin',       name:'Tuna (tinned)',         cat:'Protein', cal:116, p:26,  c:0,   f:1,   defaultG:120 },
  { id:'eggs',           name:'Eggs (whole)',          cat:'Protein', cal:155, p:13,  c:1.1, f:11,  defaultG:120 },
  { id:'egg_whites',     name:'Egg whites',            cat:'Protein', cal:52,  p:11,  c:0.7, f:0.2, defaultG:100 },
  { id:'beef_mince',     name:'Beef mince (5% fat)',   cat:'Protein', cal:137, p:21,  c:0,   f:5,   defaultG:150 },
  { id:'beef_steak',     name:'Beef steak (sirloin)',  cat:'Protein', cal:207, p:26,  c:0,   f:11,  defaultG:200 },
  { id:'turkey',         name:'Turkey breast',         cat:'Protein', cal:157, p:30,  c:0,   f:3,   defaultG:150 },
  { id:'cod',            name:'Cod fillet',            cat:'Protein', cal:82,  p:18,  c:0,   f:0.7, defaultG:180 },
  { id:'shrimp',         name:'Shrimp / prawns',       cat:'Protein', cal:85,  p:18,  c:0.9, f:0.9, defaultG:120 },
  { id:'pork_loin',      name:'Pork tenderloin',       cat:'Protein', cal:143, p:26,  c:0,   f:3.5, defaultG:150 },
  { id:'ham_deli',       name:'Ham (deli sliced)',      cat:'Protein', cal:107, p:17,  c:1.5, f:3.5, defaultG:80  },
  { id:'mackerel',       name:'Mackerel fillet',       cat:'Protein', cal:205, p:19,  c:0,   f:14,  defaultG:130 },
  { id:'sardines',       name:'Sardines (tinned)',      cat:'Protein', cal:208, p:25,  c:0,   f:11,  defaultG:90  },
  // ── Dairy ────────────────────────────────────────────────────────────────────
  { id:'greek_yoghurt',  name:'Greek yoghurt (0%)',    cat:'Dairy',   cal:59,  p:10,  c:3.6, f:0.4, defaultG:170 },
  { id:'yoghurt_full',   name:'Natural yoghurt',       cat:'Dairy',   cal:61,  p:3.5, c:4.7, f:3.3, defaultG:150 },
  { id:'cottage_cheese', name:'Cottage cheese',        cat:'Dairy',   cal:98,  p:11,  c:3.4, f:4.3, defaultG:150 },
  { id:'cream_cheese',   name:'Cream cheese',          cat:'Dairy',   cal:342, p:5.9, c:4.1, f:34,  defaultG:30  },
  { id:'milk_whole',     name:'Whole milk',            cat:'Dairy',   cal:61,  p:3.2, c:4.8, f:3.3, defaultG:200 },
  { id:'milk_semi',      name:'Semi-skimmed milk',     cat:'Dairy',   cal:46,  p:3.4, c:4.8, f:1.6, defaultG:200 },
  { id:'milk_skim',      name:'Skimmed milk',          cat:'Dairy',   cal:34,  p:3.4, c:5,   f:0.2, defaultG:200 },
  { id:'cheddar',        name:'Cheddar cheese',        cat:'Dairy',   cal:403, p:25,  c:1.3, f:33,  defaultG:30  },
  { id:'mozzarella',     name:'Mozzarella',            cat:'Dairy',   cal:280, p:17,  c:2.2, f:22,  defaultG:50  },
  { id:'parmesan',       name:'Parmesan',              cat:'Dairy',   cal:431, p:38,  c:4.1, f:29,  defaultG:20  },
  { id:'butter',         name:'Butter',                cat:'Dairy',   cal:717, p:0.9, c:0.1, f:81,  defaultG:10  },
  { id:'sour_cream',     name:'Sour cream',            cat:'Dairy',   cal:193, p:2.4, c:4.6, f:19,  defaultG:30  },
  // ── Grains / carbs ───────────────────────────────────────────────────────────
  { id:'oats',           name:'Oats (dry)',            cat:'Grains',  cal:389, p:17,  c:66,  f:7,   defaultG:80  },
  { id:'granola',        name:'Granola',               cat:'Grains',  cal:471, p:10,  c:64,  f:19,  defaultG:60  },
  { id:'rice_white',     name:'White rice (cooked)',   cat:'Grains',  cal:130, p:2.7, c:28,  f:0.3, defaultG:200 },
  { id:'rice_brown',     name:'Brown rice (cooked)',   cat:'Grains',  cal:112, p:2.6, c:24,  f:0.9, defaultG:200 },
  { id:'pasta',          name:'Pasta (cooked)',        cat:'Grains',  cal:131, p:5,   c:25,  f:1.1, defaultG:200 },
  { id:'bread_white',    name:'White bread',           cat:'Grains',  cal:265, p:9,   c:49,  f:3.2, defaultG:60  },
  { id:'bread_wb',       name:'Wholegrain bread',      cat:'Grains',  cal:247, p:10,  c:41,  f:4.2, defaultG:60  },
  { id:'bagel',          name:'Bagel (plain)',         cat:'Grains',  cal:270, p:11,  c:53,  f:1.7, defaultG:105 },
  { id:'pitta',          name:'Pitta bread',           cat:'Grains',  cal:262, p:9.1, c:53,  f:1.3, defaultG:60  },
  { id:'wrap',           name:'Tortilla wrap',         cat:'Grains',  cal:303, p:7.5, c:49,  f:7.2, defaultG:50  },
  { id:'sweet_potato',   name:'Sweet potato',          cat:'Grains',  cal:86,  p:1.6, c:20,  f:0.1, defaultG:200 },
  { id:'potato',         name:'Potato (boiled)',       cat:'Grains',  cal:77,  p:1.8, c:17,  f:0.1, defaultG:200 },
  { id:'quinoa',         name:'Quinoa (cooked)',       cat:'Grains',  cal:120, p:4.4, c:21,  f:1.9, defaultG:185 },
  { id:'couscous',       name:'Couscous (cooked)',     cat:'Grains',  cal:112, p:3.8, c:23,  f:0.2, defaultG:180 },
  // ── Vegetables ───────────────────────────────────────────────────────────────
  { id:'broccoli',       name:'Broccoli',              cat:'Veg',     cal:34,  p:2.8, c:6.6, f:0.4, defaultG:200 },
  { id:'spinach',        name:'Spinach',               cat:'Veg',     cal:23,  p:2.9, c:3.6, f:0.4, defaultG:100 },
  { id:'tomato',         name:'Tomatoes',              cat:'Veg',     cal:18,  p:0.9, c:3.9, f:0.2, defaultG:150 },
  { id:'cucumber',       name:'Cucumber',              cat:'Veg',     cal:15,  p:0.6, c:3.6, f:0.1, defaultG:150 },
  { id:'mixed_salad',    name:'Mixed salad leaves',    cat:'Veg',     cal:15,  p:1.2, c:2.2, f:0.3, defaultG:100 },
  { id:'avocado',        name:'Avocado',               cat:'Veg',     cal:160, p:2,   c:9,   f:15,  defaultG:80  },
  { id:'carrots',        name:'Carrots',               cat:'Veg',     cal:41,  p:0.9, c:10,  f:0.2, defaultG:150 },
  { id:'bell_pepper',    name:'Bell pepper',           cat:'Veg',     cal:31,  p:1,   c:6,   f:0.3, defaultG:150 },
  { id:'onion',          name:'Onion',                 cat:'Veg',     cal:40,  p:1.1, c:9.3, f:0.1, defaultG:80  },
  { id:'corn',           name:'Sweetcorn (tinned)',    cat:'Veg',     cal:86,  p:3.2, c:17,  f:1.3, defaultG:100 },
  { id:'edamame',        name:'Edamame (shelled)',     cat:'Veg',     cal:121, p:11,  c:8.9, f:5.2, defaultG:100 },
  { id:'mushrooms',      name:'Mushrooms',             cat:'Veg',     cal:22,  p:3.1, c:3.3, f:0.3, defaultG:100 },
  { id:'courgette',      name:'Courgette / zucchini',  cat:'Veg',     cal:17,  p:1.2, c:3.1, f:0.3, defaultG:150 },
  // ── Legumes ───────────────────────────────────────────────────────────────────
  { id:'lentils',        name:'Lentils (cooked)',      cat:'Legumes', cal:116, p:9,   c:20,  f:0.4, defaultG:150 },
  { id:'chickpeas',      name:'Chickpeas (tinned)',    cat:'Legumes', cal:139, p:7.3, c:22,  f:2.6, defaultG:150 },
  { id:'black_beans',    name:'Black beans (tinned)',  cat:'Legumes', cal:132, p:8.9, c:24,  f:0.5, defaultG:150 },
  { id:'kidney_beans',   name:'Kidney beans (tinned)', cat:'Legumes', cal:127, p:8.7, c:22,  f:0.5, defaultG:150 },
  // ── Fruits ───────────────────────────────────────────────────────────────────
  { id:'banana',         name:'Banana',               cat:'Fruit',   cal:89,  p:1.1, c:23,  f:0.3, defaultG:120 },
  { id:'apple',          name:'Apple',                cat:'Fruit',   cal:52,  p:0.3, c:14,  f:0.2, defaultG:180 },
  { id:'blueberries',    name:'Blueberries',          cat:'Fruit',   cal:57,  p:0.7, c:14,  f:0.3, defaultG:100 },
  { id:'strawberries',   name:'Strawberries',         cat:'Fruit',   cal:32,  p:0.7, c:7.7, f:0.3, defaultG:150 },
  { id:'orange',         name:'Orange',               cat:'Fruit',   cal:47,  p:0.9, c:12,  f:0.1, defaultG:150 },
  { id:'mango',          name:'Mango',                cat:'Fruit',   cal:60,  p:0.8, c:15,  f:0.4, defaultG:150 },
  { id:'grapes',         name:'Grapes',               cat:'Fruit',   cal:69,  p:0.7, c:18,  f:0.2, defaultG:120 },
  { id:'kiwi',           name:'Kiwi',                 cat:'Fruit',   cal:61,  p:1.1, c:15,  f:0.5, defaultG:80  },
  { id:'pineapple',      name:'Pineapple',            cat:'Fruit',   cal:50,  p:0.5, c:13,  f:0.1, defaultG:150 },
  { id:'watermelon',     name:'Watermelon',           cat:'Fruit',   cal:30,  p:0.6, c:7.6, f:0.2, defaultG:200 },
  // ── Snacks / fats ────────────────────────────────────────────────────────────
  { id:'almonds',        name:'Almonds',              cat:'Snacks',  cal:579, p:21,  c:22,  f:50,  defaultG:30  },
  { id:'cashews',        name:'Cashews',              cat:'Snacks',  cal:553, p:18,  c:33,  f:44,  defaultG:30  },
  { id:'walnuts',        name:'Walnuts',              cat:'Snacks',  cal:654, p:15,  c:14,  f:65,  defaultG:30  },
  { id:'mixed_nuts',     name:'Mixed nuts',           cat:'Snacks',  cal:607, p:18,  c:21,  f:54,  defaultG:30  },
  { id:'peanuts',        name:'Peanuts',              cat:'Snacks',  cal:567, p:26,  c:16,  f:49,  defaultG:30  },
  { id:'peanut_butter',  name:'Peanut butter',        cat:'Snacks',  cal:588, p:25,  c:20,  f:50,  defaultG:30  },
  { id:'almond_butter',  name:'Almond butter',        cat:'Snacks',  cal:614, p:21,  c:19,  f:56,  defaultG:30  },
  { id:'dark_choc',      name:'Dark chocolate 85%',   cat:'Snacks',  cal:598, p:8,   c:22,  f:43,  defaultG:25  },
  { id:'rice_cake',      name:'Rice cakes',           cat:'Snacks',  cal:387, p:7.5, c:81,  f:2.9, defaultG:30  },
  { id:'popcorn',        name:'Popcorn (plain)',       cat:'Snacks',  cal:387, p:13,  c:78,  f:4.5, defaultG:25  },
  { id:'hummus',         name:'Hummus',               cat:'Snacks',  cal:166, p:7.9, c:14,  f:9.6, defaultG:80  },
  { id:'protein_bar',    name:'Protein bar (generic)', cat:'Snacks', cal:350, p:20,  c:38,  f:9,   defaultG:55  },
  { id:'olive_oil',      name:'Olive oil',            cat:'Snacks',  cal:884, p:0,   c:0,   f:100, defaultG:10  },
  // ── Drinks ───────────────────────────────────────────────────────────────────
  { id:'protein_shake',  name:'Protein shake (whey)', cat:'Drinks',  cal:121, p:24,  c:3,   f:1.5, defaultG:35  },
  { id:'oat_milk',       name:'Oat milk',             cat:'Drinks',  cal:45,  p:1,   c:6.5, f:1.5, defaultG:250 },
  { id:'almond_milk',    name:'Almond milk (unsweet)', cat:'Drinks', cal:15,  p:0.6, c:0.5, f:1.2, defaultG:250 },
  { id:'coffee_black',   name:'Black coffee',         cat:'Drinks',  cal:2,   p:0.3, c:0,   f:0,   defaultG:240 },
  { id:'orange_juice',   name:'Orange juice',         cat:'Drinks',  cal:45,  p:0.7, c:10,  f:0.2, defaultG:200 },
  { id:'green_tea',      name:'Green tea',            cat:'Drinks',  cal:1,   p:0,   c:0.2, f:0,   defaultG:240 },
  { id:'coconut_water',  name:'Coconut water',        cat:'Drinks',  cal:19,  p:0.7, c:3.7, f:0.2, defaultG:250 },
];

// ─── Macro ring component ──────────────────────────────────────────────────────
function MacroRing({ size = 110, strokeW = 10, consumed, target, color, label, theme }) {
  const t = themes[theme];
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;
  const r = (size - strokeW) / 2;
  const c = 2 * Math.PI * r;
  const [drawn, setDrawn] = React.useState(false);
  React.useEffect(() => { const id = setTimeout(() => setDrawn(true), 100); return () => clearTimeout(id); }, []);
  const offset = c * (1 - (drawn ? pct : 0));
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
      <div style={{ position:'relative', width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} stroke={color+'25'} strokeWidth={strokeW} fill="none"/>
          <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={strokeW}
            fill="none" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset}
            style={{ transition:'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)' }}/>
        </svg>
        <div style={{
          position:'absolute', inset:0, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center'
        }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:t.text, lineHeight:1 }}>
            {consumed}
          </div>
          <div style={{ fontSize:9.5, color:t.text3, letterSpacing:'.04em' }}>/{target}</div>
        </div>
      </div>
      <div style={{ fontSize:10, color:color, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

// ─── Macro bar component ───────────────────────────────────────────────────────
function MacroBar({ consumed, target, color, label, unit = 'g', theme }) {
  const t = themes[theme];
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  const [w, setW] = React.useState(0);
  React.useEffect(() => { const id = setTimeout(() => setW(pct), 80); return () => clearTimeout(id); }, [pct]);
  return (
    <div style={{ flex:1 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:10, color:t.text2, fontWeight:500 }}>{label}</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:t.text3 }}>
          {consumed}<span style={{ color:t.text3 }}>/{target}{unit}</span>
        </span>
      </div>
      <div style={{ height:5, background:color+'20', borderRadius:999, overflow:'hidden' }}>
        <div style={{
          height:'100%', width:w+'%', background:color, borderRadius:999,
          transition:'width 1s cubic-bezier(.2,.7,.2,1)'
        }}/>
      </div>
    </div>
  );
}

// ─── Main FoodScreen ──────────────────────────────────────────────────────────
function FoodScreen({
  width = 390, height = 820, theme = 'light',
  foodLog = {}, userSettings = {}, plan = {}, activities = {},
  completedSessions = [],
  onUpdateFood,
  onNav, tracksCycle = true,
}) {
  const t = themes[theme];
  const base        = userSettings.dailyCaloriesBase || 1500;
  const gymBoost    = userSettings.gymDayBoost || 250;

  // Current viewing date (defaults to today, arrows navigate)
  const [viewDate, setViewDate]   = React.useState(new Date());
  const [addMeal,  setAddMeal]    = React.useState(null);   // meal id that the sheet is open for
  const [search,   setSearch]     = React.useState('');
  const [selected, setSelected]   = React.useState(null);   // food from DB being added
  const [grams,    setGrams]      = React.useState('');
  const [customName, setCustomName] = React.useState('');
  const [customCal,  setCustomCal]  = React.useState('');
  const [customProt, setCustomProt] = React.useState('');
  const [customCarb, setCustomCarb] = React.useState('');
  const [customFat,  setCustomFat]  = React.useState('');
  const [showCustom, setShowCustom] = React.useState(false);
  const [showWeekly, setShowWeekly] = React.useState(false);

  const today    = new Date();
  const vKey     = foodDateKey(viewDate);
  const isToday  = vKey === foodDateKey(today);
  const entries  = foodLog[vKey]?.entries || [];

  // Day target — fixed (no gym day adjustments)
  const vDow     = foodDow(viewDate);
  const split    = SPLITS && plan.splitDays ? SPLITS[plan.splitDays] : null;
  const isGymDay = split && split.schedule[vDow] !== '—';
  const completedGymThisDay = completedSessions.some(s => foodDateKey(new Date(s.date)) === vKey);
  const hasActivity = (activities[vDow] || []).some(a => a.duration >= 30);
  const dayTarget = base; // fixed — no gym day adjustments

  // Detect if today had a heavy compound session (for info banner)
  const todayCompletedSession = completedSessions.find(s => foodDateKey(new Date(s.date)) === vKey);
  const isHeavyCompoundDay = todayCompletedSession && split && (() => {
    const sched = plan.scheduleOverride || (split ? split.schedule : []);
    const slot = sched[vDow];
    if (!slot || slot === '—') return false;
    const day = split.days.find(d => d.id === slot);
    return day && day.compound && day.compound.length >= 2;
  })();

  // Macro targets — derived from calorie target (30% protein, 40% carbs, 30% fat)
  const protTarget = Math.round(dayTarget * 0.30 / 4);
  const carbTarget = Math.round(dayTarget * 0.40 / 4);
  const fatTarget  = Math.round(dayTarget * 0.30 / 9);

  // Today's totals
  const totCal  = entries.reduce((s, e) => s + (e.calories || 0), 0);
  const totProt = entries.reduce((s, e) => s + (e.protein  || 0), 0);
  const totCarb = entries.reduce((s, e) => s + (e.carbs    || 0), 0);
  const totFat  = entries.reduce((s, e) => s + (e.fat      || 0), 0);

  const calPct = dayTarget > 0 ? Math.min(1, totCal / dayTarget) : 0;
  let ringColor = '#15803D';
  if (calPct > 1.15)      ringColor = '#BE3B2E';
  else if (calPct > 1.05) ringColor = '#B45309';

  // Weekly data for overview
  const weekStart = foodGetWeekStart(today);
  const weekDays  = Array.from({length:7}, (_,i) => {
    const d   = foodAddDays(weekStart, i);
    const tgt = base; // fixed — no gym day adjustments
    const k   = foodDateKey(d);
    const con = (foodLog[k]?.entries || []).reduce((s,e) => s + (e.calories||0), 0);
    return { d, key:k, label:FOOD_DAY_LABELS[i], target:tgt, consumed:con,
             isToday: k === foodDateKey(today), isFuture: d > today };
  });

  // Food DB search
  const filteredDB = React.useMemo(() => {
    if (!search.trim()) return FOOD_DB.slice(0, 16);
    const q = search.toLowerCase();
    return FOOD_DB.filter(f => f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q));
  }, [search]);

  // Calculate nutrition for currently entered grams
  const calcNutrition = (food, g) => {
    const mult = Number(g) / 100;
    return {
      calories: Math.round(food.cal * mult),
      protein:  Math.round(food.p   * mult * 10) / 10,
      carbs:    Math.round(food.c   * mult * 10) / 10,
      fat:      Math.round(food.f   * mult * 10) / 10,
    };
  };

  const confirmAdd = () => {
    if (!selected || !grams) return;
    const n = calcNutrition(selected, grams);
    const entry = {
      id: Date.now().toString(),
      name: selected.name + ' (' + grams + 'g)',
      meal: addMeal,
      time: new Date().toTimeString().slice(0,5),
      grams: Number(grams),
      ...n
    };
    const updated = [...entries, entry];
    if (onUpdateFood) onUpdateFood(vKey, updated);
    resetSheet();
  };

  const confirmCustom = () => {
    const cal = Number(customCal);
    if (!cal || cal <= 0) return;
    const entry = {
      id: Date.now().toString(),
      name: customName.trim() || 'Custom food',
      meal: addMeal,
      time: new Date().toTimeString().slice(0,5),
      grams: 0,
      calories: cal,
      protein:  Number(customProt) || 0,
      carbs:    Number(customCarb) || 0,
      fat:      Number(customFat)  || 0,
    };
    const updated = [...entries, entry];
    if (onUpdateFood) onUpdateFood(vKey, updated);
    resetSheet();
  };

  const removeEntry = (id) => {
    const updated = entries.filter(e => e.id !== id);
    if (onUpdateFood) onUpdateFood(vKey, updated);
  };

  const resetSheet = () => {
    setAddMeal(null); setSearch(''); setSelected(null); setGrams('');
    setCustomName(''); setCustomCal(''); setCustomProt('');
    setCustomCarb(''); setCustomFat(''); setShowCustom(false);
  };

  const navigateDay = (delta) => {
    setViewDate(d => foodAddDays(d, delta));
  };

  // Touch swipe for date navigation
  const swipeRef = React.useRef(null);
  const onTouchStart = (e) => { swipeRef.current = e.touches[0].clientX; };
  const onTouchEnd   = (e) => {
    if (!swipeRef.current) return;
    const dx = e.changedTouches[0].clientX - swipeRef.current;
    if (dx < -40) navigateDay(1);
    if (dx > 40)  navigateDay(-1);
    swipeRef.current = null;
  };

  const dateLabel = isToday ? 'Today' : viewDate.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' });

  return (
    <div style={{
      width, height, background:t.bg, fontFamily:t.sans, color:t.text,
      display:'flex', flexDirection:'column', overflow:'hidden', position:'relative'
    }}>
      {/* Status bar */}
      <div style={{
        height:44, display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        padding:'0 22px 8px', fontSize:14, fontWeight:600, color:t.text, flexShrink:0
      }}>
        <span>9:41</span>
        <div style={{ display:'flex', gap:5, alignItems:'center', fontSize:11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Header with day navigation */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'2px 18px 12px', flexShrink:0
      }}>
        <button onClick={() => navigateDay(-1)} style={{
          width:32, height:32, borderRadius:9, background:'transparent',
          border:`1px solid ${t.border}`, color:t.text2, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16
        }}>‹</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:t.text, lineHeight:1 }}>
            {dateLabel}
          </div>
          {!isToday && (
            <button onClick={() => setViewDate(new Date())} style={{
              marginTop:3, fontSize:10, color:t.accent, background:'transparent',
              border:'none', cursor:'pointer', fontFamily:t.sans
            }}>Back to today</button>
          )}
        </div>
        <button onClick={() => navigateDay(1)} style={{
          width:32, height:32, borderRadius:9, background:'transparent',
          border:`1px solid ${t.border}`, color:t.text2, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16
        }}>›</button>
      </div>

      {/* Scrollable body — swipeable */}
      <div
        style={{ flex:1, overflowY:'auto', padding:'0 18px 16px', position:'relative' }}
        className="phone-scroll"
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >

        {/* ── CALORIE RING + MACRO BARS ── */}
        <div style={{
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:20,
          padding:'16px 18px', marginBottom:12
        }}>
          <div style={{ display:'flex', gap:16, alignItems:'center' }}>
            {/* Big calorie ring */}
            <div style={{ position:'relative', flexShrink:0 }}>
              {(() => {
                const r = 44, sw = 11, sz = r*2+sw;
                const circ = 2*Math.PI*r;
                const [drawn, setD] = React.useState(false);
                React.useEffect(() => { const id = setTimeout(() => setD(true), 80); return () => clearTimeout(id); }, [totCal]);
                const off = circ * (1 - (drawn ? calPct : 0));
                return (
                  <div style={{ position:'relative', width:sz, height:sz }}>
                    <svg width={sz} height={sz} style={{ transform:'rotate(-90deg)' }}>
                      <circle cx={sz/2} cy={sz/2} r={r} stroke={ringColor+'25'} strokeWidth={sw} fill="none"/>
                      <circle cx={sz/2} cy={sz/2} r={r} stroke={ringColor} strokeWidth={sw}
                        fill="none" strokeLinecap="round"
                        strokeDasharray={circ} strokeDashoffset={off}
                        style={{ transition:'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)' }}/>
                    </svg>
                    <div style={{
                      position:'absolute', inset:0, display:'flex', flexDirection:'column',
                      alignItems:'center', justifyContent:'center'
                    }}>
                      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:t.text, lineHeight:1 }}>
                        {totCal}
                      </div>
                      <div style={{ fontSize:9, color:t.text3, letterSpacing:'.04em', marginTop:2 }}>
                        /{dayTarget} kcal
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Macro bars */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
              <MacroBar consumed={Math.round(totProt)} target={protTarget}
                color={t.accent} label="Protein" unit="g" theme={theme}/>
              <MacroBar consumed={Math.round(totCarb)} target={carbTarget}
                color='#0369A1' label="Carbs" unit="g" theme={theme}/>
              <MacroBar consumed={Math.round(totFat)} target={fatTarget}
                color='#6D4AAF' label="Fat" unit="g" theme={theme}/>
            </div>
          </div>

          {/* Remaining callout */}
          {(() => {
            const rem = dayTarget - totCal;
            const over = rem < 0;
            return (
              <div style={{
                marginTop:12, padding:'8px 12px', borderRadius:9,
                background: over ? '#BE3B2E12' : t.surface2,
                border:`1px solid ${over ? '#BE3B2E30' : t.border}`,
                display:'flex', justifyContent:'space-between', alignItems:'center'
              }}>
                <span style={{ fontSize:11, color:t.text2 }}>
                  {over ? 'Over by' : 'Remaining'}
                </span>
                <span style={{
                  fontFamily:"'DM Serif Display',serif", fontSize:18, lineHeight:1,
                  color: over ? '#BE3B2E' : t.green
                }}>
                  {Math.abs(rem)} kcal
                </span>
              </div>
            );
          })()}
        </div>

        {/* ── HEAVY SESSION BANNER ── */}
        {completedGymThisDay && isHeavyCompoundDay && (
          <div style={{
            padding:'10px 14px', borderRadius:12, marginBottom:10,
            background: t.accent + '12', border:`1px solid ${t.accent}30`,
            display:'flex', alignItems:'center', gap:10
          }}>
            <span style={{ fontSize:16 }}>💪</span>
            <div style={{ flex:1, fontSize:11.5, color:t.text2, lineHeight:1.45 }}>
              <span style={{ fontWeight:600, color:t.text }}>Big session today</span> — consider adding 200–300 extra kcal from carbs and protein.
            </div>
          </div>
        )}

        {/* ── COPY FROM YESTERDAY BANNER ── */}
        {(() => {
          const yesterday = foodAddDays(viewDate, -1);
          const yesterdayKey = foodDateKey(yesterday);
          const yesterdayEntries = foodLog[yesterdayKey]?.entries || [];
          if (entries.length === 0 && yesterdayEntries.length > 0) {
            return (
              <div style={{
                padding:'10px 14px', borderRadius:12, marginBottom:10,
                background: t.surface, border:`1px dashed ${t.border2}`,
                display:'flex', alignItems:'center', justifyContent:'space-between', gap:10
              }}>
                <div style={{ fontSize:11.5, color:t.text2 }}>
                  Nothing logged yet — copy from yesterday?
                </div>
                <button onClick={() => {
                  const copied = yesterdayEntries.map(e => ({ ...e, id: Date.now().toString() + Math.random(), time: new Date().toTimeString().slice(0,5) }));
                  if (onUpdateFood) onUpdateFood(vKey, copied);
                }} style={{
                  padding:'5px 11px', borderRadius:8, background:t.accent, color:t.accentText,
                  border:'none', fontFamily:t.sans, fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap'
                }}>
                  Copy yesterday
                </button>
              </div>
            );
          }
          return null;
        })()}

        {/* ── MEAL SECTIONS ── */}
        {MEALS.map(meal => {
          const mealEntries = entries.filter(e => e.meal === meal.id);
          const mealCal  = mealEntries.reduce((s,e) => s + (e.calories||0), 0);
          const mealProt = mealEntries.reduce((s,e) => s + (e.protein||0), 0);
          return (
            <div key={meal.id} style={{
              background:t.surface, border:`1px solid ${t.border}`, borderRadius:18,
              marginBottom:10, overflow:'hidden'
            }}>
              {/* Meal header */}
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 14px 10px',
                borderBottom: mealEntries.length > 0 ? `1px solid ${t.border}` : 'none'
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:15 }}>{meal.emoji}</span>
                  <div>
                    <div style={{ fontSize:13, color:t.text, fontWeight:500 }}>{meal.label}</div>
                    {mealCal > 0 && (
                      <div style={{ fontSize:10, color:t.text3, marginTop:1 }}>
                        {mealCal} kcal
                        {mealProt > 0 && <span style={{ marginLeft:5, color:meal.color }}>{Math.round(mealProt)}g protein</span>}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => { setAddMeal(meal.id); setSearch(''); setSelected(null); setGrams(''); setShowCustom(false); }} style={{
                  width:28, height:28, borderRadius:7, background:meal.color+'18',
                  border:`1px solid ${meal.color}30`, color:meal.color,
                  cursor:'pointer', fontSize:16, display:'flex',
                  alignItems:'center', justifyContent:'center', fontFamily:t.sans
                }}>+</button>
              </div>

              {/* Meal items */}
              {mealEntries.map((e, i) => (
                <div key={e.id} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'9px 14px',
                  borderBottom: i < mealEntries.length-1 ? `1px solid ${t.border}` : 'none'
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, color:t.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {e.name}
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:2, fontSize:10, color:t.text3 }}>
                      <span style={{ color:t.text2, fontFamily:"'JetBrains Mono',monospace" }}>{e.calories} kcal</span>
                      {e.protein > 0 && <span style={{ color:t.accent }}>P {Math.round(e.protein)}g</span>}
                      {e.carbs   > 0 && <span style={{ color:'#0369A1' }}>C {Math.round(e.carbs)}g</span>}
                      {e.fat     > 0 && <span style={{ color:'#6D4AAF' }}>F {Math.round(e.fat)}g</span>}
                    </div>
                  </div>
                  <button onClick={() => removeEntry(e.id)} style={{
                    width:24, height:24, borderRadius:5, background:'transparent',
                    border:`1px solid ${t.border}`, color:'#BE3B2E',
                    cursor:'pointer', fontSize:13, flexShrink:0
                  }}>×</button>
                </div>
              ))}

              {mealEntries.length === 0 && (
                <div style={{ padding:'10px 14px', fontSize:11, color:t.text3 }}>
                  Nothing logged for {meal.label.toLowerCase()} yet.
                </div>
              )}
            </div>
          );
        })}

        {/* ── WEEKLY OVERVIEW (collapsible) ── */}
        <button onClick={() => setShowWeekly(v => !v)} style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'11px 14px', borderRadius:13,
          background:t.surface, border:`1px solid ${t.border}`,
          cursor:'pointer', fontFamily:t.sans, marginBottom:6
        }}>
          <span style={{ fontSize:12, color:t.text, fontWeight:500 }}>Weekly overview</span>
          <span style={{ fontSize:11, color:t.text3 }}>{showWeekly ? '▲' : '▼'}</span>
        </button>

        {showWeekly && (
          <div style={{
            background:t.surface, border:`1px solid ${t.border}`, borderRadius:16,
            padding:'14px 16px', marginBottom:12
          }}>
            {/* Week bars */}
            <div style={{ display:'flex', gap:5, alignItems:'flex-end', height:56, marginBottom:8 }}>
              {weekDays.map(day => {
                const pct = day.target > 0 ? Math.min(1.3, day.consumed / day.target) : 0;
                const barH = Math.max(2, pct * 44);
                let barCol = t.border;
                if (day.consumed > 0) {
                  const r = day.consumed / day.target;
                  barCol = r > 1.2 ? '#BE3B2E' : r > 1.08 ? '#B45309' : '#15803D';
                }
                const isViewing = day.key === vKey;
                return (
                  <div key={day.key} onClick={() => setViewDate(new Date(day.d))}
                    style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer' }}>
                    <div style={{ width:'100%', height:44, display:'flex', alignItems:'flex-end' }}>
                      <div style={{
                        width:'100%', height:barH, borderRadius:3, background:barCol,
                        outline: isViewing ? `2px solid ${t.accent}` : 'none', outlineOffset:1
                      }}/>
                    </div>
                    <div style={{ fontSize:9.5, color:day.isToday ? t.accent : t.text3, fontWeight:day.isToday ? 600 : 400 }}>
                      {day.label.slice(0,2)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize:10.5, color:t.text2 }}>
              Week total: <span style={{ fontWeight:500, color:t.text }}>
                {weekDays.reduce((s,d) => s+d.consumed, 0).toLocaleString()} kcal
              </span>
              {' '}/ target {weekDays.reduce((s,d) => s+d.target, 0).toLocaleString()} kcal
            </div>
          </div>
        )}
      </div>

      <BottomNav theme={theme} active="food" onNav={onNav} tracksCycle={tracksCycle}/>

      {/* ── ADD FOOD BOTTOM SHEET ── */}
      {addMeal && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.45)',
          display:'flex', alignItems:'flex-end', zIndex:50
        }} onClick={resetSheet}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width:'100%', background:t.surface,
            borderTopLeftRadius:22, borderTopRightRadius:22,
            padding:'16px 20px 24px', maxHeight:'88%',
            display:'flex', flexDirection:'column'
          }}>
            <div style={{ width:38, height:4, background:t.border, borderRadius:99, margin:'0 auto 12px' }}/>

            {/* Sheet header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:t.text }}>
                  {MEALS.find(m => m.id === addMeal)?.emoji} Add to {MEALS.find(m => m.id === addMeal)?.label}
                </div>
              </div>
              <button onClick={() => setShowCustom(v => !v)} style={{
                padding:'4px 10px', borderRadius:7, background:'transparent',
                border:`1px solid ${t.border}`, color:t.text2,
                fontSize:10.5, cursor:'pointer', fontFamily:t.sans
              }}>
                {showCustom ? 'Search foods' : 'Custom entry'}
              </button>
            </div>

            {showCustom ? (
              // Custom entry form
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ fontSize:10.5, color:t.text2, marginBottom:2 }}>
                  Enter calories manually — useful for meals you've weighed yourself or restaurant food.
                </div>
                <input value={customName} onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Food name (e.g. Nando's chicken wrap)"
                  style={{ padding:'10px 12px', borderRadius:10, border:`1px solid ${t.border}`,
                    background:t.surface2, fontFamily:t.sans, fontSize:13, color:t.text, outline:'none' }}
                />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div>
                    <div style={{ fontSize:10, color:t.text3, marginBottom:4 }}>Calories (kcal) *</div>
                    <input value={customCal} type="number" placeholder="e.g. 450"
                      onChange={(e) => setCustomCal(e.target.value)}
                      style={{ width:'100%', padding:'10px 12px', borderRadius:10,
                        border:`1px solid ${t.border}`, background:t.surface2,
                        fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:t.text,
                        outline:'none', boxSizing:'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:t.text3, marginBottom:4 }}>Protein (g)</div>
                    <input value={customProt} type="number" placeholder="optional"
                      onChange={(e) => setCustomProt(e.target.value)}
                      style={{ width:'100%', padding:'10px 12px', borderRadius:10,
                        border:`1px solid ${t.border}`, background:t.surface2,
                        fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:t.text,
                        outline:'none', boxSizing:'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:t.text3, marginBottom:4 }}>Carbs (g)</div>
                    <input value={customCarb} type="number" placeholder="optional"
                      onChange={(e) => setCustomCarb(e.target.value)}
                      style={{ width:'100%', padding:'10px 12px', borderRadius:10,
                        border:`1px solid ${t.border}`, background:t.surface2,
                        fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:t.text,
                        outline:'none', boxSizing:'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:t.text3, marginBottom:4 }}>Fat (g)</div>
                    <input value={customFat} type="number" placeholder="optional"
                      onChange={(e) => setCustomFat(e.target.value)}
                      style={{ width:'100%', padding:'10px 12px', borderRadius:10,
                        border:`1px solid ${t.border}`, background:t.surface2,
                        fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:t.text,
                        outline:'none', boxSizing:'border-box' }}
                    />
                  </div>
                </div>
                <button onClick={confirmCustom} disabled={!customCal || Number(customCal) <= 0} style={{
                  padding:'13px', borderRadius:12, border:'none', fontFamily:t.sans,
                  fontSize:13, fontWeight:600, cursor: customCal ? 'pointer' : 'default',
                  background: customCal ? t.accent : t.surface2,
                  color: customCal ? t.accentText : t.text3
                }}>Log food</button>
              </div>

            ) : selected ? (
              // Portion selector for a chosen food
              <div>
                <div style={{
                  background:t.surface2, border:`1px solid ${t.border}`, borderRadius:12,
                  padding:'12px 14px', marginBottom:14
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:14, color:t.text, fontWeight:500 }}>{selected.name}</div>
                      <div style={{ fontSize:10.5, color:t.text3 }}>{selected.cat} · {selected.cal} kcal per 100g</div>
                    </div>
                    <button onClick={() => { setSelected(null); setGrams(''); }} style={{
                      width:24, height:24, borderRadius:6, background:'transparent',
                      border:`1px solid ${t.border}`, color:t.text3, cursor:'pointer', fontSize:13
                    }}>‹</button>
                  </div>
                </div>

                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10.5, color:t.text2, marginBottom:6 }}>
                    Portion size (grams)
                  </div>
                  <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                    {[selected.defaultG, Math.round(selected.defaultG * 0.5), Math.round(selected.defaultG * 1.5)].map(g => (
                      <button key={g} onClick={() => setGrams(String(g))} style={{
                        flex:1, padding:'9px 0', borderRadius:9,
                        background: grams === String(g) ? t.accent : t.surface2,
                        color: grams === String(g) ? t.accentText : t.text2,
                        border:`1px solid ${grams === String(g) ? t.accent : t.border}`,
                        fontFamily:"'JetBrains Mono',monospace", fontSize:13, cursor:'pointer'
                      }}>{g}g</button>
                    ))}
                  </div>
                  <input value={grams} type="number"
                    onChange={(e) => setGrams(e.target.value)}
                    placeholder="Or enter grams..."
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10,
                      border:`1px solid ${t.border}`, background:t.surface2,
                      fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:t.text, outline:'none' }}
                  />
                </div>

                {grams && Number(grams) > 0 && (() => {
                  const n = calcNutrition(selected, grams);
                  return (
                    <div style={{
                      display:'flex', gap:8, marginBottom:14,
                      padding:'10px 12px', borderRadius:10,
                      background:t.surface2, border:`1px solid ${t.border}`
                    }}>
                      {[
                        { label:'kcal', val:n.calories, color:t.text },
                        { label:'prot', val:n.protein+'g', color:t.accent },
                        { label:'carbs', val:n.carbs+'g', color:'#0369A1' },
                        { label:'fat', val:n.fat+'g', color:'#6D4AAF' },
                      ].map(m => (
                        <div key={m.label} style={{ flex:1, textAlign:'center' }}>
                          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:16, color:m.color }}>{m.val}</div>
                          <div style={{ fontSize:9.5, color:t.text3, marginTop:2 }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <button onClick={confirmAdd} disabled={!grams || Number(grams) <= 0} style={{
                  width:'100%', padding:'13px', borderRadius:12, border:'none',
                  fontFamily:t.sans, fontSize:13, fontWeight:600,
                  cursor: grams ? 'pointer' : 'default',
                  background: grams ? t.accent : t.surface2,
                  color: grams ? t.accentText : t.text3
                }}>Add to {MEALS.find(m => m.id === addMeal)?.label}</button>
              </div>

            ) : (
              // Food search list
              <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
                <div style={{ position:'relative', marginBottom:10 }}>
                  <input
                    autoFocus value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search foods or category…"
                    style={{ width:'100%', padding:'10px 36px 10px 12px', borderRadius:10,
                      border:`1px solid ${t.border}`, background:t.surface2,
                      fontFamily:t.sans, fontSize:13, color:t.text, outline:'none' }}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} style={{
                      position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                      background:'transparent', border:'none', color:t.text3, cursor:'pointer', fontSize:16
                    }}>×</button>
                  )}
                </div>

                <div style={{ overflowY:'auto', flex:1 }}>
                  {filteredDB.map((food, i) => (
                    <button key={food.id} onClick={() => { setSelected(food); setGrams(String(food.defaultG)); }} style={{
                      width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'10px 12px', borderRadius:10, textAlign:'left',
                      background: i % 2 === 0 ? t.surface2 : 'transparent',
                      border:`1px solid ${t.border}`, marginBottom:5,
                      cursor:'pointer', fontFamily:t.sans
                    }}>
                      <div>
                        <div style={{ fontSize:13, color:t.text }}>{food.name}</div>
                        <div style={{ fontSize:10, color:t.text3, marginTop:2 }}>
                          {food.cat} · {food.cal} kcal · {food.p}g protein per 100g
                        </div>
                      </div>
                      <span style={{ fontSize:14, color:t.text3 }}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export {
  foodGetWeekStart, foodDateKey, foodAddDays, foodDow,
  FOOD_DAY_LABELS, MEALS, FOOD_DB,
  MacroRing, MacroBar, FoodScreen,
};
