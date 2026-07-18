import React from 'react';
import themes from '../data/themes';
import { BottomNav } from '../components/SharedUI';
import { getSessionDisplay } from '../data/sessionDisplay';
import { MarkCompleteSheet, EditSessionSheet, ExercisePickerSheet } from './GymPlanScreens';
import { findCompletedForActivity, completedDateKey } from '../utils/sessionCompletion';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// The date key for the same weekday one week earlier — used to offer
// "copy last week's plan" when pre-selecting a gym/conditioning day's
// activities, and `day.dk` is a UTC-anchored YYYY-MM-DD string (see
// WeeklyOverviewScreen's toDateKey).
function prevWeekDateKey(dk) {
  const d = new Date(dk + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

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
function HistoricSessionsSheet({ theme, sess, completedSessions = [], onClose, onViewSummary, onDeleteSession }) {
  const t = themes[theme];
  const label = workoutLabelFor(sess);
  const history = completedSessions
    .filter(s => s.workout === label)
    .sort((a, b) => new Date(b.date || b.endedAt) - new Date(a.date || a.endedAt));
  const [deleteId, setDeleteId] = React.useState(null);

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
                <div style={{ display: 'flex', gap: 7 }}>
                  <button onClick={() => onViewSummary && onViewSummary(s)} style={{
                    flex: 1, padding: '7px', borderRadius: 8, background: 'transparent',
                    border: `1px solid ${t.border}`, color: t.accent, fontSize: 11, cursor: 'pointer', fontFamily: t.sans,
                  }}>View summary ›</button>
                  {onDeleteSession && (
                    <button onClick={() => setDeleteId(s.id)} style={{
                      padding: '7px 10px', borderRadius: 8, background: 'transparent',
                      border: `1px solid ${t.border}`, color: '#BE3B2E', fontSize: 11, cursor: 'pointer', fontFamily: t.sans,
                    }}>Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {deleteId && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-end', zIndex: 70 }}
          onClick={() => setDeleteId(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '18px 20px 24px',
          }}>
            <div style={{ width: 38, height: 4, background: t.border, borderRadius: 99, margin: '0 auto 14px' }} />
            <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text, marginBottom: 6 }}>Delete this session?</div>
            <div style={{ fontSize: 12, color: t.text2, marginBottom: 16, lineHeight: 1.5 }}>
              This logged session will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteId(null)} style={{
                flex: 1, padding: '12px', borderRadius: 11, background: 'transparent',
                border: `1px solid ${t.border2}`, color: t.text, fontFamily: t.sans, fontSize: 13, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => { onDeleteSession(deleteId); setDeleteId(null); }} style={{
                flex: 1, padding: '12px', borderRadius: 11, background: '#BE3B2E', color: '#fff',
                border: 'none', fontFamily: t.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
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
  onBack, onStartActivity, onStartConditioning, onGoToGymTab, onNav,
  onMarkComplete, onViewSummary, onEditSession, onDeleteSession, onRemoveSession,
  preselectedQueues = {}, onSavePreselectedQueue,
  tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false,
}) {
  const t = themes[theme];
  const [recordingSess, setRecordingSess] = React.useState(null);
  const [editingSession, setEditingSession] = React.useState(null);
  const [historicSess, setHistoricSess] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [removeTarget, setRemoveTarget] = React.useState(null); // scheduled (not-yet-logged) session to remove
  const [pickerState, setPickerState] = React.useState(null); // { sess, mode: 'start' | 'plan' }

  if (!day) return null;

  const preselected = preselectedQueues[day.dk];
  const previousWeekPreselected = preselectedQueues[prevWeekDateKey(day.dk)];

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
  const deleteBtnStyle = {
    padding: '13px 16px', borderRadius: 13, background: 'transparent',
    border: `1px solid ${t.border}`, color: '#BE3B2E', fontFamily: t.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  };
  const planBtnStyle = {
    width: '100%', marginTop: 8, padding: '10px 0', borderRadius: 12, background: 'transparent',
    border: `1px solid ${t.accent}40`, color: t.accent, fontFamily: t.sans, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  };
  const removeBtnStyle = {
    width: '100%', marginTop: 8, padding: '10px 0', borderRadius: 12, background: 'transparent',
    border: `1px dashed #BE3B2E60`, color: '#BE3B2E', fontFamily: t.sans, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
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
              // Any session typed "gym" — not just the recurring split day —
              // gets the same exercise-picking treatment as conditioning,
              // e.g. a one-off "Full Body (Gym)"/"Leg Day (Gym)" activity
              // added via the Weekly Overview or an uploaded event plan.
              const isGymType = !isGym && (sess.type || '').toLowerCase() === 'gym';
              const isConditioning = (sess.type || '').toLowerCase() === 'conditioning';
              const usesExercisePicker = isConditioning || isGymType;
              const completed = isGym ? gymCompleted : findCompletedForActivity(sess, completedForDay);
              const { color, emoji, label: displayLabel } = getSessionDisplay(sess.actData, sess.type);
              const label = sess.label || displayLabel;
              const sessPreselected = ((isGym || isGymType) && preselected?.kind === 'gym') || (isConditioning && preselected?.kind === 'conditioning')
                ? preselected : null;

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

                  {sessPreselected && !completed && (
                    <div style={{ fontSize: 11, color: t.accent, marginBottom: 8 }}>
                      🗂 {sessPreselected.exercises.length} exercise{sessPreselected.exercises.length !== 1 ? 's' : ''} planned
                    </div>
                  )}

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
                        {onDeleteSession && (
                          <button onClick={() => setDeleteTarget(completed.id)} style={deleteBtnStyle}>Delete</button>
                        )}
                      </div>
                    </>
                  ) : isGym ? (
                    <>
                      <button onClick={onGoToGymTab} style={{
                        width: '100%', padding: '13px 0', borderRadius: 13, border: 'none',
                        background: color, color: '#fff', fontFamily: t.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      }}>Go to Session tab →</button>
                      <button onClick={() => setPickerState({ sess, mode: 'plan' })} style={planBtnStyle}>
                        🗂 Plan exercises
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button
                          onClick={() => {
                            if (usesExercisePicker) {
                              if (sessPreselected?.exercises?.length) {
                                onStartConditioning && onStartConditioning(sess, sessPreselected.exercises);
                              } else {
                                setPickerState({ sess, mode: 'start' });
                              }
                            } else {
                              onStartActivity && onStartActivity(sess);
                            }
                          }}
                          style={{
                            flex: 1, padding: '13px 0', borderRadius: 13, border: 'none',
                            background: color, color: '#fff', fontFamily: t.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                          }}>Start session</button>
                        <button onClick={() => setRecordingSess(sess)} style={{
                          padding: '13px 16px', borderRadius: 13, background: 'transparent',
                          border: `1.5px solid ${t.green}60`, color: t.green,
                          fontFamily: t.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>✓ Record</button>
                      </div>
                      {usesExercisePicker && (
                        <button onClick={() => setPickerState({ sess, mode: 'plan' })} style={planBtnStyle}>
                          🗂 Plan exercises
                        </button>
                      )}
                    </>
                  )}

                  <button onClick={() => setHistoricSess(sess)} style={historyBtnStyle}>
                    See historic sessions
                  </button>
                  {!completed && onRemoveSession && (
                    <button onClick={() => setRemoveTarget(sess)} style={removeBtnStyle}>
                      Remove from plan
                    </button>
                  )}
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
                    {onDeleteSession && (
                      <button onClick={() => setDeleteTarget(s.id)} style={deleteBtnStyle}>Delete</button>
                    )}
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
          onDeleteSession={onDeleteSession}
        />
      )}

      {pickerState && (
        <ExercisePickerSheet
          theme={theme}
          title={`Pick exercises — ${pickerState.sess.label}`}
          confirmLabel={pickerState.mode === 'start' ? 'Start session' : 'Save plan'}
          initialSelectedIds={preselected?.exercises || []}
          previousIds={previousWeekPreselected?.exercises || null}
          onConfirm={(ids) => {
            if (pickerState.mode === 'start') {
              onStartConditioning && onStartConditioning(pickerState.sess, ids);
            } else {
              onSavePreselectedQueue && onSavePreselectedQueue(day.dk, {
                kind: (pickerState.sess.source === 'gym' || (pickerState.sess.type || '').toLowerCase() === 'gym') ? 'gym' : 'conditioning',
                exercises: ids,
                label: pickerState.sess.label,
              });
            }
            setPickerState(null);
          }}
          onClose={() => setPickerState(null)}
        />
      )}

      {removeTarget && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-end', zIndex: 65 }}
          onClick={() => setRemoveTarget(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '18px 20px 24px',
          }}>
            <div style={{ width: 38, height: 4, background: t.border, borderRadius: 99, margin: '0 auto 14px' }} />
            <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text, marginBottom: 6 }}>Remove this session?</div>
            <div style={{ fontSize: 12, color: t.text2, marginBottom: 16, lineHeight: 1.5 }}>
              This will take "{removeTarget.label}" off {day.isToday ? "today's" : dayName + "'s"} plan.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRemoveTarget(null)} style={{
                flex: 1, padding: '12px', borderRadius: 11, background: 'transparent',
                border: `1px solid ${t.border2}`, color: t.text, fontFamily: t.sans, fontSize: 13, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => { onRemoveSession && onRemoveSession(removeTarget); setRemoveTarget(null); }} style={{
                flex: 1, padding: '12px', borderRadius: 11, background: '#BE3B2E', color: '#fff',
                border: 'none', fontFamily: t.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-end', zIndex: 65 }}
          onClick={() => setDeleteTarget(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '18px 20px 24px',
          }}>
            <div style={{ width: 38, height: 4, background: t.border, borderRadius: 99, margin: '0 auto 14px' }} />
            <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text, marginBottom: 6 }}>Delete this session?</div>
            <div style={{ fontSize: 12, color: t.text2, marginBottom: 16, lineHeight: 1.5 }}>
              This logged session will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteTarget(null)} style={{
                flex: 1, padding: '12px', borderRadius: 11, background: 'transparent',
                border: `1px solid ${t.border2}`, color: t.text, fontFamily: t.sans, fontSize: 13, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => { onDeleteSession && onDeleteSession(deleteTarget); setDeleteTarget(null); }} style={{
                flex: 1, padding: '12px', borderRadius: 11, background: '#BE3B2E', color: '#fff',
                border: 'none', fontFamily: t.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
