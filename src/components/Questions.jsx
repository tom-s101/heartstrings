import { useState } from "react";
import { C, Icon, card, qText, Chip, Primary, Dealing, fate, linkBtn } from "../ui";

const CATS = [
  { id: "deep", label: "Deep", icon: "moon" }, { id: "silly", label: "Silly", icon: "spark" },
  { id: "spicy", label: "Spicy", icon: "flame" }, { id: "wholesome", label: "Wholesome", icon: "flower" },
  { id: "hypothetical", label: "Hypothetical", icon: "dice" },
];
const FORMATS = [
  { id: "wyr", name: "Would You Rather", icon: "split" }, { id: "trolley", name: "Trial by Trolley", icon: "tram" },
  { id: "redflags", name: "Red or Green Flag", icon: "flag" }, { id: "cah", name: "Fill in the Blank", icon: "card" },
  { id: "mostlikely", name: "Most Likely To", icon: "point" }, { id: "nhie", name: "Never Have I Ever", icon: "eye" },
  { id: "newlywed", name: "How Well You Know Me", icon: "rings" }, { id: "hottake", name: "Hot Takes", icon: "chili" },
  { id: "thisorthat", name: "This or That", icon: "bolt" }, { id: "truthdare", name: "Truth or Dare", icon: "gift" },
];
const VIBES = [{ id: "sweet", icon: "flower", label: "Sweet" }, { id: "silly", icon: "spark", label: "Silly" }, { id: "flirty", icon: "flame", label: "Flirty" }, { id: "deep", icon: "moon", label: "Deep" }];
const CHOICES = {
  redGreen: [{ k: "red", label: "Red flag", icon: "flag", c: C.roseDeep }, { k: "green", label: "Green flag", icon: "flag", c: C.sageDeep }],
  pickPerson: [{ k: "him", label: "Him", icon: "wave", c: C.blue }, { k: "both", label: "Both", icon: "twoHearts", c: C.gold }, { k: "her", label: "Her", icon: "lotus", c: C.rose }],
  yesNo: [{ k: "have", label: "I have", icon: "check", c: C.sageDeep }, { k: "never", label: "Never", icon: "ban", c: C.roseDeep }],
  agreeDisagree: [{ k: "agree", label: "Agree", icon: "thumbUp", c: C.sageDeep }, { k: "disagree", label: "Disagree", icon: "thumbDown", c: C.roseDeep }],
};

export function Questions({ room, mine, names }) {
  const { state, commit, generateQuestion } = room;
  const q = state.q;
  const meColor = mine === "him" ? C.blue : C.rose;
  const [td, setTd] = [q._td, (v) => commit((s) => { s.q._td = v; return s; })]; // synced truth/dare reveal

  const setStyle = (style) => commit((s) => { s.q.style = style; s.q.sel = style === "classic" ? "deep" : "wyr"; return s; });
  const setSel = (sel) => { commit((s) => { s.q.sel = sel; return s; }); generateQuestion({ sel, vibe: q.vibe, theme: q.theme }); };
  const setVibe = (vibe) => commit((s) => { s.q.vibe = vibe; return s; });
  const setTheme = (theme) => commit((s) => { s.q.theme = theme; return s; });
  // setting my pick also scores the round if it completes the pair — done in one
  // commit so it can't double-count and doesn't depend on either client staying online
  const setPick = (k) => commit((s) => {
    s.q.picks = { ...s.q.picks, [mine]: k };
    const p = s.q.picks;
    if (state.feel === "gamenight" && p.him && p.her && !s.q.awarded) {
      s.q.awarded = true;
      if (p.him === p.her) { s.score.him = (s.score.him || 0) + 1; s.score.her = (s.score.her || 0) + 1; }
    }
    return s;
  });
  // a hung/abandoned generation (e.g. partner dropped mid-generate) self-heals after 18s
  const stale = q.generating && q.genAt && Date.now() - q.genAt > 18000;
  const next = () => generateQuestion({ sel: q.sel, vibe: q.vibe, theme: q.theme });
  const [view, setView] = useState("play"); // "play" | "history"

  return (
    <div>
      <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,.55)", borderRadius: 16, padding: 6, marginBottom: 18 }}>
        {[["classic", "chat", "Classic"], ["games", "card", "Game modes"], ["history", "refresh", `History${q.history?.length ? ` (${q.history.length})` : ""}`]].map(([id, ic, l]) => {
          const isView = id === "history";
          const active = isView ? view === "history" : (view === "play" && q.style === id);
          return (
            <button key={id} className="press"
              onClick={() => isView ? setView(v => v === "history" ? "play" : "history") : (setView("play"), setStyle(id))}
              style={{ flex: 1, border: "none", borderRadius: 12, padding: "11px 6px", cursor: "pointer", background: active ? "#fff" : "transparent", color: active ? C.ink : C.inkSoft, fontWeight: 800, fontSize: 13.5, boxShadow: active ? "0 8px 18px -12px rgba(0,0,0,.5)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Icon name={ic} size={16} color={active ? C.ink : C.inkSoft} /> {l}
            </button>
          );
        })}
      </div>

      {view === "history" ? (
        <div>
          {!q.history?.length ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.inkSoft }}>
              <Icon name="chat" size={32} color={C.line} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontFamily: "'Caveat',cursive", fontSize: 20 }}>no questions yet — generate one to start!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...q.history].reverse().map((h, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,.85)", borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color: C.inkSoft }}>
                    <Icon name="chat" size={13} color={C.inkSoft} />
                    <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px" }}>{h.sel} · #{q.history.length - i}</span>
                  </div>
                  <p style={{ fontFamily: "'Fraunces',serif", fontSize: 16, margin: 0, color: C.ink, lineHeight: 1.4 }}>{h.prompt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : q.style === "classic" ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {CATS.map((c) => <Chip key={c.id} active={q.sel === c.id} color={meColor} icon={c.icon} label={c.label} onClick={() => setSel(c.id)} />)}
          </div>
          <ThemeInput value={q.theme} onChange={setTheme} />
          <Card count={q.count} sel={q.sel} icon={CATS.find((c) => c.id === q.sel)?.icon} generating={q.generating} genMine={q.genBy === room.clientId}>
            <p style={qText}>{q.round?.prompt}</p>
          </Card>
          <Primary onClick={next} loading={q.generating && !stale} icon="spark" label={q.generating ? "thinking…" : "new question"} />
          <Turn turn={q.turn} names={names} />
        </>
      ) : (
        <>
          <div className="row">
            {FORMATS.map((f) => {
              const on = q.sel === f.id;
              return (
                <button key={f.id} className="press" onClick={() => setSel(f.id)} style={{ flex: "0 0 auto", width: 104, borderRadius: 16, padding: "14px 8px", cursor: "pointer", textAlign: "center", border: `2px solid ${on ? C.ink : C.line}`, background: on ? "#fff" : "rgba(255,255,255,.55)", boxShadow: on ? "0 12px 22px -15px rgba(0,0,0,.6)" : "none", transform: on ? "translateY(-2px)" : "none" }}>
                  <div style={{ height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={f.icon} size={26} color={on ? C.ink : C.inkSoft} sw={1.6} /></div>
                  <div style={{ fontWeight: 800, fontSize: 11.5, marginTop: 6, lineHeight: 1.2, color: on ? C.ink : C.inkSoft }}>{f.name}</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 4, marginBottom: 10 }}>
            {VIBES.map((v) => <Chip key={v.id} active={q.vibe === v.id} color={C.sage} icon={v.icon} label={v.label} onClick={() => setVibe(v.id)} small />)}
          </div>
          <ThemeInput value={q.theme} onChange={setTheme} />
          <Card count={q.count} sel={q.sel} icon={FORMATS.find((f) => f.id === q.sel)?.icon} name={FORMATS.find((f) => f.id === q.sel)?.name} generating={q.generating} genMine={q.genBy === room.clientId}>
            <RoundCard round={q.round} picks={q.picks} mine={mine} setPick={setPick} td={td} setTd={setTd} />
          </Card>
          <Primary onClick={next} loading={q.generating && !stale} icon="refresh" label={q.generating ? "dealing…" : "new round"} />
          <Turn turn={q.turn} names={names} />
          <p style={{ textAlign: "center", fontSize: 12, color: C.inkSoft, marginTop: 6 }}>each of you taps your own answer — then see if you match</p>
        </>
      )}
    </div>
  );
}


function Card({ count, icon, name, generating, genMine, children }) {
  return (
    <div key={count} className="pop" style={card({ padding: 22, minHeight: 196, marginBottom: 16 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, color: C.inkSoft }}>
        <Icon name={icon} size={17} color={C.inkSoft} /><span style={{ fontWeight: 800, fontSize: 12.5 }}>{name ? `${name} · ` : ""}#{count}</span>
      </div>
      {generating ? <div style={{ textAlign: "center", padding: "26px 0" }}><Dealing text={genMine ? "dealing a fresh card" : "your partner is dealing a card"} /></div> : children}
    </div>
  );
}
function ThemeInput({ value, onChange }) {
  const [local, setLocal] = useState(value || "");
  // Sync inward only when room state changes from outside (e.g. partner clears it)
  const prev = useState(value)[0];
  if (value !== prev && value !== local) setLocal(value || "");
  const flush = () => { if (local !== value) onChange(local); };
  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={flush}
      onKeyDown={(e) => e.key === "Enter" && flush()}
      placeholder="optional theme… e.g. our future, food, travel"
      style={{ width: "100%", padding: "10px 12px", borderRadius: 13, border: `1.5px solid ${C.line}`, fontFamily: "inherit", fontSize: 14, color: C.ink, background: C.paper, outline: "none", marginBottom: 16 }} />
  );
}
const Turn = ({ turn, names }) => {
  const name = names?.[turn]?.name || (turn === "him" ? "his" : "her");
  const possessive = names?.[turn]?.name ? `${name}'s` : name;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 }}>
      <Icon name={turn === "him" ? "wave" : "lotus"} size={16} color={turn === "him" ? C.blue : C.rose} />
      <span style={{ fontFamily: "'Caveat',cursive", fontSize: 18, color: C.inkSoft }}>{possessive} turn to answer first</span>
    </div>
  );
};

function RoundCard({ round, picks, mine, setPick, td, setTd }) {
  if (!round) return null;
  const { shape } = round;
  if (shape === "choice2") return (
    <div>
      <p style={{ ...qText, marginBottom: 16 }}>{round.prompt}</p>
      <div style={{ display: "flex", gap: 10 }}>
        {[0, 1].map((i) => <div key={i} style={{ flex: 1, borderRadius: 16, padding: "16px 12px", textAlign: "center", background: i === 0 ? C.blueLight : C.roseLight, fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 500 }}>{round.options?.[i]}</div>)}
      </div>
      <PickArea options={[{ k: "0", label: round.options?.[0] }, { k: "1", label: round.options?.[1] }]} picks={picks} mine={mine} setPick={setPick} />
    </div>
  );
  if (shape === "truthDare") return (
    <div style={{ textAlign: "center" }}>
      {!td ? (<>
        <p style={{ fontFamily: "'Caveat',cursive", fontSize: 22, color: C.inkSoft, margin: "6px 0 16px" }}>choose your fate…</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="press" onClick={() => setTd("truth")} style={fate(C.blue)}><Icon name="chat" size={20} color="#fff" /> Truth</button>
          <button className="press" onClick={() => setTd("dare")} style={fate(C.rose)}><Icon name="spark" size={20} color="#fff" /> Dare</button>
        </div></>
      ) : (<>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8, color: td === "truth" ? C.blueDeep : C.roseDeep }}>
          <Icon name={td === "truth" ? "chat" : "spark"} size={16} color={td === "truth" ? C.blueDeep : C.roseDeep} /><span style={{ fontWeight: 800, fontSize: 12, letterSpacing: ".5px" }}>{td === "truth" ? "TRUTH" : "DARE"}</span>
        </div>
        <p style={qText}>{td === "truth" ? round.truth : round.dare}</p>
        <button onClick={() => setTd(td === "truth" ? "dare" : "truth")} style={linkBtn}>show the {td === "truth" ? "dare" : "truth"} instead</button>
      </>)}
    </div>
  );
  if (shape === "open") return (
    <div style={{ textAlign: "center" }}>
      <p style={{ ...qText, margin: "10px 0" }}>{round.prompt}</p>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.sage }}><Icon name="chat" size={16} color={C.sage} /><span style={{ fontFamily: "'Caveat',cursive", fontSize: 19 }}>answer out loud — then trade</span></div>
    </div>
  );
  return (
    <div>
      <p style={{ ...qText, margin: "4px 0 16px" }}>{round.prompt}</p>
      <PickArea options={CHOICES[shape]} picks={picks} mine={mine} setPick={setPick} />
    </div>
  );
}

function PickArea({ options, picks, mine, setPick }) {
  const both = picks?.him && picks?.her;
  const match = both && picks.him === picks.her;
  const Row = ({ side, color, deep, sideIcon, label }) => {
    const isMine = side === mine;
    return (
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 6, color: deep }}>
          <Icon name={sideIcon} size={15} color={deep} /><span style={{ fontFamily: "'Caveat',cursive", fontSize: 17 }}>{label}{isMine ? " (you)" : ""}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((o) => {
            const on = picks?.[side] === o.k;
            const dim = !isMine && !on;
            return (
              <button key={o.k} className={isMine ? "press" : ""} onClick={isMine ? () => setPick(o.k) : undefined} disabled={!isMine}
                style={{ border: `1.5px solid ${on ? color : C.line}`, background: on ? color : "#fff", color: on ? "#fff" : C.ink, opacity: dim ? .45 : 1, borderRadius: 12, padding: "9px 10px", cursor: isMine ? "pointer" : "default", fontWeight: 700, fontSize: 13, lineHeight: 1.2, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                {o.icon && <Icon name={o.icon} size={16} color={on ? "#fff" : (o.c || C.inkSoft)} />}{o.label}
              </button>
            );
          })}
          {!isMine && !picks?.[side] && <span style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 16, color: C.inkSoft }}>waiting…</span>}
        </div>
      </div>
    );
  };
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 14 }}>
        <Row side="him" color={C.blue} deep={C.blueDeep} sideIcon="wave" label="his" />
        <Row side="her" color={C.rose} deep={C.roseDeep} sideIcon="lotus" label="her" />
      </div>
      {both && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14 }}>
          <Icon name={match ? "twoHearts" : "split"} size={20} color={match ? C.sage : C.gold} />
          <span style={{ fontFamily: "'Caveat',cursive", fontSize: 23, color: match ? C.sageDeep : C.gold }}>{match ? "you matched!" : "you're split — defend yourselves"}</span>
        </div>
      )}
    </div>
  );
}
