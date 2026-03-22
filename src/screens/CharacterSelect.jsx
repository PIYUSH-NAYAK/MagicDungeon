import { useState } from "react";
import { useGame } from "../context/GameContext";

function CSSCrewmate({ color, size = 90 }) {
  return (
    <div style={{ position: "relative", width: size, height: size, color }}>
      <div style={{
        position: "absolute",
        top: "30%", left: "10%",
        width: "80%", height: "55%",
        background: "currentColor",
        borderRadius: "50% 50% 20% 20%",
      }}>
        <div style={{
          position: "absolute",
          top: "18%", left: "19%",
          width: "62%", height: "55%",
          background: "linear-gradient(135deg, #a8d8f8 0%, #5bb3e8 100%)",
          borderRadius: "40% 40% 15% 15%",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.3)",
        }} />
      </div>
      <div style={{
        position: "absolute",
        bottom: 0, left: 0,
        width: "100%", height: "62%",
        background: "currentColor",
        borderRadius: "50% 50% 30% 30% / 60% 60% 40% 40%",
      }}>
        <div style={{
          position: "absolute",
          right: "-24%", bottom: "10%",
          width: "28%", height: "45%",
          background: "currentColor",
          filter: "brightness(0.7)",
          borderRadius: "30% 50% 50% 30%",
        }} />
      </div>
    </div>
  );
}

export function CharacterSelect() {
  const { myPlayer, confirmCharacter, COLORS, room, leaveRoom } = useGame();
  const [name, setName] = useState(myPlayer.name || "");
  const [color, setColor] = useState(myPlayer.color || COLORS[0]);

  const canConfirm = name.trim().length >= 2;

  return (
    <div className="screen" style={{ background: "radial-gradient(ellipse at 60% 40%, #0e0829 0%, #0a0a0f 70%)", padding: "2rem" }}>
      {/* Glow orb that reacts to color */}
      <div className="orb" style={{
        width: 500, height: 500,
        top: "-20%", right: "-10%",
        background: `${color}22`,
        animationDuration: "5s",
        transition: "background .5s ease",
      }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem", width: "100%", maxWidth: 520, position: "relative", zIndex: 1 }}>
        {/* Title */}
        <div style={{ textAlign: "center" }} className="animate-fadeIn">
          <h1 className="cinzel" style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: ".3rem", color: "var(--gold)" }}>
            Choose Your Character
          </h1>
          <p style={{ color: "var(--muted)", fontSize: ".9rem", fontFamily: "'Rajdhani', sans-serif", letterSpacing: ".08em" }}>
            Pick a colour and enter your name
          </p>
        </div>

        {/* Preview + options side by side */}
        <div className="card animate-fadeIn" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem", border: `1px solid ${color}44`, transition: "border-color .4s" }}>
          {/* CSS Crewmate preview with glow */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{
              padding: "1.2rem",
              borderRadius: "50%",
              boxShadow: `0 0 50px ${color}66, 0 0 0 3px ${color}22`,
              transition: "box-shadow .4s ease",
              animation: "breathe 3s ease-in-out infinite",
            }}>
              <CSSCrewmate color={color} size={90} />
            </div>
          </div>

          {/* Name input */}
          <div>
            <label style={{ display: "block", fontSize: ".85rem", color: "var(--muted)", marginBottom: ".5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: "'Rajdhani', sans-serif" }}>
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
            <label style={{ display: "block", fontSize: ".85rem", color: "var(--muted)", marginBottom: ".75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: "'Rajdhani', sans-serif" }}>
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
                  boxShadow: color === c ? `0 0 20px ${c}cc` : "none",
                  transform: color === c ? "scale(1.18)" : "scale(1)",
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
            style={{ fontSize: "1.05rem", padding: ".9rem", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: ".08em" }}
          >
            Confirm →
          </button>
        </div>
      </div>
    </div>
  );
}
