import { useState } from "react";
import { useGame } from "../context/GameContext";

export function DelegatingScreen() {
  const { delegationProgress, myId, room, walletPublicKey, runDelegation, isHost } = useGame();
  const [signing, setSigning]     = useState(false);
  const [myDone,  setMyDone]      = useState(false);
  const [currentStep, setCurrentStep] = useState("");

  /* ── Step definitions ─────────────────────────────────────────── */
  const hostSteps = [
    "Create game permission (GameState PDA)",
    "Delegate GameState to ER Validator",
    "Create player permission (PlayerState PDA)",
    "Delegate PlayerState to ER Validator",
    "TEE authentication (message sign)",
  ];
  const playerSteps = [
    "Create player permission (PlayerState PDA)",
    "Delegate PlayerState to ER Validator",
    "TEE authentication (message sign)",
  ];
  const steps = isHost ? hostSteps : playerSteps;

  const dp    = delegationProgress;
  const total = dp?.total    || 1;
  const done  = dp?.delegated || 0;
  const pct   = Math.round((done / total) * 100);

  /* ── Sign handler ──────────────────────────────────────────────── */
  async function handleSign() {
    if (signing || myDone) return;
    setSigning(true);
    setCurrentStep(steps[0]);
    try {
      // Intercept each step label by hooking into progression
      // runDelegation fires TXs sequentially — we update the label as each completes
      await runDelegation();
      setMyDone(true);
      setCurrentStep("Done ✓");
    } catch {
      setCurrentStep("Failed — check console");
    } finally {
      setSigning(false);
    }
  }

  const walletShort = walletPublicKey
    ? `${walletPublicKey.toBase58().slice(0, 6)}…${walletPublicKey.toBase58().slice(-4)}`
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
          Blockchain Setup
        </h2>
        <p style={{ color: "rgba(255,255,255,.4)", fontSize: ".85rem", marginTop: ".3rem" }}>
          Delegate accounts to the Ephemeral Rollup for private gameplay
        </p>
      </div>

      {/* My signing card */}
      <div style={{
        background: "rgba(155,89,182,.08)",
        border: `1px solid ${myDone ? "rgba(46,204,113,.4)" : "rgba(155,89,182,.25)"}`,
        borderRadius: 18, padding: "1.5rem", width: "100%", maxWidth: 400,
        transition: "border-color .4s",
      }}>
        {/* Wallet + TX count */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.1rem" }}>
          <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,.35)", fontFamily: "monospace" }}>
            🔑 {walletShort}
          </span>
          <span style={{
            fontSize: ".7rem", padding: ".2rem .6rem", borderRadius: 99,
            background: isHost ? "rgba(231,76,60,.15)" : "rgba(52,152,219,.12)",
            color: isHost ? "#e74c3c" : "#5dade2", fontWeight: 700,
          }}>
            {isHost ? "Host · 4 TXs + sign" : "Player · 2 TXs + sign"}
          </span>
        </div>

        {/* Steps checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: ".55rem", marginBottom: "1.2rem" }}>
          {steps.map((s, i) => {
            const stepDone = myDone || (signing && currentStep && steps.indexOf(currentStep) > i);
            const stepActive = signing && currentStep === s;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: ".65rem" }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: stepDone ? "rgba(46,204,113,.2)" : stepActive ? "rgba(155,89,182,.2)" : "rgba(255,255,255,.04)",
                  border: `1.5px solid ${stepDone ? "#2ecc71" : stepActive ? "#9b59b6" : "rgba(255,255,255,.1)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {stepDone ? <span style={{ fontSize: ".65rem", color: "#2ecc71" }}>✓</span>
                    : stepActive ? <Spin />
                    : <span style={{ fontSize: ".6rem", color: "rgba(255,255,255,.2)" }}>{i + 1}</span>}
                </div>
                <span style={{
                  fontSize: ".82rem",
                  color: stepDone ? "#a0ffa0" : stepActive ? "#c39bd3" : "rgba(255,255,255,.4)",
                }}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>

        {/* CTA button */}
        {!myDone ? (
          <button
            onClick={handleSign}
            disabled={signing}
            style={{
              width: "100%", padding: ".85rem",
              background: signing ? "rgba(155,89,182,.15)" : "linear-gradient(135deg,#9b59b6,#6c3483)",
              border: `1px solid ${signing ? "rgba(155,89,182,.3)" : "transparent"}`,
              borderRadius: 99, cursor: signing ? "default" : "pointer",
              color: "#fff", fontWeight: 800, fontSize: "1rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: ".6rem",
              transition: "all .2s",
            }}
          >
            {signing ? <><Spin size={16} /> Approve in Phantom…</> : "⚡ Sign & Delegate"}
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: ".75rem", padding: ".5rem 0" }}>
            <span style={{ fontSize: "1.4rem" }}>✅</span>
            <p style={{ color: "#a0ffa0", fontWeight: 700, fontSize: ".95rem" }}>
              Ready! Waiting for others…
            </p>
          </div>
        )}
      </div>

      {/* All-players progress */}
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".35rem" }}>
          <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,.35)" }}>Players delegated</span>
          <span style={{ fontSize: ".72rem", color: "#9b59b6", fontWeight: 700 }}>{done} / {total}</span>
        </div>
        <div style={{ background: "rgba(255,255,255,.07)", borderRadius: 99, height: 5, marginBottom: ".85rem" }}>
          <div style={{
            height: "100%", borderRadius: 99,
            background: done === total ? "#2ecc71" : "linear-gradient(90deg,#9b59b6,#5dade2)",
            width: `${pct}%`, transition: "width .5s ease",
          }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".45rem" }}>
          {dp?.players?.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: ".4rem",
              background: p.done ? "rgba(46,204,113,.1)" : "rgba(255,255,255,.04)",
              border: `1px solid ${p.done ? "rgba(46,204,113,.3)" : "rgba(255,255,255,.07)"}`,
              borderRadius: 99, padding: ".25rem .75rem", fontSize: ".78rem",
              transition: "all .4s",
            }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: p.color }} />
              <span style={{ color: p.done ? "#a0ffa0" : "rgba(255,255,255,.45)" }}>{p.name}</span>
              {p.done
                ? <span style={{ color: "#2ecc71", fontSize: ".65rem" }}>✓</span>
                : <Spin size={9} />}
            </div>
          ))}
          {!dp && (
            <span style={{ color: "rgba(255,255,255,.2)", fontSize: ".78rem" }}>Connecting…</span>
          )}
        </div>
      </div>

      <p style={{ color: "rgba(255,255,255,.2)", fontSize: ".72rem", textAlign: "center", maxWidth: 320 }}>
        Countdown starts automatically when all players have delegated
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Spin({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ animation: "spin .9s linear infinite", flexShrink: 0 }}>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9b59b6" strokeWidth="2" strokeDasharray="15 8" />
    </svg>
  );
}
