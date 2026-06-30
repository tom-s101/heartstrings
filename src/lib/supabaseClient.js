import { createClient } from "@supabase/supabase-js";

// Vite env vars (see .env.example)
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,      // keep the session across reloads
    autoRefreshToken: true,    // refresh before the JWT expires
    detectSessionInUrl: true,  // needed for magic-link logins
    storage: window.localStorage, // explicit (some mobile browsers need this set, not defaulted)
  },
  realtime: { params: { eventsPerSecond: 20 } }, // headroom for live drawing strokes
});
