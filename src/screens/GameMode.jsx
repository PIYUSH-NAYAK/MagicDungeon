import { useGame } from "../context/GameContext";

const MODES = [
  {
    id: "impostor",
    icon: "🔪",
    label: "Impostor",
    desc: "Find the killer among your crew before everyone is dead.",
    color: "#e74c3c",
  },
  {
    id: "free_roam",
    icon: "🌏",
    label: "Free Roam",
    desc: "Explore the dungeon freely. No win condition, just vibes.",
    color: "#3498db",
  },
  {
    id: "last_stand",
    icon: "☠️",
    label: "Last Stand",
    desc: "Battle royale — eliminate others, be the last one standing.",
    color: "#9b59b6",
  },
  {
    id: "tasks_only",
    icon: "🔧",
    label: "Tasks Only",
    desc: "Co-op mode — everyone is a crewmate, finish all tasks fast.",
    color: "#2ecc71",
  },
];

export function GameMode() {
  const { room, isHost, selectGameMode, startCountdown, setPhaseState } = useGame();
  const selected = room?.gameMode || "impostor";

  return (
    <div className="screen" style={{ background: "radial-gradient(ellipse at 50% 40%, #0d1426 0%, #0a0a0f 70%)", padding: "2rem", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ textAlign: "center" }} className="animate-fadeIn">
        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: ".3rem" }}>
          {isHost ? "Select Game Mode" : "Waiting for host…"}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
          {isHost ? "Choose how you want to play" : "The host is selecting a game mode"}
        </p>
      </div>

      {/* Mode cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", width: "100%", maxWidth: 640 }} className="animate-fadeIn">
        {MODES.map(m => (
          <button
            key={m.id}
            disabled={!isHost}
            onClick={() => isHost && selectGameMode(m.id)}
            style={{
              background: selected === m.id ? `linear-gradient(135deg, ${m.color}33, ${m.color}15)` : "var(--surface)",
              border: selected === m.id ? `2px solid ${m.color}` : "2px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "1.4rem 1.25rem",
              cursor: isHost ? "pointer" : "default",
              textAlign: "left",
              transition: "all .25s",
              transform: selected === m.id ? "scale(1.02)" : "scale(1)",
              boxShadow: selected === m.id ? `0 4px 24px ${m.color}44` : "none",
            }}
          >
            <div style={{ fontSize: "2.2rem", marginBottom: ".5rem" }}>{m.icon}</div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", color: selected === m.id ? m.color : "var(--text)", marginBottom: ".35rem" }}>
              {m.label}
            </div>
            <div style={{ color: "var(--muted)", fontSize: ".82rem", lineHeight: 1.5 }}>{m.desc}</div>
            {selected === m.id && (
              <div style={{ marginTop: ".75rem", fontSize: ".75rem", color: m.color, fontWeight: 700, letterSpacing: ".08em" }}>
                ✓ SELECTED
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lock in button (host) */}
      {isHost && (
        <button
          className="btn btn-gold animate-fadeIn"
          style={{ fontSize: "1.1rem", padding: ".9rem 2.5rem", marginTop: ".5rem" }}
          onClick={startCountdown}
        >
          🚀 &nbsp; Lock In &amp; Start!
        </button>
      )}

      {!isHost && (
        <div style={{ color: "var(--muted)", fontSize: ".9rem", display: "flex", alignItems: "center", gap: ".5rem" }} className="animate-fadeIn">
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2ecc71", boxShadow: "0 0 8px #2ecc71", animation: "pulse 1.5s infinite" }} />
          Waiting for host to start the game…
        </div>
      )}
    </div>
  );
}
