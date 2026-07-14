import { useState } from "react";
import { C, Icon, Mark, card, primary, Label, Input, Hint, useIsMobile } from "../ui";

/* ============================================================================
   Join — two flavors:
   • mode="distance": the OG flow — room name + secret code + pick your side.
   • mode="together": one shared device, right now, no partner to match codes
     with — so there's nothing to type. The room + code are derived silently
     from your account so your history, gallery, and no-repeat questions still
     persist night to night. You just tell us who's holding the phone.
   ============================================================================ */

export function Join({ onEnter, mode = "distance", user, onBack }) {
  const isMobile = useIsMobile();
  const together = mode === "together";
  const [room, setRoom] = useState("");
  const [code, setCode] = useState("");
  const [side, setSide] = useState(together ? "him" : null);
  const [nameHim, setNameHim] = useState("");
  const [nameHer, setNameHer] = useState("");
  const [myName, setMyName] = useState("");
  const can = together
    ? !!(nameHim.trim() && nameHer.trim())
    : room.trim().length > 1 && code.trim().length >= 4 && side && myName.trim().length > 0;

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "34px 20px", position: "relative", zIndex: 2 }}>
      <div className="fin" style={{ textAlign: "center" }}>
        <div style={{ display: "inline-flex", marginBottom: 12 }}><Mark size={26} /></div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 46, lineHeight: 1, margin: 0, fontWeight: 600, letterSpacing: "-1px" }}>
          {together ? "Your cozy corner" : "Find your room"}
        </h1>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 23, color: C.inkSoft, margin: "8px 0 0" }}>
          {together ? "one device, two hearts — who's playing?" : "agree on a name and a secret code"}
        </p>
      </div>

      <div className="fin d1" style={card({ width: "100%", maxWidth: 430, marginTop: 24, padding: "28px 26px" })}>
        {onBack && (
          <button className="press" onClick={onBack} style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 13, cursor: "pointer", marginBottom: 10, padding: 0 }}>← back</button>
        )}
        {!together && (
          <>
            <Label>room name</Label>
            <Input value={room} onChange={setRoom} placeholder="e.g. our-little-corner" />
            <Label style={{ marginTop: 16 }}>secret code</Label>
            <div style={{ position: "relative" }}>
              <Input value={code} onChange={setCode} placeholder="a private word only you two know" />
              <span style={{ position: "absolute", right: 12, top: 18 }}><Icon name="lock" size={18} color={C.inkSoft} /></span>
            </div>
            <Hint style={{ marginTop: 7 }}>
              The first of you to use a name sets its code; the other must match it — so no stranger can wander in.
            </Hint>
          </>
        )}

        {together ? (
          <>
            <Label style={{ marginTop: 20 }}>who's here tonight</Label>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, marginTop: 8 }}>
              <NameField icon="wave" color={C.blue} value={nameHim} onChange={setNameHim} placeholder="first name" />
              <NameField icon="lotus" color={C.rose} value={nameHer} onChange={setNameHer} placeholder="first name" />
            </div>
            <Hint style={{ marginTop: 7 }}>Blue answers go to the first name, rose to the second — you'll both tap on this screen. Same corner every date night, so your gallery and question history stick around.</Hint>
          </>
        ) : (
          <>
            <Label style={{ marginTop: 20 }}>pick your side</Label>
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              <SideCard active={side === "him"} onClick={() => setSide("him")} icon="wave" color={C.blue} deep={C.blueDeep} light={C.blueLight} label="His side" sub="the deep blue" />
              <SideCard active={side === "her"} onClick={() => setSide("her")} icon="lotus" color={C.rose} deep={C.roseDeep} light={C.roseLight} label="Her side" sub="the soft rose" />
            </div>
            <Label style={{ marginTop: 16 }}>your first name</Label>
            <NameField icon={side === "her" ? "lotus" : "wave"} color={side === "her" ? C.rose : C.blue} value={myName} onChange={setMyName} placeholder="what should we call you?" />
            <Hint style={{ marginTop: 7 }}>Shows up for your partner too, so the game says "Sam's turn" instead of just "his"/"her".</Hint>
          </>
        )}

        <button className="press" disabled={!can}
          onClick={() => onEnter(together ? {
            // Solo device, no partner to match a code with — derive a private,
            // stable room from this account so it's the same cozy corner every
            // date night (history/gallery persist) without anyone typing anything.
            room: `together-${user?.id || "local"}`, code: (user?.id || "local-together").replace(/-/g, "").slice(0, 24) || "together",
            side: "him", local: true, names: { him: nameHim.trim(), her: nameHer.trim() },
          } : {
            room: room.trim().toLowerCase(), code: code.trim(), side, local: false, names: null, myName: myName.trim(),
          })}
          style={primary(can, { marginTop: 24, width: "100%" })}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>step inside together <Icon name="arrow" size={18} color={can ? "#fff" : C.inkSoft} /></span>
        </button>
      </div>
    </div>
  );
}

function NameField({ icon, color, value, onChange, placeholder }) {
  return (
    <div style={{ flex: 1, position: "relative" }}>
      <span style={{ position: "absolute", left: 11, top: 17 }}><Icon name={icon} size={17} color={color} /></span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "12px 12px 12px 34px", borderRadius: 13, border: `1.5px solid ${color}55`, fontFamily: "inherit", fontSize: 14.5, color: C.ink, background: C.paper, outline: "none" }} />
    </div>
  );
}

function SideCard({ active, onClick, icon, color, deep, light, label, sub }) {
  return (
    <button onClick={onClick} className="press" style={{ flex: 1, borderRadius: 20, padding: "20px 10px 16px", cursor: "pointer", border: `2px solid ${active ? color : C.line}`, background: active ? light : C.paper, transform: active ? "translateY(-2px)" : "none", boxShadow: active ? `0 14px 26px -16px ${color}` : "0 2px 8px -5px rgba(0,0,0,.2)" }}>
      <div style={{ width: 56, height: 56, margin: "0 auto", borderRadius: "50%", background: active ? "#fff" : light, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 6px 14px -8px ${color}` : "none" }}>
        <Icon name={icon} size={32} color={color} />
      </div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: deep, marginTop: 10, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color }}>{sub}</div>
    </button>
  );
}
