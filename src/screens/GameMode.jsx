import { useGame } from "../context/GameContext";

const MODES = [
  { id: "impostor",   icon: "🔪", label: "Impostor",   desc: "Find the killer before everyone is dead.", color: "#e74c3c" },
  { id: "free_roam",  icon: "🌏", label: "Free Roam",  desc: "Explore freely. No win condition.",        color: "#3498db" },
  { id: "tasks_only", icon: "🔧", label: "Tasks Only", desc: "Co-op — everyone finishes tasks together.", color: "#2ecc71" },
];

const MAPS = [
  { id: "castle_on_hills",          icon: "🏰", label: "Castle on Hills" },
  { id: "animal_crossing_map",      icon: "🌿", label: "Animal Crossing" },
  { id: "city_scene_tokyo",         icon: "🏙️", label: "Tokyo City"      },
  { id: "de_dust_2_with_real_light",icon: "🏜️", label: "Dust II"         },
  { id: "medieval_fantasy_book",    icon: "📖", label: "Fantasy Book"    },
];

export function GameMode() {
  const { room, isHost, selectGameMode, selectMap, startCountdown } = useGame();
  const selectedMode = room?.gameMode || "impostor";
  const selectedMap  = room?.map      || "castle_on_hills";

  return (
    <div className="screen" style={{
      background: "radial-gradient(ellipse at 50% 40%, #0d1426 0%, #0a0a0f 70%)",
      padding: "2rem", flexDirection: "column", gap: "1.5rem", overflowY: "auto",
    }}>
      <div style={{ textAlign: "center" }} className="animate-fadeIn">
        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: ".3rem" }}>
          {isHost ? "Game Setup" : "Waiting for host…"}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
          {isHost ? "Choose game mode and map" : "Host is configuring the game"}
        </p>
      </div>

      {/* ── Game Mode ──────────────────────────────────────────────────────── */}
      <div style={{ width: "100%", maxWidth: 640 }}>
        <p style={{ color: "var(--muted)", fontSize: ".78rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: ".6rem" }}>
          Game Mode
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: ".75rem" }}>
          {MODES.map(m => (
            <button
              key={m.id}
              disabled={!isHost}
              onClick={() => isHost && selectGameMode(m.id)}
              style={{
                background: selectedMode === m.id ? `linear-gradient(135deg,${m.color}33,${m.color}15)` : "var(--surface)",
                border: selectedMode === m.id ? `2px solid ${m.color}` : "2px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1.1rem 1rem", cursor: isHost ? "pointer" : "default",
                textAlign: "left", transition: "all .22s",
                transform: selectedMode === m.id ? "scale(1.02)" : "scale(1)",
                boxShadow: selectedMode === m.id ? `0 4px 20px ${m.color}44` : "none",
              }}
            >
              <div style={{ fontSize: "1.8rem", marginBottom: ".35rem" }}>{m.icon}</div>
              <div style={{ fontWeight: 700, fontSize: ".95rem", color: selectedMode === m.id ? m.color : "var(--text)", marginBottom: ".25rem" }}>
                {m.label}
              </div>
              <div style={{ color: "var(--muted)", fontSize: ".78rem", lineHeight: 1.4 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Map Picker ─────────────────────────────────────────────────────── */}
      <div style={{ width: "100%", maxWidth: 640 }}>
        <p style={{ color: "var(--muted)", fontSize: ".78rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: ".6rem" }}>
          Map
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".6rem" }}>
          {MAPS.map(m => {
            const active = selectedMap === m.id;
            return (
              <button
                key={m.id}
                disabled={!isHost}
                onClick={() => isHost && selectMap(m.id)}
                style={{
                  display: "flex", alignItems: "center", gap: ".5rem",
                  padding: ".55rem 1rem",
                  background: active ? "rgba(241,196,15,.15)" : "var(--surface)",
                  border: active ? "2px solid #f1c40f" : "2px solid var(--border)",
                  borderRadius: 999, cursor: isHost ? "pointer" : "default",
                  color: active ? "#f1c40f" : "var(--text)",
                  fontWeight: active ? 700 : 400, fontSize: ".85rem",
                  transition: "all .2s",
                  boxShadow: active ? "0 0 14px rgba(241,196,15,.3)" : "none",
                }}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
                {active && <span style={{ fontSize: ".7rem", opacity: .7 }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Start (host only) ──────────────────────────────────────────────── */}
      {isHost ? (
        <button
          className="btn btn-gold animate-fadeIn"
          style={{ fontSize: "1.1rem", padding: ".9rem 2.5rem" }}
          onClick={startCountdown}
        >
          🚀 &nbsp; Lock In &amp; Start!
        </button>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: ".9rem", display: "flex", alignItems: "center", gap: ".5rem" }} className="animate-fadeIn">
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2ecc71", boxShadow: "0 0 8px #2ecc71", animation: "pulse 1.5s infinite" }} />
          Waiting for host to start the game…
        </div>
      )}
    </div>
  );
}
