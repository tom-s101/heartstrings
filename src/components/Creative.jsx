import { useState } from "react";
import { C, Icon, card } from "../ui";

/* ============================================================================
   Creative — 10 collaborative tools, synced through room_state.c_state.
   Each tool reads its slice from c and commits changes via setC.
   Text being typed stays local; it's committed on submit/blur to avoid spam.
   ============================================================================ */

const TOOLS = [
  { id: "story", name: "Story Weaver", icon: "pen" }, { id: "melody", name: "Melody Mixer", icon: "note" },
  { id: "tier", name: "Tier List", icon: "tier" }, { id: "vault", name: "Dream Vault", icon: "vault" },
  { id: "mosaic", name: "Memory Mosaic", icon: "frame" }, { id: "kitchen", name: "Kitchen Conjurer", icon: "pot" },
  { id: "oracle", name: "Oracle of Us", icon: "moon" }, { id: "emoji", name: "Emoji Epic", icon: "smile" },
  { id: "date", name: "Fantasy Date", icon: "calendar" }, { id: "letter", name: "Love Letter", icon: "mail" },
];

export function Creative({ room, mine }) {
  const c = room.state.c || {};
  const setC = (fn) => room.commit((s) => { s.c = s.c || {}; fn(s.c); return s; });
  const tool = c.tool || "story";

  return (
    <div>
      <div className="row">
        {TOOLS.map((t) => {
          const on = tool === t.id;
          return (
            <button key={t.id} className="press" onClick={() => setC((cc) => { cc.tool = t.id; })} style={{ flex: "0 0 auto", width: 100, borderRadius: 16, padding: "13px 6px", cursor: "pointer", textAlign: "center", border: `2px solid ${on ? C.ink : C.line}`, background: on ? "#fff" : "rgba(255,255,255,.55)", boxShadow: on ? "0 12px 22px -15px rgba(0,0,0,.6)" : "none", transform: on ? "translateY(-2px)" : "none" }}>
              <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={t.icon} size={24} color={on ? C.ink : C.inkSoft} sw={1.6} /></div>
              <div style={{ fontWeight: 800, fontSize: 11, marginTop: 5, lineHeight: 1.15, color: on ? C.ink : C.inkSoft }}>{t.name}</div>
            </button>
          );
        })}
      </div>
      <div key={tool} className="pop" style={card({ padding: 20, marginTop: 6 })}>
        {tool === "story" && <Story c={c} setC={setC} mine={mine} ai={room.aiAssist} />}
        {tool === "melody" && <Melody c={c} setC={setC} mine={mine} />}
        {tool === "tier" && <Tier c={c} setC={setC} />}
        {tool === "vault" && <Vault c={c} setC={setC} mine={mine} />}
        {tool === "mosaic" && <Mosaic c={c} setC={setC} mine={mine} />}
        {tool === "kitchen" && <Kitchen c={c} setC={setC} />}
        {tool === "oracle" && <Oracle c={c} setC={setC} mine={mine} />}
        {tool === "emoji" && <EmojiEpic c={c} setC={setC} mine={mine} />}
        {tool === "date" && <DateForge c={c} setC={setC} />}
        {tool === "letter" && <Letter c={c} setC={setC} ai={room.aiAssist} />}
      </div>
    </div>
  );
}

/* shared */
const inp = { width: "100%", padding: "11px 13px", borderRadius: 13, border: `1.5px solid ${C.line}`, fontFamily: "inherit", fontSize: 14, color: C.ink, background: C.paper, outline: "none" };
const grad = `linear-gradient(90deg, ${C.blue}, ${C.rose})`;
const btn = (bg) => ({ border: "none", borderRadius: 13, padding: "11px 16px", background: bg, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 });
const ghost = { border: `1.5px solid ${C.sage}`, borderRadius: 13, padding: "11px 16px", background: "#fff", color: C.ink, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 };
const Who = ({ who }) => <Icon name={who === "him" ? "wave" : "lotus"} size={14} color={who === "him" ? C.blue : C.rose} />;
const Pill = ({ active, onClick, children, color = C.sage }) => <button className="press" onClick={onClick} style={{ border: `1.5px solid ${active ? color : C.line}`, background: active ? color : "rgba(255,255,255,.7)", color: active ? "#fff" : C.inkSoft, borderRadius: 999, padding: "6px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{children}</button>;
const tag = { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 999, padding: "5px 11px", fontSize: 12.5, fontWeight: 700, color: C.ink };
const mini = { width: 30, height: 30, borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

/* 1 Story Weaver */
const STARTERS = ["The night we finally met,", "In a city neither of us knew,", "If we'd been born a century ago,"];
function Story({ c, setC, mine, ai }) {
  const story = c.story || { lines: [{ who: "her", text: STARTERS[0] }] };
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const add = () => { if (!text.trim()) return; setC((cc) => { cc.story = { lines: [...(cc.story?.lines || story.lines), { who: mine, text: text.trim() }] }; }); setText(""); };
  const suggest = async () => { setBusy(true); const s = await ai(`Continue this couples' love story with ONE short evocative next sentence only (no quotes):\n${story.lines.map((l) => l.text).join(" ")}`); setBusy(false); if (s) setText(s.replace(/^["']|["']$/g, "")); };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{STARTERS.map((s) => <Pill key={s} active={story.lines[0]?.text === s} onClick={() => setC((cc) => { cc.story = { lines: [{ who: "her", text: s }] }; })}>{s.slice(0, 16)}…</Pill>)}</div>
      <div style={{ background: C.paper, borderRadius: 14, padding: 14, border: `1px solid ${C.line}`, fontFamily: "'Fraunces',serif", fontSize: 17, lineHeight: 1.6 }}>
        {story.lines.map((l, i) => <span key={i} style={{ color: l.who === "him" ? C.blueDeep : C.roseDeep }}>{l.text} </span>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "12px 0 6px", color: C.inkSoft }}><Who who={mine} /><span style={{ fontFamily: "'Caveat',cursive", fontSize: 17 }}>your line</span></div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="add your line…" rows={2} style={{ ...inp, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button className="press" onClick={suggest} disabled={busy} style={{ ...ghost, flex: 1, opacity: busy ? .6 : 1 }}><Icon name="spark" size={16} color={C.ink} /> {busy ? "…" : "suggest"}</button>
        <button className="press" onClick={add} style={{ ...btn(grad), flex: 2 }}><Icon name="arrow" size={16} color="#fff" /> add line</button>
      </div>
    </div>
  );
}

/* 2 Melody Mixer */
function Melody({ c, setC, mine }) {
  const songs = c.melody?.songs || [{ who: "her", title: "our first slow dance", why: "you stepped on my foot and I knew" }];
  const [title, setTitle] = useState(""); const [why, setWhy] = useState("");
  const add = () => { if (!title.trim()) return; setC((cc) => { cc.melody = { songs: [...(cc.melody?.songs || songs), { who: mine, title: title.trim(), why: why.trim() }] }; }); setTitle(""); setWhy(""); };
  const move = (i, d) => setC((cc) => { const a = [...(cc.melody?.songs || songs)]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; cc.melody = { songs: a }; });
  return (
    <div>
      <div style={{ textAlign: "center", fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 600, marginBottom: 10 }}>Our Date Night Mix</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {songs.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: C.paper, borderRadius: 12, padding: "10px 12px", border: `1px solid ${C.line}` }}>
            <span style={{ fontFamily: "'Fraunces',serif", color: C.inkSoft, fontSize: 13, width: 16 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}><Who who={s.who} /> {s.title}</div>{s.why && <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: C.inkSoft }}>“{s.why}”</div>}</div>
            <button className="press" onClick={() => move(i, -1)} style={mini}><Icon name="up" size={15} color={C.inkSoft} /></button>
            <button className="press" onClick={() => move(i, 1)} style={mini}><Icon name="down" size={15} color={C.inkSoft} /></button>
          </div>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="song title…" style={{ ...inp, marginBottom: 8 }} />
      <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="why it reminds you of them…" style={{ ...inp, marginBottom: 10 }} />
      <button className="press" onClick={add} style={{ ...btn(grad), width: "100%" }}><Icon name="plus" size={16} color="#fff" /> add to mix</button>
    </div>
  );
}

/* 3 Tier List */
const TIER_CATS = { "Date ideas": ["picnic", "movie night", "road trip", "cooking in", "stargazing", "museum", "beach day", "arcade"], "Snacks": ["popcorn", "ice cream", "fries", "sushi", "chocolate", "mango", "ramen", "tacos"], "Future pets": ["golden pup", "fat cat", "bunny", "parrot", "corgi", "turtle"] };
const TIERS = ["S", "A", "B", "C"]; const TIER_C = { S: C.rose, A: C.gold, B: C.sage, C: C.blue };
function Tier({ c, setC }) {
  const t = c.tier || { cat: "Date ideas", board: {} };
  const [sel, setSel] = useState(null);
  const placed = Object.values(t.board).flat();
  const pool = (TIER_CATS[t.cat] || []).filter((x) => !placed.includes(x));
  const place = (tier) => { if (!sel) return; setC((cc) => { const b = { ...(cc.tier?.board || {}) }; TIERS.forEach((k) => b[k] = (b[k] || []).filter((x) => x !== sel)); b[tier] = [...(b[tier] || []), sel]; cc.tier = { cat: t.cat, board: b }; }); setSel(null); };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, justifyContent: "center" }}>{Object.keys(TIER_CATS).map((k) => <Pill key={k} active={t.cat === k} onClick={() => { setSel(null); setC((cc) => { cc.tier = { cat: k, board: {} }; }); }}>{k}</Pill>)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {TIERS.map((tier) => (
          <div key={tier} onClick={() => place(tier)} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, borderRadius: 12, padding: "6px 8px", background: C.paper, border: `1.5px solid ${sel ? TIER_C[tier] : C.line}`, cursor: sel ? "pointer" : "default" }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: TIER_C[tier], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontFamily: "'Fraunces',serif" }}>{tier}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(t.board[tier] || []).map((x) => <span key={x} style={tag}>{x}</span>)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: "'Caveat',cursive", fontSize: 17, color: C.inkSoft, marginBottom: 6 }}>{sel ? `tap a tier to place “${sel}”` : "tap an item, then a tier"}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{pool.map((x) => <button key={x} className="press" onClick={() => setSel(x)} style={{ ...tag, cursor: "pointer", border: `1.5px solid ${sel === x ? C.ink : C.line}`, background: sel === x ? C.ink : "#fff", color: sel === x ? "#fff" : C.ink }}>{x}</button>)}</div>
    </div>
  );
}

/* 4 Dream Vault */
const VTABS = ["Our Dream Life", "Next 5 Dates", "Future Home"];
function Vault({ c, setC, mine }) {
  const v = c.vault || { tab: VTABS[0], items: {} };
  const [text, setText] = useState("");
  const list = v.items[v.tab] || [];
  const add = () => { if (!text.trim()) return; setC((cc) => { const it = { ...(cc.vault?.items || {}) }; it[v.tab] = [...(it[v.tab] || []), { who: mine, text: text.trim() }]; cc.vault = { tab: v.tab, items: it }; }); setText(""); };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, justifyContent: "center" }}>{VTABS.map((tb) => <Pill key={tb} active={v.tab === tb} onClick={() => setC((cc) => { cc.vault = { ...(cc.vault || { items: {} }), tab: tb }; })}>{tb}</Pill>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {list.map((x, i) => <div key={i} style={{ background: C.paper, borderRadius: 12, padding: 12, border: `1px solid ${C.line}`, display: "flex", gap: 6, alignItems: "flex-start" }}><Who who={x.who} /><span style={{ fontFamily: "'Fraunces',serif", fontSize: 15 }}>{x.text}</span></div>)}
        {list.length === 0 && <div style={{ gridColumn: "1/3", textAlign: "center", color: C.inkSoft, fontFamily: "'Caveat',cursive", fontSize: 18, padding: "14px 0" }}>nothing pinned yet — dream a little</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="pin a dream…" style={inp} /><button className="press" onClick={add} style={btn(grad)}><Icon name="plus" size={16} color="#fff" /></button></div>
    </div>
  );
}

/* 5 Memory Mosaic */
const MPR = ["our funniest fight", "best trip moment", "the day I knew", "a tiny perfect day"];
function Mosaic({ c, setC, mine }) {
  const entries = c.mosaic?.entries || [{ who: "her", prompt: "the day I knew", caption: "you fell asleep mid-sentence and I just smiled" }];
  const [prompt, setPrompt] = useState(MPR[0]); const [cap, setCap] = useState("");
  const add = () => { if (!cap.trim()) return; setC((cc) => { cc.mosaic = { entries: [{ who: mine, prompt, caption: cap.trim() }, ...(cc.mosaic?.entries || entries)] }; }); setCap(""); };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>{MPR.map((p) => <Pill key={p} active={prompt === p} onClick={() => setPrompt(p)}>{p}</Pill>)}</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}><input value={cap} onChange={(e) => setCap(e.target.value)} placeholder={`caption “${prompt}”…`} style={inp} /><button className="press" onClick={add} style={btn(grad)}><Icon name="plus" size={16} color="#fff" /></button></div>
      <div style={{ borderLeft: `2px solid ${C.line}`, marginLeft: 8, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {entries.map((e, i) => (
          <div key={i} style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: -21, top: 4, width: 10, height: 10, borderRadius: 999, background: e.who === "him" ? C.blue : C.rose }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 13, color: C.inkSoft }}><Who who={e.who} /> {e.prompt}</div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16 }}>{e.caption}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 6 Kitchen Conjurer */
const KW = { base: ["midnight ramen", "fluffy pancakes", "crispy tacos", "velvet risotto"], star: ["mango", "dark chocolate", "chili oil", "blue cheese", "marshmallow"], twist: ["deep-fried", "served cold", "on a stick", "set on fire (safely)", "wrapped in bacon"] };
function Kitchen({ c, setC }) {
  const k = c.kitchen || { dish: { base: KW.base[0], star: KW.star[0], twist: KW.twist[0] }, name: "", rate: 3 };
  const [name, setName] = useState(k.name || "");
  const spin = () => setC((cc) => { cc.kitchen = { ...(cc.kitchen || k), dish: { base: KW.base[Math.floor(Math.random() * KW.base.length)], star: KW.star[Math.floor(Math.random() * KW.star.length)], twist: KW.twist[Math.floor(Math.random() * KW.twist.length)] } }; });
  const rate = (n) => setC((cc) => { cc.kitchen = { ...(cc.kitchen || k), rate: n }; });
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["base", "star", "twist"].map((key) => <div key={key} style={{ flex: 1, background: C.paper, borderRadius: 14, padding: "16px 8px", textAlign: "center", border: `1px solid ${C.line}` }}><div style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, textTransform: "uppercase", letterSpacing: .5 }}>{key}</div><div style={{ fontFamily: "'Fraunces',serif", fontSize: 15, marginTop: 4 }}>{k.dish[key]}</div></div>)}
      </div>
      <button className="press" onClick={spin} style={{ ...btn(C.sage), width: "100%", marginBottom: 12 }}><Icon name="refresh" size={16} color="#fff" /> spin the wheels</button>
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setC((cc) => { cc.kitchen = { ...(cc.kitchen || k), name }; })} placeholder="name your creation…" style={{ ...inp, textAlign: "center", fontFamily: "'Fraunces',serif", fontSize: 17, marginBottom: 12 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{ fontFamily: "'Caveat',cursive", fontSize: 17, color: C.inkSoft }}>edible?</span>
        {[1, 2, 3, 4, 5].map((n) => <button key={n} className="press" onClick={() => rate(n)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><Icon name="heart" size={22} color={n <= (k.rate || 0) ? C.rose : C.line} /></button>)}
      </div>
    </div>
  );
}

/* 7 Oracle of Us */
const DECK = ["The Spark", "The Long Night", "The Adventure", "The Home", "The Mirror", "The Leap", "The Garden", "The Tide", "The Promise", "The Laughter"];
function Oracle({ c, setC, mine }) {
  const o = c.oracle || { card: null, journal: [] };
  const [meaning, setMeaning] = useState("");
  const draw = () => { setMeaning(""); setC((cc) => { cc.oracle = { ...(cc.oracle || o), card: DECK[Math.floor(Math.random() * DECK.length)] }; }); };
  const save = () => { if (!o.card || !meaning.trim()) return; setC((cc) => { cc.oracle = { card: null, journal: [{ card: o.card, who: mine, meaning: meaning.trim() }, ...(cc.oracle?.journal || o.journal)] }; }); setMeaning(""); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <div onClick={draw} style={{ width: 140, height: 200, borderRadius: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 14, background: o.card ? `linear-gradient(160deg, ${C.blueLight}, ${C.roseLight})` : C.blueDeep, border: `2px solid ${o.card ? C.gold : C.blueDeep}`, color: o.card ? C.ink : "#fff" }}>
          {o.card ? <div><Icon name="moon" size={26} color={C.gold} style={{ margin: "0 auto 8px" }} /><div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 600 }}>{o.card}</div></div> : <div style={{ fontFamily: "'Caveat',cursive", fontSize: 22 }}>tap to draw a card</div>}
        </div>
      </div>
      {o.card && (<>
        <textarea value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder={`what does “${o.card}” say about us?`} rows={2} style={{ ...inp, resize: "vertical", marginBottom: 10 }} />
        <button className="press" onClick={save} style={{ ...btn(grad), width: "100%" }}><Icon name="check" size={16} color="#fff" /> save to our oracle journal</button>
      </>)}
      {(o.journal || []).length > 0 && <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>{o.journal.map((j, i) => <div key={i} style={{ background: C.paper, borderRadius: 12, padding: 10, border: `1px solid ${C.line}` }}><div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 13, color: C.gold }}><Who who={j.who} /> {j.card}</div><div style={{ fontFamily: "'Fraunces',serif", fontSize: 15 }}>{j.meaning}</div></div>)}</div>}
    </div>
  );
}

/* 8 Emoji Epic */
const ESET = "❤️ 😂 🥹 🌙 ✨ 🍜 🚗 🏠 🎁 🌊 🌸 🔥 🎶 ☕ 🐱 🐶 ✈️ 🏔️ 🌧️ ☀️ 💍 📞 🍕 🎂 🫶 👀 💤 🥂 🌹".split(" ");
function EmojiEpic({ c, setC, mine }) {
  const e = c.emoji || { chain: [], reveal: false };
  const [guess, setGuess] = useState("");
  const addE = (em) => setC((cc) => { const ch = cc.emoji?.chain || e.chain; if (ch.length < 10) cc.emoji = { ...(cc.emoji || e), chain: [...ch, em], reveal: false }; });
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: C.inkSoft }}><Who who={mine} /><span style={{ fontFamily: "'Caveat',cursive", fontSize: 17 }}>tell a story in emoji (max 10)</span></div>
      <div style={{ minHeight: 54, background: C.paper, borderRadius: 12, border: `1px solid ${C.line}`, padding: 12, fontSize: 26, letterSpacing: 4, marginBottom: 10 }}>{e.chain.join("") || <span style={{ fontSize: 15, color: C.inkSoft, fontFamily: "'Caveat',cursive", letterSpacing: 0 }}>tap emojis below…</span>}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>{ESET.map((em, i) => <button key={i} className="press" onClick={() => addE(em)} style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 10, fontSize: 22, width: 38, height: 38, cursor: "pointer", lineHeight: 1 }}>{em}</button>)}</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button className="press" onClick={() => setC((cc) => { cc.emoji = { ...(cc.emoji || e), chain: (cc.emoji?.chain || e.chain).slice(0, -1) }; })} style={{ ...ghost, flex: 1 }}>undo</button>
        <button className="press" onClick={() => setC((cc) => { cc.emoji = { chain: [], reveal: false }; })} style={{ ...ghost, flex: 1 }}>clear</button>
      </div>
      <input value={guess} onChange={(e2) => setGuess(e2.target.value)} placeholder="partner says their guess out loud…" style={{ ...inp, marginBottom: 10 }} />
      <button className="press" onClick={() => setC((cc) => { cc.emoji = { ...(cc.emoji || e), reveal: true }; })} style={{ ...btn(grad), width: "100%" }}><Icon name="spark" size={16} color="#fff" /> reveal if they got it</button>
      {e.reveal && <div style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 20, color: C.sageDeep, marginTop: 10 }}>now tell them what it really meant ✶</div>}
    </div>
  );
}

/* 9 Fantasy Date Forge */
const DCATS = { Venue: ["rooftop garden", "tiny jazz bar", "seaside cliff", "cozy bookshop café"], Outfit: ["matching pajamas", "all dressed up", "cottagecore linen", "leather & boots"], Food: ["street tacos", "midnight noodles", "picnic spread", "tasting menu"], Twist: ["surprise fireworks", "a sudden rainstorm", "a stray kitten adopts you", "karaoke showdown"] };
function DateForge({ c, setC }) {
  const d = c.date || { picks: {}, booked: false };
  const done = Object.keys(DCATS).every((k) => d.picks[k]);
  if (d.booked) return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "inline-flex", marginBottom: 8 }}><Icon name="mail" size={30} color={C.rose} /></div>
      <div style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 600 }}>Booking confirmed ✶</div>
      <div style={{ background: C.paper, borderRadius: 14, padding: 16, border: `1px solid ${C.line}`, marginTop: 12, textAlign: "left" }}>
        {Object.entries(d.picks).map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.line}` }}><span style={{ color: C.inkSoft, fontWeight: 800, fontSize: 13 }}>{k}</span><span style={{ fontFamily: "'Fraunces',serif" }}>{v}</span></div>)}
      </div>
      <button className="press" onClick={() => setC((cc) => { cc.date = { picks: {}, booked: false }; })} style={{ ...btn(C.sage), marginTop: 14 }}><Icon name="refresh" size={16} color="#fff" /> forge another</button>
    </div>
  );
  return (
    <div>
      {Object.entries(DCATS).map(([cat, opts]) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: C.inkSoft, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>{cat}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{opts.map((o) => <Pill key={o} active={d.picks[cat] === o} onClick={() => setC((cc) => { const p = { ...(cc.date?.picks || {}) }; p[cat] = o; cc.date = { picks: p, booked: false }; })}>{o}</Pill>)}</div>
        </div>
      ))}
      <button className="press" disabled={!done} onClick={() => setC((cc) => { cc.date = { ...(cc.date || d), booked: true }; })} style={{ ...btn(done ? grad : C.line), width: "100%", marginTop: 6, cursor: done ? "pointer" : "not-allowed" }}><Icon name="calendar" size={16} color="#fff" /> book it</button>
    </div>
  );
}

/* 10 Love Letter Lab */
const TONES = ["sweet", "nostalgic", "spicy", "future-self"];
function Letter({ c, setC, ai }) {
  const l = c.letter || { tone: "sweet", body: "", sealed: false };
  const [body, setBody] = useState(l.body || ""); const [busy, setBusy] = useState(false);
  const draft = async () => { setBusy(true); const t = await ai(`Write a short ${l.tone} love letter (4-6 lines) from one partner to another in a long-distance relationship. Warm, specific, never crude. Return only the letter.`); setBusy(false); if (t) { setBody(t); setC((cc) => { cc.letter = { ...(cc.letter || l), body: t }; }); } };
  if (l.sealed) return (
    <div style={{ textAlign: "center" }}>
      <div style={{ background: `linear-gradient(160deg, ${C.blueLight}, #fff 50%, ${C.roseLight})`, borderRadius: 16, padding: 20, border: `1px solid ${C.line}`, fontFamily: "'Fraunces',serif", fontSize: 17, lineHeight: 1.6, whiteSpace: "pre-wrap", textAlign: "left" }}>{l.body}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, color: C.roseDeep }}><Icon name="heart" size={16} color={C.rose} /><span style={{ fontFamily: "'Caveat',cursive", fontSize: 20 }}>sealed with love</span></div>
      <div><button className="press" onClick={() => setC((cc) => { cc.letter = { ...(cc.letter || l), sealed: false }; })} style={{ ...ghost, marginTop: 12 }}>edit</button></div>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, justifyContent: "center" }}>{TONES.map((t) => <Pill key={t} active={l.tone === t} onClick={() => setC((cc) => { cc.letter = { ...(cc.letter || l), tone: t }; })}>{t}</Pill>)}</div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => setC((cc) => { cc.letter = { ...(cc.letter || l), body }; })} placeholder="write together, line by line…" rows={6} style={{ ...inp, resize: "vertical", fontFamily: "'Fraunces',serif", fontSize: 16, lineHeight: 1.5, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <button className="press" onClick={draft} disabled={busy} style={{ ...ghost, flex: 1, opacity: busy ? .6 : 1 }}><Icon name="spark" size={16} color={C.ink} /> {busy ? "…" : "draft for us"}</button>
        <button className="press" onClick={() => body.trim() && setC((cc) => { cc.letter = { ...(cc.letter || l), body, sealed: true }; })} style={{ ...btn(grad), flex: 1 }}><Icon name="mail" size={16} color="#fff" /> seal it</button>
      </div>
    </div>
  );
}
