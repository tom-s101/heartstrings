import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { C, Icon, card, primary, ghost, Label, Input, Hint } from "../ui";

/* ============================================================================
   Photo Booth — two ways in:
   • Solo (1 device): customize → countdown shots → strip → save. All local.
   • Room (long distance): one partner creates a room (auto 6-letter code),
     the other joins with the code. The countdown is synced, each device
     captures its own camera, photos upload to booth_photos, and BOTH devices
     compose a combined his+hers strip.
   Reuses the existing room system: the code IS the room name (prefixed), so
   join_room, membership, and RLS all apply unchanged.
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

const genCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");

export function PhotoBooth({ user, onBack }) {
  const [stage, setStage] = useState("mode"); // mode | joincode | setup | booth
  const [session, setSession] = useState(null); // null (solo) | { code, roomId, side }
  const [cfg, setCfg] = useState({ layout: "strip3", frame: "rose", filter: "none", caption: "us ♡", date: true });
  const [joinInput, setJoinInput] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const enterRoom = async (code, side) => {
    setBusy(true); setErr(null);
    const name = `booth-${code.toLowerCase()}`;
    const { data: rid, error } = await supabase.rpc("join_room", { p_name: name, p_code: code, p_side: side });
    setBusy(false);
    if (error) { setErr(/full/i.test(error.message) ? "That booth is full." : "Couldn't find a booth with that code — double-check it."); return; }
    setSession({ code, roomId: rid, side });
    setStage("setup");
  };

  if (stage === "mode") return (
    <Shell onBack={onBack} title="Photo Booth" sub="how do you want to shoot?">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <BigOption icon="camera" title="One device" sub="you're together (or flying solo) — shoot on this screen"
          color={C.gold} onClick={() => { setSession(null); setStage("setup"); }} />
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
    <Setup cfg={cfg} setCfg={setCfg} session={session}
      onBack={() => setStage("mode")} onStart={() => setStage("booth")} />
  );

  return <Booth cfg={cfg} session={session} user={user} onDone={() => setStage("setup")} onExit={onBack} />;
}

/* ---------------- setup / customization ---------------- */
function Setup({ cfg, setCfg, session, onBack, onStart }) {
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const frame = FRAMES.find((f) => f.id === cfg.frame);
  return (
    <Shell onBack={onBack} title="Design your strip" sub={session ? "you're in a shared booth" : "make it yours"}>
      {session && (
        <div style={{ textAlign: "center", background: C.blueLight, borderRadius: 14, padding: "12px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.blueDeep, letterSpacing: 1 }}>BOOTH CODE — SEND THIS TO THEM</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 32, fontWeight: 700, letterSpacing: 6, color: C.blueDeep }}>{session.code}</div>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: C.inkSoft }}>they tap “Join with a code” and enter it</div>
        </div>
      )}
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

/* ---------------- the booth itself ---------------- */
function Booth({ cfg, session, user, onDone, onExit }) {
  const shots = LAYOUTS.find((l) => l.id === cfg.layout).shots;
  const filter = FILTERS.find((f) => f.id === cfg.filter).css;
  const frame = FRAMES.find((f) => f.id === cfg.frame);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [camErr, setCamErr] = useState(null);
  const [count, setCount] = useState(null);   // 3..2..1 overlay
  const [flash, setFlash] = useState(false);
  const [mine, setMine] = useState([]);       // my captured shots (data urls)
  const [partner, setPartner] = useState([]); // partner shots (room mode)
  const [partnerHere, setPartnerHere] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | shooting | done
  const channelRef = useRef(null);
  const shooting = useRef(false);

  /* camera */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } }, audio: false });
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

  /* room channel: presence + shutter sync + partner photos */
  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel(`booth:${session.roomId}`, {
      config: { presence: { key: session.side }, broadcast: { self: false } },
    });
    channelRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const sides = new Set(Object.values(ch.presenceState()).flat().map((m) => m.side));
      setPartnerHere(sides.has(session.side === "him" ? "her" : "him"));
    });
    ch.on("broadcast", { event: "shutter" }, () => { if (!shooting.current) runSequence(false); });
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "booth_photos", filter: `room_id=eq.${session.roomId}` },
      ({ new: row }) => { if (row.side !== session.side) setPartner((p) => { const n = [...p]; n[row.idx] = row.image; return n; }); });
    ch.subscribe(async (st) => { if (st === "SUBSCRIBED") await ch.track({ side: session.side }); });
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [session?.roomId]);

  const capture = useCallback(() => {
    const v = videoRef.current; if (!v) return null;
    const cv = document.createElement("canvas"); cv.width = SHOT_W; cv.height = SHOT_H;
    const x = cv.getContext("2d");
    // mirror + cover-crop
    const vr = v.videoWidth / v.videoHeight, tr = SHOT_W / SHOT_H;
    let sw = v.videoWidth, sh = v.videoHeight, sx = 0, sy = 0;
    if (vr > tr) { sw = sh * tr; sx = (v.videoWidth - sw) / 2; } else { sh = sw / tr; sy = (v.videoHeight - sh) / 2; }
    x.translate(SHOT_W, 0); x.scale(-1, 1);
    if (filter !== "none") x.filter = filter.replace("blur(0.4px)", ""); // canvas blur is heavy; skip
    x.drawImage(v, sx, sy, sw, sh, 0, 0, SHOT_W, SHOT_H);
    return cv.toDataURL("image/jpeg", 0.72);
  }, [filter]);

  const runSequence = useCallback(async (broadcast) => {
    if (shooting.current) return;
    shooting.current = true;
    setPhase("shooting"); setMine([]); if (session) setPartner([]);
    if (broadcast && session) channelRef.current?.send({ type: "broadcast", event: "shutter", payload: {} });
    const taken = [];
    for (let i = 0; i < shots; i++) {
      for (let c = 3; c >= 1; c--) { setCount(c); await wait(1000); }
      setCount(null); setFlash(true); await wait(120); setFlash(false);
      const img = capture();
      if (img) {
        taken.push(img); setMine([...taken]);
        if (session) {
          supabase.from("booth_photos").insert({ room_id: session.roomId, side: session.side, idx: i, image: img });
        }
      }
      if (i < shots - 1) await wait(900);
    }
    setPhase("done");
    shooting.current = false;
  }, [shots, capture, session]);

  /* strip download */
  const downloadStrip = () => {
    const isDuo = !!session;
    const pad = 26, gap = 14, w = 300, h = Math.round(w * SHOT_H / SHOT_W);
    const cols = isDuo ? 2 : 1;
    const W = pad * 2 + cols * w + (cols - 1) * gap;
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
        const a = isDuo ? (mine.length && session.side === "him" ? mine[i] : partner[i]) : mine[i];
        const b = isDuo ? (session.side === "him" ? partner[i] : mine[i]) : null;
        if (isDuo) {
          if (a) await draw(a, pad, y); else placeholder(x, pad, y, w, h, frame.accent);
          if (b) await draw(b, pad + w + gap, y); else placeholder(x, pad + w + gap, y, w, h, frame.accent);
        } else if (a) await draw(a, pad, y);
      }
      x.fillStyle = frame.accent; x.textAlign = "center";
      x.font = "italic 600 26px Georgia, serif";
      x.fillText(cfg.caption || "us ♡", W / 2, H - capH + 34);
      if (cfg.date) { x.font = "13px Georgia, serif"; x.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), W / 2, H - capH + 56); }
      x.font = "11px Georgia, serif"; x.globalAlpha = .65; x.fillText("Heartstrings booth", W / 2, H - 10); x.globalAlpha = 1;
      const a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = `heartstrings-booth-${Date.now()}.png`; a.click();
    })();
  };

  const other = session?.side === "him" ? "her" : "him";
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
            {partnerHere ? "both in the booth" : `waiting… code ${session.code}`}
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
          <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "#111", aspectRatio: "4/3" }}>
            <video ref={videoRef} autoPlay playsInline muted
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", filter, opacity: ready ? 1 : 0 }} />
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
        {(mine.length > 0 || partner.some(Boolean)) && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {Array.from({ length: shots }).map((_, i) => (
              <div key={i} style={{ display: "flex", gap: 3 }}>
                <Thumb src={mine[i]} accent={frame.accent} />
                {session && <Thumb src={partner[i]} accent={frame.accent} dashed />}
              </div>
            ))}
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
              <button className="press" onClick={() => { setMine([]); setPartner([]); setPhase("idle"); }} style={ghost({ flex: 1 })}>
                <Icon name="refresh" size={16} color={C.ink} /> retake
              </button>
            </>
          )}
        </div>
        {session && phase === "done" && partner.filter(Boolean).length < shots && (
          <Hint style={{ textAlign: "center", marginTop: 10 }}>waiting for {other === "him" ? "his" : "her"} photos to arrive — the strip will include whatever's here when you save.</Hint>
        )}
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

function Thumb({ src, accent, dashed }) {
  return src
    ? <img src={src} alt="" style={{ width: 52, height: 39, objectFit: "cover", borderRadius: 6, border: `1.5px solid ${accent}` }} />
    : <div style={{ width: 52, height: 39, borderRadius: 6, border: `1.5px ${dashed ? "dashed" : "solid"} ${C.line}`, background: "#fff" }} />;
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
