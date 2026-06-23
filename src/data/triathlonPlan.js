// Triathlon training plan data — populated per-user in a future edition.
// Keeping exports so all importers continue to compile without changes.

export const TRIATHLON_META = {
  startDate: null,
  raceDate:  null,
  totalWeeks: 0,
  raceDistances: '',
};

const _PLAN_START = new Date();

// Returns 1 until a real plan is configured
export function getCurrentTriathlonWeek() {
  return 1;
}

// Returns the current Monday until a real plan is configured
export function getTriathlonWeekStart(weekNum) {
  const d = new Date(_PLAN_START);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset + (weekNum - 1) * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

// No hardcoded sessions — plan data will be user-defined in a future edition
export const TRIATHLON_PLAN = {};

export const DISCIPLINE_DISPLAY = {
  Swim:         { emoji: '🏊', color: '#0369A1', label: 'Swim' },
  Bike:         { emoji: '🚴', color: '#9333EA', label: 'Bike' },
  Run:          { emoji: '🏃', color: '#0090FF', label: 'Run' },
  Conditioning: { emoji: '💪', color: '#6D4AAF', label: 'Conditioning' },
  Rest:         { emoji: '😴', color: '#9CA3AF', label: 'Rest' },
  Race:         { emoji: '🏁', color: '#DC2626', label: 'Race Day!' },
};
