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
         generating: false, genBy: null },
    d: { sub: "same", prompt: "our dream date", revealed: false, duration: 60, endsAt: null,
         round: 1, artist: "him" },
    score: { him: 0, her: 0 },
    c: { tool: "story" },
    players: { him: { lastSeen: 0 }, her: { lastSeen: 0 } },
  };
}

function isObj(v) { return v != null && typeof v === "object" && !Array.isArray(v); }

export function useRoom(roomName, joinCode, side, user) {
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

  // Defensive merge: a malformed or wrong-typed nested field (a bad AI response
  // that got saved, an old shape from a previous version, etc.) must never be
  // able to crash a downstream render. Anything that doesn't look like what we
  // expect is quietly replaced with a safe default instead of passed through.
  const applyRow = useCallback((row) => {
    if (!row) return;
    setState((prev) => {
      const q = isObj(row.q_state) ? row.q_state : {};
      const d = isObj(row.d_state) ? row.d_state : {};
      const c = isObj(row.c_state) ? row.c_state : {};
      return {
        ...prev,
        mode: row.mode ?? prev.mode,
        feel: row.feel ?? prev.feel,
        q: {
          ...prev.q, ...q,
          picks: isObj(q.picks) ? q.picks : (prev.q.picks || { him: null, her: null }),
          round: isObj(q.round) ? q.round : prev.q.round,
        },
        d: {
          ...prev.d, ...d,
          chain: Array.isArray(d.chain) ? d.chain : (prev.d.chain || []),
        },
        c: { ...prev.c, ...c },
        score: isObj(row.score) ? row.score : prev.score,
      };
    });
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
        (p) => applyRow(p.new));

      channel.on("broadcast", { event: "stroke" }, ({ payload }) => {
        if (payload.side !== side) setPartnerStrokes((s) => [...s, payload.stroke]);
      });
      channel.on("broadcast", { event: "clear" }, ({ payload }) => {
        if (payload.side !== side) setPartnerStrokes([]);
      });

      channel.on("presence", { event: "sync" }, () => {
        const st = channel.presenceState();
        const sides = new Set(Object.values(st).flat().map((m) => m.side));
        setState((prev) => ({ ...prev, players: {
          him: { lastSeen: sides.has("him") ? Date.now() : 0 },
          her: { lastSeen: sides.has("her") ? Date.now() : 0 },
        } }));
      });

      await channel.subscribe(async (st) => {
        if (st === "SUBSCRIBED") {
          setOnline(true); setStatus("live");
          await channel.track({ side, uid: clientId.current });
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

  // Lets a crashed section heal itself: resets just that slice of synced
  // state back to safe defaults (used by ErrorBoundary's "reset" button).
  // Never touches the other sections, the room, accounts, or saved gallery.
  const resetSection = useCallback((which) => commit((s) => {
    const fresh = blankState();
    if (which === "q") s.q = fresh.q;
    if (which === "d") s.d = fresh.d;
    if (which === "c") s.c = fresh.c;
    return s;
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
      // Explicitly fetch (and refresh if needed) the session before calling the
      // function. functions.invoke() normally attaches this for us, but on some
      // mobile browsers (storage partitioning, background tab throttling) the
      // implicit lookup can miss, which silently sends an unauthenticated
      // request and the server correctly 401s. Being explicit here removes that
      // failure mode entirely — every call now guarantees a fresh token or fails
      // loudly instead of silently.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("no session");
      // call invoke with the token forced into the header, bypassing any
      // implicit/stale lookup the client might otherwise do
      const call = supabase.functions.invoke("generate-question", {
        body: { roomId, format: sel, vibe, theme },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 18000));
      const { data, error } = await Promise.race([call, timeout]);
      if (!error) round = data?.round || null;
    } catch { round = null; }
    if (!round) round = { shape: "open", prompt: "Tell me about a moment today you wished I'd been there for." };
    try {
      await commit((s) => {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: { prompt },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
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

  /* local (one-device) mode saves both stroke sets directly */
  const saveDrawingDirect = useCallback(async (him, her) => {
    if (!roomId) return;
    const d = stateRef.current.d;
    await supabase.from("drawings").insert({
      room_id: roomId, prompt: d.prompt, sub_mode: d.sub || "together", round: d.round || 1,
      strokes_him: him || [], strokes_her: her || [],
    });
  }, [roomId]);

  return { state, commit, online, status, error, clientId: clientId.current,
    mineStrokes, partnerStrokes, pushStroke, clearMine,
    generateQuestion, saveDrawing, saveDrawingDirect, addScore, aiAssist, resetSection, roomId };
}
