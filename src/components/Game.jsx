import { useState, useEffect, useRef } from "react";
import { useRoom } from "../hooks/useRoom";
import { signOut } from "../lib/auth";
import { C, Icon, Mark } from "../ui";

const MODES = {
  chill:      { icon: "leaf",   label: "Chill Mode",      desc: "No pressure — just enjoy each other ✶" },
  structured: { icon: "timer",  label: "Structured Mode", desc: "Timed answers to keep things moving ⏱" },
  gamenight:  { icon: "trophy", label: "Game Night",      desc: "Scoring is on — may the best one win 🏆" },
};
import { Questions } from "./Questions";
import { Drawing } from "./Drawing";
import { Creative } from "./Creative";
import { Gallery } from "./Gallery";

const ONLINE_WINDOW = 12000;

export function Game({ session, user, onLeave }) {
  const room = useRoom(session.room, session.code, session.side, user, session.name);
  const { state, status, error } = room;
  const [tab, setTab] = useState("questions");
  const [toast, setToast] = useState(null);
  const [exitModal, setExitModal] = useState(null); // "leave" | "signout" | null
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const mine = session.side;
  const meColor = mine === "him" ? C.blue : C.rose;
  const other = mine === "him" ? "her" : "him";
  const partnerOnline = (state.players?.[other]?.lastSeen || 0) > Date.now() - ONLINE_WINDOW;

  const activateMode = (id) => {
    room.commit((s) => { s.feel = id; return s; });
    clearTimeout(toastTimer.current);
    setToast(id);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  if (error) {
    const m = /code/i.test(error) ? { t: "That code doesn't match", s: "Double-check the secret code with your partner — it has to be identical on both sides." }
      : /full/i.test(error) ? { t: "This room is full", s: "A Heartstrings room holds up to four. Try a different room name, or ask whoever's in to make space." }
      : { t: "Couldn't join", s: error };
    return (
      <div style={{ position: "relative", zIndex: 2, maxWidth: 440, margin: "80px auto", textAlign: "center", padding: 24 }}>
        <div style={{ display: "inline-flex", marginBottom: 10 }}><Icon name="lock" size={34} color={C.roseDeep} /></div>
        <h2 style={{ fontFamily: "'Fraunces',serif", margin: "0 0 6px" }}>{m.t}</h2>
        <p style={{ color: C.inkSoft }}>{m.s}</p>
        <button className="press" onClick={onLeave} style={{ marginTop: 16, border: `1.5px solid ${C.sage}`, background: "#fff", borderRadius: 14, padding: "11px 20px", fontWeight: 800, cursor: "pointer" }}>back</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100%", position: "relative", zIndex: 2 }}>
      {status === "reconnecting" && (
        <div style={{ background: C.gold, color: "#fff", textAlign: "center", padding: "7px 12px", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Icon name="refresh" size={15} color="#fff" /> reconnecting…
        </div>
      )}
      {toast && (
        <div key={toast} style={{ background: "rgba(255,255,255,.96)", borderBottom: `3px solid ${meColor}`, textAlign: "center", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, animation: "fin .35s ease both", boxShadow: "0 4px 18px -8px rgba(0,0,0,.18)" }}>
          <Icon name={MODES[toast].icon} size={20} color={meColor} />
          <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5, color: C.ink }}>{MODES[toast].label}</span>
          <span style={{ color: C.inkSoft, fontSize: 14 }}>— {MODES[toast].desc}</span>
        </div>
      )}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Mark size={18} />
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, lineHeight: 1 }}>{session.room}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
              <Icon name={mine === "him" ? "wave" : "lotus"} size={14} color={meColor} />
              <span style={{ fontFamily: "'Caveat', cursive", color: C.inkSoft, fontSize: 15 }}>{session.name} · the {mine === "him" ? "blue" : "lotus"} one</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {state.feel === "gamenight" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.7)", borderRadius: 999, padding: "5px 11px", border: `1px solid ${C.line}` }}>
              <Icon name="wave" size={14} color={C.blue} /><b style={{ fontSize: 13, color: C.blueDeep }}>{state.score?.him || 0}</b>
              <span style={{ color: C.inkSoft }}>–</span>
              <b style={{ fontSize: 13, color: C.roseDeep }}>{state.score?.her || 0}</b><Icon name="lotus" size={14} color={C.rose} />
            </div>
          )}
          <Presence partnerOnline={partnerOnline} status={status} />
          <div style={{ display: "flex", gap: 6 }}>
            {[["chill", "leaf"], ["structured", "timer"], ["gamenight", "trophy"]].map(([id, ic]) => (
              <IconChip key={id} active={state.feel === id} onClick={() => activateMode(id)} color={meColor} icon={ic} />
            ))}
          </div>
          <ExitMenu onLeave={() => setExitModal("leave")} onSignOut={() => setExitModal("signout")} />
        </div>
      </header>

      <nav style={{ display: "flex", gap: 8, padding: "0 18px", maxWidth: 820, margin: "0 auto", width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <Tab active={tab === "questions"} onClick={() => setTab("questions")} icon="chat" label="Questions" />
        <Tab active={tab === "drawing"} onClick={() => setTab("drawing")} icon="brush" label="Drawing" />
        <Tab active={tab === "creative"} onClick={() => setTab("creative")} icon="pen" label="Creative" />
        <Tab active={tab === "gallery"} onClick={() => setTab("gallery")} icon="frame" label="Gallery" />
      </nav>

      {/* Exit confirmation modal */}
      {exitModal && (
        <div onClick={() => setExitModal(null)} style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(60,50,40,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="pop" onClick={(e) => e.stopPropagation()} style={{ background: C.cream, borderRadius: 24, padding: "28px 26px", maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 32px 60px -20px rgba(0,0,0,.35)" }}>
            <div style={{ display: "inline-flex", marginBottom: 10 }}>
              <Icon name={exitModal === "leave" ? "close" : "arrow"} size={32} color={C.roseDeep} style={exitModal === "signout" ? { transform: "rotate(180deg)" } : {}} />
            </div>
            <h2 style={{ fontFamily: "'Fraunces',serif", margin: "0 0 8px", fontSize: 24 }}>
              {exitModal === "leave" ? "Leave the room?" : "Sign out?"}
            </h2>
            <p style={{ color: C.inkSoft, fontSize: 14, margin: "0 0 22px", lineHeight: 1.5 }}>
              {exitModal === "leave"
                ? "You can always come back — just use the same room name and code."
                : "You'll be signed out completely. Your room and progress are saved."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="press" onClick={() => setExitModal(null)} style={{ flex: 1, border: `1.5px solid ${C.line}`, background: "#fff", borderRadius: 14, padding: "13px", fontWeight: 800, fontSize: 14, cursor: "pointer", color: C.ink }}>
                Stay
              </button>
              <button className="press" onClick={() => { setExitModal(null); exitModal === "leave" ? onLeave() : signOut(); }}
                style={{ flex: 1, border: "none", background: `linear-gradient(90deg, ${C.roseDeep}, ${C.blueDeep})`, borderRadius: 14, padding: "13px", fontWeight: 800, fontSize: 14, cursor: "pointer", color: "#fff" }}>
                {exitModal === "leave" ? "Yes, leave" : "Yes, sign out"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "18px 18px 48px", width: "100%" }}>
        {tab === "questions" && <Questions room={room} mine={mine} names={state.players} />}
        {tab === "drawing" && <Drawing room={room} mine={mine} partnerOnline={partnerOnline} />}
        {tab === "creative" && <Creative room={room} mine={mine} />}
        {tab === "gallery" && <Gallery roomId={room.roomId} />}
      </main>
    </div>
  );
}

function Presence({ partnerOnline, status }) {
  const dot = (c, lit) => <span style={{ width: 9, height: 9, borderRadius: 999, background: lit ? c : "rgba(0,0,0,.15)", boxShadow: lit ? `0 0 0 3px ${c}33` : "none", display: "inline-block" }} />;
  const live = status === "live";
  const txt = status === "connecting" ? "connecting…" : status === "reconnecting" ? "reconnecting…" : partnerOnline ? "both here" : "waiting…";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.7)", borderRadius: 999, padding: "6px 11px", border: `1px solid ${C.line}` }}>
      {dot(C.blue, live)}{dot(C.rose, live && partnerOnline)}
      <span style={{ fontSize: 11.5, fontWeight: 800, color: !live ? C.gold : partnerOnline ? C.sageDeep : C.inkSoft }}>{txt}</span>
    </div>
  );
}
function Tab({ active, onClick, icon, label }) {
  return (
    <button className="press" onClick={onClick} style={{ border: "none", cursor: "pointer", padding: "11px 13px", borderRadius: "16px 16px 0 0", fontWeight: 800, fontSize: 14, color: active ? C.ink : C.inkSoft, background: active ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.4)", boxShadow: active ? "0 -3px 12px -7px rgba(0,0,0,.3)" : "none", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      <Icon name={icon} size={17} color={active ? C.ink : C.inkSoft} /><span className="tab-label">{label}</span>
    </button>
  );
}
function IconChip({ active, onClick, color, icon }) {
  return (
    <button className="press" onClick={onClick} style={{ width: 38, height: 38, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${active ? color : C.line}`, background: active ? color : "rgba(255,255,255,.7)" }}>
      <Icon name={icon} size={19} color={active ? "#fff" : C.inkSoft} />
    </button>
  );
}
function ExitMenu({ onLeave, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler); document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="press" onClick={() => setOpen((v) => !v)} style={{ width: 38, height: 38, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${C.line}`, background: "rgba(255,255,255,.7)" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 3.5, alignItems: "center", justifyContent: "center" }}>
          {[0,1,2].map((i) => <span key={i} style={{ width: 4, height: 4, borderRadius: 999, background: C.inkSoft, display: "block" }} />)}
        </span>
      </button>
      {open && (
        <div className="pop" style={{ position: "absolute", right: 0, top: 44, background: "#fff", borderRadius: 16, boxShadow: "0 16px 40px -12px rgba(0,0,0,.25)", border: `1px solid ${C.line}`, overflow: "hidden", zIndex: 10, minWidth: 160 }}>
          <button className="press" onClick={() => { setOpen(false); onLeave(); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 700, color: C.ink, borderBottom: `1px solid ${C.line}` }}>
            <Icon name="close" size={16} color={C.inkSoft} /> Leave room
          </button>
          <button className="press" onClick={() => { setOpen(false); onSignOut(); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 700, color: C.roseDeep }}>
            <Icon name="arrow" size={16} color={C.roseDeep} style={{ transform: "rotate(180deg)" }} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
