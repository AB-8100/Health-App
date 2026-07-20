// Shared display metadata (emoji/color/label) for sessions shown across the
// Weekly Overview, Session tab and session detail screens. Keyed by a
// session's `type`. The `endurance`/`team_sport`/etc. keys mirror the
// `category` column on the Supabase `ref_activities` table, so an activity
// picked from that table (e.g. "Rugby (training session)") resolves to a
// sensible icon/color without needing a per-activity mapping.
export const SESSION_DISPLAY = {
  swim:         { label: 'Swim',    emoji: '🏊', color: '#0369A1' },
  run:          { label: 'Run',     emoji: '🏃', color: '#0090FF' },
  cycle:        { label: 'Cycle',   emoji: '🚴', color: '#9333EA' },
  bike:         { label: 'Bike',    emoji: '🚴', color: '#D97706' },
  gym:          { label: 'Gym',     emoji: '🏋️', color: '#4F46E5' },
  yoga:         { label: 'Yoga',    emoji: '🧘', color: '#6D4AAF' },
  walk:         { label: 'Walk',    emoji: '🚶', color: '#15803D' },
  row:          { label: 'Row',     emoji: '🚣', color: '#4B5563' },
  hiit:         { label: 'HIIT',    emoji: '⚡', color: '#DC2626' },
  pilates:      { label: 'Pilates', emoji: '🤸', color: '#7C3AED' },
  climb:        { label: 'Climb',   emoji: '🧗', color: '#854D0E' },
  dance:        { label: 'Dancing', emoji: '💃', color: '#EC4899' },
  brick:        { label: 'Brick',   emoji: '🔥', color: '#9333EA' },
  sprint:       { label: 'Sprint',  emoji: '⏱️', color: '#F59E0B' },
  conditioning: { label: 'Cond',    emoji: '💪', color: '#0D9488' },
  race:         { label: 'Race',    emoji: '🏁', color: '#DC2626' },
  rest:         { label: 'Rest',    emoji: '😴', color: '#9CA3AF' },
  other:        { label: 'Other',   emoji: '⚡', color: '#4B5563' },
  // ref_activities.category values
  endurance:    { label: 'Endurance',    emoji: '🏃', color: '#0090FF' },
  team_sport:   { label: 'Team sport',   emoji: '⚽', color: '#DC2626' },
  racket_sport: { label: 'Racket sport', emoji: '🎾', color: '#F59E0B' },
  combat:       { label: 'Combat',       emoji: '🥊', color: '#B91C1C' },
  water_sport:  { label: 'Water sport',  emoji: '🏄', color: '#0369A1' },
  adventure:    { label: 'Adventure',    emoji: '🧗', color: '#854D0E' },
  mobility:     { label: 'Mobility',     emoji: '🧘', color: '#6D4AAF' },
  recovery:     { label: 'Recovery',     emoji: '😌', color: '#9CA3AF' },
};

// Resolve display for a session. Prefers the activity's own data (spread from
// ACTIVITY_DEFS in App.jsx), then falls back to SESSION_DISPLAY keyed by type.
export function getSessionDisplay(actData, type) {
  if (actData?.label && actData?.emoji && actData?.color) {
    return { label: actData.label, emoji: actData.emoji, color: actData.color };
  }
  return SESSION_DISPLAY[type] || SESSION_DISPLAY.other;
}

// [DATA] Keyword → intensity-tier classification for uploaded event-plan
// sessions (Sequencing Advisor P0.2). Runs against the session name/description
// string parsed out of an uploaded .xlsx plan (trainingPlanImport.js). Kept
// here (not in overtrain.js) so it's reusable anywhere a session's tier needs
// to be shown, matching this file's existing role as the name/type → display
// lookup.
export const SESSION_TYPE_INTENSITY = {
  low:    ['easy', 'recovery', 'long slow', 'long run'],
  medium: ['tempo', 'steady', 'moderate'],
  high:   ['interval', 'sprint', 'hill', 'race-pace', 'race pace', 'threshold'],
};

// Checked high → medium → low so a name matching keywords from more than one
// tier (e.g. "Easy interval recovery") resolves to the highest-intensity
// match — under-flagging a hard session is worse than over-flagging an easy
// one.
const TIER_PRECEDENCE = ['high', 'medium', 'low'];

// Returns 'high' | 'medium' | 'low' | null (no keyword match — caller should
// fall back to discipline-level generic load, not crash or return undefined).
export function classifySessionTier(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  for (const tier of TIER_PRECEDENCE) {
    if (SESSION_TYPE_INTENSITY[tier].some(kw => lower.includes(kw))) return tier;
  }
  return null;
}
