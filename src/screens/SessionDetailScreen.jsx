import React from 'react';
import themes from '../data/themes';
import { BottomNav } from '../components/SharedUI';
import { getSessionDisplay } from '../data/sessionDisplay';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function fmtElapsed(totalSeconds = 0) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// A completed session's local calendar day, for matching against a plan
// day's date key (which is itself a local-feeling YYYY-MM-DD string).
function completedDateKey(s) {
  const d = new Date(s.date || s.endedAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Shows what's scheduled for a single day tapped in the Weekly Overview — the
// session type/detail if upcoming, or what was actually done if it's already
// logged (elapsed time / distance, or completed gym exercises).
export function SessionDetailScreen({
  width = 390, height = 820, theme = 'light',
  day, completedSessions = [],
  onBack, onStartActivity, onGoToGymTab, onNav,
  tracksCycle = false, hasGym = true, hasEventTraining = false, hasTrainingActivities = false,
}) {
  const t = themes[theme];
  if (!day) return null;

  const dayName = DAY_NAMES[day.dayIdx] || 'Day';
  const dateLabel = day.d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const completedForDay = completedSessions.filter(s => completedDateKey(s) === day.dk);

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
        {completedForDay.length > 0 ? (
          completedForDay.map(s => {
            const exercisesDone = (s.queue || []).filter(e => (e.sets || []).some(st => st.done));
            return (
              <div key={s.id} style={{
                background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16,
                padding: '16px 18px', marginBottom: 12,
              }}>
                <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: t.green, fontWeight: 600, marginBottom: 4 }}>
                  ✓ Completed
                </div>
                <div style={{ fontFamily: t.serif, fontSize: 20, color: t.text, marginBottom: 8 }}>{s.workout || 'Session'}</div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: t.text2 }}>
                  {s.elapsed ? <span>⏱ {fmtElapsed(s.elapsed)}</span> : null}
                  {s.distance != null ? <span>📏 {s.distance}{s.distanceUnit || 'km'}</span> : null}
                  {s.lengths != null && s.poolLengthM != null ? <span>🏊 {s.lengths} × {s.poolLengthM}m</span> : null}
                </div>
                {exercisesDone.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
                    {exercisesDone.map((e, i) => (
                      <div key={e.id || i} style={{ fontSize: 12, color: t.text2, padding: '3px 0' }}>
                        {e.name} — {(e.sets || []).filter(st => st.done).length} sets
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : day.sessions.length === 0 ? (
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18,
            padding: '28px 18px', textAlign: 'center', marginBottom: 12,
          }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>😴</div>
            <div style={{ fontFamily: t.serif, fontSize: 18, color: t.text, marginBottom: 4 }}>Rest day</div>
            <div style={{ fontSize: 12.5, color: t.text3 }}>Nothing scheduled — recovery is part of the plan.</div>
          </div>
        ) : (
          day.sessions.map(sess => {
            const { color, emoji, label: displayLabel } = getSessionDisplay(sess.actData, sess.type);
            const label = sess.label || displayLabel;
            const isGym = sess.source === 'gym';
            return (
              <div key={sess.id} style={{
                background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18,
                padding: '16px 18px', marginBottom: 12,
              }}>
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
                {isGym ? (
                  <button onClick={onGoToGymTab} style={{
                    width: '100%', padding: '13px 0', borderRadius: 13, border: 'none',
                    background: color, color: '#fff', fontFamily: t.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>Go to Session tab →</button>
                ) : (
                  <button onClick={() => onStartActivity && onStartActivity(sess)} style={{
                    width: '100%', padding: '13px 0', borderRadius: 13, border: 'none',
                    background: color, color: '#fff', fontFamily: t.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>Start session</button>
                )}
              </div>
            );
          })
        )}
      </div>

      <BottomNav
        theme={theme} active="weekly" onNav={onNav}
        tracksCycle={tracksCycle} hasGym={hasGym} hasEventTraining={hasEventTraining} hasTrainingActivities={hasTrainingActivities}
      />
    </div>
  );
}
