// ============================================================================
// generate-question — Supabase Edge Function (Deno)
// Generates ONE round of the chosen couples' GAME FORMAT via Claude,
// server-side, as structured JSON so the client knows how to render it.
//
// Why server-side: your ANTHROPIC_API_KEY never touches the browser.
// The caller's JWT is used, and room membership is checked against the
// caller's own row so it can never accidentally match a different member.
//
// Reliability notes:
// - Red/Green Flag was drifting almost entirely green because nothing told
//   the model which one to write. It's forced to a real coin-flip per round,
//   and the model is told explicitly which kind to produce. The same
//   coin-flip mechanism now also picks the "target"/"teller" side for
//   How Well You Know Me and Two Truths and a Lie.
// - FIXED (was causing "glitchy card" on ~80% of generations): the
//   garbled-text guard used to reject ANY string containing a curly or
//   square bracket ANYWHERE in it. Ordinary, colorful game text legitimately
//   uses brackets sometimes (asides, emphasis), so this was throwing away
//   perfectly good replies at a high rate. It now only rejects text that is
//   itself a JSON blob or still contains a literal `"key":` fragment or a
//   stray code fence — the actual signature of a leaked/malformed reply —
//   while leaving normal prose alone.
// - max_tokens raised (350 -> 700) and retries raised (2 -> 3), since some
//   schemas (three statements, four options, an explain line) genuinely
//   need more headroom and were sometimes getting cut off mid-JSON.
// - If every attempt still fails, the function no longer 502s and lets the
//   client fall back to a generic, wrong-shaped question. It now returns a
//   hand-written, shape-correct fallback round for the exact format that was
//   requested, so the UI is always coherent even in the rare case the model
//   truly can't be reached.
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
  mostlikely: { shape: "spectrum3",     instr: "a 'who is more likely to ___' question" },
  nhie:       { shape: "handraise",     instr: "a 'Never have I ever ___' statement, flirty or funny but kind" },
  newlywed:   { shape: "guess",         instr: "a short, specific personal-detail prompt phrased as a fill-in-the-blank FACT about a person, ending naturally right before an unstated blank — a fact-card, not a full question. Style examples (write your own, don't reuse these): 'their go-to order at a coffee shop is', 'the movie they've rewatched the most is', 'their most-used emoji is', 'the song they know every word to is'. Keep it specific, concrete, everyday, and guessable — not abstract or heavy." },
  hottake:    { shape: "spectrum2",     instr: "a slightly provocative opinion/hot take about love or dating to agree or disagree with" },
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
  twotruths: { shape: "twolie", instr: "three short, punchy first-person statements someone might say about themselves — quirky habits, small confessions, random facts, tastes, or bits of history. Make all three sound EQUALLY plausible and written in the same casual voice/length so it's genuinely hard to tell which one's made up. Keep each under 12 words. Do not mark or hint which one is false — that part is decided in the app, not by you." },
  compat:    { shape: "slider",      instr: "a single short playful statement to rate from 0 to 100 for how much it describes 'us' as a couple (e.g. how much you bicker over silly things, how spontaneous you are together, how often you finish each other's sentences)" },
};

const VIBE_LABEL: Record<string, string> = {
  sweet: "sweet", silly: "silly", flirty: "flirty (tasteful)", deep: "deep and reflective",
};

const SCHEMA_BY_SHAPE: Record<string, string> = {
  choice2:     `{"prompt":"...","options":["A","B"]}`,
  truthDare:   `{"truth":"...","dare":"..."}`,
  twolie:      `{"prompt":"a short one-line lead-in, e.g. 'a few things about me...'","options":["statement A","statement B","statement C"]}`,
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

// A string is "garbled" only if it's not real text, empty, absurdly long, or
// still carries an actual signature of leaked JSON/markdown — NOT just
// because it happens to contain a bracket somewhere (normal prose does that
// sometimes, e.g. a parenthetical aside written with brackets, and that was
// previously enough to nuke a perfectly good reply).
function garbled(text: unknown): boolean {
  if (typeof text !== "string") return true;
  const t = text.trim();
  if (!t || t.length > 700) return true;
  if (/^[{[][\s\S]*[}\]]$/.test(t)) return true;      // the whole string IS a JSON/array blob
  if (/"[a-zA-Z_]+"\s*:\s*["{[\d]/.test(t)) return true; // a literal `"key": value` fragment leaked in
  if (/```/.test(t)) return true;                      // a stray code fence
  return false;
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
  if (shape === "twolie") {
    return !garbled(r.prompt) && Array.isArray(r.options) && r.options.length === 3
      && r.options.every((o) => typeof o === "string" && !garbled(o));
  }
  if (shape === "choiceMulti") {
    return !garbled(r.prompt) && Array.isArray(r.options) && r.options.length >= 3 && r.options.length <= 5
      && r.options.every((o) => typeof o === "string" && !garbled(o));
  }
  // open, guess, redGreen, spectrum2, spectrum3, handraise, slider — just need a clean prompt
  return !garbled(r.prompt);
}

// Hand-written, always-valid fallback content per shape, used only if every
// live attempt at the model genuinely fails — keeps the UI shape-correct
// (never swaps a game into an unrelated generic question) even then.
function fallbackFor(format: string, shape: string): Record<string, unknown> {
  const table: Record<string, Record<string, unknown>[]> = {
    choice2: [
      { prompt: "Tonight: cozy night in or spontaneous night out?", options: ["Cozy night in", "Spontaneous night out"] },
      { prompt: "Weekend trip: mountains or beach?", options: ["Mountains", "Beach"] },
    ],
    redGreen: [
      { prompt: "Remembers little things you mentioned in passing, weeks later." },
      { prompt: "Goes quiet for days after an argument instead of talking it through." },
      { prompt: "Checks in without being asked when you've had a rough day." },
      { prompt: "Keeps score of who did what last time you disagreed." },
    ],
    open: [
      { prompt: "Tell me about a moment today you wished I'd been there for." },
      { prompt: "What's something small that made you smile today?" },
    ],
    guess: [
      { prompt: "their go-to order at a coffee shop is" },
      { prompt: "the song they know every word to is" },
    ],
    spectrum2: [
      { prompt: "Splitting the bill down the middle, always, no matter who ordered what." },
      { prompt: "Texting 'good morning' every single day is non-negotiable." },
    ],
    spectrum3: [
      { prompt: "who is more likely to forget where they put their phone" },
      { prompt: "who is more likely to fall asleep mid-movie" },
    ],
    handraise: [
      { prompt: "Never have I ever cried during a commercial." },
      { prompt: "Never have I ever texted the wrong person something embarrassing." },
    ],
    choiceMulti: [
      { prompt: "You've had a rough day and just walked in the door. What actually helps most?", options: ["A hug, no talking yet", "Them asking what happened", "Them just making you tea", "Some quiet time, then talk"] },
    ],
    twolie: [
      { prompt: "a few things about me…", options: ["I can't sleep without socks on", "I've never seen a single Star Wars movie", "I once ate cereal for dinner five nights in a row"] },
      { prompt: "some things about me, one's a lie…", options: ["I've never broken a bone", "I know how to juggle", "I once got lost in my own neighborhood"] },
    ],
    truthDare: [
      { truth: "What's a small thing that instantly makes your day better?", dare: "Send a voice memo saying the nicest thing about your partner right now." },
    ],
    slider: [
      { prompt: "How much you finish each other's sentences." },
      { prompt: "How spontaneous the two of you are together." },
    ],
  };
  const options = table[shape];
  if (!options || !options.length) return { prompt: "What's something small about today you want to remember?" };
  return options[Math.floor(Math.random() * options.length)];
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
    // How Well You Know Me: which side is being guessed about this round.
    const target = format === "newlywed" ? (Math.random() < 0.5 ? "him" : "her") : null;
    // Two Truths and a Lie: which side is "telling" this round (they'll pick
    // their own lie in-app; the model never decides truth/false).
    const teller = format === "twotruths" ? (Math.random() < 0.5 ? "him" : "her") : null;

    const schema = schemaFor(fmt.shape);
    const basePrompt =
      `Generate ONE round of a couples' connection game (long-distance dating).\n` +
      `Format: ${format} — ${fmt.instr}.\n` +
      (leaning
        ? `Write ONE short, plain sentence (max 18 words, no sub-clauses, no caveats) describing a specific ${leaning === "red" ? "concerning/unhealthy" : "healthy/admirable"} relationship behavior. Do not use the words "red flag" or "green flag". Do not explain or hedge — just state the behavior.\n`
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
        body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: "user", content: promptText }] }),
      });
      if (!aiRes.ok) return null;
      const data = await aiRes.json();
      const raw = (data.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text).join(" ").replace(/```json|```/g, "").trim();
      try { return JSON.parse(extractJSON(raw)); } catch { return null; }
    }

    // Try up to three times: if a reply doesn't parse or doesn't match the
    // expected shape, ask again with a stricter reminder rather than ever
    // passing a malformed object through to the client/database.
    let round: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 3 && !round; attempt++) {
      const promptText = attempt === 0
        ? basePrompt
        : basePrompt + `\nIMPORTANT: reply with ONLY the raw JSON object and nothing else — no labels, no code fences, no extra text before or after it.`;
      const candidate = await callClaude(promptText);
      if (isValidRound(fmt.shape, candidate)) round = candidate as Record<string, unknown>;
    }
    // Every live attempt failed — use a hand-written, shape-correct fallback
    // instead of ever 502-ing into a mismatched generic question client-side.
    if (!round) round = fallbackFor(format, fmt.shape);

    round.shape = fmt.shape;
    if (leaning) round.answer = leaning; // "red" | "green" — used client-side to reveal + score correctness
    if (target) round.target = target;   // "him" | "her" — who's answering about themselves this round
    if (teller) round.teller = teller;   // "him" | "her" — who privately picks their own lie this round

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
