-- Extends user_intake (Stage 3 questionnaire) with the remaining fields needed
-- to drive the AI plan generator: day preferences, discipline ranking, and
-- goals/mindset. All stored as JSONB, consistent with the rest of the table.

alter table public.user_intake
  add column if not exists discipline_ranking jsonb not null default '[]'::jsonb,
  -- Strongest → weakest, triathlon only, e.g. ["bike", "run", "swim"]

  add column if not exists preferences jsonb not null default '{}'::jsonb,
  -- { longSessionDay, secondDisciplineDay, conditioningDay } — day-of-week keys or ''

  add column if not exists mindset jsonb not null default '{}'::jsonb;
  -- { primaryGoal, disciplineToImprove, nervousAbout, targetTime, priorExperience,
  --   usesSpeedTraining, lifestyleNotes }

-- injury.avoidExercises / injury.aggravatingFactors are new keys within the
-- existing `injury` jsonb column — no migration needed there.
