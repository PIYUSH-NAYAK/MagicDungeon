import { useState } from "react";
import { useGame } from "../context/GameContext";

export function ResultsScreen() {
  const { room, winner, isHost, backToLobby, chain } = useGame();
  const [finalizing, setFinalizing] = useState(false);
  const [finalized,  setFinalized]  = useState(false);
  if (!room) return null;

  async function handleFinalize() {
    if (!chain) return;
    setFinalizing(true);
    try {
      await chain.commands.finalizeGame();
      setFinalized(true);
    } catch (e) {
      console.warn("[chain] finalizeGame:", e.message);
    } finally {
      setFinalizing(false);
    }
  }

  const players = Object.values(room.players);

  // Resolve each player's role: prefer ER allPlayerStates (revealed post-game) → socket room role
  // Anchor encodes Role::Impostor as { impostor:{} }, Role::Crewmate as { crewmate:{} }
  function resolveRole(p) {
    const erPs = chain?.allPlayerStates?.[p.walletPubkey];
    if (erPs?.role?.impostor !== undefined) return "impostor";
    if (erPs?.role?.crewmate !== undefined) return "crewmate";
    return p.role; // socket fallback
  }

  const playersWithRole = players.map(p => ({ ...p, resolvedRole: resolveRole(p) }));
  const impostors = playersWithRole.filter(p => p.resolvedRole === "impostor");

  // ER result is authoritative; fall back to socket winner string
  const erResult = chain?.gameState?.result;
  const isCrewmateWin = erResult?.crewmatesWin !== undefined
    ? true
    : erResult?.impostorsWin !== undefined
    ? false
    : winner === "crewmates";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: isCrewmateWin
        ? "radial-gradient(ellipse at center, #0a1f0d 0%, #050a05 70%)"
        : "radial-gradient(ellipse at center, #200a0a 0%, #0a0505 70%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "2rem", gap: "1.8rem", overflowY: "auto",
    }}>
      {/* Big icon + banner */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "5rem", lineHeight: 1, marginBottom: "1rem", animation: "rolePop .7s ease" }}>
          {isCrewmateWin ? "✅" : "💀"}
        </div>
        <h1 style={{
          fontSize: "clamp(2rem, 7vw, 4rem)", fontWeight: 900,
          color: isCrewmateWin ? "#2ecc71" : "#e74c3c",
          textShadow: isCrewmateWin
            ? "0 0 40px rgba(46,204,113,.5)"
            : "0 0 40px rgba(231,76,60,.5)",
          letterSpacing: ".04em",
        }}>
          {isCrewmateWin ? "Crewmates Win!" : "Impostors Win!"}
        </h1>
        <p style={{ color: "rgba(255,255,255,.45)", marginTop: ".5rem" }}>
          {isCrewmateWin
            ? "All tasks completed or all impostors ejected."
            : "Impostors outnumbered the crew."}
        </p>
      </div>

      {/* Impostor reveal */}
      <div style={{
        background: "rgba(231,76,60,.1)", border: "1px solid rgba(231,76,60,.25)",
        borderRadius: 14, padding: "1rem 1.5rem", width: "100%", maxWidth: 480,
      }}>
        <p style={{ fontSize: ".8rem", color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: ".75rem" }}>
          🔪 Impostors were
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem" }}>
          {impostors.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: ".5rem",
              background: "rgba(0,0,0,.3)", borderRadius: 9999,
              padding: ".35rem .8rem",
            }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: p.color }} />
              <span style={{ fontWeight: 700, fontSize: ".9rem" }}>{p.name}</span>
              {chain?.allPlayerStates?.[p.walletPubkey] && (
                <span style={{ fontSize: ".65rem", color: "#2ecc71", opacity: .7 }}>⛓</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Full player list */}
      <div style={{ width: "100%", maxWidth: 480 }}>
        <p style={{ fontSize: ".8rem", color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: ".75rem" }}>
          All Players
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
          {playersWithRole.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: ".8rem",
              background: "rgba(255,255,255,.04)", borderRadius: 10,
              padding: ".55rem .9rem",
              opacity: p.alive ? 1 : 0.5,
            }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: p.color, border: "2px solid rgba(255,255,255,.2)" }} />
              <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
              <span style={{
                fontSize: ".75rem", padding: ".2rem .6rem", borderRadius: 99,
                background: p.resolvedRole === "impostor" ? "rgba(231,76,60,.2)" : "rgba(52,152,219,.15)",
                color: p.resolvedRole === "impostor" ? "#e74c3c" : "#5dade2",
                fontWeight: 700,
              }}>
                {p.resolvedRole === "impostor" ? "🔪 Impostor" : "🛡️ Crewmate"}
              </span>
              {!p.alive && <span style={{ fontSize: ".75rem", color: "rgba(255,255,255,.35)" }}>💀</span>}
            </div>
          ))}
        </div>
      </div>

      {/* On-chain finalize + Back to lobby */}
      {isHost ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          {!finalized ? (
            <>
              <button
                className="btn"
                onClick={handleFinalize}
                disabled={finalizing}
                style={{
                  padding: ".75rem 2rem", fontSize: ".9rem",
                  background: "linear-gradient(135deg,#9b59b6,#6c3483)",
                  border: "none", color: "#fff", borderRadius: 99, cursor: "pointer",
                  opacity: finalizing ? .6 : 1,
                }}
              >
                {finalizing ? "⏳ Committing…" : "⛓️ Commit Result to Chain"}
              </button>
              <p style={{ color: "rgba(255,255,255,.3)", fontSize: ".75rem", textAlign: "center", maxWidth: 300 }}>
                Locks final result permanently on Solana Devnet via MagicBlock ER
              </p>
            </>
          ) : (
            <p style={{ color: "#2ecc71", fontSize: ".85rem", fontWeight: 700 }}>✅ Result committed on-chain!</p>
          )}
          <button
            className="btn btn-gold"
            onClick={backToLobby}
            style={{ padding: ".9rem 2.5rem", fontSize: "1rem" }}
          >
            🏠 Back to Lobby
          </button>
        </div>
      ) : (
        <p style={{ color: "rgba(255,255,255,.3)", fontSize: ".85rem" }}>
          {chain?.isFinalized ? "✅ Result committed on-chain" : "Waiting for host to start a new game…"}
        </p>
      )}

      <style>{`
        @keyframes rolePop {
          from { opacity: 0; transform: scale(.4); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
