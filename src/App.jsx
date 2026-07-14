import { useState } from "react";
import { useSession } from "./lib/auth";
import { Background, C, Icon } from "./ui";
import { Auth } from "./components/Auth";
import { Landing } from "./components/Landing";
import { Join } from "./components/Join";
import { Game } from "./components/Game";
import { PhotoBooth } from "./components/PhotoBooth";

/* ============================================================================
   App routing:
   auth → Landing (pick an experience) →
     • distance → Join (sides) → Game (synced, two devices)
     • booth    → PhotoBooth (solo or coded room)
     • together → Join (names) → Game (local: one shared device)
   ============================================================================ */

export default function App() {
  const { user, loading } = useSession();
  const [section, setSection] = useState(null);  // null | distance | booth | together
  const [session, setSession] = useState(null);  // { room, code, side, local?, names? }

  const home = () => { setSession(null); setSection(null); };

  return (
    <Background>
      {loading ? (
        <div style={{ position: "relative", zIndex: 2, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft }}>
          <Icon name="heart" size={28} color={C.rose} />
        </div>
      ) : !user ? (
        <Auth />
      ) : !section ? (
        <Landing user={user} onPick={setSection} />
      ) : section === "booth" ? (
        <PhotoBooth user={user} onBack={home} />
      ) : !session ? (
        <Join mode={section === "together" ? "together" : "distance"} user={user} onEnter={setSession} onBack={home} />
      ) : (
        <Game session={session} user={user} onLeave={home} />
      )}
    </Background>
  );
}
