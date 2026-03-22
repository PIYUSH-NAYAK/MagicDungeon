import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { Character } from "./Character";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "../context/GameContext";

const _target = new THREE.Vector3();

export const RemoteCharacter = ({ id, playerData }) => {
  const { playerTransformsRef, isAlive: iAmAlive } = useGame();

  const group       = useRef();   // visual position (lerped)
  const inner       = useRef();   // y-rotation
  const initialized = useRef(false);
  const prevAnimRef = useRef("idle");
  const [animation,   setAnimation]   = useState("idle");
  const [readyToShow, setReadyToShow] = useState(false);

  const remoteAlive = playerData?.alive !== false;

  // Living players cannot see ghosts; dead players can see ghosts
  const shouldRender = remoteAlive || !iAmAlive;

  useFrame(({ clock }, delta) => {
    if (!group.current || !inner.current) return;

    const t = playerTransformsRef.current.get(id);
    if (!t?.position) return;

    _target.set(t.position[0], t.position[1], t.position[2]);

    if (!initialized.current) {
      group.current.position.copy(_target);
      initialized.current = true;
      setReadyToShow(true);
    } else {
      group.current.position.lerp(_target, delta * 12);
    }

    // Rotation
    inner.current.rotation.y = THREE.MathUtils.lerp(
      inner.current.rotation.y, t.rotation ?? 0, delta * 15,
    );

    // Ghost float
    if (!remoteAlive) {
      inner.current.position.y = Math.sin(clock.elapsedTime * 2.2 + id.charCodeAt(0)) * 0.07;
    } else {
      inner.current.position.y = 0;
    }

    // Animation
    const nextAnim = t.animation ?? "idle";
    if (nextAnim !== prevAnimRef.current) {
      prevAnimRef.current = nextAnim;
      setAnimation(nextAnim);
    }
  });

  if (!playerData || !shouldRender) return null;

  return (
    <>
      {/* Visual */}
      <group ref={group} visible={readyToShow}>
        <group ref={inner}>
          <Character
            animation={remoteAlive ? animation : "idle"}
            color={remoteAlive ? playerData.color : undefined}
            ghost={!remoteAlive}
            scale={0.18}
            position-y={-0.25}
          />

          {/* Name tag — only shown to alive viewers for alive players, or dead viewers for all */}
          <Html position={[0, 2.2, 0]} center distanceFactor={10}>
            <div style={{
              fontFamily: "Arial, sans-serif",
              fontWeight: "bold",
              color: remoteAlive ? (playerData.color || "#fff") : "rgba(180,210,255,.8)",
              backgroundColor: remoteAlive ? "rgba(0,0,0,.65)" : "rgba(20,30,60,.75)",
              padding: "3px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              whiteSpace: "nowrap",
              userSelect: "none",
              border: `1px solid ${remoteAlive
                ? (playerData.color || "#ffffff") + "44"
                : "rgba(150,180,255,.25)"}`,
              opacity: remoteAlive ? 1 : 0.7,
            }}>
              {playerData.name || `Player ${id?.slice(0, 4)}`}
              {!remoteAlive && <span style={{ marginLeft: 4, fontSize: 9 }}>👻</span>}
            </div>
          </Html>
        </group>
      </group>
    </>
  );
};
