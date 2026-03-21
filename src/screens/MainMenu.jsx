import { useState } from "react";
import { useGame } from "../context/GameContext";

const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  size: Math.random() * 50 + 20,
  left: Math.random() * 100,
  duration: Math.random() * 12 + 8,
  delay: Math.random() * 8,
}));

export function MainMenu() {
  const { createRoom, joinRoom, error, socketReady } = useGame();
  const [mode, setMode] = useState(null); // null | 'join'
  const [code, setCode] = useState("");

  return (
    <div className="screen" style={{ background: "radial-gradient(ellipse at 50% 40%, #140a2e 0%, #0a0a0f 70%)" }}>
      {/* Particles */}
      <div className="particles">
        {PARTICLES.map(p => (
          <div key={p.id} className="particle" style={{
            width: p.size, height: p.size, left: `${p.left}%`,
            animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%", maxWidth: 480, padding: "0 1.5rem" }}>
        {/* Logo */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ color: "var(--accent2)", letterSpacing: ".5em", fontSize: ".75rem", fontWeight: 600, textTransform: "uppercase", marginBottom: ".5rem" }}>
            ⚔️ &nbsp; Multiplayer &nbsp; ⚔️
          </p>
          <h1 style={{
            fontSize: "clamp(2.5rem,8vw,4.5rem)", fontWeight: 900,
            background: "linear-gradient(135deg,#f0c040,#f97316,#ec4899)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            lineHeight: 1, letterSpacing: "-.03em",
          }}>MAGIC<br/>DUNGEON</h1>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ background: "var(--crimson)", color: "#fff", padding: ".75rem 1rem", borderRadius: "var(--radius-sm)", marginBottom: "1rem", fontSize: ".9rem", animation: "fadeIn .3s ease" }}>
            ⚠ {error}
          </div>
        )}

        {/* Main buttons or Join form */}
        {mode === null && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} className="animate-fadeIn">
            <button
              className="btn btn-gold btn-full"
              style={{ fontSize: "1.1rem", padding: "1rem" }}
              onClick={createRoom}
              disabled={!socketReady}
            >
              {socketReady ? "🏰 Create Room" : "⏳ Connecting…"}
            </button>
            <button className="btn btn-primary btn-full" style={{ fontSize: "1.1rem", padding: "1rem" }} onClick={() => setMode("join")}>
              🚪 Join Room
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="card animate-fadeIn" style={{ textAlign: "left" }}>
            <h2 style={{ marginBottom: "1.25rem", fontSize: "1.2rem" }}>Enter Room Code</h2>
            <input
              className="input"
              placeholder="e.g. DUNGEON"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && joinRoom(code)}
              maxLength={8}
              style={{ fontSize: "1.4rem", letterSpacing: ".2em", textAlign: "center", marginBottom: "1rem" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: ".75rem" }}>
              <button className="btn btn-ghost btn-full" onClick={() => setMode(null)}>← Back</button>
              <button className="btn btn-gold btn-full" disabled={code.length < 4} onClick={() => joinRoom(code)}>
                Join →
              </button>
            </div>
          </div>
        )}

        <p style={{ marginTop: "2rem", color: "var(--muted)", fontSize: ".8rem" }}>
          3D · Real-time Multiplayer
        </p>
      </div>
    </div>
  );
}
