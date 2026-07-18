# Backlog — output of the planning pass over features/ideas.md
_This is an illustrative example of what the plan.yml workflow produces — not a live run._

## Cycle-phase-aware training load adjustment
- Horizon: NOW (strategy doc explicitly names this a genuine differentiator)
- Persona fit: Direct hit — Cycle-Aware Trainer persona
- Scope flag: none
- Verdict: build now

## Manual quick-entry logging (distance/duration/pace/RPE)
- Horizon: NOW (universal fallback, listed explicitly in roadmap)
- Persona fit: Multi-Sport Juggler — feeds the coordination/load model
- Scope flag: none — explicitly *not* GPS, stays lightweight
- Verdict: build now

## Rolling weekly "relative effort" load score
- Horizon: NOW
- Persona fit: core coordination-layer thesis
- Scope flag: none
- Architecture note: touches `utils/overtrain.js`, currently placeholder-backed — real logic change
- Verdict: build now

## Monthly AI nudge (pattern-based, free tier)
- Horizon: NOW
- Persona fit: fits free-tier engagement loop per strategy §8
- Scope flag: none — cost-modeled already (~£0.10/user/year)
- Verdict: build now

## Wire HomeScreen rings to real logged data
- Horizon: NOW (flagged as a known gap in PROJECT_CONTEXT §12)
- Persona fit: neutral — polish, not differentiation, but removes a "demo data" gotcha
- Scope flag: none
- Verdict: build now

## Garmin Connect API prototype
- Horizon: NOW (explicitly listed as a research/prototype task, not a shipped feature)
- Persona fit: supports both personas long-term
- Scope flag: none — this is a spike, not a build; spec should say "prototype only, your own account"
- Verdict: build now, scoped as a research spike

## Strip triathlon-specific onboarding assumptions
- Horizon: NEXT (roadmap explicitly places this in "make it usable by someone who isn't you")
- Persona fit: prerequisite for any alpha users, not for you specifically
- Scope flag: none
- Verdict: defer to NEXT — no alpha users lined up yet per roadmap

## Live map + route tracking for runs
- Horizon: LATER, and the strategy doc argues against building it at all
  unless alpha users specifically ask
- Persona fit: re-enters direct competition with Strava/Runna — explicitly
  the thing the coordination-layer thesis is designed to avoid
- Scope flag: high — multi-month build, redundant with Garmin API path
- Verdict: defer indefinitely, needs your call if you disagree

## Streaks and badges for consecutive sessions
- Horizon: not on the roadmap at all
- Persona fit: this is a habit-formation/gamification feature — strategy doc
  explicitly scopes "convincing plan-averse users to follow a plan" out of
  the product
- Scope flag: drifts toward the explicitly-excluded persona
- Verdict: needs your call — likely defer or drop

## In-app coach chat nudging skipped workouts
- Horizon: not on the roadmap
- Persona fit: same concern as streaks/badges — nudge-to-comply features
  target the "Undisciplined / Plan-Averse" persona the strategy doc says
  not to design for
- Scope flag: also risks feeling like the "second job" positioning explicitly
  argues against (§5.3)
- Verdict: needs your call — recommend against, but flagging rather than dropping silently
