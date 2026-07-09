-- ============================================================================
-- EMERGENCY: reset a crashed room's live game state.
-- Run this in Supabase → SQL Editor.
--
-- This does NOT delete: the room itself, your accounts, the join code,
-- saved gallery drawings, or question history. It only resets the *live*
-- screen (current question/drawing/creative view + scoreboard) back to
-- clean defaults — exactly what a brand-new room starts with.
--
-- Replace 'YOUR_ROOM_NAME' below with your room's exact name.
-- ============================================================================

update public.room_state
set
  mode = 'questions',
  feel = 'chill',
  q_state = '{
    "style": "classic", "sel": "deep", "vibe": "sweet", "theme": "",
    "round": {"shape": "open", "prompt": "Tell me about something from today you wish I had been there for."},
    "count": 1, "turn": "him", "picks": {"him": null, "her": null},
    "awarded": false, "generating": false, "genBy": null
  }'::jsonb,
  d_state = '{
    "sub": "same", "style": "classic", "prompt": "our dream date",
    "revealed": false, "duration": 60, "endsAt": null, "round": 1, "artist": "him"
  }'::jsonb,
  c_state = '{"tool": "story"}'::jsonb,
  score = '{"him": 0, "her": 0}'::jsonb
where room_id = (select id from public.rooms where lower(name) = lower('YOUR_ROOM_NAME'));

-- You should see "Success. 1 row affected." If it says 0 rows, double-check
-- the room name spelling — it must match exactly (case doesn't matter).
