-- ============================================================================
-- HEARTSTRINGS — Photo Booth
-- Stores captured booth photos (small base64 JPEGs) so two remote devices can
-- compose a combined couple strip. Reuses room membership for privacy.
-- ============================================================================

create table if not exists public.booth_photos (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references public.rooms(id) on delete cascade,
  side       text check (side in ('him','her')),
  idx        int not null,           -- shot number 0..3
  image      text not null,          -- data-url JPEG (~40-70KB)
  created_at timestamptz default now()
);
create index if not exists booth_room_idx on public.booth_photos(room_id, created_at desc);

alter table public.booth_photos enable row level security;
create policy "booth read"   on public.booth_photos for select using (public.is_member(room_id));
create policy "booth insert" on public.booth_photos for insert with check (public.is_member(room_id));
create policy "booth delete" on public.booth_photos for delete using (public.is_member(room_id));

alter publication supabase_realtime add table public.booth_photos;
