import { memo, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { drawStrokes, downloadKeepsake } from "../lib/drawingRender";
import { C, Icon, card, primary, ghost, Chip, useC } from "../ui";

const BASE_W = 320, BASE_H = 230;
const SUB = {
  same: { label: "Same prompt", icon: "rings" }, pictionary: { label: "Pictionary", icon: "eye" }, free: { label: "Free draw", icon: "spark" },
  paint: { label: "Paint Your Partner", icon: "user" }, duel: { label: "Quick Draw Duel", icon: "bolt" },
  scene: { label: "Dream Scene", icon: "frame" }, memory: { label: "Memory Gallery", icon: "heart" },
  studio: { label: "Studio", icon: "palette" },
};

const StrokeImg = memo(function StrokeImg({ strokes, w, color }) {
  const RC = useC();
  const ref = useRef(null);
  useEffect(() => { const c = ref.current, d = 2, h = Math.round(w * BASE_H / BASE_W); c.width = w * d; c.height = h * d; const x = c.getContext("2d"); x.scale(d, d); x.fillStyle = RC.paper; x.fillRect(0, 0, w, h); drawStrokes(x, strokes || [], w / BASE_W); }, [strokes, w, RC.paper]); // eslint-disable-line
  return <div style={{ flex: 1, borderRadius: 12, overflow: "hidden", border: `2px solid ${color}` }}><canvas ref={ref} style={{ width: "100%", display: "block" }} /></div>;
});

export function Gallery({ roomId }) {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!roomId) return; let alive = true;
    // Subscribe first, then fetch — so no INSERT can slip through the gap
    const ch = supabase.channel(`gallery:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "drawings", filter: `room_id=eq.${roomId}` },
        ({ new: row }) => setItems((p) => p ? [row, ...p] : [row]))
      .subscribe();
    supabase.from("drawings").select("*").eq("room_id", roomId).order("created_at", { ascending: false })
      .then(({ data }) => { if (alive) setItems((p) => p === null ? (data || []) : p); });
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [roomId]);

  if (items === null) return <p style={{ textAlign: "center", color: C.inkSoft, padding: 40 }}>loading your memories…</p>;
  const shown = items.filter((m) => filter === "all" || m.sub_mode === filter);

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 30, margin: 0, fontWeight: 600 }}>Our little gallery</h2>
        <p style={{ color: C.inkSoft, fontSize: 13, marginTop: 4 }}>{items.length} memories saved</p>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
        <Chip active={filter === "all"} color={C.sage} label="All" onClick={() => setFilter("all")} />
        {Object.entries(SUB).map(([id, m]) => <Chip key={id} active={filter === id} color={C.sage} icon={m.icon} label={m.label} onClick={() => setFilter(id)} />)}
      </div>
      {shown.length === 0 ? (
        <p style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 24, color: C.inkSoft, marginTop: 40 }}>nothing here yet — go draw something together</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 18 }}>
          {shown.map((m) => (
            <div key={m.id} className="press pop" onClick={() => setOpen(m)} style={card({ padding: 14, cursor: "pointer" })}>
              <div style={{ display: "flex", gap: 8 }}>
                <StrokeImg strokes={m.strokes_him} w={128} color={C.blue} />
                <StrokeImg strokes={m.strokes_her} w={128} color={C.rose} />
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 600 }}>{m.prompt}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3, color: C.inkSoft }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.sageDeep, fontWeight: 800 }}>
                    <Icon name={SUB[m.sub_mode]?.icon || "spark"} size={14} color={C.sageDeep} />{SUB[m.sub_mode]?.label || m.sub_mode}
                  </span>
                  <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16 }}>{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(60,50,40,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="pop" onClick={(e) => e.stopPropagation()} style={{ background: C.cream, borderRadius: 24, padding: 24, maxWidth: 720, width: "100%" }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 600 }}>{open.prompt}</div>
              <div style={{ fontFamily: "'Caveat',cursive", fontSize: 17, color: C.inkSoft }}>{SUB[open.sub_mode]?.label || open.sub_mode} · {new Date(open.created_at).toLocaleDateString()}</div>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {[["strokes_him", C.blue, "wave", "his"], ["strokes_her", C.rose, "lotus", "hers"]].map(([k, c, ic, lab]) => (
                <div key={k} style={{ flex: "1 1 260px" }}>
                  <StrokeImg strokes={open[k]} w={320} color={c} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 6, color: c }}><Icon name={ic} size={15} color={c} /><span style={{ fontFamily: "'Caveat',cursive", fontSize: 18 }}>{lab}</span></div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="press" onClick={() => downloadKeepsake(open)} style={primary(true, { flex: 2 })}><Icon name="download" size={18} color="#fff" /> download keepsake</button>
              <button className="press" onClick={() => setOpen(null)} style={ghost({ flex: 1 })}><Icon name="close" size={16} color={C.ink} /> close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
