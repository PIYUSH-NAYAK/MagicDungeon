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
    else end += 2 * Math.PI;
  }
  return normalizeAngle(start + (end - start) * t);
};

const KILL_RANGE   = 2.5;
const REPORT_RANGE = 3.0;

export const CharacterController = ({ onNearbyPlayer, onNearbyDead }) => {
  const { WALK_SPEED, RUN_SPEED, ROTATION_SPEED } = useControls(
    "Character Control",
    {
      WALK_SPEED: { value: 0.8, min: 0.1, max: 4, step: 0.1 },
      RUN_SPEED: { value: 1.6, min: 0.2, max: 12, step: 0.1 },
      ROTATION_SPEED: {
        value: degToRad(0.5),
        min: degToRad(0.1),
        max: degToRad(5),
        step: degToRad(0.1),
      },
    }
  );

  const rb        = useRef();
  const container = useRef();
  const character = useRef();

  // useState drives local Character render; animRef is read synchronously inside useFrame
  const [animationState, setAnimationState] = useState("idle");
  const animRef = useRef("idle");

  const characterRotationTarget = useRef(0);
  const rotationTarget          = useRef(0);
  const cameraYaw               = useRef(0);  // world-space camera yaw, free of feedback loops
  const cameraTarget            = useRef();
  const cameraPosition          = useRef();
  const cameraWorldPosition     = useRef(new Vector3());
  const cameraLookAtWorldPosition = useRef(new Vector3());
  const cameraLookAt            = useRef(new Vector3());
  const [, get]                 = useKeyboardControls();
  const isClicking              = useRef(false);

  const { emitMove, myPlayer, room, myId, isAlive, playerTransformsRef } = useGame();

  // Track nearby players/corpses
  const nearbyPlayerRef = useRef(null);
  const nearbyDeadRef   = useRef(null);

  useEffect(() => {
    const onMouseDown = () => { isClicking.current = true; };
    const onMouseUp   = () => { isClicking.current = false; };
    document.addEventListener("mousedown",  onMouseDown);
    document.addEventListener("mouseup",    onMouseUp);
    document.addEventListener("touchstart", onMouseDown);
    document.addEventListener("touchend",   onMouseUp);
    return () => {
      document.removeEventListener("mousedown",  onMouseDown);
      document.removeEventListener("mouseup",    onMouseUp);
      document.removeEventListener("touchstart", onMouseDown);
      document.removeEventListener("touchend",   onMouseUp);
    };
  }, []);

  useFrame(({ camera, mouse }) => {
    if (!rb.current || !character.current || !container.current) return;

    const vel      = rb.current.linvel();
    const movement = { x: 0, z: 0 };

    if (isAlive) {
      if (get().forward)  movement.z =  1;
      if (get().backward) movement.z = -1;

      let speed = get().run ? RUN_SPEED : WALK_SPEED;

      if (isClicking.current) {
        if (Math.abs(mouse.x) > 0.1) movement.x = -mouse.x;
        movement.z = mouse.y + 0.4;
        if (Math.abs(movement.x) > 0.5 || Math.abs(movement.z) > 0.5) speed = RUN_SPEED;
      }

      if (get().left)  movement.x =  1;
      if (get().right) movement.x = -1;
    }

    if (movement.x !== 0) rotationTarget.current += ROTATION_SPEED * movement.x;

    if (movement.x !== 0 || movement.z !== 0) {
      characterRotationTarget.current = Math.atan2(movement.x, movement.z);
      vel.x = Math.sin(rotationTarget.current + characterRotationTarget.current) * (get().run ? RUN_SPEED : WALK_SPEED);
      vel.z = Math.cos(rotationTarget.current + characterRotationTarget.current) * (get().run ? RUN_SPEED : WALK_SPEED);

      // Update ref synchronously so emitMove gets the correct value this frame
      const nextAnim = get().run ? "run" : "walk";
      if (animRef.current !== nextAnim) {
        animRef.current = nextAnim;
        setAnimationState(nextAnim);
      }
    } else {
      vel.x = 0; vel.z = 0;
      if (animRef.current !== "idle") {
        animRef.current = "idle";
        setAnimationState("idle");
      }
    }

    character.current.rotation.y = lerpAngle(
      character.current.rotation.y,
      characterRotationTarget.current,
      0.1
    );

    rb.current.setLinvel(vel, true);

    const pos = rb.current.translation();
    // Use animRef.current (synchronous) instead of animation state (stale)
    emitMove([pos.x, pos.y, pos.z], character.current.rotation.y, animRef.current);

    // ── Proximity checks ──────────────────────────────────────────────────
    if (room) {
      const myPos = [pos.x, pos.y, pos.z];
      let closestAlive = null, closestAliveDist = Infinity;
      let closestDead  = null, closestDeadDist  = Infinity;

      for (const [id, p] of Object.entries(room.players)) {
        if (id === myId) continue;
        // Read position from the live transform Map (never stale)
        const t = playerTransformsRef.current.get(id);
        if (!t?.position) continue;
        const dx = myPos[0] - t.position[0];
        const dz = myPos[2] - t.position[2];
        const d  = Math.sqrt(dx * dx + dz * dz);

        if (p.alive  && d < KILL_RANGE   && d < closestAliveDist) { closestAliveDist = d; closestAlive = id; }
        if (!p.alive && d < REPORT_RANGE && d < closestDeadDist)  { closestDeadDist  = d; closestDead  = id; }
      }

      if (closestAlive !== nearbyPlayerRef.current) {
        nearbyPlayerRef.current = closestAlive;
        onNearbyPlayer?.(closestAlive);
      }
      if (closestDead !== nearbyDeadRef.current) {
        nearbyDeadRef.current = closestDead;
        onNearbyDead?.(closestDead);
      }
    }

    // CAMERA — follow actual movement direction in world space
    // Using linvel avoids the feedback loop from (container.y + character.y)
    const vx = vel.x;
    const vz = vel.z;
    if (Math.abs(vx) > 0.05 || Math.abs(vz) > 0.05) {
      // Angle behind movement direction
      cameraYaw.current = Math.atan2(vx, vz);
    }
    container.current.rotation.y = MathUtils.lerp(
      container.current.rotation.y,
      cameraYaw.current,
      0.05,   // gentle lag — not snappy, not spinning
    );

    cameraPosition.current.getWorldPosition(cameraWorldPosition.current);
    camera.position.lerp(cameraWorldPosition.current, 0.12);

    if (cameraTarget.current) {
      cameraTarget.current.getWorldPosition(cameraLookAtWorldPosition.current);
      cameraLookAt.current.lerp(cameraLookAtWorldPosition.current, 0.12);
      camera.lookAt(cameraLookAt.current);
    }
  });

  // Use server-assigned ring slot (x/z spread) but clamp y to 3 (safe above floor)
  const [spawnPos] = useState(() => {
    const p = room?.players?.[myId];
    if (p?.position) return [p.position[0], 3, p.position[2]];
    return [0, 3, 0];
  });

  return (
    <RigidBody colliders={false} lockRotations ref={rb} position={spawnPos}>
      <group ref={container}>
        <group ref={cameraTarget} position-y={0.8} />
        <group ref={cameraPosition} position-y={0.6} position-z={-2} />
        <group ref={character}>
          <Character
            scale={0.18}
            position-y={-0.25}
            animation={animationState}
            color={myPlayer.color}
          />
        </group>
      </group>
      <CapsuleCollider args={[0.08, 0.15]} />
    </RigidBody>
  );
};
