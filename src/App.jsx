import { useState } from "react";
import { useSession, signOut } from "./lib/auth";
import { Background, C, Icon } from "./ui";
import { Auth } from "./components/Auth";
import { Join } from "./components/Join";
import { Game } from "./components/Game";

export default function App() {
  const { user, loading } = useSession();
  const [session, setSession] = useState(null); // { room, code, side }

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
          <Join onEnter={setSession} />
          <div style={{ textAlign: "center", paddingBottom: 24 }}>
            <button className="press" onClick={signOut} style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>sign out</button>
          </div>
        </div>
      ) : (
        <Game session={session} user={user} onLeave={() => setSession(null)} />
      )}
    </Background>
  );
}
