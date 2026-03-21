import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { GameProvider, useGame } from "./context/GameContext";
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
  const { phase } = useGame();

  // Pre-game / post-game UI screens
  const Screen = SCREENS[phase];
  if (Screen) return <Screen />;

  // "playing" phase — mount the 3D world
  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        shadows
        camera={{ position: [3, 3, 3], near: 0.1, fov: 40 }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={["#ececec"]} />
        <Experience />
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
