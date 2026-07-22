// Suggested calorie targets for the About screen's "Calorie targets"
// section — a computed suggestion the user can accept or override, never
// applied automatically over a manually-set value (see AboutScreen.jsx).
//
// BMR: Mifflin-St Jeor. Height/weight must be canonical cm/kg (see the
// imperial-unit save-bug fix in AboutScreen.jsx's height/weight FieldRow —
// this function assumes correct units in, garbage in otherwise).

const REST_MULTIPLIER = 1.2; // sedentary baseline — a full rest day, regardless of weekly training volume

const ACTIVITY_TIERS = [
  { maxSessions: 1,        label: 'sedentary', multiplier: 1.2   },
  { maxSessions: 3,        label: 'light',     multiplier: 1.375 },
  { maxSessions: 5,        label: 'moderate',  multiplier: 1.55  },
  { maxSessions: Infinity, label: 'high',      multiplier: 1.725 },
];

export function getActivityTier(weeklyTrainingSessions) {
  const n = Number(weeklyTrainingSessions) || 0;
  return ACTIVITY_TIERS.find(tier => n <= tier.maxSessions);
}

// sex: 'male' | 'female' | 'prefer_not_to_say' (or unset) — the male/female
// Mifflin-St Jeor offsets differ by ~166 kcal; unset/prefer-not-to-say falls
// back to their midpoint rather than guessing either way.
function sexOffset(sex) {
  if (sex === 'male') return 5;
  if (sex === 'female') return -161;
  return -78;
}

export function computeSuggestedCalories({ heightCm, weightKg, age, sex, weeklyTrainingSessions = 0 }) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  const a = Number(age);
  if (!h || !w || !a || h <= 0 || w <= 0 || a <= 0) return null;

  const bmr = 10 * w + 6.25 * h - 5 * a + sexOffset(sex);
  const tier = getActivityTier(weeklyTrainingSessions);

  return {
    bmr: Math.round(bmr),
    maintenanceCalories: Math.round(bmr * tier.multiplier),
    suggestedDailyBase: Math.round(bmr * REST_MULTIPLIER),
    suggestedGymDayBoost: Math.max(0, Math.round(bmr * (tier.multiplier - REST_MULTIPLIER))),
    activityTier: tier.label,
  };
}
