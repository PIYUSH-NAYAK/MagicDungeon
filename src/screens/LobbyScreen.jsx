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
      {/* Breathing orbs */}
      <div className="orb" style={{ width: 400, height: 400, top: "-15%", left: "-10%", background: "rgba(124,58,237,0.12)", animationDuration: "8s" }} />
      <div className="orb" style={{ width: 300, height: 300, bottom: "-10%", right: "-8%", background: "rgba(240,196,64,0.08)", animationDuration: "6s", animationDelay: "2s" }} />

      {/* Header */}
      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }} className="animate-fadeIn">
        <p style={{ color: "var(--muted)", fontSize: ".75rem", letterSpacing: ".4em", textTransform: "uppercase", marginBottom: ".4rem", fontFamily: "'Rajdhani', sans-serif" }}>
          ⚡ Room Code ⚡
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "center" }}>
          <h2 className="cinzel" style={{
            fontSize: "2.8rem", fontWeight: 900, letterSpacing: ".35em",
            background: "linear-gradient(135deg, var(--gold), var(--gold2))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            textShadow: "none",
            padding: ".3rem 1.4rem",
            borderRadius: 8,
            border: "1px solid rgba(240,196,64,0.25)",
          }}>
            {room.code}
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigator.clipboard?.writeText(room.code)}
            title="Copy code"
          >📋</button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: ".85rem", fontFamily: "'Rajdhani', sans-serif" }}>
          Share this code with friends to invite them
        </p>
      </div>

      {/* Player list */}
      <div className="card animate-fadeIn" style={{ width: "100%", maxWidth: 480, position: "relative", zIndex: 1 }}>
        <h3 style={{ marginBottom: "1rem", fontSize: ".85rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".12em", fontFamily: "'Rajdhani', sans-serif" }}>
          Players ({players.length} / {room.maxPlayers})
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
          {players.map(p => (
            <div key={p.id} className="animate-slideIn" style={{
              display: "flex", alignItems: "center", gap: ".85rem",
              background: "var(--bg2)", borderRadius: "var(--radius-sm)",
              padding: ".65rem 1rem",
              border: p.id === myId ? `1px solid ${p.color}66` : "1px solid var(--border)",
              boxShadow: p.id === myId ? `0 0 12px ${p.color}22` : "none",
              transition: "border-color .3s, box-shadow .3s",
            }}>
              {/* Color swatch */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: p.color, flexShrink: 0,
                border: "2px solid rgba(255,255,255,0.15)",
                boxShadow: `0 0 10px ${p.color}55`,
              }} />
              {/* Name */}
              <span style={{ fontWeight: 600, flex: 1, fontFamily: "'Rajdhani', sans-serif", fontSize: "1.05rem" }}>
                {p.name || "Player"}
                {p.id === myId && <span style={{ color: "var(--accent2)", fontSize: ".75rem", marginLeft: ".5rem" }}>(you)</span>}
                {p.id === room.hostId && (
                  <span style={{ color: "var(--gold)", fontSize: ".75rem", marginLeft: ".5rem", animation: "spin 4s linear infinite", display: "inline-block" }}>👑</span>
                )}
                {p.id === room.hostId && <span style={{ color: "var(--gold)", fontSize: ".75rem", marginLeft: ".2rem" }}>host</span>}
              </span>
              {/* Ready badge */}
              <span style={{
                fontSize: ".8rem", padding: ".25rem .65rem", borderRadius: 99,
                background: p.ready ? "rgba(46,204,113,.2)" : "rgba(255,255,255,.06)",
                color: p.ready ? "#2ecc71" : "var(--muted)",
                fontWeight: 600, fontFamily: "'Rajdhani', sans-serif",
                border: p.ready ? "1px solid rgba(46,204,113,.3)" : "1px solid transparent",
              }}>
                {p.ready || p.id === room.hostId ? "✓ Ready" : "Waiting…"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: ".75rem", width: "100%", maxWidth: 480, position: "relative", zIndex: 1 }} className="animate-fadeIn">
        {/* Ready toggle (non-host) */}
        {!isHost && (
          <button
            className={`btn btn-full ${me?.ready ? "btn-ghost" : "btn-primary"}`}
            style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: ".08em" }}
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
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700,
                letterSpacing: ".08em",
                animation: allReady ? "pulse 2s ease-in-out infinite" : "none",
              }}
            >
              {allReady
                ? "🎮 \u00a0 Start Game"
                : `⏳ Waiting for ${notReadyCount} player${notReadyCount > 1 ? "s" : ""}…`}
            </button>
          );
        })()}

        <button className="btn btn-ghost btn-full btn-sm" onClick={leaveRoom} style={{ color: "var(--muted)", fontFamily: "'Rajdhani', sans-serif" }}>
          Leave Room
        </button>
      </div>

      {/* Solana status strip */}
      <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 1 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: ".75rem",
          background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 99, padding: ".35rem 1rem", fontSize: ".75rem", color: "rgba(255,255,255,.4)",
          fontFamily: "'Rajdhani', sans-serif",
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
