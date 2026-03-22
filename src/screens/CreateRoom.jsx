import { useGame } from "../context/GameContext";

const FEATURES = [
  { icon: "⚖️", label: "You pick\nthe rules" },
  { icon: "👥", label: "Up to 10\nplayers" },
  { icon: "🗝️", label: "Instant\nroom code" },
  { icon: "🗺️", label: "Choose\nmap & mode" },
  { icon: "⛓️", label: "On-chain\nresults" },
  { icon: "⚔️", label: "Roles\nassigned fairly" },
];

// Floating crewmate decorations around the screen
const DECO_CREW = [
  { color: "#e74c3c", top: "12%",  left: "3%",  size: 62, dur: 3.1, delay: 0 },
  { color: "#3498db", top: "55%",  left: "2%",  size: 52, dur: 2.7, delay: 0.7 },
  { color: "#f0c040", top: "80%",  left: "6%",  size: 58, dur: 3.5, delay: 0.3 },
  { color: "#9b59b6", top: "10%",  right: "3%", size: 56, dur: 2.9, delay: 1.0 },
  { color: "#2ecc71", top: "72%",  right: "4%", size: 60, dur: 3.3, delay: 0.5 },
];

function DecoCrewmate({ color, top, left, right, size, dur, delay }) {
  return (
    <div style={{
      position: "absolute", top, left, right,
      width: size, height: size,
      color,
      animation: `crewBob ${dur}s ease-in-out ${delay}s infinite`,
      pointerEvents: "none", zIndex: 0, opacity: 0.45,
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
            boxShadow: "inset 0 2px 8px rgba(0,0,0,.3)",
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

export function CreateRoom({ onBack }) {
  const { createRoom, socketReady, error } = useGame();

  return (
    <div className="screen" style={{
      background: "radial-gradient(ellipse at 40% 35%, #0d1a2e 0%, #090a0f 70%)",
      alignItems: "center", justifyContent: "center", flexDirection: "column",
      gap: "1.5rem", padding: "2rem", overflowY: "auto",
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

      {/* Breathing orbs */}
      <div className="orb" style={{ width: 500, height: 500, top: "-15%", left: "-15%", background: "rgba(52,152,219,0.1)", animationDuration: "8s" }} />
      <div className="orb" style={{ width: 380, height: 380, bottom: "-12%", right: "-10%", background: "rgba(240,196,64,0.08)", animationDuration: "6s", animationDelay: "2s" }} />

      {/* Floating crewmate decorations */}
      {DECO_CREW.map((c, i) => <DecoCrewmate key={i} {...c} />)}

      {/* Back button */}
      <button onClick={onBack} className="btn btn-ghost btn-sm" style={{
        position: "absolute", top: "1.5rem", left: "1.5rem", zIndex: 2,
        fontFamily: "'Rajdhani', sans-serif", letterSpacing: ".08em",
      }}>
        ← Back
      </button>

      {/* Main content — two column layout */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", gap: "2.5rem", alignItems: "flex-start",
        width: "100%", maxWidth: 820,
        flexWrap: "wrap", justifyContent: "center",
      }} className="animate-fadeIn">

        {/* Left: Title + features */}
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".9rem", marginBottom: ".8rem" }}>
            <span style={{ fontSize: "2.8rem" }}>🏰</span>
            <div>
              <h1 className="cinzel" style={{
                fontSize: "clamp(1.8rem, 5vw, 2.6rem)", fontWeight: 900,
                color: "var(--gold)", lineHeight: 1.1, margin: 0,
                textShadow: "0 0 30px rgba(240,196,64,0.4)",
              }}>
                Create<br />A Room
              </h1>
            </div>
          </div>

          <p style={{
            color: "rgba(255,255,255,.5)", fontSize: ".92rem",
            fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.6,
            marginBottom: "1.5rem", maxWidth: 320,
          }}>
            Design your custom game lobby and invite allies to face the darkness together.
          </p>

          {/* Feature grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".6rem", marginBottom: "1.8rem" }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(240,196,64,0.15)",
                borderRadius: 10, padding: ".7rem .5rem",
                textAlign: "center",
                transition: "background .2s, border-color .2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(240,196,64,.07)"; e.currentTarget.style.borderColor = "rgba(240,196,64,0.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.04)"; e.currentTarget.style.borderColor = "rgba(240,196,64,0.15)"; }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: ".3rem" }}>{f.icon}</div>
                <div style={{
                  fontSize: ".7rem", color: "rgba(255,255,255,.55)",
                  fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.3, whiteSpace: "pre-line",
                }}>
                  {f.label}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ background: "var(--crimson)", color: "#fff", padding: ".6rem .9rem", borderRadius: 8, marginBottom: "1rem", fontSize: ".85rem" }}>
              ⚠ {error}
            </div>
          )}

          <button
            className="btn btn-gold btn-full"
            onClick={createRoom}
            disabled={!socketReady}
            style={{
              fontSize: "1.15rem", padding: "1rem",
              fontFamily: "'Cinzel Decorative', serif",
              letterSpacing: ".06em",
              animation: socketReady ? "pulse 2.2s ease-in-out infinite" : "none",
              boxShadow: socketReady ? "0 0 30px rgba(240,196,64,0.35)" : "none",
            }}
          >
            {socketReady ? "✦ Create Room ✦" : "⏳ Connecting…"}
          </button>
        </div>

        {/* Right: Lobby preview card */}
        <div style={{
          flex: "0 0 240px",
          background: "linear-gradient(160deg, rgba(30,20,10,.9) 0%, rgba(20,15,8,.95) 100%)",
          border: "2px solid rgba(240,196,64,0.3)",
          borderRadius: 16,
          padding: "1.2rem",
          boxShadow: "0 0 40px rgba(240,196,64,0.1), 0 8px 32px rgba(0,0,0,.6)",
        }}>
          <h3 className="cinzel" style={{
            textAlign: "center", fontSize: ".85rem", color: "var(--gold)",
            letterSpacing: ".12em", marginBottom: "1rem",
          }}>
            Game Lobby Preview
          </h3>

          {/* Room code preview */}
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            <div className="cinzel" style={{
              fontSize: "2rem", fontWeight: 900, letterSpacing: ".3em",
              color: "var(--gold)", textShadow: "0 0 20px rgba(240,196,64,0.5)",
            }}>
              DUNGEON
            </div>
            <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.35)", fontFamily: "'Rajdhani', sans-serif", letterSpacing: ".12em" }}>
              Room Code
            </div>
          </div>

          {/* Player slots */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: ".5rem", marginBottom: ".85rem" }}>
            {[
              { color: "#e74c3c", filled: true, num: 1 },
              { color: "#3498db", filled: true, num: 2 },
              { color: "#2ecc71", filled: true, num: 3 },
              { color: null,      filled: false, num: 4 },
              { color: null,      filled: false, num: 5 },
              { color: null,      filled: false, num: 6 },
            ].map((slot) => (
              <div key={slot.num} style={{
                width: "100%", aspectRatio: "1",
                borderRadius: "50%",
                background: slot.filled ? slot.color : "rgba(255,255,255,.06)",
                border: slot.filled ? `3px solid ${slot.color}` : "2px dashed rgba(255,255,255,.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,.5)", fontSize: ".7rem",
                fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
                boxShadow: slot.filled ? `0 0 12px ${slot.color}66` : "none",
              }}>
                {slot.filled ? "" : slot.num}
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", fontFamily: "'Rajdhani', sans-serif", fontSize: ".78rem", color: "rgba(255,255,255,.4)" }}>
            Players: 3 / 10
          </div>
          <div style={{ textAlign: "center", fontFamily: "'Rajdhani', sans-serif", fontSize: ".72rem", color: "rgba(255,255,255,.3)", marginTop: ".2rem" }}>
            Waiting for Host…
          </div>
        </div>

      </div>
    </div>
  );
}
