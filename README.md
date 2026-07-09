# Heartstrings — production app (synced, custom icons, polished)

A long-distance couples game: synced rooms, AI-generated question games, a
collaborative drawing board with a saved gallery. Built on Supabase
(Auth + Realtime + Postgres) with the same custom icon set and styling as the
showcase artifact.

## File tree
```
supabase/
  migrations/0001_init.sql              # tables, RLS, realtime, join_room
  migrations/0002_join_code_and_score.sql  # private join codes + scoreboard
  migrations/0003_creative_state.sql    # creative-section synced state
  functions/generate-question/          # server-side Claude generator (classic + game formats)
  functions/ai-assist/                  # generic Claude helper (Story suggest, Letter draft)
src/
  ui.jsx                                # palette, custom Icon set, primitives, Background
  lib/supabaseClient.js
  lib/auth.js                           # signUp / signIn / magic link / useSession
  lib/drawingRender.js                  # stroke replay + keepsake PNG
  hooks/useRoom.js                      # realtime state, picks, score, pictionary roles
  components/Auth.jsx Join.jsx Game.jsx Questions.jsx Drawing.jsx Creative.jsx Gallery.jsx
  App.jsx                               # session gate → Auth | Join | Game
```

## Setup
1. Create a Supabase project; copy the Project URL + anon key into `.env` (see `.env.example`).
2. Run **all three** migrations in order (SQL editor or `supabase db push`): `0001` → `0002` → `0003`.
3. Set the Claude key as a server secret: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
4. Deploy the functions: `supabase functions deploy generate-question` and `supabase functions deploy ai-assist`
5. `npm install @supabase/supabase-js` and render `<App />`.

## What's wired
- **Auth-gated.** Email/password or magic link; a profile row is auto-created on signup.
- **Private join codes.** Partners agree on a room name **and** a secret code. First to use a
  name founds it with that code; the other must match — strangers can't wander into a common name.
- **Live everything.** Presence (who's online), the question card, mode/feel/category/format,
  synced **picks** (you see each other choose), and the drawing reveal all propagate in realtime.
- **Live Pictionary.** One partner is the artist (sees the word + draws); the other is the guesser
  and watches the strokes **stream live** while the word stays hidden. "They got it!" reveals it;
  "swap & new word" alternates the artist.
- **Game Night scoring.** A synced scoreboard in the header. Matching answers earn a couple point;
  a correct Pictionary guess scores too. (The "him" client is the deterministic scorekeeper, so
  points are never double-counted.)
- **Gallery + keepsakes.** Saved drawings replay from stored strokes and export a his/her PNG.

## Notes
- Realtime uses presence + Postgres changes + broadcast (live strokes). Last-write-wins on the
  shared state row, which is fine at couple scale.
- Icons are all in `ui.jsx` as one `<Icon name=... />` component (her = lotus, his = wave).

## Edge-case handling (final pass)
- **Reconnect.** The realtime channel auto-retries; a "reconnecting…" ribbon shows during drops,
  and on every (re)connect the client re-fetches `room_state` so nothing is missed while away.
- **Race-proof scoring.** A round is scored inside the same commit that fills the second pick, with
  an `awarded` guard — so points can't double-count and scoring no longer depends on a specific
  player being online.
- **No stuck cards.** Generation has an 18s ceiling and always clears its lock (even if the persist
  fails); an abandoned generation (partner dropped mid-generate) self-heals and re-enables the
  button after 18s. New rounds also reset the truth/dare reveal.
- **Friendly join failures.** Wrong code, room full, and generic errors each get their own screen.
- **Timer reveal** fires from whichever client reaches zero, so it works even if one partner is offline.

### Known minor limitation
- Live Pictionary strokes are broadcast (ephemeral). If the *guesser* reconnects mid-round they
  won't see strokes drawn while they were away — new strokes resume normally, and all reveal-based
  modes are unaffected since those canvases are hidden until reveal anyway. If you want full replay
  on reconnect later, have the artist also persist strokes to a per-round key.

## Sections (4 tabs)
- **Questions** — Classic categories + Game modes (Would You Rather, Trolley, Red Flags, …) with synced picks + Game Night scoring.
- **Drawing** — **Classic** (Same / Pictionary / Free) and **Studio**: Paint Your Partner, Whisper Draw, Split Canvas, Drawing Telephone, Quick Draw Duel, Exquisite Corpse, One-Way Sketch, Dream Scene, Doodle Dash, Memory Gallery. All synced; chain games (Telephone/Corpse) are turn-based; Dream Scene is a shared live canvas.
- **Creative** — Story Weaver, Melody Mixer, Tier List, Dream Vault, Memory Mosaic, Kitchen Conjurer, Oracle of Us, Emoji Epic, Fantasy Date Forge, Love Letter Lab. All synced via `c_state`; Story/Letter use the `ai-assist` function for optional Claude help.

### Sync notes for the new sections
- Drawing studio reuses the existing stroke broadcast + `d_state`. Chain games persist each step into `d_state.chain` on "pass" (turn-based, so both partners take turns rather than drawing at once).
- Creative tools store their data under `room_state.c_state`; discrete actions (add line, place item, draw card) commit immediately, while free-text fields (Letter body, dish name) commit on blur to avoid write spam.

## Reliability fixes (after real-world testing)
- **Crash-to-blank-screen fixed.** The app had no error boundary, so any bad
  data in a room's saved state (e.g. a malformed AI reply that got stored)
  would throw during render and unmount the entire app to a blank white
  screen — and since the bad data lived in that room's row, reopening it hit
  the same crash every time. Each tab (Questions/Drawing/Creative/Gallery) is
  now wrapped in its own error boundary (`ErrorBoundary.jsx`): if something
  still manages to throw, only that tab shows a "Reset this section" card
  instead of the whole app going blank — the other tabs, your account, and
  the room keep working.
- **`applyRow` (the DB → UI merge) is now defensive.** Wrong-typed or missing
  nested fields (`picks`, `round`, `chain`, `score`) are replaced with safe
  defaults instead of passed straight into state, closing off the most likely
  source of the crash at the root.
- **`supabase/maintenance/reset_room.sql`** — a one-time emergency script to
  reset any already-crashed room's live state by hand from the SQL editor,
  for right now, without needing the code fixes deployed first.
- **Red/Green Flag was heavily biased toward green.** Nothing told the model
  which to generate, so it defaulted to pleasant traits almost every time.
  The server now forces a genuine 50/50 coin-flip per round and explicitly
  instructs the model which kind to write — and reveals which one it was
  after you both answer.
- **Occasional garbled card text fixed.** A model reply with stray
  labels/formatting around the JSON could previously end up rendered
  verbatim (e.g. `Red flags :{...`). Replies are now JSON-extracted and
  shape-validated before ever reaching the client; an invalid reply triggers
  one silent retry, and if a bad round still somehow gets displayed, the
  client itself recognizes stray `{}[]` characters and shows a friendly
  "that came out glitchy — try a fresh one" prompt instead of the raw text.

## Three new Game modes
- **Love Language Check** — a small scenario with 4 options, each a natural
  way to show love in the moment; tap the one that resonates and see if you
  match.
- **Two Truths & a Fib** — three fun trivia statements about love/romance/
  animal courtship, one is false; guess the fib and get a one-line reveal.
- **Compatibility Meter** — a 0–100 slider each of you sets privately, then
  reveal shows both numbers and a cute gap message ("practically the same
  soul" / "wonderfully different").

## The three-experience rework
The app now opens to a **Landing hub** after login, with three ways in:

1. **Long Distance** — the original Heartstrings: synced rooms, sides, live
   games/questions/drawing/creative across two devices.
2. **Photo Booth** (`PhotoBooth.jsx` + migration `0004_booth.sql`) —
   • *One device*: customize the strip (layout 3/4, four frames, four mood
   filters, caption, date stamp) → countdown shots on the device camera →
   composed strip with a save/download button.
   • *Create a room / Join with a code*: one partner gets an auto 6-letter
   code; the other joins with it. The countdown is broadcast-synced so both
   devices shoot at the same moment, each side's photos upload to the new
   `booth_photos` table, and BOTH devices can save a combined two-column
   his+hers strip. Booth rooms reuse `join_room` (the code doubles as the
   room's secret), so membership + RLS apply unchanged.
3. **Together** — the same games adapted for one shared device: the join
   screen asks for the room + code (history and gallery still persist) plus
   both first names. In-game: no presence pill or "waiting…" states, names
   replace his/her everywhere, both answer columns are tappable on the one
   screen, the Compatibility Meter becomes pass-the-phone (one locks in while
   the other looks away), Drawing becomes "Doodle together" (one canvas, a
   whose-pen toggle keeps the gallery's his|hers split meaningful) and
   "Guess my sketch" (hold-to-peek Pictionary), and Creative gets a
   "who's adding?" toggle.

### Deploy notes for this rework
- Run migration `0004_booth.sql` (Photo Booth needs it).
- Frontend redeploy (push to GitHub → Netlify rebuild).
- No edge-function changes in this round.
- The booth needs camera permission; on iOS it must be served over HTTPS
  (Netlify is, so only local testing over plain http may block the camera).
