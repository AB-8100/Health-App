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
- **No auto-completion for activity types other than run/swim/cycle.** The
  product ask was specifically "map to the buttons on the health app" — the
  buttons are `run`/`swim`/`cycle` (`GymPlanScreens.jsx`'s `ACTIVITY_TYPES`,
  `data/sessionDisplay.js`'s `SESSION_DISPLAY`). A Strava row with any other
  `Sport_type` (e.g. `WeightTraining`, `Hike`, `Workout`) is still stored in
  `strava_activities` for visibility/future use, but is never auto-completed
  or reconciled into `completedSessions`.

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
  its own, simpler match: same local calendar date + same `type`, not label.
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
3. **`Time_formatted` is unreliable when it's wrapped in a `<span
   type="duration" hours=… minutes=… seconds=…>` tag.** Compare row 1's
   attributes (`hours="24" minutes="30" seconds="0"`) against its own
   `Distance_km` (3.68) and `Pace_min_per_km` (6:39): 3.68 × 6:39 ≈ 24m 28s —
   i.e. the *visible* text (`24:30:00`, read as `MM:SS` + a bogus trailing
   `:00`) is roughly right, but the span's `hours="24"` attribute is
   nonsense (nobody ran for 24 hours). Row 4 shows the same pattern
   (`hours="35" minutes="56" seconds="59"` against a distance/pace product
   of ≈36 min). **Decision: never trust the `hours`/`minutes`/`seconds`
   attributes on a `<span>`-wrapped value.** Instead: (a) if `Distance_km`
   and `Pace_min_per_km` are both present, compute
   `duration_seconds = round(distance_km * pace_min_per_km * 60)` and treat
   that as authoritative; (b) only when a row has *no* span wrapper — a
   plain `MM:SS` or `H:MM:SS` string (rows 3 and 5 above) — parse that text
   directly; (c) if neither is available, leave `duration_seconds` null
   rather than trusting the span. This is a data-cleaning workaround for the
   upstream sheet, not a Forma bug — don't "fix" it by changing how Forma
   displays durations elsewhere.
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
// Sport_type (Strava vocabulary) -> Forma's ACTIVITY_TYPES id.
// Anything not listed maps to 'other' and is excluded from auto-completion.
const SPORT_TYPE_MAP = {
  Run: 'run', TrailRun: 'run', VirtualRun: 'run',
  Ride: 'cycle', VirtualRide: 'cycle', EBikeRide: 'cycle', GravelRide: 'cycle', MountainBikeRide: 'cycle',
  Swim: 'swim',
};

export function mapSportType(sportType) { … }        // -> 'run' | 'swim' | 'cycle' | 'other'
export function parseStravaDate(dateStr) { … }         // -> 'YYYY-MM-DD' local-date string, per §2.4
export function parseDuration(row) { … }               // -> seconds|null, per §2.3's span-distrust rule
export function parseStravaRow(headerIndex, cells) { … } // raw sheet row -> normalized object matching §3.1's columns
export function findMatchingCompletedSession(activity, completedSessions) { … }
  // same local date + same `type`, not yet reconciled (no back-reference needed —
  // caller passes only sessions not already claimed this sync pass)
export function fillMissingFields(completedSession, stravaActivity) { … }
  // returns a new session object with only the previously-*undefined/null*
  // fields backfilled from stravaActivity — never overwrites an existing value
export function buildSessionFromStrava(stravaActivity) { … }
  // synthesizes a new completedSessions-shaped entry when no manual match exists
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
4. For every row with `matched_session_id == null` **and** `activity_type in
   ('run','swim','cycle')`:
   a. Try `findMatchingCompletedSession` against the current
      `completedSessions` (excluding sessions already claimed earlier in
      this same loop, so two Strava rows on the same day/type don't both
      grab the same manual entry).
   b. **Match found:** `fillMissingFields` — only touches fields that were
      `null`/`undefined`/`''` on the manual entry (distance, elapsed/duration,
      pool fields for swim). If nothing was missing, the entry is left
      byte-for-byte unchanged.
   c. **No match:** synthesize a new entry via `buildSessionFromStrava` and
      append it to `completedSessions` — this is the "avoid manually
      inputting the activity" case from the product ask.
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
  bogus-duration rows, the plain-text duration rows, both `Date` formats,
  the literal duplicate-ID row, and an unmapped `Sport_type` (e.g.
  `WeightTraining`) to confirm it's stored but never reconciled. Also cover
  `fillMissingFields` never overwriting a present value, and
  `findMatchingCompletedSession` not double-claiming one manual entry for
  two Strava rows on the same day/type.
- **Playwright** (`tests/e2e/`): a smoke assertion that the About screen's
  Strava card renders in each status state (disconnected/connected), per
  `CLAUDE.md`'s "changes a screen's core render path" trigger.
- Run `npm test` and `npx playwright test` locally before considering this
  done — CI re-runs both regardless, but per `CLAUDE.md` don't rely on CI to
  catch a first-pass failure.

## 7. Rollout note

Since there's currently no synced swim activity to verify §2's `Swim →
swim` mapping and swim-specific field backfill (`poolLengthM`/`lengths` have
no obvious Strava-sheet equivalent — only `Distance_km` is available, so a
swim gap-fill can only ever backfill total distance, never pool length/lengths),
treat swim reconciliation as **lower-confidence than run/cycle** until
verified against a real synced swim. This is a probabilistic read of the
available sample data, not a certainty — flag it to the user after the first
real swim syncs, rather than assuming it worked silently.
