import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody } from "@react-three/rapier";
import { useControls } from "leva";
import { useEffect, useRef, useState } from "react";
import { MathUtils, Vector3 } from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { useGame } from "../context/GameContext";
import { Character } from "./Character";

const normalizeAngle = (angle) => {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
};

const lerpAngle = (start, end, t) => {
  start = normalizeAngle(start);
  end   = normalizeAngle(end);
  if (Math.abs(end - start) > Math.PI) {
    if (end > start) start += 2 * Math.PI;
    else             end   += 2 * Math.PI;
  }
  return normalizeAngle(start + (end - start) * t);
};

const KILL_RANGE   = 2.5;
const REPORT_RANGE = 3.0;

export const CharacterController = ({ onNearbyPlayer, onNearbyDead }) => {
  const { WALK_SPEED, RUN_SPEED, ROTATION_SPEED } = useControls("Character Control", {
    WALK_SPEED:     { value: 0.8,           min: 0.1, max: 4,           step: 0.1 },
    RUN_SPEED:      { value: 1.6,           min: 0.2, max: 12,          step: 0.1 },
    ROTATION_SPEED: { value: degToRad(0.5), min: degToRad(0.1), max: degToRad(5), step: degToRad(0.1) },
  });

  const rb        = useRef();
  const container = useRef();
  const character = useRef();

  const [animationState, setAnimationState] = useState("idle");
  const animRef = useRef("idle");

  const characterRotationTarget  = useRef(0);
  const rotationTarget           = useRef(0);
  const cameraTarget             = useRef();
  const cameraPosition           = useRef();
  const cameraWorldPosition      = useRef(new Vector3());
  const cameraLookAtWorldPosition= useRef(new Vector3());
  const cameraLookAt             = useRef(new Vector3());

  const [, get]    = useKeyboardControls();
  const isClicking = useRef(false);

  const { emitMove, myPlayer, room, myId, isAlive, playerTransformsRef } = useGame();

  const nearbyPlayerRef = useRef(null);
  const nearbyDeadRef   = useRef(null);

  useEffect(() => {
    // Only enable click-to-move when the click lands on the WebGL canvas,
    // not on DOM overlays (task mini-game, HUD buttons, meeting screen, etc.)
    const isCanvas = (e) => e.target?.tagName === "CANVAS";
    const down = (e) => { if (isCanvas(e)) isClicking.current = true;  };
    const up   = ()  => { isClicking.current = false; };
    document.addEventListener("mousedown",  down);
    document.addEventListener("mouseup",    up);
    document.addEventListener("touchstart", down);
    document.addEventListener("touchend",   up);
    return () => {
      document.removeEventListener("mousedown",  down);
      document.removeEventListener("mouseup",    up);
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchend",   up);
    };
  }, []);

  useFrame(({ camera, mouse, clock }) => {
    if (!rb.current || !character.current || !container.current) return;

    const vel      = rb.current.linvel();
    const movement = { x: 0, z: 0 };

    if (isAlive) {
      if (get().forward)  movement.z =  1;
      if (get().backward) movement.z = -1;
      if (get().left)     movement.x =  1;
      if (get().right)    movement.x = -1;

      if (isClicking.current) {
        if (Math.abs(mouse.x) > 0.1) movement.x = -mouse.x;
        movement.z = mouse.y + 0.4;
      }
    }

    const isRunning = get().run ||
      (isClicking.current && (Math.abs(movement.x) > 0.5 || Math.abs(movement.z) > 0.5));

    if (movement.x !== 0) rotationTarget.current += ROTATION_SPEED * movement.x;

    if (movement.x !== 0 || movement.z !== 0) {
      characterRotationTarget.current = Math.atan2(movement.x, movement.z);
      vel.x = Math.sin(rotationTarget.current + characterRotationTarget.current) * (isRunning ? RUN_SPEED : WALK_SPEED);
      vel.z = Math.cos(rotationTarget.current + characterRotationTarget.current) * (isRunning ? RUN_SPEED : WALK_SPEED);
      const nextAnim = isRunning ? "run" : "walk";
      if (animRef.current !== nextAnim) { animRef.current = nextAnim; setAnimationState(nextAnim); }
    } else {
      vel.x = 0; vel.z = 0;
      if (animRef.current !== "idle") { animRef.current = "idle"; setAnimationState("idle"); }
    }

    character.current.rotation.y = lerpAngle(
      character.current.rotation.y, characterRotationTarget.current, 0.1,
    );

    // Ghost float
    if (!isAlive) {
      vel.y = Math.sin(clock.elapsedTime * 2.2) * 0.3; // gentle bob via physics velocity
    }

    rb.current.setLinvel(vel, true);

    // Soft repulsion from other alive players (no physics bodies needed)
    if (room) {
      const pos = rb.current.translation();
      const PLAYER_RADIUS = 0.55;
      for (const [id, p] of Object.entries(room.players)) {
        if (id === myId || !p.alive) continue;
        const t = playerTransformsRef.current.get(id);
        if (!t?.position) continue;
        const dx = pos.x - t.position[0];
        const dz = pos.z - t.position[2];
        const d  = Math.sqrt(dx * dx + dz * dz);
        if (d < PLAYER_RADIUS && d > 0.001) {
          const push = ((PLAYER_RADIUS - d) / PLAYER_RADIUS) * 3;
          const cv = rb.current.linvel();
          rb.current.setLinvel({ x: cv.x + (dx / d) * push, y: cv.y, z: cv.z + (dz / d) * push }, true);
        }
      }
    }

    const pos = rb.current.translation();
    emitMove([pos.x, pos.y, pos.z], character.current.rotation.y, animRef.current);

    // Proximity detection
    if (room) {
      let closestAlive = null, closestAliveDist = Infinity;
      let closestDead  = null, closestDeadDist  = Infinity;
      for (const [id, p] of Object.entries(room.players)) {
        if (id === myId) continue;
        const t = playerTransformsRef.current.get(id);
        if (!t?.position) continue;
        const dx = pos.x - t.position[0];
        const dz = pos.z - t.position[2];
        const d  = Math.sqrt(dx * dx + dz * dz);
        if ( p.alive && d < KILL_RANGE   && d < closestAliveDist) { closestAliveDist = d; closestAlive = id; }
        if (!p.alive && d < REPORT_RANGE && d < closestDeadDist)  { closestDeadDist  = d; closestDead  = id; }
      }
      if (closestAlive !== nearbyPlayerRef.current) { nearbyPlayerRef.current = closestAlive; onNearbyPlayer?.(closestAlive); }
      if (closestDead  !== nearbyDeadRef.current)   { nearbyDeadRef.current  = closestDead;  onNearbyDead?.(closestDead);   }
    }

    // Camera
    container.current.rotation.y = MathUtils.lerp(container.current.rotation.y, rotationTarget.current, 0.1);
    cameraPosition.current.getWorldPosition(cameraWorldPosition.current);
    camera.position.lerp(cameraWorldPosition.current, 0.1);
    if (cameraTarget.current) {
      cameraTarget.current.getWorldPosition(cameraLookAtWorldPosition.current);
      cameraLookAt.current.lerp(cameraLookAtWorldPosition.current, 0.1);
      camera.lookAt(cameraLookAt.current);
    }
  });

  const [spawnPos] = useState(() => {
    const p = room?.players?.[myId];
    return p?.position ? [p.position[0], 3, p.position[2]] : [0, 3, 0];
  });

  return (
    <RigidBody colliders={false} lockRotations ref={rb} position={spawnPos}
      gravityScale={isAlive ? 1 : 0}
    >
      <group ref={container}>
        <group ref={cameraTarget}   position-y={0.8} />
        <group ref={cameraPosition} position-y={0.6} position-z={-2} />
        <group ref={character}>
          <Character
            scale={0.18}
            position-y={-0.25}
            animation={isAlive ? animationState : "idle"}
            color={myPlayer?.color}
            ghost={!isAlive}
          />
        </group>
      </group>
      <CapsuleCollider args={[0.08, 0.15]} />
    </RigidBody>
  );
};
