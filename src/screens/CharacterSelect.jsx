import { useState } from "react";
import { useGame } from "../context/GameContext";

export function CharacterSelect() {
  const { myPlayer, confirmCharacter, COLORS, room, leaveRoom } = useGame();
  const [name, setName] = useState(myPlayer.name || "");
  const [color, setColor] = useState(myPlayer.color || COLORS[0]);

  const canConfirm = name.trim().length >= 2;

  return (
    <div className="screen" style={{ background: "radial-gradient(ellipse at 60% 40%, #0e0829 0%, #0a0a0f 70%)", padding: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem", width: "100%", maxWidth: 520 }}>
        {/* Title */}
        <div style={{ textAlign: "center" }} className="animate-fadeIn">
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: ".3rem" }}>Choose Your Character</h1>
          <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>Pick a colour and enter your name</p>
        </div>

        {/* Preview + options side by side */}
        <div className="card animate-fadeIn" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Big colour preview circle */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{
              width: 110, height: 110, borderRadius: "50%",
              background: color,
              boxShadow: `0 0 40px ${color}88, 0 0 0 4px ${color}33`,
              transition: "all .3s",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "3rem",
            }}>
              🧑
            </div>
          </div>

          {/* Name input */}
          <div>
            <label style={{ display: "block", fontSize: ".85rem", color: "var(--muted)", marginBottom: ".5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>
              Your Name
            </label>
            <input
              className="input"
              placeholder="Enter name…"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={15}
              autoFocus
              style={{ fontSize: "1.1rem" }}
            />
            {name.length > 0 && name.trim().length < 2 && (
              <p style={{ color: "var(--crimson)", fontSize: ".8rem", marginTop: ".35rem" }}>Name must be at least 2 characters</p>
            )}
          </div>

          {/* Color grid */}
          <div>
            <label style={{ display: "block", fontSize: ".85rem", color: "var(--muted)", marginBottom: ".75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>
              Colour
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: ".65rem" }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: "100%", aspectRatio: "1",
                  borderRadius: "50%",
                  background: c,
                  border: color === c ? `3px solid #fff` : "3px solid transparent",
                  cursor: "pointer",
                  boxShadow: color === c ? `0 0 16px ${c}99` : "none",
                  transform: color === c ? "scale(1.15)" : "scale(1)",
                  transition: "all .2s",
                  outline: "none",
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: ".75rem", width: "100%" }} className="animate-fadeIn">
          <button className="btn btn-ghost" onClick={leaveRoom} style={{ flex: "0 0 auto" }}>← Back</button>
          <button
            className="btn btn-gold btn-full"
            disabled={!canConfirm}
            onClick={() => confirmCharacter(name.trim(), color)}
            style={{ fontSize: "1.05rem", padding: ".9rem" }}
          >
            Confirm →
          </button>
        </div>
      </div>
    </div>
  );
}
