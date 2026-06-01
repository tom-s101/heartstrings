import { useState } from "react";
import { C, Icon, Mark, card, primary, Label, Input, Hint } from "../ui";

const HIM_ICONS = ["wave","leaf","bolt","spark","moon","flame","tram","trophy"];
const HER_ICONS = ["lotus","flower","heart","rose","gift","twoHearts","star","palette"];

export function Join({ onEnter }) {
  const [room, setRoom] = useState("");
  const [code, setCode] = useState("");
  const [side, setSide] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [himIcon, setHimIcon] = useState("wave");
  const [herIcon, setHerIcon] = useState("lotus");
  const can = room.trim().length > 1 && code.trim().length >= 4 && side && name.trim().length > 0;

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "34px 20px", position: "relative", zIndex: 2 }}>
      <div className="fin" style={{ textAlign: "center" }}>
        <div style={{ display: "inline-flex", marginBottom: 12 }}><Mark size={26} /></div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 46, lineHeight: 1, margin: 0, fontWeight: 600, letterSpacing: "-1px" }}>Find your room</h1>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 23, color: C.inkSoft, margin: "8px 0 0" }}>agree on a name and a secret code</p>
      </div>

      <div className="fin d1" style={card({ width: "100%", maxWidth: 430, marginTop: 24, padding: "28px 26px" })}>
        <Label>your name</Label>
        <Input value={name} onChange={setName} placeholder="e.g. Matheson or Lyka" />
        <Label style={{ marginTop: 16 }}>room name</Label>
        <Input value={room} onChange={setRoom} placeholder="e.g. our-little-corner" />
        <Label style={{ marginTop: 16 }}>secret code</Label>
        <div style={{ position: "relative" }}>
          <Input value={code} onChange={setCode} placeholder="a private word only you two know" />
          <span style={{ position: "absolute", right: 12, top: 18 }}><Icon name="lock" size={18} color={C.inkSoft} /></span>
        </div>
        <Hint style={{ marginTop: 7 }}>The first of you to use a name sets its code; the other must match it — so no stranger can wander in.</Hint>

        <Label style={{ marginTop: 20 }}>pick your side</Label>
        <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
          <SideCard active={side === "him"} onClick={() => setSide("him")} icon={himIcon} color={C.blue} deep={C.blueDeep} light={C.blueLight} label="His side" sub="the deep blue"
            icons={HIM_ICONS} selectedIcon={himIcon} onIconChange={setHimIcon} />
          <SideCard active={side === "her"} onClick={() => setSide("her")} icon={herIcon} color={C.rose} deep={C.roseDeep} light={C.roseLight} label="Her side" sub="the soft lotus"
            icons={HER_ICONS} selectedIcon={herIcon} onIconChange={setHerIcon} />
        </div>

        <button className="press" disabled={!can || busy} onClick={() => { setBusy(true); onEnter({ room: room.trim().toLowerCase(), code: code.trim(), side, name: name.trim(), icon: side === "him" ? himIcon : herIcon }); }} style={primary(can, { marginTop: 24, width: "100%", opacity: busy ? .7 : 1 })}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{busy ? "stepping in…" : "step inside together"} <Icon name="arrow" size={18} color={can ? "#fff" : C.inkSoft} /></span>
        </button>
      </div>
    </div>
  );
}

function SideCard({ active, onClick, icon, color, deep, light, label, sub, icons, selectedIcon, onIconChange }) {
  return (
    <div style={{ flex: 1 }}>
      <button onClick={onClick} className="press" style={{ width: "100%", borderRadius: 20, padding: "16px 10px 12px", cursor: "pointer", border: `2px solid ${active ? color : C.line}`, background: active ? light : "var(--hs-paper)", transform: active ? "translateY(-2px)" : "none", boxShadow: active ? `0 14px 26px -16px ${color}` : "0 2px 8px -5px rgba(0,0,0,.2)" }}>
        <div style={{ width: 52, height: 52, margin: "0 auto", borderRadius: "50%", background: active ? "#fff" : light, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 6px 14px -8px ${color}` : "none" }}>
          <Icon name={icon} size={30} color={color} />
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: deep, marginTop: 8, fontWeight: 600 }}>{label}</div>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color }}>{sub}</div>
      </button>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
        {icons.map((ic) => (
          <button key={ic} className="press" onClick={(e) => { e.stopPropagation(); onIconChange(ic); }}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${selectedIcon === ic ? color : C.line}`, background: selectedIcon === ic ? `${color}22` : "var(--hs-ghost-bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={ic} size={15} color={selectedIcon === ic ? color : C.inkSoft} />
          </button>
        ))}
      </div>
    </div>
  );
}
