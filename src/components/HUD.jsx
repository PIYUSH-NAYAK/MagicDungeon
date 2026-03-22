import { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";

const INITIAL_KILL_COOLDOWN = 30; // seconds

/**
 * In-game HUD — pure DOM overlay (no Three.js Html wrapper needed)
 */
export function HUD({ nearbyDeadId, nearbyPlayerId, onKill, onReport, onEmergency }) {
  const { myRole, isAlive, taskProgress, myPlayer, chain, room, gameStartedAt } = useGame();

  // Tick every 500ms so cooldown display stays live
  const [, tick] = useState(0);
  useEffect(() => {
    if (myRole !== "impostor") return;
    const t = setInterval(() => tick(n => n + 1), 500);
    return () => clearInterval(t);
  }, [myRole]);

  const isImpostor = myRole === "impostor";
  const taskPct = taskProgress.total > 0
    ? Math.min(100, (taskProgress.completed / taskProgress.total) * 100)
    : 0;

  // Kill cooldown — 30s initial on game start, then on-chain cooldown between kills
  const serverNow        = (Date.now() / 1000) + (chain?.serverTimeOffset || 0);
  const cooldownExpiry   = chain?.playerState?.killCooldown?.toNumber?.() ?? 0;
  const onChainCooldown  = Math.max(0, Math.ceil(cooldownExpiry - serverNow));
  const elapsedSinceStart = gameStartedAt ? (Date.now() - gameStartedAt) / 1000 : 0;
  const initialCooldown  = Math.max(0, Math.ceil(INITIAL_KILL_COOLDOWN - elapsedSinceStart));
  const cooldownLeft     = Math.max(onChainCooldown, initialCooldown);
  const killReady        = cooldownLeft === 0;

  // Chain stats
  const gs           = chain?.gameState;
  const aliveCount   = gs ? gs.alive.filter(Boolean).length : Object.values(room?.players || {}).filter(p => p.alive).length;
  const totalPlayers = gs?.playerCount ?? Object.keys(room?.players || {}).length;
  const meetingsCalled = gs?.voteSession ?? 0;
  const tasksLeft    = taskProgress.total > 0 ? taskProgress.total - taskProgress.completed : null;

  // Fellow impostors (visible to impostor only)
  const fellowImpostors = isImpostor && chain?.allPlayerStates
    ? Object.entries(chain.allPlayerStates)
        .filter(([pk, ps]) => ps?.role?.impostor !== undefined && pk !== chain?.publicKey?.toBase58())
        .map(([pk]) => {
          const p = Object.values(room?.players || {}).find(p => p.walletPubkey === pk);
          return p ? p.name : pk.slice(0, 6) + "…";
        })
    : [];

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 500, fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>

      {/* ── Top progress bar ── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "rgba(0,0,0,.4)" }}>
        <div style={{
          height: "100%", width: `${taskPct}%`,
          background: "linear-gradient(90deg,#2ecc71,#1abc9c)",
          transition: "width .6s ease",
          boxShadow: "0 0 10px rgba(46,204,113,.7)",
        }} />
      </div>

      {/* ── Top-left: player card ── */}
      <div style={{ position: "absolute", top: 16, left: 16, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {/* Name + color */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(0,0,0,.65)", backdropFilter: "blur(8px)",
          borderRadius: 12, padding: "8px 14px",
          border: "1px solid rgba(255,255,255,.1)",
          boxShadow: "0 4px 20px rgba(0,0,0,.4)",
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: "50%",
            background: myPlayer?.color || "#4ade80",
            boxShadow: `0 0 8px ${myPlayer?.color || "#4ade80"}`,
            flexShrink: 0,
          }} />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, letterSpacing: ".02em" }}>
            {myPlayer?.name || "YOU"}
          </span>
          <span style={{ color: "rgba(255,255,255,.4)", fontSize: 10, fontWeight: 500 }}>(you)</span>
        </div>

        {/* Role badge */}
        {myRole && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: isImpostor ? "rgba(231,76,60,.18)" : "rgba(52,152,219,.15)",
            border: `1px solid ${isImpostor ? "rgba(231,76,60,.45)" : "rgba(52,152,219,.35)"}`,
            borderRadius: 999, padding: "5px 12px",
            backdropFilter: "blur(6px)",
            alignSelf: "flex-start",
          }}>
            <span style={{ fontSize: 13 }}>{isImpostor ? "🔪" : "🛡️"}</span>
            <span style={{ color: isImpostor ? "#e74c3c" : "#5dade2", fontWeight: 800, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>
              {isImpostor ? "Impostor" : "Crewmate"}
            </span>
          </div>
        )}

        {/* Fellow impostors */}
        {isImpostor && fellowImpostors.length > 0 && (
          <div style={{
            background: "rgba(231,76,60,.1)", border: "1px solid rgba(231,76,60,.25)",
            borderRadius: 8, padding: "5px 12px", alignSelf: "flex-start",
          }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>Allies: </span>
            <span style={{ fontSize: 11, color: "#e74c3c", fontWeight: 700 }}>
              {fellowImpostors.join(", ")}
            </span>
          </div>
        )}

        {/* Task count (crewmates) */}
        {!isImpostor && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)",
            borderRadius: 8, padding: "4px 10px",
            border: "1px solid rgba(46,204,113,.25)",
            alignSelf: "flex-start",
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2ecc71", boxShadow: "0 0 5px #2ecc71" }} />
            <span style={{ color: "rgba(255,255,255,.65)", fontSize: 11 }}>
              Tasks: <strong style={{ color: "#2ecc71" }}>{taskProgress.completed}</strong>/{taskProgress.total}
              {tasksLeft !== null && tasksLeft > 0 && (
                <span style={{ color: "rgba(255,255,255,.3)", marginLeft: 4 }}>({tasksLeft} left)</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Top-right: chain stats ── */}
      <div style={{
        position: "absolute", top: 16, right: 16,
        display: "flex", flexDirection: "column", gap: 6,
        alignItems: "flex-end", pointerEvents: "none",
      }}>
        {/* Alive players */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)",
          borderRadius: 99, padding: "5px 12px",
          border: "1px solid rgba(255,255,255,.08)",
          fontSize: 12,
        }}>
          <span>👥</span>
          <span style={{ color: "rgba(255,255,255,.7)", fontWeight: 600 }}>
            {aliveCount}<span style={{ color: "rgba(255,255,255,.35)" }}>/{totalPlayers} alive</span>
          </span>
        </div>

        {/* Meetings called */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)",
          borderRadius: 99, padding: "5px 12px",
          border: "1px solid rgba(255,255,255,.08)",
          fontSize: 12,
        }}>
          <span>🗳️</span>
          <span style={{ color: "rgba(255,255,255,.7)", fontWeight: 600 }}>
            {meetingsCalled}<span style={{ color: "rgba(255,255,255,.35)" }}> meetings called</span>
          </span>
        </div>

        {/* On-chain badge */}
        {chain?.teeToken && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "rgba(46,204,113,.08)", backdropFilter: "blur(8px)",
            borderRadius: 99, padding: "4px 10px",
            border: "1px solid rgba(46,204,113,.2)",
            fontSize: 10, color: "rgba(46,204,113,.7)", fontWeight: 700,
          }}>
            ⚡ ER live
          </div>
        )}
      </div>

      {/* ── Dead notice ── */}
      {!isAlive && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)",
          borderRadius: 14, padding: ".6rem 1.8rem",
          color: "rgba(255,255,255,.45)", fontSize: ".9rem",
          border: "1px solid rgba(255,255,255,.08)",
          letterSpacing: ".05em",
        }}>
          👻 You are dead
        </div>
      )}

      {/* ── Bottom-right: action buttons ── */}
      {isAlive && (
        <div style={{
          position: "absolute", bottom: 24, right: 24,
          display: "flex", flexDirection: "column", gap: 10,
          alignItems: "flex-end",
          pointerEvents: "all",
        }}>
          {/* Emergency meeting */}
          <button onClick={onEmergency} style={BTN.emergency}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(243,156,18,.3)"}
            onMouseLeave={e => e.currentTarget.style.background = BTN.emergency.background}
          >
            🚨 Emergency Meeting
          </button>

          {/* Report body */}
          {nearbyDeadId && (
            <button onClick={onReport} style={BTN.report}>
              📢 Report Body
            </button>
          )}

          {/* Kill — impostor only */}
          {isImpostor && (
            <button
              onClick={nearbyPlayerId && killReady ? onKill : undefined}
              disabled={!nearbyPlayerId || !killReady}
              style={nearbyPlayerId && killReady ? BTN.kill : BTN.killDisabled}
            >
              {cooldownLeft > 0 ? `🔪 ${cooldownLeft}s` : "🔪 Kill"}
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes hudPulse {
          0%,100% { transform: scale(1); box-shadow: none; }
          50%      { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

// ─── Button style presets ─────────────────────────────────────────────────────
const BASE_BTN = {
  borderRadius: 999, fontWeight: 800, cursor: "pointer",
  backdropFilter: "blur(8px)", border: "none",
  letterSpacing: ".04em", transition: "all .2s ease",
  fontFamily: "inherit",
};

const BTN = {
  emergency: {
    ...BASE_BTN,
    padding: "10px 20px", fontSize: 13,
    background: "rgba(243,156,18,.15)",
    border: "1px solid rgba(243,156,18,.4)",
    color: "#f39c12",
    boxShadow: "0 4px 16px rgba(0,0,0,.3)",
  },
  report: {
    ...BASE_BTN,
    padding: "11px 22px", fontSize: 14,
    background: "rgba(52,152,219,.25)",
    border: "1px solid rgba(52,152,219,.55)",
    color: "#3498db",
    boxShadow: "0 4px 16px rgba(0,0,0,.4)",
    animation: "hudPulse 1.2s ease infinite",
  },
  kill: {
    ...BASE_BTN,
    padding: "13px 28px", fontSize: 16,
    background: "rgba(231,76,60,.3)",
    border: "2px solid rgba(231,76,60,.65)",
    color: "#e74c3c",
    boxShadow: "0 4px 20px rgba(231,76,60,.3)",
    animation: "hudPulse .8s ease infinite",
  },
  killDisabled: {
    ...BASE_BTN,
    padding: "13px 28px", fontSize: 16,
    background: "rgba(231,76,60,.06)",
    border: "2px solid rgba(231,76,60,.18)",
    color: "rgba(231,76,60,.3)",
    cursor: "not-allowed",
  },
};
