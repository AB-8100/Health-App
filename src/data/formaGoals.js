export const TIER_META = {
  Target:    { color: '#BE5A38', label: 'Target',    priority: 3 },
  Programme: { color: '#7C3AED', label: 'Programme', priority: 2 },
  Plan:      { color: '#0369A1', label: 'Plan',      priority: 1 },
};

export const FORMA_GOALS = [
  {
    id: 'sprint-tri',
    title: 'Complete Sprint Triathlon',
    subtitle: '750m swim · 20km bike · 5km run',
    demandTier: 'Target',
    completion: 35,
    category: 'event_race',
    archived: false,
  },
  {
    id: 'swim-freq',
    title: 'Swim 3× per week',
    subtitle: 'Build aerobic base — Foundation phase',
    demandTier: 'Programme',
    completion: 60,
    category: 'training_frequency',
    archived: false,
  },
  {
    id: 'run-5k',
    title: '5km under 25 minutes',
    subtitle: 'Tempo run threshold development',
    demandTier: 'Plan',
    completion: 80,
    category: 'performance',
    archived: false,
  },
];
