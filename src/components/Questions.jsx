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
  { id: "lovelang", name: "Love Language Check", icon: "twoHearts" },
  { id: "twotruths", name: "Two Truths & a Fib", icon: "dice" },
  { id: "compat", name: "Compatibility Meter", icon: "heart" },
];
const VIBES = [{ id: "sweet", icon: "flower", label: "Sweet" }, { id: "silly", icon: "spark", label: "Silly" }, { id: "flirty", icon: "flame", label: "Flirty" }, { id: "deep", icon: "moon", label: "Deep" }];
const CHOICES = {
  redGreen: [{ k: "red", label: "Red flag", icon: "flag", c: C.roseDeep }, { k: "green", label: "Green flag", icon: "flag", c: C.sageDeep }],
  pickPerson: [{ k: "him", label: "Him", icon: "wave", c: C.blue }, { k: "both", label: "Both", icon: "twoHearts", c: C.gold }, { k: "her", label: "Her", icon: "lotus", c: C.rose }],
  yesNo: [{ k: "have", label: "I have", icon: "check", c: C.sageDeep }, { k: "never", label: "Never", icon: "ban", c: C.roseDeep }],
  agreeDisagree: [{ k: "agree", label: "Agree", icon: "thumbUp", c: C.sageDeep }, { k: "disagree", label: "Disagree", icon: "thumbDown", c: C.roseDeep }],
};

// Legacy/defense-in-depth guard: refuse to render prompts that still contain
// raw JSON punctuation (the symptom of a malformed AI reply leaking through).
const looksGarbled = (s) => typeof s !== "string" || /[{}[\]]/.test(s);

export function Questions({ room, mine, local = false, names = null }) {
  const { state, commit, generateQuestion } = room;
  const q = state.q;
  const meColor = mine === "him" ? C.blue : C.rose;
  const [td, setTd] = [q._td, (v) => commit((s) => { s.q._td = v; return s; })]; // synced truth/dare reveal

  const setStyle = (style) => commit((s) => { s.q.style = style; s.q.sel = style === "classic" ? "deep" : "wyr"; return s; });
  const setSel = (sel) => { commit((s) => { s.q.sel = sel; return s; }); generateQuestion({ sel, vibe: q.vibe, theme: q.theme }); };
  const setVibe = (vibe) => commit((s) => { s.q.vibe = vibe; return s; });
  const setTheme = (theme) => commit((s) => { s.q.theme = theme; return s; });

  // one commit sets the pick AND scores if it completes the pair — can't
  // double-count. In local (one-device) mode either side can be tapped;
  // in distance mode PickArea only ever calls this with your own side.
  const setPick = (side, k) => commit((s) => {
    s.q.picks = { ...s.q.picks, [side]: k };
    const p = s.q.picks;
    if (state.feel === "gamenight" && p.him && p.her && !s.q.awarded) {
      s.q.awarded = true;
      const shape = s.q.round?.shape;
      if (shape === "threeChoice") {
        const ci = String(s.q.round.correctIndex);
        if (p.him === ci) s.score.him = (s.score.him || 0) + 1;
        if (p.her === ci) s.score.her = (s.score.her || 0) + 1;
      } else if (shape === "redGreen" && s.q.round?.answer) {
        const ans = s.q.round.answer;
        if (p.him === ans) s.score.him = (s.score.him || 0) + 1;
        if (p.her === ans) s.score.her = (s.score.her || 0) + 1;
      } else if (p.him === p.her) {
        s.score.him = (s.score.him || 0) + 1; s.score.her = (s.score.her || 0) + 1;
      }
    }
    return s;
  });

  const setSlider = (side, val) => commit((s) => {
    s.q.picks = { ...s.q.picks, [side]: String(val) };
    const p = s.q.picks;
    if (state.feel === "gamenight" && p.him != null && p.her != null && !s.q.awarded) {
      s.q.awarded = true;
      const gap = Math.abs(Number(p.him) - Number(p.her));
      if (!Number.isNaN(gap) && gap <= 15) { s.score.him = (s.score.him || 0) + 1; s.score.her = (s.score.her || 0) + 1; }
    }
    return s;
  });

  const stale = q.generating && q.genAt && Date.now() - q.genAt > 18000;
  const next = () => generateQuestion({ sel: q.sel, vibe: q.vibe, theme: q.theme });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,.55)", borderRadius: 16, padding: 6, marginBottom: 18 }}>
        {[["classic", "chat", "Classic"], ["games", "card", "Game modes"]].map(([id, ic, l]) => (
          <button key={id} className="press" onClick={() => setStyle(id)} style={{ flex: 1, border: "none", borderRadius: 12, padding: "11px", cursor: "pointer", background: q.style === id ? "#fff" : "transparent", color: q.style === id ? C.ink : C.inkSoft, fontWeight: 800, fontSize: 14.5, boxShadow: q.style === id ? "0 8px 18px -12px rgba(0,0,0,.5)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Icon name={ic} size={17} color={q.style === id ? C.ink : C.inkSoft} /> {l}
          </button>
        ))}
      </div>

      {q.style === "classic" ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {CATS.map((c) => <Chip key={c.id} active={q.sel === c.id} color={meColor} icon={c.icon} label={c.label} onClick={() => setSel(c.id)} />)}
          </div>
          <ThemeInput value={q.theme} onChange={setTheme} />
          <Card count={q.count} sel={q.sel} icon={CATS.find((c) => c.id === q.sel)?.icon} generating={q.generating} genMine={q.genBy === room.clientId}>
            {looksGarbled(q.round?.prompt)
              ? <GlitchNotice onRetry={next} />
              : <p style={qText}>{q.round?.prompt}</p>}
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
            {q.round && looksGarbled(q.round.prompt) && q.round.shape !== "truthDare"
              ? <GlitchNotice onRetry={next} />
              : <RoundCard round={q.round} picks={q.picks} mine={mine} setPick={setPick} setSlider={setSlider} td={td} setTd={setTd} local={local} names={names} />}
          </Card>
          <Primary onClick={next} loading={q.generating && !stale} icon="refresh" label={q.generating ? "dealing…" : "new round"} />
          <p style={{ textAlign: "center", fontSize: 12, color: C.inkSoft, marginTop: 10 }}>
            {local ? "take turns tapping your answers on this screen — then see if you match" : "each of you taps your own answer — then see if you match"}
          </p>
        </>
      )}
    </div>
  );
}

function GlitchNotice({ onRetry }) {
  return (
    <div style={{ textAlign: "center", padding: "18px 0" }}>
      <p style={{ fontFamily: "'Caveat',cursive", fontSize: 20, color: C.inkSoft, marginBottom: 12 }}>
        hmm, that card came out a little glitchy ✶
      </p>
      <button className="press" onClick={onRetry} style={{ border: `1.5px solid ${C.sage}`, background: "#fff", borderRadius: 13, padding: "9px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer", color: C.ink }}>
        try a fresh one
      </button>
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
const ThemeInput = ({ value, onChange }) => (
  <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="optional theme… e.g. our future, food, travel"
    style={{ width: "100%", padding: "10px 12px", borderRadius: 13, border: `1.5px solid ${C.line}`, fontFamily: "inherit", fontSize: 14, color: C.ink, background: C.paper, outline: "none", marginBottom: 16 }} />
);
const Turn = ({ turn, names }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 }}>
    <Icon name={turn === "him" ? "wave" : "lotus"} size={16} color={turn === "him" ? C.blue : C.rose} />
    <span style={{ fontFamily: "'Caveat',cursive", fontSize: 18, color: C.inkSoft }}>
      {names ? `${names[turn]}'s` : (turn === "him" ? "his" : "her")} turn to answer first
    </span>
  </div>
);

function RoundCard({ round, picks, mine, setPick, setSlider, td, setTd, local, names }) {
  if (!round) return null;
  const { shape } = round;
  const pa = { picks, mine, setPick, local, names };

  if (shape === "choice2") return (
    <div>
      <p style={{ ...qText, marginBottom: 16 }}>{round.prompt}</p>
      <div style={{ display: "flex", gap: 10 }}>
        {[0, 1].map((i) => <div key={i} style={{ flex: 1, borderRadius: 16, padding: "16px 12px", textAlign: "center", background: i === 0 ? C.blueLight : C.roseLight, fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 500 }}>{round.options?.[i]}</div>)}
      </div>
      <PickArea options={[{ k: "0", label: round.options?.[0] }, { k: "1", label: round.options?.[1] }]} {...pa} />
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
        <p style={qText}>{looksGarbled(td === "truth" ? round.truth : round.dare) ? "hmm, that one glitched — tap New Round" : (td === "truth" ? round.truth : round.dare)}</p>
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

  if (shape === "redGreen") {
    const both = picks?.him && picks?.her;
    return (
      <div>
        <p style={{ ...qText, margin: "4px 0 16px" }}>{round.prompt}</p>
        <PickArea options={CHOICES.redGreen} {...pa} correctKey={both ? round.answer : null} hideMatchMsg />
        {both && round.answer && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 19, color: round.answer === "red" ? C.roseDeep : C.sageDeep }}>
              we were going for a {round.answer} flag on this one
            </span>
          </div>
        )}
      </div>
    );
  }

  if (shape === "choiceMulti") {
    const opts = (round.options || []).map((label, i) => ({ k: String(i), label }));
    return (
      <div>
        <p style={{ ...qText, margin: "4px 0 16px" }}>{round.prompt}</p>
        <PickArea options={opts} {...pa} />
      </div>
    );
  }

  if (shape === "threeChoice") {
    const opts = (round.options || []).map((label, i) => ({ k: String(i), label }));
    const both = picks?.him && picks?.her;
    return (
      <div>
        <p style={{ ...qText, margin: "4px 0 16px" }}>{round.prompt}</p>
        <PickArea options={opts} {...pa} correctKey={both ? String(round.correctIndex) : null} hideMatchMsg />
        {both && !looksGarbled(round.explain) && (
          <div style={{ textAlign: "center", marginTop: 12, fontFamily: "'Caveat',cursive", fontSize: 18, color: C.inkSoft }}>{round.explain}</div>
        )}
      </div>
    );
  }

  if (shape === "slider") {
    return <SliderRound round={round} picks={picks} mine={mine} setSlider={setSlider} local={local} names={names} />;
  }

  // pickPerson, yesNo, agreeDisagree
  return (
    <div>
      <p style={{ ...qText, margin: "4px 0 16px" }}>{round.prompt}</p>
      <PickArea options={CHOICES[shape]} {...pa} />
    </div>
  );
}

/* Compatibility Meter. Distance: each device sets its own. Local: pass the
   phone — blue answers first while rose looks away, then swap, then reveal. */
function SliderRound({ round, picks, mine, setSlider, local, names }) {
  const him = picks?.him != null ? Number(picks.him) : null;
  const her = picks?.her != null ? Number(picks.her) : null;
  const both = him != null && her != null;
  const gap = both ? Math.abs(him - her) : null;
  const gapMsg = gap == null ? "" : gap <= 10 ? "practically the same soul ✨" : gap <= 30 ? "cute and complementary" : "wonderfully different";
  const activeSide = local ? (picks?.him == null ? "him" : picks?.her == null ? "her" : null) : mine;
  const alreadyMine = !local && picks?.[mine] != null;

  return (
    <div>
      <p style={{ ...qText, margin: "4px 0 16px" }}>{round.prompt}</p>
      {!both && (local ? (
        <SliderInput key={activeSide}
          label={`${names?.[activeSide] || (activeSide === "him" ? "blue" : "rose")}, your turn — ${names?.[activeSide === "him" ? "her" : "him"] || "partner"} look away 👀`}
          color={activeSide === "him" ? C.blue : C.rose}
          onLock={(v) => setSlider(activeSide, v)} />
      ) : !alreadyMine ? (
        <SliderInput label="slide it, then lock in" color={mine === "him" ? C.blue : C.rose} onLock={(v) => setSlider(mine, v)} />
      ) : (
        <div style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 18, color: C.inkSoft }}>
          you locked in {picks[mine]}% — waiting on your partner…
        </div>
      ))}
      {both && (
        <div style={{ marginTop: 6, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="wave" size={16} color={C.blue} /><b style={{ fontFamily: "'Fraunces',serif", fontSize: 18 }}>{him}%</b>{names && <span style={{ fontSize: 12, color: C.inkSoft }}>{names.him}</span>}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="lotus" size={16} color={C.rose} /><b style={{ fontFamily: "'Fraunces',serif", fontSize: 18 }}>{her}%</b>{names && <span style={{ fontSize: 12, color: C.inkSoft }}>{names.her}</span>}</div>
          </div>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 19, color: C.sageDeep, marginTop: 8 }}>{gapMsg}</div>
        </div>
      )}
    </div>
  );
}
function SliderInput({ label, color, onLock }) {
  const [val, setVal] = useState(50);
  return (
    <div>
      <div style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 18, color, marginBottom: 8 }}>{label}</div>
      <input type="range" min="0" max="100" value={val} onChange={(e) => setVal(Number(e.target.value))} style={{ width: "100%" }} />
      <div style={{ textAlign: "center", fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 600, margin: "8px 0 14px" }}>{val}%</div>
      <Primary onClick={() => onLock(val)} icon="check" label="lock in my answer" />
    </div>
  );
}

function PickArea({ options, picks, mine, setPick, correctKey = null, hideMatchMsg = false, local = false, names = null }) {
  const both = picks?.him && picks?.her;
  const match = both && picks.him === picks.her;
  const Row = ({ side, color, deep, sideIcon, fallback }) => {
    const canTap = local || side === mine;
    const sidePicked = picks?.[side] != null;
    // Distance: partner's choice stays hidden until both answered, then both
    // reveal at once. Local (one screen): picks show immediately — honor system.
    const revealed = local || side === mine || both;
    const label = names?.[side] || fallback;
    return (
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 6, color: deep }}>
          <Icon name={sideIcon} size={15} color={deep} /><span style={{ fontFamily: "'Caveat',cursive", fontSize: 17 }}>{label}{!local && side === mine ? " (you)" : ""}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((o) => {
            const on = revealed && picks?.[side] === o.k;
            const dim = !canTap && revealed && !on;
            const isCorrect = correctKey != null && o.k === correctKey;
            return (
              <button key={o.k} className={canTap ? "press" : ""} onClick={canTap ? () => setPick(side, o.k) : undefined} disabled={!canTap}
                style={{
                  border: `1.5px solid ${isCorrect ? C.sageDeep : (on ? color : C.line)}`,
                  background: on ? color : (isCorrect ? `${C.sageDeep}22` : "#fff"),
                  color: on ? "#fff" : C.ink, opacity: dim ? .45 : 1, borderRadius: 12, padding: "9px 10px",
                  cursor: canTap ? "pointer" : "default", fontWeight: 700, fontSize: 13, lineHeight: 1.2,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                {o.icon && <Icon name={o.icon} size={16} color={on ? "#fff" : (o.c || C.inkSoft)} />}{o.label}
                {isCorrect && <Icon name="check" size={14} color={C.sageDeep} />}
              </button>
            );
          })}
          {!local && side !== mine && !sidePicked && <span style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 16, color: C.inkSoft }}>waiting…</span>}
          {!local && side !== mine && sidePicked && !both && <span style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 15, color: C.inkSoft }}>answered — hidden until you both pick</span>}
        </div>
      </div>
    );
  };
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 14 }}>
        <Row side="him" color={C.blue} deep={C.blueDeep} sideIcon="wave" fallback="his" />
        <Row side="her" color={C.rose} deep={C.roseDeep} sideIcon="lotus" fallback="her" />
      </div>
      {both && !hideMatchMsg && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14 }}>
          <Icon name={match ? "twoHearts" : "split"} size={20} color={match ? C.sage : C.gold} />
          <span style={{ fontFamily: "'Caveat',cursive", fontSize: 23, color: match ? C.sageDeep : C.gold }}>{match ? "you matched!" : "you're split — defend yourselves"}</span>
        </div>
      )}
    </div>
  );
}
