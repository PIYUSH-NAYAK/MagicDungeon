import { useState } from "react";
import { useGame } from "../context/GameContext";

// Step definitions — id matches the onStep() keys emitted by runDelegation
const HOST_STEPS = [
  { id: "createPermGame",   label: "Create game permission (GameState PDA)" },
  { id: "delegateGame",     label: "Delegate GameState to ER Validator" },
  { id: "createPermPlayer", label: "Create player permission (PlayerState PDA)" },
  { id: "delegatePlayer",   label: "Delegate PlayerState to ER Validator" },
  { id: "authTee",          label: "TEE authentication (message sign)" },
];

const PLAYER_STEPS = [
  { id: "createPermPlayer", label: "Create player permission (PlayerState PDA)" },
  { id: "delegatePlayer",   label: "Delegate PlayerState to ER Validator" },
  { id: "authTee",          label: "TEE authentication (message sign)" },
];

export function DelegatingScreen() {
  const { delegationProgress, walletPublicKey, runDelegation, isHost, allDelegated, hostStartGame } = useGame();

  const [signing,          setSigning]          = useState(false);
  const [myDone,           setMyDone]           = useState(false);
  const [failed,           setFailed]           = useState(false);
  // Index of the currently active step (-1 = not started yet)
  const [activeStepIdx,    setActiveStepIdx]    = useState(-1);

  const steps = isHost ? HOST_STEPS : PLAYER_STEPS;

  /* ── onStep callback: called by runDelegation before each step ─────────── */
  function onStep(stepId) {
    if (stepId === "done") {
      setMyDone(true);
      setActiveStepIdx(steps.length); // all done
      return;
    }
    if (stepId === "failed") {
      setFailed(true);
      return;
    }
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx !== -1) setActiveStepIdx(idx);
  }

  /* ── Sign handler ──────────────────────────────────────────────────────── */
  async function handleSign() {
    if (signing || myDone) return;
    setSigning(true);
    setFailed(false);
    try {
      await runDelegation(onStep);
    } catch {
      // runDelegation already calls onStep("failed") internally
    } finally {
      setSigning(false);
    }
  }

  const dp    = delegationProgress;
  const total = dp?.total    || 1;
  const done  = dp?.delegated || 0;
  const pct   = Math.round((done / total) * 100);

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
        border: `1px solid ${myDone ? "rgba(46,204,113,.4)" : failed ? "rgba(231,76,60,.4)" : "rgba(155,89,182,.25)"}`,
        borderRadius: 18, padding: "1.5rem", width: "100%", maxWidth: 400,
        transition: "border-color .4s",
      }}>
        {/* Wallet + TX count badge */}
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
          {steps.map((step, i) => {
            const isDone   = myDone || activeStepIdx > i;
            const isActive = !myDone && activeStepIdx === i;
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center", gap: ".65rem" }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: isDone   ? "rgba(46,204,113,.2)"
                            : isActive ? "rgba(155,89,182,.2)"
                            : "rgba(255,255,255,.04)",
                  border: `1.5px solid ${isDone ? "#2ecc71" : isActive ? "#9b59b6" : "rgba(255,255,255,.1)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isDone
                    ? <span style={{ fontSize: ".65rem", color: "#2ecc71" }}>✓</span>
                    : isActive
                    ? <Spin />
                    : <span style={{ fontSize: ".6rem", color: "rgba(255,255,255,.2)" }}>{i + 1}</span>}
                </div>
                <span style={{
                  fontSize: ".82rem",
                  color: isDone ? "#a0ffa0" : isActive ? "#c39bd3" : "rgba(255,255,255,.4)",
                }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
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
        ) : isHost && allDelegated ? (
          <button
            onClick={hostStartGame}
            style={{
              width: "100%", padding: ".85rem",
              background: "linear-gradient(135deg,#f39c12,#e67e22)",
              border: "none", borderRadius: 99, cursor: "pointer",
              color: "#fff", fontWeight: 800, fontSize: "1rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: ".6rem",
              animation: "hudPulse .9s ease infinite",
            }}
          >
            🚀 Start Game
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: ".75rem", padding: ".5rem 0" }}>
            <span style={{ fontSize: "1.4rem" }}>✅</span>
            <p style={{ color: "#a0ffa0", fontWeight: 700, fontSize: ".95rem" }}>
              {isHost ? "Waiting for other players…" : "Ready! Waiting for host…"}
            </p>
          </div>
        )}

        {failed && !myDone && (
          <p style={{ color: "#e74c3c", fontSize: ".78rem", marginTop: ".6rem", textAlign: "center" }}>
            ⚠ A step failed — check console. You may retry.
          </p>
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
              {p.done ? <span style={{ color: "#2ecc71", fontSize: ".65rem" }}>✓</span> : <Spin size={9} />}
            </div>
          ))}
          {!dp && (
            <span style={{ color: "rgba(255,255,255,.2)", fontSize: ".78rem" }}>Connecting…</span>
          )}
        </div>
      </div>

      <p style={{ color: "rgba(255,255,255,.2)", fontSize: ".72rem", textAlign: "center", maxWidth: 320 }}>
        {allDelegated
          ? isHost ? "All players ready — click Start Game!" : "All players ready — waiting for host…"
          : "Countdown starts when all players have delegated"}
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes hudPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(243,156,18,.4); }
          50%      { box-shadow: 0 0 0 8px rgba(243,156,18,0); }
        }
      `}</style>
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
