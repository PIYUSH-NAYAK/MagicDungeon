import { Server } from "socket.io";

const io = new Server({ cors: { origin: "*" } });

// ─── State ───────────────────────────────────────────────────────────────────
const rooms = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastRoom(code) {
  if (!rooms[code]) return;
  io.to(code).emit("roomUpdate", rooms[code]);
}

// Send each player their own private role
function broadcastRoles(code) {
  const room = rooms[code];
  if (!room) return;
  for (const pid of Object.keys(room.players)) {
    const role = room.players[pid].role;
    io.to(pid).emit("roleAssigned", { role });
  }
}

function assignRoles(room) {
  const pids = Object.keys(room.players);
  const impostorCount = Math.max(1, Math.floor(pids.length / 5));
  const shuffled = [...pids].sort(() => Math.random() - 0.5);
  for (let i = 0; i < pids.length; i++) {
    room.players[shuffled[i]].role  = i < impostorCount ? "impostor" : "crewmate";
    room.players[shuffled[i]].alive = true;
    room.players[shuffled[i]].tasks     = { completed: 0, total: 3 };
    room.players[shuffled[i]].votedFor  = null;
  }
  room.taskProgress   = { completed: 0, total: pids.length * 3 };
  room.votes          = {};
  room.meetingCallerId  = null;
  room.meetingVictimId  = null;
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
  const players         = Object.values(room.players);
  const aliveImpostors  = players.filter(p => p.role === "impostor" && p.alive);
  const aliveCrewmates  = players.filter(p => p.role === "crewmate" && p.alive);
  if (aliveImpostors.length >= aliveCrewmates.length) return "impostors";
  if (room.taskProgress.completed >= room.taskProgress.total) return "crewmates";
  if (aliveImpostors.length === 0) return "crewmates";
  return null;
}

function cleanupPlayer(socketId) {
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    if (!room.players[socketId]) continue;
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
    break;
  }
}

// ─── Socket handlers ─────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // ── Create room ──────────────────────────────────────────────────────────
  socket.on("createRoom", ({ name, color }) => {
    let code;
    do { code = generateCode(); } while (rooms[code]);

    rooms[code] = {
      code,
      hostId: socket.id,
      phase: "lobby",
      gameMode: "impostor",
      map: "castle_on_hills",
      maxPlayers: 10,
      taskProgress: { completed: 0, total: 0 },
      votes: {},
      meetingCallerId: null,
      meetingVictimId: null,
      players: {
        [socket.id]: {
          id: socket.id,
          name: name || "Player",
          color: color || "#e74c3c",
          ready: false,
          alive: true,
          role: null,
          votedFor: null,
          tasks:    { completed: 0, total: 3 },
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
  socket.on("joinRoom", ({ code, name, color }) => {
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
      name: name || "Player",
      color: color || "#3498db",
      ready: false,
      alive: true,
      role: null,
      votedFor: null,
      tasks:    { completed: 0, total: 3 },
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

    // Reset spawn positions so all players start from defined ring slots
    const pids = Object.keys(room.players);
    pids.forEach((pid, i) => {
      room.players[pid].position  = spawnPosition(i);
      room.players[pid].rotation  = 0;
      room.players[pid].animation = "idle";
    });

    room.phase = "countdown";
    broadcastRoom(code);

    let count = 5;
    const interval = setInterval(() => {
      io.to(code).emit("countdownTick", { count });
      count--;
      if (count < 0) {
        clearInterval(interval);
        assignRoles(room);
        room.phase = "role_reveal";
        broadcastRoom(code);
        broadcastRoles(code);
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
    player.tasks.completed       = Math.min(player.tasks.completed + 1, player.tasks.total);
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
      room.players[pid].tasks      = { completed: 0, total: 3 };
      room.players[pid].position   = spawnPosition(i);
    });
    broadcastRoom(code);
  });

  // ── Leave room ────────────────────────────────────────────────────────────
  socket.on("leaveRoom", ({ code }) => {
    socket.leave(code);
    cleanupPlayer(socket.id);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    cleanupPlayer(socket.id);
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
  if (!room) return;
  const tally = {};
  for (const v of Object.values(room.votes)) {
    tally[v] = (tally[v] || 0) + 1;
  }
  let maxVotes = 0, ejected = null, tie = false;
  for (const [targetId, count] of Object.entries(tally)) {
    if (targetId === "skip") continue;
    if (count > maxVotes)        { maxVotes = count; ejected = targetId; tie = false; }
    else if (count === maxVotes) { tie = true; }
  }
  if (tie) ejected = null;

  const result = {
    ejected: ejected ? { id: ejected, name: room.players[ejected]?.name, role: room.players[ejected]?.role } : null,
    tally, tie,
  };
  if (ejected && room.players[ejected]) {
    room.players[ejected].alive     = false;
    room.players[ejected].animation = "idle";
  }
  for (const pid of Object.keys(room.players)) { room.players[pid].votedFor = null; }
  room.votes = {};
  io.to(code).emit("meetingResult", result);

  const winner = checkWinCondition(room);
  if (winner) {
    setTimeout(() => { room.phase = "results"; room.winner = winner; broadcastRoom(code); }, 4000);
  } else {
    setTimeout(() => { room.phase = "playing"; broadcastRoom(code); }, 4000);
  }
}

io.listen(3001);
console.log("Server listening on port 3001");
