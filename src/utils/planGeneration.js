// Calls the generate-training-plan Supabase Edge Function (which talks to the
// Claude API server-side) and turns the JSON it returns into the same
// { meta, phases, sessions } shape used everywhere else in the app for an
// event training plan (see trainingPlanImport.js, which builds this shape
// from an uploaded .xlsx instead).
import { supabase } from './supabase';
import { buildPlanPrompt } from './planPrompt';
import { colorForPhase } from './trainingPlanImport';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = new Set(['swim', 'bike', 'run', 'brick', 'conditioning', 'rest', 'race']);
const VALID_INTENSITY = new Set(['Low', 'Medium', 'High']);

function normalizeType(raw) {
  const key = String(raw ?? '').trim().toLowerCase();
  if (VALID_TYPES.has(key)) return key;
  if (key === 'cycle' || key === 'cycling') return 'bike';
  if (key === 'strength' || key === 'gym') return 'conditioning';
  return 'other';
}

function normalizeSession(raw) {
  return {
    type:        normalizeType(raw?.type),
    label:       String(raw?.label ?? '').trim(),
    sessionType: String(raw?.sessionType ?? '').trim(),
    duration:    raw?.duration != null ? String(raw.duration).trim() : '',
    flag:        raw?.flag ? String(raw.flag).trim() : '',
    intensity:   VALID_INTENSITY.has(raw?.intensity) ? raw.intensity : 'Low',
    done:        false,
    week:        Number.isFinite(Number(raw?.week)) ? Number(raw.week) : null,
    phase:       raw?.phase ? String(raw.phase).trim() : '',
  };
}

function normalizePlan(rawPlan) {
  if (!rawPlan || typeof rawPlan !== 'object') {
    throw new Error("Claude's response wasn't a JSON object.");
  }

  const rawSessions = rawPlan.sessions;
  if (!rawSessions || typeof rawSessions !== 'object' || Array.isArray(rawSessions)) {
    throw new Error("The plan is missing a valid 'sessions' object.");
  }
  const sessions = {};
  for (const [dateKey, entries] of Object.entries(rawSessions)) {
    if (!DATE_KEY_RE.test(dateKey) || !Array.isArray(entries) || !entries.length) continue;
    sessions[dateKey] = entries.map(normalizeSession);
  }
  if (!Object.keys(sessions).length) {
    throw new Error("The plan didn't contain any dated sessions.");
  }

  const rawPhases = Array.isArray(rawPlan.phases) ? rawPlan.phases : [];
  const phases = rawPhases
    .filter(p => p && p.label && Array.isArray(p.weeks) && p.weeks.length === 2)
    .map((p, i) => ({
      label: String(p.label),
      weeks: [Number(p.weeks[0]), Number(p.weeks[1])],
      color: /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : colorForPhase(p.label, i),
    }));

  const dateKeys = Object.keys(sessions).sort();
  const meta = {
    raceType:       rawPlan.meta?.raceType ? String(rawPlan.meta.raceType) : '',
    startDate:      DATE_KEY_RE.test(rawPlan.meta?.startDate) ? rawPlan.meta.startDate : dateKeys[0],
    eventDate:      DATE_KEY_RE.test(rawPlan.meta?.raceDate)  ? rawPlan.meta.raceDate  : dateKeys[dateKeys.length - 1],
    totalWeeks:     Number.isFinite(Number(rawPlan.meta?.totalWeeks))
      ? Number(rawPlan.meta.totalWeeks)
      : phases.reduce((max, p) => Math.max(max, p.weeks[1]), 0) || 1,
    eventDistances: rawPlan.meta?.eventDistances ? String(rawPlan.meta.eventDistances) : '',
    overview:       rawPlan.meta?.overview ? String(rawPlan.meta.overview) : '',
    glossary:       Array.isArray(rawPlan.glossary) ? rawPlan.glossary : [],
    audit:          rawPlan.audit && typeof rawPlan.audit === 'object' ? rawPlan.audit : {},
  };

  return {
    meta,
    phases,
    sessions,
    sourceFileName: 'Generated with Claude',
    importedAt: new Date().toISOString(),
  };
}

export async function generateTrainingPlanWithAI({ goalsPayload, intake }) {
  const prompt = buildPlanPrompt({ goalsPayload, intake });

  const { data, error } = await supabase.functions.invoke('generate-training-plan', {
    body: { prompt },
  });

  if (error) {
    // supabase-js's FunctionsHttpError always carries the generic message
    // "Edge Function returned a non-2xx status code" — the edge function's
    // actual { error: '...' } body (auth failure, missing key, Claude API
    // error, etc.) sits unread on error.context (the raw Response) unless we
    // read it ourselves.
    let message = error.message;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      } catch {}
    }
    throw new Error(message || 'Could not reach the plan generator — check your connection and try again.');
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  if (!data?.plan) {
    throw new Error('The plan generator returned an empty response.');
  }

  return normalizePlan(data.plan);
}
