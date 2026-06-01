import { useState, useRef, useEffect } from "react";
import { useTheme, useC, LIGHT, THEMES } from "./lib/theme.jsx";
export { useTheme, useC } from "./lib/theme.jsx";

/* ============================================================================
   ui.jsx — palette, custom icon set, and shared styling primitives.
   C uses CSS custom properties so ALL 4 themes apply everywhere.
   For canvas ops (fillStyle etc.) call useC() which returns real hex values.
   Icon uses style props (not spread attrs) so CSS vars resolve in SVG.
   ============================================================================ */

export const C = {
  cream:"var(--hs-cream)", paper:"var(--hs-paper)", ink:"var(--hs-ink)", inkSoft:"var(--hs-inkSoft)",
  sage:"var(--hs-sage)", sageDeep:"var(--hs-sageDeep)", gold:"var(--hs-gold)",
  blue:"var(--hs-blue)", blueDeep:"var(--hs-blueDeep)", blueLight:"var(--hs-blueLight)",
  rose:"var(--hs-rose)", roseDeep:"var(--hs-roseDeep)", roseLight:"var(--hs-roseLight)",
  line:"var(--hs-line)",
};

export function Icon({ name, size = 24, color = "var(--hs-ink)", fill = "none", sw = 1.7, style }) {
  const s = { width: size, height: size, display: "block", flex: "0 0 auto", ...style };
  // Use style prop (not spread attrs) so CSS custom-property colors resolve inside SVG
  const P = { style: { fill, stroke: color, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round" } };
  const F = { style: { fill: color, stroke: "none" } }; // filled accent shapes
  const svg = (ch) => <svg viewBox="0 0 24 24" style={s}>{ch}</svg>;
  switch (name) {
    case "heart": return svg(<path d="M12 21.5C6.5 17 1 13 1 8.5 1 5.4 3.4 3 6.5 3c1.7 0 3.4.8 4.5 2.1C12.1 3.8 13.8 3 15.5 3c3.1 0 5.5 2.4 5.5 5.5 0 4.5-5.5 8.5-11 13z" {...F} />);
    case "wave": return svg(<><path d="M2.5 13q3.2-3.2 6.3 0t6.3 0 6.3 0" {...P} /><path d="M2.5 8.5q3.2-3.2 6.3 0t6.3 0 6.3 0" {...P} /></>);
    case "lotus": { const petal = "M12 15.5C9.6 12 9.6 8 12 5.4 14.4 8 14.4 12 12 15.5Z"; return svg(<>{[-66,-33,0,33,66].map((a) => <path key={a} d={petal} transform={`rotate(${a} 12 15.5)`} {...P} />)}<path d="M4.8 15.8C8.4 19 15.6 19 19.2 15.8" {...P} /></>); }
    case "arrow": return svg(<><path d="M4 12h15" {...P} /><path d="M13 6l6 6-6 6" {...P} /></>);
    case "leaf": return svg(<><path d="M5 18C5 9.5 11 5.5 19 5.5 19 14 13.5 18.5 5 18Z" {...P} /><path d="M7.5 15.5C11 12 14.5 9.5 17.5 8" {...P} /></>);
    case "clock": return svg(<><circle cx="12" cy="12" r="8.2" {...P} /><path d="M12 7.6V12l3.2 2" {...P} /></>);
    case "trophy": return svg(<><path d="M8 4.5h8V9a4 4 0 0 1-8 0V4.5Z" {...P} /><path d="M8 6H5.5A2.5 2.5 0 0 0 8 8.5" {...P} /><path d="M16 6h2.5A2.5 2.5 0 0 1 16 8.5" {...P} /><path d="M12 13v3.5" {...P} /><path d="M9 19.5h6M10 19.5l.4-3h3.2l.4 3" {...P} /></>);
    case "chat": return svg(<><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-7l-4 3v-3H6a2 2 0 0 1-2-2Z" {...P} /><path d="M12 13c-1.5-1-2.8-2-2.8-3.4a1.4 1.4 0 0 1 2.8-.5 1.4 1.4 0 0 1 2.8.5C14.8 11 13.5 12 12 13Z" {...F} /></>);
    case "brush": return svg(<><path d="M5 19l3-.8L18.6 7.6a1.5 1.5 0 0 0 0-2.1l-1.1-1.1a1.5 1.5 0 0 0-2.1 0L4.8 15 4 18l1 1Z" {...P} /><path d="M14.5 6.4l3.1 3.1" {...P} /></>);
    case "frame": return svg(<><rect x="4" y="5" width="16" height="14" rx="2" {...P} /><path d="M7 15.5l3.2-3.2 2.3 2.3 3-3.6 2.5 3" {...P} /><circle cx="9" cy="9" r="1.1" {...P} /></>);
    case "moon": return svg(<path d="M16.5 3.2a7.5 7.5 0 1 0 4.6 11.4A6.2 6.2 0 0 1 16.5 3.2Z" {...P} />);
    case "spark": return svg(<><path d="M12 4l1.6 4.9 4.9 1.6-4.9 1.6L12 17l-1.6-4.9L5.5 10.5l4.9-1.6Z" {...P} /><path d="M18.5 4.5l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6Z" {...F} /></>);
    case "flame": return svg(<path d="M12 3.5c2.8 3.6 4.6 5.6 4.6 8.6a4.6 4.6 0 0 1-9.2 0c0-1.7.8-2.8 1.8-3.7.5 1 1.4 1.4 2 .9.6-1.3-1-2.9.8-5.8Z" {...P} />);
    case "flower": return svg(<>{[-90,-18,54,126,198].map((d) => { const a = d * Math.PI / 180; return <circle key={d} cx={12 + 4.7 * Math.cos(a)} cy={12 + 4.7 * Math.sin(a)} r="2.5" {...P} />; })}<circle cx="12" cy="12" r="1.9" {...F} /></>);
    case "dice": return svg(<><rect x="4.5" y="4.5" width="15" height="15" rx="3" {...P} /><circle cx="9" cy="9" r="1.1" {...F} /><circle cx="12" cy="12" r="1.1" {...F} /><circle cx="15" cy="15" r="1.1" {...F} /></>);
    case "split": return svg(<><path d="M12 4.5v6" {...P} /><path d="M12 10.5c0 3.5-2.5 4.5-6 5.5" {...P} /><path d="M12 10.5c0 3.5 2.5 4.5 6 5.5" {...P} /><path d="M6 14l.2 2.4 2.3-.5M18 14l-.2 2.4-2.3-.5" {...P} /></>);
    case "tram": return svg(<><rect x="6" y="5" width="12" height="11" rx="2.5" {...P} /><path d="M8.5 9h7" {...P} /><path d="M12 5V3" {...P} /><circle cx="9.3" cy="18" r="1.2" {...P} /><circle cx="14.7" cy="18" r="1.2" {...P} /><path d="M4 20.5h16" {...P} /></>);
    case "flag": return svg(<><path d="M7 3.5v17" {...P} /><path d="M7 4.5h9l-2 3 2 3H7" {...P} /></>);
    case "card": return svg(<><rect x="5" y="4.5" width="14" height="15" rx="2.5" {...P} /><path d="M8.5 10h5" {...P} /><path d="M8.5 14h7" {...P} /></>);
    case "point": return svg(<><path d="M3 12h8" {...P} /><path d="M8 9l3 3-3 3" {...P} /><circle cx="17" cy="8.5" r="2.2" {...P} /><path d="M13.5 18a3.5 3.5 0 0 1 7 0" {...P} /></>);
    case "eye": return svg(<><path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" {...P} /><circle cx="12" cy="12" r="2.6" {...P} /></>);
    case "rings": return svg(<><circle cx="9.2" cy="13.5" r="5" {...P} /><circle cx="14.8" cy="13.5" r="5" {...P} /><path d="M12 4.5l1 1.6 1-1.6" {...P} /></>);
    case "chili": return svg(<><path d="M14 5c1 .8 1.2 1.8.4 2.9" {...P} /><path d="M14.4 7.6c2.6 1 3.4 4 1.6 6.7s-6 4-9.5 2.2c4 .3 7.4-1.6 7.6-5.5.1-1.5-.1-2.6.3-3.4Z" {...P} /></>);
    case "bolt": return svg(<path d="M13.5 3L6 13h4.5l-1 8 8-11h-5l1-7Z" {...P} />);
    case "gift": return svg(<><rect x="4.5" y="9" width="15" height="10.5" rx="1.5" {...P} /><path d="M3.5 6.5h17V9h-17Z" {...P} /><path d="M12 6.5v13" {...P} /><path d="M12 6.5C10.3 3.6 7 4.6 8.4 6.5M12 6.5C13.7 3.6 17 4.6 15.6 6.5" {...P} /></>);
    case "refresh": return svg(<><path d="M19 7.5A8 8 0 0 0 5 9" {...P} /><path d="M19 4v3.5h-3.5" {...P} /><path d="M5 16.5A8 8 0 0 0 19 15" {...P} /><path d="M5 20v-3.5h3.5" {...P} /></>);
    case "download": return svg(<><path d="M12 4v10" {...P} /><path d="M8 10.5l4 4 4-4" {...P} /><path d="M5 19h14" {...P} /></>);
    case "close": return svg(<path d="M6 6l12 12M18 6L6 18" {...P} />);
    case "check": return svg(<path d="M5 12.5l4.2 4.2L19 7" {...P} />);
    case "ban": return svg(<><circle cx="12" cy="12" r="8.2" {...P} /><path d="M6.5 6.5l11 11" {...P} /></>);
    case "thumbUp": return svg(<><path d="M7 10.5V20H4.5v-9.5Z" {...P} /><path d="M7 10.5l3.6-6.4c1.4 0 2 1 1.8 2.1l-.8 3.3h4.9a1.8 1.8 0 0 1 1.8 2.2l-1.3 5.3A1.8 1.8 0 0 1 16 20H7" {...P} /></>);
    case "thumbDown": return svg(<g transform="rotate(180 12 12)"><path d="M7 10.5V20H4.5v-9.5Z" {...P} /><path d="M7 10.5l3.6-6.4c1.4 0 2 1 1.8 2.1l-.8 3.3h4.9a1.8 1.8 0 0 1 1.8 2.2l-1.3 5.3A1.8 1.8 0 0 1 16 20H7" {...P} /></g>);
    case "twoHearts": return svg(<><path d="M9 16s-4.5-2.8-6-5.6C2 8.5 3.2 6.8 5.2 6.8c1.2 0 2 .7 2.8 1.6.8-.9 1.6-1.6 2.8-1.6 2 0 3.2 1.7 2.2 3.6C13.5 13.2 9 16 9 16Z" {...F} opacity=".9" /><path d="M16 18s-3.6-2.2-4.8-4.5C10.4 11.3 11.4 10 13 10c.9 0 1.6.6 2.2 1.3.6-.7 1.3-1.3 2.2-1.3 1.6 0 2.6 1.3 1.8 2.9C18.4 15.3 16 18 16 18Z" {...F} /></>);
    case "palette": return svg(<><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-1 2-1.8 0-1.2-1-1.4-1-2.4 0-.8.7-1.3 1.6-1.3H17a4 4 0 0 0 4-4c0-4.2-4-7.5-9-7.5Z" {...P} /><circle cx="8" cy="11" r="1" {...F} /><circle cx="12" cy="8" r="1" {...F} /><circle cx="16" cy="10" r="1" {...F} /></>);
    case "eraser": return svg(<><path d="M8 19l-3-3a1.6 1.6 0 0 1 0-2.3l7-7a1.6 1.6 0 0 1 2.3 0l3.7 3.7a1.6 1.6 0 0 1 0 2.3L13 19Z" {...P} /><path d="M19 19h-9" {...P} /></>);
    case "timer": return svg(<><circle cx="12" cy="13" r="7.2" {...P} /><path d="M12 9.5V13l2.5 1.6" {...P} /><path d="M9.5 3.5h5" {...P} /></>);
    case "lock": return svg(<><rect x="5" y="10.5" width="14" height="9" rx="2" {...P} /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...P} /></>);
    case "mail": return svg(<><rect x="3.5" y="5.5" width="17" height="13" rx="2" {...P} /><path d="M4 7l8 6 8-6" {...P} /></>);
    case "pen": return svg(<><path d="M5 19l3-.8L18.6 7.6a1.5 1.5 0 0 0 0-2.1l-1.1-1.1a1.5 1.5 0 0 0-2.1 0L4.8 15 4 18l1 1Z" {...P} /><path d="M14.5 6.4l3.1 3.1" {...P} /></>);
    case "note": return svg(<><path d="M9 18V6l10-2v12" {...P} /><circle cx="6.5" cy="18" r="2.3" {...P} /><circle cx="16.5" cy="16" r="2.3" {...P} /></>);
    case "tier": return svg(<><rect x="4" y="5" width="16" height="4" rx="1.2" {...P} /><rect x="4" y="11" width="12" height="4" rx="1.2" {...P} /><rect x="4" y="17" width="8" height="3.5" rx="1.2" {...P} /></>);
    case "vault": return svg(<><rect x="4" y="5" width="16" height="15" rx="2" {...P} /><circle cx="12" cy="12.5" r="3.2" {...P} /><path d="M12 9.3v-1M12 16.7v-1" {...P} /></>);
    case "pot": return svg(<><path d="M5 9.5h14l-1 8.5a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8Z" {...P} /><path d="M3 9.5h18" {...P} /><path d="M9 6c0 1-1 1.5-1 2.5M13 5.5c0 1-1 1.5-1 2.5" {...P} /></>);
    case "smile": return svg(<><circle cx="12" cy="12" r="8.2" {...P} /><circle cx="9.3" cy="10.2" r="1" {...F} /><circle cx="14.7" cy="10.2" r="1" {...F} /><path d="M8.5 14.2a4.5 4.5 0 0 0 7 0" {...P} /></>);
    case "calendar": return svg(<><rect x="4" y="5.5" width="16" height="14" rx="2" {...P} /><path d="M4 9.5h16M8 3.5v4M16 3.5v4" {...P} /></>);
    case "plus": return svg(<path d="M12 5v14M5 12h14" {...P} />);
    case "up": return svg(<path d="M6 14l6-6 6 6" {...P} />);
    case "down": return svg(<path d="M6 10l6 6 6-6" {...P} />);
    case "user": return svg(<><circle cx="12" cy="8" r="3.4" {...P} /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" {...P} /></>);
    default: return svg(<circle cx="12" cy="12" r="8" {...P} />);
  }
}

export function Mark({ size = 18 }) {
  const RC = useC();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <Icon name="wave" size={size} color={RC.blue} /><Icon name="lotus" size={size} color={RC.rose} />
    </span>
  );
}

export function Background({ children }) {
  const { C: RC, dark } = useTheme();
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "auto", overflowX: "hidden", background: RC.cream, fontFamily: "'Nunito', sans-serif", color: RC.ink, colorScheme: dark ? "dark" : "light" }}>
      <style>{`
        :root {
          --hs-cream:${RC.cream}; --hs-paper:${RC.paper}; --hs-ink:${RC.ink}; --hs-inkSoft:${RC.inkSoft};
          --hs-sage:${RC.sage}; --hs-sageDeep:${RC.sageDeep}; --hs-gold:${RC.gold};
          --hs-blue:${RC.blue}; --hs-blueDeep:${RC.blueDeep}; --hs-blueLight:${RC.blueLight};
          --hs-rose:${RC.rose}; --hs-roseDeep:${RC.roseDeep}; --hs-roseLight:${RC.roseLight};
          --hs-line:${RC.line};
          --hs-card-bg:${dark ? "rgba(38,30,52,.92)" : "rgba(255,255,255,.9)"};
          --hs-card-border:${dark ? "rgba(255,255,255,.11)" : "rgba(255,255,255,.7)"};
          --hs-chip-bg:${dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.7)"};
          --hs-ghost-bg:${dark ? RC.paper : "#fff"};
        }
        html,body{overflow-x:hidden;max-width:100%}
        *{box-sizing:border-box} ::selection{background:${RC.roseLight}}
        input:focus,textarea:focus{scroll-margin-bottom:320px}
        @media(max-width:420px){.tab-label{display:none}}
        .fin{animation:fin .7s cubic-bezier(.2,.8,.2,1) both}.d1{animation-delay:.12s}
        @keyframes fin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .pop{animation:pop .42s cubic-bezier(.2,.8,.2,1) both}
        @keyframes pop{from{opacity:0;transform:scale(.97) translateY(8px)}to{opacity:1;transform:none}}
        .blob{position:fixed;border-radius:50%;filter:blur(64px);opacity:${dark?.25:.4};z-index:0}
        @keyframes drift{0%,100%{transform:translateY(0)}50%{transform:translateY(-22px)}}
        .row{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 12px;scrollbar-width:thin}
        .row::-webkit-scrollbar{height:6px}.row::-webkit-scrollbar-thumb{background:rgba(128,128,128,.3);border-radius:9px}
        .press{transition:transform .12s ease, box-shadow .18s ease}.press:active{transform:scale(.97)}
        button{font-family:inherit}
        input,textarea{color-scheme:${dark?"dark":"light"}}
      `}</style>
      <div className="blob" style={{ width: 360, height: 360, top: -120, left: -120, background: RC.blue, animation: "drift 12s ease-in-out infinite" }} />
      <div className="blob" style={{ width: 360, height: 360, bottom: -120, right: -120, background: RC.rose, animation: "drift 14s ease-in-out infinite" }} />
      <div className="blob" style={{ width: 240, height: 240, top: "42%", left: "44%", background: RC.sage, opacity: .22, animation: "drift 16s ease-in-out infinite" }} />
      {children}
    </div>
  );
}

/* ---------- primitives ---------- */
export const card = (extra = {}) => ({ background: "var(--hs-card-bg)", borderRadius: 22, boxShadow: "0 24px 50px -28px rgba(70,60,50,.4)", border: "1px solid var(--hs-card-border)", backdropFilter: "blur(6px)", ...extra });
export const qText = { fontFamily: "'Fraunces', serif", fontSize: 22, lineHeight: 1.38, margin: 0, fontWeight: 500, textAlign: "center", color: "var(--hs-ink)" };
export const primary = (on, extra = {}) => ({ border: "none", borderRadius: 16, padding: "14px 18px", fontWeight: 800, fontSize: 15.5, color: on ? "#fff" : "var(--hs-inkSoft)", background: on ? "linear-gradient(90deg, var(--hs-blue), var(--hs-rose))" : "var(--hs-line)", cursor: on ? "pointer" : "not-allowed", boxShadow: on ? "0 12px 24px -12px rgba(76,106,146,.5)" : "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, ...extra });
export const ghost = (extra = {}) => ({ border: "1.5px solid var(--hs-sage)", background: "var(--hs-ghost-bg)", color: "var(--hs-ink)", borderRadius: 16, padding: "14px 18px", fontWeight: 800, fontSize: 14.5, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, ...extra });
export const fate = (c) => ({ flex: 1, border: "none", borderRadius: 14, padding: "16px", background: c, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 });
export const linkBtn = { border: "none", background: "transparent", color: "var(--hs-inkSoft)", textDecoration: "underline", cursor: "pointer", fontSize: 13, marginTop: 8 };

export const Label = ({ children, style }) => <label style={{ display: "block", fontWeight: 800, fontSize: 11.5, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--hs-inkSoft)", ...style }}>{children}</label>;
export const Hint = ({ children, style }) => <p style={{ fontSize: 12.5, color: "var(--hs-inkSoft)", margin: 0, ...style }}>{children}</p>;
export function Input({ value, onChange, placeholder, type = "text", style }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type}
    style={{ width: "100%", marginTop: 8, padding: "12px 14px", borderRadius: 14, border: "1.5px solid var(--hs-line)", fontFamily: "inherit", fontSize: 15, color: "var(--hs-ink)", background: "var(--hs-paper)", outline: "none", ...style }} />;
}
export function Chip({ active, onClick, color, icon, label, small }) {
  return (
    <button className="press" onClick={onClick} style={{ border: `1.5px solid ${active ? color : "var(--hs-line)"}`, background: active ? color : "var(--hs-chip-bg)", color: active ? "#fff" : "var(--hs-inkSoft)", borderRadius: 999, padding: small ? "5px 11px" : "7px 12px", cursor: "pointer", fontWeight: 700, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon && <Icon name={icon} size={15} color={active ? "#fff" : color} />}{label}
    </button>
  );
}
export function Primary({ onClick, loading, disabled, icon, label }) {
  const on = !loading && !disabled;
  return (
    <button className="press" onClick={onClick} disabled={!on} style={primary(true, { width: "100%", opacity: on ? 1 : .6, cursor: loading ? "wait" : on ? "pointer" : "not-allowed" })}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name={icon} size={18} color="#fff" /> {label}</span>
    </button>
  );
}
export function Dealing({ text }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'Caveat',cursive", fontSize: 23, color: "var(--hs-inkSoft)" }}>
      <Icon name="spark" size={20} color="var(--hs-inkSoft)" /> {text}…
    </span>
  );
}
export function ThemePicker({ onPick } = {}) {
  const { theme, setTheme, dark } = useTheme();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 60, right: 16 });
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!e.target.closest("[data-themepicker]")) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen(v => !v);
  };
  const active = THEMES[theme];
  return (
    <div data-themepicker style={{ position: "relative" }}>
      <button ref={btnRef} className="press" onClick={toggle} title="Change theme"
        style={{ width: 38, height: 38, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid var(--hs-line)", background: "var(--hs-chip-bg)" }}>
        <Icon name={active.icon || "palette"} size={17} color="var(--hs-rose)" />
      </button>
      {open && (
        <div data-themepicker className="pop" style={{ position: "fixed", right: pos.right, top: pos.top, background: "var(--hs-card-bg)", backdropFilter: "blur(12px)", borderRadius: 18, boxShadow: "0 20px 50px -10px rgba(0,0,0,.35)", border: "1px solid var(--hs-card-border)", zIndex: 100, minWidth: 210, padding: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "var(--hs-inkSoft)", textTransform: "uppercase", padding: "6px 10px 4px" }}>Theme</div>
          {Object.entries(THEMES).map(([key, t]) => {
            const on = theme === key;
            return (
              <button key={key} className="press" onClick={() => { setTheme(key); onPick?.(key); setOpen(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "none", background: on ? "var(--hs-chip-bg)" : "transparent", borderRadius: 12, cursor: "pointer" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, border: `1.5px solid ${on ? t.rose : "var(--hs-line)"}`, background: on ? `${t.rose}22` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name={t.icon || "palette"} size={15} color={t.rose} />
                </div>
                <span style={{ fontSize: 14, fontWeight: on ? 800 : 600, color: "var(--hs-ink)", flex: 1, textAlign: "left" }}>{t.name}</span>
                {on && <Icon name="check" size={16} color="var(--hs-rose)" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
// Keep DarkToggle as alias for backward compat
export const DarkToggle = ThemePicker;
