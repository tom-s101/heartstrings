// ============================================================================
// turn-credentials — fetches ICE servers (STUN + TURN) for the Photo Booth's
// peer-to-peer WebRTC video call.
//
// Plain STUN (what the client used before this function existed) only helps
// two devices *discover* each other's address — it can't help if either side
// sits behind a NAT/firewall that blocks a direct connection outright (common
// on mobile carrier networks / CGNAT, some corporate wifi). A TURN server
// relays the media in that case instead of the call failing/degrading to
// choppy still frames. Metered's "Open Relay" also picks the TURN server
// nearest the caller, which can also just be a *better routed* path than
// whatever direct route the two ISPs would've taken — worth trying if calls
// still feel laggy even when they do connect peer-to-peer.
//
// Setup (optional — without it, this just returns public STUN servers, so
// the booth keeps working exactly as it did before, peer-to-peer only):
//   1. Free account: https://www.metered.ca/tools/openrelay/
//      Note your "app name" (subdomain, e.g. "heartstrings") and API key.
//   2. supabase secrets set METERED_APP_NAME=your-app-name METERED_API_KEY=your-key
//   3. supabase functions deploy turn-credentials
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

    const appName = Deno.env.get("METERED_APP_NAME");
    const apiKey = Deno.env.get("METERED_API_KEY");
    if (!appName || !apiKey) return json({ iceServers: STUN_FALLBACK, turn: false });

    const r = await fetch(`https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`);
    if (!r.ok) return json({ iceServers: STUN_FALLBACK, turn: false });
    const iceServers = await r.json();
    const ok = Array.isArray(iceServers) && iceServers.length > 0;
    return json({ iceServers: ok ? iceServers : STUN_FALLBACK, turn: ok });
  } catch {
    return json({ iceServers: STUN_FALLBACK, turn: false });
  }
});

function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } }); }
