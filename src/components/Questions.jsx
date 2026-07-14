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
  { id: "twotruths", name: "Two Truths and a Lie", icon: "dice" },
  { id: "compat", name: "Compatibility Meter", icon: "heart" },
];
const VIBES = [{ id: "sweet", icon: "flower", label: "Sweet" }, { id: "silly", icon: "spark", label: "Silly" }, { id: "flirty", icon: "flame", label: "Flirty" }, { id: "deep", icon: "moon", label: "Deep" }];
const CHOICES = {
  redGreen: [{ k: "red", label: "Red flag", icon: "flag", c: C.roseDeep }, { k: "green", label: "Green flag", icon: "flag", c: C.sageDeep }],
};
// The shape a round SHOULD have for each game format, per the current build.
// If a round comes back with any other shape, it's leftover from an older
// deploy of the server function (or an old cached round) — we catch that
// below and show a "reload this round" prompt instead of silently rendering
// a blank/broken card.
const SHAPE_FOR = {
  wyr: "choice2", trolley: "choice2", redflags: "redGreen", cah: "open",
  mostlikely: "spectrum3", nhie: "handraise", newlywed: "guess", hottake: "spectrum2",
  thisorthat: "choice2", truthdare: "truthDare", lovelang: "choiceMulti",
  twotruths: "twolie", compat: "slider",
};

// Legacy/defense-in-depth guard: refuse to render prompts that still carry an
// actual signature of leaked JSON/markdown (a whole JSON blob, a literal
// `"key": value` fragment, or a stray code fence) — NOT just because the text
// happens to contain a bracket somewhere, which normal colorful prose does
// sometimes and was previously enough to wrongly flag a perfectly good card.
const looksGarbled = (s) => {
  if (typeof s !== "string") return true;
  const t = s.trim();
  if (!t) return true;
  if (/^[{[][\s\S]*[}\]]$/.test(t)) return true;
  if (/"[a-zA-Z_]+"\s*:\s*["{[\d]/.test(t)) return true;
  if (/```/.test(t)) return true;
  return false;
};

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
  // in distance mode PickArea/GuessArea/HandRaise only ever call this with
  // your own side.
  const setPick = (side, k) => commit((s) => {
    s.q.picks = { ...s.q.picks, [side]: k };
    const p = s.q.picks;
    if (state.feel === "gamenight" && p.him != null && p.her != null && !s.q.awarded) {
      s.q.awarded = true;
      const shape = s.q.round?.shape;
      if (shape === "twolie") {
        // teller picked their own lie in secret; guesser tried to catch it —
        // guesser scores on a correct catch, teller scores on a clean escape.
        const teller = s.q.round?.teller;
        const guesser = teller === "him" ? "her" : "him";
        if (teller) {
          if (p[guesser] === p[teller]) s.score[guesser] = (s.score[guesser] || 0) + 1;
          else s.score[teller] = (s.score[teller] || 0) + 1;
        }
      } else if (shape === "redGreen" && s.q.round?.answer) {
        const ans = s.q.round.answer;
        if (p.him === ans) s.score.him = (s.score.him || 0) + 1;
        if (p.her === ans) s.score.her = (s.score.her || 0) + 1;
      } else if (shape !== "guess" && p.him === p.her) {
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

  // Spectrum (Hot Takes / Most Likely To): discrete 5-zone tap bar shared by
  // both formats. "Close enough" (adjacent zone) still counts as a match.
  const setSpectrum = (side, idx) => commit((s) => {
    s.q.picks = { ...s.q.picks, [side]: String(idx) };
    const p = s.q.picks;
    if (state.feel === "gamenight" && p.him != null && p.her != null && !s.q.awarded) {
      s.q.awarded = true;
      const gap = Math.abs(Number(p.him) - Number(p.her));
      if (!Number.isNaN(gap) && gap <= 1) { s.score.him = (s.score.him || 0) + 1; s.score.her = (s.score.her || 0) + 1; }
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
              : q.round && SHAPE_FOR[q.sel] && q.round.shape !== SHAPE_FOR[q.sel]
              ? <StaleNotice onRetry={next} />
              : <RoundCard round={q.round} picks={q.picks} mine={mine} setPick={setPick} setSlider={setSlider} setSpectrum={setSpectrum} td={td} setTd={setTd} local={local} names={names} />}
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
function StaleNotice({ onRetry }) {
  return (
    <div style={{ textAlign: "center", padding: "18px 0" }}>
      <p style={{ fontFamily: "'Caveat',cursive", fontSize: 20, color: C.inkSoft, marginBottom: 12 }}>
        this round is from an older version of the game ✶
      </p>
      <button className="press" onClick={onRetry} style={{ border: `1.5px solid ${C.sage}`, background: "#fff", borderRadius: 13, padding: "9px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer", color: C.ink }}>
        reload this round
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

function RoundCard({ round, picks, mine, setPick, setSlider, setSpectrum, td, setTd, local, names }) {
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

  // How Well You Know Me: one side answers a fill-in-the-blank about
  // themselves for real, the other side guesses — free text, not a pick.
  if (shape === "guess") {
    const target = round.target || "him";
    const guesser = target === "him" ? "her" : "him";
    const targetLabel = names?.[target] || (target === "him" ? "he" : "she");
    const guesserLabel = names?.[guesser] || (guesser === "him" ? "he" : "she");
    return (
      <div>
        <p style={{ ...qText, margin: "4px 0 4px" }}>{round.prompt} ___</p>
        <p style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 15, color: C.inkSoft, marginBottom: 12 }}>
          {targetLabel} fills it in for real · {guesserLabel} tries to guess it
        </p>
        <GuessArea target={target} guesser={guesser} picks={picks} mine={mine} setPick={setPick} local={local} names={names} />
      </div>
    );
  }

  if (shape === "redGreen") {
    const both = picks?.him && picks?.her;
    return (
      <div>
        <p style={{ ...qText, margin: "4px 0 8px" }}>{round.prompt}</p>
        <p style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 15, color: C.inkSoft, marginBottom: 10 }}>swipe your verdict</p>
        <PickArea options={CHOICES.redGreen} {...pa} correctKey={both ? round.answer : null} hideMatchMsg big />
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

  // Two Truths and a Lie: the model never decides truth/false — one side is
  // randomly the "teller" and secretly marks which of the three statements
  // is their own lie; the other side tries to catch it.
  if (shape === "twolie") {
    const opts = (round.options || []).map((label, i) => ({ k: String(i), label }));
    const teller = round.teller || "him";
    const guesser = teller === "him" ? "her" : "him";
    const tellerName = names?.[teller] || (teller === "him" ? "he" : "she");
    const guesserName = names?.[guesser] || (guesser === "him" ? "he" : "she");
    const both = picks?.[teller] != null && picks?.[guesser] != null;
    const caught = both && picks[teller] === picks[guesser];
    return (
      <div>
        <p style={{ ...qText, margin: "4px 0 8px" }}>{round.prompt || "a few things about me…"}</p>
        <p style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 15, color: C.inkSoft, marginBottom: 4 }}>
          {tellerName} secretly picks the lie · {guesserName} tries to catch it
        </p>
        <PickArea options={opts} {...pa} correctKey={both ? picks[teller] : null} hideMatchMsg />
        {both && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 19, color: caught ? C.sageDeep : C.gold }}>
              {caught ? "caught the lie! 🎯" : `got away with it 😏 — the lie was #${Number(picks[teller]) + 1}`}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (shape === "slider") {
    return <SliderRound round={round} picks={picks} mine={mine} setSlider={setSlider} local={local} names={names} />;
  }

  // Hot Takes: bipolar 5-zone agree<->disagree spectrum.
  if (shape === "spectrum2") {
    return (
      <div>
        <p style={{ ...qText, margin: "4px 0 16px" }}>{round.prompt}</p>
        <Spectrum zones={["strongly disagree", "disagree", "neutral", "agree", "strongly agree"]} picks={picks} mine={mine} setSpectrum={setSpectrum} local={local} names={names} />
      </div>
    );
  }

  // Most Likely To: 5-zone him<->both<->her spectrum instead of 3 flat buttons.
  if (shape === "spectrum3") {
    return (
      <div>
        <p style={{ ...qText, margin: "4px 0 16px" }}>{round.prompt}</p>
        <Spectrum zones={["definitely him", "maybe him", "toss-up", "maybe her", "definitely her"]} picks={picks} mine={mine} setSpectrum={setSpectrum} local={local} names={names} />
      </div>
    );
  }

  // Never Have I Ever: big icon-forward hand-raise toggle instead of pills.
  if (shape === "handraise") {
    return (
      <div>
        <p style={{ ...qText, margin: "4px 0 16px" }}>{round.prompt}</p>
        <HandRaise picks={picks} mine={mine} setPick={setPick} local={local} names={names} />
      </div>
    );
  }

  // unknown/future shape — degrade gracefully instead of crashing
  return (
    <div>
      <p style={{ ...qText, margin: "4px 0 16px" }}>{round.prompt}</p>
      <PickArea options={CHOICES[shape] || []} {...pa} />
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
// Custom-styled gauge (gradient track + a big glowing draggable heart thumb)
// instead of a plain OS range input — the real interaction is still a
// native <input type=range> underneath (for reliable drag physics), it's
// just made invisible and overlaid with the meter visuals.
function SliderInput({ label, color, onLock }) {
  const [val, setVal] = useState(50);
  return (
    <div>
      <div style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 18, color, marginBottom: 6 }}>{label}</div>
      <div style={{ textAlign: "center", fontFamily: "'Fraunces',serif", fontSize: 42, fontWeight: 700, color, marginBottom: 4, lineHeight: 1 }}>{val}%</div>
      <div style={{ position: "relative", height: 40, marginTop: 10 }}>
        <div style={{ position: "absolute", top: 16, left: 0, right: 0, height: 8, borderRadius: 8, background: `linear-gradient(90deg, ${C.blueLight}, ${C.gold}, ${C.roseLight})`, boxShadow: "inset 0 1px 3px rgba(0,0,0,.15)" }} />
        <div style={{ position: "absolute", top: 16, left: 0, width: `${val}%`, height: 8, borderRadius: 8, background: color, opacity: .35 }} />
        <div style={{ position: "absolute", top: 6, left: `calc(${val}% - 14px)`, width: 28, height: 28, borderRadius: "50%", background: color, border: "3px solid #fff", boxShadow: "0 4px 14px -4px rgba(0,0,0,.55)", pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="heart" size={13} color="#fff" />
        </div>
        <input type="range" min="0" max="100" value={val} onChange={(e) => setVal(Number(e.target.value))}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 700, color: C.inkSoft, padding: "0 2px", margin: "6px 0 16px" }}>
        <span>not at all</span><span>totally us</span>
      </div>
      <Primary onClick={() => onLock(val)} icon="check" label="lock in my answer" />
    </div>
  );
}

// Shared discrete tap-bar spectrum used by Hot Takes (agree<->disagree) and
// Most Likely To (him<->both<->her) — one shared bar both partners' markers
// land on, instead of each tapping separate buttons in separate columns.
function Spectrum({ zones, picks, mine, setSpectrum, local, names }) {
  const both = picks?.him != null && picks?.her != null;
  const activeSide = local ? (picks?.him == null ? "him" : picks?.her == null ? "her" : null) : mine;
  const alreadyMine = !local && picks?.[mine] != null;
  const canPick = local ? activeSide != null : !alreadyMine;
  const pickerSide = local ? activeSide : mine;

  return (
    <div>
      {!both && canPick && (
        <p style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 16, color: pickerSide === "him" ? C.blueDeep : C.roseDeep, marginBottom: 10 }}>
          {local ? `${names?.[pickerSide] || (pickerSide === "him" ? "blue" : "rose")}, tap your spot` : "tap your spot on the spectrum"}
        </p>
      )}
      <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", border: `1.5px solid ${C.line}` }}>
        {zones.map((label, i) => {
          const himHere = both && Number(picks.him) === i;
          const herHere = both && Number(picks.her) === i;
          return (
            <button key={i} disabled={!canPick} className={canPick ? "press" : ""}
              onClick={canPick ? () => setSpectrum(pickerSide, i) : undefined}
              style={{
                flex: 1, minHeight: 62, border: "none", borderRight: i < zones.length - 1 ? `1px solid ${C.line}` : "none",
                background: i % 2 === 0 ? "#fff" : "rgba(0,0,0,.02)", cursor: canPick ? "pointer" : "default",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 2px",
              }}>
              <div style={{ display: "flex", gap: 3, minHeight: 15 }}>
                {himHere && <Icon name="wave" size={14} color={C.blue} />}
                {herHere && <Icon name="lotus" size={14} color={C.rose} />}
              </div>
              <span style={{ fontSize: 9, fontWeight: 800, color: C.inkSoft, textAlign: "center", lineHeight: 1.15 }}>{label}</span>
            </button>
          );
        })}
      </div>
      {!local && !both && alreadyMine && (
        <div style={{ textAlign: "center", marginTop: 10, fontFamily: "'Caveat',cursive", fontSize: 15, color: C.inkSoft }}>you picked your spot — waiting on your partner…</div>
      )}
      {both && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14 }}>
          <Icon name={Math.abs(Number(picks.him) - Number(picks.her)) <= 1 ? "twoHearts" : "split"} size={20} color={Math.abs(Number(picks.him) - Number(picks.her)) <= 1 ? C.sage : C.gold} />
          <span style={{ fontFamily: "'Caveat',cursive", fontSize: 20, color: Math.abs(Number(picks.him) - Number(picks.her)) <= 1 ? C.sageDeep : C.gold }}>
            {Math.abs(Number(picks.him) - Number(picks.her)) <= 1 ? "right in sync!" : "worlds apart on this one"}
          </span>
        </div>
      )}
    </div>
  );
}

// Never Have I Ever: big circular icon buttons instead of pill buttons.
function HandRaise({ picks, mine, setPick, local, names }) {
  const both = picks?.him != null && picks?.her != null;
  const OPTS = [{ k: "have", icon: "thumbUp", c: C.sageDeep, label: "I have" }, { k: "never", icon: "thumbDown", c: C.roseDeep, label: "never" }];
  const Col = ({ side }) => {
    const canTap = local || side === mine;
    const val = picks?.[side];
    const revealed = local || side === mine || both;
    const label = names?.[side] || (side === "him" ? "his" : "her");
    return (
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontFamily: "'Caveat',cursive", fontSize: 16, color: side === "him" ? C.blueDeep : C.roseDeep, marginBottom: 8 }}>
          {label}{!local && side === mine ? " (you)" : ""}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {OPTS.map((o) => {
            const on = revealed && val === o.k;
            const dim = !canTap && revealed && !on;
            return (
              <button key={o.k} disabled={!canTap} className={canTap ? "press" : ""}
                onClick={canTap ? () => setPick(side, o.k) : undefined}
                style={{ flex: 1, borderRadius: 16, padding: "16px 6px", border: `2px solid ${on ? o.c : C.line}`, background: on ? `${o.c}1c` : "#fff", opacity: dim ? .45 : 1, cursor: canTap ? "pointer" : "default" }}>
                <Icon name={o.icon} size={22} color={on ? o.c : C.inkSoft} />
                <div style={{ fontWeight: 800, fontSize: 11.5, marginTop: 6, color: on ? o.c : C.inkSoft }}>{o.label}</div>
              </button>
            );
          })}
        </div>
        {!local && side !== mine && val == null && <div style={{ marginTop: 6, fontFamily: "'Caveat',cursive", fontSize: 14, color: C.inkSoft }}>waiting…</div>}
        {!local && side !== mine && val != null && !both && <div style={{ marginTop: 6, fontFamily: "'Caveat',cursive", fontSize: 13, color: C.inkSoft }}>answered — hidden until you both pick</div>}
      </div>
    );
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 14 }}><Col side="him" /><Col side="her" /></div>
      {both && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14 }}>
          <Icon name={picks.him === picks.her ? "twoHearts" : "split"} size={20} color={picks.him === picks.her ? C.sage : C.gold} />
          <span style={{ fontFamily: "'Caveat',cursive", fontSize: 23, color: picks.him === picks.her ? C.sageDeep : C.gold }}>{picks.him === picks.her ? "you matched!" : "you're split — defend yourselves"}</span>
        </div>
      )}
    </div>
  );
}

// How Well You Know Me: free-text answer (target) vs free-text guess
// (guesser) instead of picking from options — genuinely different input mode.
function GuessArea({ target, guesser, picks, mine, setPick, local, names }) {
  const both = picks?.[target] != null && picks?.[guesser] != null;
  const Col = ({ side }) => {
    const isTarget = side === target;
    const canType = local || side === mine;
    const val = picks?.[side] || "";
    const revealed = local || side === mine || both;
    const label = names?.[side] || (side === "him" ? "his" : "her");
    return (
      <div style={{ flex: 1 }}>
        <div style={{ textAlign: "center", fontFamily: "'Caveat',cursive", fontSize: 15, color: side === "him" ? C.blueDeep : C.roseDeep, marginBottom: 6 }}>
          {label}{!local && side === mine ? " (you)" : ""} — {isTarget ? "answer for real" : "your guess"}
        </div>
        {revealed ? (
          <div style={{ minHeight: 46, borderRadius: 12, border: `1.5px solid ${C.line}`, padding: "10px 10px", fontSize: 13.5, fontWeight: 600, background: "#fff", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {val || "…"}
          </div>
        ) : canType ? (
          <GuessInput value={val} onSubmit={(t) => setPick(side, t)} />
        ) : (
          <div style={{ minHeight: 46, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 15, color: C.inkSoft }}>waiting…</span>
          </div>
        )}
      </div>
    );
  };
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", gap: 14 }}>
        <Col side="him" /><Col side="her" />
      </div>
      {both && (
        <div style={{ textAlign: "center", marginTop: 14, fontFamily: "'Caveat',cursive", fontSize: 18, color: C.sageDeep }}>
          how'd you do? 👀 — say it out loud and compare
        </div>
      )}
    </div>
  );
}
function GuessInput({ value, onSubmit }) {
  const [val, setVal] = useState(value || "");
  return (
    <div>
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="type it…" maxLength={80}
        style={{ width: "100%", padding: "9px 10px", borderRadius: 12, border: `1.5px solid ${C.line}`, fontFamily: "inherit", fontSize: 13.5, color: C.ink, background: C.paper, outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
      <button className="press" disabled={!val.trim()} onClick={() => onSubmit(val.trim())}
        style={{ width: "100%", border: "none", borderRadius: 12, padding: "8px", fontWeight: 800, fontSize: 12.5, cursor: val.trim() ? "pointer" : "default", background: val.trim() ? C.ink : C.line, color: "#fff", opacity: val.trim() ? 1 : .6 }}>
        lock it in
      </button>
    </div>
  );
}

function PickArea({ options, picks, mine, setPick, correctKey = null, hideMatchMsg = false, local = false, names = null, big = false }) {
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
                  color: on ? "#fff" : C.ink, opacity: dim ? .45 : 1, borderRadius: big ? 16 : 12, padding: big ? "16px 12px" : "9px 10px",
                  cursor: canTap ? "pointer" : "default", fontWeight: 700, fontSize: big ? 14.5 : 13, lineHeight: 1.2,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                {o.icon && <Icon name={o.icon} size={big ? 19 : 16} color={on ? "#fff" : (o.c || C.inkSoft)} />}{o.label}
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
