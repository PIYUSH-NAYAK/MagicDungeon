import { Environment, OrthographicCamera, Html } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { useControls } from "leva";
import { useRef } from "react";
import { CharacterController } from "./CharacterController";
import { Map } from "./Map";
import { SocketManager, useSocket } from "./SocketManager";
import { RemoteCharacter } from "./RemoteCharacter";

const maps = {
  castle_on_hills: {
    scale: 3,
    position: [-6, -7, 0],
  },
  animal_crossing_map: {
    scale: 20,
    position: [-15, -1, 10],
  },
  city_scene_tokyo: {
    scale: 0.72,
    position: [0, -1, -3.5],
  },
  de_dust_2_with_real_light: {
    scale: 0.3,
    position: [-5, -3, 13],
  },
  medieval_fantasy_book: {
    scale: 0.4,
    position: [-4, 0, -6],
  },
};

const Scene = () => {
    const shadowCameraRef = useRef();
    const map = "castle_on_hills";
    const { players, socket } = useSocket();

    return (
      <>
        {/* <OrbitControls /> */}
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
            left={-22}
            right={15}
            top={10}
            bottom={-20}
            ref={shadowCameraRef}
            attach={"shadow-camera"}
          />
        </directionalLight>
        <Physics key={map}>
          <Map
            scale={maps[map].scale}
            position={maps[map].position}
            model={`models/${map}.glb`}
          />
          <CharacterController />
            {/* Render Remote Players */}
            {console.log("Rendering players:", players)}
            {Object.keys(players).map((id) => {
            if (socket && id === socket.id) return null;
            return <RemoteCharacter key={id} data={players[id]} />;
            })}
        </Physics>
      </>
    );
};

const UI = () => {
  const { players, socket } = useSocket();
  const isConnected = !!socket;
  const playerIds = Object.keys(players);

  return (
    <Html fullscreen>
      <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000, background: 'rgba(0,0,0,0.5)', color: 'white', padding: 10, borderRadius: 5 }}>
        <div>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
        <div>My ID: {socket ? socket.id : '-'}</div>
        <hr style={{ borderColor: 'rgba(255,255,255,0.2)' }}/>
        <div>Players ({playerIds.length}):</div>
        <ul style={{ paddingLeft: 20, margin: 0, fontSize: 12 }}>
          {playerIds.map(id => (
            <li key={id} style={{ color: socket && id === socket.id ? '#4ade80' : 'white' }}>
              {id.slice(0, 5)}... {socket && id === socket.id ? '(You)' : ''}
              <br/>
              Pos: [{players[id]?.position?.[0]?.toFixed(1) || 0}, {players[id]?.position?.[2]?.toFixed(1) || 0}]
            </li>
          ))}
        </ul>
      </div>
    </Html>
  );
};

export const Experience = () => {
  return (
    <SocketManager>
        <UI />
        <Scene />
    </SocketManager>
  );
};
