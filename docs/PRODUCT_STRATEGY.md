# Forma — Product Strategy v0.1
 
*A working draft, not a fixed plan. Revisit and rewrite as you learn. — v0.4*
 
---
 
## 1. Where this starts
 
Forma wasn't built from a market gap — it was built from a real, lived problem: you needed a way to track gym training, nutrition, cycle tracking, and structured plans (including AI-generated ones) in one place, and nothing off-the-shelf did that well for how you actually train and live.
 
That's a genuinely strong starting point. Most consumer health apps are built backwards — a team guesses at a persona, then builds for it. You *are* the persona. The risk isn't "will anyone want this" — it's generalizing from a sample size of one without checking your assumptions.
 
So the goal of this doc isn't to invent a vision from scratch. It's to make explicit what's currently implicit in your own usage, test whether it generalizes, and give you a plan that survives being picked up and put down.
 
---
 
## 2. Draft vision statement
 
> **Forma is the lowkey coordination layer for people who train across multiple disciplines — the thing that tells you "run Tuesday, not Wednesday, so you're not dead for football Thursday" — not another app trying to replace the trackers you already trust.**
 
The wedge isn't "better gym tracker" or "better nutrition app" — those markets are saturated (Hevy, Strong, MyFitnessPal, Cronometer). It's also not "better triathlon coaching app" — TriDot, Transition, and Athletica already own that ground by being intense and metric-heavy. And critically, **it's not "replace Strava/Runna's GPS tracking and social features"** — those apps are excellent at what they do and users trust them for it.
 
The actual wedge is **coordination across sports that currently coordinate with nothing**. Picture the real user: gym sessions tracked in Notes or Excel (because no gym app has hooked them), running/cycling tracked properly in Strava or Runna (because those apps are genuinely good), and *nothing* connecting the two — so "should I run today" is answered by gut feel, not by what Tuesday's gym session or Thursday's football actually demands of the body. Forma's job isn't to out-track the trackers. It's to sit above them, pull in what they already capture, natively own the undertracked space (gym logging), and let the AI plan reason across all of it — including, for the cycle-aware persona, physiological cycle data none of the sport-specific apps touch at all.
 
**⚠️ Resolved: Strava API integration is off the table (for now).** Standard-tier Strava API access now requires a $10-ish/month developer subscription, and — more fundamentally — their terms restrict using API data in connection with AI applications, which is unsettled even in their own developer community. Decision: **Forma will support native session logging instead of pulling data from Strava/Runna.**
 
**Updated: watch APIs (Garmin, and worth checking Apple/COROS) look like a better path than Strava for real GPS/activity data.** Garmin's Connect Developer Program offers free self-serve access to a developer's own data, doesn't carry Strava's explicit AI-use restriction (though this should be confirmed directly with Garmin before relying on it), and — notably — includes a **Women's Health API for menstrual cycle data**, which could feed the Cycle-Aware persona directly rather than asking users to duplicate that logging in Forma. It's also bi-directional, meaning Forma could eventually push planned sessions straight to the watch. Tradeoff: this is Garmin-specific — Apple Watch and COROS users would need separate integrations, each with their own approval process, so this is a "pick your primary hardware ecosystem for alpha" decision, not a universal fix.
 
**Recommendation on sequencing:** start with lightweight manual logging as the universal fallback (works for anyone, any watch, zero integration risk), and treat Garmin API access as a parallel NOW-horizon research/prototyping task — not a blocker, since your own personal data access is free and immediate. Full GPS recording built natively in Forma is still not recommended (see below) now that a watch-API path exists; that would be redundant with what Garmin already provides.
 
**Important build-scope distinction:** native logging does **not** mean building full GPS recording (live maps, route tracking, elevation, background location). That's a multi-month problem on its own and walks back into direct competition with Strava/Runna/Garmin on exactly the thing they're excellent at — which the coordination-layer thesis was designed to avoid. The overtraining/coordination module only needs **distance, duration, pace, and perceived effort** — not a live map. Recommendation: build lightweight manual/quick-entry logging first (LATER-horizon: revisit full GPS only if users specifically ask for it, which would itself be a useful validation signal).
 
---
 
## 3. Target personas (draft)
 
### Primary: "The Multi-Sport Juggler" — closest to you
- Late 20s–30s, urban professional, disposable income, trains 4–6x/week across 2+ modalities (e.g. gym + running/cycling/swimming + a team sport like football)
- **Realistic current tooling — this matters for scoping:** gym sessions live in Notes or an Excel sheet (no app has won them over), running/cycling is tracked properly in Strava or Runna (these are good and won't be displaced), and nothing connects the two. The gap isn't tracking — it's coordination: "should I run today, or will that wreck Thursday's football?"
- Training toward something specific (race, event, physique goal) — not just "staying active"
- Values data and structure but doesn't want to *become* a data analyst to use the app
- **Important framing: this is not an elite or coached athlete.** If someone genuinely needs periodised, race-specific coaching (a sub-3-hour marathoner, a competitive age-grouper), they should go to a professional trainer or a dedicated platform like TriDot. Forma is deliberately **lowkey** — structured enough to feel like a real plan, not so intense it feels like being coached.
 
### New persona to design for: "Cycle-Aware Trainer"
- A woman who wants her training load to reflect where she is in her monthly cycle — e.g. ramping intensity in the follicular/ovulation window, easing off and prioritising recovery-friendly sessions in the luteal phase
- This isn't a niche add-on — it's a genuine differentiator. None of the major competitors (Runna, TriDot, TrainingPeaks, Athletica, Strava) surface cycle-phase-aware plan adjustment as a feature, despite it being well-established training science
- Forma already tracks cycle data — the opportunity is connecting that data to the *plan generator itself*, not just logging it alongside training in parallel
 
### Explicitly NOT for: "The Undisciplined / Plan-Averse"
- People who don't want a plan, don't want structure, and train purely on vibes
- This isn't a judgment — it's a scoping decision. Building onboarding, motivation nudges, or gamification to convert plan-averse users into plan-followers is a different (and much harder) product problem. Don't let this persona's feedback pull the roadmap toward habit-formation features.
 
**Recommendation:** the Multi-Sport Juggler and Cycle-Aware Trainer are really the same underlying persona wearing two hats — someone who wants a plan that reflects *all* the real inputs (multiple sports, physiological cycles, actual life) rather than a plan that pretends only one variable exists. Design for that person specifically, not for athletes and not for people who need convincing to follow a plan at all.
 
---
 
## 4. Positioning against alternatives
 
| | Forma's angle |
|---|---|
| Hevy / Strong (gym) | Not competing here — gym stays lightly native to Forma since no app has actually won this space (users are in Notes/Excel), but Forma isn't trying to out-feature a dedicated gym app either |
| Strava (cardio/cycling, owns Runna as of 2025) | **Integrate, don't replace.** Users keep Strava for GPS/social; Forma pulls activity data in (subject to API terms — see risk flag) to feed the coordination layer |
| Runna | Same — Runna stays the running coach; Forma's value is knowing that Tuesday's Runna session affects Thursday's football, which Runna itself has no visibility into |
| TriDot / Transition / Humango / Athletica | Multi-sport and AI-adaptive, but built for triathletes chasing race performance — dense metrics, $30–200/month, coach tiers, steep learning curve |
| TrainingPeaks | Multi-sport but built for coached athletes, clunky, expensive |
| MyFitnessPal / Cronometer | Nutrition-only, disconnected from training load |
| Generic AI chat (asking Claude/ChatGPT for a plan) | No persistent tracking, no adaptation over time, you rebuild context every time |
 
The gap, sharpened again: **nobody is building the coordination layer that sits above the tools people already trust.** Every competitor wants to be the one app you live in. Forma's bet is the opposite — be the thing that makes your existing apps work together, plus own the one piece (gym logging, cycle-aware adjustment) that's genuinely undertracked today.
 
---
 
## 5. Market research deep-dive: competitors, pricing, and go-to-market
 
### 5.1 Competitive matrix
 
| | Core offer | UK pricing | How they sell | Where Forma wins / doesn't compete |
|---|---|---|---|---|
| **Strava** | GPS tracking, social feed, segments, post-2024 analytics behind paywall | Free tier; Premium £8.99/mo or £54.99/yr; Family £139.99/yr equiv | Freemium, community/social virality (kudos, clubs, segments), moving toward IPO, tightening API access | Forma doesn't compete on GPS/social — integrates or coexists |
| **Runna** (Strava-owned since 2025) | AI-adaptive running plans, coach-designed, strength + injury guidance | £15.99/mo or £99.99/yr standalone; £119.99/yr bundled with Strava (Android/web only) | App-store discovery, running-influencer marketing, race partnerships (e.g. NYRR), student discounts, first-week free | Single-sport by design — Forma's edge is knowing Tuesday's Runna session affects Thursday's football, which Runna can't see |
| **TriDot / Transition / Humango / Athletica** | AI-adaptive multi-sport (triathlon) coaching, race prediction, physiological modelling | TriDot: $29–199/mo (~£23–155/mo) tiered, top tier includes human coach | Niche triathlon media (Triathlete, 220 Triathlon), exercise-scientist credibility, coach partnerships | These own "serious triathlete AI coaching" — Forma is deliberately less intense, cheaper, and not race-performance-obsessed |
| **TrainingPeaks** | Multi-sport planning + analytics, coach-athlete marketplace | Coach-dependent pricing, generally $19.95+/mo for athletes | Sells to coaches first, athletes second; long-established in endurance coaching | Coach-first model — Forma is self-directed, no coach relationship required |
| **Hevy** | Gym/strength logging, clean UX, social feed | Free tier (4 routines, 3-month history); Pro ~$2.99/mo, $23.99/yr, $74.99 lifetime | Organic/App Store virality, minimalist UX as differentiator, separate B2B "Hevy Coach" product for PTs | Forma doesn't out-feature Hevy on gym depth — could even integrate with it later rather than compete |
| **MyFitnessPal / Cronometer** | Nutrition/calorie tracking | Freemium, ~£8–10/mo premium | Huge legacy food database, ad-supported free tier | Nutrition-adjacent only — not a primary battleground for Forma |
 
### 5.2 USP, sharpened against this set
 
No competitor above occupies **"AI-adaptive, multi-sport coordination, at a lowkey price and intensity level, for self-directed non-elite athletes."** Specifically:
 
- **Runna and Strava** are single-sport or social/tracking tools — neither reasons across disciplines.
- **TriDot/Transition/Athletica** are multi-sport and AI-adaptive but priced and designed for people chasing race performance ($30–200/month, dense metrics, coach tiers) — a different, more intense customer than the Multi-Sport Juggler.
- **TrainingPeaks** requires a coach relationship, which the Multi-Sport Juggler explicitly doesn't want.
- **Nobody** surfaces cycle-phase-aware training adjustment as a core feature, despite the underlying science being well established.
 
**Why someone would choose Forma over their current stack:** not because Forma tracks better than Strava or Runna — it doesn't try to — but because it's the only place that knows what *all* of their training adds up to, at a price and complexity level that doesn't feel like signing up for a second job.
 
### 5.3 Pricing recommendation
 
Given the "lowkey" positioning, Forma should price **below** Runna (£15.99/mo) and TriDot-tier apps, closer to Hevy's accessible end — reinforcing that this is a lightweight layer, not a premium coaching product competing for the same wallet share as Strava+Runna. A reasonable starting point: **free tier (manual logging, basic coordination) + paid tier around £4.99–£7.99/month or ~£40–70/year** for AI-adaptive planning and cycle-aware features. This is deliberately positioned as an *add-on* to what users already pay for (Strava, Runna, gym membership), not a replacement subscription competing head-on for the same spend.
 
---
 
## 6. UK market sizing — TAM and SAM
 
**Important caveat before the numbers:** there's no official published dataset that cross-tabs "people who train in 2+ disciplines and want AI-coordinated plans" — that specific slice doesn't exist in any market report. What follows is a transparent, assumption-labelled estimate built from real UK participation data (Sport England, British Triathlon, industry market-sizing reports), not a single sourced figure. Treat the ranges as directional, not precise.
 
### 6.1 The funnel
 
| Layer | UK figure | Source / basis |
|---|---|---|
| UK population | ~69 million | General population |
| UK adults (18+) | ~55 million | General population |
| **Adults meeting CMO physical activity guidelines (150+ min/week)** | ~36–37 million (England: 30.9M at 64.6%, scaled UK-wide) | Sport England Active Lives Survey, Nov 2024–25 |
| **Adults doing structured "fitness activities" (gym/fitness class, 2x/28 days+)** | ~18–19 million (England: 15.3M, scaled UK-wide) | Sport England Active Lives Survey |
| UK gym members specifically | 10.5 million+ | UK fitness industry data, 2024 |
| **Estimated multi-sport / cross-training self-directed segment** (gym + at least one other structured discipline — running, cycling, swimming, team sport) | **~2.5–3.5 million** *(estimated — no direct source; assumes roughly 15–20% of the fitness-activity population trains across 2+ disciplines in a structured way, based on general cross-training patterns)* | Estimate derived from Sport England data |
| GB active racing triathletes (hardcore anchor point, not the core target) | 120,000+ | Triathlon Industry Alliance 2025 Report |
 
### 6.2 TAM (Total Addressable Market)
 
- **Population TAM:** ~36–37 million UK adults who are physically active — the broadest reasonable pool for *any* fitness/training app.
- **Revenue TAM:** the UK fitness app market currently generates roughly **£360–500 million/year** in revenue (derived from $455.3M in 2025, projected to $625.4M by 2027), across all fitness app types (tracking, nutrition, workout, meditation). This is a ceiling reference — Forma would never realistically capture this whole market, since most of it is nutrition-only or single-purpose apps outside Forma's category.
 
### 6.3 SAM (Serviceable Addressable Market)
 
**This range was stress-tested against two opposing readings of the same underlying data, not just picked once and left alone.**
 
- **Skeptical case:** the cross-training population is narrower than raw "does 2+ sports" suggests, because most cross-trainers are genuinely happy running on gut feel, and incumbents (Runna's adaptive rescheduling, Strava's Athlete Intelligence) already chip away at part of the coordination pain. Estimate: ~8% of the fitness-activity population (~1.5M), converting at 0.5–1% (multi-sided coordination products have a real cold-start/activation problem — no value until data is logged across several activities), at £40/year ARPU. **Revenue SAM: ~£300K–£600K/year.**
- **Optimistic case:** running, fitness classes, and gym are already the UK's top three activities with heavy natural overlap, and the Triathlon Industry Alliance names "converting runners to multisport" as an active growth lever — a genuine tailwind. Estimate: ~25% of the fitness-activity population (~4.7M), converting at 5–8% (a well-targeted niche product solving a real felt pain, with word-of-mouth potential similar to Runna's early trajectory), at £75/year ARPU (with cycle-aware and watch-integration upsells). **Revenue SAM: ~£17.6M–£28M/year.**
 
| | Skeptical case | Optimistic case |
|---|---|---|
| Cross-training population | ~8% of fitness-activity pool → ~1.5M | ~25% of fitness-activity pool → ~4.7M |
| Paid conversion | 0.5–1% | 5–8% |
| ARPU | £40/year | £75/year (with upsells) |
| **Resulting revenue SAM** | **~£300K–£600K/year** | **~£17.6M–£28M/year** |
 
**The finding that matters more than either number:** this is roughly a 50x spread between two defensible readings of the same market — and the *population* estimate barely moves it. The **conversion rate assumption does almost all the work.** That means this isn't really a market-sizing question anymore; it's an execution and validation question. No further desk research will narrow this range — only real usage data will (do actual cross-training users engage and convert, and at what rate, once they have a working alpha).
 
### 6.5 Cohort-adjusted ARPU — the flat £40-75/year figure overstates realized revenue
 
The ARPU used above assumes something close to a steady, year-round subscriber. But "Trainer" mode is inherently seasonal — someone pays to prepare for a specific race, then has little reason to keep paying once they've raced. A typical marathon training block runs ~16 weeks (~4 months).
 
At a sticker price of ~£7/month:
- **One race block/year** (most users): ~4 months active payment → realized ARPU ≈ **£28/year**
- **Two race blocks/year** (more engaged users, e.g. spring marathon + autumn triathlon): ~7-8 months active → realized ARPU ≈ **£49-56/year**
- **Blended, realistic mix:** cohort-adjusted ARPU is probably **£25-45/year** — below the flat £40-75 figure used in section 6.3, not dramatically so, but enough to matter when compounded through the rest of the model.
 
### 6.6 SOM — what's actually reachable in the near term (this is likely the more useful number)
 
Section 6.3's TAM/SAM answers "how big is the theoretical opportunity if this became a funded, marketed business." It does not answer "what could realistically happen in the next 1-3 years of opportunistic, unfunded, solo work" — a materially smaller question, because it depends on distribution reach, not just population size and conversion rate. That's the gap between SAM and **SOM (Serviceable Obtainable Market)**, and it's likely the real reason the SAM/TAM figures feel too high — they implicitly assume a level of reach (thousands of paying users) that only exists once there's real marketing spend, partnerships, or organic growth that's actually taken off.
 
| Step | Realistic range (solo, opportunistic, organic-only) |
|---|---|
| People who become aware of / try Forma in year 1–2 | 500–3,000 (personal network, alpha testers' word of mouth, limited organic content) |
| % actively training for a specific marathon/triathlon (relevant to Trainer mode specifically) | ~30–40% → 150–1,200 people |
| Trial-to-paid conversion (engaged trialists, not cold population — higher than the population-wide rate used in 6.3) | 5–15% → 8–180 paying users |
| Cohort-adjusted ARPU | £25–45/year |
| **Realistic year 1–2 revenue (SOM)** | **~£200–£8,100/year** |
 
**This is the number to plan around near-term, not the £300K–600K/year skeptic SAM case.** The SAM figures aren't wrong — they're a legitimate answer to a different question ("what's this worth at maturity, with real investment"). But conflating SOM and SAM is exactly what made the numbers feel implausibly high. Worth being explicit with yourself about which question you're actually asking at any given moment: "is this worth building at all" (SAM/TAM territory) vs. "what should I expect in the next year or two" (SOM territory, and the honest answer is: not much revenue, and that's normal for this stage).
 
**Fixed costs push the low end into a real loss — and there's more of them than just Apple.** The SOM figures above are gross revenue only. Beyond the Apple Developer Program cost, several other free-tier assumptions have real trigger points once this becomes a genuine product rather than a personal prototype:
 
| Cost | Amount | Trigger |
|---|---|---|
| **ICO Data Protection Fee** (UK-specific, easy to miss, not scale-dependent) | £52/year (£47 by direct debit), Tier 1 | Legally required for almost anyone processing personal data electronically in the UK, including sole traders. Non-payment risks fines up to £4,350 |
| Apple Developer Program + overhead | ~£30/month (~£360/year) *(Apple's own published fee is $99/year (~£79/year) — worth confirming what the higher figure includes)* | Only if shipping native App Store distribution — deferrable by staying a web app |
| Supabase Pro | $25/month (~£20/month, ~£240/year) | Free tier caps at 500MB database, 50K MAU, 500K Edge Function invocations/month — generous headroom, likely not hit until well past alpha/early growth stage |
| App Store / Play Store commission | 15% of paid revenue (Small Business Program, under $1M/year) | Only applies if the paid tier sells via in-app purchase; avoidable via web-based Stripe checkout (~1.5–2.9% + 20p/transaction instead) |
| Custom domain (optional) | ~£10–15/year | If not staying on a github.io or vercel.app subdomain |
 
**Architecture note:** moving the frontend back to **GitHub Pages** (free, no commercial-use restriction, low switching cost since Forma was already deployed there before) and routing any Claude API calls through a **Supabase Edge Function** rather than a Vercel serverless function removes Vercel from the stack entirely — not just defers it. Supabase's free tier explicitly permits commercial use, unlike Vercel's Hobby tier, and 500K Edge Function invocations/month is far more headroom than a monthly-cadence AI nudge or even a more frequent Trainer-mode call would need for a long while. One thing worth watching: Supabase free projects pause after 7 days without database activity — fine for a low-traffic alpha, worth a cheap keep-alive workaround (e.g. a scheduled GitHub Action ping) if that becomes annoying once real users are checking in regularly.
 
**Revised realistic picture with this architecture:** the only genuinely unavoidable cost is the **£52/year ICO fee** — everything else (Apple, Supabase Pro) is trigger-based and deferrable until there's real signal it's needed. That's a meaningfully better starting point than the ~£700/year figure assumed before. Set against the SOM range:
 
| | Low end | High end |
|---|---|---|
| Gross SOM revenue | £200/year | £8,100/year |
| Unavoidable cost (ICO fee only) | –£52/year | –£52/year |
| **Net** | **£148/year** | **£8,048/year** |
 
Even the low end now nets positive — a meaningfully better starting position than the earlier ~£700/year fixed-cost assumption gave. Apple's ~£360/year and Supabase Pro's ~£240/year remain real costs, but both are genuinely deferrable: worth deciding deliberately whether native App Store distribution is necessary yet, or whether staying on GitHub Pages + Supabase free tier makes sense until there's real signal (alpha users specifically asking for a native app, or hitting Supabase's free-tier limits) that upgrading is worth it.
 
### 6.7 What this means practically
 
This is a **real but genuinely uncertain market** — not because the population doesn't exist (it clearly does, at 1.5-4.7M depending on assumptions), but because whether this becomes a £300K/year hobby-scale outcome or a £20M+/year real business hinges almost entirely on conversion and engagement rates that can't be estimated from desk research. The honest takeaway: don't spend more time refining this number. The NOW-horizon validation work (showing Forma to real people, section 9) isn't just about "do they get the pitch" — it's the only real way to move this range, because it's the closest cheap proxy available for the conversion assumption that's actually driving the whole calculation.
 
---
 
## 7. Product principles (draft — edit freely)
 
1. **Unification over feature depth.** Better to be very good at connecting gym+cardio+nutrition+plan than to out-feature a single-purpose app.
2. **The plan should react to reality**, not just prescribe once. If early users only get value from the *initial* AI-generated plan and not ongoing adaptation, that's a signal the core loop is too thin.
3. **Low admin burden.** You built this partly because other apps demanded too much manual entry. Don't let feature creep bring that back in.
 
---
 
## 8. Product architecture: free vs. paid
 
Two distinct modes, mapping cleanly onto the personas already defined:
 
### Free: Coordination + logging + monthly AI nudge
- The core "lowkey coordination layer" — a simple view of when to run vs. gym vs. rest, based on the load model (section 7). This stays rule-based and instant — no API call needed.
- Genuinely good, customisable gym session logging — the undertracked space nobody else owns (section 2)
- **New: a monthly AI-generated nudge** — e.g. "you tried X last week, now try Y at the gym" — a lightweight pattern-based suggestion pulled from a month of logged data. At current Claude API rates (Sonnet 5, $3/$15 per million input/output tokens), a monthly call with ~2,000 input tokens and ~300 output tokens costs roughly **$0.01/call, or ~£0.10/user/year** — genuinely trivial, even cheaper on Haiku 4.5. This is cheap enough to sit in the free tier as a real engagement and word-of-mouth driver ("look what Forma just told me"), rather than being gated behind payment.
 
### Paid: Goal-specific AI plan generation ("Trainer" mode)
- For users training toward a specific race (triathlon, marathon) who want a genuinely periodized plan, not just day-to-day coordination or a monthly tip
- Two generation paths:
  - **Upload feature (built, currently free):** user provides their data/context, AI generates a plan once — a static, generate-once artifact
  - **Built-in live API (not yet built, intended paid):** ongoing, adaptive plan generation that reacts to actual logged training data over time — the same "plan should react to reality" principle from section 7, but for race-specific periodization specifically
 
**⚠️ Two things to resolve before locking this in:**
 
1. **Cannibalization risk — reduced, but still worth testing.** The monthly nudge and the paid Trainer mode are now categorically different in scope (a monthly tip vs. a full periodized plan), which is a healthier free/paid split than "static plan vs. adaptive plan" was. Still worth confirming with alpha users that the paid tier's value is obviously bigger than the free nudge, not just "more frequent."
2. **Unit economics — largely resolved for the free-tier nudge** (see cost estimate above; ~£0.10/user/year is a non-issue even at real scale). The open question now is narrower: does the **paid live-API Trainer mode**, which likely needs richer context (full training history, race-specific periodization logic) and probably calls more often during an active race block, stay comfortably below the £40–75/year ARPU range? Worth a similar back-of-envelope calculation once that feature's actual call frequency and context size are known.
 
**Terminology note:** "Trainer" here means someone *in training* for a specific race — not a coach managing other people's plans (that would be a different product, closer to TrainingPeaks or Hevy Coach). Worth using a different internal name if there's any risk of that ambiguity causing confusion later.
 
---
 
## 9. Roadmap — Now / Next / Later
 
Built for opportunistic execution: no dates, just sequencing. Move to the next horizon when the current one is genuinely done, not when you feel like it.
 
### 🟢 NOW — De-risk before you build for others
The core question right now isn't "what feature next" — it's **"does anyone other than me actually want this?"** Everything here is about answering that as cheaply as possible.
 
- [ ] Prototype Garmin Connect API access using your own account (free, self-serve) — pull your own activity and Women's Health/cycle data to see what's actually usable before committing to it as a real integration
- [ ] Confirm directly with Garmin (developer docs or support) whether their terms restrict AI application use of the data, the way Strava's do
- [ ] Design the lightweight session-logging flow (distance/duration/pace/RPE — no GPS, no maps) and how it feeds the weekly load model, as the universal fallback for non-Garmin users
- [ ] Design the load/intensity model itself. Recommendation: keep it lowkey — a rolling weekly "relative effort" score (duration × a simple intensity band: easy/moderate/hard, derived from pace or self-selected) rather than a full TSS-style physiological model. This is enough to power "run Tuesday, not Wednesday" logic without turning Forma into TrainingPeaks
- [ ] Triage known bugs into three buckets: blocks the core loop (fix), ugly-but-survivable (leave, narrate around it live), edge case (ignore for now) — only the first bucket needs fixing before showing anyone
- [ ] Write down (1 paragraph) what Forma does *for you specifically* that nothing else does — this is your pitch, stress-test it on 3–5 people who train seriously (gym friends, triathlon club, swim group)
- [ ] Show Forma to 5–8 people who look like the "Multi-Sport Juggler" persona — not for feedback on UI, but to see if they *get* the value prop unprompted. Given known bugs, run these as supervised sessions (you present, you route around rough edges live) rather than waiting for a polished, fully independent-use version
- [ ] Separately, talk to 3–5 women who train regularly about cycle-aware training specifically — is this a "nice to have if it exists" or a genuine reason to switch apps? This determines whether it's a NOW-horizon build priority or a NEXT-horizon nice-to-have
- [ ] Identify the single biggest piece of "tape" holding the current build together (data model, auth, hosting) that would break under a second user — fix only that, not everything
- [ ] Move frontend back to GitHub Pages (free, permits commercial use) and route Claude API calls through a Supabase Edge Function rather than a Vercel serverless function — removes Vercel from the cost stack entirely
- [ ] Set up a lightweight keep-alive (e.g. scheduled GitHub Action ping) if Supabase's 7-day inactivity pause becomes an issue once alpha users are active regularly
- [ ] Design the monthly AI nudge prompt/logic (free tier) — cheap enough (~£0.10/user/year) not to need rate-limiting or gating
- [ ] Once the live-API Trainer mode's likely call frequency and context size are clearer, run the same rough unit-economics check against the £40–75/year ARPU range — narrower question now that the free-tier nudge cost is resolved
- [ ] When testing with alpha users, specifically probe whether the free upload-generated plan feels "good enough" — this is the cheapest signal available on the cannibalization risk flagged in section 8
 
### 🟡 NEXT — Make it usable by someone who isn't you
- [ ] Multi-user auth/data isolation (if not already there — Drive App Data storage was single-user-oriented last I knew)
- [ ] Onboarding flow: a stranger needs to understand the value in their first 2 minutes, without you sitting next to them explaining it
- [ ] Strip anything hyper-specific to your own training (triathlon-specific assumptions, etc.) into configurable defaults
- [ ] Pick 3–5 real people from your validation list to be alpha users — not a public launch
- [ ] Build the live API "Trainer" mode only once the free upload path has been alpha-tested and the cannibalization question has a real answer
 
### 🔴 LATER — Only after alpha signal is genuinely good
- [ ] Decide: side project (slow, sustainable, maybe monetize eventually) vs. real push (time investment, possibly fundraising/cofounder conversations)
- [ ] Full GPS recording (live map, route, elevation) — only build this if alpha users specifically ask for it. If they're happy logging distance/pace/RPE manually, this is a lot of build effort for something Strava/Runna already do better
- [ ] Visual identity / brand polish (you clearly have taste for this from Soft Serve — don't waste it early on a product that hasn't found its users yet)
- [ ] Monetization model — worth deferring until you know who's actually using it and why
 
---
 
## 10. What "done" looks like for the NOW horizon
 
You'll know you're ready to move to NEXT when you can answer, with real evidence (not a guess): *"Would these 5 people be genuinely annoyed if Forma disappeared tomorrow?"* If the honest answer is "not really," that's not a failure — it's the cheapest possible lesson, and worth having before you spend real time on multi-user infrastructure.
