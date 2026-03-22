import { Html } from "@react-three/drei";
import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../context/GameContext";

const TASK_MINI_GAMES = [
  {
    id: 0,
    label: "Wire Connect",
    description: "Press the buttons in the right order",
    sequence: ["🔴", "🟡", "🟢", "🔵"],
  },
  {
    id: 1,
    label: "Calibrate",
    description: "Click the glowing symbol",
    sequence: ["⭐", "🔷", "🔶", "💠"],
  },
  {
    id: 2,
    label: "Power Up",
    description: "Press the buttons in the right order",
    sequence: ["⚡", "🌀", "💫", "✨"],
  },
];

function TaskMiniGame({ task, onComplete, onClose }) {
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);
  // Shuffle once on mount — not every render
  const shuffledButtons = useMemo(() => [...task.sequence].sort(() => Math.random() - 0.5), [task]);

  function press(symbol) {
    const next = [...input, symbol];
    const slice = task.sequence.slice(0, next.length);
    if (JSON.stringify(next) !== JSON.stringify(slice)) {
      // Wrong — shake + reset
      setShake(true);
      setTimeout(() => { setShake(false); setInput([]); }, 500);
      return;
    }
    setInput(next);
    if (next.length === task.sequence.length) {
      setTimeout(onComplete, 400);
    }
  }

  const progress = input.length / task.sequence.length;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "linear-gradient(135deg, #1a1030, #0d0820)",
        border: "1px solid rgba(155,89,182,.4)",
        borderRadius: 20, padding: "2rem",
        width: "min(90vw, 400px)",
        animation: shake ? "taskShake .4s ease" : "none",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ fontWeight: 800, color: "var(--gold)", fontSize: "1.1rem" }}>
            🔧 {task.label}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
        </div>

        <p style={{ color: "rgba(255,255,255,.5)", fontSize: ".85rem", marginBottom: "1.2rem" }}>
          {task.description}
        </p>

        {/* Progress bar */}
        <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 99, height: 6, marginBottom: "1.5rem" }}>
          <div style={{
            height: "100%", borderRadius: 99,
            width: `${progress * 100}%`,
            background: "linear-gradient(90deg, #9b59b6, #e91e63)",
            transition: "width .2s ease",
          }} />
        </div>

        {/* Sequence display */}
        <div style={{
          display: "flex", justifyContent: "center", gap: ".6rem",
          marginBottom: "1.5rem",
        }}>
          {task.sequence.map((symbol, i) => (
            <div key={i} style={{
              width: 44, height: 44, fontSize: "1.5rem",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 10,
              background: i < input.length ? "rgba(46,204,113,.25)" : "rgba(255,255,255,.06)",
              border: `2px solid ${i < input.length ? "#2ecc71" : "rgba(255,255,255,.12)"}`,
              transition: "all .2s",
            }}>
              {i < input.length ? "✓" : symbol}
            </div>
          ))}
        </div>

        {/* Buttons — shuffled order (stable, not reshuffled on re-render) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".65rem" }}>
          {shuffledButtons.map((symbol, i) => (
            <button
              key={i}
              onClick={() => press(symbol)}
              style={{
                fontSize: "1.8rem", padding: ".7rem",
                borderRadius: 14,
                background: "rgba(155,89,182,.15)",
                border: "1px solid rgba(155,89,182,.3)",
                cursor: "pointer",
                transition: "all .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(155,89,182,.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(155,89,182,.15)"; }}
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes taskShake {
          0%, 100% { transform: translateX(0); }
          25%       { transform: translateX(-8px); }
          75%       { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}

/**
 * A glowing orb in the 3D world. Shows "Press E" when the local player is near.
 * On E press → opens mini-game modal.
 */
export function TaskStation({ position, taskIndex, onComplete }) {
  const { isAlive, myRole, completeTask, room, myId, myPositionRef } = useGame();
  const meshRef   = useRef();
  const [near, setNear]   = useState(false);
  const [open, setOpen]   = useState(false);
  const task = TASK_MINI_GAMES[taskIndex % TASK_MINI_GAMES.length];

  // Derive done from server — survives remounts and is authoritative
  const me   = room?.players?.[myId];
  const done = (me?.tasks?.completed || []).includes(taskIndex);

  const canInteract = isAlive && myRole === "crewmate" && !done;
  const nearRef = useRef(false);

  // Proximity detection — prefer live ref, fall back to last known room position
  useFrame(() => {
    const pos = myPositionRef?.current ?? me?.position;
    if (!pos) return;
    const dx = pos[0] - position[0];
    const dz = pos[2] - position[2];
    const d  = Math.sqrt(dx * dx + dz * dz);
    const isNear = d < 3.0;
    if (isNear !== nearRef.current) {
      nearRef.current = isNear;
      setNear(isNear);
    }
  });

  // E-key listener
  useEffect(() => {
    function onKey(e) {
      if (e.code === "KeyE" && nearRef.current && canInteract && !open) {
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canInteract, open]);

  // Pulsing glow animation
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const scale = 1 + Math.sin(t * 2.5) * 0.08;
    meshRef.current.scale.setScalar(done ? 0.6 : scale);
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} onClick={() => { if (near && canInteract) setOpen(true); }}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial
          color={done ? "#555" : "#9b59b6"}
          emissive={done ? "#111" : "#7d3c98"}
          emissiveIntensity={done ? 0.1 : 1.2}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
      {/* Point light for glow effect */}
      {!done && (
        <pointLight color="#9b59b6" intensity={near ? 2 : 0.8} distance={3} />
      )}

      {/* "Press E" indicator — also clickable */}
      {near && canInteract && (
        <Html center position={[0, 0.6, 0]} distanceFactor={6}>
          <div
            onClick={() => setOpen(true)}
            style={{
              background: "rgba(0,0,0,.8)", borderRadius: 8,
              padding: "4px 10px", fontSize: 12,
              color: "#e0d0ff", fontWeight: 700,
              border: "1px solid rgba(155,89,182,.5)",
              whiteSpace: "nowrap", backdropFilter: "blur(4px)",
              cursor: "pointer",
            }}
          >
            [E] {task.label}
          </div>
        </Html>
      )}

      {/* Done indicator */}
      {done && (
        <Html center position={[0, 0.6, 0]} distanceFactor={6}>
          <div style={{
            background: "rgba(46,204,113,.2)", borderRadius: 8,
            padding: "3px 8px", fontSize: 11,
            color: "#2ecc71", fontWeight: 700, border: "1px solid #2ecc7166",
          }}>
            ✓ Done
          </div>
        </Html>
      )}

      {/* Mini-game modal */}
      {open && (
        <Html fullscreen>
          <TaskMiniGame
            task={task}
            onComplete={() => {
              setOpen(false);
              completeTask(taskIndex);  // sync to server → updates tasks.completed → done re-derives
              onComplete?.(taskIndex);
            }}
            onClose={() => setOpen(false)}
          />
        </Html>
      )}
    </group>
  );
}

