import { useState } from "react";
import { signIn, signUp, sendMagicLink } from "../lib/auth";
import { C, Icon, Mark, card, primary, Label, Input, Hint } from "../ui";

export function Auth() {
  const [tab, setTab] = useState("in"); // in | up | link
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true); setMsg(null);
    try {
      if (tab === "link") { const { error } = await sendMagicLink(email); setMsg(error ? error.message : "Check your email for a magic link ✶"); }
      else if (tab === "up") { const { error } = await signUp(email, pass, name); setMsg(error ? error.message : "Welcome! Check your email to confirm, then sign in."); }
      else { const { error } = await signIn(email, pass); if (error) setMsg(error.message); }
    } catch (e) { setMsg(String(e)); }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "34px 20px", position: "relative", zIndex: 2 }}>
      <div className="fin" style={{ textAlign: "center" }}>
        <div style={{ display: "inline-flex", marginBottom: 12 }}><Mark size={26} /></div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 50, lineHeight: 1, margin: 0, fontWeight: 600, letterSpacing: "-1px" }}>Heartstrings</h1>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 24, color: C.inkSoft, margin: "8px 0 0" }}>just for the two of you</p>
      </div>
      <div className="fin d1" style={card({ width: "100%", maxWidth: 400, marginTop: 24, padding: "26px 24px" })}>
        <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,.5)", borderRadius: 14, padding: 5, marginBottom: 18 }}>
          {[["in", "Sign in"], ["up", "Sign up"], ["link", "Magic link"]].map(([id, l]) => (
            <button key={id} className="press" onClick={() => { setTab(id); setMsg(null); setPass(""); }} style={{ flex: 1, border: "none", borderRadius: 10, padding: "9px 4px", cursor: "pointer", background: tab === id ? "#fff" : "transparent", color: tab === id ? C.ink : C.inkSoft, fontWeight: 800, fontSize: 13 }}>{l}</button>
          ))}
        </div>
        {tab === "up" && (<><Label>your name</Label><Input value={name} onChange={setName} placeholder="what should we call you?" /></>)}
        <Label style={{ marginTop: tab === "up" ? 14 : 0 }}>email</Label>
        <Input value={email} onChange={setEmail} placeholder="you@email.com" type="email" />
        {tab !== "link" && (<><Label style={{ marginTop: 14 }}>password</Label><Input value={pass} onChange={setPass} placeholder="••••••••" type="password" /></>)}
        <button className="press" onClick={go} disabled={busy} style={primary(true, { width: "100%", marginTop: 20, opacity: busy ? .6 : 1 })}>
          <Icon name={tab === "link" ? "mail" : "heart"} size={18} color="#fff" />
          <span style={{ marginLeft: 6 }}>{busy ? "…" : tab === "link" ? "send magic link" : tab === "up" ? "create account" : "sign in"}</span>
        </button>
        {msg && <Hint style={{ marginTop: 12, textAlign: "center", color: C.roseDeep }}>{msg}</Hint>}
      </div>
    </div>
  );
}
