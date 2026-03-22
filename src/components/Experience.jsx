import { Environment, OrthographicCamera } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { useRef } from "react";
import { CharacterController } from "./CharacterController";
import { Map } from "./Map";
import { RemoteCharacter } from "./RemoteCharacter";
import { TaskStation } from "./TaskStation";
import { useGame } from "../context/GameContext";

const MAP_CONFIGS = {
  medieval_fantasy_book: { scale: 0.4,  position: [-4, 0, -6] },
  castle_on_hills:       { scale: 3,    position: [-6, -7, 0] },
  city_scene_tokyo:      { scale: 0.72, position: [0, -1, -3.5] },
};

// Tasks placed right around spawn — y=0.3 matches ground level near spawn
const TASK_POSITIONS_BY_MAP = {
  medieval_fantasy_book: [[ 6.29, -1.11, 1.85], [9.14, -1.29, -11.85], [-10.83, 0.11, -1.91]],
  castle_on_hills:       [[-0.23, 0.8, 3.05], [-8.61, 0.05, 4.49], [-7.61, -1.61, 8.84]],
  city_scene_tokyo:      [[ 6.44, -1.08,  1.23], [ 5.09, -1.13, -3.98], [ 1.06, -0.71,  1.21]],
};

const Scene = ({ onNearbyPlayer, onNearbyDead }) => {
  const shadowCameraRef = useRef();
  const { room, myId } = useGame();
  const map = room?.map || "medieval_fantasy_book";
  const cfg = MAP_CONFIGS[map] || MAP_CONFIGS.medieval_fantasy_book;
  const taskPositions = TASK_POSITIONS_BY_MAP[map] || TASK_POSITIONS_BY_MAP.medieval_fantasy_book;
  const players = room?.players ?? {};

  return (
    <>
      <Environment preset="sunset" />
      <directionalLight
        intensity={0.65}
        castShadow
        position={[-15, 10, 15]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00005}
      >
        <OrthographicCamera
          left={-22} right={15} top={10} bottom={-20}
          ref={shadowCameraRef}
          attach="shadow-camera"
        />
      </directionalLight>

      <Physics key={map}>
        <Map scale={cfg.scale} position={cfg.position} model={`models/${map}.glb`} />
        <CharacterController
          onNearbyPlayer={onNearbyPlayer}
          onNearbyDead={onNearbyDead}
        />
        {Object.keys(players).map(id => {
          if (id === myId) return null;
          return <RemoteCharacter key={id} id={id} playerData={players[id]} />;
        })}
        {taskPositions.map((pos, i) => (
          <TaskStation key={i} position={pos} taskIndex={i} onComplete={() => {}} />
        ))}
      </Physics>
    </>
  );
};

export const Experience = ({ onNearbyPlayer, onNearbyDead }) => (
  <Scene onNearbyPlayer={onNearbyPlayer} onNearbyDead={onNearbyDead} />
);
