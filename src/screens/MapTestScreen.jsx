/**
 * MapTestScreen — standalone 3D map tester, no wallet / room / lobby required.
 * Access via:  http://localhost:5173/?test
 *
 * Features:
 *  - Switch maps live
 *  - Toggle ghost mode (translucent float)
 *  - Spawn fake remote players at fixed positions
 *  - Task station interaction
 *  - WASD / click-drag movement
 *  - Position readout overlay
 */
import { useState, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { KeyboardControls, Environment, OrthographicCamera, Html } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { CapsuleCollider, RigidBody } from "@react-three/rapier";
import { useKeyboardControls } from "@react-three/drei";
import { MathUtils, Vector3 } from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { Map } from "../components/Map";
import { Character } from "../components/Character";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizeAngle = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
const lerpAngle = (s, e, t) => {
  s = normalizeAngle(s); e = normalizeAngle(e);
  if (Math.abs(e - s) > Math.PI) { if (e > s) s += 2*Math.PI; else e += 2*Math.PI; }
  return normalizeAngle(s + (e - s) * t);
};

const MAP_CONFIGS = {
  castle_on_hills:           { scale: 3,    position: [-6, -7, 0],   spawn: [0, 3, 0] },
  animal_crossing_map:       { scale: 20,   position: [-15, -1, 10], spawn: [0, 3, 0] },
  city_scene_tokyo:          { scale: 0.72, position: [0, -1, -3.5], spawn: [0, 3, 0] },
  de_dust_2_with_real_light: { scale: 0.3,  position: [-5, -3, 13],  spawn: [0, 3, 0] },
  medieval_fantasy_book:     { scale: 0.4,  position: [-4, 0, -6],   spawn: [0, 3, 0] },
};

const KEYBOARD_MAP = [
  { name: "forward",  keys: ["ArrowUp",   "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left",     keys: ["ArrowLeft", "KeyA"] },
  { name: "right",    keys: ["ArrowRight","KeyD"] },
  { name: "run",      keys: ["Shift"] },
  { name: "jump",     keys: ["Space"] },
];

const COLORS = ["#e74c3c","#3498db","#2ecc71","#9b59b6","#f39c12"];

// ─── Test character controller (no GameContext) ───────────────────────────────
function TestCharacter({ ghost, color, spawnPos, onPosition }) {
  const rb        = useRef();
  const container = useRef();
  const character = useRef();
  const [anim, setAnim] = useState("idle");
  const animRef  = useRef("idle");
  const rotTarget = useRef(0);
  const charRotTarget = useRef(0);
  const cameraTarget  = useRef();
  const cameraPos     = useRef();
  const camWorldPos   = useRef(new Vector3());
  const camLookAt     = useRef(new Vector3());
  const camLookAtWorld= useRef(new Vector3());
  const isClicking    = useRef(false);
  const jumped        = useRef(false);
  const [, get]       = useKeyboardControls();

  const WALK = 0.8, RUN = 1.6, ROT = degToRad(0.5);

  useEffect(() => {
    const d = () => { isClicking.current = true;  };
    const u = () => { isClicking.current = false; };
    document.addEventListener("mousedown", d);
    document.addEventListener("mouseup",   u);
    return () => { document.removeEventListener("mousedown", d); document.removeEventListener("mouseup", u); };
  }, []);

  useFrame(({ camera, mouse, clock }) => {
    if (!rb.current || !character.current || !container.current) return;
    const vel = rb.current.linvel();
    const mov = { x: 0, z: 0 };
    if (!ghost) {
      if (get().forward)  mov.z =  1;
      if (get().backward) mov.z = -1;
      if (get().left)     mov.x =  1;
      if (get().right)    mov.x = -1;
      if (isClicking.current) {
        if (Math.abs(mouse.x) > 0.1) mov.x = -mouse.x;
        mov.z = mouse.y + 0.4;
      }
    }
    const running = get().run || (isClicking.current && (Math.abs(mov.x)>0.5||Math.abs(mov.z)>0.5));
    const speed = running ? RUN : WALK;
    if (mov.x !== 0) rotTarget.current += ROT * mov.x;
    if (mov.x !== 0 || mov.z !== 0) {
      charRotTarget.current = Math.atan2(mov.x, mov.z);
      vel.x = Math.sin(rotTarget.current + charRotTarget.current) * speed;
      vel.z = Math.cos(rotTarget.current + charRotTarget.current) * speed;
      const na = running ? "run" : "walk";
      if (animRef.current !== na) { animRef.current = na; setAnim(na); }
    } else {
      vel.x = 0; vel.z = 0;
      if (animRef.current !== "idle") { animRef.current = "idle"; setAnim("idle"); }
    }
    character.current.rotation.y = lerpAngle(character.current.rotation.y, charRotTarget.current, 0.1);
    if (ghost) {
      vel.y = Math.sin(clock.elapsedTime * 2.2) * 0.3;
    } else {
      if (get().jump && !jumped.current && Math.abs(vel.y) < 0.1) {
        vel.y = 2.5;
        jumped.current = true;
      }
      if (Math.abs(vel.y) < 0.1) jumped.current = false;
    }
    rb.current.setLinvel(vel, true);
    container.current.rotation.y = MathUtils.lerp(container.current.rotation.y, rotTarget.current, 0.1);
    cameraPos.current.getWorldPosition(camWorldPos.current);
    camera.position.lerp(camWorldPos.current, 0.1);
    if (cameraTarget.current) {
      cameraTarget.current.getWorldPosition(camLookAtWorld.current);
      camLookAt.current.lerp(camLookAtWorld.current, 0.1);
      camera.lookAt(camLookAt.current);
    }
    const p = rb.current.translation();
    onPosition?.([Math.round(p.x*100)/100, Math.round(p.y*100)/100, Math.round(p.z*100)/100]);
  });

  return (
    <RigidBody colliders={false} lockRotations ref={rb} position={spawnPos} gravityScale={ghost ? 0 : 1}>
      <group ref={container}>
        <group ref={cameraTarget}   position-y={0.8} />
        <group ref={cameraPos}      position-y={0.6} position-z={-2} />
        <group ref={character}>
          <Character scale={0.18} position-y={-0.25} animation={ghost ? "idle" : anim} color={color} ghost={ghost} />
        </group>
      </group>
      <CapsuleCollider args={[0.08, 0.15]} />
    </RigidBody>
  );
}

// ─── Fake remote player ───────────────────────────────────────────────────────
function FakePlayer({ position, color, name }) {
  return (
    <group position={position}>
      <Character scale={0.18} position-y={-0.25} animation="idle" color={color} />
      <Html position={[0, 2.2, 0]} center distanceFactor={10}>
        <div style={{ background:"rgba(0,0,0,.6)", color, padding:"3px 8px", borderRadius:12, fontSize:11, fontFamily:"Arial", fontWeight:"bold", whiteSpace:"nowrap" }}>
          {name}
        </div>
      </Html>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function TestScene({ mapKey, ghost, fakeCount, color, onPosition }) {
  const cfg = MAP_CONFIGS[mapKey];
  const fakePlayers = Array.from({ length: fakeCount }, (_, i) => ({
    pos: [Math.cos(i/fakeCount*Math.PI*2)*3, 0, Math.sin(i/fakeCount*Math.PI*2)*3],
    color: COLORS[(i+1) % COLORS.length],
    name: `Bot ${i+1}`,
  }));

  return (
    <>
      <Environment preset="sunset" />
      <directionalLight intensity={0.65} castShadow position={[-15,10,15]}
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.00005}>
        <OrthographicCamera left={-22} right={15} top={10} bottom={-20} attach="shadow-camera" />
      </directionalLight>
      <Physics key={mapKey}>
        <Map scale={cfg.scale} position={cfg.position} model={`models/${mapKey}.glb`} />
        <TestCharacter ghost={ghost} color={color} spawnPos={cfg.spawn} onPosition={onPosition} />
        {fakePlayers.map((p, i) => <FakePlayer key={i} position={p.pos} color={p.color} name={p.name} />)}
      </Physics>
    </>
  );
}

// ─── Main UI ─────────────────────────────────────────────────────────────────
export function MapTestScreen() {
  const [mapKey,    setMapKey]    = useState("castle_on_hills");
  const [ghost,     setGhost]     = useState(false);
  const [fakeCount, setFakeCount] = useState(2);
  const [color,     setColor]     = useState("#3498db");
  const [pos,       setPos]       = useState([0,0,0]);

  const panel = {
    position: "fixed", top: 12, left: 12, zIndex: 9999,
    background: "rgba(10,10,20,.9)", border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 14, padding: "1rem 1.2rem", color: "#fff",
    fontFamily: "monospace", fontSize: 12, display: "flex", flexDirection: "column", gap: 8,
    minWidth: 220,
  };

  return (
    <div style={{ width:"100vw", height:"100vh", position:"relative", background:"#1a1a2e" }}>
      {/* Control panel */}
      <div style={panel}>
        <div style={{ fontWeight:700, fontSize:14, color:"#f39c12", marginBottom:4 }}>
          🗺 Map Test Mode
        </div>

        {/* Map selector */}
        <label style={{ color:"rgba(255,255,255,.5)" }}>Map</label>
        <select value={mapKey} onChange={e => setMapKey(e.target.value)}
          style={{ background:"#111", color:"#fff", border:"1px solid #333", borderRadius:6, padding:"4px 6px" }}>
          {Object.keys(MAP_CONFIGS).map(k => <option key={k} value={k}>{k.replaceAll("_"," ")}</option>)}
        </select>

        {/* Color */}
        <label style={{ color:"rgba(255,255,255,.5)" }}>Player colour</label>
        <div style={{ display:"flex", gap:6 }}>
          {COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{
              width:22, height:22, borderRadius:"50%", background:c, cursor:"pointer",
              border: color===c ? "2px solid #fff" : "2px solid transparent",
            }} />
          ))}
        </div>

        {/* Ghost toggle */}
        <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
          <input type="checkbox" checked={ghost} onChange={e => setGhost(e.target.checked)} />
          <span>Ghost mode (dead player)</span>
        </label>

        {/* Fake players */}
        <label style={{ color:"rgba(255,255,255,.5)" }}>Fake bots: {fakeCount}</label>
        <input type="range" min={0} max={5} value={fakeCount} onChange={e => setFakeCount(+e.target.value)} />

        {/* Position readout */}
        <div style={{ borderTop:"1px solid rgba(255,255,255,.1)", paddingTop:6, marginTop:2 }}>
          <span style={{ color:"rgba(255,255,255,.4)" }}>pos </span>
          <span style={{ color:"#2ecc71" }}>x={pos[0]} y={pos[1]} z={pos[2]}</span>
        </div>

        <div style={{ color:"rgba(255,255,255,.3)", fontSize:10 }}>WASD / drag · Shift=run · Space=jump</div>
        <a href="/" style={{ color:"#9b59b6", textDecoration:"none", fontSize:11, marginTop:4 }}>
          ← Back to game
        </a>
      </div>

      <KeyboardControls map={KEYBOARD_MAP}>
        <Canvas shadows camera={{ position:[3,3,3], near:0.1, fov:70 }} style={{ touchAction:"none" }}>
          <color attach="background" args={["#1a1a2e"]} />
          <TestScene mapKey={mapKey} ghost={ghost} fakeCount={fakeCount} color={color} onPosition={setPos} />
        </Canvas>
      </KeyboardControls>
    </div>
  );
}
