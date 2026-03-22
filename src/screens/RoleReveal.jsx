import { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";

const IMPOSTOR_LINES = [
  "Eliminate the crew. Leave no witnesses.",
  "Trust no one. Suspect everyone.",
  "Sabotage. Deceive. Survive.",
];

const CREWMATE_LINES = [
  "Complete your tasks. Find the impostor.",
  "Stay alert. Trust your instincts.",
  "Work together. Vote wisely.",
];

export function RoleReveal() {
  const { myRole, room, dismissRoleReveal, chain } = useGame();
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // ER role is authoritative; fall back to socket-assigned role while TX confirms
  const resolvedRole = chain?.erRole ?? myRole;
  const isImpostor   = resolvedRole === "impostor";

  // Get fellow impostors from ER (blockchain) — server roles are redacted from room.players
  const fellows = isImpostor && chain?.allPlayerStates
    ? Object.entries(chain.allPlayerStates)
        .filter(([pk, ps]) => ps?.role?.impostor !== undefined && pk !== chain?.publicKey?.toBase58())
        .map(([pk]) => {
          const p = room ? Object.values(room.players).find(pl => pl.walletPubkey === pk) : null;
          return p ? { id: p.id, name: p.name, color: p.color } : null;
        })
        .filter(Boolean)
    : [];

  const line = isImpostor
    ? IMPOSTOR_LINES[Math.floor(Math.random() * IMPOSTOR_LINES.length)]
    : CREWMATE_LINES[Math.floor(Math.random() * CREWMATE_LINES.length)];

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
    const tick = setInterval(() => {
      setCountdown(c => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Dismiss only after countdown actually reaches 0 (outside the updater)
  useEffect(() => {
    if (countdown === 0) dismissRoleReveal();
  }, [countdown]);

  const accentColor = isImpostor ? "#e74c3c" : "#3498db";
  const glowColor   = isImpostor ? "rgba(231,76,60,.35)" : "rgba(52,152,219,.35)";

  return (
    <div
      onClick={dismissRoleReveal}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: isImpostor
          ? "radial-gradient(ellipse at center, #3d0a0a 0%, #0a0505 70%)"
          : "radial-gradient(ellipse at center, #0a1a3d 0%, #050510 70%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: "2rem",
        cursor: "pointer",
        opacity: visible ? 1 : 0,
        transition: "opacity .6s ease",
      }}
    >
      {/* Animated background circles */}
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none",
      }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: `${120 + i * 80}px`, height: `${120 + i * 80}px`,
            borderRadius: "50%",
            border: `1px solid ${accentColor}22`,
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            animation: `roleRing 3s ease-in-out ${i * 0.3}s infinite alternate`,
          }} />
        ))}
      </div>

      {/* Big icon */}
      <div style={{
        fontSize: "6rem",
        filter: `drop-shadow(0 0 30px ${accentColor})`,
        animation: "rolePop .6s cubic-bezier(.34,1.56,.64,1) forwards",
        lineHeight: 1,
      }}>
        {isImpostor ? "💀" : "🛡️"}
      </div>

      {/* "You are..." */}
      <div style={{ textAlign: "center" }}>
        <p style={{
          fontSize: ".9rem", letterSpacing: ".4em", textTransform: "uppercase",
          color: "rgba(255,255,255,.5)", marginBottom: ".6rem",
        }}>
          You are
        </p>
        <h1 style={{
          fontSize: "clamp(2.5rem, 8vw, 5rem)", fontWeight: 900,
          color: accentColor,
          textShadow: `0 0 40px ${glowColor}, 0 0 80px ${glowColor}`,
          letterSpacing: ".08em",
          animation: "rolePop .7s .2s cubic-bezier(.34,1.56,.64,1) both",
        }}>
          {isImpostor ? "AN IMPOSTOR" : "A CREWMATE"}
        </h1>
      </div>

      {/* Flavor text */}
      <p style={{
        color: "rgba(255,255,255,.55)", fontSize: "1rem",
        fontStyle: "italic", maxWidth: 360, textAlign: "center",
      }}>
        {line}
      </p>

      {/* Fellow impostors */}
      {isImpostor && fellows.length > 0 && (
        <div style={{
          background: "rgba(231,76,60,.12)", border: "1px solid rgba(231,76,60,.3)",
          borderRadius: 12, padding: "1rem 1.5rem", maxWidth: 320, textAlign: "center",
        }}>
          <p style={{ fontSize: ".8rem", color: "rgba(255,255,255,.5)", marginBottom: ".5rem", textTransform: "uppercase", letterSpacing: ".1em" }}>
            Your fellow impostors
          </p>
          <div style={{ display: "flex", gap: ".75rem", justifyContent: "center", flexWrap: "wrap" }}>
            {fellows.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: p.color }} />
                <span style={{ fontSize: ".9rem", fontWeight: 600 }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task reminder for crewmate */}
      {!isImpostor && (
        <div style={{
          background: "rgba(52,152,219,.12)", border: "1px solid rgba(52,152,219,.3)",
          borderRadius: 12, padding: ".8rem 1.5rem", textAlign: "center",
        }}>
          <p style={{ fontSize: ".85rem", color: "rgba(255,255,255,.6)" }}>
            🔧 Complete <strong style={{ color: "#3498db" }}>3 tasks</strong> to win — or find the impostor!
          </p>
        </div>
      )}

      {/* Auto-dismiss countdown */}
      <p style={{
        position: "absolute", bottom: "2rem",
        fontSize: ".8rem", color: "rgba(255,255,255,.3)",
        letterSpacing: ".05em",
      }}>
        Tap anywhere to dismiss • auto-starts in {countdown}s
      </p>

      <style>{`
        @keyframes rolePop {
          from { opacity: 0; transform: scale(.4); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes roleRing {
          from { opacity: .05; transform: translate(-50%, -50%) scale(1); }
          to   { opacity: .2;  transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>
    </div>
  );
}
