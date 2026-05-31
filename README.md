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
