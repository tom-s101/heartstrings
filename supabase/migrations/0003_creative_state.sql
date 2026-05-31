-- ============================================================================
-- HEARTSTRINGS — creative section state
-- One more synced jsonb column on room_state for the Creative tab's tools.
-- ============================================================================
alter table public.room_state add column if not exists c_state jsonb default '{}'::jsonb;
