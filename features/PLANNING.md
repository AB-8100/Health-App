# Pre-Spec Product Planning

This is the stage that runs *before* `features/specs/` gets anything written
to it. Its job is to stop features from being built just because they occurred
to you — every feature gets checked against `docs/PRODUCT_STRATEGY.md` before
it becomes a spec.

## Flow

```
features/ideas.md  (you: raw bullets, any format)
        │  push triggers .github/workflows/plan.yml
        ▼
features/backlog.md  (agent: scored + tagged, opened as a PR)
        │  you: review the PR — edit tags/notes inline, merge when happy
        ▼
merge to main triggers .github/workflows/spec.yml
        ▼
features/specs/00X-name.md  (agent: full spec per approved backlog item, opened as a PR)
        │  you: review the PR — this is the one mandatory checkpoint
        ▼
merge triggers .github/workflows/build.yml  (per spec — see main README)
```

## What the planning pass actually checks, per idea

For each bullet in `features/ideas.md`, the agent scores against
`docs/PRODUCT_STRATEGY.md`:

1. **Persona fit** — does this serve the Multi-Sport Juggler / Cycle-Aware
   Trainer, or is it drifting toward "Undisciplined / Plan-Averse" territory
   (gamification, habit-nudge features, convincing people to follow a plan)?
2. **Horizon** — NOW / NEXT / LATER, per the roadmap in §9 of the strategy
   doc. An idea that's clearly LATER (e.g. full GPS recording) gets tagged
   as such with a one-line reason, not silently built.
3. **Scope-creep risk** — does this quietly re-enter competition with
   Strava/Runna/Garmin on GPS, social, or coaching depth the strategy doc
   explicitly says to avoid?
4. **Architecture cost** — rough size against the current single-`screen`-state,
   no-router architecture (§2–3 of `docs/PROJECT_CONTEXT.md`). Flags anything
   that looks like it wants a router, a state library, or a new backend
   dependency, since those are architecture decisions, not feature decisions.

Output format in `features/backlog.md`:

```md
## <feature name>
- Horizon: NOW | NEXT | LATER
- Persona fit: <one line>
- Scope flag: none | <one line risk>
- Architecture note: <one line, only if non-trivial>
- Verdict: build now | defer | needs your call
```

## Important framing

This scoring is a probabilistic read against the strategy doc, not a
verdict — the agent is pattern-matching your own written priorities back at
your idea list, and it will sometimes misjudge fit or overstate risk. Treat
"Verdict" as a starting recommendation to edit in the PR, not an approval
gate. The one thing this stage is genuinely good for is catching scope creep
and horizon-mismatch *before* a spec — and therefore a build — gets written
for something that was actually a LATER idea.
