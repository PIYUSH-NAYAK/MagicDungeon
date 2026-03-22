import { useEffect, useRef, useState } from "react";
import { useGame } from "../context/GameContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const STARS = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  size: Math.random() * 2.5 + 1,
  top: Math.random() * 100,
  left: Math.random() * 100,
  duration: Math.random() * 3 + 2,
  delay: Math.random() * 4,
}));

// Pentagon positions around center (center = 50vw, 50vh)
// Each entry: top/left as % of viewport, bobbing animation
const CREW = [
  { color: "#e74c3c", top: "8%",  left: "50%",  transform: "translateX(-50%)", size: 80, dur: 3.2, delay: 0,   label: "Rogue" },
  { color: "#3498db", top: "30%", left: "82%",   transform: "",                 size: 68, dur: 2.8, delay: 0.6, label: "Phantom" },
  { color: "#f0c040", top: "68%", left: "72%",   transform: "",                 size: 72, dur: 3.6, delay: 1.2, label: "Knight" },
  { color: "#9b59b6", top: "68%", left: "20%",   transform: "",                 size: 68, dur: 2.6, delay: 0.9, label: "Sorcerer" },
  { color: "#2ecc71", top: "30%", left: "8%",    transform: "",                 size: 74, dur: 3.0, delay: 0.3, label: "Archer" },
];

function CSSCrewmate({ color, size }) {
  return (
    <div style={{ position: "relative", width: size, height: size, color, flexShrink: 0 }}>
      {/* Head */}
      <div style={{
        position: "absolute",
        top: "0%", left: "10%",
        width: "80%", height: "52%",
        background: "currentColor",
        borderRadius: "50% 50% 20% 20%",
      }}>
        {/* Visor */}
        <div style={{
          position: "absolute",
          top: "20%", left: "18%",
          width: "64%", height: "55%",
          background: "linear-gradient(135deg, #c8e8ff 0%, #5bb3e8 100%)",
          borderRadius: "40% 40% 15% 15%",
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.35), 0 0 8px rgba(100,200,255,0.3)",
        }} />
      </div>
      {/* Body */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0,
        width: "100%", height: "60%",
        background: "currentColor",
        borderRadius: "50% 50% 30% 30% / 60% 60% 40% 40%",
      }}>
        {/* Backpack */}
        <div style={{
          position: "absolute",
          right: "-22%", bottom: "12%",
          width: "26%", height: "44%",
          background: "currentColor",
          filter: "brightness(0.65)",
          borderRadius: "30% 50% 50% 30%",
        }} />
      </div>
    </div>
  );
}

function Crewmate({ color, top, left, transform, size, dur, delay, label }) {
  return (
    <div style={{
      position: "absolute",
      top, left,
      transform,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      animation: `crewBob ${dur}s ease-in-out ${delay}s infinite`,
      zIndex: 0,
      pointerEvents: "none",
    }}>
      <CSSCrewmate color={color} size={size} />
      <span style={{
        fontSize: "0.7rem",
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700,
        letterSpacing: ".12em",
        color,
        textTransform: "uppercase",
        opacity: 0.7,
        textShadow: `0 0 10px ${color}88`,
      }}>
        {label}
      </span>
    </div>
  );
}

export function SplashScreen() {
  const { setPhaseState } = useGame();
  const { publicKey }     = useWallet();
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const advancedRef = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100);
    const onKey = (e) => {
      if (["Meta","Control","Alt","Shift"].includes(e.key)) return;
      advance();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t1);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function advance() {
    if (!publicKey) return;
    if (advancedRef.current) return;
    advancedRef.current = true;
    setFadeOut(true);
    setTimeout(() => setPhaseState("menu"), 500);
  }

  return (
    <div
      className="screen"
      onClick={advance}
      style={{
        background: "radial-gradient(ellipse at 50% 50%, #160826 0%, #0a0a0f 72%)",
        cursor: "pointer",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity .5s ease",
      }}
    >
      {/* Stars */}
      {STARS.map(s => (
        <div key={s.id} className="star" style={{
          width: s.size, height: s.size,
          top: `${s.top}%`, left: `${s.left}%`,
          animationDuration: `${s.duration}s`,
          animationDelay: `${s.delay}s`,
        }} />
      ))}

      {/* Subtle breathing orbs */}
      <div className="orb" style={{ width: 420, height: 420, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(124,58,237,0.13)", animationDuration: "7s" }} />
      <div className="orb" style={{ width: 260, height: 260, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(168,85,247,0.10)", animationDuration: "5s", animationDelay: "1.5s" }} />

      {/* 5 Crewmates surrounding center */}
      {CREW.map((c, i) => <Crewmate key={i} {...c} />)}

      {/* Center content */}
      <div style={{
        position: "relative",
        zIndex: 1,
        textAlign: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(20px)",
        transition: "opacity .9s ease, transform .9s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        padding: "2rem",
        maxWidth: 440,
      }}>
        {/* Eyebrow */}
        <p style={{
          color: "#a855f7",
          letterSpacing: ".55em",
          fontSize: ".75rem",
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          textTransform: "uppercase",
          margin: 0,
        }}>
          ⚔️ &nbsp; Multiplayer &nbsp; ⚔️
        </p>

        {/* Shimmer title */}
        <div style={{ position: "relative", lineHeight: 1 }}>
          <h1 className="shimmer-text" style={{
            fontSize: "clamp(3rem, 10vw, 6.5rem)",
            fontWeight: 900,
            letterSpacing: ".02em",
            lineHeight: 1,
            margin: 0,
            animation: "shimmer 4s linear infinite, glitch1 6s infinite",
          }}>
            MAGIC<br />DUNGEON
          </h1>
          {/* Ghost glitch layer */}
          <h1 aria-hidden style={{
            position: "absolute", top: 0, left: 0,
            fontSize: "clamp(3rem, 10vw, 6.5rem)", fontWeight: 900,
            fontFamily: "'Cinzel Decorative', serif",
            lineHeight: 1, margin: 0,
            color: "#7c3aed", opacity: 0.2,
            animation: "glitch2 6s infinite .2s",
            userSelect: "none",
            pointerEvents: "none",
          }}>
            MAGIC<br />DUNGEON
          </h1>
        </div>

        {/* Divider */}
        <div style={{ color: "rgba(240,196,64,0.35)", fontSize: "1rem", letterSpacing: ".4em" }}>
          ✦ ─── ✦
        </div>

        {/* Tagline */}
        <p style={{
          color: "#7a7a9a",
          fontSize: ".88rem",
          letterSpacing: ".15em",
          fontFamily: "'Rajdhani', sans-serif",
          margin: 0,
        }}>
          3D · Real-time · On-chain
        </p>

        {/* Wallet / Enter prompt */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".75rem", marginTop: ".5rem" }}>
          {!publicKey ? (
            <>
              <WalletMultiButton style={{
                background: "linear-gradient(135deg,#9b59b6,#6c3483)",
                border: "none", borderRadius: 99,
                fontSize: ".95rem", fontWeight: 700, padding: ".7rem 1.8rem",
              }} />
              <p style={{ color: "#44445a", fontSize: ".75rem", fontFamily: "'Rajdhani', sans-serif", margin: 0 }}>
                Connect wallet to enter
              </p>
            </>
          ) : (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: ".5rem",
                background: "rgba(46,204,113,.1)", border: "1px solid rgba(46,204,113,.25)",
                borderRadius: 99, padding: ".4rem 1.1rem", fontSize: ".82rem",
              }}>
                <span style={{ color: "#2ecc71", fontWeight: 700 }}>●</span>
                <span style={{ color: "#a0ffa0", fontFamily: "'Rajdhani', sans-serif" }}>
                  {publicKey.toBase58().slice(0,4)}…{publicKey.toBase58().slice(-4)}
                </span>
                <WalletMultiButton style={{
                  background: "transparent", border: "none",
                  color: "rgba(255,255,255,.3)", fontSize: ".75rem",
                  padding: "0 .3rem", cursor: "pointer",
                }} />
              </div>
              <p style={{
                color: "#7a7a9a", fontSize: ".78rem",
                letterSpacing: ".1em",
                fontFamily: "'Rajdhani', sans-serif",
                animation: "pulse 2s infinite",
                margin: 0,
              }}>
                Click anywhere or press any key to enter
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
