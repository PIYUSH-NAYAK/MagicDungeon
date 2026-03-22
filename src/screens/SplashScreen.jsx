import { useEffect, useRef, useState } from "react";
import { useGame } from "../context/GameContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  size: Math.random() * 60 + 20,
  left: Math.random() * 100,
  duration: Math.random() * 12 + 8,
  delay: Math.random() * 10,
}));

export function SplashScreen() {
  const { setPhaseState } = useGame();
  const { publicKey }     = useWallet();
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const advancedRef = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100);
    // Only keyboard advances — no auto-timer, no global click
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
    if (!publicKey) return;        // must have wallet connected
    if (advancedRef.current) return;
    advancedRef.current = true;
    setFadeOut(true);
    setTimeout(() => setPhaseState("menu"), 500);
  }

  return (
    // Click on the splash overlay itself advances — but scoped to this element only
    <div
      className="screen"
      onClick={advance}
      style={{
        background: "radial-gradient(ellipse at 50% 60%, #1a0a2e 0%, #0a0a0f 70%)",
        cursor: "pointer",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity .5s ease",
      }}
    >
      {/* Particles */}
      <div className="particles">
        {PARTICLES.map(p => (
          <div key={p.id} className="particle" style={{
            width: p.size, height: p.size,
            left: `${p.left}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }} />
        ))}
      </div>

      {/* Main logo */}
      <div style={{
        position: "relative", zIndex: 1, textAlign: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(24px)",
        transition: "opacity .8s ease, transform .8s ease",
      }}>
        <p style={{
          color: "#a855f7", letterSpacing: ".5em", fontSize: ".85rem",
          fontWeight: 600, marginBottom: "1rem", textTransform: "uppercase",
        }}>
          ⚔️ &nbsp; Multiplayer &nbsp; ⚔️
        </p>

        {/* Glitch title */}
        <div style={{ position: "relative", display: "inline-block" }}>
          <h1 style={{
            fontSize: "clamp(3rem, 10vw, 7rem)", fontWeight: 900,
            background: "linear-gradient(135deg, #f0c040, #f97316, #ec4899)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            letterSpacing: "-.03em", lineHeight: 1,
            animation: "glitch1 3s infinite",
          }}>
            MAGIC<br />DUNGEON
          </h1>
          <h1 aria-hidden style={{
            position: "absolute", top: 0, left: 0,
            fontSize: "clamp(3rem, 10vw, 7rem)", fontWeight: 900,
            letterSpacing: "-.03em", lineHeight: 1,
            color: "#7c3aed", opacity: 0.35,
            animation: "glitch2 3s infinite .1s",
            userSelect: "none",
          }}>
            MAGIC<br />DUNGEON
          </h1>
        </div>

        <p style={{ marginTop: "2rem", color: "#7a7a9a", fontSize: ".95rem", letterSpacing: ".12em" }}>
          3D · Real-time Multiplayer
        </p>


      </div>

      {/* Character silhouettes */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
        display: "flex", alignItems: "flex-end", justifyContent: "space-around",
        padding: "0 2rem", opacity: .35, pointerEvents: "none",
      }}>
        {[..."🏃🚶🏃🏃🚶"].map((e, i) => (
          <span key={i} style={{ fontSize: "2.5rem", animation: `floatUp ${4 + i}s ${i * .5}s linear infinite`, opacity: .6 }}>{e}</span>
        ))}
      </div>
    </div>
  );
}
