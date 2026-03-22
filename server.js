import { Server } from "socket.io";

const io = new Server({ cors: { origin: "*" } });

// ─── State ───────────────────────────────────────────────────────────────────
const rooms = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Send each connected player a personalised view of the room.
// Their OWN role is included; all OTHER players' roles are redacted (private).
function broadcastRoom(code) {
  const room = rooms[code];
  if (!room) return;
  const sids = io.sockets.adapter.rooms.get(code);
  if (!sids) return;
  for (const sid of sids) {
    const payload = {
      ...room,
      players: Object.fromEntries(
        Object.entries(room.players).map(([pid, p]) => [
          pid,
          pid === sid ? p : { ...p, role: undefined },
        ])
      ),
    };
    io.to(sid).emit("roomUpdate", payload);
  }
}

// Internal role assignment — server uses this for win condition logic.
// Roles are NOT sent to clients; clients use the ER (blockchain) for display.
function assignRoles(room) {
  const pids = Object.keys(room.players);
  const impostorCount = Math.max(1, Math.floor(pids.length / 5));
  const shuffled = [...pids].sort(() => Math.random() - 0.5);
  for (let i = 0; i < pids.length; i++) {
    room.players[shuffled[i]].role     = i < impostorCount ? "impostor" : "crewmate";
    room.players[shuffled[i]].alive    = true;
    room.players[shuffled[i]].votedFor = null;
    room.players[shuffled[i]].tasks    = { completed: [], total: 3 };
  }
  const crewmateCount  = Object.values(room.players).filter(p => p.role === "crewmate").length;
  room.taskProgress    = { completed: 0, total: crewmateCount * 3 };
  room.votes           = {};
  room.meetingCallerId = null;
  room.meetingVictimId = null;
}

// Spread players evenly in a ring so they never stack on each other
function spawnPosition(index) {
  const RADIUS = 1.5;
  const angle  = (index / 16) * Math.PI * 2;
  return [
    parseFloat((Math.cos(angle) * RADIUS).toFixed(3)),
    3,   // y=3 is safely above the castle floor — body falls ~0.5s onto floor
    parseFloat((Math.sin(angle) * RADIUS).toFixed(3)),
  ];
}

function getDistance(a, b) {
  if (!a?.position || !b?.position) return Infinity;
  const dx = a.position[0] - b.position[0];
  const dz = a.position[2] - b.position[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function checkWinCondition(room) {
  const players        = Object.values(room.players);
  const aliveImpostors = players.filter(p => p.role === "impostor" && p.alive !== false);
  const aliveCrewmates = players.filter(p => p.role === "crewmate" && p.alive !== false);
  // Don't evaluate until roles are assigned
  if (aliveImpostors.length === 0 && aliveCrewmates.length === 0) return null;
  // Impostors win when they match or outnumber alive crewmates (and game has started)
  if (aliveImpostors.length > 0 && aliveImpostors.length >= aliveCrewmates.length) return "impostors";
  // Crewmates win: all tasks done OR no impostors left
  if (room.taskProgress.total > 0 && room.taskProgress.completed >= room.taskProgress.total) return "crewmates";
  if (aliveImpostors.length === 0) return "crewmates";
  return null;
}

// Timers for soft-disconnected players (socketId → timeout handle)
const reconnectTimers = {};

// immediate=true  → hard-remove immediately (explicit leave / lobby disconnect)
// immediate=false → soft-remove during active phases (give 30s to refresh/rejoin)
function cleanupPlayer(socketId, immediate = false) {
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    if (!room.players[socketId]) continue;

    const activePhases = ["character_select", "game_mode", "delegating", "countdown", "role_reveal", "playing", "meeting", "results"];
    if (!immediate && activePhases.includes(room.phase)) {
      // Soft disconnect — mark player and wait 30s for rejoin
      room.players[socketId].disconnected = true;
      broadcastRoom(code);
      clearTimeout(reconnectTimers[socketId]);
      reconnectTimers[socketId] = setTimeout(() => cleanupPlayer(socketId, true), 30_000);
    } else {
      // Hard remove
      clearTimeout(reconnectTimers[socketId]);
      delete reconnectTimers[socketId];
      delete room.players[socketId];

      if (room.hostId === socketId) {
        const remaining = Object.keys(room.players);
        room.hostId = remaining[0] || null;
      }

      if (Object.keys(room.players).length === 0) {
        delete rooms[code];
        console.log(`Room ${code} deleted (empty)`);
      } else {
        broadcastRoom(code);
      }
    }
    break;
  }
}

// ─── Socket handlers ─────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // ── Create room ──────────────────────────────────────────────────────────
  socket.on("createRoom", ({ name, color, walletPubkey, chainGameId }) => {
    let code;
    do { code = generateCode(); } while (rooms[code]);

    rooms[code] = {
      code,
      hostId: socket.id,
      phase: "lobby",
      gameMode: "impostor",
      map: "medieval_fantasy_book",
      chainGameId: chainGameId || String(Date.now()),  // use host-provided ID so all clients share same on-chain game
      delegatedPlayers: {},             // tracks which players completed on-chain delegation
      allDelegated: false,
      maxPlayers: 10,
      taskProgress: { completed: 0, total: 0 },
      votes: {},
      meetingCallerId: null,
      meetingVictimId: null,
      players: {
        [socket.id]: {
          id: socket.id,
          walletPubkey: walletPubkey || null,
          name: name || "Player",
          color: color || "#e74c3c",
          ready: false,
          alive: true,
          role: null,
          votedFor: null,
          tasks:    { completed: [], total: 3 },
          position: spawnPosition(0),
          rotation: 0,
          animation: "idle",
        },
      },
    };

    socket.join(code);
    socket.emit("roomCreated", { code, room: rooms[code] });
    console.log(`Room ${code} created by ${socket.id}`);
  });

  // ── Join room ─────────────────────────────────────────────────────────────
  socket.on("joinRoom", ({ code, name, color, walletPubkey }) => {
    const room = rooms[code];
    if (!room) { socket.emit("roomError", { message: "Room not found." }); return; }
    if (room.phase !== "lobby" && room.phase !== "character_select") {
      socket.emit("roomError", { message: "Game already in progress." }); return;
    }
    const playerCount = Object.keys(room.players).length;
    if (playerCount >= room.maxPlayers) {
      socket.emit("roomError", { message: "Room is full." }); return;
    }

    room.players[socket.id] = {
      id: socket.id,
      walletPubkey: walletPubkey || null,
      name: name || "Player",
      color: color || "#3498db",
      ready: false,
      alive: true,
      role: null,
      votedFor: null,
      tasks:    { completed: [], total: 3 },
      position: spawnPosition(playerCount),   // unique ring slot
      rotation: 0,
      animation: "idle",
    };

    socket.join(code);
    socket.emit("roomJoined", { code, room });
    broadcastRoom(code);
    console.log(`${socket.id} joined room ${code}`);
  });

  // ── Update character ─────────────────────────────────────────────────────
  socket.on("setCharacter", ({ code, name, color }) => {
    const room = rooms[code];
    if (!room?.players[socket.id]) return;
    room.players[socket.id].name  = name;
    room.players[socket.id].color = color;
    broadcastRoom(code);
  });

  // ── Toggle ready ──────────────────────────────────────────────────────────
  socket.on("setReady", ({ code, ready }) => {
    const room = rooms[code];
    if (!room?.players[socket.id]) return;
    room.players[socket.id].ready = ready;
    broadcastRoom(code);
  });

  // ── Advance phase (host only) ─────────────────────────────────────────────
  socket.on("setPhase", ({ code, phase }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.phase = phase;
    broadcastRoom(code);
  });

  // ── Set game mode (host only) ─────────────────────────────────────────────
  socket.on("setGameMode", ({ code, gameMode }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.gameMode = gameMode;
    broadcastRoom(code);
  });

  // ── Set map (host only) ───────────────────────────────────────────────────
  socket.on("setMap", ({ code, map }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.map = map;
    broadcastRoom(code);
  });

  // ── Countdown + role assignment ───────────────────────────────────────────
  socket.on("startCountdown", ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;

    // Reset spawn positions
    const pids = Object.keys(room.players);
    pids.forEach((pid, i) => {
      room.players[pid].position  = spawnPosition(i);
      room.players[pid].rotation  = 0;
      room.players[pid].animation = "idle";
    });

    // Move to 'delegating' phase — each client signs their own chain txs
    room.phase = "delegating";
    room.delegatedPlayers = {};
    broadcastRoom(code);
  });

  // ── Player signals completed their on-chain delegation ────────────────────
  socket.on("playerDelegated", ({ code }) => {
    const room = rooms[code];
    if (!room || room.phase !== "delegating") return;

    room.delegatedPlayers[socket.id] = true;
    const totalPlayers   = Object.keys(room.players).length;
    const delegatedCount = Object.keys(room.delegatedPlayers).length;

    // Broadcast updated delegation status to show live progress
    io.to(code).emit("delegationProgress", {
      delegated: delegatedCount,
      total: totalPlayers,
      players: Object.entries(room.players).map(([id, p]) => ({
        id, name: p.name, color: p.color,
        done: !!room.delegatedPlayers[id],
      })),
    });

    // All players delegated — notify host to start
    if (delegatedCount >= totalPlayers) {
      room.allDelegated = true;
      io.to(code).emit("allDelegated");
    }
  });

  // ── Host syncs ER-assigned roles to server before countdown ends ──────────
  // Called by hostStartGame() after chain.syncAllState() resolves.
  // roles = { [walletPubkey]: "impostor" | "crewmate" }
  socket.on("syncRoles", ({ code, roles }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room._erRoles = roles; // stored until countdown ends
    console.log(`[syncRoles] room ${code}:`, Object.values(roles).reduce((a, r) => { a[r] = (a[r]||0)+1; return a; }, {}));
  });

  // ── Host manually starts countdown after all delegated ─────────────────────
  socket.on("beginCountdown", ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || !room.allDelegated) return;
    room.phase = "countdown";
    broadcastRoom(code);

    let count = 5;
    const interval = setInterval(() => {
      io.to(code).emit("countdownTick", { count });
      count--;
      if (count < 0) {
        clearInterval(interval);
        const pids = Object.keys(room.players);

        if (room._erRoles && Object.keys(room._erRoles).length > 0) {
          // Apply ER-assigned roles (walletPubkey → role) — source of truth
          pids.forEach(pid => {
            const wp = room.players[pid].walletPubkey;
            room.players[pid].role     = (wp && room._erRoles[wp]) || "crewmate";
            room.players[pid].alive    = true;
            room.players[pid].votedFor = null;
            room.players[pid].tasks    = { completed: [], total: 3 };
          });
          const crewmates      = pids.filter(pid => room.players[pid].role === "crewmate");
          room.taskProgress    = { completed: 0, total: crewmates.length * 3 };
          room.votes           = {};
          room.meetingCallerId = null;
          room.meetingVictimId = null;
        } else {
          // Fallback: server-random roles (ER sync didn't arrive in time)
          assignRoles(room);
        }

        // Send each player their own role privately
        pids.forEach(pid => {
          io.to(pid).emit("roleAssigned", { role: room.players[pid].role });
        });

        room.phase = "role_reveal";
        broadcastRoom(code);

        // Auto-advance to "playing" so later broadcastRoom calls use correct phase
        setTimeout(() => {
          if (!rooms[code] || rooms[code].phase !== "role_reveal") return;
          rooms[code].phase = "playing";
          broadcastRoom(code);
        }, 7000);
      }
    }, 1000);
  });

  // ── In-game movement ─────────────────────────────────────────────────────
  // Only update position on server. Emit a lightweight packet to other players.
  socket.on("move", ({ code, position, rotation, animation }) => {
    const room = rooms[code];
    if (!room?.players[socket.id]) return;
    const p    = room.players[socket.id];
    p.position  = position;
    p.rotation  = rotation;
    p.animation = animation;
    // Lightweight broadcast — only the fields needed for rendering
    socket.to(code).emit("playerMoved", {
      id:        socket.id,
      position,
      rotation,
      animation,
    });
  });

  // ── Kill player (impostor only) ───────────────────────────────────────────
  socket.on("killPlayer", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room) return;
    const killer = room.players[socket.id];
    const target = room.players[targetId];
    if (!killer || !target) return;
    if (killer.role !== "impostor") return;
    if (!killer.alive || !target.alive) return;
    if (getDistance(killer, target) > 2.5) {
      socket.emit("roomError", { message: "Too far away to kill!" }); return;
    }
    target.alive     = false;
    target.animation = "death";
    broadcastRoom(code);
    io.to(code).emit("playerKilled", { killerId: socket.id, victimId: targetId });
    const winner = checkWinCondition(room);
    if (winner) { room.phase = "results"; room.winner = winner; broadcastRoom(code); }
  });

  // ── Report body ───────────────────────────────────────────────────────────
  socket.on("reportBody", ({ code, bodyId }) => {
    const room = rooms[code];
    if (!room) return;
    const reporter = room.players[socket.id];
    if (!reporter?.alive) return;
    room.meetingCallerId = socket.id;
    room.meetingVictimId = bodyId;
    room.votes = {};
    room.phase = "meeting";
    room._meetingResolved = false;
    broadcastRoom(code);
    io.to(code).emit("meetingCalled", {
      callerId: socket.id, callerName: reporter.name,
      victimId: bodyId,    victimName: room.players[bodyId]?.name || "Unknown",
      type: "report",
    });
    startMeetingTimer(code);
  });

  // ── Emergency meeting ─────────────────────────────────────────────────────
  socket.on("emergencyMeeting", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    const caller = room.players[socket.id];
    if (!caller?.alive) return;
    room.meetingCallerId = socket.id;
    room.meetingVictimId = null;
    room.votes = {};
    room.phase = "meeting";
    room._meetingResolved = false;
    broadcastRoom(code);
    io.to(code).emit("meetingCalled", {
      callerId: socket.id, callerName: caller.name,
      victimId: null,      victimName: null,
      type: "emergency",
    });
    startMeetingTimer(code);
  });

  // ── Cast vote ─────────────────────────────────────────────────────────────
  socket.on("castVote", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || room.phase !== "meeting") return;
    const voter = room.players[socket.id];
    if (!voter?.alive || room.votes[socket.id]) return;
    room.votes[socket.id]  = targetId;
    voter.votedFor         = targetId;
    broadcastRoom(code);
    io.to(code).emit("voteUpdate", { voterId: socket.id, votes: room.votes });
    const alivePlayers = Object.values(room.players).filter(p => p.alive);
    if (Object.keys(room.votes).length >= alivePlayers.length) {
      if (room._meetingTimer) { clearInterval(room._meetingTimer); room._meetingTimer = null; }
      resolveMeeting(code);
    }
  });

  // ── Complete task ─────────────────────────────────────────────────────────
  socket.on("completeTask", ({ code, taskIndex }) => {
    const room = rooms[code];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player?.alive || player.role !== "crewmate") return;
    if (player.tasks.completed.includes(taskIndex)) return; // already done — ignore duplicate
    player.tasks.completed.push(taskIndex);
    room.taskProgress.completed  = Math.min(room.taskProgress.completed + 1, room.taskProgress.total);
    broadcastRoom(code);
    io.to(code).emit("taskCompleted", { playerId: socket.id, taskIndex, taskProgress: room.taskProgress });
    const winner = checkWinCondition(room);
    if (winner) { room.phase = "results"; room.winner = winner; broadcastRoom(code); }
  });

  // ── Back to lobby (host only) ─────────────────────────────────────────────
  socket.on("backToLobby", ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.phase   = "lobby";
    room.winner  = null;
    room.votes   = {};
    room.meetingCallerId  = null;
    room.meetingVictimId  = null;
    room.taskProgress     = { completed: 0, total: 0 };
    const pids = Object.keys(room.players);
    pids.forEach((pid, i) => {
      room.players[pid].role       = null;
      room.players[pid].alive      = true;
      room.players[pid].votedFor   = null;
      room.players[pid].ready      = false;
      room.players[pid].tasks      = { completed: [], total: 3 };
      room.players[pid].position   = spawnPosition(i);
    });
    broadcastRoom(code);
  });

  // ── Rejoin room (page refresh recovery) ──────────────────────────────────
  socket.on("rejoinRoom", ({ code, walletPubkey, name }) => {
    const room = rooms[code];
    if (!room) { socket.emit("roomError", { message: "Room no longer exists." }); return; }

    // Find the player's old entry by walletPubkey (primary) or name (fallback)
    let oldId = null;
    for (const [pid, p] of Object.entries(room.players)) {
      if (walletPubkey && p.walletPubkey === walletPubkey) { oldId = pid; break; }
    }
    if (!oldId) {
      for (const [pid, p] of Object.entries(room.players)) {
        if (p.name === name) { oldId = pid; break; }
      }
    }
    if (!oldId) { socket.emit("roomError", { message: "Not a member of this room." }); return; }

    // Cancel the pending hard-removal timer
    clearTimeout(reconnectTimers[oldId]);
    delete reconnectTimers[oldId];

    // Migrate player to new socket.id
    const playerData = { ...room.players[oldId], id: socket.id, disconnected: false };
    delete room.players[oldId];
    room.players[socket.id] = playerData;

    if (room.hostId === oldId) room.hostId = socket.id;

    // Preserve delegation status under new id
    if (room.delegatedPlayers?.[oldId]) {
      room.delegatedPlayers[socket.id] = true;
      delete room.delegatedPlayers[oldId];
    }

    socket.join(code);
    socket.emit("rejoinedRoom", { code, room });
    broadcastRoom(code);
    console.log(`${socket.id} rejoined room ${code} (was ${oldId})`);
  });

  // ── Leave room ────────────────────────────────────────────────────────────
  socket.on("leaveRoom", ({ code }) => {
    socket.leave(code);
    cleanupPlayer(socket.id, true); // explicit leave — always hard-remove
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    cleanupPlayer(socket.id); // soft in active phases, hard in lobby
  });
});

// ─── Meeting timer helper ─────────────────────────────────────────────────────
function startMeetingTimer(code) {
  const room = rooms[code];
  if (!room) return;
  let timeLeft = 60;
  const ticker = setInterval(() => {
    if (!rooms[code]) { clearInterval(ticker); return; }
    timeLeft--;
    io.to(code).emit("meetingTimer", { timeLeft });
    if (timeLeft <= 0) { clearInterval(ticker); resolveMeeting(code); }
  }, 1000);
  room._meetingTimer = ticker;
}

// ─── Meeting resolution ───────────────────────────────────────────────────────
function resolveMeeting(code) {
  const room = rooms[code];
  if (!room || room._meetingResolved) return;
  room._meetingResolved = true;

  if (room._meetingTimer) { clearInterval(room._meetingTimer); room._meetingTimer = null; }

  const tally = {};
  for (const v of Object.values(room.votes)) {
    tally[v] = (tally[v] || 0) + 1;
  }

  const skipCount = tally["skip"] || 0;
  let maxVotes = 0, ejectedId = null, tie = false;
  for (const [targetId, count] of Object.entries(tally)) {
    if (targetId === "skip") continue;
    if (count > maxVotes)        { maxVotes = count; ejectedId = targetId; tie = false; }
    else if (count === maxVotes) { tie = true; ejectedId = null; }
  }

  // Skip wins if: no votes, tie, or skips >= top player votes
  if (maxVotes === 0 || tie || skipCount >= maxVotes) ejectedId = null;

  const ejectedPlayer = ejectedId ? room.players[ejectedId] : null;
  if (ejectedId && ejectedPlayer) {
    ejectedPlayer.alive     = false;
    ejectedPlayer.animation = "idle";
  }

  for (const pid of Object.keys(room.players)) room.players[pid].votedFor = null;
  room.votes = {};

  const winner = checkWinCondition(room);

  io.to(code).emit("meetingResult", {
    ejected: ejectedPlayer ? { id: ejectedId, name: ejectedPlayer.name, role: ejectedPlayer.role } : null,
    tally,
    skipCount,
    tie: !ejectedId && maxVotes > 0 && skipCount < maxVotes,
    winner: winner || null,
  });

  if (winner) {
    setTimeout(() => {
      if (!rooms[code]) return;
      rooms[code].phase  = "results";
      rooms[code].winner = winner;
      broadcastRoom(code);
    }, 6000);
  } else {
    setTimeout(() => {
      if (!rooms[code]) return;
      rooms[code].phase = "playing";
      broadcastRoom(code);
    }, 6000);
  }
}

io.listen(3001);
console.log("Server listening on port 3001");
