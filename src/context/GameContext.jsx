import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAmongUsProgram } from "../hooks/useAmongUsProgram";

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
  const [txLogs, setTxLogs]             = useState([]); // feeds ChainLog UI
  const [delegationProgress, setDelegProgess] = useState(null); // { delegated, total, players[] }

  const { publicKey } = useWallet();

  // Append a TX log entry — passed to useAmongUsProgram as onTxLog
  const onTxLog = (log) => setTxLogs(prev => {
    const exists = prev.find(l => l.id === log.id);
    if (exists) return prev.map(l => l.id === log.id ? { ...l, ...log } : l);
    return [...prev, log];
  });

  const chain = useAmongUsProgram(chainGameId || "0", { onTxLog });

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
      // Read chainGameId from server so all clients share the same on-chain game_id
      if (room.chainGameId) setChainGameId(room.chainGameId);
    });

    s.on("roomJoined", ({ room }) => {
      seedTransforms(room.players, true);
      setRoom(room);
      setPhase("lobby");
      if (room.chainGameId) setChainGameId(room.chainGameId);
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

    s.on("countdownTick", ({ count }) => setCount(count));

    s.on("roleAssigned", ({ role }) => {
      console.log("[game] role assigned:", role);
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
      // Auto-trigger resolveVote on-chain (host resolves based on socket result)
      if (result && myIdRef.current === roomRef.current?.hostId) {
        const ejectedPlayer = result.ejectedId
          ? roomRef.current?.players[result.ejectedId]
          : null;
        const ejectedWallet = ejectedPlayer?.walletPubkey || null;
        chain.commands.resolveVote(ejectedWallet)
          .catch(e => console.warn("[chain] resolveVote:", e.message));
      }
    });

    s.on("taskCompleted", ({ taskProgress }) => setTaskProgress(taskProgress));

    s.on("roomError", ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 3500);
    });

    // ── playerMoved: write to Map ONLY — zero React re-renders ──────────────
    s.on("playerMoved", ({ id, position, rotation, animation }) => {
      playerTransformsRef.current.set(id, { position, rotation, animation });
    });

    return () => { s.disconnect(); socketRef.current = null; };
  }, []);

  // ── Auto on-chain: createGame when host's room+chainGameId are ready ────────
  useEffect(() => {
    if (!chainGameId || !room || !myId || myId !== room.hostId) return;
    // Only fire once when chainGameId is first set with a valid room
    chain.commands.createGame().catch(e => console.warn("[chain] createGame:", e.message));
  }, [chainGameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto on-chain: joinGame when non-host gets their chainGameId ─────────────
  useEffect(() => {
    if (!chainGameId || !room || !myId || myId === room.hostId) return;
    chain.commands.joinGame().catch(e => console.warn("[chain] joinGame:", e.message));
  }, [chainGameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto on-chain: subscribe to ER WS when teeToken is ready ─────────────────
  useEffect(() => {
    if (!chain.teeToken) return;
    chain.subscribe();
  }, [chain.teeToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── runDelegation: called from DelegatingScreen button click ──────────────
  // MUST be user-gesture initiated — Phantom blocks auto-fired useEffect transactions
  async function runDelegation() {
    const r = roomRef.current;
    if (!r || phase !== "delegating") return;
    try {
      // Host also delegates the shared GameState
      if (myId === r.hostId) {
        await chain.commands.createPermGame();
        await chain.commands.delegateGame();
      }
      // Every player delegates their own PlayerState
      await chain.commands.createPermPlayer();
      await chain.commands.delegatePlayer();
      // Authenticate with TEE
      await chain.commands.authTee();
      // Signal server: this player is ready
      sock()?.emit("playerDelegated", { code: r.code });
      console.log("[chain] delegation complete ✓");
    } catch (e) {
      console.error("[chain] delegation error:", e);
      setError(`Chain error: ${e.message}. Proceeding anyway.`);
      setTimeout(() => setError(null), 5000);
      // Still signal so one player's error doesn't block everyone
      sock()?.emit("playerDelegated", { code: r.code });
    }
  }

  // ── Helper ─────────────────────────────────────────────────────────────────
  const sock = () => socketRef.current;

  // ── Actions ────────────────────────────────────────────────────────────────
  function createRoom() {
    const walletPubkey = publicKey?.toBase58() || null;
    sock()?.emit("createRoom", { name: myPlayer.name || "Player", color: myPlayer.color, walletPubkey });
    // Generate a unique game_id from timestamp for the on-chain contract
    const gameId = String(Date.now());
    setChainGameId(gameId);
  }

  function joinRoom(code) {
    const walletPubkey = publicKey?.toBase58() || null;
    sock()?.emit("joinRoom", {
      code: code.toUpperCase(),
      name: myPlayer.name || "Player",
      color: myPlayer.color,
      walletPubkey,
    });
    // Use the room code as the seed for the game_id (host's timestamp)
    // Will be overwritten when roomJoined fires with the real room data
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
    // On-chain: look up victim's wallet pubkey from room players
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
    // On-chain vote: null targetId = skip
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
    playerTransformsRef.current.clear();
    setRoom(null); setMyRole(null); setIsAlive(true);
    setWinner(null); setMeetingInfo(null); setMeetingResult(null);
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
  function dismissRoleReveal() { setPhase("playing"); }

  const isHost = !!(room && myId && myId === room.hostId);

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
      startCountdown, setReady,
      emitMove,
      killPlayer, reportBody, callEmergencyMeeting,
      castVote, completeTask,
      leaveRoom, backToLobby, goToMenu, dismissRoleReveal,
      // ── On-chain (Solana / MagicBlock ER) ──
      chain,          // the full useAmongUsProgram instance
      chainGameId,
      walletPublicKey: publicKey,
      txLogs,
      delegationProgress,
      runDelegation,   // call from button click — triggers Phantom for delegation txs
    }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);
