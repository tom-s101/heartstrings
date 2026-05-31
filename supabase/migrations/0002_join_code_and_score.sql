-- ============================================================================
-- HEARTSTRINGS — Phase 4 polish migration
-- Adds private join codes (so common room names can't collide with strangers)
-- and a synced scoreboard for Game Night.
-- ============================================================================

-- ---------- private join code on rooms ----------
alter table public.rooms add column if not exists join_code text;

-- ---------- scoreboard on the synced state ----------
alter table public.room_state add column if not exists score jsonb default '{"him":0,"her":0}'::jsonb;

-- ---------- join_room now requires name + code ----------
-- Both partners agree on a room name AND a secret code. First person to use a
-- name "founds" the room with that code; anyone joining later must match it.
drop function if exists public.join_room(text, text);

create or replace function public.join_room(p_name text, p_code text, p_side text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r_id uuid; existing_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if length(coalesce(p_code,'')) < 4 then raise exception 'code too short'; end if;

  select id, join_code into r_id, existing_code from public.rooms where lower(name) = lower(p_name);

  if r_id is null then
    insert into public.rooms(name, join_code, created_by) values (p_name, p_code, auth.uid())
      returning id into r_id;
    insert into public.room_state(room_id) values (r_id);
  elsif existing_code is distinct from p_code then
    raise exception 'wrong code';
  end if;

  if (select count(*) from public.room_members where room_id = r_id) >= 4
     and not exists (select 1 from public.room_members where room_id = r_id and user_id = auth.uid()) then
    raise exception 'room is full';
  end if;

  insert into public.room_members(room_id, user_id, side)
    values (r_id, auth.uid(), p_side)
    on conflict (room_id, user_id) do update set side = excluded.side, last_seen = now();

  return r_id;
end; $$;
