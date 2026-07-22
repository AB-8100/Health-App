// Pure helpers for plan.scheduleOverride — the 7-slot weekly gym schedule
// (index 0=Mon..6=Sun, each '—' or a split-day-id) — shared by
// AboutScreen.jsx's "Training days" toggle and GymPlanScreens.jsx's
// SplitPickerScreen ("Customize split" content picker) so the two can't
// drift out of sync on how a schedule is read or reconciled.
//
// The two concepts these keep separate:
//  - WHICH weekdays are training days (a slot being non-'—') — owned by
//    AboutScreen's day toggle.
//  - WHAT split-day-id's content runs on those days — owned by
//    SplitPickerScreen, and reconciled here whenever the active split
//    template changes so the day *selection* survives instead of being
//    reset to the new template's default schedule.

export const REST = '—';

// Which weekday indices (0=Mon..6=Sun) are currently training days,
// independent of which specific split-day-id occupies each slot.
export function getTrainingDayIndices(schedule = []) {
  return schedule.reduce((idxs, slot, i) => {
    if (slot !== REST) idxs.push(i);
    return idxs;
  }, []);
}

// True if every non-rest slot holds a split-day-id that belongs to the
// given set. A schedule can go invalid after the active split template
// changes elsewhere without reconciliation (e.g. stale data from before
// this concept existed) — callers use this to decide whether to reconcile
// before use.
export function isScheduleValidForSplit(schedule, splitDayIds) {
  const idSet = new Set(splitDayIds);
  return (schedule || []).every(slot => slot === REST || idSet.has(slot));
}

// Toggles a single weekday on/off in place (returns a new array). Turning
// a day off just clears its slot — other days are untouched. Turning a day
// on assigns the next split-day-id in rotation, continuing from however
// many days are already on, rather than reshuffling existing assignments.
export function toggleTrainingDay(schedule, splitDayIds, dayIdx) {
  const next = [...(schedule || Array(7).fill(REST))];
  if (next[dayIdx] !== REST && next[dayIdx] !== undefined) {
    next[dayIdx] = REST;
    return next;
  }
  if (!splitDayIds || !splitDayIds.length) return next;
  const onCount = next.filter(s => s !== REST).length;
  next[dayIdx] = splitDayIds[onCount % splitDayIds.length];
  return next;
}

// Reassigns split-day-ids across whichever slots are already training
// days, round-robin in weekday order — used when the active split
// template changes (a different set/count of split-day ids) so the
// existing training-day selection survives and every slot ends up holding
// a valid id for the new template, instead of the schedule being reset.
export function reconcileScheduleWithSplitIds(schedule, splitDayIds) {
  if (!splitDayIds || !splitDayIds.length) return (schedule || []).map(() => REST);
  let onIdx = 0;
  return (schedule || []).map(slot => {
    if (slot === REST) return REST;
    const id = splitDayIds[onIdx % splitDayIds.length];
    onIdx++;
    return id;
  });
}
