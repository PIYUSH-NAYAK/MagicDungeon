import { useState } from "react";
import { useGame } from "../context/GameContext";

export function DelegatingScreen() {
  const { delegationProgress, myId, walletPublicKey, chain, runDelegation, isHost } = useGame();
  const [signing, setSigning]   = useState(false);
  const [myDone,  setMyDone]    = useState(false);
  const [stepMsg, setStepMsg]   = useState("");

  const dp     = delegationProgress;
  const total  = dp?.total  || 1;
  const done   = dp?.delegated || 0;
  const pct    = Math.round((done / total) * 100);

  async function handleSign() {
    setSigning(true);
    setStepMsg(isHost ? "Creating game permission…" : "Creating player permission…");
    try {
      await runDelegation();
      setMyDone(true);
      setStepMsg("Done! Waiting for others…");
    } catch {
      setStepMsg("Error — check console. Will proceed anyway.");
    } finally {
      setSigning(false);
    }
  }

  const walletShort = walletPublicKey
    ? `${walletPublicKey.toBase58().slice(0,6)}…${walletPublicKey.toBase58().slice(-4)}`
    : "wallet";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9990,
      background: "radial-gradient(ellipse at 50% 30%, #0d0420 0%, #050509 70%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "2rem", padding: "2rem",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: ".5rem" }}>⛓️</div>
        <h2 style={{
          fontSize: "1.6rem", fontWeight: 800,
          background: "linear-gradient(135deg,#9b59b6,#5dade2)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Preparing Blockchain
        </h2>
        <p style={{ color: "rgba(255,255,255,.4)", fontSize: ".85rem", marginTop: ".3rem" }}>
          Each player delegates their account to the Ephemeral Rollup
        </p>
      </div>

      {/* My signing card */}
      <div style={{
        background: "rgba(155,89,182,.08)", border: `1px solid ${myDone ? "rgba(46,204,113,.35)" : "rgba(155,89,182,.25)"}`,
        borderRadius: 18, padding: "1.5rem", width: "100%", maxWidth: 380,
        transition: "border-color .4s",
      }}>
        <p style={{ fontSize: ".72rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "1rem" }}>
          🔑 {walletShort}
        </p>

        {!myDone ? (
          <>
            <p style={{ color: "rgba(255,255,255,.6)", fontSize: ".88rem", marginBottom: "1.2rem", lineHeight: 1.5 }}>
              {isHost
                ? "Sign ~4 transactions: game permission, delegation, player permission, TEE auth"
                : "Sign ~2 transactions: player permission & delegation, then TEE auth"}
            </p>
            <button
              onClick={handleSign}
              disabled={signing}
              style={{
                width: "100%", padding: ".85rem 1.5rem",
                background: signing
                  ? "rgba(155,89,182,.2)"
                  : "linear-gradient(135deg,#9b59b6,#6c3483)",
                border: "none", borderRadius: 99, cursor: signing ? "not-allowed" : "pointer",
                color: "#fff", fontWeight: 800, fontSize: "1rem",
                display: "flex", alignItems: "center", justifyContent: "center", gap: ".6rem",
                transition: "all .2s",
              }}
            >
              {signing ? <><Spin /> {stepMsg}</> : "⚡ Sign & Delegate"}
            </button>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>✅</span>
            <div>
              <p style={{ color: "#a0ffa0", fontWeight: 700 }}>Delegation complete!</p>
              <p style={{ color: "rgba(255,255,255,.4)", fontSize: ".8rem" }}>{stepMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* All players progress */}
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".4rem" }}>
          <span style={{ fontSize: ".75rem", color: "rgba(255,255,255,.4)" }}>Players Ready</span>
          <span style={{ fontSize: ".75rem", color: "#9b59b6", fontWeight: 700 }}>{done}/{total}</span>
        </div>
        <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 99, height: 6, marginBottom: ".9rem" }}>
          <div style={{
            height: "100%", borderRadius: 99,
            background: "linear-gradient(90deg,#9b59b6,#2ecc71)",
            width: `${pct}%`, transition: "width .5s ease",
          }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
          {dp?.players?.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: ".4rem",
              background: p.done ? "rgba(46,204,113,.1)" : "rgba(255,255,255,.04)",
              border: `1px solid ${p.done ? "rgba(46,204,113,.3)" : "rgba(255,255,255,.07)"}`,
              borderRadius: 99, padding: ".25rem .8rem", fontSize: ".8rem",
              transition: "all .4s",
            }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />
              <span style={{ color: p.done ? "#a0ffa0" : "rgba(255,255,255,.5)" }}>{p.name}</span>
              {p.done ? <span style={{ fontSize: ".65rem", color: "#2ecc71" }}>✓</span> : <Spin size={10} />}
            </div>
          ))}
          {/* Fallback if dp not yet from server */}
          {!dp && (
            <p style={{ color: "rgba(255,255,255,.25)", fontSize: ".8rem" }}>Waiting for players…</p>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Spin({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" style={{ animation: "spin .9s linear infinite", flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5" fill="none" stroke="#9b59b6" strokeWidth="2" strokeDasharray="18 10" />
    </svg>
  );
}
