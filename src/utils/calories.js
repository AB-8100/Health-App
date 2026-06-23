export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary',        sub: 'Little or no exercise',             multiplier: 1.2   },
  { id: 'light',     label: 'Lightly active',   sub: 'Light exercise 1–3 days/week',      multiplier: 1.375 },
  { id: 'moderate',  label: 'Moderately active',sub: 'Moderate exercise 3–5 days/week',   multiplier: 1.55  },
  { id: 'active',    label: 'Very active',       sub: 'Hard exercise 6–7 days/week',       multiplier: 1.725 },
  { id: 'extra',     label: 'Extra active',      sub: 'Very hard exercise or physical job',multiplier: 1.9   },
];

// Mifflin-St Jeor Equation
// weight in kg, height in cm, age in years
// Returns TDEE rounded to nearest 50 kcal, or null if inputs are missing
export function calculateTDEE({ weight, height, age, sex, activityLevel = 'moderate' } = {}) {
  const W = Number(weight);
  const H = Number(height);
  const A = Number(age);
  if (!W || !H || !A) return null;

  let bmr;
  if (sex === 'male') {
    bmr = 10 * W + 6.25 * H - 5 * A + 5;
  } else if (sex === 'female') {
    bmr = 10 * W + 6.25 * H - 5 * A - 161;
  } else {
    // 'other' or unset — average of male and female formulas
    bmr = 10 * W + 6.25 * H - 5 * A - 78;
  }

  const level = ACTIVITY_LEVELS.find(l => l.id === activityLevel) ?? ACTIVITY_LEVELS[2];
  return Math.round((bmr * level.multiplier) / 50) * 50;
}
