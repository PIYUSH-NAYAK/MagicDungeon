import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAmongUsProgram } from "../hooks/useAmongUsProgram";
import { toast } from "sonner";

const GameContext = createContext(null);

export const COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#9b59b6",
  "#f39c12", "#1abc9c", "#e91e63", "#795548",
  "#ecf0f1", "#00bcd4",
];

// ─── Provider ─────────────────────────────────────────────────────────────────
export function GameProvider({ children }) {
  const [phase, setPhase]               = useState("splash");
  // Restore name/color from localStorage
  const savedName  = localStorage.getItem("mg_playerName")  || "";
  const savedColor = localStorage.getItem("mg_playerColor") || COLORS[0];
  const [myPlayer, setMyPlayer]         = useState({ name: savedName, color: savedColor });
  const [room, setRoom]                 = useState(null);
  const [error, setError]               = useState(null);
  const [countdownValue, setCount]      = useState(5);
  const [socketReady, setSocketReady]   = useState(false);
  const [myId, setMyId]                 = useState(null);

  const [myRole, setMyRole]             = useState(null);
  const [isAlive, setIsAlive]           = useState(true);
  const [taskProgress, setTaskProgress] = useState({ completed: 0, total: 0 });
  const [meetingInfo, setMeetingInfo]   = useState(null);
  const [meetingTimer, setMeetingTimer] = useState(60);
  const [meetingResult, setMeetingResult] = useState(null);
  const [winner, setWinner]             = useState(null);
  const [chainGameId, setChainGameId]   = useState(null);
  const [onChainCreated, setOnChainCreated] = useState(false); // true once createGame/joinGame confirmed
  const [txLogs, setTxLogs]             = useState([]); // feeds ChainLog UI
  const [delegationProgress, setDelegProgess] = useState(null); // { delegated, total, players[] }
  const [allDelegated, setAllDelegated] = useState(false);
  const [gameStartedAt, setGameStartedAt] = useState(null); // ms timestamp when "playing" phase began

  const { publicKey } = useWallet();

  // Append a TX log entry — passed to useAmongUsProgram as onTxLog
  const onTxLog = (log) => {
    setTxLogs(prev => {
      const exists = prev.find(l => l.id === log.id);
      if (exists) return prev.map(l => l.id === log.id ? { ...l, ...log } : l);
      return [...prev, log];
    });
    if (log.status === "confirmed" && log.sig) {
      const explorerUrl = log.isER
        ? `https://solscan.io/tx/${log.sig}?cluster=custom&customUrl=${encodeURIComponent("https://tee.magicblock.app")}`
        : `https://solscan.io/tx/${log.sig}?cluster=devnet`;
      toast.success(log.label, {
        description: `${log.sig.slice(0, 8)}…${log.sig.slice(-6)}`,
        action: { label: "View", onClick: () => window.open(explorerUrl, "_blank") },
        duration: 6000,
      });
    } else if (log.status === "failed") {
      toast.error(`Failed: ${log.label}`, { duration: 5000 });
    }
  };

  const chain = useAmongUsProgram(chainGameId || "0", { onTxLog });

  // Declared early so it's available in useEffect dependency arrays below
  // (re-evaluated each render, same logic as the const at the bottom)
  const isHost = !!(room && myId && myId === room?.hostId);

  const socketRef = useRef(null);
  const roomRef   = useRef(null);
  const myIdRef   = useRef(null);
  const phaseRef  = useRef("splash");     // mirror of phase for use inside socket handlers

  // ── Position store ─────────────────────────────────────────────────────────
  // Map<playerId, {position, rotation, animation}>
  // Written by playerMoved (high-frequency). NEVER triggers React re-renders.
  const playerTransformsRef = useRef(new Map());

  // emitMove throttle: track last-sent time
  const lastMoveEmitRef = useRef(0);
  const MOVE_THROTTLE_MS = 50; // 20 fps max

  useEffect(() => { roomRef.current  = room;  }, [room]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Seed/update the transform Map from a full player list (roomCreated/roomJoined/roomUpdate)
  // During active gameplay we do NOT overwrite entries that already exist — those
  // already have live positions from playerMoved, which are more up-to-date.
  function seedTransforms(players, overwrite = false) {
    for (const [id, p] of Object.entries(players)) {
      if (p.position && (overwrite || !playerTransformsRef.current.has(id))) {
        playerTransformsRef.current.set(id, {
          position:  p.position,
          rotation:  p.rotation  ?? 0,
          animation: p.animation ?? "idle",
        });
      }
    }
    // Remove stale entries for players who left
    for (const id of playerTransformsRef.current.keys()) {
      if (!players[id]) playerTransformsRef.current.delete(id);
    }
  }

  // ── Connect socket ─────────────────────────────────────────────────────────
  useEffect(() => {
    const s = io("http://localhost:3001");
    socketRef.current = s;
    myIdRef.current   = null;

    s.on("connect", () => {
      console.log("[socket] connected:", s.id);
      myIdRef.current = s.id;
      setMyId(s.id);
      setSocketReady(true);

      // Attempt session recovery after a page refresh
      const saved = sessionStorage.getItem("mg_session");
      if (saved) {
        try {
          const session = JSON.parse(saved);
          s.emit("rejoinRoom", session);
        } catch {}
      }
    });

    s.on("disconnect", () => {
      console.log("[socket] disconnected");
      setSocketReady(false);
    });

    s.on("connect_error", (err) => {
      console.error("[socket] connect_error:", err.message);
      setError("Cannot reach server — make sure node server.js is running.");
      setTimeout(() => setError(null), 5000);
    });

    s.on("roomCreated", ({ room }) => {
      seedTransforms(room.players, true);
      setRoom(room);
      setPhase("lobby");
      if (room.chainGameId) setChainGameId(room.chainGameId);
      // Persist session so a page refresh can rejoin automatically
      const me = room.players[s.id];
      sessionStorage.setItem("mg_session", JSON.stringify({
        code: room.code,
        walletPubkey: me?.walletPubkey || null,
        name: me?.name || "",
      }));
    });

    s.on("roomJoined", ({ room }) => {
      seedTransforms(room.players, true);
      setRoom(room);
      setPhase("lobby");
      if (room.chainGameId) setChainGameId(room.chainGameId);
      const me = room.players[s.id];
      sessionStorage.setItem("mg_session", JSON.stringify({
        code: room.code,
        walletPubkey: me?.walletPubkey || null,
        name: me?.name || "",
      }));
    });

    s.on("rejoinedRoom", ({ room }) => {
      seedTransforms(room.players, true);
      setRoom(room);
      if (room.chainGameId) setChainGameId(room.chainGameId);
      setOnChainCreated(true);
      // Restore my player state
      const me = room.players[s.id];
      if (me) {
        setMyRole(me.role || null);
        setIsAlive(me.alive !== false);
      }
      // Jump straight to the room's current phase
      const p = room.phase;
      if (["lobby","character_select","game_mode","delegating","countdown","role_reveal","playing","meeting","results"].includes(p)) {
        setPhase(p);
      }
      console.log("[socket] rejoined room", room.code, "phase:", room.phase);
    });

    s.on("roomUpdate", (updated) => {
      // During gameplay (playing/meeting), DON'T overwrite live transform positions —
      // playerMoved keeps them accurate. Only seed entries for NEW players.
      const isPlaying = ["playing", "meeting"].includes(phaseRef.current);
      seedTransforms(updated.players, !isPlaying);

      setRoom({ ...updated });
      if (updated.taskProgress) setTaskProgress(updated.taskProgress);
      if (updated.winner)       setWinner(updated.winner);

      const authoritativePhases = ["countdown", "role_reveal", "playing", "meeting", "results"];
      if (authoritativePhases.includes(updated.phase)) {
        if (updated.phase === "playing") setGameStartedAt(prev => prev ?? Date.now());
        setPhase(updated.phase);
      } else if (updated.phase === "lobby") {
        setPhase("lobby");
      } else if (updated.phase === "character_select") {
        setPhase(prev => prev === "lobby" ? "character_select" : prev);
      } else if (updated.phase === "delegating") {
        setPhase("delegating");
      }
    });

    s.on("delegationProgress", (progress) => setDelegProgess(progress));
    s.on("allDelegated", () => setAllDelegated(true));

    s.on("countdownTick", ({ count }) => setCount(count));

    s.on("roleAssigned", ({ role }) => {
      console.log("[game] role assigned (server-confirmed):", role);
      setMyRole(role);
      setIsAlive(true);
    });

    s.on("playerKilled", ({ victimId }) => {
      if (victimId === s.id) setIsAlive(false);
    });

    s.on("meetingCalled", (info) => {
      setMeetingInfo(info);
      setMeetingTimer(60);
      setMeetingResult(null);
    });

    s.on("meetingTimer", ({ timeLeft }) => setMeetingTimer(timeLeft));

    s.on("voteUpdate", ({ votes }) => {
      setRoom(prev => prev ? { ...prev, votes } : prev);
    });

    s.on("meetingResult", (result) => {
      setMeetingResult(result);
      // Host resolves vote on-chain
      if (result && myIdRef.current === roomRef.current?.hostId) {
        const ejectedSocketId = result.ejected?.id || null;
        const ejectedPlayer   = ejectedSocketId ? roomRef.current?.players[ejectedSocketId] : null;
        const ejectedWallet   = ejectedPlayer?.walletPubkey || null;
        chain.commands.resolveVote(ejectedWallet)
          .catch(e => console.warn("[chain] resolveVote:", e.message));
      }
    });

    s.on("taskCompleted", ({ taskProgress }) => setTaskProgress(taskProgress));

    s.on("roomError", ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 3500);
      // If a rejoin attempt failed, clear the stale session so user gets the menu
      sessionStorage.removeItem("mg_session");
    });

    // ── playerMoved: write to Map ONLY — zero React re-renders ──────────────
    s.on("playerMoved", ({ id, position, rotation, animation }) => {
      playerTransformsRef.current.set(id, { position, rotation, animation });
    });

    return () => { s.disconnect(); socketRef.current = null; };
  }, []);

  // ── Manual on-chain: joiners click this in lobby (Phantom requires user gesture) ──
  // Polls until the host's createGame TX confirms, then calls joinGame.
  async function registerOnChain() {
    const r = roomRef.current;
    if (!r || !chainGameId) {
      setError("Room or game ID not ready — try again in a moment.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    // Wait up to 30s for the host's createGame to confirm, then call joinGame
    setError("⏳ Waiting for host to create game on-chain…");
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        await chain.commands.joinGame(chainGameId);
        setOnChainCreated(true);
        setError(null);
        return;
      } catch (e) {
        const isNotInit = e.message?.includes("AccountNotInitialized") || e.message?.includes("0xbc4");
        if (!isNotInit || attempt === 14) {
          setError(`On-chain error: ${e.message}`);
          setTimeout(() => setError(null), 5000);
          return;
        }
        // Host hasn't confirmed createGame yet — wait 2s and retry
        await new Promise(res => setTimeout(res, 2000));
      }
    }
  }

  // ── Auto on-chain: subscribe to ER WS when teeToken is ready ─────────────────
  useEffect(() => {
    if (!chain.teeToken) return;
    chain.subscribe();
  }, [chain.teeToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── After role_reveal: ALL players sync ER state to get their on-chain role ───
  useEffect(() => {
    if (phase !== "role_reveal") return;
    // Give the ER a moment to settle after startGame TX, then sync
    const t = setTimeout(() => chain.syncAllState(), 1500);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ER role as fallback display (server's roleAssigned is primary) ──────────
  useEffect(() => {
    if (!chain.erRole) return;
    // Only override if server hasn't set a role yet (e.g. ER subscription fires first)
    setMyRole(prev => prev || chain.erRole);
  }, [chain.erRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ER-driven: task progress (authoritative counters from chain) ──────────────
  useEffect(() => {
    const gs = chain.gameState;
    if (!gs || gs.totalTasks === 0) return;
    setTaskProgress({ completed: gs.tasksCompleted, total: gs.totalTasks });
  }, [chain.gameState?.tasksCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ER-driven: phase transitions ─────────────────────────────────────────────
  useEffect(() => {
    const gs = chain.gameState;
    if (!gs) return;
    // Game over — ER is authoritative for the final result
    if (gs.phase?.ended !== undefined && phase !== "results") {
      const r = gs.result;
      if (r?.crewmatesWin !== undefined) setWinner("crewmates");
      else if (r?.impostorsWin !== undefined) setWinner("impostors");
      setPhase("results");
    }
  }, [chain.gameState?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ER-driven: kill broadcast from alive[] diff ───────────────────────────────
  useEffect(() => {
    const kill = chain.latestKill;
    if (!kill) return;
    const r = roomRef.current;
    if (!r) return;
    const victimB58 = kill.victimPk.toBase58();
    // Find the socket-player whose walletPubkey matches the on-chain victim pubkey
    const entry = Object.entries(r.players).find(([, p]) => p.walletPubkey === victimB58);
    if (!entry) return;
    const [victimSocketId] = entry;
    // Mark dead in local room state — mirrors what the socket "playerKilled" event does
    setRoom(prev => {
      if (!prev?.players[victimSocketId]) return prev;
      return {
        ...prev,
        players: {
          ...prev.players,
          [victimSocketId]: { ...prev.players[victimSocketId], alive: false, animation: "death" },
        },
      };
    });
    // If it's me, update my liveness
    if (victimSocketId === myIdRef.current) setIsAlive(false);
  }, [chain.latestKill]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── runDelegation: called from DelegatingScreen button click ──────────────
  // MUST be user-gesture initiated — Phantom blocks auto-fired useEffect transactions
  // onStep(id) is called BEFORE each step begins so the UI can track progress.
  // Step IDs (host):   createPermGame → delegateGame → createPermPlayer → delegatePlayer → authTee → done
  // Step IDs (player): createPermPlayer → delegatePlayer → authTee → done
  async function runDelegation(onStep) {
    const r = roomRef.current;
    if (!r || phase !== "delegating") return;
    try {
      if (myId === r.hostId) {
        onStep?.("createPermGame");
        await chain.commands.createPermGame();
        onStep?.("delegateGame");
        await chain.commands.delegateGame();
      }
      onStep?.("createPermPlayer");
      await chain.commands.createPermPlayer();
      onStep?.("delegatePlayer");
      await chain.commands.delegatePlayer();
      onStep?.("authTee");
      await chain.commands.authTee();
      onStep?.("done");
      sock()?.emit("playerDelegated", { code: r.code });
      console.log("[chain] delegation complete ✓");
    } catch (e) {
      console.error("[chain] delegation error:", e);
      onStep?.("failed");
      setError(`Chain error: ${e.message}. Proceeding anyway.`);
      setTimeout(() => setError(null), 5000);
      sock()?.emit("playerDelegated", { code: r.code });
    }
  }

  // ── Helper ─────────────────────────────────────────────────────────────────
  const sock = () => socketRef.current;

  // ── Actions ────────────────────────────────────────────────────────────────
  async function createRoom() {
    const walletPubkey = publicKey?.toBase58() || null;
    const gameId = String(Date.now());
    // Send gameId to server so all clients share the same on-chain game PDA
    sock()?.emit("createRoom", { name: myPlayer.name || "Player", color: myPlayer.color, walletPubkey, chainGameId: gameId });
    // Wait for roomCreated to confirm the server echoed back the same gameId (still within gesture)
    const confirmedId = await new Promise((resolve) => {
      socketRef.current?.once("roomCreated", ({ room }) => resolve(room.chainGameId || gameId));
    });
    setChainGameId(confirmedId);
    try {
      await chain.commands.createGame(confirmedId);
      setOnChainCreated(true);
    } catch (e) {
      console.warn("[chain] createGame:", e.message);
      setError(`On-chain error: ${e.message}`);
      setTimeout(() => setError(null), 5000);
    }
  }

  async function joinRoom(code) {
    const walletPubkey = publicKey?.toBase58() || null;
    sock()?.emit("joinRoom", {
      code: code.toUpperCase(),
      name: myPlayer.name || "Player",
      color: myPlayer.color,
      walletPubkey,
    });
    // Wait for roomJoined response (still within the button-click async chain → Phantom accepts it)
    const gameId = await new Promise((resolve) => {
      socketRef.current?.once("roomJoined", ({ room }) => resolve(room.chainGameId || null));
    });
    if (!gameId) return;
    setChainGameId(gameId);
    // Retry joinGame until host's createGame confirms (AccountNotInitialized = host TX pending)
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        await chain.commands.joinGame(gameId);
        setOnChainCreated(true);
        return;
      } catch (e) {
        const notInit = e.message?.includes("AccountNotInitialized") || e.message?.includes("0xbc4");
        if (!notInit || attempt === 14) {
          setError(`On-chain join failed: ${e.message}`);
          setTimeout(() => setError(null), 5000);
          return;
        }
        await new Promise(res => setTimeout(res, 2000));
      }
    }
  }

  function confirmCharacter(name, color) {
    setMyPlayer({ name, color });
    localStorage.setItem("mg_playerName",  name);
    localStorage.setItem("mg_playerColor", color);
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("setCharacter", { code: r.code, name, color });
    setPhase("game_mode");
  }

  function startGame() {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("setPhase", { code: r.code, phase: "character_select" });
    setPhase("character_select");
  }

  function selectGameMode(mode) {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("setGameMode", { code: r.code, gameMode: mode });
  }

  function selectMap(map) {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("setMap", { code: r.code, map });
  }

  function startCountdown() {
    const r = roomRef.current;
    if (!r) return;
    // Server moves room to 'delegating' phase → each client signs their own txs
    // → server waits for all → then fires countdown → host calls startGame via ER
    sock()?.emit("startCountdown", { code: r.code });
  }

  function beginCountdown() {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("beginCountdown", { code: r.code });
  }

  // ── hostStartGame: called from DelegatingScreen "Start Game" button ────────
  // Phantom popup (startGame ER TX) fires BEFORE countdown begins.
  async function hostStartGame() {
    try {
      await chain.commands.startGame();   // Phantom popup — must be user gesture
      await chain.syncAllState();         // fetch ER-assigned roles for all players
    } catch (e) {
      console.warn("[chain] startGame:", e.message);
      setError(`Start game failed: ${e.message}`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    // Sync ER roles to server so kill/win-condition logic uses the same assignment
    const allStates = chain.allPlayerStates;
    if (allStates && Object.keys(allStates).length > 0) {
      const roles = {};
      for (const [pk, ps] of Object.entries(allStates)) {
        roles[pk] = ps?.role?.impostor !== undefined ? "impostor" : "crewmate";
      }
      const r = roomRef.current;
      if (r) sock()?.emit("syncRoles", { code: r.code, roles });
      console.log("[chain] synced ER roles to server:", roles);
    }

    beginCountdown(); // THEN kick off the 5s countdown via socket
  }

  function setReady(val) {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("setReady", { code: r.code, ready: val });
  }

  // Throttled to MOVE_THROTTLE_MS — plenty for smooth visual sync, ~20fps
  function emitMove(position, rotation, animation) {
    const r = roomRef.current;
    if (!r) return;
    const now = Date.now();
    if (now - lastMoveEmitRef.current < MOVE_THROTTLE_MS) return;
    lastMoveEmitRef.current = now;
    sock()?.emit("move", { code: r.code, position, rotation, animation });
  }

  function killPlayer(targetId) {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("killPlayer", { code: r.code, targetId });
    const victim = r.players[targetId];
    if (victim?.walletPubkey) {
      chain.commands.killPlayer(victim.walletPubkey)
        .catch(e => console.warn("[chain] killPlayer:", e.message));
    }
  }

  function reportBody(bodyId) {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("reportBody", { code: r.code, bodyId });
    chain.commands.callMeeting()
      .catch(e => console.warn("[chain] callMeeting (report):", e.message));
  }

  function callEmergencyMeeting() {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("emergencyMeeting", { code: r.code });
    chain.commands.callMeeting()
      .catch(e => console.warn("[chain] callMeeting (emergency):", e.message));
  }

  function castVote(targetId) {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("castVote", { code: r.code, targetId });
    const target = targetId ? r.players[targetId]?.walletPubkey || null : null;
    chain.commands.submitVote(target)
      .catch(e => console.warn("[chain] submitVote:", e.message));
  }

  function completeTask(taskIndex) {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("completeTask", { code: r.code, taskIndex });
    chain.commands.completeTask()
      .catch(e => console.warn("[chain] completeTask:", e.message));
  }

  function leaveRoom() {
    const r = roomRef.current;
    if (r) sock()?.emit("leaveRoom", { code: r.code });
    sessionStorage.removeItem("mg_session");
    playerTransformsRef.current.clear();
    setRoom(null); setMyRole(null); setIsAlive(true);
    setWinner(null); setMeetingInfo(null); setMeetingResult(null);
    setGameStartedAt(null);
    setPhase("menu");
  }

  function backToLobby() {
    const r = roomRef.current;
    if (!r) return;
    sock()?.emit("backToLobby", { code: r.code });
    setMyRole(null); setIsAlive(true);
    setWinner(null); setMeetingInfo(null); setMeetingResult(null);
  }

  function goToMenu()        { setPhase("menu"); }
  function dismissRoleReveal() { setGameStartedAt(Date.now()); setPhase("playing"); }

  return (
    <GameContext.Provider value={{
      phase, setPhaseState: setPhase,
      myPlayer, setMyPlayer,
      room, error, countdownValue,
      isHost, myId, socketReady,
      myRole, isAlive, taskProgress,
      meetingInfo, meetingTimer, meetingResult,
      winner,
      COLORS,
      playerTransformsRef,   // ref to the live transform Map
      createRoom, joinRoom, startGame,
      confirmCharacter, selectGameMode, selectMap,
      startCountdown, beginCountdown, hostStartGame, setReady,
      emitMove,
      killPlayer, reportBody, callEmergencyMeeting,
      castVote, completeTask,
      leaveRoom, backToLobby, goToMenu, dismissRoleReveal,
      // ── On-chain (Solana / MagicBlock ER) ──
      chain,          // the full useAmongUsProgram instance
      chainGameId,
      onChainCreated, // true once createGame / joinGame tx is confirmed
      walletPublicKey: publicKey,
      txLogs,
      delegationProgress,
      allDelegated,
      gameStartedAt,
      registerOnChain, // call from lobby button click — createGame (host) or joinGame (player)
      runDelegation,   // call from button click — triggers Phantom for delegation txs
    }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);
