import { Server } from "socket.io";

const io = new Server({
  cors: {
    origin: "*",
  },
});

const players = {};

io.on("connection", (socket) => {
  console.log("Player connected: " + socket.id);

  // Initialize player with random position near center
  players[socket.id] = {
    id: socket.id,
    position: [Math.random() * 5, 0, Math.random() * 5],
    rotation: 0,
    animation: "idle",
  };

  // Send current players to new player
  socket.emit("players", players);

  // Broadcast new player to others
  socket.broadcast.emit("newPlayer", players[socket.id]);

  socket.on("move", (data) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      players[socket.id].rotation = data.rotation;
      players[socket.id].animation = data.animation;
      
      // Broadcast movement to everyone else
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected: " + socket.id);
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

io.listen(3001);
console.log("Server listening on port 3001");
