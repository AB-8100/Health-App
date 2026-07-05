import React from 'react';
import themes from '../data/themes';
import { BottomNav } from '../components/SharedUI';
import { getSessionDisplay } from '../data/sessionDisplay';
import { MarkCompleteSheet, EditSessionSheet } from './GymPlanScreens';
import { findCompletedForActivity, completedDateKey } from '../utils/sessionCompletion';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function fmtElapsed(totalSeconds = 0) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Gym completions are logged under "<split day name> day" (see AddSessionSheet
// / GymSessionScreen), while non-gym completions are logged under the plain
// activity label — so history has to be looked up under the right label
// depending on which kind of session this is.
function workoutLabelFor(sess) {
  return sess.source === 'gym' ? `${sess.label} day` : sess.label;
}

// All-time log of completed sessions for a single scheduled activity — lets
// the user browse past exercise logs instead of only ever seeing today's.
function HistoricSessionsSheet({ theme, sess, completedSessions = [], onClose, onViewSummary }) {
  const t = themes[theme];
  const label = workoutLabelFor(sess);
  const history = completedSessions
    .filter(s => s.workout === label)
    .sort((a, b) => new Date(b.date || b.endedAt) - new Date(a.date || a.endedAt));

  return (
    <div
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: '16px 20px 28px', maxHeight: '75%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ width: 38, height: 4, background: t.border, borderRadius: 99, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
          <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text }}>{sess.label} — history</div>
          <button onClick={onClose} style={{
            padding: '4px 10px', borderRadius: 7, background: 'transparent',
            border: `1px solid ${t.border}`, color: t.text2, fontSize: 10.5, cursor: 'pointer', fontFamily: t.sans,
          }}>Close</button>
        </div>
        <div style={{ fontSize: 11, color: t.text3, marginBottom: 12, flexShrink: 0 }}>
          {history.length} logged session{history.length !== 1 ? 's' : ''}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }} className="phone-scroll">
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: t.text3, fontSize: 12.5 }}>
              No past logs for this session yet.
            </div>
          ) : history.map(s => {
            const doneExercises = (s.queue || []).filter(e => (e.sets || []).some(st => st.done));
            return (
              <div key={s.id} style={{
                background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 12,
                padding: '10px 12px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>
                    {new Date(s.date || s.endedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: 10.5, color: t.text3, whiteSpace: 'nowrap' }}>
                    {s.elapsed ? fmtElapsed(s.elapsed) : ''}
                    {s.distance != null ? `${s.elapsed ? ' · ' : ''}${s.distance}${s.distanceUnit || 'km'}` : ''}
                  </span>
                </div>
                {doneExercises.length > 0 && (
                  <div style={{ fontSize: 11, color: t.text2, marginBottom: 6 }}>
                    {doneExercises.length} exercise{doneExercises.length !== 1 ? 's' : ''} logged
                  </div>
                )}
                {s.rpe != null && (
                  <div style={{ fontSize: 11, color: t.text2, marginBottom: 6 }}>💪 RPE {s.rpe}/10</div>
                )}
                <button onClick={() => onViewSummary && onViewSummary(s)} style={{
                  width: '100%', padding: '7px', borderRadius: 8, background: 'transparent',
                  border: `1px solid ${t.border}`, color: t.accent, fontSize: 11, cursor: 'pointer', fontFamily: t.sans,
                }}>View summary ›</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Shows what's scheduled for a single day tapped in the Weekly Overview — the
// session type/detail if upcoming, or what was actually done if it's already
// logged (elapsed time / distance, or completed gym exercises). Also lets the
// user log a session directly from here (mirroring the Session tab's Record
// feature) and browse past logs for that same session.
export function SessionDetailScreen({
  width = 390, height = 820, theme = 'light',
  day, completedSessions = [],
  onBack, onStartActivity, onGoToGymTab, onNav,
  onMarkComplete, onViewSummary, onEditSession,
  tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false,
}) {
  const t = themes[theme];
  const [recordingSess, setRecordingSess] = React.useState(null);
  const [editingSession, setEditingSession] = React.useState(null);
  const [historicSess, setHistoricSess] = React.useState(null);

  if (!day) return null;

  const dayName = DAY_NAMES[day.dayIdx] || 'Day';
  const dateLabel = day.d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const completedForDay = completedSessions.filter(s => completedDateKey(s) === day.dk);

  // A gym session is matched to whichever completed-today entry actually
  // carries logged exercises, since gym completions aren't labelled the same
  // way the scheduled gym session is (split day name vs. "<name> day").
  const gymSess = day.sessions.find(s => s.source === 'gym');
  const gymCompleted = gymSess ? completedForDay.find(s => Array.isArray(s.queue) && s.queue.length > 0) : null;

  const nonGymLabels = new Set(day.sessions.filter(s => s.source !== 'gym').map(s => s.label));
  const unmatchedCompleted = completedForDay.filter(s =>
    !(Array.isArray(s.queue) && s.queue.length > 0) && !nonGymLabels.has(s.workout)
  );

  const cardStyle = {
    background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18,
    padding: '16px 18px', marginBottom: 12,
  };
  const loggedBtnStyle = {
    flex: 1, padding: '13px 0', borderRadius: 13, border: `1.5px solid ${t.green}40`,
    background: t.green + '18', color: t.green, fontFamily: t.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  };
  const editBtnStyle = {
    padding: '13px 16px', borderRadius: 13, background: 'transparent',
    border: `1px solid ${t.border}`, color: t.accent, fontFamily: t.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  };
  const historyBtnStyle = {
    width: '100%', marginTop: 8, padding: '10px 0', borderRadius: 12, background: 'transparent',
    border: `1px dashed ${t.border2}`, color: t.text2, fontFamily: t.sans, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
  };

  return (
    <div style={{
      width, height, background: t.bg, fontFamily: t.sans, color: t.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 22px 8px', fontSize: 14, fontWeight: 600, flexShrink: 0,
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      <div style={{ padding: '0 20px 10px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, borderRadius: 9, background: t.surface2,
          border: `1px solid ${t.border}`, color: t.text2, fontSize: 15,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>‹</button>
        <div>
          <div style={{ fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: t.text3 }}>
            {day.isToday ? 'Today' : dayName}
          </div>
          <div style={{ fontFamily: t.serif, fontSize: 22, lineHeight: 1.05, color: t.text }}>{dateLabel}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 16px' }} className="phone-scroll">
        {day.sessions.length === 0 && unmatchedCompleted.length === 0 ? (
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18,
            padding: '28px 18px', textAlign: 'center', marginBottom: 12,
          }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>😴</div>
            <div style={{ fontFamily: t.serif, fontSize: 18, color: t.text, marginBottom: 4 }}>Rest day</div>
            <div style={{ fontSize: 12.5, color: t.text3 }}>Nothing scheduled — recovery is part of the plan.</div>
          </div>
        ) : (
          <>
            {day.sessions.length === 0 && (
              <div style={{
                background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18,
                padding: '20px 18px', textAlign: 'center', marginBottom: 12,
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>😴</div>
                <div style={{ fontFamily: t.serif, fontSize: 16, color: t.text }}>Rest day</div>
                <div style={{ fontSize: 12, color: t.text3, marginTop: 2 }}>Nothing was scheduled, but something was logged below.</div>
              </div>
            )}

            {day.sessions.map(sess => {
              const isGym = sess.source === 'gym';
              const completed = isGym ? gymCompleted : findCompletedForActivity(sess, completedForDay);
              const { color, emoji, label: displayLabel } = getSessionDisplay(sess.actData, sess.type);
              const label = sess.label || displayLabel;

              return (
                <div key={sess.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 13, flexShrink: 0, fontSize: 22,
                      background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{emoji}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: t.serif, fontSize: 19, color: t.text, lineHeight: 1.1 }}>{label}</div>
                      {sess.detail && (
                        <div style={{ fontSize: 11.5, color: t.text3, marginTop: 3 }}>{sess.detail}</div>
                      )}
                    </div>
                  </div>

                  {completed ? (
                    <>
                      {completed.rpe != null && (
                        <div style={{ fontSize: 12, color: t.text2, marginBottom: 8 }}>💪 RPE {completed.rpe}/10</div>
                      )}
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button onClick={() => onViewSummary && onViewSummary(completed)} style={loggedBtnStyle}>
                          ✓ Logged — view
                        </button>
                        <button onClick={() => setEditingSession(completed)} style={editBtnStyle}>✎ Edit</button>
                      </div>
                    </>
                  ) : isGym ? (
                    <button onClick={onGoToGymTab} style={{
                      width: '100%', padding: '13px 0', borderRadius: 13, border: 'none',
                      background: color, color: '#fff', fontFamily: t.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}>Go to Session tab →</button>
                  ) : (
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button onClick={() => onStartActivity && onStartActivity(sess)} style={{
                        flex: 1, padding: '13px 0', borderRadius: 13, border: 'none',
                        background: color, color: '#fff', fontFamily: t.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      }}>Start session</button>
                      <button onClick={() => setRecordingSess(sess)} style={{
                        padding: '13px 16px', borderRadius: 13, background: 'transparent',
                        border: `1.5px solid ${t.green}60`, color: t.green,
                        fontFamily: t.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>✓ Record</button>
                    </div>
                  )}

                  <button onClick={() => setHistoricSess(sess)} style={historyBtnStyle}>
                    See historic sessions
                  </button>
                </div>
              );
            })}

            {unmatchedCompleted.map(s => {
              const exercisesDone = (s.queue || []).filter(e => (e.sets || []).some(st => st.done));
              return (
                <div key={s.id} style={cardStyle}>
                  <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: t.green, fontWeight: 600, marginBottom: 4 }}>
                    ✓ Completed
                  </div>
                  <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text, marginBottom: 8 }}>{s.workout || 'Session'}</div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: t.text2, marginBottom: 12 }}>
                    {s.elapsed ? <span>⏱ {fmtElapsed(s.elapsed)}</span> : null}
                    {s.distance != null ? <span>📏 {s.distance}{s.distanceUnit || 'km'}</span> : null}
                    {s.lengths != null && s.poolLengthM != null ? <span>🏊 {s.lengths} × {s.poolLengthM}m</span> : null}
                    {s.rpe != null ? <span>💪 RPE {s.rpe}/10</span> : null}
                  </div>
                  {exercisesDone.length > 0 && (
                    <div style={{ marginBottom: 12, paddingBottom: 4, borderBottom: `1px solid ${t.border}` }}>
                      {exercisesDone.map((e, i) => (
                        <div key={e.id || i} style={{ fontSize: 12, color: t.text2, padding: '3px 0' }}>
                          {e.name} — {(e.sets || []).filter(st => st.done).length} sets
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button onClick={() => onViewSummary && onViewSummary(s)} style={loggedBtnStyle}>✓ Logged — view</button>
                    <button onClick={() => setEditingSession(s)} style={editBtnStyle}>✎ Edit</button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <BottomNav
        theme={theme} active="weekly" onNav={onNav}
        tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
      />

      {recordingSess && (
        <MarkCompleteSheet
          theme={theme}
          workoutLabel={recordingSess.label}
          workoutType={recordingSess.type}
          onClose={() => setRecordingSess(null)}
          onSave={(extras) => {
            onMarkComplete && onMarkComplete({ ...extras, workout: recordingSess.label, date: day.d.toISOString() });
            setRecordingSess(null);
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

      {historicSess && (
        <HistoricSessionsSheet
          theme={theme}
          sess={historicSess}
          completedSessions={completedSessions}
          onClose={() => setHistoricSess(null)}
          onViewSummary={onViewSummary}
        />
      )}
    </div>
  );
}
