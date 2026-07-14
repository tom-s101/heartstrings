import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { C, Icon, card, primary, ghost, Label, Input, Hint } from "../ui";

/* ============================================================================
   Photo Booth — two ways in:
   • Solo (1 device): customize → countdown shots → strip → save. All local.
   • Room (long distance): one partner creates a room (auto 6-letter code),
     the other joins with the code. The room's channel is owned by the
     PhotoBooth shell (not the Booth screen) so it stays alive across setup
     AND the booth itself. That lets us:
       - sync the strip's look (layout/frame/filter/caption) from whoever
         created the room to whoever joins with the code, live, no re-entry.
       - open a real peer-to-peer WebRTC video call between the two devices
         (signaled over this same room channel), so the live view — and the
         final shots — show both of you together, at real camera quality,
         in one split frame. If the two devices can't establish a direct
         connection (no TURN server is configured here, so very restrictive
         NATs/firewalls can occasionally fail), it falls back to relaying
         low-fps camera snapshots instead, so the booth still works.
     The countdown is still synced (broadcast "shutter"), and each device
     composites its own camera + its live view of its partner (WebRTC video
     when connected, the relay snapshot otherwise) into a single photo per shot.
   ============================================================================ */

const FRAMES = [
  { id: "rose", label: "Rose", bg: "#F8E4EC", accent: C.roseDeep },
  { id: "blue", label: "Ocean", bg: "#DEE8F3", accent: C.blueDeep },
  { id: "cream", label: "Cream", bg: "#FAF4EA", accent: "#8B7C6B" },
  { id: "ink", label: "Midnight", bg: "#3A332C", accent: "#F6E9D4" },
];
const FILTERS = [
  { id: "none", label: "Natural", css: "none" },
  { id: "warm", label: "Golden", css: "sepia(.25) saturate(1.15) brightness(1.05)" },
  { id: "bw", label: "Classic B&W", css: "grayscale(1) contrast(1.08)" },
  { id: "soft", label: "Dreamy", css: "brightness(1.08) saturate(.9) blur(0.4px)" },
];
const LAYOUTS = [
  { id: "strip3", label: "Strip · 3", shots: 3 },
  { id: "strip4", label: "Strip · 4", shots: 4 },
];
const SHOT_W = 480, SHOT_H = 360;
const DEFAULT_CFG = { layout: "strip3", frame: "rose", filter: "none", caption: "us ♡", date: true };
// public STUN-only config — no TURN server, so this is peer-to-peer over the
// open internet. Works for the vast majority of home/mobile connections;
// very restrictive corporate networks or symmetric NATs can still fail, in
// which case the booth quietly falls back to the low-fps photo relay below.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const genCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");

export function PhotoBooth({ user, onBack }) {
  const [stage, setStage] = useState("mode"); // mode | joincode | setup | booth
  const [session, setSession] = useState(null); // null (solo) | { code, roomId, side }
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [joinInput, setJoinInput] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // room-wide sync: alive from the moment a room exists (setup) through the
  // booth screen itself, so config + camera frames + the shutter all flow
  // over one channel instead of being recreated per screen.
  const channelRef = useRef(null);
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  const [partnerHere, setPartnerHere] = useState(false);
  const [partnerFrame, setPartnerFrame] = useState(null); // last low-fps snapshot of their camera (fallback)
  const [shutterTick, setShutterTick] = useState(0);
  const [rtcSignal, setRtcSignal] = useState(null); // latest WebRTC offer/answer/ice from partner
  const isCreator = !session || session.side === "him";

  const enterRoom = async (code, side) => {
    setBusy(true); setErr(null);
    const name = `booth-${code.toLowerCase()}`;
    const { data: rid, error } = await supabase.rpc("join_room", { p_name: name, p_code: code, p_side: side });
    setBusy(false);
    if (error) { setErr(/full/i.test(error.message) ? "That booth is full." : "Couldn't find a booth with that code — double-check it."); return; }
    setSession({ code, roomId: rid, side });
    setStage("setup");
  };

  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel(`booth:${session.roomId}`, {
      config: { presence: { key: session.side }, broadcast: { self: false } },
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const sides = new Set(Object.values(ch.presenceState()).flat().map((m) => m.side));
      const otherHere = sides.has(session.side === "him" ? "her" : "him");
      setPartnerHere(otherHere);
      // whoever created the room is the source of truth for the strip's
      // look — re-send it whenever the partner (re)appears, so a joiner
      // who arrives after customization already started still gets it.
      if (session.side === "him" && otherHere) {
        ch.send({ type: "broadcast", event: "cfg", payload: cfgRef.current });
      }
    });
    ch.on("broadcast", { event: "cfg" }, ({ payload }) => { if (session.side !== "him") setCfg(payload); });
    ch.on("broadcast", { event: "frame" }, ({ payload }) => setPartnerFrame(payload.img));
    ch.on("broadcast", { event: "shutter" }, () => setShutterTick((t) => t + 1));
    ch.on("broadcast", { event: "rtc" }, ({ payload }) => setRtcSignal({ ...payload, t: Date.now() }));

    ch.subscribe(async (st) => {
      if (st === "SUBSCRIBED") {
        await ch.track({ side: session.side });
        if (session.side === "him") ch.send({ type: "broadcast", event: "cfg", payload: cfgRef.current });
      }
    });
    return () => { supabase.removeChannel(ch); channelRef.current = null; setPartnerHere(false); setPartnerFrame(null); setRtcSignal(null); };
    // eslint-disable-next-line
  }, [session?.roomId]);

  // creator's edits propagate live to whoever already joined
  useEffect(() => {
    if (session?.side === "him" && channelRef.current) {
      channelRef.current.send({ type: "broadcast", event: "cfg", payload: cfg });
    }
    // eslint-disable-next-line
  }, [cfg]);

  const sendFrame = useCallback((img) => {
    channelRef.current?.send({ type: "broadcast", event: "frame", payload: { img } });
  }, []);
  const sendShutter = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "shutter", payload: {} });
  }, []);
  const sendRtc = useCallback((msg) => {
    channelRef.current?.send({ type: "broadcast", event: "rtc", payload: msg });
  }, []);

  const startFresh = (nextSession) => { setCfg(DEFAULT_CFG); setSession(nextSession); setStage(nextSession ? "setup" : "setup"); };

  if (stage === "mode") return (
    <Shell onBack={onBack} title="Photo Booth" sub="how do you want to shoot?">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <BigOption icon="camera" title="One device" sub="you're together (or flying solo) — shoot on this screen"
          color={C.gold} onClick={() => { setCfg(DEFAULT_CFG); setSession(null); setStage("setup"); }} />
        <BigOption icon="plane" title="Create a room" sub="get a code, send it to your favorite person far away"
          color={C.blue} onClick={() => enterRoom(genCode(), "him")} busy={busy} />
        <BigOption icon="lock" title="Join with a code" sub="they sent you a booth code? hop in here"
          color={C.rose} onClick={() => setStage("joincode")} />
      </div>
      {err && <Hint style={{ textAlign: "center", marginTop: 12, color: C.roseDeep }}>{err}</Hint>}
    </Shell>
  );

  if (stage === "joincode") return (
    <Shell onBack={() => setStage("mode")} title="Join a booth" sub="enter the code they sent you">
      <Label>booth code</Label>
      <Input value={joinInput} onChange={(v) => setJoinInput(v.toUpperCase())} placeholder="e.g. K7XMPQ" />
      <button className="press" disabled={joinInput.trim().length < 4 || busy}
        onClick={() => enterRoom(joinInput.trim(), "her")}
        style={primary(joinInput.trim().length >= 4 && !busy, { width: "100%", marginTop: 16 })}>
        <Icon name="arrow" size={17} color="#fff" /> {busy ? "joining…" : "join booth"}
      </button>
      {err && <Hint style={{ textAlign: "center", marginTop: 12, color: C.roseDeep }}>{err}</Hint>}
    </Shell>
  );

  if (stage === "setup") return (
    <Setup cfg={cfg} setCfg={setCfg} session={session} canEdit={isCreator} partnerHere={partnerHere}
      onBack={() => setStage("mode")} onStart={() => setStage("booth")} />
  );

  return (
    <Booth cfg={cfg} session={session} user={user} partnerHere={partnerHere} partnerFrame={partnerFrame}
      shutterTick={shutterTick} rtcSignal={rtcSignal} onSendFrame={sendFrame} onSendShutter={sendShutter} onSendRtc={sendRtc}
      onDone={() => setStage("setup")} onExit={onBack} />
  );
}

/* ---------------- setup / customization ---------------- */
function Setup({ cfg, setCfg, session, canEdit, partnerHere, onBack, onStart }) {
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const frame = FRAMES.find((f) => f.id === cfg.frame);
  return (
    <Shell onBack={onBack} title="Design your strip" sub={session ? "you're in a shared booth" : "make it yours"}>
      {session && canEdit && (
        <div style={{ textAlign: "center", background: C.blueLight, borderRadius: 14, padding: "12px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.blueDeep, letterSpacing: 1 }}>BOOTH CODE — SEND THIS TO THEM</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 32, fontWeight: 700, letterSpacing: 6, color: C.blueDeep }}>{session.code}</div>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: C.inkSoft }}>they tap "Join with a code" and enter it — whatever you pick below shows up on their screen too</div>
        </div>
      )}
      {session && !canEdit && (
        <div style={{ textAlign: "center", background: C.roseLight, borderRadius: 14, padding: "12px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.roseDeep, letterSpacing: 1 }}>
            {partnerHere ? "SYNCED WITH THEIR PICKS" : "WAITING TO SYNC"}
          </div>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: C.inkSoft }}>
            {partnerHere ? "they're designing the strip — it'll update here automatically" : "once they're in and pick a look, it'll appear here"}
          </div>
        </div>
      )}
      {canEdit ? (
        <>
          <Section label="strip layout">
            {LAYOUTS.map((l) => <Pick key={l.id} active={cfg.layout === l.id} onClick={() => set("layout", l.id)} label={l.label} />)}
          </Section>
          <Section label="frame">
            {FRAMES.map((f) => (
              <button key={f.id} className="press" onClick={() => set("frame", f.id)} style={{
                border: `2px solid ${cfg.frame === f.id ? f.accent : C.line}`, background: f.bg, color: f.accent,
                borderRadius: 12, padding: "9px 14px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>{f.label}</button>
            ))}
          </Section>
          <Section label="mood filter">
            {FILTERS.map((f) => <Pick key={f.id} active={cfg.filter === f.id} onClick={() => set("filter", f.id)} label={f.label} />)}
          </Section>
          <Label style={{ marginTop: 16 }}>caption on the strip</Label>
          <Input value={cfg.caption} onChange={(v) => set("caption", v)} placeholder="us ♡ · date night · manila ↔ mindoro" />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13.5, color: C.ink, cursor: "pointer" }}>
            <input type="checkbox" checked={cfg.date} onChange={(e) => set("date", e.target.checked)} /> stamp today's date
          </label>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SummaryRow label="layout" value={LAYOUTS.find((l) => l.id === cfg.layout)?.label} />
          <SummaryRow label="frame" value={frame.label} />
          <SummaryRow label="filter" value={FILTERS.find((f) => f.id === cfg.filter)?.label} />
          <SummaryRow label="caption" value={cfg.caption || "—"} />
        </div>
      )}
      {/* mini preview */}
      <div style={{ display: "flex", justifyContent: "center", margin: "18px 0 6px" }}>
        <div style={{ background: frame.bg, borderRadius: 10, padding: "12px 10px", width: 92, boxShadow: "0 14px 26px -18px rgba(0,0,0,.5)" }}>
          {Array.from({ length: LAYOUTS.find((l) => l.id === cfg.layout).shots }).map((_, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 4, height: 44, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="heart" size={13} color={frame.accent} />
            </div>
          ))}
          <div style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 12, color: frame.accent }}>{cfg.caption || "us"}</div>
        </div>
      </div>
      <button className="press" onClick={onStart} style={primary(true, { width: "100%", marginTop: 12 })}>
        <Icon name="camera" size={18} color="#fff" /> open the booth
      </button>
    </Shell>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderRadius: 12, background: "#fff", border: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".5px", textTransform: "uppercase", color: C.inkSoft }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{value}</span>
    </div>
  );
}

/* ---------------- the booth itself ---------------- */
function Booth({ cfg, session, user, partnerHere, partnerFrame, shutterTick, rtcSignal, onSendFrame, onSendShutter, onSendRtc, onDone, onExit }) {
  const shots = LAYOUTS.find((l) => l.id === cfg.layout).shots;
  const filter = FILTERS.find((f) => f.id === cfg.filter).css;
  const frame = FRAMES.find((f) => f.id === cfg.frame);
  const videoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [camErr, setCamErr] = useState(null);
  const [count, setCount] = useState(null);   // 3..2..1 overlay
  const [flash, setFlash] = useState(false);
  const [mine, setMine] = useState([]);       // captured shots (data urls) — already include partner when in a room
  const [phase, setPhase] = useState("idle"); // idle | shooting | done
  const shooting = useRef(false);
  const partnerImgRef = useRef(null); // decoded <img> of partnerFrame, ready for canvas draws — fallback only

  /* -------- real peer-to-peer video (WebRTC), signaled over the same room
     channel. Whoever created the room always makes the offer; the joiner
     always answers, so there's no glare. If the connection can't establish
     (strict NAT/firewall, no TURN server configured), the low-fps photo
     relay above keeps working as a fallback for both the live "them" pane
     and captured shots. */
  const pcRef = useRef(null);
  const madeOfferRef = useRef(false);
  const pendingCandidatesRef = useRef([]);
  const [rtcConnected, setRtcConnected] = useState(false);
  const isInitiator = session?.side === "him";

  const teardownPC = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    madeOfferRef.current = false;
    pendingCandidatesRef.current = [];
    setRtcConnected(false);
  }, []);

  const ensurePC = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current));
    pc.ontrack = (e) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    pc.onicecandidate = (e) => { if (e.candidate) onSendRtc({ kind: "ice", data: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      setRtcConnected(pc.connectionState === "connected");
      if (pc.connectionState === "failed" || pc.connectionState === "closed") teardownPC();
    };
    pcRef.current = pc;
    return pc;
  }, [onSendRtc, teardownPC]);

  // initiator opens the connection once the camera's ready and the partner's in the room
  useEffect(() => {
    if (!session || !isInitiator || !ready || !partnerHere || madeOfferRef.current) return;
    madeOfferRef.current = true;
    (async () => {
      try {
        const pc = ensurePC();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        onSendRtc({ kind: "offer", data: offer });
      } catch { madeOfferRef.current = false; }
    })();
  }, [session, isInitiator, ready, partnerHere, ensurePC, onSendRtc]);

  // handle incoming offer/answer/ice from the partner
  useEffect(() => {
    if (!rtcSignal || !session || !ready) return;
    (async () => {
      try {
        const pc = ensurePC();
        if (rtcSignal.kind === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(rtcSignal.data));
          for (const c of pendingCandidatesRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
          pendingCandidatesRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          onSendRtc({ kind: "answer", data: answer });
        } else if (rtcSignal.kind === "answer") {
          if (pc.signalingState !== "stable") {
            await pc.setRemoteDescription(new RTCSessionDescription(rtcSignal.data));
            for (const c of pendingCandidatesRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
            pendingCandidatesRef.current = [];
          }
        } else if (rtcSignal.kind === "ice") {
          if (pc.remoteDescription) { try { await pc.addIceCandidate(new RTCIceCandidate(rtcSignal.data)); } catch { /* ignore */ } }
          else pendingCandidatesRef.current.push(rtcSignal.data);
        }
      } catch { /* a stray/late signal — safe to drop */ }
    })();
    // eslint-disable-next-line
  }, [rtcSignal]);

  // partner stepped out of the booth — tear down so a fresh offer goes out when they're back
  useEffect(() => { if (!partnerHere) teardownPC(); }, [partnerHere, teardownPC]);
  useEffect(() => () => teardownPC(), [teardownPC]);

  /* camera */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; }
        setReady(true);
      } catch {
        setCamErr("Camera access is needed for the booth — check your browser permissions and reload.");
      }
    })();
    return () => { alive = false; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  /* fallback path: a snapshot of our own camera sent to our partner a few
     times a second, used only for the live "them" pane and for compositing
     shots WHILE real WebRTC video isn't connected. Once rtcConnected is
     true this stops (real video is strictly better and there's no reason
     to keep spending bandwidth on it), and resumes automatically if the
     peer connection ever drops. */
  useEffect(() => {
    if (!session || !ready || rtcConnected) return;
    const FW = SHOT_W / 2, FH = SHOT_H; // exactly the size of the half-slot it fills
    const cv = document.createElement("canvas"); cv.width = FW; cv.height = FH;
    const cx = cv.getContext("2d");
    const iv = setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      drawCover(cx, v, 0, 0, FW, FH, false);
      onSendFrame(cv.toDataURL("image/jpeg", 0.85));
    }, 300);
    return () => clearInterval(iv);
  }, [session, ready, rtcConnected, onSendFrame]);

  /* decode the latest partner snapshot so capture() can draw it synchronously */
  useEffect(() => {
    if (!partnerFrame) { partnerImgRef.current = null; return; }
    const img = new Image();
    img.onload = () => { partnerImgRef.current = img; };
    img.src = partnerFrame;
  }, [partnerFrame]);

  /* the partner's shutter press starts our countdown too */
  const prevTick = useRef(shutterTick);
  useEffect(() => {
    if (shutterTick !== prevTick.current) {
      prevTick.current = shutterTick;
      if (!shooting.current) runSequence(false);
    }
    // eslint-disable-next-line
  }, [shutterTick]);

  const capture = useCallback(() => {
    const v = videoRef.current; if (!v) return null;
    const cv = document.createElement("canvas"); cv.width = SHOT_W; cv.height = SHOT_H;
    const x = cv.getContext("2d");
    if (filter !== "none") x.filter = filter.replace("blur(0.4px)", ""); // canvas blur is heavy; skip
    if (session) {
      const half = SHOT_W / 2;
      drawCover(x, v, 0, 0, half, SHOT_H, true); // you, mirrored — the selfie you expect
      const rv = remoteVideoRef.current;
      if (rtcConnected && rv && rv.videoWidth) drawCover(x, rv, half, 0, half, SHOT_H, false); // them, real video, true orientation
      else if (partnerImgRef.current) drawCover(x, partnerImgRef.current, half, 0, half, SHOT_H, false); // fallback relay frame
      else { x.filter = "none"; x.fillStyle = "#2a2a2a"; x.fillRect(half, 0, half, SHOT_H); }
      x.filter = "none";
      x.strokeStyle = "rgba(255,255,255,.55)"; x.lineWidth = 2;
      x.beginPath(); x.moveTo(half, 0); x.lineTo(half, SHOT_H); x.stroke();
    } else {
      drawCover(x, v, 0, 0, SHOT_W, SHOT_H, true);
    }
    return cv.toDataURL("image/jpeg", 0.88);
  }, [filter, session, rtcConnected]);

  const runSequence = useCallback(async (broadcast) => {
    if (shooting.current) return;
    shooting.current = true;
    setPhase("shooting"); setMine([]);
    if (broadcast && session) onSendShutter();
    const taken = [];
    for (let i = 0; i < shots; i++) {
      for (let c = 3; c >= 1; c--) { setCount(c); await wait(1000); }
      setCount(null); setFlash(true); await wait(120); setFlash(false);
      const img = capture();
      if (img) {
        taken.push(img); setMine([...taken]);
        if (session) supabase.from("booth_photos").insert({ room_id: session.roomId, side: session.side, idx: i, image: img });
      }
      if (i < shots - 1) await wait(900);
    }
    setPhase("done");
    shooting.current = false;
  }, [shots, capture, session, onSendShutter]);

  /* strip download — each shot is already a finished frame (both of you, if
     this is a room booth), so the strip is always a single column. */
  const downloadStrip = () => {
    const pad = 26, gap = 14, w = 300, h = Math.round(w * SHOT_H / SHOT_W);
    const W = pad * 2 + w;
    const capH = 74;
    const H = pad + shots * (h + gap) + capH;
    const cv = document.createElement("canvas"); cv.width = W * 2; cv.height = H * 2;
    const x = cv.getContext("2d"); x.scale(2, 2);
    x.fillStyle = frame.bg; x.fillRect(0, 0, W, H);
    const draw = (src, cx, cy) => new Promise((res) => {
      const img = new Image();
      img.onload = () => { x.save(); rr(x, cx, cy, w, h, 8); x.clip(); x.drawImage(img, cx, cy, w, h); x.restore(); res(); };
      img.onerror = res; img.src = src;
    });
    (async () => {
      for (let i = 0; i < shots; i++) {
        const y = pad + i * (h + gap);
        const a = mine[i];
        if (a) await draw(a, pad, y); else placeholder(x, pad, y, w, h, frame.accent);
      }
      x.fillStyle = frame.accent; x.textAlign = "center";
      x.font = "italic 600 26px Georgia, serif";
      x.fillText(cfg.caption || "us ♡", W / 2, H - capH + 34);
      if (cfg.date) { x.font = "13px Georgia, serif"; x.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), W / 2, H - capH + 56); }
      x.font = "11px Georgia, serif"; x.globalAlpha = .65; x.fillText("Heartstrings booth", W / 2, H - 10); x.globalAlpha = 1;
      const a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = `heartstrings-booth-${Date.now()}.png`; a.click();
    })();
  };

  const duoReady = !session || partnerHere;

  return (
    <div style={{ position: "relative", zIndex: 2, maxWidth: 620, margin: "0 auto", padding: "22px 18px 44px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button className="press" onClick={onExit} style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="close" size={14} color={C.inkSoft} /> exit booth
        </button>
        {session && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: partnerHere ? C.sageDeep : C.gold }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: partnerHere ? C.sage : C.gold }} />
            {!partnerHere ? `waiting… code ${session.code}` : rtcConnected ? "both in the booth · live video" : "both in the booth · connecting video…"}
          </div>
        )}
      </div>

      <div style={card({ padding: 16 })}>
        {camErr ? (
          <div style={{ textAlign: "center", padding: "34px 16px" }}>
            <Icon name="camera" size={30} color={C.roseDeep} style={{ margin: "0 auto 10px" }} />
            <p style={{ color: C.inkSoft, fontSize: 14 }}>{camErr}</p>
          </div>
        ) : (
          <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "#111", aspectRatio: "4/3", display: "flex" }}>
            {session ? (
              <>
                <Pane label="you">
                  <video ref={videoRef} autoPlay playsInline muted
                    style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", filter, opacity: ready ? 1 : 0 }} />
                </Pane>
                <div style={{ width: 2, background: "rgba(255,255,255,.35)" }} />
                <Pane label={rtcConnected ? "them · HD" : "them"}>
                  {/* real video track, once connected — hidden (not unmounted) so the
                      peer connection's ontrack handler always has somewhere to attach */}
                  <video ref={remoteVideoRef} autoPlay playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", filter, display: rtcConnected ? "block" : "none" }} />
                  {!rtcConnected && (partnerFrame ? (
                    <img src={partnerFrame} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.55)", fontSize: 12, textAlign: "center", padding: 10 }}>
                      {partnerHere ? "connecting video…" : "waiting for them to join…"}
                    </div>
                  ))}
                </Pane>
              </>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", filter, opacity: ready ? 1 : 0 }} />
            )}
            {count != null && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span key={count} className="pop" style={{ fontFamily: "'Fraunces',serif", fontSize: 110, fontWeight: 700, color: "#fff", textShadow: "0 6px 30px rgba(0,0,0,.5)" }}>{count}</span>
              </div>
            )}
            {flash && <div style={{ position: "absolute", inset: 0, background: "#fff" }} />}
            {phase === "shooting" && count == null && !flash && (
              <div style={{ position: "absolute", top: 12, left: 0, right: 0, textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 22, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>
                {mine.length < shots ? `pose ${mine.length + 1} of ${shots}!` : ""}
              </div>
            )}
          </div>
        )}

        {/* thumbnails */}
        {mine.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {Array.from({ length: shots }).map((_, i) => <Thumb key={i} src={mine[i]} accent={frame.accent} />)}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {phase !== "done" ? (
            <button className="press" disabled={!ready || phase === "shooting" || !duoReady}
              onClick={() => runSequence(true)}
              style={primary(ready && phase !== "shooting" && duoReady, { flex: 1 })}>
              <Icon name="camera" size={18} color="#fff" />
              {phase === "shooting" ? "strike a pose…" : !duoReady ? `waiting for your partner (${session.code})` : "start the countdown"}
            </button>
          ) : (
            <>
              <button className="press" onClick={downloadStrip} style={primary(true, { flex: 2 })}>
                <Icon name="download" size={18} color="#fff" /> save the strip
              </button>
              <button className="press" onClick={() => { setMine([]); setPhase("idle"); }} style={ghost({ flex: 1 })}>
                <Icon name="refresh" size={16} color={C.ink} /> retake
              </button>
            </>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button className="press" onClick={onDone} style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>back to strip design</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- shared bits ---------------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function placeholder(x, cx, cy, w, h, accent) { x.save(); rr(x, cx, cy, w, h, 8); x.fillStyle = "#ffffff88"; x.fill(); x.strokeStyle = accent; x.setLineDash([5, 5]); x.stroke(); x.restore(); }

// cover-crop `source` (a <video> or <img>/Image) into a dw×dh rect at (dx,dy),
// optionally mirrored — shared by the live camera capture and the periodic
// low-fps snapshots we broadcast to a partner.
function drawCover(ctx, source, dx, dy, dw, dh, mirror) {
  const sw0 = source.videoWidth || source.naturalWidth || source.width;
  const sh0 = source.videoHeight || source.naturalHeight || source.height;
  if (!sw0 || !sh0) return;
  const sr = sw0 / sh0, tr = dw / dh;
  let sw = sw0, sh = sh0, sx = 0, sy = 0;
  if (sr > tr) { sw = sh * tr; sx = (sw0 - sw) / 2; } else { sh = sw / tr; sy = (sh0 - sh) / 2; }
  ctx.save();
  if (mirror) { ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh); }
  else { ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh); }
  ctx.restore();
}

function Pane({ label, children }) {
  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden", background: "#1c1c1c" }}>
      {children}
      <span style={{ position: "absolute", left: 6, bottom: 6, fontSize: 10, fontWeight: 800, color: "#fff", background: "rgba(0,0,0,.45)", borderRadius: 6, padding: "2px 6px" }}>{label}</span>
    </div>
  );
}

function Thumb({ src, accent }) {
  return src
    ? <img src={src} alt="" style={{ width: 52, height: 39, objectFit: "cover", borderRadius: 6, border: `1.5px solid ${accent}` }} />
    : <div style={{ width: 52, height: 39, borderRadius: 6, border: `1.5px dashed ${C.line}`, background: "#fff" }} />;
}
function Shell({ onBack, title, sub, children }) {
  return (
    <div style={{ position: "relative", zIndex: 2, maxWidth: 480, margin: "0 auto", padding: "26px 18px 44px" }}>
      <button className="press" onClick={onBack} style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
        ← back
      </button>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 32, margin: 0, fontWeight: 600 }}>{title}</h2>
        <div style={{ fontFamily: "'Caveat',cursive", fontSize: 20, color: C.inkSoft }}>{sub}</div>
      </div>
      <div style={card({ padding: 22 })}>{children}</div>
    </div>
  );
}
function BigOption({ icon, title, sub, color, onClick, busy }) {
  return (
    <button className="press" onClick={onClick} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: "pointer", borderRadius: 18, padding: "16px", border: `2px solid ${C.line}`, background: "#fff", opacity: busy ? .6 : 1 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
        <Icon name={icon} size={26} color={color} />
      </div>
      <div>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 600, color: C.ink }}>{title}</div>
        <div style={{ fontSize: 12.5, color: C.inkSoft }}>{sub}</div>
      </div>
      <div style={{ marginLeft: "auto" }}><Icon name="arrow" size={18} color={color} /></div>
    </button>
  );
}
function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Label style={{ marginBottom: 8 }}>{label}</Label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
function Pick({ active, onClick, label }) {
  return (
    <button className="press" onClick={onClick} style={{ border: `1.5px solid ${active ? C.sage : C.line}`, background: active ? C.sage : "#fff", color: active ? "#fff" : C.inkSoft, borderRadius: 12, padding: "9px 14px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>{label}</button>
  );
}
