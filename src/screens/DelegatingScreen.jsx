import { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";

export function DelegatingScreen() {
  const { delegationProgress, myId, walletPublicKey, chain } = useGame();
  const [myDone, setMyDone] = useState(false);
  const [step, setStep] = useState("Connecting to Solana…");

  // Track chain progress via txLogs for the personal step description
  useEffect(() => {
    if (!chain) return;
    if (chain.teeToken)           { setMyDone(true); setStep("Ready!"); return; }
    if (chain.isLoading)          { return; }
  }, [chain?.teeToken, chain?.isLoading]);

  const dp = delegationProgress;
  const total  = dp?.total || 1;
  const done   = dp?.delegated || 0;
  const pct    = Math.round((done / total) * 100);

  const steps = [
    { label: "Create game permission",   done: myDone },
    { label: "Delegate account to ER",   done: myDone },
    { label: "TEE authentication",       done: myDone },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9990,
      background: "radial-gradient(ellipse at 50% 30%, #0d0420 0%, #050509 70%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "2rem",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: ".5rem", animation: myDone ? "none" : "spin 3s linear infinite" }}>
          {myDone ? "✅" : "⛓️"}
        </div>
        <h2 style={{
          fontSize: "1.6rem", fontWeight: 800,
          background: "linear-gradient(135deg,#9b59b6,#5dade2)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Preparing Blockchain
        </h2>
        <p style={{ color: "rgba(255,255,255,.4)", fontSize: ".85rem", marginTop: ".4rem" }}>
          Each player signs their delegation — game starts when everyone's ready
        </p>
      </div>

      {/* My personal steps */}
      <div style={{
        background: "rgba(155,89,182,.08)", border: "1px solid rgba(155,89,182,.2)",
        borderRadius: 16, padding: "1.25rem 1.75rem", width: "100%", maxWidth: 380,
      }}>
        <p style={{ fontSize: ".72rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: ".85rem" }}>
          🔑 {walletPublicKey ? `${walletPublicKey.toBase58().slice(0,6)}…${walletPublicKey.toBase58().slice(-4)}` : "Your wallet"}
        </p>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: ".75rem",
            marginBottom: ".6rem",
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              background: s.done ? "rgba(46,204,113,.25)" : "rgba(155,89,182,.15)",
              border: `1.5px solid ${s.done ? "#2ecc71" : "rgba(155,89,182,.4)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: ".65rem",
            }}>
              {s.done ? "✓" : <Spin />}
            </div>
            <span style={{ fontSize: ".85rem", color: s.done ? "#a0ffa0" : "rgba(255,255,255,.6)" }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* All players status */}
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".4rem" }}>
          <span style={{ fontSize: ".75rem", color: "rgba(255,255,255,.4)" }}>All Players</span>
          <span style={{ fontSize: ".75rem", color: "#9b59b6", fontWeight: 700 }}>{done}/{total} ready</span>
        </div>
        {/* Progress bar */}
        <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 99, height: 5, marginBottom: "1rem" }}>
          <div style={{
            height: "100%", borderRadius: 99,
            background: "linear-gradient(90deg,#9b59b6,#5dade2)",
            width: `${pct}%`, transition: "width .4s ease",
          }} />
        </div>
        {/* Per-player chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
          {dp?.players?.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: ".4rem",
              background: p.done ? "rgba(46,204,113,.1)" : "rgba(255,255,255,.04)",
              border: `1px solid ${p.done ? "rgba(46,204,113,.3)" : "rgba(255,255,255,.08)"}`,
              borderRadius: 99, padding: ".25rem .75rem", fontSize: ".78rem",
              transition: "all .3s",
            }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />
              <span style={{ color: p.done ? "#a0ffa0" : "rgba(255,255,255,.5)" }}>{p.name}</span>
              {p.done
                ? <span style={{ color: "#2ecc71", fontSize: ".65rem" }}>✓</span>
                : <Spin size={10} />}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Spin({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9b59b6" strokeWidth="1.8" strokeDasharray="15 8" />
    </svg>
  );
}
