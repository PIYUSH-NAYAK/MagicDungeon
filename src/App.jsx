import { useState } from "react";
import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { GameProvider, useGame } from "./context/GameContext";
import { HUD } from "./components/HUD";
import { SplashScreen } from "./screens/SplashScreen";
import { MainMenu } from "./screens/MainMenu";
import { LobbyScreen } from "./screens/LobbyScreen";
import { CharacterSelect } from "./screens/CharacterSelect";
import { GameMode } from "./screens/GameMode";
import { Countdown } from "./screens/Countdown";
import { RoleReveal } from "./screens/RoleReveal";
import { MeetingScreen } from "./screens/MeetingScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { Experience } from "./components/Experience";

const keyboardMap = [
  { name: "forward",  keys: ["ArrowUp",    "KeyW"] },
  { name: "backward", keys: ["ArrowDown",  "KeyS"] },
  { name: "left",     keys: ["ArrowLeft",  "KeyA"] },
  { name: "right",    keys: ["ArrowRight", "KeyD"] },
  { name: "run",      keys: ["Shift"] },
  { name: "interact", keys: ["KeyE"] },
];

const SCREENS = {
  splash:           SplashScreen,
  menu:             MainMenu,
  lobby:            LobbyScreen,
  character_select: CharacterSelect,
  game_mode:        GameMode,
  countdown:        Countdown,
  role_reveal:      RoleReveal,
  meeting:          MeetingScreen,
  results:          ResultsScreen,
};

function GameRouter() {
  const { phase, killPlayer, reportBody, callEmergencyMeeting } = useGame();
  const [nearbyPlayerId, setNearbyPlayerId] = useState(null);
  const [nearbyDeadId,   setNearbyDeadId]   = useState(null);

  // Pre-game / post-game UI screens
  const Screen = SCREENS[phase];
  if (Screen) return <Screen />;

  // "playing" phase — the HUD is a DOM sibling of Canvas (not inside it)
  return (
    <KeyboardControls map={keyboardMap}>
      {/* Plain DOM overlay HUD — position:fixed, sits above the Canvas */}
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
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}

export default App;
