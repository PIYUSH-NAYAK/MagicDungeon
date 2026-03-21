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

  const players  = Object.values(room.players);
  const alivePlayers = players.filter(p => p.alive);
  const me = room.players[myId];
  const hasVoted = !!myVote || !!(room.votes?.[myId]);

  const isEmergency = meetingInfo?.type === "emergency";
  const headerText = isEmergency
    ? `🚨 ${meetingInfo?.callerName || "Someone"} called an emergency meeting!`
    : `💀 ${meetingInfo?.callerName || "Someone"} found a body!`;

  function handleVote(targetId) {
    if (hasVoted || !isAlive) return;
    setMyVote(targetId);
    castVote(targetId);
  }

  // Count votes for display
  const voteTally = {};
  if (room.votes) {
    for (const v of Object.values(room.votes)) {
      voteTally[v] = (voteTally[v] || 0) + 1;
    }
  }

  // Result overlay
  if (meetingResult) {
    const ejected = meetingResult.ejected;
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "radial-gradient(ellipse at center, #120820 0%, #080510 70%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: "1.5rem",
      }}>
        <div style={{ fontSize: "5rem" }}>
          {ejected ? (ejected.role === "impostor" ? "🎉" : "😱") : "🤝"}
        </div>
        <h2 style={{
          fontSize: "clamp(1.5rem, 5vw, 2.5rem)", fontWeight: 900, textAlign: "center",
          color: ejected
            ? ejected.role === "impostor" ? "#2ecc71" : "#e74c3c"
            : "var(--gold)",
        }}>
          {ejected
            ? `${ejected.name} was ejected!`
            : meetingResult.tie ? "It's a tie — no one ejected." : "Skipped — no one ejected."}
        </h2>
        {ejected && (
          <p style={{ color: "rgba(255,255,255,.6)", fontSize: "1rem" }}>
            {ejected.name} was{" "}
            <strong style={{ color: ejected.role === "impostor" ? "#e74c3c" : "#3498db" }}>
              {ejected.role === "impostor" ? "an IMPOSTOR" : "a CREWMATE"}
            </strong>.
          </p>
        )}
        <p style={{ color: "rgba(255,255,255,.3)", fontSize: ".85rem" }}>
          Returning to game…
        </p>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at center, #0d0520 0%, #060310 80%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "2rem",
      gap: "1.2rem", overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: 500 }}>
        <h2 style={{
          fontSize: "1.4rem", fontWeight: 800,
          color: isEmergency ? "var(--gold)" : "#e74c3c",
          marginBottom: ".3rem",
        }}>
          {headerText}
        </h2>
        {meetingInfo?.victimName && (
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: ".9rem" }}>
            Victim: <strong style={{ color: "#e74c3c" }}>{meetingInfo.victimName}</strong>
          </p>
        )}
      </div>

      {/* Timer */}
      <div style={{
        fontSize: "3rem", fontWeight: 900,
        color: meetingTimer <= 10 ? "#e74c3c" : "var(--gold)",
        fontVariantNumeric: "tabular-nums",
        textShadow: meetingTimer <= 10 ? "0 0 20px #e74c3c88" : "none",
        transition: "color .3s",
      }}>
        {meetingTimer}s
      </div>

      {/* Discussion note */}
      <p style={{ color: "rgba(255,255,255,.35)", fontSize: ".85rem", fontStyle: "italic" }}>
        Discuss, then vote who to eject. Skip if unsure.
      </p>

      {/* Player vote list */}
      <div style={{
        width: "100%", maxWidth: 480,
        display: "flex", flexDirection: "column", gap: ".55rem",
      }}>
        {alivePlayers.map(p => {
          const isMe = p.id === myId;
          const voteCount = voteTally[p.id] || 0;
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: ".8rem",
              background: "var(--bg2)",
              border: `1px solid ${myVote === p.id ? "#e74c3c66" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)",
              padding: ".6rem 1rem",
              opacity: isMe ? 0.65 : 1,
            }}>
              {/* Color dot */}
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: p.color, flexShrink: 0,
                border: "2px solid rgba(255,255,255,.2)",
              }} />
              {/* Name */}
              <span style={{ flex: 1, fontWeight: 600, fontSize: ".95rem" }}>
                {p.name}
                {isMe && <span style={{ color: "var(--muted)", fontSize: ".75rem", marginLeft: ".4rem" }}>(you)</span>}
              </span>
              {/* Vote count */}
              {voteCount > 0 && (
                <span style={{
                  fontSize: ".8rem", padding: ".2rem .55rem", borderRadius: 99,
                  background: "rgba(231,76,60,.2)", color: "#e74c3c", fontWeight: 700,
                }}>
                  {voteCount} 🗳️
                </span>
              )}
              {/* Vote button */}
              {!isMe && isAlive && (
                <button
                  onClick={() => handleVote(p.id)}
                  disabled={hasVoted}
                  style={{
                    padding: ".3rem .8rem", borderRadius: 8,
                    background: myVote === p.id ? "#e74c3c" : hasVoted ? "rgba(255,255,255,.06)" : "rgba(231,76,60,.2)",
                    color: myVote === p.id ? "#fff" : hasVoted ? "var(--muted)" : "#e74c3c",
                    border: "1px solid rgba(231,76,60,.3)",
                    cursor: hasVoted ? "not-allowed" : "pointer",
                    fontWeight: 700, fontSize: ".8rem",
                    transition: "all .2s",
                  }}
                >
                  {myVote === p.id ? "✓ Voted" : "Vote"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Skip vote */}
      {isAlive && (
        <button
          onClick={() => handleVote("skip")}
          disabled={hasVoted}
          className="btn btn-ghost btn-full"
          style={{
            maxWidth: 480,
            opacity: hasVoted ? 0.4 : 1,
            cursor: hasVoted ? "not-allowed" : "pointer",
          }}
        >
          {myVote === "skip" ? "✓ Skipping vote" : "⏭ Skip Vote"}
        </button>
      )}

      {!isAlive && (
        <p style={{ color: "rgba(255,255,255,.3)", fontSize: ".85rem", fontStyle: "italic" }}>
          👻 You are dead — spectating the meeting.
        </p>
      )}
    </div>
  );
}
