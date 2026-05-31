// ============================================================================
// generate-question — Supabase Edge Function (Deno)
// Generates ONE round of the chosen couples' GAME FORMAT via Claude,
// server-side, as structured JSON so the client knows how to render it.
//
// Why server-side: your ANTHROPIC_API_KEY never touches the browser.
// The caller's JWT is used so RLS enforces room membership.
//
// Deploy:   supabase functions deploy generate-question
// Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "claude-haiku-4-5-20251001"; // fast + cheap; swap to claude-sonnet-4-6 for richer rounds

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// format id -> { shape, instruction }. shape tells the client how to render.
const FORMATS: Record<string, { shape: string; instr: string }> = {
  wyr:        { shape: "choice2",       instr: "a playful would-you-rather with two tempting, contrasting options" },
  trolley:    { shape: "choice2",       instr: "a lighthearted trolley-problem dilemma about the relationship; the trolley threatens one lovely thing and pulling the lever sacrifices another. Two options, each a thing one might save." },
  redflags:   { shape: "redGreen",      instr: "a single dating trait or behavior, stated plainly, to be judged a red or green flag" },
  cah:        { shape: "open",          instr: "a cheeky fill-in-the-blank sentence using ____ for the blank; clean but funny" },
  mostlikely: { shape: "pickPerson",    instr: "a 'who is more likely to ___' question" },
  nhie:       { shape: "yesNo",         instr: "a 'Never have I ever ___' statement, flirty or funny but kind" },
  newlywed:   { shape: "open",          instr: "a 'guess my answer' question where each partner predicts the other's response" },
  hottake:    { shape: "agreeDisagree", instr: "a slightly provocative opinion/hot take about love or dating to agree or disagree with" },
  thisorthat: { shape: "choice2",       instr: "a quick, cute either/or about shared life; two short options" },
  truthdare:  { shape: "truthDare",     instr: "one warm 'truth' question AND one sweet/silly 'dare' doable over a video call" },
  // classic single-question categories (open shape) — classic mode reuses this path
  deep:        { shape: "open", instr: "a deep, reflective one-sentence question partners answer about themselves or each other" },
  silly:       { shape: "open", instr: "a silly, lighthearted one-sentence question" },
  spicy:       { shape: "open", instr: "a flirty (tasteful) one-sentence question" },
  wholesome:   { shape: "open", instr: "a warm, wholesome one-sentence question" },
  hypothetical:{ shape: "open", instr: "a hypothetical or would-you-rather one-sentence question" },
};

const VIBE_LABEL: Record<string, string> = {
  sweet: "sweet", silly: "silly", flirty: "flirty (tasteful)", deep: "deep and reflective",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    const { roomId, format = "wyr", vibe = "sweet", theme = "" } = await req.json();
    if (!roomId) return json({ error: "roomId required" }, 400);

    const fmt = FORMATS[format] ?? FORMATS.wyr;

    // membership enforced by RLS
    const { data: mem } = await supabase
      .from("room_members").select("room_id").eq("room_id", roomId).maybeSingle();
    if (!mem) return json({ error: "forbidden" }, 403);

    // avoid repeats: pull recent rounds of THIS format for this room
    const { data: prev } = await supabase
      .from("questions").select("text")
      .eq("room_id", roomId).eq("category", format)
      .order("created_at", { ascending: false }).limit(20);
    const avoid = (prev ?? []).map((r: { text: string }) => r.text);

    const schema = fmt.shape === "choice2"
      ? `{"prompt":"...","options":["A","B"]}`
      : fmt.shape === "truthDare"
      ? `{"truth":"...","dare":"..."}`
      : `{"prompt":"..."}`;

    const prompt =
      `Generate ONE round of a couples' connection game (long-distance dating).\n` +
      `Format: ${format} — ${fmt.instr}.\n` +
      `Tone: ${VIBE_LABEL[vibe] ?? vibe}.\n` +
      (theme ? `Theme to weave in: "${theme}".\n` : "") +
      (avoid.length ? `Do NOT repeat or echo: ${avoid.join(" | ")}\n` : "") +
      `Keep it one or two short sentences, warm and never crude.\n` +
      `Respond with ONLY minified JSON (no markdown, no preamble) shaped exactly: ${schema}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    if (!aiRes.ok) return json({ error: "claude_error", detail: await aiRes.text() }, 502);

    const data = await aiRes.json();
    const raw = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join(" ").replace(/```json|```/g, "").trim();

    let round: Record<string, unknown>;
    try { round = JSON.parse(raw); } catch { return json({ error: "bad_json", raw }, 502); }
    round.shape = fmt.shape;

    // store a text key for the no-repeat bank (prompt, or truth for truth/dare)
    const key = String(round.prompt ?? round.truth ?? raw);
    await supabase.from("questions").insert({
      room_id: roomId, category: format, theme, text: key, created_by: user.id,
    });

    return json({ round });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}
