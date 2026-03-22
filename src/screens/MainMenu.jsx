import { useState } from "react";
import { useGame } from "../context/GameContext";
import { CreateRoom } from "./CreateRoom";
import { JoinRoom } from "./JoinRoom";

const STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  size: Math.random() * 2.5 + 1,
  top: Math.random() * 100,
  left: Math.random() * 100,
  duration: Math.random() * 3 + 2,
  delay: Math.random() * 4,
}));

export function MainMenu() {
  const { error } = useGame();
  const [screen, setScreen] = useState(null); // null | 'create' | 'join'

  // Route to sub-screens
  if (screen === "create") return <CreateRoom onBack={() => setScreen(null)} />;
  if (screen === "join")   return <JoinRoom   onBack={() => setScreen(null)} />;

  return (
    <div className="screen" style={{ background: "radial-gradient(ellipse at 50% 40%, #140a2e 0%, #0a0a0f 70%)" }}>
      {/* Stars */}
      {STARS.map(s => (
        <div key={s.id} className="star" style={{
          width: s.size, height: s.size,
          top: `${s.top}%`, left: `${s.left}%`,
          animationDuration: `${s.duration}s`,
          animationDelay: `${s.delay}s`,
        }} />
      ))}

      {/* Breathing orbs */}
      <div className="orb" style={{ width: 450, height: 450, top: "-15%", left: "-12%", background: "rgba(124,58,237,0.15)", animationDuration: "7s" }} />
      <div className="orb" style={{ width: 350, height: 350, bottom: "-10%", right: "-10%", background: "rgba(168,85,247,0.12)", animationDuration: "9s", animationDelay: "3s" }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%", maxWidth: 480, padding: "0 1.5rem" }}>
        {/* Logo */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{
            color: "var(--accent2)", letterSpacing: ".5em", fontSize: ".75rem",
            fontWeight: 600, textTransform: "uppercase", marginBottom: ".5rem",
            fontFamily: "'Rajdhani', sans-serif",
          }}>
            ⚔️ &nbsp; Multiplayer &nbsp; ⚔️
          </p>
          <h1 className="shimmer-text" style={{
            fontSize: "clamp(2.5rem,8vw,4.5rem)",
            fontWeight: 900, lineHeight: 1.05,
          }}>
            MAGIC<br/>DUNGEON
          </h1>
          <div style={{ marginTop: ".8rem", color: "rgba(240,196,64,0.4)", fontSize: "1.2rem", letterSpacing: ".3em" }}>
            ⚔ ─── ⚔
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ background: "var(--crimson)", color: "#fff", padding: ".75rem 1rem", borderRadius: "var(--radius-sm)", marginBottom: "1rem", fontSize: ".9rem", animation: "fadeIn .3s ease" }}>
            ⚠ {error}
          </div>
        )}

        {/* Main buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} className="animate-fadeIn">
          <button
            className="btn btn-gold btn-full"
            style={{ fontSize: "1.1rem", padding: "1rem", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: ".08em" }}
            onClick={() => setScreen("create")}
          >
            🏰 &nbsp; Create Room
          </button>
          <button
            className="btn btn-primary btn-full"
            style={{ fontSize: "1.1rem", padding: "1rem", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: ".08em" }}
            onClick={() => setScreen("join")}
          >
            🚪 &nbsp; Join Room
          </button>
        </div>

        <p style={{ marginTop: "2rem", color: "var(--muted)", fontSize: ".8rem", fontFamily: "'Rajdhani', sans-serif", letterSpacing: ".1em" }}>
          ✦ &nbsp; 3D · Real-time Multiplayer &nbsp; ✦
        </p>
      </div>
    </div>
  );
}
