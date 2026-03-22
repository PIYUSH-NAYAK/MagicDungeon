import { useState } from "react";
import { useGame } from "../context/GameContext";

export function MeetingScreen() {
  const {
    room, myId, isAlive,
    meetingInfo, meetingTimer, meetingResult,
    castVote,
  } = useGame();

  const [myVote, setMyVote] = useState(null);

  if (!room) return null;

  const players      = Object.values(room.players);
  const alivePlayers = players.filter(p => p.alive);
  const isEmergency  = meetingInfo?.type === "emergency";
  const hasVoted     = !!myVote || !!(room.votes?.[myId]);
  const totalVoters  = alivePlayers.length;
  const votedCount   = Object.keys(room.votes || {}).length;
  const allVoted     = votedCount >= totalVoters;

  const voteTally  = {};
  let   skipCount  = 0;
  for (const v of Object.values(room.votes || {})) {
    if (v === "skip") skipCount++;
    else voteTally[v] = (voteTally[v] || 0) + 1;
  }

  function handleVote(targetId) {
    if (hasVoted || !isAlive) return;
    setMyVote(targetId);
    castVote(targetId);
  }

  // ── Result overlay ───────────────────────────────────────────────────────
  if (meetingResult) {
    const { ejected, tally = {}, skipCount: finalSkip = 0, tie, winner } = meetingResult;

    const tallyRows = Object.entries(tally)
      .filter(([id]) => id !== "skip")
      .map(([id, count]) => ({ player: room.players[id], count }))
      .sort((a, b) => b.count - a.count);

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "radial-gradient(ellipse at center, #0a0015 0%, #060010 70%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: "1.2rem", padding: "2rem",
      }}>
        {/* Breathing orb */}
        <div className="orb" style={{ width: 500, height: 500, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(124,58,237,0.12)", animationDuration: "5s" }} />

        {ejected ? (
          <>
            <div style={{ fontSize: "4rem", zIndex: 1 }}>{ejected.role === "impostor" ? "🎉" : "😱"}</div>
            <h2 className="cinzel" style={{ fontSize: "clamp(1.6rem, 5vw, 2.4rem)", fontWeight: 900, textAlign: "center", color: "#fff", margin: 0, zIndex: 1 }}>
              {ejected.name} was ejected!
            </h2>
            <div style={{
              display: "flex", alignItems: "center", gap: "1rem",
              background: ejected.role === "impostor" ? "rgba(231,76,60,.15)" : "rgba(52,152,219,.15)",
              border: `2px solid ${ejected.role === "impostor" ? "#e74c3c" : "#3498db"}`,
              borderRadius: 14, padding: "1rem 2rem", zIndex: 1,
            }}>
              <span style={{ fontSize: "2rem" }}>{ejected.role === "impostor" ? "🔪" : "🧑‍🚀"}</span>
              <div>
                <div style={{ fontSize: ".8rem", color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".1em", fontFamily: "'Rajdhani', sans-serif" }}>
                  {ejected.name} was
                </div>
                <div className="cinzel" style={{ fontSize: "1.6rem", fontWeight: 900, color: ejected.role === "impostor" ? "#e74c3c" : "#3498db" }}>
                  {ejected.role === "impostor" ? "AN IMPOSTOR" : "A CREWMATE"}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: "4rem", zIndex: 1 }}>🤝</div>
            <h2 className="cinzel" style={{ fontSize: "clamp(1.4rem, 5vw, 2.2rem)", fontWeight: 900, textAlign: "center", color: "var(--gold)", margin: 0, zIndex: 1 }}>
              {tie ? "It's a tie — no one ejected." : "Skipped — no one ejected."}
            </h2>
          </>
        )}

        {/* Vote tally */}
        <div style={{ width: "100%", maxWidth: 360, background: "rgba(255,255,255,.04)", borderRadius: 12, padding: "1rem", display: "flex", flexDirection: "column", gap: ".5rem", zIndex: 1 }}>
          <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: ".3rem", fontFamily: "'Rajdhani', sans-serif" }}>Vote tally</div>
          {tallyRows.map(({ player, count }) => (
            <div key={(player?.id || Math.random())} style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: player?.color || "#888", flexShrink: 0, boxShadow: `0 0 6px ${player?.color || "#888"}` }} />
              <span style={{ flex: 1, color: "rgba(255,255,255,.8)", fontSize: ".9rem", fontFamily: "'Rajdhani', sans-serif" }}>{player?.name || "Unknown"}</span>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {Array.from({ length: count }).map((_, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: "#e74c3c" }} />)}
                <span style={{ color: "#e74c3c", fontWeight: 700, fontSize: ".85rem", marginLeft: 4, fontFamily: "'Rajdhani', sans-serif" }}>{count}</span>
              </div>
            </div>
          ))}
          {finalSkip > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#666", flexShrink: 0 }} />
              <span style={{ flex: 1, color: "rgba(255,255,255,.5)", fontSize: ".9rem", fontFamily: "'Rajdhani', sans-serif" }}>Skip</span>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {Array.from({ length: finalSkip }).map((_, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: "#666" }} />)}
                <span style={{ color: "#aaa", fontWeight: 700, fontSize: ".85rem", marginLeft: 4, fontFamily: "'Rajdhani', sans-serif" }}>{finalSkip}</span>
              </div>
            </div>
          )}
        </div>

        {/* Win condition */}
        {winner && (
          <div style={{ background: winner === "crewmates" ? "rgba(46,204,113,.2)" : "rgba(231,76,60,.2)", border: `2px solid ${winner === "crewmates" ? "#2ecc71" : "#e74c3c"}`, borderRadius: 14, padding: ".8rem 2rem", textAlign: "center", zIndex: 1 }}>
            <div style={{ fontSize: "1.8rem" }}>{winner === "crewmates" ? "🏆" : "👾"}</div>
            <div className="cinzel" style={{ fontWeight: 900, fontSize: "1.3rem", color: winner === "crewmates" ? "#2ecc71" : "#e74c3c" }}>
              {winner === "crewmates" ? "CREWMATES WIN!" : "IMPOSTORS WIN!"}
            </div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: ".8rem", marginTop: ".2rem", fontFamily: "'Rajdhani', sans-serif" }}>
              {winner === "crewmates" ? "All impostors have been ejected." : "Impostors outnumber the crew."}
            </div>
          </div>
        )}

        <p style={{ color: "rgba(255,255,255,.3)", fontSize: ".8rem", marginTop: ".5rem", fontFamily: "'Rajdhani', sans-serif", zIndex: 1 }}>
          {winner ? "Game over — showing results…" : "Returning to game…"}
        </p>
      </div>
    );
  }

  // ── Voting screen ────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at center, #0d0520 0%, #060310 80%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "2rem",
      gap: "1rem", overflowY: "auto",
    }}>
      {/* Breathing orb */}
      <div className="orb" style={{ width: 400, height: 400, top: "-10%", right: "-10%", background: "rgba(231,76,60,0.08)", animationDuration: "6s" }} />

      <div style={{ textAlign: "center", maxWidth: 500, position: "relative", zIndex: 1 }}>
        <h2 className="cinzel" style={{ fontSize: "1.3rem", fontWeight: 900, color: isEmergency ? "var(--gold)" : "#e74c3c", marginBottom: ".3rem" }}>
          {isEmergency
            ? `${meetingInfo?.callerName || "Someone"} called an emergency meeting!`
            : `${meetingInfo?.callerName || "Someone"} found a body!`}
        </h2>
        {meetingInfo?.victimName && (
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: ".9rem", margin: 0, fontFamily: "'Rajdhani', sans-serif" }}>
            Victim: <strong style={{ color: "#e74c3c" }}>{meetingInfo.victimName}</strong>
          </p>
        )}
      </div>

      {/* Timer */}
      <div className="cinzel" style={{ fontSize: "2.8rem", fontWeight: 900, color: meetingTimer <= 10 ? "#e74c3c" : "var(--gold)", fontVariantNumeric: "tabular-nums", textShadow: meetingTimer <= 10 ? "0 0 20px #e74c3c88" : "0 0 20px rgba(240,196,64,0.4)", transition: "color .3s, text-shadow .3s", lineHeight: 1, zIndex: 1 }}>
        {meetingTimer}s
      </div>

      {/* Vote progress */}
      <div style={{ display: "flex", alignItems: "center", gap: ".6rem", background: allVoted ? "rgba(46,204,113,.1)" : "rgba(255,255,255,.04)", border: `1px solid ${allVoted ? "rgba(46,204,113,.4)" : "rgba(255,255,255,.08)"}`, borderRadius: 99, padding: ".35rem .9rem", transition: "all .3s", zIndex: 1 }}>
        <span style={{ fontSize: ".8rem", color: allVoted ? "#2ecc71" : "rgba(255,255,255,.4)", fontWeight: 700, fontFamily: "'Rajdhani', sans-serif" }}>
          {allVoted ? "✓ All voted — tallying…" : `${votedCount} / ${totalVoters} voted`}
        </span>
      </div>

      {/* Player list */}
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: ".5rem", zIndex: 1 }}>
        {alivePlayers.map(p => {
          const isMe    = p.id === myId;
          const votes   = voteTally[p.id] || 0;
          const iTarget = myVote === p.id;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: ".75rem", background: iTarget ? "rgba(231,76,60,.12)" : "var(--bg2)", border: `1px solid ${iTarget ? "#e74c3c55" : "var(--border)"}`, borderRadius: "var(--radius-sm)", padding: ".55rem .9rem", opacity: isMe ? 0.6 : 1, transition: "all .2s", boxShadow: iTarget ? "0 0 12px rgba(231,76,60,.2)" : "none" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: p.color, flexShrink: 0, border: "2px solid rgba(255,255,255,.2)", boxShadow: `0 0 8px ${p.color}55` }} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: ".9rem", fontFamily: "'Rajdhani', sans-serif" }}>
                {p.name}
                {isMe && <span style={{ color: "var(--muted)", fontSize: ".72rem", marginLeft: ".35rem" }}>(you)</span>}
              </span>
              {votes > 0 && (
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  {Array.from({ length: votes }).map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: "#e74c3c" }} />)}
                  <span style={{ color: "#e74c3c", fontWeight: 700, fontSize: ".8rem", marginLeft: 3, fontFamily: "'Rajdhani', sans-serif" }}>{votes}</span>
                </div>
              )}
              {!isMe && isAlive && (
                <button onClick={() => handleVote(p.id)} disabled={hasVoted} style={{ padding: ".28rem .7rem", borderRadius: 7, background: iTarget ? "#e74c3c" : hasVoted ? "rgba(255,255,255,.05)" : "rgba(231,76,60,.18)", color: iTarget ? "#fff" : hasVoted ? "var(--muted)" : "#e74c3c", border: "1px solid rgba(231,76,60,.3)", cursor: hasVoted ? "not-allowed" : "pointer", fontWeight: 700, fontSize: ".78rem", transition: "all .15s", flexShrink: 0, fontFamily: "'Rajdhani', sans-serif" }}>
                  {iTarget ? "✓ Voted" : "Vote"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Skip */}
      {isAlive && (
        <button onClick={() => handleVote("skip")} disabled={hasVoted} style={{ width: "100%", maxWidth: 480, padding: ".65rem", borderRadius: "var(--radius-sm)", background: myVote === "skip" ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.05)", border: `1px solid ${myVote === "skip" ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.1)"}`, color: myVote === "skip" ? "#fff" : "var(--muted)", cursor: hasVoted ? "not-allowed" : "pointer", fontWeight: 700, fontSize: ".88rem", opacity: hasVoted && myVote !== "skip" ? 0.35 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: ".5rem", transition: "all .15s", fontFamily: "'Rajdhani', sans-serif", zIndex: 1 }}>
          {myVote === "skip" ? "✓ Skipping" : "⏭ Skip Vote"}
          {skipCount > 0 && <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 99, padding: ".1rem .45rem", fontSize: ".75rem", color: "rgba(255,255,255,.6)" }}>{skipCount}</span>}
        </button>
      )}

      {!isAlive && (
        <p style={{ color: "rgba(255,255,255,.3)", fontSize: ".85rem", fontStyle: "italic", fontFamily: "'Rajdhani', sans-serif", zIndex: 1 }}>
          You are dead — spectating the meeting.
        </p>
      )}
    </div>
  );
}
