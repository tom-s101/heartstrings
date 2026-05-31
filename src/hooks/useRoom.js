import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

/* ============================================================================
   useRoom — synced room state over Supabase Realtime.
   Surface: { state, commit, online, clientId, mineStrokes, partnerStrokes,
              pushStroke, clearMine, generateQuestion, saveDrawing, addScore,
              roomId, error }
   ============================================================================ */

function blankState() {
  return {
    mode: "questions",
    feel: "chill",
    q: { style: "classic", sel: "deep", vibe: "sweet", theme: "",
         round: { shape: "open", prompt: "What's a moment with me you keep replaying in your head?" },
         count: 1, turn: "him", picks: { him: null, her: null }, awarded: false,
         generating: false, genBy: null, history: [] },
    d: { sub: "same", prompt: "our dream date", revealed: false, duration: 60, endsAt: null,
         round: 1, artist: "him" },
    score: { him: 0, her: 0 },
    c: { tool: "story" },
    players: { him: { lastSeen: 0 }, her: { lastSeen: 0 } },
  };
}

export function useRoom(roomName, joinCode, side, user, name) {
  const [roomId, setRoomId] = useState(null);
  const [state, setState] = useState(blankState());
  const [online, setOnline] = useState(false);
  const [status, setStatus] = useState("connecting"); // connecting | live | reconnecting | error
  const [error, setError] = useState(null);
  const [mineStrokes, setMineStrokes] = useState([]);
  const [partnerStrokes, setPartnerStrokes] = useState([]);

  const stateRef = useRef(state);
  const channelRef = useRef(null);
  const clientId = useRef(user?.id || Math.random().toString(36).slice(2));
  useEffect(() => { stateRef.current = state; }, [state]);

  const applyRow = useCallback((row) => {
    if (!row) return;
    setState((prev) => ({
      ...prev,
      mode: row.mode ?? prev.mode,
      feel: row.feel ?? prev.feel,
      q: { ...prev.q, ...(row.q_state || {}) },
      d: { ...prev.d, ...(row.d_state || {}) },
      c: { ...prev.c, ...(row.c_state || {}) },
      score: row.score || prev.score,
    }));
  }, []);

  /* join + subscribe */
  useEffect(() => {
    let alive = true; let presenceTimer = null;
    (async () => {
      const { data: rid, error: rpcErr } = await supabase.rpc("join_room", {
        p_name: roomName, p_code: joinCode, p_side: side,
      });
      if (rpcErr) { if (alive) setError(rpcErr.message); return; }
      if (!alive) return;
      setRoomId(rid);

      const { data: row } = await supabase.from("room_state").select("*").eq("room_id", rid).single();
      if (row) applyRow(row);

      const channel = supabase.channel(`room:${rid}`, {
        config: { presence: { key: clientId.current }, broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel.on("postgres_changes",
        { event: "*", schema: "public", table: "room_state", filter: `room_id=eq.${rid}` },
        (p) => { if (p.new.updated_by !== clientId.current) applyRow(p.new); });

      channel.on("broadcast", { event: "stroke" }, ({ payload }) => {
        if (payload.side !== side) setPartnerStrokes((s) => [...s, payload.stroke]);
      });
      channel.on("broadcast", { event: "clear" }, ({ payload }) => {
        if (payload.side !== side) setPartnerStrokes([]);
      });

      channel.on("presence", { event: "sync" }, () => {
        const st = channel.presenceState();
        const members = Object.values(st).flat();
        const bySide = Object.fromEntries(members.map((m) => [m.side, m]));
        setState((prev) => {
          const himOnline = !!bySide.him;
          const herOnline = !!bySide.her;
          const himName = bySide.him?.name || prev.players?.him?.name || "";
          const herName = bySide.her?.name || prev.players?.her?.name || "";
          // Skip re-render if nothing meaningful changed
          const prevHimOnline = (prev.players?.him?.lastSeen || 0) > 0;
          const prevHerOnline = (prev.players?.her?.lastSeen || 0) > 0;
          if (himOnline === prevHimOnline && herOnline === prevHerOnline &&
              himName === prev.players?.him?.name && herName === prev.players?.her?.name) return prev;
          return { ...prev, players: {
            him: { lastSeen: himOnline ? Date.now() : 0, name: himName },
            her: { lastSeen: herOnline ? Date.now() : 0, name: herName },
          }};
        });
      });

      await channel.subscribe(async (st) => {
        if (st === "SUBSCRIBED") {
          setOnline(true); setStatus("live");
          await channel.track({ side, uid: clientId.current, name: name || "" });
          // re-sync state on (re)connect so we never miss changes made while away
          const { data: fresh } = await supabase.from("room_state").select("*").eq("room_id", rid).single();
          if (fresh) applyRow(fresh);
          if (!presenceTimer) presenceTimer = setInterval(() => {
            supabase.from("room_members").update({ last_seen: new Date().toISOString() })
              .eq("room_id", rid).eq("user_id", user.id);
          }, 30000);
        } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
          setOnline(false); setStatus("reconnecting"); // supabase auto-retries; SUBSCRIBED fires again on success
        } else if (st === "CLOSED") {
          setOnline(false);
        }
      });
    })();
    return () => { alive = false; if (presenceTimer) clearInterval(presenceTimer); if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [roomName, joinCode, side, user, applyRow]);

  /* optimistic local + persist */
  const commit = useCallback(async (mutate) => {
    const next = mutate(JSON.parse(JSON.stringify(stateRef.current)));
    stateRef.current = next; setState(next);
    if (!roomId) return;
    await supabase.from("room_state").update({
      mode: next.mode, feel: next.feel, q_state: next.q, d_state: next.d, c_state: next.c, score: next.score,
      updated_by: clientId.current, updated_at: new Date().toISOString(),
    }).eq("room_id", roomId);
  }, [roomId]);

  const addScore = useCallback((him = 0, her = 0) => commit((s) => {
    s.score = { him: (s.score?.him || 0) + him, her: (s.score?.her || 0) + her }; return s;
  }), [commit]);

  /* live drawing */
  const pushStroke = useCallback((stroke) => {
    setMineStrokes((p) => [...p, stroke]);
    channelRef.current?.send({ type: "broadcast", event: "stroke", payload: { side, stroke } });
  }, [side]);
  const clearMine = useCallback(() => {
    setMineStrokes([]);
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: { side } });
  }, [side]);

  /* question generation (classic categories + game formats share this) */
  const generateQuestion = useCallback(async ({ sel, vibe, theme }) => {
    await commit((s) => { s.q.generating = true; s.q.genBy = clientId.current; s.q.genAt = Date.now(); return s; });
    let round = null;
    try {
      // 18s ceiling so a hung function can never lock the card forever
      const call = supabase.functions.invoke("generate-question", { body: { roomId, format: sel, vibe, theme } });
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 18000));
      const { data, error } = await Promise.race([call, timeout]);
      if (!error) round = data?.round || null;
    } catch { round = null; }
    if (!round) round = { shape: "open", prompt: "Tell me about a moment today you wished I'd been there for." };
    try {
      await commit((s) => {
        // Save current question to history before replacing
        if (s.q.round?.prompt) {
          s.q.history = [...(s.q.history || []), { prompt: s.q.round.prompt, sel: s.q.sel, at: Date.now() }].slice(-30);
        }
        s.q.round = round; s.q.count = (s.q.count || 1) + 1;
        s.q.turn = s.q.turn === "him" ? "her" : "him";
        s.q.picks = { him: null, her: null }; s.q.awarded = false;
        s.q._td = null; // clear any prior truth/dare reveal
        s.q.generating = false; s.q.genBy = null; s.q.genAt = null;
        return s;
      });
    } catch {
      // even if the persist fails, never leave the lock stuck locally
      setState((p) => ({ ...p, q: { ...p.q, round, generating: false, genBy: null, genAt: null } }));
    }
    return round;
  }, [commit, roomId]);

  /* generic AI helper for creative tools (server-side key) */
  const aiAssist = useCallback(async (prompt) => {
    try {
      const { data, error } = await supabase.functions.invoke("ai-assist", { body: { prompt } });
      return error ? null : (data?.text || null);
    } catch { return null; }
  }, []);

  /* save drawing to gallery */
  const saveDrawing = useCallback(async () => {
    if (!roomId) return;
    const d = stateRef.current.d;
    const him = side === "him" ? mineStrokes : partnerStrokes;
    const her = side === "her" ? mineStrokes : partnerStrokes;
    await supabase.from("drawings").insert({
      room_id: roomId, prompt: d.prompt, sub_mode: d.sub, round: d.round,
      strokes_him: him, strokes_her: her,
    });
  }, [roomId, side, mineStrokes, partnerStrokes]);

  return { state, commit, online, status, error, clientId: clientId.current,
    mineStrokes, partnerStrokes, pushStroke, clearMine,
    generateQuestion, saveDrawing, addScore, aiAssist, roomId };
}
