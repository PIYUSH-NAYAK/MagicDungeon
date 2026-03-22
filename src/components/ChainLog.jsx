import { useState, useEffect, useRef } from "react";

/**
 * ChainLog — floating bottom-right panel showing live blockchain TX status.
 * Receives txLogs from GameContext via useGame() or direct prop.
 * Each log: { id, label, status: 'pending'|'confirmed'|'failed', sig, isER }
 */
export function ChainLog({ logs = [] }) {
  const [visible, setVisible] = useState([]);
  const timers = useRef({});

  useEffect(() => {
    if (!logs.length) return;
    const latest = logs[logs.length - 1];
    setVisible(prev => {
      const exists = prev.find(l => l.id === latest.id);
      if (exists) return prev.map(l => l.id === latest.id ? latest : l);
      return [...prev.slice(-4), latest]; // keep last 5
    });
    // Auto-dismiss confirmed logs after 8s
    if (latest.status === "confirmed") {
      clearTimeout(timers.current[latest.id]);
      timers.current[latest.id] = setTimeout(() => {
        setVisible(prev => prev.filter(l => l.id !== latest.id));
      }, 8000);
    }
  }, [logs]);

  if (!visible.length) return null;

  return (
    <div style={{
      position: "fixed", bottom: 80, right: 16, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: ".45rem",
      pointerEvents: "none",
    }}>
      {visible.map(log => (
        <div key={log.id} style={{
          display: "flex", alignItems: "center", gap: ".6rem",
          background: "rgba(10,10,20,.92)",
          border: `1px solid ${log.status === "confirmed" ? "rgba(46,204,113,.4)" : log.status === "failed" ? "rgba(231,76,60,.4)" : "rgba(155,89,182,.4)"}`,
          borderRadius: 99, padding: ".35rem .9rem",
          fontSize: ".75rem", color: "rgba(255,255,255,.8)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 20px rgba(0,0,0,.5)",
          animation: "slideInRight .25s ease",
          pointerEvents: "all",
        }}>
          {/* Status icon */}
          {log.status === "pending"   && <Spinner />}
          {log.status === "confirmed" && <span style={{ color: "#2ecc71" }}>✓</span>}
          {log.status === "failed"    && <span style={{ color: "#e74c3c" }}>✗</span>}

          {/* Label */}
          <span style={{ color: log.status === "confirmed" ? "#a0ffa0" : "rgba(255,255,255,.7)" }}>
            {log.label}
          </span>

          {/* Layer badge */}
          <span style={{
            fontSize: ".6rem", padding: ".1rem .4rem", borderRadius: 99,
            background: log.isER ? "rgba(155,89,182,.25)" : "rgba(52,152,219,.2)",
            color: log.isER ? "#c39bd3" : "#5dade2",
            fontWeight: 700,
          }}>
            {log.isER ? "ER" : "Base"}
          </span>

          {/* Solscan link when confirmed */}
          {log.sig && log.status === "confirmed" && (
            <a
              href={log.isER
                ? `https://solscan.io/tx/${log.sig}?cluster=custom&customUrl=${encodeURIComponent("https://tee.magicblock.app")}`
                : `https://solscan.io/tx/${log.sig}?cluster=devnet`}
              target="_blank" rel="noreferrer"
              style={{ color: "#9b59b6", fontSize: ".65rem", textDecoration: "none" }}
            >
              {log.sig.slice(0,6)}…
            </a>
          )}
        </div>
      ))}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" style={{ animation: "spin 1s linear infinite" }}>
      <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="#9b59b6" strokeWidth="2" strokeDasharray="20 10" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
