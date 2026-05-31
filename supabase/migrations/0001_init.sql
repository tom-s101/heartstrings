-- ============================================================================
-- HEARTSTRINGS — Phase 2 schema
-- Accounts, synced rooms, no-repeat question bank, couples gallery.
-- Run via `supabase db push` or paste into the SQL editor.
-- ============================================================================

-- ---------- profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_emoji text default '🌸',
  created_at   timestamptz default now()
);

-- create a profile row automatically on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- rooms ----------
-- Both partners "type the same room name" → join_or_create resolves it.
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create unique index if not exists rooms_name_key on public.rooms (lower(name));

-- ---------- membership (presence + up to 4 for double dates) ----------
create table if not exists public.room_members (
  room_id   uuid references public.rooms(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete cascade,
  side      text check (side in ('him','her','guest')) default 'guest',
  joined_at timestamptz default now(),
  last_seen timestamptz default now(),
  primary key (room_id, user_id)
);

-- ---------- synced game state (one row per room) ----------
create table if not exists public.room_state (
  room_id    uuid primary key references public.rooms(id) on delete cascade,
  mode       text default 'questions',
  feel       text default 'chill',
  q_state    jsonb default '{}'::jsonb,
  d_state    jsonb default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz default now()
);

-- ---------- question bank / no-repeat history ----------
create table if not exists public.questions (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references public.rooms(id) on delete cascade,
  category   text,
  theme      text,
  text       text not null,
  created_by uuid,
  created_at timestamptz default now()
);
create index if not exists questions_room_idx on public.questions(room_id, created_at desc);
-- hard guarantee: the same question text can never appear twice in one room
create unique index if not exists questions_room_text_key on public.questions(room_id, md5(lower(text)));

-- ---------- couples gallery (saved drawings) ----------
create table if not exists public.drawings (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references public.rooms(id) on delete cascade,
  prompt      text,
  sub_mode    text,
  round       int,
  strokes_him jsonb,
  strokes_her jsonb,
  image_url   text,            -- optional rendered PNG (Supabase Storage)
  created_at  timestamptz default now()
);
create index if not exists drawings_room_idx on public.drawings(room_id, created_at desc);

-- ============================================================================
-- Membership helper (SECURITY DEFINER avoids RLS recursion)
-- ============================================================================
create or replace function public.is_member(p_room uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room and user_id = auth.uid()
  );
$$;

-- ============================================================================
-- join_or_create: the one entry point clients call to enter a room by name
-- ============================================================================
create or replace function public.join_room(p_name text, p_side text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select id into r_id from public.rooms where lower(name) = lower(p_name);

  if r_id is null then
    insert into public.rooms(name, created_by) values (p_name, auth.uid())
      returning id into r_id;
    insert into public.room_state(room_id) values (r_id);
  end if;

  -- cap at 4 members, unless already a member
  if (select count(*) from public.room_members where room_id = r_id) >= 4
     and not exists (select 1 from public.room_members
                     where room_id = r_id and user_id = auth.uid()) then
    raise exception 'room is full';
  end if;

  insert into public.room_members(room_id, user_id, side)
    values (r_id, auth.uid(), p_side)
    on conflict (room_id, user_id)
    do update set side = excluded.side, last_seen = now();

  return r_id;
end; $$;

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.profiles     enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.room_state   enable row level security;
alter table public.questions    enable row level security;
alter table public.drawings     enable row level security;

-- profiles: manage your own
create policy "profiles self read"   on public.profiles for select using (id = auth.uid());
create policy "profiles self write"  on public.profiles for update using (id = auth.uid());
create policy "profiles self insert" on public.profiles for insert with check (id = auth.uid());

-- rooms: visible to members; creating happens via join_room (definer)
create policy "rooms member read" on public.rooms for select using (public.is_member(id));

-- room_members: members can see each other; you can update your own row (last_seen)
create policy "members read"        on public.room_members for select using (public.is_member(room_id));
create policy "members update self"  on public.room_members for update using (user_id = auth.uid());

-- room_state: members read + write
create policy "state read"  on public.room_state for select using (public.is_member(room_id));
create policy "state write"  on public.room_state for update using (public.is_member(room_id));
create policy "state insert" on public.room_state for insert with check (public.is_member(room_id));

-- questions: members read + insert
create policy "q read"   on public.questions for select using (public.is_member(room_id));
create policy "q insert" on public.questions for insert with check (public.is_member(room_id));

-- drawings: members read + insert
create policy "d read"   on public.drawings for select using (public.is_member(room_id));
create policy "d insert" on public.drawings for insert with check (public.is_member(room_id));

-- ============================================================================
-- Realtime: stream these tables to subscribed clients
-- ============================================================================
alter publication supabase_realtime add table public.room_state;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.drawings;
