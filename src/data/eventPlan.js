// Event training plan data — populated per-user when a training plan is generated.
// EVENT_PLAN will be loaded from Supabase (training_plans table, training_type='event')
// once the plan generation flow is built.

export const PLAN_META = {
  startDate:      null,
  eventDate:      null,
  totalWeeks:     0,
  eventDistances: '',
};

const _PLAN_START = new Date();

// Returns 1 until a real plan is configured for the user
export function getCurrentPlanWeek() {
  return 1;
}

// Returns the Monday of the given week number relative to now
export function getPlanWeekStart(weekNum) {
  const d = new Date(_PLAN_START);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset + (weekNum - 1) * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

// No hardcoded sessions — plan data is user-defined and loaded from Supabase
export const EVENT_PLAN = {};

// Derives training phase ranges from total weeks to event.
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
