import { useGame } from "../context/GameContext";

export function LobbyScreen() {
  const { room, isHost, myId, setReady, leaveRoom, startGame, chain, chainGameId, walletPublicKey, onChainCreated } = useGame();
  const walletShort = walletPublicKey ? `${walletPublicKey.toBase58().slice(0,4)}…${walletPublicKey.toBase58().slice(-4)}` : "not connected";
  const teeActive   = !!chain?.teeToken;

  if (!room) return null;

  const players = Object.values(room.players);
  const me = room.players[myId];

  return (
    <div className="screen" style={{ background: "radial-gradient(ellipse at 40% 50%, #110a2a 0%, #0a0a0f 70%)", flexDirection: "column", gap: "1.5rem", padding: "2rem" }}>
      {/* Header */}
      <div style={{ textAlign: "center" }} className="animate-fadeIn">
        <p style={{ color: "var(--muted)", fontSize: ".8rem", letterSpacing: ".3em", textTransform: "uppercase", marginBottom: ".4rem" }}>Room Code</p>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "center" }}>
          <h2 style={{
            fontSize: "2.8rem", fontWeight: 900, letterSpacing: ".35em",
            background: "linear-gradient(135deg, var(--gold), var(--gold2))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            {room.code}
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigator.clipboard?.writeText(room.code)}
            title="Copy code"
          >📋</button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: ".85rem" }}>
          Share this code with friends to invite them
        </p>
      </div>

      {/* Player list */}
      <div className="card animate-fadeIn" style={{ width: "100%", maxWidth: 480 }}>
        <h3 style={{ marginBottom: "1rem", fontSize: ".9rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".1em" }}>
          Players ({players.length} / {room.maxPlayers})
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
          {players.map(p => (
            <div key={p.id} className="animate-slideIn" style={{
              display: "flex", alignItems: "center", gap: ".85rem",
              background: "var(--bg2)", borderRadius: "var(--radius-sm)",
              padding: ".65rem 1rem",
              border: p.id === myId ? "1px solid var(--accent2)" : "1px solid var(--border)",
            }}>
              {/* Color swatch */}
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: p.color, flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }} />
              {/* Name */}
              <span style={{ fontWeight: 600, flex: 1 }}>
                {p.name || "Player"}
                {p.id === myId && <span style={{ color: "var(--accent2)", fontSize: ".75rem", marginLeft: ".5rem" }}>(you)</span>}
                {p.id === room.hostId && <span style={{ color: "var(--gold)", fontSize: ".75rem", marginLeft: ".5rem" }}>👑 host</span>}
              </span>
              {/* Ready badge */}
              <span style={{
                fontSize: ".8rem", padding: ".25rem .65rem", borderRadius: 99,
                background: p.ready ? "rgba(46,204,113,.2)" : "rgba(255,255,255,.06)",
                color: p.ready ? "#2ecc71" : "var(--muted)",
                fontWeight: 600,
              }}>
                {p.ready || p.id === room.hostId ? "✓ Ready" : "Waiting…"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: ".75rem", width: "100%", maxWidth: 480 }} className="animate-fadeIn">
        {/* Ready toggle (non-host) */}
        {!isHost && (
          <button
            className={`btn btn-full ${me?.ready ? "btn-ghost" : "btn-primary"}`}
            onClick={() => setReady(!me?.ready)}
          >
            {me?.ready ? "✗ Not Ready" : "✓ I'm Ready!"}
          </button>
        )}

        {/* Start game (host only) */}
        {isHost && (() => {
          const nonHostPlayers = players.filter(p => p.id !== room.hostId);
          const allReady = nonHostPlayers.length > 0 && nonHostPlayers.every(p => p.ready);
          const notReadyCount = nonHostPlayers.filter(p => !p.ready).length;
          return (
            <button
              className="btn btn-gold btn-full"
              disabled={!allReady}
              onClick={startGame}
              style={{
                fontSize: "1.05rem", padding: ".9rem",
                opacity: allReady ? 1 : 0.4,
                cursor: allReady ? "pointer" : "not-allowed",
                transition: "opacity .3s",
              }}
            >
              {allReady
                ? "🎮 \u00a0 Start Game"
                : `⏳ Waiting for ${notReadyCount} player${notReadyCount > 1 ? "s" : ""}…`}
            </button>
          );
        })()}

        <button className="btn btn-ghost btn-full btn-sm" onClick={leaveRoom} style={{ color: "var(--muted)" }}>
          Leave Room
        </button>
      </div>
      {/* Solana status strip */}
      <div style={{
        position: "absolute", bottom: 12, left: 0, right: 0,
        display: "flex", justifyContent: "center",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: ".75rem",
          background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 99, padding: ".35rem 1rem", fontSize: ".75rem", color: "rgba(255,255,255,.4)",
        }}>
          <span title="Wallet">🔑 {walletShort}</span>
          <span style={{ opacity: .4 }}>│</span>
          <span style={{ color: onChainCreated ? "#2ecc71" : chainGameId ? "#f39c12" : "rgba(255,255,255,.35)" }}>
            {onChainCreated
              ? `✓ on-chain #${chainGameId?.slice(-6) ?? "—"}`
              : chainGameId ? "⏳ joining chain…" : "○ not connected"}
          </span>
          <span style={{ opacity: .4 }}>│</span>
          <span style={{ color: teeActive ? "#2ecc71" : "rgba(255,255,255,.3)" }}>
            {teeActive ? "⚡ TEE active" : "○ TEE pending"}
          </span>
        </div>
      </div>
    </div>
  );
}
