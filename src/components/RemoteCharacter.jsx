import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import { Character } from "./Character";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";

export const RemoteCharacter = ({ data }) => {
  const rigidBody = useRef();
  const group = useRef();
  
  // Safety check
  if (!data || !data.position) {
      console.warn("RemoteCharacter: Missing data or position", data);
      return null;
  }

  // Use simple lerp for smooth movement
  useFrame((state, delta) => {
    if (!rigidBody.current || !group.current) return;
    
    // Target position
    const targetPos = new THREE.Vector3(data.position[0], data.position[1], data.position[2]);
    
    // Interpolate position visually (or physics-wise)
    // For kinematic bodies, we set the next translation
    const currentPos = rigidBody.current.translation();
    const currentVec = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
    
    const nextPos = currentVec.lerp(targetPos, delta * 10);
    rigidBody.current.setNextKinematicTranslation(nextPos);
    
    // Interpolate rotation (Y axis)
    // Minimal angle interpolation logic
    let targetRot = data.rotation;
    let currentRot = group.current.rotation.y;
    
    // Normalize angles to avoid spinning the wrong way
    // (Simple implementation: just lerp directly for now, can be improved with math helpers)
    group.current.rotation.y = THREE.MathUtils.lerp(currentRot, targetRot, delta * 15);
  });

  return (
    <RigidBody ref={rigidBody} type="kinematicPosition" colliders={false}>
        <group ref={group}>
        <Character animation={data.animation} scale={0.18} position-y={-0.25} />
        <Html position={[0, 2.2, 0]} center distanceFactor={10}>
            <div style={{ 
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            color: 'white', 
            backgroundColor: 'rgba(0,0,0,0.6)', 
            padding: '4px 8px', 
            borderRadius: '12px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            userSelect: 'none'
            }}>
            Player {data.id.slice(0, 4)}
            </div>
        </Html>
        </group>
        <CapsuleCollider args={[0.08, 0.15]} />
    </RigidBody>
  );
};
