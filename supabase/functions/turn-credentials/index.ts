// ============================================================================
// turn-credentials — fetches ICE servers (STUN + TURN) for the Photo Booth's
// peer-to-peer WebRTC video call.
//
// Plain STUN (what the client used before this function existed) only helps
// two devices *discover* each other's address — it can't help if either side
// sits behind a NAT/firewall that blocks a direct connection outright (common
// on mobile carrier networks / CGNAT, some corporate wifi). A TURN server
// relays the media in that case instead of the call failing/degrading to
// choppy still frames, and can also just be a *better routed* path than
// whatever direct route the two ISPs would've taken.
//
// Setup (optional — without it, this just returns public STUN servers, so
// the booth keeps working exactly as it did before, peer-to-peer only):
//   1. Free account: https://www.metered.ca/tools/openrelay/ (Metered's
//      "Open Relay" TURN service, 20GB/month free).
//   2. Dashboard → TURN Server → "Generate Your First Credential" (or "Add
//      Credential"). Once it's created, click "Show ICE Servers Array" and
//      copy the whole JSON array it shows you — that's it, no domain/app
//      name to go hunting for.
//   3. supabase secrets set METERED_ICE_SERVERS_JSON='<paste the array here>'
//   4. supabase functions deploy turn-credentials
//
// (Advanced/alternative: if you'd rather fetch fresh credentials from
// Metered's REST API on every call instead of using one static array, set
// METERED_APP_NAME — the "Metered Domain" on the dashboard's Developers page
// — and METERED_API_KEY instead of METERED_ICE_SERVERS_JSON.)
//
// Deploy: supabase functions deploy turn-credentials
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const STUN_FALLBACK = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    // Easiest path: a static ICE servers array pasted straight from the
    // Metered dashboard's "Show ICE Servers Array" button.
    const staticJson = Deno.env.get("METERED_ICE_SERVERS_JSON");
    if (staticJson) {
      try {
        const parsed = JSON.parse(staticJson);
        if (Array.isArray(parsed) && parsed.length) return json({ iceServers: parsed, turn: true });
      } catch { /* fall through to other options below */ }
    }

    // Alternative path: fetch fresh credentials from Metered's REST API.
    const appName = Deno.env.get("METERED_APP_NAME");
    const apiKey = Deno.env.get("METERED_API_KEY");
    if (appName && apiKey) {
      const r = await fetch(`https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`);
      if (r.ok) {
        const iceServers = await r.json();
        if (Array.isArray(iceServers) && iceServers.length) return json({ iceServers, turn: true });
      }
    }

    return json({ iceServers: STUN_FALLBACK, turn: false });
  } catch {
    return json({ iceServers: STUN_FALLBACK, turn: false });
  }
});

function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } }); }
