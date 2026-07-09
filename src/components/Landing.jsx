import { C, Icon, Mark } from "../ui";
import { signOut } from "../lib/auth";

/* ============================================================================
   Landing — the welcome hub after login. Three experiences:
   Long Distance (the OG synced Heartstrings), Photo Booth, Together (1 device).
   ============================================================================ */

const OPTIONS = [
  {
    id: "distance", icon: "plane", title: "Long Distance",
    sub: "miles apart, side by side",
    desc: "Play synced games and questions over a video call — each of you on your own device, everything mirrored live.",
    color: C.blue, deep: C.blueDeep, light: C.blueLight,
    tags: ["synced rooms", "live drawing", "AI question games"],
  },
  {
    id: "booth", icon: "camera", title: "Photo Booth",
    sub: "strike a pose, keep the strip",
    desc: "A dreamy little photo booth — solo on one device, or create a room and take a couple strip together from two places at once.",
    color: C.gold, deep: "#B0803F", light: "#F6E9D4",
    tags: ["photo strips", "remote booth", "save & share"],
  },
  {
    id: "together", icon: "couch", title: "Together",
    sub: "same couch, one screen",
    desc: "All the games and questions built for one shared device — pass it back and forth on date night, no second phone needed.",
    color: C.rose, deep: C.roseDeep, light: C.roseLight,
    tags: ["one device", "pass & play", "date night"],
  },
];

export function Landing({ onPick, user }) {
  return (
    <div style={{ position: "relative", zIndex: 2, minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px 40px" }}>
      <div className="fin" style={{ textAlign: "center", marginBottom: 26 }}>
        <div style={{ display: "inline-flex", marginBottom: 12 }}><Mark size={26} /></div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 50, lineHeight: 1, margin: 0, fontWeight: 600, letterSpacing: "-1px" }}>Heartstrings</h1>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 24, color: C.inkSoft, margin: "8px 0 0" }}>
          how are you two spending time today?
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, width: "100%", maxWidth: 940 }}>
        {OPTIONS.map((o, i) => (
          <button key={o.id} className={`press fin d${i > 0 ? 1 : ""}`} onClick={() => onPick(o.id)} style={{
            textAlign: "left", cursor: "pointer", borderRadius: 24, padding: "24px 22px",
            border: `2px solid ${C.line}`, background: "rgba(255,255,255,.88)",
            boxShadow: "0 24px 50px -30px rgba(70,60,50,.45)", transition: "all .2s ease",
            display: "flex", flexDirection: "column", gap: 0,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = o.color; e.currentTarget.style.transform = "translateY(-4px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.transform = "none"; }}>
            <div style={{ width: 58, height: 58, borderRadius: 18, background: o.light, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Icon name={o.icon} size={30} color={o.color} />
            </div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 23, fontWeight: 600, color: C.ink }}>{o.title}</div>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 19, color: o.deep, marginBottom: 8 }}>{o.sub}</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: C.inkSoft, margin: "0 0 14px" }}>{o.desc}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
              {o.tags.map((t) => (
                <span key={t} style={{ fontSize: 11, fontWeight: 800, color: o.deep, background: o.light, borderRadius: 999, padding: "4px 10px" }}>{t}</span>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, color: o.color, fontWeight: 800, fontSize: 13.5 }}>
              step inside <Icon name="arrow" size={16} color={o.color} />
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 26, textAlign: "center" }}>
        <span style={{ fontSize: 12.5, color: C.inkSoft }}>{user?.email}</span>
        <span style={{ color: C.line, margin: "0 8px" }}>·</span>
        <button className="press" onClick={signOut} style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>sign out</button>
      </div>
    </div>
  );
}
