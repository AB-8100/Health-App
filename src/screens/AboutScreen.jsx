import React from 'react';
import themes from '../data/themes';
import { getCurrentPlanWeek, computeEventPhases } from '../data/eventPlan';
import { DraftPlanBanner } from '../components/SharedUI';
import { parseTrainingPlanWorkbook } from '../utils/trainingPlanImport';
import { isSupportedAIRaceType } from '../utils/planPrompt';
const CONNECTED_SERVICES = [
  { id: 'strava',   name: 'Strava',       scope: 'Runs · Rides · Workouts',  color: '#FC5200', glyph: 'S' },
  { id: 'apple',    name: 'Apple Health', scope: 'Steps · Sleep · Weight',   color: '#000',    glyph: 'A' },
  { id: 'oura',     name: 'Oura',         scope: 'Sleep · HRV · Recovery',   color: '#1C1917', glyph: 'O' },
  { id: 'mfp',      name: 'MyFitnessPal', scope: 'Meals · Macros · Calories',color: '#0072CE', glyph: 'M' },
  { id: 'garmin',   name: 'Garmin',       scope: 'Workouts · HR · GPS',      color: '#007CC3', glyph: 'G' },
  { id: 'flo',      name: 'Flo',          scope: 'Period & cycle history',   color: '#E85DA1', glyph: 'F' },
];

const GOAL_LABELS = {
  strength: 'Build strength',
  muscle: 'Build muscle',
  'fat-loss': 'Lose fat',
  active: 'Stay active',
  flexibility: 'Mobility & flow',
};

// Simple editable field row
function FieldRow({ label, value, unit, type = 'number', step, onChange, theme }) {
  const t = themes[theme];
  const [editing, setEditing] = React.useState(false);
  const [local, setLocal] = React.useState(String(value));

  const commit = () => {
    const v = type === 'number' ? Number(local) : local;
    if (type === 'number' && !isNaN(v) && v > 0) onChange(v);
    else if (type === 'text' && local.trim()) onChange(local.trim());
    setEditing(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 0', borderBottom: `1px solid ${t.border}`,
    }}>
      <span style={{ fontSize: 13, color: t.text }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {editing ? (
          <>
            <input
              autoFocus
              value={local}
              type={type}
              step={step}
              onChange={(e) => setLocal(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              style={{
                width: 80, padding: '4px 8px', borderRadius: 7,
                border: `1px solid ${t.accent}`, background: t.surface2,
                fontFamily: t.mono, fontSize: 13, color: t.text, outline: 'none',
                textAlign: 'right',
              }}
            />
            {unit && <span style={{ fontSize: 11, color: t.text3 }}>{unit}</span>}
          </>
        ) : (
          <>
            <span style={{ fontFamily: t.mono, fontSize: 13, color: t.text2 }}>
              {value}{unit ? ` ${unit}` : ''}
            </span>
            <button onClick={() => { setLocal(String(value)); setEditing(true); }} style={{
              padding: '3px 8px', borderRadius: 6, background: 'transparent',
              border: `1px solid ${t.border}`, color: t.accent,
              fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
            }}>Edit</button>
          </>
        )}
      </div>
    </div>
  );
}

// Section card wrapper
function Section({ title, children, theme }) {
  const t = themes[theme];
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18,
      padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
        color: t.text3, marginBottom: 10, fontWeight: 500,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function AboutScreen({
  width = 390, height = 820, theme = 'light',
  profile = {}, userSettings = {}, plan = {},
  onSaveProfile, onSaveSettings,
  onBack, onNav, onSignOut, onSetupTrainingPlan,
  tracksCycle = true,
  sheetsStatus = 'disconnected', sheetsError = null, sheetUrl = null,
  onConnectSheets, onDisconnectSheets, onReconnectSheets,
  intakeCompleted = false,
  intakeDraft = false,
  onStartQuestionnaire,
  eventPlan = { meta: {}, phases: [], sessions: {} },
  onUploadTrainingPlan,
  goalsPayload,
  intake,
  onGenerateAIPlan,
}) {
  const t = themes[theme];

  const [localProfile, setLP] = React.useState({ ...profile });
  const [localSettings, setLS] = React.useState({
    dailyCaloriesBase: userSettings.dailyCaloriesBase || 1500,
    gymDayBoost: userSettings.gymDayBoost || 250,
    weightUnit: userSettings.weightUnit || 'kg',
    heightUnit: userSettings.heightUnit || 'cm',
    ...userSettings,
  });

  // Simulated connected state — in production this would be OAuth status
  const [connected, setConnected] = React.useState(
    new Set(profile.connected || [])
  );

  const updateProfile = (key, val) => {
    const updated = { ...localProfile, [key]: val };
    setLP(updated);
    if (onSaveProfile) onSaveProfile(updated);
  };

  const updateSettings = (key, val) => {
    const updated = { ...localSettings, [key]: val };
    setLS(updated);
    if (onSaveSettings) onSaveSettings(updated);
  };

  const toggleService = (id) => {
    const next = new Set(connected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setConnected(next);
    updateProfile('connected', [...next]);
  };

  const hasGym          = localProfile.hasGym !== false;
  const hasEventTraining = !!localProfile.hasEventTraining;
  const gymDays          = hasGym && plan.splitDays ? plan.splitDays : 0;
  const eventDays        = hasEventTraining ? 5 : 0;
  const totalWeeklySessions = gymDays + eventDays;
  const totalPlanWeeks   = eventPlan.meta?.totalWeeks || localProfile.eventTotalWeeks || 18;
  const currentWeek      = getCurrentPlanWeek(eventPlan.meta?.startDate, totalPlanWeeks);
  const phaseMeta        = eventPlan.phases?.length ? eventPlan.phases : computeEventPhases(totalPlanWeeks);
  const currentPhase     = phaseMeta.find(p => currentWeek >= p.weeks[0] && currentWeek <= p.weeks[1]) || phaseMeta[0];
  const planDone         = !!localProfile.goal;

  const goals = ['strength', 'muscle', 'fat-loss', 'active', 'flexibility'];

  // ── Training plan upload ──────────────────────────────────────────────────
  const fileInputRef = React.useRef(null);
  const [importState, setImportState] = React.useState('idle'); // idle | parsing | confirm | error
  const [importError, setImportError] = React.useState(null);
  const [pendingPlan, setPendingPlan] = React.useState(null);

  const handlePickFile = () => fileInputRef.current?.click();

  // onUploadTrainingPlan already persists profile.hasEventTraining upstream —
  // this just mirrors it into localProfile, which (unlike the other fields on
  // this screen) is only ever seeded from the `profile` prop at mount, so
  // without this it'd keep showing "no plan" here until the screen remounts.
  //
  // onUploadTrainingPlan returns a promise that resolves once the plan has
  // actually been confirmed saved to Supabase (not just applied locally) —
  // await it so a save failure (e.g. offline, or a backend error) surfaces
  // as a real error here instead of silently looking like it worked and
  // then reverting on the next reload.
  const applyUploadedPlan = async (parsed) => {
    setLP(prev => ({ ...prev, hasEventTraining: true, eventTotalWeeks: parsed.meta?.totalWeeks || prev.eventTotalWeeks }));
    try {
      await onUploadTrainingPlan?.(parsed);
      setImportState('idle');
    } catch (err) {
      setImportError(
        `Your plan is showing, but saving it to your account failed (${err.message || 'unknown error'}). ` +
        `It may not survive a reload — try uploading again once you're back online.`
      );
      setImportState('error');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportState('parsing');
    try {
      const parsed = await parseTrainingPlanWorkbook(file);
      if (hasEventTraining) {
        setPendingPlan(parsed);
        setImportState('confirm');
      } else {
        await applyUploadedPlan(parsed);
      }
    } catch (err) {
      setImportError(err.message || "Couldn't read that file — check it matches the expected format.");
      setImportState('error');
    }
  };

  const confirmImport = () => {
    const parsed = pendingPlan;
    setPendingPlan(null);
    applyUploadedPlan(parsed);
  };
  const cancelImport = () => {
    setPendingPlan(null);
    setImportState('idle');
  };

  // ── AI plan generation ─────────────────────────────────────────────────────
  const raceType = goalsPayload?.goals?.find(g => g.type === 'event_race')?.config?.raceType;
  const canGenerateAI = isSupportedAIRaceType(raceType) && typeof onGenerateAIPlan === 'function';
  const [aiGenState, setAiGenState] = React.useState('idle'); // idle | confirm | working | error
  const [aiGenError, setAiGenError] = React.useState(null);

  const runGenerateAI = async () => {
    setAiGenState('working');
    setAiGenError(null);
    try {
      await onGenerateAIPlan();
      setLP(prev => ({ ...prev, hasEventTraining: true }));
      setAiGenState('idle');
    } catch (err) {
      setAiGenError(err.message || 'Something went wrong generating your plan.');
      setAiGenState('error');
    }
  };
  const handleGenerateAIClick = () => {
    if (hasEventTraining) setAiGenState('confirm');
    else runGenerateAI();
  };
  const cancelGenerateAI = () => setAiGenState('idle');

  return (
    <div style={{
      width, height, background: t.bg, fontFamily: t.sans, color: t.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      {/* Status bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 22px 8px', fontSize: 14, fontWeight: 600, color: t.text,
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '2px 16px 12px', borderBottom: `1px solid ${t.border}`,
      }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, borderRadius: 9, background: 'transparent',
          border: `1px solid ${t.border}`, color: t.text, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>←</button>
        <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text }}>About me</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 16px' }} className="phone-scroll">

        {/* Profile avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `linear-gradient(135deg, ${t.accent}, #6D4AAF)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: t.serif, fontSize: 24, color: '#fff', flexShrink: 0,
          }}>
            {(localProfile.name || 'U').charAt(0)}
          </div>
          <div>
            <div style={{ fontFamily: t.serif, fontSize: 22, color: t.text, lineHeight: 1 }}>
              {localProfile.name || 'Your name'}
            </div>
            <div style={{ fontSize: 11, color: t.text3, marginTop: 3 }}>
              {GOAL_LABELS[localProfile.goal] || 'No goal set'}
              {' · '}
              {totalWeeklySessions > 0
                ? `${totalWeeklySessions} sessions/wk`
                : 'No plan set up'}
            </div>
          </div>
        </div>

        {/* Draft plan banner — only nag when there's neither a completed
            questionnaire nor an uploaded training plan to fall back on */}
        {!intakeCompleted && !hasEventTraining && (
          <div style={{ marginBottom: 12 }}>
            <DraftPlanBanner
              theme={theme}
              hasDraft={intakeDraft}
              onAction={onStartQuestionnaire}
            />
          </div>
        )}

        {/* Google Sheets sync */}
        <Section title="Data sync" theme={theme}>
          <div style={{ fontSize: 11, color: t.text2, marginBottom: 12, lineHeight: 1.5 }}>
            Connect Google Sheets to back up your data to your Google Drive and keep it safe across devices.
          </div>

          {/* Status row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0', borderBottom: `1px solid ${t.border}`,
          }}>
            {/* Google Sheets icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: sheetsStatus === 'connected' ? '#1A73E8' : (theme === 'dark' ? t.surface2 : '#F5F3EF'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="2" width="16" height="20" rx="2" fill={sheetsStatus === 'connected' ? '#fff' : '#34A853'} fillOpacity={sheetsStatus === 'connected' ? 1 : 0.9} />
                <rect x="7" y="8"  width="10" height="1.5" rx="0.75" fill={sheetsStatus === 'connected' ? '#1A73E8' : '#fff'} />
                <rect x="7" y="11" width="10" height="1.5" rx="0.75" fill={sheetsStatus === 'connected' ? '#1A73E8' : '#fff'} />
                <rect x="7" y="14" width="7"  height="1.5" rx="0.75" fill={sheetsStatus === 'connected' ? '#1A73E8' : '#fff'} />
              </svg>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>Google Sheets</div>
              <div style={{ fontSize: 10.5, color: t.text3 }}>
                {sheetsStatus === 'connected'       && 'Syncing to Google Drive'}
                {sheetsStatus === 'disconnected'    && 'Not connected'}
                {sheetsStatus === 'needs-reconnect' && 'Session expired — reconnect to resume'}
                {sheetsStatus === 'connecting'      && 'Connecting…'}
              </div>
            </div>

            {sheetsStatus === 'disconnected' && onConnectSheets && (
              <button onClick={onConnectSheets} style={{
                padding: '5px 12px', borderRadius: 8,
                background: t.accent + '15', color: t.accent,
                border: `1px solid ${t.accent + '30'}`,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
              }}>Connect</button>
            )}
            {sheetsStatus === 'needs-reconnect' && onReconnectSheets && (
              <button onClick={onReconnectSheets} style={{
                padding: '5px 12px', borderRadius: 8,
                background: '#F59E0B15', color: '#D97706',
                border: '1px solid #F59E0B30',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
              }}>Reconnect</button>
            )}
            {sheetsStatus === 'connected' && onDisconnectSheets && (
              <button onClick={onDisconnectSheets} style={{
                padding: '5px 12px', borderRadius: 8,
                background: '#BE3B2E15', color: '#BE3B2E',
                border: '1px solid #BE3B2E30',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
              }}>Disconnect</button>
            )}
            {sheetsStatus === 'connecting' && (
              <div style={{
                width: 18, height: 18, border: `2px solid ${t.accent}`,
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
            )}
          </div>

          {sheetsError && sheetsStatus !== 'connected' && (
            <div style={{
              marginTop: 8, padding: '8px 10px', borderRadius: 8,
              background: '#BE3B2E15', border: '1px solid #BE3B2E30',
              fontSize: 11, color: '#BE3B2E', lineHeight: 1.5,
            }}>
              {sheetsError}
            </div>
          )}

          {sheetsStatus === 'connected' && sheetUrl && (
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: `1px solid ${t.border}`,
              textDecoration: 'none',
            }}>
              <div>
                <div style={{ fontSize: 12, color: t.accent, fontWeight: 500 }}>Open in Google Sheets</div>
                <div style={{
                  fontSize: 10, color: t.text3, marginTop: 1,
                  maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {sheetUrl}
                </div>
              </div>
              <span style={{ fontSize: 14, color: t.accent }}>↗</span>
            </a>
          )}

          <div style={{ padding: '10px 0 2px', fontSize: 11, color: t.text3, lineHeight: 1.6 }}>
            {sheetsStatus === 'connected'
              ? 'Saved to 6 tabs: Profile · Sessions · Food Log · Custom Foods · Settings · Backup.'
              : 'Without sync, data is stored only in this browser and will be lost if you clear your cache.'}
          </div>
        </Section>

        {/* Body stats */}
        <Section title="Body stats" theme={theme}>
          <FieldRow label="Name" value={localProfile.name || ''} type="text"
            onChange={(v) => updateProfile('name', v)} theme={theme} />
          <FieldRow label="Age" value={localProfile.age || 30} unit="years"
            onChange={(v) => updateProfile('age', v)} theme={theme} />
          <FieldRow label="Height" value={localProfile.height || 168}
            unit={localSettings.heightUnit} step={1}
            onChange={(v) => updateProfile('height', v)} theme={theme} />
          <FieldRow label="Weight" value={localProfile.weight || 65}
            unit={localSettings.weightUnit} step={0.1}
            onChange={(v) => updateProfile('weight', v)} theme={theme} />
          {/* Unit toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 0',
          }}>
            <span style={{ fontSize: 13, color: t.text }}>Units</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {['kg / cm', 'lbs / ft'].map((u, i) => {
                const isMetric = i === 0;
                const active = isMetric ? localSettings.weightUnit === 'kg' : localSettings.weightUnit === 'lbs';
                return (
                  <button key={u} onClick={() => {
                    updateSettings('weightUnit', isMetric ? 'kg' : 'lbs');
                    updateSettings('heightUnit', isMetric ? 'cm' : 'ft');
                  }} style={{
                    padding: '4px 9px', borderRadius: 7,
                    background: active ? t.text : 'transparent',
                    color: active ? '#fff' : t.text2,
                    border: `1px solid ${active ? t.text : t.border}`,
                    fontSize: 10.5, cursor: 'pointer', fontFamily: t.sans, fontWeight: 500,
                  }}>{u}</button>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Training goal */}
        <Section title="Training goal" theme={theme}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {goals.map(g => (
              <button key={g} onClick={() => updateProfile('goal', g)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, background: localProfile.goal === g ? t.accent + '15' : 'transparent',
                border: `1px solid ${localProfile.goal === g ? t.accent : t.border}`,
                cursor: 'pointer', fontFamily: t.sans, textAlign: 'left',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: localProfile.goal === g ? t.accent : t.surface2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: localProfile.goal === g ? '#fff' : t.border2,
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: t.text, fontWeight: localProfile.goal === g ? 500 : 400 }}>
                    {GOAL_LABELS[g]}
                  </div>
                </div>
                {localProfile.goal === g && (
                  <span style={{ marginLeft: 'auto', fontSize: 14, color: t.accent }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </Section>

        {/* Calorie settings */}
        <Section title="Calorie targets" theme={theme}>
          <div style={{ fontSize: 11, color: t.text2, marginBottom: 10, lineHeight: 1.5 }}>
            Base calories apply on rest days. Gym days and active sessions add their boost automatically.
          </div>
          <FieldRow label="Daily base" value={localSettings.dailyCaloriesBase}
            unit="kcal" step={50}
            onChange={(v) => updateSettings('dailyCaloriesBase', v)} theme={theme} />
          <FieldRow label="Gym day boost" value={localSettings.gymDayBoost}
            unit="kcal" step={25}
            onChange={(v) => updateSettings('gymDayBoost', v)} theme={theme} />
          <div style={{ padding: '10px 0', fontSize: 11, color: t.text3 }}>
            Weekly base target: <span style={{ color: t.text, fontWeight: 500 }}>
              {(localSettings.dailyCaloriesBase * 7).toLocaleString()} kcal
            </span>
            {' '}(adjusts with active days)
          </div>
        </Section>

        {/* Training plan */}
        <Section title="Training plan" theme={theme}>
          {hasEventTraining ? (
            <>
              {/* Active event plan card */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: `1px solid ${t.border}`,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: currentPhase.color + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>🏁</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Event Training Plan</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: currentPhase.color,
                      background: currentPhase.color + '18', border: `1px solid ${currentPhase.color}30`,
                      borderRadius: 4, padding: '1px 5px', letterSpacing: '.06em',
                    }}>{currentPhase.label.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: t.text3, marginTop: 1 }}>
                    {totalPlanWeeks}-week programme · Week {currentWeek}
                    {eventPlan.meta?.eventDistances ? ` · ${eventPlan.meta.eventDistances}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, color: '#16A34A',
                  background: '#16A34A18', border: '1px solid #16A34A30',
                  borderRadius: 5, padding: '2px 7px',
                }}>ACTIVE</span>
              </div>

              {/* Phase progress bar */}
              <div style={{ margin: '10px 0 8px' }}>
                <div style={{ display: 'flex', gap: 2, height: 4, borderRadius: 99, overflow: 'hidden' }}>
                  {phaseMeta.map(ph => {
                    const w = ((ph.weeks[1] - ph.weeks[0] + 1) / totalPlanWeeks) * 100;
                    const isActive = ph.label === currentPhase.label;
                    const filled = isActive
                      ? ((currentWeek - ph.weeks[0]) / (ph.weeks[1] - ph.weeks[0] + 1)) * w
                      : currentWeek > ph.weeks[1] ? w : 0;
                    return (
                      <div key={ph.label} style={{
                        width: `${w}%`, height: '100%', borderRadius: 99,
                        background: ph.color + '25', position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${(filled / w) * 100}%`, background: ph.color, borderRadius: 99,
                        }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                  {phaseMeta.map(ph => {
                    const w = ((ph.weeks[1] - ph.weeks[0] + 1) / totalPlanWeeks) * 100;
                    return (
                      <div key={ph.label} style={{
                        width: `${w}%`, fontSize: 8,
                        color: ph.label === currentPhase.label ? ph.color : t.text3,
                        fontWeight: ph.label === currentPhase.label ? 700 : 400,
                        whiteSpace: 'nowrap', overflow: 'hidden',
                      }}>{ph.label}</div>
                    );
                  })}
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[
                  { label: 'Event sessions', value: `${eventDays}/wk` },
                  { label: 'Disciplines', value: 'Swim · Bike · Run' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    flex: 1, background: t.surface2, border: `1px solid ${t.border}`,
                    borderRadius: 9, padding: '7px 10px',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{stat.value}</div>
                    <div style={{ fontSize: 9.5, color: t.text3 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <button onClick={() => onNav?.('weekly')} style={{
                width: '100%', padding: '9px', borderRadius: 10,
                background: 'transparent', border: `1px solid ${t.border}`,
                color: t.accent, fontFamily: t.sans, fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}>View weekly overview →</button>
            </>
          ) : (
            <>
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '8px 12px', borderRadius: 10,
                background: t.surface2, border: `1px solid ${t.border}`,
                marginBottom: 10,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>📋</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                    {!planDone ? 'Complete your profile' : 'No event training plan'}
                  </div>
                  <div style={{ fontSize: 11, color: t.text2, lineHeight: 1.5 }}>
                    {!planDone
                      ? 'Finish setting up your goals and training intake to unlock a personalised plan.'
                      : 'Add a race or event goal to unlock the 18-week Weekly Overview plan with conflict detection.'}
                  </div>
                </div>
              </div>
              <button
                onClick={onSetupTrainingPlan}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  background: t.accent, color: '#fff', border: 'none',
                  fontFamily: t.sans, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {!planDone ? 'Complete your profile →' : 'Set up training plan →'}
              </button>
            </>
          )}

          {/* Upload / overwrite from spreadsheet */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {importState === 'confirm' && pendingPlan ? (
              <div style={{
                padding: '10px 12px', borderRadius: 10,
                background: '#F59E0B12', border: '1px solid #F59E0B35',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>
                  Replace your current plan?
                </div>
                <div style={{ fontSize: 11, color: t.text2, lineHeight: 1.5, marginBottom: 10 }}>
                  {pendingPlan.meta.totalWeeks}-week plan
                  {pendingPlan.meta.eventDistances ? ` · ${pendingPlan.meta.eventDistances}` : ''}
                  {' '}from {pendingPlan.sourceFileName}. This overwrites your existing event plan and clears any manual schedule changes.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={cancelImport} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    background: 'transparent', border: `1px solid ${t.border}`,
                    color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>Cancel</button>
                  <button onClick={confirmImport} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    background: '#DC2626', border: 'none',
                    color: '#fff', fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>Overwrite plan</button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={handlePickFile}
                  disabled={importState === 'parsing'}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 10,
                    background: 'transparent', border: `1px solid ${t.border}`,
                    color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600,
                    cursor: importState === 'parsing' ? 'default' : 'pointer',
                    opacity: importState === 'parsing' ? 0.6 : 1,
                  }}
                >
                  {importState === 'parsing'
                    ? 'Reading file…'
                    : hasEventTraining ? 'Upload new plan (.xlsx) →' : 'Upload training plan (.xlsx) →'}
                </button>
                {importState === 'error' && importError && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#DC2626', lineHeight: 1.5 }}>
                    {importError}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Generate with Claude */}
          {canGenerateAI && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
              {aiGenState === 'confirm' ? (
                <div style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: '#F59E0B12', border: '1px solid #F59E0B35',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>
                    Replace your current plan?
                  </div>
                  <div style={{ fontSize: 11, color: t.text2, lineHeight: 1.5, marginBottom: 10 }}>
                    This generates a new plan from your saved goals and questionnaire answers, overwriting your existing event plan and clearing any manual schedule changes.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelGenerateAI} style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      background: 'transparent', border: `1px solid ${t.border}`,
                      color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={runGenerateAI} style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      background: '#DC2626', border: 'none',
                      color: '#fff', fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>Overwrite plan</button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleGenerateAIClick}
                    disabled={aiGenState === 'working'}
                    style={{
                      width: '100%', padding: '9px', borderRadius: 10,
                      background: 'transparent', border: `1px solid ${t.accent}`,
                      color: t.accent, fontFamily: t.sans, fontSize: 12, fontWeight: 600,
                      cursor: aiGenState === 'working' ? 'default' : 'pointer',
                      opacity: aiGenState === 'working' ? 0.6 : 1,
                    }}
                  >
                    {aiGenState === 'working'
                      ? 'Building your plan… this can take a minute'
                      : hasEventTraining ? 'Regenerate plan with AI ✦' : 'Generate plan with AI ✦'}
                  </button>
                  {aiGenState === 'error' && aiGenError && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#DC2626', lineHeight: 1.5 }}>
                      {aiGenError}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Section>

        {/* Training split — disabled while an uploaded event plan is driving
            the Weekly Overview, since a configured split would inject gym
            sessions alongside the plan's own sessions. */}
        <Section title="Training split" theme={theme}>
          <div style={{ fontSize: 11, color: t.text2, marginBottom: 10, lineHeight: 1.5 }}>
            {hasEventTraining
              ? "Disabled while your uploaded training plan is active. Add one-off sessions from the Weekly Overview's + Add session button instead."
              : 'Gym sessions per week. Tap a number or open the picker to adjust your schedule and exercises.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, opacity: hasEventTraining ? 0.45 : 1 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const isActive = (plan.splitDays || 0) === n;
              return (
                <button
                  key={n}
                  disabled={hasEventTraining}
                  onClick={() => onNav?.('gym-split')}
                  style={{
                    padding: '12px 0 8px', borderRadius: 11,
                    background: isActive ? t.text : t.surface2,
                    color: isActive ? '#fff' : t.text,
                    border: `1px solid ${isActive ? t.text : t.border}`,
                    fontFamily: t.serif, fontSize: 20, lineHeight: 1,
                    cursor: hasEventTraining ? 'not-allowed' : 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  }}
                >
                  {n}
                  <span style={{
                    fontFamily: t.sans, fontSize: 8.5, letterSpacing: '.08em',
                    color: isActive ? 'rgba(255,255,255,.7)' : t.text3, fontWeight: 500,
                  }}>
                    {n === 1 ? 'DAY' : 'DAYS'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Combined weekly session count */}
          {totalWeeklySessions > 0 && (
            <div style={{
              marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
            }}>
              {gymDays > 0 && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: '#4F46E5',
                  background: '#4F46E508', border: '1px solid #4F46E520',
                  borderRadius: 5, padding: '2px 7px',
                }}>🏋️ {gymDays} gym</span>
              )}
              {eventDays > 0 && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: '#0369A1',
                  background: '#0369A108', border: '1px solid #0369A120',
                  borderRadius: 5, padding: '2px 7px',
                }}>🏊 {eventDays} event</span>
              )}
              <span style={{ fontSize: 10.5, color: t.text3 }}>
                = <strong style={{ color: t.text }}>{totalWeeklySessions} sessions/week</strong> total
              </span>
            </div>
          )}

          <button
            disabled={hasEventTraining}
            onClick={() => onNav?.('gym-split')}
            style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 9,
              background: 'transparent', border: `1px solid ${t.border}`,
              color: hasEventTraining ? t.text3 : t.accent, fontFamily: t.sans, fontSize: 11, fontWeight: 600,
              cursor: hasEventTraining ? 'not-allowed' : 'pointer',
              opacity: hasEventTraining ? 0.45 : 1,
            }}
          >Open split picker →</button>

          {hasEventTraining && (
            <button
              onClick={() => updateProfile('hasEventTraining', false)}
              style={{
                width: '100%', marginTop: 10, padding: '9px', borderRadius: 10,
                background: 'transparent', border: `1px solid ${t.border}`,
                color: t.text2, fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Switch to training split instead →</button>
          )}
        </Section>

        {/* Connected apps */}
        <Section title="Connected apps" theme={theme}>
          <div style={{ fontSize: 11, color: t.text2, marginBottom: 12, lineHeight: 1.5 }}>
            Connect services to import workouts, steps, sleep, and nutrition automatically.
          </div>
          {CONNECTED_SERVICES.filter(s => s.id !== 'flo' || tracksCycle).map((svc, i) => {
            const isOn = connected.has(svc.id);
            return (
              <div key={svc.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderTop: i > 0 ? `1px solid ${t.border}` : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: isOn ? svc.color : (theme === 'dark' ? t.surface2 : '#F5F3EF'),
                  color: isOn ? '#fff' : t.text3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: t.serif, fontSize: 14, fontWeight: 600, flexShrink: 0,
                  transition: 'background .2s',
                }}>
                  {svc.glyph}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{svc.name}</div>
                  <div style={{ fontSize: 10.5, color: t.text3 }}>{svc.scope}</div>
                </div>
                <button onClick={() => toggleService(svc.id)} style={{
                  padding: '5px 12px', borderRadius: 8,
                  background: isOn ? '#BE3B2E15' : t.accent + '15',
                  color: isOn ? '#BE3B2E' : t.accent,
                  border: `1px solid ${isOn ? '#BE3B2E30' : t.accent + '30'}`,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: t.sans,
                }}>
                  {isOn ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            );
          })}
        </Section>

        {/* App info + sign out */}
        <div style={{
          textAlign: 'center', padding: '8px 0 16px',
          fontSize: 10.5, color: t.text3, lineHeight: 1.6,
        }}>
          Forma · v2.0 · {sheetsStatus === 'connected' ? 'Syncing to Google Drive' : 'Data stored locally on this device'}
        </div>

        {onSignOut && (
          <button onClick={onSignOut} style={{
            width: '100%', padding: '13px 0', borderRadius: 14,
            background: 'transparent',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}`,
            color: '#BE3B2E', fontFamily: t.sans, fontSize: 14, fontWeight: 500,
            cursor: 'pointer', marginBottom: 8,
          }}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}


export { CONNECTED_SERVICES, GOAL_LABELS, FieldRow, Section, AboutScreen };
