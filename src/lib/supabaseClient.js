import { createClient } from "@supabase/supabase-js";

// Vite env vars (see .env.example)
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anon, {
  realtime: { params: { eventsPerSecond: 20 } }, // headroom for live drawing strokes
});
