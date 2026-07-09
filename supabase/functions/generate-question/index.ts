// ============================================================================
// generate-question — Supabase Edge Function (Deno)
// Generates ONE round of the chosen couples' GAME FORMAT via Claude,
// server-side, as structured JSON so the client knows how to render it.
//
// Why server-side: your ANTHROPIC_API_KEY never touches the browser.
// The caller's JWT is used, and room membership is checked against the
// caller's own row so it can never accidentally match a different member.
//
// Reliability notes (fixed after real-world testing):
// - Red/Green Flag was drifting almost entirely green because nothing told
//   the model which one to write. It's now forced to a real coin-flip per
//   round, and the model is told explicitly which kind to produce.
// - Occasionally the model's reply had leftover formatting/labels around the
//   JSON, which then got rendered verbatim in the UI. Replies are now
//   JSON-extracted, shape-validated, and retried once before ever reaching
//   the client — a bad reply is discarded rather than displayed.
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
  redflags:   { shape: "redGreen",      instr: "a single dating trait or behavior, described plainly and neutrally in one sentence, for the couple to judge as a red or green flag" },
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
  // new formats
  lovelang:  { shape: "choiceMulti", instr: "a short everyday scenario (1 sentence), followed by 4 options that are each a natural way someone might show love in that moment (e.g. a kind word, doing a helpful task for them, a small thoughtful gift, giving focused undivided time, a warm hug or touch) — phrase every option as a natural action, never name a 'love language' term directly" },
  twotruths: { shape: "threeChoice", instr: "three short, surprising statements about love, romance, relationships, or animal courtship/mating rituals — exactly one is false. Make them general fun trivia, NOT about this specific couple's real life." },
  compat:    { shape: "slider",      instr: "a single short playful statement to rate from 0 to 100 for how much it describes 'us' as a couple (e.g. how much you bicker over silly things, how spontaneous you are together, how often you finish each other's sentences)" },
};

const VIBE_LABEL: Record<string, string> = {
  sweet: "sweet", silly: "silly", flirty: "flirty (tasteful)", deep: "deep and reflective",
};

const SCHEMA_BY_SHAPE: Record<string, string> = {
  choice2:     `{"prompt":"...","options":["A","B"]}`,
  truthDare:   `{"truth":"...","dare":"..."}`,
  threeChoice: `{"prompt":"...","options":["A","B","C"],"correctIndex":0,"explain":"one short fun sentence revealing the answer"}`,
  choiceMulti: `{"prompt":"...","options":["A","B","C","D"]}`,
};
function schemaFor(shape: string): string {
  return SCHEMA_BY_SHAPE[shape] ?? `{"prompt":"..."}`;
}

// Pulls the { ... } object out of a reply even if the model added stray text,
// a label, or markdown fences around it — instead of requiring the whole
// response to already be pure JSON.
function extractJSON(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return raw;
  return raw.slice(start, end + 1);
}

// A string is "garbled" if it's not a real string, absurdly long, or still
// contains raw JSON punctuation — the exact symptom of a leaked/malformed
// reply making it into a visible card.
function garbled(text: unknown): boolean {
  return typeof text !== "string" || text.length === 0 || text.length > 400 || /[{}[\]]/.test(text);
}

function isValidRound(shape: string, round: unknown): round is Record<string, unknown> {
  if (!round || typeof round !== "object") return false;
  const r = round as Record<string, unknown>;
  if (shape === "choice2") {
    return !garbled(r.prompt) && Array.isArray(r.options) && r.options.length === 2
      && r.options.every((o) => typeof o === "string" && !garbled(o));
  }
  if (shape === "truthDare") {
    return !garbled(r.truth) && !garbled(r.dare);
  }
  if (shape === "threeChoice") {
    return !garbled(r.prompt) && Array.isArray(r.options) && r.options.length === 3
      && r.options.every((o) => typeof o === "string" && !garbled(o))
      && Number.isInteger(r.correctIndex) && (r.correctIndex as number) >= 0 && (r.correctIndex as number) <= 2
      && !garbled(r.explain);
  }
  if (shape === "choiceMulti") {
    return !garbled(r.prompt) && Array.isArray(r.options) && r.options.length >= 3 && r.options.length <= 5
      && r.options.every((o) => typeof o === "string" && !garbled(o));
  }
  // open, redGreen, pickPerson, yesNo, agreeDisagree, slider — just need a clean prompt
  return !garbled(r.prompt);
}

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

    // membership: check the CALLER's own row only (0 or 1), never the couple's combined rows
    const { data: mem } = await supabase
      .from("room_members").select("room_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
    if (!mem) return json({ error: "forbidden" }, 403);

    // avoid repeats: pull recent rounds of THIS format for this room
    const { data: prev } = await supabase
      .from("questions").select("text")
      .eq("room_id", roomId).eq("category", format)
      .order("created_at", { ascending: false }).limit(20);
    const avoid = (prev ?? []).map((r: { text: string }) => r.text);

    // Red/Green Flag: force a genuine 50/50 split instead of leaving the
    // balance up to the model (which was defaulting to green almost always).
    const leaning = format === "redflags" ? (Math.random() < 0.5 ? "red" : "green") : null;

    const schema = schemaFor(fmt.shape);
    const basePrompt =
      `Generate ONE round of a couples' connection game (long-distance dating).\n` +
      `Format: ${format} — ${fmt.instr}.\n` +
      (leaning
        ? `This behavior MUST genuinely be a ${leaning === "red"
            ? "RED flag — a real, concerning, unhealthy relationship behavior (not just a mild quirk)"
            : "GREEN flag — a real, admirable, healthy relationship behavior"
          }. Describe it plainly and neutrally in ONE sentence. Do NOT use the words "red flag" or "green flag" anywhere in the text — the couple has to judge it themselves.\n`
        : "") +
      `Tone: ${VIBE_LABEL[vibe] ?? vibe}.\n` +
      (theme ? `Theme to weave in: "${theme}".\n` : "") +
      (avoid.length ? `Do NOT repeat or closely echo: ${avoid.slice(0, 15).join(" | ")}\n` : "") +
      `Keep it concise and warm, never crude.\n` +
      `Respond with ONLY minified JSON — no markdown, no labels, no preamble or explanation before or after it — shaped exactly: ${schema}`;

    async function callClaude(promptText: string): Promise<unknown> {
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 350, messages: [{ role: "user", content: promptText }] }),
      });
      if (!aiRes.ok) return null;
      const data = await aiRes.json();
      const raw = (data.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text).join(" ").replace(/```json|```/g, "").trim();
      try { return JSON.parse(extractJSON(raw)); } catch { return null; }
    }

    // Try twice: if the first reply doesn't parse or doesn't match the
    // expected shape, ask again with a stricter reminder rather than ever
    // passing a malformed object through to the client/database.
    let round: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 2 && !round; attempt++) {
      const promptText = attempt === 0
        ? basePrompt
        : basePrompt + `\nIMPORTANT: reply with ONLY the raw JSON object and nothing else — no labels, no code fences, no extra text.`;
      const candidate = await callClaude(promptText);
      if (isValidRound(fmt.shape, candidate)) round = candidate as Record<string, unknown>;
    }
    if (!round) return json({ error: "bad_json" }, 502);

    round.shape = fmt.shape;
    if (leaning) round.answer = leaning; // "red" | "green" — used client-side to reveal + score correctness

    // store a text key for the no-repeat bank (prompt, or truth for truth/dare)
    const key = String(round.prompt ?? round.truth ?? "").slice(0, 300);
    if (key) {
      await supabase.from("questions").insert({
        room_id: roomId, category: format, theme, text: key, created_by: user.id,
      });
    }

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
