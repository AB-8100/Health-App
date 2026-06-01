import React from 'react';
import ReactDOM from 'react-dom/client';

import { loadFromCache, saveToCache, scheduleSaveLocal } from './utils/storage';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakButton } from './components/tweaks/TweaksPanel';
import { themes, RefinedHome } from './screens/HomeScreen';
import { GymSessionScreen, GymSummaryScreen, PlaceholderScreen } from './screens/GymSessionScreen';
import { EX_LIB, SPLITS, GymHubScreen, SplitPickerScreen, SessionEditorScreen, DayActivitiesScreen } from './screens/GymPlanScreens';
import { ExerciseLibraryScreen } from './screens/ExerciseScreens';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { FoodScreen } from './screens/FoodScreen';
import { AboutScreen } from './screens/AboutScreen';

// ─── localStorage key (referenced in resetProfile) ────────────────────────
const LS_DATA_KEY = 'forma_data';

const TWEAK_DEFAULTS = {
  "theme": "light",
  "accent": "#BE5A38",
  "showOnboarding": false
};

const EMPTY_PROFILE = {
  name: '', age: 30, sex: '', tracksCycle: null,
  height: 168, weight: 65, goal: '', connected: [], splitDays: 3,
};
const DEFAULT_SETTINGS = {
  dailyCaloriesBase: 1500,
  gymDayBoost: 250,
  weightUnit: 'kg',
  heightUnit: 'cm',
};
const DEFAULT_PLAN = { splitDays: 3, todayIdx: 0, overrides: {} };

// ─────────────────────────────────────────────────────────────────────────────
// Splash screen — shown while checking for a cached session on load
// ─────────────────────────────────────────────────────────────────────────────
function SplashScreen({ theme = 'light', userName }) {
  const bg     = theme === 'dark' ? '#111114' : '#F5F2ED';
  const accent = '#BE5A38';
  const text2  = theme === 'dark' ? '#9A9398' : '#6B6560';
  return (
    <div style={{
      width: '100%', height: '100%', background: bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 48, color: accent, letterSpacing: '-0.02em' }}>
        Forma
      </div>
      <div style={{
        width: 28, height: 28, border: `2.5px solid ${accent}`,
        borderTopColor: 'transparent', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {userName && (
        <div style={{ fontSize: 13, color: text2 }}>Welcome back, {userName}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App — root component
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [authState, setAuthState] = React.useState('loading');
  const [screen, setScreen]               = React.useState('home');
  const [profile, setProfileRaw]          = React.useState(EMPTY_PROFILE);
  const [onboardingActive, setOnboarding] = React.useState(false);
  const [plan, setPlanRaw]                = React.useState(DEFAULT_PLAN);
  const [userSettings, setSettingsRaw]    = React.useState(DEFAULT_SETTINGS);
  const [editingDayId, setEditingDayId]   = React.useState(null);
  const [editingDayIdx, setEditingDayIdx] = React.useState(null);
  const [activities, setActivities]       = React.useState({});
  const [session, setSession]             = React.useState({
    active: false, paused: false, elapsed: 0, workout: '', queue: null,
  });
  const [lastSession, setLastSession]             = React.useState(null);
  const [completedSessions, setCompletedSessions] = React.useState([]);
  const [foodLog, setFoodLog]                     = React.useState({});

  React.useEffect(() => {
    const saved = loadFromCache();
    if (saved) hydrateState(saved);
    setAuthState('ready');
  }, []);

  const hydrateState = (data) => {
    if (!data) return;
    if (data.profile)           setProfileRaw(data.profile);
    if (data.plan)              setPlanRaw(data.plan);
    if (data.userSettings)      setSettingsRaw(data.userSettings);
    if (data.completedSessions) setCompletedSessions(data.completedSessions);
    if (data.foodLog)           setFoodLog(data.foodLog);
    if (data.activities)        setActivities(data.activities);
    setOnboarding(!data.profile || !data.profile.name);
  };

  const buildSnapshot = (overrides = {}) => ({
    profile, plan, userSettings,
    completedSessions, foodLog, activities,
    savedAt: new Date().toISOString(),
    ...overrides,
  });

  const scheduleSave = React.useCallback((overrides = {}) => {
    const snapshot = buildSnapshot(overrides);
    scheduleSaveLocal(snapshot);
  }, [profile, plan, userSettings, completedSessions, foodLog, activities]);

  const setProfile = (updater) => {
    setProfileRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      setTimeout(() => scheduleSave({ profile: next }), 0);
      return next;
    });
  };
  const setPlan = (updater) => {
    setPlanRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setTimeout(() => scheduleSave({ plan: next }), 0);
      return next;
    });
  };
  const setUserSettings = (updater) => {
    setSettingsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      setTimeout(() => scheduleSave({ userSettings: next }), 0);
      return next;
    });
  };

  const resetProfile = () => {
    try { localStorage.removeItem(LS_DATA_KEY); } catch(e) {}
    setProfileRaw(EMPTY_PROFILE);
    setPlanRaw(DEFAULT_PLAN);
    setSettingsRaw(DEFAULT_SETTINGS);
    setCompletedSessions([]);
    setFoodLog({});
    setActivities({});
    setSession({ active: false, paused: false, elapsed: 0, workout: '', queue: null });
    setOnboarding(true);
    setScreen('home');
  };

  React.useEffect(() => {
    if (!session.active || session.paused) return;
    const id = setInterval(() => setSession(s => ({ ...s, elapsed: s.elapsed + 1 })), 1000);
    return () => clearInterval(id);
  }, [session.active, session.paused]);

  React.useEffect(() => {
    document.body.setAttribute('data-theme', tweaks.theme);
  }, [tweaks.theme]);

  const startSession = () => {
    const split = SPLITS[plan.splitDays] || SPLITS[3];
    if (!split || !split.days || !split.days.length) return;
    const todayBase = split.days[(plan.todayIdx || 0) % split.days.length];
    const today = (plan.overrides && plan.overrides[todayBase.id]) || todayBase;
    const SECTION_ORDER_LOCAL = ['compound','accessory','core','mobility'];
    const queue = SECTION_ORDER_LOCAL.flatMap(sec => (today[sec] || []).map(id => {
      const ex = EX_LIB[id] || {};
      const targetSets = 3;
      return {
        id, name: ex.name || id, muscle: ex.muscle || '',
        targetSets, targetReps: 10, targetWeight: 0, lastWeek: '—', isPR: false,
        sets: Array.from({ length: targetSets }, () => ({ w: null, r: null, done: false })),
      };
    }));
    setSession(s => ({
      ...s, active: true, paused: false, elapsed: 0, exIdx: 0,
      workout: today.name + ' day',
      queue: queue.length ? queue : null,
    }));
    setScreen('gym-session');
  };

  const finishSession = (final) => {
    const completed = { ...session, ...final, id: Date.now().toString(), date: new Date().toISOString(), endedAt: Date.now() };
    setLastSession(completed);
    setCompletedSessions(prev => {
      const next = [...prev, completed];
      setTimeout(() => scheduleSave({ completedSessions: next }), 0);
      return next;
    });
    setScreen('gym-summary');
  };

  const closeSummary = () => {
    setSession({ active: false, paused: false, elapsed: 0, workout: '', queue: null });
    setScreen('home');
  };

  const deleteSession = (id) => setCompletedSessions(prev => {
    const next = prev.filter(s => s.id !== id);
    setTimeout(() => scheduleSave({ completedSessions: next }), 0);
    return next;
  });

  const viewSummary = (sessionData) => { setLastSession(sessionData); setScreen('gym-summary'); };

  const updateFood = (dateKey, entries) => setFoodLog(prev => {
    const next = { ...prev, [dateKey]: { entries } };
    setTimeout(() => scheduleSave({ foodLog: next }), 0);
    return next;
  });

  const navigate = (target) => {
    if (target === 'gym') setScreen(session.active ? 'gym-session' : 'gym-hub');
    else setScreen(target);
  };

  const completeOnboarding = (newProfile) => {
    const newPlan = { splitDays: newProfile.splitDays || 3, todayIdx: 0, overrides: {} };
    setProfileRaw(newProfile);
    setPlanRaw(newPlan);
    setSettingsRaw(DEFAULT_SETTINGS);
    saveToCache({ profile: newProfile, plan: newPlan, userSettings: DEFAULT_SETTINGS,
                  completedSessions: [], foodLog: {}, activities: {},
                  savedAt: new Date().toISOString() });
    setOnboarding(false);
    setScreen('home');
  };

  if (authState === 'loading') {
    return (
      <div className="stage">
        <div className="phone-frame">
          <div className="phone-notch"/>
          <div className="phone-inner">
            <SplashScreen theme={tweaks.theme} />
          </div>
        </div>
        <div className="label">Forma · Loading</div>
      </div>
    );
  }

  const renderScreen = (s) => {
    if (onboardingActive)
      return <OnboardingScreen width={374} height={804} theme={tweaks.theme}
               onComplete={completeOnboarding}
               initial={EMPTY_PROFILE} />;
    if (s === 'home')
      return <RefinedHome width={374} height={804} theme={tweaks.theme}
               profile={profile}
               plan={plan}
               completedSessions={completedSessions}
               onNav={navigate}
               onStartSession={startSession}
               activeSession={session.active ? session : null}
               onResumeSession={() => setScreen('gym-session')}
               onOpenAbout={() => setScreen('about-me')} />;
    if (s === 'gym-hub')
      return <GymHubScreen width={374} height={804} theme={tweaks.theme}
               plan={plan}
               todayIdx={plan.todayIdx}
               dayOfWeek={new Date().getDay() === 0 ? 6 : new Date().getDay() - 1}
               activities={activities}
               completedSessions={completedSessions}
               activeSession={session.active ? session : null}
               tracksCycle={profile.tracksCycle}
               onNav={navigate}
               onStartSession={startSession}
               onResumeSession={() => setScreen('gym-session')}
               onChangeSplit={() => setScreen('gym-split')}
               onEditDay={(dayId) => { setEditingDayId(dayId); setTimeout(() => setScreen('gym-edit'), 0); }}
               onSelectDay={(i) => { setPlan(p => ({ ...p, todayIdx: i })); }}
               onTapDay={(dayIdx) => { setEditingDayIdx(dayIdx); setScreen('gym-day'); }}
               onBrowseLibrary={() => setScreen('gym-library')}
               onViewSummary={viewSummary}
               onDeleteSession={deleteSession}
               onReorderSchedule={(newSched) => setPlan(p => ({ ...p, scheduleOverride: newSched }))} />;
    if (s === 'gym-split')
      return <SplitPickerScreen width={374} height={804} theme={tweaks.theme}
               plan={plan}
               tracksCycle={profile.tracksCycle}
               onBack={() => setScreen('gym-hub')}
               onSave={(d) => { setPlan(p => ({ ...p, splitDays: d, todayIdx: 0, scheduleOverride: null })); setScreen('gym-hub'); }}
               onNav={navigate} />;
    if (s === 'gym-edit') {
      const split = SPLITS[plan.splitDays] || SPLITS[3];
      if (!split) return null;
      const fallbackId = split.days[0].id;
      const resolvedDayId = editingDayId || fallbackId;
      if (!resolvedDayId) return null;
      return <SessionEditorScreen width={374} height={804} theme={tweaks.theme}
               plan={plan}
               dayId={resolvedDayId}
               tracksCycle={profile.tracksCycle}
               onBack={() => setScreen('gym-hub')}
               onSave={(updatedDay) => {
                 setPlan(p => ({ ...p, overrides: { ...p.overrides, [updatedDay.id]: updatedDay } }));
                 setScreen('gym-hub');
               }}
               onNav={navigate} />;
    }
    if (s === 'gym-day')
      return <DayActivitiesScreen width={374} height={804} theme={tweaks.theme}
               plan={plan}
               dayIdx={editingDayIdx ?? 1}
               activities={activities}
               tracksCycle={profile.tracksCycle}
               onBack={() => setScreen('gym-hub')}
               onSave={(idx, list) => {
                 setActivities(a => {
                   const next = { ...a, [idx]: list };
                   setTimeout(() => scheduleSave({ activities: next }), 0);
                   return next;
                 });
               }}
               onEditGym={(dayId) => { setEditingDayId(dayId); setScreen('gym-edit'); }}
               onNav={navigate} />;
    if (s === 'food')
      return <FoodScreen width={374} height={804} theme={tweaks.theme}
               foodLog={foodLog}
               userSettings={userSettings}
               plan={plan}
               activities={activities}
               completedSessions={completedSessions}
               onUpdateFood={updateFood}
               onNav={navigate}
               tracksCycle={profile.tracksCycle} />;
    if (s === 'about-me')
      return <AboutScreen width={374} height={804} theme={tweaks.theme}
               profile={profile}
               userSettings={userSettings}
               plan={plan}
               onSaveProfile={(p) => setProfile(prev => ({ ...prev, ...p }))}
               onSaveSettings={(s) => setUserSettings(prev => ({ ...prev, ...s }))}
               onBack={() => setScreen('home')}
               onNav={navigate}
               onSignOut={resetProfile}
               tracksCycle={profile.tracksCycle} />;
    if (s === 'gym-library')
      return <ExerciseLibraryScreen width={374} height={804} theme={tweaks.theme}
               tracksCycle={profile.tracksCycle}
               onBack={() => setScreen('gym-hub')}
               onNav={navigate} />;
    if (s === 'gym-session' || s === 'gym')
      return <GymSessionScreen width={374} height={804} theme={tweaks.theme}
               session={session} setSession={setSession}
               tracksCycle={profile.tracksCycle}
               onNav={navigate}
               onExit={() => setScreen(session.active ? 'home' : 'gym-hub')}
               onComplete={finishSession} />;
    if (s === 'gym-summary')
      return <GymSummaryScreen width={374} height={804} theme={tweaks.theme}
               session={lastSession}
               tracksCycle={profile.tracksCycle}
               onDone={closeSummary}
               onNav={navigate} />;
    return <PlaceholderScreen width={374} height={804} theme={tweaks.theme}
             screen={s} onNav={navigate} tracksCycle={profile.tracksCycle} />;
  };

  const screenLabel = onboardingActive
    ? 'ONBOARDING'
    : screen.replace(/^gym-?/, '').toUpperCase() || screen.toUpperCase();

  return (
    <>
      <div className="stage">
        <div className="phone-frame">
          <div className="phone-notch"/>
          <div className="phone-inner">
            <div key={onboardingActive ? 'onboarding' : screen} className="screen-anim">
              {renderScreen(screen)}
            </div>
          </div>
        </div>
        <div className="label">
          Forma · {screenLabel}{profile.name ? ' · ' + profile.name : ''}
        </div>
      </div>

      <TweaksPanel title="Dev tools">
        <TweakSection label="Theme">
          <TweakRadio
            label="Mode"
            value={tweaks.theme}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            onChange={(v) => setTweak('theme', v)}
          />
        </TweakSection>
        <TweakSection label="Navigate">
          <TweakSelect
            label="Screen"
            value={onboardingActive ? 'onboarding' : screen}
            options={[
              { value: 'onboarding',  label: 'Onboarding' },
              { value: 'home',        label: 'Home' },
              { value: 'gym-hub',     label: 'Gym · Hub' },
              { value: 'gym-split',   label: 'Gym · Split picker' },
              { value: 'gym-edit',    label: 'Gym · Session editor' },
              { value: 'gym-day',     label: 'Gym · Day activities' },
              { value: 'gym-library', label: 'Gym · Exercise library' },
              { value: 'gym-session', label: 'Gym · In session' },
              { value: 'gym-summary', label: 'Gym · Summary' },
              { value: 'food',        label: 'Food · Weekly tracker' },
              { value: 'about-me',   label: 'About me' },
              { value: 'cycle',       label: 'Cycle (stub)' },
            ]}
            onChange={(v) => {
              if (v === 'onboarding') setOnboarding(true);
              else { setOnboarding(false); setScreen(v); }
            }}
          />
        </TweakSection>
        <TweakSection label="Profile">
          <TweakButton label="Re-run onboarding" secondary
            onClick={() => { setOnboarding(true); setScreen('home'); }} />
          <TweakButton label="Reset all data" secondary onClick={resetProfile} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

export default App;
