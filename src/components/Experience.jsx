import { Environment, OrthographicCamera } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { useRef, useState } from "react";
import { CharacterController } from "./CharacterController";
import { Map } from "./Map";
import { RemoteCharacter } from "./RemoteCharacter";
import { HUD } from "./HUD";
import { TaskStation } from "./TaskStation";
import { useGame } from "../context/GameContext";

const MAP_CONFIGS = {
  castle_on_hills:         { scale: 3,    position: [-6, -7, 0] },
  animal_crossing_map:     { scale: 20,   position: [-15, -1, 10] },
  city_scene_tokyo:        { scale: 0.72, position: [0, -1, -3.5] },
  de_dust_2_with_real_light: { scale: 0.3, position: [-5, -3, 13] },
  medieval_fantasy_book:   { scale: 0.4,  position: [-4, 0, -6] },
};

// Fixed task station positions in the castle map
const TASK_POSITIONS = [
  [2, 0.3, 1],
  [-3, 0.3, 3],
  [4, 0.3, -2],
];

const Scene = ({ nearbyPlayerId, nearbyDeadId, onNearbyPlayer, onNearbyDead }) => {
  const shadowCameraRef = useRef();
  const { room, myId } = useGame();
  const map = "castle_on_hills";
  const cfg = MAP_CONFIGS[map];
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

        {/* Task Stations */}
        {TASK_POSITIONS.map((pos, i) => (
          <TaskStation
            key={i}
            position={pos}
            taskIndex={i}
            onComplete={() => {}}
          />
        ))}
      </Physics>
    </>
  );
};

export const Experience = () => {
  const { killPlayer, reportBody, callEmergencyMeeting } = useGame();
  const [nearbyPlayerId, setNearbyPlayerId] = useState(null);
  const [nearbyDeadId,   setNearbyDeadId]   = useState(null);

  return (
    <>
      <HUD
        nearbyPlayerId={nearbyPlayerId}
        nearbyDeadId={nearbyDeadId}
        onKill={()      => killPlayer(nearbyPlayerId)}
        onReport={()    => reportBody(nearbyDeadId)}
        onEmergency={()  => callEmergencyMeeting()}
      />
      <Scene
        nearbyPlayerId={nearbyPlayerId}
        nearbyDeadId={nearbyDeadId}
        onNearbyPlayer={setNearbyPlayerId}
        onNearbyDead={setNearbyDeadId}
      />
    </>
  );
};
