import { useState, useRef } from "react";
import { useGame } from "../context/GameContext";

// Floating crewmate decorations
const DECO_CREW = [
  { color: "#9b59b6", top: "10%",  left: "2%",  size: 60, dur: 3.0, delay: 0 },
  { color: "#e74c3c", top: "60%",  left: "1%",  size: 50, dur: 2.6, delay: 0.8 },
  { color: "#3498db", top: "80%",  left: "5%",  size: 55, dur: 3.4, delay: 0.3 },
  { color: "#2ecc71", top: "8%",   right: "2%", size: 56, dur: 2.8, delay: 1.1 },
  { color: "#f0c040", top: "65%",  right: "3%", size: 58, dur: 3.2, delay: 0.5 },
];

function DecoCrewmate({ color, top, left, right, size, dur, delay }) {
  return (
    <div style={{
      position: "absolute", top, left, right,
      width: size, height: size, color,
      animation: `crewBob ${dur}s ease-in-out ${delay}s infinite`,
      pointerEvents: "none", zIndex: 0, opacity: 0.4,
    }}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <div style={{
          position: "absolute", top: "0%", left: "10%",
          width: "80%", height: "52%", background: "currentColor",
          borderRadius: "50% 50% 20% 20%",
        }}>
          <div style={{
            position: "absolute", top: "20%", left: "18%",
            width: "64%", height: "55%",
            background: "linear-gradient(135deg,#c8e8ff,#5bb3e8)",
            borderRadius: "40% 40% 15% 15%",
          }} />
        </div>
        <div style={{
          position: "absolute", bottom: 0, left: 0,
          width: "100%", height: "60%", background: "currentColor",
          borderRadius: "50% 50% 30% 30% / 60% 60% 40% 40%",
        }}>
          <div style={{
            position: "absolute", right: "-22%", bottom: "12%",
            width: "26%", height: "44%", background: "currentColor",
            filter: "brightness(.65)", borderRadius: "30% 50% 50% 30%",
          }} />
        </div>
      </div>
    </div>
  );
}

// Individual code box — one letter at a time
function CodeBox({ value, highlight }) {
  return (
    <div style={{
      width: 52, height: 64,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: value ? "rgba(155,89,182,0.22)" : "rgba(255,255,255,.04)",
      border: `2px solid ${value ? "#9b59b6" : "rgba(155,89,182,0.25)"}`,
      borderRadius: 10,
      fontFamily: "'Cinzel Decorative', serif",
      fontSize: "1.6rem", fontWeight: 900,
      color: value ? "#c39bff" : "rgba(155,89,182,0.3)",
      boxShadow: value ? "0 0 16px rgba(155,89,182,0.4), inset 0 0 10px rgba(155,89,182,0.1)" : "none",
      transition: "all .2s",
      textTransform: "uppercase",
      letterSpacing: 0,
    }}>
      {value || "·"}
    </div>
  );
}

export function JoinRoom({ onBack }) {
  const { joinRoom, error } = useGame();
  const [code, setCode] = useState("");
  const inputRef = useRef(null);

  const letters = Array.from({ length: 6 }, (_, i) => code[i] || "");
  const isReady = code.length >= 4;

  function handleInput(e) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(val);
  }

  return (
    <div className="screen" style={{
      background: "radial-gradient(ellipse at 50% 40%, #0e0520 0%, #060310 75%)",
      flexDirection: "column", gap: "1.5rem",
      padding: "2rem",
    }}>
      {/* Stars */}
      {Array.from({ length: 35 }, (_, i) => (
        <div key={i} className="star" style={{
          width: Math.random() * 2.5 + 1, height: Math.random() * 2.5 + 1,
          top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
          animationDuration: `${Math.random() * 3 + 2}s`,
          animationDelay: `${Math.random() * 4}s`,
        }} />
      ))}

      {/* Breathing orbs — purple portal vibe */}
      <div className="orb" style={{ width: 500, height: 500, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(155,89,182,0.12)", animationDuration: "6s" }} />
      <div className="orb" style={{ width: 320, height: 320, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(124,58,237,0.10)", animationDuration: "4s", animationDelay: "1s" }} />
      <div className="orb" style={{ width: 180, height: 180, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(168,85,247,0.14)", animationDuration: "3s", animationDelay: "0.5s" }} />

      {/* Portal rune ring */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 380, height: 380, borderRadius: "50%",
        border: "1.5px solid rgba(155,89,182,0.2)",
        animation: "spin 20s linear infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 320, height: 320, borderRadius: "50%",
        border: "1.5px dashed rgba(168,85,247,0.15)",
        animation: "spin 15s linear infinite reverse",
        pointerEvents: "none",
      }} />

      {/* Floating crewmates */}
      {DECO_CREW.map((c, i) => <DecoCrewmate key={i} {...c} />)}

      {/* Back button */}
      <button onClick={onBack} className="btn btn-ghost btn-sm" style={{
        position: "absolute", top: "1.5rem", left: "1.5rem", zIndex: 2,
        fontFamily: "'Rajdhani', sans-serif", letterSpacing: ".08em",
      }}>
        ← Back
      </button>

      {/* Center content */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: "1.4rem",
        textAlign: "center", maxWidth: 440,
      }} className="animate-fadeIn">

        {/* Door icon */}
        <div style={{ fontSize: "3.5rem", filter: "drop-shadow(0 0 20px rgba(155,89,182,0.6))", animation: "breathe 3s ease-in-out infinite" }}>
          🚪
        </div>

        {/* Title */}
        <div>
          <h1 className="cinzel" style={{
            fontSize: "clamp(2rem, 6vw, 3rem)", fontWeight: 900,
            color: "#c39bff", margin: 0,
            textShadow: "0 0 30px rgba(155,89,182,0.6), 0 0 60px rgba(155,89,182,0.3)",
          }}>
            Join a Room
          </h1>
          <p style={{
            color: "rgba(255,255,255,.4)", fontSize: ".85rem",
            fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.6,
            marginTop: ".5rem", maxWidth: 300,
          }}>
            Enter the unique room code provided by your party leader to join their game session.
          </p>
        </div>

        {/* Code boxes (visual display) */}
        <div
          style={{ display: "flex", gap: ".5rem", cursor: "text" }}
          onClick={() => inputRef.current?.focus()}
        >
          {letters.map((ch, i) => <CodeBox key={i} value={ch} />)}
        </div>

        {/* Hidden real input */}
        <input
          ref={inputRef}
          value={code}
          onChange={handleInput}
          onKeyDown={e => e.key === "Enter" && isReady && joinRoom(code)}
          maxLength={6}
          autoFocus
          style={{
            position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none",
          }}
        />

        {/* Status line */}
        <p style={{
          fontFamily: "'Rajdhani', sans-serif", fontSize: ".85rem", margin: 0,
          color: isReady ? "#2ecc71" : "rgba(255,255,255,.3)",
          letterSpacing: ".08em",
          transition: "color .3s",
        }}>
          {isReady ? "✦  Looking good! Hit Join when ready  ✦" : "Type your room code…"}
        </p>

        {error && (
          <div style={{ background: "var(--crimson)", color: "#fff", padding: ".6rem 1.2rem", borderRadius: 8, fontSize: ".85rem" }}>
            ⚠ {error}
          </div>
        )}

        {/* Join button */}
        <button
          className="btn btn-full"
          onClick={() => joinRoom(code)}
          disabled={!isReady}
          style={{
            fontSize: "1.1rem", padding: ".9rem 2rem",
            background: isReady
              ? "linear-gradient(135deg, #9b59b6, #6c3483)"
              : "rgba(155,89,182,.1)",
            border: `2px solid ${isReady ? "rgba(155,89,182,.6)" : "rgba(155,89,182,.2)"}`,
            color: isReady ? "#fff" : "rgba(155,89,182,.4)",
            borderRadius: 99,
            fontFamily: "'Cinzel Decorative', serif",
            letterSpacing: ".06em",
            boxShadow: isReady ? "0 0 30px rgba(155,89,182,0.4)" : "none",
            animation: isReady ? "pulse 2s ease-in-out infinite" : "none",
            transition: "all .3s",
            maxWidth: 320, width: "100%",
          }}
        >
          {isReady ? "✦  Join Room  ✦" : "Join Room"}
        </button>

        {/* Mini hint */}
        <p style={{ color: "rgba(255,255,255,.2)", fontSize: ".72rem", fontFamily: "'Rajdhani', sans-serif", margin: 0 }}>
          Click the code boxes above and start typing
        </p>
      </div>
    </div>
  );
}
