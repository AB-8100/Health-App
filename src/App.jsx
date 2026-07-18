import React from 'react';

import { loadFromCache, saveToCache, scheduleSaveAll } from './utils/storage';
import { supabase, loadUserData, saveUserData, saveUserGoals, saveUserIntake, loadUserGoals, loadUserIntake } from './utils/supabase';
import { generateTrainingPlanWithAI } from './utils/planGeneration';
import {
  initFromCache, getSheetsStatus, getSheetId, getSheetUrl,
  connectGoogle, disconnectGoogle, reconnectGoogle,
  loadFromSheets, saveToSheets,
} from './utils/googleSheets';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakButton } from './components/tweaks/TweaksPanel';
import { themes, RefinedHome } from './screens/HomeScreen';
import { GymSessionScreen, GymSummaryScreen, ActivityTimerScreen, PlaceholderScreen } from './screens/GymSessionScreen';
import { SPLITS, GymHubScreen, SplitPickerScreen, SessionEditorScreen, DayActivitiesScreen, buildQueueFromExerciseIds } from './screens/GymPlanScreens';
import { ExerciseLibraryScreen } from './screens/ExerciseScreens';
import { WeeklyOverviewScreen } from './screens/WeeklyOverviewScreen';
import { SessionDetailScreen } from './screens/SessionDetailScreen';
import { computeEventPhases, getTodayDateKey } from './data/eventPlan';
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
const DEFAULT_EVENT_PLAN = { meta: {}, phases: [], sessions: {} };

// ─── Onboarding helpers ───────────────────────────────────────────────────────

const DAY_KEY_TO_IDX = { monday:0, tuesday:1, wednesday:2, thursday:3, friday:4, saturday:5, sunday:6 };

const ACTIVITY_DEFS = {
  gym:      { type:'gym',   label:'Gym',     emoji:'🏋️', color:'#BE5A38', duration:60, isGym: true },
  running:  { type:'run',   label:'Run',     emoji:'🏃', color:'#0090FF', duration:45 },
  cycling:  { type:'cycle', label:'Cycle',   emoji:'🚴', color:'#9333EA', duration:60 },
  swimming: { type:'swim',  label:'Swim',    emoji:'🏊', color:'#0369A1', duration:45 },
  rowing:   { type:'other', label:'Row',     emoji:'🚣', color:'#4B5563', duration:45 },
  yoga:     { type:'yoga',  label:'Yoga',    emoji:'🧘', color:'#6D4AAF', duration:60 },
  hiit:     { type:'other', label:'HIIT',    emoji:'⚡', color:'#DC2626', duration:30 },
  walking:  { type:'walk',  label:'Walk',    emoji:'🚶', color:'#15803D', duration:60 },
  pilates:  { type:'other', label:'Pilates', emoji:'🤸', color:'#6D4AAF', duration:45 },
  climbing: { type:'other', label:'Climb',   emoji:'🧗', color:'#854D0E', duration:90 },
  dancing:  { type:'other', label:'Dancing', emoji:'💃', color:'#EC4899', duration:60 },
};

// Spreads selected activities across training days (capped at trainingDays.length).
// Gym sessions are not stored in the activities state — they're tracked via plan.splitDays.
// Returns { schedule, gymDayCount } so the caller can pick the right gym split.
function generateActivitySchedule(goalsPayload) {
  const { goals = [], trainingDays = [], gymAccess = false } = goalsPayload;
  const generalGoal = goals.find(g => g.type === 'general_fitness');
  let selectedIds = [...(generalGoal?.config?.activities || [])];

  // Ensure gym appears in the rotation whenever the user has gym access
  if (gymAccess && !selectedIds.includes('gym')) {
    selectedIds = ['gym', ...selectedIds];
  }

  if (!trainingDays.length) return { schedule: {}, gymDayCount: 0 };

  // Only gym (or nothing selected) → all training days count as gym sessions
  const nonGymActivities = selectedIds.filter(id => id !== 'gym');
  if (!nonGymActivities.length) {
    return { schedule: {}, gymDayCount: gymAccess ? trainingDays.length : 0 };
  }

  // Cycle through activity list (gym + others) across training days
  const schedule = {};
  let gymDayCount = 0;

  trainingDays.forEach((day, i) => {
    const dayIdx = DAY_KEY_TO_IDX[day];
    if (dayIdx === undefined) return;
    const actId = selectedIds[i % selectedIds.length];

    if (actId === 'gym') {
      gymDayCount++;
      // Gym days are represented by plan.splitDays — no entry needed in activities
    } else {
      const def = ACTIVITY_DEFS[actId];
      if (def) {
        schedule[dayIdx] = [{ id: `gen-${dayIdx}`, ...def, isGym: false, source: 'generated' }];
      }
    }
  });

  return { schedule, gymDayCount };
}

// Gym split is determined by how many gym sessions are in the weekly plan,
// not the total number of training days.
function getAutoSplitDays(gymDayCount) {
  if (!gymDayCount || gymDayCount <= 0) return null;
  if (gymDayCount === 1) return 1;
  if (gymDayCount === 2) return 2;
  if (gymDayCount === 3) return 3;
  if (gymDayCount === 4) return 4;
  return 5;
}

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

  const [authState, setAuthState]     = React.useState('loading');
  const [currentUser, setCurrentUser] = React.useState(null);
  const [sheetsStatus, setSheetsStatus] = React.useState('disconnected');
  const [sheetsError, setSheetsError] = React.useState(null);
  const sheetsConnectedRef = React.useRef(false);
  const [screen, setScreen]               = React.useState('gym-hub');
  const [profile, setProfileRaw]          = React.useState(EMPTY_PROFILE);
  const [onboardingActive, setOnboarding] = React.useState(false);
  // 'profile' = Stage 1 | 'goals' = Stage 2 | 'intake' = Stage 3 | null = main app
  const [onboardingStage, setOnboardingStage] = React.useState(null);
  // Holds the Stage 2 payload while Stage 3 (intake) is shown
  const [pendingGoalsPayload, setPendingGoalsPayload] = React.useState(null);
  // Persisted Stage 2 / Stage 3 answers, reloaded from Supabase — kept around
  // (independent of the ephemeral pendingGoalsPayload above) so the AI plan
  // generator can be re-run any time from About Me, not just right after
  // finishing onboarding.
  const [goalsPayload, setGoalsPayload] = React.useState(null);
  const [intakePayload, setIntakePayload] = React.useState(null);
  // Whether Stage 3 was opened from the main app (not initial onboarding)
  const screenBeforeIntakeRef = React.useRef(null);
  // True when the user has a saved intake draft (started but not finished)
  const [intakeDraft, setIntakeDraft] = React.useState(false);
  const [plan, setPlanRaw]                = React.useState(DEFAULT_PLAN);
  const [userSettings, setSettingsRaw]    = React.useState(DEFAULT_SETTINGS);
  const [editingDayId, setEditingDayId]   = React.useState(null);
  const [editingDayIdx, setEditingDayIdx] = React.useState(null);
  const [viewingDay, setViewingDay] = React.useState(null);
  const [activities, setActivities]             = React.useState({});
  const [eventOverrides, setEventOverrides] = React.useState({});
  const [preselectedQueues, setPreselectedQueues] = React.useState({});
  const [planSessionsDone, setPlanSessionsDone]           = React.useState({});
  const [eventPlan, setEventPlan]         = React.useState(DEFAULT_EVENT_PLAN);
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

    try {
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
        setEventOverrides({});
        setPreselectedQueues({});
        setPlanSessionsDone({});
        setEventPlan(DEFAULT_EVENT_PLAN);
        setCustomFoods([]);
        // Stage 1: collect profile basics before anything else
        setOnboardingStage('profile');
      } else if (loadedProfile && !loadedProfile.goal) {
        // Has profile but no goal set yet — send to Stage 2
        setOnboardingStage('goals');
      }

      // Best-effort — used only to power the "Generate my plan with AI"
      // action from About Me; missing/failed loads just disable that button.
      try {
        const [savedGoals, savedIntake] = await Promise.all([
          loadUserGoals(sbUser.id),
          loadUserIntake(sbUser.id),
        ]);
        if (savedGoals)  setGoalsPayload(savedGoals);
        if (savedIntake) setIntakePayload(savedIntake);
      } catch (e) {
        console.warn('Forma: goals/intake load failed', e);
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
      if (hasAnyData && loadedProfile) {
        setScreen('weekly');
      }
    } catch (e) {
      console.error('Forma: bootstrapUser failed', e);
    } finally {
      setAuthState('app');
    }
  }, []);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) bootstrapUser(data.session);
    });
    const timeout = setTimeout(() => setAuthState(s => s === 'loading' ? 'login' : s), 6000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(timeout);
      // Supabase fires this listener on TOKEN_REFRESHED/USER_UPDATED too —
      // those happen automatically in the background while the user is
      // active in the app (a refresh every ~50min, plus on tab focus).
      // Re-running the full bootstrap for them re-fetches from Supabase and
      // overwrites in-memory state with whatever was last saved there, which
      // can race with an in-flight local save and make recent edits (e.g. a
      // dragged session) appear to revert. Only actual sign-in transitions
      // need the full reload.
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) bootstrapUser(session);
        else setAuthState('login');
      } else if (event === 'SIGNED_OUT') {
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
    if (data.eventOverrides)   setEventOverrides(data.eventOverrides);
    if (data.preselectedQueues) setPreselectedQueues(data.preselectedQueues);
    if (data.planSessionsDone)        setPlanSessionsDone(data.planSessionsDone);
    if (data.eventPlan)        setEventPlan(data.eventPlan);
    if (data.customFoods)          setCustomFoods(data.customFoods);
    setOnboarding(!data.profile || !data.profile.name);
  };

  const buildSnapshot = (overrides = {}) => ({
    profile, plan, userSettings,
    completedSessions, foodLog, activities, customFoods,
    eventOverrides, preselectedQueues, planSessionsDone, eventPlan,
    savedAt: new Date().toISOString(),
    ...overrides,
  });

  const currentUserIdRef = React.useRef(null);
  React.useEffect(() => { currentUserIdRef.current = currentUser?.id || null; }, [currentUser]);

  // Sync intakeDraft from localStorage whenever the user or onboarding stage changes
  React.useEffect(() => {
    if (!currentUser?.id) { setIntakeDraft(false); return; }
    try {
      const raw = localStorage.getItem(`forma_intake_${currentUser.id}`);
      if (!raw) { setIntakeDraft(false); return; }
      const parsed = JSON.parse(raw);
      setIntakeDraft(parsed.status === 'draft');
    } catch { setIntakeDraft(false); }
  }, [currentUser?.id, onboardingStage]);

  const scheduleSave = React.useCallback((overrides = {}) => {
    const snapshot = buildSnapshot(overrides);
    scheduleSaveAll(snapshot, sheetsConnectedRef.current, currentUserIdRef.current);
  }, [profile, plan, userSettings, completedSessions, foodLog, activities, customFoods, eventOverrides, preselectedQueues, planSessionsDone, eventPlan]);

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
    setEventOverrides({});
    setPreselectedQueues({});
    setPlanSessionsDone({});
    setEventPlan(DEFAULT_EVENT_PLAN);
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
  const handleGoalsSetupComplete = (goalsSetupPayload) => {
    // Persist goals to Supabase
    if (currentUserIdRef.current) {
      saveUserGoals(currentUserIdRef.current, goalsSetupPayload)
        .catch(e => console.warn('Forma: goals save failed', e));
    }
    // Hold onto the payload so Stage 3 can read goal types for conditional sections
    setPendingGoalsPayload(goalsSetupPayload);
    setGoalsPayload(goalsSetupPayload);
    setOnboardingStage('intake');
  };

  // Called when Stage 3 (DeepQuestionnaire) completes or is skipped
  const handleIntakeComplete = (intakePayload, skipped) => {
    const gp = pendingGoalsPayload || {};
    const primaryGoalType = gp.goals?.[0]?.type ?? '';
    const hasEvent = gp.goals?.some(g => g.type === 'event_race');
    const hasTrainingActivities =
      gp.goals?.some(g => g.type === 'general_fitness' && (g.config?.activities || []).length > 0) ||
      gp.goals?.some(g => g.type === 'sport_activity' && g.config?.sportType) ||
      (gp.regularSports || []).length > 0;

    const gymAccess = gp.gymAccess ?? profile.hasGym;
    const { schedule: initialActivities, gymDayCount } = generateActivitySchedule({ ...gp, gymAccess });
    const autoSplitDays = getAutoSplitDays(gymDayCount);

    const updatedProfile = {
      ...profile,
      goal: primaryGoalType,
      hasGym: gymAccess,
      hasEventTraining: hasEvent,
      hasTrainingActivities: !!hasTrainingActivities,
      splitDays: autoSplitDays,
      intakeCompleted: !skipped,
    };

    // Persist intake to Supabase
    if (currentUserIdRef.current) {
      saveUserIntake(currentUserIdRef.current, intakePayload)
        .catch(e => console.warn('Forma: intake save failed', e));
    }
    setIntakePayload(intakePayload);

    setPendingGoalsPayload(null);

    // If opened from the main app (not initial onboarding), apply the newly
    // computed split/activity schedule (same as completeOnboarding does) and
    // return — previously this only saved `profile`, so the split/activities
    // it just generated were silently dropped and the weekly plan kept
    // showing rest days after navigating away and back.
    if (screenBeforeIntakeRef.current !== null) {
      const returnTo = screenBeforeIntakeRef.current;
      screenBeforeIntakeRef.current = null;
      const nextPlan = { ...plan, splitDays: autoSplitDays };
      const nextActivities = { ...activities, ...initialActivities };
      setProfileRaw(updatedProfile);
      setPlanRaw(nextPlan);
      setActivities(nextActivities);
      setOnboardingStage(null);
      setIntakeDraft(skipped);
      setTimeout(() => scheduleSave({ profile: updatedProfile, plan: nextPlan, activities: nextActivities }), 0);
      setScreen(returnTo);
    } else {
      completeOnboarding(updatedProfile, initialActivities);
    }
  };

  // Opens Stage 3 from within the main app (banner tap on weekly or profile screens)
  const handleStartQuestionnaire = (fromScreen) => {
    screenBeforeIntakeRef.current = fromScreen || screen;
    // Build a minimal goalsPayload from the current profile so intake steps are
    // correct. `profile.goal` is the older single-select field and can never
    // be 'event_race', so an existing uploaded event plan must be carried
    // forward explicitly here — otherwise handleIntakeComplete recomputes
    // hasEventTraining from this reconstructed payload and wipes it out.
    const goalsFromProfile = profile.goal
      ? [{ type: profile.goal, config: {} }]
      : [];
    if (profile.hasEventTraining) goalsFromProfile.push({ type: 'event_race', config: {} });
    // Layer in richer scheduling/facility fields from the persisted goalsPayload
    // (if loaded) so the AI plan generator has more to work with — but keep
    // `goals`/`gymAccess` computed fresh from `profile` above, since those are
    // the fields most likely to have changed since the saved payload.
    setPendingGoalsPayload({ ...(goalsPayload || {}), goals: goalsFromProfile, gymAccess: profile.hasGym });
    setOnboarding(false);
    setOnboardingStage('intake');
  };

  // Called when the user exits Stage 3 mid-flow (saves draft, returns to previous screen)
  const handleExitQuestionnaire = () => {
    setOnboardingStage(null);
    setIntakeDraft(true);
    setPendingGoalsPayload(null);
    const returnTo = screenBeforeIntakeRef.current || 'weekly';
    screenBeforeIntakeRef.current = null;
    setScreen(returnTo);
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
    setEventOverrides({});
    setPreselectedQueues({});
    setPlanSessionsDone({});
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

    // A user can pre-select today's exercises ahead of time from the Weekly
    // Overview day detail — if they did, use that instead of the split day's
    // default exercise list.
    const todayPreselect = preselectedQueues[getTodayDateKey()];
    const queue = (todayPreselect?.kind === 'gym' && todayPreselect.exercises?.length)
      ? buildQueueFromExerciseIds(todayPreselect.exercises)
      : buildQueueFromExerciseIds(
          ['compound','accessory','core','mobility'].flatMap(sec => today[sec] || [])
        );

    setSession(s => ({
      ...s, active: true, paused: false, elapsed: 0, exIdx: 0, kind: 'gym',
      workout: today.name + ' day',
      queue: queue.length ? queue : null,
    }));
    setScreen('gym-session');
  };

  // Starts a plain elapsed-time timer for a non-gym session (run, swim, a
  // scheduled event-plan discipline, etc.) — no exercise queue, just
  // start/pause/stop, unlike the gym flow above.
  const startActivitySession = (act) => {
    setSession({
      active: true, paused: false, elapsed: 0, kind: 'activity',
      workout: act?.label || act?.type || 'Session', type: act?.type || null, queue: null,
    });
    setScreen('activity-session');
  };

  // Conditioning sessions log like a gym session — pick activities, then log
  // sets/reps against each one — rather than the plain elapsed-time timer
  // every other activity type uses.
  const startConditioningSession = (act, exerciseIds = []) => {
    const queue = buildQueueFromExerciseIds(exerciseIds);
    setSession({
      active: true, paused: false, elapsed: 0, exIdx: 0, kind: 'conditioning',
      workout: act?.label || 'Conditioning', type: 'conditioning',
      queue: queue.length ? queue : null,
    });
    setScreen('gym-session');
  };

  // Saves a date-specific pre-selection of exercises for a gym or
  // conditioning day (made from the Weekly Overview day detail), so that
  // when the session for that date is actually started, it seeds its queue
  // from these picks instead of the default template.
  const savePreselectedQueue = (dateKey, payload) => setPreselectedQueues(prev => {
    const next = { ...prev, [dateKey]: { ...payload, updatedAt: new Date().toISOString() } };
    setTimeout(() => scheduleSave({ preselectedQueues: next }), 0);
    return next;
  });

  const finishActivitySession = ({ distance = null, distanceUnit = 'km', poolLengthM = null, lengths = null, rpe = null } = {}) => {
    const completed = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      endedAt: Date.now(),
      workout: session.workout,
      type: session.type || null,
      elapsed: session.elapsed,
      distance,
      distanceUnit,
      poolLengthM,
      lengths,
      rpe,
      queue: null,
    };
    setCompletedSessions(prev => {
      const next = [...prev, completed];
      setTimeout(() => scheduleSave({ completedSessions: next }), 0);
      return next;
    });
    setSession({ active: false, paused: false, elapsed: 0, workout: '', queue: null });
    setScreen('gym-hub');
  };

  const discardActivitySession = () => {
    setSession({ active: false, paused: false, elapsed: 0, workout: '', queue: null });
    setScreen('gym-hub');
  };

  const markSessionComplete = ({ elapsed = 0, distance = null, distanceUnit = 'km', poolLengthM = null, lengths = null, workout = null, type = null, date = null, rpe = null } = {}) => {
    let workoutName = workout;
    if (!workoutName) {
      const split = plan.splitDays ? SPLITS[plan.splitDays] : null;
      const todayBase = split?.days?.[(plan.todayIdx || 0) % split.days.length];
      const today = (plan.overrides && todayBase && plan.overrides[todayBase.id]) || todayBase;
      workoutName = today ? today.name + ' day' : 'Session';
    }
    const completed = {
      id: Date.now().toString(),
      date: date || new Date().toISOString(),
      endedAt: Date.now(),
      active: false,
      manuallyCompleted: true,
      workout: workoutName,
      type,
      elapsed,
      distance,
      distanceUnit,
      poolLengthM,
      lengths,
      rpe,
      queue: null,
    };
    setCompletedSessions(prev => {
      const next = [...prev, completed];
      setTimeout(() => scheduleSave({ completedSessions: next }), 0);
      return next;
    });
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

  const closeSummary = ({ notes, rpe } = {}) => {
    if (lastSession?.id && (notes !== undefined || rpe !== undefined)) {
      setCompletedSessions(prev => {
        const next = prev.map(s => s.id === lastSession.id ? { ...s, ...(notes !== undefined ? { notes } : {}), ...(rpe !== undefined ? { rpe } : {}) } : s);
        setTimeout(() => scheduleSave({ completedSessions: next }), 0);
        return next;
      });
    }
    setSession({ active: false, paused: false, elapsed: 0, workout: '', queue: null });
    setScreen('gym-hub');
  };

  const deleteSession = (id) => setCompletedSessions(prev => {
    const next = prev.filter(s => s.id !== id);
    setTimeout(() => scheduleSave({ completedSessions: next }), 0);
    return next;
  });

  // Removes a not-yet-logged session from the Weekly Overview — unlike
  // deleteSession above (which removes an already-completed entry), this
  // pulls the scheduled session itself out of whichever store it lives in,
  // so it stops being shown at all. Then returns to the Weekly Overview so
  // the day list re-reads from the now-updated state.
  const removeScheduledSession = (sess) => {
    if (sess.source === 'gym') {
      const split = plan.splitDays ? SPLITS[plan.splitDays] : null;
      if (!split) return;
      const splitIds = new Set(split.days.map(d => d.id));
      const overrideValid = plan.scheduleOverride?.every(s => s === '—' || splitIds.has(s));
      const sched = [...((overrideValid ? plan.scheduleOverride : null) || split.schedule)];
      sched[sess.dayIdx] = '—';
      setPlan(p => ({ ...p, scheduleOverride: sched }));
    } else if (sess.source === 'event_plan') {
      const dk = viewingDay?.dk;
      if (!dk) return;
      const existing = Object.prototype.hasOwnProperty.call(eventOverrides, dk)
        ? eventOverrides[dk]
        : (hasEventTraining ? (eventPhasePlan.sessions[dk] || []).filter(s => s.type !== 'rest') : []);
      const next = { ...eventOverrides, [dk]: existing.filter(s => s !== sess.raw) };
      setEventOverrides(next);
      setTimeout(() => scheduleSave({ eventOverrides: next }), 0);
    } else if (sess.source === 'activity') {
      const next = { ...activities, [sess.dayIdx]: (activities[sess.dayIdx] || []).filter(a => a !== sess.actData) };
      setActivities(next);
      setTimeout(() => scheduleSave({ activities: next }), 0);
    }
    setScreen('weekly');
  };

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
    if (target === 'gym') setScreen(session.active ? (session.kind === 'activity' ? 'activity-session' : 'gym-session') : 'gym-hub');
    else setScreen(target);
  };

  const completeOnboarding = (newProfile, initialActivities = {}) => {
    const newPlan = { splitDays: newProfile.splitDays ?? null, todayIdx: 0, overrides: {} };
    setProfileRaw(newProfile);
    setPlanRaw(newPlan);
    setSettingsRaw(DEFAULT_SETTINGS);
    setActivities(initialActivities);
    const snapshot = { profile: newProfile, plan: newPlan, userSettings: DEFAULT_SETTINGS,
                       completedSessions: [], foodLog: {}, activities: initialActivities,
                       savedAt: new Date().toISOString() };
    saveToCache(snapshot, currentUserIdRef.current);
    if (sheetsConnectedRef.current) saveToSheets(snapshot);
    if (currentUserIdRef.current) {
      saveUserData(currentUserIdRef.current, snapshot).catch(e => console.warn('Forma: onboarding save failed', e));
    }
    setOnboarding(false);
    setOnboardingStage(null);
    setScreen('weekly');
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

  const eventPhasePlan = React.useMemo(() => {
    const totalWeeks = eventPlan.meta?.totalWeeks || profile.eventTotalWeeks || 18;
    const phases = eventPlan.phases?.length ? eventPlan.phases : computeEventPhases(totalWeeks);
    return { phases, totalWeeks, startDate: eventPlan.meta?.startDate || null, sessions: eventPlan.sessions || {} };
  }, [eventPlan, profile.eventTotalWeeks]);

  // Replaces the whole event training plan from an uploaded spreadsheet, and
  // wipes every other source that feeds sessions into the Weekly Overview
  // (gym split, manually-added activities, per-day overrides/completion
  // state) so the planner shows nothing but the freshly uploaded plan.
  const handleUploadTrainingPlan = (parsed) => {
    setEventPlan(parsed);
    setEventOverrides({});
    setPreselectedQueues({});
    setPlanSessionsDone({});
    setActivities({});
    setPlanRaw(DEFAULT_PLAN);
    const nextProfile = {
      ...profile,
      hasEventTraining: true,
      eventTotalWeeks: parsed.meta?.totalWeeks || profile.eventTotalWeeks,
    };
    setProfileRaw(nextProfile);
    const overrides = {
      eventPlan: parsed, eventOverrides: {}, preselectedQueues: {}, planSessionsDone: {}, activities: {},
      plan: DEFAULT_PLAN, profile: nextProfile,
    };
    setTimeout(() => scheduleSave(overrides), 0);

    // scheduleSave's remote write is fire-and-forget (debounced local cache
    // + best-effort Supabase sync via scheduleSaveAll, whose failures are
    // only console.warn'd) — a failure there is otherwise invisible: the
    // plan looks uploaded, but never actually reaches Supabase, and the next
    // real reload (or an evicted local cache) silently reverts to no plan /
    // rest days. Explicitly await the write here so the caller (AboutScreen)
    // can surface a real error instead of assuming success.
    if (!currentUserIdRef.current) return Promise.resolve();
    return saveUserData(currentUserIdRef.current, buildSnapshot(overrides));
  };

  // Generates a training plan via the Claude API (through the
  // generate-training-plan edge function) from the athlete's saved goals +
  // intake answers, then applies it exactly like an uploaded spreadsheet
  // would via handleUploadTrainingPlan. Throws on failure so callers
  // (DeepQuestionnaireScreen's done step, AboutScreen's regenerate button)
  // can show their own loading/error state.
  const generateAndApplyPlan = async (gp, intakeData) => {
    const parsed = await generateTrainingPlanWithAI({ goalsPayload: gp, intake: intakeData });
    await handleUploadTrainingPlan(parsed);
    return parsed;
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
  const hasTrainingActivities = !!profile.hasTrainingActivities;

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
               onComplete={handleIntakeComplete}
               onGeneratePlan={(intakeDraft) => generateAndApplyPlan(pendingGoalsPayload, intakeDraft)}
               onExit={screenBeforeIntakeRef.current !== null ? handleExitQuestionnaire : undefined} />;
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
               onResumeSession={() => setScreen(session.kind === 'activity' ? 'activity-session' : 'gym-session')}
               onOpenAbout={() => setScreen('about-me')}
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities} />;
    if (s === 'gym-hub')
      return <GymHubScreen width={contentW} height={contentH} theme={tweaks.theme}
               plan={plan}
               todayIdx={plan.todayIdx}
               dayOfWeek={new Date().getDay() === 0 ? 6 : new Date().getDay() - 1}
               activities={activities}
               completedSessions={completedSessions}
               activeSession={session.active ? session : null}
               eventOverrides={eventOverrides}
               eventPhasePlan={eventPhasePlan}
               preselectedQueues={preselectedQueues}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
               onNav={navigate}
               onStartSession={startSession}
               onStartActivity={startActivitySession}
               onStartConditioning={startConditioningSession}
               onMarkComplete={markSessionComplete}
               onResumeSession={() => setScreen(session.kind === 'activity' ? 'activity-session' : 'gym-session')}
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
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
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
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
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
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
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
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities} />;
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
               onSetupTrainingPlan={() => { setOnboardingStage('goals'); setOnboarding(false); }}
               tracksCycle={profile.tracksCycle}
               sheetsStatus={sheetsStatus}
               sheetsError={sheetsError}
               sheetUrl={getSheetUrl()}
               onConnectSheets={handleConnectSheets}
               onDisconnectSheets={handleDisconnectSheets}
               onReconnectSheets={handleReconnectSheets}
               intakeCompleted={!!profile.intakeCompleted}
               intakeDraft={intakeDraft}
               onStartQuestionnaire={() => handleStartQuestionnaire('about-me')}
               eventPlan={eventPlan}
               onUploadTrainingPlan={handleUploadTrainingPlan}
               goalsPayload={goalsPayload}
               intake={intakePayload}
               onGenerateAIPlan={() => generateAndApplyPlan(goalsPayload, intakePayload)} />;
    if (s === 'weekly')
      return <WeeklyOverviewScreen width={contentW} height={contentH} theme={tweaks.theme}
               onNav={navigate}
               profile={profile}
               plan={plan}
               activities={activities}
               onUpdateActivities={(next) => {
                 setActivities(next);
                 setTimeout(() => scheduleSave({ activities: next }), 0);
               }}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
               eventOverrides={eventOverrides}
               onUpdateOverrides={(next) => {
                 setEventOverrides(next);
                 setTimeout(() => scheduleSave({ eventOverrides: next }), 0);
               }}
               planSessionsDone={planSessionsDone}
               onToggleDone={(next) => {
                 setPlanSessionsDone(next);
                 setTimeout(() => scheduleSave({ planSessionsDone: next }), 0);
               }}
               eventPhasePlan={eventPhasePlan}
               onTapDay={(day) => { setViewingDay(day); setScreen('session-detail'); }}
               onUpdatePlan={(newSched) => setPlan(p => ({ ...p, scheduleOverride: newSched }))}
               intakeCompleted={!!profile.intakeCompleted}
               intakeDraft={intakeDraft}
               onStartQuestionnaire={() => handleStartQuestionnaire('weekly')}
               completedSessions={completedSessions} />;
    if (s === 'session-detail')
      return <SessionDetailScreen width={contentW} height={contentH} theme={tweaks.theme}
               day={viewingDay}
               completedSessions={completedSessions}
               onBack={() => setScreen('weekly')}
               onNav={navigate}
               onStartActivity={(sess) => startActivitySession(sess)}
               onStartConditioning={startConditioningSession}
               onGoToGymTab={() => setScreen('gym-hub')}
               onMarkComplete={markSessionComplete}
               onViewSummary={viewSummary}
               onEditSession={editSession}
               onDeleteSession={deleteSession}
               onRemoveSession={removeScheduledSession}
               preselectedQueues={preselectedQueues}
               onSavePreselectedQueue={savePreselectedQueue}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities} />;
    if (s === 'gym-library')
      return <ExerciseLibraryScreen width={contentW} height={contentH} theme={tweaks.theme}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
               onBack={() => setScreen('gym-hub')}
               onNav={navigate} />;
    if (s === 'gym-session' || s === 'gym')
      return <GymSessionScreen width={contentW} height={contentH} theme={tweaks.theme}
               session={session} setSession={setSession}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
               onNav={navigate}
               onExit={() => { setSession({ active: false, paused: false, elapsed: 0, workout: '', queue: null }); setScreen('gym-hub'); }}
               onComplete={finishSession} />;
    if (s === 'activity-session')
      return <ActivityTimerScreen width={contentW} height={contentH} theme={tweaks.theme}
               session={session} setSession={setSession}
               onFinish={finishActivitySession}
               onDiscard={discardActivitySession}
               onNav={navigate}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities} />;
    if (s === 'gym-summary')
      return <GymSummaryScreen width={contentW} height={contentH} theme={tweaks.theme}
               session={lastSession}
               tracksCycle={profile.tracksCycle}
               hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
               onDone={closeSummary}
               onNav={navigate} />;
    return <PlaceholderScreen width={contentW} height={contentH} theme={tweaks.theme}
             screen={s} onNav={navigate} tracksCycle={profile.tracksCycle}
             hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities} />;
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
              { value: 'weekly',   label: 'Weekly Overview' },
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
