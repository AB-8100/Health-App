import React from 'react';
import themes from '../data/themes';
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
  onBack, onNav, onSignOut, tracksCycle = true,
  sheetsStatus = 'disconnected', sheetUrl = null,
  onConnectSheets, onDisconnectSheets, onReconnectSheets,
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

  const goals = ['strength', 'muscle', 'fat-loss', 'active', 'flexibility'];

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
              {plan.splitDays || 3}-day split
            </div>
          </div>
        </div>

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

        {/* Default split */}
        <Section title="Default training split" theme={theme}>
          <div style={{ fontSize: 11, color: t.text2, marginBottom: 10, lineHeight: 1.5 }}>
            Your standard training frequency. You can override this week-by-week from the Gym tab.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const isActive = (plan.splitDays || 3) === n;
              return (
                <button key={n} style={{
                  padding: '12px 0 8px', borderRadius: 11,
                  background: isActive ? t.text : t.surface2,
                  color: isActive ? '#fff' : t.text,
                  border: `1px solid ${isActive ? t.text : t.border}`,
                  fontFamily: t.serif, fontSize: 20, lineHeight: 1, cursor: 'default',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}>
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
          <div style={{ marginTop: 8, fontSize: 11, color: t.text3 }}>
            Change from the Gym → Split picker.
          </div>
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
            Reset profile &amp; data
          </button>
        )}
      </div>
    </div>
  );
}


export { CONNECTED_SERVICES, GOAL_LABELS, FieldRow, Section, AboutScreen };
