import React from 'react';

import { loadFromCache, saveToCache, scheduleSaveAll } from './utils/storage';
import { supabase, loadUserData, saveUserData, saveUserGoals, saveUserIntake } from './utils/supabase';
import {
  initFromCache, getSheetsStatus, getSheetId, getSheetUrl,
  connectGoogle, disconnectGoogle, reconnectGoogle,
  loadFromSheets, saveToSheets,
} from './utils/googleSheets';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakButton } from './components/tweaks/TweaksPanel';
import { themes, RefinedHome } from './screens/HomeScreen';
import { GymSessionScreen, GymSummaryScreen, PlaceholderScreen } from './screens/GymSessionScreen';
import { EX_LIB, SPLITS, GymHubScreen, SplitPickerScreen, SessionEditorScreen, DayActivitiesScreen } from './screens/GymPlanScreens';
import { ExerciseLibraryScreen } from './screens/ExerciseScreens';
import { TriathlonScreen } from './screens/TriathlonScreen';
import { WeeklyOverviewScreen } from './screens/WeeklyOverviewScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { GoalsSetupScreen } from './screens/GoalsSetupScreen';
import { DeepQuestionnaireScreen } from './screens/DeepQuestionnaireScreen';
import { ProfileSetupScreen } from './screens/ProfileSetupScreen';
import { FoodScreen } from './screens/FoodScreen';
import { AboutScreen } from './screens/AboutScreen';
import { LoginScreen } from './screens/LoginScreen';

const TWEAK_DEFAULTS = {
  "theme": "light",
  "accent": "#BE5A38",
  "showOnboarding": false
};

const EMPTY_PROFILE = {
  name: '', age: 30, sex: '', tracksCycle: false,
  height: 168, weight: 65, goal: '', connected: [], splitDays: null,
  hasGym: true, hasEventTraining: false,
};
const DEFAULT_SETTINGS = {
  dailyCaloriesBase: 1500,
  gymDayBoost: 250,
  weightUnit: 'kg',
  heightUnit: 'cm',
};
const DEFAULT_PLAN = { splitDays: null, todayIdx: 0, overrides: {} };

// ─────────────────────────────────────────────────────────────────────────────
// Error boundary — catches render crashes so the app never goes fully blank
// ─────────────────────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          width: '100%', height: '100%', background: '#F5F2ED',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
          fontFamily: 'DM Sans, system-ui, sans-serif',
        }}>
          <div style={{ fontSize: 32, color: '#BE5A38', fontFamily: 'DM Serif Display, serif' }}>Forma</div>
          <div style={{ fontSize: 14, color: '#6B6560', textAlign: 'center' }}>
            Something went wrong. Please reload and try again.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px', borderRadius: 10, background: '#BE5A38',
              color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

  const isMobileInit = window.innerWidth <= 430;
  const [contentW, setContentW] = React.useState(isMobileInit ? window.innerWidth : 374);
  const [contentH, setContentH] = React.useState(isMobileInit ? window.innerHeight : 804);

  const [authState, setAuthState]     = React.useState('loading'); // 'loading'|'login'|'app'
  const [currentUser, setCurrentUser] = React.useState(null); // { id, email, name }
  const [sheetsStatus, setSheetsStatus] = React.useState('disconnected'); // 'disconnected'|'connected'|'needs-reconnect'|'connecting'
  const [sheetsError, setSheetsError] = React.useState(null);
  const sheetsConnectedRef = React.useRef(false);
  const [screen, setScreen]               = React.useState('gym-hub');
  const [profile, setProfileRaw]          = React.useState(EMPTY_PROFILE);
  const [onboardingActive, setOnboarding] = React.useState(false);
  // 'profile' = Stage 1 | 'goals' = Stage 2 | 'intake' = Stage 3 | null = main app
  const [onboardingStage, setOnboardingStage] = React.useState(null);
  // Holds the Stage 2 payload while Stage 3 (intake) is shown
  const [pendingGoalsPayload, setPendingGoalsPayload] = React.useState(null);
  const [plan, setPlanRaw]                = React.useState(DEFAULT_PLAN);
  const [userSettings, setSettingsRaw]    = React.useState(DEFAULT_SETTINGS);
  const [editingDayId, setEditingDayId]   = React.useState(null);
  const [editingDayIdx, setEditingDayIdx] = React.useState(null);
  const [activities, setActivities]             = React.useState({});
  const [triathlonOverrides, setTriathlonOverrides] = React.useState({});
  const [triathlonDone, setTriathlonDone]           = React.useState({});
  const [session, setSession]             = React.useState({
    active: false, paused: false, elapsed: 0, workout: '', queue: null,
  });
  const [lastSession, setLastSession]             = React.useState(null);
  const [completedSessions, setCompletedSessions] = React.useState([]);
  const [foodLog, setFoodLog]                     = React.useState({});
  const [customFoods, setCustomFoods]             = React.useState([]);

  React.useEffect(() => {
    sheetsConnectedRef.current = sheetsStatus === 'connected';
  }, [sheetsStatus]);

  const bootstrapUser = React.useCallback(async (supaSession) => {
    const sbUser = supaSession?.user;
    if (!sbUser) { setAuthState('login'); return; }

    const name = sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || sbUser.email.split('@')[0];
    setCurrentUser({ id: sbUser.id, email: sbUser.email, name });

    // Show cached data immediately for instant paint while Supabase loads
    const cached = loadFromCache(sbUser.id);
    if (cached) hydrateState(cached);

    // Supabase is the source of truth — if it has no data the user is new,
    // regardless of what's in localStorage (handles stale cache after account reset).
    let hasAnyData = false;
    let loadedProfile = null;
    try {
      const remote = await loadUserData(sbUser.id);
      if (remote) {
        hasAnyData = true;
        loadedProfile = remote.profile ?? null;
        const localAt  = cached?.savedAt  ? new Date(cached.savedAt)  : new Date(0);
        const remoteAt = remote.savedAt ? new Date(remote.savedAt) : new Date(0);
        if (remoteAt >= localAt) {
          hydrateState(remote);
          saveToCache(remote, sbUser.id);
        } else {
          loadedProfile = cached?.profile ?? null;
        }
      }
      // remote === null → no Supabase data → treat as new user even if cache exists
    } catch (e) {
      console.warn('Forma: remote load failed', e);
      // Network/DB error: fall back to cache so existing users aren't locked out offline
      if (cached) { hasAnyData = true; loadedProfile = cached.profile ?? null; }
    }

    if (!hasAnyData) {
      // New user or stale cache after account reset — clear everything and start fresh
      setProfileRaw(EMPTY_PROFILE);
      setPlanRaw(DEFAULT_PLAN);
      setSettingsRaw(DEFAULT_SETTINGS);
      setCompletedSessions([]);
      setFoodLog({});
      setActivities({});
      setTriathlonOverrides({});
      setTriathlonDone({});
      setCustomFoods([]);
      // Stage 1: collect profile basics before anything else
      setOnboardingStage('profile');
    } else if (loadedProfile && !loadedProfile.goal) {
      // Has profile but no goal set yet — send to Stage 2
      setOnboardingStage('goals');
    }

    const status = getSheetsStatus();
    setSheetsStatus(status);
    if (status === 'connected') {
      const connected = initFromCache();
      if (connected) {
        loadFromSheets().then(sheetsData => {
          if (!sheetsData) return;
          const localAt  = cached?.savedAt  ? new Date(cached.savedAt)       : new Date(0);
          const sheetsAt = sheetsData.savedAt ? new Date(sheetsData.savedAt) : new Date(0);
          if (sheetsAt > localAt) {
            hydrateState(sheetsData);
            saveToCache(sheetsData, sbUser.id);
          }
        }).catch(() => setSheetsStatus('needs-reconnect'));
      }
    }

    // Route to the right starting screen based on the loaded profile
    if (hasAnyData && loadedProfile && !loadedProfile.hasGym) {
      if (loadedProfile.hasEventTraining) setScreen('triathlon');
      else setScreen('food');
    }

    setAuthState('app');
  }, []);

  React.useEffect(() => {
    // getSession() triggers the PKCE code exchange when returning from OAuth.
    // Only bootstrap if a session is returned — never set 'login' here to avoid
    // clobbering a SIGNED_IN that fires immediately after.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) bootstrapUser(data.session);
    });

    // Safety net: if auth state hasn't resolved in 6s, show login rather than hang on splash.
    const timeout = setTimeout(() => setAuthState(s => s === 'loading' ? 'login' : s), 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(timeout);
      if (session) {
        bootstrapUser(session);
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
        setAuthState('login');
      }
    });
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, [bootstrapUser]);

  // Scale phone frame to fit viewport on desktop; fill viewport on real phones
  React.useEffect(() => {
    const update = () => {
      if (window.innerWidth <= 430) {
        setContentW(window.innerWidth);
        setContentH(window.innerHeight);
        document.documentElement.style.setProperty('--phone-scale', '1');
      } else {
        setContentW(374);
        setContentH(804);
        const scale = Math.min(
          1,
          window.innerWidth  / 406,   // 390 frame + 16 breathing room
          window.innerHeight / 882,   // 820 frame + 14 gap + ~48 label
        );
        document.documentElement.style.setProperty('--phone-scale', scale.toFixed(4));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const hydrateState = (data) => {
    if (!data) return;
    if (data.profile)           setProfileRaw(data.profile);
    if (data.plan)              setPlanRaw(data.plan);
    if (data.userSettings)      setSettingsRaw(data.userSettings);
    if (data.completedSessions) setCompletedSessions(data.completedSessions);
    if (data.foodLog)           setFoodLog(data.foodLog);
    if (data.activities)           setActivities(data.activities);
    if (data.triathlonOverrides)   setTriathlonOverrides(data.triathlonOverrides);
    if (data.triathlonDone)        setTriathlonDone(data.triathlonDone);
    if (data.customFoods)          setCustomFoods(data.customFoods);
    setOnboarding(!data.profile || !data.profile.name);
  };

  const buildSnapshot = (overrides = {}) => ({
    profile, plan, userSettings,
    completedSessions, foodLog, activities, customFoods,
    triathlonOverrides, triathlonDone,
    savedAt: new Date().toISOString(),
    ...overrides,
  });

  const currentUserIdRef = React.useRef(null);
  React.useEffect(() => { currentUserIdRef.current = currentUser?.id || null; }, [currentUser]);

  const scheduleSave = React.useCallback((overrides = {}) => {
    const snapshot = buildSnapshot(overrides);
    scheduleSaveAll(snapshot, sheetsConnectedRef.current, currentUserIdRef.current);
  }, [profile, plan, userSettings, completedSessions, foodLog, activities, customFoods]);

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
    setProfileRaw(EMPTY_PROFILE);
    setPlanRaw(DEFAULT_PLAN);
    setSettingsRaw(DEFAULT_SETTINGS);
    setCompletedSessions([]);
    setFoodLog({});
    setActivities({});
    setTriathlonOverrides({});
    setTriathlonDone({});
    setCustomFoods([]);
    setSession({ active: false, paused: false, elapsed: 0, workout: '', queue: null });
    setOnboardingStage('profile');
    setOnboarding(false);
    setScreen('home');
  };

  // Called when Stage 1 (ProfileSetup) is complete
  const handleProfileSetupComplete = ({ profile: p, userSettings: s }) => {
    setProfileRaw(prev => ({ ...prev, ...p }));
    setSettingsRaw(prev => ({ ...prev, ...s }));
    setOnboardingStage('goals');
  };

  // Called when Stage 2 (GoalsSetup) is complete — routes to Stage 3 (intake)
  const handleGoalsSetupComplete = (goalsPayload) => {
    // Persist goals to Supabase
    if (currentUserIdRef.current) {
      saveUserGoals(currentUserIdRef.current, goalsPayload)
        .catch(e => console.warn('Forma: goals save failed', e));
    }
    // Hold onto the payload so Stage 3 can read goal types for conditional sections
    setPendingGoalsPayload(goalsPayload);
    setOnboardingStage('intake');
  };

  // Called when Stage 3 (DeepQuestionnaire) completes or is skipped
  const handleIntakeComplete = (intakePayload, skipped) => {
    const gp = pendingGoalsPayload || {};
    const primaryGoalType = gp.goals?.[0]?.type ?? '';
    const hasEvent = gp.goals?.some(g => g.type === 'event_race');

    const updatedProfile = {
      ...profile,
      goal: primaryGoalType,
      hasGym: gp.gymAccess ?? profile.hasGym,
      hasEventTraining: hasEvent,
    };

    // Persist intake to Supabase
    if (currentUserIdRef.current) {
      saveUserIntake(currentUserIdRef.current, intakePayload)
        .catch(e => console.warn('Forma: intake save failed', e));
    }

    // Trigger plan regeneration if a draft plan already exists and intake is complete
    if (!skipped && updatedProfile.splitDays) {
      console.info('Forma: intake complete — plan regeneration triggered');
    }

    setPendingGoalsPayload(null);
    completeOnboarding(updatedProfile);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    disconnectGoogle();
    setSheetsStatus('disconnected');
    setCurrentUser(null);
    setProfileRaw(EMPTY_PROFILE);
    setPlanRaw(DEFAULT_PLAN);
    setSettingsRaw(DEFAULT_SETTINGS);
    setCompletedSessions([]);
    setFoodLog({});
    setActivities({});
    setTriathlonOverrides({});
    setTriathlonDone({});
    setCustomFoods([]);
    setSession({ active: false, paused: false, elapsed: 0, workout: '', queue: null });
    setOnboarding(false);
    setOnboardingStage(null);
    setScreen('gym-hub');
    setAuthState('login');
  };

  const handleLogin = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    // onAuthStateChange will call bootstrapUser automatically
  };

  const handleSignUp = async (displayName, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: displayName },
        emailRedirectTo: import.meta.env.VITE_APP_URL || (window.location.origin + import.meta.env.BASE_URL),
      },
    });
    if (error) throw new Error(error.message);
    // If email confirmation is disabled in Supabase, session is returned immediately
    if (data.session) return; // onAuthStateChange handles the rest
    // If confirmation required, inform the user
    throw new Error('Check your email to confirm your account, then sign in.');
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
    const split = plan.splitDays ? SPLITS[plan.splitDays] : null;
    if (!split || !split.days || !split.days.length) return;
    const todayBase = split.days[(plan.todayIdx || 0) % split.days.length];
    const today = (plan.overrides && plan.overrides[todayBase.id]) || todayBase;
    const SECTION_ORDER_LOCAL = ['compound','accessory','core','mobility'];
    const queue = SECTION_ORDER_LOCAL.flatMap(sec => (today[sec] || []).map(id => {
      const ex = EX_LIB[id] || {};
      const targetSets = 3;
      const unilateral = ex.unilateral || false;
      return {
        id, name: ex.name || id, muscle: ex.muscle || '',
        targetSets, targetReps: 10, targetWeight: 0, lastWeek: '—', isPR: false,
        unilateral,
        sets: Array.from({ length: targetSets }, () =>
          unilateral
            ? { wR: null, rR: null, wL: null, rL: null, done: false }
            : { w: null, r: null, done: false }
        ),
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
    setScreen('gym-hub');
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

  const saveCustomFood = (food) => setCustomFoods(prev => {
    const next = [...prev, food];
    setTimeout(() => scheduleSave({ customFoods: next }), 0);
    return next;
  });

  const importSessions = (sessions) => setCompletedSessions(prev => {
    const next = [...prev, ...sessions];
    setTimeout(() => scheduleSave({ completedSessions: next }), 0);
    return next;
  });

  const editSession = (updated) => setCompletedSessions(prev => {
    const next = prev.map(s => s.id === updated.id ? updated : s);
    setTimeout(() => scheduleSave({ completedSessions: next }), 0);
    return next;
  });

  const navigate = (target) => {
    if (target === 'gym') setScreen(session.active ? 'gym-session' : 'gym-hub');
    else setScreen(target);
  };

  const completeOnboarding = (newProfile) => {
    const newPlan = { splitDays: newProfile.splitDays ?? null, todayIdx: 0, overrides: {} };
    setProfileRaw(newProfile);
    setPlanRaw(newPlan);
    setSettingsRaw(DEFAULT_SETTINGS);
    const snapshot = { profile: newProfile, plan: newPlan, userSettings: DEFAULT_SETTINGS,
                       completedSessions: [], foodLog: {}, activities: {},
                       savedAt: new Date().toISOString() };
    saveToCache(snapshot, currentUserIdRef.current);
    if (sheetsConnectedRef.current) saveToSheets(snapshot);
    // Save to Supabase immediately so next login finds real remote data
    if (currentUserIdRef.current) {
      saveUserData(currentUserIdRef.current, snapshot).catch(e => console.warn('Forma: onboarding save failed', e));
    }
    setOnboarding(false);
    setOnboardingStage(null);
    if (newProfile.hasGym) setScreen('gym-hub');
    else if (newProfile.hasEventTraining) setScreen('triathlon');
    else setScreen('food');
  };

  const handleConnectSheets = async () => {
    setSheetsStatus('connecting');
    setSheetsError(null);
    try {
      await connectGoogle();
      setSheetsStatus('connected');
      setSheetsError(null);
      sheetsConnectedRef.current = true;
      // Migrate current local data to the new sheet
      const snapshot = buildSnapshot();
      await saveToSheets(snapshot);
    } catch(e) {
      console.error('Google Sheets connect failed:', e.message);
      setSheetsStatus(getSheetId() ? 'needs-reconnect' : 'disconnected');
      setSheetsError(e.message);
    }
  };

  const handleDisconnectSheets = () => {
    disconnectGoogle();
    setSheetsStatus('disconnected');
    setSheetsError(null);
  };

  const handleReconnectSheets = async () => {
    setSheetsStatus('connecting');
    setSheetsError(null);
    try {
      await reconnectGoogle();
      setSheetsStatus('connected');
      setSheetsError(null);
      sheetsConnectedRef.current = true;
    } catch(e) {
      console.error('Google Sheets reconnect failed:', e.message);
      setSheetsStatus('needs-reconnect');
      setSheetsError(e.message);
    }
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

  if (authState === 'login') {
    return (
      <div className="stage">
        <div className="phone-frame">
          <div className="phone-notch"/>
          <div className="phone-inner">
            <LoginScreen
              width={contentW} height={contentH} theme={tweaks.theme}
              onLogin={handleLogin}
              onSignUp={handleSignUp}
            />
          </div>
        </div>
        <div className="label">Forma · Sign in</div>
      </div>
    );
  }

  const hasGym = profile.hasGym !== false;
  const hasEventTraining = !!profile.hasEventTraining;

  const renderScreen = (s) => {
    if (onboardingStage === 'profile')
      return <ProfileSetupScreen width={contentW} height={contentH} theme={tweaks.theme}
               userId={currentUser?.id}
               onComplete={handleProfileSetupComplete} />;
    if (onboardingStage === 'goals')
      return <GoalsSetupScreen width={contentW} height={contentH} theme={tweaks.theme}
               userId={currentUser?.id}
               onComplete={handleGoalsSetupComplete} />;
    if (onboardingStage === 'intake')
      return <DeepQuestionnaireScreen width={contentW} height={contentH} theme={tweaks.theme}
               userId={currentUser?.id}
               goalsPayload={pendingGoalsPayload}
               onComplete={handleIntakeComplete} />;
    if (onboardingActive)
      return <OnboardingScreen width={contentW} height={contentH} theme={tweaks.theme}
               onComplete={completeOnboarding}
               initial={{ ...EMPTY_PROFILE, name: currentUser?.name || '', ...profile }} />;
    if (s === 'home')
      return <RefinedHome width={contentW} height={contentH} theme={tweaks.theme}
               profile={profile}
               plan={plan}
               completedSessions={completedSessions}
               onNav={navigate}
               onStartSession={startSession}
               activeSession={session.active ? session : null}
               onResumeSession={() => setScreen('gym-session')}
               onOpenAbout={() => setScreen('about-me')}
               hasGym={hasGym} hasEventTraining={hasEventTraining} />;
    if (s === 'gym-hub')
      return <GymHubScreen width={contentW} height={contentH} theme={tweaks.theme}
               plan={plan}
               todayIdx={plan.todayIdx}
               dayOfWeek={new Date().getDay() === 0 ? 6 : new Date().getDay() - 1}
               activities={activities}
               completedSessions={completedSessions}
               activeSession={session.active ? session : null}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining}
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
               onReorderSchedule={(newSched) => setPlan(p => ({ ...p, scheduleOverride: newSched }))}
               onImportSessions={importSessions}
               onEditSession={editSession} />;
    if (s === 'gym-split')
      return <SplitPickerScreen width={contentW} height={contentH} theme={tweaks.theme}
               plan={plan}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining}
               onBack={() => setScreen('gym-hub')}
               onSave={(d, schedule) => { setPlan(p => ({ ...p, splitDays: d, todayIdx: 0, scheduleOverride: schedule || null })); setScreen('gym-hub'); }}
               onNav={navigate} />;
    if (s === 'gym-edit') {
      const split = SPLITS[plan.splitDays] || SPLITS[3];
      if (!split) return null;
      const fallbackId = split.days[0].id;
      const resolvedDayId = editingDayId || fallbackId;
      if (!resolvedDayId) return null;
      return <SessionEditorScreen width={contentW} height={contentH} theme={tweaks.theme}
               plan={plan}
               dayId={resolvedDayId}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining}
               onBack={() => setScreen('gym-hub')}
               onSave={(updatedDay, newSchedule) => {
                 setPlan(p => ({
                   ...p,
                   overrides: { ...p.overrides, [updatedDay.id]: updatedDay },
                   ...(newSchedule ? { scheduleOverride: newSchedule } : {}),
                 }));
                 setScreen('gym-hub');
               }}
               onNav={navigate} />;
    }
    if (s === 'gym-day')
      return <DayActivitiesScreen width={contentW} height={contentH} theme={tweaks.theme}
               plan={plan}
               dayIdx={editingDayIdx ?? 1}
               activities={activities}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining}
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
      return <FoodScreen width={contentW} height={contentH} theme={tweaks.theme}
               foodLog={foodLog}
               userSettings={userSettings}
               plan={plan}
               activities={activities}
               completedSessions={completedSessions}
               customFoods={customFoods}
               onUpdateFood={updateFood}
               onSaveCustomFood={saveCustomFood}
               onNav={navigate}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining} />;
    if (s === 'about-me')
      return <AboutScreen width={contentW} height={contentH} theme={tweaks.theme}
               profile={profile}
               userSettings={userSettings}
               plan={plan}
               onSaveProfile={(p) => setProfile(prev => ({ ...prev, ...p }))}
               onSaveSettings={(s) => setUserSettings(prev => ({ ...prev, ...s }))}
               onBack={() => setScreen('gym-hub')}
               onNav={navigate}
               onSignOut={handleSignOut}
               tracksCycle={profile.tracksCycle}
               sheetsStatus={sheetsStatus}
               sheetsError={sheetsError}
               sheetUrl={getSheetUrl()}
               onConnectSheets={handleConnectSheets}
               onDisconnectSheets={handleDisconnectSheets}
               onReconnectSheets={handleReconnectSheets} />;
    if (s === 'triathlon')
      return <WeeklyOverviewScreen width={contentW} height={contentH} theme={tweaks.theme}
               onNav={navigate}
               profile={profile}
               plan={plan}
               activities={activities}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining}
               triathlonOverrides={triathlonOverrides}
               onUpdateOverrides={(next) => {
                 setTriathlonOverrides(next);
                 setTimeout(() => scheduleSave({ triathlonOverrides: next }), 0);
               }}
               triathlonDone={triathlonDone}
               onToggleDone={(next) => {
                 setTriathlonDone(next);
                 setTimeout(() => scheduleSave({ triathlonDone: next }), 0);
               }}
               onTapDay={(dayIdx) => { setEditingDayIdx(dayIdx); setScreen('gym-day'); }} />;
    if (s === 'gym-library')
      return <ExerciseLibraryScreen width={contentW} height={contentH} theme={tweaks.theme}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining}
               onBack={() => setScreen('gym-hub')}
               onNav={navigate} />;
    if (s === 'gym-session' || s === 'gym')
      return <GymSessionScreen width={contentW} height={contentH} theme={tweaks.theme}
               session={session} setSession={setSession}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining}
               onNav={navigate}
               onExit={() => { setSession({ active: false, paused: false, elapsed: 0, workout: '', queue: null }); setScreen('gym-hub'); }}
               onComplete={finishSession} />;
    if (s === 'gym-summary')
      return <GymSummaryScreen width={contentW} height={contentH} theme={tweaks.theme}
               session={lastSession}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining}
               onDone={closeSummary}
               onNav={navigate} />;
    return <PlaceholderScreen width={contentW} height={contentH} theme={tweaks.theme}
             screen={s} onNav={navigate} tracksCycle={profile.tracksCycle}
             hasGym={hasGym} hasEventTraining={hasEventTraining} />;
  };

  const screenLabel = onboardingStage === 'profile'
    ? 'PROFILE SETUP'
    : onboardingStage === 'goals'
      ? 'GOALS SETUP'
      : onboardingStage === 'intake'
        ? 'DEEP INTAKE'
        : onboardingActive
          ? 'ONBOARDING'
          : screen.replace(/^gym-?/, '').toUpperCase() || screen.toUpperCase();

  return (
    <>
      <div className="stage">
        <div className="phone-frame">
          <div className="phone-notch"/>
          <div className="phone-inner">
            <ErrorBoundary>
              <div key={onboardingActive ? 'onboarding' : screen} className="screen-anim">
                {renderScreen(screen)}
              </div>
            </ErrorBoundary>
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
            value={onboardingStage === 'profile' ? 'profile-setup' : onboardingStage === 'goals' ? 'goals-setup' : onboardingStage === 'intake' ? 'deep-intake' : onboardingActive ? 'onboarding' : screen}
            options={[
              { value: 'profile-setup', label: 'Profile Setup (Stage 1)' },
              { value: 'goals-setup',   label: 'Goals Setup (Stage 2)' },
              { value: 'deep-intake',   label: 'Deep Intake (Stage 3)' },
              { value: 'onboarding',    label: 'Legacy Onboarding' },
              { value: 'home',        label: 'Home' },
              { value: 'gym-hub',     label: 'Gym · Hub' },
              { value: 'gym-split',   label: 'Gym · Split picker' },
              { value: 'gym-edit',    label: 'Gym · Session editor' },
              { value: 'gym-day',     label: 'Gym · Day activities' },
              { value: 'gym-library', label: 'Gym · Exercise library' },
              { value: 'triathlon',   label: 'Weekly Overview' },
              { value: 'gym-session', label: 'Gym · In session' },
              { value: 'gym-summary', label: 'Gym · Summary' },
              { value: 'food',        label: 'Food · Weekly tracker' },
              { value: 'about-me',   label: 'About me' },
              { value: 'cycle',       label: 'Cycle (stub)' },
            ]}
            onChange={(v) => {
              if (v === 'profile-setup') { setOnboardingStage('profile'); setOnboarding(false); }
              else if (v === 'goals-setup') { setOnboardingStage('goals'); setOnboarding(false); }
              else if (v === 'deep-intake') { setOnboardingStage('intake'); setOnboarding(false); }
              else if (v === 'onboarding') { setOnboarding(true); setOnboardingStage(null); }
              else { setOnboarding(false); setOnboardingStage(null); setScreen(v); }
            }}
          />
        </TweakSection>
        <TweakSection label="Profile">
          <TweakButton label="Re-run onboarding" secondary
            onClick={() => { setOnboardingStage('profile'); setOnboarding(false); setScreen('home'); }} />
          <TweakButton label="Reset all data" secondary onClick={resetProfile} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

export default App;
