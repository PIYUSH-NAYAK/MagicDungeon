import { useState } from "react";
import { MapTestScreen } from "./screens/MapTestScreen";
import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { GameProvider, useGame } from "./context/GameContext";
import { HUD } from "./components/HUD";
import { ChainLog } from "./components/ChainLog";
import { WalletProvider } from "./providers/WalletProvider";
import { SplashScreen } from "./screens/SplashScreen";
import { MainMenu } from "./screens/MainMenu";
import { LobbyScreen } from "./screens/LobbyScreen";
import { CharacterSelect } from "./screens/CharacterSelect";
import { GameMode } from "./screens/GameMode";
import { Countdown } from "./screens/Countdown";
import { DelegatingScreen } from "./screens/DelegatingScreen";
import { RoleReveal } from "./screens/RoleReveal";
import { MeetingScreen } from "./screens/MeetingScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { Experience } from "./components/Experience";
import { Toaster } from "sonner";

const keyboardMap = [
  { name: "forward",  keys: ["ArrowUp",    "KeyW"] },
  { name: "backward", keys: ["ArrowDown",  "KeyS"] },
  { name: "left",     keys: ["ArrowLeft",  "KeyA"] },
  { name: "right",    keys: ["ArrowRight", "KeyD"] },
  { name: "run",      keys: ["Shift"] },
  { name: "interact", keys: ["KeyE"] },
  { name: "jump",     keys: ["Space"] },
];

const SCREENS = {
  splash:           SplashScreen,
  menu:             MainMenu,
  lobby:            LobbyScreen,
  character_select: CharacterSelect,
  game_mode:        GameMode,
  delegating:       DelegatingScreen,
  countdown:        Countdown,
  role_reveal:      RoleReveal,
  meeting:          MeetingScreen,
  results:          ResultsScreen,
};

function GameRouter() {
  const { phase, killPlayer, reportBody, callEmergencyMeeting, txLogs } = useGame();
  const [nearbyPlayerId, setNearbyPlayerId] = useState(null);
  const [nearbyDeadId,   setNearbyDeadId]   = useState(null);

  // Global ChainLog overlay — visible on ALL screens
  const chainLogEl = <ChainLog logs={txLogs} />;

  // Pre-game / post-game UI screens
  const Screen = SCREENS[phase];
  if (Screen) return <>{chainLogEl}<Screen /></>;

  // "playing" phase — the HUD is a DOM sibling of Canvas (not inside it)
  return (
    <KeyboardControls map={keyboardMap}>
      {chainLogEl}
      <HUD
        nearbyPlayerId={nearbyPlayerId}
        nearbyDeadId={nearbyDeadId}
        onKill={()       => killPlayer(nearbyPlayerId)}
        onReport={()     => reportBody(nearbyDeadId)}
        onEmergency={()  => callEmergencyMeeting()}
      />
      <Canvas
        shadows
        camera={{ position: [3, 3, 3], near: 0.1, fov: 70 }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={["#1a1a2e"]} />
        <Experience
          onNearbyPlayer={setNearbyPlayerId}
          onNearbyDead={setNearbyDeadId}
        />
      </Canvas>
    </KeyboardControls>
  );
}

function App() {
  if (new URLSearchParams(window.location.search).has("test")) return <MapTestScreen />;

  return (
    <WalletProvider>
      <Toaster position="bottom-left" richColors />
      <GameProvider>
        <GameRouter />
      </GameProvider>
    </WalletProvider>
  );
}

export default App;
