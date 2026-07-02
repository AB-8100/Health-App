// Pure helpers for the event training plan. The plan data itself — sessions,
// phases, meta (start date, event date, total weeks) — lives in app state,
// loaded from Supabase (training_plans table, training_type='event') after a
// user uploads a training plan spreadsheet via the About screen.
//
// Dates are treated as calendar days with no time-of-day component, so every
// date here is anchored to UTC midnight and read back with the UTC getters —
// that keeps a plan's Monday looking like Monday regardless of which
// timezone the browser is running in, and keeps plan dates lining up exactly
// with the session dates parsed out of the uploaded spreadsheet.

function parseUTCDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Returns the plan week currently active, based on the plan's real start
// date. Falls back to week 1 when no plan has been uploaded yet.
export function getCurrentPlanWeek(startDate, totalWeeks = 18) {
  if (!startDate) return 1;
  const start = parseUTCDate(startDate);
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((todayUTC - start.getTime()) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  return Math.min(Math.max(week, 1), totalWeeks || 1);
}

// Returns the first day (UTC midnight) of the given plan week, relative to
// the plan's start date. Without a start date, falls back to the Monday of
// the current calendar week so the weekly planner still has something to
// show before a plan is uploaded.
export function getPlanWeekStart(weekNum, startDate) {
  let d;
  if (startDate) {
    d = parseUTCDate(startDate);
  } else {
    const now = new Date();
    d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = d.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + mondayOffset);
  }
  d.setUTCDate(d.getUTCDate() + (weekNum - 1) * 7);
  return d;
}

// Derives training phase ranges from total weeks to event. Used only as a
// fallback when no phases were parsed from an uploaded plan.
// Proportions: Foundation 33% · Build 44% · Peak 17% · Taper remainder (min 1wk)
export function computeEventPhases(totalWeeks = 18) {
  const foundation = Math.max(1, Math.round(totalWeeks * 0.33));
  const build      = Math.max(1, Math.round(totalWeeks * 0.44));
  const peak       = Math.max(1, Math.round(totalWeeks * 0.17));
  const taper      = Math.max(1, totalWeeks - foundation - build - peak);

  const phases = [];
  let start = 1;
  phases.push({ label: 'Foundation', weeks: [start, start + foundation - 1], color: '#15803D' });
  start += foundation;
  phases.push({ label: 'Build',      weeks: [start, start + build - 1],      color: '#0369A1' });
  start += build;
  phases.push({ label: 'Peak',       weeks: [start, start + peak - 1],       color: '#9333EA' });
  start += peak;
  phases.push({ label: 'Taper',      weeks: [start, start + taper - 1],      color: '#DC2626' });
  return phases;
}
