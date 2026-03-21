import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { Character } from "./Character";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "../context/GameContext";

const _target = new THREE.Vector3();

export const RemoteCharacter = ({ id, playerData }) => {
  const { playerTransformsRef } = useGame();

  const group        = useRef();   // outer — owns world position
  const inner        = useRef();   // inner — owns y-rotation
  const initialized  = useRef(false);
  const prevAnimRef  = useRef("idle");
  const [animation, setAnimation] = useState("idle");
  const [readyToShow, setReadyToShow] = useState(false); // hide until first real position


  // useFrame owns the position completely — no position prop on the group.
  // React NEVER touches group.position, so there is no prop/lerp conflict.
  useFrame((_, delta) => {
    if (!group.current || !inner.current) return;

    const t = playerTransformsRef.current.get(id);
    if (!t?.position) return;

    _target.set(t.position[0], t.position[1], t.position[2]);

    if (!initialized.current) {
      // Snap to server position on the very first frame data arrives.
      // This prevents the character from briefly appearing at (0,0,0)
      // and sliding underground before settling at the correct location.
      group.current.position.copy(_target);
      initialized.current = true;
      setReadyToShow(true);  // now safe to show — position is ground-level
    } else {
      group.current.position.lerp(_target, delta * 12);
    }

    // Rotation
    inner.current.rotation.y = THREE.MathUtils.lerp(
      inner.current.rotation.y, t.rotation ?? 0, delta * 15,
    );

    // Update animation state only on clip transitions (not every frame)
    const nextAnim = t.animation ?? "idle";
    if (nextAnim !== prevAnimRef.current) {
      prevAnimRef.current = nextAnim;
      setAnimation(nextAnim);
    }
  });

  if (!playerData) return null;

  const isAlive = playerData.alive !== false;

  return (
    // NO position prop — useFrame owns the group.position entirely.
    // Setting position here would conflict and snap characters underground on
    // every React re-render (animation change, roomUpdate, etc.).
    <group ref={group} visible={readyToShow}>

      <group ref={inner}>
        <Character
          animation={isAlive ? animation : "idle"}
          color={playerData.color}
          scale={0.18}
          position-y={-0.25}
        />

        {/* Name tag */}
        <Html position={[0, 2.2, 0]} center distanceFactor={10}>
          <div style={{
            fontFamily: "Arial, sans-serif",
            fontWeight: "bold",
            color: isAlive ? (playerData.color || "#fff") : "rgba(150,150,200,.7)",
            backgroundColor: isAlive ? "rgba(0,0,0,.65)" : "rgba(30,20,60,.8)",
            padding: "3px 8px",
            borderRadius: "12px",
            fontSize: "11px",
            whiteSpace: "nowrap",
            userSelect: "none",
            border: `1px solid ${isAlive
              ? (playerData.color || "#ffffff") + "44"
              : "rgba(150,150,200,.2)"}`,
            opacity: isAlive ? 1 : 0.6,
          }}>
            {playerData.name || `Player ${id?.slice(0, 4)}`}
            {!isAlive && <span style={{ marginLeft: 4, fontSize: 9 }}>💀</span>}
          </div>
        </Html>

        {!isAlive && (
          <Html position={[0, 0.5, 0]} center distanceFactor={6}>
            <div style={{ fontSize: "1.2rem", opacity: 0.5 }}>👻</div>
          </Html>
        )}
      </group>
    </group>
  );
};
