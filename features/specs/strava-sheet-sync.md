# Strava → Google Sheet → Forma Sync

Status: Draft — technical spec for an implementing Claude Code session. Kept
to the same shape as the project's other specs (`trail-running-support.md`,
`deterministic-endurance-plan-generator.md`) per `CLAUDE.md`'s "do not
implement a feature whose spec you have not read in full" rule.

Confirmed with the user before writing this (recorded here so the
implementing session doesn't have to re-derive them):

1. **Sync is client-side, on app foreground/login** — not a server-side cron.
   No new backend secrets, no refresh-token storage. New Strava activities
   are picked up the next time Forma is opened, not instantly.
2. **Sheet access reuses the existing Google OAuth flow** (`utils/googleSheets.js`'s
   token client), not a publish-to-web CSV link.
3. **A new Supabase table (`strava_activities`) is required.** `gym_sessions`
   is delete-then-insert on every client save (`docs/PROJECT_CONTEXT.md` §12),
   so a synced row can't be reconciled safely by writing into it directly —
   it needs its own table, reconciled into `completedSessions` in memory,
   then saved the normal way.
4. **Merge policy: fill gaps only, never overwrite.** If the user already
   manually logged a value (distance, duration, etc.), Strava never replaces
   it — it only fills fields the user left blank. This matters because the
   source sheet has real data-quality problems (§2) that shouldn't be able to
   clobber something the user typed deliberately.

Per `CLAUDE.md`'s escalation rules, this feature touches **two** things that
require the `needs-human-review` label rather than auto-merge: a new file
under `supabase/migrations/`, and Google OAuth/Sheets config (`utils/googleSheets.js`
or a sibling module reusing its token client). Flag both explicitly in the
PR description — do not let this auto-merge.

## Non-goals (explicitly out of scope)

- **No direct Strava API integration.** The user already has a live
  automation (outside this repo — Zapier/Make/IFTTT or similar) writing
  Strava activities into the Google Sheet. This spec starts at "read the
  Sheet," not "talk to Strava's API." If that upstream automation breaks,
  it's not this feature's problem to detect or fix.
- **No changes to the existing Sheets *backup* feature** (`utils/googleSheets.js`'s
  `Backup`/`Profile`/`Sessions`/etc. tabs, `connectGoogle`/`saveToSheets`).
  That's a different spreadsheet (created and owned by Forma) from the one
  this spec reads (the user's own pre-existing Strava sheet). They may end up
  sharing an OAuth token, but not a spreadsheet ID, and not code paths beyond
  what §3 explicitly says to share.
- **No server-side/background sync.** Confirmed decision #1 above — this is
  a known, accepted limitation, not an oversight.
- **Auto-completion is not limited to triathlon disciplines.** Earlier
  drafting of this spec scoped reconciliation to `run`/`swim`/`cycle` only —
  corrected per user feedback. The real boundary is Forma's full non-gym
  `ACTIVITY_TYPES` set (`GymPlanScreens.jsx` line ~3247): `run`, `walk`,
  `swim`, `yoga`, `hike`, `cycle`, plus `gym` for a Strava strength-type
  activity. Any `Sport_type` that maps to one of *those* is reconciled the
  same way run/swim/cycle are (§4). Only a `Sport_type` with no sensible
  Forma counterpart (golf, kayaking, sailing, etc.) falls through to
  `activity_type: 'other'` — still stored in `strava_activities` for
  visibility, but never auto-completed or reconciled, since there's no
  scheduled/loggable counterpart to reconcile it against.

## 1. Context — what's already there

- `screens/GymPlanScreens.jsx`'s `ACTIVITY_TYPES` (line ~3247) is the
  canonical list of non-gym activity buttons: `run`, `walk`, `swim`, `yoga`,
  `hike`, `cycle`, `other` (plus `gym`). `data/sessionDisplay.js`'s
  `SESSION_DISPLAY` mirrors this for icon/label/colour lookups elsewhere.
  This spec only ever writes `type: 'run' | 'swim' | 'cycle'`.
- A logged activity lives in the flat `completedSessions` array
  (`App.jsx`), one entry per finished/manually-marked session, built by
  `ActivityTimerScreen` (`screens/GymSessionScreen.jsx`) on manual finish.
  Relevant fields on an activity-type entry: `id` (client-generated,
  `Date.now().toString()`), `type`, `workout` (label), `date`/`endedAt`,
  `elapsed` (seconds), plus type-specific fields — `distance`/`unit` for
  run/cycle, `poolLengthM`/`lengths`/`distance`/`distanceUnit` for swim
  (`swimExtras` in `ActivityTimerScreen`), and `rpe` on all of them. This is
  what `sessionToDb` (`utils/supabase.js`) writes into `gym_sessions.raw` —
  **all of Forma's completed-activity history, gym and non-gym alike, lives
  in the misleadingly-named `gym_sessions` table**, delete-then-inserted on
  every save.
- `utils/sessionCompletion.js` already matches completed sessions to
  *scheduled* sessions by workout label for a given calendar day. Strava
  activities don't know Forma's scheduled workout labels, so §4 below needs
  its own, simpler match: same local calendar date + same `type` (subject to
  the `cycle`/`bike` equivalence in §1.1 below), not label.

### 1.1 Pre-existing bug this feature must not make worse: `cycle` vs `bike`

There is already a live inconsistency in the app, independent of this
feature, that this sync **must** account for rather than silently
reproduce: the cycling discipline is stored under **two different `type`
strings depending on which part of the app generated the session**.

- Non-race sources — `GymPlanScreens.jsx`'s `ACTIVITY_TYPES`, the
  auto-generated weekly schedule (`utils/scheduleGeneration.js`), day
  activities logged via `ActivityTimerScreen` — all use `type: 'cycle'`,
  `label: 'Cycle'`.
- Event-race training plans — the deterministic engine
  (`utils/planEngine.js`'s `buildBikeEntry`), an uploaded `.xlsx` plan
  (`utils/trainingPlanImport.js`'s `DISCIPLINE_TYPE_MAP`), and the retired
  AI generator (`utils/planGeneration.js`) — all use `type: 'bike'`,
  `label: 'Bike'`.
- `utils/sessionCompletion.js`'s `isSessionCompleted` matches a non-gym
  scheduled session to a completed one **by label** (`s.workout ===
  sess.label`). Since `'Cycle'` and `'Bike'` are different strings, a
  logged activity from one source doesn't mark a scheduled session from the
  other source complete — that's the "live issue... depending on the
  source" being described. `data/sessionDisplay.js`'s `SESSION_DISPLAY` then
  compounds it visually with two separate colour/emoji entries (`cycle`:
  purple, `bike`: orange).
- `utils/analytics.js` already has to work around exactly this split for its
  own purposes — `SPEED_TYPES = ['cycle', 'bike']` and `DISCIPLINE_FOR_TYPE
  = { cycle: 'bike', bike: 'bike', ... }` treat the two as aliases when
  computing pace/speed and goal paces. **This spec follows that existing
  precedent rather than inventing a new convention.**

**Decision — fixing the underlying `cycle`/`bike` split app-wide (unifying
`sessionCompletion.js`'s matching, `SESSION_DISPLAY`, and every
producer/consumer of the two strings) is a real bug but a separate,
larger piece of work than this spec's scope — flag it in the PR description
as a follow-up, don't fold it into this feature.** What this feature *does*
need to do, scoped to its own reconciliation logic only (§4): treat `cycle`
and `bike` as one equivalence class everywhere it checks "is there already a
matching session for this Strava ride" — so a Strava `Ride` can satisfy
*either* a `cycle`-typed day activity *or* a `bike`-typed event-plan
session on the same day, never just one of them. Without this, a triathlete
with an active event plan would see their Strava rides silently fail to
mark the plan's own Bike sessions complete, which is precisely the
"either one is marked to completion" outcome asked for.
- `utils/googleSheets.js` already owns a Google Identity Services token
  client with scope `https://www.googleapis.com/auth/spreadsheets` +
  `.../drive.file`. The **`spreadsheets`** scope (unlike `drive.file`) grants
  read/write to *any* spreadsheet the signed-in user has access to, not just
  ones Forma created — so reading the user's own pre-existing Strava sheet
  needs **no new OAuth scope**, only a way to plug in a different spreadsheet
  ID and reuse the same access token.

## 2. The source data — what's actually in the sheet

Read directly from the live sheet
(`191tLHr266O3IdRnqIhsU_siB8w78jdI2JS89gxoNQ_s`) to ground this in real rows,
not an assumed schema. Header row and a sample of body rows:

| Athlete_id | Distance_km | Time_formatted | Pace_min_per_km | Activity_name | Sport_type | Calories | Elevation_gain | Date | Device | Activity_url | ID | runtime_meta |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 71607932 | 3.68 | `<span type="duration" hours="24" minutes="30" seconds="0">24:30:00</span>` | 6:39 | Evening Run | Run | 290 | 42.4 | 2026-08-11 17:44:11 | Strava App | strava.com/activities/19706792185 | 19706792185 | FALSE |
| 71607932 | 3.68 | *(same span as above)* | 6:39 | Evening Run | Run | 290 | 42.4 | Tue Aug 11 2026 | Strava App | *(same URL/ID)* | 19706792185 | |
| 71607932 | 3.44 | 23:12 | 6:44 | Afternoon Run | Run | 271 | 41.8 | Fri Aug 14 2026 | Strava App | .../19738700051 | 19738700051 | |
| 71607932 | 10.7 | `<span ... hours="35" minutes="56" seconds="59">35:56:59</span>` | 3:22 | Afternoon Ride | Ride | 206 | 65.7 | Sat Aug 15 2026 | Strava App | .../19753149942 | 19753149942 | |
| 71607932 | 19.72 | 1:02:26 | 3:10 | Evening Ride | Ride | 338 | 60.9 | Thu Aug 27 2026 | Strava App | .../19926926803 | 19926926803 | |

**Decision-relevant data-quality problems, all handled explicitly in §3
rather than assumed away:**

1. **`ID` is the only reliable natural key.** It's Strava's own activity ID
   (matches the trailing segment of `Activity_url`) and is stable — use it
   as the idempotency/dedupe key for every row, never the sheet row number.
2. **The sheet already contains a literal duplicate row** — activity
   `19706792185` appears twice, once with a full timestamp
   (`2026-08-11 17:44:11`), once with a date-only string
   (`Tue Aug 11 2026`) and no `Device`/`runtime_meta` set. This looks like
   the upstream automation re-appending a row on a later run rather than
   updating in place. **Decision: upsert on `(user_id, strava_id)` — last
   write wins.** Since both rows describe the same activity, whichever is
   read last simply overwrites the same DB row; no data is lost either way.
3. **`Time_formatted`'s `<span type="duration" hours=… minutes=… seconds=…>`
   wrapper mislabels sub-hour durations — confirmed by the user, who spotted
   the actual shift.** Under an hour, the value's fields are shifted one
   place: what should render as `0:MM:SS` (0 hours) instead loses the
   leading `0:` and gains a bogus trailing `:00`, landing in the `hours`
   attribute what should have been `minutes`, and in `minutes` what should
   have been `seconds`. Row 1's `hours="24" minutes="30" seconds="0"`
   (displayed `24:30:00`) isn't a 24-hour run — it's 24 minutes 30 seconds,
   confirmed against its own `Distance_km`/`Pace_min_per_km` (3.68km ×
   6:39/km ≈ 24m 28s). Row 6 (`hours="31" minutes="23" seconds="0"`,
   displayed `31:23:00`) is the same pattern: 10.08km × 3:07/km ≈ 31m 25s,
   matching a real `31:23`, not 31 hours.

   **Parsing rule for a `<span>`-wrapped value, in order:**
   - `seconds === "0"` (or `"00"`) → **the shift bug** — discard the
     trailing `:00` entirely and read the remaining `hours:minutes` pair as
     `MM:SS` (real hours = 0). This is the case the user identified.
   - `seconds !== "00"` → per the user's rule this is a genuine `H:MM:SS`
     value ("over an hour, the format is rightfully x-y-z") and should be
     trusted literally.
     **Caveat — this branch doesn't hold for every row in the live sample,
     so don't trust it unconditionally.** Row 4 (`10.7km` at `3:22/km`
     pace) carries `hours="35" minutes="56" seconds="59"` — read literally
     that's a 35-hour bike ride, but `distance × pace` puts the real
     duration at ≈36 minutes, so this row has the *same* shift bug despite
     a non-zero trailing value. **Decision: add a plausibility guard** —
     whenever `Distance_km` and `Pace_min_per_km` are both present, compute
     `estimate_seconds = distance_km * pace_min_per_km * 60` and compare it
     to the literal `H:MM:SS` reading; if they disagree by more than ~2× (or
     the literal reading implies an implausible duration for a single
     activity, e.g. >6 hours), apply the same left-shift correction as the
     `seconds === "00"` case instead of trusting the literal value. Treat
     this guard as a probabilistic safety net inferred from a handful of
     rows, not a settled rule — re-verify once more data (especially a
     genuinely long run/ride) has synced, and surface to the user if the
     guard ever fires, rather than resolving it silently forever.
   - **No `<span>` wrapper** (plain text, e.g. `23:12` or `1:02:26` in the
     sample) → parse directly by segment count (`MM:SS` for 2 segments,
     `H:MM:SS` for 3). Both plain-text rows in the sample check out exactly
     against `distance × pace`, with no evidence of the shift bug — the bug
     appears to be specific to how the span-wrapped form gets generated
     upstream, not a general problem with the column.
   - If `Distance_km`/`Pace_min_per_km` are unavailable to cross-check *and*
     the value is span-wrapped with a non-zero trailing second, fall back to
     the literal `H:MM:SS` reading (there's nothing better to do) but this
     is the lowest-confidence path — worth a code comment saying so.

   This is a data-cleaning workaround for the upstream sheet, not a Forma
   bug — don't "fix" it by changing how Forma displays durations elsewhere.
4. **`Date` is inconsistently formatted** — sometimes a full
   `YYYY-MM-DD HH:mm:ss` timestamp, sometimes a bare `Ddd Mon DD YYYY` date
   with no time-of-day (both appear on the *same* duplicated activity, so
   this isn't even consistent per source). **Decision: parse with a
   dedicated `parseStravaDate()` helper** (try `YYYY-MM-DD` prefix first,
   fall back to `new Date(str)` for the `Ddd Mon DD YYYY` form — both parse
   reliably across browsers, unlike the space-separated
   `YYYY-MM-DD HH:mm:ss` form which some engines mis-parse). **Match by
   local calendar date only, never time-of-day** — several rows have no
   time-of-day at all, and matching against manually-logged sessions in §4
   already needs date-only granularity anyway (`completedDateKey()` in
   `utils/sessionCompletion.js` does the same).
5. **No swim rows exist in the current sample**, so the `Sport_type → Swim`
   mapping is inferred from Strava's own API vocabulary, not observed data —
   flag this as untested against real data until the user has a synced swim.

## 3. Data layer

### 3.1 New table: `strava_activities`

New migration file `supabase/migrations/<date>_create_strava_activities.sql`,
matching the style of `20260811_create_user_feedback.sql` (RLS, per-user
policies, ends with `select pg_notify('pgrst', 'reload schema');`).

```sql
create table if not exists public.strava_activities (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users(id) on delete cascade,
  strava_id          text        not null,          -- the sheet's `ID` column
  activity_type      text        not null,           -- 'run' | 'swim' | 'cycle' | 'other'
  sport_type_raw     text,                            -- original Strava `Sport_type` string
  activity_name      text,
  distance_km        numeric,
  duration_seconds   integer,
  pace_min_per_km     text,
  calories           numeric,
  elevation_gain_m    numeric,
  occurred_on        date        not null,            -- local calendar date, matching granularity (§2.4)
  occurred_at_raw    text,                             -- original Date cell, kept for debugging only
  device             text,
  activity_url       text,
  matched_session_id text,                             -- completedSessions[].id this was reconciled into, if any
  raw                jsonb       not null,             -- full parsed row, for future fields / debugging
  synced_at          timestamptz not null default now(),
  unique (user_id, strava_id)
);

create index if not exists strava_activities_user_id_idx on public.strava_activities (user_id);

alter table public.strava_activities enable row level security;

create policy "Users can view own strava activities"
  on public.strava_activities for select
  using (auth.uid() = user_id);

create policy "Users can insert own strava activities"
  on public.strava_activities for insert
  with check (auth.uid() = user_id);

create policy "Users can update own strava activities"
  on public.strava_activities for update
  using (auth.uid() = user_id);

select pg_notify('pgrst', 'reload schema');
```

**Decision:** no delete policy — old synced rows are never a correctness
problem (they're keyed by `strava_id`, upserted in place), so there's no
need for the client to delete rows, matching the append-only spirit of
`user_feedback`.

**Decision:** `matched_session_id` is a plain `text` column, not a foreign
key — `completedSessions[].id` is a client-generated
`Date.now().toString()`, not a `gym_sessions` row's real uuid (see
`sessionToDb`'s comment in `utils/supabase.js`), so there's nothing to
reference. It's purely a "have I already reconciled this one" marker.

### 3.2 `utils/supabase.js` additions

Add `strava_activities` to `loadUserData`'s parallel query list and a
`saveStravaActivities`/`upsertStravaActivities` helper alongside the
existing per-table mappers — **upsert**, not delete-then-insert (unlike
`gym_sessions`/`food_log`/`custom_foods`), since rows here are additive and
keyed by `strava_id`:

```js
supabase.from('strava_activities')
  .upsert(rows, { onConflict: 'user_id,strava_id' });
```

Load it into a new top-level state slice in `App.jsx` — `stravaActivities`
— not into `buildSnapshot()`'s existing debounced-save payload, since this
data is never derived from user typing and doesn't need the localStorage/Sheets
backup round-trip the rest of the snapshot gets. Write it directly via the
supabase helper right after a sync (§4), independent of `scheduleSave`.

## 4. Sync + reconciliation logic — `utils/stravaSync.js` (new)

Pure functions, unit-testable (per `CLAUDE.md`'s "Add/update Vitest tests for
any new pure logic in `utils/`"), called from a thin `App.jsx` orchestration
layer:

```js
// Sport_type (Strava vocabulary) -> Forma's non-gym ACTIVITY_TYPES id.
// Not limited to triathlon disciplines — covers every button ACTIVITY_TYPES
// actually has (GymPlanScreens.jsx ~line 3247). Anything not listed maps to
// 'other', stored for visibility but excluded from auto-completion (§ Non-goals).
const SPORT_TYPE_MAP = {
  Run: 'run', TrailRun: 'run', VirtualRun: 'run',
  Ride: 'cycle', VirtualRide: 'cycle', EBikeRide: 'cycle', GravelRide: 'cycle',
  MountainBikeRide: 'cycle', Velomobile: 'cycle', Handcycle: 'cycle',
  Swim: 'swim',
  Walk: 'walk',
  Hike: 'hike', Snowshoe: 'hike',
  Yoga: 'yoga',
  WeightTraining: 'gym', Crossfit: 'gym', Workout: 'gym', Elliptical: 'gym', StairStepper: 'gym',
  // everything else (Golf, Kayaking, Rowing, Soccer, Sail, Surfing, ski/skate
  // types, etc.) intentionally falls through to 'other' below.
};

// cycle/bike are the same discipline under two different `type` strings
// depending on source (§1.1) — treat them as one equivalence class for every
// match/lookup this module does, mirroring utils/analytics.js's existing
// SPEED_TYPES/DISCIPLINE_FOR_TYPE precedent. Not used to fix §1.1's
// underlying split app-wide, only to keep this module's own reconciliation
// correct regardless of which source produced the day's scheduled session.
const TYPE_EQUIVALENCE = { cycle: ['cycle', 'bike'], bike: ['cycle', 'bike'] };
function typesMatch(a, b) {
  return a === b || (TYPE_EQUIVALENCE[a] || []).includes(b);
}

export function mapSportType(sportType) { … }        // -> one of ACTIVITY_TYPES' ids, or 'other'
export function parseStravaDate(dateStr) { … }         // -> 'YYYY-MM-DD' local-date string, per §2.4
export function parseDuration(row) { … }               // -> seconds|null, per §2.3's span-distrust + plausibility-guard rule
export function parseStravaRow(headerIndex, cells) { … } // raw sheet row -> normalized object matching §3.1's columns
export function findMatchingCompletedSession(activity, completedSessions) { … }
  // same local date + typesMatch(activity.activity_type, session.type) — not
  // yet reconciled (caller passes only sessions not already claimed this pass)
export function findMatchingScheduledSession(activity, scheduledSessionsForDay) { … }
  // same day's event-plan/day-activity sessions (source of `sess.label` used
  // by sessionCompletion.js's isSessionCompleted), matched by typesMatch —
  // used to decide which label/type an auto-created session should carry
  // (see orchestration step 4c below), so it actually marks that scheduled
  // session complete regardless of whether it says 'cycle' or 'bike'
export function fillMissingFields(completedSession, stravaActivity) { … }
  // returns a new session object with only the previously-*undefined/null*
  // fields backfilled from stravaActivity — never overwrites an existing value
export function buildSessionFromStrava(stravaActivity, matchedScheduledSession) { … }
  // synthesizes a new completedSessions-shaped entry when no manual match
  // exists; if matchedScheduledSession is given, uses *its* type/label
  // (e.g. 'bike'/'Bike' from an active event plan) instead of always
  // defaulting to activity_type/'cycle', so the right scheduled session
  // gets marked done (§1.1)
```

**Read strategy:** fetch the full sheet range (`Sheet1!A1:M`, or whatever the
first sheet's name turns out to be — read it dynamically via the
spreadsheet's `sheets[0].properties.title` rather than hardcoding `Sheet1`,
since the user could rename the tab) on every sync. **Decision:** no
incremental/paginated fetch for now — at personal-single-user scale (tens to
low hundreds of activities a year) a full-range read is simpler and cheap;
revisit only if the sheet grows into the thousands of rows.

**Orchestration (`App.jsx`, runs once per sync — app foreground/login and a
manual "Sync now" button, §5):**

1. Skip entirely if not connected (§5) — no sheet ID stored, or token needs
   reconnect (mirror `sheetsStatus`'s `needs-reconnect` state).
2. Fetch + parse all rows → normalized activity objects (§3.1 shape).
3. Upsert all of them into `strava_activities` (dedupes on `strava_id`
   regardless of match/reconciliation outcome — §2.2's duplicate-row case is
   handled here for free).
4. For every row with `matched_session_id == null` **and** `activity_type !==
   'other'` (i.e. it mapped to one of Forma's actual activity buttons —
   run/walk/swim/yoga/hike/cycle/gym, not just the triathlon three):
   a. Try `findMatchingCompletedSession` against the current
      `completedSessions` (excluding sessions already claimed earlier in
      this same loop, so two Strava rows on the same day/type don't both
      grab the same manual entry) — using `typesMatch`, so a `cycle`-mapped
      Strava ride can match a `bike`-typed completed session and vice versa.
   b. **Match found:** `fillMissingFields` — only touches fields that were
      `null`/`undefined`/`''` on the manual entry (distance, elapsed/duration,
      pool fields for swim). If nothing was missing, the entry is left
      byte-for-byte unchanged.
   c. **No match on `completedSessions`:** before creating a new entry,
      check that day's *scheduled* sessions (event-plan sessions +
      day-activities feeding into `WeeklyOverviewScreen.jsx`'s
      `buildWeekData()`) via `findMatchingScheduledSession`, again with
      `typesMatch`. If one exists (e.g. an active triathlon plan's `Bike`
      session today), synthesize the new `completedSessions` entry with
      *that* session's `type`/label (§1.1's fix, scoped to this feature's
      own output) so it actually reads as complete; otherwise default to
      the Strava-mapped type/label (e.g. `cycle`/`'Cycle'`). Either way this
      is the "avoid manually inputting the activity" case from the product
      ask.
   d. Either way, mark that `strava_activities` row's `matched_session_id`
      (update, not re-upsert of the whole row) so it's never reprocessed.
5. If any `completedSessions` entries were added/changed in step 4, run them
   through the **existing** save path — `scheduleSave({ completedSessions:
   next })` — so this goes through the same `gym_sessions` delete-then-insert
   write every other completed-session change already uses. Do not write
   `gym_sessions` directly from this module.

**Decision:** if a matched manual entry already has every relevant field
filled in, per the product ask ("no further action to take place") the only
side effect is marking `matched_session_id` — `completedSessions` itself
isn't touched, so no wasted `gym_sessions` re-save.

## 5. UI — `screens/AboutScreen.jsx`

`AboutScreen.jsx`'s `CONNECTED_SERVICES` list already has a `Strava` entry
(`{ id:'strava', name:'Strava', scope:'Runs · Rides · Workouts', ... }`) but
per `docs/PROJECT_CONTEXT.md` §12 it's **UI-only, no real integration**.
Note: the actual live `CONNECTED_SERVICES` array is in `AboutScreen.jsx`; a
near-identical `IMPORT_SOURCES` array also exists in the legacy,
mostly-unreachable `OnboardingScreen.jsx` — don't confuse the two, only the
`AboutScreen.jsx` one is user-facing today. Wire the real card:

- **Connect flow**: reuse `connectGoogle`'s OAuth token (or a sibling
  `getStravaAccessToken`-style helper reusing the same token client/scope —
  don't duplicate the Google Identity Services boilerplate) plus a text input
  for the user to paste the Sheet's URL (extract the spreadsheet ID via the
  same `/spreadsheets/d/([^/]+)/` pattern already implied by
  `getSheetUrl()`). Store the parsed sheet ID in `localStorage`
  (`forma_strava_sheet_id`), matching how `getSheetId()` stores the backup
  sheet's ID today — **not** in a new Supabase profile column, so this stays
  a lightweight, per-device setting like the existing Sheets backup
  connection, not a schema change beyond §3.1's table. (Flag in the PR
  description per `CLAUDE.md` #5 that this was a deliberate scope-limiting
  choice, not an oversight — a multi-device synced setting would need a
  `profiles` column.)
- **Status states**: mirror `sheetsStatus`'s `disconnected` /
  `needs-reconnect` / `connected` / `connecting` states and rendering
  (`AboutScreen.jsx` ~line 1195-1293) — add `stravaSyncStatus`,
  `onConnectStrava`, `onDisconnectStrava`, `onSyncStravaNow` props following
  the exact naming pattern `sheetsStatus`/`onConnectSheets`/etc. already use.
- **"Sync now" button** + last-synced timestamp — since sync is client-side
  and foreground-only (decision #1), give the user a way to force it rather
  than only syncing on login.
- No changes needed to `WeeklyOverviewScreen.jsx`/`SessionDetailScreen.jsx`
  render paths — an auto-created or gap-filled `completedSessions` entry
  flows through their existing rendering unchanged. A "via Strava" badge on
  such entries would be a nice touch but is **not required** by the product
  ask — treat it as optional polish, not scope.

## 6. Testing (per `CLAUDE.md`'s "Every feature branch must")

- **Vitest** (`utils/stravaSync.test.js`): cover every §2 data-quality case
  with the *actual* sample rows from §2 as fixtures — the span-wrapped
  `seconds==="00"` shift-bug rows, the plain-text duration rows, the
  span-wrapped-but-non-zero-seconds row (`35:56:59`) confirming the
  plausibility guard overrides the literal reading, both `Date` formats,
  the literal duplicate-ID row, and a `Sport_type` with no Forma counterpart
  (e.g. `Golf`) to confirm it's stored as `'other'` but never reconciled.
  Also cover: `fillMissingFields` never overwriting a present value;
  `findMatchingCompletedSession` not double-claiming one manual entry for
  two Strava rows on the same day/type; and — specifically for §1.1 —
  `typesMatch('cycle', 'bike')` both directions, plus a scenario test where
  a Strava `Ride` on a day with an active triathlon plan's scheduled `Bike`
  session (and no matching `completedSessions` entry) produces a new
  session typed `bike`/`'Bike'`, not `cycle`/`'Cycle'`, so it actually marks
  that plan session complete.
- **Playwright** (`tests/e2e/`): a smoke assertion that the About screen's
  Strava card renders in each status state (disconnected/connected), per
  `CLAUDE.md`'s "changes a screen's core render path" trigger.
- Run `npm test` and `npx playwright test` locally before considering this
  done — CI re-runs both regardless, but per `CLAUDE.md` don't rely on CI to
  catch a first-pass failure.

## 7. Rollout note

Everything in this spec beyond plain run/cycle is inferred, not observed —
worth being explicit about which parts are solid versus a best-probability
guess, and flagging accordingly rather than presenting all of it with equal
confidence:

- **Run and cycle (as `Ride`) are backed by real sample rows** and the
  duration/date parsing rules in §2 were derived directly from them — this
  is the highest-confidence part of the spec.
- **No synced swim activity exists in the current sample**, so `Swim →
  swim` mapping is inferred from Strava's own API vocabulary, not observed.
  Swim-specific field backfill is also structurally limited:
  `poolLengthM`/`lengths` have no obvious Strava-sheet equivalent — only
  `Distance_km` is available, so a swim gap-fill can only ever backfill
  total distance, never pool length/lengths.
- **`walk`/`hike`/`yoga`/`gym` mappings (added per this revision) have zero
  supporting sample data** — they're a reasonable reading of Strava's public
  sport-type vocabulary against Forma's existing `ACTIVITY_TYPES`, not
  something cross-checked against a real row the way run/cycle were. If any
  of these Sport_type values behave differently in practice (e.g. Strava's
  actual `sport_type` string for a gym session turns out to be something
  other than `WeightTraining`/`Workout`), `SPORT_TYPE_MAP` will need
  adjusting once real data surfaces.
- **The `35:56:59`-style plausibility guard (§2 point 3) is inferred from a
  single contradicting row**, not a confirmed general rule — treat its
  2×/6-hour thresholds as a starting point to tune once more real durations
  (especially a genuinely-over-an-hour activity) have synced.

Flag each of these to the user the first time real data would exercise them
(first synced swim, first gym/walk/hike/yoga activity, first time the
plausibility guard fires) rather than assuming silently that the inferred
behaviour was correct.
