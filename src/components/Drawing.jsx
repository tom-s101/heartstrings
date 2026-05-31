import { useState, useRef, useEffect } from "react";
import { C, Icon, card, primary, ghost } from "../ui";
import { drawStrokes } from "../lib/drawingRender";

/* ============================================================================
   Drawing — Classic / Studio toggle, all synced through room_state.d_state.
   Classic: Same prompt / Pictionary / Free draw (simple originals).
   Studio:  10 named modes across 5 mechanics (simul, picto, split, collab, chain).
   ============================================================================ */

const CLASSIC = [["same","rings","Same prompt"],["pictionary","eye","Pictionary"],["free","spark","Free draw"]];
const CLASSIC_PROMPTS = { same:["our dream date","what home feels like","each other as a cartoon"], pictionary:["a memory we share","your favorite thing about me","our perfect weekend"], free:["draw whatever's in your heart","your mood today"] };

const STUDIO = [
  { id:"paint", name:"Paint Your Partner", icon:"user", mech:"simul", timer:300, prompts:["draw each other!"] },
  { id:"whisper", name:"Whisper Draw", icon:"eye", mech:"picto", custom:true, prompts:["our first date","an inside joke","your happy place"] },
  { id:"split", name:"Split Canvas", icon:"split", mech:"split", prompts:["our future house","us as superheroes","our dream pet"] },
  { id:"telephone", name:"Drawing Telephone", icon:"chat", mech:"chain", kind:"telephone", prompts:["You hold my hand under the stars"] },
  { id:"duel", name:"Quick Draw Duel", icon:"bolt", mech:"simul", timer:75, duel:true, prompts:["a romantic disaster","our worst cooking attempt","love at first sight"] },
  { id:"corpse", name:"Exquisite Corpse", icon:"dice", mech:"chain", kind:"corpse", prompts:["our dream date creature"] },
  { id:"oneway", name:"One-Way Sketch", icon:"point", mech:"picto", lock:true, custom:true, prompts:["how you feel when I text good morning","the way I laugh","our perfect Sunday"] },
  { id:"scene", name:"Dream Scene", icon:"frame", mech:"collab", prompts:["our honeymoon","pet parents","superhero couple"] },
  { id:"dash", name:"Doodle Dash", icon:"timer", mech:"simul", timer:60, prompts:["a flirty avocado","love as a monster truck","our future in 2099","a heart having a bad day"] },
  { id:"memory", name:"Memory Gallery", icon:"heart", mech:"simul", timer:0, save:true, prompts:["our first kiss","a trip we want","the day we met"] },
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function Drawing({ room, mine, partnerOnline }) {
  const { state, commit } = room;
  const d = state.d;
  const style = d.style || "classic";
  const setStyle = (st) => commit((s) => { s.d.style = st; if (st === "studio" && !s.d.studio) { s.d.studio = "paint"; s.d.prompt = "draw each other!"; s.d.revealed = false; } return s; });
  return (
    <div>
      <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,.55)", borderRadius: 16, padding: 6, marginBottom: 18 }}>
        {[["classic","brush","Classic"],["studio","palette","Studio"]].map(([id,ic,l]) => (
          <button key={id} className="press" onClick={() => setStyle(id)} style={{ flex:1, border:"none", borderRadius:12, padding:"11px", cursor:"pointer", background: style===id?"#fff":"transparent", color: style===id?C.ink:C.inkSoft, fontWeight:800, fontSize:14.5, boxShadow: style===id?"0 8px 18px -12px rgba(0,0,0,.5)":"none", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
            <Icon name={ic} size={17} color={style===id?C.ink:C.inkSoft} /> {l}
          </button>
        ))}
      </div>
      {style === "classic"
        ? <Classic room={room} mine={mine} partnerOnline={partnerOnline} />
        : <Studio room={room} mine={mine} partnerOnline={partnerOnline} />}
    </div>
  );
}

/* ===================== CLASSIC ===================== */
function Classic({ room, mine, partnerOnline }) {
  const { state, commit, mineStrokes, partnerStrokes, pushStroke, clearMine, saveDrawing } = room;
  const d = state.d; const feel = state.feel;
  const lastRound = useRef(d.round);
  useEffect(() => { if (d.round !== lastRound.current) { lastRound.current = d.round; clearMine(); } }, [d.round]); // eslint-disable-line
  const remaining = useCountdown(d, () => commit((s)=>{ s.d.revealed=true; s.d.endsAt=null; return s; }));

  const setSub = (sub) => commit((s) => { s.d.sub=sub; s.d.prompt=pick(CLASSIC_PROMPTS[sub]); s.d.revealed=false; s.d.endsAt=null; s.d.round=(s.d.round||1)+1; if(sub==="pictionary") s.d.artist=s.d.artist||"him"; return s; });
  const newPrompt = () => commit((s) => { s.d.prompt=pick(CLASSIC_PROMPTS[s.d.sub||"same"]); s.d.revealed=false; s.d.endsAt=null; s.d.round=(s.d.round||1)+1; if(s.d.sub==="pictionary") s.d.artist=s.d.artist==="him"?"her":"him"; return s; });
  const startTimer = () => commit((s) => { s.d.endsAt=Date.now()+ (s.d.duration||60)*1000; s.d.revealed=false; return s; });
  const reveal = () => commit((s) => { s.d.revealed=true; s.d.endsAt=null; return s; });
  const gotIt = () => commit((s) => { s.d.revealed=true; if(s.feel==="gamenight"){ s.score.him=(s.score.him||0)+1; s.score.her=(s.score.her||0)+1; } return s; });
  const isP = d.sub==="pictionary"; const amArtist = d.artist===mine;

  return (
    <div style={card({ padding:20 })}>
      <ChipRow items={CLASSIC} active={d.sub||"same"} onPick={setSub} />
      <Head label={isP ? (amArtist?"you're the artist — draw:":"guess what they're drawing!") : "both draw:"} prompt={isP && !amArtist && !d.revealed ? hide(d.prompt) : d.prompt} time={feel!=="chill"?remaining:null} endsAt={d.endsAt} />
      {isP
        ? <div style={{ maxWidth:380, margin:"0 auto" }}>{amArtist ? <Canvas color={col(mine)} editable strokes={mineStrokes} onStroke={pushStroke} palette /> : <Canvas color={col(other(mine))} strokes={partnerStrokes} live />}</div>
        : <Pair mine={mine} mineStrokes={mineStrokes} partnerStrokes={partnerStrokes} pushStroke={pushStroke} revealed={d.revealed} partnerOnline={partnerOnline} />}
      <Controls feel={feel} d={d} isP={isP} amArtist={amArtist} onStart={startTimer} onReveal={reveal} onGotIt={gotIt} onSave={saveDrawing} onNew={newPrompt} pictNew="swap & new word" />
    </div>
  );
}

/* ===================== STUDIO ===================== */
function Studio({ room, mine, partnerOnline }) {
  const { state, commit } = room;
  const d = state.d;
  const m = STUDIO.find((x) => x.id === (d.studio || "paint")) || STUDIO[0];
  const start = (mode) => commit((s) => {
    s.d.studio = mode.id; s.d.prompt = pick(mode.prompts); s.d.revealed = false; s.d.endsAt = null;
    s.d.duration = mode.timer || 60; s.d.round = (s.d.round || 1) + 1; s.d.winner = null; s.d.title = "";
    s.d.artist = s.d.artist || "him"; s.d.theme = mode.mech === "collab" ? pick(mode.prompts) : s.d.theme;
    if (mode.custom) s.d.words = s.d.words || [];
    if (mode.mech === "chain") { s.d.kind = mode.kind; s.d.chain = mode.kind === "telephone" ? [{ who: "her", type: "sentence", value: mode.prompts[0] }] : []; }
    return s;
  });
  return (
    <div style={card({ padding: 20 })}>
      <div className="row" style={{ marginBottom: 8 }}>
        {STUDIO.map((x) => { const on = m.id === x.id; return (
          <button key={x.id} className="press" onClick={() => start(x)} style={{ flex:"0 0 auto", width:96, borderRadius:14, padding:"12px 6px", cursor:"pointer", textAlign:"center", border:`2px solid ${on?C.ink:C.line}`, background:on?"#fff":"rgba(255,255,255,.55)", boxShadow:on?"0 12px 22px -15px rgba(0,0,0,.6)":"none", transform:on?"translateY(-2px)":"none" }}>
            <div style={{ height:26, display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name={x.icon} size={23} color={on?C.ink:C.inkSoft} sw={1.6} /></div>
            <div style={{ fontWeight:800, fontSize:10.5, marginTop:5, lineHeight:1.15, color:on?C.ink:C.inkSoft }}>{x.name}</div>
          </button> ); })}
      </div>
      {m.mech === "simul" && <Simul room={room} mine={mine} m={m} partnerOnline={partnerOnline} />}
      {m.mech === "picto" && <Picto room={room} mine={mine} m={m} />}
      {m.mech === "split" && <Split room={room} mine={mine} m={m} />}
      {m.mech === "collab" && <Collab room={room} mine={mine} m={m} />}
      {m.mech === "chain" && <Chain room={room} mine={mine} m={m} />}
    </div>
  );
}

/* simul */
function Simul({ room, mine, m, partnerOnline }) {
  const { state, commit, mineStrokes, partnerStrokes, pushStroke, clearMine, saveDrawing } = room;
  const d = state.d; const feel = state.feel;
  const lastRound = useRef(d.round);
  useEffect(() => { if (d.round !== lastRound.current) { lastRound.current = d.round; clearMine(); } }, [d.round]); // eslint-disable-line
  const remaining = useCountdown(d, () => commit((s)=>{ s.d.revealed=true; s.d.endsAt=null; return s; }));
  const newRound = () => commit((s)=>{ s.d.prompt=pick(m.prompts); s.d.revealed=false; s.d.endsAt=null; s.d.winner=null; s.d.round=(s.d.round||1)+1; return s; });
  const winner = (w) => commit((s)=>{ s.d.winner=w; if(s.feel==="gamenight"){ if(w==="him") s.score.him=(s.score.him||0)+1; else s.score.her=(s.score.her||0)+1; } return s; });
  return (
    <div>
      <Head label={m.dash?"draw, fast:":"both draw:"} prompt={d.prompt} time={(m.timer&&feel!=="chill")?remaining:null} endsAt={d.endsAt} />
      <Pair mine={mine} mineStrokes={mineStrokes} partnerStrokes={partnerStrokes} pushStroke={pushStroke} revealed={d.revealed} partnerOnline={partnerOnline} />
      {d.revealed && m.duel && (
        <div style={{ textAlign:"center", marginTop:14 }}>
          <div style={{ fontFamily:"'Caveat',cursive", fontSize:20, color:C.inkSoft, marginBottom:6 }}>who nailed it?</div>
          <div style={{ display:"flex", gap:10 }}>
            <button className="press" onClick={()=>winner("him")} style={pill(d.winner==="him"?C.blue:C.blueLight, d.winner==="him")}><Icon name="trophy" size={16} color={d.winner==="him"?"#fff":C.blue} /> His</button>
            <button className="press" onClick={()=>winner("her")} style={pill(d.winner==="her"?C.rose:C.roseLight, d.winner==="her")}><Icon name="trophy" size={16} color={d.winner==="her"?"#fff":C.rose} /> Hers</button>
          </div>
        </div>
      )}
      <Controls feel={feel} d={d} onStart={()=>commit((s)=>{ s.d.endsAt=Date.now()+(s.d.duration||60)*1000; s.d.revealed=false; return s; })} onReveal={()=>commit((s)=>{ s.d.revealed=true; s.d.endsAt=null; return s; })} onSave={saveDrawing} onNew={newRound} save={m.save} />
    </div>
  );
}

/* picto */
function Picto({ room, mine, m }) {
  const { state, commit, mineStrokes, partnerStrokes, pushStroke, clearMine } = room;
  const d = state.d;
  const lastRound = useRef(d.round);
  useEffect(() => { if (d.round !== lastRound.current) { lastRound.current = d.round; clearMine(); } }, [d.round]); // eslint-disable-line
  const [word, setWord] = useState("");
  const bank = [...m.prompts, ...((d.words)||[])];
  const next = () => commit((s)=>{ s.d.prompt=pick([...m.prompts, ...((s.d.words)||[])]); s.d.revealed=false; s.d.round=(s.d.round||1)+1; if(!m.lock) s.d.artist=s.d.artist==="him"?"her":"him"; return s; });
  const gotIt = () => commit((s)=>{ s.d.revealed=true; if(s.feel==="gamenight"){ s.score.him=(s.score.him||0)+1; s.score.her=(s.score.her||0)+1; } return s; });
  const amArtist = d.artist===mine;
  return (
    <div>
      {m.custom && (
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <input value={word} onChange={(e)=>setWord(e.target.value)} placeholder="add your own word / prompt…" style={inp} />
          <button className="press" onClick={()=>{ if(word.trim()){ commit((s)=>{ s.d.words=[...((s.d.words)||[]), word.trim()]; return s; }); setWord(""); } }} style={{ ...ghost, padding:"0 16px" }}>add</button>
        </div>
      )}
      <Head label={amArtist?"you're the artist — draw:":"guess what they're drawing!"} prompt={amArtist||d.revealed ? d.prompt : hide(d.prompt)} />
      <div style={{ maxWidth:380, margin:"0 auto" }}>{amArtist ? <Canvas color={col(mine)} editable strokes={mineStrokes} onStroke={pushStroke} palette /> : <Canvas color={col(other(mine))} strokes={partnerStrokes} live />}</div>
      <div style={{ display:"flex", gap:10, marginTop:16 }}>
        {!d.revealed
          ? (amArtist ? <button className="press" onClick={gotIt} style={btn(grad,{flex:1})}><Icon name="check" size={18} color="#fff" /> they got it!</button>
                      : <div style={{ flex:1, textAlign:"center", fontFamily:"'Caveat',cursive", fontSize:19, color:C.inkSoft, padding:"12px 0" }}>say your guesses out loud ✶</div>)
          : <button className="press" onClick={next} style={btn(C.sage,{flex:1})}><Icon name="refresh" size={17} color="#fff" /> {m.lock?"new prompt":"swap & new word"}</button>}
      </div>
    </div>
  );
}

/* split */
function Split({ room, mine, m }) {
  const { state, commit, mineStrokes, partnerStrokes, pushStroke, clearMine, saveDrawing } = room;
  const d = state.d;
  const lastRound = useRef(d.round);
  useEffect(() => { if (d.round !== lastRound.current) { lastRound.current = d.round; clearMine(); } }, [d.round]); // eslint-disable-line
  const newRound = () => commit((s)=>{ s.d.prompt=pick(m.prompts); s.d.revealed=false; s.d.title=""; s.d.round=(s.d.round||1)+1; return s; });
  const himS = mine==="him"?mineStrokes:partnerStrokes;
  const herS = mine==="her"?mineStrokes:partnerStrokes;
  return (
    <div>
      <Head label="one prompt, two halves:" prompt={d.prompt} />
      {!d.revealed ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div><SideLabel icon="wave" color={C.blue} text="his half (top)" /><HalfCanvas mine={mine} side="him" editable={mine==="him"} strokes={mine==="him"?mineStrokes:partnerStrokes} onStroke={pushStroke} hidden={mine!=="him"} /></div>
          <div><SideLabel icon="lotus" color={C.rose} text="her half (bottom)" /><HalfCanvas mine={mine} side="her" editable={mine==="her"} strokes={mine==="her"?mineStrokes:partnerStrokes} onStroke={pushStroke} hidden={mine!=="her"} /></div>
        </div>
      ) : (
        <div>
          <div style={{ borderRadius:16, overflow:"hidden", border:`2.5px solid ${C.gold}` }}><Combined top={himS} bot={herS} /></div>
          <input value={d.title||""} onChange={(e)=>commit((s)=>{ s.d.title=e.target.value; return s; })} placeholder="name your masterpiece…" style={{ ...inp, marginTop:10, textAlign:"center", fontFamily:"'Fraunces',serif", fontSize:17 }} />
        </div>
      )}
      <Controls feel={state.feel} d={d} onReveal={()=>commit((s)=>{ s.d.revealed=true; return s; })} onSave={saveDrawing} onNew={newRound} save />
    </div>
  );
}

/* collab */
function Collab({ room, mine, m }) {
  const { state, commit, mineStrokes, partnerStrokes, pushStroke, clearMine, saveDrawing } = room;
  const d = state.d;
  const lastRound = useRef(d.round);
  useEffect(() => { if (d.round !== lastRound.current) { lastRound.current = d.round; clearMine(); } }, [d.round]); // eslint-disable-line
  const all = [...(mineStrokes||[]), ...(partnerStrokes||[])];
  return (
    <div>
      <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:12, justifyContent:"center" }}>
        {m.prompts.map((p)=><button key={p} className="press" onClick={()=>commit((s)=>{ s.d.theme=p; return s; })} style={pill(d.theme===p?C.sage:"rgba(255,255,255,.7)", d.theme===p)}>{p}</button>)}
      </div>
      <Head label="build it together:" prompt={d.theme||m.prompts[0]} />
      <Canvas color={C.sage} editable strokes={all} onStroke={pushStroke} palette height={280} />
      <div style={{ display:"flex", gap:10, marginTop:16 }}>
        <button className="press" onClick={saveDrawing} style={ghost}><Icon name="frame" size={17} color={C.ink} /> save</button>
        <button className="press" onClick={()=>commit((s)=>{ s.d.round=(s.d.round||1)+1; return s; })} style={btn(C.sage,{flex:1})}><Icon name="refresh" size={17} color="#fff" /> clear canvas</button>
      </div>
      <p style={{ textAlign:"center", fontSize:12, color:C.inkSoft, marginTop:10 }}>one shared canvas — you both draw on it live</p>
    </div>
  );
}

/* chain (telephone + corpse) */
function Chain({ room, mine, m }) {
  const { state, commit, mineStrokes, pushStroke, clearMine } = room;
  const d = state.d;
  const chain = d.chain || [];
  const [text, setText] = useState("");
  const lastRound = useRef(d.round);
  useEffect(() => { if (d.round !== lastRound.current) { lastRound.current = d.round; clearMine(); } }, [d.round]); // eslint-disable-line

  if (d.kind === "telephone") {
    const TURN = chain.length % 2 === 1 ? "him" : "her";
    const nextType = chain.length % 2 === 1 ? "draw" : "describe";
    const limit = 5; const done = chain.length >= limit;
    const myTurn = TURN === mine;
    const last = chain[chain.length - 1];
    const pass = () => {
      commit((s) => {
        const ch = [...(s.d.chain || [])];
        if (nextType === "describe") { if (!text.trim()) return s; ch.push({ who: mine, type: "describe", value: text.trim() }); }
        else { ch.push({ who: mine, type: "draw", value: mineStrokes }); }
        s.d.chain = ch; s.d.round = (s.d.round || 1) + 1; return s;
      });
      setText("");
    };
    if (d.revealed || done) return <Reveal chain={chain} onNew={() => commit((s)=>{ s.d.chain=[{who:"her",type:"sentence",value:m.prompts[0]}]; s.d.revealed=false; s.d.round=(s.d.round||1)+1; return s; })} />;
    return (
      <div>
        <div style={{ textAlign:"center", fontFamily:"'Caveat',cursive", fontSize:18, color:C.inkSoft, marginBottom:12 }}>round {chain.length} · {TURN==="him"?"🌊 his":"🌸 her"} turn — only the last step is shown</div>
        <LastEntry entry={last} />
        {myTurn ? (
          <>
            {nextType==="draw" ? <Canvas color={col(mine)} editable strokes={mineStrokes} onStroke={pushStroke} palette /> : <input value={text} onChange={(e)=>setText(e.target.value)} placeholder="describe what you see in one line…" style={{ ...inp, fontFamily:"'Fraunces',serif", fontSize:16 }} />}
            <button className="press" onClick={pass} style={btn(grad,{ width:"100%", marginTop:14 })}><Icon name="arrow" size={18} color="#fff" /> pass to partner</button>
          </>
        ) : <Waiting who={TURN} />}
        <button className="press" onClick={()=>commit((s)=>{ s.d.revealed=true; return s; })} style={{ ...ghost, width:"100%", marginTop:10 }}><Icon name="spark" size={16} color={C.ink} /> end & reveal the chain</button>
      </div>
    );
  }

  /* corpse */
  const SECT = ["head","torso","legs"];
  const step = chain.length; const TURN = step % 2 === 0 ? "him" : "her"; const myTurn = TURN === mine;
  if (d.revealed || step >= SECT.length) return <StackReveal chain={chain} prompt={m.prompts[0]} onNew={()=>commit((s)=>{ s.d.chain=[]; s.d.revealed=false; s.d.round=(s.d.round||1)+1; return s; })} />;
  const pass = () => { commit((s)=>{ const ch=[...(s.d.chain||[])]; ch.push({ who:mine, type:"band", value:mineStrokes }); s.d.chain=ch; s.d.round=(s.d.round||1)+1; return s; }); };
  return (
    <div>
      <div style={{ textAlign:"center", marginBottom:12 }}>
        <div style={{ fontFamily:"'Caveat',cursive", fontSize:18, color:C.inkSoft }}>draw the <b style={{ color:C.ink }}>{SECT[step]}</b> · {TURN==="him"?"🌊 his":"🌸 her"} turn</div>
        <div style={{ fontSize:12, color:C.inkSoft }}>no peeking at the other sections!</div>
      </div>
      {myTurn ? (<>
        <Canvas color={col(mine)} editable strokes={mineStrokes} onStroke={pushStroke} palette height={110} />
        <button className="press" onClick={pass} style={btn(grad,{ width:"100%", marginTop:14 })}><Icon name="arrow" size={18} color="#fff" /> {step+1<SECT.length?"next section":"reveal creature"}</button>
      </>) : <Waiting who={TURN} />}
    </div>
  );
}

/* ===================== shared bits ===================== */
const grad = `linear-gradient(90deg, ${C.blue}, ${C.rose})`;
const inp = { width:"100%", flex:1, padding:"11px 13px", borderRadius:13, border:`1.5px solid ${C.line}`, fontFamily:"inherit", fontSize:14, color:C.ink, background:C.paper, outline:"none" };
const btn = (bg, extra={}) => ({ border:"none", borderRadius:14, padding:"13px", background:bg, color:"#fff", fontWeight:800, fontSize:14.5, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7, ...extra });
const pill = (bg, on) => ({ flex:1, border:on?"none":`1.5px solid ${C.line}`, borderRadius:13, padding:"11px", background:bg, color:on?"#fff":C.inkSoft, fontWeight:800, fontSize:13, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7 });
const col = (s) => s==="him"?C.blue:C.rose;
const other = (s) => s==="him"?"her":"him";
const hide = (w) => (w||"").split("").map((ch)=>ch===" "?"  ":"•").join("");

function useCountdown(d, onZero) {
  const [rem, setRem] = useState(d.duration || 60);
  useEffect(() => {
    if (!d.endsAt) { setRem(d.duration || 60); return; }
    const id = setInterval(() => { const left = Math.max(0, Math.ceil((d.endsAt - Date.now())/1000)); setRem(left); if (left<=0 && !d.revealed) onZero(); }, 250);
    return () => clearInterval(id);
  }, [d.endsAt, d.revealed, d.duration]); // eslint-disable-line
  return rem;
}

function ChipRow({ items, active, onPick }) {
  return <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>{items.map(([id,ic,l])=>(
    <button key={id} className="press" onClick={()=>onPick(id)} style={{ border:`1.5px solid ${active===id?C.sage:C.line}`, background:active===id?C.sage:"rgba(255,255,255,.7)", color:active===id?"#fff":C.inkSoft, borderRadius:999, padding:"7px 12px", cursor:"pointer", fontWeight:700, fontSize:12.5, display:"inline-flex", alignItems:"center", gap:6 }}><Icon name={ic} size={15} color={active===id?"#fff":C.sage} />{l}</button>
  ))}</div>;
}
function Head({ label, prompt, time, endsAt }) {
  return <div style={{ textAlign:"center", marginBottom:14 }}>
    <div style={{ fontFamily:"'Caveat',cursive", fontSize:18, color:C.inkSoft }}>{label}</div>
    <div style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:600, letterSpacing: typeof prompt==="string"&&prompt.startsWith("•")?6:0 }}>{prompt}</div>
    {time!=null && <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginTop:5, color:time<=10?C.roseDeep:C.inkSoft }}><Icon name="timer" size={15} color={time<=10?C.roseDeep:C.inkSoft} /><b>{time}s {endsAt?"":"(not started)"}</b></div>}
  </div>;
}
function SideLabel({ icon, color, text, live }) {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, color, marginBottom:5 }}><Icon name={icon} size={14} color={color} /><span style={{ fontFamily:"'Caveat',cursive", fontSize:16 }}>{text}</span>{live && <span style={{ width:7, height:7, borderRadius:999, background:"#E05a5a" }} />}</div>;
}
function Waiting({ who }) {
  return <div style={{ textAlign:"center", padding:"30px 0", fontFamily:"'Caveat',cursive", fontSize:20, color:C.inkSoft }}><Icon name={who==="him"?"wave":"lotus"} size={22} color={who==="him"?C.blue:C.rose} style={{ margin:"0 auto 6px" }} />it's {who==="him"?"his":"her"} turn — hang tight ✶</div>;
}
function Controls({ feel, d, isP, amArtist, onStart, onReveal, onGotIt, onSave, onNew, save, pictNew }) {
  if (isP) return (
    <div style={{ display:"flex", gap:10, marginTop:16 }}>
      {!d.revealed ? (amArtist ? <button className="press" onClick={onGotIt} style={btn(grad,{flex:1})}><Icon name="check" size={18} color="#fff" /> they got it!</button> : <div style={{ flex:1, textAlign:"center", fontFamily:"'Caveat',cursive", fontSize:19, color:C.inkSoft, padding:"12px 0" }}>say your guesses out loud ✶</div>)
        : <button className="press" onClick={onNew} style={btn(C.sage,{flex:1})}><Icon name="refresh" size={17} color="#fff" /> {pictNew||"new"}</button>}
    </div>
  );
  return (
    <div style={{ display:"flex", gap:10, marginTop:16 }}>
      {feel!=="chill" && !d.revealed && !d.endsAt && onStart && d.duration ? <button className="press" onClick={onStart} style={{ ...ghost, flex:1 }}><Icon name="timer" size={17} color={C.ink} /> start</button> : null}
      {!d.revealed
        ? <button className="press" onClick={onReveal} style={btn(grad,{flex:2})}><Icon name="spark" size={18} color="#fff" /> reveal</button>
        : (<>
            <button className="press" onClick={onSave} style={{ ...ghost, flex:1 }}><Icon name="frame" size={17} color={C.ink} /> save</button>
            <button className="press" onClick={onNew} style={btn(C.sage,{flex:1})}><Icon name="refresh" size={17} color="#fff" /> new</button>
          </>)}
    </div>
  );
}

/* canvases */
function Canvas({ strokes, editable, hidden, live, onStroke, color, height=230, palette }) {
  const ref = useRef(null), drawing = useRef(false), cur = useRef(null);
  const [brush, setBrush] = useState(color);
  useEffect(() => { const c = ref.current; if (!c || drawing.current) return; const x = c.getContext("2d"); x.fillStyle=C.paper; x.fillRect(0,0,c.width,c.height); drawStrokes(x, strokes, 1); }, [strokes]);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return { x: Math.round((e.clientX-r.left)*(320/r.width)), y: Math.round((e.clientY-r.top)*(height/r.height)) }; };
  const down = (e) => { if(!editable) return; drawing.current=true; const p=pos(e); cur.current={color:brush,pts:[[p.x,p.y]]}; ref.current.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if(!editable||!drawing.current) return; e.preventDefault(); const p=pos(e),x=ref.current.getContext("2d"),l=cur.current.pts.at(-1); x.strokeStyle=brush;x.lineWidth=3.4;x.lineCap="round";x.lineJoin="round";x.beginPath();x.moveTo(l[0],l[1]);x.lineTo(p.x,p.y);x.stroke(); cur.current.pts.push([p.x,p.y]); };
  const up = () => { if(!editable||!drawing.current) return; drawing.current=false; if(cur.current?.pts.length) onStroke?.(cur.current); cur.current=null; };
  const colors = [color, C.ink, C.sage, C.gold, C.rose, C.blue];
  return (
    <div>
      <div style={{ position:"relative", borderRadius:16, overflow:"hidden", border:`2px solid ${color}`, boxShadow:`0 8px 20px -14px ${color}` }}>
        <canvas ref={ref} width={320} height={height} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} style={{ width:"100%", display:"block", touchAction:"none", cursor:editable?"crosshair":"default" }} />
        {hidden && <div style={{ position:"absolute", inset:0, backdropFilter:"blur(8px)", background:`${C.cream}e6`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}><Icon name="brush" size={26} color={color} /><span style={{ fontFamily:"'Caveat',cursive", fontSize:19, color }}>hidden until reveal</span></div>}
        {live && <span style={{ position:"absolute", top:8, right:8, width:8, height:8, borderRadius:999, background:"#E05a5a" }} />}
      </div>
      {palette && editable && (
        <div style={{ display:"flex", gap:7, marginTop:8, alignItems:"center" }}>
          <Icon name="palette" size={16} color={C.inkSoft} />
          {colors.map((p)=><button key={p} className="press" onClick={()=>setBrush(p)} style={{ width:20, height:20, borderRadius:999, cursor:"pointer", background:p, border:brush===p?`2px solid ${C.ink}`:`1px solid ${C.line}` }} />)}
        </div>
      )}
    </div>
  );
}
function Pair({ mine, mineStrokes, partnerStrokes, pushStroke, revealed, partnerOnline }) {
  return (
    <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
      <div style={{ flex:"1 1 240px", minWidth:200 }}><SideLabel icon={mine==="him"?"wave":"lotus"} color={col(mine)} text="you" /><Canvas color={col(mine)} editable strokes={mineStrokes} onStroke={pushStroke} palette /></div>
      <div style={{ flex:"1 1 240px", minWidth:200 }}><SideLabel icon={mine==="him"?"lotus":"wave"} color={col(other(mine))} text={partnerOnline?"your partner":"partner (waiting…)"} /><Canvas color={col(other(mine))} strokes={partnerStrokes} hidden={!revealed} /></div>
    </div>
  );
}
function HalfCanvas({ editable, strokes, onStroke, hidden }) {
  return <Canvas color={editable?C.blue:C.rose} editable={editable} strokes={strokes} onStroke={onStroke} hidden={hidden} palette={editable} height={130} />;
}
function Combined({ top, bot }) {
  const ref = useRef(null);
  useEffect(()=>{ const c=ref.current,x=c.getContext("2d"); x.fillStyle=C.paper; x.fillRect(0,0,c.width,c.height); const d=(s,off)=>{ x.lineCap="round";x.lineJoin="round"; for(const st of (s||[])){ if(!st.pts?.length)continue; x.strokeStyle=st.color; x.lineWidth=3.4; x.beginPath(); st.pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]+off):x.moveTo(p[0],p[1]+off)); x.stroke(); } }; d(top,0); d(bot,130); },[top,bot]);
  return <canvas ref={ref} width={320} height={260} style={{ width:"100%", display:"block" }} />;
}
function LastEntry({ entry }) {
  if (!entry) return null;
  return <div style={{ background:C.paper, borderRadius:12, padding:12, border:`1px solid ${C.line}`, marginBottom:12 }}>
    <SideLabel icon={entry.who==="him"?"wave":"lotus"} color={entry.who==="him"?C.blue:C.rose} text={`previous: ${entry.type}`} />
    {entry.type==="draw" ? <Mini strokes={entry.value} /> : <p style={{ fontFamily:"'Fraunces',serif", fontSize:17, margin:"4px 0 0", textAlign:"center" }}>{entry.value}</p>}
  </div>;
}
function Reveal({ chain, onNew }) {
  return <div>
    <div style={{ textAlign:"center", fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:600, marginBottom:12 }}>the chain unraveled ✶</div>
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>{chain.map((c,i)=>(
      <div key={i} style={{ background:C.paper, borderRadius:12, padding:10, border:`1px solid ${C.line}` }}>
        <SideLabel icon={c.who==="him"?"wave":"lotus"} color={c.who==="him"?C.blue:C.rose} text={c.type} />
        {c.type==="draw" ? <Mini strokes={c.value} /> : <p style={{ fontFamily:"'Fraunces',serif", fontSize:16, margin:"4px 0 0" }}>{c.value}</p>}
      </div>
    ))}</div>
    <button className="press" onClick={onNew} style={btn(C.sage,{ width:"100%", marginTop:14 })}><Icon name="refresh" size={17} color="#fff" /> play again</button>
  </div>;
}
function StackReveal({ chain, prompt, onNew }) {
  const ref = useRef(null);
  useEffect(()=>{ const c=ref.current,x=c.getContext("2d"); x.fillStyle=C.paper; x.fillRect(0,0,c.width,c.height); x.lineCap="round";x.lineJoin="round"; chain.forEach((b,bi)=>{ const off=bi*110; for(const st of (b.value||[])){ if(!st.pts?.length)continue; x.strokeStyle=st.color; x.lineWidth=3.4; x.beginPath(); st.pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]+off):x.moveTo(p[0],p[1]+off)); x.stroke(); } }); },[chain]);
  return <div>
    <div style={{ textAlign:"center", fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:600, marginBottom:6 }}>{prompt} ✶</div>
    <div style={{ borderRadius:16, overflow:"hidden", border:`2.5px solid ${C.gold}` }}><canvas ref={ref} width={320} height={330} style={{ width:"100%", display:"block" }} /></div>
    <p style={{ textAlign:"center", fontFamily:"'Caveat',cursive", fontSize:20, color:C.inkSoft, marginTop:8 }}>your beautiful monster</p>
    <button className="press" onClick={onNew} style={btn(C.sage,{ width:"100%", marginTop:10 })}><Icon name="refresh" size={17} color="#fff" /> play again</button>
  </div>;
}
function Mini({ strokes }) {
  const ref = useRef(null);
  useEffect(()=>{ const c=ref.current,x=c.getContext("2d"); x.fillStyle=C.paper; x.fillRect(0,0,c.width,c.height); drawStrokes(x, strokes, 1); },[strokes]);
  return <canvas ref={ref} width={320} height={230} style={{ width:"100%", display:"block", borderRadius:10, marginTop:4 }} />;
}
