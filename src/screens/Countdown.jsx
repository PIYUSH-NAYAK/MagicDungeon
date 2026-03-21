import { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";

export function Countdown() {
  const { countdownValue, room } = useGame();
  const [prevVal, setPrevVal] = useState(countdownValue);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (countdownValue !== prevVal) {
      setPrevVal(countdownValue);
      setKey(k => k + 1);
    }
  }, [countdownValue]);

  const isGo = countdownValue <= 0;
  const displayColor = isGo ? "#f0c040" :`hsl(${(countdownValue / 5) * 120}, 80%, 60%)`;

  return (
    <div className="screen" style={{
      background: "radial-gradient(ellipse at 50% 50%, #120820 0%, #0a0a0f 60%)",
      flexDirection: "column", gap: "1rem",
    }}>
      {/* Background pulse ring */}
      <div style={{
        position: "absolute",
        width: "100vmin", height: "100vmin",
        borderRadius: "50%",
        border: `3px solid ${displayColor}33`,
        animation: "pulse 1s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Game mode badge */}
      <p style={{ color: "var(--muted)", fontSize: ".85rem", letterSpacing: ".3em", textTransform: "uppercase", zIndex: 1 }}>
        {room?.gameMode?.replace("_", " ")?.toUpperCase() || "MATCH"} STARTING IN
      </p>

      {/* The big number */}
      <div key={key} style={{
        fontSize: "clamp(8rem, 25vw, 16rem)",
        fontWeight: 900,
        color: displayColor,
        lineHeight: 1,
        textShadow: `0 0 60px ${displayColor}88, 0 0 120px ${displayColor}44`,
        animation: "countPop .9s ease both",
        zIndex: 1,
        transition: "color .3s",
      }}>
        {isGo ? "GO!" : countdownValue}
      </div>

      {/* Sub-text */}
      <p style={{ color: "var(--muted)", fontSize: ".9rem", zIndex: 1, marginTop: ".5rem" }}>
        {isGo ? "Entering dungeon…" : "Get ready, adventurer!"}
      </p>

      {/* Bottom room info */}
      {room && (
        <div style={{ position: "absolute", bottom: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
          {Object.values(room.players).map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: ".4rem", background: "var(--surface)", padding: ".4rem .8rem", borderRadius: 99, border: "1px solid var(--border)" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: p.color }} />
              <span style={{ fontSize: ".8rem", color: "var(--text)" }}>{p.name || "Player"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
