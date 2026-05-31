import { useState } from "react";
import { useSession, signOut } from "./lib/auth";
import { Background, C, Icon } from "./ui";
import { Auth } from "./components/Auth";
import { Join } from "./components/Join";
import { Game } from "./components/Game";

const SESSION_KEY = "hs_room_session";

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
}
function saveSession(s) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export default function App() {
  const { user, loading } = useSession();
  const [session, setSession] = useState(() => loadSaved());

  const enter = (s) => { saveSession(s); setSession(s); };
  const leave = () => { clearSession(); setSession(null); };
  const handleSignOut = () => { clearSession(); signOut(); };

  return (
    <Background>
      {loading ? (
        <div style={{ position: "relative", zIndex: 2, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft }}>
          <Icon name="heart" size={28} color={C.rose} />
        </div>
      ) : !user ? (
        <Auth />
      ) : !session ? (
        <div style={{ position: "relative", zIndex: 2 }}>
          <Join onEnter={enter} />
          <div style={{ textAlign: "center", paddingBottom: 24 }}>
            <button className="press" onClick={handleSignOut} style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>sign out</button>
          </div>
        </div>
      ) : (
        <Game session={session} user={user} onLeave={leave} onSignOut={handleSignOut} />
      )}
    </Background>
  );
}
