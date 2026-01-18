import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();

export const SocketManager = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [players, setPlayers] = useState({});

  useEffect(() => {
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to server");
    });

    newSocket.on("players", (serverPlayers) => {
      console.log("Received players:", serverPlayers);
      setPlayers(serverPlayers);
    });

    newSocket.on("newPlayer", (player) => {
      console.log("New player joined:", player);
      setPlayers((prev) => ({ ...prev, [player.id]: player }));
    });

    newSocket.on("playerMoved", (player) => {
      setPlayers((prev) => ({ ...prev, [player.id]: player }));
    });

    newSocket.on("playerDisconnected", (id) => {
      setPlayers((prev) => {
        const newPlayers = { ...prev };
        delete newPlayers[id];
        return newPlayers;
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, players }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
