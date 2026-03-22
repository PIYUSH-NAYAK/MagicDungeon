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
          3D · Real-time Multiplayer · On-chain
        </p>

        {/* Wallet connect / enter prompt */}
        <div style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          {!publicKey ? (
            <>
              <WalletMultiButton style={{
                background: "linear-gradient(135deg,#9b59b6,#6c3483)",
                border: "none", borderRadius: 99,
                fontSize: ".95rem", fontWeight: 700, padding: ".7rem 1.8rem",
              }} />
              <p style={{ color: "#555577", fontSize: ".8rem" }}>Connect wallet to enter</p>
            </>
          ) : (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: ".5rem",
                background: "rgba(46,204,113,.12)", border: "1px solid rgba(46,204,113,.3)",
                borderRadius: 99, padding: ".4rem 1.1rem", fontSize: ".82rem",
              }}>
                <span style={{ color: "#2ecc71", fontWeight: 700 }}>●</span>
                <span style={{ color: "#a0ffa0" }}>
                  {publicKey.toBase58().slice(0,4)}…{publicKey.toBase58().slice(-4)}
                </span>
                <WalletMultiButton style={{
                  background: "transparent", border: "none",
                  color: "rgba(255,255,255,.35)", fontSize: ".75rem",
                  padding: "0 .3rem", cursor: "pointer",
                }} />
              </div>
              <p style={{ color: "#7a7a9a", fontSize: ".82rem", letterSpacing: ".08em", animation: "pulse 2s infinite" }}>
                Click anywhere or press any key to enter
              </p>
            </>
          )}
        </div>

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
