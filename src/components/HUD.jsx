import { Html } from "@react-three/drei";
import { useGame } from "../context/GameContext";

/**
 * In-game HUD — rendered inside <Canvas> via <Html fullscreen>
 * Shows: task bar, role badge, kill button (impostor), report button (all alive)
 */
export function HUD({ nearbyDeadId, nearbyPlayerId, onKill, onReport, onEmergency }) {
  const { myRole, isAlive, taskProgress, room } = useGame();

  if (!isAlive) {
    // Ghost HUD — very minimal
    return (
      <Html fullscreen>
        <div style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(0,0,0,.6)", borderRadius: 12,
          padding: ".6rem 1.4rem", pointerEvents: "none",
          color: "rgba(255,255,255,.4)", fontSize: ".9rem",
          backdropFilter: "blur(6px)",
        }}>
          👻 You are dead
        </div>
      </Html>
    );
  }

  const isImpostor = myRole === "impostor";
  const taskPct = taskProgress.total > 0
    ? Math.min(100, (taskProgress.completed / taskProgress.total) * 100)
    : 0;

  return (
    <Html fullscreen>
      {/* ── Task Bar (top, crewmates + everyone can see it) ───────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: 6, background: "rgba(0,0,0,.5)", zIndex: 100,
      }}>
        <div style={{
          height: "100%", width: `${taskPct}%`,
          background: "linear-gradient(90deg, #2ecc71, #1abc9c)",
          transition: "width .6s ease",
          boxShadow: "0 0 8px rgba(46,204,113,.6)",
        }} />
      </div>

      {/* ── Task progress label ──────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 10, left: 10, zIndex: 101,
        background: "rgba(0,0,0,.55)", borderRadius: 8,
        padding: "5px 10px", fontSize: 12, color: "rgba(255,255,255,.7)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#2ecc71", boxShadow: "0 0 6px #2ecc71",
        }} />
        Tasks: {taskProgress.completed}/{taskProgress.total}
      </div>

      {/* ── Role badge (bottom-left) ─────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: "2rem", left: "1.5rem", zIndex: 200,
        background: isImpostor ? "rgba(231,76,60,.2)" : "rgba(52,152,219,.15)",
        border: `1px solid ${isImpostor ? "rgba(231,76,60,.4)" : "rgba(52,152,219,.3)"}`,
        borderRadius: 999, padding: ".4rem 1rem",
        color: isImpostor ? "#e74c3c" : "#5dade2",
        fontWeight: 700, fontSize: ".85rem",
        backdropFilter: "blur(6px)",
      }}>
        {isImpostor ? "🔪 IMPOSTOR" : "🛡️ CREWMATE"}
      </div>

      {/* ── Action buttons (bottom-right) ─────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: "2rem", right: "1.5rem",
        display: "flex", flexDirection: "column", gap: ".65rem",
        alignItems: "flex-end", zIndex: 200,
      }}>
        {/* Emergency meeting button */}
        <button
          onClick={onEmergency}
          style={{
            padding: ".45rem 1rem", borderRadius: 999,
            background: "rgba(243,156,18,.15)",
            border: "1px solid rgba(243,156,18,.35)",
            color: "#f39c12", fontWeight: 700, fontSize: ".8rem",
            cursor: "pointer", backdropFilter: "blur(6px)",
            transition: "all .2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(243,156,18,.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(243,156,18,.15)"; }}
        >
          🚨 Emergency
        </button>

        {/* Report button */}
        {nearbyDeadId && (
          <button
            onClick={onReport}
            style={{
              padding: ".5rem 1.2rem", borderRadius: 999,
              background: "rgba(52,152,219,.2)",
              border: "1px solid rgba(52,152,219,.5)",
              color: "#3498db", fontWeight: 800, fontSize: ".9rem",
              cursor: "pointer", backdropFilter: "blur(6px)",
              animation: "hudPulse 1s ease infinite",
            }}
          >
            📢 Report Body
          </button>
        )}

        {/* Kill button (impostor only) */}
        {isImpostor && nearbyPlayerId && (
          <button
            onClick={onKill}
            style={{
              padding: ".6rem 1.4rem", borderRadius: 999,
              background: "rgba(231,76,60,.25)",
              border: "2px solid rgba(231,76,60,.6)",
              color: "#e74c3c", fontWeight: 900, fontSize: "1rem",
              cursor: "pointer", backdropFilter: "blur(6px)",
              animation: "hudPulse 0.7s ease infinite",
            }}
          >
            🔪 Kill
          </button>
        )}

        {/* Kill button disabled state */}
        {isImpostor && !nearbyPlayerId && (
          <button
            disabled
            style={{
              padding: ".6rem 1.4rem", borderRadius: 999,
              background: "rgba(231,76,60,.07)",
              border: "2px solid rgba(231,76,60,.2)",
              color: "rgba(231,76,60,.35)", fontWeight: 900, fontSize: "1rem",
              cursor: "not-allowed",
            }}
          >
            🔪 Kill
          </button>
        )}
      </div>

      <style>{`
        @keyframes hudPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.04); }
        }
      `}</style>
    </Html>
  );
}
